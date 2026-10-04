/**
 * MidiVelocityMapping — maps MIDI velocity to Csound p-field values.
 * Mirrors the Java MidiVelocityMapping class.
 */
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readBoolean, readInt, readDouble } from '../utilities/xml';
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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): MidiVelocityMapping {
    checkRoot(data, 'midiVelocityMapping', context);
    checkShape(
      data,
      [],
      ['enabled', 'pFieldIndex', 'minVelocity', 'maxVelocity', 'minValue', 'maxValue'],
      context,
    );
    const mapping = new MidiVelocityMapping();
    {
      const node = data.getElement('enabled');
      if (node) mapping._enabled = readBoolean(node, context);
    }
    {
      const node = data.getElement('pFieldIndex');
      if (node) mapping._pFieldIndex = readInt(node, context, 1);
    }
    {
      const node = data.getElement('minVelocity');
      if (node) mapping._minVelocity = readInt(node, context, 0, 127);
    }
    {
      const node = data.getElement('maxVelocity');
      if (node) mapping._maxVelocity = readInt(node, context, 0, 127);
    }
    {
      const node = data.getElement('minValue');
      if (node) mapping._minValue = readDouble(node, context);
    }
    {
      const node = data.getElement('maxValue');
      if (node) mapping._maxValue = readDouble(node, context);
    }
    if (mapping._minVelocity > mapping._maxVelocity || mapping._minValue > mapping._maxValue)
      throw context.at(data).error({
        code: 'conflict',
        message: 'Velocity mapping bounds are reversed.',
        recovery: 'Supply ordered minimum and maximum values.',
      });
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
