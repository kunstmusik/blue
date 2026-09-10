// @vitest-environment browser
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useIPCListeners } from '../hooks/use-ipc-listeners';
import ProjectPropertiesPanel from '../components/workbench/panels/ProjectPropertiesPanel';
import {
  __testClearPendingPatches,
  acceptProjectDocumentRevision,
  flushProjectDocumentPatches,
  getProjectDocumentRevision,
  useProjectStore,
} from '../stores/project-store';
import {
  reconcileExternalSelectionHints,
  useScoreSelectionStore,
} from '../stores/score-selection-store';
import { createDefaultProgramSettings } from '../../shared/program-settings';
import {
  createDefaultWindowLayoutSettings,
  type WindowLayoutSettingsSnapshot,
} from '../../shared/window-layout-settings';
import type {
  ProjectDocumentCommitMetadata,
  ProjectDocumentUpdatedEvent,
  ProjectHistoryResponse,
  ProjectRuntimeOutcomeEvent,
} from '../../shared/project-history';
import type { ProjectDocumentPatch, ProjectEditorSnapshot } from '../../shared/project-editor';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type DocumentUpdatedListener = (event: ProjectDocumentUpdatedEvent) => void;

const documentUpdatedListeners = new Set<DocumentUpdatedListener>();

function makeEvent(
  overrides: Partial<ProjectDocumentUpdatedEvent> = {},
): ProjectDocumentUpdatedEvent {
  return {
    documentId: 'doc-1',
    sessionId: 7,
    revision: 2,
    stateId: 'state-2',
    isDirty: true,
    history: {
      canUndo: true,
      canRedo: false,
      undoLabel: 'Set Master Level',
      redoLabel: null,
      cursor: 2,
      length: 2,
      retainedBytes: 0,
      savedStateId: 'state-0',
      stateId: 'state-2',
    },
    acceptedOperationIds: [],
    snapshot: null,
    ...overrides,
  };
}

function dispatchDocumentUpdated(event: ProjectDocumentUpdatedEvent): void {
  for (const listener of documentUpdatedListeners) {
    listener(event);
  }

  // Mirrors the production use-ipc-listeners canonical-update handling.
  const store = useProjectStore.getState();
  if (event.sessionId !== store.sessionId) return;
  if (store.documentId && event.documentId !== store.documentId) return;
  if (event.revision <= getProjectDocumentRevision() && store.loaded) return;
  if (event.snapshot) {
    acceptProjectDocumentRevision(event.sessionId, event.revision);
    useProjectStore.getState().setProjectInfo(event.snapshot as never);
    if (event.isDirty) {
      useProjectStore.getState().markDirty();
    } else {
      useProjectStore.getState().markClean();
    }
    if (event.selectionHints && event.selectionHints.length > 0) {
      reconcileExternalSelectionHints(event.selectionHints, store.score);
    }
  }
}

interface BrowserPerformanceMemory {
  readonly usedJSHeapSize: number;
}

function browserHeapUsed(): number | null {
  const memory = (performance as Performance & { memory?: BrowserPerformanceMemory }).memory;
  return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null;
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)] ?? 0;
}

/**
 * Two views of the same document (main window + Dockview popout share one
 * renderer JS context): both subscribe to the project store and to canonical
 * publications. An undo issued from either view must refresh both.
 */
function createView(label: string, host: HTMLElement): Root {
  const root = createRoot(host);
  function View(): React.ReactElement {
    const title = useProjectStore((s) => s.title);
    const isDirty = useProjectStore((s) => s.isDirty);
    const selection = useScoreSelectionStore((s) => s.selectedObjectIds);
    return React.createElement(
      'div',
      { 'data-view': label },
      React.createElement('span', { 'data-field': 'title' }, title),
      React.createElement('span', { 'data-field': 'dirty' }, isDirty ? 'dirty' : 'clean'),
      React.createElement('span', { 'data-field': 'status' }, isDirty ? 'dirty' : 'clean'),
      React.createElement('span', { 'data-field': 'selection' }, [...selection].sort().join(',')),
    );
  }
  act(() => {
    root.render(React.createElement(View));
  });
  return root;
}

