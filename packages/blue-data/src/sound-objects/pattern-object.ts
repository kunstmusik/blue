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
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';
import { checkShape, readText, readInt } from '../utilities/xml';
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

  /** Creates a default pattern object or copies a supplied instance. */
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

  /** Returns the beats stored on the pattern object. */
  getBeats(): number {
    return this._beats;
  }
  /** Sets the duration of one pattern cycle in beats. */
  setBeats(b: number): void {
    this.setTime(b, this._subDivisions);
  }

  /** Returns the sub divisions stored on the pattern object. */
  getSubDivisions(): number {
    return this._subDivisions;
  }
  /** Sets the number of steps per beat. */
  setSubDivisions(s: number): void {
    this.setTime(this._beats, s);
  }

  /** Updates the pattern timing using the supplied beat and subdivision counts. */
  setTime(beats: number, subDivisions: number): void {
    if (this._beats === beats && this._subDivisions === subDivisions) return;
    const preserveSteps = this._subDivisions === subDivisions;
    const numSteps = beats * subDivisions;
    for (const pattern of this._patterns) {
      const values = Array.from({ length: numSteps }, () => false);
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

  /** Returns the number of entries stored in the pattern object. */
  size(): number {
    return this._patterns.length;
  }
  /** Returns the entry at the supplied index in the pattern object’s patterns. */
  getPattern(index: number): Pattern {
    return this._patterns[index];
  }
  /** Adds a pattern to this object's ordered pattern list. */
  addPattern(pattern: Pattern): void {
    this._patterns.push(pattern);
  }

  private appendPatternSteps(
    pattern: Pattern,
    maxSteps: number,
    timeIncrement: number,
    out: NoteList,
  ): void {
    let baseNotes: NoteList | null = null;
    const limit = Math.min(pattern.values.length, maxSteps);
    for (let j = 0; j < limit; j++) {
      if (!pattern.values[j]) continue;
      if (baseNotes === null) {
        baseNotes = getNotes(pattern.patternScore);
      }
      const stepNotes = baseNotes.deepCopy();
      setScoreStart(stepNotes, j * timeIncrement);
      out.merge(stepNotes);
    }
  }

  private generateRawNotes(): NoteList {
    const tempNoteList = new NoteList();
    const timeIncrement = 1.0 / this._subDivisions;
    const maxSteps = this._beats * this._subDivisions;

    let soloFound = false;

    for (const p of this._patterns) {
      if (p.solo && !p.muted) {
        soloFound = true;
        this.appendPatternSteps(p, maxSteps, timeIncrement, tempNoteList);
      }
    }

    if (!soloFound) {
      for (const p of this._patterns) {
        if (!p.muted) {
          this.appendPatternSteps(p, maxSteps, timeIncrement, tempNoteList);
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

  /** Generates the pattern object’s Csound notes, awaiting asynchronous generators or processors through the compile context. */
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

  /** Reconstructs the pattern object from its Blue XML element, using the supplied diagnostic context when provided. */
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
      [...BASIC_SOUND_OBJECT_CHILDREN, 'beats', 'subDivisions', 'patterns'],
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
