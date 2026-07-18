import { create } from 'zustand';
import {
  LIBRARY_TYPES,
  getLibraryTransferSourceType,
  type LibraryBrowseNode,
  type LibraryChangedEvent,
  type LibraryInteractionClipboard,
  type LibraryExactTransferTarget,
  type LibraryInsertionMode,
  type LibraryTransferPreview,
  type LibraryTransferSourceReference,
  type LibraryItemKey,
  type LibrarySearchResult,
  type LibraryServiceSnapshot,
  type LibraryType,
  type UserLibraryMutation,
  type LibraryMutationPreview,
  type ManualLibraryImportPreview,
  type ManualLibraryImportResult,
} from '../../shared/unified-library';
import { useLibraryEditorStore } from './library-editor-store';
import { libraryEditorPanelId } from './library-editor-store';
import { useWorkbenchStore } from './workbench-store';
import { toast } from 'sonner';

const EMPTY_NODES: Record<LibraryType, LibraryBrowseNode[]> = {
  instrument: [],
  udo: [],
  soundObject: [],
  effect: [],
};

interface LibraryState {
  snapshot: LibraryServiceSnapshot | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  typeFilter: LibraryType | 'all';
  query: string;
  scrollTop: number;
  nodesByType: Record<LibraryType, LibraryBrowseNode[]>;
  userRootsByType: Record<LibraryType, LibraryBrowseNode | null>;
  childrenByParent: Record<string, LibraryBrowseNode[]>;
  searchResults: LibrarySearchResult[];
  nextSearchCursor: string | null;
  selectedKey: LibraryItemKey | null;
  clipboard: LibraryInteractionClipboard | null;
  transferPreview: LibraryTransferPreview | null;
  transferSource: LibraryTransferSourceReference | null;
  deletePreview: (LibraryMutationPreview & { readonly displayName: string }) | null;
  importPreview: ManualLibraryImportPreview | null;
  importResult: ManualLibraryImportResult | null;
  initialize: () => Promise<void>;
  dispose: () => void;
  reset: () => void;
  refresh: () => Promise<void>;
  setTypeFilter: (filter: LibraryType | 'all') => void;
  setQuery: (query: string) => void;
  runSearch: (append?: boolean) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  expandNode: (node: LibraryBrowseNode) => Promise<void>;
  selectItem: (key: LibraryItemKey) => Promise<void>;
  captureClipboard: (node: LibraryBrowseNode, operation: 'copy' | 'cut') => void;
  cancelClipboard: () => void;
  pasteInto: (parent: LibraryBrowseNode) => Promise<boolean>;
  transferToProject: (source: LibraryTransferSourceReference, target: LibraryExactTransferTarget, mode?: LibraryInsertionMode) => Promise<boolean>;
  applyTransfer: (mode?: LibraryInsertionMode) => Promise<boolean>;
  cancelTransfer: () => void;
  prepareDelete: (node: LibraryBrowseNode) => Promise<boolean>;
  confirmDelete: (decision: 'save' | 'discard') => Promise<boolean>;
  cancelDelete: () => void;
  applyMutation: (mutation: UserLibraryMutation) => Promise<boolean>;
  openEditor: (key: LibraryItemKey, pinned?: boolean) => Promise<void>;
  selectImportFiles: () => Promise<void>;
  executeImport: () => Promise<void>;
  cancelImport: () => void;
  exportCurrent: () => Promise<void>;
  exportAll: () => Promise<void>;
  retryRecovery: () => Promise<void>;
  restoreBackup: () => Promise<void>;
  createFreshDatabase: () => Promise<void>;
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribeChanged: (() => void) | null = null;

function initialState() {
  return {
    snapshot: null,
    initialized: false,
    loading: false,
    error: null,
    typeFilter: 'all' as const,
    query: '',
    scrollTop: 0,
    nodesByType: { ...EMPTY_NODES },
    userRootsByType: { instrument: null, udo: null, soundObject: null, effect: null },
    childrenByParent: {},
    searchResults: [],
    nextSearchCursor: null,
    selectedKey: null,
    clipboard: null,
    transferPreview: null,
    transferSource: null,
    deletePreview: null,
    importPreview: null,
    importResult: null,
  };
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ...initialState(),

  initialize: async () => {
    if (get().initialized || get().loading) return;
    set({ loading: true, error: null });
    try {
      const snapshot = await window.blueAPI.getLibraryServiceSnapshot();
      set({
        snapshot,
        initialized: true,
      });
      unsubscribeSnapshot?.();
      unsubscribeChanged?.();
      unsubscribeSnapshot = window.blueAPI.onLibraryServiceSnapshot((next) => {
        const projectChanged = get().snapshot?.projectSessionId !== next.projectSessionId;
        set({
          snapshot: next,
          ...(projectChanged ? { selectedKey: null } : {}),
        });
        if (projectChanged) void get().refresh();
      });
      unsubscribeChanged = window.blueAPI.onLibraryChanged((event: LibraryChangedEvent) => {
        if ((get().snapshot?.contentRevision ?? 0) > event.contentRevision) return;
        void get().refresh();
      });
      await get().refresh();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to load Libraries' });
    } finally {
      set({ loading: false });
    }
  },

  dispose: () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = null;
    unsubscribeSnapshot?.();
    unsubscribeChanged?.();
    unsubscribeSnapshot = null;
    unsubscribeChanged = null;
  },

