/**
 * GenericScore — a SoundObject containing raw Csound score text.
 * Mirrors the Java GenericScore class.
 *
 * This is the most common SoundObject type — it holds Csound score events
 * as plain text (e.g., "i1 0 2 440 0.5\ni2 3 1 880 0.3").
 *
 * During CSD generation, the text is passed through directly to the score output.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { SoundObjectException } from './sound-object-exception';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkShape, readText } from '../utilities/xml';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject, SoundObjectStatic } from './sound-object';
import { TimeBehavior } from './time-behavior';
import {
  initBasicFromXML,
  getBasicXML,
  BASIC_SOUND_OBJECT_CHILDREN,
} from './sound-object-utilities';
import {
  applyNoteProcessorChain,
  applyNoteProcessorChainAsync,
  applyTimeBehavior,
  getNotes,
  setScoreStart,
} from '../utilities/score';

export class GenericScore extends AbstractSoundObject implements SoundObject {
  private _scoreText = '';

  constructor() {
    super();
    this.setName('GenericScore');
    this._scoreText = 'i1 0 2 3 4 5';
    this._backgroundColor = 0x404040;
  }

  /** Get the raw score text. */
  getScoreText(): string {
    return this._scoreText;
  }

  /** Set the raw score text. */
  setScoreText(text: string): void {
    this._scoreText = text;
  }

  getRangeOriginBeats(context: TimeContext): number | null | undefined {
    if (
      this.getTimeBehavior() !== TimeBehavior.NONE ||
      this.getNoteProcessorChain().getProcessors().length > 0
    ) {
      return undefined;
    }

    let notes: NoteList;
    try {
      notes = getNotes(this._scoreText);
    } catch {
      // Do not surface parse errors for score objects that the requested
      // range would otherwise prune before generation.
      return undefined;
    }
    if (notes.length === 0) return null;

    const objectDuration = this.getSubjectiveDuration().toBeats(context);
    if (!Number.isFinite(objectDuration) || objectDuration <= 0) return undefined;

    let earliest = Infinity;
    for (const note of notes) {
      const start = note.getStartTime();
      const end = note.getEndTime();
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        start >= objectDuration ||
        end > objectDuration
      ) {
        return undefined;
      }
      earliest = Math.min(earliest, note.getStartTime());
    }
    return this.getStartTime().toBeats(context) + earliest;
  }

  // ─── SoundObject implementation ───

  override generateForCSD(
    context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    const noteList = getNotes(this._scoreText);

    const processed = applyNoteProcessorChain(noteList, this.getNoteProcessorChain());
    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(processed, this.getTimeBehavior(), duration, repeatPointBeats);
    setScoreStart(processed, startTime);

    return processed;
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    const noteList = getNotes(this._scoreText);

    const processed = await applyNoteProcessorChainAsync(
      noteList,
      this.getNoteProcessorChain(),
      compileData,
    );
    const duration = this.getSubjectiveDuration().toBeats(context);
    const startTime = this.getStartTime().toBeats(context);
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;

    applyTimeBehavior(processed, this.getTimeBehavior(), duration, repeatPointBeats);
    setScoreStart(processed, startTime);

    return processed;
  }

  // ─── XML Serialization ───

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.GenericScore');
    elem.addElement('score').setText(this._scoreText);
    return elem;
  }

  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): GenericScore {
    const context = providedContext ?? new XmlLoadContext(data);
    checkShape(data, ['type'], [...BASIC_SOUND_OBJECT_CHILDREN, 'score', 'scoreText'], context);
    const type = data.getAttribute('type');
    if (
      data.getName() !== 'soundObject' ||
      (type !== 'GenericScore' && type !== 'blue.soundObject.GenericScore')
    )
      throw context.at(data).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Expected GenericScore SoundObject.',
        recovery: 'Use the matching supported SoundObject type.',
      });
    const sObj = new GenericScore();
    initBasicFromXML(sObj, data, context);
    const current = data.getElement('score');
    const legacy = data.getElement('scoreText');
    const score = current ? readText(current, context) : undefined;
    const alias = legacy ? readText(legacy, context) : undefined;
    if (score !== undefined && alias !== undefined && score !== alias)
      throw context.at(legacy!).error({
        code: 'conflict',
        message: 'Score text aliases disagree.',
        recovery: 'Keep one consistent score text.',
      });
    if (score !== undefined || alias !== undefined) sObj.setScoreText(score ?? alias!);
    return providedContext ? sObj : requireXmlValue(context.result(sObj), sink);
  }

  override deepCopy(): GenericScore {
    const copy = new GenericScore();
    copy.copyFrom(this);
    copy._scoreText = this._scoreText;
    return copy;
  }
}
