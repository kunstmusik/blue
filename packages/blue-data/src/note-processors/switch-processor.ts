import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.SwitchProcessor';

export class SwitchProcessor extends NoteProcessor {
  private _pfield1 = 4;
  private _pfield2 = 5;

  constructor();
  constructor(src: SwitchProcessor);
  constructor(src?: SwitchProcessor) {
    super();
    if (src) {
      this._pfield1 = src._pfield1;
      this._pfield2 = src._pfield2;
    }
  }

  getPfield1(): string {
    return this._pfield1.toString();
  }
  setPfield1(pfield1: string): void {
    this._pfield1 = parseInt(pfield1, 10);
  }

  getPfield2(): string {
    return this._pfield2.toString();
  }
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

  static loadFromXML(data: Element): SwitchProcessor {
    const proc = new SwitchProcessor();
    const p1 = data.getTextString('pfield1');
    if (p1 !== null) proc._pfield1 = parseInt(p1, 10);
    const p2 = data.getTextString('pfield2');
    if (p2 !== null) proc._pfield2 = parseInt(p2, 10);
    return proc;
  }
}
