import { describe, expect, it } from 'vitest';
import {
  createLibraryCursor,
  createLibraryServiceError,
  isBrowseLibraryRequest,
  isLibraryContextRequest,
  isLibraryItemKey,
  isLibraryServicePhase,
  isLibraryType,
  isSearchLibrariesRequest,
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
    expect(isLibraryItemKey({ scope: 'user', libraryType: 'effect' })).toBe(false);
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
});
