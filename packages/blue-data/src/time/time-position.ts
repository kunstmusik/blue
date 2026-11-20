/**
 * TimePosition — represents a position in time with a specific time base.
 * Mirrors the Java TimePosition class with 7 subtypes.
 *
 * All subtypes are represented as a single class with a type discriminant
 * and type-specific fields. This avoids the Java pattern of nested inner
 * classes while providing the same functionality.
 *
 * Subtypes:
 * - BEATS (BeatTime): csoundBeats — quarter note = 1 beat
 * - BBT (BBTTime): bar (1-based), beat (1-based), ticks — via MeterMap
 * - BBST (BBSTTime): bar, beat, sixteenth (1-4), ticks — via MeterMap
 * - BBF (BBFTime): bar, beat, fraction (0-99 canonical hundredths) — via MeterMap
 * - TIME (TimeValue): hours, minutes, seconds, milliseconds
 * - SECONDS (SecondsValue): totalSeconds
 * - FRAME (FrameValue): frameNumber — via sampleRate
 */
import { TimeBase } from './time-base';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkShape } from '../utilities/xml';
import { readTimeNumber } from './time-xml';
import { TimeContext } from './time-context';

/** Default PPQ (pulses per quarter note). */
const DEFAULT_PPQ = 960;

/**
 * Immutable timeline position tagged with a {@link TimeBase} discriminant, matching Java Blue's
 * `TimePosition` subtypes (`BEATS`, `BBT`, `BBST`, `BBF`, `TIME`, `SECONDS`, `FRAME`; `TimeBase.SMPTE`
 * is display-only and {@link smpte} aliases {@link frames}).
 *
 * Unlike `TimeDuration` (which uses 0-based bars and beats), musical positions use **1-based** bar and
 * beat numbers and convert against a {@link TimeContext}:
 * - `BEATS`: Csound beats (quarter note = 1 beat).
 * - `BBT` / `BBST`: 1-based bar and beat with 960 PPQ ticks (`BBST` also includes 1-based sixteenths `1–4`),
 *   resolved through `TimeContext.getMeterMap()` (`MeterMap` and `Meter.getBeatScale()`).
 * - `BBF`: 1-based bar and beat with `0–99` canonical hundredths, resolved through `TimeContext.getMeterMap()`.
 * - `TIME` / `SECONDS`: wall-clock time (`hh:mm:ss.mmm` or total seconds), converted to/from Csound beats
 *   through `TimeContext.getTempoMap()` (`TempoMap`, defaulting to 60 BPM when disabled).
 * - `FRAME`: audio sample frame index, resolved to seconds via `TimeContext.getSampleRate()` and to
 *   beats via `TimeContext.getTempoMap()`.
 */
export class TimePosition {
  private readonly _timeBase: TimeBase;

  // BeatTime fields
  private readonly _csoundBeats: number;

  // BBTTime fields (1-based)
  private readonly _bar: number;
  private readonly _beat: number;
  private readonly _ticks: number;

  // BBSTTime additional fields
  private readonly _sixteenth: number;

  // BBFTime additional fields (canonical hundredths)
  private readonly _fraction: number;

  // TimeValue fields
  private readonly _hours: number;
  private readonly _minutes: number;
  private readonly _seconds: number;
  private readonly _milliseconds: number;

  // SecondsValue fields
  private readonly _totalSeconds: number;

  // FrameValue fields
  private readonly _frameNumber: number;

  // ─── Private constructor ───

  private constructor(
    timeBase: TimeBase,
    props: Partial<{
      csoundBeats: number;
      bar: number;
      beat: number;
      ticks: number;
      sixteenth: number;
      fraction: number;
      hours: number;
      minutes: number;
      seconds: number;
      milliseconds: number;
      totalSeconds: number;
      frameNumber: number;
    }> = {},
  ) {
    this._timeBase = timeBase;
    this._csoundBeats = props.csoundBeats ?? 0;
    this._bar = props.bar ?? 0;
    this._beat = props.beat ?? 0;
    this._ticks = props.ticks ?? 0;
    this._sixteenth = props.sixteenth ?? 0;
    this._fraction = props.fraction ?? 0;
    this._hours = props.hours ?? 0;
    this._minutes = props.minutes ?? 0;
    this._seconds = props.seconds ?? 0;
    this._milliseconds = props.milliseconds ?? 0;
    this._totalSeconds = props.totalSeconds ?? 0;
    this._frameNumber = props.frameNumber ?? 0;
  }

