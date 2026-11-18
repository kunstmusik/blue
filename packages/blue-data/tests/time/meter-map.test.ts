import { describe, it, expect } from 'vite-plus/test';
import { MeterMap } from '../../src/time/meter-map';
import { Meter } from '../../src/time/meter';
import { MeasureMeterPair } from '../../src/time/measure-meter-pair';

describe('MeterMap', () => {
  it('testListenerNotifications', () => {
    const map = new MeterMap();
    let counter = 0;
    map.addListener(() => {
      counter++;
    });

    map.add(new MeasureMeterPair(5, new Meter(3, 4)));
    expect(counter).toBe(1);

    map.set(0, new MeasureMeterPair(1, new Meter(3, 4)));
    expect(counter).toBe(2);
  });

  it('testUpdateMeasureStartBeats', () => {
    const map = new MeterMap();
    // Default: 4/4 at measure 1, measureStartBeats[0] = 0.0
    map.add(new MeasureMeterPair(9, new Meter(7, 8)));
    // 7/8: beatsPerMeasure = 7 * (4/8) = 3.5
    // measureStartBeats[1] = 0.0 + (9-1) * 4.0 = 32.0
    map.add(new MeasureMeterPair(17, new Meter(3, 4)));
    // 3/4: beatsPerMeasure = 3.0
    // measureStartBeats[2] = 32.0 + (17-9) * 3.5 = 32.0 + 28.0 = 60.0

    // Verify indirectly via barBeatToBeats
    expect(map.barBeatToBeats(1, 1)).toBeCloseTo(0.0);
    expect(map.barBeatToBeats(9, 1)).toBeCloseTo(32.0);
    expect(map.barBeatToBeats(17, 1)).toBeCloseTo(60.0);
  });

  it('testBarBeatToBeats', () => {
    const map = new MeterMap();
    map.add(new MeasureMeterPair(9, new Meter(3, 4)));

    expect(map.barBeatToBeats(1, 1)).toBeCloseTo(0.0);
    expect(map.barBeatToBeats(2, 1)).toBeCloseTo(4.0);
    expect(map.barBeatToBeats(2, 3)).toBeCloseTo(6.0);
    expect(map.barBeatToBeats(9, 1)).toBeCloseTo(32.0);
    expect(map.barBeatToBeats(10, 1)).toBeCloseTo(35.0);
  });

  it('testBeatsToBBT', () => {
    const map = new MeterMap();
    const ppq = 960;

    expect(map.beatsToBBT(0.0, ppq)).toEqual({ bar: 1, beat: 1, ticks: 0 });
    expect(map.beatsToBBT(4.0, ppq)).toEqual({ bar: 2, beat: 1, ticks: 0 });
    expect(map.beatsToBBT(6.5, ppq)).toEqual({ bar: 2, beat: 3, ticks: 480 });
  });

  it('testBeatsToBBTWithMeterChanges', () => {
    const map = new MeterMap();
    map.add(new MeasureMeterPair(9, new Meter(3, 4)));
    const ppq = 960;

    // Before the meter change (4/4)
    expect(map.beatsToBBT(0.0, ppq)).toEqual({ bar: 1, beat: 1, ticks: 0 });
    expect(map.beatsToBBT(4.0, ppq)).toEqual({ bar: 2, beat: 1, ticks: 0 });

    // At the meter change (3/4 starts at measure 9, beat 32.0)
    expect(map.beatsToBBT(32.0, ppq)).toEqual({ bar: 9, beat: 1, ticks: 0 });

    // After the meter change — 3/4 has beatsPerMeasure = 3.0
    // 32.0 + 3.0 = 35.0 → measure 10, beat 1
    expect(map.beatsToBBT(35.0, ppq)).toEqual({ bar: 10, beat: 1, ticks: 0 });

    // 32.0 + 3.0 + 1.5 = 36.5 → measure 10, beat 2, ticks = 480
    expect(map.beatsToBBT(36.5, ppq)).toEqual({ bar: 10, beat: 2, ticks: 480 });
  });

  it('testRoundTripConversion', () => {
    const map = new MeterMap();
    map.add(new MeasureMeterPair(9, new Meter(3, 4)));
    map.add(new MeasureMeterPair(17, new Meter(7, 8)));

    const barsToTest = [1, 5, 10];

    for (const bar of barsToTest) {
      const meter = map.getMeterForMeasure(bar);
      const beats = map.barBeatToBeats(bar, 1);
      const result = map.beatsToBBT(beats);
      expect(result.bar).toBe(bar);
      expect(result.beat).toBe(1);
      expect(result.ticks).toBe(0);
    }
  });

  it('testBarBeatToBeatsEmptyMeterMap', () => {
    const map = new MeterMap();
    map.clear();
    expect(() => map.barBeatToBeats(1, 1)).toThrow();
  });

  it('testBarBeatToBeatsBarBeforeFirstEntry', () => {
    const map = new MeterMap();
    expect(() => map.barBeatToBeats(0, 1)).toThrow();
  });

  it('testBarBeatToBeatsBeatExceedsMeter', () => {
    const map = new MeterMap();
    // Default is 4/4, beat 5 exceeds numBeats
    expect(() => map.barBeatToBeats(1, 5)).toThrow();
  });

  it('testBeatsToBBTEmptyMeterMap', () => {
    const map = new MeterMap();
    map.clear();
    expect(() => map.beatsToBBT(0.0)).toThrow();
  });

  it('testBeatsToBBTNegativeBeats', () => {
    const map = new MeterMap();
    expect(() => map.beatsToBBT(-1.0)).toThrow();
  });

  it('testReplaceAllCopiesEntries', () => {
    const source = new MeterMap();
    source.add(new MeasureMeterPair(5, new Meter(3, 4)));
    source.add(new MeasureMeterPair(10, new Meter(6, 8)));

    const target = new MeterMap();
    target.replaceAll(source);

    expect(target.size()).toBe(source.size());
    for (let i = 0; i < source.size(); i++) {
      expect(target.get(i).equals(source.get(i))).toBe(true);
    }

    // Verify entries are copies, not the same references
    expect(target.get(0)).not.toBe(source.get(0));
    expect(target.get(0).meter).not.toBe(source.get(0).meter);
  });

  it('testReplaceAllFiresListener', () => {
    const target = new MeterMap();
    let counter = 0;
    target.addListener(() => {
      counter++;
    });

    const source = new MeterMap();
    source.add(new MeasureMeterPair(5, new Meter(3, 4)));

    target.replaceAll(source);
    expect(counter).toBe(1);
  });

  it('testReplaceAllPreservesListeners', () => {
    const target = new MeterMap();
    let counter = 0;
    target.addListener(() => {
      counter++;
    });

    const source1 = new MeterMap();
    source1.add(new MeasureMeterPair(5, new Meter(3, 4)));
    target.replaceAll(source1);
    expect(counter).toBe(1);

    const source2 = new MeterMap();
    source2.add(new MeasureMeterPair(3, new Meter(6, 8)));
    target.replaceAll(source2);
    expect(counter).toBe(2);
  });
});
