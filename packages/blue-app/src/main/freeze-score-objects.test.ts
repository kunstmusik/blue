import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  BlueData,
  FrozenSoundObject,
  GenericScore,
  PolyObject,
  TimeDuration,
  TimePosition,
  buildAiffBytes,
  buildWavBytes,
} from '@blue/data';
import {
  allocateFreezeFileName,
  countFreezeReferences,
  executeFreezeUnfreeze,
  isFreezeEligible,
  resolveFreezeArtifactPath,
  resolveFreezeTargets,
} from './freeze-score-objects';
import type { ScoreObjectEditorTargetSnapshot } from '../shared/project-editor';
import type { FreezeItemStatus } from '../shared/render-freeze-contract';
import {
  createProjectEditorSnapshot,
  createScoreObjectEditorDocument,
} from '../shared/project-editor';

function createWavFile(channels = 1): Buffer {
  return Buffer.from(buildWavBytes(channels, 100, 16, 100));
}

describe('allocateFreezeFileName', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'blue-freeze-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('produces freeze0.wav on non-macOS with empty directory', () => {
    expect(allocateFreezeFileName(tempDir, 'linux')).toBe('freeze0.wav');
  });

  it('produces freeze0.aif on macOS with empty directory', () => {
    expect(allocateFreezeFileName(tempDir, 'darwin')).toBe('freeze0.aif');
  });

  it('finds the max counter and increments', () => {
    fs.writeFileSync(path.join(tempDir, 'freeze0.wav'), '');
    fs.writeFileSync(path.join(tempDir, 'freeze2.wav'), '');

    expect(allocateFreezeFileName(tempDir, 'linux')).toBe('freeze3.wav');
  });

  it('skips files that start with freeze but are not numeric', () => {
    fs.writeFileSync(path.join(tempDir, 'freeze-old.wav'), '');
    fs.writeFileSync(path.join(tempDir, 'freezeABC.wav'), '');
    fs.writeFileSync(path.join(tempDir, 'freeze0.wav'), '');

    expect(allocateFreezeFileName(tempDir, 'linux')).toBe('freeze1.wav');
  });

  it('advances on collision', () => {
    fs.writeFileSync(path.join(tempDir, 'freeze0.wav'), '');
    fs.writeFileSync(path.join(tempDir, 'freeze1.wav'), '');

    expect(allocateFreezeFileName(tempDir, 'linux')).toBe('freeze2.wav');
  });

  it('uses platform extension regardless of existing files', () => {
    fs.writeFileSync(path.join(tempDir, 'freeze0.wav'), '');

    // macOS always uses .aif, even if .wav files exist
    expect(allocateFreezeFileName(tempDir, 'darwin')).toBe('freeze1.aif');
  });

  it('ignores non-freeze-prefixed files', () => {
    fs.writeFileSync(path.join(tempDir, 'render0.wav'), '');
    fs.writeFileSync(path.join(tempDir, 'audio.wav'), '');

    expect(allocateFreezeFileName(tempDir, 'linux')).toBe('freeze0.wav');
  });

  it('does not treat partially numeric names as valid freeze counters', () => {
    fs.writeFileSync(path.join(tempDir, 'freeze1junk.wav'), '');
    expect(allocateFreezeFileName(tempDir, 'linux')).toBe('freeze0.wav');
  });

  it('only resolves artifact filenames directly inside the project directory', () => {
    expect(resolveFreezeArtifactPath(tempDir, 'freeze0.wav')).toBe(
      path.join(tempDir, 'freeze0.wav'),
    );
    expect(resolveFreezeArtifactPath(tempDir, '../outside.wav')).toBeNull();
    expect(resolveFreezeArtifactPath(tempDir, path.join(tempDir, 'outside.wav'))).toBeNull();
  });
});

describe('countFreezeReferences', () => {
  function createScoreWithFrozenObjects(fileNames: string[]): BlueData {
    const data = new BlueData();
    const score = data.getScore();
    const polyObj = score[0] as PolyObject;
    const layer = polyObj[0];

    for (const fileName of fileNames) {
      const fso = new FrozenSoundObject();
      fso.setFrozenWaveFileName(fileName);
      fso.setNumChannels(2);
      fso.setStartTime(TimePosition.beats(0));
      fso.setSubjectiveDuration(TimeDuration.beats(2));
      layer.push(fso);
    }

    return data;
  }

  it('counts zero when no frozen objects reference the file', () => {
    const data = createScoreWithFrozenObjects(['freeze0.wav']);
    expect(countFreezeReferences(data.getScore(), 'freeze1.wav')).toBe(0);
  });

  it('counts one when a single frozen object references the file', () => {
    const data = createScoreWithFrozenObjects(['freeze0.wav']);
    expect(countFreezeReferences(data.getScore(), 'freeze0.wav')).toBe(1);
  });

  it('counts multiple references to the same file', () => {
    const data = createScoreWithFrozenObjects(['freeze0.wav', 'freeze0.wav', 'freeze1.wav']);
    expect(countFreezeReferences(data.getScore(), 'freeze0.wav')).toBe(2);
  });

  it('counts frozen objects in nested PolyObjects', () => {
    const data = new BlueData();
    const score = data.getScore();
    const rootPoly = score[0] as PolyObject;
    const rootLayer = rootPoly[0];

    // Create a nested PolyObject with a frozen object inside
    const nested = new PolyObject(true);
    nested.newLayerAt(-1);
    const nestedLayer = nested[0];

    const fso = new FrozenSoundObject();
    fso.setFrozenWaveFileName('freeze2.wav');
    fso.setNumChannels(2);
    fso.setStartTime(TimePosition.beats(0));
    fso.setSubjectiveDuration(TimeDuration.beats(2));
    nestedLayer.push(fso);

    rootLayer.push(nested);

    expect(countFreezeReferences(data.getScore(), 'freeze2.wav')).toBe(1);
  });
});

