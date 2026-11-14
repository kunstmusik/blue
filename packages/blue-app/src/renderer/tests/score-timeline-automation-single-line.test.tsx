// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import AutomationLineView from '../components/workbench/panels/score/automation/AutomationLineView';
import type { AutomationParameterSnapshot } from '../../shared/project-editor';
import {
  beatToX,
  xToBeat,
  valueToY,
  yToValue,
  clampAndSnap,
  snapBeat,
  insertPoint,
  deletePoint,
  movePoint,
  moveRange,
  scaleRange,
  shiftRangeValues,
  rangeEdgeNear,
  findPointNear,
} from '../components/workbench/panels/score/automation/automation-line-utils';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver;

const PPB = 100;
const HEIGHT = 100;

describe('single-line coordinate conversion', () => {
  it('round-trips beat <-> pixel', () => {
    expect(xToBeat(beatToX(4.5, PPB), PPB)).toBeCloseTo(4.5);
    expect(beatToX(3, PPB)).toBe(300);
    expect(xToBeat(300, PPB)).toBeCloseTo(3);
  });

  it('round-trips value <-> pixel within min/max', () => {
    const v = yToValue(valueToY(0.4, 0, 1, HEIGHT), 0, 1, HEIGHT, 0);
    expect(v).toBeCloseTo(0.4, 1);
  });

  it('clamps and snaps values to resolution within min/max', () => {
    expect(clampAndSnap(1.5, 0, 1, 0)).toBe(1);
    expect(clampAndSnap(-1, 0, 1, 0)).toBe(0);
    expect(clampAndSnap(0.2, 0, 1, 0.25)).toBe(0.25); // rounds up to nearest 0.25
    expect(clampAndSnap(0.1, 0, 1, 0.25)).toBe(0); // rounds down to 0
  });
});

describe('single-line snap', () => {
  it('does not snap when disabled and never returns negative beats', () => {
    expect(snapBeat(-3, false, 0)).toBe(0);
    expect(snapBeat(2.7, false, 0)).toBeCloseTo(2.7);
  });

  it('snaps to the nearest multiple when enabled', () => {
    expect(snapBeat(2.7, true, 1)).toBe(3);
    expect(snapBeat(2.4, true, 1)).toBe(2);
    expect(snapBeat(-1, true, 1)).toBe(0);
  });
});

describe('single-line point edit primitives', () => {
  it('inserts a point and keeps the line sorted by time', () => {
    const pts = insertPoint(
      [
        { time: 0, value: 0 },
        { time: 4, value: 1 },
      ],
      2,
      0.5,
    );
    expect(pts.map((p) => p.time)).toEqual([0, 2, 4]);
  });

  it('deletes a point by index', () => {
    const pts = deletePoint(
      [
        { time: 0, value: 0 },
        { time: 2, value: 0.5 },
        { time: 4, value: 1 },
      ],
      1,
    );
    expect(pts.map((p) => p.time)).toEqual([0, 4]);
  });

  it('moves a point and re-sorts, clamping time to >= 0', () => {
    const pts = movePoint(
      [
        { time: 0, value: 0 },
        { time: 4, value: 1 },
      ],
      0,
      3,
      0.5,
    );
    expect(pts.map((p) => p.time)).toEqual([3, 4]);
    const clamped = movePoint([{ time: 2, value: 0 }], 0, -5, 0);
    expect(clamped[0]!.time).toBe(0);
  });
});

describe('single-line range move', () => {
  it('moves only in-range points and clamps before beat zero', () => {
    const pts = [
      { time: 0, value: 0 },
      { time: 2, value: 0.5 },
      { time: 6, value: 1 },
    ];
    const moved = moveRange(pts, 1, 4, 2);
    expect(moved.map((p) => p.time)).toEqual([0, 4, 6]);

    // A delta that would push an in-range point below zero clamps it to 0.
    const clamped = moveRange(pts, 1, 4, -5);
    expect(clamped.map((p) => p.time)).toEqual([0, 0, 6]);
  });
});

describe('single-line range scale', () => {
  it('scales in-range points around the anchor and leaves others unchanged', () => {
    const pts = [
      { time: 0, value: 0 },
      { time: 2, value: 0.5 },
      { time: 6, value: 1 },
    ];
    const scaled = scaleRange(pts, 1, 4, 1, 2);
    expect(scaled.map((p) => p.time)).toEqual([0, 3, 6]);
  });
});

describe('single-line vertical value shift', () => {
  it('shifts in-range values, clamping and snapping to bounds/resolution', () => {
    const pts = [
      { time: 0, value: 0 },
      { time: 2, value: 0.5 },
      { time: 6, value: 1 },
    ];
    const shifted = shiftRangeValues(pts, 1, 4, 0.4, 0, 1, 0);
    expect(shifted[1]!.value).toBeCloseTo(0.9, 5);
    expect(shifted[0]!.value).toBe(0); // out of range, unchanged
    expect(shifted[2]!.value).toBe(1); // out of range, unchanged

    const clamped = shiftRangeValues([{ time: 2, value: 0.9 }], 1, 4, 0.5, 0, 1, 0);
    expect(clamped[0]!.value).toBe(1);
  });
});

