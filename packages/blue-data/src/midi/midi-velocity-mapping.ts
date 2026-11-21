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

  /** Reports whether the MIDI velocity mapping is enabled. */
  isEnabled(): boolean {
    return this._enabled;
  }
  /** Sets the enabled stored on the MIDI velocity mapping. */
  setEnabled(e: boolean): void {
    this._enabled = e;
  }

  /** Returns the p field index stored on the MIDI velocity mapping. */
  getPFieldIndex(): number {
    return this._pFieldIndex;
  }
  /** Sets the p field index stored on the MIDI velocity mapping. */
  setPFieldIndex(idx: number): void {
    this._pFieldIndex = idx;
  }

  /** Returns the min velocity stored on the MIDI velocity mapping. */
  getMinVelocity(): number {
    return this._minVelocity;
  }
  /** Sets the min velocity stored on the MIDI velocity mapping. */
  setMinVelocity(v: number): void {
    this._minVelocity = v;
  }

  /** Returns the max velocity stored on the MIDI velocity mapping. */
  getMaxVelocity(): number {
    return this._maxVelocity;
  }
  /** Sets the max velocity stored on the MIDI velocity mapping. */
  setMaxVelocity(v: number): void {
    this._maxVelocity = v;
  }

  /** Returns the lower bound for configured values. */
  getMinValue(): number {
    return this._minValue;
  }
  /** Sets the lower bound for configured values. */
  setMinValue(v: number): void {
    this._minValue = v;
  }

  /** Returns the upper bound for configured values. */
  getMaxValue(): number {
    return this._maxValue;
  }
  /** Sets the upper bound for configured values. */
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

  /** Reconstructs the MIDI velocity mapping from its Blue XML element, using the supplied diagnostic context when provided. */
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