describe('global project history across two views (T029, US2)', () => {
  let hostA: HTMLElement;
  let hostB: HTMLElement;
  let rootA: Root;
  let rootB: Root;

  beforeEach(() => {
    documentUpdatedListeners.clear();
    (window as { blueAPI?: unknown }).blueAPI = {
      onProjectDocumentUpdated: vi.fn((cb: DocumentUpdatedListener) => {
        documentUpdatedListeners.add(cb);
        return () => documentUpdatedListeners.delete(cb);
      }),
      getProjectDocument: vi.fn(async () => null),
      commitProjectDocumentPatches: vi.fn(async () => ({
        changed: false,
        revision: 0,
        sessionId: 7,
      })),
    };

    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-1',
      loaded: true,
      title: 'Before Edit',
      isDirty: false,
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
                    objectId: 'obj-1',
                    objectType: 'GenericScore',
                    name: 'Object One',
                    startBeats: 0,
                    durationBeats: 2,
                  },
                  {
                    objectId: 'obj-2',
                    objectType: 'GenericScore',
                    name: 'Object Two',
                    startBeats: 4,
                    durationBeats: 2,
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    hostA = document.createElement('div');
    hostB = document.createElement('div');
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);
    rootA = createView('main', hostA);
    rootB = createView('popout', hostB);
  });

  afterEach(() => {
    act(() => {
      rootA.unmount();
      rootB.unmount();
    });
    hostA.remove();
    hostB.remove();
  });

  function titleOf(host: HTMLElement): string | null {
    return host.querySelector('[data-field="title"]')?.textContent ?? null;
  }

  function dirtyOf(host: HTMLElement): string | null {
    return host.querySelector('[data-field="dirty"]')?.textContent ?? null;
  }

  function selectionOf(host: HTMLElement): string | null {
    return host.querySelector('[data-field="selection"]')?.textContent ?? null;
  }

  it('refreshes every mounted view when another context edits the document', () => {
    expect(titleOf(hostA)).toBe('Before Edit');
    expect(titleOf(hostB)).toBe('Before Edit');

    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          revision: 5,
          isDirty: true,
          snapshot: { sessionId: 7, documentId: 'doc-1', title: 'Edited Elsewhere' },
        }),
      );
    });

    expect(titleOf(hostA)).toBe('Edited Elsewhere');
    expect(titleOf(hostB)).toBe('Edited Elsewhere');
    expect(dirtyOf(hostA)).toBe('dirty');
    expect(dirtyOf(hostB)).toBe('dirty');
  });

  it('propagates an undo issued from one view to the other view', () => {
    act(() => {
      useProjectStore.setState({ title: 'Edited State', isDirty: true });
    });
    expect(titleOf(hostA)).toBe('Edited State');
    expect(titleOf(hostB)).toBe('Edited State');

    // Undo issued from the popout view: the canonical publication restores.
    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          revision: 6,
          isDirty: true,
          history: makeEvent().history && {
            ...makeEvent().history,
            canUndo: true,
            canRedo: true,
            redoLabel: 'Set Master Level',
            cursor: 1,
          },
          snapshot: { sessionId: 7, documentId: 'doc-1', title: 'Restored State' },
        }),
      );
    });

    expect(titleOf(hostA)).toBe('Restored State');
    expect(titleOf(hostB)).toBe('Restored State');
  });

  it('restores origin selections in every view and reconciles invalid hints', () => {
    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          revision: 7,
          isDirty: true,
          originViewId: 'origin-view',
          selectionHints: [
            { targetType: 'scoreObject', targetId: 'obj-2' },
            { targetType: 'scoreObject', targetId: 'obj-1' },
          ],
          snapshot: { sessionId: 7, documentId: 'doc-1', title: 'With Selection' },
        }),
      );
    });

    expect(selectionOf(hostA)).toBe('obj-1,obj-2');
    expect(selectionOf(hostB)).toBe('obj-1,obj-2');

    // Hints whose targets no longer exist reconcile to a clear selection.
    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          revision: 8,
          isDirty: true,
          originViewId: 'origin-view',
          selectionHints: [{ targetType: 'scoreObject', targetId: 'obj-deleted' }],
          snapshot: { sessionId: 7, documentId: 'doc-1', title: 'After Delete' },
        }),
      );
    });

    expect(selectionOf(hostA)).toBe('');
    expect(selectionOf(hostB)).toBe('');
  });

  it('keeps stale-document publications away from both views', () => {
    act(() => {
      dispatchDocumentUpdated(
        makeEvent({
          documentId: 'doc-replaced',
          revision: 9,
          snapshot: { sessionId: 7, title: 'Replaced leakage' },
        }),
      );
    });

    expect(titleOf(hostA)).toBe('Before Edit');
    expect(titleOf(hostB)).toBe('Before Edit');
  });

  // This intentionally remains a component-only benchmark: it uses a vi.fn
  // commit seam, empty patches, and fabricated publications. T116's
  // production boundary below is the acceptance gate.
  it('measures the component-only canonical paint and status benchmark', async () => {
    type CommitRequest = {
      documentId: string;
      expectedRevision: number;
      contextSequence: number;
      label: string;
      patches: readonly unknown[];
    };
    type CommitResponse = { changed: boolean; revision: number; sessionId: number };
    type BrowserHistoryApi = {
      commitProjectDocumentPatches: (request: CommitRequest) => Promise<CommitResponse>;
    };

    const api = (window as unknown as { blueAPI: BrowserHistoryApi }).blueAPI;
    const paintLatencies: number[] = [];
    const statusLatencies: number[] = [];
    const heapBefore = browserHeapUsed();
    let revision = 100;
    let commandReceivedAt = 0;

    api.commitProjectDocumentPatches = vi.fn(async () => {
      commandReceivedAt = performance.now();
      const nextRevision = ++revision;
      dispatchDocumentUpdated(
        makeEvent({
          revision: nextRevision,
          isDirty: true,
          history: {
            ...makeEvent().history,
            cursor: nextRevision,
            length: nextRevision,
          },
          snapshot: {
            sessionId: 7,
            documentId: 'doc-1',
            title: `Measured ${nextRevision}`,
          },
        }),
      );
      return { changed: true, revision: nextRevision, sessionId: 7 };
    });

    const submit = (contextSequence: number) =>
      api.commitProjectDocumentPatches({
        documentId: 'doc-1',
        expectedRevision: revision,
        contextSequence,
        label: 'Measured canonical edit',
        patches: [],
      });

    // Warm the browser and React scheduler before collecting samples.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await submit(i + 1);
        await nextPaint();
      });
    }
    act(() => {
      useProjectStore.setState({ title: 'Before Edit', isDirty: false });
    });

    for (let i = 0; i < 100; i++) {
      const expectedTitle = `Measured ${revision + 1}`;
      await act(async () => {
        const result = await submit(i + 6);
        expect(result.changed).toBe(true);
        await nextPaint();

        const canonicalPaintAt = performance.now();
        expect(titleOf(hostA)).toBe(expectedTitle);
        expect(titleOf(hostB)).toBe(expectedTitle);
        const statusRenderAt = performance.now();
        expect(dirtyOf(hostA)).toBe('dirty');
        expect(dirtyOf(hostB)).toBe('dirty');
        expect(hostA.querySelector('[data-field="status"]')?.textContent).toBe('dirty');
        expect(hostB.querySelector('[data-field="status"]')?.textContent).toBe('dirty');

        paintLatencies.push(canonicalPaintAt - commandReceivedAt);
        statusLatencies.push(statusRenderAt - commandReceivedAt);
      });
    }

    const heapAfter = browserHeapUsed();
    const metrics = {
      samples: paintLatencies.length,
      paintedCanonicalViewMs: {
        p50: percentile(paintLatencies, 50),
        p95: percentile(paintLatencies, 95),
        max: Math.max(...paintLatencies),
      },
      statusRenderMs: {
        p50: percentile(statusLatencies, 50),
        p95: percentile(statusLatencies, 95),
        max: Math.max(...statusLatencies),
      },
      heapDeltaBytes: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
    };
    console.log(`[T087 component browser benchmark] ${JSON.stringify(metrics)}`);

    expect(paintLatencies).toHaveLength(100);
    expect(statusLatencies).toHaveLength(100);
    expect(metrics.paintedCanonicalViewMs.p95).toBeLessThanOrEqual(200);
  });
});

