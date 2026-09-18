import { describe, expect, it } from 'vitest';
import {
  getArrangementOwnerParameters,
  getProjectParameterCatalog,
  getTrackOwnerParameters,
} from './project-parameter-catalog';
import { BlueData } from '../blue-data';
import { BlueX7 } from '../instruments/blue-x7';
import { GenericInstrument } from '../instruments/generic-instrument';
import { TrackLayerGroup } from '../score/track/track-layer-group';
import { Track } from '../score/track/track';
import { Channel } from '../mixer/channel';

function addArrangementBlueX7(
  blueData: BlueData,
  name: string,
): { instr: BlueX7; arrangementId: string } {
  const instr = new BlueX7();
  instr.setName(name);
  blueData.getArrangement().addInstrumentAtEnd(instr);
  const ia = blueData
    .getArrangement()
    .getArrangement()
    .find((entry) => entry.instr === instr)!;
  return { instr, arrangementId: ia.arrangementId };
}

function addTrackBlueX7(blueData: BlueData, name: string, trackName: string): TrackLayerGroup {
  const group = new TrackLayerGroup();
  const track = new Track();
  track.setName(trackName);
  const instr = new BlueX7();
  instr.setName(name);
  track.setInstrument(instr);
  group.push(track);
  blueData.getScore().push(group);
  return group;
}

function nonMixerOwners(catalog: ReturnType<typeof getProjectParameterCatalog>): string[] {
  return [...new Set(catalog.filter((e) => e.ownerKind !== 'mixer').map((e) => e.ownerIdentity))];
}

