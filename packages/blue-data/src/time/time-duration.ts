/**
 * TimeDuration — represents a duration of time with a specific time base.
 * Mirrors the Java TimeDuration class with 7 subtypes.
 *
 * Key difference from TimePosition: bar/beat-based duration types use
 * 0-based bars and beats (duration semantics), and use the first meter
 * entry's meter for conversion (not MeterMap.barBeatToBeats which accounts
 * for meter changes at specific positions).
 */
import { TimeBase } from './time-base';
import { TimeContext } from './time-context';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkShape } from '../utilities/xml';
import { readTimeNumber } from './time-xml';

/** Default PPQ (pulses per quarter note). */
const DEFAULT_PPQ = 960;

/** Immutable time span in a specific {@link TimeBase}. Bar and beat counts are zero-based and convert using the first meter. */
export class TimeDuration {
  private readonly _timeBase: TimeBase;

  // DurationBeats fields
  private readonly _csoundBeats: number;

  // DurationBBT fields (0-based)
  private readonly _bar: number;
  private readonly _beat: number;
  private readonly _ticks: number;

  // DurationBBST additional fields
  private readonly _sixteenth: number;

  // DurationBBF additional fields (canonical hundredths)
  private readonly _fraction: number;

  // DurationTime fields
  private readonly _hours: number;
  private readonly _minutes: number;
  private readonly _seconds: number;
  private readonly _milliseconds: number;

  // DurationSeconds fields
  private readonly _totalSeconds: number;

