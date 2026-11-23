import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.InversionProcessor';

/** Mirrors a numeric p-field around a configured center value. */
export class InversionProcessor extends NoteProcessor {
  private _value = 10;
  private _pfield = 4;

  /** Creates an inversion processor initialized with its default settings. */
  constructor();
  /** Creates an inversion processor using the source instance’s settings. */
  constructor(src: InversionProcessor);
  constructor(src?: InversionProcessor) {
    super();
    if (src) {
      this._value = src._value;
      this._pfield = src._pfield;
    }
  }

  /** Returns the one-based Csound p-field index. */
  getPfield(): string {
    return this._pfield.toString();
  }
  /** Sets the one-based Csound p-field index. */
  setPfield(pfield: string): void {
    this._pfield = parseInt(pfield, 10);
  }

  /** Returns the inversion center as editable text. */
  getVal(): string {
    return this._value.toString();
  }
  /** Sets the numeric center around which the selected p-field is mirrored. */
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

  /** Reconstructs the inversion processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): InversionProcessor {
    validateProcessorXml(data, 'InversionProcessor', context);
    const proc = new InversionProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const v = data.getTextString('value');
    if (v !== null) proc._value = parseFloat(v);
    return proc;
  }
}
