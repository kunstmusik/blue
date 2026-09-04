/**
 * Missing Audio Asset service (Electron main process).
 *
 * Mirrors Java Blue's AudioFile dependency check on project open:
 *   - OpenProjectAction.checkDependencies / checkAudioFiles / reconcileAudioFiles
 *   - BlueSystem.findFile / BlueSystem.getRelativePath
 *
 * Filesystem probing and AudioFile mutation live here so that @blue/data stays
 * free of Node built-ins. All functions are pure with respect to injected
 * dependencies (project directory, SFDIR) to keep them unit-testable.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AudioFile, PolyObject, type BlueData } from '@blue/data';
import type { Score, SoundObject } from '@blue/data';
import type {
  MissingAudioAssetReplacement,
  MissingAudioAssetRow,
  MissingAudioAssetsSession,
} from '../shared/missing-audio-assets';

export interface MissingAudioResolutionContext {
  /** Current project directory, or null when unavailable (e.g. unsaved project). */
  projectDirectory: string | null;
  /** SFDIR-equivalent search directory for separator-less file names. */
  sfDir: string | null;
}

export interface MissingAudioFileProbe {
  /** Returns true when a regular file exists at the given path. */
  isFile: (filePath: string) => boolean;
}

/**
 * Default filesystem probe using Node fs. Java's findFile checks both
 * existence and isFile(); we mirror that with statSync.
 */
export const defaultFileProbe: MissingAudioFileProbe = {
  isFile(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  },
};

/**
 * Java BlueSystem.findFile parity. Returns a resolved existing path or null.
 *
 * Order:
 *   1. projectDirectory + separator + path (when projectDirectory available)
 *   2. path as-is (absolute or cwd-relative)
 *   3. sfDir + separator + path, only when path contains no separator
 */
