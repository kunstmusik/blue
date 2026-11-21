import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { ValueTimeMapper } from './value-time-mapper';

const JAVA_TYPE = 'blue.noteProcessor.LineAddProcessor';

/** Adds a value from a beat/value curve to a p-field on each note. */
export class LineAddProcessor extends NoteProcessor {
  private _lineAddString = '0 0';
  private _pfield = 4;

  /** Creates a line add processor initialized with its default settings. */
  constructor();
  /** Creates a line add processor using the source instance’s settings. */
  constructor(src: LineAddProcessor);
  constructor(src?: LineAddProcessor) {
    super();
    if (src) {
      this._lineAddString = src._lineAddString;
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

  /** Returns the line add string stored on the line add processor. */
  getLineAddString(): string {
    return this._lineAddString;
  }
  /** Sets the line add string stored on the line add processor. */
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

  /** Reconstructs the line add processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): LineAddProcessor {
    validateProcessorXml(data, 'LineAddProcessor', context);
    const proc = new LineAddProcessor();
    const pf = data.getTextString('pfield');
    if (pf !== null) proc._pfield = parseInt(pf, 10);
    const las = data.getTextString('lineAddString');
    if (las !== null) proc._lineAddString = las;
    return proc;
  }
}
