/**
 * Pure automation range transform functions shared between the renderer (for
 * live preview) and the main process (for canonical point mutation).
 *
 * Port of Java Blue's Line.processLineForSelectionDrag / processLineForSelectionScale
 * (Line.java:909-1194). When a time-range of automation points is moved or scaled,
 * the line segments connecting outside-points to in-range points would visually
 * deform without boundary anchor points. These functions capture the line's value
 * at the selection boundaries before the transform, apply the transform to in-range
 * points, then insert anchor points at the original and translated/scaled boundary
 * times so the unselected portions of the line stay visually intact.
 */

export interface RangePoint {
  time: number;
  value: number;
}

/**
 * Returns the line's y-value at `time`. If points exist at exactly `time`,
 * `fromLeft` selects the leftmost (true) or rightmost (false) one to handle
 * discontinuities. Otherwise interpolates linearly between surrounding points.
 *
 * Port of Java's Line.getValue(time, fromLeft) + Line.getValue(time).
 */
export function lineValueAt<T extends RangePoint>(
  points: readonly T[],
  time: number,
  fromLeft: boolean,
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0]!.value;

  if (fromLeft) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      if (p.time === time) return p.value;
      if (p.time > time) break;
    }
  } else {
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i]!;
      if (p.time === time) return p.value;
      if (p.time < time) break;
    }
  }

  if (time <= points[0]!.time) return points[0]!.value;
  if (time >= points[points.length - 1]!.time) return points[points.length - 1]!.value;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.time <= time && b.time >= time) {
      if (b.time === a.time) return b.value;
      const t = (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * t;
    }
  }

  return points[points.length - 1]!.value;
}

/**
 * Insert a point at (time, value). If a point already exists at exactly `time`:
 * - If there are TWO points at `time` (a discontinuity pair), adjust the
 *   appropriate side (fromLeft → first, !fromLeft → last).
 * - If there is ONE point at `time`, INSERT a new one to form a discontinuity
 *   pair (NOT adjust). This matches Java's behavior where insertOrAdjust always
 *   inserts when left == right, creating boundary discontinuities that preserve
 *   line shape on both sides of the boundary.
 *
 * Port of Java's Line.insertOrAdjust(time, value, fromLeft).
 */
function insertOrAdjustPoint(
  points: RangePoint[],
  time: number,
  value: number,
  fromLeft: boolean,
): RangePoint[] {
  // Find all points at exactly this time.
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.time === time) indices.push(i);
  }

  if (indices.length >= 2) {
    // Discontinuity pair exists — adjust the appropriate side.
    const targetIdx = fromLeft ? indices[0]! : indices[indices.length - 1]!;
    const copy = [...points];
    copy[targetIdx] = { ...copy[targetIdx]!, value };
    return copy;
  }

  // Zero or one point at this time — insert a new one (Java always inserts
  // when left == right, creating a discontinuity pair if one existed).
  const result = [...points, { time, value }];
  result.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * Remove duplicate-time points that have the same value (dead points).
 * Port of Java's Line.stripTimeDeadPoints().
 */
function stripTimeDeadPoints(points: RangePoint[]): RangePoint[] {
  if (points.length <= 1) return points;
  const result = [...points];

  for (let i = result.length - 1; i >= 1; i--) {
    const cur = result[i]!;
    const prev = result[i - 1]!;
    if (cur.time === prev.time && cur.value === prev.value) {
      result.splice(i, 1);
    }
  }

  let zeroFound = false;
  for (let i = 0; i < result.length; i++) {
    if (result[i]!.time === 0) {
      if (zeroFound) {
        result.splice(i, 1);
        i--;
      } else {
        zeroFound = true;
      }
    }
  }

  return result;
}

/** Helper: insert anchor only if current line value differs from target. */
function anchor(
  points: RangePoint[],
  time: number,
  value: number,
  fromLeft: boolean,
): RangePoint[] {
  if (lineValueAt(points, time, fromLeft) !== value) {
    return insertOrAdjustPoint(points, time, value, fromLeft);
  }
  return points;
}

