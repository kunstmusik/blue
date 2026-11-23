import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { ValueTimeMapper } from './value-time-mapper';

const JAVA_TYPE = 'blue.noteProcessor.LineMultiplyProcessor';

/** Multiplies a p-field on each note by the value of a beat/value curve. */
export class LineMultiplyProcessor extends NoteProcessor {
  private _lineMultiplyString = '0 1';
  private _pfield = 4;

  /** Creates a line multiply processor initialized with its default settings. */
  constructor();
  /** Creates a line multiply processor using the source instance’s settings. */
  constructor(src: LineMultiplyProcessor);
  constructor(src?: LineMultiplyProcessor) {
    super();
    if (src) {
      this._lineMultiplyString = src._lineMultiplyString;
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

  /** Returns the line multiply string stored on the line multiply processor. */
  getLineMultiplyString(): string {
    return this._lineMultiplyString;
  }
  /** Sets the line multiply string stored on the line multiply processor. */
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

  /** Reconstructs the line multiply processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): LineMultiplyProcessor {
    validateProcessorXml(data, 'LineMultiplyProcessor', context);
    const proc = new LineMultiplyProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const lms = data.getTextString('lineMultiplyString');
    if (lms !== null) proc._lineMultiplyString = lms;
    return proc;
  }
}
