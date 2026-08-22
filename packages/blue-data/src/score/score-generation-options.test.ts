import { describe, expect, it } from 'vitest';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import {
  applyTrackInstrumentOverride,
  markTrackInstrumentTargets,
  replaceTrackInstrumentP1,
} from './score-generation-options';

describe('Track score generation options', () => {
  it.each([
    ['3', '17'],
    ['3.5', '17.5'],
    ['-3', '-17'],
    ['-3.5', '-17.5'],
    ['"lead"', '17'],
    ['lead.main', '17'],
  ])('replaces the instrument portion of %s while preserving suffix semantics', (input, expected) => {
    expect(replaceTrackInstrumentP1(input, 17)).toBe(expected);
  });

  it.each(['', '3abc', '1..2', '1i'])('preserves malformed or empty authored p1 %s', (input) => {
    expect(replaceTrackInstrumentP1(input, 17)).toBe(input);
  });

  it('only changes notes explicitly marked assignable', () => {
    const assignable = Note.createNoteFromText('i3 0 1 440');
    const preserved = Note.createNoteFromText('i4 0 1 440');
    const unmarked = Note.createNoteFromText('i5 0 1 440');
    if (!assignable || !preserved || !unmarked) throw new Error('fixture note did not parse');

    assignable.setTrackInstrumentTarget('assignable');
    preserved.setTrackInstrumentTarget('preserve');
    const notes = new NoteList();
    notes.push(assignable);
    notes.push(preserved);
    notes.push(unmarked);
    applyTrackInstrumentOverride(notes, 21);

    expect(assignable.getPField(1)).toBe('21');
    expect(preserved.getPField(1)).toBe('4');
    expect(unmarked.getPField(1)).toBe('5');
  });

  it('marks eligible notes transiently without changing score text', () => {
    const note = Note.createNoteFromText('i3 0 1 440');
    if (!note) throw new Error('fixture note did not parse');
    const notes = new NoteList();
    notes.push(note);
    const authored = note.toScoreText();

    markTrackInstrumentTargets(notes, 'assignable');

    expect(note.getTrackInstrumentTarget()).toBe('assignable');
    expect(note.toScoreText()).toBe(authored);
  });
});
