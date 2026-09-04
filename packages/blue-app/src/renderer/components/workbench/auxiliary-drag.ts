import type { AuxiliaryEdge } from './auxiliary-layout';

export interface AuxiliaryDragBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface AuxiliaryDragPoint {
  x: number;
  y: number;
}

export const AUXILIARY_EDGE_DRAG_THRESHOLD = 96;
const AUXILIARY_EDGE_INFERENCE_THRESHOLD = 24;

function isAuxiliaryEdge(value: string | undefined): value is AuxiliaryEdge {
  return value === 'left' || value === 'right' || value === 'bottom';
}

function pickClosestAuxiliaryEdge(
  candidates: Array<{ edge: AuxiliaryEdge; distance: number }>,
  threshold: number,
): AuxiliaryEdge | undefined {
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.distance <= threshold ? candidates[0].edge : undefined;
}

export function getAuxiliaryEdgeDropTarget(
  bounds: AuxiliaryDragBounds,
  point: AuxiliaryDragPoint,
  threshold = AUXILIARY_EDGE_DRAG_THRESHOLD,
): AuxiliaryEdge | undefined {
  const withinVertical = point.y >= bounds.top - threshold && point.y <= bounds.bottom + threshold;
  const withinHorizontal =
    point.x >= bounds.left - threshold && point.x <= bounds.right + threshold;

  const candidates: Array<{ edge: AuxiliaryEdge; distance: number }> = [];

  if (withinVertical && point.x <= bounds.left + threshold) {
    candidates.push({
      edge: 'left',
      distance: Math.abs(point.x - bounds.left),
    });
  }

  if (withinVertical && point.x >= bounds.right - threshold) {
    candidates.push({
      edge: 'right',
      distance: Math.abs(bounds.right - point.x),
    });
  }

  if (withinHorizontal && point.y >= bounds.bottom - threshold) {
    candidates.push({
      edge: 'bottom',
      distance: Math.abs(bounds.bottom - point.y),
    });
  }

  return pickClosestAuxiliaryEdge(candidates, threshold);
}

export function getAuxiliaryEdgeFromBounds(
  containerBounds: AuxiliaryDragBounds,
  targetBounds: AuxiliaryDragBounds,
  threshold = AUXILIARY_EDGE_INFERENCE_THRESHOLD,
): AuxiliaryEdge | undefined {
  return pickClosestAuxiliaryEdge(
    [
      {
        edge: 'left',
        distance: Math.abs(targetBounds.left - containerBounds.left),
      },
      {
        edge: 'right',
        distance: Math.abs(containerBounds.right - targetBounds.right),
      },
      {
        edge: 'bottom',
        distance: Math.abs(containerBounds.bottom - targetBounds.bottom),
      },
    ],
    threshold,
  );
}

export function getAuxiliaryEdgeFromGroupElement(
  groupElement: HTMLElement | null | undefined,
): AuxiliaryEdge | undefined {
  if (!groupElement) {
    return undefined;
  }

  const edge = groupElement.dataset.auxEdge;
  return isAuxiliaryEdge(edge) ? edge : undefined;
}
