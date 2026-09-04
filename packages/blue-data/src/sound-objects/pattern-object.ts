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
    this._beats = b;
  }

  getSubDivisions(): number {
    return this._subDivisions;
  }
  setSubDivisions(s: number): void {
    this._subDivisions = s;
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
        for (let j = 0; j < p.values.length; j++) {
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
          for (let j = 0; j < p.values.length; j++) {
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

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): PatternObject {
    const obj = new PatternObject();
    initBasicFromXML(obj, data);

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();
      switch (nodeName) {
        case 'beats':
          obj._beats = parseInt(node.getTextString() ?? '4', 10);
          break;
        case 'subDivisions':
          obj._subDivisions = parseInt(node.getTextString() ?? '4', 10);
          break;
        case 'patterns': {
          const patternNodes = node.getElements();
          while (patternNodes.hasMoreElements()) {
            const pNode = patternNodes.next();
            if (pNode.getName() === 'pattern') {
              obj._patterns.push(Pattern.loadFromXML(pNode));
            }
          }
          break;
        }
      }
    }

    return obj;
  }

  override deepCopy(): SoundObject {
    return new PatternObject(this);
  }
}