export function findAudioFile(
  originalPath: string,
  context: MissingAudioResolutionContext,
  probe: MissingAudioFileProbe = defaultFileProbe,
): string | null {
  const { projectDirectory, sfDir } = context;

  if (projectDirectory) {
    const candidate = path.join(projectDirectory, originalPath);
    if (probe.isFile(candidate)) {
      return candidate;
    }
  }

  if (probe.isFile(originalPath)) {
    return originalPath;
  }

  if (!originalPath.includes(path.sep) && sfDir) {
    const candidate = path.join(sfDir, originalPath);
    if (probe.isFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Walk every PolyObject layer group (root and nested) and invoke the visitor
 * for each AudioFile sound object encountered. Mirrors Java's recursive
 * checkAudioFiles/reconcileAudioFiles traversal which iterates
 * pObj.getSoundObjects(true) and recurses into nested PolyObjects.
 */
export function forEachAudioFile(score: Score, visitor: (audioFile: AudioFile) => void): void {
  for (const layerGroup of score) {
    if (!(layerGroup instanceof PolyObject)) {
      continue;
    }
    walkPolyObject(layerGroup, visitor);
  }
}

function walkPolyObject(polyObject: PolyObject, visitor: (audioFile: AudioFile) => void): void {
  for (const soundObject of iterateSoundObjects(polyObject)) {
    if (soundObject instanceof AudioFile) {
      visitor(soundObject);
    } else if (soundObject instanceof PolyObject) {
      walkPolyObject(soundObject, visitor);
    }
  }
}

/**
 * Flatten a PolyObject's SoundLayers into a single SoundObject iteration,
 * mirroring Java's pObj.getSoundObjects(true). The `true` flag only affects
 * solo filtering during note generation and does not change traversal scope,
 * so a plain layer flattening is the correct parity behavior here.
 */
function* iterateSoundObjects(polyObject: PolyObject): Generator<SoundObject> {
  for (const layer of polyObject) {
    for (const soundObject of layer) {
      yield soundObject;
    }
  }
}

/**
 * Collect unique unresolved AudioFile original paths. Mirrors Java
 * checkAudioFiles with the spec's blank-path guard: empty names are skipped,
 * found files are skipped, and duplicates collapse to a single entry
 * preserving first-seen order.
 */
export function collectMissingAudioFiles(
  data: BlueData,
  context: MissingAudioResolutionContext,
  probe: MissingAudioFileProbe = defaultFileProbe,
): MissingAudioAssetRow[] {
  const seen = new Set<string>();
  const rows: MissingAudioAssetRow[] = [];

  forEachAudioFile(data.getScore(), (audioFile) => {
    const soundFileName = audioFile.getSoundFileName();
    if (soundFileName.length === 0 || soundFileName.trim().length === 0) {
      return;
    }
    if (seen.has(soundFileName)) {
      return;
    }
    if (findAudioFile(soundFileName, context, probe) !== null) {
      return;
    }
    seen.add(soundFileName);
    rows.push({ originalPath: soundFileName, replacementPath: '' });
  });

  return rows;
}

/**
 * Java BlueSystem.getRelativePath parity. Returns "" when the selected path is
 * the project directory, a project-relative path when the selected path is a
 * child of the project directory, and the chosen path otherwise.
 */
export function normalizeReplacementPath(
  selectedPath: string,
  projectDirectory: string | null,
): string {
  if (!projectDirectory) {
    return selectedPath;
  }

  const projectPath = canonicalize(projectDirectory);
  if (!projectPath) {
    return selectedPath;
  }

  if (selectedPath === projectPath) {
    return '';
  }

  if (selectedPath.startsWith(projectPath + path.sep)) {
    return selectedPath.substring(projectPath.length + 1);
  }

  return selectedPath;
}

function canonicalize(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    try {
      return path.resolve(target);
    } catch {
      return null;
    }
  }
}

/**
 * Build validated replacement mappings from modal rows. Mirrors Java's
 * getFilesMap filter: only rows whose replacement is non-empty and different
 * from the original path are included. When an active-session path set is
 * provided, rows outside that session are ignored.
 */
export function buildReplacementMappings(
  rows: MissingAudioAssetReplacement[],
  projectDirectory: string | null,
  allowedOriginalPaths?: ReadonlySet<string>,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const row of rows) {
    const originalPath = row.originalPath;
    const selectedPath = row.replacementPath;

    if (allowedOriginalPaths && !allowedOriginalPaths.has(originalPath)) {
      continue;
    }
    if (selectedPath.length === 0) {
      continue;
    }
    if (selectedPath === originalPath) {
      continue;
    }

    const storedPath = normalizeReplacementPath(selectedPath, projectDirectory);
    map.set(originalPath, storedPath);
  }

  return map;
}

/**
 * Apply replacement mappings to every AudioFile whose current path exactly
 * matches a mapped original path. Mirrors Java reconcileAudioFiles. Returns
 * true when at least one AudioFile path changed.
 */
export function applyReplacementMappings(data: BlueData, mappings: Map<string, string>): boolean {
  if (mappings.size === 0) {
    return false;
  }

  let changed = false;
  forEachAudioFile(data.getScore(), (audioFile) => {
    const current = audioFile.getSoundFileName();
    if (mappings.has(current)) {
      const next = mappings.get(current);
      if (next !== undefined && next !== current) {
        audioFile.setSoundFileName(next);
        changed = true;
      }
    }
  });

  return changed;
}

/**
 * Session manager. Only one missing-audio session is active at a time; loading
 * another project supersedes (stales) the previous session.
 */
let activeSession: MissingAudioAssetsSession | null = null;

export function getActiveMissingAudioSession(): MissingAudioAssetsSession | null {
  return activeSession;
}

export function setActiveMissingAudioSession(session: MissingAudioAssetsSession | null): void {
  activeSession = session;
}

export function clearMissingAudioSession(sessionId?: string): void {
  if (sessionId && activeSession && activeSession.sessionId !== sessionId) {
    return;
  }
  activeSession = null;
}

/**
 * Returns true when the session is stale: missing, or bound to a different
 * project session id than the one supplied by the caller.
 */
export function isSessionStale(
  session: MissingAudioAssetsSession | null,
  currentProjectSessionId: number,
): boolean {
  return !session || session.projectSessionId !== currentProjectSessionId;
}

let sessionIdCounter = 0;

export function createMissingAudioSessionId(): string {
  sessionIdCounter += 1;
  return `missing-audio-${Date.now()}-${sessionIdCounter}`;
}
