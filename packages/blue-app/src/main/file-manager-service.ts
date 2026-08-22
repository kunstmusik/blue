/**
 * Main-process File Manager filesystem service (SPEC 076).
 *
 * Owns all host filesystem access for the File Manager panel: root
 * composition, lazy direct-child listings, and directory validation. The
 * renderer never receives fs handles; only serializable snapshots and typed
 * error results cross the IPC boundary.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AudioClip, TimeDuration, parseAudioFileMetadata } from '@blue/data';
import type {
  AudioDropRejectionCode,
  CommitAudioFileDropRequest,
  CommitAudioFileDropResult,
  FileManagerDirectoryResult,
  FileManagerNodeSnapshot,
  FileManagerRootSnapshot,
  FileManagerValidateDirectoryResult,
} from '../shared/file-manager';
import { isCsoundAudioSourcePath } from '../shared/file-manager';
import type {
  ProjectDocumentCommitReceipt,
  ProjectDocumentPatch,
  TrackItemTransfer,
} from '../shared/project-editor';
import { normalizeReplacementPath } from './missing-audio-assets';
import { copySourceToProjectMediaFolder } from './score-object-file-operations';

export interface FileManagerRootsDeps {
  /** Reads the persisted favorite paths from the program settings store. */
  loadFavoritePaths: () => string[];
  /** Reads the persisted root labels from the program settings store. */
  loadRootLabels?: () => Record<string, string>;
  /** Overrides process.platform for root-derivation tests. */
  platform?: string;
  /** Overrides os.homedir() for root-derivation tests. */
  homeDirectory?: string;
}

function listStaticRootPaths(platform: string, homeDirectory: string): string[] {
  const roots: string[] = [];
  if (platform === 'win32') {
    for (let code = 65; code <= 90; code++) {
      const drive = `${String.fromCharCode(code)}:\\`;
      try {
        fs.statSync(drive);
        roots.push(drive);
      } catch {
        // Drive not present.
      }
    }
  } else {
    roots.push('/');
  }
  if (homeDirectory.trim().length > 0) {
    roots.push(path.resolve(homeDirectory));
  }
  return roots;
}

/**
 * Host path identity used for de-duplication: realpath where available, with
 * case-insensitive comparison on Windows.
 */
export function normalizeFileManagerHostIdentity(filePath: string, platform: string): string {
  return platform === 'win32' ? filePath.replaceAll('\\', '/').toLowerCase() : filePath;
}

async function resolveHostIdentity(filePath: string, platform: string): Promise<string> {
  const normalized = path.resolve(filePath);
  const real = await fs.promises.realpath(normalized).then(
    (value) => value,
    () => null,
  );
  const base = real ?? normalized;
  return normalizeFileManagerHostIdentity(base, platform);
}

function mapStatError(err: unknown): { code: 'not-found' | 'not-directory' | 'permission-denied' | 'read-failed'; message: string } {
  const errno = (err as NodeJS.ErrnoException | null)?.code;
  if (errno === 'ENOENT') return { code: 'not-found', message: 'Path not found.' };
  if (errno === 'ENOTDIR') return { code: 'not-directory', message: 'Path is not a directory.' };
  if (errno === 'EACCES' || errno === 'EPERM') return { code: 'permission-denied', message: 'Permission denied.' };
  return { code: 'read-failed', message: err instanceof Error ? err.message : String(err) };
}

