import type {
  AutomationAssignmentState,
  AutomationPointSnapshot,
  AutomationRangeRef,
  AutomationTargetSnapshot,
  AutomationTargetGroupSnapshot,
  ScoreLayerAutomationSnapshot,
  ScoreLayerGroupSnapshot,
} from '../../../../../../shared/project-editor';
import { DEFAULT_ROW_HEIGHT, GROUP_SPACER } from '../types';

export function classifyTargets(
  automation: ScoreLayerAutomationSnapshot,
  allTargets: AutomationTargetSnapshot[],
): {
  current: AutomationTargetSnapshot[];
  elsewhere: AutomationTargetSnapshot[];
  available: AutomationTargetSnapshot[];
  missing: AutomationTargetSnapshot[];
} {
  const current: AutomationTargetSnapshot[] = [];
  const elsewhere: AutomationTargetSnapshot[] = [];
  const available: AutomationTargetSnapshot[] = [];
  const missing: AutomationTargetSnapshot[] = [];

  for (const target of allTargets) {
    switch (target.assignmentState) {
      case 'assignedCurrentLayer':
        current.push(target);
        break;
      case 'assignedOtherLayer':
        elsewhere.push(target);
        break;
      case 'missing':
        missing.push(target);
        break;
      default:
        available.push(target);
    }
  }

  return { current, elsewhere, available, missing };
}

export function getAllTargetsFromGroups(
  groups: AutomationTargetGroupSnapshot[],
): AutomationTargetSnapshot[] {
  const result: AutomationTargetSnapshot[] = [];
  function walk(group: AutomationTargetGroupSnapshot) {
    result.push(...group.targets);
    for (const sub of group.subGroups) {
      walk(sub);
    }
  }
  for (const g of groups) walk(g);
  return result;
}

export function getSelectedParameter(
  automation: ScoreLayerAutomationSnapshot,
): AutomationTargetSnapshot | undefined {
  const selectedId = automation.selectedParameterId;
  if (!selectedId) return undefined;
  return getAllTargetsFromGroups(automation.targetGroups).find((t) => t.parameterId === selectedId);
}

export function getTargetLabel(target: AutomationTargetSnapshot): string {
  return target.label || target.parameterId;
}

export function getAssignmentStateLabel(state: AutomationAssignmentState): string {
  switch (state) {
    case 'assignedCurrentLayer':
      return '●';
    case 'assignedOtherLayer':
      return '◎';
    case 'missing':
      return '✕';
    default:
      return '';
  }
}

// ─── Multi-line range geometry ─────────────────────────────────────────────
//
// Layer rows are laid out top-to-bottom within the score scroll content: each
// layer row is `layer.height || DEFAULT_ROW_HEIGHT` tall, and each layer group
// is followed by a `GROUP_SPACER` gap. This mirrors the layout math in
// score timeline canvases (see getGlobalLayerIndexForY), so the
// geometry computed here stays in sync with the rendered rows without reading
// DOM positions — keeping multi-line selection deterministic and unit-testable.

export interface LayerRowGeometry {
  groupId: string;
  layerId: string;
  layerIndex: number;
  top: number;
  height: number;
  /** True for PolyObject and Track rows (support automation), even with no params. */
  automatable: boolean;
  parameterIds: string[];
}

export function buildLayerRowGeometry(layerGroups: ScoreLayerGroupSnapshot[]): LayerRowGeometry[] {
  const rows: LayerRowGeometry[] = [];
  let y = 0;
  for (const group of layerGroups) {
    for (let li = 0; li < group.layers.length; li++) {
      const layer = group.layers[li]!;
      const height = layer.height || DEFAULT_ROW_HEIGHT;
      const automation = layer.automation;
      const parameterIds = automation?.parameters.map((p) => p.parameterId) ?? [];
      rows.push({
        groupId: group.groupId,
        layerId: layer.layerId,
        layerIndex: li,
        top: y,
        height,
        // A layer is automatable if it HAS an automation field (polyObject or
        // audio family), regardless of whether any parameters are currently
        // assigned. This matches Java's MultiLineSelectionMouseProcessor which
        // includes ALL ScoreObjectLayer rows in the selection span so their
        // score objects / clips participate in move/scale gestures.
        automatable: !!automation,
        parameterIds,
      });
      y += height;
    }
    y += GROUP_SPACER;
  }
  return rows;
}

export function totalLayerContentHeight(rows: LayerRowGeometry[]): number {
  if (rows.length === 0) return 0;
  const last = rows[rows.length - 1]!;
  return last.top + last.height + GROUP_SPACER;
}

/** Automatable rows whose vertical span intersects the [yMin, yMax] range. */
export function layersIntersectingYRange(
  rows: LayerRowGeometry[],
  yMin: number,
  yMax: number,
): LayerRowGeometry[] {
  const lo = Math.min(yMin, yMax);
  const hi = Math.max(yMin, yMax);
  return rows.filter((row) => row.automatable && row.top < hi && row.top + row.height > lo);
}

/**
 * Build a patch range ref covering the given layers within a beat range.
 * All automatable layers are included in `layerIds` (so the object-alignment
 * pass sees them), but `parameterIdsByLayer` only gets entries for layers
 * that actually have assigned parameters.
 */
export function buildRangeRefForLayers(
  rows: LayerRowGeometry[],
  startBeat: number,
  endBeat: number,
): AutomationRangeRef {
  const layerIds: string[] = [];
  const parameterIdsByLayer: Record<string, string[]> = {};
  for (const row of rows) {
    if (!row.automatable) continue;
    layerIds.push(row.layerId);
    if (row.parameterIds.length > 0) {
      parameterIdsByLayer[row.layerId] = [...row.parameterIds];
    }
  }
  return { startBeat, endBeat, layerIds, parameterIdsByLayer };
}

export function findLayerSnapshot(
  layerGroups: ScoreLayerGroupSnapshot[],
  layerId: string,
): ScoreLayerAutomationSnapshot | undefined {
  for (const group of layerGroups) {
    for (const layer of group.layers) {
      if (layer.layerId === layerId) return layer.automation;
    }
  }
  return undefined;
}

/**
 * Compute live-preview points for a multi-line move/scale over a range ref.
 * `transform` maps one parameter's committed points to its preview points.
 */
export function computeMultiLinePreview(
  layerGroups: ScoreLayerGroupSnapshot[],
  range: AutomationRangeRef,
  transform: (points: AutomationPointSnapshot[]) => AutomationPointSnapshot[],
): Record<string, AutomationPointSnapshot[]> {
  const preview: Record<string, AutomationPointSnapshot[]> = {};
  for (const layerId of range.layerIds) {
    const automation = findLayerSnapshot(layerGroups, layerId);
    if (!automation) continue;
    const wanted = new Set(range.parameterIdsByLayer[layerId] ?? []);
    for (const param of automation.parameters) {
      if (!wanted.has(param.parameterId)) continue;
      preview[param.parameterId] = transform(param.points);
    }
  }
  return preview;
}
