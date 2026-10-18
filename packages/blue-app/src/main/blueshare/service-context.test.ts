import { describe, expect, it, vi } from 'vitest';
import { BlueShareService, type MinimalWebContents } from './service';
import { BlueShareTransport } from './transport';

function createMockSender(id = 1): MinimalWebContents {
  let destroyed = false;
  const listeners: Record<string, (() => void)[]> = {};

  return {
    id,
    isDestroyed: () => destroyed,
    once: (event: string, fn: () => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    // Test helper to simulate destruction
    _destroy: () => {
      destroyed = true;
      if (listeners['destroyed']) {
        listeners['destroyed'].forEach((fn) => fn());
      }
    },
  } as MinimalWebContents & { _destroy: () => void };
}

describe('BlueShareService Context & Lifetime Management', () => {
  it('opens and closes dialog contexts bound to sender webContents', () => {
    const service = new BlueShareService();
    const sender = createMockSender(10);

    const openResult = service.openDialog(sender);
    expect(openResult.ok).toBe(true);
    if (!openResult.ok) return;

    const { contextId, account } = openResult.value;
    expect(contextId).toBeTruthy();
    expect(account.state).toBe('signedOut');
    expect(account.user).toBeNull();

    // Validating context with matching sender succeeds
    const validated = service.validateDialog(contextId, 10);
    expect('contextId' in validated).toBe(true);

    // Closing context removes it
    service.closeDialog(contextId);
    const afterClose = service.validateDialog(contextId);
    expect('code' in afterClose && afterClose.code).toBe('invalid_context');
  });

  it('rejects opening or using dialogs with destroyed senders', () => {
    const service = new BlueShareService();
    const sender = createMockSender(20);
    (sender as any)._destroy();

    const openResult = service.openDialog(sender);
    expect(openResult.ok).toBe(false);
    if (!openResult.ok) {
      expect(openResult.error.code).toBe('sender_destroyed');
    }

    // If sender destroys while dialog is open, validation detects it and cleans up
    const livingSender = createMockSender(21);
    const res = service.openDialog(livingSender);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    (livingSender as any)._destroy();
    const check = service.validateDialog(res.value.contextId);
    expect('code' in check && check.code).toBe('invalid_context');
  });

  it('rejects wrong senders or invalid context IDs', () => {
    const service = new BlueShareService();
    const sender = createMockSender(30);
    const res = service.openDialog(sender);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Wrong sender ID
    const wrongSender = service.validateDialog(res.value.contextId, 999);
    expect('code' in wrongSender && wrongSender.code).toBe('forbidden_sender');

    // Non-existent context ID
    const badContext = service.validateDialog('non-existent-uuid', 30);
    expect('code' in badContext && badContext.code).toBe('invalid_context');
  });

  it('enforces one pending import/publish/remove slot per dialog', () => {
    const service = new BlueShareService();
    const sender = createMockSender(40);
    const res = service.openDialog(sender);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const contextId = res.value.contextId;

    // Acquire slot for import
    const slot1 = service.acquireOperationSlot(contextId, 'import', 40);
    expect('operationId' in slot1).toBe(true);
    if (!('operationId' in slot1)) return;
    expect(slot1.operationType).toBe('import');
    expect(slot1.state).toBe('pending');

    // Attempt second concurrent operation on same dialog
    const slot2 = service.acquireOperationSlot(contextId, 'publish', 40);
    expect('code' in slot2 && slot2.code).toBe('busy');

    // Release slot1
    service.releaseOperationSlot(contextId, slot1.operationId);

    // Now acquiring publish slot succeeds
    const slot3 = service.acquireOperationSlot(contextId, 'publish', 40);
    expect('operationId' in slot3).toBe(true);
  });

  it('cancels active pending operation and signals abort when dialog closes', () => {
    const service = new BlueShareService();
    const sender = createMockSender(50);
    const res = service.openDialog(sender);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const contextId = res.value.contextId;
    const slot = service.acquireOperationSlot(contextId, 'import', 50);
    expect('operationId' in slot).toBe(true);
    if (!('operationId' in slot)) return;

    expect(slot.abortController.signal.aborted).toBe(false);

    // Close dialog
    service.closeDialog(contextId);

    expect(slot.state).toBe('cancelled');
    expect(slot.abortController.signal.aborted).toBe(true);
  });

  it('advances accountEpoch and notifies listeners with sanitized state on account change', () => {
    const service = new BlueShareService();
    const events: any[] = [];
    const unsubscribe = service.onAccountChanged((snap) => {
      events.push(snap);
    });

    const initialEpoch = service.getAccountEpoch();

    service.setAccountState('signedIn', {
      id: 'usr-1',
      name: 'Steven',
      username: 'steven',
    });

    expect(service.getAccountEpoch()).toBe(initialEpoch + 1);
    expect(events.length).toBe(1);
    expect(events[0].state).toBe('signedIn');
    expect(events[0].user).toEqual({
      id: 'usr-1',
      name: 'Steven',
      username: 'steven',
    });
    // Never leaks credentials
    expect(events[0].user.email).toBeUndefined();
    expect(events[0].user.password).toBeUndefined();

    unsubscribe();
    service.setAccountState('signedOut', null);
    expect(events.length).toBe(1); // Unsubscribed, no more calls
  });

  it('manages publish source snapshot lifetime: bound to epoch/context and released on clear, close, signout, and shutdown (T060)', async () => {
    const mockLibrary = {
      capturePublishSource: async (req: any) => ({
        ok: true,
        value: {
          key: req.key,
          revision: req.expectedRevision,
          displayName: 'Test',
          blueType: 'blue.orchestra.GenericInstrument',
          description: '',
          xml: '<instrument type="blue.orchestra.GenericInstrument"><name>Test</name></instrument>',
        },
      }),
    };

    const service = new BlueShareService({ libraryService: mockLibrary as any });
    const sender = createMockSender(60);
    const { contextId } = (service.openDialog(sender) as any).value;

    service.setAccountState('signedIn', { id: 'u1', name: 'User 1', username: 'u1' });
    const currentEpoch = service.getAccountEpoch();

    const prepRes = await service.preparePublishSource(
      contextId,
      'req-prep-1',
      {
        scope: 'user',
        libraryType: 'instrument',
        nodeId: 'n1',
      },
      1,
    );
    expect(prepRes.ok).toBe(true);

    const dialogContext = service.validateDialog(contextId) as any;
    expect(dialogContext.publishSource).not.toBeNull();
    expect(dialogContext.publishSource.contextId).toBe(contextId);
    expect(dialogContext.publishSource.accountEpoch).toBe(currentEpoch);

    // Explicit clear releases snapshot
    const clearRes = service.clearPublishSource(contextId);
    expect(clearRes.ok).toBe(true);
    expect(dialogContext.publishSource).toBeNull();

    // Re-prepare
    await service.preparePublishSource(
      contextId,
      'req-prep-2',
      {
        scope: 'user',
        libraryType: 'instrument',
        nodeId: 'n1',
      },
      1,
    );
    expect(dialogContext.publishSource).not.toBeNull();

    // Changing account state releases snapshot
    service.setAccountState('signedOut', null);
    expect(dialogContext.publishSource).toBeNull();

    // Re-sign in and re-prepare
    service.setAccountState('signedIn', { id: 'u2', name: 'User 2', username: 'u2' });
    await service.preparePublishSource(
      contextId,
      'req-prep-3',
      {
        scope: 'user',
        libraryType: 'instrument',
        nodeId: 'n1',
      },
      1,
    );
    expect(dialogContext.publishSource).not.toBeNull();

    // Closing dialog releases snapshot
    service.closeDialog(contextId);
    expect(service.validateDialog(contextId)).toHaveProperty('code', 'invalid_context');
  });
});

it('reports a stalled durable library import as unknown and retains its guard until settlement (T092)', async () => {
  vi.useFakeTimers();
  let finish!: (value: any) => void;
  const libraryService = {
    importStandaloneResource: vi.fn(
      () =>
        new Promise<any>((resolve) => {
          finish = resolve;
        }),
    ),
  };
  const service = new BlueShareService({ libraryService });
  try {
    const { contextId } = (service.openDialog(createMockSender(93)) as any).value;
    vi.spyOn(service, 'fetchResourceDetail').mockResolvedValue({
      ok: true,
      value: { xml: '<synthetic/>', name: 'Synthetic' },
    } as any);
    let result: any;
    const pending = service
      .importResource(contextId, 'import', { kind: 'instrument', id: 1 })
      .then((value) => {
        result = value;
      });
    await vi.advanceTimersByTimeAsync(30001);
    expect(result?.ok).toBe(false);
    expect(result.error.outcome).toBe('unknown');
    expect(result.error.message).toMatch(/may still finish/i);
    const repeat = await service.importResource(contextId, 'repeat', { kind: 'instrument', id: 1 });
    expect(repeat.ok).toBe(false);
    expect(!repeat.ok && repeat.error.code).toBe('busy');
    expect(libraryService.importStandaloneResource).toHaveBeenCalledTimes(1);
    service.closeDialog(contextId);
    const reopened = (service.openDialog(createMockSender(94)) as any).value.contextId;
    let afterReopen: unknown;
    void service
      .importResource(reopened, 'reopened-repeat', { kind: 'instrument', id: 1 })
      .then((value) => {
        afterReopen = value;
      });
    await vi.advanceTimersByTimeAsync(0);
    expect(afterReopen).toMatchObject({ ok: false, error: { code: 'busy' } });
    finish({ ok: true, value: { contentRevision: 1, affectedNodes: [] } });
    await pending;
    await Promise.resolve();
    const dialog = service.validateDialog(reopened);
    if ('code' in dialog) throw new Error('context');
    expect(dialog.activeOperation).toBeNull();
  } finally {
    service.shutdown();
    vi.useRealTimers();
  }
});
