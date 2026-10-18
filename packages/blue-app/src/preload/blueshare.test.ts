import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BLUESHARE_CHANNELS } from '../shared/blueshare';

const invoke = vi.hoisted(() => vi.fn());
const on = vi.hoisted(() => vi.fn());
const removeListener = vi.hoisted(() => vi.fn());
const expose = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  clipboard: { writeText: vi.fn(), readText: vi.fn() },
  contextBridge: { exposeInMainWorld: expose },
  ipcRenderer: { invoke, on, removeListener },
  webUtils: { getPathForFile: vi.fn(() => '') },
}));

describe('BlueShare Preload API bridge', () => {
  beforeEach(() => {
    invoke.mockReset();
    on.mockReset();
    removeListener.mockReset();
    expose.mockClear();
    vi.resetModules();
  });

  it('exposes typed BlueShare methods and forwards calls to ipcRenderer', async () => {
    await import('./preload');
    const blueAPI = expose.mock.calls.find(([name]) => name === 'blueAPI')![1] as any;

    expect(typeof blueAPI.openBlueShare).toBe('function');
    expect(typeof blueAPI.getBlueShareAccount).toBe('function');
    expect(typeof blueAPI.signInBlueShare).toBe('function');
    expect(typeof blueAPI.signOutBlueShare).toBe('function');
    expect(typeof blueAPI.getBlueShareCategories).toBe('function');
    expect(typeof blueAPI.listBlueShareResources).toBe('function');
    expect(typeof blueAPI.getBlueShareLatest).toBe('function');
    expect(typeof blueAPI.getBlueShareResource).toBe('function');
    expect(typeof blueAPI.importBlueShareResource).toBe('function');
    expect(typeof blueAPI.prepareBlueSharePublish).toBe('function');
    expect(typeof blueAPI.publishBlueShareResource).toBe('function');
    expect(typeof blueAPI.listBlueShareMine).toBe('function');
    expect(typeof blueAPI.removeBlueShareResource).toBe('function');
    expect(typeof blueAPI.openBlueShareWebsite).toBe('function');
    expect(typeof blueAPI.closeBlueShare).toBe('function');
    expect(typeof blueAPI.onBlueShareAccountChanged).toBe('function');

    // 1. openBlueShare
    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        contextId: 'ctx-1',
        serviceScope: 'https://blue3.kunstmusik.com',
        account: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 1 },
      },
    });
    const openRes = await blueAPI.openBlueShare();
    expect(invoke).toHaveBeenCalledWith(BLUESHARE_CHANNELS.OPEN);
    expect(openRes.ok).toBe(true);

    // 2. getBlueShareAccount
    invoke.mockResolvedValueOnce({
      ok: true,
      value: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 1 },
    });
    const accountRes = await blueAPI.getBlueShareAccount('ctx-1');
    expect(invoke).toHaveBeenCalledWith(BLUESHARE_CHANNELS.GET_ACCOUNT, 'ctx-1');
    expect(accountRes.ok).toBe(true);

    // 3. importBlueShareResource
    invoke.mockResolvedValueOnce({
      ok: true,
      value: { contentRevision: 5, affectedNodes: [] },
    });
    const importRes = await blueAPI.importBlueShareResource('ctx-1', 'req-1', {
      kind: 'instrument',
      id: 42,
    });
    expect(invoke).toHaveBeenCalledWith(BLUESHARE_CHANNELS.IMPORT_RESOURCE, 'ctx-1', 'req-1', {
      kind: 'instrument',
      id: 42,
    });
    expect(importRes.ok).toBe(true);

    // 4. signInBlueShare
    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        state: 'signedIn',
        user: { id: 'u1', name: 'Steven', username: 'steven' },
        expiresAt: null,
        accountEpoch: 2,
      },
    });
    const signInRes = await blueAPI.signInBlueShare(
      'ctx-1',
      'req-2',
      'steven@example.com',
      'secret',
    );
    expect(invoke).toHaveBeenCalledWith(
      BLUESHARE_CHANNELS.SIGN_IN,
      'ctx-1',
      'req-2',
      'steven@example.com',
      'secret',
    );
    expect(signInRes.ok).toBe(true);

    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        state: 'signedIn',
        user: { id: 'u1', name: 'Steven', username: 'steven' },
        expiresAt: null,
        accountEpoch: 2,
        persistenceWarning: 'Unable to remember this session.',
      },
    });
    const remembered = await blueAPI.signInBlueShare(
      'ctx-1',
      'req-remember',
      'steven@example.com',
      'secret',
      true,
    );
    expect(invoke).toHaveBeenLastCalledWith(
      BLUESHARE_CHANNELS.SIGN_IN,
      'ctx-1',
      'req-remember',
      'steven@example.com',
      'secret',
      true,
    );
    expect(remembered.ok).toBe(true);

    // 5. signOutBlueShare
    invoke.mockResolvedValueOnce({
      ok: true,
      value: { signedOut: true, remoteRevocationConfirmed: true },
    });
    const signOutRes = await blueAPI.signOutBlueShare('ctx-1', 'req-3');
    expect(invoke).toHaveBeenCalledWith(BLUESHARE_CHANNELS.SIGN_OUT, 'ctx-1', 'req-3');
    expect(signOutRes.ok).toBe(true);

    // 6. listBlueShareMine
    invoke.mockResolvedValueOnce({ ok: true, value: { items: [], nextBeforeId: null } });
    const mineRes = await blueAPI.listBlueShareMine('ctx-1', 'req-4', 'instrument', 50);
    expect(invoke).toHaveBeenCalledWith(
      BLUESHARE_CHANNELS.LIST_MINE,
      'ctx-1',
      'req-4',
      'instrument',
      50,
    );
    expect(mineRes.ok).toBe(true);

    // 7. prepareBlueSharePublish
    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        sourceToken: 'token-abc',
        kind: 'instrument',
        name: 'My Synth',
        blueType: 'blue.orchestra.GenericInstrument',
        descriptionSeed: 'Seed description',
        byteLength: 1234,
      },
    });
    const prepRes = await blueAPI.prepareBlueSharePublish(
      'ctx-1',
      'req-prep',
      {
        scope: 'user',
        libraryType: 'instrument',
        nodeId: 'node-1',
      },
      3,
    );
    expect(invoke).toHaveBeenCalledWith(
      BLUESHARE_CHANNELS.PREPARE_PUBLISH,
      'ctx-1',
      'req-prep',
      { scope: 'user', libraryType: 'instrument', nodeId: 'node-1' },
      3,
    );
    expect(prepRes.ok).toBe(true);

    // 8. publishBlueShareResource
    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        kind: 'instrument',
        id: 99,
        name: 'My Synth',
        description: 'Final description',
        blueType: 'blue.orchestra.GenericInstrument',
        createdAt: '2026-01-01T00:00:00Z',
        category: { id: 10, name: 'Synths' },
        author: { id: 'u1', name: 'Steven', username: 'steven' },
      },
    });
    const pubRes = await blueAPI.publishBlueShareResource(
      'ctx-1',
      'req-pub',
      'token-abc',
      10,
      'Final description',
    );
    expect(invoke).toHaveBeenCalledWith(
      BLUESHARE_CHANNELS.PUBLISH_RESOURCE,
      'ctx-1',
      'req-pub',
      'token-abc',
      10,
      'Final description',
    );
    expect(pubRes.ok).toBe(true);

    // 9. removeBlueShareResource
    invoke.mockResolvedValueOnce({
      ok: true,
      value: { kind: 'instrument', id: 42, removed: true, alreadyRemoved: false },
    });
    const remRes = await blueAPI.removeBlueShareResource('ctx-1', 'req-rem', {
      kind: 'instrument',
      id: 42,
    });
    expect(invoke).toHaveBeenCalledWith(BLUESHARE_CHANNELS.REMOVE_RESOURCE, 'ctx-1', 'req-rem', {
      kind: 'instrument',
      id: 42,
    });
    expect(remRes.ok).toBe(true);

    // 10. openBlueShareWebsite
    invoke.mockResolvedValueOnce({ ok: true, value: { opened: true } });
    const webRes = await blueAPI.openBlueShareWebsite('ctx-1', 'register');
    expect(invoke).toHaveBeenCalledWith(BLUESHARE_CHANNELS.OPEN_WEBSITE, 'ctx-1', 'register');
    expect(webRes.ok).toBe(true);

    // 10. onBlueShareAccountChanged & unsubscribe
    const callback = vi.fn();
    const unsubscribe = blueAPI.onBlueShareAccountChanged(callback);
    expect(on).toHaveBeenCalledWith(BLUESHARE_CHANNELS.ACCOUNT_CHANGED, expect.any(Function));

    const handler = on.mock.calls[0][1];
    handler(
      {},
      {
        state: 'signedIn',
        user: { id: 'u1', name: 'Steven', username: 'steven' },
        expiresAt: null,
        accountEpoch: 2,
      },
    );
    expect(callback).toHaveBeenCalledWith({
      state: 'signedIn',
      user: { id: 'u1', name: 'Steven', username: 'steven' },
      expiresAt: null,
      accountEpoch: 2,
    });

    // Malformed snapshot should NOT trigger callback
    callback.mockClear();
    handler({}, { state: 'signedIn', email: 'secret@leak.com' });
    expect(callback).not.toHaveBeenCalled();

    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(BLUESHARE_CHANNELS.ACCOUNT_CHANGED, handler);
  }, 15000);

  it('rejects malformed IPC results and secret leaks at preload boundary', async () => {
    await import('./preload');
    const blueAPI = expose.mock.calls.find(([name]) => name === 'blueAPI')![1] as any;

    // 1. Malformed payload (not an object)
    invoke.mockResolvedValueOnce('bad-string');
    const badRes = await blueAPI.openBlueShare();
    expect(badRes.ok).toBe(false);
    expect(badRes.error.code).toBe('boundary_contract_violation');

    // 2. Secret leak attempt in account snapshot
    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        state: 'signedIn',
        user: { id: 'u1', name: 'Steven', username: 'steven' },
        email: 'secret@example.com', // Secret leak!
        accountEpoch: 1,
      },
    });
    const leakRes = await blueAPI.getBlueShareAccount('ctx-1');
    expect(leakRes.ok).toBe(false);
    expect(leakRes.error.code).toBe('boundary_contract_violation');

    // 3. Malformed success item in categories
    invoke.mockResolvedValueOnce({
      ok: true,
      value: [{ id: -1, name: 'Invalid' }],
    });
    const catRes = await blueAPI.getBlueShareCategories('ctx-1', 'req-1', 'instrument');
    expect(catRes.ok).toBe(false);
    expect(catRes.error.code).toBe('boundary_contract_violation');

    // 4. Malformed error response
    invoke.mockResolvedValueOnce({
      ok: false,
      error: 'Not a structured error object',
    });
    const errRes = await blueAPI.signOutBlueShare('ctx-1', 'req-2');
    expect(errRes.ok).toBe(false);
    expect(errRes.error.code).toBe('boundary_contract_violation');
  });
});

