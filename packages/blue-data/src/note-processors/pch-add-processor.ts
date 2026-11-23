import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { getBaseTen } from '../utilities/score';

const JAVA_TYPE = 'blue.noteProcessor.PchAddProcessor';

/** Transposes values in Csound octave.pitch-class notation. */
export class PchAddProcessor extends NoteProcessor {
  private _value = 0;
  private _pfield = 4;

  /** Creates a pitch-class add processor initialized with its default settings. */
  constructor();
  /** Creates a pitch-class add processor using the source instance’s settings. */
  constructor(src: PchAddProcessor);
  constructor(src?: PchAddProcessor) {
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
    const p = parseInt(pfield, 10);
    if (p > 3) {
      this._pfield = p;
    }
  }

  /** Returns the pitch-class transposition amount as text. */
  getVal(): string {
    return this._value.toString();
  }
  /** Sets the pitch-class interval added to the selected p-field. */
  setVal(value: string): void {
    this._value = parseInt(value, 10);
  }

  override process(notes: NoteList): NoteList {
    for (let i = 0; i < notes.length; i++) {
      const temp = notes.getNote(i);
      let val: string;
      try {
        val = temp.getPField(this._pfield)!.trim();
        parseFloat(val);
      } catch {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      if (isNaN(parseFloat(val))) {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }

      let baseTen = getBaseTen(val);
      baseTen += this._value;

      const octave = Math.trunc(baseTen / 12);
      const strPch = (baseTen % 12) / 100;

      temp.setPField((octave + strPch).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'PchAddProcessor';
  }

  override deepCopy(): PchAddProcessor {
    return new PchAddProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this.getPfield());
    elem.addElement('value').setText(this.getVal());
    return elem;
  }

  /** Reconstructs the pitch-class transposition processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): PchAddProcessor {
    validateProcessorXml(data, 'PchAddProcessor', context);
    const proc = new PchAddProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const v = data.getTextString('value');
    if (v !== null) proc._value = parseInt(v, 10);
    return proc;
  }
}
