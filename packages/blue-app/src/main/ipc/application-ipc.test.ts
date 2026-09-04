import { describe, expect, it, vi } from 'vitest';
import {
  APPLICATION_IPC_CHANNELS,
  registerApplicationIpc,
  type ApplicationListenerChannel,
} from './application-ipc';
import type { IpcMainEventListener } from './ipc-registration';
import {
  createHandlerRecord,
  expectIdempotentReverseDisposal,
  FakeRegistrarIpcMain,
} from './ipc-registrar-test-utils';

const LISTENER_CHANNELS = [
  'settings:close-response',
] as const satisfies readonly ApplicationListenerChannel[];
const HANDLER_CHANNELS = APPLICATION_IPC_CHANNELS.filter(
  (channel) => !LISTENER_CHANNELS.includes(channel as ApplicationListenerChannel),
);

describe('application IPC registrar', () => {
  it('registers the exact 23-channel invoke/listener sequence and exact teardown', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const listeners = { 'settings:close-response': vi.fn() } satisfies Record<
      ApplicationListenerChannel,
      IpcMainEventListener
    >;
    const dispose = registerApplicationIpc({
      ipcMain,
      handlers: createHandlerRecord(HANDLER_CHANNELS),
      listeners,
    });
    expect(ipcMain.registrations).toEqual(
      APPLICATION_IPC_CHANNELS.map((channel) =>
        channel === 'settings:close-response' ? `on:${channel}` : `handle:${channel}`,
      ),
    );
    expect(ipcMain.listeners.get('settings:close-response')).toBe(
      listeners['settings:close-response'],
    );
    expectIdempotentReverseDisposal(ipcMain, dispose);
  });

  it('preserves fail-closed decisions, settings/OSC results, native paths, layout targets, and listeners', async () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(HANDLER_CHANNELS);
    handlers['blue:native-confirmation:show'] = vi.fn(async () => ({ outcome: 'cancelled' }));
    handlers['program-settings:save'] = vi.fn((_event, settings) => ({ ok: true, settings }));
    handlers['osc-control:get-snapshot'] = vi.fn(() => ({ state: 'stopped' }));
    handlers['file-manager:validate-directory'] = vi.fn((_event, filePath) => ({
      valid: true,
      filePath,
    }));
    handlers['window-layout:reset'] = vi.fn((_event, request) => ({
      ok: true,
      targetWindowId: request.targetWindowId,
    }));
    const closeResponses: unknown[] = [];
    registerApplicationIpc({
      ipcMain,
      handlers,
      listeners: {
        'settings:close-response': vi.fn((_event, response) => closeResponses.push(response)),
      },
    });

    await expect(ipcMain.handlers.get('blue:native-confirmation:show')?.({}, {})).resolves.toEqual({
      outcome: 'cancelled',
    });
    expect(ipcMain.handlers.get('program-settings:save')?.({}, { general: {} })).toEqual({
      ok: true,
      settings: { general: {} },
    });
    expect(ipcMain.handlers.get('osc-control:get-snapshot')?.({})).toEqual({ state: 'stopped' });
    expect(
      ipcMain.handlers.get('file-manager:validate-directory')?.({}, '\\\\server\\share'),
    ).toEqual({ valid: true, filePath: '\\\\server\\share' });
    expect(ipcMain.handlers.get('window-layout:reset')?.({}, { targetWindowId: 17 })).toEqual({
      ok: true,
      targetWindowId: 17,
    });
    ipcMain.listeners.get('settings:close-response')?.({}, { outcome: 'cancelled' });
    expect(closeResponses).toEqual([{ outcome: 'cancelled' }]);
  });

  it('preserves validation errors', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(HANDLER_CHANNELS);
    handlers['program-settings:save'] = vi.fn(() => {
      throw new Error('invalid settings');
    });
    registerApplicationIpc({
      ipcMain,
      handlers,
      listeners: { 'settings:close-response': vi.fn() },
    });
    expect(() => ipcMain.handlers.get('program-settings:save')?.({}, null)).toThrow(
      'invalid settings',
    );
  });
});