describe('project parameter catalog', () => {
  it('enumerates arrangement, Track, and mixer owners in deterministic order', () => {
    const blueData = new BlueData();
    const lead = addArrangementBlueX7(blueData, 'Lead');
    addTrackBlueX7(blueData, 'Bass', 'Track Bass');
    const pad = addArrangementBlueX7(blueData, 'Pad');

    const catalog = getProjectParameterCatalog(blueData);
    const owners = [...new Set(catalog.map((e) => e.ownerIdentity))];

    // arrangement owners come before Track owners, mixer last
    expect(owners).toEqual([
      `arrangement:${lead.arrangementId}`,
      `arrangement:${pad.arrangementId}`,
      expect.stringMatching(/^track:/),
      'mixer',
    ]);

    // the BlueX7 owners contribute exactly 151 parameters each
    for (const owner of nonMixerOwners(catalog)) {
      expect(catalog.filter((e) => e.ownerIdentity === owner)).toHaveLength(151);
    }

    // owner labels and chooser paths carry display names
    const bassEntry = catalog.find((e) => e.ownerKind === 'track-instrument')!;
    expect(bassEntry.ownerLabel).toBe('Track Layer Group / Track Bass');
    expect(bassEntry.path).toEqual(['Track Layer Group', 'Track Bass']);
    expect(
      catalog.find((e) => e.ownerIdentity === `arrangement:${lead.arrangementId}`)!.ownerLabel,
    ).toBe(`${lead.arrangementId}) Lead`);
  });

  it('keeps same-named instruments identity-distinct', () => {
    const blueData = new BlueData();
    addArrangementBlueX7(blueData, 'BlueX7');
    addArrangementBlueX7(blueData, 'BlueX7');
    addTrackBlueX7(blueData, 'BlueX7', 'Track A');
    addTrackBlueX7(blueData, 'BlueX7', 'Track A');

    const catalog = getProjectParameterCatalog(blueData);
    const owners = nonMixerOwners(catalog);
    expect(owners).toHaveLength(4);
    expect(new Set(owners).size).toBe(4);

    // routing key (ownerIdentity + parameter id) is unique across the project
    const routingKeys = new Set(
      catalog.map((e) => `${e.ownerIdentity}:${e.parameter.getUniqueId()}`),
    );
    expect(routingKeys.size).toBe(catalog.length);
  });

  it('skips disabled arrangement assignments and disabled Track instruments', () => {
    const blueData = new BlueData();
    const muted = addArrangementBlueX7(blueData, 'Muted');
    blueData.getArrangement().removeInstrumentById(muted.arrangementId);
    blueData.getArrangement().addInstrumentAtEnd(muted.instr);
    blueData
      .getArrangement()
      .getArrangement()
      .find((ia) => ia.instr === muted.instr)!.enabled = false;
    const live = addArrangementBlueX7(blueData, 'Live');

    const group = new TrackLayerGroup();
    const track = new Track();
    track.setName('T');
    const trackInstr = new BlueX7();
    trackInstr.setEnabled(false);
    track.setInstrument(trackInstr);
    group.push(track);
    blueData.getScore().push(group);

    const liveOwner = `arrangement:${
      blueData
        .getArrangement()
        .getArrangement()
        .find((ia) => ia.instr === live.instr)!.arrangementId
    }`;
    expect(
      new Set(getArrangementOwnerParameters(blueData.getArrangement()).map((e) => e.ownerIdentity)),
    ).toEqual(new Set([liveOwner]));
    expect(getTrackOwnerParameters(blueData.getScore())).toHaveLength(0);
  });

  it('keeps non-automatable instruments out of the catalog', () => {
    const blueData = new BlueData();
    const generic = new GenericInstrument();
    generic.setName('Plain');
    blueData.getArrangement().addInstrumentAtEnd(generic);
    const catalog = getProjectParameterCatalog(blueData);
    expect(catalog.filter((e) => e.ownerKind !== 'mixer')).toHaveLength(0);
  });

  it('drops removed owners on the next catalog build', () => {
    const blueData = new BlueData();
    const removed = addArrangementBlueX7(blueData, 'Temp');
    expect(nonMixerOwners(getProjectParameterCatalog(blueData))).toHaveLength(1);
    blueData.getArrangement().removeInstrumentById(removed.arrangementId);
    expect(
      getProjectParameterCatalog(blueData).filter((e) => e.ownerKind !== 'mixer'),
    ).toHaveLength(0);
  });

  it('survives save/reopen with stable owner identities', () => {
    const blueData = new BlueData();
    addArrangementBlueX7(blueData, 'Lead');
    addTrackBlueX7(blueData, 'Bass', 'Track Bass');

    const reopened = BlueData.loadFromString(blueData.saveToString());
    const before = getProjectParameterCatalog(blueData)
      .filter((e) => e.ownerKind !== 'mixer')
      .map((e) => `${e.ownerIdentity}:${e.parameter.getUniqueId()}`);
    const after = getProjectParameterCatalog(reopened)
      .filter((e) => e.ownerKind !== 'mixer')
      .map((e) => `${e.ownerIdentity}:${e.parameter.getUniqueId()}`);
    expect(after).toEqual(before);
  });

  it('enumerates the mixer Pan parameter once per source, subchannel, and master channel (Spec 112 T073)', () => {
    const blueData = new BlueData();
    const mixer = blueData.getMixer();
    mixer.setEnabled(true);

    const source = new Channel();
    source.setName('Source');
    mixer.getChannels().push(source);
    const sub = new Channel();
    sub.setName('Sub');
    mixer.getSubChannels().push(sub);

    const mixerEntries = getProjectParameterCatalog(blueData).filter(
      (e) => e.ownerKind === 'mixer',
    );
    const panEntries = mixerEntries.filter((e) => e.parameter.getName() === 'Pan');
    const expectedPans = [source, sub, mixer.getMaster()].map((channel) =>
      channel.getPanParameter().getUniqueId(),
    );
    expect(panEntries.map((e) => e.parameter.getUniqueId())).toEqual(expectedPans);

    // Owner attribution stays the mixer namespace and routing keys are unique.
    for (const entry of panEntries) {
      expect(entry.ownerIdentity).toBe('mixer');
      expect(entry.path).toEqual(['Mixer']);
    }
    const routingKeys = new Set(
      mixerEntries.map((e) => `${e.ownerIdentity}:${e.parameter.getUniqueId()}`),
    );
    expect(routingKeys.size).toBe(mixerEntries.length);
  });

  it('keeps mixer Pan distinct from Volume in the catalog across save/reopen', () => {
    const blueData = new BlueData();
    const mixer = blueData.getMixer();
    mixer.setEnabled(true);
    const source = new Channel();
    source.setName('Source');
    source.setPan(0.25);
    mixer.getChannels().push(source);

    const reopened = BlueData.loadFromString(blueData.saveToString());
    for (const data of [blueData, reopened]) {
      const entries = getProjectParameterCatalog(data).filter((e) => e.ownerKind === 'mixer');
      const volume = entries.find((e) => e.parameter.getName() === 'Volume')!;
      const pan = entries.find((e) => e.parameter.getName() === 'Pan')!;
      expect(pan.parameter.getUniqueId()).not.toBe(volume.parameter.getUniqueId());
      expect(pan.parameter.getFixedValue()).toBe(0.25);
      expect(volume.parameter.getName()).toBe('Volume');
    }
  });
});
