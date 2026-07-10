/**
 * Internal application contract shared by Electron main, preload, and workbench
 * renderers for Java Blue/NetBeans-style window Float/Dock parity (SPEC 055).
 *
 * Browser-safe: no Node or Electron built-ins. Type-only imports keep runtime
 * dependencies out of renderer bundles. Channel-name constants are centralized
 * here so main, preload, and renderer cannot drift apart.
 *
 * See:
 *   specs/055-window-float-dock-parity/contracts/workbench-window-ipc.md
 *   specs/055-window-float-dock-parity/data-model.md
 */

import type { ProjectEditorSnapshot } from './project-editor';

/* -------------------------------------------------------------------------- */
/* Primitive unions                                                           */
/* -------------------------------------------------------------------------- */

export type WorkbenchWindowRole = 'main' | 'floating';
export type WorkbenchAuxiliaryEdge = 'left' | 'right' | 'bottom';
export type WorkbenchPresentation =
  | 'docked'
  | 'floating'
  | 'minimized'
  | 'slideout'
  | 'maximized';
export type WorkbenchRevealSource = 'window-menu' | 'shortcut' | 'programmatic';
export type WorkbenchCloseSource =
  | 'window-close'
  | 'tab-close'
  | 'reset-windows'
  | 'dock';
export type WorkbenchPanelMode = 'editor' | 'properties' | 'output' | 'repl';
export type WorkbenchRestoreDirection = 'left' | 'right' | 'above' | 'below';
export type WorkbenchWindowDisplayState = 'normal' | 'maximized' | 'fullscreen';

export interface FloatingWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WorkAreaRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/* -------------------------------------------------------------------------- */
/* Data-model entities (data-model.md)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Remembers where a floating group should return when Dock is invoked. Mirrors
 * NetBeans previous-mode/index behavior with Blue-specific auxiliary state.
 */
export interface DockingOrigin {
  originGroupId?: string;
  originPanelOrder: string[];
  originActivePanelId?: string;
  originMode: WorkbenchPanelMode;
  originIndex?: number;
  /**
   * A neighboring editor group used to recreate a single-tab split after its
   * original Dockview group was removed by close.
   */
  restoreReferenceGroupId?: string;
  restoreDirection?: WorkbenchRestoreDirection;
  auxiliarySeedGroupId?: 'properties-main' | 'output-main';
  auxiliaryGroupInstanceId?: string;
  edge?: WorkbenchAuxiliaryEdge;
  presentation: WorkbenchPresentation;
  dockedSize?: number;
  slideoutSize?: number;
  capturedAt?: string;
}

/**
 * Snapshot of a separate OS-level window hosting a floating workbench tab group.
 */
export interface FloatingWorkbenchWindow {
  windowId: string;
  popoutGroupId: string;
  panelIds: string[];
  activePanelId?: string;
  bounds: FloatingWindowBounds;
  displayState?: WorkbenchWindowDisplayState;
  projectSessionId?: number;
}

/* -------------------------------------------------------------------------- */
/* IPC channel constants                                                      */
/* -------------------------------------------------------------------------- */

export const WORKBENCH_WINDOW_REGISTER_CHANNEL = 'workbench-window:register';
export const WORKBENCH_WINDOW_UPDATE_OWNERSHIP_CHANNEL =
  'workbench-window:update-ownership';
export const WORKBENCH_WINDOW_REVEAL_PANEL_CHANNEL =
  'workbench-window:reveal-panel';
export const WORKBENCH_WINDOW_REQUEST_CLOSE_CHANNEL =
  'workbench-window:request-close';
export const WORKBENCH_WINDOW_DOCK_GROUP_CHANNEL =
  'workbench-window:dock-group';
export const PROJECT_DOCUMENT_UPDATED_CHANNEL = 'project-document-updated';

/* -------------------------------------------------------------------------- */
/* IPC message types (workbench-window-ipc.md)                                */
/* -------------------------------------------------------------------------- */

export interface WorkbenchWindowRegisterRequest {
  role: WorkbenchWindowRole;
  popoutGroupId?: string;
  projectSessionId?: number;
}

export interface WorkbenchWindowRegisterResponse {
  windowId: string;
}

export interface WorkbenchWindowOwnershipUpdate {
  windowId: string;
  role: WorkbenchWindowRole;
  popoutGroupId?: string;
  panelIds: string[];
  activePanelId?: string;
  projectSessionId?: number;
}

export interface WorkbenchRevealPanelRequest {
  panelId: string;
  source: WorkbenchRevealSource;
}

export interface WorkbenchRevealPanelResult {
  handled: boolean;
  focusedWindowId?: string;
  openedInDefaultMode?: boolean;
}

export interface WorkbenchWindowCloseRequest {
  windowId: string;
  popoutGroupId?: string;
  panelIds: string[];
  source: WorkbenchCloseSource;
}

export interface WorkbenchWindowCloseResult {
  allowed: boolean;
  blockedPanelIds?: string[];
  requiresPrompt?: boolean;
}

export interface DockFloatingGroupRequest {
  popoutGroupId: string;
  requestedPanelId: string;
}

export interface DockFloatingGroupResult {
  docked: boolean;
  fallbackUsed?: boolean;
  skippedPanelIds?: string[];
}

export interface ProjectDocumentUpdatedEvent {
  sessionId: number;
  revision: number;
  snapshot: ProjectEditorSnapshot;
  sourceWindowId?: string;
}

/* -------------------------------------------------------------------------- */
/* Validation helpers (browser-safe, pure)                                    */
/* -------------------------------------------------------------------------- */