function compareNodeNames(a: { name: string }, b: { name: string }): number {
  const la = a.name.toLowerCase();
  const lb = b.name.toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/**
 * Returns the live root list: static platform roots and the home directory,
 * followed by saved favorites that currently resolve to directories. A
 * missing favorite is omitted from the live list but never deleted from the
 * stored settings.
 */
export async function getFileManagerRoots(
  deps: FileManagerRootsDeps,
): Promise<FileManagerRootSnapshot[]> {
  const platform = deps.platform ?? process.platform;
  const homeDirectory = deps.homeDirectory ?? os.homedir();
  const favoritePaths = deps.loadFavoritePaths();
  const rootLabels = deps.loadRootLabels ? deps.loadRootLabels() : {};

  const roots: FileManagerRootSnapshot[] = [];
  const seenIdentities = new Set<string>();
  const resolvedHome = homeDirectory.trim().length > 0 ? path.resolve(homeDirectory) : '';
  const homeId = resolvedHome.length > 0 ? await resolveHostIdentity(resolvedHome, platform) : '';

  for (const staticPath of listStaticRootPaths(platform, homeDirectory)) {
    const id = await resolveHostIdentity(staticPath, platform);
    if (seenIdentities.has(id)) continue;
    seenIdentities.add(id);

    const isHome = id === homeId || (resolvedHome.length > 0 && path.resolve(staticPath) === resolvedHome);
    const defaultLabel = isHome ? 'Home' : 'Root';
    const customLabel = rootLabels[id] ?? rootLabels[staticPath] ?? rootLabels[path.resolve(staticPath)];
    const label = typeof customLabel === 'string' && customLabel.trim().length > 0
      ? customLabel.trim()
      : defaultLabel;

    roots.push({
      id,
      path: staticPath,
      label,
      kind: 'static',
      available: true,
      isDirectory: true,
    });
  }

  for (const favoritePath of favoritePaths) {
    const trimmedFavoritePath = typeof favoritePath === 'string' ? favoritePath.trim() : '';
    if (trimmedFavoritePath.length === 0 || !path.isAbsolute(trimmedFavoritePath)) continue;
    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(trimmedFavoritePath);
    } catch {
      // Omit missing/unreadable favorites from the live list; keep them in
      // stored settings so they can return when the volume does.
      continue;
    }
    if (!stats.isDirectory()) continue;
    const resolvedFavorite = path.resolve(trimmedFavoritePath);
    const id = await resolveHostIdentity(trimmedFavoritePath, platform);
    if (seenIdentities.has(id)) continue;
    seenIdentities.add(id);

    const customLabel = rootLabels[id] ?? rootLabels[trimmedFavoritePath] ?? rootLabels[resolvedFavorite];
    const label = typeof customLabel === 'string' && customLabel.trim().length > 0
      ? customLabel.trim()
      : resolvedFavorite;

    roots.push({
      id,
      path: resolvedFavorite,
      label,
      kind: 'favorite',
      available: true,
      isDirectory: true,
    });
  }

  return roots;
}

/**
 * Lists the direct visible children of one directory. Dot-prefixed names are
 * excluded; children are ordered by a deterministic case-insensitive name
 * comparison with a case-sensitive tie-break; a symlink to a directory stays
 * expandable because the final kind comes from stat, not the dirent.
 */
