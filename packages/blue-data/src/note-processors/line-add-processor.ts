import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { ValueTimeMapper } from './value-time-mapper';

const JAVA_TYPE = 'blue.noteProcessor.LineAddProcessor';

export class LineAddProcessor extends NoteProcessor {
  private _lineAddString = '0 0';
  private _pfield = 4;

  constructor();
  constructor(src: LineAddProcessor);
  constructor(src?: LineAddProcessor) {
    super();
    if (src) {
      this._lineAddString = src._lineAddString;
      this._pfield = src._pfield;
    }
  }

  getPfield(): string {
    return this._pfield.toString();
  }
  setPfield(pfield: string): void {
    this._pfield = parseInt(pfield, 10);
  }

  getLineAddString(): string {
    return this._lineAddString;
  }
  setLineAddString(lineAddString: string): void {
    this._lineAddString = lineAddString;
  }

  override process(notes: NoteList): NoteList {
    const tm = ValueTimeMapper.createValueTimeMapper(this._lineAddString);
    if (tm === null) {
      throw new NoteProcessorException('Error in line add string', this._pfield);
    }

    for (const note of notes) {
      let oldVal: number;
      let addVal: number;
      try {
        oldVal = parseFloat(note.getPField(this._pfield)!);
        addVal = tm.getValueForBeat(note.getStartTime());
      } catch {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      if (isNaN(oldVal)) {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      if (isNaN(addVal)) {
        throw new NoteProcessorException('Note beat out of range', this._pfield);
      }
      note.setPField((oldVal + addVal).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'LineAddProcessor';
  }

  override deepCopy(): LineAddProcessor {
    return new LineAddProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this.getPfield());
    elem.addElement('lineAddString').setText(this.getLineAddString());
    return elem;
  }

  static loadFromXML(data: Element): LineAddProcessor {
    const proc = new LineAddProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const las = data.getTextString('lineAddString');
    if (las !== null) proc._lineAddString = las;
    return proc;
  }
}
