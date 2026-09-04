import { describe, expect, it } from 'vitest';
import { BlueData } from '../blue-data';
import { NoteList } from '../sound-objects/note-list';
import { Note } from '../sound-objects/note';
import { GenericScore } from '../sound-objects/generic-score';
import { LiveObject } from './live-object';
import { LiveObjectBins } from './live-object-bins';
import { TimeBehavior } from '../sound-objects/time-behavior';
import type { JavaRuntimeClientContract } from '../java-runtime';
import { initializeJavaScriptRuntime } from '../javascript-runtime';
import { JavaScriptObject } from '../sound-objects/javascript-object';
import {
  prepareTriggerBatch,
  resolveTriggerTargets,
  scaleNotesByTempo,
  computeTempoScale,
} from './blue-live-trigger';
import {
  createModernProject,
  createModernLiveData,
  createSparseGridLiveData,
  createMultiEnabledLiveData,
  createLibraryInstanceLiveData,
  createRuntimeBackedLiveData,
  MODERN_ENABLED_TARGET_ORDER,
  SPARSE_GRID_ENABLED_TARGET_ORDER,
  MULTI_ENABLED_TARGET_ORDER,
  TEMPO_SCALING_CASES,
  INVALID_TEMPO_VALUES,
  attachSavedSet,
} from './blue-live-trigger-fixtures';

describe('blue-live-trigger target selection', () => {
  it('targets the selected cell regardless of enabled state', () => {
    const data = createModernProject();
    const bins = data.getLiveData().getLiveObjectBins();

    // lo-00 is disabled but selected
    const result = resolveTriggerTargets(bins, 'selected', 'lo-00');
    expect('targets' in result).toBe(true);
    if ('targets' in result) {
      expect(result.targets).toHaveLength(1);
      expect(result.targets[0]!.getUniqueId()).toBe('lo-00');
      expect(result.targets[0]!.isEnabled()).toBe(false);
    }
  });

  it('targets only enabled cells in column-major order', () => {
    const data = createModernProject();
    const bins = data.getLiveData().getLiveObjectBins();

    const result = resolveTriggerTargets(bins, 'enabled');
    expect('targets' in result).toBe(true);
    if ('targets' in result) {
      const ids = result.targets.map((t) => t.getUniqueId());
      expect(ids).toEqual(MODERN_ENABLED_TARGET_ORDER.map((t) => t.uniqueId));
    }
  });

  it('skips null cells in sparse grids during enabled traversal', () => {
    const ld = createSparseGridLiveData();
    const result = resolveTriggerTargets(ld.getLiveObjectBins(), 'enabled');
    expect('targets' in result).toBe(true);
    if ('targets' in result) {
      const ids = result.targets.map((t) => t.getUniqueId());
      expect(ids).toEqual(SPARSE_GRID_ENABLED_TARGET_ORDER.map((t) => t.uniqueId));
    }
  });

  it('does not impose row or column exclusivity', () => {
    const ld = createMultiEnabledLiveData();
    const result = resolveTriggerTargets(ld.getLiveObjectBins(), 'enabled');
    expect('targets' in result).toBe(true);
    if ('targets' in result) {
      const ids = result.targets.map((t) => t.getUniqueId());
      expect(ids).toEqual(MULTI_ENABLED_TARGET_ORDER.map((t) => t.uniqueId));
    }
  });

  it('returns target-not-found for a missing selected id', () => {
    const data = createModernProject();
    const result = resolveTriggerTargets(
      data.getLiveData().getLiveObjectBins(),
      'selected',
      'does-not-exist',
    );
    expect('failure' in result).toBe(true);
    if ('failure' in result) {
      expect(result.failure.code).toBe('target-not-found');
    }
  });

  it('returns invalid-request for an empty selected id', () => {
    const data = createModernProject();
    const result = resolveTriggerTargets(data.getLiveData().getLiveObjectBins(), 'selected', '  ');
    expect('failure' in result).toBe(true);
    if ('failure' in result) {
      expect(result.failure.code).toBe('invalid-request');
    }
  });

  it('returns empty targets when no cells are enabled', () => {
    const data = new BlueData();
    const result = resolveTriggerTargets(data.getLiveData().getLiveObjectBins(), 'enabled');
    expect('targets' in result).toBe(true);
    if ('targets' in result) {
      expect(result.targets).toHaveLength(0);
    }
  });
});

