/**
 * NoteProcessor — abstract base class for note processors.
 * Mirrors the Java NoteProcessor class.
 */
import type { CompileData } from '../compile-data';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

export abstract class NoteProcessor {
  /**
   * Process a NoteList, potentially modifying or replacing notes.
   */
  abstract process(notes: NoteList): NoteList;

  async processAsync(notes: NoteList, _compileData?: CompileData): Promise<NoteList> {
    return this.process(notes);
  }

  /**
   * Get the display name for this processor.
   */
  abstract getDisplayName(): string;

  /**
   * Deep copy this processor.
   */
  abstract deepCopy(): NoteProcessor;

  /**
   * Save to XML. Subclasses must implement this.
   */
  abstract saveAsXML(): Element;
}
