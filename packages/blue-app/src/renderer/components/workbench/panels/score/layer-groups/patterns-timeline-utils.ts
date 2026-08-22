/**
 * Pure geometry helpers for the Patterns layer-group grid.
 *
 * A pattern cell is not an independently placed score object. Its horizontal
 * position is derived from its integer cell index and the group's shared
 * pattern step length.
 */
import type {
  PatternLayerSnapshot,
  PatternsLayerGroupSnapshot,
} from '../types';

/** Positive-definite scale guard; never produces NaN CSS values. */
export function safePixelsPerBeat(pixelsPerBeat: number): number {
  return Number.isFinite(pixelsPerBeat) && pixelsPerBeat > 0 ? pixelsPerBeat : 1;
}

/** Beat position → canvas pixel. Non-finite inputs clamp to zero. */
export function beatToPixelX(beat: number, pixelsPerBeat: number): number {
  const scale = safePixelsPerBeat(pixelsPerBeat);
  if (!Number.isFinite(beat) || beat < 0) return 0;
  return beat * scale;
}

/** Canvas pixel → beat position. Non-finite inputs clamp to zero. */
export function pixelXToBeat(pixelX: number, pixelsPerBeat: number): number {
  const scale = safePixelsPerBeat(pixelsPerBeat);
  if (!Number.isFinite(pixelX) || pixelX < 0) return 0;
  return pixelX / scale;
}

/** Hit-testing/paint cell index: floor(max(0, beat) / step). */
export function cellIndexAtBeat(beat: number, stepBeats: number): number {
  const step = Number.isFinite(stepBeats) && stepBeats > 0 ? stepBeats : 1;
  return Math.floor(Math.max(0, beat) / step);
}

/** Every integer cell between two indices, inclusive. */
export function cellsBetween(start: number, end: number): number[] {
  const first = Math.min(start, end);
  const last = Math.max(start, end);
  const cells: number[] = [];
  for (let cellIndex = first; cellIndex <= last; cellIndex += 1) {
    cells.push(cellIndex);
  }
  return cells;
}

/** Maximum active-cell end in beats; zero when the group has no active cells. */
export function computePatternExtentBeats(group: PatternsLayerGroupSnapshot): number {
  const step = Number.isFinite(group.effectivePatternBeatsLength)
    && group.effectivePatternBeatsLength > 0
    ? group.effectivePatternBeatsLength
    : 1;
  let maxCell = -1;
  for (const layer of group.layers) {
    for (const cellIndex of layer.activeCellIndices) {
      if (Number.isInteger(cellIndex) && cellIndex >= 0) {
        maxCell = Math.max(maxCell, cellIndex);
      }
    }
  }
  return maxCell < 0 ? 0 : (maxCell + 1) * step;
}

export interface PatternRowHit {
  layer: PatternLayerSnapshot;
  rowIndex: number;
  rowTop: number;
}

export function findPatternRowAtY(
  layers: readonly PatternLayerSnapshot[],
  localY: number,
  defaultRowHeight: number,
): PatternRowHit | null {
  if (!Number.isFinite(localY) || localY < 0) return null;
  let rowTop = 0;
  for (let rowIndex = 0; rowIndex < layers.length; rowIndex += 1) {
    const layer = layers[rowIndex]!;
    const height = layer.height || defaultRowHeight;
    if (localY >= rowTop && localY < rowTop + height) {
      return { layer, rowIndex, rowTop };
    }
    rowTop += height;
  }
  return null;
}
