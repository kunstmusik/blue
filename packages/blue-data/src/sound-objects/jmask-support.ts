/**
 * JMask support model used by the JMask SoundObject.
 * Mirrors the Java blue.soundObject.jmask package closely enough for XML round-trip,
 * generator evaluation, and editor state preservation.
 */
import { Element, Elements } from '../serialization/xml-reader';
import { writeBoolean, writeDouble, writeInt, readBoolean, readDouble, readInt } from '../utilities/xml';
import { formatBlueNumber } from '../utilities/number-format';
import { clamp } from '../utilities/math-utils';
import { NoteList } from './note-list';
import { Note } from './note';

const TWO_POW_53 = 9007199254740992;
const JAVA_MULTIPLIER = 0x5deece66dn;
const JAVA_ADDEND = 0xbn;
const JAVA_MASK = (1n << 48n) - 1n;

function shortClassName(type: string | null | undefined): string {
  if (!type) return '';
  return type.split('.').pop() ?? type;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function rescale(value: number, oldMin: number, oldMax: number, newMin: number, newMax: number): number {
  if (oldMax === oldMin) {
    return newMin;
  }
  const normalized = (value - oldMin) / (oldMax - oldMin);
  return newMin + (normalized * (newMax - newMin));
}

function wrap(value: number, low: number, high: number): number {
  const range = high - low;
  if (range === 0) return low;
  let shifted = value - low;
  shifted %= range;
  if (shifted < 0) shifted += range;
  return low + shifted;
}

function mirror(value: number, low: number, high: number): number {
  const range = high - low;
  if (range === 0) return low;
  const period = range * 2;
  let shifted = (value - low) % period;
  if (shifted < 0) shifted += period;
  return low + (shifted > range ? period - shifted : shifted);
}

function remainder(value: number, mod: number): number {
  if (mod === 0) return 0;
  let shifted = value % mod;
  if (shifted < 0) shifted += mod;
  return shifted;
}

export class JavaRandom {
  private _seed = 0n;

  constructor(seed: number = Date.now()) {
    this.setSeed(seed);
  }

  setSeed(seed: number): void {
    this._seed = (BigInt(Math.trunc(seed)) ^ JAVA_MULTIPLIER) & JAVA_MASK;
  }

  private next(bits: number): number {
    this._seed = (this._seed * JAVA_MULTIPLIER + JAVA_ADDEND) & JAVA_MASK;
    return Number(this._seed >> BigInt(48 - bits));
  }

  nextDouble(): number {
    const high = this.next(26);
    const low = this.next(27);
    return ((high * 134217728) + low) / TWO_POW_53;
  }
}

export interface Generator {
  initialize(duration: number): void;
  getValue(time: number, rnd: JavaRandom): number;
  saveAsXML(): Element;
  deepCopy(): Generator;
}

export interface Maskable {}
export interface Quantizable {}
export interface Accumulatable {}

export interface ProbabilityGenerator extends Generator {
  getName(): string;
  deepCopy(): ProbabilityGenerator;
}

export class TablePoint {
  time = 0.0;
  value = 0.5;

  constructor(other?: TablePoint) {
    if (other) {
      this.time = other.time;
      this.value = other.value;
    }
  }

  static loadFromXML(data: Element): TablePoint {
    const point = new TablePoint();
    point.time = parseFloat(data.getAttributeValue('time') ?? '0');
    point.value = parseFloat(data.getAttributeValue('value') ?? '0.5');
    return point;
  }

  saveAsXML(): Element {
    const elem = new Element('point');
    elem.setAttribute('time', String(this.time));
    elem.setAttribute('value', String(this.value));
    return elem;
  }

  getTime(): number {
    return this.time;
  }

  setTime(time: number): void {
    this.time = time;
  }

  getValue(): number {
    return this.value;
  }

  setValue(value: number): void {
    this.value = value;
  }

  setLocation(time: number, value: number): void {
    this.time = time;
    this.value = value;
  }
}

export class Table {
  static readonly OFF = 0;
  static readonly ON = 1;
  static readonly COS = 2;
  static readonly TYPES = ['Off', 'On', 'Cosine'];

  points: TablePoint[] = [];
  min = 0.0;
  max = 1.0;
  interpolationType = Table.ON;
  interpolation = 0.0;

  constructor(sourceOrInit: boolean | Table = true) {
    if (sourceOrInit instanceof Table) {
      this.min = sourceOrInit.min;
      this.max = sourceOrInit.max;
      this.interpolationType = sourceOrInit.interpolationType;
      this.interpolation = sourceOrInit.interpolation;
      this.points = sourceOrInit.points.map((point) => new TablePoint(point));
      return;
    }

    if (sourceOrInit !== false) {
      const firstPoint = new TablePoint();
      const secondPoint = new TablePoint();
      secondPoint.time = 1.0;
      this.points.push(firstPoint, secondPoint);
    }
  }

  private getSortedPoints(): TablePoint[] {
    return [...this.points].sort((left, right) => left.time - right.time);
  }

  private interpolateValue(ex: number, r: number, a: number, b: number): number {
    if (ex === 0.0) {
      return a + (r * (b - a));
    }
    if (ex > 0.0 && b >= a) {
      return a + (Math.pow(r, ex + 1.0) * (b - a));
    }
    if (ex > 0.0 && b < a) {
      return b + (Math.pow(1.0 - r, ex + 1.0) * (a - b));
    }
    if (ex < 0.0 && b >= a) {
      return b + (Math.pow(1.0 - r, Math.abs(ex) + 1.0) * (a - b));
    }
    return a + (Math.pow(r, Math.abs(ex) + 1.0) * (b - a));
  }

  private interpolateCosine(r: number, a: number, b: number): number {
    const cx = Math.cos((Math.PI * r) + Math.PI) / 2.0 + 0.5;
    return a + (cx * (b - a));
  }

  private integrateSegment(x1: number, xe: number, y1: number, y2: number): number {
    const pw2 = Math.pow(2, this.interpolation);
    return x1 * y1 + (Math.pow(x1, 1.0 + pw2) * (y2 - y1)) / ((1.0 + pw2) * Math.pow(xe, pw2));
  }

  getPoint(index: number): TablePoint {
    return this.points[index]!;
  }

  getTablePoint(index: number): TablePoint {
    return this.getPoint(index);
  }

  addPoint(index: number, point: TablePoint): void {
    this.points.splice(index, 0, point);
  }

  removePoint(index: number): void {
    if (index >= 0 && index < this.points.length) {
      this.points.splice(index, 1);
    }
  }

  removePointByPoint(selectedPoint: TablePoint): void {
    this.removePoint(this.points.indexOf(selectedPoint));
  }

  getRowCount(): number {
    return this.points.length;
  }

  getColumnCount(): number {
    return 2;
  }

  getColumnName(columnIndex: number): string {
    return columnIndex === 0 ? 'Time' : 'Value';
  }

  getValueAt(rowIndex: number, columnIndex: number): number {
    const point = this.getPoint(rowIndex);
    return columnIndex === 0 ? point.time : point.value;
  }

  setValueAt(aValue: unknown, rowIndex: number, columnIndex: number): void {
    if (typeof aValue !== 'number') {
      return;
    }

    const point = this.getPoint(rowIndex);

    if (columnIndex === 0) {
      if (rowIndex === 0 || rowIndex === this.points.length - 1) {
        return;
      }

      const previous = this.getPoint(rowIndex - 1)!;
      const next = this.getPoint(rowIndex + 1)!;
      let val = aValue;

      if (val < previous.time) {
        val = previous.time;
      }
      if (val > next.time) {
        val = next.time;
      }

      point.time = val;
      return;
    }

    point.value = aValue;
  }

  getInterpolation(): number {
    return this.interpolation;
  }

  setInterpolation(interpolation: number): void {
    this.interpolation = interpolation;
  }

  getInterpolationType(): number {
    return this.interpolationType;
  }

  setInterpolationType(interpolationType: number): void {
    this.interpolationType = interpolationType;
  }

  getMin(): number {
    return this.min;
  }

  setMin(min: number, truncate: boolean): void {
    if (this.min === min) {
      return;
    }

    const oldMin = this.min;
    this.min = min;

    for (const point of this.points) {
      const nextValue = truncate
        ? clamp(point.value, this.min, this.max)
        : rescale(point.value, oldMin, this.max, this.min, this.max);
      point.setLocation(point.time, nextValue);
    }
  }

  getMax(): number {
    return this.max;
  }

  setMax(max: number, truncate: boolean): void {
    if (this.max === max) {
      return;
    }

    const oldMax = this.max;
    this.max = max;

    for (const point of this.points) {
      const nextValue = truncate
        ? clamp(point.value, this.min, this.max)
        : rescale(point.value, this.min, oldMax, this.min, this.max);
      point.setLocation(point.time, nextValue);
    }
  }

  getValue(time: number): number {
    const sorted = this.getSortedPoints();
    const size = sorted.length;
    if (size === 0) {
      return 0.0;
    }

    let a = sorted[0]!;
    if (size === 1 || time <= 0.0) {
      return a.value;
    }

    let b: TablePoint | null = null;

    for (let index = 1; index < size; index += 1) {
      b = sorted[index]!;

      if (b.time === time) {
        if (index === size - 1) {
          return b.value;
        }

        while (index < size) {
          const temp = sorted[index]!;
          if (temp.time !== time) {
            break;
          }
          b = temp;
          index += 1;
        }

        return b.value;
      }

      if (b.time < time) {
        a = b;
      } else {
        break;
      }
    }

    if (b === a || b === null) {
      return a.value;
    }

    const r = (time - a.time) / (b.time - a.time);

    switch (this.interpolationType) {
      case Table.OFF:
        return a.value;
      case Table.COS:
        return this.interpolateCosine(r, a.value, b.value);
      case Table.ON:
      default:
        return this.interpolateValue(this.interpolation, r, a.value, b.value);
    }
  }

  getphs(xt: number): number {
    let erg: number;
    let phsum = 0.0;
    const xtr = roundTo(xt, 10);
    const sorted = this.getSortedPoints();
    const pointsSize = sorted.length;

    const x = new Array<number>(pointsSize);
    const y = new Array<number>(pointsSize);
    for (let index = 0; index < pointsSize; index += 1) {
      const point = sorted[index]!;
      x[index] = point.time;
      y[index] = point.value;
    }

    if (pointsSize === 0) {
      erg = 0.0;
    } else if (pointsSize === 1) {
      erg = xtr * y[0]!;
    } else if (xtr <= x[0]!) {
      erg = x[0]! * y[0]! - xtr * y[0]!;
    } else {
      let index = 0;
      while (index < pointsSize && x[index]! < xtr) {
        index += 1;
      }

      if (this.interpolationType !== Table.OFF) {
        if (index >= 2) {
          for (let k = 0; k < (index - 1); k += 1) {
            phsum += this.integrateSegment(x[k + 1]! - x[k]!, x[k + 1]! - x[k]!, y[k]!, y[k + 1]!);
          }
        }

        if (xtr >= x[pointsSize - 1]!) {
          phsum += xtr * y[pointsSize - 1]! - x[pointsSize - 1]! * y[pointsSize - 1]!;
        } else {
          phsum += this.integrateSegment(xtr - x[index - 1]!, x[index]! - x[index - 1]!, y[index - 1]!, y[index]!);
        }
        erg = phsum;
      } else {
        if (index >= 2) {
          for (let k = 0; k < (index - 1); k += 1) {
            phsum += x[k + 1]! * y[k]! - x[k]! * y[k]!;
          }
        }
        phsum += xtr * y[index - 1]! - x[index - 1]! * y[index - 1]!;
        erg = phsum;
      }
    }

    return erg;
  }

  saveAsXML(): Element {
    const retVal = new Element('table');
    retVal.addElement(writeDouble('min', this.getMin()));
    retVal.addElement(writeDouble('max', this.getMax()));
    retVal.addElement(writeInt('interpolationType', this.getInterpolationType()));
    retVal.addElement(writeDouble('interpolation', this.interpolation));

    const pointsNode = new Element('points');
    for (const point of this.points) {
      pointsNode.addElement(point.saveAsXML());
    }
    retVal.addElement(pointsNode);
    return retVal;
  }

  static loadFromXML(data: Element): Table {
    const table = new Table(false);
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'min':
          table.min = readDouble(node);
          break;
        case 'max':
          table.max = readDouble(node);
          break;
        case 'interpolationType':
          table.interpolationType = readInt(node);
          break;
        case 'interpolation':
          table.interpolation = readDouble(node);
          break;
        case 'points': {
          const pointNodes = node.getElements();
          while (pointNodes.hasMoreElements()) {
            const pointNode = pointNodes.next();
            if (pointNode.getName() === 'point') {
              table.points.push(TablePoint.loadFromXML(pointNode));
            }
          }
          break;
        }
        case 'point':
          table.points.push(TablePoint.loadFromXML(node));
          break;
      }
    }

    return table;
  }
}

