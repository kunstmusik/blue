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
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}));

import { useIPCListeners } from '../hooks/use-ipc-listeners';
import {
  cancelScheduledProjectHistoryEntriesRefresh,
  getProjectHistoryEntries,
  getProjectHistoryProjection,
  setProjectHistoryEntries,
  setProjectHistoryProjection,
} from '../hooks/use-project-history';
import UndoHistoryPanel from '../components/workbench/panels/UndoHistoryPanel';
import {
  getProjectDocumentRevision,
  getProjectHistoryParticipantContextId,
  useProjectStore,
} from '../stores/project-store';
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
    onProjectRuntimeOutcome: vi.fn((cb: (...args: unknown[]) => void) =>
      addListener(listeners, 'project-runtime-outcome', cb),
    ),
    getProgramSettings: vi.fn(),
    updateWindowLayout: vi.fn(),
    readProjectHistory: vi.fn(),
    readProjectHistoryEntries: vi.fn(),
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

  it('ignores canonical project updates from a different document lifetime', () => {
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-current',
      loaded: true,
      title: 'Current document',
    });
    act(() => {
      root.render(<Harness />);
    });

    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-replaced',
        sessionId: 7,
        revision: 50,
        snapshot: { sessionId: 7, title: 'Replaced document leakage' },
      });
    });

    expect(useProjectStore.getState().title).toBe('Current document');
    expect(getProjectDocumentRevision()).toBe(0);
  });

  it('rejects older and equal revisions from other contexts', () => {
    useProjectStore.setState({ sessionId: 7, documentId: 'doc-1', loaded: true });
    act(() => {
      root.render(<Harness />);
    });
    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;

    // Establish the local revision base, then send an equal-revision event.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 4,
        snapshot: { sessionId: 7, title: 'Rev 4' },
      });
    });
    expect(useProjectStore.getState().title).toBe('Rev 4');

    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 4,
        snapshot: { sessionId: 7, title: 'Echoed rev 4' },
      });
    });
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 3,
        snapshot: { sessionId: 7, title: 'Stale rev 3' },
      });
    });

    expect(useProjectStore.getState().title).toBe('Rev 4');
  });

  it('accepts revision-zero snapshots on initial registration', () => {
    useProjectStore.setState({ sessionId: 0, documentId: null, loaded: false });
    act(() => {
      root.render(<Harness />);
    });

    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-initial',
        sessionId: 0,
        revision: 0,
        stateId: 'state-0',
        isDirty: false,
        history: {
          canUndo: false,
          canRedo: false,
          undoLabel: null,
          redoLabel: null,
          cursor: 0,
          length: 0,
          retainedBytes: 0,
          savedStateId: null,
          stateId: 'state-0',
        },
        acceptedOperationIds: [],
        snapshot: { sessionId: 0, documentId: 'doc-initial', title: 'Initial' },
      });
    });

    expect(useProjectStore.getState().title).toBe('Initial');
    expect(useProjectStore.getState().documentId).toBe('doc-initial');
  });

  it('projects the authoritative dirty state from other-context publications', () => {
    useProjectStore.setState({ sessionId: 7, documentId: 'doc-1', loaded: true, isDirty: false });
    act(() => {
      root.render(<Harness />);
    });
    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;

    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 5,
        isDirty: true,
        snapshot: { sessionId: 7, title: 'Remote edit' },
      });
    });
    expect(useProjectStore.getState().isDirty).toBe(true);

    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 6,
        isDirty: false,
        snapshot: { sessionId: 7, title: 'Saved elsewhere' },
      });
    });
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('applies save checkpoint publications at an unchanged revision (spec 106 FR-009)', () => {
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-1',
      loaded: true,
      isDirty: true,
    });
    act(() => {
      root.render(<Harness />);
    });
    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;

    // Establish the local revision base with a newer-revision publication.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 4,
        isDirty: true,
        acceptedOperationIds: [],
        snapshot: { sessionId: 7, title: 'Rev 4' },
      });
    });
    expect(useProjectStore.getState().title).toBe('Rev 4');
    expect(getProjectDocumentRevision()).toBe(4);

    // A successful save publishes at the SAME revision as a checkpoint.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 4,
        stateId: 'state-4',
        isDirty: false,
        history: {
          canUndo: true,
          canRedo: false,
          undoLabel: 'Edit One',
          redoLabel: null,
          cursor: 1,
          length: 1,
          retainedBytes: 8,
          savedStateId: 'state-4',
          stateId: 'state-4',
        },
        acceptedOperationIds: [],
        publicationKind: 'checkpoint',
        snapshot: { sessionId: 7, title: 'Rev 4' },
      });
    });

    expect(getProjectHistoryProjection()?.savedStateId).toBe('state-4');
    expect(useProjectStore.getState().isDirty).toBe(false);

    // Equal-revision mutation publications without ownership stay dropped.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 4,
        isDirty: true,
        acceptedOperationIds: [],
        snapshot: { sessionId: 7, title: 'Echoed rev 4' },
      });
    });
    expect(useProjectStore.getState().title).toBe('Rev 4');
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('restores selection hints from other-view publications and reconciles invalid targets', () => {
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-1',
      loaded: true,
      score: {
        ...useProjectStore.getState().score,
        layerGroups: [
          {
            groupId: 'g1',
            groupType: 'soundObject' as const,
            layers: [
              {
                layerId: 'l1',
                name: 'Layer',
                height: 40,
                muted: false,
                solo: false,
                items: [
                  {
                    objectId: 'obj-alive',
                    objectType: 'GenericScore',
                    name: 'Alive',
                    startBeats: 0,
                    durationBeats: 2,
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    useScoreSelectionStore.getState().clearSelection();
    act(() => {
      root.render(<Harness />);
    });

    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;

    // A publication from another view restores its stable origin selection.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 3,
        isDirty: true,
        originViewId: 'other-view',
        selectionHints: [{ targetType: 'scoreObject', targetId: 'obj-alive' }],
        snapshot: { sessionId: 7, title: 'Restored' },
      });
    });
    expect(useScoreSelectionStore.getState().selectedObjectIds.has('obj-alive')).toBe(true);

    // After the object is deleted elsewhere, hints referencing it reconcile
    // to a cleared selection instead of pointing at nothing.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 4,
        isDirty: true,
        originViewId: 'other-view',
        selectionHints: [
          { targetType: 'scoreObject', targetId: 'obj-alive' },
          { targetType: 'scoreObject', targetId: 'obj-deleted' },
        ],
        snapshot: { sessionId: 7, title: 'Restored 2' },
      });
    });
    expect(useScoreSelectionStore.getState().selectedObjectIds.has('obj-alive')).toBe(true);

    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 5,
        isDirty: true,
        originViewId: 'other-view',
        selectionHints: [{ targetType: 'scoreObject', targetId: 'obj-gone' }],
        snapshot: { sessionId: 7, title: 'Restored 3' },
      });
    });
    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(0);
  });

  it('preserves unrelated selections for closed or non-origin views and prunes deleted selections without hints', () => {
    const aliveScore = {
      layerGroups: [
        {
          groupId: 'g1',
          groupType: 'soundObject' as const,
          layers: [
            {
              layerId: 'l1',
              name: 'Layer',
              height: 40,
              muted: false,
              solo: false,
              items: [
                {
                  objectId: 'obj-alive',
                  objectType: 'GenericScore',
                  name: 'Alive',
                  startBeats: 0,
                  durationBeats: 2,
                },
              ],
            },
          ],
        },
      ],
    };
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-1',
      loaded: true,
      score: aliveScore,
    });
    useScoreSelectionStore.getState().setSelection(['obj-alive']);
    act(() => {
      root.render(<Harness />);
    });

    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;

    // A dedicated view is not allowed to replace the workbench selection.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 1,
        isDirty: true,
        originContextId: 'dedicated-track-context',
        originViewId: 'track-instrument',
        selectionHints: [{ targetType: 'scoreObject', targetId: 'obj-deleted' }],
        snapshot: { sessionId: 7, score: aliveScore },
      });
    });
    expect(useScoreSelectionStore.getState().selectedObjectIds).toEqual(new Set(['obj-alive']));

    // A closed origin also leaves a valid unrelated workbench selection alone.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 2,
        isDirty: true,
        originContextId: 'dedicated-closed-context',
        originViewId: 'effect-editor',
        selectionHints: [{ targetType: 'scoreObject', targetId: 'obj-deleted' }],
        snapshot: { sessionId: 7, score: aliveScore },
      });
    });
    expect(useScoreSelectionStore.getState().selectedObjectIds).toEqual(new Set(['obj-alive']));

    // Selection reconciliation is independent of replay hints: deleting the
    // selected object clears it even when the publication carries no hints.
    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-1',
        sessionId: 7,
        revision: 3,
        isDirty: true,
        snapshot: { sessionId: 7, score: { layerGroups: [] } },
      });
    });
    expect(useScoreSelectionStore.getState().selectedObjectIds.size).toBe(0);
  });

  it('suppresses replay of acknowledged own operations', async () => {
    vi.useFakeTimers();
    try {
      const blueApiWithCommit = window.blueAPI as typeof window.blueAPI & {
        commitProjectDocumentPatches: ReturnType<typeof vi.fn>;
      };
      blueApiWithCommit.commitProjectDocumentPatches = vi.fn(async () => ({
        changed: true,
        revision: 1,
        sessionId: 7,
      }));
      useProjectStore.setState({
        sessionId: 7,
        documentId: 'doc-1',
        loaded: true,
        title: 'Optimistic',
      });
      act(() => {
        root.render(<Harness />);
      });

      // Submit an own operation through the patch queue so it is tracked.
      await act(async () => {
        void useProjectStore.getState().applyProjectDocumentPatch({
          projectProperties: { title: 'Local edit' },
        });
        await vi.advanceTimersByTimeAsync(200);
      });
      const commitCall = blueApiWithCommit.commitProjectDocumentPatches.mock.calls[0];
      const metadata = commitCall?.[1] as { operationId?: string } | undefined;
      const operationId = metadata?.operationId;
      expect(operationId).toMatch(/^op-/);

      const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
        .value as (...args: unknown[]) => void;
      // The canonical echo acknowledges our own operation with a snapshot
      // captured from before the local optimistic application; it must not be
      // replayed over fresher local state.
      act(() => {
        projectUpdatedHandler({
          documentId: 'doc-1',
          sessionId: 7,
          revision: 1,
          acceptedOperationIds: [operationId],
          snapshot: { sessionId: 7, title: 'Stale canonical echo' },
        });
      });

      expect(useProjectStore.getState().title).toBe('Local edit');
      expect(getProjectDocumentRevision()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
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

  it('handles project runtime outcomes and updates project store status', async () => {
    const warning = vi.spyOn(toast, 'warning');
    useProjectStore.setState({ sessionId: 7, documentId: 'doc-runtime', loaded: true });
    await act(async () => {
      root.render(<Harness />);
    });

    const runtimeOutcomeHandler = listeners.get('project-runtime-outcome')?.values().next()
      .value as ((event: { outcomes: unknown[] }) => void) | undefined;
    expect(runtimeOutcomeHandler).toBeDefined();

    act(() => {
      runtimeOutcomeHandler!({
        documentId: 'doc-runtime',
        revision: 0,
        outcomes: [
          {
            performanceKind: 'timeline',
            status: 'restart-required',
            generation: 1,
            desiredRevision: 0,
          },
        ],
      });
    });

    expect(useProjectStore.getState().runtimeOutcomes).toHaveLength(1);
    expect(useProjectStore.getState().runtimeOutcomes[0].status).toBe('restart-required');
    expect(useProjectStore.getState().runtimeOutcomeStatusText).toBe(
      'Restart required for playback to reflect all changes',
    );
    expect(warning).not.toHaveBeenCalled();
  });

  it('fences runtime outcomes by revision and preserves unresolved outcomes across cosmetic commits', async () => {
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-runtime-fence',
      loaded: true,
      runtimeOutcomes: [],
      runtimeOutcomeStatusText: '',
    });
    await act(async () => {
      root.render(<Harness />);
    });

    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;

    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-runtime-fence',
        sessionId: 7,
        revision: 2,
        isDirty: true,
        runtimeOutcomes: [
          {
            performanceKind: 'timeline',
            status: 'failed',
            generation: 3,
            desiredRevision: 2,
            message: 'late engine failure',
          },
        ],
        snapshot: { sessionId: 7, documentId: 'doc-runtime-fence', title: 'Revision 2' },
      });
    });

    expect(getProjectDocumentRevision()).toBe(2);
    expect(useProjectStore.getState().runtimeOutcomes).toHaveLength(1);

    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-runtime-fence',
        sessionId: 7,
        revision: 1,
        isDirty: true,
        runtimeOutcomes: [
          {
            performanceKind: 'timeline',
            status: 'applied',
            generation: 4,
            desiredRevision: 1,
          },
        ],
        snapshot: { sessionId: 7, documentId: 'doc-runtime-fence', title: 'Stale' },
      });
    });

    expect(useProjectStore.getState().runtimeOutcomes[0].status).toBe('failed');

    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-runtime-fence',
        sessionId: 7,
        revision: 3,
        isDirty: true,
        runtimeOutcomes: [],
        snapshot: { sessionId: 7, documentId: 'doc-runtime-fence', title: 'Revision 3' },
      });
    });

    expect(useProjectStore.getState().runtimeOutcomes).toEqual([
      expect.objectContaining({
        performanceKind: 'timeline',
        status: 'failed',
        desiredRevision: 2,
      }),
    ]);
    expect(useProjectStore.getState().runtimeOutcomeStatusText).toContain(
      'Live synchronization failed',
    );
  });

  it('preserves a failed live update after a later cosmetic canonical publication', async () => {
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-runtime-cosmetic',
      loaded: true,
      runtimeOutcomes: [],
      runtimeOutcomeStatusText: '',
    });
    await act(async () => {
      root.render(<Harness />);
    });

    const runtimeOutcomeHandler = listeners.get('project-runtime-outcome')?.values().next()
      .value as ((event: unknown) => void) | undefined;
    const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
      .value as (...args: unknown[]) => void;
    expect(runtimeOutcomeHandler).toBeDefined();

    act(() => {
      runtimeOutcomeHandler!({
        documentId: 'doc-runtime-cosmetic',
        revision: 0,
        outcomes: [
          {
            performanceKind: 'blueLive',
            status: 'failed',
            generation: 4,
            desiredRevision: 0,
            message: 'live update rejected',
          },
        ],
      });
    });

    act(() => {
      projectUpdatedHandler({
        documentId: 'doc-runtime-cosmetic',
        sessionId: 7,
        revision: 1,
        isDirty: true,
        runtimeOutcomes: [],
        snapshot: { sessionId: 7, documentId: 'doc-runtime-cosmetic', title: 'Cosmetic edit' },
      });
    });

    expect(useProjectStore.getState().runtimeOutcomes).toEqual([
      expect.objectContaining({
        performanceKind: 'blueLive',
        status: 'failed',
        desiredRevision: 0,
      }),
    ]);
  });

  it('keeps unresolved runtime obligations visible across unrelated successful edits', () => {
    useProjectStore.setState({
      runtimeOutcomes: [],
      runtimeOutcomeStatusText: '',
    });

    useProjectStore.getState().handleRuntimeOutcomes([
      {
        performanceKind: 'timeline',
        generation: 2,
        desiredRevision: 4,
        status: 'restart-required',
        affectedOwnerIds: ['projectProperties'],
      },
    ]);
    useProjectStore.getState().handleRuntimeOutcomes([
      {
        performanceKind: 'timeline',
        generation: 2,
        desiredRevision: 5,
        status: 'applied',
        affectedOwnerIds: ['mixer-gates'],
      },
    ]);

    expect(useProjectStore.getState().runtimeOutcomes[0]).toEqual(
      expect.objectContaining({
        status: 'restart-required',
        desiredRevision: 5,
        affectedOwnerIds: expect.arrayContaining(['projectProperties', 'mixer-gates']),
      }),
    );
    expect(useProjectStore.getState().runtimeOutcomeStatusText).toBe(
      'Restart required for playback to reflect all changes',
    );

    useProjectStore.getState().handleRuntimeOutcomes([
      {
        performanceKind: 'blueLive',
        generation: 3,
        desiredRevision: 6,
        status: 'failed',
        affectedOwnerIds: ['Master'],
        message: 'gate write failed',
      },
    ]);
    useProjectStore.getState().handleRuntimeOutcomes([
      {
        performanceKind: 'blueLive',
        generation: 3,
        desiredRevision: 7,
        status: 'applied',
        affectedOwnerIds: ['Other'],
      },
    ]);

    expect(useProjectStore.getState().runtimeOutcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          performanceKind: 'blueLive',
          status: 'failed',
          desiredRevision: 7,
          affectedOwnerIds: expect.arrayContaining(['Master', 'Other']),
        }),
      ]),
    );
    expect(useProjectStore.getState().runtimeOutcomeStatusText).toContain(
      'Live synchronization failed',
    );
  });

  it('clears only the stopped performance outcome', async () => {
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-runtime-clear',
      loaded: true,
      runtimeOutcomes: [],
      runtimeOutcomeStatusText: '',
    });
    await act(async () => {
      root.render(<Harness />);
    });

    const runtimeOutcomeHandler = listeners.get('project-runtime-outcome')?.values().next()
      .value as ((event: unknown) => void) | undefined;
    expect(runtimeOutcomeHandler).toBeDefined();

    act(() => {
      runtimeOutcomeHandler!({
        documentId: 'doc-runtime-clear',
        revision: 0,
        outcomes: [
          {
            performanceKind: 'timeline',
            status: 'failed',
            generation: 1,
            desiredRevision: 0,
          },
          {
            performanceKind: 'blueLive',
            status: 'restart-required',
            generation: 2,
            desiredRevision: 0,
          },
        ],
      });
    });
    expect(useProjectStore.getState().runtimeOutcomes).toHaveLength(2);

    act(() => {
      runtimeOutcomeHandler!({
        documentId: 'doc-runtime-clear',
        revision: 0,
        outcomes: [],
        clearPerformanceKind: 'timeline',
      });
    });

    expect(useProjectStore.getState().runtimeOutcomes).toEqual([
      expect.objectContaining({ performanceKind: 'blueLive', status: 'restart-required' }),
    ]);
  });

  it('seeds and clears project history entries with the projection lifecycle (spec 106)', async () => {
    act(() => {
      root.render(<Harness />);
    });

    const projectLoadedHandler = listeners.get('project-loaded')!.values().next().value as (
      ...args: unknown[]
    ) => void;
    const projectClosedHandler = listeners.get('project-closed')!.values().next().value as (
      ...args: unknown[]
    ) => void;

    const loadedSnapshot = {
      documentId: 'doc-history-1',
      revision: 1,
      cursor: 1,
      entries: [{ entryId: 'e1', label: 'Edit One', timestamp: 100, afterStateId: 's1' }],
    };
    blueAPI.readProjectHistory.mockResolvedValue({
      canUndo: true,
      canRedo: false,
      undoLabel: 'Edit One',
      redoLabel: null,
      cursor: 1,
      length: 1,
      retainedBytes: 16,
      savedStateId: null,
      stateId: 's1',
      revision: 1,
    });
    blueAPI.readProjectHistoryEntries.mockResolvedValue(loadedSnapshot);

    await act(async () => {
      projectLoadedHandler({
        documentId: 'doc-history-1',
        title: 'History Project',
        missingAudioAssets: null,
      });
    });

    expect(blueAPI.readProjectHistoryEntries).toHaveBeenCalledWith({
      documentId: 'doc-history-1',
    });
    expect(getProjectHistoryEntries()).toEqual(loadedSnapshot);
    expect(getProjectHistoryProjection()?.undoLabel).toBe('Edit One');

    act(() => {
      projectClosedHandler();
    });

    expect(getProjectHistoryEntries()).toBeNull();
    expect(getProjectHistoryProjection()).toBeNull();
  });

  it('refreshes the undo panel from a cross-context publication without manual refresh (spec 106 SC-003)', async () => {
    vi.useFakeTimers();
    const panelContainer = document.createElement('div');
    document.body.appendChild(panelContainer);
    const panelRoot = createRoot(panelContainer);
    try {
      useProjectStore.setState({ sessionId: 7, documentId: 'doc-1', loaded: true });
      blueAPI.readProjectHistory.mockResolvedValue({
        canUndo: false,
        canRedo: false,
        undoLabel: null,
        redoLabel: null,
        cursor: 0,
        length: 0,
        retainedBytes: 0,
        savedStateId: null,
        stateId: 's0',
      });
      blueAPI.readProjectHistoryEntries.mockResolvedValue({
        documentId: 'doc-1',
        revision: 1,
        cursor: 0,
        entries: [],
      });

      act(() => {
        root.render(<Harness />);
        panelRoot.render(<UndoHistoryPanel />);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(panelContainer.textContent).toContain('No edits yet');

      // An edit committed by another context (e.g. a floated popout) arrives
      // through the canonical publication channel.
      blueAPI.readProjectHistoryEntries.mockResolvedValue({
        documentId: 'doc-1',
        revision: 2,
        cursor: 1,
        entries: [{ entryId: 'e1', label: 'Popout Edit', timestamp: 500, afterStateId: 's1' }],
      });
      const projectUpdatedHandler = listeners.get('project-document-updated')!.values().next()
        .value as (...args: unknown[]) => void;
      await act(async () => {
        projectUpdatedHandler({
          documentId: 'doc-1',
          sessionId: 7,
          revision: 2,
          stateId: 's1',
          isDirty: true,
          history: {
            canUndo: true,
            canRedo: false,
            undoLabel: 'Popout Edit',
            redoLabel: null,
            cursor: 1,
            length: 1,
            retainedBytes: 8,
            savedStateId: 's0',
            stateId: 's1',
          },
          acceptedOperationIds: [],
          originContextId: 'ctx-popout',
          snapshot: { sessionId: 7, title: 'Cross context' },
        });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(panelContainer.textContent).toContain('Popout Edit');

      // Publications from a different document lifetime must not touch it.
      const fetchCallsBefore = blueAPI.readProjectHistoryEntries.mock.calls.length;
      await act(async () => {
        projectUpdatedHandler({
          documentId: 'doc-other',
          sessionId: 7,
          revision: 9,
          acceptedOperationIds: [],
          snapshot: { sessionId: 7, title: 'Other document' },
        });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(panelContainer.textContent).toContain('Popout Edit');
      expect(blueAPI.readProjectHistoryEntries.mock.calls.length).toBe(fetchCallsBefore);
    } finally {
      cancelScheduledProjectHistoryEntriesRefresh();
      vi.useRealTimers();
      act(() => {
        panelRoot.unmount();
      });
      panelContainer.remove();
      setProjectHistoryEntries(null);
      setProjectHistoryProjection(null);
    }
  });
});
