// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeterMapSnapshot, MeterMapPatch, MeterSnapshot } from '../../shared/project-editor';
import MeterRegionBar from '../components/workbench/panels/score/MeterRegionBar';
import MeterEntryDialog from '../components/workbench/panels/score/MeterEntryDialog';
import {
  beatToMeasure,
  deriveMeterRegions,
  findRegionAtBeat,
} from '../components/workbench/panels/score/meter-map-utils';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Root[] = [];

const DEFAULT_METER_MAP: MeterMapSnapshot = {
  entries: [{ measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 }],
};

const MIXED_METER_MAP: MeterMapSnapshot = {
  entries: [
    { measure: 1, numBeats: 4, beatLength: 4, startBeat: 0 },
    { measure: 5, numBeats: 3, beatLength: 4, startBeat: 16 },
    { measure: 9, numBeats: 7, beatLength: 8, startBeat: 28 },
  ],
};

function renderMeterBar(options?: {
  meterMap?: MeterMapSnapshot;
  totalBeats?: number;
  pixelsPerBeat?: number;
  rowVisible?: boolean;
  rootTimelineOnly?: boolean;
}): {
  container: HTMLDivElement;
  root: Root;
  bar: HTMLDivElement;
  onMeterPatch: ReturnType<typeof vi.fn<(patch: MeterMapPatch) => void>>;
  onOpenEntryDialog: ReturnType<typeof vi.fn<(index: number) => void>>;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  const onMeterPatch = vi.fn<(patch: MeterMapPatch) => void>();
  const onOpenEntryDialog = vi.fn<(index: number) => void>();
  const totalBeats = options?.totalBeats ?? 40;
  const pixelsPerBeat = options?.pixelsPerBeat ?? 100;

  act(() => {
    root.render(
      <MeterRegionBar
        meterMap={options?.meterMap ?? DEFAULT_METER_MAP}
        totalBeats={totalBeats}
        pixelsPerBeat={pixelsPerBeat}
        rowVisible={options?.rowVisible ?? true}
        rootTimelineOnly={options?.rootTimelineOnly ?? true}
        onMeterPatch={onMeterPatch}
        onOpenEntryDialog={onOpenEntryDialog}
      />,
    );
  });

  const bar = container.firstElementChild as HTMLDivElement | null;
  if (bar) {
    bar.getBoundingClientRect = () =>
      ({
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
  }

  return { container, root, bar, onMeterPatch, onOpenEntryDialog };
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    if (root) {
      act(() => {
        root.unmount();
      });
    }
  }
  document.body.innerHTML = '';
});

describe('MeterRegionBar rendering', () => {
  it('renders a 20px row', () => {
    const { bar } = renderMeterBar();
    expect(bar).toBeTruthy();
    expect(bar.style.height).toBe('20px');
  });

  it('renders labels for each meter entry', () => {
    const { container } = renderMeterBar({ meterMap: MIXED_METER_MAP });
    const regionDivs = container.querySelectorAll('[title*="Measure"]');
    expect(regionDivs[0]?.className).toContain('flex items-center');
    expect(container.innerHTML).toContain('4/4');
    expect(container.innerHTML).toContain('3/4');
    expect(container.innerHTML).toContain('7/8');
  });

  it('returns null when row is not visible', () => {
    const { container } = renderMeterBar({ rowVisible: false });
    const bar = container.firstElementChild;
    expect(bar).toBeNull();
  });

  it('shows tooltip with measure and time signature', () => {
    const { container } = renderMeterBar({ meterMap: MIXED_METER_MAP });
    const tooltipElements = container.querySelectorAll('[title*="Measure"]');
    expect(tooltipElements.length).toBe(3);
    expect(tooltipElements[0].getAttribute('title')).toBe('Measure 1 / Time Signature: 4/4');
    expect(tooltipElements[1].getAttribute('title')).toBe('Measure 5 / Time Signature: 3/4');
  });
});

