import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.SwitchProcessor';

/** Exchanges the values of two selected p-fields on each note. */
export class SwitchProcessor extends NoteProcessor {
  private _pfield1 = 4;
  private _pfield2 = 5;

  /** Creates a switch processor initialized with its default settings. */
  constructor();
  /** Creates a switch processor using the source instance’s settings. */
  constructor(src: SwitchProcessor);
  constructor(src?: SwitchProcessor) {
    super();
    if (src) {
      this._pfield1 = src._pfield1;
      this._pfield2 = src._pfield2;
    }
  }

  /** Returns the one-based index of the first Csound p-field. */
  getPfield1(): string {
    return this._pfield1.toString();
  }
  /** Sets the one-based index of the first Csound p-field. */
  setPfield1(pfield1: string): void {
    this._pfield1 = parseInt(pfield1, 10);
  }

  /** Returns the one-based index of the second Csound p-field. */
  getPfield2(): string {
    return this._pfield2.toString();
  }
  /** Sets the one-based index of the second Csound p-field. */
  setPfield2(pfield2: string): void {
    this._pfield2 = parseInt(pfield2, 10);
  }

  override process(notes: NoteList): NoteList {
    for (const note of notes) {
      const pcount = note.getPCount();
      if (this._pfield1 < 1 || this._pfield1 >= pcount) {
        throw new NoteProcessorException('Missing pfield', this._pfield1);
      }
      if (this._pfield2 < 1 || this._pfield2 >= pcount) {
        throw new NoteProcessorException('Missing pfield', this._pfield2);
      }

      const tempPField = note.getPField(this._pfield1);
      note.setPField(note.getPField(this._pfield2)!, this._pfield1);
      note.setPField(tempPField!, this._pfield2);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'SwitchProcessor';
  }

  override deepCopy(): SwitchProcessor {
    return new SwitchProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield1').setText(this.getPfield1());
    elem.addElement('pfield2').setText(this.getPfield2());
    return elem;
  }

  /** Reconstructs the switch processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): SwitchProcessor {
    validateProcessorXml(data, 'SwitchProcessor', context);
    const proc = new SwitchProcessor();
    const p1 = data.getTextString('pfield1');
    if (p1 !== null) proc._pfield1 = parseInt(p1, 10);
    const p2 = data.getTextString('pfield2');
    if (p2 !== null) proc._pfield2 = parseInt(p2, 10);
    return proc;
  }
}
