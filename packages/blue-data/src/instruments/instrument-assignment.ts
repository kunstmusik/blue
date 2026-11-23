/**
 * InstrumentAssignment — maps an instrument to an arrangement ID.
 * Mirrors the Java InstrumentAssignment class.
 */
import { Instrument } from './instrument';
import { Element } from '../serialization/xml-reader';
import { XmlLoadContext } from '../serialization/xml-load';
import { checkRoot, checkShape, parseXmlBoolean } from '../utilities/xml';
import { loadInstrumentFromXML } from './instrument-registry';
import type { CopyMode } from '../deep-copyable';

/** Maps a Csound instrument identifier to an instrument and an arrangement-level enable flag. */
export class InstrumentAssignment {
  /** Csound identifier used to address the instrument from the score. */
  arrangementId = '0';
  /** Instrument associated with this arrangement entry. */
  instr!: Instrument;
  /** Whether this instrument assignment participates in generation. */
  enabled = true;

  /** Creates a default instrument assignment or copies a supplied instance. The copy mode controls identity preservation. */
  constructor(other?: InstrumentAssignment, mode: CopyMode = 'duplication') {
    if (other) {
      this.arrangementId = other.arrangementId;
      this.enabled = other.enabled;
      this.instr = other.instr?.deepCopy(mode);
    }
  }

  /** Compares numeric IDs numerically when both can be parsed, falling back to text ordering otherwise. */
  compareTo(other: InstrumentAssignment): number {
    // Compare arrangement IDs numerically if possible
    const a = parseInt(this.arrangementId, 10);
    const b = parseInt(other.arrangementId, 10);
    if (!isNaN(a) && !isNaN(b)) {
      return a - b;
    }
    return this.arrangementId.localeCompare(other.arrangementId);
  }

  /** Serializes the instrument assignment and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const elem = new Element('instrumentAssignment');
    elem.setAttribute('arrangementId', this.arrangementId);
    elem.setAttribute('isEnabled', this.enabled.toString());
    if (this.instr) {
      elem.addElement(this.instr.saveAsXML());
    }
    return elem;
  }

  /** Reconstructs the instrument assignment from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): InstrumentAssignment {
    checkRoot(data, 'instrumentAssignment', context);
    checkShape(data, ['arrangementId', 'id', 'isEnabled', 'enabled'], ['instrument'], context);
    for (const [current, legacy] of [
      ['arrangementId', 'id'],
      ['isEnabled', 'enabled'],
    ])
      if (data.hasAttribute(current) && data.hasAttribute(legacy))
        throw context.at(data).error({
          code: 'conflict',
          member: `@${legacy}`,
          message: 'Assignment attribute aliases coexist.',
          recovery: 'Keep only the canonical assignment attribute.',
        });
    const ia = new InstrumentAssignment();
    ia.arrangementId = data.getAttribute('arrangementId') ?? data.getAttribute('id') ?? '0';
    ia.enabled = parseXmlBoolean(
      data.getAttribute('isEnabled') ?? data.getAttribute('enabled') ?? 'true',
      context.at(data),
      '@isEnabled',
    );

    const instrElem = data.getElement('instrument');
    if (!instrElem)
      throw context.at(data).error({
        code: 'cardinality',
        member: 'instrument',
        message: 'Assignment requires one resolved instrument.',
        recovery: 'Embed the assigned instrument or load its historical project library.',
      });
    ia.instr = loadInstrumentFromXML(instrElem, context);
    return ia;
  }
}
