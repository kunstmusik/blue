import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlueShareService } from './service';
import { BlueShareTransport, type TransportResponse } from './transport';
import { RememberedSessionStore, type RememberedSession } from './remembered-session';

const origin = 'https://blue.example.invalid';
const user = { id: '1', name: 'Example', username: 'example' };
const record: RememberedSession = {
  version: 1,
  origin,
  expiresAt: new Date(Date.now() + 7 * 86400_000 - 1000).toISOString(),
  cookies: [
    {
      name: 'session',
      value: 'synthetic-proof',
      domain: 'blue.example.invalid',
      path: '/',
      secure: true,
      httpOnly: true,
      hostOnly: true,
      sameSite: 'lax',
    },
  ],
};
const directories: string[] = [];
const response = (value: unknown, status = 200): TransportResponse => ({
  status,
  headers: {},
  body: JSON.stringify(value),
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'blue-remember-service-'));
  directories.push(dir);
  const store = new RememberedSessionStore({
    filePath: join(dir, 'session.enc'),
    origin,
    encryption: {
      isEncryptionAvailable: () => true,
      encryptString: (s) => Buffer.from(s).reverse(),
      decryptString: (b) => Buffer.from(b).reverse().toString(),
    },
  });
  const request = vi.fn(async ({ method }: { method: string }) =>
    method === 'DELETE'
      ? response({ signedOut: true })
      : response({ user, expiresAt: record.expiresAt }),
  );
  const transport = new BlueShareTransport({ origin, requestAdapter: request });
  vi.spyOn(transport, 'snapshotCookies').mockResolvedValue(record.cookies);
  vi.spyOn(transport, 'restoreCookies').mockResolvedValue();
  const service = new BlueShareService({ transport, rememberedSession: store });
  const opened = service.openDialog({ id: 1, isDestroyed: () => false });
  if (!opened.ok) throw Error('open');
  return {
    store,
    request,
    transport,
    service,
    ctx: opened.value.contextId,
    filePath: join(dir, 'session.enc'),
  };
}
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('remembered account lifecycle', () => {
  it('saves only opted-in proof after server expiry validation and restores only after verification', async () => {
    const f = await fixture();
    const signed = await f.service.signIn(
      f.ctx,
      'login',
      'user@example.invalid',
      'secret',
      undefined,
      true,
    );
    expect(signed.ok).toBe(true);
    expect(f.request.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.invalid', password: 'secret', rememberMe: true }),
    });
    expect(await f.store.load()).toEqual(record);
    f.service.shutdown();
    const next = new BlueShareService({ transport: f.transport, rememberedSession: f.store });
    const opened = next.openDialog({ id: 2, isDestroyed: () => false });
    if (!opened.ok) throw Error('open');
    expect(opened.value.account.state).toBe('signedOut');
    const checked = await next.getAccount(opened.value.contextId);
    expect(checked).toMatchObject({ ok: true, value: { state: 'signedIn', user } });
    expect(f.transport.restoreCookies).toHaveBeenCalledWith(
      record.cookies,
      record.expiresAt,
      expect.any(Function),
    );
    await next.signOut(opened.value.contextId, 'out');
    expect(await f.store.load()).toBeNull();
  });
  it('ordinary login retires older remembered proof and sends the compatible body', async () => {
    const f = await fixture();
    await f.store.save(record);
    await f.service.signIn(f.ctx, 'login', 'user@example.invalid', 'secret');
    expect(await f.store.load()).toBeNull();
    expect(f.request.mock.calls[0][0]).toMatchObject({
      body: JSON.stringify({ email: 'user@example.invalid', password: 'secret' }),
    });
  });
  it('keeps unverified proof on a temporary outage, disables protected state, and permits explicit retry', async () => {
    const f = await fixture();
    await f.store.save(record);
    f.request.mockRejectedValueOnce(Error('offline'));
    expect(await f.service.getAccount(f.ctx)).toMatchObject({
      ok: true,
      value: { state: 'unavailable', user: null },
    });
    expect(await f.store.load()).toEqual(record);
    expect(await f.service.getAccount(f.ctx)).toMatchObject({
      ok: true,
      value: { state: 'signedIn', user },
    });
  });
  it('clears server-revoked proof', async () => {
    const f = await fixture();
    await f.store.save(record);
    f.request.mockResolvedValueOnce(
      response({ error: { code: 'UNAUTHENTICATED', message: 'Expired' } }, 401),
    );
    expect(await f.service.getAccount(f.ctx)).toMatchObject({
      ok: true,
      value: { state: 'signedOut' },
    });
    expect(await f.store.load()).toBeNull();
  });
  it('logout wins over a delayed restore response', async () => {
    const f = await fixture();
    await f.store.save(record);
    let release!: (r: TransportResponse) => void;
    f.request.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const restoring = f.service.getAccount(f.ctx);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await f.service.signOut(f.ctx, 'out');
    release(response({ user, expiresAt: record.expiresAt }));
    await restoring;
    expect(f.service.getAccountSnapshot().state).toBe('signedOut');
    expect(await f.store.load()).toBeNull();
  });
  it('logout wins over delayed source cookie capture and an obsolete login', async () => {
    const f = await fixture();
    let release!: (c: RememberedSession['cookies']) => void;
    vi.mocked(f.transport.snapshotCookies).mockImplementation(
      () => new Promise((r) => (release = r)),
    );
    const login = f.service.signIn(
      f.ctx,
      'login',
      'user@example.invalid',
      'secret',
      undefined,
      true,
    );
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await f.service.signOut(f.ctx, 'out');
    release(record.cookies);
    expect((await login).ok).toBe(false);
    expect(await f.store.load()).toBeNull();
    expect(f.service.getAccountSnapshot().state).toBe('signedOut');
  });
  it('a replacement account wins over an old restore response', async () => {
    const f = await fixture();
    await f.store.save(record);
    let release!: (r: TransportResponse) => void;
    f.request.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const restoring = f.service.getAccount(f.ctx);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const nextUser = { id: '2', name: 'Other', username: 'other' };
    f.request.mockResolvedValueOnce(response({ user: nextUser }));
    await f.service.signIn(f.ctx, 'replacement', 'other@example.invalid', 'secret');
    expect(await f.service.getAccount(f.ctx)).toMatchObject({
      ok: true,
      value: { user: nextUser },
    });
    release(response({ user, expiresAt: record.expiresAt }));
    await restoring;
    expect(f.service.getAccountSnapshot().user).toEqual(nextUser);
    expect(await f.store.load()).toBeNull();
  });
  it('does not retry or silently downgrade an opted-in request rejected by an old server', async () => {
    const f = await fixture();
    f.request.mockResolvedValueOnce(
      response({ error: { code: 'INVALID_INPUT', message: 'Unknown field' } }, 400),
    );
    const result = await f.service.signIn(
      f.ctx,
      'login',
      'user@example.invalid',
      'secret',
      undefined,
      true,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('uncheck') },
    });
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(await f.store.load()).toBeNull();
  });
  it('rejects an expired session even if the verification response claims HTTP success', async () => {
    const f = await fixture();
    f.request
      .mockResolvedValueOnce(response({ user }))
      .mockResolvedValueOnce(response({ user, expiresAt: '2020-01-01T00:00:00Z' }));
    expect(
      (await f.service.signIn(f.ctx, 'login', 'user@example.invalid', 'secret', undefined, true))
        .ok,
    ).toBe(false);
    expect(f.service.getAccountSnapshot().state).toBe('signedOut');
    expect(await f.store.load()).toBeNull();
  });
  it('keeps ordinary sign-in usable when encrypted persistence fails and sanitizes the warning', async () => {
    const f = await fixture();
    vi.spyOn(f.store, 'save').mockRejectedValue(Error('/private/path synthetic-proof'));
    const result = await f.service.signIn(
      f.ctx,
      'login',
      'user@example.invalid',
      'secret',
      undefined,
      true,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { state: 'signedIn', persistenceWarning: expect.any(String) },
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-proof');
    expect(await f.store.load()).toBeNull();
  });
  it('reports local cleanup failure while clearing active identity', async () => {
    const f = await fixture();
    await mkdir(f.filePath);
    const result = await f.service.signOut(f.ctx, 'out');
    expect(result).toMatchObject({ ok: false, error: { code: 'local_session_cleanup_failed' } });
    expect(f.service.getAccountSnapshot().state).toBe('signedOut');
  });
});

