import { describe, expect, it, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { BLUESHARE_CHANNELS } from '../../shared/blueshare';
import { registerBlueShareIpc } from './ipc';
import { BlueShareService } from './service';

class MockIpcMain {
  readonly handlers = new Map<string, Function>();

  handle(channel: string, handler: Function): void {
    if (this.handlers.has(channel)) {
      throw new Error(`Duplicate channel handler: ${channel}`);
    }
    this.handlers.set(channel, handler);
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

describe('BlueShare IPC Registrar', () => {
  it('registers all BlueShare channels and handles open, getAccount, and close safely', async () => {
    const ipcMain = new MockIpcMain();
    const service = new BlueShareService();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: {
        send: vi.fn(),
      },
    };

    const unregister = registerBlueShareIpc({
      ipcMain: ipcMain as unknown as IpcMain,
      service,
      getWindows: () => [mockWindow as any],
    });

    const accountRead = vi.spyOn(service, 'getAccount');
    const sender = { id: 101, isDestroyed: () => false };
    const event = { sender };

    // 1. OPEN
    const openHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.OPEN);
    expect(openHandler).toBeDefined();
    const openRes = await openHandler!(event);
    expect(openRes.ok).toBe(true);
    const { contextId, account } = openRes.value;
    expect(account.state).toBe('signedOut');
    expect(accountRead).toHaveBeenCalledWith(contextId, sender.id);

    // 2. GET_ACCOUNT with valid context
    const getAccountHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.GET_ACCOUNT);
    expect(getAccountHandler).toBeDefined();
    const accountRes = await getAccountHandler!(event, contextId);
    expect(accountRes.ok).toBe(true);
    expect(accountRes.value.state).toBe('signedOut');

    // 3. GET_ACCOUNT with wrong sender
    const wrongSenderEvent = { sender: { id: 999, isDestroyed: () => false } };
    const wrongSenderRes = await getAccountHandler!(wrongSenderEvent, contextId);
    expect(wrongSenderRes.ok).toBe(false);
    expect(wrongSenderRes.error.code).toBe('forbidden_sender');

    // 4. GET_ACCOUNT with malformed contextId
    const malformedRes = await getAccountHandler!(event, 12345);
    expect(malformedRes.ok).toBe(false);
    expect(malformedRes.error.code).toBe('invalid_request');

    // 5. Account change broadcasts event to open windows
    service.setAccountState('signedIn', {
      id: 'u-1',
      name: 'Steven',
      username: 'steven',
    });
    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      BLUESHARE_CHANNELS.ACCOUNT_CHANGED,
      expect.objectContaining({ state: 'signedIn' }),
    );

    // 6. IMPORT_RESOURCE validation
    const importHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.IMPORT_RESOURCE);
    expect(importHandler).toBeDefined();

    // Invalid key rejected
    const invalidKeyRes = await importHandler!(event, contextId, 'req-1', {
      kind: 'invalid',
      id: 10,
    });
    expect(invalidKeyRes.ok).toBe(false);
    expect(invalidKeyRes.error.code).toBe('invalid_request');

    // Wrong sender rejected
    const wrongSenderImport = await importHandler!(wrongSenderEvent, contextId, 'req-1', {
      kind: 'instrument',
      id: 10,
    });
    expect(wrongSenderImport.ok).toBe(false);
    expect(wrongSenderImport.error.code).toBe('forbidden_sender');

    // 7. SIGN_IN validation
    const signInHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.SIGN_IN);
    const invalidRemember = await signInHandler!(
      event,
      contextId,
      'req-remember',
      'test@example.invalid',
      'test',
      'true',
    );
    expect(invalidRemember.ok).toBe(false);

    expect(signInHandler).toBeDefined();
    const badSignIn = await signInHandler!(event, contextId, 'req-2', 123, 'pass');
    expect(badSignIn.ok).toBe(false);
    expect(badSignIn.error.code).toBe('invalid_request');

    // 8. SIGN_OUT validation
    const signOutHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.SIGN_OUT);
    expect(signOutHandler).toBeDefined();
    const badSignOut = await signOutHandler!(wrongSenderEvent, contextId, 'req-3');
    expect(badSignOut.ok).toBe(false);
    expect(badSignOut.error.code).toBe('forbidden_sender');

    // 9. LIST_MINE validation
    const listMineHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.LIST_MINE);
    expect(listMineHandler).toBeDefined();
    const badKindMine = await listMineHandler!(event, contextId, 'req-4', 'bad-kind', null);
    expect(badKindMine.ok).toBe(false);
    expect(badKindMine.error.code).toBe('invalid_request');

    // 10. OPEN_WEBSITE validation
    const openWebHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.OPEN_WEBSITE);
    expect(openWebHandler).toBeDefined();
    const badPurpose = await openWebHandler!(event, contextId, 'invalid-purpose');
    expect(badPurpose.ok).toBe(false);
    expect(badPurpose.error.code).toBe('invalid_request');

    // 11. PREPARE_PUBLISH validation
    const prepareHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.PREPARE_PUBLISH);
    expect(prepareHandler).toBeDefined();
    const badPrepKey = await prepareHandler!(event, contextId, 'req-5', null, 1);
    expect(badPrepKey.ok).toBe(false);
    expect(badPrepKey.error.code).toBe('invalid_request');

    const badPrepRev = await prepareHandler!(event, contextId, 'req-5', { scope: 'user' }, -1);
    expect(badPrepRev.ok).toBe(false);
    expect(badPrepRev.error.code).toBe('invalid_request');

    const wrongSenderPrep = await prepareHandler!(
      wrongSenderEvent,
      contextId,
      'req-5',
      { scope: 'user' },
      1,
    );
    expect(wrongSenderPrep.ok).toBe(false);
    expect(wrongSenderPrep.error.code).toBe('forbidden_sender');

    // 12. PUBLISH_RESOURCE validation and XML stripping
    const publishHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.PUBLISH_RESOURCE);
    expect(publishHandler).toBeDefined();
    const badPubToken = await publishHandler!(event, contextId, 'req-6', 123, 10, 'desc');
    expect(badPubToken.ok).toBe(false);
    expect(badPubToken.error.code).toBe('invalid_request');

    const badPubCategory = await publishHandler!(event, contextId, 'req-6', 'tok-1', -1, 'desc');
    expect(badPubCategory.ok).toBe(false);
    expect(badPubCategory.error.code).toBe('invalid_request');

    const badPubDesc = await publishHandler!(event, contextId, 'req-6', 'tok-1', 10, 9999);
    expect(badPubDesc.ok).toBe(false);
    expect(badPubDesc.error.code).toBe('invalid_request');

    const wrongSenderPub = await publishHandler!(
      wrongSenderEvent,
      contextId,
      'req-6',
      'tok-1',
      10,
      'desc',
    );
    expect(wrongSenderPub.ok).toBe(false);
    expect(wrongSenderPub.error.code).toBe('forbidden_sender');

    // Verify XML stripping on publish success
    vi.spyOn(service, 'publishResource').mockResolvedValueOnce({
      ok: true,
      value: {
        kind: 'instrument',
        id: 42,
        name: 'Exported Synth',
        description: 'Desc',
        blueType: 'blue.orchestra.GenericInstrument',
        createdAt: '2026-01-01T00:00:00Z',
        category: { id: 10, name: 'Synths' },
        author: { id: 'u1', name: 'Steven', username: 'steven' },
        xml: '<instrument><secret>DoNotLeakToRenderer</secret></instrument>',
      } as any,
    });
    const pubSuccess = await publishHandler!(event, contextId, 'req-7', 'tok-valid', 10, 'desc');
    expect(pubSuccess.ok).toBe(true);
    if (pubSuccess.ok) {
      expect((pubSuccess.value as any).xml).toBeUndefined();
      expect(pubSuccess.value.name).toBe('Exported Synth');
    }

    // 13. REMOVE_RESOURCE validation and delegation
    const removeHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.REMOVE_RESOURCE);
    expect(removeHandler).toBeDefined();

    const badRemKey = await removeHandler!(event, contextId, 'req-8', null);
    expect(badRemKey.ok).toBe(false);
    expect(badRemKey.error.code).toBe('invalid_request');

    const wrongSenderRem = await removeHandler!(wrongSenderEvent, contextId, 'req-8', {
      kind: 'instrument',
      id: 1,
    });
    expect(wrongSenderRem.ok).toBe(false);
    expect(wrongSenderRem.error.code).toBe('forbidden_sender');

    vi.spyOn(service, 'removeResource').mockResolvedValueOnce({
      ok: true,
      value: { kind: 'instrument', id: 1, removed: true, alreadyRemoved: false },
    });
    const remSuccess = await removeHandler!(event, contextId, 'req-8', {
      kind: 'instrument',
      id: 1,
    });
    expect(remSuccess.ok).toBe(true);
    if (remSuccess.ok) {
      expect(remSuccess.value.removed).toBe(true);
      expect(remSuccess.value.alreadyRemoved).toBe(false);
    }

    // 14. CLOSE
    const closeHandler = ipcMain.handlers.get(BLUESHARE_CHANNELS.CLOSE);
    expect(closeHandler).toBeDefined();
    const closeRes = await closeHandler!(event, contextId);
    expect(closeRes.ok).toBe(true);

    // After close, context is invalid
    const afterCloseRes = await getAccountHandler!(event, contextId);
    expect(afterCloseRes.ok).toBe(false);
    expect(afterCloseRes.error.code).toBe('invalid_context');

    // Teardown removes all handlers and listener
    unregister();
    expect(ipcMain.handlers.size).toBe(0);
  });

  it('rejects duplicate channel registration cleanly and rolls back', () => {
    const ipcMain = new MockIpcMain();
    const service = new BlueShareService();

    const unregister1 = registerBlueShareIpc({
      ipcMain: ipcMain as unknown as IpcMain,
      service,
    });

    // Second registration should throw already initialized error
    expect(() =>
      registerBlueShareIpc({
        ipcMain: ipcMain as unknown as IpcMain,
        service,
      }),
    ).toThrow(/already initialized: blueshare/);

    unregister1();
    expect(ipcMain.handlers.size).toBe(0);
  });
});

