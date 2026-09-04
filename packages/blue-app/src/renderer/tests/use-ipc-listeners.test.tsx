// @vitest-environment jsdom

import React, { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

import { useIPCListeners } from '../hooks/use-ipc-listeners';
import { getProjectDocumentRevision, useProjectStore } from '../stores/project-store';
import { usePlaybackStore } from '../stores/playback-store';
import { useUIStore } from '../stores/ui-store';
import { useSettingsStore } from '../stores/settings-store';
import { useLayoutSettingsStore } from '../stores/layout-settings-store';
import { useScoreSelectionStore } from '../stores/score-selection-store';
import { useRenderToDiskStore } from '../stores/render-to-disk-store';
import { createDefaultProgramSettings } from '../../shared/program-settings';
import type { RenderOperationStatus } from '../../shared/render-freeze-contract';
import {
  applyWindowLayoutUpdate,
  createDefaultWindowLayoutSettings,
  type WindowLayoutSettingsSnapshot,
  type WindowLayoutUpdateRequest,
} from '../../shared/window-layout-settings';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type ListenerMap = Map<string, Set<(...args: unknown[]) => void>>;

function createListenerBucket(): ListenerMap {
  return new Map();
}

function addListener(
  listeners: ListenerMap,
  channel: string,
  handler: (...args: unknown[]) => void,
): () => void {
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
    onProjectLoaded: vi.fn((cb: (info: unknown) => void) =>
      addListener(listeners, 'project-loaded', cb),
    ),
    onProjectClosed: vi.fn((cb: () => void) => addListener(listeners, 'project-closed', cb)),
    onPlaybackStatus: vi.fn((cb: (status: unknown) => void) =>
      addListener(listeners, 'playback-status', cb),
    ),
    onPlaybackClock: vi.fn((cb: (clock: unknown) => void) =>
      addListener(listeners, 'playback-clock', cb),
    ),
    onPlaybackError: vi.fn((cb: (error: unknown) => void) =>
      addListener(listeners, 'playback-error', cb),
    ),
    onNativeMenuCommand: vi.fn((cb: (command: unknown) => void) =>
      addListener(listeners, 'native-menu-command', cb),
    ),
    syncAuditionScoreObjectAvailability: vi.fn(),
    onSaveComplete: vi.fn((cb: () => void) => addListener(listeners, 'save-complete', cb)),
    onSaveError: vi.fn((cb: (error: unknown) => void) => addListener(listeners, 'save-error', cb)),
    onEngineOutput: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'engine-output', cb),
    ),
    onEngineOutputSelect: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'engine-output-select', cb),
    ),
    onEngineOutputReset: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'engine-output-reset', cb),
    ),
    onGeneratedCsd: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'generated-csd', cb),
    ),
    onGeneratedCsdError: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'generated-csd-error', cb),
    ),
    onBlueLiveStatus: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'blue-live-status', cb),
    ),
    onRenderOperationStatus: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'render-operation-status', cb),
    ),
    onProjectDocumentUpdated: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'project-document-updated', cb),
    ),
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
    useScoreSelectionStore.getState().clearSelection();
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
    useRenderToDiskStore.setState({
      open: false,
      operationId: null,
      phase: null,
      progress: null,
      message: '',
      outputPath: null,
      action: null,
      error: null,
      outputExpanded: false,
      cancelRequested: false,
    });
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
    useRenderToDiskStore.setState({
      open: false,
      operationId: null,
      phase: null,
      progress: null,
      message: '',
      outputPath: null,
      action: null,
      error: null,
      outputExpanded: false,
      cancelRequested: false,
    });
    useScoreSelectionStore.getState().clearSelection();
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

  it('clears score selection and audition availability when the project closes', () => {
    useScoreSelectionStore.getState().setSelection(['sobj-1']);
    act(() => {
      root.render(<Harness />);
    });
    const projectClosedHandler = listeners.get('project-closed')!.values().next().value as (
      ...args: unknown[]
    ) => void;

    act(() => {
      projectClosedHandler();
    });

    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(0);
    expect(blueAPI.syncAuditionScoreObjectAvailability).toHaveBeenLastCalledWith(false);
  });

  it('shows a failure toast when a disk render fails after its dialog is gone', () => {
    act(() => {
      root.render(<Harness />);
    });

    const renderStatusHandler = listeners.get('render-operation-status')!.values().next().value as (
      status: RenderOperationStatus,
    ) => void;
    const error = 'Open command failed: spawn ENOENT';

    act(() => {
      renderStatusHandler({
        operationId: 'disk-closed',
        kind: 'diskRender',
        phase: 'failed',
        message: error,
        progress: null,
        outputPath: null,
        error,
      });
    });

    expect(toast.error).toHaveBeenCalledWith(error, { id: 'disk-closed' });

    useRenderToDiskStore.setState({ open: true, operationId: 'disk-visible', phase: 'completed' });
    act(() => {
      renderStatusHandler({
        operationId: 'disk-visible',
        kind: 'diskRender',
        phase: 'failed',
        message: error,
        progress: null,
        outputPath: null,
        error,
      });
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('reveals the no-project workbench when a panel is opened from Welcome', () => {
    act(() => {
      root.render(<Harness />);
    });

    const nativeMenuHandler = listeners.get('native-menu-command')!.values().next().value as (
      ...args: unknown[]
    ) => void;

    act(() => {
      nativeMenuHandler({ type: 'focus-panel', panelId: 'MixerTopComponent' });
    });

    expect(useUIStore.getState().activePanel).toBe('workspace');
  });

  it('applies canonical project updates for the active project session', () => {
    useProjectStore.setState({ sessionId: 7, loaded: true, title: 'Before freeze' });
    act(() => {
      root.render(<Harness />);
    });

    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;
    act(() => {
      projectUpdatedHandler({
        sessionId: 7,
        revision: 2,
        snapshot: { sessionId: 7, title: 'After freeze' },
      });
    });

    expect(useProjectStore.getState().title).toBe('After freeze');
    expect(getProjectDocumentRevision()).toBe(2);
  });

  it('ignores canonical project updates from a stale session', () => {
    useProjectStore.setState({ sessionId: 7, loaded: true, title: 'Current project' });
    act(() => {
      root.render(<Harness />);
    });

    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;
    act(() => {
      projectUpdatedHandler({
        sessionId: 6,
        revision: 99,
        snapshot: { sessionId: 6, title: 'Stale project' },
      });
    });

    expect(useProjectStore.getState().title).toBe('Current project');
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
    expect(persistedLayout.workbench?.serializedLayout).toEqual(legacyWorkbench);
    expect(useLayoutSettingsStore.getState().layout?.windows.main?.normalBounds).toEqual(
      legacyBounds,
    );
  });

  it('hydrates saved follow preferences from program settings at startup (SPEC 079)', async () => {
    const defaults = createDefaultProgramSettings('darwin');
    blueAPI.getProgramSettings.mockResolvedValue({
      ...defaults,
      playback: {
        ...defaults.playback,
        followPlayback: false,
        followPlaybackOnStart: false,
      },
    });

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);
    expect(usePlaybackStore.getState().followPlaybackOnStart).toBe(false);
  });

  it('preserves hydrated follow preferences when the project closes (SPEC 079)', async () => {
    const defaults = createDefaultProgramSettings('darwin');
    blueAPI.getProgramSettings.mockResolvedValue({
      ...defaults,
      playback: { ...defaults.playback, followPlayback: false },
    });

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);

    // An active suspended session must end with the project close while the
    // hydrated saved preference survives the runtime reset.
    act(() => {
      usePlaybackStore.setState({ isPlaying: true, status: 'playing' });
      usePlaybackStore.getState().suspendFollowForSession();
    });
    expect(usePlaybackStore.getState().followPlayback).toBe(false);

    const projectClosedHandler = listeners.get('project-closed')!.values().next()
      .value as () => void;
    act(() => {
      projectClosedHandler();
    });

    expect(usePlaybackStore.getState().status).toBe('idle');
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
  });

  it('applies resolved follow commands delivered on the native-menu channel (SPEC 079)', async () => {
    await act(async () => {
      root.render(<Harness />);
    });

    const nativeMenuHandler = listeners.get('native-menu-command')!.values().next().value as (
      command: unknown,
    ) => void;

    act(() => {
      nativeMenuHandler({ type: 'set-follow-playback', enabled: false });
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);

    act(() => {
      nativeMenuHandler({ type: 'set-follow-playback-on-render-start', enabled: false });
    });

    expect(usePlaybackStore.getState().followPlaybackOnStart).toBe(false);
  });
});
