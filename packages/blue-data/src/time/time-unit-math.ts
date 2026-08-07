/**
 * TimeUnitMath — type-safe arithmetic operations on time values.
 * Mirrors the Java TimeUnitMath class.
 *
 * All operations convert through beats as the intermediate representation.
 * Position-type is preserved when adding/subtracting durations.
 */
import { TimePosition } from './time-position';
import { TimeDuration } from './time-duration';
import { TimeBase } from './time-base';
import { TimeContext } from './time-context';

/**
 * Add a duration to a position, returning a new position of the same type.
 */
export function add(context: TimeContext, position: TimePosition, duration: TimeDuration): TimePosition;
/**
 * Add two durations, returning DurationBeats.
 */
export function add(context: TimeContext, a: TimeDuration, b: TimeDuration): TimeDuration;
export function add(context: TimeContext, a: TimePosition | TimeDuration, b: TimeDuration): TimePosition | TimeDuration {
  if (a instanceof TimePosition) {
    // Position + Duration → Position
    const beats = a.toBeats(context) + b.toBeats(context);
    return beatsToTimePosition(Math.max(0, beats), a.getTimeBase(), context);
  } else {
    // Duration + Duration → Duration (beats)
    return TimeDuration.beats(Math.max(0, a.toBeats(context) + b.toBeats(context)));
  }
}

/**
 * Subtract a duration from a position, returning a new position clamped to 0.
 */
export function subtract(context: TimeContext, position: TimePosition, duration: TimeDuration): TimePosition;
/**
 * Subtract two durations, returning DurationBeats clamped to 0.
 */
export function subtract(context: TimeContext, a: TimeDuration, b: TimeDuration): TimeDuration;
export function subtract(context: TimeContext, a: TimePosition | TimeDuration, b: TimeDuration): TimePosition | TimeDuration {
  if (a instanceof TimePosition) {
    // Position - Duration → Position (clamped to 0)
    const beats = Math.max(0, a.toBeats(context) - b.toBeats(context));
    return beatsToTimePosition(beats, a.getTimeBase(), context);
  } else {
    // Duration - Duration → Duration (clamped to 0)
    return TimeDuration.beats(Math.max(0, a.toBeats(context) - b.toBeats(context)));
  }
}

/**
 * Get the absolute distance between two positions as DurationBeats.
 */
export function distance(context: TimeContext, from: TimePosition, to: TimePosition): TimeDuration {
  return TimeDuration.beats(Math.abs(to.toBeats(context) - from.toBeats(context)));
}

/**
 * Get the forward distance (to - from), clamped to 0 if reversed.
 */
export function forwardDistance(context: TimeContext, from: TimePosition, to: TimePosition): TimeDuration {
  return TimeDuration.beats(Math.max(0, to.toBeats(context) - from.toBeats(context)));
}

/**
 * Convert a duration to a different time base.
 * Returns the same instance if the time bases match.
 */
export function convertDuration(dur: TimeDuration, targetBase: TimeBase, context: TimeContext): TimeDuration {
  if (dur.getTimeBase() === targetBase) return dur;
  const beats = dur.toBeats(context);
  return beatsToDuration(beats, targetBase, context);
}

/**
 * Convert raw beats to a duration of the given time base.
 */
