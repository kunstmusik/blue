// @vitest-environment jsdom

import React, { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIPCListeners } from '../hooks/use-ipc-listeners';
import { useProjectStore } from '../stores/project-store';
import { usePlaybackStore } from '../stores/playback-store';
import { useUIStore } from '../stores/ui-store';
import { useSettingsStore } from '../stores/settings-store';
import { useLayoutSettingsStore } from '../stores/layout-settings-store';
import { createDefaultProgramSettings } from '../../shared/program-settings';
import {
  applyWindowLayoutUpdate,
  createDefaultWindowLayoutSettings,
  type WindowLayoutSettingsSnapshot,
  type WindowLayoutUpdateRequest,
} from '../../shared/window-layout-settings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ListenerMap = Map<string, Set<(...args: unknown[]) => void>>;

function createListenerBucket(): ListenerMap {
  return new Map();
}

function addListener(listeners: ListenerMap, channel: string, handler: (...args: unknown[]) => void): () => void {
  let set = listeners.get(channel);
  if (!set) {
    set = new Set();
    listeners.set(channel, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
  };
}

function getListenerCount(listeners: ListenerMap, channel: string): number {
  return listeners.get(channel)?.size ?? 0;
}

function ensureLocalStorage(): Storage {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
  });
  return storage;
}