  // DurationFrames fields
  private readonly _frameCount: number;

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
      frameCount: number;
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
    this._frameCount = props.frameCount ?? 0;
  }

  // ─── Static constants ───

  /** Zero-length span expressed in Csound beats. */
  static readonly ZERO = new TimeDuration(TimeBase.BEATS, { csoundBeats: 0 });

  // ─── Factory methods ───

  /** Creates a nonnegative duration in Csound beats, where one quarter note is one beat. */
  static beats(csoundBeats: number): TimeDuration {
    if (csoundBeats < 0) throw new Error(`Invalid csoundBeats: ${csoundBeats} (must be >= 0)`);
    return new TimeDuration(TimeBase.BEATS, { csoundBeats });
  }

  /** Creates a span from zero-based bar and beat counts and ticks. */
  static bbt(bar: number, beat: number, ticks: number): TimeDuration {
    if (bar < 0) throw new Error(`Invalid bar: ${bar} (must be >= 0)`);
    if (beat < 0) throw new Error(`Invalid beat: ${beat} (must be >= 0)`);
    if (ticks < 0) throw new Error(`Invalid ticks: ${ticks} (must be >= 0)`);
    return new TimeDuration(TimeBase.BBT, { bar, beat, ticks });
  }

  /** Creates a span from zero-based bars, beats, and sixteenths (0–3), with remaining ticks. */
  static bbst(bar: number, beat: number, sixteenth: number, ticks: number): TimeDuration {
    if (bar < 0) throw new Error(`Invalid bar: ${bar} (must be >= 0)`);
    if (beat < 0) throw new Error(`Invalid beat: ${beat} (must be >= 0)`);
    if (sixteenth < 0 || sixteenth > 3)
      throw new Error(`Invalid sixteenth: ${sixteenth} (must be 0-3)`);
    if (ticks < 0) throw new Error(`Invalid ticks: ${ticks} (must be >= 0)`);
    return new TimeDuration(TimeBase.BBST, { bar, beat, sixteenth, ticks });
  }

  /** Creates a span in zero-based bars and beats plus a fraction in hundredths (0–99). */
  static bbf(bar: number, beat: number, fraction: number): TimeDuration {
    if (bar < 0) throw new Error(`Invalid bar: ${bar} (must be >= 0)`);
    if (beat < 0) throw new Error(`Invalid beat: ${beat} (must be >= 0)`);
    if (fraction < 0 || fraction >= 100)
      throw new Error(`Invalid fraction: ${fraction} (must be 0-99)`);
    return new TimeDuration(TimeBase.BBF, { bar, beat, fraction });
  }

  /** Creates a wall-clock span from hours, minutes, seconds, and milliseconds. */
  static timeValue(
    hours: number,
    minutes: number,
    seconds: number,
    milliseconds: number,
  ): TimeDuration {
    if (hours < 0) throw new Error(`Invalid hours: ${hours}`);
    if (minutes < 0 || minutes >= 60) throw new Error(`Invalid minutes: ${minutes}`);
    if (seconds < 0 || seconds >= 60) throw new Error(`Invalid seconds: ${seconds}`);
    if (milliseconds < 0 || milliseconds >= 1000)
      throw new Error(`Invalid milliseconds: ${milliseconds}`);
    return new TimeDuration(TimeBase.TIME, { hours, minutes, seconds, milliseconds });
  }

  /** Alias for {@link TimeDuration.timeValue}. */
  static time(hours: number, minutes: number, seconds: number, milliseconds: number): TimeDuration {
    return TimeDuration.timeValue(hours, minutes, seconds, milliseconds);
  }

  /** Creates a duration from nonnegative elapsed seconds without splitting it into clock fields. */
  static seconds(totalSeconds: number): TimeDuration {
    if (totalSeconds < 0) throw new Error(`Invalid totalSeconds: ${totalSeconds} (must be >= 0)`);
    if (!isFinite(totalSeconds))
      throw new Error(`Invalid totalSeconds: ${totalSeconds} (must be finite)`);
    return new TimeDuration(TimeBase.SECONDS, { totalSeconds });
  }

  /** Converts elapsed seconds to clock fields and rounded milliseconds. Negative input is treated as zero. */
  static fromSeconds(totalSeconds: number): TimeDuration {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const remainder = totalSeconds - hours * 3600;
    const minutes = Math.floor(remainder / 60);
    const secs = remainder - minutes * 60;
    const seconds = Math.floor(secs);
    const milliseconds = Math.round((secs - seconds) * 1000);
    return new TimeDuration(TimeBase.TIME, { hours, minutes, seconds, milliseconds });
  }

  /** Creates a duration in audio sample frames. Use a {@link TimeContext} to convert it to seconds. */
  static frames(frameCount: number): TimeDuration {
    if (frameCount < 0) throw new Error(`Invalid frameCount: ${frameCount} (must be >= 0)`);
    return new TimeDuration(TimeBase.FRAME, { frameCount });
  }

  // ─── Accessors ───

  /** Returns the representation used for this duration. */
  getTimeBase(): TimeBase {
    return this._timeBase;
  }

  /** Returns the stored scalar for beats, seconds, or audio frames. Use a conversion method for other time bases. */
  getValue(): number {
    if (this._timeBase === TimeBase.BEATS) return this._csoundBeats;
    if (this._timeBase === TimeBase.SECONDS) return this._totalSeconds;
    if (this._timeBase === TimeBase.FRAME) return this._frameCount;
    return this._csoundBeats;
  }

  /** Returns the stored beat count for the `BEATS` representation. */
  getCsoundBeats(): number {
    return this._csoundBeats;
  }
  /** Returns the stored bar count for bar-based durations. */
  getBar(): number {
    return this._bar;
  }
  /** Returns the stored beat count for bar-based durations. */
  getBeat(): number {
    return this._beat;
  }
  /** Returns the stored tick remainder for tick-based durations. */
  getTicks(): number {
    return this._ticks;
  }
  /** Returns the stored sixteenth count for `BBST` durations. */
  getSixteenth(): number {
    return this._sixteenth;
  }
  /** Returns the stored fraction in hundredths of a beat for `BBF` durations. */
  getFraction(): number {
    return this._fraction;
  }
  /** Returns the hours component of a wall-clock duration. */
  getHours(): number {
    return this._hours;
  }
  /** Returns the minutes component of a wall-clock duration. */
  getMinutes(): number {
    return this._minutes;
  }
  /** Returns the seconds component of a wall-clock duration. Use `toSeconds(context)` for total seconds. */
  getSeconds(): number {
    return this._seconds;
  }
  /** Returns the milliseconds component of a wall-clock duration. */
  getMilliseconds(): number {
    return this._milliseconds;
  }
  /** Returns the stored scalar for the `SECONDS` representation. */
  getTotalSeconds(): number {
    return this._totalSeconds;
  }
  /** Returns the stored frame count for the `FRAME` representation. */
  getFrameCount(): number {
    return this._frameCount;
  }

  /** Get total ticks for BBST durations. */
  toTotalTicks(ppq: number): number {
    return this._sixteenth * (ppq / 4) + this._ticks;
  }

  /** Get total seconds for DurationTime. */
  toTotalSecondsValue(): number {
    return this._hours * 3600 + this._minutes * 60 + this._seconds + this._milliseconds / 1000;
  }

  // ─── Conversions ───

  /** Converts to Csound beats. Bar-based spans use the first meter entry. Clock and audio-frame spans use the tempo map. */
  toBeats(context: TimeContext): number {
    switch (this._timeBase) {
      case TimeBase.BEATS:
        return this._csoundBeats;

      case TimeBase.BBT: {
        // Duration uses first meter entry (not MeterMap.barBeatToBeats)
        const meter = context.getMeterMap().get(0).meter;
        return (
          this._bar * meter.getBeatsPerMeasure() +
          this._beat * meter.getBeatScale() +
          (this._ticks / DEFAULT_PPQ) * meter.getBeatScale()
        );
      }

      case TimeBase.BBST: {
        const meter = context.getMeterMap().get(0).meter;
        const beatScale = meter.getBeatScale();
        return (
          this._bar * meter.getBeatsPerMeasure() +
          this._beat * beatScale +
          (this.toTotalTicks(DEFAULT_PPQ) / DEFAULT_PPQ) * beatScale
        );
      }

      case TimeBase.BBF: {
        const meter = context.getMeterMap().get(0).meter;
        return (
          this._bar * meter.getBeatsPerMeasure() +
          this._beat * meter.getBeatScale() +
          (this._fraction / 100.0) * meter.getBeatScale()
        );
      }

      case TimeBase.TIME: {
        const secs = this.toTotalSecondsValue();
        return context.getTempoMap().secondsToBeats(secs);
      }

      case TimeBase.SECONDS: {
        return context.getTempoMap().secondsToBeats(this._totalSeconds);
      }

      case TimeBase.FRAME: {
        const secs = this._frameCount / context.getSampleRate();
        return context.getTempoMap().secondsToBeats(secs);
      }

      default:
        return this._csoundBeats;
    }
  }

  /** Convert to seconds using the provided context. */
  toSeconds(context: TimeContext): number {
    switch (this._timeBase) {
      case TimeBase.SECONDS:
        return this._totalSeconds;
      case TimeBase.TIME:
        return this.toTotalSecondsValue();
      case TimeBase.FRAME:
        return this._frameCount / context.getSampleRate();
      default:
        return context.getTempoMap().beatsToSeconds(this.toBeats(context));
    }
  }

  /** Convert to frames using the provided context. */
  toFrames(context: TimeContext): number {
    return Math.round(this.toSeconds(context) * context.getSampleRate());
  }

  /** Get total seconds for frames at a given sample rate. */
  toTotalSecondsForSampleRate(sampleRate: number): number {
    if (sampleRate <= 0) throw new Error(`Invalid sampleRate: ${sampleRate}`);
    if (this._timeBase === TimeBase.FRAME) return this._frameCount / sampleRate;
    return this.toTotalSecondsValue();
  }

  // Aliases matching Java naming (plural forms for duration 0-based)
  /** Alias for {@link TimeDuration.getBar}. */
  getBars(): number {
    return this._bar;
  }
  /** Alias for {@link TimeDuration.getBeat}. */
  getBeats(): number {
    return this._beat;
  }

  // ─── Equality ───

  /** Compares the time base and its stored fields. Equivalent spans in different time bases compare unequal. */
  equals(other: TimeDuration): boolean {
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
        return this._frameCount === other._frameCount;
      default:
        return false;
    }
  }

  /** Returns a hash based on the same representation used by {@link TimeDuration.equals}. */
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
        return h(this._frameCount);
      default:
        return 0;
    }
  }

  // ─── XML Serialization ───

  /** Serializes this duration using its stored time representation. */
  saveAsXML(): Element {
    const elem = new Element('timeDuration');

    switch (this._timeBase) {
      case TimeBase.BEATS:
        elem.setAttribute('type', 'BEATS');
        elem.addElement('csoundBeats').setText(this._csoundBeats.toString());
        break;
      case TimeBase.BBT:
        elem.setAttribute('type', 'BBT');
        elem.addElement('bars').setText(this._bar.toString());
        elem.addElement('beats').setText(this._beat.toString());
        elem.addElement('ticks').setText(this._ticks.toString());
        break;
      case TimeBase.BBST:
        elem.setAttribute('type', 'BBST');
        elem.addElement('bars').setText(this._bar.toString());
        elem.addElement('beats').setText(this._beat.toString());
        elem.addElement('sixteenth').setText(this._sixteenth.toString());
        elem.addElement('ticks').setText(this._ticks.toString());
        break;
      case TimeBase.BBF:
        elem.setAttribute('type', 'BBF');
        elem.addElement('bars').setText(this._bar.toString());
        elem.addElement('beats').setText(this._beat.toString());
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
        elem.addElement('frameCount').setText(this._frameCount.toString());
        break;
      default:
        elem.setAttribute('type', 'BEATS');
        elem.addElement('csoundBeats').setText(this._csoundBeats.toString());
    }

    return elem;
  }

  /** Loads a supported duration representation using the supplied XML diagnostic context. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): TimeDuration {
    const type = data.getAttribute('type') ?? '';
    switch (type) {
      case 'BEATS':
      case 'CSOUND_BEATS':
      case 'DurationBeats': {
        checkShape(data, ['type'], ['csoundBeats'], context);
        return TimeDuration.beats(readTimeNumber(data, context, ['csoundBeats']));
      }
      case 'BBT':
      case 'DurationBBT': {
        checkShape(data, ['type'], ['bars', 'bar', 'beats', 'beat', 'ticks'], context);
        return TimeDuration.bbt(
          readTimeNumber(data, context, ['bars', 'bar'], true, 0),
          readTimeNumber(data, context, ['beats', 'beat'], true, 0),
          readTimeNumber(data, context, ['ticks'], true, 0, Number.MAX_SAFE_INTEGER),
        );
      }
      case 'BBST':
      case 'DurationBBST': {
        checkShape(data, ['type'], ['bars', 'bar', 'beats', 'beat', 'sixteenth', 'ticks'], context);
        return TimeDuration.bbst(
          readTimeNumber(data, context, ['bars', 'bar'], true, 0),
          readTimeNumber(data, context, ['beats', 'beat'], true, 0),
          readTimeNumber(data, context, ['sixteenth'], true, 0, 3),
          readTimeNumber(data, context, ['ticks'], true, 0, Number.MAX_SAFE_INTEGER),
        );
      }
      case 'BBF':
      case 'DurationBBF': {
        checkShape(data, ['type'], ['bars', 'bar', 'beats', 'beat', 'fraction'], context);
        return TimeDuration.bbf(
          readTimeNumber(data, context, ['bars', 'bar'], true, 0),
          readTimeNumber(data, context, ['beats', 'beat'], true, 0),
          readTimeNumber(data, context, ['fraction'], true, 0, 99),
        );
      }
      case 'TIME':
      case 'DurationTime': {
        checkShape(data, ['type'], ['hours', 'minutes', 'seconds', 'milliseconds'], context);
        return TimeDuration.timeValue(
          readTimeNumber(data, context, ['hours'], true, 0),
          readTimeNumber(data, context, ['minutes'], true, 0, 59),
          readTimeNumber(data, context, ['seconds'], true, 0, 59),
          readTimeNumber(data, context, ['milliseconds'], true, 0, 999),
        );
      }
      case 'SECONDS':
      case 'DurationSeconds': {
        checkShape(data, ['type'], ['totalSeconds', 'seconds'], context);
        return TimeDuration.seconds(readTimeNumber(data, context, ['totalSeconds', 'seconds']));
      }
      case 'FRAME':
      case 'DurationFrames': {
        checkShape(data, ['type'], ['frameCount', 'frameNumber'], context);
        return TimeDuration.frames(
          readTimeNumber(data, context, ['frameCount', 'frameNumber'], true, 0),
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
