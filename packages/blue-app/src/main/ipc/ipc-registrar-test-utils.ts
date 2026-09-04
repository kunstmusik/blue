import { vi } from 'vitest';
import type { IpcMainEventListener, IpcMainInvokeHandler, IpcMainLike } from './ipc-registration';

export class FakeRegistrarIpcMain implements IpcMainLike {
  readonly handlers = new Map<string, IpcMainInvokeHandler>();
  readonly listeners = new Map<string, IpcMainEventListener>();
  readonly registrations: string[] = [];
  readonly removals: string[] = [];

  handle(channel: string, listener: IpcMainInvokeHandler): void {
    this.registrations.push(`handle:${channel}`);
    this.handlers.set(channel, listener);
  }

  on(channel: string, listener: IpcMainEventListener): void {
    this.registrations.push(`on:${channel}`);
    this.listeners.set(channel, listener);
  }

  removeHandler(channel: string): void {
    this.removals.push(`handle:${channel}`);
    this.handlers.delete(channel);
  }

  removeListener(channel: string, listener: IpcMainEventListener): void {
    this.removals.push(`on:${channel}`);
    if (this.listeners.get(channel) === listener) {
      this.listeners.delete(channel);
    }
  }
}

export function createHandlerRecord<TChannel extends string>(
  channels: readonly TChannel[],
): Record<TChannel, IpcMainInvokeHandler> {
  return Object.fromEntries(
    channels.map((channel) => [channel, vi.fn((...args: unknown[]) => ({ channel, args }))]),
  ) as unknown as Record<TChannel, IpcMainInvokeHandler>;
}

export function expectIdempotentReverseDisposal(
  ipcMain: FakeRegistrarIpcMain,
  dispose: () => void,
): void {
  const expected = ipcMain.registrations.slice().reverse();
  dispose();
  dispose();
  if (JSON.stringify(ipcMain.removals) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected registrar removals: ${JSON.stringify(ipcMain.removals)}`);
  }
  if (ipcMain.handlers.size !== 0 || ipcMain.listeners.size !== 0) {
    throw new Error('Registrar disposal left handlers or listeners installed.');
  }
}