describe('bounded account operations', () => {
  it('times out stalled restore storage, permits public browsing, and fences its late identity', async () => {
    const f = await fixture();
    let release!: (value: RememberedSession | null) => void;
    vi.spyOn(f.store, 'load').mockImplementationOnce(() => new Promise((r) => (release = r)));
    vi.useFakeTimers();
    const restore = f.service.getAccount(f.ctx);
    expect(f.service.getAccountSnapshot().state).toBe('unavailable');
    f.request.mockResolvedValueOnce(response({ items: [] }));
    expect((await f.service.getCategories(f.ctx, 'browse', 'instrument')).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await restore).toMatchObject({ ok: true, value: { state: 'unavailable', user: null } });
    release(record);
    await Promise.resolve();
    expect(f.transport.restoreCookies).not.toHaveBeenCalled();
    expect(f.service.getAccountSnapshot().user).toBeNull();
  });

  it('bounds a stalled cleanup and never sends login after it eventually completes', async () => {
    const f = await fixture();
    let release!: () => void;
    vi.spyOn(f.store, 'clear').mockImplementationOnce(
      () => new Promise<void>((r) => (release = r)),
    );
    vi.useFakeTimers();
    const login = f.service.signIn(f.ctx, 'login', 'user@example.invalid', 'secret');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await login).toMatchObject({ ok: false, error: { code: 'timeout' } });
    expect(f.service.getAccountSnapshot()).toMatchObject({ state: 'signedOut', user: null });
    release();
    await Promise.resolve();
    expect(f.request).not.toHaveBeenCalled();
  });

  it('bounds offline forget without falsely confirming deletion or sending a late DELETE', async () => {
    const f = await fixture();
    let release!: () => void;
    vi.spyOn(f.store, 'clear').mockImplementationOnce(
      () => new Promise<void>((r) => (release = r)),
    );
    vi.useFakeTimers();
    const logout = f.service.signOut(f.ctx, 'out');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await logout).toMatchObject({ ok: false, error: { code: 'timeout' } });
    expect(f.service.getAccountSnapshot().persistenceWarning).toContain('could not remove');
    release();
    await Promise.resolve();
    expect(f.request).not.toHaveBeenCalled();
  });

  it('uses one budget for login plus verification and fences a late verified response', async () => {
    const f = await fixture();
    vi.spyOn(f.store, 'clear').mockResolvedValue();
    let release!: (r: TransportResponse) => void;
    f.request.mockImplementationOnce(
      () => new Promise((r) => setTimeout(() => r(response({ user })), 20_000)),
    );
    f.request.mockImplementationOnce(() => new Promise((r) => (release = r)));
    vi.useFakeTimers();
    const login = f.service.signIn(
      f.ctx,
      'login',
      'user@example.invalid',
      'secret',
      undefined,
      true,
    );
    await vi.advanceTimersByTimeAsync(20_000);
    expect(f.request.mock.calls[1][0]).toMatchObject({ method: 'GET', timeoutMs: 10_000 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await login).toMatchObject({ ok: false, error: { code: 'timeout' } });
    release(response({ user, expiresAt: record.expiresAt }));
    await Promise.resolve();
    expect(f.transport.snapshotCookies).not.toHaveBeenCalled();
    expect(f.service.getAccountSnapshot().state).toBe('signedOut');
  });
});

