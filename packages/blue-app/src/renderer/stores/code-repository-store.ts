// Code Repository renderer store.
//
// Holds the canonical snapshot pushed from main and the expected-revision token
// for atomic draft commit. The editor dialog owns its own local draft and dirty
// state; this store only persists the canonical snapshot, handles change-event
// refresh, and commits the dialog's root with the expected revision.

import { create } from 'zustand';
import type { CodeRepositoryNode } from '@blue/data';
import type {
  CodeRepositoryError,
  CodeRepositorySnapshot,
  CodeRepositoryStatus,
} from '../../shared/code-repository';

let unsubscribeChanged: (() => void) | null = null;

export interface CodeRepositoryStoreState {
  readonly snapshot: CodeRepositorySnapshot | null;
  /** Expected revision for the next atomic commit. */
  readonly expectedRevision: number;
  readonly loading: boolean;
  readonly initialized: boolean;
  readonly loadError: CodeRepositoryError | null;
  readonly conflict: CodeRepositoryError | null;
  readonly status: CodeRepositoryStatus | null;

  initialize: () => void;
  dispose: () => void;
  refresh: () => Promise<void>;
  openEditor: () => Promise<void>;
  closeEditor: () => void;
  importFile: () => Promise<{ ok: true } | { ok: false; error: CodeRepositoryError } | null>;
  retry: () => Promise<void>;
  reloadConflict: () => void;
  save: (
    root: CodeRepositoryNode,
  ) => Promise<{ ok: true } | { ok: false; error: CodeRepositoryError }>;
}

export const useCodeRepositoryStore = create<CodeRepositoryStoreState>((set, get) => ({
  snapshot: null,
  expectedRevision: 0,
  loading: false,
  initialized: false,
  loadError: null,
  conflict: null,
  status: null,

  initialize: () => {
    if (get().initialized) return;
    if (window.blueAPI?.onCodeRepositoryChanged) {
      unsubscribeChanged = window.blueAPI.onCodeRepositoryChanged(() => {
        // Refresh the canonical snapshot; the editor dialog surfaces a conflict
        // on save if its expected revision is now stale.
        void get().refresh();
      });
    }
    set({ initialized: true });
    void get().refresh();
  },

  dispose: () => {
    unsubscribeChanged?.();
    unsubscribeChanged = null;
    set({
      initialized: false,
      snapshot: null,
      loadError: null,
      conflict: null,
      status: null,
    });
  },

  refresh: async () => {
    if (!window.blueAPI?.getCodeRepositorySnapshot) {
      set({
        snapshot: null,
        loading: false,
        loadError: {
          code: 'storage-unavailable',
          message: 'Code Repository bridge is unavailable',
          retryable: false,
        },
      });
      return;
    }
    set({ loading: true, loadError: null });
    try {
      const [result, status] = await Promise.all([
        window.blueAPI.getCodeRepositorySnapshot(),
        window.blueAPI.getCodeRepositoryStatus?.(),
      ]);
      if (result.ok) {
        set({
          snapshot: result.value,
          loading: false,
          loadError: null,
          status: status ?? null,
        });
      } else {
        set({
          snapshot: null,
          loading: false,
          loadError: result.error,
          status: status ?? null,
        });
      }
    } catch (error) {
      set({
        snapshot: null,
        loading: false,
        loadError: {
          code: 'storage-unavailable',
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      });
    }
  },

  openEditor: async () => {
    await get().refresh();
    const snapshot = get().snapshot;
    if (snapshot) {
      set({
        expectedRevision: snapshot.contentRevision,
        loadError: null,
        conflict: null,
      });
    }
  },

  closeEditor: () => {
    set({ conflict: null });
  },

  importFile: async () => {
    const snapshot = get().snapshot;
    if (!window.blueAPI?.importCodeRepositoryFile) {
      return {
        ok: false,
        error: {
          code: 'storage-unavailable',
          message: 'Code Repository is unavailable',
          retryable: true,
        },
      };
    }
    const result = await window.blueAPI.importCodeRepositoryFile({
      expectedRevision: snapshot?.contentRevision ?? 0,
    });
    if (result === null) return null;
    if (result.ok) {
      set({
        snapshot: result.value.snapshot,
        expectedRevision: result.value.snapshot.contentRevision,
        conflict: null,
        loadError: null,
      });
      return { ok: true };
    }
    if (result.error.code === 'revision-conflict' && result.error.currentSnapshot) {
      set({
        snapshot: result.error.currentSnapshot,
        conflict: result.error,
      });
    } else if (result.error.code === 'storage-unavailable') {
      set({ loadError: result.error });
    }
    return { ok: false, error: result.error };
  },

  retry: async () => {
    if (window.blueAPI?.retryCodeRepository) {
      const result = await window.blueAPI.retryCodeRepository();
      if (!result.ok) {
        set({ loadError: result.error, status: null });
        return;
      }
      set({ status: result.value, loadError: null });
    }
    await get().refresh();
  },

  reloadConflict: () => {
    const conflict = get().conflict;
    if (conflict?.currentSnapshot) {
      set({
        snapshot: conflict.currentSnapshot,
        expectedRevision: conflict.currentSnapshot.contentRevision,
        conflict: null,
      });
    }
  },

  save: async (root) => {
    const { expectedRevision } = get();
    if (!window.blueAPI?.commitCodeRepositoryDraft) {
      return {
        ok: false as const,
        error: {
          code: 'storage-unavailable',
          message: 'Unavailable',
          retryable: false,
        },
      };
    }
    const result = await window.blueAPI.commitCodeRepositoryDraft({
      expectedRevision,
      root,
    });
    if (result.ok) {
      set({
        snapshot: result.value,
        expectedRevision: result.value.contentRevision,
        conflict: null,
      });
      return { ok: true as const };
    }
    set({
      conflict: result.error,
      ...(result.error.currentSnapshot
        ? {
            snapshot: result.error.currentSnapshot,
          }
        : {}),
    });
    return { ok: false as const, error: result.error };
  },
}));
