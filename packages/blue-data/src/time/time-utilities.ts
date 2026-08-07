/**
 * TimeUtilities — utility functions for time conversions.
 * Mirrors the Java TimeUtilities class.
 */
import { TimePosition } from './time-position';
import { TimeDuration } from './time-duration';
import { TimeBase } from './time-base';
import { TimeContext } from './time-context';

/**
 * Convert a TimePosition to beats using the given context.
 */
export function timePositionToBeats(position: TimePosition, context: TimeContext): number {
  if (!position) throw new Error('position is required');
  if (!context) throw new Error('context is required');
  return position.toBeats(context);
}

/**
 * Convert beats to a TimePosition of the given base type.
 */
export function beatsToTimePosition(beats: number, base: TimeBase, context: TimeContext): TimePosition {
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
      // Normalize to avoid millisecond overflow (e.g., 0.999977 * 1000 = 999.977 ≈ 1000)
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

/**
 * Convert a TimePosition from one base to another.
 * Returns the same instance if the bases match.
 */
export function convertTimePosition(position: TimePosition, targetBase: TimeBase, context: TimeContext): TimePosition {
  if (position.getTimeBase() === targetBase) return position;
  const beats = position.toBeats(context);
  return beatsToTimePosition(beats, targetBase, context);
}

/**
 * Convert seconds to a TimePosition of the given base.
 */
export function secondsToTimePosition(seconds: number, base: TimeBase, context: TimeContext): TimePosition {
  const beats = context.getTempoMap().secondsToBeats(seconds);
  return beatsToTimePosition(beats, base, context);
}

/**
 * Convert a TimePosition to seconds.
 */
export function timePositionToSeconds(position: TimePosition, context: TimeContext): number {
  return position.toSeconds(context);
}

/**
 * Convert frames to a TimePosition of the given base.
 */
export function framesToTimePosition(frames: number, base: TimeBase, context: TimeContext): TimePosition {
  const secs = frames / context.getSampleRate();
  const beats = context.getTempoMap().secondsToBeats(secs);
  return beatsToTimePosition(beats, base, context);
}

/**
 * Convert a TimePosition to frames.
 */
export function timePositionToFrames(position: TimePosition, context: TimeContext): number {
  return position.toFrames(context);
}
