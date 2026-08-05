import { describe, expect, it } from 'vitest';
import {
  createTrackInstrumentFixture,
  createTrackFixture,
  createTrackWithInstrumentFixture,
} from './track-test-fixtures';
import { BlueSynthBuilder } from '../../instruments/blue-synth-builder';
import { BSBKnob } from '../../instruments/blue-synth-builder/bsb-knob';
import { GenericInstrument } from '../../instruments/generic-instrument';

describe('Track instrument CSD generation', () => {
  it('registers one independent Track instrument and retargets only eligible notes', async () => {
    const { data, track } = createTrackWithInstrumentFixture();
    const arrangementSizeBefore = data.getArrangement().size();

    const syncCsd = data.toCSD();
    const asyncCsd = await data.toCSDAsync();

    expect(data.getArrangement().size()).toBe(arrangementSizeBefore);
    expect(syncCsd).toContain('Fixture Instrument');
    expect(syncCsd).toMatch(/\ni1\s+0(?:\.0)?\s+1\s+60/);
    expect(syncCsd).toMatch(/\ni2\s+0(?:\.0)?\s+1/);
    expect(asyncCsd).toContain('Fixture Instrument');
    expect(asyncCsd).toMatch(/\ni1\s+0(?:\.0)?\s+1\s+60/);
    expect(asyncCsd).toMatch(/\ni2\s+0(?:\.0)?\s+1/);
    expect(track.getInstrument()?.getName()).toBe('Fixture Instrument');
  });

  it('does not mutate authored p1 or share a Track-owned instrument copy', () => {
    const first = createTrackWithInstrumentFixture();
    const second = createTrackWithInstrumentFixture();
    const source = first.track.getInstrument();
    const assigned = second.track.getInstrument();
    expect(source).not.toBeNull();
    expect(assigned).not.toBeNull();
    expect(source).not.toBe(assigned);
    expect(first.track[0]).not.toBe(second.track[0]);
    expect(first.data.saveToString()).not.toContain('track-instrument');
  });

  it('rebuilds render state after replacement, disable, and clear without stale instrument code', () => {
    const { data, track } = createTrackWithInstrumentFixture();
    const first = track.getInstrument();
    if (!(first instanceof GenericInstrument)) {
      throw new Error('Expected GenericInstrument fixture');
    }
    first.setGlobalOrc('gi_track_fixture init 1');
    first.setGlobalSco('i "track-fixture-support" 0 0.01');
    const firstCsd = data.toCSD();
    expect(firstCsd).toContain('Fixture Instrument');
    expect(firstCsd).toContain('gi_track_fixture init 1');
    expect(firstCsd).toContain('track-fixture-support');

    const replacement = createTrackInstrumentFixture('Replacement Instrument');
    replacement.setText('aout oscili 0.1, 220\nouts aout, aout');
    track.setInstrument(replacement);
    const replacementCsd = data.toCSD();
    expect(replacementCsd).toContain('Replacement Instrument');
    expect(replacementCsd).not.toContain('Fixture Instrument');
    expect(replacementCsd).not.toContain('gi_track_fixture');

    track.getInstrument()!.setEnabled(false);
    const disabledCsd = data.toCSD();
    expect(disabledCsd).not.toContain('Replacement Instrument');

    track.clearInstrument();
    const clearedCsd = data.toCSD();
    expect(clearedCsd).not.toContain('Replacement Instrument');
    expect(clearedCsd).not.toContain('gi_track_fixture');
  });

  it('exports each Track instrument automation channel exactly once', () => {
    const { data, track } = createTrackFixture({ includeClip: false });
    const instrument = new BlueSynthBuilder();
    instrument.setName('Automated Track Instrument');
    instrument.setInstrumentText('aout oscili <gain>, 440\nouts aout, aout');

    const gain = new BSBKnob();
    gain.objectName = 'gain';
    gain.automationAllowed = true;
    instrument.getGraphicInterface().getRootGroup().addChild(gain);
    track.setInstrument(instrument);

    const exportedChannels = [...data.toCSD().matchAll(/^(gk_blue_auto\d+) chnexport/gm)]
      .map((match) => match[1]);

    expect(exportedChannels.length).toBeGreaterThan(0);
    expect(new Set(exportedChannels).size).toBe(exportedChannels.length);
  });
});
