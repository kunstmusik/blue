import { create } from 'zustand';

import type {
  DiskRenderAction,
  RenderOperationPhase,
  RenderOperationStatus,
} from '../../shared/render-freeze-contract';

/** Output-panel tab that main resets and streams disk-render Csound output to. */
export const DISK_RENDER_OUTPUT_TAB = 'Csound (Disk)';

const TERMINAL_PHASES: readonly RenderOperationPhase[] = ['completed', 'cancelled', 'failed'];

function isTerminalPhase(phase: RenderOperationPhase | null): boolean {
  return phase !== null && TERMINAL_PHASES.includes(phase);
}

/**
 * Tracks the disk-render operation for the progress dialog. Disk renders are
 * started by the native application menu in the main process; the renderer
 * never invokes renderToDisk, so the store is driven purely by the status
 * broadcasts and the operationId is main-generated.
 */
export interface RenderToDiskState {
  open: boolean;
  operationId: string | null;
  phase: RenderOperationPhase | null;
  progress: number | null;
  message: string;
  outputPath: string | null;
  action: DiskRenderAction | null;
  error: string | null;
  outputExpanded: boolean;
  cancelRequested: boolean;

  handleStatus: (status: RenderOperationStatus) => void;
  cancel: () => void;
  close: () => void;
  toggleOutput: () => void;
}

const initialState = {
  open: false,
  operationId: null,
  phase: null,
  progress: null,
  message: '',
  outputPath: null,
  action: null,
  error: null,
  outputExpanded: false,
  cancelRequested: false,
};

function openStateFromStatus(status: RenderOperationStatus) {
  return {
    ...initialState,
    open: true,
    operationId: status.operationId,
    phase: status.phase,
    progress: status.progress,
    message: status.message,
    outputPath: status.outputPath,
    action: status.action ?? null,
  };
}

export const useRenderToDiskStore = create<RenderToDiskState>((set, get) => ({
  ...initialState,

  handleStatus(status) {
    set((state) => {
      if (status.kind !== 'diskRender') return state;

      if (!state.open) {
        // Open on the first non-terminal status, and only in the main
        // workbench window: Dockview popout windows are created via
        // window.open and also receive the broadcast, but the modal for the
        // menu-initiated render belongs to the main window. Popouts carry a
        // window.opener reference; the main window's is null/undefined.
        const isPopoutWindow = window.opener !== null && window.opener !== undefined;
        if (isTerminalPhase(status.phase) || isPopoutWindow) return state;
        return openStateFromStatus(status);
      }

      if (state.operationId !== status.operationId) {
        // A new render may start while the previous terminal dialog is still
        // open. Replace that settled state with the new non-terminal render,
        // while continuing to reject stale events from older operations.
        if (!isTerminalPhase(state.phase) || isTerminalPhase(status.phase)) return state;
        return openStateFromStatus(status);
      }
      // Ignore late non-terminal broadcasts once terminal, but keep accepting
      // terminal transitions: a failing external "Open" command is broadcast
      // as failed after the render itself already completed.
      if (isTerminalPhase(state.phase) && !isTerminalPhase(status.phase)) return state;
      return {
        phase: status.phase,
        progress: status.phase === 'completed' ? 100 : status.progress,
        message: status.message,
        outputPath: status.outputPath ?? state.outputPath,
        action: status.action ?? state.action,
        error: status.phase === 'failed' ? (status.error ?? status.message) : state.error,
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

  toggleOutput() {
    set((state) => ({ outputExpanded: !state.outputExpanded }));
  },
}));
