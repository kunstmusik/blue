import { create } from 'zustand';

import type {
  FreezeItemAction,
  FreezeItemStatus,
  FreezeOperationResult,
  RenderOperationPhase,
  RenderOperationStatus,
} from '../../shared/render-freeze-contract';
import type { ScoreObjectClipboardEntry } from './score-selection-store';
import { useProjectStore } from './project-store';

/**
 * Per-object row state for the freeze/unfreeze progress dialog. `cancelled`
 * and `notApplied` are renderer-derived terminal states: the main process
 * reports the overall phase, and rows that never finished are mapped onto
 * them when the operation ends.
 */
export type FreezeRowStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled'
  | 'notApplied';

export interface FreezeOperationRow {
  selectionId: string;
  name: string;
  action: FreezeItemAction;
  freezeFile: string | null;
  status: FreezeRowStatus;
  reason: string | null;
  output: string;
}

/** Maximum characters of Csound output kept per row. Oldest text is trimmed. */
const MAX_ROW_OUTPUT_CHARS = 200_000;

const TERMINAL_PHASES: readonly RenderOperationPhase[] = ['completed', 'cancelled', 'failed'];
const NON_TERMINAL_ROW_STATUS: readonly FreezeRowStatus[] = ['pending', 'running'];

function isTerminalPhase(phase: RenderOperationPhase | null): boolean {
  return phase !== null && TERMINAL_PHASES.includes(phase);
}

function canApplyItemPhase(
  operationPhase: RenderOperationPhase | null,
  itemPhase: FreezeItemStatus['phase'],
): boolean {
  if (!isTerminalPhase(operationPhase)) return true;
  return (operationPhase === 'completed' && itemPhase === 'complete')
    || (operationPhase === 'failed' && itemPhase === 'failed');
}

function appendRowOutput(output: string, append: string): string {
  const combined = output + append.replace(/\r\n?/g, '\n');
  if (combined.length <= MAX_ROW_OUTPUT_CHARS) return combined;
  return combined.slice(combined.length - MAX_ROW_OUTPUT_CHARS);
}

/** Map non-terminal rows onto a terminal row status when the operation ends. */
function settleRows(
  rows: FreezeOperationRow[],
  outcome: 'completed' | 'cancelled' | 'failed',
): FreezeOperationRow[] {
  return rows.map((row) => {
    if (!NON_TERMINAL_ROW_STATUS.includes(row.status)) return row;
    if (outcome === 'completed') return { ...row, status: 'complete' };
    if (outcome === 'cancelled') return { ...row, status: 'cancelled' };
    return { ...row, status: 'notApplied' };
  });
}

function optimisticRows(entries: ScoreObjectClipboardEntry[]): FreezeOperationRow[] {
  const rows: FreezeOperationRow[] = [];
  for (const entry of entries) {
    const target = entry.editorTarget;
    if (!target) continue;
    const frozenBarRenderer = entry.barRenderer?.kind === 'frozenSoundObject'
      ? entry.barRenderer
      : null;
    rows.push({
      selectionId: target.selectionId,
      name: entry.name,
      action: frozenBarRenderer ? 'unfreeze' : 'freeze',
      freezeFile: frozenBarRenderer ? frozenBarRenderer.frozenWaveFileName : null,
      status: 'pending',
      reason: null,
      output: '',
    });
  }
  return rows;
}

export interface FreezeOperationState {
  open: boolean;
  operationId: string | null;
  phase: RenderOperationPhase | null;
  progress: number | null;
  message: string;
  rows: FreezeOperationRow[];
  selectedSelectionId: string | null;
  /** True once the user clicks a row; stops the selection following the running row. */
  selectionLocked: boolean;
  outputExpanded: boolean;
  result: FreezeOperationResult | null;
  error: string | null;
  cancelRequested: boolean;

  start: (entries: ScoreObjectClipboardEntry[]) => Promise<void>;
  handleStatus: (status: RenderOperationStatus) => void;
  handleItemEvent: (event: FreezeItemStatus) => void;
  cancel: () => void;
  close: () => void;
  selectRow: (selectionId: string) => void;
  toggleOutput: () => void;
}

const initialState = {
  open: false,
  operationId: null,
  phase: null,
  progress: null,
  message: '',
  rows: [],
  selectedSelectionId: null,
  selectionLocked: false,
  outputExpanded: false,
  result: null,
  error: null,
  cancelRequested: false,
};

