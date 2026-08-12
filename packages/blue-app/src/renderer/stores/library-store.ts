import { create } from 'zustand';
import {
  LIBRARY_TYPES,
  getLibraryTransferSourceType,
  type LibraryBrowseNode,
  type BrowseLibraryResult,
  type BrowseLibraryRequest,
  type LibraryChangedEvent,
  type LibraryInteractionClipboard,
  type LibraryResult,
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
  type ScoreTimelineSoundObjectRequest,
  type TrackInstrumentClipboardRequest,
  type BlueLiveSoundObjectClipboardRequest,
  type CapturableLibraryTransferSource,
} from '../../shared/unified-library';
import {
  libraryEditorPanelId,
  useLibraryEditorStore,
} from './library-editor-store';
import { useWorkbenchStore } from './workbench-store';
import { useBsbClipboardStore } from './bsb-clipboard-store';
import { toast } from 'sonner';

const EMPTY_NODES: Record<LibraryType, LibraryBrowseNode[]> = {
  instrument: [],
  udo: [],
  soundObject: [],
  effect: [],
};

function receiveSharedCopyBuffers(snapshot: LibraryServiceSnapshot): void {
  if (snapshot.bsbClipboard !== undefined) {
    useBsbClipboardStore.getState().receiveClipboard(snapshot.bsbClipboard);
  }
}

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
  captureClipboard: (node: LibraryBrowseNode, operation: 'copy' | 'cut') => Promise<boolean>;
  captureScoreSoundObject: (request: ScoreTimelineSoundObjectRequest) => Promise<boolean>;
  captureTrackInstrument: (request: TrackInstrumentClipboardRequest) => Promise<boolean>;
  captureBlueLiveSoundObject: (request: BlueLiveSoundObjectClipboardRequest) => Promise<boolean>;
  addScoreSoundObjectToProjectLibrary: (request: ScoreTimelineSoundObjectRequest) => Promise<boolean>;
  cancelClipboard: () => void;
  pasteInto: (parent: LibraryBrowseNode) => Promise<boolean>;
  transferToUser: (source: LibraryTransferSourceReference, parent: LibraryBrowseNode) => Promise<boolean>;
  moveUserNode: (source: LibraryBrowseNode, destination: LibraryBrowseNode) => Promise<boolean>;
  transferToProject: (source: LibraryTransferSourceReference, target: LibraryExactTransferTarget, mode?: LibraryInsertionMode) => Promise<boolean>;
  applyTransfer: (mode?: LibraryInsertionMode) => Promise<boolean>;
  cancelTransfer: () => void;
  prepareDelete: (node: LibraryBrowseNode) => Promise<boolean>;
  confirmDelete: (decision: 'save' | 'discard') => Promise<boolean>;
  cancelDelete: () => void;
  applyMutation: (mutation: UserLibraryMutation) => Promise<boolean>;
  openEditor: (key: LibraryItemKey, pinned?: boolean) => Promise<void>;
  selectImportFiles: () => Promise<void>;
  selectImportDirectory: () => Promise<void>;
  executeImport: (folderSelections?: Readonly<Record<string, string>>) => Promise<void>;
  cancelImport: () => void;
  importInstrumentToFolder: (parent: LibraryBrowseNode) => Promise<boolean>;
  exportInstrument: (node: LibraryBrowseNode) => Promise<boolean>;
  exportCurrent: () => Promise<void>;
  exportAll: () => Promise<void>;
  retryRecovery: () => Promise<void>;
  restoreBackup: () => Promise<void>;
  createFreshDatabase: () => Promise<void>;
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribeChanged: (() => void) | null = null;
let refreshGeneration = 0;
let searchGeneration = 0;
const expandGenerations = new Map<string, number>();

