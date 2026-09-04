import { Element } from '../../serialization/xml-reader';

export class TrackerNote {
  private _tied = false;
  private _off = false;
  private _fields: string[] = [];

  constructor(other?: TrackerNote) {
    if (other) {
      this._tied = other._tied;
      this._off = other._off;
      this._fields = [...other._fields];
    }
  }

  isTied(): boolean {
    return this._tied;
  }
  setTied(tied: boolean): void {
    this._tied = tied;
  }

  isOff(): boolean {
    return this._off;
  }
  setOff(off: boolean): void {
    this._off = off;
  }

  getNumFields(): number {
    return 1 + this._fields.length;
  }

  addColumn(): void {
    this._fields.push('');
  }

  removeColumn(index: number): void {
    if (index < 0 || index >= this._fields.length) {
      return;
    }
    this._fields.splice(index, 1);
  }

  setValue(col: number, value: string): void {
    if (col === 0) {
      console.warn('TrackerNote: SetValue with column 0 should not be called');
      return;
    }
    const index = col - 1;
    if (index >= 0 && index < this._fields.length) {
      this._fields[index] = value;
    }
    this.setOff(false);
  }

  getValue(col: number): string {
    if (this._off) {
      return 'OFF';
    }
    if (col === 0) {
      return this._tied ? '-' : '';
    }
    const index = col - 1;
    return this._fields[index] ?? '';
  }

  isActive(): boolean {
    return this._fields.some((field) => field.length > 0);
  }

  saveAsXML(): Element {
    const retVal = new Element('trackerNote');
    retVal.addElement('tied').setText(this._tied.toString());
    retVal.addElement('off').setText(this._off.toString());
    for (const val of this._fields) {
      retVal.addElement('field').setAttribute('val', val);
    }
    return retVal;
  }

  static loadFromXML(data: Element): TrackerNote {
    const retVal = new TrackerNote();
    const nodes = data.getElements();

    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      const nodeName = node.getName();
      const nodeVal = node.getTextString();

      switch (nodeName) {
        case 'tied':
          retVal._tied = nodeVal === 'true';
          break;
        case 'off':
          retVal._off = nodeVal === 'true';
          break;
        case 'pitch':
        case 'amp':
          retVal._fields.push(nodeVal ?? '');
          break;
        case 'field':
        case 'otherField': {
          const atVal = node.getAttributeValue('val');
          retVal._fields.push(atVal ?? '');
          break;
        }
      }
    }
    return retVal;
  }

  copyValues(other: TrackerNote): void {
    this._tied = other._tied;
    this._off = other._off;
    this._fields = [...other._fields];
  }

  clear(): void {
    for (let i = 0; i < this._fields.length; i++) {
      this._fields[i] = '';
    }
    this._tied = false;
    this._off = false;
  }
}
