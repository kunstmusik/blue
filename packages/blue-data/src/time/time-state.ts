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
import { XmlLoadContext } from '../serialization/xml-load';

import { resolveSmpteRate, isValidSmpteFormat } from './smpte-timecode';

const CURRENT_FORMAT_VERSION = 2;

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
    }
  }

  getPixelSecond(): number {
    return 100 * Math.exp(Math.log(2) * (this.zoomIterations / 32.0));
  }

  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }
  setSnapEnabled(value: boolean): void {
    this.snapEnabled = value;
  }

  getSnapValue(): SnapValueName {
    return this.snapValue;
  }
  setSnapValue(value: SnapValueName): void {
    this.snapValue = value;
  }

  getTimeDisplay(): TimeBase {
    return this.timeDisplay;
  }
  setTimeDisplay(value: TimeBase): void {
    this.timeDisplay = value;
  }

  getSecondaryTimeDisplay(): TimeBase {
    return this.secondaryTimeDisplay;
  }
  setSecondaryTimeDisplay(value: TimeBase): void {
    this.secondaryTimeDisplay = value;
  }

  isSecondaryRulerEnabled(): boolean {
    return this.secondaryRulerEnabled;
  }
  setSecondaryRulerEnabled(value: boolean): void {
    this.secondaryRulerEnabled = value;
  }

  isTempoRowVisible(): boolean {
    return this.tempoRowVisible;
  }
  setTempoRowVisible(value: boolean): void {
    this.tempoRowVisible = value;
  }

  isMeterRowVisible(): boolean {
    return this.meterRowVisible;
  }
  setMeterRowVisible(value: boolean): void {
    this.meterRowVisible = value;
  }

  isMarkersRowVisible(): boolean {
    return this.markersRowVisible;
  }
  setMarkersRowVisible(value: boolean): void {
    this.markersRowVisible = value;
  }

  getSmpteFrameRate(): number {
    return this.smpteFrameRate;
  }
  setSmpteFrameRate(value: number): void {
    if (!resolveSmpteRate(value)) throw new Error('Unsupported SMPTE rate');
    this.smpteFrameRate = value;
    if (!isValidSmpteFormat(value, this.smpteDropFrame)) this.smpteDropFrame = false;
  }

  isSmpteDropFrame(): boolean {
    return this.smpteDropFrame;
  }
  setSmpteDropFrame(value: boolean): void {
    if (!isValidSmpteFormat(this.smpteFrameRate, value))
      throw new Error('Unsupported SMPTE format');
    this.smpteDropFrame = value;
  }

  getZoomIterations(): number {
    return this.zoomIterations;
  }
  setZoomIterations(value: number): void {
    this.zoomIterations = value;
  }

  lowerPixelSecond(): void {
    this.zoomIterations--;
  }
  raisePixelSecond(): void {
    this.zoomIterations++;
  }

  // ─── XML Serialization ───

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
    return elem;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): TimeState {
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
        if (value <= 0)
          throw context.at(snap).error({
            code: 'value',
            value: token,
            message: 'Legacy snap must be positive.',
            recovery: 'Choose a positive snap interval or a supported enum name.',
          });
        state.snapValue = closestSnapValueMatch(value);
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
    return state;
  }
}