type ProductionHistoryListener = (payload: unknown) => void;

interface ProductionHistoryHarness {
  api: Record<string, unknown>;
  dispatchNativeMenuCommand(command: { type: 'undo' | 'redo' }): Promise<ProjectHistoryResponse>;
  dispatchRuntimeFailure(message: string): void;
  commandReceivedAt(): number;
  retainedBytes(): number;
}

function snapshotFromProductionStore(title?: string): ProjectEditorSnapshot {
  const state = useProjectStore.getState();
  return {
    filePath: state.filePath,
    version: state.version,
    sessionId: state.sessionId,
    documentId: state.documentId ?? undefined,
    globalOrc: state.globalOrc,
    globalSco: state.globalSco,
    orchestra: structuredClone(state.orchestra),
    mixer: structuredClone(state.mixer),
    projectProperties: {
      ...structuredClone(state.projectProperties),
      ...(title === undefined ? {} : { title }),
    },
    clojureProject: structuredClone(state.clojureProject),
    transport: structuredClone(state.transport),
    tablesText: state.tablesText,
    scratchPad: structuredClone(state.scratchPad),
    projectUdos: structuredClone(state.projectUdos),
    loaded: true,
    ...(state.blueLive ? { blueLive: structuredClone(state.blueLive) } : {}),
    ...(state.midiInput ? { midiInput: structuredClone(state.midiInput) } : {}),
    score: structuredClone(state.score),
    namedChains: { names: [] },
  };
}

