/**
 * TempoMap — manages tempo changes over time.
 * Mirrors the Java TempoMap class.
 *
 * Supports multiple TempoPoint entries with CONSTANT or LINEAR curves.
 * When disabled, always returns 60 BPM regardless of tempo points.
 */
import { CurveType, parseCurveType } from './curve-type';
import { TempoPoint } from './tempo-point';
import { Element } from '../serialization/xml-reader';
import { TimePosition } from './time-position';
import { TimeContext } from './time-context';

export class TempoMap {
  private points: TempoPoint[] = [new TempoPoint(undefined, 60, CurveType.CONSTANT)];
  private _enabled = false;
  private _visible = false;
  private listeners: Array<() => void> = [];

  /** Copy constructor. */
  constructor(source?: TempoMap) {
    if (source) {
      this._enabled = source._enabled;
      this._visible = source._visible;
      this.points = source.points.map((p) => {
        const np = new TempoPoint(p.position, p.tempo, p.curveType);
        np.enabled = p.enabled;
        np.visible = p.visible;
        np.beat = p.beat;
        np.accumulatedTime = p.accumulatedTime;
        return np;
      });
    }
  }

  // ─── Accessors ───

  /** Get tempo. With no args returns first point's tempo; with index returns that point's tempo. */
  getTempo(index?: number): number {
    if (index !== undefined) return this.points[index]?.tempo ?? 60;
    return this.points[0]?.tempo ?? 60;
  }

  setTempo(bpm: number): void {
    if (this.points.length === 1) {
      this.points[0].tempo = bpm;
      this.recalculateAccumulatedTimes();
    }
  }

  /** Get the beat position at a specific index. */
  getBeat(index: number): number {
    return this.points[index]?.beat ?? 0;
  }

  /** Get the curve type at a specific index. */
  getCurveType(index: number): CurveType {
    return this.points[index]?.curveType ?? CurveType.CONSTANT;
  }

  /** Get the tempo point at a specific index. Alias for getTempoPoint. */
  getPoint(index: number): TempoPoint {
    return this.points[index];
  }