/**
 * Move all points within [selectionStart, selectionEnd] by transTime, while
 * inserting boundary anchor points at the original and translated selection
 * edges to preserve the line shape outside the selection.
 *
 * Port of Java's Line.processLineForSelectionDrag.
 */
export function moveRangeWithAnchors<T extends RangePoint>(
  points: readonly T[],
  selectionStart: number,
  selectionEnd: number,
  transTime: number,
): RangePoint[] {
  if (transTime === 0) return [...points];

  const leftWards = transTime < 0;
  const transStartTime = Math.max(0, selectionStart + transTime);
  const transEndTime = Math.max(0, selectionEnd + transTime);

  const originStartOuterValue = lineValueAt(points, selectionStart, true);
  const originStartInnerValue = lineValueAt(points, selectionStart, false);
  const originEndOuterValue = lineValueAt(points, selectionEnd, false);
  const originEndInnerValue = lineValueAt(points, selectionEnd, true);
  const transStartOuterVal = lineValueAt(points, transStartTime, true);
  const transEndOuterVal = lineValueAt(points, transEndTime, false);

  const intersects = Math.abs(transTime) <= selectionEnd - selectionStart;

  // Collect in-range points (skip first point — Java's isFirstLinePoint).
  const collected: RangePoint[] = [];
  let result: RangePoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i === 0) {
      result.push({ time: p.time, value: p.value });
      continue;
    }
    const inOriginal = p.time >= selectionStart && p.time <= selectionEnd;
    const inTranslated = p.time >= transStartTime && p.time <= transEndTime;
    if (inOriginal) {
      collected.push({ time: Math.max(0, p.time + transTime), value: p.value });
      // Don't add to result — will be re-added after move.
    } else if (inTranslated) {
      // Point in translated region — drop (will be overwritten by anchors).
    } else {
      result.push({ time: p.time, value: p.value });
    }
  }

  // Strip duplicate boundary points from collected list (Java stripOuterPoints).
  // Move collected points back.
  for (const cp of collected) {
    result.push(cp);
  }
  result.sort((a, b) => a.time - b.time);

  // Insert boundary anchors, following Java's conditional branches.
  if (intersects) {
    if (!leftWards) {
      // Moved right
      result = anchor(result, transStartTime, originStartOuterValue, true);
      result = anchor(result, transStartTime, originStartInnerValue, false);
      result = anchor(result, selectionStart, originStartOuterValue, true);
      result = anchor(result, transEndTime, transEndOuterVal, false);
      result = anchor(result, transEndTime, originEndInnerValue, true);
    } else {
      // Moved left
      result = anchor(result, transStartTime, transStartOuterVal, true);
      result = anchor(result, transStartTime, originStartInnerValue, false);
      result = anchor(result, selectionEnd, originEndInnerValue, true);
      result = anchor(result, selectionEnd, originEndOuterValue, false);
      result = anchor(result, transEndTime, originEndInnerValue, false);
    }
  } else {
    if (!leftWards) {
      // Moved right, no intersection
      result = anchor(result, selectionEnd, originEndOuterValue, false);
      result = anchor(result, selectionEnd, originStartOuterValue, true);
      result = anchor(result, selectionStart, originStartOuterValue, true);
      result = anchor(result, transStartTime, transStartOuterVal, true);
      result = anchor(result, transEndTime, transEndOuterVal, false);
      result = anchor(result, transStartTime, originStartInnerValue, false);
      result = anchor(result, transEndTime, originEndInnerValue, true);
    } else {
      // Moved left, no intersection
      result = anchor(result, transStartTime, transStartOuterVal, true);
      result = anchor(result, transEndTime, transEndOuterVal, false);
      result = anchor(result, transStartTime, originStartInnerValue, false);
      result = anchor(result, transEndTime, originEndInnerValue, true);
      result = anchor(result, selectionEnd, originStartOuterValue, true);
      result = anchor(result, selectionEnd, originEndOuterValue, false);
      result = anchor(result, selectionStart, originStartOuterValue, true);
    }
  }

  result.sort((a, b) => a.time - b.time);
  return stripTimeDeadPoints(result);
}

