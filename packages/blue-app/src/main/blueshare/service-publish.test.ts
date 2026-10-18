import { describe, expect, it, vi } from 'vitest';
import { BlueShareService } from './service';
import { BlueShareTransport, BlueShareNotDispatchedError } from './transport';
import {
  FakeBlueShareServer,
  createConnectedTransport,
  createMockSender,
  TEST_USERS,
} from './test-helpers';
import type {
  LibraryItemKey,
  LibraryPublishSourceSnapshot,
  LibraryResult,
} from '../../shared/unified-library';

function createMockLibraryService(
  initialXml = '<instrument type="blue.orchestra.GenericInstrument"><name>Test Instrument</name></instrument>',
) {
  let revision = 1;
  let currentXml = initialXml;
  let isDeleted = false;

  return {
    get revision() {
      return revision;
    },
    bumpRevision(newXml?: string) {
      revision++;
      if (newXml) currentXml = newXml;
    },
    delete() {
      isDeleted = true;
    },
    capturePublishSource: async (req: {
      key: LibraryItemKey;
      expectedRevision: number;
    }): Promise<LibraryResult<LibraryPublishSourceSnapshot>> => {
      if (isDeleted) {
        return {
          ok: false,
          error: {
            code: 'not-found',
            message: 'Library node not found',
            retryable: false,
          },
        };
      }
      if (req.expectedRevision !== revision) {
        return {
          ok: false,
          error: {
            code: 'stale-revision',
            message: `Stale revision: expected ${req.expectedRevision}, got ${revision}`,
            retryable: false,
          },
        };
      }
      return {
        ok: true,
        value: {
          key: req.key,
          revision,
          displayName: 'Test Instrument',
          blueType: req.key.libraryType === 'effect' ? null : 'blue.orchestra.GenericInstrument',
          description: 'Seeded description',
          xml: currentXml,
        },
      };
    },
  };
}