  // ─── Factory methods ───

  /**
   * Creates a Csound beat position (`TimeBase.BEATS`), where one beat equals one quarter note.
   *
   * @param csoundBeats Position in Csound beats (quarter notes).
   */
  static beats(csoundBeats: number): TimePosition {
    return new TimePosition(TimeBase.BEATS, { csoundBeats });
  }

  /**
   * Creates a Bars.Beats.Ticks position (`TimeBase.BBT`) using 1-based `bar` and `beat` numbers
   * and 960 PPQ `ticks`. Resolved to Csound beats via `TimeContext.getMeterMap()`.
   *
   * @param bar 1-based measure number (`>= 1`).
   * @param beat 1-based beat within the measure (`>= 1`).
   * @param ticks Sub-beat ticks at 960 PPQ (`>= 0`).
   * @throws Error if `bar < 1`, `beat < 1`, or `ticks < 0`.
   */
  static bbt(bar: number, beat: number, ticks: number): TimePosition {
    if (bar < 1) throw new Error(`Invalid bar: ${bar} (must be >= 1)`);
    if (beat < 1) throw new Error(`Invalid beat: ${beat} (must be >= 1)`);
    if (ticks < 0) throw new Error(`Invalid ticks: ${ticks} (must be >= 0)`);
    return new TimePosition(TimeBase.BBT, { bar, beat, ticks });
  }

  /**
   * Creates a Bars.Beats.Sixteenths.Ticks position (`TimeBase.BBST`) using 1-based `bar`, `beat`,
   * and `sixteenth` (`1–4`, 240 ticks per sixteenth at 960 PPQ). Resolved via `TimeContext.getMeterMap()`.
   *
   * @param bar 1-based measure number (`>= 1`).
   * @param beat 1-based beat within the measure (`>= 1`).
   * @param sixteenth 1-based sixteenth subdivision within the beat (`1–4`).
   * @param ticks Sub-sixteenth ticks (`>= 0`).
   * @throws Error if `bar < 1`, `beat < 1`, `sixteenth` is outside `1–4`, or `ticks < 0`.
   */
  static bbst(bar: number, beat: number, sixteenth: number, ticks: number): TimePosition {
    if (bar < 1) throw new Error(`Invalid bar: ${bar} (must be >= 1)`);
    if (beat < 1) throw new Error(`Invalid beat: ${beat} (must be >= 1)`);
    if (sixteenth < 1 || sixteenth > 4)
      throw new Error(`Invalid sixteenth: ${sixteenth} (must be 1-4)`);
    if (ticks < 0) throw new Error(`Invalid ticks: ${ticks} (must be >= 0)`);
    return new TimePosition(TimeBase.BBST, { bar, beat, sixteenth, ticks });
  }

  /**
   * Creates a Bars.Beats.Fraction position (`TimeBase.BBF`) using 1-based `bar` and `beat` numbers
   * and canonical hundredths `fraction` (`0–99`). Resolved via `TimeContext.getMeterMap()`.
   *
   * @param bar 1-based measure number (`>= 1`).
   * @param beat 1-based beat within the measure (`>= 1`).
   * @param fraction Canonical hundredths of a beat (`0–99`).
   * @throws Error if `bar < 1`, `beat < 1`, or `fraction` is outside `0–99`.
   */
  static bbf(bar: number, beat: number, fraction: number): TimePosition {
    if (bar < 1) throw new Error(`Invalid bar: ${bar} (must be >= 1)`);
    if (beat < 1) throw new Error(`Invalid beat: ${beat} (must be >= 1)`);
    if (fraction < 0 || fraction >= 100)
      throw new Error(`Invalid fraction: ${fraction} (must be 0-99)`);
    return new TimePosition(TimeBase.BBF, { bar, beat, fraction });
  }