describe('checked outgoing IPC (T074/T075)', () => {
  it('checks service success nodes and projects exceptions without forwarding fields or secrets', async () => {
    const ipcMain = new MockIpcMain();
    const service = new BlueShareService();
    const dispose = registerBlueShareIpc({ ipcMain: ipcMain as unknown as IpcMain, service });
    const event = { sender: { id: 12, isDestroyed: () => false } };
    const opened = await ipcMain.handlers.get(BLUESHARE_CHANNELS.OPEN)!(event);
    expect(opened.value.serviceScope).toBe('https://blue3.kunstmusik.com');
    vi.spyOn(service, 'importResource').mockResolvedValueOnce({
      ok: true,
      value: { contentRevision: 1, affectedNodes: [null] },
    } as any);
    const handler = ipcMain.handlers.get(BLUESHARE_CHANNELS.IMPORT_RESOURCE)!;
    expect(
      (await handler(event, opened.value.contextId, 'request', { kind: 'instrument', id: 1 })).ok,
    ).toBe(false);
    vi.spyOn(service, 'getLatest').mockRejectedValueOnce({
      code: 'synthetic-proof',
      message: 'token=synthetic-proof',
      fields: { token: 'synthetic-proof', xml: {} },
    });
    const result = await ipcMain.handlers.get(BLUESHARE_CHANNELS.GET_LATEST)!(
      event,
      opened.value.contextId,
      'request',
      'instrument',
    );
    expect(JSON.stringify(result)).not.toContain('synthetic-proof');
    expect(result.ok).toBe(false);
    dispose();
    service.shutdown();
  });
});

it('returns an owned browsing context without waiting for account verification', async () => {
  const ipcMain = new MockIpcMain();
  const service = new BlueShareService();
  vi.spyOn(service, 'getAccount').mockImplementation(() => {
    service.setAccountState('unavailable', null);
    return new Promise(() => {});
  });
  const unregister = registerBlueShareIpc({ ipcMain: ipcMain as unknown as IpcMain, service });
  const opened = await ipcMain.handlers.get(BLUESHARE_CHANNELS.OPEN)!({
    sender: { id: 1, isDestroyed: () => false },
  });
  expect(opened).toMatchObject({
    ok: true,
    value: { account: { state: 'unavailable', user: null } },
  });
  expect(service.validateDialog(opened.value.contextId, 1)).not.toHaveProperty('code');
  unregister();
});
