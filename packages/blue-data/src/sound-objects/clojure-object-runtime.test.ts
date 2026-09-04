import { describe, expect, it, vi } from 'vitest';
import { CompileData } from '../compile-data';
import { setJavaRuntimeClient, type JavaRuntimeClientContract } from '../java-runtime';
import { TimeContext } from '../time/time-context';
import { ClojureObject } from './clojure-object';

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
      result: {
        scoreText: 'i1 0 8 3 4 5',
        namespace: 'user0',
      },
    })),
    jythonImportCheck: vi.fn(async () => ({
      ok: true,
      result: { importedModules: [], libraryPaths: [] },
    })),
    evaluateJythonScript: vi.fn(async () => ({ ok: true, result: { value: '' } })),
    evaluateJythonScoreObject: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonObjectBuilder: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonInstrument: vi.fn(async () => ({ ok: true, result: { instrumentText: '' } })),
    processJythonNoteList: vi.fn(async () => ({ ok: true, result: { notes: [] } })),
    reinitializeJython: vi.fn(async () => ({ ok: true, result: { libraryPaths: [] } })),
  };
}

describe('ClojureObject runtime bridge', () => {
  it('generates notes through the Java runtime client', async () => {
    const runtimeClient = createRuntimeClient();
    const compileData = CompileData.createEmptyCompileData();
    setJavaRuntimeClient(compileData, runtimeClient);

    const obj = new ClojureObject();
    obj.setClojureCode('(def score "i1 0 8 3 4 5")');

    const noteList = await obj.generateForCSDAsync(new TimeContext(), compileData, 0, -1);

    expect(noteList.length).toBe(1);
    expect(noteList.getNote(0).getPField(1)).toBe('1');
    expect(noteList.getNote(0).getStartTime()).toBe(0);
    expect(noteList.getNote(0).getSubjectiveDuration()).toBe(4);
    expect(runtimeClient.evaluateClojureScoreObject).toHaveBeenCalledWith({
      code: '(def score "i1 0 8 3 4 5")',
      blueDuration: 4,
    });
  });

  it('evaluates on-load code through the Java runtime client', async () => {
    const runtimeClient = createRuntimeClient();
    const obj = new ClojureObject();
    obj.setOnLoadProcessable(true);
    obj.setClojureCode('(def some-state 42)');

    await obj.processOnLoadAsync(new TimeContext(), runtimeClient);

    expect(runtimeClient.evaluateClojure).toHaveBeenCalledWith({
      code: '(def some-state 42)',
    });
  });
});
