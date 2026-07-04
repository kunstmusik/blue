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
  };

  function Harness(): React.ReactElement {
    useIPCListeners();
    return React.createElement('div');
  }

  beforeEach(() => {
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
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete (window as Window & { blueAPI?: typeof blueAPI }).blueAPI;
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
});
