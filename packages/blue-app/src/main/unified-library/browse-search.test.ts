import { describe, expect, it, vi } from 'vitest';
import { parseLibraryCursor } from '../../shared/unified-library';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

const payload = (name: string, objectType = 'blue.orchestra.GenericInstrument') => ({
  embeddedName: name,
  objectType,
  supportStatus: 'supported' as const,
  supportReasonCode: null,
  supportMessage: null,
  payloadXml: `<instrument type="${objectType}"><name>${name}</name></instrument>`,
  rawHash: `raw-${name}`,
  canonicalContentHash: `canonical-${name}`,
  serializerRevision: '1',
  preview: {
    description: { state: 'available', value: `${name} description` },
    comment: { state: 'unavailable', reason: 'Not provided' },
  },
  dependencies: { itemOwned: [], unresolvedExternal: [] },
  metadataRevision: 1,
});

async function createService(): Promise<{
  service: UnifiedLibraryService;
  client: UnifiedLibraryRepositoryClient;
  rootId: string;
}> {
  const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
  const rootId = await client.runForTesting((repository) => {
    const root = repository.getRoot('instrument');
    const folder = repository.createFolder({
      libraryType: 'instrument',
      parentId: root.id,
      displayName: 'Synths',
    });
    repository.createItem({
      libraryType: 'instrument',
      parentId: root.id,
      displayName: 'Zither',
      payload: payload('Zither'),
    });
    repository.createItem({
      libraryType: 'instrument',
      parentId: folder.id,
      displayName: 'Alpha Pad',
      payload: payload('Alpha Pad'),
    });
    repository.createItem({
      libraryType: 'instrument',
      parentId: folder.id,
      displayName: 'Beta Pad',
      payload: payload('Beta Pad'),
    });
    return root.id;
  });
  const service = new UnifiedLibraryService(':memory:', () => client);
  await service.start();
  return { service, client, rootId };
}

describe('Unified Library browse, search, and preview', () => {
  it('browses folders before items and pages indexed case-insensitive search', async () => {
    const { service, rootId } = await createService();
    try {
      const browse = await service.browseLibraries({
        parent: { scope: 'user', libraryType: 'instrument', nodeId: rootId },
      });
      expect(browse).toMatchObject({ ok: true });
      if (!browse.ok) return;
      expect(browse.value.children.map((child) => child.displayName)).toEqual(['Synths', 'Zither']);
      expect(browse.value.children[0]?.nodeKind).toBe('folder');

      const first = await service.searchLibraries({
        query: 'PAD',
        typeFilter: 'instrument',
        projectSessionId: null,
        limit: 1,
      });
      expect(first).toMatchObject({ ok: true });
      if (!first.ok) return;
      expect(first.value.results.map((result) => result.displayName)).toEqual(['Alpha Pad']);
      expect(parseLibraryCursor(first.value.nextCursor ?? '')).toMatchObject({
        kind: 'search',
        offset: 1,
      });

      const second = await service.searchLibraries({
        query: 'pad',
        typeFilter: 'instrument',
        projectSessionId: null,
        cursor: first.value.nextCursor ?? undefined,
        limit: 1,
      });
      expect(second).toMatchObject({
        ok: true,
        value: { results: [{ displayName: 'Beta Pad' }], nextCursor: null },
      });
    } finally {
      await service.stop();
    }
  });

  it('loads payload only for preview and invalidates a cursor after mutation', async () => {
    const { service, client, rootId } = await createService();
    const payloadSpy = vi.spyOn(client, 'getItemPayload');
    try {
      const first = await service.searchLibraries({
        query: 'pad',
        typeFilter: 'all',
        projectSessionId: null,
        limit: 1,
      });
      expect(first.ok).toBe(true);
      expect(payloadSpy).not.toHaveBeenCalled();
      if (!first.ok) return;

      const preview = await service.getLibraryItemPreview(first.value.results[0]!.key);
      expect(preview).toMatchObject({
        ok: true,
        value: {
          fields: { description: { state: 'available', value: 'Alpha Pad description' } },
        },
      });
      expect(payloadSpy).toHaveBeenCalledTimes(1);

      await client.runForTesting((repository) => repository.createItem({
        libraryType: 'instrument',
        parentId: rootId,
        displayName: 'Gamma Pad',
        payload: payload('Gamma Pad'),
      }));
      const stale = await service.searchLibraries({
        query: 'pad',
        typeFilter: 'all',
        projectSessionId: null,
        cursor: first.value.nextCursor ?? undefined,
        limit: 1,
      });
      expect(stale).toMatchObject({ ok: false, error: { code: 'stale-cursor' } });
    } finally {
      await service.stop();
    }
  });
});
