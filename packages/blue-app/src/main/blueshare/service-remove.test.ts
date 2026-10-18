import { describe, expect, it, vi } from 'vitest';
import type { ResourceKey } from '../../shared/blueshare';
import { BlueShareService } from './service';
import {
  createConnectedTransport,
  createSyntheticCatalog,
  createMockSender,
  FakeBlueShareServer,
  TEST_USERS,
} from './test-helpers';

describe('BlueShare Removal Service Contract (T042)', () => {
  it('requires authentication to remove a resource', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(1);
    const { contextId } = (service.openDialog(sender) as any).value;

    const key: ResourceKey = { kind: 'instrument', id: 1 };
    const res = await service.removeResource(contextId, 'req-rem-1', key);

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected unauthenticated removal to fail');
    expect(res.error.code).toBe('unauthorized');
    expect(res.error.status).toBe(401);
  });

  it('allows owner to remove resource and confirms removal (200 with removed: true)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(2);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Sign in as Steven (TEST_USERS[0])
    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    // Resource 2 in instrument is owned by Steven (TEST_USERS[0])
    const key: ResourceKey = { kind: 'instrument', id: 2 };
    const removeRes = await service.removeResource(contextId, 'req-rem-2', key);

    expect(removeRes.ok).toBe(true);
    if (!removeRes.ok) throw new Error('Expected owner removal to succeed');
    expect(removeRes.value.removed).toBe(true);
    expect(removeRes.value.alreadyRemoved).toBe(false);

    // Verify GET now returns 410 (removed)
    const getRes = await service.getResource(contextId, 'req-get-1', key);
    expect(getRes.ok).toBe(false);
    if (getRes.ok) throw new Error('Expected removed resource to return error');
    expect(getRes.error.status).toBe(410);
  });

  it('denies removal when user is not the owner (403 forbidden)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(3);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Sign in as user 2 (Other Author)
    await service.signIn(contextId, 'req-login', TEST_USERS[1].email, TEST_USERS[1].password);

    // Resource 2 is owned by TEST_USERS[0], NOT TEST_USERS[1]
    const key: ResourceKey = { kind: 'instrument', id: 2 };
    const removeRes = await service.removeResource(contextId, 'req-rem-3', key);

    expect(removeRes.ok).toBe(false);
    if (removeRes.ok) throw new Error('Expected non-owner removal to be denied');
    expect(removeRes.error.code).toBe('forbidden');
    expect(removeRes.error.status).toBe(403);
  });

  it('handles repeated owner removal (idempotent / alreadyRemoved)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(4);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: ResourceKey = { kind: 'instrument', id: 2 };
    // First removal
    const firstRes = await service.removeResource(contextId, 'req-rem-4a', key);
    expect(firstRes.ok).toBe(true);
    if (!firstRes.ok) throw new Error('First removal failed');
    expect(firstRes.value.alreadyRemoved).toBe(false);

    // Repeated removal
    const secondRes = await service.removeResource(contextId, 'req-rem-4b', key);
    expect(secondRes.ok).toBe(true);
    if (!secondRes.ok) throw new Error('Second removal failed');
    expect(secondRes.value.removed).toBe(true);
    expect(secondRes.value.alreadyRemoved).toBe(true);
  });

  it('rejects duplicate pending clicks while removal is in progress (FR-013)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let resolveDelete: (res: any) => void;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });

    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'DELETE' && opts.url.includes('/resources/')) {
        return deletePromise as any;
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(5);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: ResourceKey = { kind: 'instrument', id: 1 };

    // First removal hangs
    const firstPromise = service.removeResource(contextId, 'req-rem-5a', key);

    // Second removal attempt while first is pending
    const secondRes = await service.removeResource(contextId, 'req-rem-5b', key);
    expect(secondRes.ok).toBe(false);
    if (secondRes.ok) throw new Error('Expected duplicate pending click to fail');
    expect(secondRes.error.code).toBe('busy');

    // Resolve first removal
    resolveDelete!({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'instrument', id: 1, removed: true, alreadyRemoved: false }),
    });

    const firstRes = await firstPromise;
    expect(firstRes.ok).toBe(true);
  });

  it('handles lost committed responses (504 timeout): marks outcome unknown with no auto-retry', async () => {
    const fakeServer = new FakeBlueShareServer();
    fakeServer.lostCommittedWrites = true; // Simulates 504 gateway timeout after committing deletion!

    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(6);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: ResourceKey = { kind: 'instrument', id: 2 };
    const removeRes = await service.removeResource(contextId, 'req-rem-6', key);

    expect(removeRes.ok).toBe(false);
    if (removeRes.ok) throw new Error('Expected timeout to report failure');
    expect(removeRes.error.outcome).toBe('unknown');
    expect(removeRes.error.status).toBe(504);

    // Resource was actually removed on server
    fakeServer.lostCommittedWrites = false;
    // Verification using listMine proves item is gone
    const mineRes = await service.listMine(contextId, 'req-mine', 'instrument');
    expect(mineRes.ok).toBe(true);
    if (!mineRes.ok) throw new Error('listMine failed');
    expect(mineRes.value.items.some((i) => i.id === 2)).toBe(false);
  });

  it('fences remove operations on dialog close or sign out', async () => {
    const fakeServer = new FakeBlueShareServer();
    let resolveDelete: (res: any) => void;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });

    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'DELETE' && opts.url.includes('/resources/')) {
        return deletePromise as any;
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(7);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: ResourceKey = { kind: 'instrument', id: 1 };
    const removePromise = service.removeResource(contextId, 'req-rem-7', key);

    // Sign out while delete is in-flight
    await service.signOut(contextId, 'req-logout');

    resolveDelete!({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'instrument', id: 1, removed: true, alreadyRemoved: false }),
    });

    const removeRes = await removePromise;
    expect(removeRes.ok).toBe(false);
    if (removeRes.ok) throw new Error('Expected fenced removal to fail');
    expect(removeRes.error.code).toBe('fenced');
  });

  it('rejects removal receipt with wrong key (wrong kind or id) as uncertain outcome (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let injectedReceipt: Record<string, unknown> = {
      kind: 'effect', // wrong kind!
      id: 2,
      removed: true,
      alreadyRemoved: false,
    };
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'DELETE' && opts.url.includes('/resources/')) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(injectedReceipt),
        };
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(8);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    // Wrong kind
    const key: ResourceKey = { kind: 'instrument', id: 2 };
    let res = await service.removeResource(contextId, 'req-rem-wrong-kind', key);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected wrong-kind removal receipt to fail');
    expect(res.error.code).toBe('invalid_response');
    expect(res.error.outcome).toBe('unknown');

    // Immediate second removal attempt is blocked while uncertain (T064)
    const immediateBlocked = await service.removeResource(contextId, 'req-rem-blocked', key);
    expect(immediateBlocked.ok).toBe(false);
    if (!immediateBlocked.ok) {
      expect(immediateBlocked.error.code).toBe('reconciliation_required');
      expect(immediateBlocked.error.outcome).toBe('unknown');
    }

    // Reconcile by refreshing submissions
    await service.listMine(contextId, 'req-mine', 'instrument', null);

    // Wrong id (now permitted after reconciliation)
    injectedReceipt = {
      kind: 'instrument',
      id: 9999, // wrong id!
      removed: true,
      alreadyRemoved: false,
    };
    res = await service.removeResource(contextId, 'req-rem-wrong-id', key);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected wrong-id removal receipt to fail');
    expect(res.error.code).toBe('invalid_response');
    expect(res.error.outcome).toBe('unknown');
  });

  it('rejects removal receipt with removed: false as uncertain outcome (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'DELETE' && opts.url.includes('/resources/')) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'instrument',
            id: 2,
            removed: false, // removed: false!
            alreadyRemoved: false,
          }),
        };
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(9);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: ResourceKey = { kind: 'instrument', id: 2 };
    const res = await service.removeResource(contextId, 'req-rem-false', key);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected removed:false to fail');
    expect(res.error.code).toBe('invalid_response');
    expect(res.error.outcome).toBe('unknown');
  });

  it('rejects removal receipt with string-boolean removed: "true" as uncertain outcome (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'DELETE' && opts.url.includes('/resources/')) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'instrument',
            id: 2,
            removed: 'true', // string-boolean!
            alreadyRemoved: false,
          }),
        };
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(10);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: ResourceKey = { kind: 'instrument', id: 2 };
    const res = await service.removeResource(contextId, 'req-rem-str-bool', key);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected string-boolean removed to fail');
    expect(res.error.code).toBe('invalid_response');
    expect(res.error.outcome).toBe('unknown');
  });

  it('rejects removal receipt with invalid alreadyRemoved as uncertain outcome (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'DELETE' && opts.url.includes('/resources/')) {
        return {
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'instrument',
            id: 2,
            removed: true,
            alreadyRemoved: 'false', // string instead of boolean!
          }),
        };
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(11);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: ResourceKey = { kind: 'instrument', id: 2 };
    const res = await service.removeResource(contextId, 'req-rem-bad-already', key);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected invalid alreadyRemoved to fail');
    expect(res.error.code).toBe('invalid_response');
    expect(res.error.outcome).toBe('unknown');
  });

  it('treats ambiguous 500 Internal Server Error as uncertain outcome (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(12);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    fakeServer.injectedStatus = 500;

    const key: ResourceKey = { kind: 'instrument', id: 2 };
    const res = await service.removeResource(contextId, 'req-rem-500', key);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected 500 to fail');
    expect(res.error.status).toBe(500);
    expect(res.error.outcome).toBe('unknown');
  });
});

