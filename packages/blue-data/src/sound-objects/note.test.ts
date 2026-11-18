import { describe, expect, it } from 'vite-plus/test';
import { Note } from './note';

describe('Note', () => {
  it('seeds blank notes with Java-compatible zero-based pfields', () => {
    const note = Note.createNote(4);

    expect(note.getPField(1)).toBe('0');
    expect(note.getPField(2)).toBe('1');
    expect(note.getPField(3)).toBe('2');
    expect(note.getPField(4)).toBe('3');
  });

  it('keeps p2 in sync when the start time changes', () => {
    const note = Note.createNote(4);

    note.setStartTime(12.5);

    expect(note.getStartTime()).toBe(12.5);
    expect(note.getPField(2)).toBe('12.5');
  });

  it('rejects uppercase I note text', () => {
    expect(Note.createNoteFromText('I1 0 1 440')).toBeNull();
    expect(Note.createNoteFromText('i1 0 1 440')).not.toBeNull();
  });
});
