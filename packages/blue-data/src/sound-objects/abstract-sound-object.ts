/**
 * AbstractSoundObject — base implementation of SoundObject.
 * Mirrors the Java AbstractSoundObject class.
 *
 * Provides default implementations for ScoreObject properties (name, start time,
 * duration, color) and common listener management.
 */
import { SoundObject } from './sound-object';
import { TimePosition } from '../time/time-position';
import { TimeDuration } from '../time/time-duration';
import { TimeContext } from '../time/time-context';
import { TimeBehavior } from './time-behavior';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { NoteList } from './note-list';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap } from '../serialization/obj-ref-map';
import type { CopyMode } from '../deep-copyable';

/** Common timeline placement, duration, time behavior, and note processing for authored sound objects. */
export abstract class AbstractSoundObject implements SoundObject {
  protected _name = '';
  protected _startTime = TimePosition.beats(0);
  protected _subjectiveDuration = TimeDuration.beats(4);
  protected _backgroundColor = 0x404040;
  protected _timeBehavior = TimeBehavior.SCALE;
  protected _repeatPoint: TimeDuration | null = null;
  protected _npc = new NoteProcessorChain();
  protected _cloneSourceHashCode = 0;

  /** Initializes common sound-object settings, including a zero start and four-beat duration. */
  constructor() {}

  // Copy constructor
  protected copyFrom(other: AbstractSoundObject): void {
    this._name = other._name;
    this._startTime = other._startTime;
    this._subjectiveDuration = other._subjectiveDuration;
    this._backgroundColor = other._backgroundColor;
    this._timeBehavior = other._timeBehavior;
    this._repeatPoint = other._repeatPoint;
    this._npc = new NoteProcessorChain(other._npc);
    this._cloneSourceHashCode = other._cloneSourceHashCode;
  }

  // ─── ScoreObject implementation ───

  /** Returns the editable object name shown on the timeline. */
  getName(): string {
    return this._name;
  }

  /** Changes this object's display name. */
  setName(value: string): void {
    this._name = value;
  }

  /** Returns the object's placement in its containing timeline, in the authored time base. */
  getStartTime(): TimePosition {
    return this._startTime;
  }

  /** Sets the object's placement in its containing timeline. */
  setStartTime(value: TimePosition): void {
    this._startTime = value;
  }

  /** Returns the authored span that controls placement and time behavior. */
  getSubjectiveDuration(): TimeDuration {
    return this._subjectiveDuration;
  }

  /** Sets the object's authored span. */
  setSubjectiveDuration(value: TimeDuration): void {
    this._subjectiveDuration = value;
  }

  /** Returns the stored timeline color as a packed integer. */
  getBackgroundColor(): number {
    return this._backgroundColor;
  }

  /** Sets the packed color integer used when displaying this object. */
  setBackgroundColor(color: number): void {
    this._backgroundColor = color;
  }

  /** Returns the allowed left-edge offsets. The base defaults to extension with no lower bound. */
  getResizeLeftLimits(_context: TimeContext): number[] {
    return [-Infinity, 0];
  }

  /** Returns the allowed right-edge offsets. The base defaults to extension with no upper bound. */
  getResizeRightLimits(_context: TimeContext): number[] {
    return [0, Infinity];
  }

  /** Handles a move of the left edge in Csound beats. The base implementation is a no-op. */
  resizeLeft(_context: TimeContext, _newStartTime: number): void {
    // Default: no-op
  }

  /** Handles a move of the right edge in Csound beats. The base implementation is a no-op. */
  resizeRight(_context: TimeContext, _newEndTime: number): void {
    // Default: no-op
  }

  /** Returns the stored source hash carried by copies. */
  getCloneSourceHashCode(): number {
    return this._cloneSourceHashCode;
  }

  // ─── SoundObject implementation ───

  /** Returns the live chain that concrete objects use to transform generated notes. */
  getNoteProcessorChain(): NoteProcessorChain {
    return this._npc;
  }

  /** Replaces the object's processor chain by reference. */
  setNoteProcessorChain(chain: NoteProcessorChain): void {
    this._npc = chain;
  }

  /** Returns the rule used to fit generated material to the object's authored duration. */
  getTimeBehavior(): TimeBehavior {
    return this._timeBehavior;
  }

  /** Sets the rule applied during score generation. */
  setTimeBehavior(behavior: TimeBehavior): void {
    this._timeBehavior = behavior;
  }

  /** Returns the configured repetition interval, or `null` to let the generator infer it. */
  getRepeatPoint(): TimeDuration | null {
    return this._repeatPoint;
  }

  /** Sets the repetition interval. Pass `null` to clear the override. */
  setRepeatPoint(repeatPoint: TimeDuration | null): void {
    this._repeatPoint = repeatPoint;
  }

  // ─── Abstract methods ───

  /** Generates the object's notes using the supplied timing and render context. */
  abstract generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): NoteList;

  /** Writes the concrete sound object to XML, using the supplied reference mapping when applicable. */
  abstract saveAsXML(objRefMap?: ObjRefSaveMap): Element;

  /** Copies the authored sound object with the requested identity policy. */
  abstract deepCopy(mode?: CopyMode): SoundObject;
}
