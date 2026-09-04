/**
 * MidiKeyMapping — maps MIDI note numbers to Csound p-field values.
 * Mirrors the Java MidiKeyMapping class.
 */
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';

export class MidiKeyMapping implements BlueDataObject {
  private _enabled = true;
  private _pFieldIndex = 4;
  private _baseNote = 60; // Middle C
  private _range = 12; // One octave

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

  getBaseNote(): number {
    return this._baseNote;
  }
  setBaseNote(n: number): void {
    this._baseNote = n;
  }

  getRange(): number {
    return this._range;
  }
  setRange(r: number): void {
    this._range = r;
  }

  saveAsXML(): Element {
    const elem = new Element('midiKeyMapping');
    elem.addElement('enabled').setText(this._enabled.toString());
    elem.addElement('pFieldIndex').setText(this._pFieldIndex.toString());
    elem.addElement('baseNote').setText(this._baseNote.toString());
    elem.addElement('range').setText(this._range.toString());
    return elem;
  }

  static loadFromXML(data: Element): MidiKeyMapping {
    const mapping = new MidiKeyMapping();
    const en = data.getTextString('enabled');
    if (en) mapping._enabled = en.toLowerCase() === 'true';
    const pfi = data.getTextString('pFieldIndex');
    if (pfi) mapping._pFieldIndex = parseInt(pfi, 10);
    const bn = data.getTextString('baseNote');
    if (bn) mapping._baseNote = parseInt(bn, 10);
    const r = data.getTextString('range');
    if (r) mapping._range = parseInt(r, 10);
    return mapping;
  }

  deepCopy(): BlueDataObject {
    const copy = new MidiKeyMapping();
    copy._enabled = this._enabled;
    copy._pFieldIndex = this._pFieldIndex;
    copy._baseNote = this._baseNote;
    copy._range = this._range;
    return copy;
  }
}
