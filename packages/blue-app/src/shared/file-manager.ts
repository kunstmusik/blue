/**
 * Shared File Manager contracts (SPEC 076).
 *
 * Pure, browser-safe types and helpers used by the Electron main filesystem
 * service, the preload bridge, and the renderer File Manager panel. No Node
 * built-ins; host paths are opaque strings here and are only interpreted by
 * the main process.
 */
import type { ProjectDocumentCommitReceipt, TrackRef } from './project-editor';

// ─── IPC channels ───

export const FILE_MANAGER_GET_ROOTS_CHANNEL = 'file-manager:get-roots';
export const FILE_MANAGER_LIST_DIRECTORY_CHANNEL = 'file-manager:list-directory';
export const FILE_MANAGER_VALIDATE_DIRECTORY_CHANNEL = 'file-manager:validate-directory';
export const COMMIT_AUDIO_FILE_DROP_CHANNEL = 'commit-audio-file-drop';

// ─── Roots ───

export type FileManagerRootKind = 'static' | 'favorite';

export interface FileManagerRootSnapshot {
  id: string;
  path: string;
  label: string;
  kind: FileManagerRootKind;
  available: boolean;
  isDirectory: boolean;
  diagnostic?: string;
}

// ─── Directory listings ───

export type FileManagerNodeKind = 'file' | 'directory';

export interface FileManagerNodeSnapshot {
  id: string;
  path: string;
  name: string;
  kind: FileManagerNodeKind;
  parentPath: string;
  isSymlink: boolean;
  canExpand: boolean;
}

export interface FileManagerDirectorySnapshot {
  directoryPath: string;
  children: FileManagerNodeSnapshot[];
  loadedAt: number;
  /** Directory-level diagnostic when one or more children were omitted. */
  diagnostic?: string;
}

export type FileManagerDirectoryErrorCode =
  | 'not-found'
  | 'not-directory'
  | 'permission-denied'
  | 'read-failed'
  | 'symlink-cycle';

export type FileManagerDirectoryResult =
  | { status: 'ok'; snapshot: FileManagerDirectorySnapshot }
  | {
      status: 'error';
      directoryPath: string;
      code: FileManagerDirectoryErrorCode;
      message: string;
    };

export interface FileManagerValidateDirectoryResult {
  ok: boolean;
  normalizedPath?: string;
  message?: string;
}

// ─── Context action eligibility ───

export type FileManagerAction = 'refresh-folder' | 'add-to-favorites' | 'remove-from-favorites';

export interface FileManagerActionState {
  refreshFolder: boolean;
  addToFavorites: boolean;
  removeFromFavorites: boolean;
}

export interface FileManagerActionNodeInfo {
  nodeKind: FileManagerNodeKind;
  /** Root kind when the node is one of the panel roots; null for ordinary nodes. */
  rootKind: FileManagerRootKind | null;
}

const NO_ACTIONS: FileManagerActionState = {
  refreshFolder: false,
  addToFavorites: false,
  removeFromFavorites: false,
};

/**
 * Java Blue action matrix (FileNode.getActions), with the intentional cleanup
 * that regular files expose no File Manager actions.
 */
export function getFileManagerActionState(info: FileManagerActionNodeInfo): FileManagerActionState {
  if (info.nodeKind !== 'directory') return NO_ACTIONS;
  switch (info.rootKind) {
    case 'static':
      return { refreshFolder: true, addToFavorites: false, removeFromFavorites: false };
    case 'favorite':
      return { refreshFolder: true, addToFavorites: false, removeFromFavorites: true };
    default:
      return { refreshFolder: true, addToFavorites: true, removeFromFavorites: false };
  }
}

// ─── Favorite settings normalization ───

/**
 * Normalizes the persisted favorite list: non-string and blank values are
 * discarded and exact duplicates removed. Host path validation (absolute
 * form, existence, case rules) is main-owned.
 */
export function normalizeFileManagerFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

// ─── Root labels normalization ───

/**
 * Normalizes custom root labels (SPEC 076). Non-string, blank, and empty
 * values are discarded. Keyed by root path identity.
 */
export function normalizeFileManagerRootLabels(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof key !== 'string' || typeof val !== 'string') continue;
    const trimmedKey = key.trim();
    const trimmedVal = val.trim();
    if (trimmedKey.length === 0 || trimmedVal.length === 0) continue;
    result[trimmedKey] = trimmedVal;
  }
  return result;
}

// ─── Drag payload ───

export const BLUE_FILE_MANAGER_DRAG_MIME = 'application/x-blue-file-manager-file';

export interface FileManagerDragPayload {
  version: 1;
  kind: 'file';
  path: string;
  name: string;
}

export function serializeFileManagerDragPayload(payload: FileManagerDragPayload): string {
  return JSON.stringify(payload);
}

