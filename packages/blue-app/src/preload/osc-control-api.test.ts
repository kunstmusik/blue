import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OSC_CONTROL_COMMAND_CHANNEL,
  OSC_CONTROL_GET_SNAPSHOT_CHANNEL,
  OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL,
} from '../shared/osc-control';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  exposedApi: null as Record<string, any> | null,
}));

vi.mock('electron', () => ({
  clipboard: { readText: vi.fn(), writeText: vi.fn() },
  contextBridge: {
    exposeInMainWorld: (_name: string, api: Record<string, any>) => {
      mocks.exposedApi = api;
    },
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: mocks.on,
    removeListener: mocks.removeListener,
    send: vi.fn(),
  },
}));

import './preload';

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.on.mockReset();
  mocks.removeListener.mockReset();
});

describe('OSC preload API', () => {
  it('requests the current serializable listener snapshot', async () => {
    await mocks.exposedApi!.getOscServerSnapshot();
    expect(mocks.invoke).toHaveBeenCalledWith(OSC_CONTROL_GET_SNAPSHOT_CHANNEL);
  });

  it('forwards only valid runtime snapshots and cleans up subscriptions', () => {
    let handler: ((event: unknown, payload: unknown) => void) | null = null;
    mocks.on.mockImplementation((_channel: string, listener: typeof handler) => {
      handler = listener;
    });
    const callback = vi.fn();
    const unsubscribe = mocks.exposedApi!.onOscServerSnapshot(callback);

    handler!(
      {},
      {
        phase: 'listening',
        preferredPort: 8000,
        activePort: 8000,
        fallbackFrom: null,
        lastBindError: null,
        lastPacketError: null,
        revision: 2,
        updatedAt: 'now',
      },
    );
    handler!({}, { phase: 'not-a-phase' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(mocks.on).toHaveBeenCalledWith(
      OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL,
      expect.any(Function),
    );
    unsubscribe();
    expect(mocks.removeListener).toHaveBeenCalledWith(
      OSC_CONTROL_SNAPSHOT_CHANGED_CHANNEL,
      expect.any(Function),
    );
  });

  it('forwards only registered OSC command events', () => {
    let handler: ((event: unknown, payload: unknown) => void) | null = null;
    mocks.on.mockImplementation((_channel: string, listener: typeof handler) => {
      handler = listener;
    });
    const callback = vi.fn();
    mocks.exposedApi!.onOscCommand(callback);

    handler!(
      {},
      { sequence: 1, commandId: 'score.play', receivedAddress: '/score/play', receivedAt: 'now' },
    );
    handler!(
      {},
      {
        sequence: 2,
        commandId: 'blueLive.toggleMidiInput',
        receivedAddress: '/blueLive/toggleMidiInput',
        receivedAt: 'now',
      },
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(mocks.on).toHaveBeenCalledWith(OSC_CONTROL_COMMAND_CHANNEL, expect.any(Function));
  });
});