export class DoubleOrTable {
  value = 0.0;
  table: Table;
  tableEnabled = false;

  constructor(defaultVal = 0.0) {
    this.value = defaultVal;
    this.table = new Table();
  }

  getValue(time: number): number {
    return this.tableEnabled ? this.table.getValue(time) : this.value;
  }
}

export class Mask {
  high = 1.0;
  low = 0.0;
  mapValue = 0.0;
  highTableEnabled = false;
  lowTableEnabled = false;
  highTable = new Table();
  lowTable = new Table();
  enabled = false;
  duration = 1.0;

  constructor(other?: Mask) {
    if (other) {
      this.high = other.high;
      this.low = other.low;
      this.mapValue = other.mapValue;
      this.highTableEnabled = other.highTableEnabled;
      this.lowTableEnabled = other.lowTableEnabled;
      this.highTable = new Table(other.highTable);
      this.lowTable = new Table(other.lowTable);
      this.enabled = other.enabled;
      this.duration = other.duration;
    }
  }

  static loadFromXML(data: Element): Mask {
    const mask = new Mask();
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'table': {
          const table = Table.loadFromXML(node);
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'highTable') {
            mask.highTable = table;
          } else if (tableId === 'lowTable') {
            mask.lowTable = table;
          }
          break;
        }
        case 'highTableEnabled':
          mask.highTableEnabled = readBoolean(node);
          break;
        case 'lowTableEnabled':
          mask.lowTableEnabled = readBoolean(node);
          break;
        case 'low':
          mask.low = readDouble(node);
          break;
        case 'high':
          mask.high = readDouble(node);
          break;
        case 'mapValue':
          mask.mapValue = readDouble(node);
          break;
        case 'enabled':
          mask.enabled = readBoolean(node);
          break;
      }
    }

    return mask;
  }

  saveAsXML(): Element {
    const retVal = new Element('mask');
    retVal.addElement(writeBoolean('highTableEnabled', this.highTableEnabled));
    retVal.addElement(writeBoolean('lowTableEnabled', this.lowTableEnabled));
    retVal.addElement(writeDouble('low', this.low));
    retVal.addElement(writeDouble('high', this.high));
    retVal.addElement(writeDouble('mapValue', this.mapValue));
    retVal.addElement(writeBoolean('enabled', this.enabled));

    const highTableNode = this.highTable.saveAsXML();
    highTableNode.setAttribute('tableId', 'highTable');
    retVal.addElement(highTableNode);

    const lowTableNode = this.lowTable.saveAsXML();
    lowTableNode.setAttribute('tableId', 'lowTable');
    retVal.addElement(lowTableNode);
    return retVal;
  }

  private mapValueToRange(value: number): number {
    return this.mapValue === 0.0 ? value : Math.pow(value, this.mapValue);
  }

  getValue(time: number, value: number): number {
    if (!this.enabled) {
      return value;
    }

    const localTime = this.duration !== 0 ? time / this.duration : 0;
    const localHigh = this.highTableEnabled ? this.highTable.getValue(localTime) : this.high;
    const localLow = this.lowTableEnabled ? this.lowTable.getValue(localTime) : this.low;
    return localLow + ((localHigh - localLow) * this.mapValueToRange(value));
  }
}

export class Quantizer {
  gridSize = 1.0;
  strength = 1.0;
  offset = 0.0;
  gridSizeTableEnabled = false;
  strengthTableEnabled = false;
  offsetTableEnabled = false;
  gridSizeTable = new Table();
  strengthTable = new Table();
  offsetTable = new Table();
  enabled = false;
  duration = 1.0;

  constructor(other?: Quantizer) {
    if (other) {
      this.gridSize = other.gridSize;
      this.strength = other.strength;
      this.offset = other.offset;
      this.gridSizeTableEnabled = other.gridSizeTableEnabled;
      this.strengthTableEnabled = other.strengthTableEnabled;
      this.offsetTableEnabled = other.offsetTableEnabled;
      this.gridSizeTable = new Table(other.gridSizeTable);
      this.strengthTable = new Table(other.strengthTable);
      this.offsetTable = new Table(other.offsetTable);
      this.enabled = other.enabled;
      this.duration = other.duration;
      return;
    }

    this.gridSizeTable.getPoint(0).setValue(1.0);
    this.gridSizeTable.getPoint(0).setValue(1.0);
    this.gridSizeTable.setMin(Number.MIN_VALUE, true);

    this.strengthTable.getPoint(0).setValue(1.0);
    this.strengthTable.getPoint(0).setValue(1.0);

    this.offsetTable.getPoint(0).setValue(0.0);
    this.offsetTable.getPoint(0).setValue(0.0);
  }

