import { Instrument } from './instrument';
import { Element } from '../serialization/xml-reader';

/** Retains unavailable instrument types without discarding their project data. */
export class UnknownInstrument extends Instrument {
  private readonly xml: Element;

  constructor(xml: Element) {
    super();
    this.xml = xml.clone();
  }

  getTypeName(): string {
    return this.xml.getAttribute('type') ?? 'Unknown';
  }

  override getName(): string {
    return this.xml.getTextString('name') ?? '';
  }

  override setName(name: string): void {
    (this.xml.getElement('name') ?? this.xml.addElement('name')).setText(name);
  }

  override getComment(): string {
    return this.xml.getTextString('comment') ?? '';
  }

  override setComment(comment: string): void {
    (this.xml.getElement('comment') ?? this.xml.addElement('comment')).setText(comment ?? '');
  }

  generateInstrument(): string {
    throw new Error(`Unsupported instrument type: ${this.getTypeName()}`);
  }

  deepCopy(): Instrument {
    return new UnknownInstrument(this.xml);
  }

  saveAsXML(): Element {
    return this.xml.clone();
  }
}