export async function listFileManagerDirectory(
  request: { path: string },
): Promise<FileManagerDirectoryResult> {
  const target = typeof request?.path === 'string' ? request.path : '';
  if (target.trim().length === 0 || !path.isAbsolute(target)) {
    return {
      status: 'error',
      directoryPath: target,
      code: 'not-found',
      message: 'A non-empty absolute directory path is required.',
    };
  }

  try {
    const stats = await fs.promises.stat(target);
    if (!stats.isDirectory()) {
      return {
        status: 'error',
        directoryPath: target,
        code: 'not-directory',
        message: `Not a directory: ${target}`,
      };
    }
  } catch (err) {
    const mapped = mapStatError(err);
    return { status: 'error', directoryPath: target, ...mapped };
  }

  let dirents: fs.Dirent[];
  try {
    dirents = await fs.promises.readdir(target, { withFileTypes: true });
  } catch (err) {
    const mapped = mapStatError(err);
    return { status: 'error', directoryPath: target, ...mapped };
  }

  const children: FileManagerNodeSnapshot[] = [];
  let omittedCount = 0;
  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) continue;
    const childPath = path.join(target, dirent.name);
    try {
      const childStats = await fs.promises.stat(childPath);
      const kind = childStats.isDirectory() ? 'directory' : 'file';
      const childIdentity = await resolveHostIdentity(childPath, process.platform);
      children.push({
        id: childIdentity,
        path: childPath,
        name: dirent.name,
        kind,
        parentPath: target,
        isSymlink: dirent.isSymbolicLink(),
        canExpand: kind === 'directory',
      });
    } catch (err) {
      // A disappearing or unreadable child is omitted from this listing with
      // a directory-level diagnostic rather than failing the whole read.
      omittedCount += 1;
      console.warn(`[file-manager] Omitted unreadable child: ${childPath} (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  children.sort(compareNodeNames);

  return {
    status: 'ok',
    snapshot: {
      directoryPath: target,
      children,
      loadedAt: Date.now(),
      ...(omittedCount > 0
        ? { diagnostic: `${omittedCount} ${omittedCount === 1 ? 'entry was' : 'entries were'} unreadable and omitted.` }
        : {}),
    },
  };
}

/**
 * Revalidates that a path is an ordinary directory immediately before a
 * favorite write or folder action. Returns the main-normalized absolute path
 * used for the settings write.
 */
export async function validateFileManagerDirectory(
  request: { path: string },
): Promise<FileManagerValidateDirectoryResult> {
  const target = typeof request?.path === 'string' ? request.path : '';
  const trimmedTarget = target.trim();
  if (trimmedTarget.length === 0 || !path.isAbsolute(trimmedTarget)) {
    return { ok: false, message: 'An absolute directory path is required.' };
  }
  try {
    const stats = await fs.promises.stat(trimmedTarget);
    if (!stats.isDirectory()) {
      return { ok: false, message: `Not a directory: ${trimmedTarget}` };
    }
    return { ok: true, normalizedPath: path.resolve(trimmedTarget) };
  } catch {
    return { ok: false, message: `Could not access directory: ${trimmedTarget}` };
  }
}

// ─── Audio file drop commit (SPEC 076) ───

export interface AudioFileDropProjectContext {
  sessionId: number;
  revision: number;
  projectDirectory: string | null;
  copyToMediaFileOnImport: boolean;
  mediaFolder?: string;
}

export interface AudioFileDropCommitContext {
  getCurrentProject: () => AudioFileDropProjectContext | null;
  commitProjectDocumentPatch: (patch: ProjectDocumentPatch) => Promise<ProjectDocumentCommitReceipt>;
}

function rejectedDrop(code: AudioDropRejectionCode, message: string): CommitAudioFileDropResult {
  return { status: 'rejected', code, message };
}

function cleanupCreatedMediaFile(createdMediaPath: string | null): void {
  if (!createdMediaPath) return;
  try {
    fs.unlinkSync(createdMediaPath);
  } catch {
    // Best-effort cleanup only.
  }
}

/**
 * Commits one audio-file drop onto a Track audio layer. Every renderer-supplied
 * path is revalidated here: regular file, shared Csound-source suffix, project
 * session/revision fence, and drop position. The canonical project mutation
 * happens only through the provided commit callback; if that mutation rejects
 * after a media copy was created, only the newly-created copy is removed.
 */
export async function commitAudioFileDrop(
  request: CommitAudioFileDropRequest,
  context: AudioFileDropCommitContext,
): Promise<CommitAudioFileDropResult> {
  const sourcePath = typeof request?.sourcePath === 'string' ? request.sourcePath.trim() : '';
  if (sourcePath.length === 0 || !path.isAbsolute(sourcePath)) {
    return rejectedDrop('not-a-file', 'A non-empty absolute source path is required.');
  }
  if (!Number.isFinite(request.startBeats) || request.startBeats < 0) {
    return rejectedDrop('invalid-location', 'Drop position must be a finite non-negative beat.');
  }

  const current = context.getCurrentProject();
  if (!current) {
    return rejectedDrop('no-project', 'No project is open.');
  }
  if (
    request.track.projectSessionId !== current.sessionId
    || request.track.projectRevision !== current.revision
  ) {
    return rejectedDrop('stale-project', 'The score changed while dragging. Drop again to retry.');
  }

  try {
    const stats = await fs.promises.stat(sourcePath);
    if (!stats.isFile()) {
      return rejectedDrop('not-a-file', `Not a regular file: ${sourcePath}`);
    }
  } catch {
    return rejectedDrop('not-a-file', `Could not access source file: ${sourcePath}`);
  }
  if (!isCsoundAudioSourcePath(sourcePath)) {
    return rejectedDrop('unsupported-extension', `Unsupported audio source: ${path.basename(sourcePath)}`);
  }
  try {
    await fs.promises.access(sourcePath, fs.constants.R_OK);
  } catch {
    return rejectedDrop('unreadable', `Source file is not readable: ${sourcePath}`);
  }

  // Resolve symlinks once so the media copy path and the relative-path
  // normalization share the same canonical project directory.
  const projectDirectory = current.projectDirectory
    ? await fs.promises.realpath(current.projectDirectory).then(
        (value) => value,
        () => current.projectDirectory!,
      )
    : null;

  let finalPath = sourcePath;
  let copiedToMedia = false;
  let createdMediaPath: string | null = null;
  if (current.copyToMediaFileOnImport && projectDirectory) {
    const copyResult = copySourceToProjectMediaFolder(
      {
        sourcePath,
        projectDirectory,
        mediaFolder: current.mediaFolder,
      },
    );
    if (copyResult.status === 'error') {
      return rejectedDrop('copy-failed', copyResult.message);
    }
    finalPath = copyResult.finalPath;
    copiedToMedia = copyResult.copiedToMedia;
    createdMediaPath = copyResult.createdMediaPath;
  }

  const storedPath = normalizeReplacementPath(finalPath, projectDirectory);
  const objectName = path.basename(finalPath);

  // Metadata is best effort: an allowlisted Csound source is never rejected
  // because the header parser cannot decode it; the clip then uses the
  // existing Track insertion default duration.
  let channels = 0;
  let durationSeconds = 0;
  try {
    const bytes = await fs.promises.readFile(finalPath);
    const metadata = parseAudioFileMetadata(new Uint8Array(bytes));
    channels = metadata.channels;
    durationSeconds = metadata.durationSeconds;
  } catch {
    // Fall back to defaults below.
  }

  const clip = new AudioClip();
  clip.setName(objectName);
  clip.setAudioFile(storedPath);
  if (durationSeconds > 0) {
    clip.setNumChannels(channels);
    clip.setAudioDuration(durationSeconds);
    clip.setSubjectiveDuration(TimeDuration.fromSeconds(durationSeconds));
  } else {
    clip.setSubjectiveDuration(TimeDuration.beats(4));
  }
  const item: TrackItemTransfer = {
    objectType: 'AudioClip',
    name: objectName,
    serializedXml: clip.saveAsXML().toXml(),
  };

  let receipt: ProjectDocumentCommitReceipt;
  try {
    receipt = await context.commitProjectDocumentPatch({
      score: {
        type: 'addTrackItem',
        track: request.track,
        item,
        startBeats: request.startBeats,
      },
    });
  } catch (err) {
    cleanupCreatedMediaFile(createdMediaPath);
    return rejectedDrop(
      'invalid-location',
      err instanceof Error ? err.message : 'The project rejected the drop.',
    );
  }
  if (!receipt.changed) {
    cleanupCreatedMediaFile(createdMediaPath);
    return rejectedDrop('invalid-location', 'The drop target layer no longer accepts the clip.');
  }

  return { status: 'created', objectName, storedPath, copiedToMedia, receipt };
}