async function browseAllChildren(
  parent: BrowseLibraryRequest['parent'],
): Promise<LibraryResult<BrowseLibraryResult>> {
  const children: LibraryBrowseNode[] = [];
  const seenNodeIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let contentRevision: number | undefined;
  let browseParent: LibraryBrowseNode | null = null;

  do {
    const result = await window.blueAPI.browseLibraries({
      parent,
      cursor,
      limit: 500,
      ...(contentRevision === undefined ? {} : { expectedContentRevision: contentRevision }),
    });
    if (!result.ok) return result;
    contentRevision ??= result.value.contentRevision;
    browseParent ??= result.value.parent;
    for (const child of result.value.children) {
      if (!seenNodeIds.has(child.nodeId)) {
        seenNodeIds.add(child.nodeId);
        children.push(child);
      }
    }
    const nextCursor = result.value.nextCursor ?? undefined;
    if (nextCursor && seenCursors.has(nextCursor)) {
      return {
        ok: false,
        error: {
          code: 'stale-cursor',
          message: 'Library browse returned a repeated cursor.',
          retryable: true,
        },
      };
    }
    if (nextCursor) seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);

  if (!browseParent || contentRevision === undefined) {
    return {
      ok: false,
      error: {
        code: 'storage-failure',
        message: 'Library browse returned no parent.',
        retryable: true,
      },
    };
  }
  return {
    ok: true,
    value: { contentRevision, parent: browseParent, children, nextCursor: null },
  };
}

