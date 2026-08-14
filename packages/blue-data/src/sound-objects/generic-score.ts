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
import { ObjRefSaveMap } from '../serialization/obj-ref-map';
import { SoundObject, SoundObjectStatic } from './sound-object';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
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

    applyTimeBehavior(
      processed,
      this.getTimeBehavior(),
      duration,
      repeatPointBeats,
    );
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

    applyTimeBehavior(
      processed,
      this.getTimeBehavior(),
      duration,
      repeatPointBeats,
    );
    setScoreStart(processed, startTime);

    return processed;
  }

  // ─── XML Serialization ───

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.GenericScore');
    elem.addElement('score').setText(this._scoreText);
    return elem;
  }

  static loadFromXML(data: Element): GenericScore {
    const sObj = new GenericScore();
    initBasicFromXML(sObj, data);

    const score = data.getTextString('score');
    if (score !== null) {
      sObj.setScoreText(score);
      return sObj;
    }

    const scoreText = data.getTextString('scoreText');
    if (scoreText !== null) {
      sObj.setScoreText(scoreText);
    }

    return sObj;
  }

  override deepCopy(): GenericScore {
    const copy = new GenericScore();
    copy.copyFrom(this);
    copy._scoreText = this._scoreText;
    return copy;
  }
}