export const useFreezeOperationStore = create<FreezeOperationState>((set, get) => ({
  ...initialState,

  async start(entries) {
    if (get().open && !isTerminalPhase(get().phase)) return;

    const rows = optimisticRows(entries);
    if (rows.length === 0) return;
    const targets = entries
      .map((entry) => entry.editorTarget)
      .filter((target): target is NonNullable<typeof target> => target !== undefined);

    const operationId = `freeze-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set({
      ...initialState,
      open: true,
      operationId,
      phase: 'preparing',
      progress: 0,
      message: `Preparing to freeze/unfreeze ${rows.length} object${rows.length === 1 ? '' : 's'}...`,
      rows,
      selectedSelectionId: rows[0]!.selectionId,
    });

    // IPC replies and status broadcasts use separate Electron queues. The
    // terminal phase set here guards against a late preparing or rendering
    // broadcast reopening settled rows.
    try {
      const flushPendingPatches = useProjectStore.getState().flushPendingPatches;
      if (flushPendingPatches) await flushPendingPatches();
      const current = get();
      if (current.operationId !== operationId) return;
      if (current.cancelRequested) {
        set((state) => {
          if (state.operationId !== operationId || isTerminalPhase(state.phase)) return state;
          return {
            phase: 'cancelled',
            progress: null,
            message: 'Freeze/unfreeze cancelled.',
            rows: settleRows(state.rows, 'cancelled'),
            error: null,
          };
        });
        return;
      }
      const result = await window.blueAPI.freezeScoreObjects({ targets, operationId });
      const outcome: RenderOperationPhase = result.ok
        ? 'completed'
        : result.cancelled
          ? 'cancelled'
          : 'failed';
      set((state) => {
        const rejectedReasons = result.rejectedTargets.map(({ reason }) => reason).join('\n');
        if (state.operationId !== operationId) return state;
        if (isTerminalPhase(state.phase)) {
          return {
            result,
            error: result.ok ? state.error : (rejectedReasons || result.error || state.error),
          };
        }
        return {
          phase: outcome,
          progress: outcome === 'completed' ? 100 : null,
          rows: settleRows(state.rows, outcome),
          result,
          error: result.ok ? null : (rejectedReasons || result.error),
        };
      });
    } catch (error) {
      set((state) => {
        if (state.operationId !== operationId || isTerminalPhase(state.phase)) return state;
        const cancelled = state.cancelRequested;
        return {
          phase: cancelled ? 'cancelled' : 'failed',
          progress: cancelled ? null : state.progress,
          message: cancelled ? 'Freeze/unfreeze cancelled.' : state.message,
          rows: settleRows(state.rows, cancelled ? 'cancelled' : 'failed'),
          error: cancelled ? null : (error instanceof Error ? error.message : String(error)),
        };
      });
    }
  },

  handleStatus(status) {
    set((state) => {
      if (!state.open || state.operationId !== status.operationId) return state;
      if (status.kind !== 'freeze' || isTerminalPhase(state.phase)) return state;
      if (!isTerminalPhase(status.phase)) {
        return { phase: status.phase, progress: status.progress, message: status.message };
      }
      const outcome = status.phase as 'completed' | 'cancelled' | 'failed';
      return {
        phase: outcome,
        progress: outcome === 'completed' ? 100 : state.progress,
        message: status.message,
        rows: settleRows(state.rows, outcome),
        error: outcome === 'failed' ? (status.error ?? status.message) : state.error,
      };
    });
  },

  handleItemEvent(event) {
    set((state) => {
      if (!state.open || state.operationId !== event.operationId) return state;
      const rowIndex = state.rows.findIndex((row) => row.selectionId === event.selectionId);
      if (rowIndex === -1) return state;
      const row = state.rows[rowIndex]!;
      const applyPhase = canApplyItemPhase(state.phase, event.phase);
      const updated: FreezeOperationRow = {
        ...row,
        name: event.name.length > 0 ? event.name : row.name,
        freezeFile: event.freezeFile ?? row.freezeFile,
        status: applyPhase ? event.phase : row.status,
        reason: applyPhase && event.phase === 'failed' ? event.reason : row.reason,
        output: event.outputAppend !== null ? appendRowOutput(row.output, event.outputAppend) : row.output,
      };
      const rows = [...state.rows];
      rows[rowIndex] = updated;
      return {
        rows,
        selectedSelectionId: applyPhase && event.phase === 'running' && !state.selectionLocked
          ? updated.selectionId
          : state.selectedSelectionId,
      };
    });
  },

  cancel() {
    const { operationId, phase, open, cancelRequested } = get();
    if (!open || !operationId || isTerminalPhase(phase) || cancelRequested) return;
    set({ cancelRequested: true });
    void window.blueAPI?.cancelRenderOperation?.({ operationId });
  },

  close() {
    if (!isTerminalPhase(get().phase)) return;
    set({ ...initialState });
  },

  selectRow(selectionId) {
    set((state) => {
      if (!state.rows.some((row) => row.selectionId === selectionId)) return state;
      return { selectedSelectionId: selectionId, selectionLocked: true };
    });
  },

  toggleOutput() {
    set((state) => ({ outputExpanded: !state.outputExpanded }));
  },
}));
