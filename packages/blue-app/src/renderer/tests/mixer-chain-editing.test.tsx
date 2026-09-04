import { describe, expect, it } from 'vitest';
import { BlueData, Channel, Effect, GenericInstrument } from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  getMixerChannelSnapshotId,
} from '../../shared/project-editor';

function createMixerProject(): {
  data: BlueData;
  channelId: string;
} {
  const data = new BlueData();

  const instrument = new GenericInstrument();
  instrument.setName('Lead');
  data.getArrangement().addInstrument(instrument, '1');

  const channel = new Channel();
  channel.setName('Lead Channel');
  channel.setAssociation('1');
  data.getMixer().getChannels().splice(0, 0, channel);

  return {
    data,
    channelId: getMixerChannelSnapshotId(channel),
  };
}

function createLibraryEffectXml(): string {
  const effect = new Effect();
  effect.setName('Delay');
  effect.setComments('Library note');
  effect.setCode('aout = ain * 0.5');
  effect.setEnabled(true);
  effect.setNumIns(1);
  effect.setNumOuts(1);
  return effect.saveAsXML().toXml();
}

describe('Mixer chain editing', () => {
  it('adds, reorders, disables, and removes mixer chain entries', () => {
    const { data, channelId } = createMixerProject();

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'addEffectFromLibrary',
          channelId,
          chain: 'pre',
          libraryEffectId: 'library-effect-1',
          effectXml: createLibraryEffectXml(),
          entryId: 'effect-1',
        },
      }),
    ).toBe(true);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'addSend',
          channelId,
          chain: 'pre',
          sendChannel: 'master',
          level: 0.5,
          entryId: 'send-1',
        },
      }),
    ).toBe(true);

    let snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels).toHaveLength(1);
    expect(snapshot.mixer?.channels[0]?.preChain).toHaveLength(2);
    expect(snapshot.mixer?.channels[0]?.preChain[0]).toEqual(
      expect.objectContaining({
        entryId: 'effect-1',
        kind: 'effect',
        name: 'Delay',
        comments: 'Library note',
        enabled: true,
      }),
    );
    expect(snapshot.mixer?.channels[0]?.preChain[1]).toEqual(
      expect.objectContaining({
        entryId: 'send-1',
        kind: 'send',
        sendChannel: 'master',
        level: 0.5,
        enabled: true,
      }),
    );

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'reorderChainEntry',
          channelId,
          chain: 'pre',
          from: 1,
          to: 0,
        },
      }),
    ).toBe(true);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'updateEffect',
          channelId,
          chain: 'pre',
          entryId: 'effect-1',
          patch: {
            enabled: false,
          },
        },
      }),
    ).toBe(true);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'removeChainEntry',
          channelId,
          chain: 'pre',
          entryId: 'effect-1',
        },
      }),
    ).toBe(true);

    snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.preChain).toHaveLength(1);
    expect(snapshot.mixer?.channels[0]?.preChain[0]).toEqual(
      expect.objectContaining({
        entryId: 'send-1',
        kind: 'send',
        sendChannel: 'master',
        level: 0.5,
        enabled: true,
      }),
    );
  });

  it('updates send target, level, and enabled state', () => {
    const { data, channelId } = createMixerProject();

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'addSend',
          channelId,
          chain: 'post',
          entryId: 'send-2',
        },
      }),
    ).toBe(true);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'updateSend',
          channelId,
          chain: 'post',
          entryId: 'send-2',
          patch: {
            sendChannel: 'master',
            level: 0.25,
            enabled: false,
          },
        },
      }),
    ).toBe(true);

    const snapshot = createProjectEditorSnapshot(data, null);
    expect(snapshot.mixer?.channels[0]?.postChain).toHaveLength(1);
    expect(snapshot.mixer?.channels[0]?.postChain[0]).toEqual(
      expect.objectContaining({
        entryId: 'send-2',
        kind: 'send',
        sendChannel: 'master',
        level: 0.25,
        enabled: false,
      }),
    );
  });
});
