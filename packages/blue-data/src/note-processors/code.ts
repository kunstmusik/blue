import { XmlLoadContext } from '../serialization/xml-load';
import { validateProcessorXml } from './xml-policy';
import { NoteProcessor } from './note-processor';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

const JAVA_TYPE = 'blue.noteProcessor.Code';

/** Preserves the legacy Code processor and its source text. Processing passes the notes through unchanged. */
export class Code extends NoteProcessor {
  private _code = '';

  /** Returns the score statements authored for this processor. */
  getCode(): string {
    return this._code;
  }
  /** Stores the legacy score source text for XML round trips. */
  setCode(code: string): void {
    this._code = code;
  }

  /** Returns the input list unchanged. */
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

  /** Reads the legacy Code processor from its Blue XML element, using the supplied diagnostic context when provided. */
  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Code {
    validateProcessorXml(data, 'Code', context);
    const proc = new Code();
    const code = data.getTextString('code');
    if (code !== null) proc._code = code;
    return proc;
  }
}