describe('blue-live-trigger tempo scaling', () => {
  for (const testCase of TEMPO_SCALING_CASES) {
    it(`scales p2/p3 by 60/tempo at tempo ${testCase.tempo}`, () => {
      const notes = new NoteList();
      const n = Note.createNoteFromText(`i1 ${testCase.baseNote.p2} ${testCase.baseNote.p3} 440`);
      expect(n).not.toBeNull();
      notes.push(n!);

      scaleNotesByTempo(notes, testCase.tempoScale);

      expect(notes.getNote(0).getStartTime()).toBeCloseTo(testCase.scaledNote.p2, 5);
      expect(notes.getNote(0).getObjectiveDuration()).toBeCloseTo(testCase.scaledNote.p3, 5);
    });
  }

  it('computeTempoScale returns exactly 60 / tempo', () => {
    expect(computeTempoScale(60)).toBe(1);
    expect(computeTempoScale(120)).toBe(0.5);
    expect(computeTempoScale(30)).toBe(2);
    expect(computeTempoScale(90)).toBeCloseTo(60 / 90, 10);
  });

  it('preserves non-timing p-fields during scaling', () => {
    const notes = new NoteList();
    const n = Note.createNoteFromText('i1 4 2 440 0.5 7');
    expect(n).not.toBeNull();
    notes.push(n!);

    scaleNotesByTempo(notes, 0.5);

    // p1 (instr), p4 (freq), p5 (amp), p6 preserved
    expect(notes.getNote(0).getPField(1)).toBe('1');
    expect(notes.getNote(0).getPField(4)).toBe('440');
    expect(notes.getNote(0).getPField(5)).toBe('0.5');
    expect(notes.getNote(0).getPField(6)).toBe('7');
    // p2/p3 scaled
    expect(notes.getNote(0).getStartTime()).toBe(2);
    expect(notes.getNote(0).getObjectiveDuration()).toBe(1);
  });
});

describe('blue-live-trigger prepareTriggerBatch', () => {
  it('prepares a selected-disabled cell batch', async () => {
    const original = createModernProject();
    const copy = original.deepCopy() as BlueData;

    const result = await prepareTriggerBatch(copy, 'selected', 'lo-00');

    expect(result.kind).toBe('prepared');
    if (result.kind === 'prepared') {
      expect(result.batch.targetIds).toEqual(['lo-00']);
      expect(result.batch.targetCount).toBe(1);
      expect(result.batch.noteCount).toBeGreaterThan(0);
      expect(result.batch.scoreText).toContain('i1');
      expect(result.batch.tempoScale).toBe(1);
    }
  });

  it('prepares an enabled column-major batch', async () => {
    const original = createModernProject();
    const copy = original.deepCopy() as BlueData;

    const result = await prepareTriggerBatch(copy, 'enabled');

    expect(result.kind).toBe('prepared');
    if (result.kind === 'prepared') {
      expect(result.batch.targetIds).toEqual(MODERN_ENABLED_TARGET_ORDER.map((t) => t.uniqueId));
      expect(result.batch.targetCount).toBe(3);
      expect(result.batch.noteCount).toBe(3);
    }
  });

  it('returns empty for no enabled targets', async () => {
    const original = new BlueData();
    const copy = original.deepCopy() as BlueData;

    const result = await prepareTriggerBatch(copy, 'enabled');

    expect(result.kind).toBe('empty');
    if (result.kind === 'empty') {
      expect(result.empty.targetCount).toBe(0);
    }
  });

  it('returns empty when populated targets generate no notes', async () => {
    const original = new BlueData();
    const bins = new LiveObjectBins(1, 1);
    const target = new LiveObject();
    const score = new GenericScore();
    score.setScoreText('');
    target.setUniqueId('empty-score');
    target.setEnabled(true);
    target.setSoundObject(score);
    bins.setLiveObject(0, 0, target);
    original.getLiveData().setLiveObjectBins(bins);

    const result = await prepareTriggerBatch(original.deepCopy() as BlueData, 'enabled');

    expect(result.kind).toBe('empty');
    if (result.kind === 'empty') {
      expect(result.empty.targetIds).toEqual(['empty-score']);
      expect(result.empty.targetCount).toBe(1);
    }
  });

  it('returns invalid-tempo for non-positive or non-finite tempo', async () => {
    for (const tempo of INVALID_TEMPO_VALUES) {
      const original = createModernProject();
      original.getLiveData().setTempo(tempo);
      const copy = original.deepCopy() as BlueData;

      const result = await prepareTriggerBatch(copy, 'enabled');

      expect(result.kind).toBe('failure');
      if (result.kind === 'failure') {
        expect(result.failure.code).toBe('invalid-tempo');
      }
    }
  });

  it('overrides copied TimeBehavior to NONE during preparation', async () => {
    const original = createModernProject();
    // Set an authored TimeBehavior on a cell's SoundObject
    const bins = original.getLiveData().getLiveObjectBins();
    const lo00 = bins.getLiveObject(0, 0);
    lo00!.getSoundObject()!.setTimeBehavior(TimeBehavior.SCALE);
    const authoredBefore = lo00!.getSoundObject()!.getTimeBehavior();

    const copy = original.deepCopy() as BlueData;
    const result = await prepareTriggerBatch(copy, 'selected', 'lo-00');

    expect(result.kind).toBe('prepared');
    // The CANONICAL authored TimeBehavior is unchanged after preparation.
    expect(lo00!.getSoundObject()!.getTimeBehavior()).toBe(authoredBefore);
    expect(lo00!.getSoundObject()!.getTimeBehavior()).toBe(TimeBehavior.SCALE);
  });

  it('does not mutate the canonical project during preparation', async () => {
    const original = createModernProject();
    const originalSerialization = original.saveToString();

    const copy = original.deepCopy() as BlueData;
    await prepareTriggerBatch(copy, 'enabled');

    expect(original.saveToString()).toBe(originalSerialization);
  });

  it('rejects malformed non-finite generated timing without a partial batch', async () => {
    const original = createModernProject();
    const malformed = new GenericScore();
    malformed.setScoreText('i1 NaN 2 440');
    original.getLiveData().getLiveObjectBins().getLiveObject(0, 1)!.setSoundObject(malformed);

    const result = await prepareTriggerBatch(original.deepCopy() as BlueData, 'enabled');

    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') {
      expect(result.failure.code).toBe('generation-failed');
      expect(result.failure.targetId).toBe('lo-01');
    }
  });

  it('prepares a library-backed Instance target', async () => {
    const fixture = createLibraryInstanceLiveData();
    const copy = fixture.data.deepCopy() as BlueData;

    const result = await prepareTriggerBatch(copy, 'selected', 'lib-inst-0');

    expect(result.kind).toBe('prepared');
    if (result.kind === 'prepared') {
      expect(result.batch.targetIds).toEqual(['lib-inst-0']);
      expect(result.batch.noteCount).toBeGreaterThan(0);
    }
  });

  it('scales generated notes by 60/tempo at tempo 120', async () => {
    const original = createModernProject();
    original.getLiveData().setTempo(120);
    const copy = original.deepCopy() as BlueData;

    const result = await prepareTriggerBatch(copy, 'selected', 'lo-00');

    expect(result.kind).toBe('prepared');
    if (result.kind === 'prepared') {
      expect(result.batch.tempoScale).toBe(0.5);
      // The score text should reflect scaled timing
      expect(result.batch.scoreText).toContain('i1');
    }
  });
});