describe('MeterRegionBar double-click interaction', () => {
  it('dispatches meter-map-set-entry for new measure on double-click', () => {
    const { bar, onMeterPatch, onOpenEntryDialog } = renderMeterBar();
    act(() => {
      bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 1000, clientY: 10 }));
    });
    expect(onMeterPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'meter-map-set-entry',
        numBeats: 4,
        beatLength: 4,
      }),
    );
  });

  it('opens edit dialog for existing entry measure on double-click', () => {
    const { bar, onOpenEntryDialog } = renderMeterBar({ meterMap: MIXED_METER_MAP });
    act(() => {
      bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 50, clientY: 10 }));
    });
    expect(onOpenEntryDialog).toHaveBeenCalledWith(0);
  });
});

describe('MeterRegionBar context menu', () => {
  it('renders region divs with context menu wrappers', () => {
    const { container } = renderMeterBar({ meterMap: MIXED_METER_MAP });
    const regionDivs = container.querySelectorAll('[title*="Measure"]');
    expect(regionDivs.length).toBe(3);
  });
});

describe('MeterEntryDialog', () => {
  it('disables measure input for first entry', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const onClose = vi.fn();
    const onPatch = vi.fn();

    act(() => {
      root.render(
        <MeterEntryDialog
          entryIndex={0}
          meterMap={MIXED_METER_MAP}
          onMeterPatch={onPatch}
          onClose={onClose}
        />,
      );
    });

    const measureInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(measureInput).toBeTruthy();
    expect(measureInput.disabled).toBe(true);
  });

  it('dispatches meter-map-update-entry on OK', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const onClose = vi.fn();
    const onPatch = vi.fn();

    act(() => {
      root.render(
        <MeterEntryDialog
          entryIndex={0}
          meterMap={DEFAULT_METER_MAP}
          onMeterPatch={onPatch}
          onClose={onClose}
        />,
      );
    });

    const okButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'OK',
    );
    expect(okButton).toBeTruthy();
    act(() => {
      okButton!.click();
    });

    expect(onPatch).toHaveBeenCalledWith({
      type: 'meter-map-update-entry',
      previousMeasure: 1,
      measure: 1,
      numBeats: 4,
      beatLength: 4,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes without patching on Cancel', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);
    const onClose = vi.fn();
    const onPatch = vi.fn();

    act(() => {
      root.render(
        <MeterEntryDialog
          entryIndex={0}
          meterMap={DEFAULT_METER_MAP}
          onMeterPatch={onPatch}
          onClose={onClose}
        />,
      );
    });

    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel',
    );
    expect(cancelButton).toBeTruthy();
    act(() => {
      cancelButton!.click();
    });

    expect(onPatch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Beat-to-measure conversion', () => {
  it('computes correct measure from beat using accumulated meter data', () => {
    const entries = MIXED_METER_MAP.entries;
    expect(beatToMeasure(0, entries)).toBe(1);
    expect(beatToMeasure(4, entries)).toBe(2);
    expect(beatToMeasure(16, entries)).toBe(5);
    expect(beatToMeasure(19, entries)).toBe(6);
    expect(beatToMeasure(28, entries)).toBe(9);
  });

  it('derives correct region boundaries', () => {
    const regions = deriveMeterRegions(MIXED_METER_MAP, 40);
    expect(regions).toHaveLength(3);
    expect(regions[0].startBeat).toBe(0);
    expect(regions[1].startBeat).toBe(16);
    expect(regions[2].startBeat).toBeCloseTo(28, 6);
  });

  it('finds correct region at beat', () => {
    const regions = deriveMeterRegions(MIXED_METER_MAP, 40);
    expect(findRegionAtBeat(regions, 0)).toBe(0);
    expect(findRegionAtBeat(regions, 16)).toBe(1);
    expect(findRegionAtBeat(regions, 28)).toBe(2);
    expect(findRegionAtBeat(regions, 35)).toBe(2);
  });
});
