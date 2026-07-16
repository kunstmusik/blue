// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryExactTransferTarget, LibraryType } from '../../shared/unified-library';
import { useLibraryStore } from '../stores/library-store';

const previewLibraryTransfer = vi.fn(async (request: { target: LibraryExactTransferTarget }) => {
  const libraryType: LibraryType = request.target.kind === 'orchestra'
    ? 'instrument'
    : request.target.kind === 'projectUdo'
      ? 'udo'
      : request.target.kind === 'effectChain'
        ? 'effect'
        : 'soundObject';
  return {
    ok: true as const,
    value: {
      previewToken: `preview-${libraryType}`,
      item: {
        key: { scope: 'user' as const, libraryType, nodeId: `${libraryType}-1` },
        displayName: libraryType, libraryType, scope: 'user' as const, objectType: libraryType,
        supportStatus: 'supported' as const, supportMessage: null, fields: {},
        dependencies: { itemOwned: [], unresolvedExternal: [] },
      },
      target: request.target,
      requestedMode: 'independent' as const,
      allowedModes: ['independent'] as const,
      canApply: true,
      blockingReasons: [],
    },
  };
});
const applyLibraryTransfer = vi.fn(async (token: string) => ({
  ok: true as const,
  value: {
    projectSessionId: 3, projectRevision: 8,
    libraryType: token.replace('preview-', '') as LibraryType,
    insertedIdentity: token,
    message: 'Added.',
  },
}));

beforeEach(() => {
  previewLibraryTransfer.mockClear();
  applyLibraryTransfer.mockClear();
  window.blueAPI = { ...window.blueAPI, previewLibraryTransfer, applyLibraryTransfer };
  useLibraryStore.getState().reset();
});

describe('direct Library transfer routing', () => {
  it('uses the same explicit preview/apply path for all four exact destinations', async () => {
    const targets: Array<[LibraryType, LibraryExactTransferTarget]> = [
      ['instrument', { kind: 'orchestra', projectSessionId: 3, projectRevision: 7, insertIndex: 2 }],
      ['udo', { kind: 'projectUdo', projectSessionId: 3, projectRevision: 7, insertIndex: 1 }],
      ['effect', { kind: 'effectChain', projectSessionId: 3, projectRevision: 7, channelId: 'main', chain: 'pre', insertIndex: 0, chainRevision: '' }],
      ['soundObject', {
        kind: 'score', projectSessionId: 3, projectRevision: 7,
        location: { rootGroupId: 'root', containerPath: [], layerId: 'root-layer-0', startTime: 4 },
        timeContextRevision: '7',
      }],
    ];

    for (const [libraryType, target] of targets) {
      const source = { kind: 'clipboard' as const, source: { kind: 'userNode' as const, libraryType, nodeId: `${libraryType}-1`, revision: 1 } };
      expect(await useLibraryStore.getState().transferToProject(source, target)).toBe(true);
    }

    expect(previewLibraryTransfer).toHaveBeenCalledTimes(4);
    expect(applyLibraryTransfer).toHaveBeenCalledTimes(4);
    expect('context' in useLibraryStore.getState()).toBe(false);
  });

  it('keeps a dependency or stale-target failure atomic and visible', async () => {
    previewLibraryTransfer.mockResolvedValueOnce({
      ok: true,
      value: {
        previewToken: 'blocked',
        item: {
          key: { scope: 'user', libraryType: 'effect', nodeId: 'effect-1' },
          displayName: 'Effect', libraryType: 'effect', scope: 'user', objectType: 'Effect',
          supportStatus: 'supported', supportMessage: null, fields: {},
          dependencies: { itemOwned: [], unresolvedExternal: ['external UDO'] },
        },
        target: { kind: 'effectChain', projectSessionId: 3, projectRevision: 7, channelId: 'main', chain: 'pre', insertIndex: 0, chainRevision: '' },
        requestedMode: 'independent', allowedModes: ['independent'], canApply: false,
        blockingReasons: ['Resolve external dependencies before transfer.'],
      },
    });
    const applied = await useLibraryStore.getState().transferToProject(
      { kind: 'clipboard', source: { kind: 'userNode', libraryType: 'effect', nodeId: 'effect-1', revision: 1 } },
      { kind: 'effectChain', projectSessionId: 3, projectRevision: 7, channelId: 'main', chain: 'pre', insertIndex: 0, chainRevision: '' },
    );
    expect(applied).toBe(false);
    expect(applyLibraryTransfer).not.toHaveBeenCalled();
    expect(useLibraryStore.getState().error).toMatch(/dependencies/i);
  });
});
