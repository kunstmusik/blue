// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TempoMapPatch, TempoMapSnapshot } from '../../shared/project-editor';
import TempoLineView from '../components/workbench/panels/score/TempoLineView';
import {
  TEMPO_LINE_VIEW_HEIGHT,
  tempoToScreenY,
} from '../components/workbench/panels/score/tempo-map-utils';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const BASE_TEMPO_MAP: TempoMapSnapshot = {
  enabled: true,
  visible: true,
  points: [
    { beat: 0, tempo: 60, curveType: 'constant' },
    { beat: 4, tempo: 120, curveType: 'constant' },
    { beat: 8, tempo: 90, curveType: 'linear' },
  ],
};

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
  document.body.innerHTML = '';
});

describe('TempoLineView', () => {
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

    expect(onTempoPatch).toHaveBeenLastCalledWith({
      type: 'updateTempoPoint',
      index: 1,
      patch: {
        beat: 5.5,
        tempo: 120,
      },
    });

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
});
