// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { toast } from 'sonner';
import type {
  TrackInstrumentEditorPatchResult,
  TrackInstrumentEditorSnapshot,
} from '../../shared/project-editor';
import { createDefaultBlueX7Voice } from '@blue/data';

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock('../components/workbench/panels/orchestra/InstrumentEditorPanel', () => ({
  default: ({
    instrument,
    onOrchestraPatch,
    onEditorUsable,
    blueX7Runtime,
  }: {
    instrument: { name: string };
    onOrchestraPatch: (patch: { type: 'updateInstrument'; patch: { name: string } }) => void;
    onEditorUsable: () => void;
    blueX7Runtime?: { enabled: boolean };
  }) => (
    <div>
      <button
        type="button"
        data-testid="instrument-editor"
        onClick={() => onOrchestraPatch({ type: 'updateInstrument', patch: { name: 'Updated' } })}
      >
        {instrument.name}
      </button>
      <button
        type="button"
        data-testid="rapid-control"
        onClick={() => {
          for (const value of [0.25, 0.5, 0.75]) {
            onOrchestraPatch({
              type: 'updateInstrument',
              patch: {
                bsbInterface: {
                  type: 'updateWidgetProperties',
                  widgetId: 'gain-slider',
                  properties: { value },
                },
              },
            } as never);
          }
        }}
      >
        Rapid control
      </button>
      <button type="button" data-testid="editor-usable" onClick={onEditorUsable}>
        Editor usable
      </button>
      {blueX7Runtime && (
        <div data-testid="blue-x7-runtime" data-enabled={String(blueX7Runtime.enabled)} />
      )}
    </div>
  ),
}));

import TrackInstrumentEditorPage from '../components/track-instrument-editor/TrackInstrumentEditorPage';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeSnapshot(): TrackInstrumentEditorSnapshot {
  return {
    track: {
      rootGroupId: 'editor-group',
      trackId: 'editor-track',
      projectSessionId: 2,
      projectRevision: 3,
    },
    instrument: {
      assignmentId: 'editor-track',
      type: 'generic',
      name: 'Initial Instrument',
      enabled: true,
      comment: '',
      text: 'out a1',
      globalOrc: '',
      globalSco: '',
      udolist: [],
    },
    projectUdos: [],
  };
}