  static loadFromXML(data: Element): Quantizer {
    const quantizer = new Quantizer();
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'gridSize':
          quantizer.gridSize = readDouble(node);
          break;
        case 'strength':
          quantizer.strength = readDouble(node);
          break;
        case 'offset':
          quantizer.offset = readDouble(node);
          break;
        case 'gridSizeTableEnabled':
          quantizer.gridSizeTableEnabled = readBoolean(node);
          break;
        case 'strengthTableEnabled':
          quantizer.strengthTableEnabled = readBoolean(node);
          break;
        case 'offsetTableEnabled':
          quantizer.offsetTableEnabled = readBoolean(node);
          break;
        case 'enabled':
          quantizer.enabled = readBoolean(node);
          break;
        case 'table': {
          const table = Table.loadFromXML(node);
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'gridSizeTable') {
            quantizer.gridSizeTable = table;
          } else if (tableId === 'strengthTable') {
            quantizer.strengthTable = table;
          } else if (tableId === 'offsetTable') {
            quantizer.offsetTable = table;
          }
          break;
        }
      }
    }

    return quantizer;
  }

  saveAsXML(): Element {
    const retVal = new Element('quantizer');
    retVal.addElement(writeDouble('gridSize', this.gridSize));
    retVal.addElement(writeDouble('strength', this.strength));
    retVal.addElement(writeDouble('offset', this.offset));
    retVal.addElement(writeBoolean('gridSizeTableEnabled', this.gridSizeTableEnabled));
    retVal.addElement(writeBoolean('strengthTableEnabled', this.strengthTableEnabled));
    retVal.addElement(writeBoolean('offsetTableEnabled', this.offsetTableEnabled));
    retVal.addElement(writeBoolean('enabled', this.enabled));

    const gridSizeTableNode = this.gridSizeTable.saveAsXML();
    gridSizeTableNode.setAttribute('tableId', 'gridSizeTable');
    retVal.addElement(gridSizeTableNode);

    const strengthTableNode = this.strengthTable.saveAsXML();
    strengthTableNode.setAttribute('tableId', 'strengthTable');
    retVal.addElement(strengthTableNode);

    const offsetTableNode = this.offsetTable.saveAsXML();
    offsetTableNode.setAttribute('tableId', 'offsetTable');
    retVal.addElement(offsetTableNode);
    return retVal;
  }

  getValue(time: number, value: number): number {
    if (!this.enabled) {
      return value;
    }

    const localTime = this.duration !== 0 ? time / this.duration : 0;
    const localGridSize = this.gridSizeTableEnabled ? this.gridSizeTable.getValue(localTime) : this.gridSize;
    const localStrength = this.strengthTableEnabled ? this.strengthTable.getValue(localTime) : this.strength;
    const localOffset = this.offsetTableEnabled ? this.offsetTable.getValue(localTime) : this.offset;

    if (localGridSize === 0) {
      return value;
    }

    const d = value - localOffset;
    const r = Math.floor((d + localGridSize / 2.0) / localGridSize);
    const err = d / localGridSize - r;
    return localOffset + ((r + (err * (1 - localStrength))) * localGridSize);
  }
}

export class Accumulator {
  static readonly ON = 0;
  static readonly LIMIT = 1;
  static readonly MIRROR = 2;
  static readonly WRAP = 3;
  static readonly MODES = ['On', 'Limit', 'Mirror', 'Wrap'];

  highTable = new Table();
  lowTable = new Table();
  highTableEnabled = false;
  lowTableEnabled = false;
  mode = Accumulator.ON;
  low = 0.0;
  high = 1.0;
  initialValue = 0.0;
  enabled = false;
  runningValue = 0.0;
  firstTime = true;
  duration = 1.0;

  constructor(other?: Accumulator) {
    if (other) {
      this.highTable = new Table(other.highTable);
      this.lowTable = new Table(other.lowTable);
      this.highTableEnabled = other.highTableEnabled;
      this.lowTableEnabled = other.lowTableEnabled;
      this.mode = other.mode;
      this.low = other.low;
      this.high = other.high;
      this.initialValue = other.initialValue;
      this.enabled = other.enabled;
    }
  }

  static loadFromXML(data: Element): Accumulator {
    const accumulator = new Accumulator();
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'table': {
          const table = Table.loadFromXML(node);
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'highTable') {
            accumulator.highTable = table;
          } else if (tableId === 'lowTable') {
            accumulator.lowTable = table;
          }
          break;
        }
        case 'highTableEnabled':
          accumulator.highTableEnabled = readBoolean(node);
          break;
        case 'lowTableEnabled':
          accumulator.lowTableEnabled = readBoolean(node);
          break;
        case 'mode':
          accumulator.mode = readInt(node);
          break;
        case 'low':
          accumulator.low = readDouble(node);
          break;
        case 'high':
          accumulator.high = readDouble(node);
          break;
        case 'initialValue':
          accumulator.initialValue = readDouble(node);
          break;
        case 'enabled':
          accumulator.enabled = readBoolean(node);
          break;
      }
    }

    return accumulator;
  }

  saveAsXML(): Element {
    const retVal = new Element('accumulator');

    const highTableNode = this.highTable.saveAsXML();
    highTableNode.setAttribute('tableId', 'highTable');
    retVal.addElement(highTableNode);

    const lowTableNode = this.lowTable.saveAsXML();
    lowTableNode.setAttribute('tableId', 'lowTable');
    retVal.addElement(lowTableNode);

    retVal.addElement(writeBoolean('highTableEnabled', this.highTableEnabled));
    retVal.addElement(writeBoolean('lowTableEnabled', this.lowTableEnabled));
    retVal.addElement(writeInt('mode', this.mode));
    retVal.addElement(writeDouble('low', this.low));
    retVal.addElement(writeDouble('high', this.high));
    retVal.addElement(writeDouble('initialValue', this.initialValue));
    retVal.addElement(writeBoolean('enabled', this.enabled));
    return retVal;
  }

  getValue(time: number, value: number): number {
    if (!this.enabled) {
      return value;
    }

    if (this.firstTime) {
      this.firstTime = false;
      this.runningValue = this.initialValue;
    }

    this.runningValue += value;

    const localTime = this.duration !== 0 ? time / this.duration : 0;
    const lowerBound = this.lowTableEnabled ? this.lowTable.getValue(localTime) : this.low;
    const upperBound = this.highTableEnabled ? this.highTable.getValue(localTime) : this.high;

    switch (this.mode) {
      case Accumulator.LIMIT:
        this.runningValue = clamp(this.runningValue, lowerBound, upperBound);
        break;
      case Accumulator.MIRROR:
        this.runningValue = mirror(this.runningValue, lowerBound, upperBound);
        break;
      case Accumulator.WRAP:
        this.runningValue = wrap(this.runningValue, lowerBound, upperBound);
        break;
      case Accumulator.ON:
      default:
        break;
    }

    return this.runningValue;
  }
}

export class Constant implements Generator, Accumulatable {
  value = 1.0;

  constructor(other?: Constant) {
    if (other) {
      this.value = other.value;
    }
  }

  static loadFromXML(data: Element): Constant {
    const constant = new Constant();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'value') {
        constant.value = readDouble(node);
      }
    }
    return constant;
  }

  initialize(_duration: number): void {}

  getValue(_time: number, _rnd: JavaRandom): number {
    return this.value;
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Constant');
    retVal.addElement(writeDouble('value', this.value));
    return retVal;
  }

  deepCopy(): Constant {
    return new Constant(this);
  }
}

export class Random implements Generator, Quantizable, Accumulatable {
  min = 0.0;
  max = 1.0;

  constructor(other?: Random) {
    if (other) {
      this.min = other.min;
      this.max = other.max;
    }
  }

  static loadFromXML(data: Element): Random {
    const random = new Random();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'min':
          random.min = readDouble(node);
          break;
        case 'max':
          random.max = readDouble(node);
          break;
      }
    }
    return random;
  }

  initialize(_duration: number): void {}

  getValue(_time: number, rnd: JavaRandom): number {
    return this.min + ((this.max - this.min) * rnd.nextDouble());
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Random');
    retVal.addElement(writeDouble('min', this.min));
    retVal.addElement(writeDouble('max', this.max));
    return retVal;
  }

  deepCopy(): Random {
    return new Random(this);
  }
}

