import { NoteProcessor } from './note-processor';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.Code';

export class Code extends NoteProcessor {
  private _code = '';

  getCode(): string {
    return this._code;
  }
  setCode(code: string): void {
    this._code = code;
  }

  override process(notes: NoteList): NoteList {
    return notes;
  }

  override getDisplayName(): string {
    return 'Code';
  }

  override deepCopy(): Code {
    const copy = new Code();
    copy._code = this._code;
    return copy;
  }

  saveAsXML(): Element {
    const elem = new Element('noteProcessor');
    elem.setAttribute('type', JAVA_TYPE);
    elem.addElement('code').setText(this._code);
    return elem;
  }

  static loadFromXML(data: Element): Code {
    const proc = new Code();
    const code = data.getTextString('code');
    if (code !== null) proc._code = code;
    return proc;
  }
}