describe('nested BlueShare preload validation (T074)', () => {
  it('rejects bad nodes, malformed diagnostics and missing service scope', async () => {
    await import('./preload');
    const api = expose.mock.calls.find(([name]) => name === 'blueAPI')![1] as any;
    invoke.mockResolvedValueOnce({
      ok: true,
      value: {
        contextId: 'ctx',
        account: { state: 'signedOut', user: null, expiresAt: null, accountEpoch: 1 },
      },
    });
    expect((await api.openBlueShare()).ok).toBe(false);
    invoke.mockResolvedValueOnce({
      ok: true,
      value: { contentRevision: 1, affectedNodes: [null] },
    });
    expect((await api.importBlueShareResource('ctx', 'r', { kind: 'instrument', id: 1 })).ok).toBe(
      false,
    );
    invoke.mockResolvedValueOnce({
      ok: false,
      error: { code: 'invalid_xml', message: 'Invalid', diagnostics: [null] },
    });
    expect(
      (await api.importBlueShareResource('ctx', 'r', { kind: 'instrument', id: 1 })).error.code,
    ).toBe('boundary_contract_violation');
  });
});

it('checks reset publish requests/results at preload', async () => {
  await import('./preload');
  const api = expose.mock.calls.find(([name]) => name === 'blueAPI')![1] as any;
  invoke.mockResolvedValueOnce({ ok: true, value: { cleared: true } });
  expect((await api.resetBlueSharePublish('ctx', 'request')).ok).toBe(true);
  expect(invoke).toHaveBeenCalledWith(BLUESHARE_CHANNELS.RESET_PUBLISH, 'ctx', 'request');
  invoke.mockResolvedValueOnce({ ok: true, value: { cleared: 'yes' } });
  expect((await api.resetBlueSharePublish('ctx', 'request')).ok).toBe(false);
});
