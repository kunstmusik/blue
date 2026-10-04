/**
 * Sound — a SoundObject with a BlueSynthBuilder (BSB) instrument.
 * Mirrors the Java Sound class.
 *
 * Phase 11: Data preservation (load/save XML). BSB CSD generation
 * requires the full BSB system (Phase 11 BSB sub-task).
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { Note } from './note';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import {
  checkShape,
  readText,
  readInt,
  readBoolean,
  readEnum,
  parseXmlBoolean,
} from '../utilities/xml';
import { BASIC_SOUND_OBJECT_CHILDREN } from './sound-object-utilities';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { TimeBehavior } from './time-behavior';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { BlueSynthBuilder } from '../instruments/blue-synth-builder';
import type { ScoreGenerationOptions } from '../score/score-generation-options';
import type { CopyMode } from '../deep-copyable';

export class Sound extends AbstractSoundObject {
  private _comment = '';
  private _blueSynthBuilder = new BlueSynthBuilder();

  private static loadBlueSynthBuilderFromText(source: string): BlueSynthBuilder {
    const trimmed = source.trim();
    if (!trimmed) {
      return new BlueSynthBuilder();
    }

    try {
      const root = Element.parse(trimmed);
      if (root.getName() === 'instrument') {
        return BlueSynthBuilder.loadFromXML(root);
      }

      const nestedInstrument = root.getElement('instrument');
      if (nestedInstrument) {
        return BlueSynthBuilder.loadFromXML(nestedInstrument);
      }
    } catch {
      // Fall through to legacy plain-text migration behavior.
    }

    const legacy = new BlueSynthBuilder();
    legacy.setInstrumentText(source);
    return legacy;
  }

  constructor(other?: Sound, mode: CopyMode = 'duplication') {
    super();
    this.setName('Sound');
    if (other) {
      this.copyFrom(other);
      this._comment = other._comment;
      this._blueSynthBuilder = other._blueSynthBuilder.deepCopy(mode);
    }
  }

  getComment(): string {
    return this._comment;
  }
  setComment(text: string): void {
    this._comment = text;
  }

  getBlueSynthBuilder(): BlueSynthBuilder {
    return this._blueSynthBuilder;
  }
  setBlueSynthBuilder(bsb: BlueSynthBuilder): void {
    this._blueSynthBuilder = bsb;
  }

  getBSBInstrumentText(): string {
    return this._blueSynthBuilder.saveAsXML().toXml();
  }
  setBSBInstrumentText(text: string): void {
    this._blueSynthBuilder = Sound.loadBlueSynthBuilderFromText(text);
  }

  override getTimeBehavior(): TimeBehavior {
    return TimeBehavior.NOT_SUPPORTED;
  }

  getRangeOriginBeats(context: TimeContext): number | null | undefined {
    if (this.getNoteProcessorChain().getProcessors().length > 0) return undefined;
    const duration = this.getSubjectiveDuration().toBeats(context);
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return this.getStartTime().toBeats(context);
  }

  override generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
    options?: ScoreGenerationOptions,
  ): NoteList {
    const bsb = this._blueSynthBuilder.deepCopy() as BlueSynthBuilder;

    // Java parity: clear compilation variable names for score Sound objects
    // so widget values resolve directly (not gk automation vars from arrangement scope).
    const soundStart = this._startTime.toBeats(context);
    const soundDuration = this._subjectiveDuration.toBeats(context);
    for (const parameter of bsb.getParameters()) {
      parameter.setCompilationVarName('');
      parameter.setPoints(
        parameter.getPoints().map((point) => ({
          time: soundStart + point.time * soundDuration,
          value: point.value,
        })),
      );
    }

    const instrumentNumber = compileData.addInstrument(bsb);
    if (options?.trackId) compileData.addInstrSourceId(bsb, options.trackId);
    return this.generateNotes(context, instrumentNumber, startTime, endTime);
  }

  private generateNotes(
    context: TimeContext,
    instrumentNumber: number,
    renderStart: number,
    renderEnd: number,
  ): NoteList {
    const notes = new NoteList();

    const subjectiveDuration = this._subjectiveDuration.toBeats(context);
    let noteDuration = subjectiveDuration;
    if (renderEnd > 0 && renderEnd < subjectiveDuration) {
      noteDuration = renderEnd;
    }
    noteDuration -= renderStart;

    if (!Number.isFinite(noteDuration) || noteDuration <= 0) {
      return notes;
    }

    const note = new Note();
    note.setPField(String(instrumentNumber), 1);
    note.setStartTime(this._startTime.toBeats(context) + renderStart);
    note.setSubjectiveDuration(noteDuration);
    notes.add(note);

    return notes;
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.Sound');
    elem.addElement(this._blueSynthBuilder.saveAsXML());
    elem.addElement('comment').setText(this._comment);
    return elem;
  }

  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): Sound {
    const ctx = context ?? new XmlLoadContext(data);
    const type = data.getAttribute('type');
    if (
      data.getName() !== 'soundObject' ||
      type === null ||
      !['Sound', 'blue.soundObject.Sound'].includes(type)
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Unsupported Sound type.',
        recovery: 'Supply a supported concrete SoundObject type.',
      });
    checkShape(
      data,
      ['type'],
      [...BASIC_SOUND_OBJECT_CHILDREN, ...['instrument', 'instrumentText', 'comment']],
      ctx,
    );
    const obj = new Sound();
    const commentElement = data.getElement('comment');
    if (commentElement) readText(commentElement, ctx);
    const instrumentTextElement = data.getElement('instrumentText');
    if (instrumentTextElement) readText(instrumentTextElement, ctx);
    initBasicFromXML(obj, data, ctx);

    const instrElem = data.getElement('instrument');
    if (instrElem !== null) {
      obj.setBlueSynthBuilder(BlueSynthBuilder.loadFromXML(instrElem, _objRefMap, ctx));
    } else {
      const instrText = data.getTextString('instrumentText');
      if (instrText !== null) {
        const migratedInstrument = new BlueSynthBuilder();
        migratedInstrument.setInstrumentText(instrText);
        obj.setBlueSynthBuilder(migratedInstrument);
      }
    }

    const oldText = data.getElement('instrumentText');
    if (instrElem && oldText) {
      const historical = new BlueSynthBuilder();
      historical.setInstrumentText(readText(oldText, ctx));
      if (historical.saveAsXML().toXml() !== obj.getBlueSynthBuilder().saveAsXML().toXml())
        throw ctx.at(oldText).error({
          code: 'conflict',
          message: 'Competing Sound instrument representations.',
          recovery: 'Keep one equivalent instrument representation.',
        });
    }
    const comment = data.getTextString('comment');
    if (comment !== null) obj._comment = comment;

    return context ? obj : requireXmlValue(ctx.result(obj), sink);
  }

  override deepCopy(mode: CopyMode = 'duplication'): SoundObject {
    return new Sound(this, mode);
  }
}
