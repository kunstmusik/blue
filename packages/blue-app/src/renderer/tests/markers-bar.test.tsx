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
  applyProjectDocumentPatch: (patch: unknown) => void;
}

const { mockProjectState } = vi.hoisted(() => ({
  mockProjectState: {
    applyProjectDocumentPatch: vi.fn(),
  } satisfies MockProjectState,
}));

vi.mock('../stores/project-store', () => ({
  useProjectStore: (selector: (state: MockProjectState) => unknown) => selector(mockProjectState),
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
        smpteFrameRate={24}
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
    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenCalledWith({
      score: {
        type: 'updateMarker',
        sourceIndex: 0,
        patch: { timeBeats: expect.any(Number) },
      },
    });

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

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenLastCalledWith({
      transport: { renderStartTime: 10, renderEndTime: -1 },
    });

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

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenLastCalledWith({
      score: {
        type: 'updateMarker',
        sourceIndex: 0,
        patch: { timeBeats: 4 },
      },
    });

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

    expect(mockProjectState.applyProjectDocumentPatch).toHaveBeenLastCalledWith({
      score: {
        type: 'updateMarker',
        sourceIndex: 0,
        patch: { timeBeats: 3 },
      },
    });

    act(() => {
      root.unmount();
    });
  });
});