export class Oscillator implements Generator, Maskable, Quantizable, Accumulatable {
  static readonly SINE = 0;
  static readonly COSINE = 1;
  static readonly SAW_UP = 2;
  static readonly SAW_DOWN = 3;
  static readonly SQUARE = 4;
  static readonly TRIANGLE = 5;
  static readonly POW_UP = 6;
  static readonly POW_DOWN = 7;
  static readonly FUNCTIONS = ['Sine', 'Cosine', 'Saw (Increasing)', 'Saw (Decreasing)', 'Square', 'Triangle', 'Power Function (Increasing)', 'Power Function (Decreasing)'];

  oscillatorType = Oscillator.SINE;
  phaseInit = 0.0;
  frequency = 1.0;
  freqTable = new Table();
  freqTableEnabled = false;
  exponent = 1.0;

  constructor(other?: Oscillator) {
    if (other) {
      this.oscillatorType = other.oscillatorType;
      this.phaseInit = other.phaseInit;
      this.frequency = other.frequency;
      this.freqTable = new Table(other.freqTable);
      this.freqTableEnabled = other.freqTableEnabled;
      this.exponent = other.exponent;
      return;
    }

    this.freqTable.setMin(0.001, false);
    this.freqTable.setMax(10.0, false);
    this.freqTable.getPoint(0).setValue(1.0);
    this.freqTable.getPoint(1).setValue(1.0);
  }

  static loadFromXML(data: Element): Oscillator {
    const oscillator = new Oscillator();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'oscillatorType':
          oscillator.oscillatorType = readInt(node);
          break;
        case 'phaseInit':
          oscillator.phaseInit = readDouble(node);
          break;
        case 'frequency':
          oscillator.frequency = readDouble(node);
          break;
        case 'freqTableEnabled':
          oscillator.freqTableEnabled = readBoolean(node);
          break;
        case 'table':
          oscillator.freqTable = Table.loadFromXML(node);
          break;
        case 'exponent':
          oscillator.exponent = readDouble(node);
          break;
      }
    }
    return oscillator;
  }

  initialize(_duration: number): void {}

  private getPhase(time: number): number {
    if (!this.freqTableEnabled) {
      return this.phaseInit + (time * this.frequency);
    }
    return this.phaseInit + this.freqTable.getphs(time);
  }

  private sin(phase: number): number {
    return Math.sin(Math.PI * 2 * phase) * 0.5 + 0.5;
  }

  private cos(phase: number): number {
    return Math.cos(Math.PI * 2 * phase) * 0.5 + 0.5;
  }

  private sawUp(phase: number): number {
    return Math.abs(remainder(phase, 1.0));
  }

  private sawDown(phase: number): number {
    return 1.0 - Math.abs(remainder(phase, 1.0));
  }

  private square(phase: number): number {
    const x = Math.abs(remainder(phase, 1.0));
    return x < 0.5 ? 1.0 : 0.0;
  }

  private triangle(phase: number): number {
    const x = Math.abs(remainder(phase, 1.0));
    return x < 0.5 ? 2.0 * x : 2.0 * (1.0 - x);
  }

  private powerUp(phase: number): number {
    return Math.pow(Math.abs(remainder(phase, 1.0)), Math.pow(2.0, this.exponent));
  }

  private powerDown(phase: number): number {
    return Math.pow(1.0 - Math.abs(remainder(phase, 1.0)), Math.pow(2.0, this.exponent));
  }

  getValue(time: number, _rnd: JavaRandom): number {
    const phase = this.getPhase(time);
    switch (this.oscillatorType) {
      case Oscillator.COSINE:
        return this.cos(phase);
      case Oscillator.SAW_UP:
        return this.sawUp(phase);
      case Oscillator.SAW_DOWN:
        return this.sawDown(phase);
      case Oscillator.SQUARE:
        return this.square(phase);
      case Oscillator.TRIANGLE:
        return this.triangle(phase);
      case Oscillator.POW_UP:
        return this.powerUp(phase);
      case Oscillator.POW_DOWN:
        return this.powerDown(phase);
      case Oscillator.SINE:
      default:
        return this.sin(phase);
    }
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Oscillator');
    retVal.addElement(writeInt('oscillatorType', this.oscillatorType));
    retVal.addElement(writeDouble('phaseInit', this.phaseInit));
    retVal.addElement(writeDouble('frequency', this.frequency));
    retVal.addElement(writeBoolean('freqTableEnabled', this.freqTableEnabled));
    retVal.addElement(this.freqTable.saveAsXML());
    retVal.addElement(writeDouble('exponent', this.exponent));
    return retVal;
  }

  deepCopy(): Oscillator {
    return new Oscillator(this);
  }
}

export class Segment implements Generator, Quantizable, Accumulatable {
  table = new Table();

  constructor(other?: Segment) {
    if (other) {
      this.table = new Table(other.table);
    }
  }

  static loadFromXML(data: Element): Segment {
    const segment = new Segment();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'table') {
        segment.table = Table.loadFromXML(node);
      }
    }
    return segment;
  }

  initialize(duration: number): void {
    for (const point of this.table.points) {
      point.time *= duration;
    }
  }

  getValue(time: number, _rnd: JavaRandom): number {
    return this.table.getValue(time);
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Segment');
    retVal.addElement(this.table.saveAsXML());
    return retVal;
  }

  deepCopy(): Segment {
    return new Segment(this);
  }
}

export class ItemList implements Generator, TableLike, Accumulatable {
  static readonly CYCLE = 0;
  static readonly SWING = 1;
  static readonly RANDOM = 2;
  static readonly HEAP = 3;
  static readonly MODES = ['Cycle', 'Swing', 'Random', 'Heap'];

  listType = ItemList.CYCLE;
  listItems: number[] = [];
  index = 0;
  direction = 0;

  constructor(other?: ItemList) {
    if (other) {
      this.listType = other.listType;
      this.listItems = [...other.listItems];
    }
  }

  static loadFromXML(data: Element): ItemList {
    const itemList = new ItemList();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'listType':
          itemList.listType = readInt(node);
          break;
        case 'listItems': {
          const items = node.getElements();
          while (items.hasMoreElements()) {
            const itemNode = items.next();
            if (itemNode.getName() === 'item') {
              itemList.listItems.push(parseFloat(itemNode.getTextString()));
            }
          }
          break;
        }
        case 'index':
          itemList.index = readInt(node);
          break;
        case 'direction':
          itemList.direction = readInt(node);
          break;
      }
    }
    return itemList;
  }

  initialize(_duration: number): void {
    this.index = 0;
    this.direction = 0;
  }

  private shuffleItems(): void {
    for (let index = this.listItems.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.listItems[index], this.listItems[swapIndex]] = [this.listItems[swapIndex]!, this.listItems[index]!];
    }
  }

  getValue(_time: number, rnd: JavaRandom): number {
    if (this.listItems.length === 0) {
      return 0.0;
    }

    if (this.listItems.length === 1) {
      return this.listItems[0]!;
    }

    switch (this.listType) {
      case ItemList.CYCLE: {
        const value = this.listItems[this.index]!;
        this.index += 1;
        if (this.index >= this.listItems.length) {
          this.index = 0;
        }
        return value;
      }
      case ItemList.SWING: {
        const value = this.listItems[this.index]!;
        if (this.direction === 0) {
          this.index += 1;
          if (this.index >= this.listItems.length) {
            this.index -= 2;
            this.direction = 1;
          }
        } else {
          this.index -= 1;
          if (this.index < 0) {
            this.index = 1;
            this.direction = 0;
          }
        }
        return value;
      }
      case ItemList.RANDOM: {
        this.index = Math.floor(rnd.nextDouble() * this.listItems.length);
        return this.listItems[this.index]!;
      }
      case ItemList.HEAP: {
        if (this.index === 0) {
          this.shuffleItems();
        }
        const value = this.listItems[this.index]!;
        this.index += 1;
        if (this.index >= this.listItems.length) {
          this.index = 0;
        }
        return value;
      }
      default:
        return this.listItems[this.index]!;
    }
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.ItemList');
    retVal.addElement(writeInt('listType', this.listType));
    retVal.addElement(writeInt('index', this.index));
    retVal.addElement(writeInt('direction', this.direction));

    const items = new Element('listItems');
    for (const item of this.listItems) {
      items.addElement('item').setText(String(item));
    }
    retVal.addElement(items);
    return retVal;
  }

  deepCopy(): ItemList {
    return new ItemList(this);
  }
}