describe('isFreezeEligible', () => {
  it('returns true for regular SoundObjects', () => {
    const score = new GenericScore();
    expect(isFreezeEligible(score)).toBe(true);
  });

  it('returns false for FrozenSoundObject', () => {
    const fso = new FrozenSoundObject();
    expect(isFreezeEligible(fso)).toBe(false);
  });

  it('returns false for non-sound-object values', () => {
    expect(isFreezeEligible(null)).toBe(false);
    expect(isFreezeEligible({})).toBe(false);
    expect(isFreezeEligible(42)).toBe(false);
  });
});

describe('resolveFreezeTargets', () => {
  function createTarget(
    objectIndex: number,
    layerIndex = 0,
    rootGroupIndex = 0,
  ): ScoreObjectEditorTargetSnapshot {
    return {
      selectionId: `sel-${objectIndex}`,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex, containerPath: [], layerIndex, objectIndex },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };
  }

  it('resolves a valid timeline target', () => {
    const data = new BlueData();
    const score = data.getScore();
    const polyObj = score[0] as PolyObject;
    const layer = polyObj[0];

    const obj1 = new GenericScore();
    obj1.setName('Obj 1');
    obj1.setStartTime(TimePosition.beats(0));
    obj1.setSubjectiveDuration(TimeDuration.beats(2));
    layer.push(obj1);

    const target = createTarget(1); // index 1 (0 is the default empty layer entry)

    // Actually, PolyObject layer starts empty after newLayerAt. Index 0 is the first.
    target.location!.objectIndex = 0;

    const { resolved, rejected } = resolveFreezeTargets(data, [target]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].sObj.getName()).toBe('Obj 1');
    expect(resolved[0].isFrozen).toBe(false);
    expect(rejected).toHaveLength(0);
  });

  it('resolves a FrozenSoundObject so it can be unfrozen', () => {
    const data = new BlueData();
    const layer = (data.getScore()[0] as PolyObject)[0];
    const source = new GenericScore();
    source.setStartTime(TimePosition.beats(2));
    source.setSubjectiveDuration(TimeDuration.beats(1));
    const frozen = new FrozenSoundObject();
    frozen.setFrozenSoundObject(source);
    frozen.setFrozenWaveFileName('freeze0.wav');
    frozen.setStartTime(TimePosition.beats(2));
    frozen.setSubjectiveDuration(TimeDuration.beats(1));
    layer.push(frozen);

    const { resolved, rejected } = resolveFreezeTargets(data, [createTarget(0)]);
    expect(rejected).toHaveLength(0);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.isFrozen).toBe(true);
  });

  it('restores the nested source when its freeze artifact is missing or unsafe', async () => {
    const data = new BlueData();
    const layer = (data.getScore()[0] as PolyObject)[0];
    const source = new GenericScore();
    source.setStartTime(TimePosition.beats(2));
    source.setSubjectiveDuration(TimeDuration.beats(1));
    const frozen = new FrozenSoundObject();
    frozen.setFrozenSoundObject(source);
    frozen.setFrozenWaveFileName('../outside.wav');
    frozen.setStartTime(TimePosition.beats(2));
    frozen.setSubjectiveDuration(TimeDuration.beats(1));
    layer.push(frozen);
    const runCsound = vi.fn();

    const operation = await executeFreezeUnfreeze(
      {
        data,
        projectDirectory: path.join(process.cwd(), 'freeze-project'),
        utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
        platform: 'linux',
      },
      [createTarget(0)],
      'freeze-test',
      vi.fn(),
      { runCsound },
    );

    expect(operation.ok).toBe(true);
    expect(operation.unfrozenCount).toBe(1);
    expect(layer[0]).toBeInstanceOf(GenericScore);
    expect(layer[0]).not.toBe(frozen);
    expect(layer[0].getStartTime().getValue()).toBe(2);
    expect(operation.deletedFiles).toEqual([]);
    expect(runCsound).not.toHaveBeenCalled();
  });

  it('deletes a shared artifact only after the final reference is unfrozen', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-shared-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 2; index++) {
        const source = new GenericScore();
        source.setName(`Source ${index + 1}`);
        source.setStartTime(TimePosition.beats(index * 2));
        source.setSubjectiveDuration(TimeDuration.beats(1));
        const frozen = new FrozenSoundObject();
        frozen.setFrozenSoundObject(source);
        frozen.setFrozenWaveFileName('freeze0.wav');
        frozen.setStartTime(TimePosition.beats(index * 2));
        frozen.setSubjectiveDuration(TimeDuration.beats(1));
        layer.push(frozen);
      }
      const artifactPath = path.join(projectDirectory, 'freeze0.wav');
      fs.writeFileSync(artifactPath, createWavFile());
      const runCsound = vi.fn();

      const first = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
          platform: 'linux',
        },
        [createTarget(0)],
        'unfreeze-first',
        vi.fn(),
        { runCsound },
      );

      expect(first.ok).toBe(true);
      expect(first.deletedFiles).toEqual([]);
      expect(fs.existsSync(artifactPath)).toBe(true);

      const second = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
          platform: 'linux',
        },
        [createTarget(1)],
        'unfreeze-final',
        vi.fn(),
        { runCsound },
      );

      expect(second.ok).toBe(true);
      expect(second.deletedFiles).toEqual(['freeze0.wav']);
      expect(fs.existsSync(artifactPath)).toBe(false);
      expect(layer[0]).toBeInstanceOf(GenericScore);
      expect(layer[1]).toBeInstanceOf(GenericScore);
      expect(runCsound).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('keeps a multi-target operation atomic when a later target is rejected', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-atomic-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const regular = new GenericScore();
      regular.setName('Regular');
      regular.setStartTime(TimePosition.beats(0));
      regular.setSubjectiveDuration(TimeDuration.beats(1));
      const missing = new FrozenSoundObject();
      missing.setFrozenWaveFileName('freeze-missing.wav');
      missing.setStartTime(TimePosition.beats(2));
      missing.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(regular, missing);

      const operation = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
          platform: 'linux',
        },
        [createTarget(0), createTarget(1)],
        'freeze-atomic',
        vi.fn(),
        {
          runCsound: async (args) => {
            fs.writeFileSync(args[1]!, createWavFile());
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(operation.ok).toBe(false);
      expect(layer[0]).toBe(regular);
      expect(layer[1]).toBe(missing);
      expect(
        fs.readdirSync(projectDirectory).filter((name) => name.startsWith('freeze')),
      ).toHaveLength(0);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('removes the allocated artifact when metadata inspection fails', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-invalid-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const source = new GenericScore();
      source.setName('Invalid artifact source');
      source.setStartTime(TimePosition.beats(0));
      source.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(source);

      const operation = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
          platform: 'linux',
        },
        [createTarget(0)],
        'freeze-invalid',
        vi.fn(),
        {
          runCsound: async (args) => {
            fs.writeFileSync(args[1]!, 'not audio');
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(operation.ok).toBe(false);
      expect(operation.error).toMatch(/unsupported audio format|too short/i);
      expect(layer[0]).toBe(source);
      expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('freeze'))).toEqual(
        [],
      );
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('rejects a freeze artifact whose audio format does not match the platform extension', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-format-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const source = new GenericScore();
      source.setStartTime(TimePosition.beats(0));
      source.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(source);

      const operation = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'utility-csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
          platform: 'linux',
        },
        [createTarget(0)],
        'freeze-format',
        vi.fn(),
        {
          runCsound: async (args) => {
            fs.writeFileSync(args[1]!, buildAiffBytes(1, 100, 16, 100));
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(operation.ok).toBe(false);
      expect(operation.error).toMatch(/format AIFF does not match expected WAV/i);
      expect(layer[0]).toBe(source);
      expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('freeze'))).toEqual(
        [],
      );
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('cancels without replacing the source or retaining the generated artifact', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-cancel-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const source = new GenericScore();
      source.setStartTime(TimePosition.beats(0));
      source.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(source);
      let cancelled = false;

      const operation = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'utility-csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
          platform: 'linux',
          isCancelled: () => cancelled,
        },
        [createTarget(0)],
        'freeze-cancel',
        vi.fn(),
        {
          runCsound: async (args) => {
            fs.writeFileSync(args[1]!, createWavFile());
            cancelled = true;
            return { exitCode: -1, stderr: 'cancelled' };
          },
        },
      );

      expect(operation.cancelled).toBe(true);
      expect(layer[0]).toBe(source);
      expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('freeze'))).toEqual(
        [],
      );
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('replaces the canonical object and exposes the Frozen editor and bar snapshot', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-success-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const source = new GenericScore();
      source.setName('Pattern1');
      source.setStartTime(TimePosition.beats(0));
      source.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(source);

      const runCsound = vi.fn(async (args: string[]) => {
        fs.writeFileSync(args[1]!, createWavFile(2));
        return { exitCode: 0, stderr: '' };
      });
      const operation = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
          platform: 'linux',
        },
        [createTarget(0)],
        'freeze-success',
        vi.fn(),
        { runCsound },
      );

      expect(operation.ok).toBe(true);
      expect(layer[0]).toBeInstanceOf(FrozenSoundObject);
      expect(layer[0].getName()).toBe('F: Pattern1');
      expect((layer[0] as FrozenSoundObject).getNumChannels()).toBe(2);
      expect(layer[0].getSubjectiveDuration().getValue()).toBeGreaterThan(0);
      expect(runCsound).toHaveBeenCalledWith(
        expect.arrayContaining(['-Wdo', path.join(projectDirectory, 'freeze0.wav')]),
        projectDirectory,
        expect.any(Function),
        undefined,
        expect.any(Function),
      );

      const snapshot = createProjectEditorSnapshot(
        data,
        path.join(projectDirectory, 'test.blue'),
        1,
      );
      const row = snapshot.score!.layerGroups[0]!.layers[0]!.items[0]!;
      expect(row.objectType).toBe('FrozenSoundObject');
      expect(row.barRenderer).toMatchObject({
        kind: 'frozenSoundObject',
        frozenWaveFileName: 'freeze0.wav',
        waveformKey: 'fso:freeze0.wav',
      });

      const document = createScoreObjectEditorDocument(data, { target: row.editorTarget! });
      expect(document?.editor).toMatchObject({
        kind: 'frozenSoundObject',
        frozenWaveFileName: 'freeze0.wav',
        sourceName: 'Pattern1',
        sourceType: 'GenericScore',
      });
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('rejects library-owned targets', () => {
    const data = new BlueData();
    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'lib-1',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'library',
      displayContext: 'library',
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const { resolved, rejected } = resolveFreezeTargets(data, [target]);
    expect(resolved).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain('timeline');
  });

  it('rejects targets without a location', () => {
    const data = new BlueData();
    const target: ScoreObjectEditorTargetSnapshot = {
      selectionId: 'no-loc',
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };

    const { resolved, rejected } = resolveFreezeTargets(data, [target]);
    expect(resolved).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });
});

