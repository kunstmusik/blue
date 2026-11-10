// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkerSnapshot } from '../../shared/project-editor';
import MarkersBar from '../components/workbench/panels/score/MarkersBar';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface MockProjectState {
  applyProjectDocumentPatch: ReturnType<typeof vi.fn>;
  sessionId: number;
  flushPendingPatches: ReturnType<typeof vi.fn>;
  score: { markers: MarkerSnapshot[] };
}

const { mockProjectState, mockFinishProjectGesture } = vi.hoisted(() => {
  const state: MockProjectState = {
    applyProjectDocumentPatch: vi.fn(),
    sessionId: 1,
    flushPendingPatches: vi.fn(async () => {}),
    score: { markers: [] },
  };
  return {
    mockProjectState: state,
    mockFinishProjectGesture: vi.fn(async () => ({
      status: 'committed',
      operationId: 'op-1',
      documentId: 'doc-1',
      revision: 1,
    })),
  };
});

vi.mock('../stores/project-store', () => {
  const store = (selector: (state: MockProjectState) => unknown) => selector(mockProjectState);
  store.getState = () => mockProjectState;
  return {
    useProjectStore: store,
    getProjectDocumentId: () => 'doc-1',
  };
});

vi.mock('../lib/history-scope-router', () => ({
  finishProjectGesture: (...args: unknown[]) => mockFinishProjectGesture(...args),
  registerHistoryEditorSettlement: vi.fn(() => vi.fn()),
}));

function renderMarkersBar(options?: {
  markers?: MarkerSnapshot[];
  scrollLeft?: number;
  rowLeft?: number;
  containerLeft?: number;
  containerRight?: number;
  snapEnabled?: boolean;
  snapValue?: 'BEAT' | 'ONE_SECOND';
  tempo?: number;
  smpteFrameRate?: number;
  smpteDropFrame?: boolean;
  timeDisplay?: string;
}): {
  container: HTMLDivElement;
  root: Root;
  scrollContainer: HTMLDivElement;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const scrollContainer = document.createElement('div');
  Object.defineProperty(scrollContainer, 'scrollLeft', {
    value: options?.scrollLeft ?? 0,
    writable: true,
    configurable: true,
  });
  scrollContainer.getBoundingClientRect = () =>
    ({
      x: options?.containerLeft ?? 0,
      y: 0,
      left: options?.containerLeft ?? 0,
      top: 0,
      right: options?.containerRight ?? 120,
      bottom: 20,
      width: (options?.containerRight ?? 120) - (options?.containerLeft ?? 0),
      height: 20,
      toJSON: () => ({}),
    }) as DOMRect;

  const root = createRoot(container);
  mockProjectState.score.markers = structuredClone(
    options?.markers ?? [{ name: 'Intro', time: 2, timeBase: 'BEATS', sourceIndex: 0 }],
  );

  act(() => {
    root.render(
      <MarkersBar
        markers={
          options?.markers ?? [{ name: 'Intro', time: 2, timeBase: 'BEATS', sourceIndex: 0 }]
        }
        totalBeats={128}
        pixelsPerBeat={10}
        rowVisible
        snapEnabled={options?.snapEnabled ?? false}
        snapValue={options?.snapValue ?? 'BEAT'}
        scrollContainerRef={{ current: scrollContainer }}
        rootTimelineOnly
        tempo={options?.tempo ?? 60}
        smpteFrameRate={options?.smpteFrameRate ?? 24}
        smpteDropFrame={options?.smpteDropFrame ?? false}
        timeDisplay={options?.timeDisplay ?? 'BEATS'}
        sampleRate={44100}
      />,
    );
  });

  const row = container.firstElementChild as HTMLDivElement;
  row.getBoundingClientRect = () =>
    ({
      x: options?.rowLeft ?? 0,
      y: 0,
      left: options?.rowLeft ?? 0,
      top: 0,
      right: (options?.rowLeft ?? 0) + 120,
      bottom: 20,
      width: 120,
      height: 20,
      toJSON: () => ({}),
    }) as DOMRect;

  return { container, root, scrollContainer };
}

