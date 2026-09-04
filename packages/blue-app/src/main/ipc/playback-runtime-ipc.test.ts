import { describe, expect, it, vi } from 'vitest';
import {
  PLAYBACK_RUNTIME_IPC_CHANNELS,
  registerPlaybackRuntimeIpc,
  type PlaybackRuntimeListenerChannel,
} from './playback-runtime-ipc';
import type { IpcMainEventListener } from './ipc-registration';
import {
  createHandlerRecord,
  expectIdempotentReverseDisposal,
  FakeRegistrarIpcMain,
} from './ipc-registrar-test-utils';

const LISTENER_CHANNELS = [
  'sync-audition-score-object-availability',
  'sync-follow-playback-state',
] as const satisfies readonly PlaybackRuntimeListenerChannel[];

const HANDLER_CHANNELS = PLAYBACK_RUNTIME_IPC_CHANNELS.filter(
  (channel) => !LISTENER_CHANNELS.includes(channel as PlaybackRuntimeListenerChannel),
);

describe('playback/runtime IPC registrar', () => {
  it('registers the exact 30-channel invoke/listener sequence and exact teardown', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const listeners = Object.fromEntries(
      LISTENER_CHANNELS.map((channel) => [channel, vi.fn()]),
    ) as unknown as Record<PlaybackRuntimeListenerChannel, IpcMainEventListener>;
    const dispose = registerPlaybackRuntimeIpc({
      ipcMain,
      handlers: createHandlerRecord(HANDLER_CHANNELS),
      listeners,
    });

    expect(ipcMain.registrations).toEqual(
      PLAYBACK_RUNTIME_IPC_CHANNELS.map((channel) =>
        LISTENER_CHANNELS.includes(channel as PlaybackRuntimeListenerChannel)
          ? `on:${channel}`
          : `handle:${channel}`,
      ),
    );
    expect(ipcMain.listeners.get(LISTENER_CHANNELS[0])).toBe(listeners[LISTENER_CHANNELS[0]]);
    expectIdempotentReverseDisposal(ipcMain, dispose);
  });

  it('preserves runtime results, mutual-exclusion/cancellation statuses, event targets, and listener payloads', async () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(HANDLER_CHANNELS);
    const eventTargets: string[] = [];
    handlers['toggle-play'] = vi.fn(async () => ({ started: false, reason: 'render-active' }));
    handlers['blue-live:get-status'] = vi.fn(() => ({ state: 'idle' }));
    handlers['repl-console:evaluate'] = vi.fn((_event, request) => ({
      ok: true,
      value: request.code,
    }));
    handlers['send-bsb-realtime-control-update'] = vi.fn((_event, update) => update);
    handlers['render-to-disk'] = vi.fn((_event, request) => ({
      ok: false,
      operationId: request.operationId,
      cancelled: true,
    }));
    const listeners = {
      'sync-audition-score-object-availability': vi.fn((event: { sender: string }) =>
        eventTargets.push(event.sender),
      ),
      'sync-follow-playback-state': vi.fn((event: { sender: string }) =>
        eventTargets.push(event.sender),
      ),
    };
    registerPlaybackRuntimeIpc({ ipcMain, handlers, listeners });

    await expect(ipcMain.handlers.get('toggle-play')?.({})).resolves.toEqual({
      started: false,
      reason: 'render-active',
    });
    expect(ipcMain.handlers.get('blue-live:get-status')?.({})).toEqual({ state: 'idle' });
    expect(ipcMain.handlers.get('repl-console:evaluate')?.({}, { code: '2 + 2' })).toEqual({
      ok: true,
      value: '2 + 2',
    });
    expect(ipcMain.handlers.get('send-bsb-realtime-control-update')?.({}, { value: 0.5 })).toEqual({
      value: 0.5,
    });
    expect(ipcMain.handlers.get('render-to-disk')?.({}, { operationId: 'render-1' })).toEqual({
      ok: false,
      operationId: 'render-1',
      cancelled: true,
    });
    ipcMain.listeners.get('sync-follow-playback-state')?.({ sender: 'main-renderer' }, true);
    expect(eventTargets).toEqual(['main-renderer']);
  });

  it('preserves runtime errors', () => {
    const ipcMain = new FakeRegistrarIpcMain();
    const handlers = createHandlerRecord(HANDLER_CHANNELS);
    handlers['engine:evaluate-code'] = vi.fn(() => {
      throw new Error('engine unavailable');
    });
    registerPlaybackRuntimeIpc({
      ipcMain,
      handlers,
      listeners: {
        'sync-audition-score-object-availability': vi.fn(),
        'sync-follow-playback-state': vi.fn(),
      },
    });
    expect(() => ipcMain.handlers.get('engine:evaluate-code')?.({}, 'i1 0 1')).toThrow(
      'engine unavailable',
    );
  });
});
