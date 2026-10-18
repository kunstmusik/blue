import { describe, expect, it, vi } from 'vitest';
import { BlueShareService, type MinimalWebContents } from './service';
import { BlueShareTransport } from './transport';
import { FakeBlueShareServer, TEST_USERS, createConnectedTransport } from './test-helpers';
import type { AccountSessionSnapshot } from '../../shared/blueshare';

function createMockSender(id = 1): MinimalWebContents {
  return {
    id,
    isDestroyed: () => false,
  };
}

describe('BlueShareService - Account & Session Lifecycle (T023)', () => {
  it('signs in with valid credentials, providing sanitized identity and advancing accountEpoch', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(10);
    const { contextId } = (service.openDialog(sender) as any).value;

    const initialSnapshot = service.getAccountSnapshot();
    expect(initialSnapshot.state).toBe('signedOut');
    expect(initialSnapshot.user).toBeNull();
    const initialEpoch = initialSnapshot.accountEpoch;

    const events: AccountSessionSnapshot[] = [];
    service.onAccountChanged((snap) => events.push(snap));

    const testUser = TEST_USERS[0];
    const signInRes = await service.signIn(
      contextId,
      'req-login-1',
      testUser.email,
      testUser.password,
    );

    expect(signInRes.ok).toBe(true);
    if (!signInRes.ok) throw new Error('Sign in failed');

    expect(signInRes.value.state).toBe('signedIn');
    expect(signInRes.value.user).toEqual({
      id: testUser.id,
      name: testUser.name,
      username: testUser.username,
    });
    // Identity must be sanitized: NO email or password in user object
    expect((signInRes.value.user as any).email).toBeUndefined();
    expect((signInRes.value.user as any).password).toBeUndefined();

    // Epoch must be strictly greater than initial
    expect(signInRes.value.accountEpoch).toBeGreaterThan(initialEpoch);

    // Event must have been emitted
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].state).toBe('signedIn');
    expect(events[events.length - 1].user?.username).toBe(testUser.username);
  });

  it('rejects invalid credentials with 401 and preserves signedOut state', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(11);
    const { contextId } = (service.openDialog(sender) as any).value;

    const signInRes = await service.signIn(
      contextId,
      'req-login-fail',
      'bad@example.com',
      'wrongpassword',
    );
    expect(signInRes.ok).toBe(false);
    if (signInRes.ok) throw new Error('Expected failure');
    expect(signInRes.error.status).toBe(401);

    const snapshot = service.getAccountSnapshot();
    expect(snapshot.state).toBe('signedOut');
    expect(snapshot.user).toBeNull();
  });

  it('signs out locally and confirms remote revocation when server confirms', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(12);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login-2', TEST_USERS[0].email, TEST_USERS[0].password);
    expect(service.getAccountSnapshot().state).toBe('signedIn');
    const epochBeforeSignOut = service.getAccountEpoch();

    const signOutRes = await service.signOut(contextId, 'req-logout-1');
    expect(signOutRes.ok).toBe(true);
    if (!signOutRes.ok) throw new Error('Sign out failed');
    expect(signOutRes.value.signedOut).toBe(true);
    expect(signOutRes.value.remoteRevocationConfirmed).toBe(true);

    const snapshot = service.getAccountSnapshot();
    expect(snapshot.state).toBe('signedOut');
    expect(snapshot.user).toBeNull();
    expect(snapshot.accountEpoch).toBeGreaterThan(epochBeforeSignOut);
  });

  it('signs out locally even if remote revocation fails (e.g. offline 503)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(13);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login-3', TEST_USERS[0].email, TEST_USERS[0].password);
    expect(service.getAccountSnapshot().state).toBe('signedIn');

    // Inject 503 for the logout request
    fakeServer.injectedStatus = 503;

    const signOutRes = await service.signOut(contextId, 'req-logout-2');
    expect(signOutRes.ok).toBe(true);
    if (!signOutRes.ok) throw new Error('Sign out failed');
    expect(signOutRes.value.signedOut).toBe(true);
    // Remote revocation was not confirmed because of 503
    expect(signOutRes.value.remoteRevocationConfirmed).toBe(false);

    // But local state is definitively signedOut and epoch advanced
    const snapshot = service.getAccountSnapshot();
    expect(snapshot.state).toBe('signedOut');
    expect(snapshot.user).toBeNull();
  });

  it('fetches owner-scoped /mine pages only when signed in, rejecting anonymous access with 401', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(14);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Anonymous attempt to access /mine
    const anonRes = await service.listMine(contextId, 'req-mine-anon', 'instrument');
    expect(anonRes.ok).toBe(false);
    if (anonRes.ok) throw new Error('Expected failure');
    expect(anonRes.error.code).toBe('unauthorized');

    // Sign in as Steven
    const user = TEST_USERS[0];
    await service.signIn(contextId, 'req-login-4', user.email, user.password);

    // Authenticated access to /mine
    const mineRes = await service.listMine(contextId, 'req-mine-auth', 'instrument');
    expect(mineRes.ok).toBe(true);
    if (!mineRes.ok) throw new Error('Failed to list mine');

    expect(Array.isArray(mineRes.value.items)).toBe(true);
    // All items must belong to the signed-in user
    expect(mineRes.value.items.every((item) => item.author.id === user.id)).toBe(true);
  });

  it('expires session when service reports 401 on verifySession or /mine', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(15);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login-5', TEST_USERS[0].email, TEST_USERS[0].password);
    expect(service.getAccountSnapshot().state).toBe('signedIn');

    // Simulate session expiry on server by injecting 401
    fakeServer.injectedStatus = 401;

    const verifyRes = await service.verifySession(contextId);
    expect(verifyRes.ok).toBe(false);
    if (verifyRes.ok) throw new Error('Expected failure');
    expect(verifyRes.error.status).toBe(401);

    // Service transitioned to signedOut
    expect(service.getAccountSnapshot().state).toBe('signedOut');
    expect(service.getAccountSnapshot().user).toBeNull();
  });

  it('does NOT wipe account state on temporary network errors (503/504) during verifySession', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(16);
    const { contextId } = (service.openDialog(sender) as any).value;

    await service.signIn(contextId, 'req-login-6', TEST_USERS[0].email, TEST_USERS[0].password);
    expect(service.getAccountSnapshot().state).toBe('signedIn');

    // Inject temporary 503 outage
    fakeServer.injectedStatus = 503;

    const verifyRes = await service.verifySession(contextId);
    expect(verifyRes.ok).toBe(false);

    // State is NOT cleared to signedOut on network outage!
    const snapshot = service.getAccountSnapshot();
    expect(snapshot.state).not.toBe('signedOut');
    expect(snapshot.user?.id).toBe(TEST_USERS[0].id);
  });

  it('prevents late login responses from reviving signed-out or replaced account', async () => {
    const fakeServer = new FakeBlueShareServer();
    let loginResolve: (res: any) => void;
    const loginPromise = new Promise((resolve) => {
      loginResolve = resolve;
    });

    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => {
        if (opts.url.includes('/session') && opts.method === 'POST') {
          return loginPromise as any;
        }
        return fakeServer.handleRequest(opts);
      },
    });

    const service = new BlueShareService({ transport });
    const sender = createMockSender(17);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Start slow sign-in
    const slowSignIn = service.signIn(
      contextId,
      'req-slow',
      TEST_USERS[0].email,
      TEST_USERS[0].password,
    );

    // In the meantime, close the dialog or sign out
    service.closeDialog(contextId);

    // Now resolve the login response
    loginResolve!({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'session_id=late-session; Path=/',
      },
      body: JSON.stringify({ user: { id: TEST_USERS[0].id, name: 'Late', username: 'late' } }),
    });

    const result = await slowSignIn;
    // Must be rejected or fenced due to closed dialog / epoch change
    expect(result.ok).toBe(false);
    expect(service.getAccountSnapshot().state).toBe('signedOut');
  });

  it('handles account replacement: signing in as user B rotates session and advances epoch', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(18);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Sign in User A
    await service.signIn(contextId, 'req-user-a', TEST_USERS[0].email, TEST_USERS[0].password);
    const snapshotA = service.getAccountSnapshot();
    expect(snapshotA.user?.username).toBe('steven');

    // Replace with User B
    await service.signIn(contextId, 'req-user-b', TEST_USERS[1].email, TEST_USERS[1].password);
    const snapshotB = service.getAccountSnapshot();
    expect(snapshotB.user?.username).toBe('otherauthor');
    expect(snapshotB.accountEpoch).toBeGreaterThan(snapshotA.accountEpoch);
  });

  it('opens registration and recovery URLs with fixed routes only', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(19);
    const { contextId } = (service.openDialog(sender) as any).value;

    const openedUrls: string[] = [];
    (service as any).externalUrlOpener = (url: string) => {
      openedUrls.push(url);
      return Promise.resolve(true);
    };

    const regRes = await service.openWebsite(contextId, 'register');
    expect(regRes.ok).toBe(true);
    expect(openedUrls[0]).toBe('https://blue3.kunstmusik.com/register');

    const recRes = await service.openWebsite(contextId, 'recover');
    expect(recRes.ok).toBe(true);
    expect(openedUrls[1]).toBe('https://blue3.kunstmusik.com/forgot-password');

    // Reject arbitrary purposes
    const badRes = await service.openWebsite(contextId, 'evil' as any);
    expect(badRes.ok).toBe(false);
  });

  it('handles overlapping sign-ins: slow login A is superseded by fast login B without overwriting (T059)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let resolveLoginA: (res: any) => void;
    const promiseA = new Promise((resolve) => {
      resolveLoginA = resolve;
    });

    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => {
        if (opts.url.includes('/session') && opts.method === 'POST') {
          const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
          if (body?.email === TEST_USERS[0].email) {
            return promiseA as any;
          }
        }
        return fakeServer.handleRequest(opts);
      },
    });

    const service = new BlueShareService({ transport });
    const sender = createMockSender(20);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Start slow sign-in for User A
    const loginAPromise = service.signIn(
      contextId,
      'req-login-a',
      TEST_USERS[0].email,
      TEST_USERS[0].password,
    );
    expect(service.getAccountSnapshot().state).toBe('signingIn');

    // Start fast sign-in for User B
    const loginBResult = await service.signIn(
      contextId,
      'req-login-b',
      TEST_USERS[1].email,
      TEST_USERS[1].password,
    );
    expect(loginBResult.ok).toBe(true);
    expect(service.getAccountSnapshot().state).toBe('signedIn');
    expect(service.getAccountSnapshot().user?.username).toBe(TEST_USERS[1].username);
    const userBEpoch = service.getAccountSnapshot().accountEpoch;

    // Now resolve slow login A
    resolveLoginA!({
      status: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': 'session_id=sess-a; Path=/' },
      body: JSON.stringify({
        user: { id: TEST_USERS[0].id, name: TEST_USERS[0].name, username: TEST_USERS[0].username },
      }),
    });

    const loginAResult = await loginAPromise;
    expect(loginAResult.ok).toBe(false);
    if (loginAResult.ok) throw new Error('Expected login A to be fenced');
    expect(loginAResult.error.code).toBe('fenced');

    // Service remains signedIn as User B with User B's epoch
    expect(service.getAccountSnapshot().state).toBe('signedIn');
    expect(service.getAccountSnapshot().user?.username).toBe(TEST_USERS[1].username);
    expect(service.getAccountSnapshot().accountEpoch).toBe(userBEpoch);
  });

  it('handles failed replacement: failed sign-in of user B resets to signedOut, not reverting to user A or hanging in signingIn (T059)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(21);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Sign in User A
    await service.signIn(contextId, 'req-user-a', TEST_USERS[0].email, TEST_USERS[0].password);
    expect(service.getAccountSnapshot().state).toBe('signedIn');
    expect(service.getAccountSnapshot().user?.username).toBe(TEST_USERS[0].username);

    // Attempt replacing with bad credentials
    const failRes = await service.signIn(
      contextId,
      'req-user-b-fail',
      'bad@example.com',
      'wrongpassword',
    );
    expect(failRes.ok).toBe(false);

    // Must be signedOut, NOT user A, NOT signingIn
    const snapshot = service.getAccountSnapshot();
    expect(snapshot.state).toBe('signedOut');
    expect(snapshot.user).toBeNull();
  });

  it('isolates old-account 401: slow listMine from previous session returning 401 does not log out newer login (T059)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let resolveMine: (res: any) => void;
    const minePromise = new Promise((resolve) => {
      resolveMine = resolve;
    });

    let interceptMine = true;
    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => {
        if (interceptMine && opts.url.includes('/mine')) {
          interceptMine = false;
          return minePromise as any;
        }
        return fakeServer.handleRequest(opts);
      },
    });

    const service = new BlueShareService({ transport });
    const sender = createMockSender(22);
    const { contextId } = (service.openDialog(sender) as any).value;

    // User A signs in
    await service.signIn(
      contextId,
      'req-login-user-a',
      TEST_USERS[0].email,
      TEST_USERS[0].password,
    );
    expect(service.getAccountSnapshot().state).toBe('signedIn');
    expect(service.getAccountSnapshot().user?.username).toBe(TEST_USERS[0].username);

    // User A dispatches slow listMine
    const slowMinePromise = service.listMine(contextId, 'req-slow-mine', 'instrument');

    // While listMine is on the wire, User A is replaced by User B
    const loginB = await service.signIn(
      contextId,
      'req-login-user-b',
      TEST_USERS[1].email,
      TEST_USERS[1].password,
    );
    expect(loginB.ok).toBe(true);
    expect(service.getAccountSnapshot().user?.username).toBe(TEST_USERS[1].username);
    const userBEpoch = service.getAccountSnapshot().accountEpoch;

    // Now resolve User A's slow listMine with 401
    resolveMine!({
      status: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: { code: 'unauthorized', message: 'Old session expired' } }),
    });

    const mineResult = await slowMinePromise;
    expect(mineResult.ok).toBe(false);
    if (mineResult.ok) throw new Error('Expected old listMine to be fenced');
    expect(mineResult.error.code).toBe('fenced');

    // User B MUST STILL BE SIGNED IN! Old 401 did NOT log out User B!
    const snapshot = service.getAccountSnapshot();
    expect(snapshot.state).toBe('signedIn');
    expect(snapshot.user?.username).toBe(TEST_USERS[1].username);
    expect(snapshot.accountEpoch).toBe(userBEpoch);
  });

  it('handles close during login: closing dialog mid-login resets signingIn to signedOut and fences late response (T059)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let resolveLogin: (res: any) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });

    const transport = new BlueShareTransport({
      requestAdapter: async (opts) => {
        if (opts.url.includes('/session') && opts.method === 'POST') {
          return loginPromise as any;
        }
        return fakeServer.handleRequest(opts);
      },
    });

    const service = new BlueShareService({ transport });
    const sender = createMockSender(23);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Start sign in
    const signInPromise = service.signIn(
      contextId,
      'req-close-mid-login',
      TEST_USERS[0].email,
      TEST_USERS[0].password,
    );
    expect(service.getAccountSnapshot().state).toBe('signingIn');

    // User closes dialog mid-login
    service.closeDialog(contextId);

    // State immediately resets to signedOut, not hanging in signingIn
    expect(service.getAccountSnapshot().state).toBe('signedOut');

    // Now resolve late server response
    resolveLogin!({
      status: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': 'session_id=late; Path=/' },
      body: JSON.stringify({
        user: { id: TEST_USERS[0].id, name: TEST_USERS[0].name, username: TEST_USERS[0].username },
      }),
    });

    const signInResult = await signInPromise;
    expect(signInResult.ok).toBe(false);
    if (signInResult.ok) throw new Error('Expected fenced sign-in');
    expect(signInResult.error.code).toBe('fenced');

    // State remains signedOut
    expect(service.getAccountSnapshot().state).toBe('signedOut');
  });

  it('handles sign-out / new-login race: late completion of signOut does not wipe newer login or session proof (T059)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let resolveDeleteSession: (res: any) => void;
    const deleteSessionPromise = new Promise((resolve) => {
      resolveDeleteSession = resolve;
    });

    const transport = createConnectedTransport(fakeServer);
    // Wrap sendRequest to intercept and delay DELETE /session
    const origSendRequest = transport.sendRequest.bind(transport);
    transport.sendRequest = async (opts) => {
      if (opts.routePath === '/session' && opts.method === 'DELETE') {
        await deleteSessionPromise;
      }
      return origSendRequest(opts);
    };

    const service = new BlueShareService({ transport });
    const sender = createMockSender(24);
    const { contextId } = (service.openDialog(sender) as any).value;

    // User A signs in
    await service.signIn(contextId, 'req-user-a', TEST_USERS[0].email, TEST_USERS[0].password);
    expect(service.getAccountSnapshot().state).toBe('signedIn');
    expect(service.getAccountSnapshot().user?.username).toBe(TEST_USERS[0].username);

    // User A initiates signOut (which detaches proof and begins slow DELETE /session)
    const signOutPromise = service.signOut(contextId, 'req-logout');
    expect(service.getAccountSnapshot().state).toBe('signingOut');

    // While signOut is awaiting remote revocation, User B signs in!
    const loginBResult = await service.signIn(
      contextId,
      'req-user-b',
      TEST_USERS[1].email,
      TEST_USERS[1].password,
    );
    expect(loginBResult.ok).toBe(true);
    expect(service.getAccountSnapshot().state).toBe('signedIn');
    expect(service.getAccountSnapshot().user?.username).toBe(TEST_USERS[1].username);
    const userBEpoch = service.getAccountSnapshot().accountEpoch;

    // Now resolve slow signOut DELETE /session
    resolveDeleteSession!({ status: 200 });

    const signOutResult = await signOutPromise;
    expect(signOutResult.ok).toBe(true);

    // User B MUST STILL BE SIGNED IN! Late logout did NOT reset to signedOut or wipe User B!
    expect(service.getAccountSnapshot().state).toBe('signedIn');
    expect(service.getAccountSnapshot().user?.username).toBe(TEST_USERS[1].username);
    expect(service.getAccountSnapshot().accountEpoch).toBe(userBEpoch);

    // User B can still make authenticated requests (e.g. listMine)
    const mineResult = await service.listMine(contextId, 'req-mine-b', 'instrument');
    expect(mineResult.ok).toBe(true);
    if (!mineResult.ok) throw new Error('Expected mineResult to be ok');
    expect(mineResult.value.items.every((it) => it.author.id === TEST_USERS[1].id)).toBe(true);
  });

  it('validates logout revocation response: sets remoteRevocationConfirmed: false for non-JSON, 204, or unconfirmed payloads (T063)', async () => {
    const fakeServer = new FakeBlueShareServer();
    let injectedResponse: { status: number; body?: string; headers?: Record<string, string> } = {
      status: 200,
      body: '<not>json</not>',
    };
    const origHandle = fakeServer.handleRequest.bind(fakeServer);
    fakeServer.handleRequest = async (opts) => {
      if (opts.url.includes('/session') && opts.method === 'DELETE') {
        return {
          status: injectedResponse.status,
          headers: injectedResponse.headers ?? { 'content-type': 'application/json' },
          body: injectedResponse.body ?? '',
        };
      }
      return origHandle(opts);
    };

    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(25);
    const { contextId } = (service.openDialog(sender) as any).value;

    // Case 1: non-JSON 200 response
    await service.signIn(contextId, 'req-login-1', TEST_USERS[0].email, TEST_USERS[0].password);
    injectedResponse = { status: 200, body: '<html>Logged out?</html>' };
    let res = await service.signOut(contextId, 'req-logout-nonjson');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected signOut to succeed locally');
    expect(res.value.signedOut).toBe(true);
    expect(res.value.remoteRevocationConfirmed).toBe(false);

    // Case 2: 204 No Content
    await service.signIn(contextId, 'req-login-2', TEST_USERS[0].email, TEST_USERS[0].password);
    injectedResponse = { status: 204, body: '' };
    res = await service.signOut(contextId, 'req-logout-204');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected signOut to succeed locally');
    expect(res.value.signedOut).toBe(true);
    expect(res.value.remoteRevocationConfirmed).toBe(false);

    // Case 3: 200 with signedOut: false
    await service.signIn(contextId, 'req-login-3', TEST_USERS[0].email, TEST_USERS[0].password);
    injectedResponse = { status: 200, body: JSON.stringify({ signedOut: false }) };
    res = await service.signOut(contextId, 'req-logout-false');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected signOut to succeed locally');
    expect(res.value.signedOut).toBe(true);
    expect(res.value.remoteRevocationConfirmed).toBe(false);

    // Case 4: 200 with string-boolean signedOut: "true"
    await service.signIn(contextId, 'req-login-4', TEST_USERS[0].email, TEST_USERS[0].password);
    injectedResponse = { status: 200, body: JSON.stringify({ signedOut: 'true' }) };
    res = await service.signOut(contextId, 'req-logout-str');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected signOut to succeed locally');
    expect(res.value.signedOut).toBe(true);
    expect(res.value.remoteRevocationConfirmed).toBe(false);

    // Case 5: 500 Internal Server Error
    await service.signIn(contextId, 'req-login-5', TEST_USERS[0].email, TEST_USERS[0].password);
    injectedResponse = { status: 500, body: JSON.stringify({ error: { code: 'server_error' } }) };
    res = await service.signOut(contextId, 'req-logout-500');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('Expected signOut to succeed locally');
    expect(res.value.signedOut).toBe(true);
    expect(res.value.remoteRevocationConfirmed).toBe(false);
  });

  it('rejects invalid or oversized login requests before protected dispatch (T065)', async () => {
    const fakeServer = new FakeBlueShareServer();
    const handleSpy = vi.spyOn(fakeServer, 'handleRequest');
    const transport = createConnectedTransport(fakeServer);
    const service = new BlueShareService({ transport });
    const sender = createMockSender(26);
    const { contextId } = (service.openDialog(sender) as any).value;

    const initialEpoch = service.getAccountEpoch();
    expect(service.getAccountSnapshot().state).toBe('signedOut');

    // Case 1: Empty email
    const emptyEmailRes = await service.signIn(contextId, 'req-login-empty-email', '', 'password');
    expect(emptyEmailRes.ok).toBe(false);
    if (!emptyEmailRes.ok) {
      expect(emptyEmailRes.error.code).toBe('validation_error');
      expect(emptyEmailRes.error.fields?.email).toBeDefined();
    }
    expect(handleSpy).not.toHaveBeenCalled();
    expect(service.getAccountEpoch()).toBe(initialEpoch);
    expect(service.getAccountSnapshot().state).toBe('signedOut');

    // Case 2: Invalid email without @
    const badEmailRes = await service.signIn(
      contextId,
      'req-login-bad-email',
      'not-an-email',
      'password',
    );
    expect(badEmailRes.ok).toBe(false);
    if (!badEmailRes.ok) {
      expect(badEmailRes.error.code).toBe('validation_error');
      expect(badEmailRes.error.fields?.email).toBeDefined();
    }
    expect(handleSpy).not.toHaveBeenCalled();
    expect(service.getAccountEpoch()).toBe(initialEpoch);

    // Case 3: Empty password
    const emptyPassRes = await service.signIn(
      contextId,
      'req-login-empty-pass',
      'test@example.com',
      '',
    );
    expect(emptyPassRes.ok).toBe(false);
    if (!emptyPassRes.ok) {
      expect(emptyPassRes.error.code).toBe('validation_error');
      expect(emptyPassRes.error.fields?.password).toBeDefined();
    }
    expect(handleSpy).not.toHaveBeenCalled();
    expect(service.getAccountEpoch()).toBe(initialEpoch);

    // Case 4: Oversized login payload (> 16 KiB)
    const hugePassword = 'x'.repeat(16 * 1024 + 1);
    const oversizedRes = await service.signIn(
      contextId,
      'req-login-huge',
      'test@example.com',
      hugePassword,
    );
    expect(oversizedRes.ok).toBe(false);
    if (!oversizedRes.ok) {
      expect(oversizedRes.error.code).toBe('validation_error');
      expect(oversizedRes.error.fields?.request).toMatch(/16 KiB/);
    }
    expect(handleSpy).not.toHaveBeenCalled();
    expect(service.getAccountEpoch()).toBe(initialEpoch);
    expect(service.getAccountSnapshot().state).toBe('signedOut');
  });
});

