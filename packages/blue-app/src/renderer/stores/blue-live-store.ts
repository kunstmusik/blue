import { create } from 'zustand';
import type { BlueLiveStatus, BlueLiveStatusSnapshot } from '../types/global';

/**
 * Transient Manual Trigger feedback. This mirrors runtime-only status from the
 * main-owned trigger controller and never changes persistent enabled flags,
 * saved sets, or `.blue` XML.
 */
export interface BlueLiveTriggerFeedback {
  status: 'idle' | 'busy' | 'submitted' | 'empty' | 'error';
  message: string;
  /** Monotonic token so stale async completions do not overwrite newer feedback. */
  token: number;
}

interface BlueLiveState {
  status: BlueLiveStatus;
  running: boolean;
  message: string;
  sessionId: number;
  projectRevision: number | null;
  initialized: boolean;
  trigger: BlueLiveTriggerFeedback;
}

interface BlueLiveActions {
  setStatusFromSnapshot: (snapshot: BlueLiveStatusSnapshot) => void;
  reset: () => void;
  setTriggerBusy: () => void;
  setTriggerResult: (status: Omit<BlueLiveTriggerFeedback, 'token'>) => void;
  clearTrigger: () => void;
}

type BlueLiveStore = BlueLiveState & BlueLiveActions;

const initialTrigger: BlueLiveTriggerFeedback = {
  status: 'idle',
  message: '',
  token: 0,
};

const initialState: BlueLiveState = {
  status: 'idle',
  running: false,
  message: '',
  sessionId: 0,
  projectRevision: null,
  initialized: false,
  trigger: initialTrigger,
};

let triggerTokenCounter = 0;

export const useBlueLiveStore = create<BlueLiveStore>((set) => ({
  ...initialState,

  setStatusFromSnapshot: (snapshot) =>
    set({
      status: snapshot.status,
      running: snapshot.running,
      message: snapshot.message ?? '',
      sessionId: snapshot.sessionId,
      projectRevision: snapshot.projectRevision ?? null,
      initialized: true,
    }),

  reset: () => set(initialState),

  setTriggerBusy: () =>
    set(() => ({
      trigger: {
        status: 'busy',
        message: '',
        token: ++triggerTokenCounter,
      },
    })),

  setTriggerResult: (result) =>
    set(() => ({
      trigger: {
        ...result,
        token: ++triggerTokenCounter,
      },
    })),

  clearTrigger: () =>
    set(() => ({
      trigger: { ...initialTrigger, token: ++triggerTokenCounter },
    })),
}));
