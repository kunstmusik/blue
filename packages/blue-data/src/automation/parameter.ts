/**
 * Parameter — an automation parameter with points and curve type.
 * Mirrors the Java Parameter class: values and points stay binary64 doubles,
 * while the resolution is an exact Java-compatible decimal (the `bdresolution`
 * BigDecimal in Java Blue). Linear evaluation reproduces Java
 * `Line.getValue(double)` bit-for-bit, including early returns, duplicate-time
 * selection, the descending bias, and exact positive-resolution quantization.
 */
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';
import { generatePrefixedUuid } from '../utilities/uuid';
import {
  JavaDecimal,
  javaDecimalIsQuantizationActive,
  normalizeLegacyResolution,
  parseJavaDecimal,
  quantizeToResolutionJava,
  snapToResolutionJava,
} from './java-decimal';

export interface AutomationPoint {
  time: number;
  value: number;
}

export enum AutomationCurve {
  STEP = 'STEP',
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
}

/** Raised when parameter XML carries a resolution that Java would reject. */
export class ParameterResolutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ParameterResolutionError';
    this.code = code;
  }
}

/** The Java default resolution: exact decimal -1 (unquantized). */
export function defaultResolutionDecimal(): JavaDecimal {
  const parsed = parseJavaDecimal('-1');
  if (!parsed.ok) {
    throw new Error('default resolution failed to parse');
  }
  return parsed.value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function rescale(
  value: number,
  oldMinimum: number,
  oldMaximum: number,
  newMinimum: number,
  newMaximum: number,
  resolution: JavaDecimal,
): number {
  if (oldMaximum === oldMinimum) {
    return snapToResolutionJava(newMinimum, newMinimum, newMaximum, resolution);
  }

  const normalized = (value - oldMinimum) / (oldMaximum - oldMinimum);
  const nextValue = newMinimum + (normalized * (newMaximum - newMinimum));
  return snapToResolutionJava(nextValue, newMinimum, newMaximum, resolution);
}

export class Parameter implements BlueDataObject {
  private _uniqueId = Parameter.generateUniqueId();
  private _name = '';
  private _label = '';
  private _minimum = 0;
  private _maximum = 1;
  private _curve: AutomationCurve = AutomationCurve.LINEAR;
  private _points: AutomationPoint[] = [];
  private _enabled = false;
  private _resolution: JavaDecimal = defaultResolutionDecimal();
  private _compilationVarName: string | null = null;
  private _fixedValue = 0;
  private _lineColor = -8355712;

  private static generateUniqueId(): string {
    return generatePrefixedUuid('param');
  }

  private static formatDouble(v: number): string {
    const s = v.toString();
    if (s.includes('.') || s.includes('e') || s.includes('E')) return s;
    return s + '.0';
  }

  getName(): string { return this._name; }
  setName(name: string): void { this._name = name; }

  getUniqueId(): string { return this._uniqueId; }
  setUniqueId(id: string): void { this._uniqueId = id; }

  getLabel(): string { return this._label; }
  setLabel(label: string): void { this._label = label; }

  getMinimum(): number { return this._minimum; }
  setMinimum(v: number, truncate = false): void {
    if (this._minimum === v) {
      return;
    }

    const oldMinimum = this._minimum;
    this._minimum = v;

    this._points = this._points.map((point) => ({
      ...point,
      value: truncate
        ? snapToResolutionJava(clamp(point.value, this._minimum, this._maximum), this._minimum, this._maximum, this._resolution)
        : rescale(point.value, oldMinimum, this._maximum, this._minimum, this._maximum, this._resolution),
    }));

    this._fixedValue = truncate
      ? snapToResolutionJava(clamp(this._fixedValue, this._minimum, this._maximum), this._minimum, this._maximum, this._resolution)
      : rescale(this._fixedValue, oldMinimum, this._maximum, this._minimum, this._maximum, this._resolution);
  }

  getMaximum(): number { return this._maximum; }
  setMaximum(v: number, truncate = false): void {
    if (this._maximum === v) {
      return;
    }

    const oldMaximum = this._maximum;
    this._maximum = v;

    this._points = this._points.map((point) => ({
      ...point,
      value: truncate
        ? snapToResolutionJava(clamp(point.value, this._minimum, this._maximum), this._minimum, this._maximum, this._resolution)
        : rescale(point.value, this._minimum, oldMaximum, this._minimum, this._maximum, this._resolution),
    }));

    this._fixedValue = truncate
      ? snapToResolutionJava(clamp(this._fixedValue, this._minimum, this._maximum), this._minimum, this._maximum, this._resolution)
      : rescale(this._fixedValue, this._minimum, oldMaximum, this._minimum, this._maximum, this._resolution);
  }

  getCurve(): AutomationCurve { return this._curve; }
  setCurve(c: AutomationCurve): void { this._curve = c; }

  getPoints(): AutomationPoint[] { return [...this._points]; }
  setPoints(points: AutomationPoint[]): void { this._points = [...points]; }

  addPoint(time: number, value: number): void {
    this._points.push({ time, value });
    this._points.sort((a, b) => a.time - b.time);
  }

  isEnabled(): boolean { return this._enabled; }
  setEnabled(e: boolean): void { this._enabled = e; }

  /**
   * Set automation enabled state.
   */
  setAutomationEnabled(e: boolean): void { this._enabled = e; }

  /**
   * The exact resolution as a Java-compatible decimal. This is the sole
   * quantization selector; `0.1` and `0.10` are distinct resolutions.
   */
  getResolutionDecimal(): JavaDecimal { return this._resolution; }

  /**
   * Sets the exact resolution. Mirrors Java Parameter.setResolution: the
   * nested line receives the resolution and every point snaps to the grid
   * (clamped to the parameter bounds) exactly as LineUtils.snapToResolution
   * does in Java Blue.
   */
  setResolutionDecimal(resolution: JavaDecimal): void {
    this._resolution = resolution;
    this._points = this._points.map((point) => ({
      ...point,
      value: snapToResolutionJava(point.value, this._minimum, this._maximum, resolution),
    }));
  }

  /**
   * Derived numeric projection of the exact resolution (Java
   * `BigDecimal.doubleValue()`). Display/preview only; it is never the
   * authority for evaluation or persistence.
   */
  getResolution(): number { return this._resolution.doubleValue; }

  /**
   * Legacy numeric setter retained for callers that only have a double:
   * applies Java's legacy normalization (exact construction, scale-5
   * HALF_UP, strip trailing zeros) so no double-only conversion becomes the
   * source of truth.
   */
  setResolution(r: number): void {
    const normalized = normalizeLegacyResolution(r);
    if (normalized.ok) {
      this.setResolutionDecimal(normalized.value);
    }
  }

  /** Canonical Java BigDecimal.toString() text of the exact resolution. */
  getResolutionText(): string { return this._resolution.canonicalText; }

  /**
   * Parses canonical decimal text as the exact resolution. Throws
   * ParameterResolutionError when the text is not accepted by the Java
   * BigDecimal(String) grammar.
   */
  setResolutionText(text: string): void {
    const parsed = parseJavaDecimal(text);
    if (!parsed.ok) {
      throw new ParameterResolutionError(parsed.code, parsed.message);
    }
    this.setResolutionDecimal(parsed.value);
  }

  getCompilationVarName(): string | null { return this._compilationVarName; }
  setCompilationVarName(name: string): void { this._compilationVarName = name; }

  /**
   * Fixed value for non-automated parameters.
   */
  getFixedValue(): number { return this._fixedValue; }
  setFixedValue(v: number): void { this._fixedValue = v; }

  getLineColor(): number { return this._lineColor; }
  setLineColor(c: number): void { this._lineColor = c; }

  /**
   * Check if this parameter has automation enabled (has points).
   */
  isAutomationEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Value at a specific time. Automated parameters evaluate the Java
   * `Line.getValue(double)` sequence (bit-exact for the LINEAR curve);
   * non-automated parameters return the fixed value, matching Java
   * Parameter.getValue(time).
   */
  getValue(time: number): number {
    if (!this.isAutomationEnabled()) {
      return this._fixedValue;
    }
    if (this._curve === AutomationCurve.LINEAR) {
      return this.evaluateJavaLinear(time);
    }
    return this.evaluateExtensionCurve(time);
  }

  /**
   * Java blue.components.lines.Line.getValue(double), reproduced exactly:
   * early returns for the empty line, single points, and time zero; direct
   * point hits with last-of-run duplicate selection; last-point behavior
   * beyond the line; the Java double operation order for interpolation; the
   * descending bias; and exact positive-resolution quantization.
   */
  private evaluateJavaLinear(time: number): number {
    const points = this._points;
    const size = points.length;
    if (size === 0) {
      return 0.0;
    }

    const first = points[0];
    // Java compares `time == 0.0f` widened to double: -0.0 also matches
    if (size === 1 || time === 0.0) {
      return first.value;
    }

    let aIndex = 0;
    let bIndex = -1;
    for (let i = 1; i < size; i++) {
      const candidate = points[i];
      if (candidate.time === time) {
        if (i === size - 1) {
          return candidate.value;
        }
        // last point of the same-time run wins
        while (i < size) {
          const temp = points[i];
          if (temp.time !== time) {
            break;
          }
          bIndex = i;
          i++;
        }
        return points[bIndex].value;
      }
      if (candidate.time < time) {
        aIndex = i;
      } else {
        bIndex = i;
        break;
      }
    }
    if (bIndex === -1) {
      // time is at or beyond the last point (Java: b == a after the loop)
      return points[size - 1].value;
    }
    if (bIndex === aIndex) {
      return points[bIndex].value;
    }

    const a = points[aIndex];
    const b = points[bIndex];
    const m = (b.value - a.value) / (b.time - a.time);
    const x = time - a.time;
    let y = m * x + a.value;

    if (javaDecimalIsQuantizationActive(this._resolution)) {
      if (b.value < a.value) {
        y += this._resolution.doubleValue * 0.99;
      }
      const quantized = quantizeToResolutionJava(y, this._resolution);
      if (quantized !== null) {
        y = quantized;
      }
    }
    return y;
  }

  /**
   * STEP and EXPONENTIAL curves are Blue extensions without a Java Line
   * equivalent: only their quantization stage claims Java parity. The
   * calculation keeps its pre-feature formula on the Java-selected segment
   * and then applies the exact quantizer when the resolution is active.
   */
  private evaluateExtensionCurve(time: number): number {
    const points = this._points;
    const size = points.length;
    if (size === 0) return 0.0;
    if (size === 1 || time === 0.0) return points[0].value;

    let aIndex = 0;
    let bIndex = -1;
    for (let i = 1; i < size; i++) {
      const candidate = points[i];
      if (candidate.time === time) {
        if (i === size - 1) return candidate.value;
        while (i < size) {
          const temp = points[i];
          if (temp.time !== time) break;
          bIndex = i;
          i++;
        }
        return points[bIndex].value;
      }
      if (candidate.time < time) {
        aIndex = i;
      } else {
        bIndex = i;
        break;
      }
    }
    if (bIndex === -1) return points[size - 1].value;
    if (bIndex === aIndex) return points[bIndex].value;

    const a = points[aIndex];
    const b = points[bIndex];
    let y: number;
    if (this._curve === AutomationCurve.STEP) {
      y = time < b.time ? a.value : b.value;
    } else {
      const t = (time - a.time) / (b.time - a.time);
      const v1 = Math.max(a.value, 0.0001);
      const v2 = Math.max(b.value, 0.0001);
      y = v1 * Math.pow(v2 / v1, t);
    }

    if (javaDecimalIsQuantizationActive(this._resolution)) {
      if (b.value < a.value) {
        y += this._resolution.doubleValue * 0.99;
      }
      const quantized = quantizeToResolutionJava(y, this._resolution);
      if (quantized !== null) {
        y = quantized;
      }
    }
    return y;
  }

  saveAsXML(): Element {
    const elem = new Element('parameter');
    elem.setAttribute('uniqueId', this._uniqueId);
    elem.setAttribute('name', this._name);
    elem.setAttribute('label', this._label);
    elem.setAttribute('min', Parameter.formatDouble(this._minimum));
    elem.setAttribute('max', Parameter.formatDouble(this._maximum));
    elem.setAttribute('bdresolution', this._resolution.canonicalText);
    elem.setAttribute('curve', this._curve);
    elem.setAttribute('automationEnabled', this._enabled.toString());
    elem.setAttribute('value', Parameter.formatDouble(this._fixedValue));

    const lineElem = elem.addElement('line');
    lineElem.setAttribute('name', '');
    lineElem.setAttribute('version', '2');
    lineElem.setAttribute('max', Parameter.formatDouble(this._maximum));
    lineElem.setAttribute('min', Parameter.formatDouble(this._minimum));
    lineElem.setAttribute('bdresolution', this._resolution.canonicalText);
    lineElem.setAttribute('color', this._lineColor.toString());
    lineElem.setAttribute('rightBound', 'false');
    lineElem.setAttribute('endPointsLinked', 'false');

    for (const pt of this._points) {
      const ptElem = lineElem.addElement('linePoint');
      ptElem.setAttribute('x', Parameter.formatDouble(pt.time));
      ptElem.setAttribute('y', Parameter.formatDouble(pt.value));
    }

    return elem;
  }

  static loadFromXML(data: Element): Parameter {
    const param = new Parameter();
    const uid = data.getAttribute('uniqueId');
    if (uid) param._uniqueId = uid;
    param._name = data.getAttribute('name') ?? '';
    param._label = data.getAttribute('label') ?? '';

    const curve = data.getAttribute('curve');
    if (curve && Object.values(AutomationCurve).includes(curve as AutomationCurve)) {
      param._curve = curve as AutomationCurve;
    }

    const min = data.getAttribute('min');
    if (min) param._minimum = parseFloat(min);

    const max = data.getAttribute('max');
    if (max) param._maximum = parseFloat(max);

    // Java load precedence: the legacy double attribute normalizes through
    // new BigDecimal(double).setScale(5, HALF_UP).stripTrailingZeros(), then
    // bdresolution overrides it exactly. Malformed decimals fail the load
    // without installing a partially parsed resolution.
    const legacyResolution = data.getAttribute('resolution');
    if (legacyResolution) {
      const normalized = normalizeLegacyResolution(parseFloat(legacyResolution));
      if (normalized.ok) {
        param._resolution = normalized.value;
      } else {
        throw new ParameterResolutionError(normalized.code, normalized.message);
      }
    }

    const bdResolution = data.getAttribute('bdresolution');
    if (bdResolution) {
      const parsed = parseJavaDecimal(bdResolution);
      if (!parsed.ok) {
        throw new ParameterResolutionError(parsed.code, parsed.message);
      }
      param._resolution = parsed.value;
    }

    const automationEnabled = data.getAttribute('automationEnabled');
    if (automationEnabled !== null) {
      param._enabled = automationEnabled === 'true';
    } else {
      param._enabled = data.getAttribute('enabled') === 'true';
    }

    const fixedValue = data.getAttribute('value');
    if (fixedValue !== null) {
      param._fixedValue = parseFloat(fixedValue);
    }

    // compatibility-only legacy children: read and ignored (no behavior,
    // not saved, not copied)
    data.getTextString('resolutionScale');
    data.getTextString('highPrecision');

    const lineNode = data.getElement('line');
    if (lineNode) {
      const lineColor = lineNode.getAttribute('color');
      if (lineColor !== null && lineColor !== undefined) {
        param._lineColor = parseInt(lineColor, 10);
      }

      const curveType = lineNode.getAttribute('curveType');
      if (curveType === 'CONSTANT') {
        param._curve = AutomationCurve.STEP;
      } else if (curveType === 'LINEAR') {
        param._curve = AutomationCurve.LINEAR;
      } else if (curveType === 'EXPONENTIAL') {
        param._curve = AutomationCurve.EXPONENTIAL;
      }

      const linePoints = lineNode.getElements('linePoint');
      while (linePoints.hasMoreElements()) {
        const pt = linePoints.next();
        param._points.push({
          time: parseFloat(pt.getAttribute('x') ?? '0'),
          value: parseFloat(pt.getAttribute('y') ?? '0'),
        });
      }
    }

    const pointsNode = data.getElement('points');
    if (pointsNode) {
      const pts = pointsNode.getElements('point');
      while (pts.hasMoreElements()) {
        const pt = pts.next();
        param._points.push({
          time: parseFloat(pt.getAttribute('time') ?? '0'),
          value: parseFloat(pt.getAttribute('value') ?? '0'),
        });
      }
    }

    param._points.sort((a, b) => a.time - b.time);

    // Java Parameter.loadFromXML synchronizes the parameter-owned resolution
    // to the nested line (reference-unequal by construction), which snaps
    // every point against the line bounds exactly as Line.setResolution does
    if (lineNode) {
      const lineMinimum = parseFloat(lineNode.getAttribute('min') ?? '0');
      const lineMaximum = parseFloat(lineNode.getAttribute('max') ?? '1');
      param._points = param._points.map((point) => ({
        ...point,
        value: snapToResolutionJava(point.value, lineMinimum, lineMaximum, param._resolution),
      }));
    }

    if (fixedValue === null && param._points.length > 0) {
      param._fixedValue = param._points[0].value;
    }

    return param;
  }

  deepCopy(): BlueDataObject {
    const copy = new Parameter();
    copy._name = this._name;
    copy._label = this._label;
    copy._minimum = this._minimum;
    copy._maximum = this._maximum;
    copy._curve = this._curve;
    copy._points = this._points.map((point) => ({ ...point }));
    copy._enabled = this._enabled;
    copy._resolution = this._resolution;
    copy._compilationVarName = this._compilationVarName;
    copy._fixedValue = this._fixedValue;
    copy._lineColor = this._lineColor;
    return copy;
  }
}
