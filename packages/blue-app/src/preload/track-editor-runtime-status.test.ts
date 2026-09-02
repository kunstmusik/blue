import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL,
  TRACK_INSTRUMENT_RUNTIME_STATUS_QUERY_CHANNEL,
  TRACK_INSTRUMENT_RUNTIME_STATUS_SUBSCRIBE_CHANNEL,
  TRACK_INSTRUMENT_RUNTIME_STATUS_UNSUBSCRIBE_CHANNEL,
  type TrackInstrumentRuntimeStatus,
} from '../shared/track-instrument-editor-contract';
import type { TrackInstrumentEditorRequest } from '../shared/project-editor';

const electronMock = vi.hoisted(() => ({
  clipboard: { writeText: vi.fn(), readText: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  webUtils: { getPathForFile: vi.fn(() => '') },
}));

vi.mock('electron', () => electronMock);

type RuntimeStatusBridge = {
  getTrackInstrumentRuntimeStatus: (
    request: TrackInstrumentEditorRequest,
  ) => Promise<TrackInstrumentRuntimeStatus | null>;
  subscribeTrackInstrumentRuntimeStatus: (
    request: TrackInstrumentEditorRequest,
    callback: (status: TrackInstrumentRuntimeStatus) => void,
  ) => Promise<{
    status: TrackInstrumentRuntimeStatus;
    unsubscribe: () => Promise<void>;
  } | null>;
};

const request: TrackInstrumentEditorRequest = {
  track: {
    rootGroupId: 'group-1',
    trackId: 'track-1',
    projectSessionId: 3,
    projectRevision: 4,
  },
};

const inactiveStatus: TrackInstrumentRuntimeStatus = {
  sequence: 0,
  playbackRunning: false,
  blueLiveRunning: false,
};

async function loadBridge(): Promise<RuntimeStatusBridge> {
  vi.resetModules();
  electronMock.contextBridge.exposeInMainWorld.mockClear();
  await import('./preload');
  const bridge = electronMock.contextBridge.exposeInMainWorld.mock.calls
    .find(([name]) => name === 'blueAPI')?.[1] as RuntimeStatusBridge | undefined;
  if (!bridge) throw new Error('blueAPI bridge was not exposed');
  return bridge;
}

function getEventHandler(): ((event: unknown, payload: unknown) => void) | undefined {
  return electronMock.ipcRenderer.on.mock.calls
    .find(([channel]) => channel === TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL)?.[1] as
    | ((event: unknown, payload: unknown) => void)
    | undefined;
}

describe('Track editor runtime status preload surface', () => {
  beforeEach(() => {
    electronMock.ipcRenderer.invoke.mockReset();
    electronMock.ipcRenderer.on.mockReset();
    electronMock.ipcRenderer.removeListener.mockReset();
  });

  it('validates query responses while forwarding the request', async () => {
    const bridge = await loadBridge();
    electronMock.ipcRenderer.invoke.mockResolvedValueOnce(inactiveStatus);

    await expect(bridge.getTrackInstrumentRuntimeStatus(request)).resolves.toEqual(inactiveStatus);
    expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith(
      TRACK_INSTRUMENT_RUNTIME_STATUS_QUERY_CHANNEL,
      request,
    );

    electronMock.ipcRenderer.invoke.mockResolvedValueOnce({ sequence: 1, playbackRunning: 'yes' });
    await expect(bridge.getTrackInstrumentRuntimeStatus(request)).resolves.toBeNull();
  });

  it('installs the event listener before the subscribe IPC call', async () => {
    const bridge = await loadBridge();
    const liveStatus = { sequence: 1, playbackRunning: true, blueLiveRunning: false };
    const observed: TrackInstrumentRuntimeStatus[] = [];
    electronMock.ipcRenderer.on.mockImplementation(() => undefined);
    electronMock.ipcRenderer.invoke.mockImplementation(async (channel: string) => {
      if (channel === TRACK_INSTRUMENT_RUNTIME_STATUS_SUBSCRIBE_CHANNEL) {
        expect(electronMock.ipcRenderer.on).toHaveBeenCalledWith(
          TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL,
          expect.any(Function),
        );
        getEventHandler()?.({}, liveStatus);
      }
      return inactiveStatus;
    });

    const subscription = await bridge.subscribeTrackInstrumentRuntimeStatus(request, (status) => {
      observed.push(status);
    });

    expect(observed).toEqual([liveStatus]);
    expect(subscription?.status).toEqual(inactiveStatus);
  });

  it('rejects malformed events and removes the listener exactly once on unsubscribe', async () => {
    const bridge = await loadBridge();
    electronMock.ipcRenderer.invoke.mockResolvedValue(inactiveStatus);
    const observed: TrackInstrumentRuntimeStatus[] = [];
    const subscription = await bridge.subscribeTrackInstrumentRuntimeStatus(request, (status) => {
      observed.push(status);
    });
    const handler = getEventHandler();

    handler?.({}, { sequence: 2, playbackRunning: true, blueLiveRunning: 'yes' });
    handler?.({}, { sequence: 2, playbackRunning: true, blueLiveRunning: true });
    expect(observed).toEqual([{
      sequence: 2,
      playbackRunning: true,
      blueLiveRunning: true,
    }]);

    await subscription?.unsubscribe();
    await subscription?.unsubscribe();
    expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledTimes(1);
    expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledWith(
      TRACK_INSTRUMENT_RUNTIME_STATUS_CHANGED_CHANNEL,
      handler,
    );
    expect(electronMock.ipcRenderer.invoke).toHaveBeenNthCalledWith(
      2,
      TRACK_INSTRUMENT_RUNTIME_STATUS_UNSUBSCRIBE_CHANNEL,
      request,
    );
  });

  it('cleans up when subscribe IPC fails and treats teardown IPC failure as harmless', async () => {
    const bridge = await loadBridge();
    electronMock.ipcRenderer.invoke.mockRejectedValueOnce(new Error('host closed'));

    await expect(bridge.subscribeTrackInstrumentRuntimeStatus(request, () => undefined))
      .rejects.toThrow('host closed');
    expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledTimes(1);

    electronMock.ipcRenderer.invoke.mockResolvedValueOnce(inactiveStatus);
    const subscription = await bridge.subscribeTrackInstrumentRuntimeStatus(request, () => undefined);
    electronMock.ipcRenderer.invoke.mockRejectedValueOnce(new Error('sender gone'));
    await expect(subscription?.unsubscribe()).resolves.toBeUndefined();
    expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledTimes(2);
  });
});