function makeBlueX7Snapshot(): TrackInstrumentEditorSnapshot {
  return {
    ...makeSnapshot(),
    instrument: {
      assignmentId: 'editor-track',
      type: 'blueX7',
      name: 'Live X7',
      enabled: true,
      comment: '',
      voice: createDefaultBlueX7Voice(),
      parameters: [
        {
          parameterId: 'gain-id',
          semanticKey: 'common.feedback',
          fixedValue: 0,
          automationEnabled: true,
        },
      ],
    },
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('Track instrument editor window page', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
    delete (window as typeof window & { blueAPI?: unknown }).blueAPI;
  });

  it('loads the stable Track target and forwards editor patches to the main bridge', async () => {
    window.history.replaceState(
      {},
      '',
      '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
    );
    const update = vi.fn().mockResolvedValue({
      status: 'applied',
      snapshot: {
        ...makeSnapshot(),
        instrument: { ...makeSnapshot().instrument, name: 'Updated' },
        track: { ...makeSnapshot().track, projectRevision: 4 },
      },
    });
    const onProjectDocumentUpdated = vi.fn(() => () => undefined);
    window.blueAPI = {
      getTrackInstrumentEditorDocument: vi.fn().mockResolvedValue(makeSnapshot()),
      updateTrackInstrumentEditorDocument: update,
      onProjectDocumentUpdated,
      sendBsbRealtimeControlUpdate: vi.fn().mockResolvedValue(undefined),
    } as never;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrackInstrumentEditorPage />);
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="instrument-editor"]')?.textContent).toBe(
      'Initial Instrument',
    );
    expect(onProjectDocumentUpdated).toHaveBeenCalledTimes(1);

    await act(async () => {
      (container.querySelector('[data-testid="instrument-editor"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        track: expect.objectContaining({ rootGroupId: 'editor-group', trackId: 'editor-track' }),
        patch: { name: 'Updated' },
      }),
    );

    act(() => root.unmount());
  });

  it('streams rapid BSB controls immediately while serializing and coalescing durable patches', async () => {
    window.history.replaceState(
      {},
      '',
      '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
    );
    const firstUpdate = deferred<TrackInstrumentEditorPatchResult>();
    const update = vi
      .fn()
      .mockImplementationOnce(() => firstUpdate.promise)
      .mockResolvedValue({
        status: 'applied',
        snapshot: {
          ...makeSnapshot(),
          track: { ...makeSnapshot().track, projectRevision: 5 },
        },
      });
    const realtime = vi.fn().mockResolvedValue(undefined);
    window.blueAPI = {
      getTrackInstrumentEditorDocument: vi.fn().mockResolvedValue(makeSnapshot()),
      updateTrackInstrumentEditorDocument: update,
      onProjectDocumentUpdated: vi.fn(() => () => undefined),
      sendBsbRealtimeControlUpdate: realtime,
    } as never;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrackInstrumentEditorPage />);
      await Promise.resolve();
    });

    await act(async () => {
      (container.querySelector('[data-testid="rapid-control"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(realtime).toHaveBeenCalledTimes(3);
    expect(realtime).toHaveBeenLastCalledWith({
      track: {
        projectSessionId: 2,
        rootGroupId: 'editor-group',
        trackId: 'editor-track',
      },
      widgetId: 'gain-slider',
      kind: 'value',
      payload: { value: 0.75 },
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'gain-slider',
            properties: { value: 0.25 },
          },
        },
      }),
    );

    await act(async () => {
      firstUpdate.resolve({
        status: 'applied',
        snapshot: {
          ...makeSnapshot(),
          track: { ...makeSnapshot().track, projectRevision: 4 },
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        track: expect.objectContaining({ projectRevision: 4 }),
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties',
            widgetId: 'gain-slider',
            properties: { value: 0.75 },
          },
        },
      }),
    );
    expect(container.textContent).not.toContain('changed elsewhere');

    act(() => root.unmount());
  });

  it('rebases and retries a durable patch when an unrelated project update advances the revision', async () => {
    window.history.replaceState(
      {},
      '',
      '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
    );
    const update = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'stale',
        snapshot: {
          ...makeSnapshot(),
          track: { ...makeSnapshot().track, projectRevision: 4 },
        },
      })
      .mockResolvedValueOnce({
        status: 'applied',
        snapshot: {
          ...makeSnapshot(),
          instrument: { ...makeSnapshot().instrument, name: 'Updated' },
          track: { ...makeSnapshot().track, projectRevision: 5 },
        },
      });
    window.blueAPI = {
      getTrackInstrumentEditorDocument: vi.fn().mockResolvedValue(makeSnapshot()),
      updateTrackInstrumentEditorDocument: update,
      onProjectDocumentUpdated: vi.fn(() => () => undefined),
      sendBsbRealtimeControlUpdate: vi.fn().mockResolvedValue(undefined),
    } as never;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrackInstrumentEditorPage />);
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="instrument-editor"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0]?.[0].track.projectRevision).toBe(3);
    expect(update.mock.calls[1]?.[0].track.projectRevision).toBe(4);
    expect(container.textContent).not.toContain('changed elsewhere');

    act(() => root.unmount());
  });

  it('uses a visually neutral shell while the snapshot is loading', async () => {
    window.history.replaceState(
      {},
      '',
      '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
    );
    window.blueAPI = {
      getTrackInstrumentEditorDocument: vi.fn(() => new Promise(() => {})),
      updateTrackInstrumentEditorDocument: vi.fn(),
      onProjectDocumentUpdated: vi.fn(() => () => undefined),
      sendBsbRealtimeControlUpdate: vi.fn(),
    } as never;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrackInstrumentEditorPage />);
    });

    const loadingShell = container.querySelector('div');
    expect(loadingShell?.className).toContain('bg-app-bg');
    expect(loadingShell?.getAttribute('aria-hidden')).toBe('true');
    expect(container.textContent).not.toContain('Loading');
    act(() => root.unmount());
  });

  it('surfaces exhausted stale save retries as visible feedback while retaining the draft (T122)', async () => {
    window.history.replaceState(
      {},
      '',
      '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
    );
    vi.mocked(toast.error).mockClear();

    let revision = 3;
    const update = vi.fn().mockImplementation(async () => {
      revision += 1;
      return {
        status: 'stale',
        snapshot: {
          ...makeSnapshot(),
          track: { ...makeSnapshot().track, projectRevision: revision },
        },
      };
    });
    window.blueAPI = {
      getTrackInstrumentEditorDocument: vi.fn().mockResolvedValue(makeSnapshot()),
      updateTrackInstrumentEditorDocument: update,
      onProjectDocumentUpdated: vi.fn(() => () => undefined),
      sendBsbRealtimeControlUpdate: vi.fn().mockResolvedValue(undefined),
    } as never;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrackInstrumentEditorPage />);
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="instrument-editor"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    // 1 attempt + MAX_STALE_RETRIES retries, then visible failure feedback.
    expect(update).toHaveBeenCalledTimes(4);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Unable to save the Track instrument change'),
    );
    expect(container.textContent).not.toContain('no longer available');

    act(() => root.unmount());
  });

  it('surfaces realtime control update failures as visible feedback (T122)', async () => {
    window.history.replaceState(
      {},
      '',
      '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
    );
    vi.mocked(toast.error).mockClear();

    const realtime = vi.fn().mockRejectedValue(new Error('engine unreachable'));
    window.blueAPI = {
      getTrackInstrumentEditorDocument: vi.fn().mockResolvedValue(makeSnapshot()),
      updateTrackInstrumentEditorDocument: vi.fn().mockResolvedValue({
        status: 'applied',
        snapshot: makeSnapshot(),
      }),
      onProjectDocumentUpdated: vi.fn(() => () => undefined),
      sendBsbRealtimeControlUpdate: realtime,
    } as never;

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrackInstrumentEditorPage />);
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="rapid-control"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(realtime).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Unable to send the live control update'),
    );
    consoleError.mockRestore();
    act(() => root.unmount());
  });

  it('gates BlueX7 runtime activity on editor readiness and ordered status updates', async () => {
    window.history.replaceState(
      {},
      '',
      '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
    );
    let runtimeCallback:
      | ((status: { sequence: number; playbackRunning: boolean; blueLiveRunning: boolean }) => void)
      | undefined;
    const unsubscribe = vi.fn(async () => undefined);
    window.blueAPI = {
      getTrackInstrumentEditorDocument: vi.fn().mockResolvedValue(makeBlueX7Snapshot()),
      subscribeTrackInstrumentRuntimeStatus: vi.fn((_request, callback) => {
        runtimeCallback = callback;
        return Promise.resolve({
          status: { sequence: 0, playbackRunning: false, blueLiveRunning: false },
          unsubscribe,
        });
      }),
      updateTrackInstrumentEditorDocument: vi.fn(),
      onProjectDocumentUpdated: vi.fn(() => () => undefined),
      sendBsbRealtimeControlUpdate: vi.fn().mockResolvedValue(undefined),
    } as never;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrackInstrumentEditorPage />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const runtime = () => container.querySelector('[data-testid="blue-x7-runtime"]');
    expect(runtime()?.getAttribute('data-enabled')).toBe('false');

    await act(async () => {
      runtimeCallback?.({ sequence: 1, playbackRunning: true, blueLiveRunning: false });
    });
    expect(runtime()?.getAttribute('data-enabled')).toBe('false');

    await act(async () => {
      (container.querySelector('[data-testid="editor-usable"]') as HTMLButtonElement).click();
    });
    expect(runtime()?.getAttribute('data-enabled')).toBe('true');

    await act(async () => {
      runtimeCallback?.({ sequence: 2, playbackRunning: false, blueLiveRunning: false });
    });
    expect(runtime()?.getAttribute('data-enabled')).toBe('false');

    await act(async () => {
      runtimeCallback?.({ sequence: 1, playbackRunning: true, blueLiveRunning: false });
    });
    expect(runtime()?.getAttribute('data-enabled')).toBe('false');

    await act(async () => {
      runtimeCallback?.({ sequence: 3, playbackRunning: false, blueLiveRunning: true });
    });
    expect(runtime()?.getAttribute('data-enabled')).toBe('true');

    act(() => root.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each(['stale snapshot', 'null snapshot', 'removed Track', 'missed publication'] as const)(
    'settles a pending initial load after a newer publication with a %s',
    async (scenario) => {
      window.history.replaceState(
        {},
        '',
        '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
      );
      const pending = deferred<TrackInstrumentEditorSnapshot | null>();
      const initial = makeSnapshot();
      const current = {
        ...initial,
        track: { ...initial.track, projectRevision: 4 },
        instrument: { ...initial.instrument, name: 'Current Instrument' },
      };
      const getTrackInstrumentEditorDocument = vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValue(current);
      let publish!: (event: unknown) => void;
      window.blueAPI = {
        getTrackInstrumentEditorDocument,
        onProjectDocumentUpdated: vi.fn((callback) => {
          publish = callback;
          return () => undefined;
        }),
      } as never;

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      try {
        await act(async () => root.render(<TrackInstrumentEditorPage />));
        expect(getTrackInstrumentEditorDocument).toHaveBeenCalledTimes(1);
        await act(async () => {
          if (scenario === 'missed publication') {
            pending.resolve(current);
          } else {
            publish({
              sessionId: 2,
              documentId: 'doc-1',
              revision: 4,
              dirty: true,
              snapshot: scenario === 'removed Track' ? { score: { layerGroups: [] } } : undefined,
            });
            pending.resolve(scenario === 'null snapshot' ? null : initial);
          }
        });
        const editor = container.querySelector('[data-testid="instrument-editor"]');
        if (scenario === 'removed Track') {
          expect(getTrackInstrumentEditorDocument).toHaveBeenCalledTimes(1);
          expect(editor).toBeNull();
          expect(container.textContent).toContain('The Track instrument is no longer available.');
        } else if (scenario === 'missed publication') {
          expect(getTrackInstrumentEditorDocument).toHaveBeenCalledTimes(1);
          expect(editor?.textContent).toBe('Current Instrument');
        } else {
          expect(getTrackInstrumentEditorDocument).toHaveBeenCalledTimes(2);
          expect(getTrackInstrumentEditorDocument).toHaveBeenLastCalledWith({
            track: { ...initial.track, projectRevision: 4 },
          });
          expect(editor?.textContent).toBe('Current Instrument');
        }
      } finally {
        act(() => root.unmount());
      }
    },
  );

  it('retains loaded instrument and advances revision when checkpoints or unrelated updates omit score', async () => {
    window.history.replaceState(
      {},
      '',
      '/track-instrument-editor.html?rootGroupId=editor-group&trackId=editor-track&projectSessionId=2&projectRevision=3',
    );
    let updatedCallback:
      | ((event: {
          sessionId: number;
          documentId: string;
          revision: number;
          dirty: boolean;
          publicationKind?: 'full' | 'patch' | 'checkpoint';
          snapshot?: Record<string, unknown>;
        }) => void)
      | undefined;
    const updateTrackInstrumentEditorDocument = vi.fn().mockResolvedValue({
      status: 'applied',
      snapshot: {
        ...makeSnapshot(),
        track: {
          ...makeSnapshot().track,
          projectRevision: 6,
        },
      },
    } satisfies TrackInstrumentEditorPatchResult);

    window.blueAPI = {
      getTrackInstrumentEditorDocument: vi.fn().mockResolvedValue(makeSnapshot()),
      updateTrackInstrumentEditorDocument,
      onProjectDocumentUpdated: vi.fn((callback) => {
        updatedCallback = callback as typeof updatedCallback;
        return () => undefined;
      }),
      sendBsbRealtimeControlUpdate: vi.fn(),
    } as never;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrackInstrumentEditorPage />);
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="instrument-editor"]')?.textContent).toBe(
      'Initial Instrument',
    );

    await act(async () => {
      updatedCallback?.({
        sessionId: 2,
        documentId: 'doc-1',
        revision: 4,
        dirty: false,
        publicationKind: 'checkpoint',
        snapshot: {
          sessionId: 2,
          documentId: 'doc-1',
          filePath: '/test.blue',
          loaded: true,
          dirty: false,
        },
      });
    });

    expect(container.querySelector('[data-testid="instrument-editor"]')?.textContent).toBe(
      'Initial Instrument',
    );
    expect(container.textContent).not.toContain('no longer available');

    await act(async () => {
      updatedCallback?.({
        sessionId: 2,
        documentId: 'doc-1',
        revision: 5,
        dirty: true,
        publicationKind: 'patch',
        snapshot: {
          sessionId: 2,
          documentId: 'doc-1',
          filePath: '/test.blue',
          loaded: true,
          dirty: true,
          globalOrc: 'gaout init 0',
        },
      });
    });

    expect(container.querySelector('[data-testid="instrument-editor"]')?.textContent).toBe(
      'Initial Instrument',
    );
    expect(container.textContent).not.toContain('no longer available');

    await act(async () => {
      (container.querySelector('[data-testid="instrument-editor"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(updateTrackInstrumentEditorDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        track: expect.objectContaining({ projectRevision: 5 }),
      }),
    );

    await act(async () => {
      updatedCallback?.({
        sessionId: 2,
        documentId: 'doc-1',
        revision: 7,
        dirty: true,
        publicationKind: 'patch',
        snapshot: {
          sessionId: 2,
          documentId: 'doc-1',
          filePath: '/test.blue',
          loaded: true,
          dirty: true,
          score: { layerGroups: [] },
        },
      });
    });

    expect(container.textContent).toContain('The Track instrument is no longer available.');

    act(() => root.unmount());
  });
});