/**
 * Scale all points within [domainStart, domainEnd] around the scale's domain/range,
 * inserting boundary anchor points at the original and scaled edges to preserve
 * the line shape outside the selection.
 *
 * Port of Java's Line.processLineForSelectionScale.
 */
export function scaleRangeWithAnchors<T extends RangePoint>(
  points: readonly T[],
  domainStart: number,
  domainEnd: number,
  anchorBeat: number,
  scaleFactor: number,
): RangePoint[] {
  const rangeStart = anchorBeat + (domainStart - anchorBeat) * scaleFactor;
  const rangeEnd = anchorBeat + (domainEnd - anchorBeat) * scaleFactor;

  if (rangeStart === domainStart && rangeEnd === domainEnd) return [...points];

  const domainStartOuterValue = lineValueAt(points, domainStart, true);
  const domainStartInnerValue = lineValueAt(points, domainStart, false);
  const domainEndOuterValue = lineValueAt(points, domainEnd, false);
  const domainEndInnerValue = lineValueAt(points, domainEnd, true);
  const rangeStartOuterValue = lineValueAt(points, rangeStart, true);
  const rangeEndOuterValue = lineValueAt(points, rangeEnd, false);

  const deleteStart = Math.min(domainStart, rangeStart);
  const deleteEnd = Math.max(domainEnd, rangeEnd);

  // Collect and scale in-range points; remove points in the affected region.
  const affected: RangePoint[] = [];
  let result: RangePoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i === 0) {
      result.push({ time: p.time, value: p.value });
      continue;
    }
    if (p.time < deleteStart || p.time > deleteEnd) {
      result.push({ time: p.time, value: p.value });
      continue;
    }
    if (p.time >= domainStart && p.time <= domainEnd) {
      const newTime = Math.max(0, anchorBeat + (p.time - anchorBeat) * scaleFactor);
      affected.push({ time: newTime, value: p.value });
    }
    // Points in region but not in domain are dropped.
  }

  result = [...result, ...affected];
  result.sort((a, b) => a.time - b.time);

  // Insert boundary anchors following Java's conditional branches.
  if (rangeStart > domainStart) {
    // Scaled right from left edge
    result = anchor(result, domainStart, domainStartOuterValue, true);
    result = anchor(result, rangeStart, domainStartOuterValue, true);
    result = anchor(result, rangeStart, domainStartInnerValue, false);
    result = anchor(result, rangeEnd, domainEndInnerValue, true);
  } else if (rangeStart < domainStart) {
    // Scaled left from left edge
    result = anchor(result, rangeStart, rangeStartOuterValue, true);
    result = anchor(result, rangeStart, domainStartInnerValue, false);
    result = anchor(result, rangeEnd, domainEndInnerValue, true);
  } else if (rangeEnd > domainEnd) {
    // Scaled right from right edge
    result = anchor(result, rangeEnd, domainEndInnerValue, true);
    result = anchor(result, rangeEnd, rangeEndOuterValue, false);
    result = anchor(result, domainStart, domainStartInnerValue, false);
  } else if (rangeEnd < domainEnd) {
    // Scaled left from right edge
    result = anchor(result, rangeEnd, domainEndInnerValue, true);
    result = anchor(result, rangeEnd, domainEndOuterValue, false);
    result = anchor(result, domainEnd, domainEndOuterValue, false);
    result = anchor(result, domainStart, domainStartInnerValue, false);
  }

  result.sort((a, b) => a.time - b.time);
  return stripTimeDeadPoints(result);
}
