import { useCallback, useSyncExternalStore } from 'react';
import type {
  ProjectHistoryEntriesSnapshot,
  ProjectHistoryStateProjection,
} from '../../shared/project-history';
import { executeProjectRedo, executeProjectUndo } from '../lib/history-scope-router';

/**
 * Latest authoritative history projection published by main. Availability is
 * main-owned state; renderers only display and command it.
 */
let currentProjection: ProjectHistoryStateProjection | null = null;
const projectionListeners = new Set<() => void>();

export function getProjectHistoryProjection(): ProjectHistoryStateProjection | null {
  return currentProjection;
}

export function setProjectHistoryProjection(
  projection: ProjectHistoryStateProjection | null,
): void {
  currentProjection = projection;
  for (const listener of projectionListeners) {
    listener();
  }
}

function subscribeProjection(listener: () => void): () => void {
  projectionListeners.add(listener);
  return () => projectionListeners.delete(listener);
}

function getProjectionSnapshot(): ProjectHistoryStateProjection | null {
  return currentProjection;
}

/**
 * Latest per-entry history snapshot fetched from main (spec 106). Like the
 * projection this is main-owned display state; renderers only read it.
 */
let currentEntriesSnapshot: ProjectHistoryEntriesSnapshot | null = null;
const entriesListeners = new Set<() => void>();

export function getProjectHistoryEntries(): ProjectHistoryEntriesSnapshot | null {
  return currentEntriesSnapshot;
}

export function setProjectHistoryEntries(snapshot: ProjectHistoryEntriesSnapshot | null): void {
  currentEntriesSnapshot = snapshot;
  for (const listener of entriesListeners) {
    listener();
  }
}

function subscribeEntries(listener: () => void): () => void {
  entriesListeners.add(listener);
  return () => entriesListeners.delete(listener);
}

function getEntriesSnapshot(): ProjectHistoryEntriesSnapshot | null {
  return currentEntriesSnapshot;
}

let entriesFetchInFlight = false;
let entriesFetchQueued = false;

/**
 * Fetch the current entry summaries. Concurrent callers coalesce: while a
 * fetch is in flight one queued re-fetch runs afterward, so a publication
 * landing mid-flight cannot leave the store on an older revision.
 */
export async function refreshProjectHistoryEntries(): Promise<void> {
  if (entriesFetchInFlight) {
    entriesFetchQueued = true;
    return;
  }
  entriesFetchInFlight = true;
  try {
    do {
      entriesFetchQueued = false;
      const result = await window.blueAPI.readProjectHistoryEntries();
      if (!('status' in result)) {
        setProjectHistoryEntries(result);
      }
    } while (entriesFetchQueued);
  } catch {
    // Keep the last snapshot; the next projection change retriggers.
  } finally {
    entriesFetchInFlight = false;
  }
}

export interface UseProjectHistoryEntriesResult {
  snapshot: ProjectHistoryEntriesSnapshot | null;
  refreshEntries: () => Promise<void>;
}

/**
 * Per-entry history view state for the Undo History panel. The panel keys its
 * refresh effect on the projection fingerprint (revision/cursor/length) so
 * every canonical publication — including edits from other windows — keeps
 * the list current without a dedicated push channel.
 */
export function useProjectHistoryEntries(): UseProjectHistoryEntriesResult {
  const snapshot = useSyncExternalStore(subscribeEntries, getEntriesSnapshot, getEntriesSnapshot);

  const refreshEntries = useCallback((): Promise<void> => {
    return refreshProjectHistoryEntries();
  }, []);

  return { snapshot, refreshEntries };
}

export interface UseProjectHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  retainedBytes: number;
  limitBytes?: number;
  cursor: number;
  length: number;
  revision: number;
  savedStateId: string | null;
  maxEntries?: number;
  retentionStatus: ProjectHistoryStateProjection['retentionStatus'];
  undo(): Promise<void>;
  redo(): Promise<void>;
  refresh(): Promise<void>;
}

/**
 * Renderer history client for the focused window. Commands dispatch to the
 * main-owned coordinator at the current revision fence; the resulting
 * canonical publication (applied by the IPC listener) refreshes every view.
 * Undo and redo operations are never owned by this context's patch queue, so
 * their canonical publications are applied like any other context's.
 */
export function useProjectHistory(): UseProjectHistoryResult {
  const projection = useSyncExternalStore(
    subscribeProjection,
    getProjectionSnapshot,
    getProjectionSnapshot,
  );

  const undo = useCallback(async (): Promise<void> => {
    await executeProjectUndo();
  }, []);

  const redo = useCallback(async (): Promise<void> => {
    await executeProjectRedo();
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const result = await window.blueAPI.readProjectHistory();
    if ('status' in result) return;
    setProjectHistoryProjection(result);
  }, []);

  return {
    canUndo: projection?.canUndo ?? false,
    canRedo: projection?.canRedo ?? false,
    undoLabel: projection?.undoLabel ?? null,
    redoLabel: projection?.redoLabel ?? null,
    retainedBytes: projection?.retainedBytes ?? 0,
    limitBytes: projection?.limitBytes,
    cursor: projection?.cursor ?? 0,
    length: projection?.length ?? 0,
    revision: projection?.revision ?? 0,
    savedStateId: projection?.savedStateId ?? null,
    maxEntries: projection?.maxEntries,
    retentionStatus: projection?.retentionStatus,
    undo,
    redo,
    refresh,
  };
}
