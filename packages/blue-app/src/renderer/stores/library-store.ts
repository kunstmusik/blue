import { create } from 'zustand';
import {
  LIBRARY_TYPES,
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
  type LibraryMigrationSummary,
  type LibraryMutationPreview,
  type ManualLibraryImportPreview,
  type ManualLibraryImportResult,
  type LibraryImportHistoryEntry,
} from '../../shared/unified-library';
import { useLibraryEditorStore } from './library-editor-store';
import { libraryEditorPanelId } from './library-editor-store';
import { useWorkbenchStore } from './workbench-store';
import { toast } from 'sonner';

export type LibrarySourceFilter = 'all' | 'user' | 'project';

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
  projectAvailable: boolean;
  typeFilter: LibraryType | 'all';
  sourceFilter: LibrarySourceFilter;
  query: string;
  nodesByType: Record<LibraryType, LibraryBrowseNode[]>;
  userRootsByType: Record<LibraryType, LibraryBrowseNode | null>;
  projectNodesByType: Record<LibraryType, LibraryBrowseNode[]>;
  childrenByParent: Record<string, LibraryBrowseNode[]>;
  searchResults: LibrarySearchResult[];
  nextSearchCursor: string | null;
  selectedKey: LibraryItemKey | null;
  clipboard: LibraryInteractionClipboard | null;
  transferPreview: LibraryTransferPreview | null;
  transferSource: LibraryTransferSourceReference | null;
  deletePreview: (LibraryMutationPreview & { readonly displayName: string }) | null;
  migrationSummary: LibraryMigrationSummary | null;
  importPreview: ManualLibraryImportPreview | null;
  importResult: ManualLibraryImportResult | null;
  history: LibraryImportHistoryEntry[];
  historyOpen: boolean;
  initialize: () => Promise<void>;
  dispose: () => void;
  reset: () => void;
  refresh: () => Promise<void>;
  setTypeFilter: (filter: LibraryType | 'all') => void;
  setSourceFilter: (filter: LibrarySourceFilter) => void;
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
  dismissMigrationSummary: () => void;
  selectImportFiles: () => Promise<void>;
  executeImport: () => Promise<void>;
  cancelImport: () => void;
  exportCurrent: () => Promise<void>;
  exportAll: () => Promise<void>;
  openHistory: () => Promise<void>;
  closeHistory: () => void;
  undoImport: (batchId: string) => Promise<void>;
  retryRecovery: () => Promise<void>;
  restoreBackup: () => Promise<void>;
  createFreshDatabase: () => Promise<void>;
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribeChanged: (() => void) | null = null;
let unsubscribeMigration: (() => void) | null = null;

function initialState() {
  return {
    snapshot: null,
    initialized: false,
    loading: false,
    error: null,
    projectAvailable: false,
    typeFilter: 'all' as const,
    sourceFilter: 'all' as const,
    query: '',
    nodesByType: { ...EMPTY_NODES },
    userRootsByType: { instrument: null, udo: null, soundObject: null, effect: null },
    projectNodesByType: { ...EMPTY_NODES },
    childrenByParent: {},
    searchResults: [],
    nextSearchCursor: null,
    selectedKey: null,
    clipboard: null,
    transferPreview: null,
    transferSource: null,
    deletePreview: null,
    migrationSummary: null,
    importPreview: null,
    importResult: null,
    history: [],
    historyOpen: false,
  };
}