interface TableLike {
  listType: number;
  listItems: number[];
  index: number;
  direction: number;
}

export class Uniform implements ProbabilityGenerator {
  constructor(other?: Uniform) {
    void other;
  }

  static loadFromXML(_data: Element): Uniform {
    return new Uniform();
  }

  getName(): string {
    return 'Uniform';
  }

  initialize(_duration: number): void {}

  getValue(_time: number, rnd: JavaRandom): number {
    return rnd.nextDouble();
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Uniform');
    return retVal;
  }

  deepCopy(): Uniform {
    return new Uniform(this);
  }
}

export class Triangle implements ProbabilityGenerator {
  constructor(other?: Triangle) {
    void other;
  }

  static loadFromXML(_data: Element): Triangle {
    return new Triangle();
  }

  getName(): string {
    return 'Triangle';
  }

  initialize(_duration: number): void {}

  getValue(_time: number, rnd: JavaRandom): number {
    return 0.5 * (rnd.nextDouble() + rnd.nextDouble());
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Triangle');
    return retVal;
  }

  deepCopy(): Triangle {
    return new Triangle(this);
  }
}

export class Linear implements ProbabilityGenerator {
  static readonly DECREASING = 0;
  static readonly INCREASING = 1;

  direction = Linear.DECREASING;

  constructor(other?: Linear) {
    if (other) {
      this.direction = other.direction;
    }
  }

  static loadFromXML(data: Element): Linear {
    const linear = new Linear();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'direction') {
        linear.direction = readInt(node);
      }
    }
    return linear;
  }

  getName(): string {
    return 'Linear';
  }

  initialize(_duration: number): void {}

  getValue(_time: number, rnd: JavaRandom): number {
    const x1 = rnd.nextDouble();
    const x2 = rnd.nextDouble();
    return this.direction === Linear.DECREASING ? Math.min(x1, x2) : Math.max(x1, x2);
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Linear');
    retVal.addElement(writeInt('direction', this.direction));
    return retVal;
  }

  deepCopy(): Linear {
    return new Linear(this);
  }
}

export class Exponential implements ProbabilityGenerator {
  static readonly DECREASING = 0;
  static readonly INCREASING = 1;
  static readonly BILATERAL = 2;

  direction = Exponential.DECREASING;
  lambda = 0.5;
  lambdaTable = new Table();
  lambdaTableEnabled = false;

  constructor(other?: Exponential) {
    if (other) {
      this.direction = other.direction;
      this.lambda = other.lambda;
      this.lambdaTable = new Table(other.lambdaTable);
      this.lambdaTableEnabled = other.lambdaTableEnabled;
      return;
    }

    this.lambdaTable.setMin(0.0001, false);
  }

  static loadFromXML(data: Element): Exponential {
    const exponential = new Exponential();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'direction':
          exponential.direction = readInt(node);
          break;
        case 'lambda':
          exponential.lambda = readDouble(node);
          break;
        case 'lambdaTableEnabled':
          exponential.lambdaTableEnabled = readBoolean(node);
          break;
        case 'table':
          exponential.lambdaTable = Table.loadFromXML(node);
          break;
      }
    }
    return exponential;
  }

  getName(): string {
    return 'Exponential';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localLambda = this.lambdaTableEnabled ? this.lambdaTable.getValue(time) : this.lambda;
    let x = 0.0;

    if (this.direction === Exponential.BILATERAL) {
      let e = 0.0;
      do {
        x = 2.0 * rnd.nextDouble();
        if (x > 1.0) {
          x = 2.0 - x;
          e = -Math.log(x);
        } else {
          e = Math.log(x);
        }
        e = (e / 14.0 / localLambda) + 0.5;
      } while (e > 1.0 || e < 0.0);
      return e;
    }

    do {
      while ((x = rnd.nextDouble()) === 0) {
        // retry
      }
      x = -Math.log(x) / 7.0 / localLambda;
    } while (x > 1.0);

    if (this.direction === Exponential.INCREASING) {
      x = 1.0 - x;
    }
    return x;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Exponential');
    retVal.addElement(writeInt('direction', this.direction));
    retVal.addElement(writeDouble('lambda', this.lambda));
    retVal.addElement(writeBoolean('lambdaTableEnabled', this.lambdaTableEnabled));
    retVal.addElement(this.lambdaTable.saveAsXML());
    return retVal;
  }

  deepCopy(): Exponential {
    return new Exponential(this);
  }
}

export class Gaussian implements ProbabilityGenerator {
  sigma = 0.1;
  mu = 0.5;
  sigmaTableEnabled = false;
  muTableEnabled = false;
  sigmaTable = new Table();
  muTable = new Table();

  constructor(other?: Gaussian) {
    if (other) {
      this.sigma = other.sigma;
      this.mu = other.mu;
      this.sigmaTableEnabled = other.sigmaTableEnabled;
      this.muTableEnabled = other.muTableEnabled;
      this.sigmaTable = new Table(other.sigmaTable);
      this.muTable = new Table(other.muTable);
      return;
    }

    this.sigmaTable.getPoint(0).setValue(0.1);
    this.sigmaTable.getPoint(1).setValue(0.1);
    this.muTable.getPoint(0).setValue(0.5);
    this.muTable.getPoint(1).setValue(0.5);
  }

  static loadFromXML(data: Element): Gaussian {
    const gaussian = new Gaussian();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'sigma':
          gaussian.sigma = readDouble(node);
          break;
        case 'mu':
          gaussian.mu = readDouble(node);
          break;
        case 'sigmaTableEnabled':
          gaussian.sigmaTableEnabled = readBoolean(node);
          break;
        case 'muTableEnabled':
          gaussian.muTableEnabled = readBoolean(node);
          break;
        case 'table': {
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'sigmaTable') {
            gaussian.sigmaTable = Table.loadFromXML(node);
          } else if (tableId === 'muTable') {
            gaussian.muTable = Table.loadFromXML(node);
          }
          break;
        }
      }
    }
    return gaussian;
  }

  getName(): string {
    return 'Gaussian';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localSigma = this.sigmaTableEnabled ? this.sigmaTable.getValue(time) : this.sigma;
    const localMu = this.muTableEnabled ? this.muTable.getValue(time) : this.mu;

    let value = 0.0;
    do {
      let sum = 0.0;
      for (let index = 1; index <= 12; index += 1) {
        sum += rnd.nextDouble();
      }
      value = localSigma * (sum - 6.0) + localMu;
    } while (value > 1.0 || value < 0.0);

    return value;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Gaussian');
    retVal.addElement(writeDouble('sigma', this.sigma));
    retVal.addElement(writeDouble('mu', this.mu));
    retVal.addElement(writeBoolean('sigmaTableEnabled', this.sigmaTableEnabled));
    retVal.addElement(writeBoolean('muTableEnabled', this.muTableEnabled));

    const sigmaTableNode = this.sigmaTable.saveAsXML();
    sigmaTableNode.setAttribute('tableId', 'sigmaTable');
    retVal.addElement(sigmaTableNode);

    const muTableNode = this.muTable.saveAsXML();
    muTableNode.setAttribute('tableId', 'muTable');
    retVal.addElement(muTableNode);
    return retVal;
  }

  deepCopy(): Gaussian {
    return new Gaussian(this);
  }
}

export class Cauchy implements ProbabilityGenerator {
  alpha = 0.1;
  mu = 0.5;
  alphaTableEnabled = false;
  muTableEnabled = false;
  alphaTable = new Table();
  muTable = new Table();

  constructor(other?: Cauchy) {
    if (other) {
      this.alpha = other.alpha;
      this.mu = other.mu;
      this.alphaTableEnabled = other.alphaTableEnabled;
      this.muTableEnabled = other.muTableEnabled;
      this.alphaTable = new Table(other.alphaTable);
      this.muTable = new Table(other.muTable);
      return;
    }

    this.alphaTable.getPoint(0).setValue(0.1);
    this.alphaTable.getPoint(1).setValue(0.1);
    this.muTable.getPoint(0).setValue(0.5);
    this.muTable.getPoint(1).setValue(0.5);
  }

