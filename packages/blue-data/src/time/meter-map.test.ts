import { describe, expect, it } from 'vite-plus/test';
import { MeterMap } from './meter-map';
import { Meter } from './meter';
import { MeasureMeterPair } from './measure-meter-pair';
import { Element } from '../serialization/xml-reader';
import { TimeContext } from './time-context';
import { TimeDuration } from './time-duration';
import { TimePosition } from './time-position';

describe('MeterMap BBF conversion', () => {
  it('formats canonical hundredths with two-digit rounding semantics', () => {
    const meterMap = new MeterMap();

    expect(meterMap.beatsToBBF(0.05)).toEqual({ bar: 1, beat: 1, fraction: 5 });
    expect(meterMap.beatsToBBF(0.5)).toEqual({ bar: 1, beat: 1, fraction: 50 });
  });

  it('carries rounding overflow to the next beat', () => {
    const meterMap = new MeterMap();

    expect(meterMap.beatsToBBF(0.9994)).toEqual({ bar: 1, beat: 2, fraction: 0 });
  });
});

describe('MeterMap XML round-trip', () => {
  it('round-trips a default 4/4 meter map', () => {
    const original = new MeterMap();
    const xml = original.saveAsXML();
    const loaded = MeterMap.loadFromXML(xml);
    expect(loaded.size()).toBe(1);
    expect(loaded.get(0).measure).toBe(1);
    expect(loaded.get(0).meter.numBeats).toBe(4);
    expect(loaded.get(0).meter.beatLength).toBe(4);
  });

  it('round-trips a multi-entry meter map', () => {
    const original = new MeterMap();
    original.add(new MeasureMeterPair(1, new Meter(4, 4)));
    original.add(new MeasureMeterPair(5, new Meter(3, 4)));
    original.add(new MeasureMeterPair(9, new Meter(7, 8)));

    const xml = original.saveAsXML();
    const loaded = MeterMap.loadFromXML(xml);

    expect(loaded.size()).toBe(3);
    expect(loaded.get(0).measure).toBe(1);
    expect(loaded.get(0).meter.numBeats).toBe(4);
    expect(loaded.get(0).meter.beatLength).toBe(4);
    expect(loaded.get(1).measure).toBe(5);
    expect(loaded.get(1).meter.numBeats).toBe(3);
    expect(loaded.get(1).meter.beatLength).toBe(4);
    expect(loaded.get(2).measure).toBe(9);
    expect(loaded.get(2).meter.numBeats).toBe(7);
    expect(loaded.get(2).meter.beatLength).toBe(8);
  });

  it('defaults to 4/4 when loading empty XML', () => {
    const emptyElem = new Element('meterMap');
    const loaded = MeterMap.loadFromXML(emptyElem);
    expect(loaded.size()).toBe(1);
    expect(loaded.get(0).measure).toBe(1);
  });
});

describe('MeterMap mixed-meter conversion', () => {
  it('computes correct measure start beats for 4/4 then 3/4 then 7/8', () => {
    const map = new MeterMap();
    map.add(new MeasureMeterPair(1, new Meter(4, 4)));
    map.add(new MeasureMeterPair(5, new Meter(3, 4)));
    map.add(new MeasureMeterPair(9, new Meter(7, 8)));

    expect(map.get(0).measure).toBe(1);
    expect(map.get(1).measure).toBe(5);
    expect(map.get(2).measure).toBe(9);

    map.updateMeasureStartBeats();

    const e0 = map.get(0);
    const e1 = map.get(1);
    const e2 = map.get(2);

    expect(e0.meter.getBeatsPerMeasure()).toBe(4);
    expect(e1.meter.getBeatsPerMeasure()).toBe(3);
    expect(e2.meter.getBeatsPerMeasure()).toBeCloseTo(3.5, 6);

    const beats_0_to_5 = (5 - 1) * 4;
    const beats_5_to_9 = (9 - 5) * 3;

    expect(beats_0_to_5).toBe(16);
    expect(beats_5_to_9).toBe(12);
  });

  it('converts beats to BBT correctly for mixed meter', () => {
    const map = new MeterMap();
    map.add(new MeasureMeterPair(1, new Meter(4, 4)));
    map.add(new MeasureMeterPair(5, new Meter(3, 4)));

    const result = map.beatsToBBT(17, 960);
    expect(result.bar).toBe(5);
    expect(result.beat).toBe(2);
  });

  it('converts beats to BBF correctly for mixed meter', () => {
    const map = new MeterMap();
    map.add(new MeasureMeterPair(1, new Meter(4, 4)));
    map.add(new MeasureMeterPair(5, new Meter(3, 4)));

    const result = map.beatsToBBF(17);
    expect(result.bar).toBe(5);
    expect(result.beat).toBe(2);
    expect(result.fraction).toBe(0);
  });
});

describe('Meter-scaled fractional time units', () => {
  function makeSevenEightContext(): TimeContext {
    const context = new TimeContext();
    const meterMap = new MeterMap();
    meterMap.clear();
    meterMap.add(new MeasureMeterPair(1, new Meter(7, 8)));
    context.setMeterMap(meterMap);
    return context;
  }

  it('scales BBT, BBST, and BBF position fractions by the active beat length', () => {
    const context = makeSevenEightContext();

    expect(TimePosition.bbt(1, 1, 480).toBeats(context)).toBeCloseTo(0.25, 6);
    expect(TimePosition.bbst(1, 1, 3, 0).toBeats(context)).toBeCloseTo(0.25, 6);
    expect(TimePosition.bbf(1, 2, 50).toBeats(context)).toBeCloseTo(0.75, 6);
  });

  it('scales BBT and BBF duration fractions by the first meter beat length', () => {
    const context = makeSevenEightContext();

    expect(TimeDuration.bbt(0, 0, 480).toBeats(context)).toBeCloseTo(0.25, 6);
    expect(TimeDuration.bbf(0, 1, 50).toBeats(context)).toBeCloseTo(0.75, 6);
  });
});
