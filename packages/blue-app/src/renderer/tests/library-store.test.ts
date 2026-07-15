// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BrowseLibraryRequest,
  LibraryBrowseNode,
  LibraryChangedEvent,
  LibraryItemPreview,
  LibraryServiceSnapshot,
  SearchLibrariesRequest,
} from '../../shared/unified-library';
import { useLibraryStore } from '../stores/library-store';

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
const preview: LibraryItemPreview = {
  key: item.key!,
  displayName: item.displayName,
  libraryType: 'instrument',
  scope: 'user',
  objectType: item.objectType!,
  supportStatus: 'supported',
  supportMessage: null,
  fields: { comment: { state: 'unavailable', reason: 'Not provided' } },
  dependencies: { itemOwned: [], unresolvedExternal: [] },
};
const getLibraryItemPreview = vi.fn(async () => ({ ok: true as const, value: preview }));

beforeEach(() => {
  vi.useFakeTimers();
  snapshotListener = null;
  changedListener = null;
  browseLibraries.mockClear();
  searchLibraries.mockClear();
  getLibraryItemPreview.mockClear();
  window.blueAPI = {
    ...window.blueAPI,
    getLibraryServiceSnapshot: vi.fn(async () => snapshot),
    browseLibraries,
    searchLibraries,
    getLibraryItemPreview,
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

  it('debounces search, appends pagination, selects items, and caches previews', async () => {
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
    expect(getLibraryItemPreview).toHaveBeenCalledTimes(1);
    expect(useLibraryStore.getState().selectedPreview).toEqual(preview);
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
});
