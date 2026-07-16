import { describe, expect, it, vi } from 'vitest';
import type { LegacyLibraryDocumentPlan } from '@blue/data';
import { UnifiedLibraryRepositoryClient } from './repository-client';
import { UnifiedLibraryService } from './service';

describe('10,000-item library performance', () => {
  it('keeps browse, indexed search, preview lookup, and pagination bounded', async () => {
    const client = UnifiedLibraryRepositoryClient.openForTesting(':memory:');
    try {
      const items = Array.from({ length: 10_000 }, (_, index) => {
        const name = `Item ${String(index).padStart(5, '0')}`;
        const xml = `<instrument type="blue.orchestra.GenericInstrument"><name>${name}</name></instrument>`;
        return {
          kind: 'item' as const,
          displayName: name,
          sourceIndex: index,
          payload: {
            embeddedName: name,
            objectType: 'blue.orchestra.GenericInstrument',
            supportStatus: 'supported' as const,
            supportReasonCode: null,
            supportMessage: null,
            rawXml: xml,
            rawHash: `raw-${index}`,
            canonicalContentHash: `canonical-${index}`,
            preview: {},
            dependencies: { itemOwned: [], unresolvedExternal: [] },
          },
        };
      });
      const plan: LegacyLibraryDocumentPlan = {
        libraryType: 'instrument',
        descriptor: {
          libraryType: 'instrument', fileName: 'userInstrumentLibrary.xml',
          rootElement: 'instrumentLibrary', categoryElement: 'instrumentCategory',
          leafElement: 'instrument', ordering: 'categoriesFirst',
        },
        root: { kind: 'folder', name: 'Instrument Library', isRoot: true, sourceIndex: 0, children: items },
        folderCount: 0,
        itemCount: items.length,
        unsupportedCount: 0,
        diagnostics: [],
        sourceRawHash: 'benchmark',
      };
      await client.startImportBatch({ id: 'benchmark', mode: 'automatic', sourceCount: 1, startedAt: new Date(0).toISOString() });
      await client.importLegacyDocument({ batchId: 'benchmark', sourceId: 'benchmark-source', sourcePath: 'memory', sourceKind: 'primary', plan });

      const root = await client.getRoot('instrument');
      const service = new UnifiedLibraryService(':memory:', () => client);
      await service.start();
      const payloadSpy = vi.spyOn(client, 'getItemPayload');
      const editorSpy = vi.spyOn(service, 'openLibraryItemEditor');
      const browseStart = performance.now();
      const firstPage = await service.browseLibraries({
        parent: { scope: 'user', libraryType: 'instrument', nodeId: root.id },
        limit: 100,
      });
      const browseMs = performance.now() - browseStart;
      const searchStart = performance.now();
      const search = await service.searchLibraries({
        query: 'item 09999',
        typeFilter: 'instrument',
        projectSessionId: null,
        limit: 20,
      });
      const searchMs = performance.now() - searchStart;
      expect(firstPage).toMatchObject({ ok: true, value: { children: { length: 100 } } });
      expect(search).toMatchObject({
        ok: true,
        value: { results: [{ displayName: 'Item 09999' }] },
      });
      expect(payloadSpy).not.toHaveBeenCalled();
      expect(editorSpy).not.toHaveBeenCalled();
      if (!search.ok) throw new Error('Expected indexed search to succeed');
      const previewStart = performance.now();
      const preview = await service.getLibraryItemPreview(search.value.results[0]!.key);
      const previewMs = performance.now() - previewStart;

      expect(preview).toMatchObject({ ok: true, value: { displayName: 'Item 09999' } });
      expect(payloadSpy).toHaveBeenCalledTimes(1);
      expect(editorSpy).not.toHaveBeenCalled();
      expect({ browseMs, searchMs, previewMs }).toMatchObject({
        browseMs: expect.any(Number), searchMs: expect.any(Number), previewMs: expect.any(Number),
      });
      expect(browseMs).toBeLessThan(1_000);
      expect(searchMs).toBeLessThan(1_000);
      expect(previewMs).toBeLessThan(250);
    } finally { await client.close(); }
  }, 20_000);
});
