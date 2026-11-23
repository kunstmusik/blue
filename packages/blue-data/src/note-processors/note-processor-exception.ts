/**
 * NoteProcessorException — thrown when a note processor encounters an error.
 * Mirrors the Java NoteProcessorException class.
 */
export class NoteProcessorException extends Error {
  /** One-based Csound p-field index. */
  public readonly pfield: number;

  /** Creates a processing diagnostic with the affected p-field index and optional cause. */
  constructor(message: string, pfield: number, cause?: Error) {
    super(message);
    this.name = 'NoteProcessorException';
    this.pfield = pfield;
    if (cause) this.cause = cause;
  }
}