  static loadFromXML(data: Element): Cauchy {
    const cauchy = new Cauchy();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'alpha':
          cauchy.alpha = readDouble(node);
          break;
        case 'mu':
          cauchy.mu = readDouble(node);
          break;
        case 'alphaTableEnabled':
          cauchy.alphaTableEnabled = readBoolean(node);
          break;
        case 'muTableEnabled':
          cauchy.muTableEnabled = readBoolean(node);
          break;
        case 'table': {
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'alphaTable') {
            cauchy.alphaTable = Table.loadFromXML(node);
          } else if (tableId === 'muTable') {
            cauchy.muTable = Table.loadFromXML(node);
          }
          break;
        }
      }
    }
    return cauchy;
  }

  getName(): string {
    return 'Cauchy';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localAlpha = this.alphaTableEnabled ? this.alphaTable.getValue(time) : this.alpha;
    const localMu = this.muTableEnabled ? this.muTable.getValue(time) : this.mu;

    let x = 0.0;
    let e = 0.0;
    do {
      do {
        x = rnd.nextDouble();
      } while (x === 0.5);
      e = localAlpha * Math.tan(x * Math.PI) + localMu;
    } while (e > 1.0 || e < 0.0);

    return e;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Cauchy');
    retVal.addElement(writeDouble('alpha', this.alpha));
    retVal.addElement(writeDouble('mu', this.mu));
    retVal.addElement(writeBoolean('alphaTableEnabled', this.alphaTableEnabled));
    retVal.addElement(writeBoolean('muTableEnabled', this.muTableEnabled));

    const alphaTableNode = this.alphaTable.saveAsXML();
    alphaTableNode.setAttribute('tableId', 'alphaTable');
    retVal.addElement(alphaTableNode);

    const muTableNode = this.muTable.saveAsXML();
    muTableNode.setAttribute('tableId', 'muTable');
    retVal.addElement(muTableNode);
    return retVal;
  }

  deepCopy(): Cauchy {
    return new Cauchy(this);
  }
}

export class Beta implements ProbabilityGenerator {
  a = 0.1;
  b = 0.1;
  aTable = new Table();
  bTable = new Table();
  aTableEnabled = false;
  bTableEnabled = false;

  constructor(other?: Beta) {
    if (other) {
      this.a = other.a;
      this.b = other.b;
      this.aTable = new Table(other.aTable);
      this.bTable = new Table(other.bTable);
      this.aTableEnabled = other.aTableEnabled;
      this.bTableEnabled = other.bTableEnabled;
      return;
    }

    this.aTable.getPoint(0).setValue(0.1);
    this.aTable.getPoint(1).setValue(0.1);
    this.bTable.getPoint(0).setValue(0.1);
    this.bTable.getPoint(1).setValue(0.1);
  }

  static loadFromXML(data: Element): Beta {
    const beta = new Beta();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'a':
          beta.a = readDouble(node);
          break;
        case 'b':
          beta.b = readDouble(node);
          break;
        case 'aTableEnabled':
          beta.aTableEnabled = readBoolean(node);
          break;
        case 'bTableEnabled':
          beta.bTableEnabled = readBoolean(node);
          break;
        case 'table': {
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'aTable') {
            beta.aTable = Table.loadFromXML(node);
          } else if (tableId === 'bTable') {
            beta.bTable = Table.loadFromXML(node);
          }
          break;
        }
      }
    }
    return beta;
  }

  getName(): string {
    return 'Beta';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localA = this.aTableEnabled ? this.aTable.getValue(time) : this.a;
    const localB = this.bTableEnabled ? this.bTable.getValue(time) : this.b;

    let x1 = 0.0;
    let x2 = 0.0;
    let yps1 = 0.0;
    let yps2 = 0.0;
    let sum = 0.0;
    do {
      x1 = rnd.nextDouble();
      x2 = rnd.nextDouble();
      yps1 = Math.pow(x1, 1.0 / localA);
      yps2 = Math.pow(x2, 1.0 / localB);
      sum = yps1 + yps2;
    } while (sum > 1.0);

    return yps1 / sum;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Beta');
    retVal.addElement(writeDouble('a', this.a));
    retVal.addElement(writeDouble('b', this.b));
    retVal.addElement(writeBoolean('aTableEnabled', this.aTableEnabled));
    retVal.addElement(writeBoolean('bTableEnabled', this.bTableEnabled));

    const aTableNode = this.aTable.saveAsXML();
    aTableNode.setAttribute('tableId', 'aTable');
    retVal.addElement(aTableNode);

    const bTableNode = this.bTable.saveAsXML();
    bTableNode.setAttribute('tableId', 'bTable');
    retVal.addElement(bTableNode);
    return retVal;
  }

  deepCopy(): Beta {
    return new Beta(this);
  }
}

export class Weibull implements ProbabilityGenerator {
  s = 0.5;
  t = 2.0;
  sTableEnabled = false;
  tTableEnabled = false;
  sTable = new Table();
  tTable = new Table();

  constructor(other?: Weibull) {
    if (other) {
      this.s = other.s;
      this.t = other.t;
      this.sTableEnabled = other.sTableEnabled;
      this.tTableEnabled = other.tTableEnabled;
      this.sTable = new Table(other.sTable);
      this.tTable = new Table(other.tTable);
      return;
    }

    this.tTable.setMax(4.0, false);
    this.tTable.setMin(0.001, false);
    this.sTable.getPoint(0).setValue(0.5);
    this.sTable.getPoint(1).setValue(0.5);
    this.tTable.getPoint(0).setValue(2.0);
    this.tTable.getPoint(1).setValue(2.0);
  }

  static loadFromXML(data: Element): Weibull {
    const weibull = new Weibull();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 's':
          weibull.s = readDouble(node);
          break;
        case 't':
          weibull.t = readDouble(node);
          break;
        case 'sTableEnabled':
          weibull.sTableEnabled = readBoolean(node);
          break;
        case 'tTableEnabled':
          weibull.tTableEnabled = readBoolean(node);
          break;
        case 'table': {
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'sTable') {
            weibull.sTable = Table.loadFromXML(node);
          } else if (tableId === 'tTable') {
            weibull.tTable = Table.loadFromXML(node);
          }
          break;
        }
      }
    }
    return weibull;
  }

  getName(): string {
    return 'Weibull';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localS = this.sTableEnabled ? this.sTable.getValue(time) : this.s;
    const localT = this.tTableEnabled ? this.tTable.getValue(time) : this.t;

    let x = 0.0;
    let a = 0.0;
    let value = 0.0;
    do {
      x = rnd.nextDouble();
      a = 1.0 / (1.0 - x);
      value = localS * Math.pow(Math.log(a), 1.0 / localT);
    } while (value > 1.0);

    return value;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Weibull');
    retVal.addElement(writeDouble('s', this.s));
    retVal.addElement(writeDouble('t', this.t));
    retVal.addElement(writeBoolean('sTableEnabled', this.sTableEnabled));
    retVal.addElement(writeBoolean('tTableEnabled', this.tTableEnabled));

    const sTableNode = this.sTable.saveAsXML();
    sTableNode.setAttribute('tableId', 'sTable');
    retVal.addElement(sTableNode);

    const tTableNode = this.tTable.saveAsXML();
    tTableNode.setAttribute('tableId', 'tTable');
    retVal.addElement(tTableNode);
    return retVal;
  }

  deepCopy(): Weibull {
    return new Weibull(this);
  }
}

export class Probability implements Generator, Maskable, Quantizable, Accumulatable {
  generators: ProbabilityGenerator[] = [
    new Uniform(),
    new Linear(),
    new Triangle(),
    new Exponential(),
    new Gaussian(),
    new Cauchy(),
    new Beta(),
    new Weibull(),
  ];
  selectedIndex = 0;
  private duration = 0;

  constructor(other?: Probability) {
    if (other) {
      this.selectedIndex = other.selectedIndex;
      this.generators = other.generators.map((generator) => generator.deepCopy());
    }
  }

  static loadFromXML(data: Element): Probability {
    const probability = new Probability();
    const nodes = data.getElements();
    let generatorIndex = 0;

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'selectedIndex':
          probability.selectedIndex = readInt(node);
          break;
        case 'probabilityGenerator': {
          const generator = loadProbabilityGeneratorFromXML(node);
          if (generator && generatorIndex < probability.generators.length) {
            probability.generators[generatorIndex] = generator;
          }
          generatorIndex += 1;
          break;
        }
      }
    }

    return probability;
  }

  initialize(duration: number): void {
    this.duration = duration;
  }

  getValue(time: number, rnd: JavaRandom): number {
    const generator = this.generators[this.selectedIndex] ?? this.generators[0]!;
    const localTime = this.duration !== 0 ? time / this.duration : 0;
    return generator.getValue(localTime, rnd);
  }

  getGenerators(): ProbabilityGenerator[] {
    return this.generators;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  setSelectedIndex(selectedIndex: number): void {
    this.selectedIndex = clamp(selectedIndex, 0, this.generators.length - 1);
  }

  getSelectedProbabilityGenerator(): ProbabilityGenerator {
    return this.generators[this.selectedIndex] ?? this.generators[0]!;
  }

  saveAsXML(): Element {
    const retVal = new Element('generator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.Probability');
    retVal.addElement(writeInt('selectedIndex', this.selectedIndex));
    for (const generator of this.generators) {
      retVal.addElement(generator.saveAsXML());
    }
    return retVal;
  }

  deepCopy(): Probability {
    return new Probability(this);
  }
}

