import { describe, expect, it } from 'vitest';
import { BlueData, Channel, Effect, GenericInstrument, Send } from '@blue/data';
import { ProjectSession } from '../../main/project-session';
import { ProjectHistory } from '../../main/project-history';
import {
  FakePublicationRecorder,
  MockHistoryContext,
} from '../../main/project-history-test-support';
import { applyProjectDocumentPatch } from './patch-document';
import { createProjectEditorSnapshot } from './snapshot-score';
import { getMixerChannelSnapshotId } from './identity';
import type { MixerChainClipboardPayload } from './contract';

/**
 * T119: mixer duplicate/paste insertion identities. The renderer allocates
 * fresh entry IDs once in the patch intent (see the project-store
 * normalization); these tests prove main adopts exactly those IDs for the
 * canonical model and that the IDs survive undo/redo and remain usable for
 * remove-by-entryId afterwards.
 */

function createMixerProject() {
  const data = new BlueData();
  const instrument = new GenericInstrument();
  instrument.setName('Lead');
  data.getArrangement().addInstrument(instrument, '1');
  const channel = new Channel();
  channel.setName('Lead Channel');
  channel.setAssociation('1');
  data.getMixer().getChannels().splice(0, 0, channel);
  return { data, channelId: getMixerChannelSnapshotId(channel) };
}

function createLibraryEffectXml(name = 'Delay'): string {
  const effect = new Effect();
  effect.setName(name);
  effect.setCode('aout = ain * 0.5');
  effect.setEnabled(true);
  effect.setNumIns(1);
  effect.setNumOuts(1);
  return effect.saveAsXML().toXml();
}

function clipboardEffectEntry(name: string) {
  return {
    entryId: `clipboard-${name}`,
    kind: 'effect' as const,
    effectXml: createLibraryEffectXml(name),
    name,
    enabled: true,
    numIns: 1,
    numOuts: 1,
    style: 'CLASSIC' as const,
    code: 'aout = ain',
    comments: '',
    editEnabled: false,
    gridSettings: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    objectNames: [],
    widgets: [],
    widgetTree: { type: 'bsbCanvas', children: [] },
    udos: [],
  };
}

function clipboardSendEntry(entryId: string) {
  return { entryId, kind: 'send' as const, sendChannel: 'Master', level: 0.25, enabled: true };
}

function preChainEntries(data: BlueData) {
  const snapshot = createProjectEditorSnapshot(data, null);
  return snapshot.mixer?.channels.find((entry) => entry.name === 'Lead Channel')?.preChain ?? [];
}

function setupHistory(data: BlueData) {
  const session = new ProjectSession();
  session.replace(data, '/tmp/mixer-identity.blue');
  const recorder = new FakePublicationRecorder();
  const history = new ProjectHistory({ session, publishUpdated: (evt) => recorder.record(evt) });
  const context = new MockHistoryContext('ctx-mixer-identity');
  const docId = session.read().documentId!;
  const live = () => session.read().data!;
  return { session, history, context, docId, live, recorder };
}

