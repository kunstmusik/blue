// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import ToolbarDisplays from '../components/menu-bar/ToolbarDisplays';
import { usePlaybackStore } from '../stores/playback-store';
import { useProjectStore } from '../stores/project-store';

const formatterCallCounts = vi.hoisted(() => ({
  playhead: 0,
  selection: 0,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/menu-bar/toolbar-formatters', async () => {
  const actual = await vi.importActual<any>('../components/menu-bar/toolbar-formatters');

  return {
    ...actual,
    buildPlayheadDisplayState: (...args: any[]) => {
      formatterCallCounts.playhead += 1;
      return actual.buildPlayheadDisplayState(...args);
    },
    buildSelectionDisplayState: (...args: any[]) => {
      formatterCallCounts.selection += 1;
      return actual.buildSelectionDisplayState(...args);
    },
  };
});

function seedProject(): void {
  const snapshot = createEmptyProjectEditorSnapshot();

  useProjectStore.getState().setProjectInfo({
    title: 'Toolbar Test',
    author: 'Test Author',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/path/to/test.blue',
    loaded: true,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: {
      ...snapshot.orchestra,
      loaded: true,
    },
    projectProperties: {
      ...snapshot.projectProperties,
      title: 'Toolbar Test',
      author: 'Test Author',
    },
    transport: {
      ...snapshot.transport,
      renderStartTime: 8,
      renderEndTime: 12,
      tempoMap: {
        enabled: true,
        points: [
          { beat: 0, tempo: 120, curveType: 'constant' },
          { beat: 8, tempo: 120, curveType: 'constant' },
        ],
      },
    },
  });
}

function renderRoot(element: React.ReactElement): {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  formatterCallCounts.playhead = 0;
  formatterCallCounts.selection = 0;
  document.body.innerHTML = '';
  useProjectStore.getState().clearProject();
  usePlaybackStore.getState().reset();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Toolbar display render isolation', () => {
  it('renders advancing playhead text when the engine clock arrives before playing status', () => {
    seedProject();

    const tree = renderRoot(<ToolbarDisplays />);

    act(() => {
      usePlaybackStore
        .getState()
        .setStatus({ status: 'starting', message: 'Preparing playback...' });
      usePlaybackStore.getState().acceptPlaybackClock({
        sessionId: 1,
        sampleFrames: 0,
        sequence: 0,
        sampleRate: 44100,
        ksmps: 64,
      });
      usePlaybackStore
        .getState()
        .setStatus({ status: 'playing', message: 'Playing via blue-engine' });
    });

    const playhead = tree.container.querySelector('.toolbar-display-main--playhead');
    const initialText = playhead?.textContent;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const updatedText = tree.container.querySelector(
      '.toolbar-display-main--playhead',
    )?.textContent;
    expect(initialText).toBe('8.00');
    expect(updatedText).toBe('10.00');

    tree.unmount();
  });

  it('keeps the playhead anchored to playback-start transport when render start changes mid-playback', () => {
    seedProject();

    const tree = renderRoot(<ToolbarDisplays />);

    act(() => {
      usePlaybackStore.setState((state) => ({
        ...state,
        status: 'playing',
        transportAnchor: {
          ...useProjectStore.getState().transport,
          tempoMap: {
            ...useProjectStore.getState().transport.tempoMap,
            points: useProjectStore
              .getState()
              .transport.tempoMap.points.map((point) => ({ ...point })),
          },
          meterMap: {
            entries: useProjectStore
              .getState()
              .transport.meterMap.entries.map((entry) => ({ ...entry })),
          },
        },
        clock: {
          sessionId: 1,
          sampleFrames: 0,
          sequence: 0,
          sampleRate: 44100,
          ksmps: 64,
          receivedAtMs: Date.now(),
        },
        display: {
          sampleFrames: 44100,
          elapsedSeconds: 1,
          source: 'engine-authority',
        },
      }));
    });

    expect(tree.container.querySelector('.toolbar-display-main--playhead')?.textContent).toBe(
      '10.00',
    );

    act(() => {
      const current = useProjectStore.getState();
      useProjectStore.getState().setProjectInfo({
        title: current.title,
        author: current.author,
        sampleRate: current.sampleRate,
        version: current.version,
        filePath: current.filePath,
        loaded: current.loaded,
        globalOrc: current.globalOrc,
        globalSco: current.globalSco,
        orchestra: current.orchestra,
        projectProperties: current.projectProperties,
        transport: {
          ...current.transport,
          renderStartTime: 20,
        },
      });
    });

    expect(tree.container.querySelector('.toolbar-display-main--playhead')?.textContent).toBe(
      '10.00',
    );

    tree.unmount();
  });

  it('does not recompute selection text during local playhead interpolation ticks', () => {
    seedProject();

    const tree = renderRoot(<ToolbarDisplays />);
    const baseline = {
      playhead: formatterCallCounts.playhead,
      selection: formatterCallCounts.selection,
    };

    act(() => {
      usePlaybackStore.setState({
        status: 'playing',
        clock: {
          sessionId: 1,
          sampleFrames: 44100,
          sequence: 1,
          sampleRate: 44100,
          ksmps: 64,
          receivedAtMs: Date.now(),
        },
      });
    });

    const afterClock = {
      playhead: formatterCallCounts.playhead,
      selection: formatterCallCounts.selection,
    };

    expect(afterClock.playhead).toBeGreaterThan(baseline.playhead);
    expect(afterClock.selection).toBe(baseline.selection);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(formatterCallCounts.playhead).toBeGreaterThan(afterClock.playhead);
    expect(formatterCallCounts.selection).toBe(afterClock.selection);

    tree.unmount();
  });

  it('does not recompute the playhead when only selection bounds change', () => {
    seedProject();

    const tree = renderRoot(<ToolbarDisplays />);
    const baseline = {
      playhead: formatterCallCounts.playhead,
      selection: formatterCallCounts.selection,
    };
    const current = useProjectStore.getState();

    act(() => {
      useProjectStore.getState().setProjectInfo({
        title: current.title,
        author: current.author,
        sampleRate: current.sampleRate,
        version: current.version,
        filePath: current.filePath,
        loaded: current.loaded,
        globalOrc: current.globalOrc,
        globalSco: current.globalSco,
        orchestra: current.orchestra,
        projectProperties: current.projectProperties,
        transport: {
          ...current.transport,
          renderEndTime: 16,
        },
      });
    });

    expect(formatterCallCounts.selection).toBeGreaterThan(baseline.selection);
    expect(formatterCallCounts.playhead).toBe(baseline.playhead);

    tree.unmount();
  });
});
