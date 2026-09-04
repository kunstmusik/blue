import { NoteProcessor } from './note-processor';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.RetrogradeProcessor';

export class RetrogradeProcessor extends NoteProcessor {
  constructor();
  constructor(_src: RetrogradeProcessor);
  constructor(_src?: RetrogradeProcessor) {
    super();
  }

  override process(notes: NoteList): NoteList {
    notes.sort();
    const size = notes.length;
    if (size === 0) return notes;

    const lastNote = notes.getNote(size - 1);
    const totalTime = lastNote.getStartTime() + lastNote.getSubjectiveDuration();

    for (let i = 0; i < size; i++) {
      const temp = notes.getNote(i);
      temp.setStartTime(totalTime - (temp.getStartTime() + temp.getSubjectiveDuration()));
    }
    return notes;
  }

  override getDisplayName(): string {
    return 'RetrogradeProcessor';
  }

  override deepCopy(): RetrogradeProcessor {
    return new RetrogradeProcessor();
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    return elem;
  }

  static loadFromXML(_data: Element): RetrogradeProcessor {
    return new RetrogradeProcessor();
  }
}
