import type { AutomationPointSnapshot } from '../../../../../../shared/project-editor';

export const AUTOMATION_LINE_EDGE_INSET = 5;

export function beatToX(beat: number, pixelsPerBeat: number): number {
  return beat * pixelsPerBeat;
}

export function xToBeat(x: number, pixelsPerBeat: number): number {
  return x / pixelsPerBeat;
}

export function valueToY(
  value: number,
  minimum: number,
  maximum: number,
  height: number,
): number {
  if (maximum === minimum) return height / 2;
  const normalized = (value - minimum) / (maximum - minimum);
  const drawableHeight = Math.max(0, height - AUTOMATION_LINE_EDGE_INSET * 2);
  if (drawableHeight === 0) return height / 2;
  return AUTOMATION_LINE_EDGE_INSET + (1 - normalized) * drawableHeight;
}

export function yToValue(
  y: number,
  minimum: number,
  maximum: number,
  height: number,
  resolution: number,
): number {
  const drawableHeight = Math.max(0, height - AUTOMATION_LINE_EDGE_INSET * 2);
  if (drawableHeight === 0) return minimum;
  const normalized = 1 - ((y - AUTOMATION_LINE_EDGE_INSET) / drawableHeight);
  let value = minimum + normalized * (maximum - minimum);
  return clampAndSnap(value, minimum, maximum, resolution);
}

export function clampAndSnap(
  value: number,
  minimum: number,
  maximum: number,
  resolution: number,
): number {
  let clamped = Math.min(maximum, Math.max(minimum, value));
  if (resolution > 0 && Number.isFinite(resolution)) {
    clamped = minimum + Math.round((clamped - minimum) / resolution) * resolution;
    clamped = Math.min(maximum, Math.max(minimum, clamped));
  }
  return clamped;
}

export function snapBeat(beat: number, snapEnabled: boolean, snapValue: number): number {
  if (!snapEnabled || snapValue <= 0) return Math.max(0, beat);
  const snapped = Math.round(beat / snapValue) * snapValue;
  return Math.max(0, snapped);
}

export function insertPoint(
  points: AutomationPointSnapshot[],
  time: number,
  value: number,
): AutomationPointSnapshot[] {
  const newPoints = [...points, { time, value }];
  newPoints.sort((a, b) => a.time - b.time);
  return newPoints;
}

export function deletePoint(
  points: AutomationPointSnapshot[],
  index: number,
): AutomationPointSnapshot[] {
  if (index < 0 || index >= points.length) return points;
  return points.filter((_, i) => i !== index);
}

export function movePoint(
  points: AutomationPointSnapshot[],
  index: number,
  newTime: number,
  newValue: number,
): AutomationPointSnapshot[] {
  if (index < 0 || index >= points.length) return points;
  const newPoints = points.map((p, i) =>
    i === index ? { time: Math.max(0, newTime), value: newValue } : p,
  );
  newPoints.sort((a, b) => a.time - b.time);
  return newPoints;
}

export function replaceRange(
  points: AutomationPointSnapshot[],
  startBeat: number,
  endBeat: number,
  newPoints: AutomationPointSnapshot[],
): AutomationPointSnapshot[] {
  const outside = points.filter((p) => p.time < startBeat || p.time > endBeat);
  const merged = [...outside, ...newPoints];
  merged.sort((a, b) => a.time - b.time);
  return merged;
}

export function moveRange(
  points: AutomationPointSnapshot[],
  startBeat: number,
  endBeat: number,
  beatDelta: number,
): AutomationPointSnapshot[] {
  return points.map((p) => {
    if (p.time >= startBeat && p.time <= endBeat) {
      return { ...p, time: Math.max(0, p.time + beatDelta) };
    }
    return p;
  });
}

export function scaleRange(
  points: AutomationPointSnapshot[],
  startBeat: number,
  endBeat: number,
  anchorBeat: number,
  scaleFactor: number,
): AutomationPointSnapshot[] {
  return points.map((p) => {
    if (p.time >= startBeat && p.time <= endBeat) {
      const offset = p.time - anchorBeat;
      return { ...p, time: Math.max(0, anchorBeat + offset * scaleFactor) };
    }
    return p;
  });
}

// The anchored range transform functions (moveRangeWithAnchors, scaleRangeWithAnchors,
// lineValueAt) live in the shared module so both renderer and main process can use them.
export { lineValueAt, moveRangeWithAnchors, scaleRangeWithAnchors } from '../../../../../../shared/automation-range-math';

/**
 * Vertically shift the values of points within [startBeat, endBeat] by `delta`,
 * clamping + snapping each to the parameter bounds/resolution. Used by the
 * single-line control-drag vertical-shift gesture.
 */
