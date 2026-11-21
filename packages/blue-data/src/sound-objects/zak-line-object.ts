import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { Note } from './note';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readText, parseXmlInteger } from '../utilities/xml';
import { readLineXml } from '../automation/line-xml';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import {
  initBasicFromXML,
  getBasicXML,
  BASIC_SOUND_OBJECT_CHILDREN,
} from './sound-object-utilities';
import { GenericInstrument } from '../instruments/generic-instrument';
import { setScoreStart } from '../utilities/score';
import { formatBlueNumber } from '../utilities/number-format';

/** Authored time and value pair for a Zak control line. */
export interface ZakLinePoint {
  /** Horizontal time coordinate of this Zak control point. */
  x: number;
  /** Control value at this point. */
  y: number;
}

/** Control line mapped to a numeric Csound Zak channel. */
export interface ZakLineData {
  /** Csound Zak channel addressed by the control line. */
  channel: number;
  /** Minimum random value. */
  min?: number;
  /** Maximum random value. */
  max?: number;
  /** Numeric value step. */
  resolution?: string;
  /** Packed display color. */
  color: number;
  /** Whether the line includes a constrained right endpoint. */
  rightBound?: boolean;
  /** Whether the two endpoint values are linked. */
  endPointsLinked?: boolean;
  /** Control points belonging to this zak line data, in stored order. */
  points: ZakLinePoint[];
}

export class ZakLineObject extends AbstractSoundObject {
  private static readonly LINE_OBJECT_CACHE = 'abstractLineObject.lineObjectCache';
  private static readonly GEN_SIZE = 16384;

  private _zakSpace = 0;
  private _lines: ZakLineData[] = [];

  /** Creates a default zak line object or copies a supplied instance. */
  constructor(other?: ZakLineObject) {
    super();
    this.setName('ZakLineObject');
    if (other) {
      this.copyFrom(other);
      this._zakSpace = other._zakSpace;
      this._lines = other._lines.map((line) => ({
        ...line,
        points: line.points.map((point) => ({ ...point })),
      }));
    }
  }

  /** Returns the zak space stored on the Zak line sound object. */
  getZakSpace(): number {
    return this._zakSpace;
  }

  /** Sets the zak space stored on the Zak line sound object. */
  setZakSpace(space: number): void {
    this._zakSpace = space;
  }

  /** Returns the authored lines assigned to Csound Zak channels. */
  getLines(): ZakLineData[] {
    return [...this._lines];
  }

  /** Adds a control line for a Zak channel. */
  addLine(line: ZakLineData): void {
    this._lines.push(line);
  }

  override generateForCSD(
    context: TimeContext,
    compileData: CompileData,
    startTime: number,
    endTime: number,
  ): NoteList {
    const instrLineArray: number[] = [];
    const ftableNums = this.generateFTables(compileData);
    this.generateInstruments(compileData, instrLineArray, ftableNums);
    return this.generateNotes(context, instrLineArray, startTime, endTime);
  }

  override saveAsXML(_objRefMap?: ObjRefSaveMap): Element {
    const elem = getBasicXML(this, 'blue.soundObject.ZakLineObject');
    elem.addElement('zakSpace').setText(this._zakSpace.toString());
    for (const line of this._lines) {
      const lineElem = elem.addElement('zakline');
      lineElem.setAttribute('version', '2');
      lineElem.setAttribute('channel', String(line.channel));
      lineElem.setAttribute('max', String(line.max ?? 1));
      lineElem.setAttribute('min', String(line.min ?? 0));
      lineElem.setAttribute('bdresolution', String(line.resolution ?? -1));
      lineElem.setAttribute('color', String(line.color ?? -8355712));
      lineElem.setAttribute('rightBound', String(Boolean(line.rightBound)));
      lineElem.setAttribute('endPointsLinked', String(Boolean(line.endPointsLinked)));

      for (const point of line.points) {
        const pointElem = lineElem.addElement('linePoint');
        pointElem.setAttribute('x', String(point.x));
        pointElem.setAttribute('y', String(point.y));
      }
    }
    return elem;
  }

