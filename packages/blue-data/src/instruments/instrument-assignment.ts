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

export class InstrumentAssignment {
  arrangementId = '0';
  instr!: Instrument;
  enabled = true;

  constructor(other?: InstrumentAssignment, mode: CopyMode = 'duplication') {
    if (other) {
      this.arrangementId = other.arrangementId;
      this.enabled = other.enabled;
      this.instr = other.instr?.deepCopy(mode);
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