export function beatsToDuration(beats: number, targetBase: TimeBase, context: TimeContext): TimeDuration {
  if (beats < 0) beats = 0;

  switch (targetBase) {
    case TimeBase.BEATS:
      return TimeDuration.beats(beats);

    case TimeBase.BBT: {
      const meterMap = context.getMeterMap();
      const meter = meterMap.get(0).meter;
      const beatsPerMeasure = meter.getBeatsPerMeasure();
      const beatScale = meter.getBeatScale();
      const bars = Math.floor(beats / beatsPerMeasure);
      const remaining = beats - bars * beatsPerMeasure;
      const beatNum = Math.floor(remaining / beatScale);
      const fractionalBeat = remaining - beatNum * beatScale;
      const ppq = 960;
      const ticks = Math.round(fractionalBeat * ppq / beatScale);
      return TimeDuration.bbt(bars, beatNum, Math.min(ticks, ppq - 1));
    }

    case TimeBase.BBST: {
      const meterMap = context.getMeterMap();
      const meter = meterMap.get(0).meter;
      const beatsPerMeasure = meter.getBeatsPerMeasure();
      const beatScale = meter.getBeatScale();
      const ppq = 960;
      const bars = Math.floor(beats / beatsPerMeasure);
      const remainingBeats = beats - bars * beatsPerMeasure;
      const scaledBeat = remainingBeats / beatScale;
      const wholeBeat = Math.floor(scaledBeat);
      const fractionalBeat = scaledBeat - wholeBeat;
      const totalTicks = Math.round(fractionalBeat * ppq);
      const ticksPerSixteenth = ppq / 4;
      const sixteenth = Math.floor(totalTicks / ticksPerSixteenth);
      const ticks = totalTicks % ticksPerSixteenth;
      return TimeDuration.bbst(bars, wholeBeat, sixteenth, ticks);
    }

    case TimeBase.BBF: {
      const meterMap = context.getMeterMap();
      const meter = meterMap.get(0).meter;
      const beatsPerMeasure = meter.getBeatsPerMeasure();
      const beatScale = meter.getBeatScale();
      const bars = Math.floor(beats / beatsPerMeasure);
      const remaining = beats - bars * beatsPerMeasure;
      const fullBeats = Math.floor(remaining / beatScale);
      const fractionalBeat = remaining - fullBeats * beatScale;
      const fraction = Math.round(fractionalBeat * 100 / beatScale);
      return TimeDuration.bbf(bars, fullBeats, Math.min(fraction, 99));
    }

    case TimeBase.TIME:
    case TimeBase.SMPTE: {
      const secs = context.getTempoMap().beatsToSeconds(beats);
      return TimeDuration.fromSeconds(secs);
    }

    case TimeBase.SECONDS: {
      const secs = context.getTempoMap().beatsToSeconds(beats);
      return TimeDuration.seconds(secs);
    }

    case TimeBase.FRAME: {
      const secs = context.getTempoMap().beatsToSeconds(beats);
      return TimeDuration.frames(Math.round(secs * context.getSampleRate()));
    }

    default:
      return TimeDuration.beats(beats);
  }
}

/**
 * Convert a TimePosition to a TimeDuration, optionally converting to a target base.
 * The beat value of the position becomes the duration value.
 */
export function fromTimePosition(position: TimePosition, targetBaseOrContext: TimeBase | TimeContext, context?: TimeContext): TimeDuration {
  if (typeof targetBaseOrContext === 'object') {
    // fromTimePosition(position, context) → DurationBeats
    const beats = position.toBeats(targetBaseOrContext);
    return TimeDuration.beats(beats);
  } else {
    // fromTimePosition(position, targetBase, context)
    const beats = position.toBeats(context!);
    return beatsToDuration(beats, targetBaseOrContext, context!);
  }
}

// Re-export beatsToTimePosition from TimeUtilities to avoid circular dependency
// This function is implemented directly here for self-containment
function beatsToTimePositionInternal(beats: number, base: TimeBase, context: TimeContext): TimePosition {
  switch (base) {
    case TimeBase.BEATS:
      return TimePosition.beats(beats);

    case TimeBase.BBT: {
      const meterMap = context.getMeterMap();
      const bbt = meterMap.beatsToBBT(beats);
      return TimePosition.bbt(bbt.bar, bbt.beat, bbt.ticks);
    }

    case TimeBase.BBST: {
      const meterMap = context.getMeterMap();
      const bbst = meterMap.beatsToBBST(beats);
      return TimePosition.bbst(bbst.bar, bbst.beat, bbst.sixteenth, bbst.ticks);
    }

    case TimeBase.BBF: {
      const meterMap = context.getMeterMap();
      const bbf = meterMap.beatsToBBF(beats);
      return TimePosition.bbf(bbf.bar, bbf.beat, bbf.fraction);
    }

    case TimeBase.TIME:
    case TimeBase.SMPTE: {
      const totalSecs = context.getTempoMap().beatsToSeconds(beats);
      const totalMs = Math.round(totalSecs * 1000);
      const hours = Math.floor(totalMs / 3600000);
      const remainingMs = totalMs - hours * 3600000;
      const minutes = Math.floor(remainingMs / 60000);
      const secMs = remainingMs - minutes * 60000;
      const seconds = Math.floor(secMs / 1000);
      const milliseconds = secMs - seconds * 1000;
      return TimePosition.time(hours, minutes, seconds, milliseconds);
    }

    case TimeBase.SECONDS: {
      const secs = context.getTempoMap().beatsToSeconds(beats);
      return TimePosition.seconds(secs);
    }

    case TimeBase.FRAME: {
      const secs = context.getTempoMap().beatsToSeconds(beats);
      return TimePosition.frames(Math.round(secs * context.getSampleRate()));
    }

    default:
      return TimePosition.beats(beats);
  }
}

/** Internal: create position from beats — delegates to beatsToTimePosition. */
function beatsToTimePosition(beats: number, base: TimeBase, context: TimeContext): TimePosition {
  return beatsToTimePositionInternal(beats, base, context);
}