describe('BlueShare Publication Contract & Races (T032)', () => {
  it('requires authentication for preparation and publication', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(20);
    const { contextId } = (service.openDialog(sender) as any).value;

    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };

    // Anonymous prepare
    const anonPrep = await service.preparePublishSource(contextId, 'req-prep-anon', key, 1);
    expect(anonPrep.ok).toBe(false);
    if (anonPrep.ok) throw new Error('Expected prepare to fail');
    expect(anonPrep.error.status).toBe(401);

    // Anonymous publish
    const anonPub = await service.publishResource(
      contextId,
      'req-pub-anon',
      'fake-token',
      10,
      'Name',
      null,
    );
    expect(anonPub.ok).toBe(false);
    if (anonPub.ok) throw new Error('Expected publish to fail');
    expect(anonPub.error.status).toBe(401);
  });

  it('prepares source token and publishes resource with confirmed 201', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(21);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Sign in as Steven
    const user = TEST_USERS[0];
    await service.signIn(contextId, 'req-login', user.email, user.password);

    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };

    // Prepare
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    expect(prepRes.ok).toBe(true);
    if (!prepRes.ok) throw new Error('Prepare failed');
    expect(prepRes.value.sourceToken).toBeDefined();
    expect(prepRes.value.kind).toBe('instrument');
    expect(prepRes.value.name).toBe('Test Instrument');
    expect(prepRes.value.blueType).toBe('blue.orchestra.GenericInstrument');
    expect(prepRes.value.descriptionSeed).toBe('Seeded description');

    // Publish to category 10 (Synthesizers)
    const pubRes = await service.publishResource(
      contextId,
      'req-pub',
      prepRes.value.sourceToken,
      10,
      'Published Lead Synth',
      'Custom user description',
    );

    expect(pubRes.ok).toBe(true);
    if (!pubRes.ok) throw new Error('Publish failed');
    expect(pubRes.value.name).toBe('Published Lead Synth');
    expect(pubRes.value.description).toBe('Custom user description');
    expect(pubRes.value.author.id).toBe(user.id);
    expect(pubRes.value.category.id).toBe(10);

    // Verify published item appears in /mine (US4 read reconciliation)
    const mineRes = await service.listMine(contextId, 'req-mine', 'instrument');
    expect(mineRes.ok).toBe(true);
    if (!mineRes.ok) throw new Error('List mine failed');
    const found = mineRes.value.items.find((item) => item.id === pubRes.value.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Published Lead Synth');
  });

  it('sends exactly the five allowed body fields to server', async () => {
    const fakeServer = new FakeBlueShareServer();
    let sentBody: Record<string, unknown> | null = null;
    const origHandleRequest = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'POST' && opts.url.includes('/resources')) {
        sentBody = JSON.parse(opts.body as string);
      }
      return origHandleRequest(opts);
    };
    const transport = createConnectedTransport(fakeServer);

    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(22);
    const { contextId } = (service.openDialog(sender) as any).value;

    const user = TEST_USERS[0];
    await service.signIn(contextId, 'req-login', user.email, user.password);

    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    const pubRes = await service.publishResource(
      contextId,
      'req-pub',
      prepRes.value.sourceToken,
      10,
      'Synth Five Fields',
      'Test description',
    );
    expect(pubRes.ok).toBe(true);

    expect(sentBody).not.toBeNull();
    const keys = Object.keys(sentBody!).sort();
    expect(keys).toEqual(['blueType', 'categoryId', 'description', 'name', 'xml']);
  });

  it('rejects repeated pending clicks while another operation is in progress (FR-013)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let resolvePost: (res: any) => void;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'POST' && opts.url.includes('/resources')) {
        return postPromise as any;
      }
      return origHandle(opts);
    };
    const transport = createConnectedTransport(fakeServer);

    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(23);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    // Start first publish (hangs waiting for postPromise)
    const firstPublish = service.publishResource(
      contextId,
      'req-pub-1',
      prepRes.value.sourceToken,
      10,
      'First Click',
      null,
    );

    // Attempt second publish while first is pending
    const secondPublish = await service.publishResource(
      contextId,
      'req-pub-2',
      prepRes.value.sourceToken,
      10,
      'Second Click',
      null,
    );

    expect(secondPublish.ok).toBe(false);
    if (secondPublish.ok) throw new Error('Expected duplicate call to fail');
    expect(secondPublish.error.code).toBe('busy');

    // Clean up pending promise
    resolvePost!({
      status: 201,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'instrument',
        id: 999,
        name: 'First Click',
        description: null,
        blueType: 'blue.orchestra.GenericInstrument',
        category: { id: 10, name: 'Synths' },
        author: { id: TEST_USERS[0].id, name: 'Steven', username: 'steven' },
        xml: '<instrument/>',
      }),
    });
    await firstPublish;
  });

  it('detects concurrent library modification before sending and rejects with stale_source', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(24);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    // Library item edited concurrently!
    mockLibrary.bumpRevision(
      '<instrument type="blue.orchestra.GenericInstrument"><name>Modified</name></instrument>',
    );

    // Attempt to publish with old prepared token
    const pubRes = await service.publishResource(
      contextId,
      'req-pub-stale',
      prepRes.value.sourceToken,
      10,
      'Stale Submission',
      null,
    );

    expect(pubRes.ok).toBe(false);
    if (pubRes.ok) throw new Error('Expected stale source to fail');
    expect(pubRes.error.code).toBe('stale_source');
  });

  it('handles lost committed responses (504 timeout): marks uncertain, retains draft, no auto-retry', async () => {
    const fakeServer = new FakeBlueShareServer();
    // Simulate server commit followed by 504 gateway timeout
    fakeServer.lostCommittedWrites = true;

    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(25);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    const pubRes = await service.publishResource(
      contextId,
      'req-pub-timeout',
      prepRes.value.sourceToken,
      10,
      'Uncertain Publish',
      'Retained draft text',
    );

    expect(pubRes.ok).toBe(false);
    if (pubRes.ok) throw new Error('Expected 504 outcome to be an error');
    // Outcome must be uncertain ('unknown')
    expect(pubRes.error.outcome).toBe('unknown');

    // User can reconcile by checking /mine (US4 read)
    const mineRes = await service.listMine(contextId, 'req-mine-reconcile', 'instrument');
    expect(mineRes.ok).toBe(true);
    if (!mineRes.ok) throw new Error('List mine failed');
    const committedItem = mineRes.value.items.find((item) => item.name === 'Uncertain Publish');
    expect(committedItem).toBeDefined();
  });

  it('fences publish operations on dialog close or sign out', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(26);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    // Sign out before publishing
    await service.signOut(contextId, 'req-logout');

    // Attempting to publish after sign-out
    const pubRes = await service.publishResource(
      contextId,
      'req-pub-after-signout',
      prepRes.value.sourceToken,
      10,
      'After Signout',
      null,
    );
    expect(pubRes.ok).toBe(false);
    if (pubRes.ok) throw new Error('Expected publish to fail after sign out');
    expect(pubRes.error.status).toBe(401);
  });

  it('handles preparation order: slow preparation of item A is superseded by fast item B (T060)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);

    let resolveItemA: (res: any) => void;
    const promiseItemA = new Promise((resolve) => {
      resolveItemA = resolve;
    });

    const mockLibrary = {
      capturePublishSource: async (req: {
        key: LibraryItemKey;
        expectedRevision: number;
      }): Promise<any> => {
        if ('nodeId' in req.key && req.key.nodeId === 'inst-slow') {
          return promiseItemA;
        }
        return {
          ok: true,
          value: {
            key: req.key,
            revision: 1,
            displayName: 'Fast Synth',
            blueType: 'blue.orchestra.GenericInstrument',
            description: 'Fast description',
            xml: '<instrument type="blue.orchestra.GenericInstrument"><name>Fast Synth</name></instrument>',
          },
        };
      },
    };

    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(27);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);

    const keySlow: LibraryItemKey = {
      scope: 'user',
      libraryType: 'instrument',
      nodeId: 'inst-slow',
    };
    const keyFast: LibraryItemKey = {
      scope: 'user',
      libraryType: 'instrument',
      nodeId: 'inst-fast',
    };

    // Start slow preparation for Item A
    const prepPromiseSlow = service.preparePublishSource(contextId, 'req-prep-slow', keySlow, 1);

    // Prior snapshot is immediately invalidated
    const postDispatchPublish = await service.publishResource(
      contextId,
      'req-pub-prior',
      'any-old-token',
      10,
      'Name',
      null,
    );
    expect(postDispatchPublish.ok).toBe(false);
    if (postDispatchPublish.ok) throw new Error('Expected failure');
    expect(postDispatchPublish.error.code).toBe('invalid_source_token');

    // Immediately start fast preparation for Item B
    const prepFastRes = await service.preparePublishSource(contextId, 'req-prep-fast', keyFast, 1);
    expect(prepFastRes.ok).toBe(true);
    if (!prepFastRes.ok) throw new Error('Fast prepare failed');
    expect(prepFastRes.value.name).toBe('Fast Synth');
    const fastToken = prepFastRes.value.sourceToken;

    // Now resolve slow preparation for Item A
    resolveItemA!({
      ok: true,
      value: {
        key: keySlow,
        revision: 1,
        displayName: 'Slow Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        description: 'Slow description',
        xml: '<instrument type="blue.orchestra.GenericInstrument"><name>Slow Synth</name></instrument>',
      },
    });

    const prepSlowRes = await prepPromiseSlow;
    expect(prepSlowRes.ok).toBe(false);
    if (prepSlowRes.ok) throw new Error('Expected slow prep to be fenced');
    expect(prepSlowRes.error.code).toBe('fenced');

    // Current source in dialog is still Fast Synth
    const pubRes = await service.publishResource(
      contextId,
      'req-pub-fast',
      fastToken,
      10,
      'Fast Synth',
      null,
    );
    expect(pubRes.ok).toBe(true);
    if (!pubRes.ok) throw new Error('Fast publish failed');
    expect(pubRes.value.name).toBe('Fast Synth');
  });

  it('fences publication when account is replaced during awaited revision recheck (T060)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);

    let resolveRecheck: (res: any) => void;
    const promiseRecheck = new Promise((resolve) => {
      resolveRecheck = resolve;
    });

    let recheckCount = 0;
    const mockLibrary = {
      capturePublishSource: async (req: {
        key: LibraryItemKey;
        expectedRevision: number;
      }): Promise<any> => {
        recheckCount++;
        if (recheckCount === 1) {
          // First call is preparePublishSource
          return {
            ok: true,
            value: {
              key: req.key,
              revision: 1,
              displayName: 'Recheck Synth',
              blueType: 'blue.orchestra.GenericInstrument',
              description: 'Recheck desc',
              xml: '<instrument type="blue.orchestra.GenericInstrument"><name>Recheck Synth</name></instrument>',
            },
          };
        }
        // Second call is recheck in publishResource
        return promiseRecheck;
      },
    };

    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(28);
    const { contextId } = (service.openDialog(sender) as any).value;

    // User A signs in
    await service.signIn(contextId, 'req-login-a', TEST_USERS[0].email, TEST_USERS[0].password);

    const key: LibraryItemKey = {
      scope: 'user',
      libraryType: 'instrument',
      nodeId: 'inst-recheck',
    };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep-recheck', key, 1);
    expect(prepRes.ok).toBe(true);
    if (!prepRes.ok) throw new Error('Prepare failed');

    // User starts publishing (triggers slow recheck)
    const pubPromise = service.publishResource(
      contextId,
      'req-pub-recheck',
      prepRes.value.sourceToken,
      10,
      'Recheck Synth',
      null,
    );

    // While recheck is in flight, account is replaced by User B!
    await service.signIn(contextId, 'req-login-b', TEST_USERS[1].email, TEST_USERS[1].password);

    // Now resolve recheck
    resolveRecheck!({
      ok: true,
      value: {
        key,
        revision: 1,
        displayName: 'Recheck Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        description: 'Recheck desc',
        xml: '<instrument type="blue.orchestra.GenericInstrument"><name>Recheck Synth</name></instrument>',
      },
    });

    const pubRes = await pubPromise;
    expect(pubRes.ok).toBe(false);
    if (pubRes.ok) throw new Error('Expected publish to be fenced');
    expect(pubRes.error.code).toBe('fenced');

    // Verify no resource was published to server under User A or User B
    const mineB = await service.listMine(contextId, 'req-mine-b', 'instrument');
    expect(mineB.ok).toBe(true);
    if (!mineB.ok) throw new Error('List mine failed');
    expect(mineB.value.items.some((it) => it.name === 'Recheck Synth')).toBe(false);
  });

  it('treats HTTP 200 publish response as uncertain outcome and retains snapshot (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'POST' && opts.url.includes('/resources')) {
        return {
          status: 200, // unexpected status: 200 instead of 201 Created
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'instrument',
            id: 999,
            name: 'HTTP 200 Synth',
            description: null,
            blueType: 'blue.orchestra.GenericInstrument',
            category: { id: 10, name: 'Synths' },
            author: { id: TEST_USERS[0].id, name: 'Steven', username: 'steven' },
            xml: '<instrument type="blue.orchestra.GenericInstrument"><name>HTTP 200 Synth</name></instrument>',
          }),
        };
      }
      return origHandle(opts);
    };
    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(30);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);
    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    const pubRes = await service.publishResource(
      contextId,
      'req-pub-200',
      prepRes.value.sourceToken,
      10,
      'HTTP 200 Synth',
      null,
    );

    expect(pubRes.ok).toBe(false);
    if (pubRes.ok) throw new Error('Expected HTTP 200 publish to be rejected as uncertain');
    expect(pubRes.error.code).toBe('unexpected_status');
    expect(pubRes.error.status).toBe(200);
    expect(pubRes.error.outcome).toBe('unknown');

    // Snapshot is retained
    expect((service as any).dialogs.get(contextId)?.publishSource).not.toBeNull();
  });

  it('treats malformed 201 publish responses as uncertain outcome and retains snapshot (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let injectedPayload: { status: number; body: string } = {
      status: 201,
      body: '<not>json</not>',
    };
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'POST' && opts.url.includes('/resources')) {
        return {
          status: injectedPayload.status,
          headers: { 'content-type': 'application/json' },
          body: injectedPayload.body,
        };
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(31);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);
    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    // Case 1: non-JSON body on 201
    injectedPayload = { status: 201, body: 'Not JSON text' };
    let res = await service.publishResource(
      contextId,
      'req-pub-bad1',
      prepRes.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected failure');
    expect(res.error.outcome).toBe('unknown');
    expect((service as any).dialogs.get(contextId)?.publishSource).not.toBeNull();

    // Immediate retry is blocked while uncertain (T064)
    const blockedRes = await service.publishResource(
      contextId,
      'req-pub-blocked',
      prepRes.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(blockedRes.ok).toBe(false);
    if (!blockedRes.ok) {
      expect(blockedRes.error.code).toBe('reconciliation_required');
      expect(blockedRes.error.outcome).toBe('unknown');
    }

    // Reconcile via listMine
    await service.listMine(contextId, 'req-mine-1', 'instrument', null);

    // Case 2: Mismatched kind on 201 (e.g. server returned effect instead of instrument)
    injectedPayload = {
      status: 201,
      body: JSON.stringify({
        kind: 'effect',
        id: 999,
        name: 'Synth',
        description: null,
        blueType: null,
        category: { id: 10, name: 'Synths' },
        author: { id: TEST_USERS[0].id, name: 'Steven', username: 'steven' },
        xml: '<effect/>',
      }),
    };
    res = await service.publishResource(
      contextId,
      'req-pub-bad2',
      prepRes.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected failure');
    expect(res.error.code).toBe('invalid_response');
    expect(res.error.outcome).toBe('unknown');
    expect((service as any).dialogs.get(contextId)?.publishSource).not.toBeNull();

    // Reconcile via listMine
    await service.listMine(contextId, 'req-mine-2', 'instrument', null);

    // Case 3: Mismatched category on 201
    injectedPayload = {
      status: 201,
      body: JSON.stringify({
        kind: 'instrument',
        id: 999,
        name: 'Synth',
        description: null,
        blueType: 'blue.orchestra.GenericInstrument',
        category: { id: 9999, name: 'Other Category' },
        author: { id: TEST_USERS[0].id, name: 'Steven', username: 'steven' },
        xml: '<instrument type="blue.orchestra.GenericInstrument"><name>Synth</name></instrument>',
      }),
    };
    res = await service.publishResource(
      contextId,
      'req-pub-bad3',
      prepRes.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected failure');
    expect(res.error.code).toBe('invalid_response');
    expect(res.error.outcome).toBe('unknown');
    expect((service as any).dialogs.get(contextId)?.publishSource).not.toBeNull();

    // Reconcile via listMine
    await service.listMine(contextId, 'req-mine-3', 'instrument', null);

    // Case 4: Mismatched author/owner on 201
    injectedPayload = {
      status: 201,
      body: JSON.stringify({
        kind: 'instrument',
        id: 999,
        name: 'Synth',
        description: null,
        blueType: 'blue.orchestra.GenericInstrument',
        category: { id: 10, name: 'Synths' },
        author: { id: 'other-user', name: 'Other', username: 'other' },
        xml: '<instrument type="blue.orchestra.GenericInstrument"><name>Synth</name></instrument>',
      }),
    };
    res = await service.publishResource(
      contextId,
      'req-pub-bad4',
      prepRes.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected failure');
    expect(res.error.code).toBe('invalid_response');
    expect(res.error.outcome).toBe('unknown');
    expect((service as any).dialogs.get(contextId)?.publishSource).not.toBeNull();
  });

  it('treats ambiguous 500 / 502 server errors as uncertain outcome and retains snapshot (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let injectedStatus = 500;
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'POST' && opts.url.includes('/resources')) {
        return {
          status: injectedStatus,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            error: { code: 'server_error', message: 'Internal Server Error' },
          }),
        };
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(32);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);
    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    // 500 Internal Error
    injectedStatus = 500;
    let res = await service.publishResource(
      contextId,
      'req-pub-500',
      prepRes.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected 500 to fail');
    expect(res.error.status).toBe(500);
    expect(res.error.outcome).toBe('unknown');
    expect((service as any).dialogs.get(contextId)?.publishSource).not.toBeNull();

    // Immediate second publish attempt is blocked while uncertain (T064)
    const blockedRes = await service.publishResource(
      contextId,
      'req-pub-blocked',
      prepRes.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(blockedRes.ok).toBe(false);
    if (!blockedRes.ok) {
      expect(blockedRes.error.code).toBe('reconciliation_required');
      expect(blockedRes.error.outcome).toBe('unknown');
    }

    // Re-selection is also blocked while uncertain (T064)
    const reselectBlocked = await service.preparePublishSource(contextId, 'req-reselect', key, 1);
    expect(reselectBlocked.ok).toBe(false);
    if (!reselectBlocked.ok) {
      expect(reselectBlocked.error.code).toBe('reconciliation_required');
      expect(reselectBlocked.error.outcome).toBe('unknown');
    }

    // Reconcile via listMine
    await service.listMine(contextId, 'req-mine', 'instrument', null);

    // 502 Bad Gateway (now permitted after reconciliation)
    injectedStatus = 502;
    res = await service.publishResource(
      contextId,
      'req-pub-502',
      prepRes.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('Expected 502 to fail');
    expect(res.error.status).toBe(502);
    expect(res.error.outcome).toBe('unknown');
    expect((service as any).dialogs.get(contextId)?.publishSource).not.toBeNull();
  });

  it('rejects invalid or oversized publish inputs before protected dispatch with actionable field errors (T065)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const handleSpy = vi.spyOn(fakeServer, 'handleRequest');
    const transport = createConnectedTransport(fakeServer);
    const mockLibrary = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(33);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);
    handleSpy.mockClear();
    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };
    const prepRes = await service.preparePublishSource(contextId, 'req-prep', key, 1);
    if (!prepRes.ok) throw new Error('Prepare failed');

    // Case 1: Invalid category ID (0)
    const badCatRes = await service.publishResource(
      contextId,
      'req-pub-bad-cat',
      prepRes.value.sourceToken,
      0,
      'Synth',
      null,
    );
    expect(badCatRes.ok).toBe(false);
    if (!badCatRes.ok) {
      expect(badCatRes.error.code).toBe('validation_error');
      expect(badCatRes.error.outcome).toBe('rejected');
      expect(badCatRes.error.fields?.categoryId).toBeDefined();
    }
    expect(handleSpy).not.toHaveBeenCalled();

    // Case 2: Empty name
    const emptyNameRes = await service.publishResource(
      contextId,
      'req-pub-empty-name',
      prepRes.value.sourceToken,
      10,
      '   ',
      null,
    );
    expect(emptyNameRes.ok).toBe(false);
    if (!emptyNameRes.ok) {
      expect(emptyNameRes.error.code).toBe('validation_error');
      expect(emptyNameRes.error.fields?.name).toBeDefined();
    }
    expect(handleSpy).not.toHaveBeenCalled();

    // Case 3: Oversized description (> 64 KiB)
    const hugeDesc = 'd'.repeat(64 * 1024 + 1);
    const hugeDescRes = await service.publishResource(
      contextId,
      'req-pub-huge-desc',
      prepRes.value.sourceToken,
      10,
      'Synth',
      hugeDesc,
    );
    expect(hugeDescRes.ok).toBe(false);
    if (!hugeDescRes.ok) {
      expect(hugeDescRes.error.code).toBe('validation_error');
      expect(hugeDescRes.error.fields?.description).toMatch(/64 KiB/);
    }
    expect(handleSpy).not.toHaveBeenCalled();

    // Case 4: Mismatched root or type (mock library bumping XML to mismatched type)
    mockLibrary.bumpRevision(
      '<instrument type="blue.orchestra.OtherInstrument"><name>Mismatched</name></instrument>',
    );
    // Prepare fresh source with mismatched XML
    const prepMismatched = await service.preparePublishSource(
      contextId,
      'req-prep-mismatch',
      key,
      2,
    );
    if (!prepMismatched.ok) throw new Error('Prepare mismatch failed');

    const mismatchRes = await service.publishResource(
      contextId,
      'req-pub-mismatch',
      prepMismatched.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(mismatchRes.ok).toBe(false);
    if (!mismatchRes.ok) {
      expect(mismatchRes.error.code).toBe('validation_error');
      expect(mismatchRes.error.fields?.blueType).toMatch(/does not match XML root type attribute/);
    }
    expect(handleSpy).not.toHaveBeenCalled();

    // Case 5: Unsafe XML declaration (DOCTYPE / ENTITY)
    mockLibrary.bumpRevision(
      '<!DOCTYPE foo><instrument type="blue.orchestra.GenericInstrument"><name>XXE</name></instrument>',
    );
    const prepUnsafe = await service.preparePublishSource(contextId, 'req-prep-unsafe', key, 3);
    if (!prepUnsafe.ok) throw new Error('Prepare unsafe failed');

    const unsafeRes = await service.publishResource(
      contextId,
      'req-pub-unsafe',
      prepUnsafe.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(unsafeRes.ok).toBe(false);
    if (!unsafeRes.ok) {
      expect(unsafeRes.error.code).toBe('validation_error');
      expect(unsafeRes.error.fields?.xml).toMatch(/DOCTYPE, ENTITY, or XInclude/);
    }
    expect(handleSpy).not.toHaveBeenCalled();

    // Case 6: Excessive XML depth (> 128)
    let deepXml = '<instrument type="blue.orchestra.GenericInstrument">';
    for (let i = 0; i < 128; i++) deepXml += '<level>';
    for (let i = 0; i < 128; i++) deepXml += '</level>';
    deepXml += '</instrument>';
    mockLibrary.bumpRevision(deepXml);
    const prepDeep = await service.preparePublishSource(contextId, 'req-prep-deep', key, 4);
    if (!prepDeep.ok) throw new Error('Prepare deep failed');

    const deepRes = await service.publishResource(
      contextId,
      'req-pub-deep',
      prepDeep.value.sourceToken,
      10,
      'Synth',
      null,
    );
    expect(deepRes.ok).toBe(false);
    if (!deepRes.ok) {
      expect(deepRes.error.code).toBe('validation_error');
      expect(deepRes.error.fields?.xml).toMatch(/maximum depth limit of 128/);
    }
    expect(handleSpy).not.toHaveBeenCalled();
  });

  it('preserves exact description including blank strings and line breaks, and proves local resource remains unchanged (T066)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let lastPostedBody: any = null;
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.method === 'POST' && opts.url.includes('/resources')) {
        lastPostedBody = JSON.parse(opts.body as string);
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const initialXml =
      '<instrument type="blue.orchestra.GenericInstrument"><name>Unchanged Synth</name></instrument>';
    const mockLibrary = createMockLibraryService(initialXml);
    const service = new BlueShareService({ transport, libraryService: mockLibrary });
    const sender = createMockSender(34);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login', TEST_USERS[0].email, TEST_USERS[0].password);
    const key: LibraryItemKey = { scope: 'user', libraryType: 'instrument', nodeId: 'inst-1' };

    // Case 1: Whitespace and significant line breaks
    const prepRes1 = await service.preparePublishSource(contextId, 'req-prep-1', key, 1);
    if (!prepRes1.ok) throw new Error('Prepare failed');

    const exactDescription = '  Leading and trailing whitespace  \n\nSecond line\r\nThird line  ';
    const pubRes1 = await service.publishResource(
      contextId,
      'req-pub-1',
      prepRes1.value.sourceToken,
      10,
      'Synth Name',
      exactDescription,
    );
    expect(pubRes1.ok).toBe(true);
    expect(lastPostedBody.description).toBe(exactDescription);

    // Case 2: Exact blank string (not trimmed to null or stripped)
    const prepRes2 = await service.preparePublishSource(contextId, 'req-prep-2', key, 1);
    if (!prepRes2.ok) throw new Error('Prepare failed');

    const pubRes2 = await service.publishResource(
      contextId,
      'req-pub-2',
      prepRes2.value.sourceToken,
      10,
      'Synth Name',
      '',
    );
    expect(pubRes2.ok).toBe(true);
    expect(lastPostedBody.description).toBe('');

    // Verification: local library resource remains completely unchanged
    const localCheck = await mockLibrary.capturePublishSource({ key, expectedRevision: 1 });
    expect(localCheck.ok).toBe(true);
    if (localCheck.ok) {
      expect(localCheck.value.displayName).toBe('Test Instrument');
      expect(localCheck.value.description).toBe('Seeded description');
      expect(localCheck.value.xml).toBe(initialXml);
      expect(localCheck.value.revision).toBe(1);
    }
  });
});