beforeEach(() => {
  mockProjectState.applyProjectDocumentPatch.mockReset();
  mockProjectState.applyProjectDocumentPatch.mockImplementation((patch) => {
    if (patch.score?.type === 'addMarker') {
      const markers = mockProjectState.score.markers;
      markers.push({
        name: `Marker ${markers.length + 1}`,
        time: patch.score.timeBeats,
        timeBase: 'BEATS',
        sourceIndex: markers.length,
      });
    } else if (patch.score?.type === 'updateMarker') {
      const marker = mockProjectState.score.markers[patch.score.sourceIndex];
      if (marker && patch.score.patch.timeBeats !== undefined)
        marker.time = patch.score.patch.timeBeats;
    }
  });
  mockFinishProjectGesture.mockReset();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MarkersBar', () => {
  it('stops dragging after mouseup outside the bar and autoscrolls while dragging near the edge', () => {
    const { container, root, scrollContainer } = renderMarkersBar();
    const label = Array.from(container.querySelectorAll('span')).find(
      (node) => node.textContent === 'Intro',
    );

    expect(label).toBeTruthy();

    act(() => {
      label!.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: 24,
          clientY: 10,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 160,
          clientY: 10,
        }),
      );
    });

    expect(scrollContainer.scrollLeft).toBeGreaterThan(0);
    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      {
        score: {
          type: 'updateMarker',
          sourceIndex: 0,
          patch: { timeBeats: expect.any(Number) },
        },
      },
      expect.objectContaining({
        label: 'Move Marker',
        gestureId: expect.any(String),
        phase: 'begin',
      }),
    );

    const callCountAfterDrag = mockProjectState.applyProjectDocumentPatch.mock.calls.length;

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          clientX: 160,
          clientY: 10,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 80,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledTimes(callCountAfterDrag);

    act(() => {
      root.unmount();
    });
  });

  it('uses the row viewport position without double-counting scroll in a scrolled timeline', () => {
    const { container, root } = renderMarkersBar({
      scrollLeft: 40,
      rowLeft: -40,
      containerRight: 300,
    });
    const row = container.firstElementChild as HTMLDivElement;

    act(() => {
      row.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: 60,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenLastCalledWith(
      {
        transport: { renderStartTime: 10, renderEndTime: -1 },
      },
      expect.objectContaining({
        label: 'Set Render Start Time',
        gestureId: expect.any(String),
        phase: 'begin',
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it('uses tempo-aware snapping for time-based marker drags', () => {
    const { container, root } = renderMarkersBar({
      snapEnabled: true,
      snapValue: 'ONE_SECOND',
      tempo: 120,
      containerRight: 300,
    });
    const label = Array.from(container.querySelectorAll('span')).find(
      (node) => node.textContent === 'Intro',
    );

    expect(label).toBeTruthy();

    act(() => {
      label!.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: 24,
          clientY: 10,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 39,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenLastCalledWith(
      {
        score: {
          type: 'updateMarker',
          sourceIndex: 0,
          patch: { timeBeats: 4 },
        },
      },
      expect.objectContaining({
        label: 'Move Marker',
        gestureId: expect.any(String),
        phase: 'begin',
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it('drags markers relative to the initial grab point instead of snapping the grabbed edge to the cursor', () => {
    const { container, root } = renderMarkersBar({
      snapEnabled: true,
      snapValue: 'BEAT',
      containerRight: 300,
    });
    const label = Array.from(container.querySelectorAll('span')).find(
      (node) => node.textContent === 'Intro',
    );

    expect(label).toBeTruthy();

    act(() => {
      label!.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: 35,
          clientY: 10,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 46,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenLastCalledWith(
      {
        score: {
          type: 'updateMarker',
          sourceIndex: 0,
          patch: { timeBeats: 3 },
        },
      },
      expect.objectContaining({
        label: 'Move Marker',
        gestureId: expect.any(String),
        phase: 'begin',
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it('inserts marker on press with phase begin, updates during drag, and finishes with phase end on release', () => {
    const { container, root } = renderMarkersBar({
      markers: [{ name: 'Intro', time: 2, timeBase: 'BEATS', sourceIndex: 0 }],
      containerRight: 300,
    });
    const row = container.firstElementChild as HTMLDivElement;

    // Shift-click at x=50 (5 beats)
    act(() => {
      row.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          shiftKey: true,
          clientX: 50,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      {
        score: { type: 'addMarker', timeBeats: 5 },
      },
      expect.objectContaining({
        label: 'Add Marker',
        gestureId: expect.any(String),
        phase: 'begin',
      }),
    );

    // Drag move to x=80 (8 beats)
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 80,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenLastCalledWith(
      {
        score: {
          type: 'updateMarker',
          sourceIndex: 1,
          patch: { timeBeats: 8 },
        },
      },
      expect.objectContaining({
        label: 'Add Marker',
        phase: 'update',
      }),
    );

    // Release mouse
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          clientX: 80,
          clientY: 10,
        }),
      );
    });

    expect(mockFinishProjectGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        sessionId: 1,
        label: 'Add Marker',
        phase: 'end',
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it('cancels press-time marker insertion with Escape by calling finishProjectGesture with phase cancel', () => {
    const { container, root } = renderMarkersBar({
      markers: [{ name: 'Intro', time: 2, timeBase: 'BEATS', sourceIndex: 0 }],
      containerRight: 300,
    });
    const row = container.firstElementChild as HTMLDivElement;

    act(() => {
      row.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          shiftKey: true,
          clientX: 50,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      {
        score: { type: 'addMarker', timeBeats: 5 },
      },
      expect.objectContaining({
        label: 'Add Marker',
        phase: 'begin',
      }),
    );

    // Press Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(mockFinishProjectGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        sessionId: 1,
        label: 'Add Marker',
        phase: 'cancel',
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it('cancels marker drag move with Escape by calling finishProjectGesture with phase cancel', () => {
    const { container, root } = renderMarkersBar({
      markers: [{ name: 'Intro', time: 2, timeBase: 'BEATS', sourceIndex: 0 }],
      containerRight: 300,
    });
    const label = Array.from(container.querySelectorAll('span')).find(
      (node) => node.textContent === 'Intro',
    );
    expect(label).toBeTruthy();

    act(() => {
      label!.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: 20,
          clientY: 10,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 60,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ label: 'Move Marker', phase: 'begin' }),
    );

    // Press Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(mockFinishProjectGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        sessionId: 1,
        label: 'Move Marker',
        phase: 'cancel',
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it('settles already-applied live marker group on editor unmount/closure (T039)', () => {
    const { container, root } = renderMarkersBar({
      markers: [{ name: 'Intro', time: 2, timeBase: 'BEATS', sourceIndex: 0 }],
      containerRight: 300,
    });
    const label = Array.from(container.querySelectorAll('span')).find(
      (node) => node.textContent === 'Intro',
    );
    expect(label).toBeTruthy();

    act(() => {
      label!.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: 20,
          clientY: 10,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 60,
          clientY: 10,
        }),
      );
    });

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ label: 'Move Marker', phase: 'begin' }),
    );

    mockFinishProjectGesture.mockClear();

    // Editor closure / unmount
    act(() => {
      root.unmount();
    });

    expect(mockFinishProjectGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        sessionId: 1,
        label: 'Move Marker',
        phase: 'end',
      }),
    );
  });

  it('fences gesture movement on project replacement / session mismatch (T035)', () => {
    const { container, root } = renderMarkersBar({
      markers: [{ name: 'Intro', time: 2, timeBase: 'BEATS', sourceIndex: 0 }],
      containerRight: 300,
    });
    const label = Array.from(container.querySelectorAll('span')).find(
      (node) => node.textContent === 'Intro',
    );

    act(() => {
      label!.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: 20,
          clientY: 10,
        }),
      );
    });

    // Simulate project replacement changing sessionId
    mockProjectState.sessionId = 999;
    mockProjectState.applyProjectDocumentPatch.mockClear();
    mockFinishProjectGesture.mockClear();

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 100,
          clientY: 10,
        }),
      );
    });

    // Fencing must invalidate obsolete gesture, not dispatch patches to new project
    expect(mockProjectState.applyProjectDocumentPatch).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          clientX: 100,
          clientY: 10,
        }),
      );
    });

    expect(mockFinishProjectGesture).not.toHaveBeenCalled();

    // Reset sessionId
    mockProjectState.sessionId = 1;

    act(() => {
      root.unmount();
    });
  });
});

it('shows selected DF marker time without changing the marker position', () => {
  const marker = { name: 'Boundary', time: 60.06, timeBase: 'SMPTE', sourceIndex: 0 };
  const { container, root } = renderMarkersBar({
    markers: [marker],
    smpteFrameRate: 29.97,
    smpteDropFrame: true,
    timeDisplay: 'SMPTE',
  });
  expect(container.querySelector('[title]')?.getAttribute('title')).toBe('Boundary [00:01:00;02]');
  expect(marker.time).toBe(60.06);
  act(() => root.unmount());
  container.remove();
});
