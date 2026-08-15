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
import { createProjectEditorSnapshot, createScoreObjectEditorDocument } from '../shared/project-editor';

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
    expect(resolveFreezeArtifactPath(tempDir, 'freeze0.wav')).toBe(path.join(tempDir, 'freeze0.wav'));
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
  function createTarget(objectIndex: number, layerIndex = 0, rootGroupIndex = 0): ScoreObjectEditorTargetSnapshot {
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
        utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo' },
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
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo' },
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
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo' },
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
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo' },
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
      expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('freeze'))).toHaveLength(0);
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
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo' },
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
      expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('freeze'))).toEqual([]);
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
          utility: { csoundExecutable: 'utility-csound', freezeFlags: '-Wdo' },
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
      expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('freeze'))).toEqual([]);
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
          utility: { csoundExecutable: 'utility-csound', freezeFlags: '-Wdo' },
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
      expect(fs.readdirSync(projectDirectory).filter((name) => name.startsWith('freeze'))).toEqual([]);
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
          utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo' },
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
      );

      const snapshot = createProjectEditorSnapshot(data, path.join(projectDirectory, 'test.blue'), 1);
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
