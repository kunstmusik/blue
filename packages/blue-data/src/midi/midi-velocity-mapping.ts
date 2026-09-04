/**
 * MidiVelocityMapping — maps MIDI velocity to Csound p-field values.
 * Mirrors the Java MidiVelocityMapping class.
 */
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';

export class MidiVelocityMapping implements BlueDataObject {
  private _enabled = true;
  private _pFieldIndex = 5;
  private _minVelocity = 0;
  private _maxVelocity = 127;
  private _minValue = 0;
  private _maxValue = 1;

  isEnabled(): boolean {
    return this._enabled;
  }
  setEnabled(e: boolean): void {
    this._enabled = e;
  }

  getPFieldIndex(): number {
    return this._pFieldIndex;
  }
  setPFieldIndex(idx: number): void {
    this._pFieldIndex = idx;
  }

  getMinVelocity(): number {
    return this._minVelocity;
  }
  setMinVelocity(v: number): void {
    this._minVelocity = v;
  }

  getMaxVelocity(): number {
    return this._maxVelocity;
  }
  setMaxVelocity(v: number): void {
    this._maxVelocity = v;
  }

  getMinValue(): number {
    return this._minValue;
  }
  setMinValue(v: number): void {
    this._minValue = v;
  }

  getMaxValue(): number {
    return this._maxValue;
  }
  setMaxValue(v: number): void {
    this._maxValue = v;
  }

  saveAsXML(): Element {
    const elem = new Element('midiVelocityMapping');
    elem.addElement('enabled').setText(this._enabled.toString());
    elem.addElement('pFieldIndex').setText(this._pFieldIndex.toString());
    elem.addElement('minVelocity').setText(this._minVelocity.toString());
    elem.addElement('maxVelocity').setText(this._maxVelocity.toString());
    elem.addElement('minValue').setText(this._minValue.toString());
    elem.addElement('maxValue').setText(this._maxValue.toString());
    return elem;
  }

  static loadFromXML(data: Element): MidiVelocityMapping {
    const mapping = new MidiVelocityMapping();
    const en = data.getTextString('enabled');
    if (en) mapping._enabled = en.toLowerCase() === 'true';
    const pfi = data.getTextString('pFieldIndex');
    if (pfi) mapping._pFieldIndex = parseInt(pfi, 10);
    const mnV = data.getTextString('minVelocity');
    if (mnV) mapping._minVelocity = parseInt(mnV, 10);
    const mxV = data.getTextString('maxVelocity');
    if (mxV) mapping._maxVelocity = parseInt(mxV, 10);
    const mn = data.getTextString('minValue');
    if (mn) mapping._minValue = parseFloat(mn);
    const mx = data.getTextString('maxValue');
    if (mx) mapping._maxValue = parseFloat(mx);
    return mapping;
  }

  deepCopy(): BlueDataObject {
    const copy = new MidiVelocityMapping();
    copy._enabled = this._enabled;
    copy._pFieldIndex = this._pFieldIndex;
    copy._minVelocity = this._minVelocity;
    copy._maxVelocity = this._maxVelocity;
    copy._minValue = this._minValue;
    copy._maxValue = this._maxValue;
    return copy;
  }
}
