import { describe, expect, it } from 'vite-plus/test';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import { RandomAddProcessor } from './random-add-processor';
import { RandomMultiplyProcessor } from './random-multiply-processor';
import { NoteProcessorException } from './note-processor-exception';

function makeNote(p4: string): Note {
  const n = Note.createNote(5);
  n.setPField(p4, 4);
  return n;
}

describe('RandomAddProcessor parity', () => {
  it('produces deterministic output with seed', () => {
    const proc1 = new RandomAddProcessor();
    proc1.setMin('0');
    proc1.setMax('1');
    proc1.setSeedUsed(true);
    proc1.setSeed('42');

    const proc2 = new RandomAddProcessor();
    proc2.setMin('0');
    proc2.setMax('1');
    proc2.setSeedUsed(true);
    proc2.setSeed('42');

    const nl1 = new NoteList([makeNote('10'), makeNote('20'), makeNote('30')]);
    const nl2 = new NoteList([makeNote('10'), makeNote('20'), makeNote('30')]);

    const result1 = proc1.process(nl1);
    const result2 = proc2.process(nl2);

    for (let i = 0; i < 3; i++) {
      expect(result1.getNote(i).getPField(4)).toBe(result2.getNote(i).getPField(4));
    }
  });

  it('adds random value within range', () => {
    const proc = new RandomAddProcessor();
    proc.setMin('5');
    proc.setMax('5');
    proc.setSeedUsed(true);
    proc.setSeed('1');
    const nl = new NoteList([makeNote('10')]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(15, 5);
  });

  it('different seeds produce different results', () => {
    const proc1 = new RandomAddProcessor();
    proc1.setSeedUsed(true);
    proc1.setSeed('1');

    const proc2 = new RandomAddProcessor();
    proc2.setSeedUsed(true);
    proc2.setSeed('999');

    const nl1 = new NoteList([makeNote('10')]);
    const nl2 = new NoteList([makeNote('10')]);

    proc1.process(nl1);
    proc2.process(nl2);

    expect(nl1.getNote(0).getPField(4)).not.toBe(nl2.getNote(0).getPField(4));
  });

  it('throws on non-numeric pfield', () => {
    const proc = new RandomAddProcessor();
    const n = Note.createNote(5);
    n.setPField('abc', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });
});

describe('RandomMultiplyProcessor parity', () => {
  it('produces deterministic output with seed', () => {
    const proc1 = new RandomMultiplyProcessor();
    proc1.setMin('0');
    proc1.setMax('1');
    proc1.setSeedUsed(true);
    proc1.setSeed('42');

    const proc2 = new RandomMultiplyProcessor();
    proc2.setMin('0');
    proc2.setMax('1');
    proc2.setSeedUsed(true);
    proc2.setSeed('42');

    const nl1 = new NoteList([makeNote('10'), makeNote('20')]);
    const nl2 = new NoteList([makeNote('10'), makeNote('20')]);

    const result1 = proc1.process(nl1);
    const result2 = proc2.process(nl2);

    for (let i = 0; i < 2; i++) {
      expect(result1.getNote(i).getPField(4)).toBe(result2.getNote(i).getPField(4));
    }
  });

  it('multiplies by random value within range', () => {
    const proc = new RandomMultiplyProcessor();
    proc.setMin('2');
    proc.setMax('2');
    proc.setSeedUsed(true);
    proc.setSeed('1');
    const nl = new NoteList([makeNote('5')]);
    proc.process(nl);
    expect(parseFloat(nl.getNote(0).getPField(4)!)).toBeCloseTo(10, 5);
  });

  it('throws on non-numeric pfield', () => {
    const proc = new RandomMultiplyProcessor();
    const n = Note.createNote(5);
    n.setPField('abc', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });
});
