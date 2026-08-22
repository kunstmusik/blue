/**
 * Score-object file operations service (Electron main process).
 *
 * Implements:
 *   - AudioFile native selection with project/media path resolution, collision-safe media copying, and metadata probing.
 *   - FrozenSoundObject Save Copy with Java-compatible destination guards, overwrite confirmation, and exact-byte copying.
 *   - AudioFile and FrozenSoundObject metadata and artifact status inspection.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  parseAudioFileMetadata,
  AudioFileMetadataError,
  type AudioFileMetadata,
} from '@blue/data';
import type {
  AudioFileMetadataSnapshot,
  AudioFileMetadataState,
  AudioFileSelectionResult,
  FrozenSoundObjectSaveCopyResult,
} from '../shared/project-editor';
import {
  findAudioFile,
  normalizeReplacementPath,
  defaultFileProbe,
  type MissingAudioFileProbe,
  type MissingAudioResolutionContext,
} from './missing-audio-assets';
import { resolveFreezeArtifactPath } from './freeze-score-objects';

export interface ScoreObjectFileOperationProbe extends MissingAudioFileProbe {
  isDirectory?: (filePath: string) => boolean;
  exists?: (filePath: string) => boolean;
}

export interface ScoreObjectFileOperationDeps {
  showOpenDialog?: (defaultPath?: string) => Promise<string | null>;
  showSaveDialog?: (defaultPath?: string, defaultFileName?: string) => Promise<string | null>;
  confirmOverwrite?: (fileName: string) => Promise<boolean>;
  probe?: ScoreObjectFileOperationProbe;
  readFileBytes?: (filePath: string) => Uint8Array;
  copyFile?: (sourcePath: string, destinationPath: string) => void;
  ensureDir?: (dirPath: string) => void;
  compareFiles?: (pathA: string, pathB: string) => boolean;
  getFileSize?: (filePath: string) => number;
}

export const defaultOperationProbe: ScoreObjectFileOperationProbe = {
  isFile(filePath: string): boolean {
    return defaultFileProbe.isFile(filePath);
  },
  isDirectory(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isDirectory();
    } catch {
      return false;
    }
  },
  exists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  },
};

export const defaultOperationDeps: ScoreObjectFileOperationDeps = {
  probe: defaultOperationProbe,
  readFileBytes(filePath: string): Uint8Array {
    return new Uint8Array(fs.readFileSync(filePath));
  },
  copyFile(sourcePath: string, destinationPath: string): void {
    fs.copyFileSync(sourcePath, destinationPath);
  },
  ensureDir(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
  },
  compareFiles(pathA: string, pathB: string): boolean {
    try {
      const bufA = fs.readFileSync(pathA);
      const bufB = fs.readFileSync(pathB);
      return bufA.equals(bufB);
    } catch {
      return false;
    }
  },
  getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  },
};

export function formatChannelVariables(channels: number): string {
  if (channels <= 0) return '';
  const vars = Array.from({ length: channels }, (_, i) => `aChannel${i + 1}`);
  return vars.join(', ');
}

export function toAudioFileMetadataSnapshot(meta: AudioFileMetadata): AudioFileMetadataSnapshot {
  return {
    formatType: meta.format,
    byteLength: meta.byteLength,
    encodingType: meta.encodingType,
    sampleRate: meta.sampleRate,
    sampleSizeInBits: meta.bitsPerSample,
    channels: meta.channels,
    isBigEndian: meta.isBigEndian,
    durationSeconds: meta.durationSeconds,
    frameCount: meta.frameCount,
    channelVariables: formatChannelVariables(meta.channels),
    unavailableFields: meta.unavailableFields,
  };
}

export function inspectAudioFileMetadata(
  storedPath: string,
  context: MissingAudioResolutionContext,
  deps: ScoreObjectFileOperationDeps = defaultOperationDeps,
): AudioFileMetadataState {
  if (!storedPath || storedPath.trim().length === 0) {
    return { status: 'empty' };
  }

  const probe = deps.probe ?? defaultOperationProbe;
  const resolved = findAudioFile(storedPath, context, probe);
  if (!resolved || !probe.isFile(resolved)) {
    return {
      status: 'missing',
      path: storedPath,
      message: `Could not find file: ${storedPath}`,
    };
  }

  const readBytes = deps.readFileBytes ?? defaultOperationDeps.readFileBytes!;
  let bytes: Uint8Array;
  try {
    bytes = readBytes(resolved);
  } catch {
    return {
      status: 'unreadable',
      path: storedPath,
      message: `Could not read file: ${storedPath}`,
    };
  }

  try {
    const meta = parseAudioFileMetadata(bytes);
    return {
      status: 'available',
      path: storedPath,
      formatType: meta.format,
      byteLength: meta.byteLength,
      encodingType: meta.encodingType,
      sampleRate: meta.sampleRate,
      sampleSizeInBits: meta.bitsPerSample,
      channels: meta.channels,
      isBigEndian: meta.isBigEndian,
      durationSeconds: meta.durationSeconds,
      frameCount: meta.frameCount,
      channelVariables: formatChannelVariables(meta.channels),
      unavailableFields: meta.unavailableFields,
    };
  } catch (err) {
    const message = err instanceof AudioFileMetadataError ? err.message : String(err);
    return {
      status: 'unsupported',
      path: storedPath,
      message,
    };
  }
}

export function inspectFrozenArtifact(
  frozenWaveFileName: string,
  context: MissingAudioResolutionContext,
  deps: ScoreObjectFileOperationDeps = defaultOperationDeps,
): {
  artifactStatus: 'empty' | 'available' | 'missing' | 'unreadable';
  message?: string;
  canSaveCopy: boolean;
} {
  if (!frozenWaveFileName || frozenWaveFileName.trim().length === 0) {
    return { artifactStatus: 'empty', canSaveCopy: false };
  }

  const probe = deps.probe ?? defaultOperationProbe;
  const resolved = context.projectDirectory
    ? resolveFreezeArtifactPath(context.projectDirectory, frozenWaveFileName)
    : null;
  if (!resolved || !probe.isFile(resolved)) {
    return {
      artifactStatus: 'missing',
      message: `Could not locate frozen file: ${frozenWaveFileName}`,
      canSaveCopy: false,
    };
  }

  const readBytes = deps.readFileBytes ?? defaultOperationDeps.readFileBytes!;
  try {
    readBytes(resolved);
  } catch {
    return {
      artifactStatus: 'unreadable',
      message: `Could not read frozen file: ${frozenWaveFileName}`,
      canSaveCopy: false,
    };
  }

  return {
    artifactStatus: 'available',
    canSaveCopy: true,
  };
}

export interface SelectScoreObjectAudioFileOptions {
  currentPath?: string;
  context: MissingAudioResolutionContext;
  projectProps?: {
    copyToMediaFileOnImport?: boolean;
    mediaFolder?: string;
  };
}

export interface MediaFolderCopySuccess {
  status: 'ok';
  /** Absolute path of the source to use: the new copy, or the reused target when identical content already exists. */
  finalPath: string;
  copiedToMedia: boolean;
  /**
   * Path of a media file created by this call. Callers that later reject the
   * import must clean up only this file, never an existing or reused one.
   */
  createdMediaPath: string | null;
}

