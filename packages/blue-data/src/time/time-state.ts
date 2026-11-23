/**
 * TimeState — holds the time display and editing state for a score.
 * Mirrors the Java TimeState class.
 *
 * Stores ruler display format (primary/secondary via TimeBase),
 * snap settings (via SnapValue), zoom level, row visibility,
 * and SMPTE frame rate.
 */
import { TimeBase } from './time-base';
import { SnapValueName, isValidSnapValueName, closestSnapValueMatch } from './snap-value';
import { Element } from '../serialization/xml-reader';
import {
  writeBoolean,
  readBoolean,
  writeDouble,
  writeInt,
  readInt,
  checkShape,
  readText,
  parseXmlNumber,
  parseXmlInteger,
  checkRoot,
} from '../utilities/xml';
import { XmlLoadContext, requireXmlValue, type XmlDiagnosticSink } from '../serialization/xml-load';

import { resolveSmpteRate, isValidSmpteFormat } from './smpte-timecode';

const CURRENT_FORMAT_VERSION = 2;

/** Score editor preferences for timeline rulers, snapping, visibility, zoom, and SMPTE labeling. */
export class TimeState {
  private snapEnabled = false;
  private snapValue: SnapValueName = 'BEAT';
  private timeDisplay: TimeBase = TimeBase.BEATS;
  private secondaryTimeDisplay: TimeBase = TimeBase.TIME;
  private secondaryRulerEnabled = false;
  private tempoRowVisible = true;
  private meterRowVisible = true;
  private markersRowVisible = true;
  private smpteFrameRate = 24.0;
  private smpteDropFrame = false;
  private zoomIterations = 0;
  private historicalRulerInterval: number | null = null;

  /** Creates the default editor state or copies the supplied state. */
  constructor(other?: TimeState) {
    if (other) {
      this.snapEnabled = other.snapEnabled;
      this.snapValue = other.snapValue;
      this.timeDisplay = other.timeDisplay;
      this.secondaryTimeDisplay = other.secondaryTimeDisplay;
      this.secondaryRulerEnabled = other.secondaryRulerEnabled;
      this.tempoRowVisible = other.tempoRowVisible;
      this.meterRowVisible = other.meterRowVisible;
      this.markersRowVisible = other.markersRowVisible;
      this.smpteFrameRate = other.smpteFrameRate;
      this.smpteDropFrame = other.smpteDropFrame;
      this.zoomIterations = other.zoomIterations;
      this.historicalRulerInterval = other.historicalRulerInterval;
    }
  }

  /** Returns the display scale in pixels per second. Zero zoom steps gives 100, and every 32 steps doubles it. */
  getPixelSecond(): number {
    return 100 * Math.exp(Math.log(2) * (this.zoomIterations / 32.0));
  }

