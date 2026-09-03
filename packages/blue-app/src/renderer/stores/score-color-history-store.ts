import { create } from 'zustand';
import type { ProjectDocumentPatch } from '../../shared/project-editor';
import { useProjectStore } from './project-store';

export interface ScoreColorHistoryEntry {
  label: string;
  forward: ProjectDocumentPatch;
  inverse: ProjectDocumentPatch;
}

const MAX_COLOR_HISTORY_ENTRIES = 100;

function isNoOpEntry(entry: ScoreColorHistoryEntry): boolean {
  return JSON.stringify(entry.forward) === JSON.stringify(entry.inverse);
}

export interface ScoreColorHistoryState {
  entries: ScoreColorHistoryEntry[];
  cursor: number;
  canUndo: boolean;
  canRedo: boolean;
  pushEntry: (entry: ScoreColorHistoryEntry) => void;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  reset: () => void;
}

export const useScoreColorHistoryStore = create<ScoreColorHistoryState>((set, get) => ({
  entries: [],
  cursor: -1,
  canUndo: false,
  canRedo: false,

  pushEntry: (entry: ScoreColorHistoryEntry) => {
    if (isNoOpEntry(entry)) return;

    set((state) => {
      const nextEntries = state.entries.slice(0, state.cursor + 1);
      nextEntries.push(entry);
      if (nextEntries.length > MAX_COLOR_HISTORY_ENTRIES) {
        nextEntries.shift();
      }
      const newCursor = nextEntries.length - 1;
      return {
        entries: nextEntries,
        cursor: newCursor,
        canUndo: true,
        canRedo: false,
      };
    });
  },

  undo: async (): Promise<boolean> => {
    const state = get();
    if (!state.canUndo || state.cursor < 0 || state.cursor >= state.entries.length) {
      return false;
    }
    const currentEntry = state.entries[state.cursor];
    try {
      await useProjectStore.getState().flushPendingPatches?.();
    } catch {
      return false;
    }
    try {
      const result: unknown = await useProjectStore.getState().applyProjectDocumentPatch(currentEntry.inverse);
      if (result === false) {
        return false;
      }
      await useProjectStore.getState().flushPendingPatches?.();
      set((s) => {
        const nextCursor = s.cursor - 1;
        return {
          cursor: nextCursor,
          canUndo: nextCursor >= 0,
          canRedo: true,
        };
      });
      return true;
    } catch {
      return false;
    }
  },

  redo: async (): Promise<boolean> => {
    const state = get();
    if (!state.canRedo || state.cursor + 1 >= state.entries.length) {
      return false;
    }
    const nextEntry = state.entries[state.cursor + 1];
    try {
      await useProjectStore.getState().flushPendingPatches?.();
    } catch {
      return false;
    }
    try {
      const result: unknown = await useProjectStore.getState().applyProjectDocumentPatch(nextEntry.forward);
      if (result === false) {
        return false;
      }
      await useProjectStore.getState().flushPendingPatches?.();
      set((s) => {
        const nextCursor = s.cursor + 1;
        return {
          cursor: nextCursor,
          canUndo: true,
          canRedo: nextCursor < s.entries.length - 1,
        };
      });
      return true;
    } catch {
      return false;
    }
  },

  reset: () => {
    set({
      entries: [],
      cursor: -1,
      canUndo: false,
      canRedo: false,
    });
  },
}));
