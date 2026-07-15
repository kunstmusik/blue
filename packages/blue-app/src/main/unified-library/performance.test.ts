import { describe, expect, it } from 'vitest';
import type { LegacyLibraryDocumentPlan } from '@blue/data';
import { UnifiedLibraryRepositoryClient } from './repository-client';

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
      const browseStart = performance.now();
      const firstPage = await client.listChildrenPage(root.id, 0, 100);
      const browseMs = performance.now() - browseStart;
      const searchStart = performance.now();
      const search = await client.searchItems('item 09999', 'instrument', 0, 20);
      const searchMs = performance.now() - searchStart;
      const previewStart = performance.now();
      const payload = await client.getItemPayload(search.items[0]!.node.id);
      const previewMs = performance.now() - previewStart;

      expect(firstPage).toMatchObject({ nodes: { length: 100 }, hasMore: true });
      expect(search.items[0]?.node.displayName).toBe('Item 09999');
      expect(payload.embeddedName).toBe('Item 09999');
      expect({ browseMs, searchMs, previewMs }).toMatchObject({
        browseMs: expect.any(Number), searchMs: expect.any(Number), previewMs: expect.any(Number),
      });
      expect(browseMs).toBeLessThan(1_000);
      expect(searchMs).toBeLessThan(1_000);
      expect(previewMs).toBeLessThan(250);
    } finally { await client.close(); }
  }, 20_000);
});