  /** Reports whether score editing snaps to the configured grid. */
  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }
  /** Enables or disables grid snapping without changing the chosen grid interval. */
  setSnapEnabled(value: boolean): void {
    this.snapEnabled = value;
  }

  /** Returns the named musical grid interval used for snapping. */
  getSnapValue(): SnapValueName {
    return this.snapValue;
  }
  /** Selects the named musical grid interval used for snapping. */
  setSnapValue(value: SnapValueName): void {
    this.snapValue = value;
  }

  /** Returns the primary ruler's display unit. */
  getTimeDisplay(): TimeBase {
    return this.timeDisplay;
  }
  /** Sets the primary ruler's display unit without converting any stored positions. */
  setTimeDisplay(value: TimeBase): void {
    this.timeDisplay = value;
  }

  /** Returns the secondary ruler's display unit. */
  getSecondaryTimeDisplay(): TimeBase {
    return this.secondaryTimeDisplay;
  }
  /** Sets the secondary ruler's display unit independently of its visibility. */
  setSecondaryTimeDisplay(value: TimeBase): void {
    this.secondaryTimeDisplay = value;
  }

  /** Reports whether the secondary ruler is visible. */
  isSecondaryRulerEnabled(): boolean {
    return this.secondaryRulerEnabled;
  }
  /** Shows or hides the secondary ruler without changing its unit. */
  setSecondaryRulerEnabled(value: boolean): void {
    this.secondaryRulerEnabled = value;
  }

  /** Reports whether the tempo row is visible. */
  isTempoRowVisible(): boolean {
    return this.tempoRowVisible;
  }
  /** Shows or hides the tempo row without changing the tempo map. */
  setTempoRowVisible(value: boolean): void {
    this.tempoRowVisible = value;
  }

  /** Reports whether the meter row is visible. */
  isMeterRowVisible(): boolean {
    return this.meterRowVisible;
  }
  /** Shows or hides the meter row without changing the meter map. */
  setMeterRowVisible(value: boolean): void {
    this.meterRowVisible = value;
  }

  /** Reports whether the markers row is visible. */
  isMarkersRowVisible(): boolean {
    return this.markersRowVisible;
  }
  /** Shows or hides the markers row without changing project markers. */
  setMarkersRowVisible(value: boolean): void {
    this.markersRowVisible = value;
  }

  /** Returns the configured SMPTE timecode rate. */
  getSmpteFrameRate(): number {
    return this.smpteFrameRate;
  }
  /** Sets a supported SMPTE rate, clearing drop-frame mode if incompatible. Throws for an unsupported rate. */
  setSmpteFrameRate(value: number): void {
    if (!resolveSmpteRate(value)) throw new Error('Unsupported SMPTE rate');
    this.smpteFrameRate = value;
    if (!isValidSmpteFormat(value, this.smpteDropFrame)) this.smpteDropFrame = false;
  }

  /** Reports whether the SMPTE ruler uses drop-frame numbering. */
  isSmpteDropFrame(): boolean {
    return this.smpteDropFrame;
  }
  /** Sets drop-frame numbering. Throws if the requested format is incompatible with the current rate. */
  setSmpteDropFrame(value: boolean): void {
    if (!isValidSmpteFormat(this.smpteFrameRate, value))
      throw new Error('Unsupported SMPTE format');
    this.smpteDropFrame = value;
  }

  /** Returns the zoom step count relative to the default scale. */
  getZoomIterations(): number {
    return this.zoomIterations;
  }
  /** Sets the zoom step count relative to the default scale. */
  setZoomIterations(value: number): void {
    this.zoomIterations = value;
  }

  /** Zooms out by one step. */
  lowerPixelSecond(): void {
    this.zoomIterations--;
  }
  /** Zooms in by one step. */
  raisePixelSecond(): void {
    this.zoomIterations++;
  }

  // ─── XML Serialization ───

  /** Writes the current timeline display settings in the versioned XML format. */
  saveAsXML(): Element {
    const elem = new Element('timeState');
    elem.setAttribute('version', CURRENT_FORMAT_VERSION.toString());
    elem.addElement(writeInt('zoomIterations', Math.round(this.zoomIterations)));
    elem.addElement(writeBoolean('snapEnabled', this.snapEnabled));
    elem.addElement('snapValue').setText(this.snapValue);
    elem.addElement('timeDisplay').setText(this.timeDisplay);
    elem.addElement('secondaryTimeDisplay').setText(this.secondaryTimeDisplay);
    elem.addElement(writeBoolean('secondaryRulerEnabled', this.secondaryRulerEnabled));
    elem.addElement(writeBoolean('tempoRowVisible', this.tempoRowVisible));
    elem.addElement(writeBoolean('meterRowVisible', this.meterRowVisible));
    elem.addElement(writeBoolean('markersRowVisible', this.markersRowVisible));
    elem.addElement(writeDouble('smpteFrameRate', this.smpteFrameRate));
    if (this.smpteDropFrame) elem.addElement(writeBoolean('smpteDropFrame', true));
    if (this.historicalRulerInterval !== null)
      elem.addElement(writeInt('timeUnit', this.historicalRulerInterval));
    return elem;
  }

  /** Reads and validates timeline display settings, including supported legacy forms. */
  static loadFromXML(
    data: Element,
    providedContext?: XmlLoadContext,
    sink?: XmlDiagnosticSink,
  ): TimeState {
    const context = providedContext ?? new XmlLoadContext(data);
    checkRoot(data, 'timeState', context);
    const booleanFields = [
      'snapEnabled',
      'secondaryRulerEnabled',
      'tempoRowVisible',
      'meterRowVisible',
      'markersRowVisible',
      'smpteDropFrame',
    ] as const;
    checkShape(
      data,
      ['version'],
      [
        'pixelSecond',
        'zoomIterations',
        'snapValue',
        'timeDisplay',
        'secondaryTimeDisplay',
        'smpteFrameRate',
        'timeUnit',
        ...booleanFields,
      ],
      context,
    );
    const versionText = data.getAttribute('version');
    const version =
      versionText === null ? 1 : parseXmlInteger(versionText, context.at(data), 1, 4, '@version');
    const state = new TimeState();
    for (const field of booleanFields) {
      const node = data.getElement(field);
      if (node) state[field] = readBoolean(node, context);
    }
    if (version === 1 && state.secondaryRulerEnabled)
      throw context.at(data.getElement('secondaryRulerEnabled')!).error({
        code: 'conflict',
        message: 'Legacy version 1 cannot enable the secondary ruler.',
        recovery: 'Convert the timing state in a compatible editor.',
      });
    const zoom = data.getElement('zoomIterations');
    if (zoom) state.zoomIterations = readInt(zoom, context);
    const pixels = data.getElement('pixelSecond');
    if (pixels) {
      const value = readInt(pixels, context, 1);
      const converted = Math.trunc(Math.log2(value / 100) * 32);
      if (zoom && converted !== state.zoomIterations)
        throw context.at(pixels).error({
          code: 'conflict',
          message: 'Legacy zoom conflicts with zoomIterations.',
          recovery: 'Keep one consistent zoom value.',
        });
      state.zoomIterations = converted;
    }
    const timeUnit = data.getElement('timeUnit');
    if (timeUnit) {
      state.historicalRulerInterval = readInt(timeUnit, context, 1, 2147483647);
      context.at(timeUnit).diagnostic({
        code: 'P-TIME-STATE-HISTORICAL-RULER',
        severity: 'warning',
        member: 'timeUnit',
        value: String(state.historicalRulerInterval),
        message:
          'Historical timeUnit controlled TimeState ruler ticks and labels; the current timeline does not apply that interval.',
        recovery:
          'The interval is retained and saved as timeUnit. Use a compatible editor to edit it until the current timeline supports historical intervals.',
      });
    }
    for (const field of ['timeDisplay', 'secondaryTimeDisplay'] as const) {
      const node = data.getElement(field);
      if (!node) continue;
      const token = readText(node, context).trim();
      const normalized =
        token === '0' ? 'TIME' : token === '1' || token === 'CSOUND_BEATS' ? 'BEATS' : token;
      if (!Object.values(TimeBase).includes(normalized as TimeBase))
        throw context.at(node).error({
          code: 'value',
          member: field,
          value: token,
          message: 'Unsupported time display.',
          recovery: 'Use a supported TimeBase name.',
        });
      state[field] = normalized as TimeBase;
    }
    const snap = data.getElement('snapValue');
    if (snap) {
      const token = readText(snap, context).trim();
      const normalized = token === 'QUARTER' ? 'SIXTEENTH' : token;
      if (isValidSnapValueName(normalized)) state.snapValue = normalized;
      else {
        const value = parseXmlNumber(token, context.at(snap));
        if (value < 0)
          throw context.at(snap).error({
            code: 'value',
            value: token,
            message: 'Legacy snap cannot be negative.',
            recovery: 'Choose a nonnegative snap interval or a supported enum name.',
          });
        state.snapValue = closestSnapValueMatch(value);
        if (value === 0)
          context.at(snap).diagnostic({
            code: 'P-TIME-STATE-ZERO-SNAP',
            severity: 'warning',
            member: 'snapValue',
            value: token,
            message: 'Legacy zero snap maps to SIXTY_FOURTH using Java nearest-match behavior.',
            recovery: 'The mapped SIXTY_FOURTH value is saved as the canonical snap enum.',
          });
      }
    }
    const fps = data.getElement('smpteFrameRate');
    if (fps) {
      const text = readText(fps, context).trim();
      const rate = parseXmlNumber(
        text === '29.97df' ? '29.97' : text === '30df' ? '30' : text,
        context.at(fps),
      );
      if (!resolveSmpteRate(rate))
        throw context.at(fps).error({
          code: 'value',
          value: text,
          message: 'Unsupported SMPTE rate.',
          recovery: 'Choose a supported SMPTE frame rate.',
        });
      state.smpteFrameRate = rate;
    }
    if (!isValidSmpteFormat(state.smpteFrameRate, state.smpteDropFrame))
      throw context.at(data.getElement('smpteDropFrame') ?? data).error({
        code: 'conflict',
        message: 'Drop-frame mode is incompatible with the SMPTE rate.',
        recovery: 'Choose a supported rate/drop-frame pair.',
      });
    return providedContext ? state : requireXmlValue(context.result(state), sink);
  }
}
