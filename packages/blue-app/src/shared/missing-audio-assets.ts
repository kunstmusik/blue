/**
 * Shared missing-audio-asset IPC and session contracts.
 *
 * Mirrors Java Blue's AudioFile dependency check on project open. The main
 * process scans AudioFile score-object paths, sends unique unresolved paths
 * to the renderer, and applies user-approved replacement mappings back onto
 * the canonical in-memory project.
 */
import type { ProjectEditorSnapshot } from './project-editor';

export interface MissingAudioAssetRow {
  /** Stored AudioFile path string shown to the user as the missing original. */
  originalPath: string;
  /** Replacement path chosen by the user; empty until the user browses. */
  replacementPath: string;
}

export interface MissingAudioAssetsSession {
  /** Unique identifier for this missing-file session. */
  sessionId: string;
  /** Project session id captured when the scan ran; used for stale detection. */
  projectSessionId: number;
  /** Current project file path, if available. */
  projectFilePath: string | null;
  /** Unique unresolved AudioFile rows, one per original path. */
  missingFiles: MissingAudioAssetRow[];
}

export interface MissingAudioAssetReplacement {
  originalPath: string;
  replacementPath: string;
}

export interface MissingAudioAssetsResolveRequest {
  sessionId: string;
  replacements: MissingAudioAssetReplacement[];
}

export interface MissingAudioAssetsResolveResult {
  ok: boolean;
  changed: boolean;
  stale?: boolean;
  project?: ProjectEditorSnapshot;
}

export interface MissingAudioAssetsChooseRequest {
  sessionId: string;
  originalPath: string;
  currentReplacementPath?: string;
}

export interface MissingAudioAssetsDismissRequest {
  sessionId: string;
}