describe('single-line range edge detection', () => {
  const range = { startBeat: 2, endBeat: 6 };
  it('detects the left edge', () => {
    expect(rangeEdgeNear(range, 2.03, PPB)).toBe('left');
  });
  it('detects the right edge', () => {
    expect(rangeEdgeNear(range, 5.97, PPB)).toBe('right');
  });
  it('returns null for the middle of the range', () => {
    expect(rangeEdgeNear(range, 4, PPB)).toBeNull();
  });
  it('returns null for a range too narrow to disambiguate', () => {
    expect(rangeEdgeNear({ startBeat: 2, endBeat: 2.01 }, 2.005, PPB)).toBeNull();
  });
});

describe('single-line point hit testing', () => {
  it('finds the nearest point within the pixel threshold', () => {
    const pts = [
      { time: 0, value: 0 },
      { time: 2, value: 1 },
    ];
    const idx = findPointNear(pts, 2.05, 1, 0, 1, HEIGHT, 8, PPB);
    expect(idx).toBe(1);
  });

  it('returns -1 when no point is near', () => {
    const pts = [{ time: 0, value: 0 }];
    expect(findPointNear(pts, 5, 0.5, 0, 1, HEIGHT, 8, PPB)).toBe(-1);
  });
});

describe('AutomationLineView point rendering', () => {
  it('renders points with dark fill, constant radius, and red outline highlight on hover', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const parent = document.createElement('div');
    container.appendChild(parent);

    // Mock getBoundingClientRect on the parent so AutomationLineView gets dimensions
    parent.getBoundingClientRect = () => ({
      width: 400,
      height: 44,
      top: 0,
      left: 0,
      bottom: 44,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const root: Root = createRoot(parent);

    const testParam: AutomationParameterSnapshot = {
      parameterId: 'param-test',
      name: 'Send Amount',
      label: 'dB',
      displayName: 'Send Amount',
      minimum: 0,
      maximum: 1,
      resolutionDecimal: '-1',
      resolution: -1,
      curve: 'LINEAR',
      fixedValue: 0,
      automationEnabled: true,
      lineColor: 0x20dd00, // green
      sourceKind: 'instrument',
      targetPath: ['instr 1', 'Send Amount'],
      points: [
        { time: 0, value: 0 },
        { time: 4, value: 0.8 },
      ],
    };

    // Render with point 1 hovered
    act(() => {
      root.render(
        <AutomationLineView
          parameter={testParam}
          pixelsPerBeat={100}
          active={true}
          mode="singleLine"
          hoveredPointIndex={1}
        />,
      );
    });

    const circles = parent.querySelectorAll<SVGCircleElement>('circle');
    expect(circles.length).toBe(2);

    // Point 0 (unhovered): dark fill, green stroke, radius 3.25
    expect(circles[0]!.getAttribute('fill')).toBe('#05070d');
    expect(circles[0]!.getAttribute('stroke')).toBe('#20dd00');
    expect(circles[0]!.getAttribute('r')).toBe('3.25');

    // Point 1 (hovered): dark fill (NOT solid red), red stroke, constant radius 3.25
    expect(circles[1]!.getAttribute('fill')).toBe('#05070d');
    expect(circles[1]!.getAttribute('stroke')).toBe('#ef4444');
    expect(circles[1]!.getAttribute('r')).toBe('3.25');

    act(() => root.unmount());
    container.remove();
  });

  it('culls automation points and path segments to visible viewport bounds while preserving point indices', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const parent = document.createElement('div');
    Object.defineProperty(parent, 'clientHeight', { value: 100, configurable: true });
    parent.getBoundingClientRect = () =>
      ({ width: 500, height: 100, top: 0, left: 0, right: 500, bottom: 100 }) as DOMRect;
    container.appendChild(parent);

    const root = createRoot(parent);
    const onPointMouseDown = vi.fn();
    const testParam: AutomationParameterSnapshot = {
      parameterId: 'p-culled',
      name: 'Cutoff',
      minimum: 0,
      maximum: 1,
      resolution: -1,
      lineColor: 0x00ff00,
      points: [
        { time: 0, value: 0 },
        { time: 10, value: 0.2 },
        { time: 25, value: 0.5 },
        { time: 40, value: 0.8 },
        { time: 100, value: 1 },
      ],
    };

    act(() => {
      root.render(
        <AutomationLineView
          parameter={testParam}
          pixelsPerBeat={10}
          visibleStartBeats={20}
          visibleEndBeats={45}
          totalBeats={120}
          active={true}
          mode="singleLine"
          onPointMouseDown={onPointMouseDown}
        />,
      );
    });

    const circles = parent.querySelectorAll<SVGCircleElement>('circle');
    expect(circles.length).toBe(2);
    expect(circles[0]!.getAttribute('cx')).toBe('250');
    expect(circles[1]!.getAttribute('cx')).toBe('400');

    act(() => {
      circles[0]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    expect(onPointMouseDown).toHaveBeenCalledWith(2, expect.anything());

    const pathD = parent.querySelector('path')?.getAttribute('d') ?? '';
    expect(pathD).toContain('M 100 ');
    expect(pathD).toContain('L 1000 ');
    expect(pathD).not.toContain('M 0 ');
    expect(pathD).not.toContain('100000');

    // Quantized mid-ramp viewport only evaluates pixels overlapping the viewport
    const quantizedParam: AutomationParameterSnapshot = {
      ...testParam,
      resolution: 0.1,
      points: [
        { time: 0, value: 0 },
        { time: 5000, value: 1 },
      ],
    };
    act(() => {
      root.render(
        <AutomationLineView
          parameter={quantizedParam}
          pixelsPerBeat={10}
          visibleStartBeats={1000}
          visibleEndBeats={1020}
          totalBeats={5000}
          active={true}
          mode="singleLine"
        />,
      );
    });
    const quantizedPathD = parent.querySelector('path')?.getAttribute('d') ?? '';
    expect(quantizedPathD.startsWith('M 9999 ')).toBe(true);
    expect(quantizedPathD).toContain('L 10201 ');

    // Unsorted range-drag preview points keep visible circles and path intact
    const unsortedPreviewParam: AutomationParameterSnapshot = {
      ...testParam,
      resolution: -1,
      points: [
        { time: 4, value: 0 },
        { time: 5, value: 0.2 },
        { time: 6, value: 0.4 },
        { time: 2, value: 0.8 },
        { time: 12, value: 1 },
      ],
    };
    act(() => {
      root.render(
        <AutomationLineView
          parameter={unsortedPreviewParam}
          pixelsPerBeat={10}
          visibleStartBeats={0}
          visibleEndBeats={3}
          totalBeats={20}
          active={true}
          mode="singleLine"
        />,
      );
    });
    const unsortedCircles = parent.querySelectorAll<SVGCircleElement>('circle');
    expect(unsortedCircles.length).toBe(1);
    expect(unsortedCircles[0]!.getAttribute('cx')).toBe('20');
    expect(parent.querySelector('path')?.getAttribute('d')).toContain('L 20 22.999999999999996');

    // Duplicate-time vertical step just before visibleStartBeats retains full vertical step,
    // and single-point lines with time > 0 remain visible before their point time.
    const stepParam: AutomationParameterSnapshot = {
      ...testParam,
      resolution: -1,
      points: [
        { time: 0, value: 0 },
        { time: 5, value: 0.2 },
        { time: 5, value: 0.9 },
        { time: 10, value: 0.8 },
      ],
    };
    act(() => {
      root.render(
        <AutomationLineView
          parameter={stepParam}
          pixelsPerBeat={20}
          visibleStartBeats={5.005}
          visibleEndBeats={12}
          totalBeats={20}
          active={true}
          mode="singleLine"
        />,
      );
    });
    const stepPathD = parent.querySelector('path')?.getAttribute('d') ?? '';
    expect(stepPathD).toContain('M 100 77 L 100 13.999999999999998');

    const singleDelayedPoint: AutomationParameterSnapshot = {
      ...testParam,
      resolution: -1,
      points: [{ time: 5, value: 0.5 }],
    };
    act(() => {
      root.render(
        <AutomationLineView
          parameter={singleDelayedPoint}
          pixelsPerBeat={10}
          visibleStartBeats={0}
          visibleEndBeats={3}
          totalBeats={20}
          active={true}
          mode="singleLine"
        />,
      );
    });
    expect(parent.querySelector('path')?.getAttribute('d')).toBe('M 0 50 L 30 50');

    // Quantized mode ignores off-screen left/right duplicate-time vertical steps
    const quantizedWithOffscreenSteps: AutomationParameterSnapshot = {
      ...testParam,
      resolution: 0.1,
      points: [
        { time: 0, value: 0 },
        { time: 5, value: 0.1 },
        { time: 5, value: 0.9 },
        { time: 10, value: 0.1 },
        { time: 10, value: 0.9 },
      ],
    };
    act(() => {
      root.render(
        <AutomationLineView
          parameter={quantizedWithOffscreenSteps}
          pixelsPerBeat={100}
          visibleStartBeats={7}
          visibleEndBeats={9}
          totalBeats={12}
          active={true}
          mode="singleLine"
        />,
      );
    });
    const quantizedMidPathD = parent.querySelector('path')?.getAttribute('d') ?? '';
    expect(quantizedMidPathD.startsWith('M 699 ')).toBe(true);
    expect(quantizedMidPathD).not.toContain('L 500 ');
    expect(quantizedMidPathD).not.toContain('L 1000 ');

    act(() => root.unmount());
    container.remove();
  });
});