describe('mixer duplicate/paste identity adoption through project history (T119)', () => {
  it('adopts the renderer duplicate id canonically and keeps it stable across undo/redo', async () => {
    const { data, channelId } = createMixerProject();
    applyProjectDocumentPatch(data, {
      mixer: {
        type: 'addEffectFromLibrary',
        channelId,
        chain: 'pre',
        libraryEffectId: 'library-effect-1',
        effectXml: createLibraryEffectXml('Reverb'),
        entryId: 'source',
      },
    });
    const { history, context, docId, live } = setupHistory(data);

    const commit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Duplicate Mixer Chain Entry', [
        {
          mixer: {
            type: 'duplicateChainEntry',
            channelId,
            chain: 'pre',
            entryId: 'source',
            newEntryId: 'dup-effect-1',
          },
        },
      ]),
    );
    expect(commit.status).toBe('committed');

    let entries = preChainEntries(live());
    expect(entries).toHaveLength(2);
    expect(entries[1]?.entryId).toBe('dup-effect-1');
    expect(entries[1]?.projectRef?.entryId).toBe('dup-effect-1');

    const undo = await history.undo(context.nextUndoRequest(docId, 1));
    expect(undo.status).toBe('committed');
    expect(preChainEntries(live())).toHaveLength(1);

    const redo = await history.redo(context.nextRedoRequest(docId, 2));
    expect(redo.status).toBe('committed');
    entries = preChainEntries(live());
    expect(entries[1]?.entryId).toBe('dup-effect-1');
    expect(entries[1]?.projectRef?.entryId).toBe('dup-effect-1');
  });

  it('adopts the renderer duplicate id for a send and keeps it stable across undo/redo', async () => {
    const { data, channelId } = createMixerProject();
    applyProjectDocumentPatch(data, {
      mixer: {
        type: 'addSend',
        channelId,
        chain: 'pre',
        sendChannel: 'Master',
        level: 0.4,
        entryId: 'source-send',
      },
    });
    const { history, context, docId, live } = setupHistory(data);

    const commit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Duplicate Mixer Chain Entry', [
        {
          mixer: {
            type: 'duplicateChainEntry',
            channelId,
            chain: 'pre',
            entryId: 'source-send',
            newEntryId: 'dup-send-1',
          },
        },
      ]),
    );
    expect(commit.status).toBe('committed');
    expect(preChainEntries(live())[1]?.entryId).toBe('dup-send-1');
    expect(preChainEntries(live())[1]?.kind).toBe('send');

    await history.undo(context.nextUndoRequest(docId, 1));
    expect(preChainEntries(live())).toHaveLength(1);

    await history.redo(context.nextRedoRequest(docId, 2));
    expect(preChainEntries(live())[1]?.entryId).toBe('dup-send-1');
  });

  it('adopts fresh ids for a two-effect paste and keeps them stable across undo/redo', async () => {
    const { data, channelId } = createMixerProject();
    const { history, context, docId, live } = setupHistory(data);

    const payload: MixerChainClipboardPayload = {
      sourceKind: 'project',
      entries: [clipboardEffectEntry('Chorus'), clipboardEffectEntry('Phaser')],
    };

    const commit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Paste Mixer Chain Entries', [
        {
          mixer: {
            type: 'pasteChainEntries',
            channelId,
            chain: 'pre',
            payload,
            newEntryIds: ['paste-effect-1', 'paste-effect-2'],
          },
        },
      ]),
    );
    expect(commit.status).toBe('committed');

    let entries = preChainEntries(live());
    expect(entries).toHaveLength(2);
    expect(entries[0]?.entryId).toBe('paste-effect-1');
    expect(entries[0]?.projectRef?.entryId).toBe('paste-effect-1');
    expect(entries[1]?.entryId).toBe('paste-effect-2');
    expect(entries[1]?.projectRef?.entryId).toBe('paste-effect-2');

    await history.undo(context.nextUndoRequest(docId, 1));
    expect(preChainEntries(live())).toHaveLength(0);

    await history.redo(context.nextRedoRequest(docId, 2));
    entries = preChainEntries(live());
    expect(entries.map((entry) => entry.entryId)).toEqual(['paste-effect-1', 'paste-effect-2']);
  });

  it('adopts the renderer paste id for a send and keeps it stable across undo/redo', async () => {
    const { data, channelId } = createMixerProject();
    const { history, context, docId, live } = setupHistory(data);

    const payload: MixerChainClipboardPayload = {
      sourceKind: 'project',
      entries: [clipboardSendEntry('clipboard-send-1')],
    };
    const commit = await history.commit(
      context.nextCommitRequest(docId, 0, 'Paste Mixer Chain Entries', [
        {
          mixer: {
            type: 'pasteChainEntries',
            channelId,
            chain: 'pre',
            payload,
            newEntryIds: ['paste-send-1'],
          },
        },
      ]),
    );
    expect(commit.status).toBe('committed');
    expect(preChainEntries(live())[0]?.entryId).toBe('paste-send-1');
    expect(preChainEntries(live())[0]?.kind).toBe('send');

    await history.undo(context.nextUndoRequest(docId, 1));
    await history.redo(context.nextRedoRequest(docId, 2));
    expect(preChainEntries(live())[0]?.entryId).toBe('paste-send-1');
  });

  it('keeps repeated pastes distinct and stable across undo/redo', async () => {
    const { data, channelId } = createMixerProject();
    const { history, context, docId, live } = setupHistory(data);

    const payload: MixerChainClipboardPayload = {
      sourceKind: 'project',
      entries: [clipboardEffectEntry('Echo')],
    };

    await history.commit(
      context.nextCommitRequest(docId, 0, 'Paste Mixer Chain Entries', [
        {
          mixer: {
            type: 'pasteChainEntries',
            channelId,
            chain: 'pre',
            payload,
            newEntryIds: ['paste-a'],
          },
        },
      ]),
    );
    const second = await history.commit(
      context.nextCommitRequest(docId, 1, 'Paste Mixer Chain Entries', [
        {
          mixer: {
            type: 'pasteChainEntries',
            channelId,
            chain: 'pre',
            payload,
            newEntryIds: ['paste-b'],
          },
        },
      ]),
    );
    expect(second.status).toBe('committed');

    let ids = preChainEntries(live()).map((entry) => entry.entryId);
    expect(ids).toEqual(['paste-a', 'paste-b']);

    await history.undo(context.nextUndoRequest(docId, 2));
    ids = preChainEntries(live()).map((entry) => entry.entryId);
    expect(ids).toEqual(['paste-a']);

    await history.redo(context.nextRedoRequest(docId, 3));
    ids = preChainEntries(live()).map((entry) => entry.entryId);
    expect(ids).toEqual(['paste-a', 'paste-b']);
  });

  it('keeps the adopted duplicate id usable for removeChainEntry after acknowledgement', async () => {
    const { data, channelId } = createMixerProject();
    applyProjectDocumentPatch(data, {
      mixer: {
        type: 'addEffectFromLibrary',
        channelId,
        chain: 'pre',
        libraryEffectId: 'library-effect-1',
        effectXml: createLibraryEffectXml('Reverb'),
        entryId: 'source',
      },
    });
    const { history, context, docId, live } = setupHistory(data);

    await history.commit(
      context.nextCommitRequest(docId, 0, 'Duplicate Mixer Chain Entry', [
        {
          mixer: {
            type: 'duplicateChainEntry',
            channelId,
            chain: 'pre',
            entryId: 'source',
            newEntryId: 'dup-effect-1',
          },
        },
      ]),
    );

    // The renderer removes the duplicate by the same id it generated.
    const remove = await history.commit(
      context.nextCommitRequest(docId, 1, 'Remove Mixer Chain Entry', [
        { mixer: { type: 'removeChainEntry', channelId, chain: 'pre', entryId: 'dup-effect-1' } },
      ]),
    );
    expect(remove.status).toBe('committed');
    expect(preChainEntries(live())).toHaveLength(1);

    // Undoing the removal brings the duplicate back with its original id.
    await history.undo(context.nextUndoRequest(docId, 2));
    expect(preChainEntries(live())[1]?.entryId).toBe('dup-effect-1');
  });

  it('keeps the adopted paste id usable for removeChainEntry of a send after acknowledgement', async () => {
    const { data, channelId } = createMixerProject();
    const { history, context, docId, live } = setupHistory(data);

    const payload: MixerChainClipboardPayload = {
      sourceKind: 'project',
      entries: [clipboardSendEntry('clipboard-send-1')],
    };
    await history.commit(
      context.nextCommitRequest(docId, 0, 'Paste Mixer Chain Entries', [
        {
          mixer: {
            type: 'pasteChainEntries',
            channelId,
            chain: 'pre',
            payload,
            newEntryIds: ['paste-send-1'],
          },
        },
      ]),
    );

    const remove = await history.commit(
      context.nextCommitRequest(docId, 1, 'Remove Mixer Chain Entry', [
        { mixer: { type: 'removeChainEntry', channelId, chain: 'pre', entryId: 'paste-send-1' } },
      ]),
    );
    expect(remove.status).toBe('committed');
    expect(preChainEntries(live())).toHaveLength(0);

    await history.undo(context.nextUndoRequest(docId, 2));
    expect(preChainEntries(live())[0]?.entryId).toBe('paste-send-1');
  });

  describe('meter presentation patches (T010)', () => {
    it('applies setMeterEnabled and returns false on same value', () => {
      const data = new BlueData();
      expect(data.getMixer().isEnableMeters()).toBe(true);

      // Same value no-op
      expect(
        applyProjectDocumentPatch(data, { mixer: { type: 'setMeterEnabled', value: true } }),
      ).toBe(false);
      expect(data.getMixer().isEnableMeters()).toBe(true);

      // Value change
      expect(
        applyProjectDocumentPatch(data, { mixer: { type: 'setMeterEnabled', value: false } }),
      ).toBe(true);
      expect(data.getMixer().isEnableMeters()).toBe(false);
    });

    it('applies setMeterProfile and returns false on same value or invalid key', () => {
      const data = new BlueData();
      expect(data.getMixer().getMeterProfileKey()).toBe('peak-rms-mixing-plus-6');

      // Same value no-op
      expect(
        applyProjectDocumentPatch(data, {
          mixer: { type: 'setMeterProfile', value: 'peak-rms-mixing-plus-6' },
        }),
      ).toBe(false);

      // Change value
      expect(
        applyProjectDocumentPatch(data, {
          mixer: { type: 'setMeterProfile', value: 'k14-rms-peak' },
        }),
      ).toBe(true);
      expect(data.getMixer().getMeterProfileKey()).toBe('k14-rms-peak');

      // Invalid key rejection throws Error from validateProjectDocumentPatch
      expect(() =>
        applyProjectDocumentPatch(data, {
          mixer: { type: 'setMeterProfile', value: 'invalid-key' as any },
        }),
      ).toThrow();
      expect(data.getMixer().getMeterProfileKey()).toBe('k14-rms-peak');
    });

    it('round-trips setMeterEnabled and setMeterProfile through ProjectHistory', async () => {
      const { data } = createMixerProject();
      const { history, context, docId, live } = setupHistory(data);

      expect(live().getMixer().isEnableMeters()).toBe(true);
      expect(live().getMixer().getMeterProfileKey()).toBe('peak-rms-mixing-plus-6');

      // Commit Disable Meters
      const commitDisable = await history.commit(
        context.nextCommitRequest(docId, 0, 'Disable Meters', [
          { mixer: { type: 'setMeterEnabled', value: false } },
        ]),
      );
      expect(commitDisable.status).toBe('committed');
      expect(live().getMixer().isEnableMeters()).toBe(false);

      // Commit Set Meter Profile
      const commitProfile = await history.commit(
        context.nextCommitRequest(docId, 1, 'Set Meter Profile', [
          { mixer: { type: 'setMeterProfile', value: 'k20-rms-peak' } },
        ]),
      );
      expect(commitProfile.status).toBe('committed');
      expect(live().getMixer().getMeterProfileKey()).toBe('k20-rms-peak');

      // Undo Set Meter Profile
      const undoProfile = await history.undo(context.nextUndoRequest(docId, 2));
      expect(undoProfile.status).toBe('committed');
      expect(live().getMixer().getMeterProfileKey()).toBe('peak-rms-mixing-plus-6');
      expect(live().getMixer().isEnableMeters()).toBe(false);

      // Undo Disable Meters
      const undoDisable = await history.undo(context.nextUndoRequest(docId, 3));
      expect(undoDisable.status).toBe('committed');
      expect(live().getMixer().isEnableMeters()).toBe(true);

      // Redo Disable Meters
      const redoDisable = await history.redo(context.nextRedoRequest(docId, 4));
      expect(redoDisable.status).toBe('committed');
      expect(live().getMixer().isEnableMeters()).toBe(false);
    });
  });
});