  /**
   * Creates a wall-clock `TimeValue` position (`TimeBase.TIME`).
   *
   * @param hours Non-negative hours (`>= 0`).
   * @param minutes Minutes (`0–59`).
   * @param seconds Seconds (`0–59`).
   * @param milliseconds Milliseconds (`0–999`).
   * @throws Error if any field is out of range.
   */
  static timeValue(
    hours: number,
    minutes: number,
    seconds: number,
    milliseconds: number,
  ): TimePosition {
    if (hours < 0) throw new Error(`Invalid hours: ${hours}`);
    if (minutes < 0 || minutes >= 60) throw new Error(`Invalid minutes: ${minutes}`);
    if (seconds < 0 || seconds >= 60) throw new Error(`Invalid seconds: ${seconds}`);
    if (milliseconds < 0 || milliseconds >= 1000)
      throw new Error(`Invalid milliseconds: ${milliseconds}`);
    return new TimePosition(TimeBase.TIME, { hours, minutes, seconds, milliseconds });
  }

  /** Alias for {@link timeValue} matching Java `TimePosition.time()`. */
  static time(hours: number, minutes: number, seconds: number, milliseconds: number): TimePosition {
    return TimePosition.timeValue(hours, minutes, seconds, milliseconds);
  }

  /**
   * Creates a wall-clock seconds position (`TimeBase.SECONDS`).
   *
   * @param totalSeconds Non-negative finite elapsed seconds (`>= 0`).
   * @throws Error if `totalSeconds < 0` or not finite.
   */
  static seconds(totalSeconds: number): TimePosition {
    if (totalSeconds < 0) throw new Error(`Invalid totalSeconds: ${totalSeconds} (must be >= 0)`);
    if (!isFinite(totalSeconds))
      throw new Error(`Invalid totalSeconds: ${totalSeconds} (must be finite)`);
    return new TimePosition(TimeBase.SECONDS, { totalSeconds });
  }

  /**
   * Creates a sample-frame position (`TimeBase.FRAME`), resolved to wall-clock seconds via
   * `TimeContext.getSampleRate()`.
   *
   * @param frameNumber Non-negative audio sample frame index (`>= 0`).
   * @throws Error if `frameNumber < 0`.
   */
  static frames(frameNumber: number): TimePosition {
    if (frameNumber < 0) throw new Error(`Invalid frameNumber: ${frameNumber} (must be >= 0)`);
    return new TimePosition(TimeBase.FRAME, { frameNumber });
  }

  /** Alias for {@link frames} (SMPTE frame-count compatibility). */
  static smpte(frames: number): TimePosition {
    return TimePosition.frames(frames);
  }

  // ─── Accessors ───

  getTimeBase(): TimeBase {
    return this._timeBase;
  }

  /** Whether this is a BeatTime. */
  isBeatTime(): boolean {
    return this._timeBase === TimeBase.BEATS;
  }

  /** Get the raw csoundBeats value (only valid for BEATS type). */
  getValue(): number {
    if (this._timeBase === TimeBase.BEATS) return this._csoundBeats;
    if (this._timeBase === TimeBase.SECONDS) return this._totalSeconds;
    if (this._timeBase === TimeBase.FRAME) return this._frameNumber;
    return this._csoundBeats;
  }

  // BeatTime
  getCsoundBeats(): number {
    return this._csoundBeats;
  }

  // BBTTime
  getBar(): number {
    return this._bar;
  }
  getBeat(): number {
    return this._beat;
  }
  getTicks(): number {
    return this._ticks;
  }

  // BBSTTime
  getSixteenth(): number {
    return this._sixteenth;
  }

  // BBFTime
  getFraction(): number {
    return this._fraction;
  }

  // TimeValue
  getHours(): number {
    return this._hours;
  }
  getMinutes(): number {
    return this._minutes;
  }
  getSeconds(): number {
    return this._seconds;
  }
  getMilliseconds(): number {
    return this._milliseconds;
  }

  /** Get total seconds for TimeValue. */
  toTotalSeconds(): number {
    return this._hours * 3600 + this._minutes * 60 + this._seconds + this._milliseconds / 1000;
  }

  // SecondsValue
  getTotalSeconds(): number {
    return this._totalSeconds;
  }

  // FrameValue
  getFrameNumber(): number {
    return this._frameNumber;
  }

  // ─── Conversions ───

