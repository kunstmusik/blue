import { Note } from './note';

export class NoteList {
  private _notes: Note[] = [];

  constructor(initial?: Note[]) {
    if (initial) {
      this._notes = [...initial];
    }
  }

  get length(): number {
    return this._notes.length;
  }
  get size(): number {
    return this._notes.length;
  }

  get(index: number): Note {
    return this._notes[index];
  }
  getNote(index: number): Note {
    return this._notes[index];
  }

  add(note: Note): void {
    this._notes.push(note);
  }
  push(note: Note): void {
    this._notes.push(note);
  }

  clear(): void {
    this._notes = [];
  }

  merge(other: NoteList): void {
    for (let i = 0; i < other.length; i++) {
      this._notes.push(other.getNote(i));
    }
  }

  sort(): void {
    this._notes.sort((a, b) => a.getStartTime() - b.getStartTime());
  }

  sortByStartTime(): void {
    this.sort();
  }

  removeIf(predicate: (note: Note) => boolean): void {
    this._notes = this._notes.filter((n) => !predicate(n));
  }

  normalizeNoteList(): void {
    if (this._notes.length === 0) return;
    this.sort();
    const minStart = this._notes[0].getStartTime();
    for (const note of this._notes) {
      note.setStartTime(note.getStartTime() - minStart);
    }
  }

  deepCopy(): NoteList {
    const copy = new NoteList();
    for (const note of this._notes) {
      copy.push(note.deepCopy());
    }
    return copy;
  }

  *[Symbol.iterator](): Iterator<Note> {
    for (const note of this._notes) {
      yield note;
    }
  }

  map<T>(fn: (note: Note, index: number) => T): T[] {
    return this._notes.map(fn);
  }

  _removeAt(index: number): void {
    this._notes.splice(index, 1);
  }

  _replaceContents(other: NoteList): void {
    this._notes = [];
    for (let i = 0; i < other.length; i++) {
      this._notes.push(other.getNote(i));
    }
  }

  toScoreText(): string {
    return this._notes.map((n) => n.toScoreText()).join('\n');
  }

  toString(): string {
    return this.toScoreText();
  }
}