export function shiftRangeValues(
  points: AutomationPointSnapshot[],
  startBeat: number,
  endBeat: number,
  delta: number,
  minimum: number,
  maximum: number,
  resolution: number,
): AutomationPointSnapshot[] {
  return points.map((p) => {
    if (p.time < startBeat || p.time > endBeat) return p;
    return { ...p, value: clampAndSnap(p.value + delta, minimum, maximum, resolution) };
  });
}

/**
 * Returns which edge of a beat range the cursor is closest to, for the
 * single-line drag-an-edge-to-scale gesture. Returns null when the cursor is
 * not near an edge (or the range is too narrow to disambiguate).
 */
export function rangeEdgeNear(
  range: { startBeat: number; endBeat: number },
  beat: number,
  pixelsPerBeat: number,
  thresholdPx = 6,
): 'left' | 'right' | null {
  const start = Math.min(range.startBeat, range.endBeat);
  const end = Math.max(range.startBeat, range.endBeat);
  const beatThreshold = thresholdPx / pixelsPerBeat;
  const nearLeft = Math.abs(beat - start) <= beatThreshold;
  const nearRight = Math.abs(beat - end) <= beatThreshold;
  if (nearLeft && nearRight) return null;
  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  return null;
}

/**
 * Format a number for the on-curve point readout, mirroring Java Blue's
 * `NumberUtilities.formatDouble` (`##.##########`): up to ten fractional
 * digits with trailing zeros trimmed. Falls back to the raw string for
 * non-finite values.
 */
export function formatAutomationDouble(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  let s = value.toFixed(10);
  if (s.indexOf('.') !== -1) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s;
}

/**
 * Index where a new point at `time` will land after the backend's
 * `addPoint(time, value)` (which pushes then stable-sorts ascending by time).
 * Stable sort keeps an inserted point after any existing points sharing the
 * same time, so the result is the count of points with time <= `time`.
 * Used so an insert-then-drag gesture can track the freshly inserted point.
 */
export function insertionIndexForTime(
  points: AutomationPointSnapshot[],
  time: number,
): number {
  let idx = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.time <= time) {
      idx = i + 1;
    } else {
      break;
    }
  }
  return idx;
}

/**
 * Time clamp boundaries for dragging an EXISTING point at `dragIndex`, mirroring
 * Java Blue's `ParameterLinePanel.setBoundaryXValues`:
 *  - first point (index 0): pinned to time 0 ([0, 0]).
 *  - last point: clamped to [second-last time, +Inf] (may extend rightward).
 *  - middle point: clamped to [prev time, next time] (cannot cross neighbors).
 * Clamping prevents a dragged point from reordering past a neighbor, which
 * would otherwise swap indices and make it look like the neighbor vanished.
 */
export function dragTimeBoundaries(
  points: AutomationPointSnapshot[],
  dragIndex: number,
): { minTime: number; maxTime: number } {
  if (dragIndex <= 0) {
    return { minTime: 0, maxTime: 0 };
  }
  if (dragIndex >= points.length - 1) {
    return { minTime: points[dragIndex - 1]!.time, maxTime: Number.POSITIVE_INFINITY };
  }
  return {
    minTime: points[dragIndex - 1]!.time,
    maxTime: points[dragIndex + 1]!.time,
  };
}

/**
 * Time clamp boundaries for a FRESHLY INSERTED point that lands at `insertIdx`
 * (computed against the pre-insert `points`). The new point's neighbors are
 * points[insertIdx - 1] (before) and points[insertIdx] (after, in the original
 * array). Same first/last/middle rules as {@link dragTimeBoundaries}.
 */
export function insertDragTimeBoundaries(
  points: AutomationPointSnapshot[],
  insertIdx: number,
): { minTime: number; maxTime: number } {
  if (insertIdx <= 0) {
    return { minTime: 0, maxTime: 0 };
  }
  if (insertIdx >= points.length) {
    return { minTime: points[points.length - 1]!.time, maxTime: Number.POSITIVE_INFINITY };
  }
  return {
    minTime: points[insertIdx - 1]!.time,
    maxTime: points[insertIdx]!.time,
  };
}

export function findPointNear(
  points: AutomationPointSnapshot[],
  beat: number,
  value: number,
  minimum: number,
  maximum: number,
  height: number,
  thresholdPx: number,
  pixelsPerBeat: number,
): number {
  const beatThreshold = thresholdPx / pixelsPerBeat;
  const targetY = valueToY(value, minimum, maximum, height);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const pointY = valueToY(p.value, minimum, maximum, height);
    if (Math.abs(p.time - beat) <= beatThreshold && Math.abs(pointY - targetY) <= thresholdPx) {
      return i;
    }
  }
  return -1;
}