/**
 * A browser-safe main-process stand-in. Unlike the legacy component benchmark
 * above, it owns canonical snapshots and history state, emits the same
 * publication/boundary events as main, and is exercised through the actual
 * renderer listener and native-menu routing hooks.
 */
function createProductionHistoryHarness(): ProductionHistoryHarness {
  const listeners = new Map<string, Set<ProductionHistoryListener>>();
  const subscribe = (channel: string, listener: ProductionHistoryListener): (() => void) => {
    const channelListeners = listeners.get(channel) ?? new Set<ProductionHistoryListener>();
    channelListeners.add(listener);
    listeners.set(channel, channelListeners);
    return () => channelListeners.delete(listener);
  };
  const publish = (channel: string, payload: unknown): void => {
    for (const listener of listeners.get(channel) ?? []) listener(payload);
  };

  const savedStateId = 'state-0';
  let revision = 0;
  let cursor = 0;
  let canonical = snapshotFromProductionStore('Before Edit');
  let snapshots = [canonical];
  let stateIds = [savedStateId];
  let commandSequence = 0;
  let commandReceivedAt = 0;
  let lastHistoryCommand: Promise<ProjectHistoryResponse> | null = null;
  const acknowledgedBarriers = new Set<string>();
  const boundaryWaiters = new Map<string, () => void>();

  const projection = () => ({
    canUndo: cursor > 0,
    canRedo: cursor < snapshots.length - 1,
    undoLabel: cursor > 0 ? 'Set Project Title' : null,
    redoLabel: cursor < snapshots.length - 1 ? 'Set Project Title' : null,
    cursor,
    length: snapshots.length - 1,
    retainedBytes: snapshots.reduce(
      (total, snapshot) => total + JSON.stringify(snapshot).length * 2,
      0,
    ),
    savedStateId,
    stateId: stateIds[cursor] ?? savedStateId,
  });

  const publishCanonical = (operationId: string): void => {
    const history = projection();
    const event: ProjectDocumentUpdatedEvent<ProjectEditorSnapshot> = {
      documentId: 'doc-1',
      sessionId: 7,
      revision,
      stateId: history.stateId,
      isDirty: history.stateId !== savedStateId,
      history,
      acceptedOperationIds: [operationId],
      snapshot: structuredClone(canonical),
    };
    publish('project-document-updated', event);
  };

  const applyCommitPatches = (patches: readonly ProjectDocumentPatch[]): void => {
    const next = structuredClone(snapshots[cursor]!);
    for (const patch of patches) {
      if (!patch.projectProperties) continue;
      next.projectProperties = {
        ...next.projectProperties,
        ...patch.projectProperties,
      };
    }
    snapshots = [...snapshots.slice(0, cursor + 1), next];
    stateIds = [...stateIds.slice(0, cursor + 1), `state-${revision + 1}`];
    cursor += 1;
    revision += 1;
    canonical = next;
  };

  const waitForBoundaryAck = async (barrierId: string): Promise<void> => {
    if (acknowledgedBarriers.has(barrierId)) return;
    await new Promise<void>((resolve) => {
      boundaryWaiters.set(barrierId, resolve);
    });
  };

  const runHistoryCommand = async (
    request: { operationId: string },
    direction: 'undo' | 'redo',
  ): Promise<ProjectHistoryResponse> => {
    commandSequence += 1;
    commandReceivedAt = performance.now();
    const barrierId = `production-boundary-${commandSequence}`;
    publish('prepare-history-boundary', { barrierId, reason: direction });
    await waitForBoundaryAck(barrierId);

    if (
      (direction === 'undo' && cursor === 0) ||
      (direction === 'redo' && cursor === snapshots.length - 1)
    ) {
      const history = projection();
      return {
        status: 'unchanged',
        operationId: request.operationId,
        documentId: 'doc-1',
        revision,
        stateId: history.stateId,
        isDirty: history.stateId !== savedStateId,
        history,
      };
    }

    cursor += direction === 'undo' ? -1 : 1;
    revision += 1;
    canonical = structuredClone(snapshots[cursor]!);
    publishCanonical(request.operationId);
    publish('release-history-boundary', { barrierId, status: 'ready' });

    const history = projection();
    return {
      status: 'committed',
      operationId: request.operationId,
      documentId: 'doc-1',
      revision,
      stateId: history.stateId,
      isDirty: history.stateId !== savedStateId,
      history,
      runtimeOutcomes: [],
    };
  };

  const api: Record<string, unknown> = {
    getProgramSettings: vi.fn(async () => createDefaultProgramSettings('darwin')),
    updateWindowLayout: vi.fn(
      async () => createDefaultWindowLayoutSettings() as WindowLayoutSettingsSnapshot,
    ),
    syncAuditionScoreObjectAvailability: vi.fn(),
    syncLegacyRendererSettings: vi.fn(async () => undefined),
    setRecentFiles: vi.fn(async () => undefined),
    syncHistoryAvailability: vi.fn(),
    getProjectDocument: vi.fn(async () => structuredClone(canonical)),
    readProjectHistory: vi.fn(async () => projection()),
    registerHistoryParticipant: vi.fn(async () => ({ ok: true })),
    unregisterHistoryParticipant: vi.fn(async () => ({ ok: true })),
    acknowledgeHistoryBoundary: vi.fn(async (ack: unknown) => {
      const barrierId = (ack as { barrierId: string }).barrierId;
      acknowledgedBarriers.add(barrierId);
      boundaryWaiters.get(barrierId)?.();
      boundaryWaiters.delete(barrierId);
      return { ok: true };
    }),
    commitProjectDocumentPatches: vi.fn(
      async (patches: unknown[], metadata: unknown = undefined) => {
        const typedMetadata = metadata as ProjectDocumentCommitMetadata | undefined;
        const operationId = typedMetadata?.operationId ?? `production-commit-${revision + 1}`;
        applyCommitPatches(patches as ProjectDocumentPatch[]);
        publishCanonical(operationId);
        const history = projection();
        return {
          changed: true,
          revision,
          sessionId: 7,
          documentId: 'doc-1',
          stateId: history.stateId,
        };
      },
    ),
    undoProjectHistory: vi.fn((request: unknown) => {
      const typedRequest = request as { operationId: string };
      lastHistoryCommand = runHistoryCommand(typedRequest, 'undo');
      return lastHistoryCommand;
    }),
    redoProjectHistory: vi.fn((request: unknown) => {
      const typedRequest = request as { operationId: string };
      lastHistoryCommand = runHistoryCommand(typedRequest, 'redo');
      return lastHistoryCommand;
    }),
  };

  const eventChannels = [
    'project-loaded',
    'project-closed',
    'playback-status',
    'playback-clock',
    'playback-error',
    'native-menu-command',
    'save-complete',
    'save-error',
    'engine-output',
    'engine-output-select',
    'engine-output-reset',
    'generated-csd',
    'generated-csd-error',
    'blue-live-status',
    'render-operation-status',
    'engine-recovery-status',
    'project-document-updated',
    'project-runtime-outcome',
    'prepare-history-boundary',
    'release-history-boundary',
  ];
  for (const channel of eventChannels) {
    const methodName = `on${channel
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')}`;
    api[methodName] = vi.fn((callback: ProductionHistoryListener) => subscribe(channel, callback));
  }

  return {
    api,
    async dispatchNativeMenuCommand(command) {
      const priorSequence = commandSequence;
      publish('native-menu-command', command);
      const deadline = performance.now() + 5000;
      while (commandSequence === priorSequence && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (commandSequence === priorSequence || !lastHistoryCommand) {
        throw new Error(`Production ${command.type} route did not reach the history bridge`);
      }
      return lastHistoryCommand;
    },
    dispatchRuntimeFailure(message) {
      const event: ProjectRuntimeOutcomeEvent = {
        documentId: 'doc-1',
        revision,
        outcomes: [
          {
            performanceKind: 'timeline',
            generation: 1,
            desiredRevision: revision,
            status: 'failed',
            message,
          },
        ],
      };
      publish('project-runtime-outcome', event);
    },
    commandReceivedAt: () => commandReceivedAt,
    retainedBytes: () => projection().retainedBytes,
  };
}

describe('global project history production boundary (T116, US2/US3)', () => {
  let listenerHost: HTMLElement;
  let viewHostA: HTMLElement;
  let viewHostB: HTMLElement;
  let listenerRoot: Root;
  let viewRootA: Root;
  let viewRootB: Root;

  function ListenerHarness(): React.ReactElement {
    useIPCListeners();
    return React.createElement('div');
  }

  function titleOf(host: HTMLElement): string {
    return (
      (host.querySelector('input[data-history-scope="project"]') as HTMLInputElement)?.value ?? ''
    );
  }

  beforeEach(() => {
    __testClearPendingPatches();
    useProjectStore.getState().clearProject();
    const state = useProjectStore.getState();
    useProjectStore.setState({
      sessionId: 7,
      documentId: 'doc-1',
      loaded: true,
      title: 'Before Edit',
      version: state.version || '2.10.1',
      isDirty: false,
      projectProperties: {
        ...state.projectProperties,
        title: 'Before Edit',
        author: 'Browser acceptance',
      },
    });

    listenerHost = document.createElement('div');
    viewHostA = document.createElement('div');
    viewHostB = document.createElement('div');
    document.body.append(listenerHost, viewHostA, viewHostB);
  });

  afterEach(() => {
    __testClearPendingPatches();
    act(() => {
      listenerRoot.unmount();
      viewRootA.unmount();
      viewRootB.unmount();
    });
    listenerHost.remove();
    viewHostA.remove();
    viewHostB.remove();
    Reflect.deleteProperty(window, 'blueAPI');
    vi.restoreAllMocks();
  });

  it('routes 100 undo/redo pairs through production listeners, boundaries, canonical replay, and painted views', async () => {
    const harness = createProductionHistoryHarness();
    Object.defineProperty(window, 'blueAPI', {
      configurable: true,
      value: harness.api,
    });

    listenerRoot = createRoot(listenerHost);
    viewRootA = createRoot(viewHostA);
    viewRootB = createRoot(viewHostB);
    act(() => {
      listenerRoot.render(React.createElement(ListenerHarness));
      viewRootA.render(React.createElement(ProjectPropertiesPanel));
      viewRootB.render(React.createElement(ProjectPropertiesPanel));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(titleOf(viewHostA)).toBe('Before Edit');
    expect(titleOf(viewHostB)).toBe('Before Edit');

    const commitTitle = async (title: string): Promise<void> => {
      await act(async () => {
        await useProjectStore
          .getState()
          .updateProjectProperties({ title }, { label: 'Set Project Title', phase: 'single' });
        await flushProjectDocumentPatches();
        await nextPaint();
      });
    };
    const runCommand = async (type: 'undo' | 'redo', expectedTitle: string): Promise<number> => {
      let response: ProjectHistoryResponse | undefined;
      await act(async () => {
        response = await harness.dispatchNativeMenuCommand({ type });
      });
      await act(async () => {
        await nextPaint();
      });
      expect(response?.status).toBe('committed');
      expect(titleOf(viewHostA)).toBe(expectedTitle);
      expect(titleOf(viewHostB)).toBe(expectedTitle);
      expect(useProjectStore.getState().isDirty).toBe(
        type === 'redo' || expectedTitle !== 'Before Edit',
      );
      return performance.now() - harness.commandReceivedAt();
    };

    let currentTitle = 'Before Edit';
    for (let i = 0; i < 5; i += 1) {
      const nextTitle = `Warmup ${i}`;
      await commitTitle(nextTitle);
      await runCommand('undo', currentTitle);
      await runCommand('redo', nextTitle);
      currentTitle = nextTitle;
    }

    const undoLatencies: number[] = [];
    const redoLatencies: number[] = [];
    const heapBefore = browserHeapUsed();
    for (let i = 0; i < 100; i += 1) {
      const nextTitle = `Measured ${i}`;
      const previousTitle = currentTitle;
      await commitTitle(nextTitle);
      undoLatencies.push(await runCommand('undo', previousTitle));
      redoLatencies.push(await runCommand('redo', nextTitle));
      currentTitle = nextTitle;
    }

    const failureMessage = 'Injected timeline acknowledgement failure';
    const errorSpy = vi.spyOn(toast, 'error');
    const failureDeterminedAt = performance.now();
    let visibleErrorAt = failureDeterminedAt;
    await act(async () => {
      harness.dispatchRuntimeFailure(failureMessage);
      visibleErrorAt = performance.now();
      await nextPaint();
    });
    expect(errorSpy).toHaveBeenCalledWith(`Live synchronization failed: ${failureMessage}`);

    const heapAfter = browserHeapUsed();
    const metrics = {
      samplesPerCommand: 100,
      undoMs: {
        p50: percentile(undoLatencies, 50),
        p95: percentile(undoLatencies, 95),
        max: Math.max(...undoLatencies),
      },
      redoMs: {
        p50: percentile(redoLatencies, 50),
        p95: percentile(redoLatencies, 95),
        max: Math.max(...redoLatencies),
      },
      retainedBytes: harness.retainedBytes(),
      heapDeltaBytes: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
      failureToVisibleErrorMs: visibleErrorAt - failureDeterminedAt,
    };
    console.log(`[T116 end-to-end browser boundary metrics] ${JSON.stringify(metrics)}`);

    expect(undoLatencies).toHaveLength(100);
    expect(redoLatencies).toHaveLength(100);
    expect(metrics.undoMs.p95).toBeLessThanOrEqual(200);
    expect(metrics.redoMs.p95).toBeLessThanOrEqual(200);
    expect(metrics.failureToVisibleErrorMs).toBeLessThanOrEqual(1000);
  });
});