function matchesSource(result: LibrarySearchResult, filter: LibrarySourceFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'user') return result.scope === 'user';
  return result.scope !== 'user';
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ...initialState(),

  initialize: async () => {
    if (get().initialized || get().loading) return;
    set({ loading: true, error: null });
    try {
      const [snapshot, migrationSummary] = await Promise.all([
        window.blueAPI.getLibraryServiceSnapshot(),
        window.blueAPI.getLibraryMigrationSummary?.() ?? Promise.resolve(null),
      ]);
      set({
        snapshot,
        projectAvailable: snapshot.projectSessionId !== null,
        initialized: true,
        migrationSummary,
      });
      unsubscribeSnapshot?.();
      unsubscribeChanged?.();
      unsubscribeSnapshot = window.blueAPI.onLibraryServiceSnapshot((next) => {
        const projectChanged = get().snapshot?.projectSessionId !== next.projectSessionId;
        set({
          snapshot: next,
          projectAvailable: next.projectSessionId !== null,
          ...(projectChanged ? {
            projectNodesByType: { ...EMPTY_NODES },
            selectedKey: null,
          } : {}),
        });
        if (projectChanged) void get().refresh();
      });
      unsubscribeChanged = window.blueAPI.onLibraryChanged((event: LibraryChangedEvent) => {
        if ((get().snapshot?.contentRevision ?? 0) > event.contentRevision) return;
        void get().refresh();
      });
      unsubscribeMigration = window.blueAPI.onLibraryMigrationSummary?.((summary) => {
        set({ migrationSummary: summary });
      }) ?? null;
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
    unsubscribeMigration?.();
    unsubscribeMigration = null;
  },

  reset: () => {
    get().dispose();
    set(initialState());
  },

  refresh: async () => {
    const sessionId = get().snapshot?.projectSessionId ?? null;
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

    const projectNodesByType = { ...EMPTY_NODES };
    if (sessionId !== null) {
      const projectRequests = [
        { type: 'instrument' as const, scope: 'projectOwned' as const },
        { type: 'udo' as const, scope: 'projectOwned' as const },
        { type: 'soundObject' as const, scope: 'projectShared' as const },
      ];
      const projectResults = await Promise.all(projectRequests.map(({ type, scope }) => (
        window.blueAPI.browseLibraries({
          parent: { scope, libraryType: type, projectSessionId: sessionId },
        })
      )));
      projectRequests.forEach(({ type }, index) => {
        const result = projectResults[index];
        projectNodesByType[type] = result?.ok ? [...result.value.children] : [];
      });
    }
    set({ nodesByType, userRootsByType, projectNodesByType, error: null });
    if (get().query.trim()) await get().runSearch(false);
  },

  setTypeFilter: (typeFilter) => {
    set({ typeFilter });
    if (get().query.trim()) void get().runSearch(false);
  },

  setSourceFilter: (sourceFilter) => {
    set({ sourceFilter });
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
      projectSessionId: state.snapshot?.projectSessionId ?? null,
      cursor,
      limit: 100,
    });
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }
    const filtered = result.value.results.filter((candidate) => (
      matchesSource(candidate, get().sourceFilter)
    ));
    set((current) => ({
      searchResults: append ? [...current.searchResults, ...filtered] : filtered,
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
    if (node.scope !== 'user' || typeof node.revision !== 'number') return;
    set({
      clipboard: {
        operation,
        source: {
          kind: 'userNode',
          libraryType: node.libraryType,
          nodeId: node.nodeId,
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
    if (clipboard.source.libraryType !== parent.libraryType) {
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
    set({ transferPreview: result.value, transferSource: source, error: null });
    return get().applyTransfer(mode);
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
    const session = await useLibraryEditorStore.getState().open(key, pinned);
    if (!session) {
      set({ error: useLibraryEditorStore.getState().error });
      return;
    }
    useWorkbenchStore.getState().openLibraryEditorPanel(session);
  },

  dismissMigrationSummary: () => set({ migrationSummary: null }),

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

  openHistory: async () => {
    const result = await window.blueAPI.getLibraryImportHistory();
    if (!result.ok) return set({ error: result.error.message });
    set({ history: result.value, historyOpen: true, error: null });
  },

  closeHistory: () => set({ historyOpen: false }),

  undoImport: async (batchId) => {
    const result = await window.blueAPI.undoLibraryImport(batchId);
    if (!result.ok) return set({ error: result.error.message });
    await get().refresh();
    await get().openHistory();
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
