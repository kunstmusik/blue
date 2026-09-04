import { describe, expect, it } from 'vitest';
import {
  TrackLayer,
  TrackLayerGroup,
  BlueData,
  Channel,
  Effect,
  GenericInstrument,
  Send,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  createProjectEditorSnapshot,
  getMixerChannelSnapshotId,
  getMixerEntrySnapshotId,
} from '../../shared/project-editor';

function createMixerProject(): {
  data: BlueData;
  channel: Channel;
  effect: Effect;
} {
  const data = new BlueData();

  const instrument = new GenericInstrument();
  instrument.setName('Lead');
  data.getArrangement().addInstrument(instrument, '1');

  const channel = new Channel();
  channel.setName('Lead Channel');
  channel.setAssociation('1');
  data.getMixer().getChannels().splice(0, 0, channel);

  const effect = new Effect();
  effect.setName('Warmth');
  effect.setComments('Original note');
  effect.setCode('aout = ain');
  channel.getPreEffects().splice(0, 0, effect);

  return { data, channel, effect };
}

describe('Mixer contract', () => {
  it('captures mixer state and effect comments in the project snapshot', () => {
    const { data } = createMixerProject();
    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');

    expect(snapshot.mixer).toBeDefined();
    expect(snapshot.mixer?.channels).toHaveLength(1);
    expect(snapshot.mixer?.channels[0]?.preChain[0]).toEqual(
      expect.objectContaining({
        kind: 'effect',
        name: 'Warmth',
        comments: 'Original note',
      }),
    );
  });

  it('applies mixer patches to the canonical BlueData mixer and effect model', () => {
    const { data, channel, effect } = createMixerProject();
    const channelId = getMixerChannelSnapshotId(channel);
    const entryId = getMixerEntrySnapshotId(effect);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'setMixerEnabled',
          value: false,
        },
      }),
    ).toBe(true);
    expect(data.getMixer().isEnabled()).toBe(false);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'updateEffect',
          channelId,
          chain: 'pre',
          entryId,
          patch: {
            comments: 'Updated note',
          },
        },
      }),
    ).toBe(true);

    expect(effect.getComments()).toBe('Updated note');

    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');
    expect(snapshot.mixer?.channels[0]?.preChain[0]).toEqual(
      expect.objectContaining({
        kind: 'effect',
        comments: 'Updated note',
      }),
    );
  });

  it('stores audio-layer source channels in mixer channelListGroups and keeps orchestra channels flat', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const instrument = new GenericInstrument();
    instrument.setName('Lead');
    data.getArrangement().addInstrument(instrument, '1');

    const audioGroup = new TrackLayerGroup();
    const layerA = new TrackLayer();
    layerA.setName('Audio A');
    const layerB = new TrackLayer();
    layerB.setName('Audio B');
    audioGroup.push(layerA);
    audioGroup.push(layerB);
    data.getScore().push(audioGroup);

    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');

    expect(snapshot.mixer?.channelListGroups).toHaveLength(1);
    expect(snapshot.mixer?.channelListGroups[0]?.association).toBe(audioGroup.getUniqueId());
    expect(snapshot.mixer?.channelListGroups[0]?.listName).toBe(audioGroup.getName());
    expect(
      snapshot.mixer?.channelListGroups[0]?.channels.map((channel) => ({
        name: channel.name,
        association: channel.association,
      })),
    ).toEqual([
      { name: 'Audio A', association: layerA.getUniqueId() },
      { name: 'Audio B', association: layerB.getUniqueId() },
    ]);

    expect(
      snapshot.mixer?.channels.map((channel) => ({
        name: channel.name,
        association: channel.association,
      })),
    ).toEqual([{ name: 'Lead', association: '1' }]);

    expect(
      Array.from(data.getMixer().getChannelListGroups()[0] ?? [], (channel) =>
        channel.getAssociation(),
      ),
    ).toEqual([layerA.getUniqueId(), layerB.getUniqueId()]);
    expect(
      Array.from(data.getMixer().getChannels(), (channel) => channel.getAssociation()),
    ).toEqual(['1']);
  });

  it('renames the bound audio layer when an audio mixer channel name changes canonically', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const audioGroup = new TrackLayerGroup();
    const layer = new TrackLayer();
    layer.setName('Layer 1');
    audioGroup.push(layer);
    data.getScore().push(audioGroup);

    createProjectEditorSnapshot(data, '/tmp/test.blue');
    const channel = data.getMixer().getChannelListGroups()[0]?.[0];
    const channelId = getMixerChannelSnapshotId(channel!);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'updateChannel',
          channelId,
          patch: { name: 'Renamed From Mixer' },
        },
      }),
    ).toBe(true);

    expect(channel?.getName()).toBe('Renamed From Mixer');
    expect(layer.getName()).toBe('Renamed From Mixer');
  });

  it('syncs mixer channel list group label when audio layer group name changes', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const audioGroup = new TrackLayerGroup();
    audioGroup.setName('Original Group Name');
    const layer = new TrackLayer();
    layer.setName('Layer 1');
    audioGroup.push(layer);
    data.getScore().push(audioGroup);

    const initialSnapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');
    const groupId = initialSnapshot.score?.layerGroups[0]?.groupId;
    expect(groupId).toBeDefined();

    expect(
      applyProjectDocumentPatch(data, {
        score: {
          type: 'renameLayerGroup',
          groupId: groupId!,
          name: 'Renamed Group Name',
        },
      }),
    ).toBe(true);

    expect(data.getMixer().getChannelListGroups()[0]?.getListName()).toBe('Renamed Group Name');
    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');
    expect(snapshot.mixer?.channelListGroups[0]?.listName).toBe('Renamed Group Name');
  });

  it('renaming mixer channel list group label syncs back to the audio layer group', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const audioGroup = new TrackLayerGroup();
    audioGroup.setName('Original Group Name');
    const layer = new TrackLayer();
    layer.setName('Layer 1');
    audioGroup.push(layer);
    data.getScore().push(audioGroup);

    createProjectEditorSnapshot(data, '/tmp/test.blue');

    expect(
      applyProjectDocumentPatch(data, {
        mixer: {
          type: 'renameChannelListGroup',
          association: audioGroup.getUniqueId(),
          name: 'Renamed From Mixer',
        },
      }),
    ).toBe(true);

    expect(audioGroup.getName()).toBe('Renamed From Mixer');
    expect(data.getMixer().getChannelListGroups()[0]?.getListName()).toBe('Renamed From Mixer');
  });

  it('generates unique subchannel names when adding subchannels', () => {
    const data = new BlueData();

    expect(
      applyProjectDocumentPatch(data, {
        mixer: { type: 'addSubChannel' },
      }),
    ).toBe(true);
    expect(data.getMixer().getSubChannels()).toHaveLength(1);
    expect(data.getMixer().getSubChannels()[0].getName()).toBe('SubChannel1');

    expect(
      applyProjectDocumentPatch(data, {
        mixer: { type: 'addSubChannel' },
      }),
    ).toBe(true);
    expect(data.getMixer().getSubChannels()).toHaveLength(2);
    expect(data.getMixer().getSubChannels()[1].getName()).toBe('SubChannel2');
  });

  it('skips name collisions when generating unique subchannel names', () => {
    const data = new BlueData();
    const existing = new Channel();
    existing.setName('SubChannel1');
    data.getMixer().getSubChannels().push(existing);

    expect(
      applyProjectDocumentPatch(data, {
        mixer: { type: 'addSubChannel' },
      }),
    ).toBe(true);
    expect(data.getMixer().getSubChannels()).toHaveLength(2);
    expect(data.getMixer().getSubChannels()[1].getName()).toBe('SubChannel2');
  });

  it('respects explicit name in addSubChannel patch', () => {
    const data = new BlueData();

    expect(
      applyProjectDocumentPatch(data, {
        mixer: { type: 'addSubChannel', name: 'ReverbBus' },
      }),
    ).toBe(true);
    expect(data.getMixer().getSubChannels()[0].getName()).toBe('ReverbBus');
  });

  it('reconciles outChannel references when renaming a subchannel', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Reverb');
    data.getMixer().getSubChannels().push(sub1);

    const sub2 = new Channel();
    sub2.setName('Delay');
    sub2.setOutChannel('Reverb');
    data.getMixer().getSubChannels().push(sub2);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'updateChannel', channelId: sub1Id, patch: { name: 'BigReverb' } },
    });

    expect(sub1.getName()).toBe('BigReverb');
    expect(sub2.getOutChannel()).toBe('BigReverb');
  });

  it('reconciles sendChannel references when renaming a subchannel', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Reverb');
    data.getMixer().getSubChannels().push(sub1);

    const sub2 = new Channel();
    sub2.setName('Delay');
    const send = new Send();
    send.setSendChannel('Reverb');
    sub2.getPreEffects().push(send);
    data.getMixer().getSubChannels().push(sub2);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'updateChannel', channelId: sub1Id, patch: { name: 'BigReverb' } },
    });

    expect(send.getSendChannel()).toBe('BigReverb');
  });

  it('reconciles outChannel and sendChannel on instrument channels when renaming a subchannel', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Reverb');
    data.getMixer().getSubChannels().push(sub1);

    const instrument = new GenericInstrument();
    instrument.setName('Lead');
    data.getArrangement().addInstrument(instrument, '1');

    const channel = new Channel();
    channel.setName('Lead Channel');
    channel.setAssociation('1');
    channel.setOutChannel('Reverb');
    const send = new Send();
    send.setSendChannel('Reverb');
    channel.getPreEffects().push(send);
    data.getMixer().getChannels().push(channel);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'updateChannel', channelId: sub1Id, patch: { name: 'Hall' } },
    });

    expect(channel.getOutChannel()).toBe('Hall');
    expect(send.getSendChannel()).toBe('Hall');
  });

  it('resets references to Master when a subchannel is removed', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Reverb');
    data.getMixer().getSubChannels().push(sub1);

    const sub2 = new Channel();
    sub2.setName('Delay');
    sub2.setOutChannel('Reverb');
    const send = new Send();
    send.setSendChannel('Reverb');
    sub2.getPreEffects().push(send);
    data.getMixer().getSubChannels().push(sub2);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'removeSubChannel', channelId: sub1Id },
    });

    expect(data.getMixer().getSubChannels()).toHaveLength(1);
    expect(sub2.getOutChannel()).toBe('Master');
    expect(send.getSendChannel()).toBe('Master');
  });

  it('does not reconcile references when renaming a non-subchannel', () => {
    const data = new BlueData();

    const instrument = new GenericInstrument();
    instrument.setName('Lead');
    data.getArrangement().addInstrument(instrument, '1');

    const channel = new Channel();
    channel.setName('Lead Channel');
    channel.setAssociation('1');
    channel.setOutChannel('Master');
    data.getMixer().getChannels().push(channel);

    const channelId = getMixerChannelSnapshotId(channel);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'updateChannel', channelId, patch: { name: 'Lead Ch' } },
    });

    expect(channel.getName()).toBe('Lead Ch');
    expect(channel.getOutChannel()).toBe('Master');
  });

  it('reconciles rename in snapshot', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Reverb');
    data.getMixer().getSubChannels().push(sub1);

    const sub2 = new Channel();
    sub2.setName('Delay');
    sub2.setOutChannel('Reverb');
    const send = new Send();
    send.setSendChannel('Reverb');
    sub2.getPostEffects().push(send);
    data.getMixer().getSubChannels().push(sub2);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'updateChannel', channelId: sub1Id, patch: { name: 'Hall' } },
    });

    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');
    const delaySnapshot = snapshot.mixer?.subChannels.find((sc) => sc.name === 'Delay');
    expect(delaySnapshot?.outChannel).toBe('Hall');
    expect(delaySnapshot?.postChain[0]).toEqual(
      expect.objectContaining({ kind: 'send', sendChannel: 'Hall' }),
    );
  });

  it('reconciles multi-hop chain when renaming a subchannel', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Sub1');
    data.getMixer().getSubChannels().push(sub1);

    const sub2 = new Channel();
    sub2.setName('Sub2');
    sub2.setOutChannel('Sub1');
    data.getMixer().getSubChannels().push(sub2);

    const sub3 = new Channel();
    sub3.setName('Sub3');
    sub3.setOutChannel('Sub2');
    const send = new Send();
    send.setSendChannel('Sub1');
    sub3.getPreEffects().push(send);
    data.getMixer().getSubChannels().push(sub3);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'updateChannel', channelId: sub1Id, patch: { name: 'Renamed' } },
    });

    expect(sub2.getOutChannel()).toBe('Renamed');
    expect(sub3.getOutChannel()).toBe('Sub2');
    expect(send.getSendChannel()).toBe('Renamed');
  });

  it('resets master channel sends to Master when a subchannel is removed', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Reverb');
    data.getMixer().getSubChannels().push(sub1);

    const masterSend = new Send();
    masterSend.setSendChannel('Reverb');
    data.getMixer().getMaster().getPreEffects().push(masterSend);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'removeSubChannel', channelId: sub1Id },
    });

    expect(masterSend.getSendChannel()).toBe('Master');
  });

  it('resets instrument channel sends and outChannel to Master when a subchannel is removed', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Reverb');
    data.getMixer().getSubChannels().push(sub1);

    const instrument = new GenericInstrument();
    instrument.setName('Lead');
    data.getArrangement().addInstrument(instrument, '1');

    const channel = new Channel();
    channel.setName('Lead Channel');
    channel.setAssociation('1');
    channel.setOutChannel('Reverb');
    const send = new Send();
    send.setSendChannel('Reverb');
    channel.getPostEffects().push(send);
    data.getMixer().getChannels().push(channel);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'removeSubChannel', channelId: sub1Id },
    });

    expect(channel.getOutChannel()).toBe('Master');
    expect(send.getSendChannel()).toBe('Master');
  });

  it('reconciles removal in snapshot', () => {
    const data = new BlueData();

    const sub1 = new Channel();
    sub1.setName('Reverb');
    data.getMixer().getSubChannels().push(sub1);

    const sub2 = new Channel();
    sub2.setName('Delay');
    sub2.setOutChannel('Reverb');
    const send = new Send();
    send.setSendChannel('Reverb');
    sub2.getPostEffects().push(send);
    data.getMixer().getSubChannels().push(sub2);

    const sub1Id = getMixerChannelSnapshotId(sub1);

    applyProjectDocumentPatch(data, {
      mixer: { type: 'removeSubChannel', channelId: sub1Id },
    });

    const snapshot = createProjectEditorSnapshot(data, '/tmp/test.blue');
    const delaySnapshot = snapshot.mixer?.subChannels.find((sc) => sc.name === 'Delay');
    expect(delaySnapshot?.outChannel).toBe('Master');
    expect(delaySnapshot?.postChain[0]).toEqual(
      expect.objectContaining({ kind: 'send', sendChannel: 'Master' }),
    );
  });
});
