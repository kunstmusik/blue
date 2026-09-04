import { describe, expect, it } from 'vitest';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import { AddProcessor } from './add-processor';
import { MultiplyProcessor } from './multiply-processor';
import { NoteProcessorException } from './note-processor-exception';
import { NoteProcessorChain } from './note-processor-chain';

function makeNote(p4: string): Note {
  const n = Note.createNote(5);
  n.setPField(p4, 4);
  return n;
}

describe('Processor error parity', () => {
  it('AddProcessor throws on NaN pfield', () => {
    const proc = new AddProcessor();
    const n = Note.createNote(5);
    n.setPField('not-a-number', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });

  it('AddProcessor throws on missing pfield', () => {
    const proc = new AddProcessor();
    proc.setPfield('99');
    const n = Note.createNote(5);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow();
  });

  it('MultiplyProcessor throws on NaN pfield', () => {
    const proc = new MultiplyProcessor();
    const n = Note.createNote(5);
    n.setPField('xyz', 4);
    const nl = new NoteList([n]);
    expect(() => proc.process(nl)).toThrow(NoteProcessorException);
  });

  it('empty note list returns without error', () => {
    const proc = new AddProcessor();
    proc.setVal('5');
    const nl = new NoteList([]);
    const result = proc.process(nl);
    expect(result.length).toBe(0);
  });

  it('chain wraps unknown errors in NoteProcessorException', () => {
    const chain = new NoteProcessorChain();
    const throwingProc = {
      process: () => {
        throw new Error('custom error');
      },
      getDisplayName: () => 'ThrowingProcessor',
      deepCopy: () => throwingProc,
      saveAsXML: () => {
        throw new Error('no xml');
      },
    } as any;
    chain.addProcessor(throwingProc);
    const nl = new NoteList([makeNote('1')]);
    expect(() => chain.apply(nl)).toThrow(NoteProcessorException);
  });
});