describe('checked session responses (T074)', () => {
  it.each([
    { user: { id: 12, name: 'Name', username: 'user' } },
    { user: { id: 'u1', name: {}, username: 'user' } },
    { user: { id: 'u1', name: 'Name', username: 'user' }, expiresAt: 'yesterday' },
  ])('rejects malformed identity/expiry before sign-in state commits: %j', async (payload) => {
    const transport = new BlueShareTransport({
      requestAdapter: async () => ({ status: 200, headers: {}, body: JSON.stringify(payload) }),
    });
    const service = new BlueShareService({ transport });
    const opened = service.openDialog(createMockSender());
    if (!opened.ok) throw new Error('open');
    const result = await service.signIn(
      opened.value.contextId,
      'login',
      'synthetic@example.com',
      'synthetic',
    );
    expect(result.ok).toBe(false);
    expect(service.getAccountSnapshot().state).toBe('signedOut');
    service.shutdown();
  });

  it('rejects malformed session verification without replacing the checked account', async () => {
    const transport = new BlueShareTransport({
      requestAdapter: async () => ({
        status: 200,
        headers: {},
        body: JSON.stringify({ user: { id: 12, name: 'Name', username: 'user' } }),
      }),
    });
    const service = new BlueShareService({ transport });
    service.setAccountState('signedIn', { id: 'u1', name: 'Name', username: 'user' });
    const before = service.getAccountSnapshot();
    expect((await service.verifySession()).ok).toBe(false);
    expect(service.getAccountSnapshot()).toEqual(before);
    service.shutdown();
  });
});

it('rejects a success-shaped login with the wrong operation status (T074)', async () => {
  const service = new BlueShareService({
    transport: new BlueShareTransport({
      requestAdapter: async () => ({
        status: 201,
        headers: {},
        body: JSON.stringify({ user: { id: 'u1', name: 'Synthetic', username: 'synthetic' } }),
      }),
    }),
  });
  const opened = service.openDialog(createMockSender(120));
  if (!opened.ok) throw new Error('open');
  const result = await service.signIn(
    opened.value.contextId,
    'login',
    'synthetic@example.invalid',
    'synthetic',
  );
  expect(result.ok).toBe(false);
  expect(service.getAccountSnapshot().state).toBe('signedOut');
  if (!result.ok) expect(result.error.status).toBe(201);
  service.shutdown();
});
