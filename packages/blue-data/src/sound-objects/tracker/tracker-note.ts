import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, readText, readBoolean } from '../../utilities/xml';

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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): TrackerNote {
    checkRoot(data, 'trackerNote', context);
    checkShape(data, [], ['tied', 'off', 'field', 'pitch', 'amp', 'otherField'], context, [
      'field',
      'otherField',
    ]);
    const note = new TrackerNote();
    for (const child of data.getElements()) {
      switch (child.getName()) {
        case 'tied':
          note._tied = readBoolean(child, context);
          break;
        case 'off':
          note._off = readBoolean(child, context);
          break;
        case 'pitch':
        case 'amp':
          note._fields.push(readText(child, context));
          break;
        case 'field':
        case 'otherField': {
          checkShape(child, ['val'], [], context);
          const value = child.getAttribute('val');
          if (value === null)
            throw context.at(child).error({
              code: 'value',
              member: '@val',
              message: 'Tracker cell value is required.',
              recovery: 'Supply a val attribute, including empty text for an inactive cell.',
            });
          note._fields.push(value);
          break;
        }
      }
    }
    return note;
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