  /** Reconstructs the Zak line sound object from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(
    data: Element,
    _objRefMap?: ObjRefLoadMap,
    context = new XmlLoadContext(data),
  ): ZakLineObject {
    checkShape(data, ['type'], [...BASIC_SOUND_OBJECT_CHILDREN, 'zakline', 'zakSpace'], context, [
      'zakline',
    ]);
    checkRoot(data, 'soundObject', context);
    const type = data.getAttribute('type');
    if (type !== 'ZakLineObject' && type !== 'blue.soundObject.ZakLineObject')
      throw context.at(data).error({
        code: 'value',
        member: '@type',
        message: 'Unsupported ZakLineObject type.',
        recovery: 'Supply the declared SoundObject type.',
      });
    const obj = new ZakLineObject();
    initBasicFromXML(obj, data, context);
    const identities = new Set<number>();
    const space = data.getElement('zakSpace');
    if (space)
      obj._zakSpace = parseXmlInteger(readText(space, context), context.at(space), 0, 2147483647);
    for (const node of data.getElements('zakline')) {
      const channelText = node.getAttribute('channel');
      if (channelText === null)
        throw context.at(node).error({
          code: 'cardinality',
          member: '@channel',
          message: 'Zak line requires a channel.',
          recovery: 'Supply an integral channel.',
        });
      const channel = parseXmlInteger(channelText, context.at(node), 0, 2147483647, '@channel');
      const line = readLineXml(node, context, ['channel']);
      if (node.getAttribute('name') !== null || node.getAttribute('varName') !== null)
        throw context.at(node).error({
          code: 'member',
          member: '@name',
          message: 'Zak line uses channel identity rather than a name.',
          recovery: 'Remove the unsupported name.',
        });
      if (identities.has(channel))
        throw context.at(node).error({
          code: 'conflict',
          member: '@channel',
          message: 'Duplicate Zak line channel.',
          recovery: 'Use distinct channels.',
        });
      identities.add(channel);
      const { varName: _name, ...values } = line;
      obj._lines.push({ ...values, channel });
    }
    return obj;
  }

  override deepCopy(): SoundObject {
    return new ZakLineObject(this);
  }

  private createTable(line: ZakLineData): string {
    const points = [...line.points].sort((left, right) => left.x - right.x);
    if (points.length === 0) {
      return '';
    }

    let buffer = ` 0 ${ZakLineObject.GEN_SIZE} -7`;
    let lastTime = 0;
    let firstPoint = true;

    for (const point of points) {
      const newTime = point.x * ZakLineObject.GEN_SIZE;
      const dur = Math.max(newTime - lastTime, 0);

      if (firstPoint) {
        firstPoint = false;
      } else {
        buffer += ` ${formatBlueNumber(dur)}`;
      }

      buffer += ` ${formatBlueNumber(point.y)}`;
      lastTime = newTime;
    }

    return buffer;
  }

  private generateFTables(compileData: CompileData): number[] {
    const tableNums: number[] = [];
    let tableBuffer = '';

    const cacheValue = compileData.getCompilationVariable(ZakLineObject.LINE_OBJECT_CACHE);
    const tableCache =
      cacheValue instanceof Map ? (cacheValue as Map<string, number>) : new Map<string, number>();
    if (!(cacheValue instanceof Map)) {
      compileData.setCompilationVariable(ZakLineObject.LINE_OBJECT_CACHE, tableCache);
    }

    for (const line of this._lines) {
      const table = this.createTable(line);
      if (!table) {
        tableNums.push(-1);
        continue;
      }

      const cached = tableCache.get(table);
      if (cached !== undefined) {
        tableNums.push(cached);
        continue;
      }

      const tableNum = compileData.getOpenFTableNumber();
      tableCache.set(table, tableNum);
      tableNums.push(tableNum);
      tableBuffer += `f${tableNum}${table}\n`;
    }

    if (tableBuffer.length > 0) {
      compileData.appendTables(tableBuffer);
    }

    return tableNums;
  }

  private generateLineInstrument(line: ZakLineData): string {
    return `kphase line p4, p3, p5\nkline\ttablei kphase, p6, 1\nzkw kline, ${line.channel}`;
  }

  private generateInstruments(
    compileData: CompileData,
    instrLineArray: number[],
    ftableNums: number[],
  ): void {
    for (let index = 0; index < this._lines.length; index++) {
      const line = this._lines[index]!;
      const key = `AbstractLineObject.zak${line.channel}`;
      const lineNum = ftableNums[index] ?? -1;
      if (lineNum < 0) {
        continue;
      }

      const cachedInstrument = compileData.getCompilationVariable(key);
      let instrumentNumber: number;
      if (typeof cachedInstrument === 'number') {
        instrumentNumber = cachedInstrument;
      } else {
        const instrument = new GenericInstrument();
        instrument.setText(this.generateLineInstrument(line));
        instrumentNumber = compileData.addInstrument(instrument);
        compileData.setCompilationVariable(key, instrumentNumber);
      }

      instrLineArray.push(instrumentNumber, lineNum);
    }
  }

  private generateNotes(
    context: TimeContext,
    instrLineArray: number[],
    renderStart: number,
    renderEnd: number,
  ): NoteList {
    const notes = new NoteList();
    const subjectiveDuration = this._subjectiveDuration.toBeats(context);

    let newDur = subjectiveDuration;
    if (renderEnd > 0 && renderEnd < subjectiveDuration) {
      newDur = renderEnd;
    }
    newDur -= renderStart;

    const startRatio = subjectiveDuration !== 0 ? renderStart / subjectiveDuration : 0;
    const endRatio = renderEnd > 0 && subjectiveDuration !== 0 ? renderEnd / subjectiveDuration : 1;

    for (let index = 0; index < instrLineArray.length; index += 2) {
      const instrumentNumber = instrLineArray[index];
      const lineNumber = instrLineArray[index + 1];

      const note = new Note();
      note.setPField(String(instrumentNumber), 1);
      note.setStartTime(renderStart);
      note.setSubjectiveDuration(newDur);
      note.setPField(formatBlueNumber(startRatio), 4);
      note.setPField(formatBlueNumber(endRatio), 5);
      note.setPField(String(lineNumber), 6);
      notes.add(note);
    }

    setScoreStart(notes, this._startTime.toBeats(context));
    return notes;
  }
}
