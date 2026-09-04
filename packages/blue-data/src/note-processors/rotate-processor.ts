import { NoteProcessor } from './note-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';
import { normalizeNoteList } from '../utilities/score';

const JAVA_TYPE = 'blue.noteProcessor.RotateProcessor';

export class RotateProcessor extends NoteProcessor {
  private _noteIndex = 1;

  constructor();
  constructor(src: RotateProcessor);
  constructor(src?: RotateProcessor) {
    super();
    if (src) {
      this._noteIndex = src._noteIndex;
    }
  }

  getNoteIndex(): string {
    return this._noteIndex.toString();
  }
  setNoteIndex(noteIndex: string): void {
    this._noteIndex = parseInt(noteIndex, 10);
  }

  override process(notes: NoteList): NoteList {
    if (notes.length < 2 || this._noteIndex === 1) {
      return notes;
    }

    notes.sort();

    const lastNote = notes.getNote(notes.length - 1);
    const startTime = lastNote.getStartTime() + lastNote.getSubjectiveDuration();

    let index = this._noteIndex;
    if (index > 0) {
      index = index - 1;
    } else {
      index = notes.length + index;
    }

    if (index > notes.length) {
      throw new NoteProcessorException('Rotate index out of bounds', index);
    }

    const rotated = new NoteList();
    for (let i = index; i < notes.length; i++) {
      rotated.push(notes.getNote(i));
    }
    for (let i = 0; i < index; i++) {
      rotated.push(notes.getNote(i));
    }

    let idx = notes.length - index;
    while (idx < notes.length) {
      const n = rotated.getNote(idx);
      n.setStartTime(n.getStartTime() + startTime);
      idx++;
    }

    notes.clear();
    notes.merge(rotated);

    normalizeNoteList(notes);
    return notes;
  }

  override getDisplayName(): string {
    return 'RotateProcessor';
  }

  override deepCopy(): RotateProcessor {
    return new RotateProcessor(this);
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('noteIndex').setText(this.getNoteIndex());
    return elem;
  }

  static loadFromXML(data: Element): RotateProcessor {
    const proc = new RotateProcessor();
    const ni = data.getTextString('noteIndex');
    if (ni !== null) proc._noteIndex = parseInt(ni, 10);
    return proc;
  }
}
