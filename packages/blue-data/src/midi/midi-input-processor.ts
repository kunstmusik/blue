/**
 * MidiInputProcessor — holds MIDI input configuration.
 * Mirrors the Java MidiInputProcessor class.
 *
 * Stores key mapping, velocity mapping, pitch/amp constants, and scale data
 * for MIDI input processing.
 */
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, readText, readEnum } from '../utilities/xml';
import { BlueDataObject } from '../blue-data-object';
import { Scale } from '../sound-objects/piano-roll/scale';

export class MidiInputProcessor implements BlueDataObject {
  private _keyMapping = 'PCH';
  private _velMapping = 'MIDI';
  private _pitchConstant = '';
  private _ampConstant = '';
  private _scale: Scale | null = new Scale();

  constructor(other?: MidiInputProcessor) {
    if (other) {
      this._keyMapping = other._keyMapping;
      this._velMapping = other._velMapping;
      this._pitchConstant = other._pitchConstant;
      this._ampConstant = other._ampConstant;
      this._scale = other._scale ? new Scale(other._scale) : null;
    }
  }

  getKeyMapping(): string {
    return this._keyMapping;
  }

  setKeyMapping(mapping: string): void {
    this._keyMapping = mapping;
  }

  getVelocityMapping(): string {
    return this._velMapping;
  }

  setVelocityMapping(mapping: string): void {
    this._velMapping = mapping;
  }

  getPitchConstant(): string {
    return this._pitchConstant;
  }

  setPitchConstant(value: string): void {
    this._pitchConstant = value;
  }

  getAmpConstant(): string {
    return this._ampConstant;
  }

  setAmpConstant(value: string): void {
    this._ampConstant = value;
  }

  getScale(): Scale | null {
    return this._scale;
  }

  setScale(scale: Scale | null): void {
    this._scale = scale ? new Scale(scale) : null;
  }

  saveAsXML(): Element {
    const elem = new Element('midiInputProcessor');
    elem.addElement('keyMapping').setText(this._keyMapping);
    elem.addElement('velMapping').setText(this._velMapping);
    elem.addElement('pitchConstant').setText(this._pitchConstant);
    elem.addElement('ampConstant').setText(this._ampConstant);
    elem.addElement((this._scale ?? new Scale()).saveAsXML());
    return elem;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): MidiInputProcessor {
    checkRoot(data, 'midiInputProcessor', context);
    checkShape(
      data,
      [],
      ['keyMapping', 'velMapping', 'pitchConstant', 'ampConstant', 'scale'],
      context,
    );
    const mip = new MidiInputProcessor();
    const key = data.getElement('keyMapping');
    const velocity = data.getElement('velMapping');
    const pitch = data.getElement('pitchConstant');
    const amp = data.getElement('ampConstant');
    const scale = data.getElement('scale');
    if (key)
      mip._keyMapping = readEnum(
        key,
        ['MIDI', 'PCH', 'OCT', 'CONSTANT', 'TUNING_BLUE_PCH', 'TUNING_CPS'],
        context,
      );
    if (velocity)
      mip._velMapping = readEnum(velocity, ['MIDI', 'CONSTANT', 'AMP_0DBFS', 'AMP'], context);
    if (pitch) mip._pitchConstant = readText(pitch, context);
    if (amp) mip._ampConstant = readText(amp, context);
    if (scale) mip._scale = Scale.loadFromXML(scale, context);
    return mip;
  }

  deepCopy(): BlueDataObject {
    return new MidiInputProcessor(this);
  }
}
