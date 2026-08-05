import { Element } from '../serialization/xml-reader';
import { Instrument } from './instrument';

export class BlueX7 extends Instrument {
  private _rawChildren: Element[] = [];

  constructor(other?: BlueX7) {
    super();
    this.setName('BlueX7');
    if (other) {
      this._name = other._name;
      this._enabled = other._enabled;
      this._comment = other._comment;
      this._rawChildren = other._rawChildren.map((child) =>
        Element.parse(child.toXml()),
      );
    }
  }

  override generateInstrument(): string {
    return '';
  }

  saveAsXML(): Element {
    const elem = new Element('instrument');
    elem.setAttribute('type', 'blue.orchestra.BlueX7');
    elem.setAttribute('enabled', this._enabled.toString());
    elem.addElement('name').setText(this._name);
    elem.addElement('comment').setText(this._comment);
    for (const child of this._rawChildren) {
      if (child.getName() !== 'name' && child.getName() !== 'comment') {
        elem.addElement(Element.parse(child.toXml()));
      }
    }
    return elem;
  }

  static loadFromXML(data: Element): BlueX7 {
    const instr = new BlueX7();
    instr.setEnabled(data.getAttribute('enabled') !== 'false');
    instr.setName(data.getTextString('name') ?? '');
    instr.setComment(data.getTextString('comment') ?? '');
    instr._rawChildren = data
      .getElements()
      .toArray()
      .map((child) => Element.parse(child.toXml()));
    return instr;
  }

  deepCopy(): BlueX7 {
    return new BlueX7(this);
  }
}
