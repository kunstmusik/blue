import { describe, expect, it } from 'vitest';
import {
  createLibraryCursor,
  createLibraryServiceError,
  getAvailableNumericArrangementId,
  isCutLibraryToClipboardRequest,
  isBrowseLibraryRequest,
  getLibraryTransferSourceType,
  isBeginLibraryDragRequest,
  isLibraryContextRequest,
  isLibraryDragDescriptor,
  isLibraryExactTransferTarget,
  isLibraryInteractionClipboard,
  isLibraryItemKey,
  isLibraryServicePhase,
  isLibraryTransferPreviewRequest,
  isLibraryType,
  isSearchLibrariesRequest,
  isScoreTimelineSoundObjectRequest,
  parseLibraryCursor,
} from './unified-library';

describe('Unified Library shared contracts', () => {
  it('guards stable library types and service phases', () => {
    expect(['instrument', 'udo', 'soundObject', 'effect'].every(isLibraryType)).toBe(true);
    expect(isLibraryType('all')).toBe(false);
    expect(isLibraryServicePhase('readOnlyFailure')).toBe(true);
    expect(isLibraryServicePhase('broken')).toBe(false);
  });

  it('guards user and project item keys without accepting arbitrary shapes', () => {
    expect(
      isLibraryItemKey({ scope: 'user', libraryType: 'effect', nodeId: 'node-1' }),
    ).toBe(true);
    expect(
      isLibraryItemKey({
        scope: 'projectOwned',
        libraryType: 'instrument',
        projectSessionId: 3,
        locator: { kind: 'instrument', assignmentId: '1' },
      }),
    ).toBe(true);
    expect(isLibraryItemKey({
      scope: 'projectOwned',
      libraryType: 'effect',
      projectSessionId: 3,
      locator: { kind: 'effect', channelId: 'channel-1', chain: 'pre', entryId: 'effect-1' },
    })).toBe(true);
    expect(isLibraryItemKey({ scope: 'user', libraryType: 'effect' })).toBe(false);
    expect(isLibraryItemKey({
      scope: 'projectOwned',
      libraryType: 'udo',
      projectSessionId: 3,
      locator: {
        kind: 'udo',
        instrumentAssignmentId: '7',
        sessionObjectId: 'instrument:7:udo:0',
        persistedFingerprint: {
          canonicalHash: 'udo-hash',
          opcodeName: 'embeddedTone',
          style: 'CLASSIC',
        },
      },
    })).toBe(true);
    expect(isLibraryItemKey({
      scope: 'projectOwned',
      libraryType: 'udo',
      projectSessionId: 3,
      locator: {
        kind: 'udo',
        instrumentAssignmentId: '',
        sessionObjectId: 'instrument:7:udo:0',
        persistedFingerprint: {
          canonicalHash: 'udo-hash',
          opcodeName: 'embeddedTone',
          style: 'CLASSIC',
        },
      },
    })).toBe(false);
  });

  it('guards browse, search, and context requests', () => {
    expect(
      isBrowseLibraryRequest({
        parent: { scope: 'user', libraryType: 'instrument' },
        limit: 50,
      }),
    ).toBe(true);
    expect(
      isSearchLibrariesRequest({ query: 'pad', typeFilter: 'all', projectSessionId: null }),
    ).toBe(true);
    expect(isSearchLibrariesRequest({ query: 3, typeFilter: 'all' })).toBe(false);
    expect(isLibraryContextRequest({ type: 'browseType', libraryType: 'udo' })).toBe(true);
    expect(isLibraryContextRequest({ type: 'effectTarget', projectSessionId: 1 })).toBe(false);
  });

  it('round-trips bounded cursor payloads and rejects malformed values', () => {
    const cursor = createLibraryCursor({
      kind: 'search',
      contentRevision: 4,
      offset: 20,
      signature: 'effect:echo',
    });

    expect(parseLibraryCursor(cursor)).toEqual({
      kind: 'search',
      contentRevision: 4,
      offset: 20,
      signature: 'effect:echo',
    });
    expect(parseLibraryCursor('not-a-cursor')).toBeNull();
  });

  it('creates bounded serializable error envelopes', () => {
    expect(createLibraryServiceError('stale-target', 'Select a new target', true)).toEqual({
      code: 'stale-target',
      message: 'Select a new target',
      retryable: true,
    });
  });

  it('guards opaque drag descriptors, exact targets, and revision-bound clipboard entries', () => {
    expect(isLibraryDragDescriptor({ dragSessionId: 'drag-1', libraryType: 'effect' })).toBe(true);
    expect(isLibraryDragDescriptor({
      dragSessionId: 'drag-project-effect', libraryType: 'effect', sourceScope: 'projectOwned',
    })).toBe(true);
    expect(isLibraryDragDescriptor({
      dragSessionId: 'drag-invalid-scope', libraryType: 'effect', sourceScope: 'project',
    })).toBe(false);
    expect(isLibraryDragDescriptor({ dragSessionId: 'drag-1', libraryType: 'effect', payloadXml: '<effect />' })).toBe(false);
    expect(isLibraryExactTransferTarget({
      kind: 'effectChain', projectSessionId: 4, projectRevision: 7,
      channelId: 'master', chain: 'post', insertIndex: 1, chainRevision: 'rev-2',
    })).toBe(true);
    expect(isLibraryExactTransferTarget({
      kind: 'effectChain', projectSessionId: 4, projectRevision: 7,
      channelId: 'master', chain: 'pre', insertIndex: 0, chainRevision: '',
    })).toBe(true);
    expect(isLibraryExactTransferTarget({
      kind: 'projectSoundObjectLibrary', projectSessionId: 4, projectRevision: 7,
    })).toBe(true);
    expect(isLibraryExactTransferTarget({
      kind: 'projectUdo', projectSessionId: 4, projectRevision: 7,
      instrumentAssignmentId: '7', insertIndex: 0,
    })).toBe(true);
    expect(isLibraryExactTransferTarget({
      kind: 'projectUdo', projectSessionId: 4, projectRevision: 7,
      instrumentAssignmentId: '', insertIndex: 0,
    })).toBe(false);
    expect(isLibraryTransferPreviewRequest({
      source: { kind: 'drag', dragSessionId: 'drag-empty-chain' },
      target: {
        kind: 'effectChain', projectSessionId: 4, projectRevision: 7,
        channelId: 'master', chain: 'pre', insertIndex: 0, chainRevision: '',
      },
    })).toBe(true);
    expect(isLibraryInteractionClipboard({
      operation: 'copy',
      source: { kind: 'library', key: { scope: 'user', libraryType: 'udo', nodeId: 'u-1' }, revision: 3 },
      capturedAt: 100,
    })).toBe(true);
    expect(isLibraryInteractionClipboard({
      operation: 'cut',
      source: { kind: 'buffer', clipboardId: 'cut-1', libraryType: 'effect' },
      capturedAt: 101,
    })).toBe(true);
    expect(isCutLibraryToClipboardRequest({
      source: { kind: 'userNode', libraryType: 'effect', nodeId: 'effect-1', revision: 2 },
      confirmationToken: 'confirm-1',
    })).toBe(true);
    expect(isCutLibraryToClipboardRequest({
      source: { kind: 'buffer', clipboardId: 'cut-1', libraryType: 'effect' },
      confirmationToken: 'confirm-1',
    })).toBe(false);
    expect(isScoreTimelineSoundObjectRequest({
      projectSessionId: 4,
      projectRevision: 7,
      location: {
        rootGroupIndex: 0,
        containerPath: [{ layerIndex: 1, objectIndex: 2 }],
        layerIndex: 3,
        objectIndex: 4,
      },
    })).toBe(true);
    expect(isScoreTimelineSoundObjectRequest({
      projectSessionId: 4,
      projectRevision: 7,
      location: {
        rootGroupIndex: 0,
        containerPath: [{ layerIndex: -1, objectIndex: 2 }],
        layerIndex: 3,
        objectIndex: 4,
      },
    })).toBe(false);
    expect(isBeginLibraryDragRequest({
      dragSessionId: 'drag-1',
      key: { scope: 'user', libraryType: 'instrument', nodeId: 'i-1' },
      revision: 2,
    })).toBe(true);
    expect(isBeginLibraryDragRequest({
      key: { scope: 'user', libraryType: 'instrument', nodeId: 'i-1' },
      revision: 2,
    })).toBe(false);
    expect(getLibraryTransferSourceType({
      kind: 'library',
      key: { scope: 'projectShared', libraryType: 'soundObject', projectSessionId: 4, locator: { kind: 'soundObject', libraryId: 's-1', persistedFingerprint: { canonicalHash: 'hash', displayName: 'Phrase', objectType: 'GenericScore' } } },
      revision: 'hash',
    })).toBe('soundObject');
    expect(getLibraryTransferSourceType({
      kind: 'buffer', clipboardId: 'cut-1', libraryType: 'udo',
    })).toBe('udo');
  });

  it('offers numeric Orchestra insertion IDs only at ordered boundaries', () => {
    expect(getAvailableNumericArrangementId([], 0)).toBe('1');
    expect(getAvailableNumericArrangementId(['1', '2'], 1)).toBeNull();
    expect(getAvailableNumericArrangementId(['1', '3'], 1)).toBe('2');
    expect(getAvailableNumericArrangementId(['1', '3'], 2)).toBe('4');
    expect(getAvailableNumericArrangementId(['4', '6', '5'], 1)).toBeNull();
    expect(getAvailableNumericArrangementId(['4', '6', '5'], 3)).toBe('7');
  });
});
