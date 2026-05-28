import { describe, expect, it, vi } from 'vitest';
import { CompileData } from './compile-data';
import {
  getJavaRuntimeClient,
  setJavaRuntimeClient,
  type JavaRuntimeClientContract,
} from './java-runtime';

function createRuntimeClient(): JavaRuntimeClientContract {
  return {
    health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', methods: [] } })),
    initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] } })),
    reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
    evaluateClojure: vi.fn(async () => ({ ok: true, result: { value: '', namespace: 'user0' } })),
    evaluateClojureScoreObject: vi.fn(async () => ({ ok: true, result: { scoreText: '', namespace: 'user0' } })),
    jythonImportCheck: vi.fn(async () => ({ ok: true, result: { importedModules: ['orchestra'], libraryPaths: [] } })),
    evaluateJythonScript: vi.fn(async () => ({ ok: true, result: { value: '' } })),
    evaluateJythonScoreObject: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonObjectBuilder: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonInstrument: vi.fn(async () => ({ ok: true, result: { instrumentText: '' } })),
    processJythonNoteList: vi.fn(async () => ({ ok: true, result: { notes: [] } })),
    reinitializeJython: vi.fn(async () => ({ ok: true, result: { libraryPaths: [] } })),
  };
}

describe('java-runtime', () => {
  it('stores and returns the runtime client with Jython methods', () => {
    const compileData = CompileData.createEmptyCompileData();
    const runtimeClient = createRuntimeClient();

    setJavaRuntimeClient(compileData, runtimeClient);

    expect(getJavaRuntimeClient(compileData)).toBe(runtimeClient);
  });

  it('clears the runtime client', () => {
    const compileData = CompileData.createEmptyCompileData();
    setJavaRuntimeClient(compileData, createRuntimeClient());

    setJavaRuntimeClient(compileData, null);

    expect(getJavaRuntimeClient(compileData)).toBeNull();
  });
});