it.each(['snapshotCookies', 'save'] as const)(
  'recovers from stalled %s with verified process-only identity and fences a late save',
  async (stage) => {
    const f = await fixture();
    vi.spyOn(f.store, 'clear').mockResolvedValue();
    let release!: () => void;
    if (stage === 'save')
      vi.spyOn(f.store, 'save').mockImplementationOnce(
        () => new Promise<void>((r) => (release = r)),
      );
    else
      vi.mocked(f.transport.snapshotCookies).mockImplementationOnce(
        () => new Promise((r) => (release = () => r(record.cookies))),
      );
    vi.useFakeTimers();
    const login = f.service.signIn(
      f.ctx,
      'login',
      'user@example.invalid',
      'secret',
      undefined,
      true,
    );
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await login).toMatchObject({
      ok: true,
      value: { state: 'signedIn', user, persistenceWarning: expect.any(String) },
    });
    release();
    await Promise.resolve();
    expect(f.service.getAccountSnapshot().state).toBe('signedIn');
    vi.useRealTimers();
    expect(await f.store.load()).toBeNull();
  },
);

it('confirms completed local cleanup when remote logout exhausts the shared budget', async () => {
  const f = await fixture();
  vi.spyOn(f.store, 'clear').mockResolvedValue();
  f.request.mockImplementationOnce(() => new Promise(() => {}));
  vi.useFakeTimers();
  const logout = f.service.signOut(f.ctx, 'out');
  await vi.advanceTimersByTimeAsync(30_000);
  expect(await logout).toEqual({
    ok: true,
    value: { signedOut: true, remoteRevocationConfirmed: false },
  });
  expect(f.service.getAccountSnapshot()).toMatchObject({ state: 'signedOut', user: null });
  expect(f.service.getAccountSnapshot().persistenceWarning).toBeUndefined();
});