  isEnabled(): boolean {
    return this._enabled;
  }
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.recalculateAccumulatedTimes();
    this.fireListeners();
  }

  isVisible(): boolean {
    return this._visible;
  }
  setVisible(visible: boolean): void {
    if (this._visible !== visible) {
      this._visible = visible;
      this.fireListeners();
    }
  }

  size(): number {
    return this.points.length;
  }

  getTempoPoints(): ReadonlyArray<TempoPoint> {
    return this.points;
  }

  getTempoPoint(index: number): TempoPoint {
    return this.points[index];
  }

  /** Add a tempo point, optionally with context for bar-based position resolution. */
  addTempoPoint(point: TempoPoint, context?: TimeContext): void {
    this.points.push(point);
    if (context) {
      this.recalculateBeatPositions(context);
    } else {
      this.recalculateAccumulatedTimes();
    }
    this.fireListeners();
  }

  /**
   * Set tempo point at index.
   * Overloads:
   * - setTempoPoint(index, point: TempoPoint)
   * - setTempoPoint(index, beat: number, tempo: number, curveType?: CurveType)
   * - setTempoPoint(index, position: TimePosition, tempo: number, curveType: CurveType, context: TimeContext)
   */
  setTempoPoint(index: number, ...args: any[]): void {
    if (args[0] instanceof TempoPoint) {
      this.points[index] = args[0];
      this.recalculateAccumulatedTimes();
    } else if (args[0] instanceof TimePosition) {
      const [position, tempo, curveType, context] = args;
      this.points[index] = new TempoPoint(position, tempo, curveType);
      this.recalculateBeatPositions(context);
    } else if (typeof args[0] === 'number') {
      const beat = args[0];
      const tempo = args[1];
      const curveType = args[2] ?? CurveType.CONSTANT;
      const point = new TempoPoint(beat, tempo, curveType);
      this.points[index] = point;
      this.recalculateAccumulatedTimes();
    }
    this.fireListeners();
  }

  removeTempoPoint(index: number): void {
    if (this.points.length <= 1) {
      throw new Error('Cannot remove the last tempo point');
    }
    this.points.splice(index, 1);
    this.recalculateAccumulatedTimes();
    this.fireListeners();
  }

  /** Reset to single default point (60 BPM at beat 0). */
  reset(): void {
    this.points = [new TempoPoint(undefined, 60, CurveType.CONSTANT)];
    this.recalculateAccumulatedTimes();
    this.fireListeners();
  }

  /** Replace all data from a source TempoMap. */
  replaceAll(source: TempoMap): void {
    this._enabled = source._enabled;
    this._visible = source._visible;
    this.points = source.points.map((p) => {
      const np = new TempoPoint(p.position, p.tempo, p.curveType);
      np.enabled = p.enabled;
      np.visible = p.visible;
      np.beat = p.beat;
      np.accumulatedTime = p.accumulatedTime;
      return np;
    });
    this.recalculateAccumulatedTimes();
    this.fireListeners();
  }

  addListener(listener: () => void): void {
    this.listeners.push(listener);
  }

  private fireListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // ─── Conversion ───

  getBeatDuration(): number {
    return 60.0 / this.getTempo();
  }

  /**
   * Get the tempo at a given beat position.
   * For CONSTANT curves, returns the tempo of the segment containing the beat.
   * For LINEAR curves, interpolates between points.
   */
  getTempoAt(beat: number): number {
    if (!this._enabled) return 60;

    // Find the segment containing this beat
    for (let i = this.points.length - 1; i >= 0; i--) {
      if (beat >= this.points[i].beat) {
        const point = this.points[i];
        // Beyond last point: constant tempo
        if (i >= this.points.length - 1) return point.tempo;
        // CONSTANT: use this point's tempo
        if (point.curveType === CurveType.CONSTANT) return point.tempo;
        // LINEAR: interpolate
        const nextPoint = this.points[i + 1];
        const segmentLength = nextPoint.beat - point.beat;
        if (segmentLength <= 0) return point.tempo;
        const fraction = (beat - point.beat) / segmentLength;
        return point.tempo + fraction * (nextPoint.tempo - point.tempo);
      }
    }
    return this.points[0].tempo;
  }

  /**
   * Convert beats to seconds.
   * For disabled maps: 1 beat = 1 second (60 BPM).
   * For enabled maps: accumulates time across segments with CONSTANT or LINEAR curves.
   */
  beatsToSeconds(beats: number): number {
    if (!this._enabled) return beats; // 60 BPM → 1 beat = 1 second

    // Find the segment containing this beat
    let segIndex = 0;
    for (let i = this.points.length - 1; i >= 0; i--) {
      if (beats >= this.points[i].beat) {
        segIndex = i;
        break;
      }
    }

    const point = this.points[segIndex];
    const accumulatedTime = point.accumulatedTime;

    // Beyond last point: extrapolate with constant tempo
    if (segIndex >= this.points.length - 1) {
      const deltaBeats = beats - point.beat;
      return accumulatedTime + deltaBeats * (60.0 / point.tempo);
    }

    const deltaBeats = beats - point.beat;
    const nextPoint = this.points[segIndex + 1];

    if (point.curveType === CurveType.CONSTANT) {
      return accumulatedTime + deltaBeats * (60.0 / point.tempo);
    }

    // LINEAR: compute area under curve
    // tempo(t) = t0 + (t1 - t0) * (x / deltaBeat)
    // integral = 60 * [ x / t(x) ] from 0 to deltaBeats
    // Using the formula: time = 60 * 2 * deltaBeats / (t0 + t1) for linear interpolation
    const t0 = point.tempo;
    const t1 = nextPoint.tempo;
    const segmentBeats = nextPoint.beat - point.beat;

    if (t0 === t1) {
      return accumulatedTime + deltaBeats * (60.0 / t0);
    }

    // Quadratic formula based on Istvan Varga's solution (April 2006)
    const factor1 = 60.0 / t0;
    const acceleration = (60.0 / t1 - factor1) / segmentBeats;
    return accumulatedTime + factor1 * deltaBeats + 0.5 * acceleration * deltaBeats * deltaBeats;
  }

  /**
   * Convert seconds to beats.
   * Reverse of beatsToSeconds.
   */
  secondsToBeats(seconds: number): number {
    if (!this._enabled) return seconds; // 60 BPM → 1 second = 1 beat

    // Find the segment containing this time
    let segIndex = 0;
    for (let i = this.points.length - 1; i >= 0; i--) {
      if (seconds >= this.points[i].accumulatedTime) {
        segIndex = i;
        break;
      }
    }

    const point = this.points[segIndex];
    const elapsed = seconds - point.accumulatedTime;

    // Beyond last point: extrapolate with constant tempo
    if (segIndex >= this.points.length - 1) {
      return point.beat + elapsed * (point.tempo / 60.0);
    }

    const nextPoint = this.points[segIndex + 1];

    if (point.curveType === CurveType.CONSTANT) {
      return point.beat + elapsed * (point.tempo / 60.0);
    }

    // LINEAR: quadratic formula
    const t0 = point.tempo;
    const t1 = nextPoint.tempo;
    const segmentBeats = nextPoint.beat - point.beat;

    if (t0 === t1) {
      return point.beat + elapsed * (t0 / 60.0);
    }

    const factor1 = 60.0 / t0;
    const acceleration = (60.0 / t1 - factor1) / segmentBeats;
    // time = factor1 * x + 0.5 * acceleration * x^2
    // Solve: 0.5 * a * x^2 + factor1 * x - elapsed = 0
    // x = (sqrt(factor1^2 + 2*a*elapsed) - factor1) / a
    const discriminant = factor1 * factor1 + 2 * acceleration * elapsed;
    if (acceleration === 0) {
      return point.beat + elapsed / factor1;
    }
    return point.beat + (Math.sqrt(Math.max(0, discriminant)) - factor1) / acceleration;
  }

  /**
   * Recompute cached beat positions and accumulated times for all points.
   */
  recalculateAccumulatedTimes(): void {
    if (this.points.length === 0) return;

    for (const point of this.points) {
      if (point.position.isBeatTime()) {
        point.beat = point.position.getValue();
      }
    }

    if (this.points.every((point) => point.position.isBeatTime())) {
      this.points.sort((a, b) => a.beat - b.beat);
    }

    this.points[0].accumulatedTime = 0;

    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1];
      const cur = this.points[i];

      // Only recompute beat from position if position is beat-based
      // (bar-based positions are resolved by recalculateBeatPositions)
      if (cur.position.isBeatTime()) {
        cur.beat = cur.position.getValue();
      }

      const deltaBeats = cur.beat - prev.beat;

      if (prev.curveType === CurveType.CONSTANT) {
        cur.accumulatedTime = prev.accumulatedTime + deltaBeats * (60.0 / prev.tempo);
      } else {
        // LINEAR
        const factor1 = 60.0 / prev.tempo;
        const acceleration = deltaBeats > 0 ? (60.0 / cur.tempo - factor1) / deltaBeats : 0;
        cur.accumulatedTime =
          prev.accumulatedTime +
          factor1 * deltaBeats +
          0.5 * acceleration * deltaBeats * deltaBeats;
      }
    }
  }

  /**
   * Recalculate beat positions using a TimeContext for bar-based positions.
   * Points with bar-based positions (BBT, BBST, BBF) are converted to beats
   * using the context's MeterMap before recalculating accumulated times.
   */
  recalculateBeatPositions(context: TimeContext): void {
    if (this.points.length === 0) return;

    for (const point of this.points) {
      if (point.position && !point.position.isBeatTime()) {
        // Bar-based position: convert to beats
        point.beat = point.position.toBeats(context);
      }
    }

    this.points.sort((a, b) => a.beat - b.beat);

    this.recalculateAccumulatedTimes();
  }

  /**
   * Parse a legacy tempo map string format: "0 60 4 120 8 90"
   * Each pair is beat-position, tempo-BPM.
   */
  static createTempoMap(text: string): TempoMap | null {
    const tokens = text.trim().split(/\s+/);
    if (tokens.length < 2) return null;
    if (tokens.length % 2 !== 0) return null;

    const map = new TempoMap();
    map.points = [];
    map._enabled = true;

    for (let i = 0; i < tokens.length; i += 2) {
      const beat = parseFloat(tokens[i]);
      const tempo = parseFloat(tokens[i + 1]);

      if (isNaN(beat) || isNaN(tempo)) return null;
      if (beat < 0) return null;
      if (tempo <= 0) return null;

      const point = new TempoPoint(beat, tempo, CurveType.LINEAR);
      map.points.push(point);
    }

    map.recalculateAccumulatedTimes();
    return map;
  }

  equals(other: TempoMap): boolean {
    if (this._enabled !== other._enabled) return false;
    if (this.points.length !== other.points.length) return false;
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i].tempo !== other.points[i].tempo) return false;
      if (this.points[i].beat !== other.points[i].beat) return false;
      if (this.points[i].curveType !== other.points[i].curveType) return false;
    }
    return true;
  }

  // ─── XML Serialization ───

  saveAsXML(): Element {
    const elem = new Element('tempoMap');
    elem.addElement('enabled').setText(this._enabled.toString());
    elem.addElement('visible').setText(this._visible.toString());

    for (const point of this.points) {
      elem.addElement(point.saveAsXML());
    }

    return elem;
  }

  static loadFromXML(data: Element): TempoMap {
    const map = new TempoMap();

    const enabled = data.getTextString('enabled');
    if (enabled !== null) map._enabled = enabled !== 'false';

    const visible = data.getTextString('visible');
    if (visible !== null) map._visible = visible === 'true';

    const points = data.getElements('tempoPoint');
    if (points.hasMoreElements()) {
      map.points = [];
      while (points.hasMoreElements()) {
        const point = TempoPoint.loadFromXML(points.next());
        map.points.push(point);
      }
    }

    // Also check legacy beatTempoPair format (only if no tempoPoint elements were found)
    const legacyPoints = data.getElements('beatTempoPair');
    const hasTempoPoints =
      map.points.length !== 1 || map.points[0].tempo !== 60 || map.points[0].beat !== 0;
    if (legacyPoints.hasMoreElements() && !hasTempoPoints) {
      map.points = [];
      while (legacyPoints.hasMoreElements()) {
        const pairElem = legacyPoints.next();
        const beat = parseFloat(pairElem.getAttribute('beat') ?? '0');
        const tempo = parseFloat(pairElem.getAttribute('tempo') ?? '60');
        const point = new TempoPoint(beat, tempo, CurveType.LINEAR);
        map.points.push(point);
      }
    }

    if (map.points.length === 0) {
      map.points = [new TempoPoint(undefined, 60, CurveType.CONSTANT)];
    }

    map.recalculateAccumulatedTimes();
    return map;
  }
}
