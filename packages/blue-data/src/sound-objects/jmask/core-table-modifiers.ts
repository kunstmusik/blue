import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import {
  writeBoolean,
  writeDouble,
  writeInt,
  readBoolean,
  readDouble,
  readInt,
} from '../../utilities/xml';
import { clamp } from '../../utilities/math-utils';
import { validateJmaskXml } from './xml-policy';

const TWO_POW_53 = 9007199254740992;
const JAVA_MULTIPLIER = 0x5deece66dn;
const JAVA_ADDEND = 0xbn;
const JAVA_MASK = (1n << 48n) - 1n;

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function rescale(
  value: number,
  oldMin: number,
  oldMax: number,
  newMin: number,
  newMax: number,
): number {
  if (oldMax === oldMin) {
    return newMin;
  }
  const normalized = (value - oldMin) / (oldMax - oldMin);
  return newMin + normalized * (newMax - newMin);
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

export function remainder(value: number, mod: number): number {
  if (mod === 0) return 0;
  let shifted = value % mod;
  if (shifted < 0) shifted += mod;
  return shifted;
}

/** Java-compatible deterministic random stream for JMask generators. */
export class JavaRandom {
  private _seed = 0n;

  constructor(seed: number | bigint = Date.now()) {
    this.setSeed(seed);
  }

  /** Sets the pseudo-random seed. */
  setSeed(seed: number | bigint): void {
    this._seed =
      ((typeof seed === 'bigint' ? seed : BigInt(Math.trunc(seed))) ^ JAVA_MULTIPLIER) & JAVA_MASK;
  }

  private next(bits: number): number {
    this._seed = (this._seed * JAVA_MULTIPLIER + JAVA_ADDEND) & JAVA_MASK;
    return Number(this._seed >> BigInt(48 - bits));
  }

  /** Draws a Java-compatible pseudorandom number in the half-open interval from zero to one. */
  nextDouble(): number {
    const high = this.next(26);
    const low = this.next(27);
    return (high * 134217728 + low) / TWO_POW_53;
  }
}

/** Mode that controls how JMask generates note timing. */
export type JMaskGenerationMode = 1 | 2;

/** JMask value source with initialization, sampling, persistence, and copying. */
export interface Generator {
  /** Prepares the generator for the supplied generation duration. */
  initialize(duration: number): void;
  /** Samples a value at the supplied time using the shared random stream when needed. */
  getValue(time: number, rnd: JavaRandom): number;
  /** Serializes the generator and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element;
  /** Copies the generator and its editable state. */
  deepCopy(): Generator;
}

export interface Maskable {}
export interface Quantizable {}
export interface Accumulatable {}

export interface ProbabilityGenerator extends Generator {
  getName(): string;
  deepCopy(): ProbabilityGenerator;
}

/** One editable time/value point in a JMask control table. */
export class TablePoint {
  /** Time coordinate in the table's authored domain. */
  time = 0.0;
  /** Control value at the point's time coordinate. */
  value = 0.5;

  constructor(other?: TablePoint) {
    if (other) {
      this.time = other.time;
      this.value = other.value;
    }
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): TablePoint {
    validateJmaskXml(data, 'TablePoint', context);
    const point = new TablePoint();
    point.time = parseFloat(data.getAttributeValue('time') ?? '0');
    point.value = parseFloat(data.getAttributeValue('value') ?? '0.5');
    return point;
  }

  /** Serializes the table point and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const elem = new Element('point');
    elem.setAttribute('time', String(this.time));
    elem.setAttribute('value', String(this.value));
    return elem;
  }

  /** Returns the authored time coordinate. */
  getTime(): number {
    return this.time;
  }

  /** Changes the authored time coordinate. */
  setTime(time: number): void {
    this.time = time;
  }

  /** Returns the value stored at this point. */
  getValue(): number {
    return this.value;
  }

  /** Changes the value stored at this point. */
  setValue(value: number): void {
    this.value = value;
  }

  /** Changes both the time coordinate and control value. */
  setLocation(time: number, value: number): void {
    this.time = time;
    this.value = value;
  }
}

interface TableCache {
  pointsRef: TablePoint[];
  rawTimes: Float64Array;
  rawValues: Float64Array;
  interpolationType: number;
  interpolation: number;
  sorted: Array<Readonly<Pick<TablePoint, 'time' | 'value'>>>;
  prefixPhs: Float64Array;
  frequencyIntegral?: { prefix: Float64Array; origin: number };
}

const tableCaches = new WeakMap<Table, TableCache>();
const generationTables = new WeakSet<Table>();

/** Editable time/value curve used by JMask generators and modifiers. */
export class Table {
  static readonly OFF = 0;
  static readonly ON = 1;
  static readonly COS = 2;
  static readonly TYPES = ['Off', 'On', 'Cosine'];

  /** Control points belonging to this table, in stored order. */
  points: TablePoint[] = [];
  /** Lower bound used when editing table values. */
  min = 0.0;
  /** Upper bound used when editing table values. */
  max = 1.0;
  /** Selects stepped, shaped, or cosine interpolation. */
  interpolationType = Table.ON;
  /** Shaping control for the standard interpolation mode. Zero gives linear interpolation. */
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

  /** @internal Render-local view of prepared points, never exposed to editing callers. */
  prepareForGeneration(timeScale = 1): Table {
    const view = new Table(false);
    view.points = this.points;
    view.interpolationType = this.interpolationType;
    view.interpolation = this.interpolation;
    const cache = timeScale === 1 ? this.getOrBuildCache() : view.getOrBuildCache(timeScale);
    tableCaches.set(view, cache);
    generationTables.add(view);
    return view;
  }

  private getOrBuildCache(timeScale = 1): TableCache {
    const { points, interpolationType, interpolation } = this;
    const size = points.length;
    const cached = tableCaches.get(this);

    if (
      cached !== undefined &&
      cached.pointsRef === points &&
      cached.rawTimes.length === size &&
      cached.interpolationType === interpolationType &&
      Object.is(cached.interpolation, interpolation)
    ) {
      if (generationTables.has(this)) return cached;
      let valid = true;
      for (let i = 0; i < size; i += 1) {
        const pt = points[i]!;
        if (!Object.is(pt.time, cached.rawTimes[i]) || !Object.is(pt.value, cached.rawValues[i])) {
          valid = false;
          break;
        }
      }
      if (valid) {
        return cached;
      }
    }

    const rawTimes = new Float64Array(size);
    const rawValues = new Float64Array(size);
    let alreadySorted = true;
    for (let i = 0; i < size; i += 1) {
      const pt = points[i]!;
      rawTimes[i] = pt.time;
      rawValues[i] = pt.value;
      if (i > 0 && pt.time * timeScale < rawTimes[i - 1]! * timeScale) {
        alreadySorted = false;
      }
    }

    const sorted = points.map(({ time, value }) => ({ time: time * timeScale, value }));
    if (!alreadySorted) sorted.sort((left, right) => left.time - right.time);

    const prefixPhs = new Float64Array(Math.max(1, size));
    let running = 0.0;
    if (interpolationType !== Table.OFF) {
      const pw2 = Math.pow(2, interpolation);
      for (let k = 0; k < size - 1; k += 1) {
        const p0 = sorted[k]!;
        const p1 = sorted[k + 1]!;
        const dx = p1.time - p0.time;
        running += this.integrateSegment(dx, dx, p0.value, p1.value, pw2);
        prefixPhs[k + 1] = running;
      }
    } else {
      for (let k = 0; k < size - 1; k += 1) {
        const p0 = sorted[k]!;
        const p1 = sorted[k + 1]!;
        running += p1.time * p0.value - p0.time * p0.value;
        prefixPhs[k + 1] = running;
      }
    }

    const nextCache: TableCache = {
      pointsRef: points,
      rawTimes,
      rawValues,
      interpolationType,
      interpolation,
      sorted,
      prefixPhs,
    };
    tableCaches.set(this, nextCache);
    return nextCache;
  }

  private interpolateValue(ex: number, r: number, a: number, b: number): number {
    if (ex === 0.0) {
      return a + r * (b - a);
    }
    if (ex > 0.0 && b >= a) {
      return a + Math.pow(r, ex + 1.0) * (b - a);
    }
    if (ex > 0.0 && b < a) {
      return b + Math.pow(1.0 - r, ex + 1.0) * (a - b);
    }
    if (ex < 0.0 && b >= a) {
      return b + Math.pow(1.0 - r, Math.abs(ex) + 1.0) * (a - b);
    }
    return a + Math.pow(r, Math.abs(ex) + 1.0) * (b - a);
  }

  private interpolateCosine(r: number, a: number, b: number): number {
    const cx = Math.cos(Math.PI * r + Math.PI) / 2.0 + 0.5;
    return a + cx * (b - a);
  }

  private integrateSegment(
    x1: number,
    xe: number,
    y1: number,
    y2: number,
    pw2 = Math.pow(2, this.interpolation),
  ): number {
    return x1 * y1 + (Math.pow(x1, 1.0 + pw2) * (y2 - y1)) / ((1.0 + pw2) * Math.pow(xe, pw2));
  }

  /** Returns the entry at the supplied index in the table’s points. */
  getPoint(index: number): TablePoint {
    return this.points[index]!;
  }

  /** Returns the live control point at the supplied zero-based index. */
  getTablePoint(index: number): TablePoint {
    return this.getPoint(index);
  }

  /** Inserts the supplied control point at the given zero-based position. */
  addPoint(index: number, point: TablePoint): void {
    this.points.splice(index, 0, point);
  }

  /** Removes the point at the supplied index if it exists. */
  removePoint(index: number): void {
    if (index >= 0 && index < this.points.length) {
      this.points.splice(index, 1);
    }
  }

  /** Removes the supplied point by identity if this table contains it. */
  removePointByPoint(selectedPoint: TablePoint): void {
    this.removePoint(this.points.indexOf(selectedPoint));
  }

  /** Returns the number of editable control points. */
  getRowCount(): number {
    return this.points.length;
  }

  /** Returns two columns, one for time and one for value. */
  getColumnCount(): number {
    return 2;
  }

  /** Returns the editor label for the time or value column. */
  getColumnName(columnIndex: number): string {
    return columnIndex === 0 ? 'Time' : 'Value';
  }

  /** Reads the time or value cell for the supplied point index. */
  getValueAt(rowIndex: number, columnIndex: number): number {
    const point = this.getPoint(rowIndex);
    return columnIndex === 0 ? point.time : point.value;
  }

  /** Edits a numeric editor cell while preserving the fixed endpoint times. */
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

  /** Returns the interpolation stored on the table. */
  getInterpolation(): number {
    return this.interpolation;
  }

  /** Sets the interpolation stored on the table. */
  setInterpolation(interpolation: number): void {
    this.interpolation = interpolation;
  }

  /** Returns the interpolation type stored on the table. */
  getInterpolationType(): number {
    return this.interpolationType;
  }

  /** Sets the interpolation type stored on the table. */
  setInterpolationType(interpolationType: number): void {
    this.interpolationType = interpolationType;
  }

  /** Returns the minimum random value. */
  getMin(): number {
    return this.min;
  }

  /** Sets the minimum random value. */
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

  /** Returns the maximum random value. */
  getMax(): number {
    return this.max;
  }

  /** Sets the maximum random value. */
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

  /** Samples the table at the supplied time, interpolating between control points. */
  getValue(time: number): number {
    const { sorted } = this.getOrBuildCache();
    const size = sorted.length;
    if (size === 0) {
      return 0.0;
    }

    if (size === 1 || time <= 0.0) {
      return sorted[0]!.value;
    }

    let lo = 0;
    let hi = size;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid]!.time <= time) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    if (lo >= 2 && sorted[lo - 1]!.time === time) {
      return sorted[lo - 1]!.value;
    }
    if (lo === size) {
      return sorted[size - 1]!.value;
    }

    const segIdx = lo === 0 ? 0 : lo - 1;
    const a = sorted[segIdx]!;
    const b = sorted[segIdx + 1]!;
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

  /** Area under the table's frequency curve from zero to time. */
  integrateFrequency(time: number): number {
    const cache = this.getOrBuildCache();
    const points = cache.sorted;
    if (points.length === 0) return 0;
    const first = points[0]!;
    if (Math.max(time, 0) <= first.time) return time * first.value;

    if (!cache.frequencyIntegral) {
      const prefix = new Float64Array(points.length);
      for (let index = 1; index < points.length; index++) {
        const start = points[index - 1]!;
        const end = points[index]!;
        const width = end.time - start.time;
        prefix[index] =
          prefix[index - 1]! + this.integrateFrequencySegment(width, width, start.value, end.value);
      }
      cache.frequencyIntegral = { prefix, origin: this.frequencyIntegralAt(0, points, prefix) };
    }

    const { prefix, origin } = cache.frequencyIntegral;
    return this.frequencyIntegralAt(time, points, prefix) - origin;
  }

  private frequencyIntegralAt(
    time: number,
    points: TableCache['sorted'],
    prefix: Float64Array,
  ): number {
    const first = points[0]!;
    if (time < first.time) return (time - first.time) * first.value;

    const lastIndex = points.length - 1;
    const last = points[lastIndex]!;
    if (time >= last.time) return prefix[lastIndex]! + (time - last.time) * last.value;

    let lo = 0;
    let hi = lastIndex;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (points[mid]!.time <= time) lo = mid;
      else hi = mid;
    }

    const start = points[lo]!;
    const end = points[hi]!;
    return (
      prefix[lo]! +
      this.integrateFrequencySegment(
        time - start.time,
        end.time - start.time,
        start.value,
        end.value,
      )
    );
  }

  private integrateFrequencySegment(
    elapsed: number,
    width: number,
    from: number,
    to: number,
  ): number {
    if (width === 0 || this.interpolationType === Table.OFF || from === to) return elapsed * from;

    const ratio = elapsed / width;
    let area: number;
    if (this.interpolationType === Table.COS) {
      area = (ratio - Math.sin(Math.PI * ratio) / Math.PI) / 2;
    } else {
      const integralPower = Math.abs(this.interpolation) + 2;
      const reversed =
        (this.interpolation > 0 && to < from) || (this.interpolation < 0 && to >= from);
      area = reversed
        ? ratio + ((1 - ratio) ** integralPower - 1) / integralPower
        : ratio ** integralPower / integralPower;
    }

    return elapsed * from + width * (to - from) * area;
  }

  /** Returns the legacy integrated phase for the requested table time. */
  getphs(xt: number): number {
    const xtr = roundTo(xt, 10);
    const { sorted, prefixPhs } = this.getOrBuildCache();
    const pointsSize = sorted.length;

    if (pointsSize === 0) {
      return 0.0;
    }
    if (pointsSize === 1) {
      return xtr * sorted[0]!.value;
    }
    if (xtr <= sorted[0]!.time) {
      const y0 = sorted[0]!.value;
      return sorted[0]!.time * y0 - xtr * y0;
    }

    let lo = 1;
    let hi = pointsSize;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid]!.time < xtr) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const index = lo;
    let phsum = prefixPhs[index - 1]!;

    if (this.interpolationType !== Table.OFF) {
      const pw2 = Math.pow(2, this.interpolation);
      const last = sorted[pointsSize - 1]!;
      if (xtr >= last.time) {
        phsum += xtr * last.value - last.time * last.value;
      } else {
        const prev = sorted[index - 1]!;
        const curr = sorted[index]!;
        phsum += this.integrateSegment(
          xtr - prev.time,
          curr.time - prev.time,
          prev.value,
          curr.value,
          pw2,
        );
      }
      return phsum;
    }

    const prev = sorted[index - 1]!;
    phsum += xtr * prev.value - prev.time * prev.value;
    return phsum;
  }

  /** Serializes the table and its persisted settings to a new Blue XML element. */
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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Table {
    validateJmaskXml(data, 'Table', context);
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

/** Remaps a generator output between lower and upper bounds with optional shaping. */
export class Mask {
  /** Constant upper bound used when the upper table is disabled. */
  high = 1.0;
  /** Constant lower bound used when the lower table is disabled. */
  low = 0.0;
  /** Shaping exponent for remapping values between the bounds. */
  mapValue = 0.0;
  /** Whether the upper bound is read from its table. */
  highTableEnabled = false;
  /** Whether the lower bound is read from its table. */
  lowTableEnabled = false;
  /** Time-varying upper bound for the remapped value. */
  highTable = new Table();
  /** Time-varying lower bound for the remapped value. */
  lowTable = new Table();
  /** Whether this mask participates in generation. */
  enabled = false;
  /** Total render duration used to scale table lookup time. */
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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Mask {
    validateJmaskXml(data, 'Mask', context);
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

  /** Serializes the mask and its persisted settings to a new Blue XML element. */
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

  /** Remaps the supplied value using bounds resolved at the current render time. */
  getValue(time: number, value: number): number {
    if (!this.enabled) {
      return value;
    }

    const localTime = this.duration !== 0 ? time / this.duration : 0;
    const localHigh = this.highTableEnabled ? this.highTable.getValue(localTime) : this.high;
    const localLow = this.lowTableEnabled ? this.lowTable.getValue(localTime) : this.low;
    return localLow + (localHigh - localLow) * this.mapValueToRange(value);
  }
}

/** Moves a generated value toward the nearest point on a numeric grid. */
export class Quantizer {
  /** Spacing between quantization grid points when its table is disabled. */
  gridSize = 1.0;
  /** Amount of quantization applied when its table is disabled. */
  strength = 1.0;
  /** Position of the grid origin when its table is disabled. */
  offset = 0.0;
  /** Whether the grid spacing is read from its table. */
  gridSizeTableEnabled = false;
  /** Whether the quantization strength is read from its table. */
  strengthTableEnabled = false;
  /** Whether the grid origin is read from its table. */
  offsetTableEnabled = false;
  /** Time-varying spacing between grid points. */
  gridSizeTable = new Table();
  /** Time-varying amount of quantization. */
  strengthTable = new Table();
  /** Time-varying grid origin. */
  offsetTable = new Table();
  /** Whether this quantizer participates in generation. */
  enabled = false;
  /** Total render duration used to scale table lookup time. */
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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Quantizer {
    validateJmaskXml(data, 'Quantizer', context);
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

  /** Serializes the quantizer and its persisted settings to a new Blue XML element. */
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

  /** Quantizes a generated value using the grid settings at the current render time. */
  getValue(time: number, value: number): number {
    if (!this.enabled) {
      return value;
    }

    const localTime = this.duration !== 0 ? time / this.duration : 0;
    const localGridSize = this.gridSizeTableEnabled
      ? this.gridSizeTable.getValue(localTime)
      : this.gridSize;
    const localStrength = this.strengthTableEnabled
      ? this.strengthTable.getValue(localTime)
      : this.strength;
    const localOffset = this.offsetTableEnabled
      ? this.offsetTable.getValue(localTime)
      : this.offset;

    if (localGridSize === 0) {
      return value;
    }

    const d = value - localOffset;
    const r = Math.floor((d + localGridSize / 2.0) / localGridSize);
    const err = d / localGridSize - r;
    return localOffset + (r + err * (1 - localStrength)) * localGridSize;
  }
}

/** Stateful JMask modifier that combines successive inputs and applies a bound policy. */
export class Accumulator {
  static readonly ON = 0;
  static readonly LIMIT = 1;
  static readonly MIRROR = 2;
  static readonly WRAP = 3;
  static readonly MODES = ['On', 'Limit', 'Mirror', 'Wrap'];

  /** Time-varying upper bound for the running value. */
  highTable = new Table();
  /** Time-varying lower bound for the running value. */
  lowTable = new Table();
  /** Whether the upper bound is read from its table. */
  highTableEnabled = false;
  /** Whether the lower bound is read from its table. */
  lowTableEnabled = false;
  /** Policy for handling accumulated values outside the configured bounds. */
  mode = Accumulator.ON;
  /** Constant lower bound used when the lower table is disabled. */
  low = 0.0;
  /** Constant upper bound used when the upper table is disabled. */
  high = 1.0;
  /** Value used to initialize the running state. */
  initialValue = 0.0;
  /** Whether this accumulator participates in generation. */
  enabled = false;
  /** Current accumulated value during generation. */
  runningValue = 0.0;
  /** Whether the current run has yet to process its first input. */
  firstTime = true;
  /** Total render duration used to scale table lookup time. */
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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Accumulator {
    validateJmaskXml(data, 'Accumulator', context);
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

  /** Serializes the accumulator and its persisted settings to a new Blue XML element. */
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

  /** Updates the running value for this event using the bounds and accumulation mode. */
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
