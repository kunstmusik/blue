/**
 * TimeState — holds the time display and editing state for a score.
 * Mirrors the Java TimeState class.
 *
 * Stores ruler display format (primary/secondary via TimeBase),
 * snap settings (via SnapValue), zoom level, row visibility,
 * and SMPTE frame rate.
 */
import { TimeBase } from './time-base';
import { SnapValueName, isValidSnapValueName } from './snap-value';
import { Element } from '../serialization/xml-reader';
import {
  writeBoolean,
  readBoolean,
  writeDouble,
  readDouble,
  writeInt,
  readInt,
} from '../utilities/xml';

const CURRENT_FORMAT_VERSION = 2;

function parseTimeBase(text: string | null | undefined, defaultValue: TimeBase): TimeBase {
  if (!text || text.trim().length === 0) return defaultValue;
  const trimmed = text.trim();
  // Try enum name first (v2 format)
  if (Object.values(TimeBase).includes(trimmed as TimeBase)) {
    return trimmed as TimeBase;
  }
  // Fall back to legacy int parsing: 0=TIME, 1=BEATS
  const legacyValue = parseInt(trimmed, 10);
  if (!Number.isNaN(legacyValue)) {
    switch (legacyValue) {
      case 0:
        return TimeBase.TIME;
      case 1:
        return TimeBase.BEATS;
      default:
        return defaultValue;
    }
  }
  return defaultValue;
}

function parseSnapValue(text: string | null | undefined): SnapValueName {
  if (!text || text.trim().length === 0) return 'BEAT';
  const trimmed = text.trim();
  // Migrate removed enum constant
  const migrated = trimmed === 'QUARTER' ? 'SIXTEENTH' : trimmed;
  // Try enum name first (current format)
  if (isValidSnapValueName(migrated)) return migrated;
  // Legacy format: double value — find closest match
  const legacyVal = parseFloat(migrated);
  if (!Number.isNaN(legacyVal)) {
    return closestSnapValueMatchLegacy(legacyVal);
  }
  return 'BEAT';
}

function closestSnapValueMatchLegacy(legacyValue: number): SnapValueName {
  // Import-free closest match for legacy double values
  const musicalValues: Array<[SnapValueName, number]> = [
    ['BAR', 4.0],
    ['HALF', 2.0],
    ['BEAT', 1.0],
    ['EIGHTH', 0.5],
    ['SIXTEENTH', 0.25],
    ['THIRTY_SECOND', 0.125],
    ['SIXTY_FOURTH', 0.0625],
    ['QUARTER_TRIPLET', 1.0 / 3.0],
    ['EIGHTH_TRIPLET', 1.0 / 6.0],
    ['SIXTEENTH_TRIPLET', 1.0 / 12.0],
  ];
  let best: SnapValueName = 'BEAT';
  let bestDiff = Number.MAX_VALUE;
  for (const [name, val] of musicalValues) {
    const diff = Math.abs(val - legacyValue);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = name;
    }
  }
  return best;
}

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
    this.smpteFrameRate = value;
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
    return elem;
  }

  static loadFromXML(data: Element): TimeState {
    const state = new TimeState();
    const versionStr = data.getAttribute('version');
    const version = versionStr ? parseInt(versionStr, 10) : 1;

    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const name = node.getName();
      const text = node.getTextString();

      switch (name) {
        case 'pixelSecond': {
          const pixelSecond = parseInt(text, 10);
          state.zoomIterations = Math.round((Math.log(pixelSecond / 100.0) / Math.log(2)) * 32.0);
          break;
        }
        case 'zoomIterations':
          state.zoomIterations = parseInt(text, 10) || 0;
          break;
        case 'snapEnabled':
          state.snapEnabled = readBoolean(node);
          break;
        case 'snapValue':
          state.snapValue = parseSnapValue(text);
          break;
        case 'timeDisplay':
          state.timeDisplay = parseTimeBase(text, TimeBase.BEATS);
          break;
        case 'secondaryTimeDisplay':
          state.secondaryTimeDisplay = parseTimeBase(text, TimeBase.TIME);
          break;
        case 'secondaryRulerEnabled':
          state.secondaryRulerEnabled = readBoolean(node);
          break;
        case 'tempoRowVisible':
          state.tempoRowVisible = readBoolean(node);
          break;
        case 'meterRowVisible':
          state.meterRowVisible = readBoolean(node);
          break;
        case 'markersRowVisible':
          state.markersRowVisible = readBoolean(node);
          break;
        case 'smpteFrameRate':
          state.smpteFrameRate = readDouble(node);
          break;
      }
    }

    // Migrate legacy format values (version 1)
    if (version < 2) {
      state.secondaryRulerEnabled = false;
    }

    return state;
  }
}
