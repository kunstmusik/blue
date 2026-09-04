/**
 * LineObject — generates notes from user-drawn lines.
 * Mirrors Java LineObject / AbstractLineObject generation.
 */
import { AbstractSoundObject } from './abstract-sound-object';
import { NoteList } from './note-list';
import { Note } from './note';
import { TimeContext } from '../time/time-context';
import { CompileData } from '../compile-data';
import { Element } from '../serialization/xml-reader';
import { ObjRefSaveMap, ObjRefLoadMap } from '../serialization/obj-ref-map';
import { SoundObject } from './sound-object';
import { initBasicFromXML, getBasicXML } from './sound-object-utilities';
import { GenericInstrument } from '../instruments/generic-instrument';
import { setScoreStart } from '../utilities/score';
import { formatBlueNumber } from '../utilities/number-format';

export class LineObject extends AbstractSoundObject {
  private static readonly LINE_OBJECT_CACHE = 'abstractLineObject.lineObjectCache';
  private static readonly GEN_SIZE = 16384;

  private _lines: LineData[] = [];

  constructor(other?: LineObject) {
    super();
    this.setName('LineObject');
    if (other) {
      this.copyFrom(other);
      this._lines = other._lines.map((line) => ({
        ...line,
        points: line.points.map((point) => ({ ...point })),
      }));
    }
  }

  getLines(): LineData[] {
    return [...this._lines];
  }
  addLine(line: LineData): void {
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
    const elem = getBasicXML(this, 'blue.soundObject.LineObject');
    for (let index = 0; index < this._lines.length; index++) {
      const line = this._lines[index]!;
      const lineElem = elem.addElement('line');
      lineElem.setAttribute('name', line.varName || `line${index}`);
      lineElem.setAttribute('version', '2');
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

  static loadFromXML(data: Element, _objRefMap?: ObjRefLoadMap): LineObject {
    const obj = new LineObject();
    initBasicFromXML(obj, data);

    const lineNodes = data.getElements('line');
    let counter = 0;
    while (lineNodes.hasMoreElements()) {
      const node = lineNodes.next();
      const version = parseInt(node.getAttribute('version') ?? '1', 10) || 1;
      const min = parseFloat(node.getAttribute('min') ?? '0');
      const max = parseFloat(node.getAttribute('max') ?? '1');
      const range = max - min;
      const line: LineData = {
        varName: node.getAttribute('name') ?? node.getAttribute('varName') ?? `line${counter}`,
        min,
        max,
        resolution: node.getAttribute('bdresolution') ?? node.getAttribute('resolution') ?? '-1',
        color: parseInt(node.getAttribute('color') ?? '-8355712', 10),
        rightBound: (node.getAttribute('rightBound') ?? 'false') === 'true',
        endPointsLinked: (node.getAttribute('endPointsLinked') ?? 'false') === 'true',
        points: [],
      };

      const pointNodes = node.getElements('linePoint');
      while (pointNodes.hasMoreElements()) {
        const pointNode = pointNodes.next();
        const x = parseFloat(pointNode.getAttribute('x') ?? '0');
        let y = parseFloat(pointNode.getAttribute('y') ?? '0');
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        // Java parity: migrate legacy version-1 normalized Y values into min/max range.
        if (version === 1) {
          y = y * range + min;
        }
        line.points.push({ x, y });
      }

      const pointsStr = node.getTextString('points');
      if (pointsStr && line.points.length === 0) {
        for (const pair of pointsStr.trim().split(/\s+/)) {
          const [x, y] = pair.split(',').map(Number);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            line.points.push({ x, y });
          }
        }
      }
      line.points.sort((left, right) => left.x - right.x);
      obj._lines.push(line);
      counter++;
    }

    return obj;
  }

  override deepCopy(): SoundObject {
    return new LineObject(this);
  }

  private createTable(line: LineData): string {
    const points = [...line.points].sort((left, right) => left.x - right.x);
    if (points.length === 0) {
      return '';
    }

    let buffer = ` 0 ${LineObject.GEN_SIZE} -7`;
    let lastTime = 0;
    let firstPoint = true;

    for (const point of points) {
      const newTime = point.x * LineObject.GEN_SIZE;
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

    const cacheValue = compileData.getCompilationVariable(LineObject.LINE_OBJECT_CACHE);
    const tableCache =
      cacheValue instanceof Map ? (cacheValue as Map<string, number>) : new Map<string, number>();
    if (!(cacheValue instanceof Map)) {
      compileData.setCompilationVariable(LineObject.LINE_OBJECT_CACHE, tableCache);
    }

    for (const line of this._lines) {
      const table = this.createTable(line);
      if (!table) {
        tableNums.push(-1);
        continue;
      }

      let tableNum: number;
      const cached = tableCache.get(table);
      if (cached !== undefined) {
        tableNum = cached;
      } else {
        tableNum = compileData.getOpenFTableNumber();
        tableCache.set(table, tableNum);
        tableBuffer += `f${tableNum}${table}\n`;
      }
      tableNums.push(tableNum);
    }

    if (tableBuffer.length > 0) {
      compileData.appendTables(tableBuffer);
    }

    return tableNums;
  }

  private generateLineInstrument(line: LineData): string {
    const lineName = line.varName || 'line';
    return `kphase line p4, p3, p5\ngk${lineName}\ttablei kphase, p6, 1`;
  }

  private generateInstruments(
    compileData: CompileData,
    instrLineArray: number[],
    ftableNums: number[],
  ): void {
    for (let index = 0; index < this._lines.length; index++) {
      const line = this._lines[index]!;
      const lineName = line.varName || `line${index}`;
      const key = `AbstractLineObject.${lineName}`;
      const tableNum = ftableNums[index] ?? -1;
      if (tableNum < 0) {
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

      instrLineArray.push(instrumentNumber, tableNum);
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

export interface LinePoint {
  x: number;
  y: number;
}

export interface LineData {
  varName: string;
  min?: number;
  max?: number;
  resolution?: string;
  color: number;
  rightBound?: boolean;
  endPointsLinked?: boolean;
  points: LinePoint[];
}
