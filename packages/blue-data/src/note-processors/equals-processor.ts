import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.EqualsProcessor';

/** Replaces a selected p-field on each note with a constant string. */
export class EqualsProcessor extends NoteProcessor {
  private _value = '2.0';
  private _pfield = 4;

  /** Creates an equals processor initialized with its default settings. */
  constructor();
  /** Creates an equals processor using the source instance’s settings. */
  constructor(src: EqualsProcessor);
  constructor(src?: EqualsProcessor) {
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

  /** Returns the replacement p-field text. */
  getVal(): string {
    return this._value;
  }
  /** Sets the exact text written to the selected p-field. */
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

  /** Reconstructs the equals processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): EqualsProcessor {
    validateProcessorXml(data, 'EqualsProcessor', context);
    const proc = new EqualsProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const v = data.getTextString('value');
    if (v !== null) proc._value = v;
    return proc;
  }
}
