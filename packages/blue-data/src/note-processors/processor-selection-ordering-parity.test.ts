import { describe, expect, it } from 'vitest';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import { SubListProcessor } from './sublist-processor';
import { RotateProcessor } from './rotate-processor';
import { RetrogradeProcessor } from './retrograde-processor';
import { EqualsProcessor } from './equals-processor';
import { SwitchProcessor } from './switch-processor';
import { NoteProcessorException } from './note-processor-exception';

function makeNote(p4: string, start = 0, dur = 1): Note {
  const n = Note.createNote(6);
  n.setPField(p4, 4);
  n.setPField('99', 5);
  n.setStartTime(start);
  n.setSubjectiveDuration(dur);
  return n;
}

describe('SubListProcessor parity', () => {
  it('extracts sublist from notes', () => {
    const proc = new SubListProcessor();
    proc.setStart('1');
    proc.setEnd('2');
    const nl = new NoteList([makeNote('A', 0), makeNote('B', 1), makeNote('C', 2)]);
    const result = proc.process(nl);
    expect(result.length).toBe(2);
    expect(result.getNote(0).getPField(4)).toBe('A');
    expect(result.getNote(1).getPField(4)).toBe('B');
  });

  it('normalizes result start times', () => {
    const proc = new SubListProcessor();
    proc.setStart('2');
    proc.setEnd('3');
    const nl = new NoteList([makeNote('A', 0), makeNote('B', 5), makeNote('C', 10)]);
    const result = proc.process(nl);
    expect(result.length).toBe(2);
    expect(result.getNote(0).getStartTime()).toBe(0);
  });

  it('throws when end < 1', () => {
    const proc = new SubListProcessor();
    proc.setEnd('0');
    const nl = new NoteList([makeNote('A')]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });

  it('selects single note when start equals end', () => {
    const proc = new SubListProcessor();
    proc.setStart('2');
    proc.setEnd('2');
    const nl = new NoteList([makeNote('A', 0), makeNote('B', 1), makeNote('C', 2)]);
    const result = proc.process(nl);
    expect(result.length).toBe(1);
    expect(result.getNote(0).getPField(4)).toBe('B');
  });
});

describe('RotateProcessor parity', () => {
  it('returns unchanged when fewer than 2 notes', () => {
    const proc = new RotateProcessor();
    const nl = new NoteList([makeNote('A')]);
    const result = proc.process(nl);
    expect(result.getNote(0).getPField(4)).toBe('A');
  });

  it('returns unchanged when noteIndex is 1', () => {
    const proc = new RotateProcessor();
    proc.setNoteIndex('1');
    const nl = new NoteList([makeNote('A', 0), makeNote('B', 1)]);
    const result = proc.process(nl);
    expect(result.getNote(0).getPField(4)).toBe('A');
  });

  it('rotates notes by index', () => {
    const proc = new RotateProcessor();
    proc.setNoteIndex('2');
    const nl = new NoteList([makeNote('A', 0, 1), makeNote('B', 1, 1), makeNote('C', 2, 1)]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('B');
    expect(nl.getNote(1).getPField(4)).toBe('C');
    expect(nl.getNote(2).getPField(4)).toBe('A');
  });
});

describe('RetrogradeProcessor parity', () => {
  it('mirrors note start times in time (Java does not reverse list order)', () => {
    const proc = new RetrogradeProcessor();
    const nl = new NoteList([makeNote('A', 0, 2), makeNote('B', 2, 2), makeNote('C', 4, 2)]);
    proc.process(nl);
    expect(nl.getNote(0).getStartTime()).toBeCloseTo(4, 5);
    expect(nl.getNote(1).getStartTime()).toBeCloseTo(2, 5);
    expect(nl.getNote(2).getStartTime()).toBeCloseTo(0, 5);
  });

  it('handles single note', () => {
    const proc = new RetrogradeProcessor();
    const nl = new NoteList([makeNote('A', 0, 2)]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('A');
    expect(nl.getNote(0).getStartTime()).toBe(0);
  });
});

describe('EqualsProcessor parity', () => {
  it('sets pfield to exact value', () => {
    const proc = new EqualsProcessor();
    proc.setVal('42');
    const nl = new NoteList([makeNote('10')]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('42');
  });

  it('sets subjectiveDuration when pfield is 3', () => {
    const proc = new EqualsProcessor();
    proc.setPfield('3');
    proc.setVal('5');
    const n = Note.createNote(4);
    n.setSubjectiveDuration(1);
    const nl = new NoteList([n]);
    proc.process(nl);
    expect(nl.getNote(0).getSubjectiveDuration()).toBe(5);
  });

  it('handles string value', () => {
    const proc = new EqualsProcessor();
    proc.setVal('8.04');
    const nl = new NoteList([makeNote('10')]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('8.04');
  });
});

describe('SwitchProcessor parity', () => {
  it('swaps two pfields', () => {
    const proc = new SwitchProcessor();
    proc.setPfield1('4');
    proc.setPfield2('5');
    const n = Note.createNote(6);
    n.setPField('hello', 4);
    n.setPField('world', 5);
    const nl = new NoteList([n]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('world');
    expect(nl.getNote(0).getPField(5)).toBe('hello');
  });

  it('throws when pfield out of range', () => {
    const proc = new SwitchProcessor();
    proc.setPfield1('4');
    proc.setPfield2('99');
    const n = Note.createNote(5);
    n.setPField('x', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });
});
