/**
 * Audio layout preflight service (Electron main process).
 * Implements T008, T054, T058, T060 of Spec 112.
 *
 * Inspects referenced audio clips using actual file headers before launch.
 * Real file header channel count is authoritative over cached AudioClip.numChannels.
 * Native paths and identities are preserved.
 */
import * as fs from 'fs';
import {
  AudioClip,
  AudioLayoutCompileError,
  TrackLayerGroup,
  createAudioLayoutManifest,
  parseAudioFileMetadata,
  type AudioFileLayoutObservation,
  type AudioLayoutManifest,
  type BlueData,
} from '@blue/data';
import { isAudioLayoutDiagnostic, type AudioLayoutDiagnostic } from '../shared/audio-layout';
import {
  findAudioFile,
  defaultFileProbe,
  type MissingAudioFileProbe,
  type MissingAudioResolutionContext,
} from './missing-audio-assets';
import { canonicalAudioFileIdentity, type AudioFileIdentityOptions } from './audio-file-identity';

export interface PreflightAudioLayoutOptions {
  readonly isDiskRender?: boolean;
  readonly projectDirectory?: string | null;
}

export interface AudioLayoutPreflightDeps {
  readonly probe?: MissingAudioFileProbe;
  readonly readFileBytes?: (filePath: string) => Uint8Array;
  readonly platform?: string;
  readonly realpath?: (filePath: string) => string;
}

export interface AudioLayoutPreflightResult {
  readonly success: boolean;
  readonly manifest: AudioLayoutManifest | null;
  readonly diagnostics: readonly AudioLayoutDiagnostic[];
}

export function audioLayoutDiagnosticFromError(error: unknown): AudioLayoutDiagnostic | null {
  if (!(error instanceof AudioLayoutCompileError)) return null;

  const candidate = {
    code: error.code,
    message: error.message,
    ...(error.filePath !== undefined ? { filePath: error.filePath } : {}),
    ...(typeof error.observedChannels === 'number'
      ? { observedChannels: error.observedChannels }
      : {}),
    ...(typeof error.outputChannels === 'number' ? { outputChannels: error.outputChannels } : {}),
  };
  return isAudioLayoutDiagnostic(candidate) ? candidate : null;
}

export function preflightAudioLayout(
  project: BlueData,
  options?: PreflightAudioLayoutOptions,
  deps?: AudioLayoutPreflightDeps,
): AudioLayoutPreflightResult {
  const score = project.getScore();
  const panningEnabled = project.getMixer().isPanningEnabled();

  if (!panningEnabled) {
    return {
      success: true,
      manifest: null,
      diagnostics: [],
    };
  }

  const diagnostics: AudioLayoutDiagnostic[] = [];
  const props = project.getProjectProperties();
  const nchnlsStr = options?.isDiskRender ? props.diskChannels || props.channels : props.channels;
  const nchnls = parseInt(nchnlsStr || '2', 10);

  if (nchnls > 2) {
    diagnostics.push({
      code: 'UNSUPPORTED_OUTPUT_CHANNELS',
      message: `Unsupported project output channel count (${nchnls})`,
      outputChannels: nchnls,
    });
  }

  // Collect all AudioClips across tracks in the score
  const clipFilePaths: string[] = [];
  for (const item of score) {
    if (item instanceof TrackLayerGroup) {
      for (const track of item) {
        for (const soundObject of track) {
          if (soundObject instanceof AudioClip) {
            const rawPath = soundObject.getAudioFile();
            if (rawPath) {
              clipFilePaths.push(rawPath);
            }
          }
        }
      }
    }
  }

  const probe = deps?.probe ?? defaultFileProbe;
  const readFile =
    deps?.readFileBytes ??
    ((filePath: string) => {
      // Read up to 64KB for header parsing, or entire file if smaller
      const fd = fs.openSync(filePath, 'r');
      try {
        const stats = fs.fstatSync(fd);
        const readSize = Math.min(stats.size, 65536);
        const buffer = Buffer.alloc(readSize);
        fs.readSync(fd, buffer, 0, readSize, 0);
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      } finally {
        fs.closeSync(fd);
      }
    });

  const resolutionContext: MissingAudioResolutionContext = {
    projectDirectory: options?.projectDirectory ?? null,
    sfDir: null,
  };

  const observations = new Map<string, AudioFileLayoutObservation>();

  // Group aliases by resolved native identity, but retain every original path
  // as a manifest key. Header reads happen once per actual file.
  const identityOptions: AudioFileIdentityOptions = {
    platform: deps?.platform,
    realpath: deps?.realpath,
  };
  const fileGroups = new Map<string, { aliases: string[]; resolvedPath: string | null }>();

  for (const rawPath of new Set(clipFilePaths)) {
    const resolvedPath = findAudioFile(rawPath, resolutionContext, probe);
    const identity = canonicalAudioFileIdentity(resolvedPath ?? rawPath, identityOptions);
    const key = `${resolvedPath ? 'file' : 'missing'}:${identity}`;
    const group = fileGroups.get(key) ?? { aliases: [], resolvedPath };
    group.aliases.push(rawPath);
    fileGroups.set(key, group);
  }

  for (const { aliases, resolvedPath } of fileGroups.values()) {
    const rawPath = aliases[0]!;
    const setObservation = (observation: Omit<AudioFileLayoutObservation, 'filePath'>): void => {
      for (const alias of aliases) {
        observations.set(alias, { filePath: alias, ...observation });
      }
    };

    if (!resolvedPath) {
      setObservation({
        channels: 'unsupported',
        status: 'missing',
      });
      diagnostics.push({
        code: 'MISSING_AUDIO_LAYOUT',
        filePath: rawPath,
        message: `Missing audio file: '${rawPath}'`,
      });
      continue;
    }

    let bytes: Uint8Array;
    try {
      bytes = readFile(resolvedPath);
    } catch {
      setObservation({
        channels: 'unsupported',
        status: 'unreadable',
      });
      diagnostics.push({
        code: 'UNREADABLE_AUDIO_FILE',
        filePath: rawPath,
        message: `Audio file is unreadable: '${rawPath}'`,
      });
      continue;
    }

    try {
      const metadata = parseAudioFileMetadata(bytes);
      if (metadata.channels === 1) {
        setObservation({
          channels: 1,
          status: 'verified',
          sampleRate: metadata.sampleRate,
          duration: metadata.durationSeconds,
        });
      } else if (metadata.channels === 2) {
        setObservation({
          channels: 2,
          status: 'verified',
          sampleRate: metadata.sampleRate,
          duration: metadata.durationSeconds,
        });
      } else {
        setObservation({
          channels: 'unsupported',
          status: 'unsupported',
        });
        diagnostics.push({
          code: 'UNSUPPORTED_SOURCE_CHANNELS',
          filePath: rawPath,
          observedChannels: metadata.channels,
          message: `Audio file '${rawPath}' has ${metadata.channels} channels; only mono (1) and stereo (2) are supported`,
        });
      }
    } catch {
      setObservation({
        channels: 'unsupported',
        status: 'unreadable',
      });
      diagnostics.push({
        code: 'UNREADABLE_AUDIO_FILE',
        filePath: rawPath,
        message: `Failed to parse audio header for '${rawPath}'`,
      });
    }
  }

  const manifest = createAudioLayoutManifest(observations);

  return {
    success: diagnostics.length === 0,
    manifest,
    diagnostics,
  };
}
