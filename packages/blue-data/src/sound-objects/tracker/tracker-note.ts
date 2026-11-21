import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import { checkRoot, checkShape, readText, readBoolean } from '../../utilities/xml';

/** Tracker step containing text values, with tie and note-off flags. */
export class TrackerNote {
  private _tied = false;
  private _off = false;
  private _fields: string[] = [];

  /** Creates a default tracker note or copies a supplied instance. */
  constructor(other?: TrackerNote) {
    if (other) {
      this._tied = other._tied;
      this._off = other._off;
      this._fields = [...other._fields];
    }
  }

  /** Reports whether the tracker note carries a Csound tie. */
  isTied(): boolean {
    return this._tied;
  }
  /** Sets the tied stored on the tracker note. */
  setTied(tied: boolean): void {
    this._tied = tied;
  }

  /** Reports whether the tracker note marks a note-off step. */
  isOff(): boolean {
    return this._off;
  }
  /** Sets the off stored on the tracker note. */
  setOff(off: boolean): void {
    this._off = off;
  }

  /** Returns the number of fields stored in this step. */
  getNumFields(): number {
    return 1 + this._fields.length;
  }

  /** Adds a field to the step. */
  addColumn(): void {
    this._fields.push('');
  }

  /** Removes the field at the supplied column index. */
  removeColumn(index: number): void {
    if (index < 0 || index >= this._fields.length) {
      return;
    }
    this._fields.splice(index, 1);
  }

  /** Sets the text in the supplied column. */
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

  /** Returns the entry at the supplied index in the tracker note’s fields. */
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

  /** Reports whether any column has a nonempty value. The note-off flag is tracked separately. */
  isActive(): boolean {
    return this._fields.some((field) => field.length > 0);
  }

  /** Serializes the tracker note and its persisted settings to a new Blue XML element. */
  saveAsXML(): Element {
    const retVal = new Element('trackerNote');
    retVal.addElement('tied').setText(this._tied.toString());
    retVal.addElement('off').setText(this._off.toString());
    for (const val of this._fields) {
      retVal.addElement('field').setAttribute('val', val);
    }
    return retVal;
  }

  /** Reconstructs the tracker note from its Blue XML element, using the supplied diagnostic context when provided. */
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

  /** Copies the contents and note state from another tracker step. */
  copyValues(other: TrackerNote): void {
    this._tied = other._tied;
    this._off = other._off;
    this._fields = [...other._fields];
  }

  /** Empties the step and clears its tie and note-off state. */
  clear(): void {
    for (let i = 0; i < this._fields.length; i++) {
      this._fields[i] = '';
    }
    this._tied = false;
    this._off = false;
  }
}
