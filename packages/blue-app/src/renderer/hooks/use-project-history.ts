import { useCallback, useSyncExternalStore } from 'react';
import type {
  ProjectHistoryEntriesSnapshot,
  ProjectHistoryStateProjection,
} from '../../shared/project-history';
import { executeProjectRedo, executeProjectUndo } from '../lib/history-scope-router';
import { getProjectDocumentId } from '../stores/project-store';

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

/**
 * Update the entries snapshot store. Applies revision fencing for the same
 * document so a deferred hydration or scheduled fetch response from an older
 * revision cannot overwrite a newer snapshot (T042 / FR-006). The `null`
 * sentinel (project close/replace) is always applied unconditionally.
 */
export function setProjectHistoryEntries(snapshot: ProjectHistoryEntriesSnapshot | null): void {
  if (
    snapshot !== null &&
    currentEntriesSnapshot !== null &&
    currentEntriesSnapshot.documentId === snapshot.documentId &&
    snapshot.revision < currentEntriesSnapshot.revision
  ) {
    return; // Older revision — drop to prevent overwriting newer state.
  }
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
 * Fetch the current entry summaries for the active document lifetime. The
 * request carries the active `documentId` and every response is re-checked
 * after the await, so a fetch that was in flight across a project close or
 * replacement can never store another document's entries (spec 106 FR-011).
 * Concurrent callers coalesce: while a fetch is in flight one queued
 * re-fetch runs afterward, so a publication landing mid-flight cannot leave
 * the store on an older revision.
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
      const requestDocumentId = getProjectDocumentId();
      const result = await window.blueAPI.readProjectHistoryEntries(
        requestDocumentId ? { documentId: requestDocumentId } : undefined,
      );
      if (!('status' in result) && result.documentId === getProjectDocumentId()) {
        setProjectHistoryEntries(result);
      }
    } while (entriesFetchQueued);
  } catch {
    // Keep the last snapshot; the next projection change retriggers.
  } finally {
    entriesFetchInFlight = false;
  }
}

const ENTRIES_REFRESH_DEBOUNCE_MS = 500;
let entriesRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Trailing-debounced refresh for publication-driven updates. Each call resets
 * the timer so that spaced keystrokes within the engine's gesture-grouping
 * window (500 ms) coalesce into a single summary fetch that fires only once
 * typing pauses — no per-keystroke IPC reads (T043 / plan.md Performance
 * Goals / spec 106 FR-006).
 */
export function scheduleProjectHistoryEntriesRefresh(): void {
  if (entriesRefreshTimer !== null) {
    clearTimeout(entriesRefreshTimer);
  }
  entriesRefreshTimer = setTimeout(() => {
    entriesRefreshTimer = null;
    void refreshProjectHistoryEntries();
  }, ENTRIES_REFRESH_DEBOUNCE_MS);
}

/** Cancels a pending debounced refresh (tests and document teardown). */
export function cancelScheduledProjectHistoryEntriesRefresh(): void {
  if (entriesRefreshTimer !== null) {
    clearTimeout(entriesRefreshTimer);
    entriesRefreshTimer = null;
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
