// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TempoMapPatch, TempoMapSnapshot } from '../../shared/project-editor';
import TempoLineView from '../components/workbench/panels/score/TempoLineView';
import {
  TEMPO_LINE_VIEW_HEIGHT,
  tempoToScreenY,
} from '../components/workbench/panels/score/tempo-map-utils';
import { useProjectStore } from '../stores/project-store';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { mockFinishProjectGesture } = vi.hoisted(() => ({
  mockFinishProjectGesture: vi.fn(async () => ({
    status: 'committed',
    operationId: 'op-1',
    documentId: 'doc-1',
    revision: 1,
  })),
}));

vi.mock('../lib/history-scope-router', () => ({
  finishProjectGesture: (...args: unknown[]) => mockFinishProjectGesture(...args),
  registerHistoryEditorSettlement: vi.fn(() => vi.fn()),
}));

const BASE_TEMPO_MAP: TempoMapSnapshot = {
  enabled: true,
  visible: true,
  points: [
    { beat: 0, tempo: 60, curveType: 'constant' },
    { beat: 4, tempo: 120, curveType: 'constant' },
    { beat: 8, tempo: 90, curveType: 'linear' },
  ],
};

let originalTransport: ReturnType<typeof useProjectStore.getState>['transport'];

beforeEach(() => {
  originalTransport = useProjectStore.getState().transport;
  useProjectStore.setState({ transport: { ...originalTransport, tempoMap: BASE_TEMPO_MAP } });
});

function renderTempoLineView(options?: {
  tempoMap?: TempoMapSnapshot;
  totalBeats?: number;
  pixelsPerBeat?: number;
  snapEnabled?: boolean;
  snapValue?: 'BEAT' | 'ONE_SECOND';
  rootTimelineOnly?: boolean;
}): {
  container: HTMLDivElement;
  root: Root;
  svg: SVGSVGElement;
  onTempoPatch: ReturnType<typeof vi.fn<(patch: TempoMapPatch) => void>>;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onTempoPatch = vi.fn<(patch: TempoMapPatch) => void>();
  const totalBeats = options?.totalBeats ?? 16;
  const pixelsPerBeat = options?.pixelsPerBeat ?? 20;
  const scrollContainer = document.createElement('div');

  act(() => {
    root.render(
      <TempoLineView
        tempoMap={options?.tempoMap ?? BASE_TEMPO_MAP}
        totalBeats={totalBeats}
        pixelsPerBeat={pixelsPerBeat}
        snapEnabled={options?.snapEnabled ?? false}
        snapValue={options?.snapValue ?? 'BEAT'}
        rootTimelineOnly={options?.rootTimelineOnly ?? true}
        scrollContainerRef={{ current: scrollContainer }}
        onTempoPatch={onTempoPatch}
      />,
    );
  });

  const svg = container.querySelector('svg') as SVGSVGElement;
  svg.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: totalBeats * pixelsPerBeat,
      bottom: TEMPO_LINE_VIEW_HEIGHT,
      width: totalBeats * pixelsPerBeat,
      height: TEMPO_LINE_VIEW_HEIGHT,
      toJSON: () => ({}),
    }) as DOMRect;

  return { container, root, svg, onTempoPatch };
}

function changeMenuItem(label: string): HTMLElement {
  const item = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
    (node) => node.textContent?.trim() === label,
  ) as HTMLElement | undefined;
  expect(item).toBeTruthy();
  return item!;
}

afterEach(() => {
  useProjectStore.setState({ transport: originalTransport });
  document.body.innerHTML = '';
});