  /**
   * Converts this position to Csound beats (quarter note = 1 beat) using the provided {@link TimeContext}.
   *
   * - `BEATS`: returns `csoundBeats` directly.
   * - `BBT` / `BBST` / `BBF`: resolves 1-based bar and beat via `context.getMeterMap()` (`MeterMap`
   *   and `Meter.getBeatScale()`) with fixed 960 PPQ ticks (`BBT`/`BBST`) or `0–99` hundredths (`BBF`).
   * - `TIME` / `SECONDS`: converts wall-clock seconds via `context.getTempoMap().secondsToBeats()`.
   * - `FRAME`: divides `frameNumber` by `context.getSampleRate()` and converts via `TempoMap.secondsToBeats()`.
   *
   * @param context Project timing context supplying `MeterMap`, `TempoMap`, and sample rate.
   * @returns Position in Csound beats (quarter notes).
   */
  toBeats(context: TimeContext): number {
    switch (this._timeBase) {
      case TimeBase.BEATS:
        return this._csoundBeats;

      case TimeBase.BBT: {
        const meterMap = context.getMeterMap();
        const meter = meterMap.getMeterForMeasure(this._bar);
        return (
          meterMap.barBeatToBeats(this._bar, this._beat) +
          (this._ticks / DEFAULT_PPQ) * meter.getBeatScale()
        );
      }

      case TimeBase.BBST: {
        const meterMap = context.getMeterMap();
        const meter = meterMap.getMeterForMeasure(this._bar);
        const totalTicks = (this._sixteenth - 1) * (DEFAULT_PPQ / 4) + this._ticks;
        return (
          meterMap.barBeatToBeats(this._bar, this._beat) +
          (totalTicks / DEFAULT_PPQ) * meter.getBeatScale()
        );
      }

      case TimeBase.BBF: {
        const meterMap = context.getMeterMap();
        const meter = meterMap.getMeterForMeasure(this._bar);
        return (
          meterMap.barBeatToBeats(this._bar, this._beat) +
          (this._fraction / 100.0) * meter.getBeatScale()
        );
      }

      case TimeBase.TIME: {
        const secs = this.toTotalSeconds();
        return context.getTempoMap().secondsToBeats(secs);
      }

      case TimeBase.SECONDS: {
        return context.getTempoMap().secondsToBeats(this._totalSeconds);
      }

      case TimeBase.FRAME: {
        const secs = this._frameNumber / context.getSampleRate();
        return context.getTempoMap().secondsToBeats(secs);
      }

      case TimeBase.SMPTE:
      default:
        return this._csoundBeats;
    }
  }

  /**
   * Converts this position to wall-clock seconds using the provided {@link TimeContext}.
   *
   * - `TIME` / `SECONDS`: returns wall-clock seconds directly without consulting `TempoMap`.
   * - `FRAME`: divides `frameNumber` by `context.getSampleRate()`.
   * - Beat- and bar-based bases (`BEATS`, `BBT`, `BBST`, `BBF`): resolves to Csound beats via
   *   {@link toBeats} (consulting `MeterMap` where applicable) and converts through
   *   `context.getTempoMap().beatsToSeconds()`.
   *
   * @param context Project timing context supplying `MeterMap`, `TempoMap`, and sample rate.
   * @returns Position in wall-clock seconds.
   */
  toSeconds(context: TimeContext): number {
    switch (this._timeBase) {
      case TimeBase.BEATS:
        return context.getTempoMap().beatsToSeconds(this._csoundBeats);

      case TimeBase.TIME:
        return this.toTotalSeconds();

      case TimeBase.SECONDS:
        return this._totalSeconds;

      case TimeBase.FRAME:
        return this._frameNumber / context.getSampleRate();

      default:
        return context.getTempoMap().beatsToSeconds(this.toBeats(context));
    }
  }

  /**
   * Converts this position to the nearest audio sample frame (`Math.round(toSeconds(context) * sampleRate)`)
   * using `context.getSampleRate()`.
   */
  toFrames(context: TimeContext): number {
    return Math.round(this.toSeconds(context) * context.getSampleRate());
  }

