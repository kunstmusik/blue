import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.EqualsProcessor';

export class EqualsProcessor extends NoteProcessor {
  private _value = '2.0';
  private _pfield = 4;

  constructor();
  constructor(src: EqualsProcessor);
  constructor(src?: EqualsProcessor) {
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
    return this._value;
  }
  setVal(value: string): void {
    this._value = value;
  }

  override process(notes: NoteList): NoteList {
    for (const note of notes) {
      try {
        if (this._pfield === 3) {
          note.setSubjectiveDuration(parseFloat(this._value));
        } else {
          note.setPField(this._value, this._pfield);
        }
      } catch {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'EqualsProcessor';
  }

  override deepCopy(): EqualsProcessor {
    return new EqualsProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this.getPfield());
    elem.addElement('value').setText(this.getVal());
    return elem;
  }

  static loadFromXML(data: Element): EqualsProcessor {
    const proc = new EqualsProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const v = data.getTextString('value');
    if (v !== null) proc._value = v;
    return proc;
  }
}
