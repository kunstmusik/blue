/**
 * AudioClip — a file-based audio clip in a Track.
 * Mirrors the Java AudioClip class.
 *
 * AudioClip represents a reference to an audio file with temporal positioning,
 * fade in/out, and looping settings. During CSD generation, it produces a
 * diskin2-based score event.
 */
import { ScoreObject } from '../../score/score-object';
import { TimePosition } from '../../time/time-position';
import { TimeDuration } from '../../time/time-duration';
import { TimeContext } from '../../time/time-context';
import { beatsToDuration } from '../../time/time-unit-math';
import { beatsToTimePosition } from '../../time/time-utilities';
import { FadeType, fadeTypeFromString } from './fade-type';
import { Element } from '../../serialization/xml-reader';
import { checkRoot, checkShape, parseXmlNumber, readText, readBoolean } from '../../utilities/xml';
import {
  XmlLoadContext,
  requireXmlValue,
  type XmlDiagnosticSink,
} from '../../serialization/xml-load';
import { ObjRefSaveMap } from '../../serialization/obj-ref-map';
import { readInt, readDouble, writeInt, writeDouble, writeBoolean } from '../../utilities/xml';

/** Places and trims part of an audio file on a score track, with optional fades. */
export class AudioClip implements ScoreObject {
  /** Property name used to identify changes to the name. */
  static readonly NAME = 'name';
  /** Property name used to identify changes to the start time. */
  static readonly START_TIME = 'startTime';
  /** Property name used to identify changes to the duration. */
  static readonly DURATION = 'duration';
  /** Property name used to identify changes to the packed display color. */
  static readonly COLOR = 'color';
  /** Property name used to identify changes to the file start time. */
  static readonly FILE_START_TIME = 'fileStartTime';
  /** Property name used to identify changes to the fade in. */
  static readonly FADE_IN = 'fadeIn';
  /** Property name used to identify changes to the fade in type. */
  static readonly FADE_IN_TYPE = 'fadeInType';
  /** Property name used to identify changes to the fade out. */
  static readonly FADE_OUT = 'fadeOut';
  /** Property name used to identify changes to the fade out type. */
  static readonly FADE_OUT_TYPE = 'fadeOutType';
  /** Property name used to identify changes to the looping. */
  static readonly LOOPING = 'looping';
  /** Property name used to identify changes to the audio file. */
  static readonly AUDIO_FILE = 'audioFile';

  private _name = '';
  private _startTimePosition = TimePosition.beats(0);
  private _durationUnit = TimeDuration.beats(0);
  private _color = 0x404040; // dark gray

  private _audioFile = '';
  private _numChannels = 0;
  private _audioDuration = 0;
  private _fileStartTime = 0;
  private _fadeIn = 0;
  private _fadeInType = FadeType.LINEAR;
  private _fadeOut = 0;
  private _fadeOutType = FadeType.LINEAR;
  private _looping = true;

  private _cloneSourceHashCode = 0;

  /** Creates a track clip with default placement and empty source path. */
  constructor() {}

  /** Copy constructor. */
  static copyFrom(src: AudioClip): AudioClip {
    const clip = new AudioClip();
    clip._name = src._name;
    clip._startTimePosition = src._startTimePosition;
    clip._durationUnit = src._durationUnit;
    clip._color = src._color;
    clip._audioFile = src._audioFile;
    clip._numChannels = src._numChannels;
    clip._audioDuration = src._audioDuration;
    clip._fileStartTime = src._fileStartTime;
    clip._fadeIn = src._fadeIn;
    clip._fadeInType = src._fadeInType;
    clip._fadeOut = src._fadeOut;
    clip._fadeOutType = src._fadeOutType;
    clip._looping = src._looping;
    clip._cloneSourceHashCode = src.hashCode();
    return clip;
  }

  // ─── ScoreObject ───

  getName(): string {
    return this._name;
  }
  setName(value: string): void {
    this._name = value;
  }

  getStartTime(): TimePosition {
    return this._startTimePosition;
  }
  setStartTime(value: TimePosition): void {
    this._startTimePosition = value;
  }

  getSubjectiveDuration(): TimeDuration {
    return this._durationUnit;
  }
  setSubjectiveDuration(value: TimeDuration): void {
    this._durationUnit = value;
  }

  getBackgroundColor(): number {
    return this._color;
  }
  setBackgroundColor(color: number): void {
    this._color = color;
  }

  getResizeLeftLimits(context: TimeContext): number[] {
    const startBeats = this._startTimePosition.toBeats(context);
    const durBeats = this._durationUnit.toBeats(context);
    const leftLimit = this._looping ? -startBeats : Math.max(-startBeats, -this._fileStartTime);
    return [leftLimit, durBeats];
  }