  /** Get total seconds for FrameValue using the given sample rate. */
  toTotalSecondsForSampleRate(sampleRate: number): number {
    if (sampleRate <= 0) throw new Error(`Invalid sampleRate: ${sampleRate}`);
    return this._timeBase === TimeBase.FRAME
      ? this._frameNumber / sampleRate
      : this.toTotalSeconds();
  }

  /**
   * Convert BBT to BBST. Only valid for BBT type.
   * Returns a new BBST position with the same bar and beat,
   * converting ticks within the beat to sixteenth+subticks.
   */
  toBBST(ppq: number): TimePosition {
    if (this._timeBase !== TimeBase.BBT) {
      throw new Error('toBBST is only valid for BBT positions');
    }
    const ticksPerSixteenth = ppq / 4;
    const sixteenth = Math.floor(this._ticks / ticksPerSixteenth) + 1;
    const ticks = this._ticks % ticksPerSixteenth;
    return TimePosition.bbst(this._bar, this._beat, Math.min(sixteenth, 4), ticks);
  }

  // ─── Comparison ───

  lt(context: TimeContext, other: TimePosition): boolean {
    return this.toBeats(context) < other.toBeats(context);
  }

  gt(context: TimeContext, other: TimePosition): boolean {
    return this.toBeats(context) > other.toBeats(context);
  }

  lte(context: TimeContext, other: TimePosition): boolean {
    return this.toBeats(context) <= other.toBeats(context);
  }

  gte(context: TimeContext, other: TimePosition): boolean {
    return this.toBeats(context) >= other.toBeats(context);
  }

  // ─── Comparison ───

  equals(other: TimePosition): boolean {
    if (this._timeBase !== other._timeBase) return false;
    switch (this._timeBase) {
      case TimeBase.BEATS:
        return this._csoundBeats === other._csoundBeats;
      case TimeBase.BBT:
        return (
          this._bar === other._bar && this._beat === other._beat && this._ticks === other._ticks
        );
      case TimeBase.BBST:
        return (
          this._bar === other._bar &&
          this._beat === other._beat &&
          this._sixteenth === other._sixteenth &&
          this._ticks === other._ticks
        );
      case TimeBase.BBF:
        return (
          this._bar === other._bar &&
          this._beat === other._beat &&
          this._fraction === other._fraction
        );
      case TimeBase.TIME:
        return (
          this._hours === other._hours &&
          this._minutes === other._minutes &&
          this._seconds === other._seconds &&
          this._milliseconds === other._milliseconds
        );
      case TimeBase.SECONDS:
        return this._totalSeconds === other._totalSeconds;
      case TimeBase.FRAME:
        return this._frameNumber === other._frameNumber;
      default:
        return false;
    }
  }

