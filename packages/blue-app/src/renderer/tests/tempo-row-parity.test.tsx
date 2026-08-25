// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TempoMapPatch, TempoMapSnapshot } from '../../shared/project-editor';
import TempoRegionBar from '../components/workbench/panels/score/TempoRegionBar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BASE_TEMPO_MAP: TempoMapSnapshot = {
  enabled: true,
  visible: false,
  points: [
    { beat: 0, tempo: 60, curveType: 'constant' },
    { beat: 4, tempo: 120, curveType: 'linear' },
  ],
};

function renderTempoRegionBar(options?: {
  tempoMap?: TempoMapSnapshot;
  totalBeats?: number;
  pixelsPerBeat?: number;
  snapEnabled?: boolean;
  snapValue?: 'BEAT' | 'ONE_SECOND';
  rootTimelineOnly?: boolean;
}): {
  container: HTMLDivElement;
  root: Root;
  bar: HTMLDivElement;
  onTempoPatch: ReturnType<typeof vi.fn<(patch: TempoMapPatch) => void>>;
  onOpenPointDialog: ReturnType<typeof vi.fn<(index: number) => void>>;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onTempoPatch = vi.fn<(patch: TempoMapPatch) => void>();
  const onOpenPointDialog = vi.fn<(index: number) => void>();
  const totalBeats = options?.totalBeats ?? 16;
  const pixelsPerBeat = options?.pixelsPerBeat ?? 20;

  act(() => {
    root.render(
      <TempoRegionBar
        tempoMap={options?.tempoMap ?? BASE_TEMPO_MAP}
        totalBeats={totalBeats}
        pixelsPerBeat={pixelsPerBeat}
        snapEnabled={options?.snapEnabled ?? false}
        snapValue={options?.snapValue ?? 'BEAT'}
        rootTimelineOnly={options?.rootTimelineOnly ?? true}
        onTempoPatch={onTempoPatch}
        onOpenPointDialog={onOpenPointDialog}
      />,
    );
  });

  const bar = container.firstElementChild as HTMLDivElement;
  bar.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: totalBeats * pixelsPerBeat,
    bottom: 20,
    width: totalBeats * pixelsPerBeat,
    height: 20,
    toJSON: () => ({}),
  }) as DOMRect;

  return { container, root, bar, onTempoPatch, onOpenPointDialog };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TempoRegionBar', () => {
  it('renders labels and tooltips from tempo regions', () => {
    const { container, root } = renderTempoRegionBar();

    const regions = Array.from(container.querySelectorAll('[title]')) as HTMLDivElement[];
    expect(regions).toHaveLength(2);
    expect(regions[0]?.className).toContain('flex items-center');
    expect(container.textContent).toContain('♩ 60');
    expect(container.textContent).toContain('♩ 120');
    expect(regions[1]?.title).toContain('Beat: 4.00');
    expect(regions[1]?.title).toContain('Tempo: 120 BPM');
    expect(regions[1]?.title).toContain('linear');

    act(() => {
      root.unmount();
    });
  });

  it('double-clicks empty space to add a snapped tempo point', () => {
    const { bar, onTempoPatch, onOpenPointDialog, root } = renderTempoRegionBar({
      tempoMap: {
        enabled: true,
        visible: false,
        points: [{ beat: 0, tempo: 60, curveType: 'constant' }],
      },
      snapEnabled: true,
      snapValue: 'BEAT',
    });

    act(() => {
      bar.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        clientX: 73,
        clientY: 10,
      }));
    });

    expect(onOpenPointDialog).not.toHaveBeenCalled();
    expect(onTempoPatch).toHaveBeenCalledWith({
      type: 'addTempoPoint',
      point: { beat: 4, tempo: 60, curveType: 'constant' },
    });

    act(() => {
      root.unmount();
    });
  });

  it('opens the existing point dialog when double-clicking near a point', () => {
    const { bar, onTempoPatch, onOpenPointDialog, root } = renderTempoRegionBar({
      pixelsPerBeat: 20,
    });

    act(() => {
      bar.dispatchEvent(new MouseEvent('dblclick', {
        bubbles: true,
        clientX: 82,
        clientY: 10,
      }));
    });

    expect(onTempoPatch).not.toHaveBeenCalled();
    expect(onOpenPointDialog).toHaveBeenCalledWith(1);

    act(() => {
      root.unmount();
    });
  });

  it('shows the Java-style context menu actions for non-first regions', () => {
    const { container, root } = renderTempoRegionBar();
    const secondRegion = Array.from(container.querySelectorAll('[title]'))[1] as HTMLDivElement;

    act(() => {
      secondRegion.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 90,
        clientY: 10,
      }));
    });

    expect(document.body.textContent).toContain('Edit Tempo...');
    expect(document.body.textContent).toContain('Constant');
    expect(document.body.textContent).toContain('Linear');
    expect(document.body.textContent).toContain('Delete Tempo Point');

    act(() => {
      root.unmount();
    });
  });
});