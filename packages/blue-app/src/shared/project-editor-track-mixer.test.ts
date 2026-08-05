import { describe, expect, it } from 'vitest';
import {
  BlueData,
  Channel,
  Effect,
  Send,
  TrackLayer,
  TrackLayerGroup,
} from '@blue/data';
import {
  applyProjectDocumentPatch,
  findMixerChannelById,
  reconcileMixerWithArrangement,
} from './project-editor';

describe('Track mixer reconciliation', () => {
  it('resolves grouped Track channels by their snapshot association', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    track.setUniqueId('runtime-track');
    data.getScore().push(group);

    reconcileMixerWithArrangement(data);

    expect(findMixerChannelById(data.getMixer(), track.getUniqueId()))
      .toBe(data.getMixer().getChannelListGroups()[0]![0]);
  });

  it('uses the latest Track channel gain when playback is compiled again', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const group = new TrackLayerGroup();
    const track = group.newLayerAt(0);
    track.setUniqueId('replay-track');
    data.getScore().push(group);
    reconcileMixerWithArrangement(data);

    expect(applyProjectDocumentPatch(data, {
      mixer: {
        type: 'updateChannel',
        channelId: track.getUniqueId(),
        patch: { level: -18 },
      },
    })).toBe(true);

    const render = data.toRealtimePlaybackCSD();

    expect(render.parameters[0]?.getFixedValue()).toBe(-18);
    expect(render.csdText).toContain('gk_blue_auto0 init -18');
  });

  it('keeps one associated source channel and its state across 100 add/remove/rename/reorder cycles', () => {
    const data = new BlueData();
    data.getScore().length = 0;

    const group = new TrackLayerGroup();
    group.setUniqueId('track-group');
    group.setName('Tracks');

    const first = new TrackLayer();
    first.setUniqueId('track-first');
    first.setName('First');
    const second = new TrackLayer();
    second.setUniqueId('track-second');
    second.setName('Second');
    group.push(first, second);
    data.getScore().push(group);

    reconcileMixerWithArrangement(data);
    const sourceGroup = data.getMixer().getChannelListGroups()[0];
    const firstChannel = sourceGroup.find((channel) => channel.getAssociation() === first.getUniqueId());
    expect(firstChannel).toBeDefined();

    const effect = new Effect();
    effect.setName('Preserved Effect');
    firstChannel!.getPreEffects().push(effect);
    const send = new Send();
    send.setSendChannel('Master');
    send.setLevel(0.37);
    firstChannel!.getPostEffects().push(send);
    firstChannel!.setLevel(-6);
    firstChannel!.setVolume(0.8);
    firstChannel!.setPan(0.25);
    firstChannel!.setOutChannel('Master');
    firstChannel!.getLevelParameter().setAutomationEnabled(true);
    firstChannel!.getLevelParameter().setPoints([
      { time: 0, value: -6 },
      { time: 4, value: -3 },
    ]);

    for (let cycle = 0; cycle < 100; cycle += 1) {
      group.setName(`Tracks ${cycle}`);
      if (cycle % 2 === 0) {
        group.splice(0, group.length, second, first);
      } else {
        group.splice(0, group.length, first, second);
      }

      if (cycle % 5 === 0) {
        const transient = new TrackLayer();
        transient.setUniqueId(`transient-${cycle}`);
        transient.setName(`Transient ${cycle}`);
        group.push(transient);
        reconcileMixerWithArrangement(data);
        group.splice(group.indexOf(transient), 1);
      }

      reconcileMixerWithArrangement(data);

      const groups = data.getMixer().getChannelListGroups();
      expect(groups).toHaveLength(1);
      expect(Array.from(groups[0], (channel) => channel.getAssociation()).sort()).toEqual([
        first.getUniqueId(),
        second.getUniqueId(),
      ].sort());
    }

    const finalFirstChannel = data.getMixer().getChannelListGroups()[0].find(
      (channel) => channel.getAssociation() === first.getUniqueId(),
    );
    expect(finalFirstChannel).toBeDefined();
    expect(finalFirstChannel!.getPreEffects()[0].getName()).toBe('Preserved Effect');
    expect(finalFirstChannel!.getPostEffects()[0]).toBeInstanceOf(Send);
    expect((finalFirstChannel!.getPostEffects()[0] as Send).getLevel()).toBe(0.37);
    expect(finalFirstChannel!.getLevel()).toBe(-6);
    expect(finalFirstChannel!.getVolume()).toBe(0.8);
    expect(finalFirstChannel!.getPan()).toBe(0.25);
    expect(finalFirstChannel!.getOutChannel()).toBe('Master');
    expect(finalFirstChannel!.getLevelParameter().getPoints()).toEqual([
      { time: 0, value: -6 },
      { time: 4, value: -3 },
    ]);
  });

  it('retains the first canonical channel when duplicate associations are repaired', () => {
    const data = new BlueData();
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    group.setUniqueId('duplicate-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('duplicate-track');
    data.getScore().push(group);

    reconcileMixerWithArrangement(data);
    const channelList = data.getMixer().getChannelListGroups()[0]!;
    const canonical = channelList[0]!;
    canonical.setLevel(-9);
    const canonicalEffect = new Effect();
    canonicalEffect.setName('Keep first');
    canonical.getPreEffects().push(canonicalEffect);

    const duplicate = new Channel();
    duplicate.setAssociation(track.getUniqueId());
    duplicate.setName('Discard duplicate');
    duplicate.setLevel(6);
    const duplicateEffect = new Effect();
    duplicateEffect.setName('Discard last');
    duplicate.getPreEffects().push(duplicateEffect);
    channelList.push(duplicate);

    expect(reconcileMixerWithArrangement(data)).toBe(true);
    const repaired = data.getMixer().getChannelListGroups()[0]!;
    expect(repaired).toHaveLength(1);
    expect(repaired[0]!.getLevel()).toBe(-9);
    expect(repaired[0]!.getPreEffects()[0]?.getName()).toBe('Keep first');
  });
});