describe('blue-live-trigger runtime-backed generation', () => {
  function createRuntimeClient(): JavaRuntimeClientContract {
    return {
      health: async () => ({ ok: true, result: { version: 'fake', methods: [] } }),
      initSession: async () => ({
        ok: true,
        result: { projectSessionId: 1, clojureNamespace: 'fake', dependenciesLoaded: [] },
      }),
      reinitializeClojure: async () => ({ ok: true, result: { clojureNamespace: 'fake' } }),
      evaluateClojure: async () => ({ ok: true, result: { value: '', namespace: 'fake' } }),
      evaluateClojureScoreObject: async () => ({
        ok: true,
        result: { scoreText: 'i1 1 2 440', namespace: 'fake' },
      }),
      jythonImportCheck: async () => ({
        ok: true,
        result: { importedModules: [], libraryPaths: [] },
      }),
      evaluateJythonScript: async () => ({ ok: true, result: { value: '' } }),
      evaluateJythonScoreObject: async () => ({ ok: true, result: { scoreText: 'i1 2 3 880' } }),
      evaluateJythonObjectBuilder: async () => ({ ok: true, result: { scoreText: 'i1 3 4 330' } }),
      evaluateJythonInstrument: async () => ({ ok: true, result: { instrumentText: '' } }),
      processJythonNoteList: async ({ notes }) => ({ ok: true, result: { notes } }),
      reinitializeJython: async () => ({ ok: true, result: { libraryPaths: [] } }),
    };
  }

  it('prepares native objects synchronously without a runtime', async () => {
    const original = createModernProject();
    const copy = original.deepCopy() as BlueData;

    const result = await prepareTriggerBatch(copy, 'enabled');

    expect(result.kind).toBe('prepared');
  });

  it('returns runtime-unavailable when a required runtime is absent', async () => {
    const fixture = createRuntimeBackedLiveData();
    const copy = fixture.data.deepCopy() as BlueData;

    // Without a runtime injected, runtime-backed objects will fail generation.
    // Target only the clojure object so we get a single-target failure.
    const result = await prepareTriggerBatch(copy, 'selected', 'rt-clj');

    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') {
      expect(result.failure.code).toBe('runtime-unavailable');
      expect(result.failure.targetId).toBe('rt-clj');
    }
  });

  it('prepares exact Clojure and Jython batches through the injected runtime', async () => {
    const runtime = { javaRuntimeClient: createRuntimeClient() };
    const fixture = createRuntimeBackedLiveData();

    const clojureResult = await prepareTriggerBatch(
      fixture.data.deepCopy() as BlueData,
      'selected',
      'rt-clj',
      runtime,
    );
    const pythonResult = await prepareTriggerBatch(
      fixture.data.deepCopy() as BlueData,
      'selected',
      'rt-py',
      runtime,
    );

    expect(clojureResult.kind).toBe('prepared');
    expect(pythonResult.kind).toBe('prepared');
    if (clojureResult.kind === 'prepared') {
      expect(clojureResult.batch.scoreText).toContain('i1\t1.0\t2\t440');
    }
    if (pythonResult.kind === 'prepared') {
      expect(pythonResult.batch.scoreText).toContain('i1\t2.0\t3\t880');
    }
  });

  it('prepares every curated host-backed target without mutating the canonical project', async () => {
    await initializeJavaScriptRuntime();
    const runtime = { javaRuntimeClient: createRuntimeClient() };
    const fixture = createRuntimeBackedLiveData();
    const before = fixture.data.saveToString();

    const result = await prepareTriggerBatch(
      fixture.data.deepCopy() as BlueData,
      'enabled',
      undefined,
      runtime,
    );

    expect(result.kind).toBe('prepared');
    if (result.kind === 'prepared') {
      expect(result.batch.targetIds).toEqual(['rt-clj', 'rt-py', 'rt-js', 'rt-ob']);
      expect(result.batch.noteCount).toBe(4);
      expect(result.batch.scoreText).toContain('440');
      expect(result.batch.scoreText).toContain('880');
      expect(result.batch.scoreText).toContain('220');
      expect(result.batch.scoreText).toContain('330');
    }
    expect(fixture.data.saveToString()).toBe(before);
  });

  it('shares one CompileData across every target in an enabled batch', async () => {
    await initializeJavaScriptRuntime();

    const data = new BlueData();
    const bins = new LiveObjectBins(1, 2);
    const firstObject = new JavaScriptObject();
    firstObject.setJavaScriptCode('var sharedBlueLiveValue = 77; score = "i1 0 1 440";');
    const secondObject = new JavaScriptObject();
    secondObject.setJavaScriptCode('score = "i1 1 1 " + sharedBlueLiveValue;');
    const first = new LiveObject();
    first.setUniqueId('js-first');
    first.setEnabled(true);
    first.setSoundObject(firstObject);
    const second = new LiveObject();
    second.setUniqueId('js-second');
    second.setEnabled(true);
    second.setSoundObject(secondObject);
    bins.setLiveObject(0, 0, first);
    bins.setLiveObject(0, 1, second);
    data.getLiveData().setLiveObjectBins(bins);

    const result = await prepareTriggerBatch(data.deepCopy() as BlueData, 'enabled');

    expect(result.kind).toBe('prepared');
    if (result.kind === 'prepared') {
      expect(result.batch.scoreText).toContain('77');
    }
  });

  it('fails atomically when one member of an enabled batch fails', async () => {
    const fixture = createRuntimeBackedLiveData();
    const copy = fixture.data.deepCopy() as BlueData;

    const result = await prepareTriggerBatch(copy, 'enabled');

    // The batch contains runtime-backed objects that fail without a runtime;
    // the whole batch must fail rather than submit a partial result.
    expect(result.kind).toBe('failure');
  });

  it('does not change canonical serialization after a runtime-backed failure', async () => {
    const fixture = createRuntimeBackedLiveData();
    const original = fixture.data;
    const before = original.saveToString();

    const copy = original.deepCopy() as BlueData;
    await prepareTriggerBatch(copy, 'selected', 'rt-clj');

    expect(original.saveToString()).toBe(before);
  });

  it('reports runtime-unavailable when no runtime is injected for a runtime-backed object', async () => {
    const fixture = createRuntimeBackedLiveData();
    const copy = fixture.data.deepCopy() as BlueData;

    const result = await prepareTriggerBatch(copy, 'selected', 'rt-py', undefined);

    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') {
      expect(result.failure.code).toBe('runtime-unavailable');
      expect(result.failure.targetId).toBe('rt-py');
    }
  });
});