describe('executeFreezeUnfreeze item events', () => {
  function createTarget(
    objectIndex: number,
    selectionId = `sel-${objectIndex}`,
  ): ScoreObjectEditorTargetSnapshot {
    return {
      selectionId,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };
  }

  function createContext(data: BlueData, projectDirectory: string) {
    return {
      data,
      projectDirectory,
      utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 4 },
      platform: 'linux',
    };
  }

  it('emits pending, running with the allocated file, streamed output, and complete for a freeze', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-item-events-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const source = new GenericScore();
      source.setName('ItemSource');
      source.setStartTime(TimePosition.beats(0));
      source.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(source);

      const events: FreezeItemStatus[] = [];
      const operation = await executeFreezeUnfreeze(
        createContext(data, projectDirectory),
        [createTarget(0)],
        'freeze-item-events',
        vi.fn(),
        {
          runCsound: async (
            args: string[],
            _cwd: string,
            _onProgress,
            _totalDuration,
            onOutput,
          ) => {
            onOutput?.('chunk-a', 'stdout');
            onOutput?.('chunk-b\n', 'stderr');
            fs.writeFileSync(args[1]!, createWavFile());
            return { exitCode: 0, stderr: '' };
          },
        },
        (event) => {
          events.push(event);
        },
      );

      expect(operation.ok).toBe(true);
      expect(events.filter((event) => event.phase === 'pending')).toEqual([
        expect.objectContaining({
          operationId: 'freeze-item-events',
          selectionId: 'sel-0',
          name: 'ItemSource',
          action: 'freeze',
          freezeFile: null,
        }),
      ]);

      const running = events.filter((event) => event.phase === 'running');
      expect(running[0]).toMatchObject({
        selectionId: 'sel-0',
        freezeFile: null,
        outputAppend: null,
      });
      expect(running).toContainEqual(
        expect.objectContaining({ freezeFile: 'freeze0.wav', outputAppend: null }),
      );
      expect(running).toContainEqual(
        expect.objectContaining({ outputAppend: 'chunk-a', outputType: 'stdout' }),
      );
      expect(running).toContainEqual(
        expect.objectContaining({ outputAppend: 'chunk-b\n', outputType: 'stderr' }),
      );

      expect(events.filter((event) => event.phase === 'rendered')).toEqual([
        expect.objectContaining({
          selectionId: 'sel-0',
          action: 'freeze',
          freezeFile: 'freeze0.wav',
        }),
      ]);

      expect(events.filter((event) => event.phase === 'complete')).toEqual([
        expect.objectContaining({
          selectionId: 'sel-0',
          name: 'ItemSource',
          action: 'freeze',
          freezeFile: 'freeze0.wav',
        }),
      ]);
      expect(events.filter((event) => event.phase === 'failed')).toEqual([]);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('emits pending and complete carrying the freeze file for an unfreeze', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-item-unfreeze-'));
    try {
      fs.writeFileSync(path.join(projectDirectory, 'freeze0.wav'), createWavFile());
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const source = new GenericScore();
      source.setName('ThawMe');
      const frozen = new FrozenSoundObject();
      frozen.setName('F: ThawMe');
      frozen.setFrozenSoundObject(source);
      frozen.setFrozenWaveFileName('freeze0.wav');
      frozen.setStartTime(TimePosition.beats(0));
      frozen.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(frozen);

      const events: FreezeItemStatus[] = [];
      const operation = await executeFreezeUnfreeze(
        createContext(data, projectDirectory),
        [createTarget(0)],
        'freeze-item-unfreeze',
        vi.fn(),
        { runCsound: vi.fn() },
        (event) => {
          events.push(event);
        },
      );

      expect(operation.ok).toBe(true);
      expect(operation.unfrozenCount).toBe(1);
      expect(events.map((event) => event.phase)).toEqual(['pending', 'running', 'complete']);
      for (const event of events) {
        expect(event).toMatchObject({
          selectionId: 'sel-0',
          name: 'F: ThawMe',
          action: 'unfreeze',
          freezeFile: 'freeze0.wav',
        });
      }
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('emits a failed item event with the reason when Csound fails', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-item-fail-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const source = new GenericScore();
      source.setName('Doomed');
      source.setStartTime(TimePosition.beats(0));
      source.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(source);

      const events: FreezeItemStatus[] = [];
      const operation = await executeFreezeUnfreeze(
        createContext(data, projectDirectory),
        [createTarget(0)],
        'freeze-item-fail',
        vi.fn(),
        {
          runCsound: async () => ({ exitCode: 1, stderr: 'csound blew up' }),
        },
        (event) => {
          events.push(event);
        },
      );

      expect(operation.ok).toBe(false);
      const failed = events.filter((event) => event.phase === 'failed');
      expect(failed).toEqual([
        expect.objectContaining({
          selectionId: 'sel-0',
          name: 'Doomed',
          action: 'freeze',
          reason: expect.stringContaining('Csound exited with code 1'),
        }),
      ]);
      expect(events.filter((event) => event.phase === 'complete')).toEqual([]);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('does not report staged items complete when a later target fails', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-item-rollback-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const first = new GenericScore();
      first.setName('First');
      first.setStartTime(TimePosition.beats(0));
      first.setSubjectiveDuration(TimeDuration.beats(1));
      const second = new GenericScore();
      second.setName('Second');
      second.setStartTime(TimePosition.beats(1));
      second.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(first, second);

      const events: FreezeItemStatus[] = [];
      let runCount = 0;
      const operation = await executeFreezeUnfreeze(
        createContext(data, projectDirectory),
        [createTarget(0), createTarget(1)],
        'freeze-item-rollback',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            runCount += 1;
            if (runCount === 1) {
              fs.writeFileSync(args[1]!, createWavFile());
              return { exitCode: 0, stderr: '' };
            }
            return { exitCode: 1, stderr: 'second object failed' };
          },
        },
        (event) => {
          events.push(event);
        },
      );

      expect(operation.ok).toBe(false);
      expect(layer[0]).toBe(first);
      expect(layer[1]).toBe(second);
      expect(events.filter((event) => event.phase === 'complete')).toEqual([]);
      expect(events).toContainEqual(
        expect.objectContaining({
          selectionId: 'sel-1',
          phase: 'failed',
        }),
      );
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('emits failed item events for targets rejected during resolution', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-item-reject-'));
    try {
      const data = new BlueData();
      const target = createTarget(0, 'lib-1');
      target.ownerKind = 'library';
      target.displayContext = 'library';
      delete target.location;

      const events: FreezeItemStatus[] = [];
      const operation = await executeFreezeUnfreeze(
        createContext(data, projectDirectory),
        [target],
        'freeze-item-reject',
        vi.fn(),
        { runCsound: vi.fn() },
        (event) => {
          events.push(event);
        },
      );

      expect(operation.ok).toBe(false);
      expect(events).toEqual([
        expect.objectContaining({
          selectionId: 'lib-1',
          phase: 'failed',
          reason: expect.stringContaining('timeline'),
        }),
      ]);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });
});

describe('executeFreezeUnfreeze parallel execution (SPEC 085)', () => {
  function createTarget(objectIndex: number): ScoreObjectEditorTargetSnapshot {
    return {
      selectionId: `sel-${objectIndex}`,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };
  }

  function createContext(data: BlueData, projectDirectory: string, freezeMaxJobs: number) {
    return {
      data,
      projectDirectory,
      utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs },
      platform: 'linux',
    };
  }

  function addSource(layer: unknown[], index: number): GenericScore {
    const source = new GenericScore();
    source.setName(`Source ${index}`);
    source.setStartTime(TimePosition.beats(index));
    source.setSubjectiveDuration(TimeDuration.beats(1));
    layer.push(source);
    return source;
  }

  async function waitFor(
    predicate: () => boolean,
    label: string,
    deadlineMs = 3000,
  ): Promise<void> {
    const startedAt = Date.now();
    while (!predicate()) {
      if (Date.now() - startedAt > deadlineMs) {
        throw new Error(`Timed out waiting for: ${label}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  it('runs freeze renders concurrently up to the configured max jobs', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-parallel-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 4; index++) addSource(layer, index);

      let active = 0;
      let peak = 0;
      let releaseBarrier: () => void = () => undefined;
      const barrier = new Promise<void>((resolve) => {
        releaseBarrier = resolve;
      });

      const operation = await executeFreezeUnfreeze(
        createContext(data, projectDirectory, 4),
        [0, 1, 2, 3].map((index) => createTarget(index)),
        'freeze-parallel',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            active += 1;
            peak = Math.max(peak, active);
            if (active === 4) releaseBarrier();
            await Promise.race([barrier, new Promise((resolve) => setTimeout(resolve, 300))]);
            fs.writeFileSync(args[1]!, createWavFile());
            active -= 1;
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(peak).toBe(4);
      expect(operation.ok).toBe(true);
      expect(operation.frozenCount).toBe(4);
      expect(layer.filter((sObj) => sObj instanceof FrozenSoundObject)).toHaveLength(4);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('queues jobs beyond the cap and produces order-independent results', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-queue-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 6; index++) addSource(layer, index);

      const gates: Array<() => void> = [];
      const gatePromises = Array.from(
        { length: 6 },
        () =>
          new Promise<void>((resolve) => {
            gates.push(resolve);
          }),
      );
      let dispatchIndex = 0;
      let active = 0;
      let peak = 0;
      const outputPaths: string[] = [];

      const operationPromise = executeFreezeUnfreeze(
        createContext(data, projectDirectory, 4),
        [0, 1, 2, 3, 4, 5].map((index) => createTarget(index)),
        'freeze-queue',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            const myIndex = dispatchIndex++;
            active += 1;
            peak = Math.max(peak, active);
            outputPaths.push(args[1]!);
            await gatePromises[myIndex];
            fs.writeFileSync(args[1]!, createWavFile());
            active -= 1;
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      await waitFor(
        () => dispatchIndex === 4 && active === 4,
        'first four jobs running concurrently',
      );
      expect(dispatchIndex).toBe(4);

      // Complete jobs in reverse order to prove results are order-independent.
      gates[3]!();
      await waitFor(() => dispatchIndex === 5, 'fifth job dispatched after a slot freed');
      for (const gate of gates) gate();
      const operation = await operationPromise;

      expect(peak).toBe(4);
      expect(operation.ok).toBe(true);
      expect(operation.frozenCount).toBe(6);

      const freezeFiles = Array.from(layer as unknown[])
        .filter((sObj): sObj is FrozenSoundObject => sObj instanceof FrozenSoundObject)
        .map((sObj) => sObj.getFrozenWaveFileName())
        .sort();
      expect(freezeFiles).toEqual([
        'freeze0.wav',
        'freeze1.wav',
        'freeze2.wav',
        'freeze3.wav',
        'freeze4.wav',
        'freeze5.wav',
      ]);
      expect(new Set(outputPaths).size).toBe(6);
      for (let index = 0; index < 6; index++) {
        const frozen = layer[index] as FrozenSoundObject;
        expect(frozen.getName()).toBe(`F: Source ${index}`);
      }
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('allocates pairwise-distinct freeze filenames for parallel jobs', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-names-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 5; index++) addSource(layer, index);

      const gates: Array<() => void> = [];
      const gatePromises = Array.from(
        { length: 5 },
        () =>
          new Promise<void>((resolve) => {
            gates.push(resolve);
          }),
      );
      let dispatchIndex = 0;
      const outputPaths: string[] = [];

      const operationPromise = executeFreezeUnfreeze(
        createContext(data, projectDirectory, 2),
        [0, 1, 2, 3, 4].map((index) => createTarget(index)),
        'freeze-names',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            const myIndex = dispatchIndex++;
            outputPaths.push(args[1]!);
            await gatePromises[myIndex];
            fs.writeFileSync(args[1]!, createWavFile());
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      await waitFor(() => dispatchIndex === 2, 'two jobs dispatched under cap 2');
      for (const gate of gates) gate();
      const operation = await operationPromise;

      expect(operation.ok).toBe(true);
      expect(outputPaths).toHaveLength(5);
      expect(new Set(outputPaths).size).toBe(5);
      const names = outputPaths.map((outputPath) => path.basename(outputPath)).sort();
      expect(names).toEqual([
        'freeze0.wav',
        'freeze1.wav',
        'freeze2.wav',
        'freeze3.wav',
        'freeze4.wav',
      ]);
      for (const outputPath of outputPaths) {
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('renders strictly one at a time in input order with freezeMaxJobs 1', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-serial-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 3; index++) addSource(layer, index);

      let active = 0;
      let peak = 0;
      let completed = 0;
      const renderOrder: string[] = [];

      const operation = await executeFreezeUnfreeze(
        createContext(data, projectDirectory, 1),
        [0, 1, 2].map((index) => createTarget(index)),
        'freeze-serial',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            expect(active, 'a new render must not start before the previous one completed').toBe(0);
            expect(completed, 'renders dispatch in input order').toBe(renderOrder.length);
            active += 1;
            peak = Math.max(peak, active);
            renderOrder.push(path.basename(args[1]!));
            await new Promise((resolve) => setTimeout(resolve, 10));
            fs.writeFileSync(args[1]!, createWavFile());
            active -= 1;
            completed += 1;
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(peak).toBe(1);
      expect(renderOrder).toEqual(['freeze0.wav', 'freeze1.wav', 'freeze2.wav']);
      expect(operation.ok).toBe(true);
      expect(operation.frozenCount).toBe(3);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('does not occupy render slots for unfreeze items in a mixed selection', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-mixed-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      addSource(layer, 0);
      addSource(layer, 1);
      const nestedSource = new GenericScore();
      nestedSource.setName('Nested');
      nestedSource.setStartTime(TimePosition.beats(5));
      nestedSource.setSubjectiveDuration(TimeDuration.beats(1));
      const frozen = new FrozenSoundObject();
      frozen.setFrozenSoundObject(nestedSource);
      frozen.setFrozenWaveFileName('freeze9.wav');
      frozen.setName('F: Nested');
      frozen.setStartTime(TimePosition.beats(5));
      frozen.setSubjectiveDuration(TimeDuration.beats(1));
      layer.push(frozen);
      fs.writeFileSync(path.join(projectDirectory, 'freeze9.wav'), createWavFile());

      let renderCalls = 0;
      let active = 0;
      let peak = 0;
      const operation = await executeFreezeUnfreeze(
        createContext(data, projectDirectory, 2),
        [0, 1, 2].map((index) => createTarget(index)),
        'freeze-mixed',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            renderCalls += 1;
            active += 1;
            peak = Math.max(peak, active);
            fs.writeFileSync(args[1]!, createWavFile());
            await new Promise((resolve) => setTimeout(resolve, 10));
            active -= 1;
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(operation.ok).toBe(true);
      expect(operation.frozenCount).toBe(2);
      expect(operation.unfrozenCount).toBe(1);
      expect(renderCalls, 'only the two freeze items render').toBe(2);
      expect(peak).toBe(2);
      expect(layer[0]).toBeInstanceOf(FrozenSoundObject);
      expect(layer[1]).toBeInstanceOf(FrozenSoundObject);
      expect(layer[2]).toBeInstanceOf(GenericScore);
      expect((layer[2] as GenericScore).getName()).toBe('Nested');
      expect(fs.existsSync(path.join(projectDirectory, 'freeze9.wav'))).toBe(false);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });
});

describe('executeFreezeUnfreeze hybrid failure handling (SPEC 085)', () => {
  function createTarget(objectIndex: number): ScoreObjectEditorTargetSnapshot {
    return {
      selectionId: `sel-${objectIndex}`,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };
  }

  function addSource(layer: unknown[], index: number): GenericScore {
    const source = new GenericScore();
    source.setName(`Source ${index}`);
    source.setStartTime(TimePosition.beats(index));
    source.setSubjectiveDuration(TimeDuration.beats(1));
    layer.push(source);
    return source;
  }

  async function waitFor(
    predicate: () => boolean,
    label: string,
    deadlineMs = 3000,
  ): Promise<void> {
    const startedAt = Date.now();
    while (!predicate()) {
      if (Date.now() - startedAt > deadlineMs) {
        throw new Error(`Timed out waiting for: ${label}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  it('drains in-flight jobs when one object fails per-object', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-drain-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 3; index++) addSource(layer, index);

      const gates: Array<() => void> = [];
      const gatePromises = Array.from(
        { length: 3 },
        () =>
          new Promise<void>((resolve) => {
            gates.push(resolve);
          }),
      );
      let dispatchIndex = 0;
      const dispatched: number[] = [];
      const jobReturned = new Set<number>();

      const operationPromise = executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 2 },
          platform: 'linux',
        },
        [0, 1, 2].map((index) => createTarget(index)),
        'freeze-drain',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            const myIndex = dispatchIndex++;
            dispatched.push(myIndex);
            await gatePromises[myIndex];
            jobReturned.add(myIndex);
            if (myIndex === 0) {
              return { exitCode: 1, stderr: 'render error' };
            }
            fs.writeFileSync(args[1]!, createWavFile());
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      await waitFor(() => dispatchIndex === 2, 'two jobs in flight under cap 2');
      gates[0]!();
      await waitFor(() => jobReturned.has(0), 'failing job settled');
      // The in-flight job is allowed to finish; no new job may dispatch.
      gates[1]!();
      const operation = await operationPromise;

      expect(dispatched).toEqual([0, 1]);
      expect(operation.ok).toBe(false);
      expect(operation.rejectedTargets).toEqual([
        expect.objectContaining({ selectionId: 'sel-0' }),
      ]);
      for (const source of layer) {
        expect(source).toBeInstanceOf(GenericScore);
      }
      const leftovers = fs
        .readdirSync(projectDirectory)
        .filter((name) => name.startsWith('freeze') || name.startsWith('tempCsd'));
      expect(leftovers).toEqual([]);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('removes an artifact when staging fails after the render succeeds', async () => {
    const projectDirectory = fs.mkdtempSync(
      path.join(process.cwd(), 'freeze-post-render-failure-'),
    );
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      const source = addSource(layer, 0);
      let outputPath: string | undefined;

      const operation = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 1 },
          platform: 'linux',
        },
        [createTarget(0)],
        'freeze-post-render-failure',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            outputPath = args[1];
            fs.writeFileSync(args[1]!, createWavFile());
            vi.spyOn(source, 'deepCopy').mockImplementationOnce(() => {
              throw new Error('FrozenSoundObject construction failed');
            });
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(operation.ok).toBe(false);
      expect(operation.error).toContain('FrozenSoundObject construction failed');
      expect(outputPath).toBeDefined();
      expect(fs.existsSync(outputPath!)).toBe(false);
      expect(layer[0]).toBe(source);
      expect(
        fs
          .readdirSync(projectDirectory)
          .filter((name) => name.startsWith('freeze') || name.startsWith('tempCsd')),
      ).toEqual([]);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('aborts all in-flight jobs immediately on a systemic failure', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-systemic-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 3; index++) addSource(layer, index);

      const gates: Array<() => void> = [];
      const gatePromises = Array.from(
        { length: 3 },
        () =>
          new Promise<void>((resolve) => {
            gates.push(resolve);
          }),
      );
      let cancelInflight: () => void = () => undefined;
      const cancelPromise = new Promise<void>((resolve) => {
        cancelInflight = resolve;
      });
      const cancelledJobs: number[] = [];
      let dispatchIndex = 0;
      let abortRequested = false;

      const operation = await executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 3 },
          platform: 'linux',
          abortInFlight: () => {
            abortRequested = true;
            cancelInflight();
          },
        },
        [0, 1, 2].map((index) => createTarget(index)),
        'freeze-systemic',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            const myIndex = dispatchIndex++;
            if (myIndex === 0) {
              return {
                exitCode: -1,
                stderr: 'Blue Engine unavailable',
                errorCode: 'CSOUND_UNAVAILABLE',
              };
            }
            const winner = await Promise.race([
              gatePromises[myIndex].then(() => 'gate' as const),
              cancelPromise.then(() => 'cancelled' as const),
            ]);
            if (winner === 'cancelled') {
              cancelledJobs.push(myIndex);
              return { exitCode: -1, stderr: 'Operation cancelled.', cancelled: true };
            }
            fs.writeFileSync(args[1]!, createWavFile());
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      expect(abortRequested).toBe(true);
      expect(cancelledJobs.sort()).toEqual([1, 2]);
      expect(gates).toHaveLength(3);
      expect(operation.ok).toBe(false);
      expect(operation.error).toContain('CSOUND_UNAVAILABLE');
      expect(operation.rejectedTargets).toEqual([
        expect.objectContaining({ selectionId: 'sel-0' }),
      ]);
      for (const source of layer) {
        expect(source).toBeInstanceOf(GenericScore);
      }
      const leftovers = fs
        .readdirSync(projectDirectory)
        .filter((name) => name.startsWith('freeze') || name.startsWith('tempCsd'));
      expect(leftovers).toEqual([]);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });

  it('cancels cleanly while several jobs are in flight', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-cancel-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 3; index++) addSource(layer, index);

      const gates: Array<() => void> = [];
      const gatePromises = Array.from(
        { length: 3 },
        () =>
          new Promise<void>((resolve) => {
            gates.push(resolve);
          }),
      );
      let cancelled = false;
      let dispatchIndex = 0;

      const operationPromise = executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 3 },
          platform: 'linux',
          isCancelled: () => cancelled,
        },
        [0, 1, 2].map((index) => createTarget(index)),
        'freeze-cancel',
        vi.fn(),
        {
          runCsound: async (args: string[]) => {
            const myIndex = dispatchIndex++;
            await gatePromises[myIndex];
            fs.writeFileSync(args[1]!, createWavFile());
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      await waitFor(() => dispatchIndex === 3, 'all three jobs in flight');
      cancelled = true;
      for (const gate of gates) gate();
      const operation = await operationPromise;

      expect(operation.cancelled).toBe(true);
      expect(operation.ok).toBe(false);
      for (const source of layer) {
        expect(source).toBeInstanceOf(GenericScore);
      }
      const leftovers = fs
        .readdirSync(projectDirectory)
        .filter((name) => name.startsWith('freeze') || name.startsWith('tempCsd'));
      expect(leftovers).toEqual([]);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });
});

