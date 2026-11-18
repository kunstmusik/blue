import { describe, expect, it } from 'vite-plus/test';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import { LineAddProcessor } from './line-add-processor';
import { LineMultiplyProcessor } from './line-multiply-processor';
import { TimeWarpProcessor } from './time-warp-processor';
import { TuningProcessor } from './tuning-processor';
import { NoteProcessorException } from './note-processor-exception';

function makeNote(p4: string, start = 0, dur = 1): Note {
  const n = Note.createNote(5);
  n.setPField(p4, 4);
  n.setStartTime(start);
  n.setSubjectiveDuration(dur);
  return n;
}

describe('LineAddProcessor parity', () => {
  it('adds interpolated value at note start time', () => {
    const proc = new LineAddProcessor();
    proc.setLineAddString('0 5');
    const nl = new NoteList([makeNote('10', 0)]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(15, 5);
  });

  it('adds zero with default string', () => {
    const proc = new LineAddProcessor();
    const nl = new NoteList([makeNote('10', 0)]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(10, 5);
  });

  it('throws on invalid line string', () => {
    const proc = new LineAddProcessor();
    proc.setLineAddString('');
    const nl = new NoteList([makeNote('10')]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });

  it('interpolates across time range', () => {
    const proc = new LineAddProcessor();
    proc.setLineAddString('0 0 10 100');
    const nl = new NoteList([makeNote('0', 0), makeNote('0', 5), makeNote('0', 10)]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(0, 2);
    expect(parseFloat(nl.getNote(2).getPField(4)!)).toBeCloseTo(100, 2);
  });
});

describe('LineMultiplyProcessor parity', () => {
  it('multiplies by interpolated value', () => {
    const proc = new LineMultiplyProcessor();
    proc.setLineMultiplyString('0 2');
    const nl = new NoteList([makeNote('5', 0)]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(10, 5);
  });

  it('multiplies by 1 with default string (identity)', () => {
    const proc = new LineMultiplyProcessor();
    const nl = new NoteList([makeNote('7', 0)]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(7, 5);
  });

  it('throws on invalid line string', () => {
    const proc = new LineMultiplyProcessor();
    proc.setLineMultiplyString('');
    const nl = new NoteList([makeNote('10')]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });
});

describe('TimeWarpProcessor parity', () => {
  it('maps beats to seconds at constant tempo', () => {
    const proc = new TimeWarpProcessor();
    proc.setTimeWarpString('0 60');
    const nl = new NoteList([makeNote('440', 2, 1)]);
    proc.process(nl);
    expect(nl.getNote(0).getStartTime()).toBeCloseTo(2, 5);
    expect(nl.getNote(0).getSubjectiveDuration()).toBeCloseTo(1, 5);
  });

  it('maps beats to seconds at 120 BPM', () => {
    const proc = new TimeWarpProcessor();
    proc.setTimeWarpString('0 120');
    const nl = new NoteList([makeNote('440', 2, 1)]);
    proc.process(nl);
    expect(nl.getNote(0).getStartTime()).toBeCloseTo(1, 5);
    expect(nl.getNote(0).getSubjectiveDuration()).toBeCloseTo(0.5, 5);
  });

  it('throws on invalid tempo string', () => {
    const proc = new TimeWarpProcessor();
    proc.setTimeWarpString('invalid');
    const nl = new NoteList([makeNote('440')]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });

  it('handles multi-segment tempo', () => {
    const proc = new TimeWarpProcessor();
    proc.setTimeWarpString('0 60 4 120');
    const nl = new NoteList([makeNote('440', 0, 4)]);
    proc.process(nl);
    expect(nl.getNote(0).getStartTime()).toBe(0);
    expect(nl.getNote(0).getSubjectiveDuration()).toBeGreaterThan(0);
  });
});

describe('TuningProcessor parity', () => {
  it('converts pch to frequency with 12-TET default', () => {
    const proc = new TuningProcessor();
    const nl = new NoteList([makeNote('8.00')]);
    proc.process(nl);
    const freq = parseFloat(nl.getNote(0).getPField(4)!);
    expect(freq).toBeCloseTo(261.626, 1);
  });

  it('converts higher octave pch', () => {
    const proc = new TuningProcessor();
    const nl = new NoteList([makeNote('9.00')]);
    proc.process(nl);
    const freq = parseFloat(nl.getNote(0).getPField(4)!);
    expect(freq).toBeCloseTo(261.626 * 2, 1);
  });

  it('throws on out-of-range pfield', () => {
    const proc = new TuningProcessor();
    proc.setPfield('1');
    const n = Note.createNote(1);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow();
  });

  it('enforces pfield > 3', () => {
    const proc = new TuningProcessor();
    proc.setPfield('2');
    expect(proc.getPfield()).toBe('4');
  });
});
