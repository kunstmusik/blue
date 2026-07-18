import { create } from 'zustand';
import type {
  LibraryEditorConflictDecision,
  LibraryEditorPatchRequest,
  LibraryEditorSessionSnapshot,
  LibraryItemKey,
} from '../../shared/unified-library';

const PANEL_PREFIX = 'library-item:';

export function libraryEditorPanelId(sessionId: string): string {
  return `${PANEL_PREFIX}${encodeURIComponent(sessionId)}`;
}

export function libraryEditorSessionIdFromPanel(panelId: string): string | null {
  if (!panelId.startsWith(PANEL_PREFIX)) return null;
  try {
    const value = decodeURIComponent(panelId.slice(PANEL_PREFIX.length));
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

interface LibraryEditorState {
  sessions: Record<string, LibraryEditorSessionSnapshot>;
  loadingSessionIds: ReadonlySet<string>;
  error: string | null;
  initialized: boolean;
  initialize: () => void;
  dispose: () => void;
  open: (key: LibraryItemKey, pinned?: boolean) => Promise<LibraryEditorSessionSnapshot | null>;
  hydrate: (sessionId: string) => Promise<LibraryEditorSessionSnapshot | null>;
  patch: (sessionId: string, patch: Omit<LibraryEditorPatchRequest, 'sessionId'>) => Promise<void>;
  save: (sessionId: string) => Promise<void>;
  revert: (sessionId: string) => Promise<void>;
  resolveConflict: (sessionId: string, decision: LibraryEditorConflictDecision) => Promise<void>;
  close: (sessionId: string, decision?: 'discard' | 'cancel') => Promise<boolean>;
  reset: () => void;
}

let unsubscribe: (() => void) | null = null;

export const useLibraryEditorStore = create<LibraryEditorState>((set, get) => ({
  sessions: {},
  loadingSessionIds: new Set(),
  error: null,
  initialized: false,

  initialize: () => {
    if (get().initialized) return;
    unsubscribe = window.blueAPI.onLibraryEditorSessionChanged((session) => {
      set((state) => ({ sessions: { ...state.sessions, [session.sessionId]: session } }));
    });
    set({ initialized: true });
  },

  dispose: () => {
    unsubscribe?.();
    unsubscribe = null;
    set({ initialized: false });
  },

  open: async (key, pinned = false) => {
    get().initialize();
    const result = await window.blueAPI.openLibraryItemEditor({ key, pinned });
    if (!result.ok) {
      set({ error: result.error.message });
      return null;
    }
    set((state) => ({
      sessions: Object.fromEntries([
        ...Object.entries(state.sessions).filter(([sessionId, session]) => (
          sessionId === result.value.sessionId || session.dirty || session.pinned
        )),
        [result.value.sessionId, result.value],
      ]),
      error: null,
    }));
    return result.value;
  },

  hydrate: async (sessionId) => {
    get().initialize();
    if (get().sessions[sessionId]) return get().sessions[sessionId] ?? null;
    set((state) => ({ loadingSessionIds: new Set(state.loadingSessionIds).add(sessionId) }));
    const result = await window.blueAPI.getLibraryEditorSession(sessionId);
    set((state) => {
      const loadingSessionIds = new Set(state.loadingSessionIds);
      loadingSessionIds.delete(sessionId);
      return result.ok
        ? { loadingSessionIds, sessions: { ...state.sessions, [sessionId]: result.value }, error: null }
        : { loadingSessionIds, error: result.error.message };
    });
    return result.ok ? result.value : null;
  },

  patch: async (sessionId, patch) => {
    const result = await window.blueAPI.patchLibraryEditorSession({ sessionId, ...patch });
    if (!result.ok) return set({ error: result.error.message });
    set((state) => ({ sessions: { ...state.sessions, [sessionId]: result.value }, error: null }));
  },

  save: async (sessionId) => {
    const result = await window.blueAPI.saveLibraryEditorSession(sessionId);
    if (!result.ok) return set({ error: result.error.message });
    set((state) => ({
      sessions: { ...state.sessions, [sessionId]: result.value.session },
      error: result.value.status === 'saved' ? null : `Library item is ${result.value.status}.`,
    }));
  },

  revert: async (sessionId) => {
    const result = await window.blueAPI.revertLibraryEditorSession(sessionId);
    if (!result.ok) return set({ error: result.error.message });
    set((state) => ({ sessions: { ...state.sessions, [sessionId]: result.value }, error: null }));
  },

  resolveConflict: async (sessionId, decision) => {
    const result = await window.blueAPI.resolveLibraryEditorConflict(sessionId, decision);
    if (!result.ok) return set({ error: result.error.message });
    set((state) => ({ sessions: { ...state.sessions, [sessionId]: result.value }, error: null }));
  },

  close: async (sessionId, decision) => {
    const result = await window.blueAPI.closeLibraryEditorSession(sessionId, decision);
    if (!result.ok) {
      set({ error: result.error.message });
      return false;
    }
    if (result.value) set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[sessionId];
      return { sessions, error: null };
    });
    return result.value;
  },

  reset: () => {
    get().dispose();
    set({ sessions: {}, loadingSessionIds: new Set(), error: null });
  },
}));