describe('executeFreezeUnfreeze aggregate progress (SPEC 085)', () => {
  function createTarget(objectIndex: number): ScoreObjectEditorTargetSnapshot {
    return {
      selectionId: `sel-${objectIndex}`,
      selectedObjectType: 'GenericScore',
      editorObjectType: 'GenericScore',
      ownerKind: 'timeline',
      displayContext: 'timeline',
      location: { rootGroupIndex: 0, containerPath: [], layerIndex: 0, objectIndex },
      supportsTimeBehavior: true,
      supportsRepeatPoint: true,
      supportsNoteProcessorChain: true,
    };
  }

  async function waitFor(
    predicate: () => boolean,
    label: string,
    deadlineMs = 3000,
  ): Promise<void> {
    const startedAt = Date.now();
    while (!predicate()) {
      if (Date.now() - startedAt > deadlineMs) {
        throw new Error(`Timed out waiting for: ${label}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  it('reports order-independent aggregate progress across concurrent jobs', async () => {
    const projectDirectory = fs.mkdtempSync(path.join(process.cwd(), 'freeze-progress-'));
    try {
      const data = new BlueData();
      const layer = (data.getScore()[0] as PolyObject)[0];
      for (let index = 0; index < 2; index++) {
        const source = new GenericScore();
        source.setName(`Source ${index}`);
        source.setStartTime(TimePosition.beats(index));
        source.setSubjectiveDuration(TimeDuration.beats(1));
        layer.push(source);
      }

      const statuses: Array<{ phase: string; progress: number | null }> = [];
      const gates: Array<() => void> = [];
      const gatePromises = Array.from(
        { length: 2 },
        () =>
          new Promise<void>((resolve) => {
            gates.push(resolve);
          }),
      );
      let dispatchIndex = 0;

      const operationPromise = executeFreezeUnfreeze(
        {
          data,
          projectDirectory,
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo', freezeMaxJobs: 2 },
          platform: 'linux',
        },
        [0, 1].map((index) => createTarget(index)),
        'freeze-progress',
        (status) => {
          statuses.push({ phase: status.phase, progress: status.progress });
        },
        {
          runCsound: async (
            args: string[],
            _cwd: string,
            onProgress?: (progress: number) => void,
          ) => {
            const myIndex = dispatchIndex++;
            await gatePromises[myIndex];
            onProgress?.(myIndex === 0 ? 50 : 100);
            fs.writeFileSync(args[1]!, createWavFile());
            return { exitCode: 0, stderr: '' };
          },
        },
      );

      await waitFor(() => dispatchIndex === 2, 'both jobs in flight');
      // Complete in reverse dispatch order to prove order independence.
      gates[1]!();
      gates[0]!();
      const operation = await operationPromise;

      expect(operation.ok).toBe(true);

      const renderingProgress = statuses
        .filter((status) => status.phase === 'rendering' && status.progress !== null)
        .map((status) => status.progress!);
      // (0 + 100%) / 2 jobs -> 45; (1 complete + 50%) -> 67.5; all complete -> 90.
      expect(renderingProgress).toContain(45);
      expect(renderingProgress).toContain(67.5);
      expect(renderingProgress).toContain(90);
      expect(renderingProgress.filter((progress) => progress === 90)).toHaveLength(1);
      expect(renderingProgress.slice(0, -1).every((progress) => progress < 90)).toBe(true);
      for (let index = 1; index < renderingProgress.length; index++) {
        expect(renderingProgress[index]).toBeGreaterThanOrEqual(renderingProgress[index - 1]!);
      }
      expect(Math.max(...renderingProgress)).toBeLessThanOrEqual(90);

      const aggregateProgress = statuses
        .filter((status) => status.progress !== null)
        .map((status) => status.progress!);
      for (let index = 1; index < aggregateProgress.length; index++) {
        expect(aggregateProgress[index]).toBeGreaterThanOrEqual(aggregateProgress[index - 1]!);
      }

      const committing = statuses.filter((status) => status.phase === 'committing');
      expect(committing).toHaveLength(1);
      expect(committing[0]!.progress).toBe(95);

      const completed = statuses.filter((status) => status.phase === 'completed');
      expect(completed).toHaveLength(1);
      expect(completed[0]!.progress).toBe(100);
      expect(statuses.filter((status) => status.progress === 100)).toHaveLength(1);
    } finally {
      fs.rmSync(projectDirectory, { recursive: true, force: true });
    }
  });
});
