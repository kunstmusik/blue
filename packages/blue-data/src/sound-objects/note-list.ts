import { Note } from './note';

/** Ordered collection of Csound notes with operations for merging, sorting, and copying. */
export class NoteList {
  private _notes: Note[] = [];

  /** Creates an empty note list or shallowly copies the supplied array of note instances. */
  constructor(initial?: Note[]) {
    if (initial) {
      this._notes = [...initial];
    }
  }

  /** Number of notes in the list. */
  get length(): number {
    return this._notes.length;
  }
  /** Number of notes in the list. */
  get size(): number {
    return this._notes.length;
  }

  /** Gets the note at the supplied zero-based index. */
  get(index: number): Note {
    return this._notes[index];
  }
  /** Returns the entry at the supplied index in the note list’s notes. */
  getNote(index: number): Note {
    return this._notes[index];
  }

  /** Appends the supplied note instance. */
  add(note: Note): void {
    this._notes.push(note);
  }
  /** Appends the supplied note instance to the end of the list. */
  push(note: Note): void {
    this._notes.push(note);
  }

  /** Removes all notes from this list. */
  clear(): void {
    this._notes = [];
  }

  /** Appends the notes from another list in their existing order. */
  merge(other: NoteList): void {
    for (let i = 0; i < other.length; i++) {
      this._notes.push(other.getNote(i));
    }
  }

  /** Sorts the list using its note ordering. */
  sort(): void {
    this._notes.sort((a, b) => a.getStartTime() - b.getStartTime());
  }

  /** Sorts notes in ascending start-time order. */
  sortByStartTime(): void {
    this.sort();
  }

  /** Removes notes that match the supplied predicate. */
  removeIf(predicate: (note: Note) => boolean): void {
    this._notes = this._notes.filter((n) => !predicate(n));
  }

  /** Shifts note positions so the earliest note starts at zero. */
  normalizeNoteList(): void {
    if (this._notes.length === 0) return;
    this.sort();
    const minStart = this._notes[0].getStartTime();
    for (const note of this._notes) {
      note.setStartTime(note.getStartTime() - minStart);
    }
  }

  /** Copies the note list and its editable state. */
  deepCopy(): NoteList {
    const copy = new NoteList();
    for (const note of this._notes) {
      copy.push(note.deepCopy());
    }
    return copy;
  }

  /** Returns an iterator over the stored entries in order. */
  *[Symbol.iterator](): Iterator<Note> {
    for (const note of this._notes) {
      yield note;
    }
  }

  /** Applies a mapping function to the ordered notes and returns the resulting array. */
  map<T>(fn: (note: Note, index: number) => T): T[] {
    return this._notes.map(fn);
  }

  /** Removes the note at the supplied index in place. */
  _removeAt(index: number): void {
    this._notes.splice(index, 1);
  }

  /** Replaces the underlying note sequence with the supplied entries. */
  _replaceContents(other: NoteList): void {
    this._notes = [];
    for (let i = 0; i < other.length; i++) {
      this._notes.push(other.getNote(i));
    }
  }

  /** Formats the note list using Csound score syntax. */
  toScoreText(): string {
    return this._notes.map((n) => n.toScoreText()).join('\n');
  }

  /** Formats the note list as Csound score text. */
  toString(): string {
    return this.toScoreText();
  }
}
