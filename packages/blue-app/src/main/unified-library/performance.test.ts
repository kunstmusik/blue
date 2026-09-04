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
          libraryType: 'instrument',
          fileName: 'userInstrumentLibrary.xml',
          rootElement: 'instrumentLibrary',
          categoryElement: 'instrumentCategory',
          leafElement: 'instrument',
          ordering: 'categoriesFirst',
        },
        root: {
          kind: 'folder',
          name: 'Instrument Library',
          isRoot: true,
          sourceIndex: 0,
          children: items,
        },
        folderCount: 0,
        itemCount: items.length,
        unsupportedCount: 0,
        diagnostics: [],
        sourceRawHash: 'benchmark',
      };
      await client.startImportBatch({
        id: 'benchmark',
        mode: 'automatic',
        sourceCount: 1,
        startedAt: new Date(0).toISOString(),
      });
      await client.importLegacyDocument({
        batchId: 'benchmark',
        sourceId: 'benchmark-source',
        sourcePath: 'memory',
        sourceKind: 'primary',
        plan,
      });

      const root = await client.getRoot('instrument');
      const service = new UnifiedLibraryService(':memory:', () => client);
      await service.start();
      const payloadSpy = vi.spyOn(client, 'getItemPayload');
      const editorSpy = vi.spyOn(service, 'openLibraryItemEditor');
      const firstBrowseStart = performance.now();
      let browsePage = await service.browseLibraries({
        parent: { scope: 'user', libraryType: 'instrument', nodeId: root.id },
        limit: 500,
      });
      const browsePageDurations = [performance.now() - firstBrowseStart];
      let browsedItemCount = browsePage.ok ? browsePage.value.children.length : 0;
      let browseCursor = browsePage.ok ? browsePage.value.nextCursor : null;
      const browseRevision = browsePage.ok ? browsePage.value.contentRevision : undefined;
      while (browseCursor) {
        const pageStart = performance.now();
        browsePage = await service.browseLibraries({
          parent: { scope: 'user', libraryType: 'instrument', nodeId: root.id },
          cursor: browseCursor,
          limit: 500,
          expectedContentRevision: browseRevision,
        });
        browsePageDurations.push(performance.now() - pageStart);
        if (!browsePage.ok) break;
        browsedItemCount += browsePage.value.children.length;
        browseCursor = browsePage.value.nextCursor;
      }
      const firstSearchStart = performance.now();
      let search = await service.searchLibraries({
        query: 'item 00000',
        typeFilter: 'instrument',
        projectSessionId: null,
        limit: 20,
      });
      const searchDurations = [performance.now() - firstSearchStart];
      for (let sample = 1; sample < 20; sample += 1) {
        const itemIndex = sample === 19 ? 9_999 : sample * 500;
        const searchStart = performance.now();
        search = await service.searchLibraries({
          query: `item ${String(itemIndex).padStart(5, '0')}`,
          typeFilter: 'instrument',
          projectSessionId: null,
          limit: 20,
        });
        searchDurations.push(performance.now() - searchStart);
      }
      expect(browsePage).toMatchObject({ ok: true, value: { nextCursor: null } });
      expect(browsedItemCount).toBe(10_000);
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
      expect(browsePageDurations[0]).toBeLessThan(2_000);
      expect(browsePageDurations.filter((duration) => duration < 1_000)).toHaveLength(20);
      expect(searchDurations.filter((duration) => duration < 1_000).length).toBeGreaterThanOrEqual(
        19,
      );
      expect(previewMs).toBeLessThan(250);
    } finally {
      await client.close();
    }
  }, 20_000);
});