it('bounds cleanup after an authoritative rejection within the original login budget', async () => {
  const f = await fixture();
  vi.spyOn(f.store, 'clear')
    .mockResolvedValueOnce()
    .mockImplementationOnce(() => new Promise(() => {}));
  f.request.mockResolvedValueOnce(response({ user }));
  f.request.mockResolvedValueOnce(
    response({ error: { code: 'UNAUTHENTICATED', message: 'Expired' } }, 401),
  );
  vi.useFakeTimers();
  const login = f.service.signIn(f.ctx, 'login', 'user@example.invalid', 'secret', undefined, true);
  await vi.advanceTimersByTimeAsync(30_000);
  expect((await login).ok).toBe(false);
  expect(f.service.getAccountSnapshot()).toMatchObject({
    state: 'signedOut',
    user: null,
    persistenceWarning: expect.any(String),
  });
});

it('retires a closed restore so reopening can verify without waiting for its late GET', async () => {
  const f = await fixture();
  await f.store.save(record);
  let release!: (r: TransportResponse) => void;
  f.request.mockImplementationOnce(() => new Promise((r) => (release = r)));
  const old = f.service.getAccount(f.ctx);
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  f.service.closeDialog(f.ctx);
  const reopened = f.service.openDialog({ id: 1, isDestroyed: () => false });
  if (!reopened.ok) throw Error('open');
  const current = await f.service.getAccount(reopened.value.contextId);
  expect(current).toMatchObject({ ok: true, value: { state: 'signedIn', user } });
  release(response({ error: { code: 'UNAUTHENTICATED', message: 'Old response' } }, 401));
  await old;
  expect(f.service.getAccountSnapshot()).toMatchObject({ state: 'signedIn', user });
  expect(await f.store.load()).toEqual(record);
});

it('offline forget removes unavailable proof so the next first use stays anonymous', async () => {
  const f = await fixture();
  await f.store.save(record);
  f.request.mockRejectedValueOnce(Error('offline'));
  expect(await f.service.getAccount(f.ctx)).toMatchObject({
    ok: true,
    value: { state: 'unavailable' },
  });
  f.request.mockRejectedValueOnce(Error('offline'));
  expect(await f.service.signOut(f.ctx, 'forget')).toEqual({
    ok: true,
    value: { signedOut: true, remoteRevocationConfirmed: false },
  });
  f.service.shutdown();
  const next = new BlueShareService({ transport: f.transport, rememberedSession: f.store });
  const opened = next.openDialog({ id: 2, isDestroyed: () => false });
  if (!opened.ok) throw Error('open');
  const calls = f.request.mock.calls.length;
  expect(await next.getAccount(opened.value.contextId)).toMatchObject({
    ok: true,
    value: { state: 'signedOut' },
  });
  expect(f.request).toHaveBeenCalledTimes(calls);
});

it('closing an obsolete restore owner preserves a newer identity from another dialog', async () => {
  const f = await fixture();
  await f.store.save(record);
  let release!: (r: TransportResponse) => void;
  f.request.mockImplementationOnce(() => new Promise((r) => (release = r)));
  const restoring = f.service.getAccount(f.ctx);
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  const second = f.service.openDialog({ id: 2, isDestroyed: () => false });
  if (!second.ok) throw Error('open');
  await f.service.signIn(second.value.contextId, 'new', 'other@example.invalid', 'secret');
  f.service.setAccountState('unavailable', null);
  f.service.closeDialog(f.ctx);
  expect(f.service.getAccountSnapshot().state).toBe('unavailable');
  release(response({ user, expiresAt: record.expiresAt }));
  await restoring;
  expect(f.service.getAccountSnapshot().state).toBe('unavailable');
});

it('does not claim remote revocation when forgetting proof that was never verified', async () => {
  const f = await fixture();
  await f.store.save(record);
  f.request.mockRejectedValueOnce(Error('offline'));
  expect(await f.service.getAccount(f.ctx)).toMatchObject({
    ok: true,
    value: { state: 'unavailable' },
  });
  // The server can answer signedOut to an anonymous DELETE after restore discarded
  // its unverified native cookies. That is not proof that the saved session was revoked.
  expect(await f.service.signOut(f.ctx, 'forget')).toEqual({
    ok: true,
    value: { signedOut: true, remoteRevocationConfirmed: false },
  });
  expect(await f.store.load()).toBeNull();
});