function findUserNode(state: LibraryState, nodeId: string): LibraryBrowseNode | null {
  for (const root of Object.values(state.userRootsByType)) {
    if (root?.nodeId === nodeId) return root;
  }
  for (const children of Object.values(state.childrenByParent)) {
    const match = children.find((node) => node.nodeId === nodeId);
    if (match) return match;
  }
  return null;
}

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
      receiveSharedCopyBuffers(snapshot);
      set({
        snapshot,
        initialized: true,
        ...(snapshot.clipboard !== undefined ? { clipboard: snapshot.clipboard } : {}),
      });
      unsubscribeSnapshot?.();
      unsubscribeChanged?.();
      unsubscribeSnapshot = window.blueAPI.onLibraryServiceSnapshot((next) => {
        receiveSharedCopyBuffers(next);
        const projectChanged = get().snapshot?.projectSessionId !== next.projectSessionId;
        set({
          snapshot: next,
          ...(next.clipboard !== undefined ? { clipboard: next.clipboard } : {}),
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
    refreshGeneration += 1;
    searchGeneration += 1;
    expandGenerations.clear();
  },

  reset: () => {
    get().dispose();
    set(initialState());
  },

  refresh: async () => {
    const generation = ++refreshGeneration;
    const previous = get();
    const userResults = await Promise.all(LIBRARY_TYPES.map((libraryType) => (
      window.blueAPI.browseLibraries({ parent: { scope: 'user', libraryType }, limit: 1 })
    )));
    if (generation !== refreshGeneration) return;

    const nodesByType = { ...previous.nodesByType };
    const userRootsByType = { ...previous.userRootsByType };
    const errors: string[] = [];
    LIBRARY_TYPES.forEach((type, index) => {
      const result = userResults[index];
      if (!result?.ok) {
        errors.push(result?.error.message ?? `Unable to browse ${type} Libraries.`);
        return;
      }
      userRootsByType[type] = result.value.parent;
      if (!previous.childrenByParent[result.value.parent.nodeId]) nodesByType[type] = [];
    });

    set({ nodesByType, userRootsByType, error: errors.length > 0 ? errors.join(' ') : null });

    const loadedParents = Object.keys(previous.childrenByParent).map((nodeId) => {
      const refreshedRoot = Object.values(userRootsByType).find((node) => node?.nodeId === nodeId);
      return refreshedRoot ?? findUserNode(previous, nodeId);
    }).filter((node): node is LibraryBrowseNode => node !== null && node.scope === 'user');
    const loadedResults = await Promise.all(loadedParents.map(async (node) => ({
      node,
      result: await browseAllChildren({ scope: 'user', libraryType: node.libraryType, nodeId: node.nodeId }),
    })));
    if (generation !== refreshGeneration) return;
    set((state) => {
      const childrenByParent = { ...state.childrenByParent };
      const nextNodesByType = { ...state.nodesByType };
      const refreshErrors = [...errors];
      for (const { node, result } of loadedResults) {
        if (!result.ok) {
          if (result.error.code === 'not-found') {
            delete childrenByParent[node.nodeId];
            continue;
          }
          refreshErrors.push(result.error.message);
          continue;
        }
        const children = [...result.value.children];
        childrenByParent[node.nodeId] = children;
        if (node.nodeKind === 'root') nextNodesByType[node.libraryType] = children;
      }
      return {
        childrenByParent,
        nodesByType: nextNodesByType,
        error: refreshErrors.length > 0 ? refreshErrors.join(' ') : null,
      };
    });
    if (get().query.trim()) await get().runSearch(false);
  },

  setTypeFilter: (typeFilter) => {
    set({ typeFilter });
    searchGeneration += 1;
    if (get().query.trim()) void get().runSearch(false);
  },

  setQuery: (query) => {
    searchGeneration += 1;
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
    const generation = ++searchGeneration;
    const typeFilter = state.typeFilter;
    const result = await window.blueAPI.searchLibraries({
      query,
      typeFilter,
      projectSessionId: null,
      cursor,
      limit: 100,
    });
    if (
      generation !== searchGeneration
      || get().query.trim() !== query
      || get().typeFilter !== typeFilter
    ) return;
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
    if (node.scope !== 'user') return;
    const generation = (expandGenerations.get(node.nodeId) ?? 0) + 1;
    expandGenerations.set(node.nodeId, generation);
    const refreshAtStart = refreshGeneration;
    const result = await browseAllChildren({
      scope: 'user', libraryType: node.libraryType, nodeId: node.nodeId,
    });
    if (
      expandGenerations.get(node.nodeId) !== generation
      || refreshAtStart !== refreshGeneration
    ) return;
    if (!result.ok) {
      set({ error: result.error.message });
      return;
    }
    set((state) => {
      const children = [...result.value.children];
      return {
        childrenByParent: { ...state.childrenByParent, [node.nodeId]: children },
        ...(node.nodeKind === 'root'
          ? { nodesByType: { ...state.nodesByType, [node.libraryType]: children } }
          : {}),
        error: null,
      };
    });
  },

  selectItem: async (key) => {
    set({ selectedKey: key, error: null });
    await get().openEditor(key, false);
  },

  captureClipboard: async (node, operation) => {
    if (node.revision === undefined || node.nodeKind === 'root') return false;
    if (node.scope === 'user' && typeof node.revision !== 'number') return false;
    if (node.scope !== 'user' && (node.nodeKind !== 'item' || !node.key)) return false;
    const source: CapturableLibraryTransferSource = node.scope === 'user'
      ? {
          kind: 'userNode' as const,
          libraryType: node.libraryType,
          nodeId: node.nodeId,
          revision: node.revision as number,
        }
      : {
          kind: 'library' as const,
          key: node.key!,
          revision: node.revision,
        };
    if (operation === 'copy') {
      const clipboard: LibraryInteractionClipboard = {
        operation,
        source,
        capturedAt: Date.now(),
        objectType: node.objectType,
      };
      const previousClipboard = get().clipboard;
      set({
        clipboard,
        error: null,
      });
      const publishClipboard = window.blueAPI.setLibraryClipboard;
      if (typeof publishClipboard === 'function') {
        try {
          if (!await publishClipboard(clipboard)) {
            if (get().clipboard === clipboard) set({ clipboard: previousClipboard });
            return false;
          }
        } catch {
          if (get().clipboard === clipboard) set({ clipboard: previousClipboard });
          return false;
        }
      }
      return true;
    }

    let confirmationToken: string;
    if (source.kind === 'userNode') {
      const preview = await window.blueAPI.prepareLibraryMutation({
        type: 'deleteNode',
        nodeId: source.nodeId,
        expectedRevision: source.revision,
      });
      if (!preview.ok) {
        set({ error: preview.error.message });
        toast.error(preview.error.message);
        return false;
      }
      if (preview.value.dirtyEditorSessionIds.length > 0) {
        const message = 'Save or discard dirty Library Item editors before cutting this selection.';
        set({ error: message });
        toast.error(message);
        return false;
      }
      confirmationToken = preview.value.confirmationToken;
    } else {
      const preview = await window.blueAPI.previewProjectLibraryDelete(source.key);
      if (!preview.ok) {
        set({ error: preview.error.message });
        toast.error(preview.error.message);
        return false;
      }
      if (
        source.key.libraryType === 'soundObject'
        && preview.value.linkedInstanceCount > 0
        && !window.confirm(
          `Cut this SoundObject and remove its project definition plus ${preview.value.linkedInstanceCount} linked score instance${preview.value.linkedInstanceCount === 1 ? '' : 's'}?`,
        )
      ) return false;
      confirmationToken = preview.value.confirmationToken;
    }

    const result = await window.blueAPI.cutLibraryToClipboard({ source, confirmationToken });
    if (!result.ok) {
      set({ error: result.error.message });
      toast.error(result.error.message);
      return false;
    }
    for (const sessionId of result.value.closedEditorSessionIds) {
      useLibraryEditorStore.setState((state) => {
        const sessions = { ...state.sessions };
        delete sessions[sessionId];
        return { sessions };
      });
      useWorkbenchStore.getState().closePanel(libraryEditorPanelId(sessionId));
    }
    set({
      clipboard: result.value.clipboard,
      selectedKey: node.key && JSON.stringify(get().selectedKey) === JSON.stringify(node.key)
        ? null
        : get().selectedKey,
      error: null,
    });
    await get().refresh();
    toast.success(`${node.displayName} cut to the ${node.libraryType} buffer.`);
    return true;
  },

  captureScoreSoundObject: async (request) => {
    const result = await window.blueAPI.captureScoreSoundObjectClipboard(request);
    if (!result.ok) {
      set({ error: result.error.message });
      toast.error(result.error.message);
      return false;
    }
    set({ clipboard: result.value, error: null });
    return true;
  },

  captureTrackInstrument: async (request) => {
    const result = await window.blueAPI.captureTrackInstrumentClipboard(request);
    if (!result.ok) {
      set({ error: result.error.message });
      toast.error(result.error.message);
      return false;
    }
    set({ clipboard: result.value, error: null });
    return true;
  },

  captureBlueLiveSoundObject: async (request) => {
    const result = await window.blueAPI.captureBlueLiveSoundObjectClipboard(request);
    if (!result.ok) {
      set({ error: result.error.message });
      toast.error(result.error.message);
      return false;
    }
    set({ clipboard: result.value, error: null });
    return true;
  },

  addScoreSoundObjectToProjectLibrary: async (request) => {
    const result = await window.blueAPI.addScoreSoundObjectToProjectLibrary(request);
    if (!result.ok) {
      set({ error: result.error.message });
      toast.error(result.error.message);
      return false;
    }
    set({ error: null });
    toast.success(result.value.message);
    return true;
  },

  cancelClipboard: () => {
    set({ clipboard: null });
    void window.blueAPI.setLibraryClipboard(null);
  },

  pasteInto: async (destination) => {
    const clipboard = get().clipboard;
    if (!clipboard || destination.scope !== 'user') return false;
    let parent = destination;
    if (destination.nodeKind === 'item') {
      if (!destination.parentId) {
        set({ error: 'The destination folder is unavailable.' });
        return false;
      }
      parent = findUserNode(get(), destination.parentId) ?? destination;
      if (parent.nodeKind === 'item') {
        const parentResult = await browseAllChildren({
          scope: 'user', libraryType: destination.libraryType, nodeId: destination.parentId,
        });
        if (!parentResult.ok) {
          set({ error: parentResult.error.message });
          return false;
        }
        parent = parentResult.value.parent;
        const parentChildren = [...parentResult.value.children];
        set((state) => ({
          childrenByParent: { ...state.childrenByParent, [parent.nodeId]: parentChildren },
        }));
      }
    }
    if (getLibraryTransferSourceType(clipboard.source) !== parent.libraryType) {
      set({ error: 'Library items can only be pasted within the same library type.' });
      return false;
    }
    if (clipboard.source.kind === 'buffer') {
      const copied = await window.blueAPI.copyLibraryTransferToUser(
        { kind: 'clipboard', source: clipboard.source },
        parent.nodeId,
      );
      if (!copied.ok) {
        set({ error: copied.error.message });
        toast.error(copied.error.message);
        return false;
      }
      await get().refresh();
      toast.success('Clipboard contents pasted to User Libraries.');
      return true;
    }
    if (clipboard.source.kind === 'userNode') {
      const mutation: UserLibraryMutation = {
        type: 'duplicateNode',
        nodeId: clipboard.source.nodeId,
        expectedRevision: clipboard.source.revision,
        parentId: parent.nodeId,
        ...(typeof parent.revision === 'number' ? { expectedParentRevision: parent.revision } : {}),
      };
      const applied = await get().applyMutation(mutation);
      return applied;
    }
    const copied = await window.blueAPI.copyLibraryTransferToUser(
      { kind: 'clipboard', source: clipboard.source },
      parent.nodeId,
    );
    if (!copied.ok) {
      set({ error: copied.error.message });
      toast.error(copied.error.message);
      return false;
    }
    await get().refresh();
    toast.success('Item copied to User Libraries.');
    return true;
  },

  transferToUser: async (source, destination) => {
    if (destination.scope !== 'user') return false;
    const parent = destination.nodeKind === 'item' && destination.parentId
      ? findUserNode(get(), destination.parentId)
      : destination;
    if (!parent || parent.nodeKind === 'item') {
      set({ error: 'The destination folder is unavailable.' });
      return false;
    }
    const sourceType = source.kind === 'clipboard'
      ? getLibraryTransferSourceType(source.source)
      : null;
    if (sourceType && sourceType !== parent.libraryType) {
      set({ error: 'Library items can only be pasted within the same library type.' });
      return false;
    }
    const result = await window.blueAPI.copyLibraryTransferToUser(source, parent.nodeId);
    if (!result.ok) {
      set({ error: result.error.message });
      toast.error(result.error.message);
      return false;
    }
    set({ error: null });
    await get().refresh();
    toast.success('Item copied to User Libraries.');
    return true;
  },

  moveUserNode: async (source, destination) => {
    if (
      source.scope !== 'user'
      || destination.scope !== 'user'
      || source.nodeKind === 'root'
      || destination.nodeKind === 'item'
      || source.libraryType !== destination.libraryType
      || source.nodeId === destination.nodeId
      || typeof source.revision !== 'number'
    ) return false;
    const applied = await get().applyMutation({
      type: 'moveNode',
      nodeId: source.nodeId,
      expectedRevision: source.revision,
      parentId: destination.nodeId,
      ...(typeof destination.revision === 'number'
        ? { expectedParentRevision: destination.revision }
        : {}),
      targetIndex: get().childrenByParent[destination.nodeId]?.length ?? Number.MAX_SAFE_INTEGER,
    });
    if (applied) toast.success(`${source.displayName} moved to ${destination.displayName}.`);
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
    const selectedKey = get().selectedKey;
    set({
      deletePreview: null,
      clipboard: clipboard?.source.kind === 'userNode' && preview.affectedNodeIds.includes(clipboard.source.nodeId)
        ? null
        : clipboard,
      selectedKey: selectedKey?.scope === 'user' && preview.affectedNodeIds.includes(selectedKey.nodeId)
        ? null
        : selectedKey,
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
    const session = await editorStore.open(key, pinned);
    if (!session) {
      set({ error: useLibraryEditorStore.getState().error });
      return;
    }
    useWorkbenchStore.getState().openLibraryEditorPanel(session);
  },

  selectImportFiles: async () => {
    const result = await window.blueAPI.selectLibraryImportFiles();
    if (!result) return;
    if (!result.ok) return set({ error: result.error.message });
    set({ importPreview: result.value, importResult: null, error: null });
  },

  selectImportDirectory: async () => {
    const result = await window.blueAPI.selectLibraryImportDirectory();
    if (!result) return;
    if (!result.ok) return set({ error: result.error.message });
    if (result.value.sources.length === 0) {
      set({ error: 'No recognized Java Blue library files were found in that directory.' });
      return;
    }
    set({ importPreview: result.value, importResult: null, error: null });
  },

  executeImport: async (folderSelections = {}) => {
    const preview = get().importPreview;
    if (!preview) return;
    const result = await window.blueAPI.executeLibraryImport({
      previewToken: preview.previewToken,
      folderSelections,
    });
    if (!result.ok) return set({ error: result.error.message });
    set({ importPreview: null, importResult: result.value, error: null });
    await get().refresh();
  },

  cancelImport: () => set({ importPreview: null }),

  importInstrumentToFolder: async (parent) => {
    if (
      parent.scope !== 'user'
      || parent.libraryType !== 'instrument'
      || (parent.nodeKind !== 'root' && parent.nodeKind !== 'folder')
    ) return false;
    const result = await window.blueAPI.importLibraryInstrument(parent.nodeId);
    if (!result) return false;
    if (!result.ok) {
      set({ error: result.error.message });
      toast.error(result.error.message);
      return false;
    }
    set({ error: null });
    await get().refresh();
    const imported = result.value.affectedNodes[0];
    toast.success(imported ? `Imported ${imported.displayName}.` : 'Instrument imported.');
    return true;
  },

  exportInstrument: async (node) => {
    if (
      node.scope !== 'user'
      || node.libraryType !== 'instrument'
      || node.nodeKind !== 'item'
      || !node.key
      || node.key.scope !== 'user'
    ) return false;
    const result = await window.blueAPI.exportLibraryInstrument(node.key);
    if (!result) return false;
    if (!result.ok) {
      set({ error: result.error.message });
      toast.error(result.error.message);
      return false;
    }
    set({ error: null });
    toast.success(`Exported ${node.displayName}.`);
    return true;
  },

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
