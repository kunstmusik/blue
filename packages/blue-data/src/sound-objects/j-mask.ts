import { XmlLoadContext } from '../serialization/xml-load';
import { checkShape, readEnum, readText, parseXmlBoolean } from '../utilities/xml';
import { canonicalSeed, readSeed } from '../note-processors/xml-policy';
/**
 * JMask — generates notes using a mask-based random pattern system.
 * Mirrors the Java JMask class.
 *
 * The nested field/generator model is implemented in jmask-support.ts.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import {
  initBasicFromXML,
  getBasicXML,
  BASIC_SOUND_OBJECT_CHILDREN,
} from './sound-object-utilities';
import {
  applyNoteProcessorChain,
  applyNoteProcessorChainAsync,
  applyTimeBehavior,
  setScoreStart,
} from '../utilities/score';
import { Field, JavaRandom, type JMaskGenerationMode } from './jmask-support';

export class JMask extends AbstractSoundObject {
  private _generationMode: JMaskGenerationMode = 2;
  private _seedUsed = false;
  private _seed = '0';
  private _field = new Field();

  /** Creates a default j mask or copies a supplied instance. */
  constructor(other?: JMask) {
    super();
    this.setName('JMask');
    if (other) {
      this.copyFrom(other);
      this._generationMode = other._generationMode;
      this._seedUsed = other._seedUsed;
      this._seed = other._seed;
      this._field = other._field.deepCopy();
    }
  }

  /** Returns the generation mode stored on the JMask sound object. */
  getGenerationMode(): JMaskGenerationMode {
    return this._generationMode;
  }

  /** Sets the generation mode stored on the JMask sound object. */
  setGenerationMode(mode: JMaskGenerationMode): void {
    this._generationMode = mode;
  }

  /** Reports whether the JMask sound object uses the configured random seed. */
  isSeedUsed(): boolean {
    return this._seedUsed;
  }
  /** Controls whether generation uses the configured seed. */
  setSeedUsed(val: boolean): void {
    this._seedUsed = val;
  }

  /** Returns the pseudo-random seed. */
  getSeed(): string {
    return this._seed;
  }
  /** Sets the pseudo-random seed. */
  setSeed(val: number | string): void {
    this._seed = canonicalSeed(val);
  }

  /** Returns the field stored on the JMask sound object. */
  getField(): Field {
    return this._field;
  }
  /** Sets the field stored on the JMask sound object. */
  setField(field: Field): void {
    this._field = field;
  }

  private generateRawNotes(context: TimeContext): { notes: NoteList; duration: number } {
    const rnd = this._seedUsed ? new JavaRandom(BigInt(this._seed)) : new JavaRandom();
    const duration = this.getSubjectiveDuration().toBeats(context);
    const notes = this._field.generateNotesFromCopy(duration, rnd, this._generationMode);
    return { notes, duration };
  }

  private applyTimeAndOffset(notes: NoteList, duration: number, context: TimeContext): void {
    const repeatPoint = this.getRepeatPoint();
    const repeatPointBeats = repeatPoint ? repeatPoint.toBeats(context) : -1;
    applyTimeBehavior(notes, this.getTimeBehavior(), duration, repeatPointBeats);
    setScoreStart(notes, this.getStartTime().toBeats(context));
  }

  private finalizeGeneratedNotes(
    notes: NoteList,
    duration: number,
    context: TimeContext,
  ): NoteList {
    this.applyTimeAndOffset(notes, duration, context);
    return notes;
  }

  /** Generates notes from the configured JMask fields and timing rules. */
  generateNotes(context: TimeContext, _renderStart = 0, _renderEnd = -1): NoteList {
    const { notes, duration } = this.generateRawNotes(context);
    return this.finalizeGeneratedNotes(
      applyNoteProcessorChain(notes, this.getNoteProcessorChain()),
      duration,
      context,
    );
  }

  override generateForCSD(
    context: TimeContext,
    _compileData: CompileData,
    startTime: number,
    endTime: number,
  ): NoteList {
    return this.generateNotes(context, startTime, endTime);
  }

  /** Generates the JMask sound object’s Csound notes, awaiting asynchronous generators or processors through the compile context. */
  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    const { notes, duration } = this.generateRawNotes(context);
    return this.finalizeGeneratedNotes(
      await applyNoteProcessorChainAsync(notes, this.getNoteProcessorChain(), compileData),
      duration,
      context,
    );
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.JMask');
    if (this._generationMode === 2) elem.addElement('generationMode').setText('2');
    elem.addElement('seedUsed').setText(this._seedUsed.toString());
    elem.addElement('seed').setText(this._seed.toString());
    elem.addElement(this._field.saveAsXML());
    return elem;
  }

  /** Reconstructs the JMask sound object from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context = new XmlLoadContext(data),
  ): JMask {
    if (
      data.getName() !== 'soundObject' ||
      !['JMask', 'blue.soundObject.JMask'].includes(data.getAttribute('type') ?? '')
    )
      throw context.at(data).error({
        code: 'type',
        member: '@type',
        message: 'Unexpected JMask root/type.',
        recovery: 'Use the declared JMask type.',
      });
    checkShape(
      data,
      ['type'],
      [...BASIC_SOUND_OBJECT_CHILDREN, 'seed', 'seedUsed', 'field', 'generationMode'],
      context,
    );
    const obj = new JMask();
    initBasicFromXML(obj, data, context);

    const mode = data.getElement('generationMode');
    obj._generationMode = mode && readEnum(mode, ['1', '2'], context) === '2' ? 2 : 1;

    const seedUsed = data.getTextString('seedUsed');
    if (seedUsed !== null)
      obj._seedUsed = parseXmlBoolean(
        readText(data.getElement('seedUsed')!, context),
        context.at(data.getElement('seedUsed')!),
      );

    const seed = data.getTextString('seed');
    if (seed !== null) obj._seed = readSeed(data.getElement('seed')!, context);

    const field = data.getElement('field');
    if (field !== null) {
      obj._field = Field.loadFromXML(field, context);
    }

    return obj;
  }

  override deepCopy(): JMask {
    return new JMask(this);
  }
}
