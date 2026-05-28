import { describe, expect, it, vi } from 'vitest';
import { BlueData } from './blue-data';
import type { JythonSerializedNote, JavaRuntimeClientContract } from './java-runtime';
import { PythonProcessor } from './note-processors/python-processor';
import { GenericScore } from './sound-objects/generic-score';
import { SoundLayer } from './sound-objects/sound-layer';

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
    evaluateJythonInstrument: vi.fn(async () => ({ ok: true, result: { instrumentText: '' } })),
    processJythonNoteList: vi.fn(async ({ notes }) => ({
      ok: true,
      result: {
        notes: notes.map((note: JythonSerializedNote) => ({
          ...note,
          pfields: note.pfields.map((value: string, index: number) => (index === 3 ? '880' : value)),
        })),
      },
    })),
    reinitializeJython: vi.fn(async () => ({ ok: true, result: { libraryPaths: [] } })),
  };
}

describe('BlueData PythonProcessor runtime integration', () => {
  it('applies PythonProcessor chains during async CSD generation', async () => {
    const data = new BlueData();
    const root = data.getScore()[0];
    const layer = root[0] as SoundLayer;
    const score = new GenericScore();
    score.setScoreText('i1 0 1 440');
    layer.push(score);

    const processor = new PythonProcessor();
    processor.setCode("for note in noteList:\n    note.setPField('880', 4)");
    data.getScore().getNoteProcessorChain().addProcessor(processor);

    const csd = await data.toCSDAsync(undefined, createRuntimeClient());

    expect(csd).toContain('880');
    expect(csd).not.toContain('\t440');
  });
});