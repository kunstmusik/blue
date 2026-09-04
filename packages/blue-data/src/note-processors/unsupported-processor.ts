import { Element } from '../serialization/xml-reader';
import { NoteList } from '../sound-objects/note-list';
import { NoteProcessor } from './note-processor';

export class UnsupportedProcessor extends NoteProcessor {
  private _originalType = '';
  private _xml: Element | null = null;

  getOriginalType(): string {
    return this._originalType;
  }

  override process(notes: NoteList): NoteList {
    return notes;
  }

  override getDisplayName(): string {
    return `[unsupported: ${this._originalType}]`;
  }

  override deepCopy(): UnsupportedProcessor {
    const copy = new UnsupportedProcessor();
    copy._originalType = this._originalType;
    copy._xml = this._xml?.clone() ?? null;
    return copy;
  }

  saveAsXML(): Element {
    return this._xml?.clone() ?? new Element('noteProcessor');
  }

  static loadFromXML(data: Element, originalType: string): UnsupportedProcessor {
    const proc = new UnsupportedProcessor();
    proc._originalType = originalType || data.getAttribute('type') || '';
    proc._xml = data.clone();
    if (!proc._xml.getAttribute('type')) {
      proc._xml.setAttribute('type', proc._originalType);
    }

    return proc;
  }
}
