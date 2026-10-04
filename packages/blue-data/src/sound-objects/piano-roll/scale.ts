/**
 * Scale — defines pitch mappings for PianoRoll notes.
 * Default is 12TET (12-tone equal temperament).
 */
import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, readText, readDouble } from '../../utilities/xml';

export class Scale {
  scaleName = '12TET';
  baseFrequency = 261.625565; // Middle C (C4)
  octave = 2.0;
  ratios: number[];

  constructor(other?: Scale) {
    if (other) {
      this.scaleName = other.scaleName;
      this.baseFrequency = other.baseFrequency;
      this.octave = other.octave;
      this.ratios = [...other.ratios];
    } else {
      // Default: 12TET
      this.ratios = Scale.default12TET();
    }
  }

  private static default12TET(): number[] {
    const ratio = Math.pow(2.0, 1.0 / 12.0);
    const ratios = new Array(12);
    for (let i = 0; i < 12; i++) {
      ratios[i] = Math.pow(ratio, i);
    }
    return ratios;
  }

  /**
   * Get frequency for a given octave and scale degree.
   */
  getFrequency(octave: number, scaleDegree: number): number {
    let oct = octave;
    let pitchIndex = scaleDegree;

    if (pitchIndex >= this.ratios.length) {
      oct += Math.floor(pitchIndex / this.ratios.length);
      pitchIndex = pitchIndex % this.ratios.length;
    }

    if (pitchIndex < 0) {
      const octaveDiff = Math.floor((pitchIndex * -1) / this.ratios.length) + 1;
      pitchIndex = pitchIndex % this.ratios.length;
      oct -= octaveDiff;
      pitchIndex = this.ratios.length + pitchIndex;
    }

    const multiplier = Math.pow(this.octave, oct - 8);
    const newBase = multiplier * this.baseFrequency;
    return newBase * this.ratios[pitchIndex];
  }

  getNumScaleDegrees(): number {
    return this.ratios.length;
  }

  saveAsXML(): Element {
    const elem = new Element('scale');
    elem.addElement('scaleName').setText(this.scaleName);
    elem.addElement('baseFrequency').setText(this.baseFrequency.toString());
    elem.addElement('octave').setText(this.octave.toString());
    const ratiosElem = elem.addElement('ratios');
    for (const r of this.ratios) {
      ratiosElem.addElement('ratio').setText(r.toString());
    }
    return elem;
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Scale {
    checkRoot(data, 'scale', context);
    checkShape(data, [], ['scaleName', 'baseFrequency', 'octave', 'ratios'], context);
    const scale = new Scale();
    const positive = (node: Element): number => {
      const value = readDouble(node, context);
      if (value <= 0)
        throw context.at(node).error({
          code: 'value',
          value: node.getTextString(),
          message: 'Scale values must be positive.',
          recovery: 'Supply a positive finite value.',
        });
      return value;
    };
    const name = data.getElement('scaleName');
    const base = data.getElement('baseFrequency');
    const octave = data.getElement('octave');
    const ratios = data.getElement('ratios');
    if (name) scale.scaleName = readText(name, context);
    if (base) scale.baseFrequency = positive(base);
    if (octave) scale.octave = positive(octave);
    if (ratios) {
      checkShape(ratios, [], ['ratio'], context, ['ratio']);
      scale.ratios = [...ratios.getElements('ratio')].map(positive);
      if (scale.ratios.length === 0)
        throw context.at(ratios).error({
          code: 'cardinality',
          message: 'A supplied scale requires at least one ratio.',
          recovery:
            'Supply the complete tuning ratios or omit the scale for the documented default.',
        });
    }
    return scale;
  }
}