export function parseFileManagerDragPayload(
  raw: string | null | undefined,
): FileManagerDragPayload | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<FileManagerDragPayload>;
  if (
    candidate.version !== 1 ||
    candidate.kind !== 'file' ||
    typeof candidate.path !== 'string' ||
    candidate.path.length === 0 ||
    typeof candidate.name !== 'string'
  ) {
    return null;
  }
  return { version: 1, kind: 'file', path: candidate.path, name: candidate.name };
}

// ─── Shared Csound audio-source allowlist ───

/**
 * Capability-derived from the local Csound 7.0 sound-file format list and
 * libsndfile 1.2.2 major containers (research.md). Headerless `.raw` and
 * browser-only containers (.m4a/.mp4/.webm/.opus) are intentionally excluded
 * until the packaged Csound source path is verified for them.
 */
export const CSOUND_AUDIO_SOURCE_EXTENSIONS: readonly string[] = [
  'wav',
  'wave',
  'aif',
  'aiff',
  'aifc',
  'au',
  'paf',
  'svx',
  'nist',
  'voc',
  'ircam',
  'w64',
  'wavex',
  'sd2',
  'flac',
  'caf',
  'wve',
  'ogg',
  'oga',
  'mpc2k',
  'rf64',
  'mp3',
  'mp2',
  'mpeg',
];

/** Case-insensitive final-suffix check; dot-prefixed names never match. */
export function isCsoundAudioSourcePath(filePath: string): boolean {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filePath.length - 1) return false;
  const suffix = filePath.slice(dotIndex + 1).toLowerCase();
  return CSOUND_AUDIO_SOURCE_EXTENSIONS.includes(suffix);
}

// ─── External OS drop source parsing ───

export type ExternalOsFileDropParse =
  | { status: 'ok'; path: string }
  | {
      status: 'rejected';
      reason: 'multiple-files' | 'multiple-uris' | 'unsupported-scheme' | 'no-source';
    };

export interface ExternalOsFileDropInput {
  fileCount: number;
  firstFilePath?: string | null;
  uriList?: string | null;
  textPlain?: string | null;
}

/**
 * Parses the two external OS source shapes the Track audio-layer target
 * accepts: one DataTransfer file (path resolved by the preload bridge), or a
 * single `file://` URI from text/uri-list / text/plain. Multi-file,
 * multi-URI, and non-file schemes are rejected before any drop request.
 */
export function parseExternalOsFileDrop(input: ExternalOsFileDropInput): ExternalOsFileDropParse {
  if (input.fileCount > 1) return { status: 'rejected', reason: 'multiple-files' };
  if (input.fileCount === 1) {
    const path = (input.firstFilePath ?? '').trim();
    if (path.length > 0) return { status: 'ok', path };
    return { status: 'rejected', reason: 'no-source' };
  }

  const uriListLines = collectUriListLines(input.uriList);
  if (uriListLines.length > 1) return { status: 'rejected', reason: 'multiple-uris' };
  const uri = uriListLines[0] ?? collectUriListLines(input.textPlain)[0];
  if (!uri) return { status: 'rejected', reason: 'no-source' };

  const decoded = decodeFileUri(uri);
  if (!decoded) return { status: 'rejected', reason: 'unsupported-scheme' };
  return { status: 'ok', path: decoded };
}

function collectUriListLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Decodes one `file://` URI to a host path. Percent decoding happens exactly
 * once; a Windows drive root (file:///C:/...) loses only the URI-leading
 * slash; UNC hosts (file://server/share) retain the //server/share form.
 */
export function decodeFileUri(uri: string): string | null {
  const schemeMatch = /^file:\/\//i.exec(uri);
  if (!schemeMatch) return null;
  let rest = uri.slice(schemeMatch[0].length);
  if (rest.length === 0) return null;

  try {
    rest = decodeURIComponent(rest);
  } catch {
    return null;
  }

  // POSIX/Windows drive form: file:///path or file:///C:/path -> drop the
  // leading slash only when a drive letter follows.
  if (/^\/[A-Za-z]:[\\/]/.test(rest) || /^\/[A-Za-z]:$/.test(rest)) {
    return rest.slice(1);
  }
  // UNC form: file://server/share/path -> rest is server/share/path.
  if (!rest.startsWith('/')) {
    return `//${rest}`;
  }
  return rest;
}

// ─── Audio file drop commit contract ───

export type AudioDropSourceKind = 'file-manager' | 'external-os';

export interface CommitAudioFileDropRequest {
  sourcePath: string;
  sourceKind: AudioDropSourceKind;
  track: TrackRef;
  startBeats: number;
}

export type AudioDropRejectionCode =
  | 'no-project'
  | 'stale-project'
  | 'not-a-file'
  | 'unsupported-extension'
  | 'unreadable'
  | 'invalid-location'
  | 'copy-failed';

export type CommitAudioFileDropResult =
  | {
      status: 'created';
      objectName: string;
      storedPath: string;
      copiedToMedia: boolean;
      receipt: ProjectDocumentCommitReceipt;
    }
  | {
      status: 'rejected';
      code: AudioDropRejectionCode;
      message: string;
    };
