import { describe, expect, it } from 'vitest';
import { BlueData, Channel, Effect, GenericInstrument, Send } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  getMixerChannelSnapshotId,
} from '../../shared/project-editor';
import type { MixerChainClipboardPayload } from '../../shared/project-editor';

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

function createTwoChannelMixerProject() {
  const data = new BlueData();

  const instrument1 = new GenericInstrument();
  instrument1.setName('Lead');
  data.getArrangement().addInstrument(instrument1, '1');

  const instrument2 = new GenericInstrument();
  instrument2.setName('Bass');
  data.getArrangement().addInstrument(instrument2, '2');

  const channel1 = new Channel();
  channel1.setName('Lead Channel');
  channel1.setAssociation('1');
  data.getMixer().getChannels().splice(0, 0, channel1);

  const channel2 = new Channel();
  channel2.setName('Bass Channel');
  channel2.setAssociation('2');
  data.getMixer().getChannels().splice(1, 0, channel2);

  return {
    data,
    channel1Id: getMixerChannelSnapshotId(channel1),
    channel2Id: getMixerChannelSnapshotId(channel2),
  };
}

function createLibraryEffectXml(name = 'Delay'): string {
  const effect = new Effect();
  effect.setName(name);
  effect.setComments('Library note');
  effect.setCode('aout = ain * 0.5');
  effect.setEnabled(true);
  effect.setNumIns(1);
  effect.setNumOuts(1);
  return effect.saveAsXML().toXml();
}

