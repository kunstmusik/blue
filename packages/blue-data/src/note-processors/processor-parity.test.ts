import { describe, expect, it } from 'vite-plus/test';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import { AddProcessor } from './add-processor';
import { MultiplyProcessor } from './multiply-processor';
import { PchAddProcessor } from './pch-add-processor';
import { InversionProcessor } from './inversion-processor';
import { PchInversionProcessor } from './pch-inversion-processor';
import { NoteProcessorException } from './note-processor-exception';

function makeNote(p4: string, start = 0, dur = 1): Note {
  const n = Note.createNote(5);
  n.setPField(p4, 4);
  n.setStartTime(start);
  n.setSubjectiveDuration(dur);
  return n;
}

describe('AddProcessor parity', () => {
  it('adds value to pfield 4', () => {
    const proc = new AddProcessor();
    proc.setVal('5');
    const nl = new NoteList([makeNote('10')]);
    const result = proc.process(nl);
    expect(result.getNote(0).getPField(4)).toBe('15');
  });

  it('adds zero by default', () => {
    const proc = new AddProcessor();
    const nl = new NoteList([makeNote('10')]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('10');
  });

  it('adds to multiple notes', () => {
    const proc = new AddProcessor();
    proc.setVal('3');
    const nl = new NoteList([makeNote('1'), makeNote('2'), makeNote('3')]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('4');
    expect(nl.getNote(1).getPField(4)).toBe('5');
    expect(nl.getNote(2).getPField(4)).toBe('6');
  });

  it('works on custom pfield', () => {
    const proc = new AddProcessor();
    proc.setPfield('5');
    proc.setVal('10');
    const n = Note.createNote(6);
    n.setPField('100', 5);
    const nl = new NoteList([n]);
    proc.process(nl);
    expect(n.getPField(5)).toBe('110');
  });

  it('throws on non-numeric pfield', () => {
    const proc = new AddProcessor();
    const n = Note.createNote(5);
    n.setPField('abc', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });

  it('handles negative values', () => {
    const proc = new AddProcessor();
    proc.setVal('-3');
    const nl = new NoteList([makeNote('10')]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('7');
  });
});

describe('MultiplyProcessor parity', () => {
  it('multiplies pfield by value', () => {
    const proc = new MultiplyProcessor();
    proc.setVal('2');
    const nl = new NoteList([makeNote('5')]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('10');
  });

  it('multiplies by 1 by default (identity)', () => {
    const proc = new MultiplyProcessor();
    const nl = new NoteList([makeNote('7')]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('7');
  });

  it('multiplies multiple notes', () => {
    const proc = new MultiplyProcessor();
    proc.setVal('3');
    const nl = new NoteList([makeNote('1'), makeNote('2')]);
    proc.process(nl);
    expect(nl.getNote(0).getPField(4)).toBe('3');
    expect(nl.getNote(1).getPField(4)).toBe('6');
  });

  it('throws on non-numeric pfield', () => {
    const proc = new MultiplyProcessor();
    const n = Note.createNote(5);
    n.setPField('xyz', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });
});

describe('PchAddProcessor parity', () => {
  it('adds semitones to pch value', () => {
    const proc = new PchAddProcessor();
    proc.setVal('2');
    const nl = new NoteList([makeNote('8.00')]);
    proc.process(nl);
    const result = parseFloat(nl.getNote(0).getPField(4)!);
    expect(result).toBeCloseTo(8.02, 1);
  });

  it('adds zero semitones (identity)', () => {
    const proc = new PchAddProcessor();
    const nl = new NoteList([makeNote('8.06')]);
    proc.process(nl);
    const result = parseFloat(nl.getNote(0).getPField(4)!);
    expect(result).toBeCloseTo(8.06, 1);
  });

  it('wraps across octave boundary', () => {
    const proc = new PchAddProcessor();
    proc.setVal('12');
    const nl = new NoteList([makeNote('8.00')]);
    proc.process(nl);
    const result = parseFloat(nl.getNote(0).getPField(4)!);
    expect(result).toBeCloseTo(9, 1);
  });

  it('throws on non-numeric pfield', () => {
    const proc = new PchAddProcessor();
    const n = Note.createNote(5);
    n.setPField('abc', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });
});

describe('InversionProcessor parity', () => {
  it('inverts pfield value around axis', () => {
    const proc = new InversionProcessor();
    proc.setVal('10');
    const nl = new NoteList([makeNote('14')]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(6, 5);
  });

  it('inverts symmetrically', () => {
    const proc = new InversionProcessor();
    proc.setVal('10');
    const nl = new NoteList([makeNote('6')]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(14, 5);
  });

  it('leaves axis value unchanged', () => {
    const proc = new InversionProcessor();
    proc.setVal('10');
    const nl = new NoteList([makeNote('10')]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(10, 5);
  });

  it('handles multiple notes', () => {
    const proc = new InversionProcessor();
    proc.setVal('10');
    const nl = new NoteList([makeNote('4'), makeNote('16')]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(16, 5);
    expect(parseFloat(nl.getNote(1).getPField(4)!)).toBeCloseTo(4, 5);
  });
});

describe('PchInversionProcessor parity', () => {
  it('inverts pch value around axis', () => {
    const proc = new PchInversionProcessor();
    proc.setVal('8.00');
    const nl = new NoteList([makeNote('8.04')]);
    proc.process(nl);
    const result = parseFloat(nl.getNote(0).getPField(4)!);
    expect(result).toBeCloseTo(7.08, 1);
  });

  it('leaves axis unchanged', () => {
    const proc = new PchInversionProcessor();
    proc.setVal('8.00');
    const nl = new NoteList([makeNote('8.00')]);
    proc.process(nl);
    const result = parseFloat(nl.getNote(0).getPField(4)!);
    expect(result).toBeCloseTo(8, 1);
  });

  it('throws on non-numeric pfield', () => {
    const proc = new PchInversionProcessor();
    const n = Note.createNote(5);
    n.setPField('abc', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });
});
