/**
 * SoundObject — interface for note-generating objects in the score.
 * Mirrors the Java SoundObject interface.
 *
 * SoundObjects are the core compositional units in Blue. Each type generates
 * Csound score events differently:
 * - GenericScore: contains raw score text
 * - AudioClip: references an audio file with timing/fade data
 * - PythonObject: executes Python code to generate notes
 * - etc.
 *
 * During CSD generation, the Score iterates through its LayerGroups and
 * calls generateForCSD() on each SoundObject.
 */
import { ScoreObject } from '../score/score-object';
import { NoteList } from './note-list';
import { NoteProcessorChain } from '../note-processors/note-processor-chain';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { TimeBehavior } from './time-behavior';
import { TimeDuration } from '../time/time-duration';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { DeepCopyable } from '../deep-copyable';

export interface SoundObject extends ScoreObject, DeepCopyable<SoundObject> {
  /** Generate notes for CSD output. */
  generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): NoteList;

  /** Generate notes for CSD output when an environment-backed runtime is required. */
  generateForCSDAsync?(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): Promise<NoteList>;

  /** Get the note processor chain for this sound object. */
  getNoteProcessorChain(): NoteProcessorChain;
  /** Set the note processor chain for this sound object. */
  setNoteProcessorChain(chain: NoteProcessorChain): void;

  /** Get the time behavior for this sound object. */
  getTimeBehavior(): TimeBehavior;
  /** Set the time behavior for this sound object. */
  setTimeBehavior(behavior: TimeBehavior): void;

  /** Get the repeat point duration (for REPEAT time behavior). */
  getRepeatPoint(): TimeDuration | null;
  /** Set the repeat point duration. */
  setRepeatPoint(repeatPoint: TimeDuration | null): void;

  /** Serialize to XML. */
  saveAsXML(objRefMap?: ObjRefSaveMap): Element;

  /** Deep copy this sound object. */
  deepCopy(): SoundObject;
}

/**
 * Static factory interface for loading SoundObjects from XML.
 * Each SoundObject implementation must provide a static loadFromXML method.
 */
export interface SoundObjectStatic<T extends SoundObject> {
  loadFromXML(data: Element, objRefMap?: ObjRefLoadMap): Promise<T> | T;
}
