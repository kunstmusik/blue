import { describe, it, expect, beforeEach } from 'vitest';
import { TimePosition } from '../../src/time/time-position';
import { TimeDuration } from '../../src/time/time-duration';
import { TimeBase } from '../../src/time/time-base';
import { TimeContext } from '../../src/time/time-context';
import { MeterMap } from '../../src/time/meter-map';
import { Meter } from '../../src/time/meter';
import { MeasureMeterPair } from '../../src/time/measure-meter-pair';
import {
  add,
  subtract,
  distance,
  forwardDistance,
  convertDuration,
  beatsToDuration,
  fromTimePosition,
} from '../../src/time/time-unit-math';
import { makeDefaultContext } from './helpers';

describe('TimeUnitMath', () => {
  let context: TimeContext;
  beforeEach(() => {
    context = makeDefaultContext();
  });

  // ===== Position + Duration =====

  it('testAddDurationToPosition_Beats', () => {
    const result = add(context, TimePosition.beats(4.0), TimeDuration.beats(2.0));
    expect(result.getTimeBase()).toBe(TimeBase.BEATS);
    expect(result.toBeats(context)).toBeCloseTo(6.0, 4);
  });

  it('testAddDurationToPosition_BBF', () => {
    const result = add(context, TimePosition.bbf(1, 1, 0), TimeDuration.beats(4.0));
    expect(result.getTimeBase()).toBe(TimeBase.BBF);
    expect(result.toBeats(context)).toBeCloseTo(4.0, 4);
  });

  it('testAddDurationToPosition_BBT', () => {
    const result = add(context, TimePosition.bbt(1, 1, 0), TimeDuration.beats(2.5));
    expect(result.getTimeBase()).toBe(TimeBase.BBT);
    expect(result.toBeats(context)).toBeCloseTo(2.5, 4);
  });

  it('testAddDurationToPosition_ZeroDuration', () => {
    const result = add(context, TimePosition.beats(10.0), TimeDuration.beats(0.0));
    expect(result.toBeats(context)).toBeCloseTo(10.0, 4);
  });

  it('testAddDurationToPosition_SecondsPreservesTimeBase', () => {
    const result = add(context, TimePosition.seconds(2.0), TimeDuration.beats(1.5));
    expect(result.getTimeBase()).toBe(TimeBase.SECONDS);
    expect(result.getTotalSeconds()).toBeCloseTo(3.5, 4);
  });

  it('testAddDurationBBTToPositionBBF', () => {
    const result = add(context, TimePosition.bbf(2, 1, 0), TimeDuration.bbt(1, 2, 0));
    expect(result.getTimeBase()).toBe(TimeBase.BBF);
    expect(result.toBeats(context)).toBeCloseTo(10.0, 4);
  });

  // ===== Position - Position =====

  it('testDistance_Basic', () => {
    expect(
      distance(context, TimePosition.beats(2.0), TimePosition.beats(6.0)).toBeats(context),
    ).toBeCloseTo(4.0, 4);
  });

  it('testDistance_Reversed', () => {
    expect(
      distance(context, TimePosition.beats(6.0), TimePosition.beats(2.0)).toBeats(context),
    ).toBeCloseTo(4.0, 4);
  });

  it('testDistance_SamePosition', () => {
    const pos = TimePosition.beats(5.0);
    expect(distance(context, pos, pos).toBeats(context)).toBeCloseTo(0.0, 4);
  });

  it('testDistance_MixedTypes', () => {
    expect(
      distance(context, TimePosition.bbf(1, 1, 0), TimePosition.beats(4.0)).toBeats(context),
    ).toBeCloseTo(4.0, 4);
  });

  it('testForwardDistance_Normal', () => {
    expect(
      forwardDistance(context, TimePosition.beats(2.0), TimePosition.beats(6.0)).toBeats(context),
    ).toBeCloseTo(4.0, 4);
  });

  it('testForwardDistance_Reversed_ClampedToZero', () => {
    expect(
      forwardDistance(context, TimePosition.beats(6.0), TimePosition.beats(2.0)).toBeats(context),
    ).toBeCloseTo(0.0, 4);
  });

  // ===== Duration + Duration =====

  it('testAddDurations', () => {
    expect(
      add(context, TimeDuration.beats(3.0), TimeDuration.beats(2.0)).toBeats(context),
    ).toBeCloseTo(5.0, 4);
  });

  it('testAddDurations_MixedTypes', () => {
    expect(
      add(context, TimeDuration.beats(4.0), TimeDuration.bbt(0, 2, 0)).toBeats(context),
    ).toBeCloseTo(6.0, 4);
  });

  it('testAddDurations_Zero', () => {
    expect(
      add(context, TimeDuration.beats(4.0), TimeDuration.beats(0.0)).toBeats(context),
    ).toBeCloseTo(4.0, 4);
  });

  // ===== Duration - Duration =====

  it('testSubtractDurations', () => {
    expect(
      subtract(context, TimeDuration.beats(5.0), TimeDuration.beats(2.0)).toBeats(context),
    ).toBeCloseTo(3.0, 4);
  });

  it('testSubtractDurations_ClampedToZero', () => {
    expect(
      subtract(context, TimeDuration.beats(2.0), TimeDuration.beats(5.0)).toBeats(context),
    ).toBeCloseTo(0.0, 4);
  });

  // ===== Position - Duration =====

  it('testSubtractDurationFromPosition', () => {
    const result = subtract(context, TimePosition.beats(6.0), TimeDuration.beats(2.0));
    expect(result.getTimeBase()).toBe(TimeBase.BEATS);
    expect(result.toBeats(context)).toBeCloseTo(4.0, 4);
  });

  it('testSubtractDurationFromPosition_ClampedToZero', () => {
    expect(
      subtract(context, TimePosition.beats(2.0), TimeDuration.beats(5.0)).toBeats(context),
    ).toBeCloseTo(0.0, 4);
  });

  it('testSubtractDurationFromPosition_PreservesTimeBase', () => {
    const result = subtract(context, TimePosition.bbf(3, 1, 0), TimeDuration.beats(4.0));
    expect(result.getTimeBase()).toBe(TimeBase.BBF);
    expect(result.toBeats(context)).toBeCloseTo(4.0, 4);
  });

  // ===== convertDuration =====

  it('testConvertDuration_BeatsToBBF', () => {
    const result = convertDuration(TimeDuration.beats(4.0), TimeBase.BBF, context);
    expect(result.getTimeBase()).toBe(TimeBase.BBF);
    expect(result.getBars()).toBe(1);
    expect(result.getBeats()).toBe(0);
    expect(result.getFraction()).toBe(0);
  });

  it('testConvertDuration_BeatsToBBT', () => {
    const result = convertDuration(TimeDuration.beats(6.0), TimeBase.BBT, context);
    expect(result.getTimeBase()).toBe(TimeBase.BBT);
    expect(result.getBars()).toBe(1);
    expect(result.getBeats()).toBe(2);
  });

  it('testConvertDuration_BeatsToBBST', () => {
    const result = convertDuration(TimeDuration.beats(4.5), TimeBase.BBST, context);
    expect(result.getTimeBase()).toBe(TimeBase.BBST);
    expect(result.getBars()).toBe(1);
    expect(result.getSixteenth()).toBe(2);
  });

  it('testConvertDuration_BeatsToTime', () => {
    const result = convertDuration(TimeDuration.beats(2.0), TimeBase.TIME, context);
    expect(result.getTimeBase()).toBe(TimeBase.TIME);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(2);
  });

  it('testConvertDuration_BeatsToSeconds', () => {
    const result = convertDuration(TimeDuration.beats(2.5), TimeBase.SECONDS, context);
    expect(result.getTimeBase()).toBe(TimeBase.SECONDS);
    expect(result.getTotalSeconds()).toBeCloseTo(2.5, 4);
  });

  it('testConvertDuration_BeatsToFrames', () => {
    const result = convertDuration(TimeDuration.beats(1.0), TimeBase.FRAME, context);
    expect(result.getTimeBase()).toBe(TimeBase.FRAME);
    expect(result.getFrameCount()).toBe(44100);
  });

  it('testConvertDuration_SameTimeBase_ReturnsSame', () => {
    const dur = TimeDuration.beats(4.0);
    expect(convertDuration(dur, TimeBase.BEATS, context)).toBe(dur);
  });

  // ===== beatsToDuration =====

  it('testBeatsToDuration_Zero', () => {
    const result = beatsToDuration(0.0, TimeBase.BBF, context);
    expect(result.getTimeBase()).toBe(TimeBase.BBF);
    expect(result.getBars()).toBe(0);
    expect(result.getBeats()).toBe(0);
  });

  it('testBeatsToDuration_NegativeClamped', () => {
    expect(beatsToDuration(-5.0, TimeBase.BEATS, context).toBeats(context)).toBeCloseTo(0.0, 4);
  });

  it('testBeatsToDuration_BBF_FourBeats', () => {
    const result = beatsToDuration(4.0, TimeBase.BBF, context);
    expect(result.getBars()).toBe(1);
    expect(result.getBeats()).toBe(0);
    expect(result.getFraction()).toBe(0);
  });

  it('testBeatsToDuration_BBF_FiveAndHalfBeats', () => {
    const result = beatsToDuration(5.5, TimeBase.BBF, context);
    expect(result.getBars()).toBe(1);
    expect(result.getBeats()).toBe(1);
    expect(result.getFraction()).toBe(50);
  });

  // ===== fromTimePosition =====

  it('testFromTimePosition_BeatTime', () => {
    expect(fromTimePosition(TimePosition.beats(4.0), context).toBeats(context)).toBeCloseTo(4.0, 4);
  });

  it('testFromTimePosition_BBFPosition', () => {
    expect(fromTimePosition(TimePosition.bbf(2, 1, 0), context).toBeats(context)).toBeCloseTo(
      4.0,
      4,
    );
  });

  it('testFromTimePosition_WithTargetTimeBase', () => {
    const result = fromTimePosition(TimePosition.beats(4.0), TimeBase.BBF, context);
    expect(result.getTimeBase()).toBe(TimeBase.BBF);
    expect(result.getBars()).toBe(1);
    expect(result.getBeats()).toBe(0);
  });

  it('testFromTimePosition_WithTargetSecondsTimeBase', () => {
    const result = fromTimePosition(
      TimePosition.timeValue(0, 0, 4, 500),
      TimeBase.SECONDS,
      context,
    );
    expect(result.getTimeBase()).toBe(TimeBase.SECONDS);
    expect(result.getTotalSeconds()).toBeCloseTo(4.5, 4);
  });

  // ===== Non-4/4 =====

  it('testConvertDuration_BBF_In34', () => {
    const mm = new MeterMap();
    mm.clear();
    mm.add(new MeasureMeterPair(1, new Meter(3, 4)));
    const ctx = makeDefaultContext();
    ctx.setMeterMap(mm);

    const result = beatsToDuration(3.0, TimeBase.BBF, ctx);
    expect(result.getBars()).toBe(1);
    expect(result.getBeats()).toBe(0);
  });

  it('testAddPositionDuration_In34', () => {
    const mm = new MeterMap();
    mm.clear();
    mm.add(new MeasureMeterPair(1, new Meter(3, 4)));
    const ctx = makeDefaultContext();
    ctx.setMeterMap(mm);

    const result = add(ctx, TimePosition.beats(0.0), TimeDuration.bbt(1, 0, 0));
    expect(result.toBeats(ctx)).toBeCloseTo(3.0, 4);
  });
});
