// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BrowseLibraryRequest,
  CapturableLibraryTransferSource,
  LibraryBrowseNode,
  LibraryChangedEvent,
  LibraryServiceSnapshot,
  SearchLibrariesRequest,
} from '../../shared/unified-library';
import { getLibraryTransferSourceType } from '../../shared/unified-library';
import { useLibraryStore } from '../stores/library-store';
import { useLibraryEditorStore } from '../stores/library-editor-store';
import { useBsbClipboardStore } from '../stores/bsb-clipboard-store';

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
const defaultBrowseLibraries = async (request: BrowseLibraryRequest) => ({
  ok: true as const,
  value: {
    contentRevision: 3,
    parent: {
      ...item,
      key: null,
      nodeId: `root-${request.parent.libraryType}`,
      libraryType: request.parent.libraryType,
      scope: request.parent.scope,
      nodeKind: 'root' as const,
      hasChildren: request.parent.libraryType === 'instrument',
    },
    children: request.parent.libraryType === 'instrument' ? [item] : [],
    nextCursor: null,
  },
});
const browseLibraries = vi.fn(defaultBrowseLibraries);
const defaultSearchLibraries = async (request: SearchLibrariesRequest) => ({
  ok: true as const,
  value: {
    contentRevision: 3,
    normalizedQuery: request.query.toLowerCase(),
    results: request.query ? [{
      key: item.key!,
      parentId: item.parentId,
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
});
const searchLibraries = vi.fn(defaultSearchLibraries);
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
const previewLibraryTransfer = vi.fn(async () => ({
  ok: true as const,
  value: {
    previewToken: 'transfer-preview',
    item: {
      key: item.key!,
      displayName: item.displayName,
      libraryType: 'instrument' as const,
      scope: 'user' as const,
      objectType: item.objectType!,
      supportStatus: 'supported' as const,
      supportMessage: null,
      fields: {},
      dependencies: { itemOwned: [], unresolvedExternal: [] },
    },
    target: {
      kind: 'orchestra' as const,
      projectSessionId: 7,
      projectRevision: 2,
      insertIndex: 0,
    },
    requestedMode: 'independent' as const,
    allowedModes: ['independent'] as const,
    canApply: true,
    blockingReasons: [],
  },
}));
const applyLibraryTransfer = vi.fn(async () => ({
  ok: true as const,
  value: {
    projectSessionId: 7,
    projectRevision: 3,
    libraryType: 'instrument' as const,
    insertedIdentity: 'instrument-2',
    message: 'Instrument added.',
  },
}));
const copyLibraryTransferToUser = vi.fn(async () => ({
  ok: true as const,
  value: { contentRevision: 4, affectedNodes: [] },
}));
const cutLibraryToClipboard = vi.fn(async (request: {
  readonly source: CapturableLibraryTransferSource;
  readonly confirmationToken: string;
}) => ({
  ok: true as const,
  value: {
    clipboard: {
      operation: 'cut' as const,
      source: {
        kind: 'buffer' as const,
        clipboardId: `buffer-${getLibraryTransferSourceType(request.source)}`,
        libraryType: getLibraryTransferSourceType(request.source),
      },
      capturedAt: 100,
    },
    closedEditorSessionIds: [],
  },
}));
const previewProjectLibraryDelete = vi.fn(async () => ({
  ok: true as const,
  value: {
    confirmationToken: 'project-delete', linkedInstanceCount: 0, locations: [], requiresConfirmation: true,
  },
}));
const deleteProjectLibraryItem = vi.fn(async () => ({
  ok: true as const,
  value: {
    projectSessionId: 7, projectRevision: 4, libraryType: 'udo' as const,
    insertedIdentity: 'udo:501', message: 'Removed.',
  },
}));
const setLibraryClipboard = vi.fn(async () => true);
const setBsbClipboard = vi.fn(async () => true);

beforeEach(() => {
  vi.useFakeTimers();
  snapshotListener = null;
  changedListener = null;
  browseLibraries.mockReset().mockImplementation(defaultBrowseLibraries);
  searchLibraries.mockReset().mockImplementation(defaultSearchLibraries);
  openLibraryItemEditor.mockClear();
  previewLibraryTransfer.mockClear();
  applyLibraryTransfer.mockClear();
  copyLibraryTransferToUser.mockClear();
  cutLibraryToClipboard.mockClear();
  previewProjectLibraryDelete.mockClear();
  deleteProjectLibraryItem.mockClear();
  setLibraryClipboard.mockClear();
  setBsbClipboard.mockClear();
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
    previewLibraryTransfer,
    applyLibraryTransfer,
    copyLibraryTransferToUser,
    cutLibraryToClipboard,
    setLibraryClipboard,
    setBsbClipboard,
    previewProjectLibraryDelete,
    deleteProjectLibraryItem,
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
  useBsbClipboardStore.getState().receiveClipboard(null);
});

describe('library store', () => {
  it('hydrates and follows the main-owned clipboard shared by renderer windows', async () => {
    const clipboard = {
      operation: 'copy' as const,
      source: {
        kind: 'userNode' as const,
        libraryType: 'udo' as const,
        nodeId: 'shared-udo',
        revision: 1,
      },
      capturedAt: 10,
    };
    window.blueAPI.getLibraryServiceSnapshot = vi.fn(async () => ({ ...snapshot, clipboard }));
    await useLibraryStore.getState().initialize();
    expect(useLibraryStore.getState().clipboard).toEqual(clipboard);

    snapshotListener?.({ ...snapshot, clipboard: null });
    expect(useLibraryStore.getState().clipboard).toBeNull();
  });

  it('hydrates, publishes, and follows the separate cross-window BSB buffer', async () => {
    const bsbClipboard = {
      originX: 10,
      originY: 20,
      widgets: [{
        id: 'slider-1', type: 'BSBHSlider', objectName: 'amp',
        x: 10, y: 20, width: 120, height: 24,
        value: 0.5, minimum: 0, maximum: 1, editable: true,
        properties: {},
      }],
    };
    window.blueAPI.getLibraryServiceSnapshot = vi.fn(async () => ({
      ...snapshot,
      bsbClipboard,
    }));
    await useLibraryStore.getState().initialize();
    expect(useBsbClipboardStore.getState().clipboard).toEqual(bsbClipboard);

    useBsbClipboardStore.getState().setClipboard({
      ...bsbClipboard,
      originX: 30,
    });
    expect(setBsbClipboard).toHaveBeenCalledWith(expect.objectContaining({ originX: 30 }));

    snapshotListener?.({ ...snapshot, bsbClipboard: null });
    expect(useBsbClipboardStore.getState().clipboard).toBeNull();
  });

  it('retains pinned or dirty sessions while pruning a replaced clean preview', async () => {
    const cleanPreview = await useLibraryEditorStore.getState().open(item.key!);
    expect(cleanPreview?.sessionId).toBe('session-1');

    useLibraryEditorStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        pinned: { ...cleanPreview!, sessionId: 'pinned', pinned: true },
        dirty: { ...cleanPreview!, sessionId: 'dirty', dirty: true, pinned: true },
      },
    }));
    openLibraryItemEditor.mockResolvedValueOnce({
      ok: true,
      value: { ...cleanPreview!, sessionId: 'session-2' },
    });

    await useLibraryEditorStore.getState().open({
      scope: 'user', libraryType: 'instrument', nodeId: 'item-2',
    });

    expect(Object.keys(useLibraryEditorStore.getState().sessions).sort())
      .toEqual(['dirty', 'pinned', 'session-2']);
  });

  it('loads only user roots without a project and applies the type filter', async () => {
    await useLibraryStore.getState().initialize();
    expect(browseLibraries).toHaveBeenCalledTimes(4);
    expect(useLibraryStore.getState().userRootsByType.instrument?.nodeKind).toBe('root');
    expect(useLibraryStore.getState().nodesByType.instrument).toEqual([]);

    useLibraryStore.getState().setTypeFilter('instrument');
    expect(useLibraryStore.getState()).toMatchObject({
      typeFilter: 'instrument',
    });
  });

  it('drains every browse page in order when a folder is expanded', async () => {
    await useLibraryStore.getState().initialize();
    const root = useLibraryStore.getState().userRootsByType.instrument!;
    const children = Array.from({ length: 1_205 }, (_, index) => ({
      ...item,
      key: { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: `item-${index}` },
      nodeId: `item-${index}`,
      displayName: `Item ${index}`,
    }));
    browseLibraries.mockImplementation(async (request) => {
      if (request.parent.nodeId !== root.nodeId) {
        return {
          ok: true as const,
          value: { contentRevision: 3, parent: root, children: [], nextCursor: null },
        };
      }
      const offset = request.cursor ? Number(request.cursor.slice('page-'.length)) : 0;
      const page = children.slice(offset, offset + 500);
      const nextOffset = offset + page.length;
      return {
        ok: true as const,
        value: {
          contentRevision: 3,
          parent: root,
          children: page,
          nextCursor: nextOffset < children.length ? `page-${nextOffset}` : null,
        },
      };
    });

    await useLibraryStore.getState().expandNode(root);

    expect(useLibraryStore.getState().nodesByType.instrument).toHaveLength(1_205);
    expect(useLibraryStore.getState().nodesByType.instrument.at(-1)?.nodeId).toBe('item-1204');
    expect(browseLibraries).toHaveBeenCalledTimes(7);
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

  it('ignores a slower search response after the query changes', async () => {
    await useLibraryStore.getState().initialize();
    let releaseOld: (() => void) | undefined;
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
    searchLibraries.mockImplementation(async (request) => {
      if (request.query === 'Old') await oldGate;
      return { ok: true as const, value: {
        contentRevision: 3,
        normalizedQuery: request.query.toLowerCase(),
        results: [{
          key: item.key!,
          parentId: item.parentId,
          libraryType: 'instrument' as const,
          scope: 'user' as const,
          displayName: request.query,
          breadcrumb: item.breadcrumb,
          supportStatus: 'supported' as const,
          objectType: item.objectType!,
          revision: item.revision,
        }],
        nextCursor: null,
      } };
    });
    useLibraryStore.getState().setQuery('Old');
    await vi.advanceTimersByTimeAsync(160);
    useLibraryStore.getState().setQuery('New');
    await vi.advanceTimersByTimeAsync(160);
    expect(useLibraryStore.getState().searchResults[0]?.displayName).toBe('New');
    releaseOld?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(useLibraryStore.getState().searchResults[0]?.displayName).toBe('New');
  });

  it('refreshes on library and project snapshot changes', async () => {
    await useLibraryStore.getState().initialize();
    changedListener?.({
      contentRevision: 4,
      cause: 'mutation',
      requiresFullRefresh: true,
    });
    await vi.runAllTimersAsync();
    expect(browseLibraries.mock.calls.length).toBeGreaterThan(4);

    snapshotListener?.({ ...snapshot, projectSessionId: 9 });
    expect(useLibraryStore.getState().snapshot?.projectSessionId).toBe(9);
  });

  it('keeps Copy revision-bound but replaces Cut with a detached reusable buffer', async () => {
    const state = useLibraryStore.getState();
    await state.captureClipboard(item, 'copy');
    expect(useLibraryStore.getState().clipboard).toEqual({
      operation: 'copy',
      source: { kind: 'userNode', libraryType: 'instrument', nodeId: 'item-1', revision: 1 },
      capturedAt: expect.any(Number),
      objectType: 'GenericInstrument',
    });
    await state.captureClipboard(item, 'cut');
    expect(cutLibraryToClipboard).toHaveBeenCalledWith({
      source: { kind: 'userNode', libraryType: 'instrument', nodeId: 'item-1', revision: 1 },
      confirmationToken: 'delete-preview',
    });
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'cut',
      source: { kind: 'buffer', clipboardId: 'buffer-instrument', libraryType: 'instrument' },
    });
    state.cancelClipboard();
    expect(useLibraryStore.getState().clipboard).toBeNull();
    expect('context' in useLibraryStore.getState()).toBe(false);
  });

  it('captures user folders and resolves Paste on an item to its parent', async () => {
    await useLibraryStore.getState().initialize();
    const root = useLibraryStore.getState().userRootsByType.instrument!;
    const folder: LibraryBrowseNode = {
      ...item,
      key: null,
      nodeId: 'folder-1',
      parentId: root.nodeId,
      nodeKind: 'folder',
      displayName: 'Folder',
      objectType: undefined,
      supportStatus: undefined,
      hasChildren: true,
    };
    await useLibraryStore.getState().captureClipboard(folder, 'cut');
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'cut',
      source: { kind: 'buffer', clipboardId: 'buffer-instrument', libraryType: 'instrument' },
    });

    useLibraryStore.setState({
      childrenByParent: { [root.nodeId]: [item, folder] },
      nodesByType: { ...useLibraryStore.getState().nodesByType, instrument: [item, folder] },
    });
    await useLibraryStore.getState().captureClipboard(item, 'copy');
    expect(await useLibraryStore.getState().pasteInto(item)).toBe(true);
    expect(window.blueAPI.applyLibraryMutation).toHaveBeenLastCalledWith({
      type: 'duplicateNode',
      nodeId: 'item-1',
      expectedRevision: 1,
      parentId: root.nodeId,
      expectedParentRevision: root.revision,
    });
  });

  it('moves a user node into a compatible unloaded folder at the end', async () => {
    await useLibraryStore.getState().initialize();
    const root = useLibraryStore.getState().userRootsByType.instrument!;
    const source: LibraryBrowseNode = {
      ...item,
      key: null,
      nodeId: 'source-folder',
      parentId: root.nodeId,
      nodeKind: 'folder',
      displayName: 'Source',
      objectType: undefined,
      supportStatus: undefined,
      hasChildren: false,
    };
    const destination: LibraryBrowseNode = {
      ...source,
      nodeId: 'destination-folder',
      displayName: 'Destination',
      revision: 3,
    };

    expect(await useLibraryStore.getState().moveUserNode(source, destination)).toBe(true);
    expect(window.blueAPI.applyLibraryMutation).toHaveBeenCalledWith({
      type: 'moveNode',
      nodeId: 'source-folder',
      expectedRevision: 1,
      parentId: 'destination-folder',
      expectedParentRevision: 3,
      targetIndex: Number.MAX_SAFE_INTEGER,
    });
  });

  it('moves a project UDO through the same Cut buffer used by the user library', async () => {
    const projectUdo: LibraryBrowseNode = {
      key: {
        scope: 'projectOwned',
        libraryType: 'udo',
        projectSessionId: 7,
        locator: {
          kind: 'udo',
          sessionObjectId: 'udo:501',
          persistedFingerprint: { canonicalHash: 'hash-501', opcodeName: 'udo501', style: 'CLASSIC' },
        },
      },
      nodeId: 'project-udo-501',
      parentId: null,
      libraryType: 'udo',
      scope: 'projectOwned',
      nodeKind: 'item',
      displayName: 'udo501',
      breadcrumb: ['Project UDOs'],
      supportStatus: 'supported',
      objectType: 'blue.udo.UserDefinedOpcode',
      revision: 'hash-501',
      hasChildren: false,
    };
    await useLibraryStore.getState().initialize();
    await useLibraryStore.getState().captureClipboard(projectUdo, 'cut');
    const userRoot = useLibraryStore.getState().userRootsByType.udo!;

    const pasted = await useLibraryStore.getState().pasteInto(userRoot);
    expect({
      pasted,
      error: useLibraryStore.getState().error,
      clipboard: useLibraryStore.getState().clipboard,
      userRootType: userRoot.libraryType,
    }).toMatchObject({
      pasted: true,
      error: null,
      clipboard: { operation: 'cut', source: { kind: 'buffer', libraryType: 'udo' } },
      userRootType: 'udo',
    });
    expect(copyLibraryTransferToUser).toHaveBeenCalledWith(
      { kind: 'clipboard', source: { kind: 'buffer', clipboardId: 'buffer-udo', libraryType: 'udo' } },
      'root-udo',
    );
    expect(previewProjectLibraryDelete).toHaveBeenCalledWith(projectUdo.key);
    expect(cutLibraryToClipboard).toHaveBeenCalledWith({
      source: { kind: 'library', key: projectUdo.key, revision: 'hash-501' },
      confirmationToken: 'project-delete',
    });
    expect(useLibraryStore.getState().clipboard?.source.kind).toBe('buffer');
  });

  it('moves a user item into a project panel through the same Cut buffer', async () => {
    await useLibraryStore.getState().captureClipboard(item, 'cut');

    expect(await useLibraryStore.getState().transferToProject(
      { kind: 'clipboard', source: useLibraryStore.getState().clipboard!.source },
      { kind: 'orchestra', projectSessionId: 7, projectRevision: 2, insertIndex: 0 },
    )).toBe(true);

    expect(window.blueAPI.prepareLibraryMutation).toHaveBeenCalledWith({
      type: 'deleteNode', nodeId: 'item-1', expectedRevision: 1,
    });
    expect(cutLibraryToClipboard).toHaveBeenCalledWith({
      source: { kind: 'userNode', libraryType: 'instrument', nodeId: 'item-1', revision: 1 },
      confirmationToken: 'delete-preview',
    });
    expect(previewLibraryTransfer).toHaveBeenCalledWith({
      source: {
        kind: 'clipboard',
        source: { kind: 'buffer', clipboardId: 'buffer-instrument', libraryType: 'instrument' },
      },
      target: { kind: 'orchestra', projectSessionId: 7, projectRevision: 2, insertIndex: 0 },
      mode: 'independent',
    });
    expect(useLibraryStore.getState().clipboard?.source.kind).toBe('buffer');
  });

  it('does not remove a shared SoundObject when its Cut consequence is declined', async () => {
    const projectSoundObject: LibraryBrowseNode = {
      key: {
        scope: 'projectShared', libraryType: 'soundObject', projectSessionId: 7,
        locator: {
          kind: 'soundObject', libraryId: 'shared-1',
          persistedFingerprint: { canonicalHash: 'hash', displayName: 'Shared', objectType: 'GenericScore' },
        },
      },
      nodeId: 'project-sound-shared-1', parentId: null, libraryType: 'soundObject',
      scope: 'projectShared', nodeKind: 'item', displayName: 'Shared', breadcrumb: ['Project SoundObjects'],
      supportStatus: 'supported', objectType: 'GenericScore', revision: 'hash', hasChildren: false,
    };
    previewProjectLibraryDelete.mockResolvedValueOnce({
      ok: true,
      value: { confirmationToken: 'linked-delete', linkedInstanceCount: 2, locations: ['Score'], requiresConfirmation: true },
    });
    const confirm = vi.fn(() => false);
    window.confirm = confirm;
    expect(await useLibraryStore.getState().captureClipboard(projectSoundObject, 'cut')).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(cutLibraryToClipboard).not.toHaveBeenCalled();
    expect(copyLibraryTransferToUser).not.toHaveBeenCalled();
    expect(deleteProjectLibraryItem).not.toHaveBeenCalled();
    expect(useLibraryStore.getState().clipboard).toBeNull();
  });

  it('pastes a detached project Effect Cut buffer into another project chain', async () => {
    const projectEffect: LibraryBrowseNode = {
      key: {
        scope: 'projectOwned', libraryType: 'effect', projectSessionId: 7,
        locator: { kind: 'effect', channelId: 'channel-1', chain: 'pre', entryId: 'effect-1' },
      },
      nodeId: 'project-effect-1', parentId: null, libraryType: 'effect', scope: 'projectOwned',
      nodeKind: 'item', displayName: 'Delay', breadcrumb: ['Channel 1', 'Pre Effects'],
      supportStatus: 'supported', objectType: 'Effect', revision: 'effect-hash', hasChildren: false,
    };
    await useLibraryStore.getState().captureClipboard(projectEffect, 'cut');
    const source = { kind: 'clipboard' as const, source: useLibraryStore.getState().clipboard!.source };

    expect(await useLibraryStore.getState().transferToProject(source, {
      kind: 'effectChain', projectSessionId: 7, projectRevision: 2,
      channelId: 'channel-2', chain: 'post', insertIndex: 0, chainRevision: '',
    })).toBe(true);

    expect(previewLibraryTransfer).toHaveBeenCalledWith({
      source: {
        kind: 'clipboard',
        source: { kind: 'buffer', clipboardId: 'buffer-effect', libraryType: 'effect' },
      },
      target: {
        kind: 'effectChain', projectSessionId: 7, projectRevision: 2,
        channelId: 'channel-2', chain: 'post', insertIndex: 0, chainRevision: '',
      },
      mode: 'independent',
    });
    expect(useLibraryStore.getState().clipboard).toMatchObject({
      operation: 'cut', source: { kind: 'buffer', libraryType: 'effect' },
    });
  });

  it('resolves destination Paste from the captured source and retains stale sources on failure', async () => {
    await useLibraryStore.getState().initialize();
    await useLibraryStore.getState().captureClipboard(item, 'copy');
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
      selectedKey: { scope: 'user', libraryType: 'instrument', nodeId: 'child-1' },
    });
    expect(await useLibraryStore.getState().prepareDelete(item)).toBe(true);
    expect(useLibraryStore.getState().deletePreview).toMatchObject({ affectedCount: 2 });
    expect(await useLibraryStore.getState().confirmDelete('discard')).toBe(true);
    expect(window.blueAPI.applyLibraryMutation).toHaveBeenCalledWith({
      type: 'deleteNode', nodeId: 'item-1', expectedRevision: 1, confirmation: 'delete-preview',
    });
    expect(useLibraryStore.getState().clipboard).toBeNull();
    expect(useLibraryStore.getState().selectedKey).toBeNull();
    expect(useLibraryStore.getState().deletePreview).toBeNull();
  });

  it('prunes an expanded folder after deletion without reporting its expected missing-node response', async () => {
    await useLibraryStore.getState().initialize();
    const root = useLibraryStore.getState().userRootsByType.udo!;
    const folder: LibraryBrowseNode = {
      ...root,
      nodeId: 'deleted-folder',
      parentId: root.nodeId,
      nodeKind: 'folder',
      displayName: 'Temporary',
      breadcrumb: ['UDOs', 'Temporary'],
      revision: 2,
      hasChildren: true,
    };
    useLibraryStore.setState((state) => ({
      childrenByParent: {
        ...state.childrenByParent,
        [root.nodeId]: [folder],
        [folder.nodeId]: [{ ...item, libraryType: 'udo', parentId: folder.nodeId }],
      },
      nodesByType: { ...state.nodesByType, udo: [folder] },
    }));
    browseLibraries.mockImplementation(async (request) => {
      if ('nodeId' in request.parent && request.parent.nodeId === folder.nodeId) {
        return {
          ok: false as const,
          error: {
            code: 'not-found' as const,
            message: `Library node not found: ${folder.nodeId}`,
            retryable: false,
          },
        };
      }
      return defaultBrowseLibraries(request);
    });

    await useLibraryStore.getState().refresh();

    expect(useLibraryStore.getState().error).toBeNull();
    expect(useLibraryStore.getState().childrenByParent[folder.nodeId]).toBeUndefined();
    expect(useLibraryStore.getState().nodesByType.udo).not.toContainEqual(folder);
  });

  it('applies a one-mode project transfer without ever publishing modal state', async () => {
    const publishedPreviews: unknown[] = [];
    const unsubscribe = useLibraryStore.subscribe((state) => {
      if (state.transferPreview) publishedPreviews.push(state.transferPreview);
    });

    const applied = await useLibraryStore.getState().transferToProject(
      { kind: 'clipboard', source: { kind: 'userNode', libraryType: 'instrument', nodeId: 'item-1', revision: 1 } },
      { kind: 'orchestra', projectSessionId: 7, projectRevision: 2, insertIndex: 0 },
    );

    unsubscribe();
    expect(applied).toBe(true);
    expect(publishedPreviews).toEqual([]);
    expect(applyLibraryTransfer).toHaveBeenCalledWith('transfer-preview');
  });

  it('publishes modal state only when a shared SoundObject has a real copy choice', async () => {
    previewLibraryTransfer.mockResolvedValueOnce({
      ok: true,
      value: {
        ...(await previewLibraryTransfer()).value,
        item: {
          ...(await previewLibraryTransfer()).value.item,
          key: {
            scope: 'projectShared' as const,
            libraryType: 'soundObject' as const,
            projectSessionId: 7,
            locator: {
              kind: 'soundObject' as const,
              libraryId: 'shared-1',
              persistedFingerprint: { canonicalHash: 'hash', displayName: 'Shared', objectType: 'GenericScore' },
            },
          },
          libraryType: 'soundObject' as const,
          scope: 'projectShared' as const,
        },
        target: {
          kind: 'score' as const,
          projectSessionId: 7,
          projectRevision: 2,
          location: { rootGroupId: 'root', containerPath: [], layerId: 'layer-1', startTime: 0 },
          timeContextRevision: '2',
        },
        allowedModes: ['independent', 'sharedInstance'] as const,
      },
    });

    const applied = await useLibraryStore.getState().transferToProject(
      {
        kind: 'clipboard',
        source: {
          kind: 'library',
          key: {
            scope: 'projectShared',
            libraryType: 'soundObject',
            projectSessionId: 7,
            locator: {
              kind: 'soundObject',
              libraryId: 'shared-1',
              persistedFingerprint: { canonicalHash: 'hash', displayName: 'Shared', objectType: 'GenericScore' },
            },
          },
          revision: 'hash',
        },
      },
      {
        kind: 'score',
        projectSessionId: 7,
        projectRevision: 2,
        location: { rootGroupId: 'root', containerPath: [], layerId: 'layer-1', startTime: 0 },
        timeContextRevision: '2',
      },
    );

    expect(applied).toBe(true);
    expect(useLibraryStore.getState().transferPreview?.allowedModes).toEqual(['independent', 'sharedInstance']);
    expect(applyLibraryTransfer).not.toHaveBeenCalled();
  });
});