describe('operation-specific reconciliation (T076)', () => {
  it('does not unlock uncertain removal with a wrong-kind or incomplete page', async () => {
    const server = new FakeBlueShareServer();
    const service = new BlueShareService({ transport: createConnectedTransport(server) });
    const opened = service.openDialog(createMockSender(30));
    if (!opened.ok) throw new Error('open');
    const ctx = opened.value.contextId;
    await service.signIn(ctx, 'login', TEST_USERS[0].email, TEST_USERS[0].password);
    server.injectedStatus = 504;
    expect((await service.removeResource(ctx, 'remove', { kind: 'instrument', id: 2 })).ok).toBe(
      false,
    );
    server.injectedStatus = null;
    await service.listMine(ctx, 'wrong-kind', 'effect');
    const retry = await service.removeResource(ctx, 'retry', { kind: 'instrument', id: 2 });
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.error.code).toBe('reconciliation_required');
    service.shutdown();
  });
});

it('requires ordered traversal through page two before treating an unseen uncertain target as reconciled (T076)', async () => {
  const server = new FakeBlueShareServer(createSyntheticCatalog({ itemsPerKind: 100 }));
  const service = new BlueShareService({ transport: createConnectedTransport(server) });
  const opened = service.openDialog(createMockSender(31));
  if (!opened.ok) throw new Error('open');
  const ctx = opened.value.contextId;
  await service.signIn(ctx, 'login', TEST_USERS[0].email, TEST_USERS[0].password);
  server.injectedStatus = 504;
  await service.removeResource(ctx, 'remove', { kind: 'instrument', id: 2 });
  server.injectedStatus = null;
  const first = await service.listMine(ctx, 'page1', 'instrument');
  if (!first.ok) throw new Error('page1');
  expect(first.value.items).toHaveLength(25);
  expect(first.value.items.some((i) => i.id === 2)).toBe(false);
  expect(first.value.nextBeforeId).not.toBeNull();
  const premature = await service.removeResource(ctx, 'early', { kind: 'instrument', id: 2 });
  expect(premature.ok).toBe(false);
  if (!premature.ok) expect(premature.error.code).toBe('reconciliation_required');
  const second = await service.listMine(ctx, 'page2', 'instrument', first.value.nextBeforeId);
  expect(second.ok).toBe(true);
  expect(
    (await service.removeResource(ctx, 'explicit-retry', { kind: 'instrument', id: 2 })).ok,
  ).toBe(true);
  service.shutdown();
});

it('does not reconcile a newer uncertain write with a read dispatched before that operation (T076)', async () => {
  const server = new FakeBlueShareServer();
  const transport = createConnectedTransport(server);
  const service = new BlueShareService({ transport });
  const opened = service.openDialog(createMockSender(32));
  if (!opened.ok) throw new Error('open');
  const ctx = opened.value.contextId;
  await service.signIn(ctx, 'login', TEST_USERS[0].email, TEST_USERS[0].password);
  let finish!: (response: any) => void;
  vi.spyOn(transport, 'sendRequest').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const oldRead = service.listMine(ctx, 'old-read', 'instrument');
  server.injectedStatus = 504;
  await service.removeResource(ctx, 'write', { kind: 'instrument', id: 2 });
  server.injectedStatus = null;
  finish({ status: 200, headers: {}, body: JSON.stringify({ items: [], nextBeforeId: null }) });
  await oldRead;
  const retry = await service.removeResource(ctx, 'retry', { kind: 'instrument', id: 2 });
  expect(retry.ok).toBe(false);
  if (!retry.ok) expect(retry.error.code).toBe('reconciliation_required');
  service.shutdown();
});