  hashCode(): number {
    const h = (n: number) => ((n >>> 0) * 2654435761) | 0;
    switch (this._timeBase) {
      case TimeBase.BEATS:
        return h(this._csoundBeats);
      case TimeBase.BBT:
        return h(this._bar * 31 + this._beat * 7 + this._ticks);
      case TimeBase.BBST:
        return h(this._bar * 31 + this._beat * 7 + this._sixteenth * 3 + this._ticks);
      case TimeBase.BBF:
        return h(this._bar * 31 + this._beat * 7 + this._fraction);
      case TimeBase.TIME:
        return h(
          this._hours * 3600 + this._minutes * 60 + this._seconds * 1000 + this._milliseconds,
        );
      case TimeBase.SECONDS:
        return h(this._totalSeconds);
      case TimeBase.FRAME:
        return h(this._frameNumber);
      default:
        return 0;
    }
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('timePosition');

    switch (this._timeBase) {
      case TimeBase.BEATS:
        elem.setAttribute('type', 'BEATS');
        elem.addElement('csoundBeats').setText(this._csoundBeats.toString());
        break;

      case TimeBase.BBT:
        elem.setAttribute('type', 'BBT');
        elem.addElement('bar').setText(this._bar.toString());
        elem.addElement('beat').setText(this._beat.toString());
        elem.addElement('ticks').setText(this._ticks.toString());
        break;

      case TimeBase.BBST:
        elem.setAttribute('type', 'BBST');
        elem.addElement('bar').setText(this._bar.toString());
        elem.addElement('beat').setText(this._beat.toString());
        elem.addElement('sixteenth').setText(this._sixteenth.toString());
        elem.addElement('ticks').setText(this._ticks.toString());
        break;

      case TimeBase.BBF:
        elem.setAttribute('type', 'BBF');
        elem.addElement('bar').setText(this._bar.toString());
        elem.addElement('beat').setText(this._beat.toString());
        elem.addElement('fraction').setText(this._fraction.toString());
        break;

      case TimeBase.TIME:
        elem.setAttribute('type', 'TIME');
        elem.addElement('hours').setText(this._hours.toString());
        elem.addElement('minutes').setText(this._minutes.toString());
        elem.addElement('seconds').setText(this._seconds.toString());
        elem.addElement('milliseconds').setText(this._milliseconds.toString());
        break;

      case TimeBase.SECONDS:
        elem.setAttribute('type', 'SECONDS');
        elem.addElement('totalSeconds').setText(this._totalSeconds.toString());
        break;

      case TimeBase.FRAME:
        elem.setAttribute('type', 'FRAME');
        elem.addElement('frameNumber').setText(this._frameNumber.toString());
        break;

      default:
        elem.setAttribute('type', 'BEATS');
        elem.addElement('csoundBeats').setText(this._csoundBeats.toString());
    }

    return elem;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): TimePosition {
    const type = data.getAttribute('type') ?? '';
    switch (type) {
      case 'BEATS':
      case 'CSOUND_BEATS':
      case 'BeatTime': {
        checkShape(data, ['type'], ['csoundBeats'], context);
        return TimePosition.beats(readTimeNumber(data, context, ['csoundBeats']));
      }
      case 'BBT':
      case 'BBTTime': {
        checkShape(data, ['type'], ['bar', 'beat', 'ticks'], context);
        return TimePosition.bbt(
          readTimeNumber(data, context, ['bar'], true, 1),
          readTimeNumber(data, context, ['beat'], true, 1),
          readTimeNumber(data, context, ['ticks'], true, 0, Number.MAX_SAFE_INTEGER),
        );
      }
      case 'BBST':
      case 'BBSTTime': {
        checkShape(data, ['type'], ['bar', 'beat', 'sixteenth', 'ticks'], context);
        return TimePosition.bbst(
          readTimeNumber(data, context, ['bar'], true, 1),
          readTimeNumber(data, context, ['beat'], true, 1),
          readTimeNumber(data, context, ['sixteenth'], true, 1, 4),
          readTimeNumber(data, context, ['ticks'], true, 0, Number.MAX_SAFE_INTEGER),
        );
      }
      case 'BBF':
      case 'BBFTime': {
        checkShape(data, ['type'], ['bar', 'beat', 'fraction'], context);
        return TimePosition.bbf(
          readTimeNumber(data, context, ['bar'], true, 1),
          readTimeNumber(data, context, ['beat'], true, 1),
          readTimeNumber(data, context, ['fraction'], true, 0, 99),
        );
      }
      case 'TIME':
      case 'TimeValue': {
        checkShape(data, ['type'], ['hours', 'minutes', 'seconds', 'milliseconds'], context);
        return TimePosition.timeValue(
          readTimeNumber(data, context, ['hours'], true, 0),
          readTimeNumber(data, context, ['minutes'], true, 0, 59),
          readTimeNumber(data, context, ['seconds'], true, 0, 59),
          readTimeNumber(data, context, ['milliseconds'], true, 0, 999),
        );
      }
      case 'SECONDS':
      case 'SecondsValue': {
        checkShape(data, ['type'], ['totalSeconds', 'seconds'], context);
        return TimePosition.seconds(readTimeNumber(data, context, ['totalSeconds', 'seconds']));
      }
      case 'FRAME':
      case 'FrameValue': {
        checkShape(data, ['type'], ['frameCount', 'frameNumber'], context);
        return TimePosition.frames(
          readTimeNumber(
            data,
            context,
            ['frameCount', 'frameNumber'],
            true,
            Number.MIN_SAFE_INTEGER,
          ),
        );
      }
      default:
        throw context.at(data).error({
          code: 'type',
          member: '@type',
          value: type,
          message: 'Unknown or missing typed time discriminator.',
          recovery: 'Choose a supported time type and supply its required fields.',
        });
    }
  }
}
