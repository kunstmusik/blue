import { create } from 'zustand';
import {
  LIBRARY_TYPES,
  type LibraryBrowseNode,
  type LibraryChangedEvent,
  type LibraryContextRequest,
  type LibraryContextSnapshot,
  type LibraryInsertionMode,
  type LibraryInsertionPreview,
  type LibraryItemKey,
  type LibraryItemPreview,
  type LibrarySearchResult,
  type LibraryServiceSnapshot,
  type ProjectMutationReceipt,
  type LibraryType,
  type UserLibraryMutation,
  type LibraryMigrationSummary,
  type ManualLibraryImportPreview,
  type ManualLibraryImportResult,
  type LibraryImportHistoryEntry,
} from '../../shared/unified-library';
import { useLibraryEditorStore } from './library-editor-store';
import { useWorkbenchStore } from './workbench-store';

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
  projectNodesByType: Record<LibraryType, LibraryBrowseNode[]>;
  childrenByParent: Record<string, LibraryBrowseNode[]>;
  searchResults: LibrarySearchResult[];
  nextSearchCursor: string | null;
  selectedKey: LibraryItemKey | null;
  selectedPreview: LibraryItemPreview | null;
  previewCache: Record<string, LibraryItemPreview>;
  context: LibraryContextSnapshot;
  insertionPreview: LibraryInsertionPreview | null;
  lastInsertionReceipt: ProjectMutationReceipt | null;
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
  setContext: (request: LibraryContextRequest) => Promise<void>;
  clearTarget: () => Promise<void>;
  previewInsertion: (mode?: LibraryInsertionMode) => Promise<void>;
  applyInsertion: () => Promise<void>;
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
let unsubscribeContext: (() => void) | null = null;
let unsubscribeMigration: (() => void) | null = null;

function keyString(key: LibraryItemKey): string {
  return JSON.stringify(key);
}

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
    projectNodesByType: { ...EMPTY_NODES },
    childrenByParent: {},
    searchResults: [],
    nextSearchCursor: null,
    selectedKey: null,
    selectedPreview: null,
    previewCache: {},
    context: { selectedType: 'instrument' as const, target: null },
    insertionPreview: null,
    lastInsertionReceipt: null,
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
      unsubscribeContext?.();
      unsubscribeSnapshot = window.blueAPI.onLibraryServiceSnapshot((next) => {
        const projectChanged = get().snapshot?.projectSessionId !== next.projectSessionId;
        set({
          snapshot: next,
          projectAvailable: next.projectSessionId !== null,
          ...(projectChanged ? {
            projectNodesByType: { ...EMPTY_NODES },
            selectedKey: null,
            selectedPreview: null,
          } : {}),
        });
        if (projectChanged) void get().refresh();
      });
      unsubscribeChanged = window.blueAPI.onLibraryChanged((event: LibraryChangedEvent) => {
        if ((get().snapshot?.contentRevision ?? 0) > event.contentRevision) return;
        set((state) => ({
          previewCache: event.requiresFullRefresh
            ? {}
            : Object.fromEntries(Object.entries(state.previewCache).filter(([serialized]) => (
                !event.affectedKeys?.some((key) => keyString(key) === serialized)
              ))),
        }));
        void get().refresh();
      });
      unsubscribeContext = window.blueAPI.onLibraryContextChanged?.((context) => {
        set({
          context,
          typeFilter: context.selectedType,
          insertionPreview: null,
          lastInsertionReceipt: null,
        });
      }) ?? null;
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
    unsubscribeContext?.();
    unsubscribeContext = null;
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
    LIBRARY_TYPES.forEach((type, index) => {
      const result = userResults[index];
      nodesByType[type] = result?.ok ? [...result.value.children] : [];
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
    set({ nodesByType, projectNodesByType, error: null });
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
    const serialized = keyString(key);
    const cached = get().previewCache[serialized];
    set({ selectedKey: key, selectedPreview: cached ?? null });
    if (cached) return;
    const result = await window.blueAPI.getLibraryItemPreview(key);
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }
    set((state) => ({
      selectedPreview: result.value,
      previewCache: { ...state.previewCache, [serialized]: result.value },
      error: null,
    }));
  },

  setContext: async (request) => {
    const result = await window.blueAPI.setLibraryContext(request);
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }
    set({
      context: result.value,
      typeFilter: result.value.selectedType,
      insertionPreview: null,
      error: null,
    });
  },

  clearTarget: async () => {
    const context = await window.blueAPI.clearLibraryInsertionTarget();
    set({ context, insertionPreview: null, error: null });
  },

  previewInsertion: async (mode = 'independent') => {
    const key = get().selectedKey;
    if (!key) return;
    const result = await window.blueAPI.previewLibraryInsertion({ key, mode });
    if (!result.ok) {
      set({ error: result.error.message, insertionPreview: null });
      return;
    }
    set({ insertionPreview: result.value, error: null });
  },

  applyInsertion: async () => {
    const preview = get().insertionPreview;
    if (!preview?.canApply) return;
    const result = await window.blueAPI.applyLibraryInsertion(preview.previewToken);
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }
    set({ lastInsertionReceipt: result.value, insertionPreview: null, error: null });
  },

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
