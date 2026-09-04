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
import { FadeType, fadeTypeFromString, fadeTypeToCsound } from './fade-type';
import { Element } from '../../serialization/xml-reader';
import { ObjRefSaveMap } from '../../serialization/obj-ref-map';
import { readInt, readDouble, writeInt, writeDouble, writeBoolean } from '../../utilities/xml';

export class AudioClip implements ScoreObject {
  static readonly NAME = 'name';
  static readonly START_TIME = 'startTime';
  static readonly DURATION = 'duration';
  static readonly COLOR = 'color';
  static readonly FILE_START_TIME = 'fileStartTime';
  static readonly FADE_IN = 'fadeIn';
  static readonly FADE_IN_TYPE = 'fadeInType';
  static readonly FADE_OUT = 'fadeOut';
  static readonly FADE_OUT_TYPE = 'fadeOutType';
  static readonly LOOPING = 'looping';
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

  getAudioFile(): string {
    return this._audioFile;
  }
  setAudioFile(path: string): void {
    this._audioFile = path;
    // In Java, this reads the file to get numChannels/audioDuration.
    // In TS, caller must set these manually or we leave them at 0.
  }

  getNumChannels(): number {
    return this._numChannels;
  }
  setNumChannels(n: number): void {
    this._numChannels = n;
  }

  getAudioDuration(): number {
    return this._audioDuration;
  }
  setAudioDuration(d: number): void {
    this._audioDuration = d;
  }

  getFileStartTime(): number {
    return this._fileStartTime;
  }
  setFileStartTime(t: number): void {
    this._fileStartTime = t;
  }

  getFadeIn(): number {
    return this._fadeIn;
  }
  setFadeIn(t: number): void {
    this._fadeIn = t;
  }

  getFadeInType(): FadeType {
    return this._fadeInType;
  }
  setFadeInType(ft: FadeType): void {
    this._fadeInType = ft;
  }

  getFadeOut(): number {
    return this._fadeOut;
  }
  setFadeOut(t: number): void {
    this._fadeOut = t;
  }

  getFadeOutType(): FadeType {
    return this._fadeOutType;
  }
  setFadeOutType(ft: FadeType): void {
    this._fadeOutType = ft;
  }

  isLooping(): boolean {
    return this._looping;
  }
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

  static loadFromXML(data: Element): AudioClip {
    const clip = new AudioClip();
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const text = node.getTextString();

      switch (node.getName()) {
        case 'name':
          clip._name = text;
          break;
        case 'audioFile':
          clip._audioFile = text;
          break;
        case 'numChannels':
          clip._numChannels = readInt(node);
          break;
        case 'audioDuration':
          clip._audioDuration = readDouble(node);
          break;
        case 'fileStart':
          clip._fileStartTime = readDouble(node);
          break;
        case 'startTime':
          if (node.getAttributeValue('type') !== null) {
            clip._startTimePosition = TimePosition.loadFromXML(node);
          } else {
            // Legacy: plain double (beats)
            clip._startTimePosition = TimePosition.beats(readDouble(node));
          }
          break;
        case 'start':
          // Legacy format
          clip._startTimePosition = TimePosition.beats(readDouble(node));
          break;
        case 'subjectiveDuration':
          if (node.getAttributeValue('type') !== null) {
            clip._durationUnit = TimeDuration.loadFromXML(node);
          } else {
            clip._durationUnit = TimeDuration.beats(readDouble(node));
          }
          break;
        case 'duration':
          // Legacy format
          clip._durationUnit = TimeDuration.beats(readDouble(node));
          break;
        case 'backgroundColor':
          clip._color = parseInt(data.getTextString('backgroundColor') ?? '0', 10);
          break;
        case 'fadeIn':
          clip._fadeIn = readDouble(node);
          break;
        case 'fadeInType':
          clip._fadeInType = fadeTypeFromString(text) ?? FadeType.LINEAR;
          break;
        case 'fadeOut':
          clip._fadeOut = readDouble(node);
          break;
        case 'fadeOutType':
          clip._fadeOutType = fadeTypeFromString(text) ?? FadeType.LINEAR;
          break;
        case 'looping':
          clip._looping = text.toLowerCase() === 'true';
          break;
      }
    }

    return clip;
  }

  // ─── Helpers ───

  hashCode(): number {
    return this._cloneSourceHashCode || 0;
  }
}