  reset: () => {
    get().dispose();
    set(initialState());
  },

  refresh: async () => {
    const userResults = await Promise.all(LIBRARY_TYPES.map(async (libraryType) => (
      window.blueAPI.browseLibraries({ parent: { scope: 'user', libraryType } })
    )));
    const nodesByType = { ...EMPTY_NODES };
    const userRootsByType: Record<LibraryType, LibraryBrowseNode | null> = {
      instrument: null, udo: null, soundObject: null, effect: null,
    };
    LIBRARY_TYPES.forEach((type, index) => {
      const result = userResults[index];
      nodesByType[type] = result?.ok ? [...result.value.children] : [];
      userRootsByType[type] = result?.ok ? result.value.parent : null;
    });

    set({ nodesByType, userRootsByType, error: null });
    if (get().query.trim()) await get().runSearch(false);
  },

  setTypeFilter: (typeFilter) => {
    set({ typeFilter });
    if (get().query.trim()) void get().runSearch(false);
  },

  setQuery: (query) => {
    set({ query, nextSearchCursor: null });
    if (searchTimer) clearTimeout(searchTimer);
    if (!query.trim()) {
      set({ searchResults: [], nextSearchCursor: null });
      searchTimer = null;
      return;
    }
    searchTimer = setTimeout(() => {
      searchTimer = null;
      void get().runSearch(false);
    }, 150);
  },

