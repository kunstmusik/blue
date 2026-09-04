import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.AddProcessor';

export class AddProcessor extends NoteProcessor {
  private _pfield = 4;
  private _value = 0;

  getPfield(): string {
    return this._pfield.toString();
  }
  setPfield(pfield: string): void {
    this._pfield = parseInt(pfield, 10);
  }

  getVal(): string {
    return this._value.toString();
  }
  setVal(val: string): void {
    this._value = parseFloat(val);
  }

  override process(notes: NoteList): NoteList {
    for (const note of notes) {
      let fieldVal: number;
      try {
        fieldVal = parseFloat(note.getPField(this._pfield)!);
      } catch {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      if (isNaN(fieldVal)) {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      note.setPField((fieldVal + this._value).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'AddProcessor';
  }

  override deepCopy(): AddProcessor {
    const copy = new AddProcessor();
    copy._pfield = this._pfield;
    copy._value = this._value;
    return copy;
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this.getPfield());
    elem.addElement('value').setText(this.getVal());
    return elem;
  }

  static loadFromXML(data: Element): AddProcessor {
    const proc = new AddProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const v = data.getTextString('value');
    if (v !== null) proc._value = parseFloat(v);
    const pfIdx = data.getTextString('pFieldIndex');
    if (pfIdx !== null) proc._pfield = parseInt(pfIdx, 10);
    return proc;
  }
}
