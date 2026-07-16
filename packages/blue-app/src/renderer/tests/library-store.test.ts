// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BrowseLibraryRequest,
  LibraryBrowseNode,
  LibraryChangedEvent,
  LibraryServiceSnapshot,
  SearchLibrariesRequest,
} from '../../shared/unified-library';
import { useLibraryStore } from '../stores/library-store';
import { useLibraryEditorStore } from '../stores/library-editor-store';

const snapshot: LibraryServiceSnapshot = {
  phase: 'ready',
  contentRevision: 3,
  migrationState: 'never',
  userItemCounts: { instrument: 1, udo: 0, soundObject: 0, effect: 0 },
  projectSessionId: null,
  writable: true,
};

const item: LibraryBrowseNode = {
  key: { scope: 'user', libraryType: 'instrument', nodeId: 'item-1' },
  nodeId: 'item-1',
  parentId: 'root-instrument',
  libraryType: 'instrument',
  scope: 'user',
  nodeKind: 'item',
  displayName: 'Warm Pad',
  breadcrumb: ['Instruments', 'Warm Pad'],
  supportStatus: 'supported',
  objectType: 'GenericInstrument',
  revision: 1,
  hasChildren: false,
};

let snapshotListener: ((value: LibraryServiceSnapshot) => void) | null;
let changedListener: ((value: LibraryChangedEvent) => void) | null;
const browseLibraries = vi.fn(async (request: BrowseLibraryRequest) => ({
  ok: true as const,
  value: {
    contentRevision: 3,
    parent: { ...item, key: null, nodeId: `root-${request.parent.libraryType}`, nodeKind: 'root' as const },
    children: request.parent.libraryType === 'instrument' ? [item] : [],
    nextCursor: null,
  },
}));
const searchLibraries = vi.fn(async (request: SearchLibrariesRequest) => ({
  ok: true as const,
  value: {
    contentRevision: 3,
    normalizedQuery: request.query.toLowerCase(),
    results: request.query ? [{
      key: item.key!,
      libraryType: 'instrument' as const,
      scope: 'user' as const,
      displayName: item.displayName,
      breadcrumb: item.breadcrumb,
      supportStatus: 'supported' as const,
      objectType: item.objectType!,
      revision: item.revision,
    }] : [],
    nextCursor: request.cursor ? null : 'page-2',
  },
}));
const openLibraryItemEditor = vi.fn(async () => ({ ok: true as const, value: {
  sessionId: 'session-1',
  key: item.key!,
  displayName: item.displayName,
  objectType: item.objectType!,
  breadcrumb: item.breadcrumb,
  baseRevision: item.revision,
  document: { kind: 'unsupported' as const, libraryType: 'instrument' as const, objectType: item.objectType!, message: 'fixture', rawXml: '<instrument />' },
  dirty: false,
  pinned: false,
  status: 'ready' as const,
} }));

beforeEach(() => {
  vi.useFakeTimers();
  snapshotListener = null;
  changedListener = null;
  browseLibraries.mockClear();
  searchLibraries.mockClear();
  openLibraryItemEditor.mockClear();
  const applyLibraryMutation = vi.fn(async () => ({
    ok: true as const,
    value: { contentRevision: 4, affectedNodes: [] },
  }));
  window.blueAPI = {
    ...window.blueAPI,
    getLibraryServiceSnapshot: vi.fn(async () => snapshot),
    browseLibraries,
    searchLibraries,
    openLibraryItemEditor,
    onLibraryEditorSessionChanged: vi.fn(() => () => undefined),
    applyLibraryMutation,
    prepareLibraryMutation: vi.fn(async (request) => ({
      ok: true as const,
      value: {
        confirmationToken: 'delete-preview',
        nodeId: request.nodeId,
        expectedRevision: request.expectedRevision,
        affectedNodeIds: [request.nodeId, 'child-1'],
        affectedCount: 2,
        dirtyEditorSessionIds: [],
        expiresAt: Date.now() + 60_000,
      },
    })),
    onLibraryServiceSnapshot: vi.fn((listener) => {
      snapshotListener = listener;
      return () => { snapshotListener = null; };
    }),
    onLibraryChanged: vi.fn((listener) => {
      changedListener = listener;
      return () => { changedListener = null; };
    }),
  };
  useLibraryStore.getState().reset();
  useLibraryEditorStore.getState().reset();
});

