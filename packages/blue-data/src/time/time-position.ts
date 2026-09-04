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
import { TimeBase, isBeatBased } from './time-base';
import { Element } from '../serialization/xml-reader';
import { TimeContext } from './time-context';

/** Default PPQ (pulses per quarter note). */
const DEFAULT_PPQ = 960;

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

  /** Create a BeatTime position. */
  static beats(csoundBeats: number): TimePosition {
    return new TimePosition(TimeBase.BEATS, { csoundBeats });
  }

  /** Create a BBTTime position (1-based bar and beat). */
  static bbt(bar: number, beat: number, ticks: number): TimePosition {
    if (bar < 1) throw new Error(`Invalid bar: ${bar} (must be >= 1)`);
    if (beat < 1) throw new Error(`Invalid beat: ${beat} (must be >= 1)`);
    if (ticks < 0) throw new Error(`Invalid ticks: ${ticks} (must be >= 0)`);
    return new TimePosition(TimeBase.BBT, { bar, beat, ticks });
  }

  /** Create a BBSTTime position (1-based bar, beat, sixteenth 1-4, ticks). */
  static bbst(bar: number, beat: number, sixteenth: number, ticks: number): TimePosition {
    if (bar < 1) throw new Error(`Invalid bar: ${bar} (must be >= 1)`);
    if (beat < 1) throw new Error(`Invalid beat: ${beat} (must be >= 1)`);
    if (sixteenth < 1 || sixteenth > 4)
      throw new Error(`Invalid sixteenth: ${sixteenth} (must be 1-4)`);
    if (ticks < 0) throw new Error(`Invalid ticks: ${ticks} (must be >= 0)`);
    return new TimePosition(TimeBase.BBST, { bar, beat, sixteenth, ticks });
  }

  /** Create a BBFTime position (1-based bar, beat, fraction 0-99 canonical hundredths). */
  static bbf(bar: number, beat: number, fraction: number): TimePosition {
    if (bar < 1) throw new Error(`Invalid bar: ${bar} (must be >= 1)`);
    if (beat < 1) throw new Error(`Invalid beat: ${beat} (must be >= 1)`);
    if (fraction < 0 || fraction >= 100)
      throw new Error(`Invalid fraction: ${fraction} (must be 0-99)`);
    return new TimePosition(TimeBase.BBF, { bar, beat, fraction });
  }

  /** Create a TimeValue position. */
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

  /** Alias for timeValue matching Java TimePosition.time(). */
  static time(hours: number, minutes: number, seconds: number, milliseconds: number): TimePosition {
    return TimePosition.timeValue(hours, minutes, seconds, milliseconds);
  }

  /** Create a SecondsValue position. */
  static seconds(totalSeconds: number): TimePosition {
    if (totalSeconds < 0) throw new Error(`Invalid totalSeconds: ${totalSeconds} (must be >= 0)`);
    if (!isFinite(totalSeconds))
      throw new Error(`Invalid totalSeconds: ${totalSeconds} (must be finite)`);
    return new TimePosition(TimeBase.SECONDS, { totalSeconds });
  }

  /** Create a FrameValue position. */
  static frames(frameNumber: number): TimePosition {
    if (frameNumber < 0) throw new Error(`Invalid frameNumber: ${frameNumber} (must be >= 0)`);
    return new TimePosition(TimeBase.FRAME, { frameNumber });
  }

  /** Alias for frames (SMPTE compatibility). */
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

  /** Convert to Csound beats using the provided context. */
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

  /** Convert to seconds using the provided context. */
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

  /** Convert to frames using the provided context. */
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
        elem.addElement('frameCount').setText(this._frameNumber.toString());
        break;

      default:
        elem.setAttribute('type', 'BEATS');
        elem.addElement('csoundBeats').setText(this._csoundBeats.toString());
    }

    return elem;
  }

  static loadFromXML(data: Element): TimePosition {
    const type = data.getAttributeValue('type') ?? '';

    switch (type) {
      case 'BEATS':
      case 'CSOUND_BEATS':
      case 'BeatTime': {
        const csoundBeats = parseFloat(
          data.getTextString('csoundBeats') ?? data.getTextString() ?? '0',
        );
        return TimePosition.beats(csoundBeats);
      }

      case 'BBT':
      case 'BBTTime': {
        const bar = parseInt(data.getTextString('bar') ?? '1', 10);
        const beat = parseInt(data.getTextString('beat') ?? '1', 10);
        const ticks = parseInt(data.getTextString('ticks') ?? '0', 10);
        return TimePosition.bbt(bar || 1, beat || 1, ticks || 0);
      }

      case 'BBST':
      case 'BBSTTime': {
        const bar = parseInt(data.getTextString('bar') ?? '1', 10);
        const beat = parseInt(data.getTextString('beat') ?? '1', 10);
        const sixteenth = parseInt(data.getTextString('sixteenth') ?? '1', 10);
        const ticks = parseInt(data.getTextString('ticks') ?? '0', 10);
        return TimePosition.bbst(bar || 1, beat || 1, sixteenth || 1, ticks || 0);
      }

      case 'BBF':
      case 'BBFTime': {
        const bar = parseInt(data.getTextString('bar') ?? '1', 10);
        const beat = parseInt(data.getTextString('beat') ?? '1', 10);
        const fraction = parseInt(data.getTextString('fraction') ?? '0', 10);
        return TimePosition.bbf(bar || 1, beat || 1, fraction || 0);
      }

      case 'TIME':
      case 'TimeValue': {
        const hours = parseInt(data.getTextString('hours') ?? '0', 10);
        const minutes = parseInt(data.getTextString('minutes') ?? '0', 10);
        const seconds = parseInt(data.getTextString('seconds') ?? '0', 10);
        const milliseconds = parseInt(data.getTextString('milliseconds') ?? '0', 10);
        return TimePosition.timeValue(hours, minutes, seconds, milliseconds);
      }

      case 'SECONDS':
      case 'SecondsValue': {
        const totalSeconds = parseFloat(
          data.getTextString('totalSeconds') ??
            data.getTextString('seconds') ??
            data.getTextString() ??
            '0',
        );
        return TimePosition.seconds(totalSeconds);
      }

      case 'FRAME':
      case 'FrameValue': {
        const frameNumber = parseFloat(
          data.getTextString('frameCount') ??
            data.getTextString('frameNumber') ??
            data.getTextString() ??
            '0',
        );
        return TimePosition.frames(frameNumber);
      }

      default: {
        // Fallback: try to parse as plain number
        const text = data.getTextString();
        const value = text ? parseFloat(text) : 0;
        return TimePosition.beats(isNaN(value) ? 0 : value);
      }
    }
  }
}