describe('TempoLineView', () => {
  it('fills its host while preserving the timeline coordinate width', () => {
    const { svg, root } = renderTempoLineView({ totalBeats: 16, pixelsPerBeat: 20 });
    const host = svg.parentElement;

    expect(host?.style.width).toBe('100%');
    expect(svg.style.width).toBe('100%');
    expect(svg.style.minWidth).toBe('320px');
    expect(svg.getAttribute('viewBox')).toBe('0 0 320 80');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');

    act(() => {
      root.unmount();
    });
  });

  it('renders the snap grid when snapping is enabled', () => {
    const { svg, root } = renderTempoLineView({ snapEnabled: true, snapValue: 'BEAT' });

    expect(svg.querySelectorAll('line[stroke="#333"]').length).toBeGreaterThan(0);

    act(() => {
      root.unmount();
    });
  });

  it('uses Shift to bypass beat snapping during drag', () => {
    const { svg, onTempoPatch, root } = renderTempoLineView({
      snapEnabled: true,
      snapValue: 'BEAT',
    });
    const pointX = 4 * 20;
    const pointY = tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT);

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: pointX,
          clientY: pointY,
        }),
      );
    });

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: 93,
          clientY: pointY,
          shiftKey: true,
        }),
      );
    });

    const lastPatch = onTempoPatch.mock.calls[onTempoPatch.mock.calls.length - 1]?.[0] as Extract<
      TempoMapPatch,
      { type: 'updateTempoPoint' }
    >;
    expect(lastPatch.type).toBe('updateTempoPoint');
    expect(lastPatch.index).toBe(1);
    expect(lastPatch.patch.beat).toBeCloseTo(93 / 20, 6);
    expect(lastPatch.patch.tempo).toBeGreaterThan(100);

    act(() => {
      root.unmount();
    });
  });

  it('constrains drag movement to one axis while Ctrl is held', () => {
    const { svg, onTempoPatch, root } = renderTempoLineView();
    const pointX = 4 * 20;
    const pointY = tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT);

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: pointX,
          clientY: pointY,
        }),
      );
    });

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: pointX + 30,
          clientY: pointY + 2,
          ctrlKey: true,
        }),
      );
    });

    expect(onTempoPatch).toHaveBeenLastCalledWith(
      {
        type: 'updateTempoPoint',
        index: 1,
        patch: {
          beat: 5.5,
          tempo: 120,
        },
      },
      expect.objectContaining({
        label: 'Edit Tempo Point',
        gestureId: expect.any(String),
        phase: 'begin',
      }),
    );

    act(() => {
      root.unmount();
    });

    const verticalHarness = renderTempoLineView();
    const verticalPointY = tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT);

    act(() => {
      verticalHarness.svg.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: pointX,
          clientY: verticalPointY,
        }),
      );
    });

    act(() => {
      verticalHarness.svg.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: pointX + 2,
          clientY: verticalPointY + 24,
          ctrlKey: true,
        }),
      );
    });

    const verticalPatch =
      verticalHarness.onTempoPatch.mock.calls[
        verticalHarness.onTempoPatch.mock.calls.length - 1
      ]?.[0];
    expect(verticalPatch).toEqual({
      type: 'updateTempoPoint',
      index: 1,
      patch: {
        beat: 4,
        tempo: expect.any(Number),
      },
    });
    expect(
      (verticalPatch as Extract<TempoMapPatch, { type: 'updateTempoPoint' }>).patch.tempo,
    ).not.toBe(120);

    act(() => {
      verticalHarness.root.unmount();
    });
  });

  it('opens context menus for point deletion and segment curve changes without mutating immediately', () => {
    const { svg, onTempoPatch, root } = renderTempoLineView();
    const trigger = svg.parentElement as HTMLDivElement;
    const pointX = 4 * 20;
    const pointY = tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT);

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: pointX,
          clientY: pointY,
        }),
      );
      trigger.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: pointX,
          clientY: pointY,
        }),
      );
    });

    expect(onTempoPatch).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Delete Tempo Point');

    act(() => {
      changeMenuItem('Delete Tempo Point').dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });

    expect(onTempoPatch).toHaveBeenLastCalledWith({ type: 'removeTempoPoint', index: 1 });

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 40,
          clientY: tempoToScreenY(90, TEMPO_LINE_VIEW_HEIGHT),
        }),
      );
      trigger.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 40,
          clientY: tempoToScreenY(90, TEMPO_LINE_VIEW_HEIGHT),
        }),
      );
    });

    expect(document.body.textContent).toContain('Constant');
    expect(document.body.textContent).toContain('Linear');

    act(() => {
      changeMenuItem('Linear').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onTempoPatch).toHaveBeenLastCalledWith({
      type: 'setTempoCurveType',
      index: 0,
      curveType: 'linear',
    });

    act(() => {
      root.unmount();
    });
  });

  it('adds a tempo point on empty-space click with phase single', () => {
    const { svg, onTempoPatch, root } = renderTempoLineView();
    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: 50,
          clientY: 40,
        }),
      );
    });

    expect(onTempoPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'addTempoPoint',
        point: expect.objectContaining({ beat: 2.5 }),
      }),
      expect.objectContaining({
        label: 'Add Tempo Point',
        phase: 'single',
      }),
    );
    act(() => root.unmount());
  });

  it('drags tempo point with phase begin, then update, and finishes with phase end on release', () => {
    const { svg, onTempoPatch, root } = renderTempoLineView();
    const pointX = 4 * 20;
    const pointY = tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT);

    // Mousedown on point 1 (beat 4, tempo 120)
    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: pointX,
          clientY: pointY,
        }),
      );
    });

    expect(onTempoPatch).not.toHaveBeenCalled();

    // First move (phase: begin)
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: pointX + 10,
          clientY: pointY,
        }),
      );
    });

    expect(onTempoPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'updateTempoPoint' }),
      expect.objectContaining({ label: 'Edit Tempo Point', phase: 'begin' }),
    );

    // Second move (phase: update)
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: pointX + 20,
          clientY: pointY,
        }),
      );
    });

    expect(onTempoPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'updateTempoPoint' }),
      expect.objectContaining({ label: 'Edit Tempo Point', phase: 'update' }),
    );

    // Release mouse
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          clientX: pointX + 20,
          clientY: pointY,
        }),
      );
    });

    expect(mockFinishProjectGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Edit Tempo Point',
        phase: 'end',
      }),
    );

    act(() => root.unmount());
  });

  it('cancels tempo point drag with Escape by calling finishProjectGesture with phase cancel', () => {
    const { svg, onTempoPatch, root } = renderTempoLineView();
    const pointX = 4 * 20;
    const pointY = tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT);

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: pointX,
          clientY: pointY,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: pointX + 10,
          clientY: pointY,
        }),
      );
    });

    expect(onTempoPatch).toHaveBeenCalledTimes(1);

    // Escape
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(mockFinishProjectGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Edit Tempo Point',
        phase: 'cancel',
      }),
    );

    act(() => root.unmount());
  });

  it('settles already-applied live tempo group on editor unmount/closure (T039)', () => {
    const onTempoPatch = vi.fn();
    const { container, root } = renderTempoLineView({ totalBeats: 16 });
    const svg = container.querySelector('svg')!;

    // Point 1 is at beat 4, tempo 120. (X = 4 * 20 = 80, Y = tempoToScreenY(120, 60))
    const pointX = 80;
    const pointY = tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT);

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: pointX,
          clientY: pointY,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: pointX + 10,
          clientY: pointY,
        }),
      );
    });

    mockFinishProjectGesture.mockClear();

    // Closure / unmount
    act(() => {
      root.unmount();
    });

    expect(mockFinishProjectGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Edit Tempo Point',
        phase: 'end',
      }),
    );
  });

  it('fences gesture movement on project replacement / session mismatch (T035)', () => {
    const onTempoPatch = vi.fn();
    const { container, root } = renderTempoLineView({ totalBeats: 16 });
    const svg = container.querySelector('svg')!;

    const pointX = 80;
    const pointY = tempoToScreenY(120, TEMPO_LINE_VIEW_HEIGHT);

    act(() => {
      svg.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button: 0,
          clientX: pointX,
          clientY: pointY,
        }),
      );
    });

    // Simulate project replacement
    const origSessionId = useProjectStore.getState().sessionId;
    useProjectStore.setState({ sessionId: origSessionId + 100 });
    mockFinishProjectGesture.mockClear();

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          clientX: pointX + 20,
          clientY: pointY,
        }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          clientX: pointX + 20,
          clientY: pointY,
        }),
      );
    });

    expect(mockFinishProjectGesture).not.toHaveBeenCalled();

    // Restore sessionId
    useProjectStore.setState({ sessionId: origSessionId });
    act(() => root.unmount());
  });

  it('culls tempo snap grid lines to visible viewport bounds', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const scrollContainer = document.createElement('div');

    act(() => {
      root.render(
        <TempoLineView
          tempoMap={BASE_TEMPO_MAP}
          meterMap={{ entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }] }}
          totalBeats={1000}
          pixelsPerBeat={20}
          visibleStartBeats={100}
          visibleEndBeats={103}
          snapEnabled={true}
          snapValue="BEAT"
          rootTimelineOnly={true}
          scrollContainerRef={{ current: scrollContainer }}
          onTempoPatch={vi.fn()}
        />,
      );
    });

    const snapGridLines = Array.from(container.querySelectorAll('svg line')).filter(
      (line) => line.getAttribute('stroke') === '#333',
    );
    expect(snapGridLines.map((line) => line.getAttribute('x1'))).toEqual([
      '2000',
      '2020',
      '2040',
      '2060',
    ]);

    act(() => root.unmount());
    container.remove();
  });
});
