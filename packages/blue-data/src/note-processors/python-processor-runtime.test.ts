import { describe, expect, it, vi } from 'vitest';
import { CompileData } from '../compile-data';
import { Note } from '../sound-objects/note';
import { NoteList } from '../sound-objects/note-list';
import {
  setJavaRuntimeClient,
  type JavaRuntimeClientContract,
  type JythonSerializedNote,
} from '../java-runtime';
import { PythonProcessor } from './python-processor';

function createRuntimeClient(): JavaRuntimeClientContract {
  return {
    health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', methods: [] } })),
    initSession: vi.fn(async () => ({
      ok: true,
      result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] },
    })),
    reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
    evaluateClojure: vi.fn(async () => ({ ok: true, result: { value: '', namespace: 'user0' } })),
    evaluateClojureScoreObject: vi.fn(async () => ({
      ok: true,
      result: { scoreText: '', namespace: 'user0' },
    })),
    jythonImportCheck: vi.fn(async () => ({
      ok: true,
      result: { importedModules: [], libraryPaths: [] },
    })),
    evaluateJythonScript: vi.fn(async () => ({ ok: true, result: { value: '' } })),
    evaluateJythonScoreObject: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonObjectBuilder: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonInstrument: vi.fn(async () => ({ ok: true, result: { instrumentText: '' } })),
    processJythonNoteList: vi.fn(async ({ notes }) => ({
      ok: true,
      result: {
        notes: notes.map((note: JythonSerializedNote) => ({
          ...note,
          pfields: note.pfields.map((value: string, index: number) =>
            index === 3 ? '880' : value,
          ),
        })),
      },
    })),
    reinitializeJython: vi.fn(async () => ({ ok: true, result: { libraryPaths: [] } })),
  };
}

describe('PythonProcessor runtime bridge', () => {
  it('processes a note list through the Java runtime client', async () => {
    const runtimeClient = createRuntimeClient();
    const compileData = CompileData.createEmptyCompileData();
    setJavaRuntimeClient(compileData, runtimeClient);

    const processor = new PythonProcessor();
    processor.setCode("for note in noteList:\n    note.setPField('880', 4)");

    const note = Note.createBlank(4);
    note.setPField('1', 1);
    note.setPField('0', 2);
    note.setPField('1', 3);
    note.setPField('440', 4);

    const notes = new NoteList([note]);
    const processed = await processor.processAsync(notes, compileData);

    expect(processed.getNote(0).getPField(4)).toBe('880');
    expect(runtimeClient.processJythonNoteList).toHaveBeenCalledTimes(1);
  });

  it('reattaches file seek metadata when Python reorders returned notes', async () => {
    const runtimeClient = createRuntimeClient();
    runtimeClient.processJythonNoteList = vi.fn(async ({ notes }) => ({
      ok: true,
      result: {
        notes: [...notes].reverse().map((note) => ({ ...note, pfields: [...note.pfields] })),
      },
    }));
    const compileData = CompileData.createEmptyCompileData();
    setJavaRuntimeClient(compileData, runtimeClient);

    const normalizationOrigin = { owner: {} };
    const fileNote = Note.createBlank(4);
    fileNote.setPField('1', 1);
    fileNote.setPField('4', 2);
    fileNote.setPField('2', 3);
    fileNote.setPField('0', 4);
    const provenance = {
      pField: 4 as const,
      absoluteObjectStartBeat: 12,
      originalDurationBeats: 8,
      generatedOffsetSeconds: 0,
      normalizationOrigin,
    };
    fileNote.setFileSeekProvenance(provenance);

    const scoreNote = Note.createBlank(4);
    scoreNote.setPField('2', 1);
    scoreNote.setPField('2', 2);
    scoreNote.setPField('1', 3);
    scoreNote.setPField('440', 4);
    const processor = new PythonProcessor();
    const processed = await processor.processAsync(
      new NoteList([fileNote, scoreNote]),
      compileData,
    );

    const request = vi.mocked(runtimeClient.processJythonNoteList).mock.calls[0]?.[0];
    expect(request?.notes[0]?.renderMetadataId).toBe('file-seek-0');
    expect(processed.getNote(0).getFileSeekProvenance()).toBeUndefined();
    expect(processed.getNote(1).getFileSeekProvenance()).toBe(provenance);
  });
});
