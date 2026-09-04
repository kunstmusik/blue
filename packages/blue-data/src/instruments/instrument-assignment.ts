/**
 * InstrumentAssignment — maps an instrument to an arrangement ID.
 * Mirrors the Java InstrumentAssignment class.
 */
import { Instrument } from './instrument';
import { Element } from '../serialization/xml-reader';
import { loadInstrumentFromXML } from './instrument-registry';

export class InstrumentAssignment {
  arrangementId = '0';
  instr!: Instrument;
  enabled = true;

  constructor(other?: InstrumentAssignment) {
    if (other) {
      this.arrangementId = other.arrangementId;
      this.enabled = other.enabled;
      this.instr = other.instr?.deepCopy();
    }
  }

  compareTo(other: InstrumentAssignment): number {
    // Compare arrangement IDs numerically if possible
    const a = parseInt(this.arrangementId, 10);
    const b = parseInt(other.arrangementId, 10);
    if (!isNaN(a) && !isNaN(b)) {
      return a - b;
    }
    return this.arrangementId.localeCompare(other.arrangementId);
  }

  saveAsXML(): Element {
    const elem = new Element('instrumentAssignment');
    elem.setAttribute('arrangementId', this.arrangementId);
    elem.setAttribute('isEnabled', this.enabled.toString());
    if (this.instr) {
      elem.addElement(this.instr.saveAsXML());
    }
    return elem;
  }

  static loadFromXML(data: Element): InstrumentAssignment {
    const ia = new InstrumentAssignment();
    ia.arrangementId = data.getAttribute('arrangementId') ?? data.getAttribute('id') ?? '0';
    ia.enabled = (data.getAttribute('isEnabled') ?? data.getAttribute('enabled')) !== 'false';

    const instrElem = data.getElement('instrument');
    if (instrElem) {
      const instr = loadInstrumentFromXML(instrElem);
      if (instr) {
        ia.instr = instr;
      }
    }
    return ia;
  }
}