  /** Returns the permitted offsets of the clip's right edge in beats for the supplied timing context. */
  getResizeRightLimits(context: TimeContext): number[] {
    const durBeats = this._durationUnit.toBeats(context);
    return this._looping
      ? [-durBeats, Infinity]
      : [-durBeats, this._audioDuration - (durBeats + this._fileStartTime)];
  }

  resizeLeft(context: TimeContext, newStartTime: number): void {
    const currentStart = this._startTimePosition.toBeats(context);
    const currentDuration = this._durationUnit.toBeats(context);
    const diff = currentStart - newStartTime;
    let fileStart = this._fileStartTime - diff;
    const audioDur = this._audioDuration;

    if (audioDur > 0) {
      while (fileStart < 0) fileStart += audioDur;
      while (fileStart > audioDur) fileStart -= audioDur;
    }

    this._startTimePosition = beatsToTimePosition(
      newStartTime,
      this._startTimePosition.getTimeBase(),
      context,
    );
    this._fileStartTime = fileStart;
    this._durationUnit = TimeDuration.beats(currentDuration + diff);
  }

  resizeRight(context: TimeContext, newEndTime: number): void {
    const currentStart = this._startTimePosition.toBeats(context);
    this._durationUnit = TimeDuration.beats(newEndTime - currentStart);
  }

  getCloneSourceHashCode(): number {
    return this._cloneSourceHashCode;
  }

  // ─── AudioClip-specific ───

  /** Returns the configured path to the audio source. */
  getAudioFile(): string {
    return this._audioFile;
  }
  /** Sets the configured path to the audio source. */
  setAudioFile(path: string): void {
    this._audioFile = path;
    // In Java, this reads the file to get numChannels/audioDuration.
    // In TS, caller must set these manually or we leave them at 0.
  }

  /** Returns the num channels stored on the audio clip. */
  getNumChannels(): number {
    return this._numChannels;
  }
  /** Sets the num channels stored on the audio clip. */
  setNumChannels(n: number): void {
    this._numChannels = n;
  }

  /** Returns the recorded full source duration in seconds. */
  getAudioDuration(): number {
    return this._audioDuration;
  }
  /** Sets the recorded full source duration in seconds. */
  setAudioDuration(d: number): void {
    this._audioDuration = d;
  }

  /** Returns the offset into the source file in seconds. */
  getFileStartTime(): number {
    return this._fileStartTime;
  }
  /** Sets the offset into the source file in seconds. */
  setFileStartTime(t: number): void {
    this._fileStartTime = t;
  }

  /** Returns the fade-in duration in seconds. */
  getFadeIn(): number {
    return this._fadeIn;
  }
  /** Sets the fade-in duration in seconds. */
  setFadeIn(t: number): void {
    this._fadeIn = t;
  }

  /** Returns the fade-in gain curve. */
  getFadeInType(): FadeType {
    return this._fadeInType;
  }
  /** Sets the fade-in gain curve. */
  setFadeInType(ft: FadeType): void {
    this._fadeInType = ft;
  }

  /** Returns the fade-out duration in seconds. */
  getFadeOut(): number {
    return this._fadeOut;
  }
  /** Sets the fade-out duration in seconds. */
  setFadeOut(t: number): void {
    this._fadeOut = t;
  }

  /** Returns the fade-out gain curve. */
  getFadeOutType(): FadeType {
    return this._fadeOutType;
  }
  /** Sets the fade-out gain curve. */
  setFadeOutType(ft: FadeType): void {
    this._fadeOutType = ft;
  }

  /** Reports whether the audio clip repeats playback within the object duration. */
  isLooping(): boolean {
    return this._looping;
  }
  /** Sets the looping stored on the audio clip. */
  setLooping(context: TimeContext | null, looping: boolean): void {
    this._looping = looping;
    if (!looping && context && this._audioDuration > 0) {
      const durLimitBeats = context.secondsToBeats(
        Math.max(0, this._audioDuration - this._fileStartTime),
      );
      const durBeats = this._durationUnit.toBeats(context);
      if (durBeats > durLimitBeats) {
        this._durationUnit = beatsToDuration(
          durLimitBeats,
          this._durationUnit.getTimeBase(),
          context,
        );
      }
    }
  }

  // ─── XML Serialization ───

  /** Serializes the audio clip and its persisted settings to a new Blue XML element. */
  saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const root = new Element('audioClip');

    root.addElement('name').setText(this._name);
    root.addElement('audioFile').setText(this._audioFile);
    root.addElement(writeInt('numChannels', this._numChannels));
    root.addElement(writeDouble('audioDuration', this._audioDuration));
    root.addElement(writeDouble('fileStart', this._fileStartTime));
    root.addElement(this._startTimePosition.saveAsXML().setName('startTime'));
    root.addElement(this._durationUnit.saveAsXML().setName('subjectiveDuration'));
    root.addElement(writeDouble('fadeIn', this._fadeIn));
    root.addElement('fadeInType').setText(this._fadeInType);
    root.addElement(writeDouble('fadeOut', this._fadeOut));
    root.addElement('fadeOutType').setText(this._fadeOutType);
    root.addElement(writeBoolean('looping', this._looping));
    root.addElement('backgroundColor').setText(this._color.toString());

