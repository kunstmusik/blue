import { describe, expect, it, vi } from 'vitest';
import { CompileData } from '../compile-data';
import { setJavaRuntimeClient, type JavaRuntimeClientContract } from '../java-runtime';
import { PythonInstrument } from './python-instrument';

function createRuntimeClient(): JavaRuntimeClientContract {
  return {
    health: vi.fn(async () => ({ ok: true, result: { version: '0.0.1', methods: [] } })),
    initSession: vi.fn(async () => ({ ok: true, result: { projectSessionId: 1, clojureNamespace: 'user0', dependenciesLoaded: [] } })),
    reinitializeClojure: vi.fn(async () => ({ ok: true, result: { clojureNamespace: 'user1' } })),
    evaluateClojure: vi.fn(async () => ({ ok: true, result: { value: '', namespace: 'user0' } })),
    evaluateClojureScoreObject: vi.fn(async () => ({ ok: true, result: { scoreText: '', namespace: 'user0' } })),
    jythonImportCheck: vi.fn(async () => ({ ok: true, result: { importedModules: [], libraryPaths: [] } })),
    evaluateJythonScript: vi.fn(async () => ({ ok: true, result: { value: '' } })),
    evaluateJythonScoreObject: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonObjectBuilder: vi.fn(async () => ({ ok: true, result: { scoreText: '' } })),
    evaluateJythonInstrument: vi.fn(async () => ({
      ok: true,
      result: {
        instrumentText: 'aout oscili 32000, 440, 1\nout aout',
      },
    })),
    processJythonNoteList: vi.fn(async () => ({ ok: true, result: { notes: [] } })),
    reinitializeJython: vi.fn(async () => ({ ok: true, result: { libraryPaths: [] } })),
  };
}

describe('PythonInstrument runtime bridge', () => {
  it('generates instrument text through the Java runtime client', async () => {
    const runtimeClient = createRuntimeClient();
    const compileData = CompileData.createEmptyCompileData();
    setJavaRuntimeClient(compileData, runtimeClient);

    const instrument = new PythonInstrument();
    instrument.setText('instrument = "aout oscili 32000, 440, 1\\nout aout"');

    const instrumentText = await instrument.generateInstrumentAsync(compileData);

    expect(instrumentText).toContain('aout oscili 32000, 440, 1');
    expect(runtimeClient.evaluateJythonInstrument).toHaveBeenCalledWith({
      code: 'instrument = "aout oscili 32000, 440, 1\\nout aout"',
    });
  });
});