/**
 * TimeBase — enumeration of time units used in Blue.
 * Mirrors the Java TimeBase enum.
 *
 * 8 time bases matching the Java implementation:
 * - BEATS: Csound beats (quarter note = 1 beat)
 * - BBT: Bars.Beats.Ticks (1-based position)
 * - BBST: Bars.Beats.Sixteenths.Ticks (1-based position)
 * - BBF: Bars.Beats.Fraction (1-based position, fraction 0-99 canonical hundredths)
 * - TIME: Hours:Minutes:Seconds.Milliseconds
 * - SMPTE: SMPTE timecode (display only)
 * - SECONDS: Raw seconds
 * - FRAME: Audio sample frame number
 */
/** Storage and presentation units for musical and elapsed time. */
export enum TimeBase {
  /** Csound quarter-note beats. */
  BEATS = 'BEATS',
  /** Bars, beats, and ticks. */
  BBT = 'BBT',
  /** Bars, beats, sixteenths, and ticks. */
  BBST = 'BBST',
  /** Bars, beats, and hundredths of a beat. */
  BBF = 'BBF',
  /** Elapsed hours, minutes, seconds, and milliseconds. */
  TIME = 'TIME',
  /** SMPTE timecode for presentation. */
  SMPTE = 'SMPTE',
  /** Scalar elapsed seconds. */
  SECONDS = 'SECONDS',
  /** Audio sample frames at the project sample rate. */
  FRAME = 'FRAME',
}

/**
 * Returns true for beat-based time bases that use MeterMap for conversion.
 * BEATS, BBT, BBST, and BBF all represent positions/durations in musical beats.
 */
export function isBeatBased(timeBase: TimeBase): boolean {
  return (
    timeBase === TimeBase.BEATS ||
    timeBase === TimeBase.BBT ||
    timeBase === TimeBase.BBST ||
    timeBase === TimeBase.BBF
  );
}
