import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.InversionProcessor';

export class InversionProcessor extends NoteProcessor {
  private _value = 10;
  private _pfield = 4;

  constructor();
  constructor(src: InversionProcessor);
  constructor(src?: InversionProcessor) {
    super();
    if (src) {
      this._value = src._value;
      this._pfield = src._pfield;
    }
  }

  getPfield(): string {
    return this._pfield.toString();
  }
  setPfield(pfield: string): void {
    this._pfield = parseInt(pfield, 10);
  }

  getVal(): string {
    return this._value.toString();
  }
  setVal(value: string): void {
    this._value = parseFloat(value);
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
      const addVal = -1 * (fieldVal - this._value);
      note.setPField((this._value + addVal).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'InversionProcessor';
  }

  override deepCopy(): InversionProcessor {
    return new InversionProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this.getPfield());
    elem.addElement('value').setText(this.getVal());
    return elem;
  }

  static loadFromXML(data: Element): InversionProcessor {
    const proc = new InversionProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const v = data.getTextString('value');
    if (v !== null) proc._value = parseFloat(v);
    return proc;
  }
}