    return root;
  }

  /** Reconstructs the audio clip from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): AudioClip {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, 'audioClip', context);
    checkShape(
      data,
      [],
      [
        'name',
        'audioFile',
        'numChannels',
        'audioDuration',
        'fileStart',
        'startTime',
        'start',
        'subjectiveDuration',
        'duration',
        'fadeIn',
        'fadeInType',
        'fadeOut',
        'fadeOutType',
        'looping',
        'backgroundColor',
      ],
      context,
    );
    const clip = new AudioClip();
    const nonnegative = (node: Element): number => {
      const value = readDouble(node, context);
      if (value < 0)
        throw context.at(node).error({
          code: 'value',
          value: node.getTextString(),
          message: 'Audio durations and fades must be nonnegative.',
          recovery: 'Supply a nonnegative value.',
        });
      return value;
    };
    const readPosition = (node: Element): TimePosition => {
      if (node.getAttribute('type') === 'beats') {
        checkShape(node, ['type'], [], context, [], true);
        return TimePosition.beats(parseXmlNumber(node.getTextString(), context.at(node)));
      }
      return node.hasAttribute('type')
        ? TimePosition.loadFromXML(node, context)
        : TimePosition.beats(readDouble(node, context));
    };
    const readDuration = (node: Element): TimeDuration => {
      if (node.getAttribute('type') === 'beats') {
        checkShape(node, ['type'], [], context, [], true);
        const value = parseXmlNumber(node.getTextString(), context.at(node));
        if (value < 0)
          throw context.at(node).error({
            code: 'value',
            value: node.getTextString(),
            message: 'Audio duration must be nonnegative.',
            recovery: 'Supply a nonnegative duration.',
          });
        return TimeDuration.beats(value);
      }
      return node.hasAttribute('type')
        ? TimeDuration.loadFromXML(node, context)
        : TimeDuration.beats(nonnegative(node));
    };
    for (const node of data.getElements()) {
      switch (node.getName()) {
        case 'name':
          clip._name = readText(node, context);
          break;
        case 'audioFile':
          clip._audioFile = readText(node, context);
          break;
        case 'numChannels':
          clip._numChannels = readInt(node, context, 0, 2147483647);
          break;
        case 'audioDuration':
          clip._audioDuration = nonnegative(node);
          break;
        case 'fileStart':
          clip._fileStartTime = nonnegative(node);
          break;
        case 'fadeIn':
          clip._fadeIn = nonnegative(node);
          break;
        case 'fadeOut':
          clip._fadeOut = nonnegative(node);
          break;
        case 'backgroundColor':
          clip._color = readInt(node, context, -2147483648, 2147483647);
          break;
        case 'looping':
          clip._looping = readBoolean(node, context);
          break;
        case 'fadeInType':
        case 'fadeOutType': {
          const token = readText(node, context);
          // Uppercase enum identifiers were emitted by existing TypeScript fixtures.
          const fade =
            fadeTypeFromString(token) ??
            (Object.keys(FadeType).includes(token)
              ? FadeType[token as keyof typeof FadeType]
              : undefined);
          if (!fade)
            throw context.at(node).error({
              code: 'value',
              value: token,
              message: 'Unknown audio fade type.',
              recovery: 'Choose a supported fade envelope.',
            });
          clip[node.getName() === 'fadeInType' ? '_fadeInType' : '_fadeOutType'] = fade;
          break;
        }
      }
    }
    const start = data.getElement('startTime');
    const oldStart = data.getElement('start');
    if (start) clip._startTimePosition = readPosition(start);
    if (oldStart) {
      const value = TimePosition.beats(readDouble(oldStart, context));
      if (start && !value.equals(clip._startTimePosition))
        throw context.at(oldStart).error({
          code: 'conflict',
          message: 'Audio start aliases disagree.',
          recovery: 'Make both start forms agree.',
        });
      clip._startTimePosition = value;
    }
    const duration = data.getElement('subjectiveDuration');
    const oldDuration = data.getElement('duration');
    if (duration) clip._durationUnit = readDuration(duration);
    if (oldDuration) {
      const value = TimeDuration.beats(nonnegative(oldDuration));
      if (duration && !value.equals(clip._durationUnit))
        throw context.at(oldDuration).error({
          code: 'conflict',
          message: 'Audio duration aliases disagree.',
          recovery: 'Make both duration forms agree.',
        });
      clip._durationUnit = value;
    }
    return providedContext ? clip : requireXmlValue(context.result(clip), sink);
  }

  // ─── Helpers ───

  /** Returns the clip's hash code for the model's identity tracking. */
  hashCode(): number {
    return this._cloneSourceHashCode || 0;
  }
}
