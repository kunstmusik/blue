import { describe, it, expect, beforeEach } from 'vitest';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { TimeBase } from '../../src/time/time-base';
import { TimeContext } from '../../src/time/time-context';
import { MeterMap } from '../../src/time/meter-map';
import { Meter } from '../../src/time/meter';
import { MeasureMeterPair } from '../../src/time/measure-meter-pair';
import {
  timePositionToBeats,
  beatsToTimePosition,
  convertTimePosition,
  secondsToTimePosition,
  timePositionToSeconds,
  framesToTimePosition,
  timePositionToFrames,
} from '../../src/time/time-utilities';
import { makeDefaultContext } from './helpers';

describe('TimeUtilities', () => {
  let context: TimeContext;
  beforeEach(() => {
    context = makeDefaultContext();
  });

  // ===== timePositionToBeats =====

  it('testTimePositionToBeatsWithBeatTime', () => {
    expect(timePositionToBeats(TimePosition.beats(10.5), context)).toBeCloseTo(10.5, 4);
  });

  it('testTimePositionToBeatsWithBBSTTime', () => {
    expect(timePositionToBeats(TimePosition.bbst(2, 3, 1, 0), context)).toBeCloseTo(6.0, 4);
  });

  it('testTimePositionToBeatsWithTimeValue', () => {
    expect(timePositionToBeats(TimePosition.timeValue(0, 0, 10, 0), context)).toBeCloseTo(10.0, 4);
  });

  it('testTimePositionToBeatsWithSecondsValue', () => {
    expect(timePositionToBeats(TimePosition.seconds(3.25), context)).toBeCloseTo(3.25, 4);
  });

  it('testTimePositionToBeatsWithFrameValue', () => {
    expect(timePositionToBeats(TimePosition.frames(44100), context)).toBeCloseTo(1.0, 4);
  });

  it('testTimePositionToBeatsNullPosition', () => {
    expect(() => timePositionToBeats(null as any, context)).toThrow();
  });

  // ===== beatsToTimePosition =====

  it('testBeatsToTimePositionBeatTime', () => {
    const result = beatsToTimePosition(10.5, TimeBase.BEATS, context);
    expect(result.getTimeBase()).toBe(TimeBase.BEATS);
    expect(result.getCsoundBeats()).toBeCloseTo(10.5, 4);
  });

  it('testBeatsToTimePositionBBSTTime', () => {
    const result = beatsToTimePosition(6.0, TimeBase.BBST, context);
    expect(result.getTimeBase()).toBe(TimeBase.BBST);
    expect(result.getBar()).toBe(2);
    expect(result.getBeat()).toBe(3);
  });

  it('testBeatsToTimePositionTimeValue', () => {
    const result = beatsToTimePosition(10.0, TimeBase.TIME, context);
    expect(result.getTimeBase()).toBe(TimeBase.TIME);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(10);
  });

  it('testBeatsToTimePositionSecondsValue', () => {
    const result = beatsToTimePosition(10.0, TimeBase.SECONDS, context);
    expect(result.getTimeBase()).toBe(TimeBase.SECONDS);
    expect(result.getTotalSeconds()).toBeCloseTo(10.0, 4);
  });

  it('testBeatsToTimePositionFrameValue', () => {
    const result = beatsToTimePosition(1.0, TimeBase.FRAME, context);
    expect(result.getTimeBase()).toBe(TimeBase.FRAME);
    expect(result.getFrameNumber()).toBe(44100);
  });

  // ===== convertTimePosition =====

  it('testConvertTimePositionSameTimeBase', () => {
    const original = TimePosition.beats(5.0);
    expect(convertTimePosition(original, TimeBase.BEATS, context)).toBe(original);
  });

  it('testConvertTimePositionBeatTimeToBBST', () => {
    const result = convertTimePosition(TimePosition.beats(8.0), TimeBase.BBST, context);
    expect(result.getTimeBase()).toBe(TimeBase.BBST);
    expect(result.getBar()).toBe(3);
    expect(result.getBeat()).toBe(1);
  });

  it('testConvertTimePositionSecondsToTime', () => {
    const result = convertTimePosition(TimePosition.seconds(9.5), TimeBase.TIME, context);
    expect(result.getTimeBase()).toBe(TimeBase.TIME);
    expect(result.toTotalSeconds()).toBeCloseTo(9.5, 4);
  });

  // ===== Round-trip =====

  it('testRoundTripBeatTimeToBBST', () => {
    const original = TimePosition.beats(12.0);
    const intermediate = convertTimePosition(original, TimeBase.BBST, context);
    const result = convertTimePosition(intermediate, TimeBase.BEATS, context);
    expect(result.getCsoundBeats()).toBeCloseTo(original.getCsoundBeats(), 4);
  });

  it('testRoundTripBBSTToTime', () => {
    const original = TimePosition.bbst(5, 3, 1, 0);
    const intermediate = convertTimePosition(original, TimeBase.TIME, context);
    const result = convertTimePosition(intermediate, TimeBase.BBST, context);
    expect(result.getBar()).toBe(original.getBar());
    expect(result.getBeat()).toBe(original.getBeat());
  });

  // ===== Helper Methods =====

  it('testSecondsToTimePosition', () => {
    const result = secondsToTimePosition(10.0, TimeBase.BEATS, context);
    expect(result.getCsoundBeats()).toBeCloseTo(10.0, 4);
  });

  it('testTimePositionToSeconds', () => {
    expect(timePositionToSeconds(TimePosition.beats(5.0), context)).toBeCloseTo(5.0, 4);
  });

  it('testFramesToTimePosition', () => {
    const result = framesToTimePosition(88200, TimeBase.BEATS, context);
    expect(result.getCsoundBeats()).toBeCloseTo(2.0, 4);
  });

  it('testTimePositionToFrames', () => {
    expect(timePositionToFrames(TimePosition.beats(2.0), context)).toBe(88200);
  });

  it('testFramesToTimePositionNormalizesMillisecondCarry', () => {
    const result = framesToTimePosition(44099, TimeBase.TIME, context);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(1);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('testDefaultContextSampleRateUsedForFrameConversion', () => {
    const ctx = new TimeContext();
    const result = beatsToTimePosition(1.0, TimeBase.FRAME, ctx);
    expect(result.getTimeBase()).toBe(TimeBase.FRAME);
    expect(result.getFrameNumber()).toBe(44100);
  });

  // ===== Meter Changes =====

  it('testConversionWithMeterChanges', () => {
    context.getMeterMap().add(new MeasureMeterPair(5, new Meter(3, 4)));
    const bbst = TimePosition.bbst(6, 2, 1, 0);
    const beats = timePositionToBeats(bbst, context);
    const result = convertTimePosition(
      beatsToTimePosition(beats, TimeBase.BBST, context),
      TimeBase.BBST,
      context,
    );
    expect(result.getBar()).toBe(bbst.getBar());
    expect(result.getBeat()).toBe(bbst.getBeat());
  });
});
