/**
 * PatternObject — generates notes from step-sequencer pattern grids.
 * Mirrors the Java PatternObject class.
 *
 * Each PatternObject contains multiple Pattern rows. Each row has a boolean
 * step array and a Csound score template. During CSD generation, active steps
 * trigger the score template at the step's time position.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { TimeBehavior } from './time-behavior';
import { TimeContext } from '../time/time-context';
import { TimeDuration } from '../time/time-duration';
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
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { Pattern } from './pattern/pattern';
import {
  getNotes,
  applyTimeBehavior,
  applyNoteProcessorChain,
  applyNoteProcessorChainAsync,
  setScoreStart,
} from '../utilities/score';

export class PatternObject extends AbstractSoundObject {
  private _beats = 4;
  private _subDivisions = 4;
  private _patterns: Pattern[] = [];

  constructor(other?: PatternObject) {
    super();
    this.setName('Pattern');
    this._timeBehavior = TimeBehavior.REPEAT;
    if (other) {
      this.copyFrom(other);
      this._beats = other._beats;
      this._subDivisions = other._subDivisions;
      this._patterns = other._patterns.map((p) => Pattern.copyFrom(p));
    }
  }

  getBeats(): number {
    return this._beats;
  }
  setBeats(b: number): void {
    this.setTime(b, this._subDivisions);
  }

  getSubDivisions(): number {
    return this._subDivisions;
  }
  setSubDivisions(s: number): void {
    this.setTime(this._beats, s);
  }

  setTime(beats: number, subDivisions: number): void {
    if (this._beats === beats && this._subDivisions === subDivisions) return;
    const preserveSteps = this._subDivisions === subDivisions;
    const numSteps = beats * subDivisions;
    for (const pattern of this._patterns) {
      const values = new Array<boolean>(numSteps).fill(false);
      if (preserveSteps) {
        for (let i = 0; i < Math.min(numSteps, pattern.values.length); i++) {
          values[i] = pattern.values[i] ?? false;
        }
      }
      pattern.values = values;
    }
    this._beats = beats;
    this._subDivisions = subDivisions;
  }

  size(): number {
    return this._patterns.length;
  }
  getPattern(index: number): Pattern {
    return this._patterns[index];
  }
  addPattern(pattern: Pattern): void {
    this._patterns.push(pattern);
  }

  private generateRawNotes(): NoteList {
    const tempNoteList = new NoteList();
    const timeIncrement = 1.0 / this._subDivisions;

    let soloFound = false;

    for (const p of this._patterns) {
      if (p.solo && !p.muted) {
        soloFound = true;
        for (let j = 0; j < Math.min(p.values.length, this._beats * this._subDivisions); j++) {
          if (p.values[j]) {
            const tempPattern = getNotes(p.patternScore);
            const start = j * timeIncrement;
            setScoreStart(tempPattern, start);
            tempNoteList.merge(tempPattern);
          }
        }
      }
    }

    if (!soloFound) {
      for (const p of this._patterns) {
        if (!p.muted) {
          for (let j = 0; j < Math.min(p.values.length, this._beats * this._subDivisions); j++) {
            if (p.values[j]) {
              const tempPattern = getNotes(p.patternScore);
              const start = j * timeIncrement;
              setScoreStart(tempPattern, start);
              tempNoteList.merge(tempPattern);
            }
          }
        }
      }
    }

    return tempNoteList;
  }

  private applyTimeAndOffset(notes: NoteList, context: TimeContext): void {
    const duration = this._subjectiveDuration.toBeats(context);
    const rpBeats = this._repeatPoint ? this._repeatPoint.toBeats(context) : -1;
    applyTimeBehavior(notes, this._timeBehavior, duration, rpBeats, this._beats);

    const startTime = this._startTime.toBeats(context);
    setScoreStart(notes, startTime);
  }

  override generateForCSD(
    context: TimeContext,
    _compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): NoteList {
    const tempNoteList = this.generateRawNotes();
    applyNoteProcessorChain(tempNoteList, this.getNoteProcessorChain());
    this.applyTimeAndOffset(tempNoteList, context);
    return tempNoteList;
  }

  async generateForCSDAsync(
    context: TimeContext,
    compileData: CompileData,
    _startTime: number,
    _endTime: number,
  ): Promise<NoteList> {
    const tempNoteList = this.generateRawNotes();
    await applyNoteProcessorChainAsync(tempNoteList, this.getNoteProcessorChain(), compileData);
    this.applyTimeAndOffset(tempNoteList, context);
    return tempNoteList;
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.PatternObject');
    elem.addElement('beats').setText(this._beats.toString());
    elem.addElement('subDivisions').setText(this._subDivisions.toString());

    const patternsElem = elem.addElement('patterns');
    for (const pattern of this._patterns) {
      patternsElem.addElement(pattern.saveAsXML());
    }

    return elem;
  }

  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): PatternObject {
    const ctx = context ?? new XmlLoadContext(data);
    const type = data.getAttribute('type');
    if (
      data.getName() !== 'soundObject' ||
      type === null ||
      !['PatternObject', 'blue.soundObject.PatternObject'].includes(type)
    )
      throw ctx.at(data).error({
        code: 'type',
        member: '@type',
        value: type ?? '',
        message: 'Unsupported PatternObject type.',
        recovery: 'Supply a supported concrete SoundObject type.',
      });
    checkShape(
      data,
      ['type'],
      [...BASIC_SOUND_OBJECT_CHILDREN, ...['beats', 'subDivisions', 'patterns']],
      ctx,
    );
    const obj = new PatternObject();
    const subDivisionsElement = data.getElement('subDivisions');
    if (subDivisionsElement) readText(subDivisionsElement, ctx);
    const beatsElement = data.getElement('beats');
    if (beatsElement) readText(beatsElement, ctx);
    initBasicFromXML(obj, data, ctx);

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();
      switch (nodeName) {
        case 'beats':
          obj._beats = readInt(node, ctx, 1, 2147483647);
          break;
        case 'subDivisions':
          obj._subDivisions = readInt(node, ctx, 1, 2147483647);
          break;
        case 'patterns': {
          checkShape(node, [], ['pattern'], ctx, ['pattern']);
          const patternNodes = node.getElements();
          while (patternNodes.hasMoreElements()) {
            const pNode = patternNodes.next();
            if (pNode.getName() === 'pattern') {
              obj._patterns.push(Pattern.loadFromXML(pNode, ctx));
            }
          }
          break;
        }
      }
    }

    return context ? obj : requireXmlValue(ctx.result(obj), sink);
  }

  override deepCopy(): SoundObject {
    return new PatternObject(this);
  }
}
