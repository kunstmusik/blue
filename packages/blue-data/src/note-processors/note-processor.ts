/**
 * NoteProcessor — abstract base class for note processors.
 * Mirrors the Java NoteProcessor class.
 */
import type { CompileData } from '../compile-data';
import { NoteList } from '../sound-objects/note-list';
import { Element } from '../serialization/xml-reader';

/** Base contract for transformations over generated Csound note lists. */
export abstract class NoteProcessor {
  /**
   * Process a NoteList, potentially modifying or replacing notes.
   */
  abstract process(notes: NoteList): NoteList;

  /** Runs the processor asynchronously. The base implementation delegates to synchronous processing. */
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
