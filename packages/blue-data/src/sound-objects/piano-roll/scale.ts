/**
 * Scale — defines pitch mappings for PianoRoll notes.
 * Default is 12TET (12-tone equal temperament).
 */
import { Element } from '../../serialization/xml-reader';

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

  static loadFromXML(data: Element): Scale {
    const scale = new Scale();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'scaleName':
          scale.scaleName = node.getTextString();
          break;
        case 'baseFrequency':
          scale.baseFrequency = parseFloat(node.getTextString());
          break;
        case 'octave':
          scale.octave = parseFloat(node.getTextString());
          break;
        case 'ratios':
          const ratioNodes = node.getElements('ratio');
          const ratios: number[] = [];
          while (ratioNodes.hasMoreElements()) {
            ratios.push(parseFloat(ratioNodes.next().getTextString()));
          }
          scale.ratios = ratios;
          break;
      }
    }
    return scale;
  }
}
