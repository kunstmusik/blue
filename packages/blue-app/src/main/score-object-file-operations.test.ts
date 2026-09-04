import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import { buildWavBytes, buildAiffBytes } from '@blue/data';
import {
  selectScoreObjectAudioFile,
  saveFrozenSoundObjectCopy,
  inspectAudioFileMetadata,
  inspectFrozenArtifact,
  formatChannelVariables,
  type ScoreObjectFileOperationDeps,
  type ScoreObjectFileOperationProbe,
} from './score-object-file-operations';

describe('score-object-file-operations', () => {
  const projectDir = path.resolve('test', 'project');
  const externalAudioPath = path.resolve('external', 'audio.aif');
  const sfDir = path.resolve('sfx');
  const mediaAudioPath = path.join('media', 'audio.aif');
  const mediaCollisionPath = path.join('media', 'audio-001.aif');
  const validWav = buildWavBytes(2, 44100, 16, 44100);
  const validAiff = buildAiffBytes(1, 48000, 16, 48000);

  function createTestFixtureFS() {
    const files = new Map<string, Uint8Array>();
    const dirs = new Set<string>([projectDir]);

    files.set(path.join(projectDir, 'sample.wav'), validWav);
    files.set(externalAudioPath, validAiff);
    files.set(path.join(projectDir, 'freeze0.wav'), validWav);
    files.set(path.join(projectDir, 'freeze-unreadable.wav'), validWav);
    files.set(path.join(sfDir, 'voice.wav'), validWav);
    files.set(path.join(projectDir, 'corrupt.wav'), new Uint8Array([1, 2, 3, 4]));

    const probe: ScoreObjectFileOperationProbe = {
      isFile: (p: string) => files.has(p),
      isDirectory: (p: string) => dirs.has(p),
      exists: (p: string) => files.has(p) || dirs.has(p),
    };

    const deps: ScoreObjectFileOperationDeps = {
      probe,
      readFileBytes: (p: string) => {
        if (p === path.join(projectDir, 'freeze-unreadable.wav')) {
          throw new Error(`EACCES: ${p}`);
        }
        const data = files.get(p);
        if (!data) throw new Error(`ENOENT: ${p}`);
        return data;
      },
      copyFile: (src: string, dest: string) => {
        const data = files.get(src);
        if (!data) throw new Error(`ENOENT: ${src}`);
        files.set(dest, new Uint8Array(data));
      },
      ensureDir: (dir: string) => {
        dirs.add(dir);
      },
      compareFiles: (pathA: string, pathB: string) => {
        const a = files.get(pathA);
        const b = files.get(pathB);
        if (!a || !b || a.length !== b.length) return false;
        return a.every((val, i) => val === b[i]);
      },
      getFileSize: (p: string) => files.get(p)?.length ?? 0,
    };

    return { files, dirs, probe, deps };
  }

  describe('formatChannelVariables', () => {
    it('formats channel variables matching Java feedback', () => {
      expect(formatChannelVariables(0)).toBe('');
      expect(formatChannelVariables(1)).toBe('aChannel1');
      expect(formatChannelVariables(2)).toBe('aChannel1, aChannel2');
      expect(formatChannelVariables(4)).toBe('aChannel1, aChannel2, aChannel3, aChannel4');
    });
  });

  describe('inspectAudioFileMetadata', () => {
    it('returns empty status for blank path', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectAudioFileMetadata(
        '',
        { projectDirectory: projectDir, sfDir: null },
        deps,
      );
      expect(result.status).toBe('empty');
    });

    it('returns missing status for non-existent file', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectAudioFileMetadata(
        'nonexistent.wav',
        { projectDirectory: projectDir, sfDir: null },
        deps,
      );
      expect(result.status).toBe('missing');
      if (result.status === 'missing') {
        expect(result.path).toBe('nonexistent.wav');
        expect(result.message).toContain('Could not find file');
      }
    });

    it('returns available status with parsed metadata for valid file', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectAudioFileMetadata(
        'sample.wav',
        { projectDirectory: projectDir, sfDir: null },
        deps,
      );
      expect(result.status).toBe('available');
      if (result.status === 'available') {
        expect(result.formatType).toBe('WAV');
        expect(result.channels).toBe(2);
        expect(result.sampleRate).toBe(44100);
        expect(result.sampleSizeInBits).toBe(16);
        expect(result.durationSeconds).toBeCloseTo(1.0, 5);
        expect(result.channelVariables).toBe('aChannel1, aChannel2');
        expect(result.encodingType).toBe('PCM');
        expect(result.isBigEndian).toBe(false);
      }
    });

    it('returns unsupported status for corrupt file', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectAudioFileMetadata(
        'corrupt.wav',
        { projectDirectory: projectDir, sfDir: null },
        deps,
      );
      expect(result.status).toBe('unsupported');
      if (result.status === 'unsupported') {
        expect(result.path).toBe('corrupt.wav');
      }
    });

    it('resolves a separator-less file through the effective SFDIR context', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectAudioFileMetadata('voice.wav', { projectDirectory: null, sfDir }, deps);

      expect(result.status).toBe('available');
      if (result.status === 'available') {
        expect(result.channels).toBe(2);
      }
    });
  });

  describe('inspectFrozenArtifact', () => {
    it('returns empty when no filename is given', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectFrozenArtifact('', { projectDirectory: projectDir, sfDir: null }, deps);
      expect(result.artifactStatus).toBe('empty');
      expect(result.canSaveCopy).toBe(false);
    });

    it('returns missing when artifact file does not exist', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectFrozenArtifact(
        'freeze99.wav',
        { projectDirectory: projectDir, sfDir: null },
        deps,
      );
      expect(result.artifactStatus).toBe('missing');
      expect(result.canSaveCopy).toBe(false);
    });

    it('returns available when artifact exists', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectFrozenArtifact(
        'freeze0.wav',
        { projectDirectory: projectDir, sfDir: null },
        deps,
      );
      expect(result.artifactStatus).toBe('available');
      expect(result.canSaveCopy).toBe(true);
    });

    it('returns unreadable when the project-local artifact cannot be read', () => {
      const { deps } = createTestFixtureFS();
      const result = inspectFrozenArtifact(
        'freeze-unreadable.wav',
        { projectDirectory: projectDir, sfDir: null },
        deps,
      );

      expect(result.artifactStatus).toBe('unreadable');
      expect(result.canSaveCopy).toBe(false);
      expect(result.message).toContain('Could not read frozen file');
    });
  });

  describe('selectScoreObjectAudioFile', () => {
    it('fails closed when no open-dialog owner is available', async () => {
      const { deps } = createTestFixtureFS();

      const result = await selectScoreObjectAudioFile(
        { context: { projectDirectory: projectDir, sfDir: null } },
        deps,
      );

      expect(result).toMatchObject({
        status: 'error',
        code: 'no-project',
      });
    });

    it('returns cancelled when user cancels chooser', async () => {
      const { deps } = createTestFixtureFS();
      deps.showOpenDialog = vi.fn().mockResolvedValue(null);

      const result = await selectScoreObjectAudioFile(
        { context: { projectDirectory: projectDir, sfDir: null } },
        deps,
      );

      expect(result.status).toBe('cancelled');
    });

    it('returns error when selected path is not a file', async () => {
      const { deps } = createTestFixtureFS();
      deps.showOpenDialog = vi.fn().mockResolvedValue('/some/missing/file.wav');

      const result = await selectScoreObjectAudioFile(
        { context: { projectDirectory: projectDir, sfDir: null } },
        deps,
      );

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('not-a-file');
      }
    });

    it('selects external file without media copy and returns absolute path', async () => {
      const { deps } = createTestFixtureFS();
      deps.showOpenDialog = vi.fn().mockResolvedValue(externalAudioPath);

      const result = await selectScoreObjectAudioFile(
        {
          context: { projectDirectory: projectDir, sfDir: null },
          projectProps: { copyToMediaFileOnImport: false },
        },
        deps,
      );

      expect(result.status).toBe('selected');
      if (result.status === 'selected') {
        expect(result.storedPath).toBe(externalAudioPath);
        expect(result.objectName).toBe('audio.aif');
        expect(result.copiedToMedia).toBe(false);
        expect(result.metadata.formatType).toBe('AIFF');
        expect(result.metadata.channels).toBe(1);
        expect(result.metadata.channelVariables).toBe('aChannel1');
      }
    });

    it('selects file inside project directory and stores project-relative path', async () => {
      const { deps } = createTestFixtureFS();
      deps.showOpenDialog = vi.fn().mockResolvedValue(path.join(projectDir, 'sample.wav'));

      const result = await selectScoreObjectAudioFile(
        {
          context: { projectDirectory: projectDir, sfDir: null },
          projectProps: { copyToMediaFileOnImport: false },
        },
        deps,
      );

      expect(result.status).toBe('selected');
      if (result.status === 'selected') {
        expect(result.storedPath).toBe('sample.wav');
        expect(result.objectName).toBe('sample.wav');
        expect(result.copiedToMedia).toBe(false);
      }
    });

    it('copies to media folder on import and updates storedPath to media-relative path', async () => {
      const { deps, files } = createTestFixtureFS();
      deps.showOpenDialog = vi.fn().mockResolvedValue(externalAudioPath);

      const result = await selectScoreObjectAudioFile(
        {
          context: { projectDirectory: projectDir, sfDir: null },
          projectProps: { copyToMediaFileOnImport: true, mediaFolder: 'media' },
        },
        deps,
      );

      expect(result.status).toBe('selected');
      if (result.status === 'selected') {
        expect(result.storedPath).toBe(mediaAudioPath);
        expect(result.objectName).toBe('audio.aif');
        expect(result.copiedToMedia).toBe(true);
        expect(files.has(path.join(projectDir, mediaAudioPath))).toBe(true);
      }
    });

    it('reuses existing identical file in media folder without allocating new suffix', async () => {
      const { deps, files } = createTestFixtureFS();
      const mediaFile = path.join(projectDir, mediaAudioPath);
      files.set(mediaFile, validAiff); // identical content

      deps.showOpenDialog = vi.fn().mockResolvedValue(externalAudioPath);

      const result = await selectScoreObjectAudioFile(
        {
          context: { projectDirectory: projectDir, sfDir: null },
          projectProps: { copyToMediaFileOnImport: true, mediaFolder: 'media' },
        },
        deps,
      );

      expect(result.status).toBe('selected');
      if (result.status === 'selected') {
        expect(result.storedPath).toBe(mediaAudioPath);
        expect(files.has(path.join(projectDir, mediaCollisionPath))).toBe(false);
      }
    });

    it('allocates suffixed filename in media folder when collision has different content', async () => {
      const { deps, files } = createTestFixtureFS();
      const mediaFile = path.join(projectDir, mediaAudioPath);
      files.set(mediaFile, new Uint8Array([9, 9, 9])); // different content

      deps.showOpenDialog = vi.fn().mockResolvedValue(externalAudioPath);

      const result = await selectScoreObjectAudioFile(
        {
          context: { projectDirectory: projectDir, sfDir: null },
          projectProps: { copyToMediaFileOnImport: true, mediaFolder: 'media' },
        },
        deps,
      );

      expect(result.status).toBe('selected');
      if (result.status === 'selected') {
        expect(result.storedPath).toBe(mediaCollisionPath);
        expect(result.objectName).toBe('audio-001.aif');
        expect(files.has(path.join(projectDir, mediaCollisionPath))).toBe(true);
      }
    });
  });

  describe('saveFrozenSoundObjectCopy', () => {
    it('returns error when no project directory is available', async () => {
      const { deps } = createTestFixtureFS();
      const result = await saveFrozenSoundObjectCopy(
        { frozenWaveFileName: 'freeze0.wav', context: { projectDirectory: null, sfDir: null } },
        deps,
      );

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('no-project');
      }
    });

    it('returns error when frozen artifact is missing', async () => {
      const { deps } = createTestFixtureFS();
      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'missing.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('missing-artifact');
      }
    });

    it('rejects absolute and traversal artifact sources before opening Save Copy', async () => {
      const { deps } = createTestFixtureFS();
      deps.showSaveDialog = vi.fn().mockResolvedValue(path.join(projectDir, 'export.wav'));

      for (const frozenWaveFileName of ['/outside.wav', '../outside.wav']) {
        const result = await saveFrozenSoundObjectCopy(
          { frozenWaveFileName, context: { projectDirectory: projectDir, sfDir: null } },
          deps,
        );

        expect(result.status).toBe('error');
        if (result.status === 'error') {
          expect(result.code).toBe('invalid-artifact');
        }
      }
      expect(deps.showSaveDialog).not.toHaveBeenCalled();
    });

    it('rejects saving over the source artifact itself', async () => {
      const { deps } = createTestFixtureFS();
      deps.showSaveDialog = vi.fn().mockResolvedValue(path.join(projectDir, 'freeze0.wav'));

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze0.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('invalid-artifact');
        expect(result.message).toContain('different');
      }
    });

    it('reports an unreadable artifact without opening Save Copy', async () => {
      const { deps } = createTestFixtureFS();
      deps.showSaveDialog = vi.fn().mockResolvedValue(path.join(projectDir, 'export.wav'));

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze-unreadable.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('unreadable-artifact');
      }
      expect(deps.showSaveDialog).not.toHaveBeenCalled();
    });

    it('fails closed when no save-dialog owner is available', async () => {
      const { deps } = createTestFixtureFS();

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze0.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result).toMatchObject({
        status: 'error',
        code: 'no-project',
      });
    });

    it('returns cancelled when user cancels save dialog', async () => {
      const { deps } = createTestFixtureFS();
      deps.showSaveDialog = vi.fn().mockResolvedValue(null);

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze0.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('cancelled');
    });

    it('rejects destination that is a directory', async () => {
      const { deps } = createTestFixtureFS();
      deps.showSaveDialog = vi.fn().mockResolvedValue(projectDir);

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze0.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('directory-destination');
      }
    });

    it('rejects destination starting with freeze', async () => {
      const { deps } = createTestFixtureFS();
      deps.showSaveDialog = vi.fn().mockResolvedValue(path.join(projectDir, 'freeze_copy.wav'));

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze0.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('freeze-destination');
      }
    });

    it('returns cancelled when user declines overwrite of existing non-freeze file', async () => {
      const { deps, files } = createTestFixtureFS();
      const existingDest = path.join(projectDir, 'my_export.wav');
      files.set(existingDest, new Uint8Array([1, 2, 3]));

      deps.showSaveDialog = vi.fn().mockResolvedValue(existingDest);
      deps.confirmOverwrite = vi.fn().mockResolvedValue(false);

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze0.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('cancelled');
    });

    it('successfully copies exact bytes when saving a new copy', async () => {
      const { deps, files } = createTestFixtureFS();
      const dest = path.join(projectDir, 'my_export.wav');

      deps.showSaveDialog = vi.fn().mockResolvedValue(dest);

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze0.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('copied');
      if (result.status === 'copied') {
        expect(result.destinationPath).toBe(dest);
        expect(result.byteLength).toBe(validWav.length);
        expect(files.get(dest)).toEqual(validWav);
      }
    });

    it('copies over an existing destination after explicit confirmation', async () => {
      const { deps, files } = createTestFixtureFS();
      const dest = path.join(projectDir, 'my_export.wav');
      files.set(dest, new Uint8Array([1, 2, 3]));
      deps.showSaveDialog = vi.fn().mockResolvedValue(dest);
      deps.confirmOverwrite = vi.fn().mockResolvedValue(true);

      const result = await saveFrozenSoundObjectCopy(
        {
          frozenWaveFileName: 'freeze0.wav',
          context: { projectDirectory: projectDir, sfDir: null },
        },
        deps,
      );

      expect(result.status).toBe('copied');
      expect(deps.confirmOverwrite).toHaveBeenCalledWith('my_export.wav');
      expect(files.get(dest)).toEqual(validWav);
    });
  });
});
