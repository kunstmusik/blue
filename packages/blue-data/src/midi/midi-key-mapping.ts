/**
 * MidiKeyMapping — maps MIDI note numbers to Csound p-field values.
 * Mirrors the Java MidiKeyMapping class.
 */
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readBoolean, readInt } from '../utilities/xml';
import { BlueDataObject } from '../blue-data-object';

export class MidiKeyMapping implements BlueDataObject {
  private _enabled = true;
  private _pFieldIndex = 4;
  private _baseNote = 60; // Middle C
  private _range = 12; // One octave

  /** Reports whether the MIDI key mapping is enabled. */
  isEnabled(): boolean {
    return this._enabled;
  }
  /** Sets the enabled stored on the MIDI key mapping. */
  setEnabled(e: boolean): void {
    this._enabled = e;
  }

  /** Returns the p field index stored on the MIDI key mapping. */
  getPFieldIndex(): number {
    return this._pFieldIndex;
  }
  /** Sets the p field index stored on the MIDI key mapping. */
  setPFieldIndex(idx: number): void {
    this._pFieldIndex = idx;
  }

  /** Returns the base note stored on the MIDI key mapping. */
  getBaseNote(): number {
    return this._baseNote;
  }
  /** Sets the base note stored on the MIDI key mapping. */
  setBaseNote(n: number): void {
    this._baseNote = n;
  }

  /** Returns the range stored on the MIDI key mapping. */
  getRange(): number {
    return this._range;
  }
  /** Sets the range stored on the MIDI key mapping. */
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

  /** Reconstructs the MIDI key mapping from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): MidiKeyMapping {
    checkRoot(data, 'midiKeyMapping', context);
    checkShape(data, [], ['enabled', 'pFieldIndex', 'baseNote', 'range'], context);
    const mapping = new MidiKeyMapping();
    {
      const node = data.getElement('enabled');
      if (node) mapping._enabled = readBoolean(node, context);
    }
    {
      const node = data.getElement('pFieldIndex');
      if (node) mapping._pFieldIndex = readInt(node, context, 1);
    }
    {
      const node = data.getElement('baseNote');
      if (node) mapping._baseNote = readInt(node, context, 0, 127);
    }
    {
      const node = data.getElement('range');
      if (node) mapping._range = readInt(node, context, 1);
    }
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
