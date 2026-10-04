import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.MultiplyProcessor';

export class MultiplyProcessor extends NoteProcessor {
  private _pfield = 4;
  private _value = 1;

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
      note.setPField((fieldVal * this._value).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'MultiplyProcessor';
  }

  override deepCopy(): MultiplyProcessor {
    const copy = new MultiplyProcessor();
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

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): MultiplyProcessor {
    validateProcessorXml(data, 'MultiplyProcessor', context);
    const proc = new MultiplyProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    else {
      const alias = data.getTextString('pFieldIndex');
      if (alias !== null) proc._pfield = Number(alias);
    }
    const v = data.getTextString('value');
    if (v !== null) proc._value = parseFloat(v);
    return proc;
  }
}