export class GeneratorEntry {
  constructor(
    public generatorName: string,
    public generatorClass: new () => Generator,
  ) {}

  toString(): string {
    return this.generatorName;
  }

  createGenerator(): Generator {
    return new this.generatorClass();
  }
}

export class GeneratorRegistry {
  private static entries: GeneratorEntry[] | null = null;

  static getGeneratorEntries(): GeneratorEntry[] {
    if (this.entries === null) {
      this.entries = [
        new GeneratorEntry('Constant', Constant),
        new GeneratorEntry('Item List', ItemList),
        new GeneratorEntry('Segment', Segment),
        new GeneratorEntry('Random', Random),
        new GeneratorEntry('Probability', Probability),
        new GeneratorEntry('Oscillator', Oscillator),
      ];
    }

    return this.entries;
  }
}

function supportsMask(generator: Generator): boolean {
  return generator instanceof Oscillator || generator instanceof Probability;
}

function supportsQuantizer(generator: Generator): boolean {
  return generator instanceof Random
    || generator instanceof Oscillator
    || generator instanceof Segment
    || generator instanceof Probability;
}

function supportsAccumulator(generator: Generator): boolean {
  return generator instanceof Constant
    || generator instanceof Random
    || generator instanceof Oscillator
    || generator instanceof Segment
    || generator instanceof ItemList
    || generator instanceof Probability;
}

const GENERATOR_LOADERS: Record<string, (data: Element) => Generator> = {
  Constant: (data) => Constant.loadFromXML(data),
  ItemList: (data) => ItemList.loadFromXML(data),
  Segment: (data) => Segment.loadFromXML(data),
  Random: (data) => Random.loadFromXML(data),
  Probability: (data) => Probability.loadFromXML(data),
  Oscillator: (data) => Oscillator.loadFromXML(data),
};

const PROBABILITY_GENERATOR_LOADERS: Record<string, (data: Element) => ProbabilityGenerator> = {
  Uniform: (data) => Uniform.loadFromXML(data),
  Linear: (data) => Linear.loadFromXML(data),
  Triangle: (data) => Triangle.loadFromXML(data),
  Exponential: (data) => Exponential.loadFromXML(data),
  Gaussian: (data) => Gaussian.loadFromXML(data),
  Cauchy: (data) => Cauchy.loadFromXML(data),
  Beta: (data) => Beta.loadFromXML(data),
  Weibull: (data) => Weibull.loadFromXML(data),
};

export function loadGeneratorFromXML(data: Element): Generator | null {
  const type = shortClassName(data.getAttributeValue('type'));
  const loader = GENERATOR_LOADERS[type];
  return loader ? loader(data) : null;
}

export function loadProbabilityGeneratorFromXML(data: Element): ProbabilityGenerator | null {
  const type = shortClassName(data.getAttributeValue('type'));
  const loader = PROBABILITY_GENERATOR_LOADERS[type];
  return loader ? loader(data) : null;
}

export class Parameter {
  visible = true;
  generator: Generator | null = null;
  mask: Mask | null = null;
  quantizer: Quantizer | null = null;
  accumulator: Accumulator | null = null;
  name = '';

  constructor(other?: Parameter) {
    if (other) {
      this.visible = other.visible;
      this.generator = other.generator ? other.generator.deepCopy() : null;
      this.mask = other.mask ? new Mask(other.mask) : null;
      this.quantizer = other.quantizer ? new Quantizer(other.quantizer) : null;
      this.accumulator = other.accumulator ? new Accumulator(other.accumulator) : null;
      this.name = other.name;
    }
  }

  static create(generator: Generator): Parameter {
    const parameter = new Parameter();
    parameter.setGenerator(generator);
    return parameter;
  }

  static loadFromXML(data: Element): Parameter {
    const parameter = new Parameter();

    const visible = data.getAttributeValue('visible');
    if (visible !== null) {
      parameter.visible = visible.toLowerCase() === 'true';
    }

    const name = data.getAttributeValue('name');
    if (name !== null) {
      parameter.name = name;
    }

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'generator': {
          const generator = loadGeneratorFromXML(node);
          parameter.setGenerator(generator ?? new Constant());
          break;
        }
        case 'mask':
          parameter.mask = Mask.loadFromXML(node);
          break;
        case 'quantizer':
          parameter.quantizer = Quantizer.loadFromXML(node);
          break;
        case 'accumulator':
          parameter.accumulator = Accumulator.loadFromXML(node);
          break;
      }
    }

    if (!parameter.generator) {
      parameter.setGenerator(new Constant());
    }

    return parameter;
  }

  setGenerator(generator: Generator): void {
    this.generator = generator;

    if (supportsMask(generator)) {
      this.mask = this.mask ?? new Mask();
    } else {
      this.mask = null;
    }

    if (supportsQuantizer(generator)) {
      this.quantizer = this.quantizer ?? new Quantizer();
    } else {
      this.quantizer = null;
    }

    if (supportsAccumulator(generator)) {
      this.accumulator = this.accumulator ?? new Accumulator();
    } else {
      this.accumulator = null;
    }
  }

  getGenerator(): Generator | null {
    return this.generator;
  }

  setMask(mask: Mask | null): void {
    this.mask = mask;
  }

  getMask(): Mask | null {
    return this.mask;
  }

  setQuantizer(quantizer: Quantizer | null): void {
    this.quantizer = quantizer;
  }

  getQuantizer(): Quantizer | null {
    return this.quantizer;
  }

  setAccumulator(accumulator: Accumulator | null): void {
    this.accumulator = accumulator;
  }

  getAccumulator(): Accumulator | null {
    return this.accumulator;
  }

  setName(name: string): void {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  initialize(duration: number): void {
    this.generator?.initialize(duration);
    if (this.mask) {
      this.mask.duration = duration;
    }
    if (this.quantizer) {
      this.quantizer.duration = duration;
    }
    if (this.accumulator) {
      this.accumulator.duration = duration;
    }
  }

  getValue(time: number, rnd: JavaRandom): number {
    if (!this.generator) {
      return 0.0;
    }

    let value = this.generator.getValue(time, rnd);
    if (this.mask?.enabled) {
      value = this.mask.getValue(time, value);
    }
    if (this.quantizer?.enabled) {
      value = this.quantizer.getValue(time, value);
    }
    if (this.accumulator?.enabled) {
      value = this.accumulator.getValue(time, value);
    }
    return value;
  }

  saveAsXML(): Element {
    const retVal = new Element('parameter');
    retVal.setAttribute('visible', String(this.visible));
    retVal.setAttribute('name', this.name);

    if (this.generator) {
      retVal.addElement(this.generator.saveAsXML());
    }
    if (this.mask) {
      retVal.addElement(this.mask.saveAsXML());
    }
    if (this.quantizer) {
      retVal.addElement(this.quantizer.saveAsXML());
    }
    if (this.accumulator) {
      retVal.addElement(this.accumulator.saveAsXML());
    }

    return retVal;
  }

  deepCopy(): Parameter {
    return new Parameter(this);
  }
}

export class Field {
  parameters: Parameter[] = [];

  constructor(other?: Field | boolean) {
    if (other instanceof Field) {
      this.parameters = other.parameters.map((parameter) => new Parameter(parameter));
      return;
    }

    if (other !== false) {
      this.parameters.push(Parameter.create(new Constant()));
      this.parameters.push(Parameter.create(new Constant()));
      this.parameters.push(Parameter.create(new Constant()));
      this.parameters[0]!.name = 'Instrument ID';
      this.parameters[1]!.name = 'Start';
      this.parameters[2]!.name = 'Duration';
    }
  }