describe('library store', () => {
  it('loads user roots without a project and applies source/type filters', async () => {
    await useLibraryStore.getState().initialize();
    expect(browseLibraries).toHaveBeenCalledTimes(4);
    expect(useLibraryStore.getState().projectAvailable).toBe(false);
    expect(useLibraryStore.getState().nodesByType.instrument).toEqual([item]);

    useLibraryStore.getState().setTypeFilter('instrument');
    useLibraryStore.getState().setSourceFilter('user');
    expect(useLibraryStore.getState()).toMatchObject({
      typeFilter: 'instrument',
      sourceFilter: 'user',
    });
  });

  it('debounces search, appends pagination, and opens a reusable editor on selection', async () => {
    await useLibraryStore.getState().initialize();
    useLibraryStore.getState().setQuery('Pad');
    expect(searchLibraries).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(160);
    expect(searchLibraries).toHaveBeenCalledTimes(1);
    expect(useLibraryStore.getState().searchResults[0]?.displayName).toBe('Warm Pad');

    await useLibraryStore.getState().loadMoreSearchResults();
    expect(searchLibraries).toHaveBeenCalledTimes(2);

    await useLibraryStore.getState().selectItem(item.key!);
    await useLibraryStore.getState().selectItem(item.key!);
    expect(openLibraryItemEditor).toHaveBeenCalledTimes(2);
    expect(useLibraryStore.getState().selectedKey).toEqual(item.key);
  });

  it('refreshes on change events and updates no-project state from snapshots', async () => {
    await useLibraryStore.getState().initialize();
    changedListener?.({
      contentRevision: 4,
      cause: 'mutation',
      requiresFullRefresh: true,
    });
    await vi.runAllTimersAsync();
    expect(browseLibraries.mock.calls.length).toBeGreaterThan(4);

    snapshotListener?.({ ...snapshot, projectSessionId: 9 });
    expect(useLibraryStore.getState().projectAvailable).toBe(true);
  });

  it('captures revision-bound copy/cut state and cancels without persistent target state', async () => {
    const state = useLibraryStore.getState();
    state.captureClipboard(item, 'copy');
    expect(useLibraryStore.getState().clipboard).toEqual({
      operation: 'copy',
      source: { kind: 'userNode', libraryType: 'instrument', nodeId: 'item-1', revision: 1 },
      capturedAt: expect.any(Number),
    });
    state.captureClipboard(item, 'cut');
    expect(useLibraryStore.getState().clipboard?.operation).toBe('cut');
    state.cancelClipboard();
    expect(useLibraryStore.getState().clipboard).toBeNull();
    expect('context' in useLibraryStore.getState()).toBe(false);
  });

  it('resolves destination Paste from the captured source and retains stale sources on failure', async () => {
    await useLibraryStore.getState().initialize();
    useLibraryStore.getState().captureClipboard(item, 'copy');
    const parent: LibraryBrowseNode = {
      ...item,
      key: null,
      nodeId: 'target-folder',
      nodeKind: 'folder',
      displayName: 'Target',
      revision: 2,
      hasChildren: true,
    };
    expect(await useLibraryStore.getState().pasteInto(parent)).toBe(true);
    expect(window.blueAPI.applyLibraryMutation).toHaveBeenCalledWith({
      type: 'duplicateNode',
      nodeId: 'item-1',
      expectedRevision: 1,
      parentId: 'target-folder',
      expectedParentRevision: 2,
    });
    expect(useLibraryStore.getState().clipboard?.operation).toBe('copy');

    vi.mocked(window.blueAPI.applyLibraryMutation).mockResolvedValueOnce({
      ok: false,
      error: { code: 'stale-revision', message: 'Source changed', retryable: true },
    });
    expect(await useLibraryStore.getState().pasteInto(parent)).toBe(false);
    expect(useLibraryStore.getState().clipboard).not.toBeNull();
  });

  it('previews affected delete counts and clears a clipboard source inside the deleted subtree', async () => {
    await useLibraryStore.getState().initialize();
    useLibraryStore.setState({
      clipboard: {
        operation: 'copy',
        source: { kind: 'userNode', libraryType: 'instrument', nodeId: 'child-1', revision: 1 },
        capturedAt: 1,
      },
    });
    expect(await useLibraryStore.getState().prepareDelete(item)).toBe(true);
    expect(useLibraryStore.getState().deletePreview).toMatchObject({ affectedCount: 2 });
    expect(await useLibraryStore.getState().confirmDelete('discard')).toBe(true);
    expect(window.blueAPI.applyLibraryMutation).toHaveBeenCalledWith({
      type: 'deleteNode', nodeId: 'item-1', expectedRevision: 1, confirmation: 'delete-preview',
    });
    expect(useLibraryStore.getState().clipboard).toBeNull();
    expect(useLibraryStore.getState().deletePreview).toBeNull();
  });
});
