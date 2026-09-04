import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { ValueTimeMapper } from './value-time-mapper';

const JAVA_TYPE = 'blue.noteProcessor.LineMultiplyProcessor';

export class LineMultiplyProcessor extends NoteProcessor {
  private _lineMultiplyString = '0 1';
  private _pfield = 4;

  constructor();
  constructor(src: LineMultiplyProcessor);
  constructor(src?: LineMultiplyProcessor) {
    super();
    if (src) {
      this._lineMultiplyString = src._lineMultiplyString;
      this._pfield = src._pfield;
    }
  }

  getPfield(): string {
    return this._pfield.toString();
  }
  setPfield(pfield: string): void {
    this._pfield = parseInt(pfield, 10);
  }

  getLineMultiplyString(): string {
    return this._lineMultiplyString;
  }
  setLineMultiplyString(lineMultiplyString: string): void {
    this._lineMultiplyString = lineMultiplyString;
  }

  override process(notes: NoteList): NoteList {
    const tm = ValueTimeMapper.createValueTimeMapper(this._lineMultiplyString);
    if (tm === null) {
      throw new NoteProcessorException('Error in line multiply string', this._pfield);
    }

    for (const note of notes) {
      let oldVal: number;
      let multiplyVal: number;
      try {
        oldVal = parseFloat(note.getPField(this._pfield)!);
        multiplyVal = tm.getValueForBeat(note.getStartTime());
      } catch {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      if (isNaN(oldVal)) {
        throw new NoteProcessorException('Pfield is not a double', this._pfield);
      }
      if (isNaN(multiplyVal)) {
        throw new NoteProcessorException('Note beat out of range', this._pfield);
      }
      note.setPField((oldVal * multiplyVal).toString(), this._pfield);
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'LineMultiplyProcessor';
  }

  override deepCopy(): LineMultiplyProcessor {
    return new LineMultiplyProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('pfield').setText(this.getPfield());
    elem.addElement('lineMultiplyString').setText(this.getLineMultiplyString());
    return elem;
  }

  static loadFromXML(data: Element): LineMultiplyProcessor {
    const proc = new LineMultiplyProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const lms = data.getTextString('lineMultiplyString');
    if (lms !== null) proc._lineMultiplyString = lms;
    return proc;
  }
}