/**
 * Collision-safe copy of an audio source into the configured project media
 * folder (SPEC 076 preparation step, shared by AudioFile selection and the
 * File Manager audio-layer drop commit). When the target already exists with
 * identical content it is reused; otherwise a `-001`-style sibling name is
 * allocated.
 */
export function copySourceToProjectMediaFolder(
  options: {
    sourcePath: string;
    projectDirectory: string;
    mediaFolder?: string;
  },
  deps: ScoreObjectFileOperationDeps = defaultOperationDeps,
): MediaFolderCopySuccess | { status: 'error'; code: 'copy-failed'; message: string } {
  const { sourcePath, projectDirectory } = options;
  const probe = deps.probe ?? defaultOperationProbe;
  const mediaFolder = (options.mediaFolder ?? '').trim();
  const mediaDir = path.isAbsolute(mediaFolder)
    ? mediaFolder
    : path.resolve(projectDirectory, mediaFolder.length > 0 ? mediaFolder : 'media');

  const ensureDir = deps.ensureDir ?? defaultOperationDeps.ensureDir!;
  const copyFile = deps.copyFile ?? defaultOperationDeps.copyFile!;
  const compareFiles = deps.compareFiles ?? defaultOperationDeps.compareFiles!;

  try {
    ensureDir(mediaDir);
    const baseName = path.basename(sourcePath);
    const targetPath = path.join(mediaDir, baseName);

    if (probe.isFile(targetPath)) {
      if (compareFiles(sourcePath, targetPath)) {
        return { status: 'ok', finalPath: targetPath, copiedToMedia: true, createdMediaPath: null };
      }
      const ext = path.extname(baseName);
      const nameWithoutExt = path.basename(baseName, ext);
      for (let i = 1; i < 1000; i++) {
        const indexStr = String(i).padStart(3, '0');
        const candidate = path.join(mediaDir, `${nameWithoutExt}-${indexStr}${ext}`);
        if (!probe.isFile(candidate)) {
          copyFile(sourcePath, candidate);
          return { status: 'ok', finalPath: candidate, copiedToMedia: true, createdMediaPath: candidate };
        }
      }
      return {
        status: 'error',
        code: 'copy-failed',
        message: `Could not allocate unique media filename for ${baseName}`,
      };
    }

    copyFile(sourcePath, targetPath);
    return { status: 'ok', finalPath: targetPath, copiedToMedia: true, createdMediaPath: targetPath };
  } catch (err) {
    return {
      status: 'error',
      code: 'copy-failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function selectScoreObjectAudioFile(
  options: SelectScoreObjectAudioFileOptions,
  deps: ScoreObjectFileOperationDeps = defaultOperationDeps,
): Promise<AudioFileSelectionResult> {
  const { currentPath, context, projectProps } = options;

  if (!deps.showOpenDialog) {
    return {
      status: 'error',
      code: 'no-project',
      message: 'No open dialog provider available.',
    };
  }

  const defaultDir = context.projectDirectory ?? (currentPath ? path.dirname(currentPath) : undefined);
  const selectedPath = await deps.showOpenDialog(defaultDir);
  if (!selectedPath) {
    return { status: 'cancelled' };
  }

  const probe = deps.probe ?? defaultOperationProbe;
  if (!probe.isFile(selectedPath)) {
    return {
      status: 'error',
      code: 'not-a-file',
      message: `Selected path is not a regular file: ${selectedPath}`,
      path: selectedPath,
    };
  }

  let finalPath = selectedPath;
  let copiedToMedia = false;

  if (projectProps?.copyToMediaFileOnImport && context.projectDirectory) {
    const copyResult = copySourceToProjectMediaFolder(
      {
        sourcePath: selectedPath,
        projectDirectory: context.projectDirectory,
        mediaFolder: projectProps.mediaFolder,
      },
      deps,
    );
    if (copyResult.status === 'error') {
      return {
        status: 'error',
        code: copyResult.code,
        message: copyResult.message,
        path: selectedPath,
      };
    }
    finalPath = copyResult.finalPath;
    copiedToMedia = copyResult.copiedToMedia;
  }

  const storedPath = normalizeReplacementPath(finalPath, context.projectDirectory);

  const readBytes = deps.readFileBytes ?? defaultOperationDeps.readFileBytes!;
  let bytes: Uint8Array;
  try {
    bytes = readBytes(finalPath);
  } catch {
    return {
      status: 'error',
      code: 'unreadable',
      message: `Could not read file: ${finalPath}`,
      path: finalPath,
    };
  }

  try {
    const meta = parseAudioFileMetadata(bytes);
    return {
      status: 'selected',
      storedPath,
      objectName: path.basename(finalPath),
      metadata: toAudioFileMetadataSnapshot(meta),
      copiedToMedia,
    };
  } catch (err) {
    const message = err instanceof AudioFileMetadataError ? err.message : String(err);
    return {
      status: 'error',
      code: 'unsupported',
      message,
      path: finalPath,
    };
  }
}

export interface SaveFrozenSoundObjectCopyOptions {
  frozenWaveFileName: string;
  context: MissingAudioResolutionContext;
}

export async function saveFrozenSoundObjectCopy(
  options: SaveFrozenSoundObjectCopyOptions,
  deps: ScoreObjectFileOperationDeps = defaultOperationDeps,
): Promise<FrozenSoundObjectSaveCopyResult> {
  const { frozenWaveFileName, context } = options;

  if (!context.projectDirectory) {
    return {
      status: 'error',
      code: 'no-project',
      message: 'No project open.',
    };
  }

  const probe = deps.probe ?? defaultOperationProbe;
  const sourcePath = resolveFreezeArtifactPath(context.projectDirectory, frozenWaveFileName);
  if (!sourcePath || !probe.isFile(sourcePath)) {
    return {
      status: 'error',
      code: sourcePath ? 'missing-artifact' : 'invalid-artifact',
      message: sourcePath
        ? `Could not locate frozen file:\n\n${frozenWaveFileName}`
        : 'Frozen artifact must be a project-local file name.',
    };
  }

  const readBytes = deps.readFileBytes ?? defaultOperationDeps.readFileBytes!;
  try {
    readBytes(sourcePath);
  } catch {
    return {
      status: 'error',
      code: 'unreadable-artifact',
      message: `Could not read frozen file:\n\n${frozenWaveFileName}`,
    };
  }

  if (!deps.showSaveDialog) {
    return {
      status: 'error',
      code: 'no-project',
      message: 'No save dialog provider available.',
    };
  }

  const defaultDir = context.projectDirectory;
  const defaultFileName = path.basename(frozenWaveFileName);
  const destinationPath = await deps.showSaveDialog(defaultDir, defaultFileName);
  if (!destinationPath) {
    return { status: 'cancelled' };
  }

  const isDirectory = deps.probe?.isDirectory ?? defaultOperationProbe.isDirectory!;
  const exists = deps.probe?.exists ?? defaultOperationProbe.exists!;

  if (isDirectory(destinationPath)) {
    return {
      status: 'error',
      code: 'directory-destination',
      message: 'Destination is a directory.',
    };
  }

  if (path.resolve(destinationPath) === path.resolve(sourcePath)) {
    return {
      status: 'error',
      code: 'invalid-artifact',
      message: 'Destination must be different from the frozen artifact.',
    };
  }

  const destName = path.basename(destinationPath);
  if (destName.startsWith('freeze')) {
    return {
      status: 'error',
      code: 'freeze-destination',
      message: 'Can not overwrite freeze files.',
    };
  }

  if (exists(destinationPath)) {
    if (!deps.confirmOverwrite) {
      return { status: 'cancelled' };
    }
    const confirmed = await deps.confirmOverwrite(destName);
    if (!confirmed) {
      return { status: 'cancelled' };
    }
  }

  const copyFile = deps.copyFile ?? defaultOperationDeps.copyFile!;
  const getFileSize = deps.getFileSize ?? defaultOperationDeps.getFileSize!;

  try {
    copyFile(sourcePath, destinationPath);
    const byteLength = getFileSize(destinationPath);
    return {
      status: 'copied',
      destinationPath,
      byteLength,
    };
  } catch (err) {
    return {
      status: 'error',
      code: 'copy-failed',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