describe('useIPCListeners', () => {
  let container: HTMLDivElement;
  let root: Root;
  const listeners = createListenerBucket();
  const blueAPI = {
    onProjectLoaded: vi.fn((cb: (info: unknown) => void) => addListener(listeners, 'project-loaded', cb)),
    onProjectClosed: vi.fn((cb: () => void) => addListener(listeners, 'project-closed', cb)),
    onPlaybackStatus: vi.fn((cb: (status: unknown) => void) => addListener(listeners, 'playback-status', cb)),
    onPlaybackClock: vi.fn((cb: (clock: unknown) => void) => addListener(listeners, 'playback-clock', cb)),
    onPlaybackError: vi.fn((cb: (error: unknown) => void) => addListener(listeners, 'playback-error', cb)),
    onNativeMenuCommand: vi.fn((cb: (command: unknown) => void) => addListener(listeners, 'native-menu-command', cb)),
    onSaveComplete: vi.fn((cb: () => void) => addListener(listeners, 'save-complete', cb)),
    onSaveError: vi.fn((cb: (error: unknown) => void) => addListener(listeners, 'save-error', cb)),
    onEngineOutput: vi.fn((cb: (...args: unknown[]) => void) => addListener(listeners, 'engine-output', cb)),
    onEngineOutputSelect: vi.fn((cb: (...args: unknown[]) => void) => addListener(listeners, 'engine-output-select', cb)),
    onEngineOutputReset: vi.fn((cb: (...args: unknown[]) => void) => addListener(listeners, 'engine-output-reset', cb)),
    onGeneratedCsd: vi.fn((cb: (...args: unknown[]) => void) => addListener(listeners, 'generated-csd', cb)),
    onGeneratedCsdError: vi.fn((cb: (...args: unknown[]) => void) => addListener(listeners, 'generated-csd-error', cb)),
    onBlueLiveStatus: vi.fn((cb: (...args: unknown[]) => void) => addListener(listeners, 'blue-live-status', cb)),
    getProgramSettings: vi.fn(),
    updateWindowLayout: vi.fn(),
  };

  function Harness(): React.ReactElement {
    useIPCListeners();
    return React.createElement('div');
  }

  beforeEach(() => {
    ensureLocalStorage().clear();
    listeners.clear();
    Object.assign(window, { blueAPI });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useProjectStore.getState().clearProject();
    usePlaybackStore.getState().reset();
    useUIStore.getState().setActivePanel('welcome');
    useSettingsStore.setState({
      enginePath: 'blue-engine',
      recentFiles: [],
      windowBounds: null,
      midiInputDevice: '',
      midiOutputDevice: '',
      oscInputPort: 0,
      oscOutputPort: 0,
      oscOutputHost: 'localhost',
    });
    useLayoutSettingsStore.setState({ layout: null });
    blueAPI.getProgramSettings.mockResolvedValue(createDefaultProgramSettings('darwin'));
    blueAPI.updateWindowLayout.mockImplementation(async (request: WindowLayoutUpdateRequest) =>
      applyWindowLayoutUpdate(createDefaultWindowLayoutSettings(), request),
    );
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete (window as Window & { blueAPI?: typeof blueAPI }).blueAPI;
    useLayoutSettingsStore.setState({ layout: null });
    globalThis.localStorage?.clear();
    vi.clearAllMocks();
  });

  it('cleans up IPC listeners across StrictMode remounts', () => {
    act(() => {
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      );
    });

    expect(blueAPI.onProjectLoaded).toHaveBeenCalledTimes(2);
    expect(getListenerCount(listeners, 'project-loaded')).toBe(1);
    expect(getListenerCount(listeners, 'project-closed')).toBe(1);
    expect(getListenerCount(listeners, 'playback-status')).toBe(1);
    expect(getListenerCount(listeners, 'save-complete')).toBe(1);

    act(() => {
      root.unmount();
    });

    expect(getListenerCount(listeners, 'project-loaded')).toBe(0);
    expect(getListenerCount(listeners, 'project-closed')).toBe(0);
    expect(getListenerCount(listeners, 'playback-status')).toBe(0);
    expect(getListenerCount(listeners, 'save-complete')).toBe(0);
  });

  it('stores a missing-audio session from project-loaded and clears loading state', () => {
    act(() => {
      root.render(<Harness />);
    });

    const projectLoadedHandler = listeners.get('project-loaded')!.values().next().value as (
      ...args: unknown[]
    ) => void;
    const session = {
      sessionId: 's1',
      projectSessionId: 7,
      projectFilePath: '/p/x.blue',
      missingFiles: [{ originalPath: 'gone.wav', replacementPath: '' }],
    };

    act(() => {
      projectLoadedHandler({
        sessionId: 7,
        filePath: '/p/x.blue',
        title: 'X',
        author: '',
        sampleRate: '44100',
        missingAudioAssets: session,
      });
    });

    expect(useProjectStore.getState().isLoading).toBe(false);
    expect(useProjectStore.getState().missingAudioSession).toEqual(session);
  });

  it('clears the missing-audio session when project-loaded has no missing assets', () => {
    useProjectStore.getState().setMissingAudioSession({
      sessionId: 'stale',
      projectSessionId: 1,
      projectFilePath: null,
      missingFiles: [],
    });

    act(() => {
      root.render(<Harness />);
    });

    const projectLoadedHandler = listeners.get('project-loaded')!.values().next().value as (
      ...args: unknown[]
    ) => void;

    act(() => {
      projectLoadedHandler({
        sessionId: 2,
        filePath: '/p/clean.blue',
        title: 'Clean',
        author: '',
        sampleRate: '44100',
      });
    });

    expect(useProjectStore.getState().missingAudioSession).toBeNull();
  });

  it('sends legacy layout values through updateWindowLayout during startup migration', async () => {
    const legacyBounds = { x: 44, y: 55, width: 1111, height: 777 };
    const legacyWorkbench = '{"version":5,"legacy":true}';
    let persistedLayout: WindowLayoutSettingsSnapshot = createDefaultWindowLayoutSettings();

    localStorage.setItem('blue-settings', JSON.stringify({ windowBounds: legacyBounds }));
    localStorage.setItem('blue-workbench-layout', legacyWorkbench);
    blueAPI.getProgramSettings.mockResolvedValue({
      ...createDefaultProgramSettings('darwin'),
      appSpecific: {
        ...createDefaultProgramSettings('darwin').appSpecific,
        windowLayout: persistedLayout,
      },
    });
    blueAPI.updateWindowLayout.mockImplementation(async (request: WindowLayoutUpdateRequest) => {
      persistedLayout = applyWindowLayoutUpdate(
        persistedLayout,
        request,
        () => '2026-07-05T12:00:00.000Z',
      );
      return persistedLayout;
    });

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(blueAPI.updateWindowLayout).toHaveBeenCalledWith({
      type: 'legacy-migration',
      legacy: {
        windowBounds: legacyBounds,
        workbenchSerializedLayout: legacyWorkbench,
      },
    });
    expect(persistedLayout.windows.main?.normalBounds).toEqual(legacyBounds);
    expect(persistedLayout.workbench?.serializedLayout).toBe(legacyWorkbench);
    expect(useLayoutSettingsStore.getState().layout?.windows.main?.normalBounds).toEqual(legacyBounds);
  });
});