describe('Mixer chain clipboard patches', () => {
  it('duplicateChainEntry duplicates an effect entry', () => {
    const { data, channelId } = createMixerProject();

    applyProjectDocumentPatch(data, {
      mixer: {
        type: 'addEffectFromLibrary',
        channelId,
        chain: 'pre',
        libraryEffectId: 'library-effect-1',
        effectXml: createLibraryEffectXml('Delay'),
        entryId: 'effect-1',
      },
    });

    let snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.preChain).toHaveLength(1);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'duplicateChainEntry',
          channelId,
          chain: 'pre',
          entryId: 'effect-1',
          newEntryId: 'effect-duplicate-1',
        },
      }),
    ).toBe(true);

    snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.preChain).toHaveLength(2);
    expect(snapshot.mixer?.channels[0]?.preChain[0]).toEqual(
      expect.objectContaining({
        entryId: 'effect-1',
        kind: 'effect',
        name: 'Delay',
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[1]).toEqual(
      expect.objectContaining({
        kind: 'effect',
        name: 'Delay',
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[1]?.entryId).toBe('effect-duplicate-1');
    expect(snapshot.mixer?.channels[0]?.preChain[1]).toEqual(
      expect.objectContaining({
        projectRef: expect.objectContaining({ entryId: 'effect-duplicate-1' }),
      }),
    );
  });

  it('duplicateChainEntry duplicates a send entry', () => {
    const { data, channelId } = createMixerProject();

    applyProjectDocumentPatch(data, {
      mixer: {
        type: 'addSend',
        channelId,
        chain: 'pre',
        sendChannel: 'master',
        level: 0.5,
        entryId: 'send-1',
      },
    });

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'duplicateChainEntry',
          channelId,
          chain: 'pre',
          entryId: 'send-1',
          newEntryId: 'send-duplicate-1',
        },
      }),
    ).toBe(true);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.preChain).toHaveLength(2);
    expect(snapshot.mixer?.channels[0]?.preChain[0]).toEqual(
      expect.objectContaining({
        entryId: 'send-1',
        kind: 'send',
        sendChannel: 'master',
        level: 0.5,
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[1]).toEqual(
      expect.objectContaining({
        kind: 'send',
        sendChannel: 'master',
        level: 0.5,
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[1]?.entryId).toBe('send-duplicate-1');
  });

  it('duplicateChainEntry returns false for non-existent entry', () => {
    const { data, channelId } = createMixerProject();

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'duplicateChainEntry',
          channelId,
          chain: 'pre',
          entryId: 'non-existent',
        },
      }),
    ).toBe(false);
  });

  it('copyChainEntry returns true without mutating', () => {
    const { data, channelId } = createMixerProject();

    applyProjectDocumentPatch(data, {
      mixer: {
        type: 'addEffectFromLibrary',
        channelId,
        chain: 'pre',
        libraryEffectId: 'library-effect-1',
        effectXml: createLibraryEffectXml('Delay'),
        entryId: 'effect-1',
      },
    });

    const beforeSnapshot = createProjectEditorSnapshot(data, null);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'copyChainEntry',
          channelId,
          chain: 'pre',
          entryId: 'effect-1',
        },
      }),
    ).toBe(true);

    const afterSnapshot = createProjectEditorSnapshot(data, null);
    expect(afterSnapshot.mixer?.channels[0]?.preChain).toHaveLength(
      beforeSnapshot.mixer?.channels[0]?.preChain.length ?? 0,
    );
    expect(afterSnapshot.mixer?.channels[0]?.preChain[0]).toEqual(
      beforeSnapshot.mixer?.channels[0]?.preChain[0],
    );
  });

  it('pasteChainEntries pastes 2 effect entries at index 1', () => {
    const { data, channelId } = createMixerProject();

    applyProjectDocumentPatch(data, {
      mixer: {
        type: 'addEffectFromLibrary',
        channelId,
        chain: 'pre',
        libraryEffectId: 'library-effect-1',
        effectXml: createLibraryEffectXml('Reverb'),
        entryId: 'existing-1',
      },
    });

    const payload: MixerChainClipboardPayload = {
      sourceKind: 'project',
      entries: [
        {
          entryId: 'clipboard-1',
          kind: 'effect',
          effectXml: createLibraryEffectXml('Chorus'),
          name: 'Chorus',
          enabled: true,
          numIns: 1,
          numOuts: 1,
          style: 'CLASSIC',
          code: 'aout = ain',
          comments: '',
          editEnabled: false,
          gridSettings: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
          objectNames: [],
          widgets: [],
          widgetTree: { type: 'bsbCanvas', children: [] },
          udos: [],
        },
        {
          entryId: 'clipboard-2',
          kind: 'effect',
          effectXml: createLibraryEffectXml('Phaser'),
          name: 'Phaser',
          enabled: true,
          numIns: 1,
          numOuts: 1,
          style: 'CLASSIC',
          code: 'aout = ain',
          comments: '',
          editEnabled: false,
          gridSettings: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
          objectNames: [],
          widgets: [],
          widgetTree: { type: 'bsbCanvas', children: [] },
          udos: [],
        },
      ],
    };

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'pasteChainEntries',
          channelId,
          chain: 'pre',
          index: 1,
          payload,
          newEntryIds: ['paste-effect-1', 'paste-effect-2'],
        },
      }),
    ).toBe(true);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.preChain).toHaveLength(3);
    expect(snapshot.mixer?.channels[0]?.preChain[0]).toEqual(
      expect.objectContaining({
        entryId: 'existing-1',
        kind: 'effect',
        name: 'Reverb',
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[1]).toEqual(
      expect.objectContaining({
        kind: 'effect',
        name: 'Chorus',
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[2]).toEqual(
      expect.objectContaining({
        entryId: 'paste-effect-2',
        kind: 'effect',
        name: 'Phaser',
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[1]).toEqual(
      expect.objectContaining({
        entryId: 'paste-effect-1',
        projectRef: expect.objectContaining({ entryId: 'paste-effect-1' }),
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[2]).toEqual(
      expect.objectContaining({
        projectRef: expect.objectContaining({ entryId: 'paste-effect-2' }),
      }),
    );
  });

  it('pasteChainEntries pastes a send entry', () => {
    const { data, channelId } = createMixerProject();

    const payload: MixerChainClipboardPayload = {
      sourceKind: 'project',
      entries: [
        {
          entryId: 'clipboard-send-1',
          kind: 'send',
          sendChannel: 'master',
          level: 0.75,
          enabled: true,
        },
      ],
    };

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'pasteChainEntries',
          channelId,
          chain: 'post',
          payload,
          newEntryIds: ['paste-send-1'],
        },
      }),
    ).toBe(true);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.postChain).toHaveLength(1);
    expect(snapshot.mixer?.channels[0]?.postChain[0]).toEqual(
      expect.objectContaining({
        kind: 'send',
        entryId: 'paste-send-1',
        sendChannel: 'master',
        level: 0.75,
        enabled: true,
      }),
    );
  });

  it('moveChainEntryAcrossChains moves an entry between channels', () => {
    const { data, channel1Id, channel2Id } = createTwoChannelMixerProject();

    applyProjectDocumentPatch(data, {
      mixer: {
        type: 'addEffectFromLibrary',
        channelId: channel1Id,
        chain: 'pre',
        libraryEffectId: 'library-effect-1',
        effectXml: createLibraryEffectXml('Delay'),
        entryId: 'effect-move',
      },
    });

    let snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.preChain).toHaveLength(1);
    expect(snapshot.mixer?.channels[1]?.postChain).toHaveLength(0);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'moveChainEntryAcrossChains',
          fromChannelId: channel1Id,
          fromChain: 'pre',
          toChannelId: channel2Id,
          toChain: 'post',
          entryId: 'effect-move',
        },
      }),
    ).toBe(true);

    snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.preChain).toHaveLength(0);
    expect(snapshot.mixer?.channels[1]?.postChain).toHaveLength(1);
    expect(snapshot.mixer?.channels[1]?.postChain[0]).toEqual(
      expect.objectContaining({
        entryId: 'effect-move',
        kind: 'effect',
        name: 'Delay',
      }),
    );
  });

  it('moveChainEntryAcrossChains returns false when source chain does not have the entry', () => {
    const { data, channel1Id, channel2Id } = createTwoChannelMixerProject();

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'moveChainEntryAcrossChains',
          fromChannelId: channel1Id,
          fromChain: 'pre',
          toChannelId: channel2Id,
          toChain: 'post',
          entryId: 'non-existent',
        },
      }),
    ).toBe(false);
  });
});
