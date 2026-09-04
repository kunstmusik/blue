import { describe, expect, it, vi } from 'vitest';
import {
  beginIpcRegistration,
  registerIpcTransaction,
  type IpcMainEventListener,
  type IpcMainInvokeHandler,
  type IpcMainLike,
} from './ipc-registration';

class FakeIpcMain implements IpcMainLike {
  readonly handles = new Map<string, IpcMainInvokeHandler>();
  readonly listeners = new Map<string, IpcMainEventListener>();
  readonly removals: string[] = [];
  failOnHandle: string | null = null;
  failOnRemoveHandler: string | null = null;

  handle(channel: string, listener: IpcMainInvokeHandler): void {
    if (channel === this.failOnHandle) throw new Error(`cannot register ${channel}`);
    this.handles.set(channel, listener);
  }

  on(channel: string, listener: IpcMainEventListener): void {
    this.listeners.set(channel, listener);
  }

  removeHandler(channel: string): void {
    this.removals.push(`handle:${channel}`);
    if (channel === this.failOnRemoveHandler) throw new Error(`cannot remove ${channel}`);
    this.handles.delete(channel);
  }

  removeListener(channel: string, listener: IpcMainEventListener): void {
    this.removals.push(`listener:${channel}`);
    if (this.listeners.get(channel) === listener) this.listeners.delete(channel);
  }
}

describe('IPC registration lease', () => {
  it('rejects duplicate initialization before observable side effects', () => {
    const ipcMain = new FakeIpcMain();
    const first = registerIpcTransaction(ipcMain, 'domain', (scope) => {
      scope.handle('first', vi.fn());
    });
    const handleCount = ipcMain.handles.size;

    expect(() =>
      registerIpcTransaction(ipcMain, 'domain', (scope) => {
        scope.handle('second', vi.fn());
      }),
    ).toThrow('IPC registrar already initialized: domain');
    expect(ipcMain.handles.size).toBe(handleCount);
    expect(ipcMain.handles.has('second')).toBe(false);
    first();
  });

  it('rolls back partial registration in reverse order and preserves the initiating error', () => {
    const ipcMain = new FakeIpcMain();
    expect(() =>
      registerIpcTransaction(ipcMain, 'partial', (scope) => {
        scope.handle('one', vi.fn());
        scope.on('two', vi.fn());
        ipcMain.failOnHandle = 'three';
        scope.handle('three', vi.fn());
      }),
    ).toThrow('cannot register three');

    expect(ipcMain.handles.size).toBe(0);
    expect(ipcMain.listeners.size).toBe(0);
    expect(ipcMain.removals).toEqual(['listener:two', 'handle:one']);
  });

  it('removes exact listener identities, disposes once, and permits a new generation', () => {
    const ipcMain = new FakeIpcMain();
    const listener = vi.fn();
    const disposeFirst = registerIpcTransaction(ipcMain, 'domain', (scope) => {
      scope.on('event', listener);
      scope.handle('invoke', vi.fn());
    });

    disposeFirst();
    disposeFirst();
    expect(ipcMain.removals).toEqual(['handle:invoke', 'listener:event']);

    const replacementListener = vi.fn();
    const disposeSecond = registerIpcTransaction(ipcMain, 'domain', (scope) => {
      scope.on('event', replacementListener);
    });
    expect(ipcMain.listeners.get('event')).toBe(replacementListener);

    // The stale disposer cannot remove the replacement lease.
    disposeFirst();
    expect(ipcMain.listeners.get('event')).toBe(replacementListener);
    disposeSecond();
  });

  it('continues exact teardown after a removal error and releases the lease', () => {
    const ipcMain = new FakeIpcMain();
    const scope = beginIpcRegistration(ipcMain, 'teardown');
    scope.handle('first', vi.fn());
    scope.handle('second', vi.fn());
    ipcMain.failOnRemoveHandler = 'second';

    expect(() => scope.dispose()).toThrow('cannot remove second');
    expect(ipcMain.removals).toEqual(['handle:second', 'handle:first']);
    expect(() => registerIpcTransaction(ipcMain, 'teardown', () => {})).not.toThrow();
  });
});
