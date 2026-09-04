import { describe, expect, it, vi } from 'vitest';
import { BlueData } from './blue-data';
import { PythonInstrument } from './instruments/python-instrument';
import type { JavaRuntimeClientContract } from './java-runtime';

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

describe('BlueData PythonInstrument runtime integration', () => {
  it('includes generated PythonInstrument text and global sections in async CSD output', async () => {
    const data = new BlueData();
    const instrument = new PythonInstrument();
    instrument.setName('PyInstr');
    instrument.setGlobalOrc('gkPy init 1');
    instrument.setGlobalSco('i 2 0 1');
    instrument.setText('instrument = "aout oscili 32000, 440, 1\\nout aout"');
    data.getArrangement().addInstrument(instrument, '7');

    const csd = await data.toCSDAsync(undefined, createRuntimeClient());

    expect(csd).toContain('gkPy init 1');
    expect(csd).toContain('i 2 0 1');
    expect(csd).toContain('instr 7');
    expect(csd).toContain('aout oscili 32000, 440, 1');
    expect(csd).toContain('out aout');
  });
});