it('reset invalidates pending preparation before a token can be installed (T084)', async () => {
  const server = new FakeBlueShareServer();
  let finish!: (value: any) => void;
  const service = new BlueShareService({
    transport: createConnectedTransport(server),
    libraryService: {
      capturePublishSource: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  });
  const opened = service.openDialog(createMockSender(90));
  if (!opened.ok) throw new Error('open');
  const ctx = opened.value.contextId;
  await service.signIn(ctx, 'login', TEST_USERS[0].email, TEST_USERS[0].password);
  const key = { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'synthetic' };
  const pending = service.preparePublishSource(ctx, 'prepare', key, 1);
  expect(service.clearPublishSource(ctx).ok).toBe(true);
  finish({
    ok: true,
    value: {
      key,
      revision: 1,
      displayName: 'Synthetic',
      blueType: 'blue.orchestra.GenericInstrument',
      description: '',
      xml: '<instrument type="blue.orchestra.GenericInstrument"/>',
    },
  });
  expect((await pending).ok).toBe(false);
  service.shutdown();
});

it('an older publish completion releases only its own source snapshot (T078)', async () => {
  const server = new FakeBlueShareServer();
  const transport = createConnectedTransport(server);
  const libraryService = createMockLibraryService();
  const service = new BlueShareService({ transport, libraryService });
  const opened = service.openDialog(createMockSender(91));
  if (!opened.ok) throw new Error('open');
  const ctx = opened.value.contextId;
  await service.signIn(ctx, 'login', TEST_USERS[0].email, TEST_USERS[0].password);
  const key = { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'first' };
  const first = await service.preparePublishSource(ctx, 'first', key, 1);
  if (!first.ok) throw new Error('prepare');
  let finish!: (response: any) => void;
  let markDispatched!: () => void;
  const dispatched = new Promise<void>((resolve) => {
    markDispatched = resolve;
  });
  const send = transport.sendRequest.bind(transport);
  vi.spyOn(transport, 'sendRequest').mockImplementation((options) =>
    options.method === 'POST' && options.routePath.endsWith('/resources')
      ? new Promise((resolve) => {
          finish = resolve;
          markDispatched();
        })
      : send(options),
  );
  const publishing = service.publishResource(
    ctx,
    'publish',
    first.value.sourceToken,
    10,
    'description',
  );
  await dispatched;
  const newer = await service.preparePublishSource(ctx, 'newer', { ...key, nodeId: 'newer' }, 1);
  if (!newer.ok) throw new Error('new prepare');
  finish({
    status: 201,
    headers: {},
    body: JSON.stringify({
      ...server.getDetail('instrument', 2),
      id: 100,
      category: { id: 10, name: 'Synthetic' },
    }),
  });
  expect((await publishing).ok).toBe(true);
  const dialog = service.validateDialog(ctx);
  if ('code' in dialog) throw new Error('context');
  expect(dialog.publishSource?.token).toBe(newer.value.sourceToken);
  service.shutdown();
});

it.each(['preparation', 'preflight'])(
  'bounds stalled source %s without sending a late POST (T092)',
  async (phase) => {
    vi.useFakeTimers();
    const server = new FakeBlueShareServer();
    const transport = createConnectedTransport(server);
    const libraryService = createMockLibraryService();
    const service = new BlueShareService({ transport, libraryService });
    try {
      const { contextId } = (service.openDialog(createMockSender(92)) as any).value;
      await service.signIn(contextId, 'login', TEST_USERS[0].email, TEST_USERS[0].password);
      const key = { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'n1' };
      const seed =
        phase === 'preflight'
          ? await service.preparePublishSource(contextId, 'seed', key, 1)
          : null;
      const capture = libraryService.capturePublishSource.bind(libraryService);
      let finish!: (value: any) => void;
      vi.spyOn(libraryService, 'capturePublishSource').mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const send = vi.spyOn(transport, 'sendRequest');
      let result: any;
      const pending = (
        phase === 'preparation'
          ? service.preparePublishSource(contextId, 'prepare', key, 1)
          : service.publishResource(
              contextId,
              'publish',
              (seed as any).value.sourceToken,
              10,
              'exact draft',
            )
      ).then((value) => {
        result = value;
      });
      await vi.advanceTimersByTimeAsync(30001);
      expect(result?.ok).toBe(false);
      expect(result.error.outcome).toBe('rejected');
      expect(result.error.code).toBe('timeout');
      finish(await capture({ key, expectedRevision: 1 }));
      await pending;
      await Promise.resolve();
      expect(send).not.toHaveBeenCalled();
      const dialog = service.validateDialog(contextId);
      if ('code' in dialog) throw new Error('context');
      expect(dialog.activeOperation).toBeNull();
      if (phase === 'preparation') expect(dialog.publishSource).toBeNull();
    } finally {
      service.shutdown();
      vi.useRealTimers();
    }
  },
);

it.each(['publish', 'remove'])(
  'does not mark an undispatched native %s as uncertain (T088)',
  async (operation) => {
    const server = new FakeBlueShareServer();
    const transport = createConnectedTransport(server);
    const service = new BlueShareService({ transport, libraryService: createMockLibraryService() });
    const { contextId } = (service.openDialog(createMockSender(94)) as any).value;
    await service.signIn(contextId, 'login', TEST_USERS[0].email, TEST_USERS[0].password);
    const seed = await service.preparePublishSource(
      contextId,
      'prepare',
      { scope: 'user', libraryType: 'instrument', nodeId: 'n1' },
      1,
    );
    vi.spyOn(transport, 'sendRequest').mockRejectedValueOnce(
      new BlueShareNotDispatchedError('busy'),
    );
    const result =
      operation === 'publish'
        ? await service.publishResource(
            contextId,
            'publish',
            (seed as any).value.sourceToken,
            10,
            'exact',
          )
        : await service.removeResource(contextId, 'remove', { kind: 'instrument', id: 2 });
    expect(result).toMatchObject({ ok: false, error: { code: 'busy', outcome: 'rejected' } });
    const dialog = service.validateDialog(contextId);
    if ('code' in dialog) throw new Error('context');
    expect(dialog.uncertainPublishToken).toBeNull();
    expect(dialog.uncertainRemoveKey).toBeNull();
    expect(dialog.activeOperation).toBeNull();
    service.shutdown();
  },
);

it('passes only the remaining request budget to a POST after local source recheck (T092)', async () => {
  vi.useFakeTimers();
  const server = new FakeBlueShareServer();
  const transport = createConnectedTransport(server);
  const libraryService = createMockLibraryService();
  const service = new BlueShareService({ transport, libraryService });
  try {
    const { contextId } = (service.openDialog(createMockSender(95)) as any).value;
    await service.signIn(contextId, 'login', TEST_USERS[0].email, TEST_USERS[0].password);
    const key = { scope: 'user' as const, libraryType: 'instrument' as const, nodeId: 'n1' };
    const seed = await service.preparePublishSource(contextId, 'prepare', key, 1);
    const source = await libraryService.capturePublishSource({ key, expectedRevision: 1 });
    vi.spyOn(libraryService, 'capturePublishSource').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(source), 20_000);
        }),
    );
    const send = vi.spyOn(transport, 'sendRequest');
    const publishing = service.publishResource(
      contextId,
      'publish',
      (seed as any).value.sourceToken,
      10,
      'exact',
    );
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await publishing).ok).toBe(true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', timeoutMs: 10_000 }),
    );
  } finally {
    service.shutdown();
    vi.useRealTimers();
  }
});
