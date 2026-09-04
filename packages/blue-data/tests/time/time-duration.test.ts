import { describe, it, expect, beforeEach } from 'vitest';
import { TimeDuration } from '../../src/time/time-duration';
import { TimePosition } from '../../src/time/time-position';
import { TimeBase } from '../../src/time/time-base';
import { TimeContext } from '../../src/time/time-context';
import { MeterMap } from '../../src/time/meter-map';
import { Meter } from '../../src/time/meter';
import { MeasureMeterPair } from '../../src/time/measure-meter-pair';
import { makeDefaultContext } from './helpers';
import { Element } from '../../src/serialization/xml-reader';

describe('TimeDuration', () => {
  let context: TimeContext;
  beforeEach(() => {
    context = makeDefaultContext();
  });

  // ===== DurationBeats =====

  it('testDurationBeatsGetTimeBase', () => {
    expect(TimeDuration.beats(4.0).getTimeBase()).toBe(TimeBase.BEATS);
  });

  it('testDurationBeatsConversions', () => {
    const db = TimeDuration.beats(4.0);
    expect(db.toBeats(context)).toBeCloseTo(4.0, 4);
    expect(db.toSeconds(context)).toBeCloseTo(4.0, 4);
    expect(db.toFrames(context)).toBe(176400);
  });

  it('testDurationBeatsEquality', () => {
    const a = TimeDuration.beats(4.0);
    const b = TimeDuration.beats(4.0);
    const c = TimeDuration.beats(5.0);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.hashCode()).toBe(b.hashCode());
  });

  it('testDurationBeatsNegative', () => {
    expect(() => TimeDuration.beats(-1.0)).toThrow();
  });

  // ===== DurationBBT =====

  it('testDurationBBTZero', () => {
    const zero = TimeDuration.bbt(0, 0, 0);
    expect(zero.getBars()).toBe(0);
    expect(zero.getBeats()).toBe(0);
    expect(zero.getTicks()).toBe(0);
    expect(zero.toBeats(context)).toBeCloseTo(0.0, 4);
  });

  it('testDurationBBTOneMeasureIn44', () => {
    expect(TimeDuration.bbt(1, 0, 0).toBeats(context)).toBeCloseTo(4.0, 4);
  });

  it('testDurationBBTOneBarTwoBeats', () => {
    expect(TimeDuration.bbt(1, 2, 0).toBeats(context)).toBeCloseTo(6.0, 4);
  });

  it('testDurationBBTWithTicks', () => {
    expect(TimeDuration.bbt(0, 0, 480).toBeats(context)).toBeCloseTo(0.5, 4);
  });

  it('testDurationBBTSecondsAndFrames', () => {
    const d = TimeDuration.bbt(1, 0, 0);
    expect(d.toSeconds(context)).toBeCloseTo(4.0, 4);
    expect(d.toFrames(context)).toBe(176400);
  });

  it('testDurationBBTNegativeBars', () => {
    expect(() => TimeDuration.bbt(-1, 0, 0)).toThrow();
  });

  // ===== DurationBBST =====

  it('testDurationBBSTOneMeasureIn44', () => {
    expect(TimeDuration.bbst(1, 0, 0, 0).toBeats(context)).toBeCloseTo(4.0, 4);
  });

  it('testDurationBBSTWithSixteenth', () => {
    expect(TimeDuration.bbst(0, 0, 2, 0).toBeats(context)).toBeCloseTo(0.5, 4);
  });

  it('testDurationBBSTTotalTicks', () => {
    expect(TimeDuration.bbst(0, 0, 2, 60).toTotalTicks(960)).toBe(540);
  });

  it('testDurationBBSTNegativeBars', () => {
    expect(() => TimeDuration.bbst(-1, 0, 0, 0)).toThrow();
  });

  // ===== DurationBBF =====

  it('testDurationBBFOneMeasureIn44', () => {
    expect(TimeDuration.bbf(1, 0, 0).toBeats(context)).toBeCloseTo(4.0, 4);
  });

  it('testDurationBBFWithFraction', () => {
    expect(TimeDuration.bbf(0, 0, 50).toBeats(context)).toBeCloseTo(0.5, 4);
  });

  it('testDurationBBFOneBarTwoBeats', () => {
    expect(TimeDuration.bbf(1, 2, 0).toBeats(context)).toBeCloseTo(6.0, 4);
  });

  it('testDurationBBFInvalidFraction', () => {
    expect(() => TimeDuration.bbf(0, 0, 100)).toThrow();
  });

  // ===== DurationTime =====

  it('testDurationTimeConversions', () => {
    const d = TimeDuration.timeValue(0, 0, 2, 0);
    expect(d.toBeats(context)).toBeCloseTo(2.0, 4);
    expect(d.toSeconds(context)).toBeCloseTo(2.0, 4);
    expect(d.toFrames(context)).toBe(88200);
  });

  it('testDurationTimeTotalSeconds', () => {
    expect(TimeDuration.timeValue(1, 30, 45, 500).toTotalSecondsValue()).toBeCloseTo(5445.5, 4);
  });

  it('testDurationTimeInvalidHours', () => {
    expect(() => TimeDuration.timeValue(-1, 0, 0, 0)).toThrow();
  });

  it('testDurationTimeInvalidMinutes', () => {
    expect(() => TimeDuration.timeValue(0, 60, 0, 0)).toThrow();
  });

  // ===== DurationSeconds =====

  it('testDurationSecondsConversions', () => {
    const d = TimeDuration.seconds(2.5);
    expect(d.getTotalSeconds()).toBeCloseTo(2.5, 4);
    expect(d.toSeconds(context)).toBeCloseTo(2.5, 4);
    expect(d.toBeats(context)).toBeCloseTo(2.5, 4);
    expect(d.toFrames(context)).toBe(110250);
  });

  it('testDurationSecondsNegativeRejected', () => {
    expect(() => TimeDuration.seconds(-0.001)).toThrow();
  });

  it('testDurationSecondsNonFiniteRejected', () => {
    expect(() => TimeDuration.seconds(NaN)).toThrow();
    expect(() => TimeDuration.seconds(Infinity)).toThrow();
  });

  // ===== DurationFrames =====

  it('testDurationFramesConversions', () => {
    const d = TimeDuration.frames(88200);
    expect(d.toFrames(context)).toBe(88200);
    expect(d.toSeconds(context)).toBeCloseTo(2.0, 4);
    expect(d.toBeats(context)).toBeCloseTo(2.0, 4);
  });

  it('testDurationFramesNegative', () => {
    expect(() => TimeDuration.frames(-1)).toThrow();
  });

  it('testDurationFramesInvalidSampleRate', () => {
    expect(() => TimeDuration.frames(44100).toTotalSecondsForSampleRate(0)).toThrow();
  });

  // ===== XML Serialization =====

  it('testDurationBeatsXMLRoundTrip', () => {
    const original = TimeDuration.beats(4.5);
    expect(original.equals(TimeDuration.loadFromXML(original.saveAsXML()))).toBe(true);
  });

  it('testDurationBBTXMLRoundTrip', () => {
    const original = TimeDuration.bbt(2, 3, 120);
    expect(original.equals(TimeDuration.loadFromXML(original.saveAsXML()))).toBe(true);
  });

  it('testDurationBBSTXMLRoundTrip', () => {
    const original = TimeDuration.bbst(1, 2, 3, 60);
    expect(original.equals(TimeDuration.loadFromXML(original.saveAsXML()))).toBe(true);
  });

  it('testDurationBBFXMLRoundTrip', () => {
    const original = TimeDuration.bbf(3, 2, 75);
    expect(original.equals(TimeDuration.loadFromXML(original.saveAsXML()))).toBe(true);
  });

  it('testDurationTimeXMLRoundTrip', () => {
    const original = TimeDuration.timeValue(1, 30, 45, 500);
    expect(original.equals(TimeDuration.loadFromXML(original.saveAsXML()))).toBe(true);
  });

  it('testDurationSecondsXMLRoundTrip', () => {
    const original = TimeDuration.seconds(12.345678);
    const loaded = TimeDuration.loadFromXML(original.saveAsXML());
    expect(original.equals(loaded)).toBe(true);
    expect(loaded.getTimeBase()).toBe(TimeBase.SECONDS);
  });

  it('testDurationFramesXMLRoundTrip', () => {
    const original = TimeDuration.frames(88200);
    expect(original.equals(TimeDuration.loadFromXML(original.saveAsXML()))).toBe(true);
  });

  it('testDurationXMLUsesJavaTagNames', () => {
    const bbt = TimeDuration.bbt(2, 3, 120).saveAsXML();
    expect(bbt.getElement('bars')?.getTextString()).toBe('2');
    expect(bbt.getElement('beats')?.getTextString()).toBe('3');
    expect(bbt.getElement('bar')).toBeNull();
    expect(bbt.getElement('beat')).toBeNull();

    const seconds = TimeDuration.seconds(12.5).saveAsXML();
    expect(seconds.getElement('totalSeconds')?.getTextString()).toBe('12.5');
    expect(seconds.getElement('seconds')).toBeNull();

    const frames = TimeDuration.frames(88200).saveAsXML();
    expect(frames.getElement('frameCount')?.getTextString()).toBe('88200');
    expect(frames.getElement('frameNumber')).toBeNull();
  });

  it('testDurationXMLLoadsJavaAndLegacyTagNames', () => {
    const javaBbt = Element.parse(
      '<duration type="BBT"><bars>1</bars><beats>2</beats><ticks>120</ticks></duration>',
    );
    const legacyBbt = Element.parse(
      '<duration type="BBT"><bar>1</bar><beat>2</beat><ticks>120</ticks></duration>',
    );
    expect(TimeDuration.loadFromXML(javaBbt).equals(TimeDuration.loadFromXML(legacyBbt))).toBe(
      true,
    );

    const javaSeconds = Element.parse(
      '<duration type="SECONDS"><totalSeconds>2.5</totalSeconds></duration>',
    );
    const legacySeconds = Element.parse(
      '<duration type="SECONDS"><seconds>2.5</seconds></duration>',
    );
    expect(
      TimeDuration.loadFromXML(javaSeconds).equals(TimeDuration.loadFromXML(legacySeconds)),
    ).toBe(true);

    const javaFrame = Element.parse(
      '<duration type="FRAME"><frameCount>44100</frameCount></duration>',
    );
    const legacyFrame = Element.parse(
      '<duration type="FRAME"><frameNumber>44100</frameNumber></duration>',
    );
    expect(TimeDuration.loadFromXML(javaFrame).equals(TimeDuration.loadFromXML(legacyFrame))).toBe(
      true,
    );
  });

  // ===== Position vs Duration BBT =====

  it('testDurationBBTVsPositionBBT', () => {
    expect(TimePosition.bbt(1, 1, 0).toBeats(context)).toBeCloseTo(0.0, 4);
    expect(TimeDuration.bbt(0, 0, 0).toBeats(context)).toBeCloseTo(0.0, 4);
    expect(TimePosition.bbt(2, 1, 0).toBeats(context)).toBeCloseTo(4.0, 4);
    expect(TimeDuration.bbt(1, 0, 0).toBeats(context)).toBeCloseTo(4.0, 4);
  });

  // ===== Non-4/4 Meter =====

  it('testDurationBBTIn34', () => {
    const mm = new MeterMap();
    mm.clear();
    mm.add(new MeasureMeterPair(1, new Meter(3, 4)));
    const ctx = makeDefaultContext();
    ctx.setMeterMap(mm);

    expect(TimeDuration.bbt(1, 0, 0).toBeats(ctx)).toBeCloseTo(3.0, 4);
    expect(TimeDuration.bbt(2, 0, 0).toBeats(ctx)).toBeCloseTo(6.0, 4);
    expect(TimeDuration.bbt(1, 2, 0).toBeats(ctx)).toBeCloseTo(5.0, 4);
  });

  it('testDurationBBFIn68', () => {
    const mm = new MeterMap();
    mm.clear();
    mm.add(new MeasureMeterPair(1, new Meter(6, 8)));
    const ctx = makeDefaultContext();
    ctx.setMeterMap(mm);

    expect(TimeDuration.bbf(1, 0, 0).toBeats(ctx)).toBeCloseTo(3.0, 4);
    expect(TimeDuration.bbf(0, 1, 0).toBeats(ctx)).toBeCloseTo(0.5, 4);
  });

  // ===== fromSeconds =====

  it('testFromSecondsZero', () => {
    const dur = TimeDuration.fromSeconds(0.0);
    expect(dur.getTimeBase()).toBe(TimeBase.TIME);
    expect(dur.getHours()).toBe(0);
    expect(dur.getMinutes()).toBe(0);
    expect(dur.getSeconds()).toBe(0);
    expect(dur.getMilliseconds()).toBe(0);
  });

  it('testFromSecondsSimple', () => {
    const dur = TimeDuration.fromSeconds(3.5);
    expect(dur.getHours()).toBe(0);
    expect(dur.getMinutes()).toBe(0);
    expect(dur.getSeconds()).toBe(3);
    expect(dur.getMilliseconds()).toBe(500);
  });

  it('testFromSecondsMinutes', () => {
    const dur = TimeDuration.fromSeconds(90.25);
    expect(dur.getHours()).toBe(0);
    expect(dur.getMinutes()).toBe(1);
    expect(dur.getSeconds()).toBe(30);
    expect(dur.getMilliseconds()).toBe(250);
  });

  it('testFromSecondsHours', () => {
    const dur = TimeDuration.fromSeconds(3661.123);
    expect(dur.getHours()).toBe(1);
    expect(dur.getMinutes()).toBe(1);
    expect(dur.getSeconds()).toBe(1);
    expect(dur.getMilliseconds()).toBe(123);
  });

  it('testFromSecondsNegativeClampsToZero', () => {
    expect(TimeDuration.fromSeconds(-5.0).toTotalSecondsValue()).toBeCloseTo(0.0, 4);
  });

  it('testFromSecondsToBeatsAt60BPM', () => {
    expect(TimeDuration.fromSeconds(5.0).toBeats(context)).toBeCloseTo(5.0, 4);
  });
});