const EDGE_VALUES: readonly WorkbenchAuxiliaryEdge[] = [
  'left',
  'right',
  'bottom',
];
const PRESENTATION_VALUES: readonly WorkbenchPresentation[] = [
  'docked',
  'floating',
  'minimized',
  'slideout',
  'maximized',
];
const MODE_VALUES: readonly WorkbenchPanelMode[] = [
  'editor',
  'properties',
  'output',
  'repl',
];
const RESTORE_DIRECTION_VALUES: readonly WorkbenchRestoreDirection[] = [
  'left',
  'right',
  'above',
  'below',
];

export const DEFAULT_FLOATING_WINDOW_MINIMUM_SIZE = 160;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return (
    typeof value === 'string' && (allowed as readonly string[]).includes(value)
  );
}

/**
 * Returns true when `candidate` is a structurally valid {@link DockingOrigin}.
 * Required fields are `originMode`, `presentation`, and a string-array
 * `originPanelOrder`; all optional fields are type-checked when present.
 */
export function isValidDockingOrigin(
  candidate: unknown,
): candidate is DockingOrigin {
  if (!candidate || typeof candidate !== 'object') return false;
  const c = candidate as Partial<DockingOrigin>;
  if (!isOneOf(c.originMode, MODE_VALUES)) return false;
  if (!isOneOf(c.presentation, PRESENTATION_VALUES)) return false;
  if (!isStringArray(c.originPanelOrder)) return false;
  if (c.originGroupId !== undefined && typeof c.originGroupId !== 'string') {
    return false;
  }
  if (
    c.originActivePanelId !== undefined &&
    typeof c.originActivePanelId !== 'string'
  ) {
    return false;
  }
  if (c.originIndex !== undefined && !isFiniteNumber(c.originIndex))
    return false;
  if (
    c.restoreReferenceGroupId !== undefined &&
    typeof c.restoreReferenceGroupId !== 'string'
  ) {
    return false;
  }
  if (
    c.restoreDirection !== undefined &&
    !isOneOf(c.restoreDirection, RESTORE_DIRECTION_VALUES)
  ) {
    return false;
  }
  if (
    c.auxiliarySeedGroupId !== undefined &&
    c.auxiliarySeedGroupId !== 'properties-main' &&
    c.auxiliarySeedGroupId !== 'output-main'
  ) {
    return false;
  }
  if (
    c.auxiliaryGroupInstanceId !== undefined &&
    typeof c.auxiliaryGroupInstanceId !== 'string'
  ) {
    return false;
  }
  if (c.edge !== undefined && !isOneOf(c.edge, EDGE_VALUES)) return false;
  if (c.dockedSize !== undefined && !isFiniteNumber(c.dockedSize)) return false;
  if (c.slideoutSize !== undefined && !isFiniteNumber(c.slideoutSize)) {
    return false;
  }
  if (c.capturedAt !== undefined && typeof c.capturedAt !== 'string')
    return false;
  return true;
}

/**
 * Normalizes an unknown persisted value into a clean `popoutGroupId -> DockingOrigin`
 * map, dropping any entries that fail {@link isValidDockingOrigin}.
 */
export function normalizeFloatingOriginMap(
  candidate: unknown,
): Record<string, DockingOrigin> {
  const result: Record<string, DockingOrigin> = {};
  if (!candidate || typeof candidate !== 'object') return result;
  for (const [key, value] of Object.entries(
    candidate as Record<string, unknown>,
  )) {
    if (isValidDockingOrigin(value)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Returns true when `bounds` describe a finite, positive rectangle that
 * intersects at least one provided work area. When no work areas are supplied
 * the check is skipped (assumed visible) so callers without display info are
 * not blocked.
 */
export function isOnScreenBounds(
  bounds: FloatingWindowBounds,
  workAreas: readonly WorkAreaRect[],
): boolean {
  if (!Array.isArray(workAreas) || workAreas.length === 0) return true;
  return workAreas.some((area) => rectanglesIntersect(bounds, area));
}

function rectanglesIntersect(a: WorkAreaRect, b: WorkAreaRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Ensures floating window bounds are finite, meet the minimum size, and land on
 * an available display. Bounds already intersecting a work area are kept (only
 * the size floor is enforced). Otherwise the window is snapped to the top-left
 * of the first available work area.
 */
export function correctOffscreenBounds(
  bounds: Partial<FloatingWindowBounds>,
  workAreas: readonly WorkAreaRect[],
  options: { minimumSize?: number } = {},
): FloatingWindowBounds {
  const minimum = options.minimumSize ?? DEFAULT_FLOATING_WINDOW_MINIMUM_SIZE;
  const width = Math.max(
    isFiniteNumber(bounds.width) ? bounds.width : minimum,
    minimum,
  );
  const height = Math.max(
    isFiniteNumber(bounds.height) ? bounds.height : minimum,
    minimum,
  );

  if (!Array.isArray(workAreas) || workAreas.length === 0) {
    return {
      x: isFiniteNumber(bounds.x) ? bounds.x : 0,
      y: isFiniteNumber(bounds.y) ? bounds.y : 0,
      width,
      height,
    };
  }

  const baseX = isFiniteNumber(bounds.x) ? bounds.x : workAreas[0].x;
  const baseY = isFiniteNumber(bounds.y) ? bounds.y : workAreas[0].y;

  if (
    workAreas.some((area) =>
      rectanglesIntersect({ x: baseX, y: baseY, width, height }, area),
    )
  ) {
    return { x: baseX, y: baseY, width, height };
  }

  const target = workAreas[0];
  return { x: target.x, y: target.y, width, height };
}
