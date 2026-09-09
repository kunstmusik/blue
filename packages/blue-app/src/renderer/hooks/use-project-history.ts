import { useCallback, useSyncExternalStore } from 'react';
import type { ProjectHistoryStateProjection } from '../../shared/project-history';
import { executeProjectRedo, executeProjectUndo } from '../lib/history-scope-router';

/**
 * Latest authoritative history projection published by main. Availability is
 * main-owned state; renderers only display and command it.
 */
let currentProjection: ProjectHistoryStateProjection | null = null;
const projectionListeners = new Set<() => void>();

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

export interface UseProjectHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  retainedBytes: number;
  limitBytes?: number;
  cursor: number;
  length: number;
  maxEntries?: number;
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
    setProjectHistoryProjection(await window.blueAPI.readProjectHistory());
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
    maxEntries: projection?.maxEntries,
    undo,
    redo,
    refresh,
  };
}