  static loadFromXML(data: Element): Field {
    const field = new Field(false);
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'parameter') {
        field.parameters.push(Parameter.loadFromXML(node));
      }
    }

    return field;
  }

  getSize(): number {
    return this.parameters.length;
  }

  getElementAt(index: number): Parameter {
    return this.parameters[index]!;
  }

  getParameter(index: number): Parameter {
    return this.parameters[index]!;
  }

  addParameterBefore(index: number, generator: Generator): void {
    this.parameters.splice(index, 0, Parameter.create(generator));
  }

  addParameterAfter(index: number, generator: Generator): void {
    this.parameters.splice(index + 1, 0, Parameter.create(generator));
  }

  removeParameter(index: number): Parameter | null {
    if (index < 0 || index >= this.parameters.length) {
      return null;
    }
    return this.parameters.splice(index, 1)[0] ?? null;
  }

  pushUp(index: number): void {
    if (index > 0 && index < this.parameters.length) {
      const value = this.parameters.splice(index, 1)[0]!;
      this.parameters.splice(index - 1, 0, value);
    }
  }

  pushDown(index: number): void {
    if (index >= 0 && index < this.parameters.length - 1) {
      const value = this.parameters.splice(index + 1, 1)[0]!;
      this.parameters.splice(index, 0, value);
    }
  }

  changeParameter(index: number, generator: Generator): void {
    if (index < 0 || index >= this.parameters.length) {
      return;
    }

    const oldParameter = this.parameters[index]!;
    const parameter = Parameter.create(generator);
    parameter.name = oldParameter.name;
    parameter.visible = oldParameter.visible;
    this.parameters[index] = parameter;
  }

  generateNotes(duration: number, rnd: JavaRandom): NoteList {
    const noteList = new NoteList();
    if (this.parameters.length === 0) {
      return noteList;
    }

    const parameter2 = this.getParameter(1);
    if (parameter2.generator instanceof Constant && parameter2.generator.value <= 0.0) {
      throw new Error('Error: JMask p2 Constant field must use value > 0.0.');
    }

    for (const parameter of this.parameters) {
      parameter.initialize(duration);
    }

    let xt = 0.0;
    const numFields = this.parameters.length;

    while (xt < duration) {
      const note = Note.createNote(numFields);

      let p1 = this.getParameter(0).getValue(xt, rnd);
      p1 = p1 < 1.0 ? 1.0 : roundTo(p1, 0);
      note.setPField(formatBlueNumber(p1), 1);
      note.setPField(formatBlueNumber(xt), 2);

      for (let index = 3; index < numFields + 1; index += 1) {
        const value = this.getParameter(index - 1).getValue(xt, rnd);
        if (index === 3 && value < 0) {
          note.setPField(formatBlueNumber(-value), index);
          note.setTied(true);
        } else {
          note.setPField(formatBlueNumber(value), index);
        }
      }

      const p2 = this.getParameter(1).getValue(xt, rnd);
      if (!Number.isFinite(p2) || p2 <= 0.0) {
        console.warn('[JMask] p2 <= 0; stopping generation to avoid an infinite loop.');
        break;
      }

      xt += p2;
      noteList.add(note);
    }

    return noteList;
  }

  saveAsXML(): Element {
    const retVal = new Element('field');
    for (const parameter of this.parameters) {
      retVal.addElement(parameter.saveAsXML());
    }
    return retVal;
  }

  deepCopy(): Field {
    return new Field(this);
  }
}

function isSnapshotObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadSnapshotIntoObject<T extends object>(target: T, snapshot: Record<string, unknown>): T {
  for (const [key, value] of Object.entries(snapshot)) {
    if (key === 'kind' || typeof value === 'function') {
      continue;
    }
    (target as Record<string, unknown>)[key] = loadJMaskSnapshotValue(value);
  }
  return target;
}

function loadParameterSnapshot(snapshot: Record<string, unknown>): Parameter {
  const parameter = new Parameter();

  const generatorSnapshot = snapshot.generator;
  if (generatorSnapshot !== undefined) {
    const generator = loadJMaskSnapshotValue(generatorSnapshot);
    if (generator && typeof generator === 'object') {
      parameter.setGenerator(generator as Generator);
    } else {
      parameter.setGenerator(new Constant());
    }
  } else {
    parameter.setGenerator(new Constant());
  }

  return loadSnapshotIntoObject(parameter, snapshot);
}

function loadFieldSnapshot(snapshot: Record<string, unknown>): Field {
  const field = new Field(false);
  return loadSnapshotIntoObject(field, snapshot);
}

function loadTablePointSnapshot(snapshot: Record<string, unknown>): TablePoint {
  return loadSnapshotIntoObject(new TablePoint(), snapshot);
}

function loadTableSnapshot(snapshot: Record<string, unknown>): Table {
  return loadSnapshotIntoObject(new Table(), snapshot);
}

function loadDoubleOrTableSnapshot(snapshot: Record<string, unknown>): DoubleOrTable {
  const value = typeof snapshot.value === 'number' ? snapshot.value : 0.0;
  return loadSnapshotIntoObject(new DoubleOrTable(value), snapshot);
}

function loadMaskSnapshot(snapshot: Record<string, unknown>): Mask {
  return loadSnapshotIntoObject(new Mask(), snapshot);
}

function loadQuantizerSnapshot(snapshot: Record<string, unknown>): Quantizer {
  return loadSnapshotIntoObject(new Quantizer(), snapshot);
}

function loadAccumulatorSnapshot(snapshot: Record<string, unknown>): Accumulator {
  return loadSnapshotIntoObject(new Accumulator(), snapshot);
}

function loadProbabilitySnapshot(snapshot: Record<string, unknown>): Probability {
  return loadSnapshotIntoObject(new Probability(), snapshot);
}

function loadGeneratorSnapshot(snapshot: Record<string, unknown>): Generator | null {
  const kind = typeof snapshot.kind === 'string' ? snapshot.kind : '';
  switch (kind) {
    case 'Constant':
      return loadSnapshotIntoObject(new Constant(), snapshot);
    case 'Random':
      return loadSnapshotIntoObject(new Random(), snapshot);
    case 'Oscillator':
      return loadSnapshotIntoObject(new Oscillator(), snapshot);
    case 'Segment':
      return loadSnapshotIntoObject(new Segment(), snapshot);
    case 'ItemList':
      return loadSnapshotIntoObject(new ItemList(), snapshot);
    case 'Probability':
      return loadProbabilitySnapshot(snapshot);
    default:
      return null;
  }
}

function loadProbabilityGeneratorSnapshot(snapshot: Record<string, unknown>): ProbabilityGenerator | null {
  const kind = typeof snapshot.kind === 'string' ? snapshot.kind : '';
  switch (kind) {
    case 'Uniform':
      return loadSnapshotIntoObject(new Uniform(), snapshot);
    case 'Linear':
      return loadSnapshotIntoObject(new Linear(), snapshot);
    case 'Triangle':
      return loadSnapshotIntoObject(new Triangle(), snapshot);
    case 'Exponential':
      return loadSnapshotIntoObject(new Exponential(), snapshot);
    case 'Gaussian':
      return loadSnapshotIntoObject(new Gaussian(), snapshot);
    case 'Cauchy':
      return loadSnapshotIntoObject(new Cauchy(), snapshot);
    case 'Beta':
      return loadSnapshotIntoObject(new Beta(), snapshot);
    case 'Weibull':
      return loadSnapshotIntoObject(new Weibull(), snapshot);
    default:
      return null;
  }
}

function loadJMaskSnapshotValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => loadJMaskSnapshotValue(entry));
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value;
  }
  if (valueType !== 'object') {
    return value;
  }

  const snapshot = value as Record<string, unknown>;
  const kind = typeof snapshot.kind === 'string' ? snapshot.kind : '';

  switch (kind) {
    case 'Field':
      return loadFieldSnapshot(snapshot);
    case 'Parameter':
      return loadParameterSnapshot(snapshot);
    case 'TablePoint':
      return loadTablePointSnapshot(snapshot);
    case 'Table':
      return loadTableSnapshot(snapshot);
    case 'DoubleOrTable':
      return loadDoubleOrTableSnapshot(snapshot);
    case 'Mask':
      return loadMaskSnapshot(snapshot);
    case 'Quantizer':
      return loadQuantizerSnapshot(snapshot);
    case 'Accumulator':
      return loadAccumulatorSnapshot(snapshot);
    case 'Probability':
      return loadProbabilitySnapshot(snapshot);
  }

  const generator = loadGeneratorSnapshot(snapshot);
  if (generator) {
    return generator;
  }

  const probabilityGenerator = loadProbabilityGeneratorSnapshot(snapshot);
  if (probabilityGenerator) {
    return probabilityGenerator;
  }

  const plainObject: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(snapshot)) {
    if (key === 'kind' || typeof childValue === 'function') {
      continue;
    }
    plainObject[key] = loadJMaskSnapshotValue(childValue);
  }
  if (kind) {
    plainObject.kind = kind;
  }
  return plainObject;
}

export function loadFieldFromSnapshot(snapshot: Record<string, unknown>): Field {
  return loadFieldSnapshot(snapshot);
}