  runSearch: async (append = false) => {
    const state = get();
    const query = state.query.trim();
    if (!query) return;
    const cursor = append ? state.nextSearchCursor ?? undefined : undefined;
    if (append && !cursor) return;
    const result = await window.blueAPI.searchLibraries({
      query,
      typeFilter: state.typeFilter,
      projectSessionId: null,
      cursor,
      limit: 100,
    });
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }
    set((current) => ({
      searchResults: append ? [...current.searchResults, ...result.value.results] : result.value.results,
      nextSearchCursor: result.value.nextCursor,
      error: null,
    }));
  },

  loadMoreSearchResults: async () => get().runSearch(true),

  expandNode: async (node) => {
    if (!node.hasChildren || node.nodeKind === 'item') return;
    const result = await window.blueAPI.browseLibraries({
      parent: node.scope === 'user'
        ? { scope: 'user', libraryType: node.libraryType, nodeId: node.nodeId }
        : {
            scope: node.scope,
            libraryType: node.libraryType as Exclude<LibraryType, 'effect'>,
            projectSessionId: get().snapshot?.projectSessionId ?? -1,
          },
    });
    if (result.ok) {
      set((state) => ({
        childrenByParent: { ...state.childrenByParent, [node.nodeId]: [...result.value.children] },
      }));
    }
  },

  selectItem: async (key) => {
    set({ selectedKey: key, error: null });
    await get().openEditor(key, false);
  },

  captureClipboard: (node, operation) => {
    if (node.nodeKind !== 'item' || !node.key || node.revision === undefined) return;
    if (operation === 'cut' && node.scope !== 'user') return;
    set({
      clipboard: {
        operation,
        source: node.scope === 'user'
          ? {
              kind: 'userNode',
              libraryType: node.libraryType,
              nodeId: node.nodeId,
              revision: node.revision,
            }
          : {
              kind: 'library',
              key: node.key,
              revision: node.revision,
            },
        capturedAt: Date.now(),
      },
      error: null,
    });
  },

  cancelClipboard: () => set({ clipboard: null }),

  pasteInto: async (parent) => {
    const clipboard = get().clipboard;
    if (!clipboard || clipboard.source.kind !== 'userNode' || parent.scope !== 'user') return false;
    if (getLibraryTransferSourceType(clipboard.source) !== parent.libraryType) {
      set({ error: 'Library items can only be pasted within the same library type.' });
      return false;
    }
    const mutation: UserLibraryMutation = clipboard.operation === 'copy'
      ? {
          type: 'duplicateNode',
          nodeId: clipboard.source.nodeId,
          expectedRevision: clipboard.source.revision,
          parentId: parent.nodeId,
          ...(typeof parent.revision === 'number' ? { expectedParentRevision: parent.revision } : {}),
        }
      : {
          type: 'moveNode',
          nodeId: clipboard.source.nodeId,
          expectedRevision: clipboard.source.revision,
          parentId: parent.nodeId,
          ...(typeof parent.revision === 'number' ? { expectedParentRevision: parent.revision } : {}),
          targetIndex: 0,
        };
    const applied = await get().applyMutation(mutation);
    if (applied && clipboard.operation === 'cut') set({ clipboard: null });
    return applied;
  },

  transferToProject: async (source, target, mode = 'independent') => {
    const result = await window.blueAPI.previewLibraryTransfer({ source, target, mode });
    if (!result.ok) {
      set({ error: result.error.message, transferPreview: null, transferSource: null });
      toast.error(result.error.message);
      return false;
    }
    if (!result.value.canApply) {
      set({ error: result.value.blockingReasons.join(' '), transferPreview: null, transferSource: null });
      toast.error(result.value.blockingReasons.join(' '));
      return false;
    }
    if (result.value.allowedModes.length > 1 && mode === 'independent') {
      set({ transferPreview: result.value, transferSource: source, error: null });
      return true;
    }
    const applyResult = await window.blueAPI.applyLibraryTransfer(result.value.previewToken);
    if (!applyResult.ok) {
      set({ error: applyResult.error.message, transferPreview: null, transferSource: null });
      toast.error(applyResult.error.message);
      return false;
    }
    set({ transferPreview: null, transferSource: null, error: null });
    toast.success(applyResult.value.message);
    return true;
  },

  applyTransfer: async (mode) => {
    const preview = get().transferPreview;
    if (!preview) return false;
    if (mode && mode !== preview.requestedMode) {
      const source = get().transferSource;
      if (!source) return false;
      return get().transferToProject(source, preview.target, mode);
    }
    const result = await window.blueAPI.applyLibraryTransfer(preview.previewToken);
    if (!result.ok) {
      set({ error: result.error.message, transferPreview: null, transferSource: null });
      toast.error(result.error.message);
      return false;
    }
    set({ transferPreview: null, transferSource: null, error: null });
    toast.success(result.value.message);
    return true;
  },

  cancelTransfer: () => set({ transferPreview: null, transferSource: null }),

  prepareDelete: async (node) => {
    if (node.scope !== 'user' || typeof node.revision !== 'number') return false;
    const result = await window.blueAPI.prepareLibraryMutation({
      type: 'deleteNode',
      nodeId: node.nodeId,
      expectedRevision: node.revision,
    });
    if (!result.ok) {
      set({ error: result.error.message, deletePreview: null });
      return false;
    }
    set({ deletePreview: { ...result.value, displayName: node.displayName }, error: null });
    return true;
  },

  confirmDelete: async (decision) => {
    const preview = get().deletePreview;
    if (!preview) return false;
    const editorStore = useLibraryEditorStore.getState();
    for (const sessionId of preview.dirtyEditorSessionIds) {
      if (decision === 'save') {
        await editorStore.save(sessionId);
        const saved = useLibraryEditorStore.getState().sessions[sessionId];
        if (!saved || saved.dirty || saved.status !== 'ready') {
          set({ error: useLibraryEditorStore.getState().error ?? 'Unable to save the Library Item draft.' });
          return false;
        }
      } else {
        if (!await editorStore.close(sessionId, 'discard')) return false;
        useWorkbenchStore.getState().closePanel(libraryEditorPanelId(sessionId));
      }
    }
    const result = await window.blueAPI.applyLibraryMutation({
      type: 'deleteNode',
      nodeId: preview.nodeId,
      expectedRevision: preview.expectedRevision,
      confirmation: preview.confirmationToken,
    });
    if (!result.ok) {
      set({ error: result.error.message, deletePreview: null });
      return false;
    }
    for (const sessionId of result.value.closedEditorSessionIds ?? []) {
      useLibraryEditorStore.setState((state) => {
        const sessions = { ...state.sessions };
        delete sessions[sessionId];
        return { sessions };
      });
      useWorkbenchStore.getState().closePanel(libraryEditorPanelId(sessionId));
    }
    const clipboard = get().clipboard;
    set({
      deletePreview: null,
      clipboard: clipboard?.source.kind === 'userNode' && preview.affectedNodeIds.includes(clipboard.source.nodeId)
        ? null
        : clipboard,
      error: null,
    });
    await get().refresh();
    toast.success(`Deleted ${preview.affectedCount} Library ${preview.affectedCount === 1 ? 'item' : 'items'}.`);
    return true;
  },

  cancelDelete: () => set({ deletePreview: null }),

  applyMutation: async (mutation) => {
    const result = await window.blueAPI.applyLibraryMutation(mutation);
    if (!result.ok) {
      set({ error: result.error.message });
      return false;
    }
    set({ error: null });
    await get().refresh();
    return true;
  },

  openEditor: async (key, pinned = false) => {
    const editorStore = useLibraryEditorStore.getState();
    const replaceableSessionIds = Object.values(editorStore.sessions)
      .filter((session) => !session.dirty && !session.pinned)
      .map((session) => session.sessionId);
    const session = await editorStore.open(key, pinned);
    if (!session) {
      set({ error: useLibraryEditorStore.getState().error });
      return;
    }
    const workbenchStore = useWorkbenchStore.getState();
    for (const sessionId of replaceableSessionIds) {
      if (sessionId !== session.sessionId) {
        workbenchStore.closePanel(libraryEditorPanelId(sessionId));
      }
    }
    workbenchStore.openLibraryEditorPanel(session);
  },

  selectImportFiles: async () => {
    const result = await window.blueAPI.selectLibraryImportFiles();
    if (!result) return;
    if (!result.ok) return set({ error: result.error.message });
    set({ importPreview: result.value, importResult: null, error: null });
  },

  executeImport: async () => {
    const preview = get().importPreview;
    if (!preview) return;
    const result = await window.blueAPI.executeLibraryImport(preview.previewToken);
    if (!result.ok) return set({ error: result.error.message });
    set({ importPreview: null, importResult: result.value, error: null });
    await get().refresh();
  },

  cancelImport: () => set({ importPreview: null }),

  exportCurrent: async () => {
    const type = get().typeFilter;
    if (type === 'all') return;
    const result = await window.blueAPI.exportCurrentLibrary(type);
    if (result && !result.ok) set({ error: result.error.message });
  },

  exportAll: async () => {
    const result = await window.blueAPI.exportAllLibraries();
    if (result && !result.ok) set({ error: result.error.message });
  },

  retryRecovery: async () => {
    const result = await window.blueAPI.retryLibraryRecovery();
    if (!result.ok) return set({ error: result.error.message });
    set({ snapshot: result.value, error: null });
    await get().refresh();
  },

  restoreBackup: async () => {
    const result = await window.blueAPI.restoreLibraryBackup();
    if (!result) return;
    if (!result.ok) return set({ error: result.error.message });
    set({ snapshot: result.value, error: null });
    await get().refresh();
  },

  createFreshDatabase: async () => {
    if (!window.confirm('Create a fresh Libraries database? The failed database will be preserved for recovery.')) return;
    const result = await window.blueAPI.createFreshLibraryDatabase();
    if (!result.ok) return set({ error: result.error.message });
    set({ snapshot: result.value, error: null });
    await get().refresh();
  },
}));
