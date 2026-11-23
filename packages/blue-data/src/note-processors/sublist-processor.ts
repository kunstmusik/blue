import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { normalizeNoteList } from '../utilities/score';

const JAVA_TYPE = 'blue.noteProcessor.SubListProcessor';

/** Selects an inclusive one-based range of notes and normalizes their starts. */
export class SubListProcessor extends NoteProcessor {
  private _start = 1;
  private _end = 2;

  /** Creates a sub list processor initialized with its default settings. */
  constructor();
  /** Creates a sub list processor using the source instance’s settings. */
  constructor(src: SubListProcessor);
  constructor(src?: SubListProcessor) {
    super();
    if (src) {
      this._start = src._start;
      this._end = src._end;
    }
  }

  /** Returns the configured first note index as editable text. */
  getStart(): string {
    return this._start.toString();
  }
  /** Sets the inclusive one-based start index. */
  setStart(start: string): void {
    this._start = parseInt(start, 10);
  }

  /** Returns the configured last note index as editable text. */
  getEnd(): string {
    return this._end.toString();
  }
  /** Sets the inclusive one-based end index. */
  setEnd(end: string): void {
    this._end = parseInt(end, 10);
  }

  override process(notes: NoteList): NoteList {
    if (this._end < 1) {
      throw new NoteProcessorException('Note list end value is less than 1', this._end);
    }

    const tempList = new NoteList();
    for (let i = 0; i < notes.length; i++) {
      if (i >= this._start - 1 && i <= this._end - 1) {
        tempList.push(notes.getNote(i));
      }
    }

    normalizeNoteList(tempList);
    return tempList;
  }

  override getDisplayName(): string {
    return 'SubListProcessor';
  }

  override deepCopy(): SubListProcessor {
    return new SubListProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('start').setText(this.getStart());
    elem.addElement('end').setText(this.getEnd());
    return elem;
  }

  /** Reconstructs the sub list processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): SubListProcessor {
    validateProcessorXml(data, 'SubListProcessor', context);
    const proc = new SubListProcessor();
    const s = data.getTextString('start');
    if (s !== null) proc._start = parseInt(s, 10);
    const e = data.getTextString('end');
    if (e !== null) proc._end = parseInt(e, 10);
    return proc;
  }
}
