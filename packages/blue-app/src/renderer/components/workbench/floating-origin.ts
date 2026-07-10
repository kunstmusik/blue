/**
 * Pure helpers for capturing and resolving floating-group dock-back origins
 * (SPEC 055 US1/US2). These operate on plain data so they are unit-testable
 * without Dockview or Electron.
 *
 * See:
 *   specs/055-window-float-dock-parity/data-model.md (DockingOrigin)
 */

import {
  correctOffscreenBounds,
  isValidDockingOrigin,
  type DockingOrigin,
  type WorkAreaRect,
  type WorkbenchAuxiliaryEdge,
  type WorkbenchPanelMode,
  type WorkbenchPresentation,
} from '../../../shared/workbench-window-contract';

export interface CaptureDockingOriginInput {
  groupId?: string;
  panelIds: string[];
  activePanelId?: string;
  mode: WorkbenchPanelMode;
  originIndex?: number;
  restoreReferenceGroupId?: string;
  restoreDirection?: 'left' | 'right' | 'above' | 'below';
  auxiliarySeedGroupId?: 'properties-main' | 'output-main';
  auxiliaryGroupInstanceId?: string;
  edge?: WorkbenchAuxiliaryEdge;
  presentation: WorkbenchPresentation;
  dockedSize?: number;
  slideoutSize?: number;
  capturedAt?: string;
}

/**
 * Snapshots a tab group's origin state at float time. Always returns a valid
 * {@link DockingOrigin} (required fields are `originMode`, `presentation`, and a
 * non-empty `originPanelOrder`).
 */
export function captureDockingOrigin(
  input: CaptureDockingOriginInput,
): DockingOrigin {
  const origin: DockingOrigin = {
    originMode: input.mode,
    presentation: input.presentation,
    originPanelOrder: [...input.panelIds],
    ...(input.groupId !== undefined ? { originGroupId: input.groupId } : {}),
    ...(input.activePanelId !== undefined
      ? { originActivePanelId: input.activePanelId }
      : {}),
    ...(input.originIndex !== undefined
      ? { originIndex: input.originIndex }
      : {}),
    ...(input.restoreReferenceGroupId !== undefined
      ? { restoreReferenceGroupId: input.restoreReferenceGroupId }
      : {}),
    ...(input.restoreDirection !== undefined
      ? { restoreDirection: input.restoreDirection }
      : {}),
    ...(input.auxiliarySeedGroupId !== undefined
      ? { auxiliarySeedGroupId: input.auxiliarySeedGroupId }
      : {}),
    ...(input.auxiliaryGroupInstanceId !== undefined
      ? { auxiliaryGroupInstanceId: input.auxiliaryGroupInstanceId }
      : {}),
    ...(input.edge !== undefined ? { edge: input.edge } : {}),
    ...(input.dockedSize !== undefined ? { dockedSize: input.dockedSize } : {}),
    ...(input.slideoutSize !== undefined
      ? { slideoutSize: input.slideoutSize }
      : {}),
    ...(input.capturedAt !== undefined ? { capturedAt: input.capturedAt } : {}),
  };
  return origin;
}

/**
 * Returns a new origins map with `popoutGroupId` set to `origin`.
 */
export function recordFloatingOrigin(
  origins: Record<string, DockingOrigin>,
  popoutGroupId: string,
  origin: DockingOrigin,
): Record<string, DockingOrigin> {
  return { ...origins, [popoutGroupId]: origin };
}

/**
 * Returns a new origins map with `popoutGroupId` removed.
 */
export function removeFloatingOrigin(
  origins: Record<string, DockingOrigin>,
  popoutGroupId: string,
): Record<string, DockingOrigin> {
  if (!(popoutGroupId in origins)) return origins;
  const next = { ...origins };
  delete next[popoutGroupId];
  return next;
}

export interface DockTargetResolution {
  popoutGroupId: string;
  origin: DockingOrigin | undefined;
  /**
   * Default mode to use when the origin is missing or invalid. Defaults to the
   * origin mode when present, otherwise 'editor'.
   */
  fallbackMode: WorkbenchPanelMode;
  /**
   * Subset of the origin panel ids that still exist in the registry. Panels no
   * longer in the registry are skipped during restore.
   */
  validPanelIds: string[];
}

/**
 * Resolves where a floating group should dock back to. Prefers the stored
 * origin; falls back to the origin mode (or 'editor') when the origin is
 * missing/invalid. Panels absent from the current registry are skipped.
 */
export function resolveDockTarget(
  origins: Record<string, DockingOrigin>,
  popoutGroupId: string,
  knownPanelIds: ReadonlySet<string>,
): DockTargetResolution {
  const rawOrigin = origins[popoutGroupId];
  const origin =
    rawOrigin && isValidDockingOrigin(rawOrigin) ? rawOrigin : undefined;
  const fallbackMode: WorkbenchPanelMode = origin?.originMode ?? 'editor';
  const validPanelIds = origin
    ? origin.originPanelOrder.filter((id) => knownPanelIds.has(id))
    : [];
  return { popoutGroupId, origin, fallbackMode, validPanelIds };
}

/**
 * Walks a serialized Dockview layout and returns a new one whose popout-group
 * positions are finite and on-screen. Used on restore (SPEC 055 US4, FR-022) so
 * a saved floating window that lands outside every currently-connected display
 * is snapped back onto an available work area instead of opening offscreen.
 *
 * Pure: accepts and returns plain JSON-compatible data.
 */
export function clampPopoutBounds<T extends Record<string, unknown>>(
  dockviewJson: T,
  workAreas: readonly WorkAreaRect[],
): T {
  if (!dockviewJson || typeof dockviewJson !== 'object') return dockviewJson;
  const popoutGroups = (dockviewJson as { popoutGroups?: unknown })
    .popoutGroups;
  if (!Array.isArray(popoutGroups)) return dockviewJson;

  const correctedGroups = popoutGroups.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const position = (entry as { position?: unknown }).position;
    if (!position || typeof position !== 'object') return entry;
    const p = position as {
      left?: unknown;
      top?: unknown;
      width?: unknown;
      height?: unknown;
    };
    const fixed = correctOffscreenBounds(
      {
        x: typeof p.left === 'number' ? p.left : 0,
        y: typeof p.top === 'number' ? p.top : 0,
        width: typeof p.width === 'number' ? p.width : 0,
        height: typeof p.height === 'number' ? p.height : 0,
      },
      workAreas,
    );
    return {
      ...entry,
      position: {
        left: fixed.x,
        top: fixed.y,
        width: fixed.width,
        height: fixed.height,
      },
    };
  });

  return { ...dockviewJson, popoutGroups: correctedGroups };
}
