import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { getBaseTen } from '../utilities/score';

const JAVA_TYPE = 'blue.noteProcessor.PchInversionProcessor';

/** Inverts values in Csound octave.pitch-class notation around a pitch. */
export class PchInversionProcessor extends NoteProcessor {
  private _value = 8.0;
  private _pfield = 4;

  /** Creates a pitch-class inversion processor initialized with its default settings. */
  constructor();
  /** Creates a pitch-class inversion processor using the source instance’s settings. */
  constructor(src: PchInversionProcessor);
  constructor(src?: PchInversionProcessor) {
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

  /** Returns the pitch-class inversion center as text. */
  getVal(): string {
    return this._value.toString();
  }
  /** Sets the pitch-class value used as the inversion center. */
  setVal(value: string): void {
    this._value = parseFloat(value);
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

      const baseTen = getBaseTen(val);
      const baseTenAxis = getBaseTen(this.getVal());

      const addVal = -1 * (baseTen - baseTenAxis);
      const result = baseTenAxis + addVal;

      const octave = Math.trunc(result / 12);
      const strPch = (result % 12) / 100;

      temp.setPField((octave + strPch).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'PchInversionProcessor';
  }

  override deepCopy(): PchInversionProcessor {
    return new PchInversionProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this.getPfield());
    elem.addElement('value').setText(this.getVal());
    return elem;
  }

  /** Reconstructs the pitch-class inversion processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): PchInversionProcessor {
    validateProcessorXml(data, 'PchInversionProcessor', context);
    const proc = new PchInversionProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const v = data.getTextString('value');
    if (v !== null) proc._value = parseFloat(v);
    return proc;
  }
}
