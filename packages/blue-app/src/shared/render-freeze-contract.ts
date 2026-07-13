/**
 * Render and Freeze IPC Contract.
 *
 * Defines the serializable types crossing the main/preload/renderer boundary
 * for Render-to-Disk and Freeze/Unfreeze operations. The renderer supplies
 * user intent and existing score-object target locations; the main process
 * owns settings lookup, project state, dialogs, filesystem access, subprocesses,
 * and canonical mutation.
 */
import type { ProjectEditorSnapshot, ScoreObjectEditorTargetSnapshot } from './project-editor';

// ─── Channels ───

export const RENDER_OPERATION_STATUS_CHANNEL = 'render-operation-status';

// ─── Renderer → Main requests ───

export type DiskRenderAction = 'render' | 'play' | 'open';

export interface RenderToDiskRequest {
  action: DiskRenderAction;
  operationId?: string;
}

export interface FreezeScoreObjectsRequest {
  targets: ScoreObjectEditorTargetSnapshot[];
  operationId?: string;
}

export interface CancelRenderOperationRequest {
  operationId: string;
}

const DISK_RENDER_ACTIONS: readonly DiskRenderAction[] = ['render', 'play', 'open'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Runtime guards for the Electron boundary. TypeScript types do not validate IPC payloads. */
export function isRenderToDiskRequest(value: unknown): value is RenderToDiskRequest {
  return isRecord(value) && typeof value.action === 'string'
    && DISK_RENDER_ACTIONS.includes(value.action as DiskRenderAction)
    && (value.operationId === undefined || (typeof value.operationId === 'string' && value.operationId.length > 0));
}

export function isFreezeScoreObjectsRequest(value: unknown): value is FreezeScoreObjectsRequest {
  return isRecord(value) && Array.isArray(value.targets)
    && value.targets.every((target) => isRecord(target))
    && (value.operationId === undefined || (typeof value.operationId === 'string' && value.operationId.length > 0));
}

export function isCancelRenderOperationRequest(value: unknown): value is CancelRenderOperationRequest {
  return isRecord(value) && typeof value.operationId === 'string' && value.operationId.length > 0;
}

// ─── Main → Renderer status ───

export type RenderOperationKind = 'diskRender' | 'freeze';

export type RenderOperationPhase =
  | 'preparing'
  | 'rendering'
  | 'inspecting'
  | 'committing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface RenderOperationStatus {
  operationId: string;
  kind: RenderOperationKind;
  phase: RenderOperationPhase;
  message: string;
  progress: number | null;
  outputPath: string | null;
  error: string | null;
  /**
   * Originating request action for disk renders (render | play | open).
   * Absent for freeze operations. Lets the renderer distinguish a
   * "Render to Disk and Play" completion from a plain render.
   */
  action?: DiskRenderAction | null;
}

const RENDER_OPERATION_KINDS: readonly RenderOperationKind[] = ['diskRender', 'freeze'];
const RENDER_OPERATION_PHASES: readonly RenderOperationPhase[] = [
  'preparing', 'rendering', 'inspecting', 'committing', 'completed', 'cancelled', 'failed',
];

export function isRenderOperationStatus(value: unknown): value is RenderOperationStatus {
  return isRecord(value)
    && typeof value.operationId === 'string'
    && RENDER_OPERATION_KINDS.includes(value.kind as RenderOperationKind)
    && RENDER_OPERATION_PHASES.includes(value.phase as RenderOperationPhase)
    && typeof value.message === 'string'
    && (value.progress === null || typeof value.progress === 'number')
    && (value.outputPath === null || typeof value.outputPath === 'string')
    && (value.error === null || typeof value.error === 'string')
    && (value.action === undefined || value.action === null
      || (typeof value.action === 'string'
        && DISK_RENDER_ACTIONS.includes(value.action as DiskRenderAction)));
}

// ─── Results ───

export interface RenderOperationResult {
  ok: boolean;
  operationId: string;
  cancelled: boolean;
  outputPath: string | null;
  error: string | null;
}

export interface FreezeRejectedTarget {
  selectionId: string;
  reason: string;
}

export interface FreezeOperationResult {
  ok: boolean;
  operationId: string;
  cancelled: boolean;
  frozenCount: number;
  unfrozenCount: number;
  deletedFiles: string[];
  rejectedTargets: FreezeRejectedTarget[];
  error: string | null;
  project: ProjectEditorSnapshot | null;
}

// ─── Operation lifecycle invariants ───

/**
 * Only one disk/freeze operation is active at a time. The main process
 * rejects or queues concurrent requests behind the single active operation.
 */
export const SINGLE_ACTIVE_OPERATION = true;

/**
 * The renderer MUST NOT send an executable path, arbitrary output path for
 * Freeze, raw XML, or a prebuilt command. The main process resolves all
 * settings, paths, and commands from canonical sources.
 */
export const MAIN_OWNS_EXECUTABLE_AND_PATH = true;

// ─── Status factory ───

export function createStatus(
  operationId: string,
  kind: RenderOperationKind,
  phase: RenderOperationPhase,
  message: string,
  overrides?: Partial<Omit<RenderOperationStatus, 'operationId' | 'kind' | 'phase' | 'message'>>,
): RenderOperationStatus {
  return {
    operationId,
    kind,
    phase,
    message,
    progress: overrides?.progress ?? null,
    outputPath: overrides?.outputPath ?? null,
    error: overrides?.error ?? null,
    action: overrides?.action ?? null,
  };
}
