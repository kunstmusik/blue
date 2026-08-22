/**
 * Pure pattern-grid clipboard helpers. The clipboard stores a relative cell
 * shape in renderer session state; the canonical project owns the eventual
 * active-cell mutation.
 */
import type { PatternCellEdit, PatternsLayerGroupSnapshot } from '../types';

export interface PatternClipboardShapeData {
  cells: ReadonlyArray<{ rowOffset: number; cellOffset: number }>;
  width: number;
  height: number;
}

export const SINGLE_PATTERN_CELL_SHAPE: PatternClipboardShapeData = {
  cells: [{ rowOffset: 0, cellOffset: 0 }],
  width: 1,
  height: 1,
};

/** Map a relative grid shape onto a target row/cell, clipping missing rows. */
export function mapPatternShapeToTarget(
  shape: PatternClipboardShapeData,
  target: { layerId: string; cellIndex: number },
  group: PatternsLayerGroupSnapshot,
): PatternCellEdit[] {
  const targetRowIndex = group.layers.findIndex((layer) => layer.layerId === target.layerId);
  if (targetRowIndex < 0 || !Number.isInteger(target.cellIndex) || target.cellIndex < 0) return [];

  const seen = new Set<string>();
  const edits: PatternCellEdit[] = [];
  for (const cell of shape.cells) {
    if (!Number.isInteger(cell.rowOffset) || cell.rowOffset < 0) continue;
    if (!Number.isInteger(cell.cellOffset) || cell.cellOffset < 0) continue;
    const row = group.layers[targetRowIndex + cell.rowOffset];
    if (!row) continue;
    const cellIndex = target.cellIndex + cell.cellOffset;
    const key = `${row.layerId}:${cellIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edits.push({ layerId: row.layerId, cellIndex, active: true });
  }
  return edits;
}
