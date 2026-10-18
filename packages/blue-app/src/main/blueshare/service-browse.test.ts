import { describe, expect, it, vi } from 'vitest';
import { BlueShareService, type MinimalWebContents } from './service';
import { BlueShareTransport } from './transport';
import { FakeBlueShareServer } from './test-helpers';

function createMockSender(id = 1): MinimalWebContents {
  return {
    id,
    isDestroyed: () => false,
  };
}

describe('BlueShareService - Browse & Detail (US1)', () => {
  it('fetches categories for each kind independently with overlapping IDs', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const service = new BlueShareService({ transport });
    const sender = createMockSender(10);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Instrument categories
    const instrCats = await (service as any).getCategories(contextId, 'req-1', 'instrument');
    expect(instrCats.ok).toBe(true);
    expect(instrCats.value.length).toBeGreaterThan(0);
    expect(instrCats.value.every((c: any) => c.kind === 'instrument')).toBe(true);

    // Effect categories
    const effectCats = await (service as any).getCategories(contextId, 'req-2', 'effect');
    expect(effectCats.ok).toBe(true);
    expect(effectCats.value.every((c: any) => c.kind === 'effect')).toBe(true);

    // SoundObject categories
    const soCats = await (service as any).getCategories(contextId, 'req-3', 'soundObject');
    expect(soCats.ok).toBe(true);
    expect(soCats.value.every((c: any) => c.kind === 'soundObject')).toBe(true);
  });

  it('lists resources with pagination of 25 items and beforeId continuation', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const service = new BlueShareService({ transport });
    const sender = createMockSender(20);
    const { contextId } = (service.openDialog(sender) as any).value;

    // First page of instruments (catalog has 30 items)
    const page1 = await (service as any).listResources(
      contextId,
      'req-p1',
      'instrument',
      null,
      null,
    );
    expect(page1.ok).toBe(true);
    expect(page1.value.items.length).toBe(25);
    expect(page1.value.nextBeforeId).not.toBeNull();

    // Verify strict descending IDs
    for (let i = 1; i < page1.value.items.length; i++) {
      expect(page1.value.items[i].id).toBeLessThan(page1.value.items[i - 1].id);
    }

    // Second page with beforeId
    const page2 = await (service as any).listResources(
      contextId,
      'req-p2',
      'instrument',
      null,
      page1.value.nextBeforeId,
    );
    expect(page2.ok).toBe(true);
    expect(page2.value.items.length).toBe(5); // 30 - 25 = 5
    expect(page2.value.nextBeforeId).toBeNull();
  });

  it('fetches latest submissions (up to 10) independently per kind', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const service = new BlueShareService({ transport });
    const sender = createMockSender(30);
    const { contextId } = (service.openDialog(sender) as any).value;

    const latest = await (service as any).getLatest(contextId, 'req-latest', 'instrument');
    expect(latest.ok).toBe(true);
    expect(latest.value.items.length).toBe(10);
    expect(latest.value.items.every((item: any) => item.kind === 'instrument')).toBe(true);
  });

  it('fetches resource details without raw XML over the preload boundary', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const service = new BlueShareService({ transport });
    const sender = createMockSender(40);
    const { contextId } = (service.openDialog(sender) as any).value;

    const detailRes = await (service as any).getResource(contextId, 'req-det', {
      kind: 'instrument',
      id: 1,
    });
    expect(detailRes.ok).toBe(true);
    expect(detailRes.value.id).toBe(1);
    expect(detailRes.value.kind).toBe('instrument');
    expect(detailRes.value.name).toBeTruthy();
    // Raw XML must NOT be exposed in the detail display DTO
    expect((detailRes.value as any).xml).toBeUndefined();
  });

  it('distinguishes 404, 409, 410, and 503 error outcomes', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const service = new BlueShareService({ transport });
    const sender = createMockSender(50);
    const { contextId } = (service.openDialog(sender) as any).value;

    // 404 Not Found
    const notFound = await (service as any).getResource(contextId, 'req-404', {
      kind: 'instrument',
      id: 99999,
    });
    expect(notFound.ok).toBe(false);
    expect(notFound.error.status).toBe(404);

    // 409 Conflict / Unavailable
    fakeServer.injectedStatus = 409;
    fakeServer.injectedBody = JSON.stringify({
      error: { code: 'resource_unavailable', message: 'Stored XML is unavailable' },
    });
    const unavailable = await (service as any).getResource(contextId, 'req-409', {
      kind: 'instrument',
      id: 1,
    });
    expect(unavailable.ok).toBe(false);
    expect(unavailable.error.status).toBe(409);
    expect(unavailable.error.code).toBe('resource_unavailable');

    // 410 Gone / Removed
    fakeServer.injectedStatus = 410;
    fakeServer.injectedBody = JSON.stringify({
      error: { code: 'removed', message: 'Resource has been removed' },
    });
    const removed = await (service as any).getResource(contextId, 'req-410', {
      kind: 'instrument',
      id: 1,
    });
    expect(removed.ok).toBe(false);
    expect(removed.error.status).toBe(410);

    // 503 Service Unavailable -> outcome 'unknown'
    fakeServer.injectedStatus = 503;
    fakeServer.injectedBody = JSON.stringify({
      error: { code: 'service_unavailable', message: 'Maintenance in progress' },
    });
    const serverUnavailable = await (service as any).getResource(contextId, 'req-503', {
      kind: 'instrument',
      id: 1,
    });
    expect(serverUnavailable.ok).toBe(false);
    expect(serverUnavailable.error.status).toBe(503);
    expect(serverUnavailable.error.outcome).toBe('unknown');
  });

  it('rejects corrupt category hierarchies (duplicate IDs, orphans, cycles) and validates nested trees', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const service = new BlueShareService({ transport });
    const sender = createMockSender(60);
    const { contextId } = (service.openDialog(sender) as any).value;

    // 1. Nested valid tree with unordered input -> validated and returned in pre-order with sibling ID ordering
    fakeServer.injectedStatus = 200;
    fakeServer.injectedBody = JSON.stringify({
      items: [
        { id: 20, kind: 'instrument', parentId: null, name: 'Samples', description: null },
        { id: 10, kind: 'instrument', parentId: null, name: 'Synths', description: null },
        { id: 12, kind: 'instrument', parentId: 10, name: 'FM', description: null },
        { id: 11, kind: 'instrument', parentId: 10, name: 'Subtractive', description: null },
      ],
    });
    const validNested = await (service as any).getCategories(contextId, 'req-nested', 'instrument');
    expect(validNested.ok).toBe(true);
    expect(validNested.value.map((c: any) => c.id)).toEqual([10, 11, 12, 20]);

    // 2. Corrupt: duplicate category IDs
    fakeServer.injectedBody = JSON.stringify({
      items: [
        { id: 10, kind: 'instrument', parentId: null, name: 'Synths', description: null },
        { id: 10, kind: 'instrument', parentId: null, name: 'Duplicate Synths', description: null },
      ],
    });
    const dupRes = await (service as any).getCategories(contextId, 'req-dup', 'instrument');
    expect(dupRes.ok).toBe(false);
    expect(dupRes.error.code).toBe('duplicate_category_id');

    // 3. Corrupt: orphan category (references non-existent parentId)
    fakeServer.injectedBody = JSON.stringify({
      items: [
        { id: 10, kind: 'instrument', parentId: null, name: 'Synths', description: null },
        { id: 11, kind: 'instrument', parentId: 9999, name: 'Lost Child', description: null },
      ],
    });
    const orphanRes = await (service as any).getCategories(contextId, 'req-orphan', 'instrument');
    expect(orphanRes.ok).toBe(false);
    expect(orphanRes.error.code).toBe('orphan_category');

    // 4. Corrupt: self cycle
    fakeServer.injectedBody = JSON.stringify({
      items: [{ id: 10, kind: 'instrument', parentId: 10, name: 'Cycle', description: null }],
    });
    const cycleRes = await (service as any).getCategories(contextId, 'req-cycle', 'instrument');
    expect(cycleRes.ok).toBe(false);
    expect(cycleRes.error.code).toBe('category_cycle');

    // 5. Corrupt: multi-node cycle (1 -> 2 -> 1)
    fakeServer.injectedBody = JSON.stringify({
      items: [
        { id: 1, kind: 'instrument', parentId: 2, name: 'Node 1', description: null },
        { id: 2, kind: 'instrument', parentId: 1, name: 'Node 2', description: null },
      ],
    });
    const multiCycleRes = await (service as any).getCategories(
      contextId,
      'req-mcycle',
      'instrument',
    );
    expect(multiCycleRes.ok).toBe(false);
    expect(multiCycleRes.error.code).toBe('category_cycle');
  });

  it('rejects wrong detail ID and never imports another resource', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const mockLibrary = {
      capturePublishSource: vi.fn(),
      importStandaloneResource: vi.fn(),
    };
    const service = new BlueShareService({ transport, libraryService: mockLibrary as any });
    const sender = createMockSender(70);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Server returns resource with id: 99 when id: 1 was requested
    fakeServer.injectedStatus = 200;
    fakeServer.injectedBody = JSON.stringify({
      kind: 'instrument',
      id: 99, // Mismatched ID!
      name: 'Wrong Instrument',
      description: null,
      blueType: 'blue.orchestra.GenericInstrument',
      createdAt: '2026-10-17T12:00:00Z',
      category: { id: 1, name: 'Synths' },
      author: { id: 'u1', name: 'Author', username: 'author' },
      xml: '<instrument type="blue.orchestra.GenericInstrument"></instrument>',
    });

    // 1. getResource rejects mismatched ID
    const getRes = await service.getResource(contextId, 'req-wrong-get', {
      kind: 'instrument',
      id: 1,
    });
    expect(getRes.ok).toBe(false);

    // 2. importResource rejects mismatched ID and never calls libraryService.importStandaloneResource
    const importRes = await service.importResource(contextId, 'req-wrong-import', {
      kind: 'instrument',
      id: 1,
    });
    expect(importRes.ok).toBe(false);
    expect(mockLibrary.importStandaloneResource).not.toHaveBeenCalled();
  });

  it('rejects detail XML exceeding 2 MiB bound and prevents import', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const mockLibrary = {
      capturePublishSource: vi.fn(),
      importStandaloneResource: vi.fn(),
    };
    const service = new BlueShareService({ transport, libraryService: mockLibrary as any });
    const sender = createMockSender(71);
    const { contextId } = (service.openDialog(sender) as any).value;

    const oversizedXml = 'x'.repeat(2 * 1024 * 1024 + 1);
    fakeServer.injectedStatus = 200;
    fakeServer.injectedBody = JSON.stringify({
      kind: 'instrument',
      id: 1,
      name: 'Huge Instrument',
      description: null,
      blueType: 'blue.orchestra.GenericInstrument',
      createdAt: '2026-10-17T12:00:00Z',
      category: { id: 1, name: 'Synths' },
      author: { id: 'u1', name: 'Author', username: 'author' },
      xml: oversizedXml,
    });

    const getRes = await service.getResource(contextId, 'req-huge-get', {
      kind: 'instrument',
      id: 1,
    });
    expect(getRes.ok).toBe(false);

    const importRes = await service.importResource(contextId, 'req-huge-import', {
      kind: 'instrument',
      id: 1,
    });
    expect(importRes.ok).toBe(false);
    expect(mockLibrary.importStandaloneResource).not.toHaveBeenCalled();
  });

  it('enforces page size at most 25 and progressing cursors in listResources', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const service = new BlueShareService({ transport });
    const sender = createMockSender(72);
    const { contextId } = (service.openDialog(sender) as any).value;

    const createSample = (id: number, categoryId = 1) => ({
      kind: 'instrument' as const,
      id,
      name: `Instrument ${id}`,
      description: null,
      blueType: 'blue.orchestra.GenericInstrument',
      createdAt: '2026-10-17T12:00:00Z',
      category: { id: categoryId, name: 'Synths' },
      author: { id: 'u1', name: 'Author', username: 'author' },
    });

    // 1. Rejects page size > 25
    fakeServer.injectedStatus = 200;
    fakeServer.injectedBody = JSON.stringify({
      items: Array.from({ length: 26 }, (_, i) => createSample(100 - i)),
      nextBeforeId: 74,
    });
    const oversizedPage = await service.listResources(contextId, 'req-p-over', 'instrument');
    expect(oversizedPage.ok).toBe(false);

    // 2. Rejects non-progressing cursor (nextBeforeId > lowest item id, which would repeat items!)
    fakeServer.injectedBody = JSON.stringify({
      items: [createSample(30), createSample(29), createSample(28)],
      nextBeforeId: 29, // 29 > 28, would repeat item 28 in next page!
    });
    const nonProgressingPage = await service.listResources(contextId, 'req-p-repeat', 'instrument');
    expect(nonProgressingPage.ok).toBe(false);

    // 3. Rejects items violating beforeId constraint (continuation must not repeat items from previous page)
    fakeServer.injectedBody = JSON.stringify({
      items: [createSample(28), createSample(27)], // 28 is not strictly less than beforeId 28!
      nextBeforeId: 26,
    });
    const repeatedItemPage = await service.listResources(
      contextId,
      'req-p-before-violation',
      'instrument',
      null,
      28,
    );
    expect(repeatedItemPage.ok).toBe(false);

    // 4. Rejects items with wrong category when categoryId was requested
    fakeServer.injectedBody = JSON.stringify({
      items: [createSample(30, 2)], // Category 2 instead of requested 1
      nextBeforeId: null,
    });
    const wrongCategoryPage = await service.listResources(
      contextId,
      'req-p-cat-violation',
      'instrument',
      1,
    );
    expect(wrongCategoryPage.ok).toBe(false);
  });

  it('rejects out-of-order creation dates and invalid dates in getLatest', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => fakeServer.handleRequest(opts),
    });
    const service = new BlueShareService({ transport });
    const sender = createMockSender(73);
    const { contextId } = (service.openDialog(sender) as any).value;

    const sample1 = {
      kind: 'instrument' as const,
      id: 10,
      name: 'Instr 10',
      description: null,
      blueType: 'blue.orchestra.GenericInstrument',
      createdAt: '2026-10-17T10:00:00Z', // Older
      category: { id: 1, name: 'Synths' },
      author: { id: 'u1', name: 'Author', username: 'author' },
    };

    const sample2 = {
      ...sample1,
      id: 20,
      name: 'Instr 20',
      createdAt: '2026-10-17T12:00:00Z', // Newer
    };

    // Out of order: older date before newer date
    fakeServer.injectedStatus = 200;
    fakeServer.injectedBody = JSON.stringify({
      items: [sample1, sample2],
    });
    const outOfOrderLatest = await service.getLatest(contextId, 'req-latest-bad', 'instrument');
    expect(outOfOrderLatest.ok).toBe(false);

    // Non-UTC date string (+02:00)
    fakeServer.injectedBody = JSON.stringify({
      items: [{ ...sample2, createdAt: '2026-10-17T12:00:00+02:00' }],
    });
    const nonUtcLatest = await service.getLatest(contextId, 'req-latest-non-utc', 'instrument');
    expect(nonUtcLatest.ok).toBe(false);
  });
});
