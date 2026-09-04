import { create } from 'zustand';
import type { BlueLiveNoteTarget } from '../../shared/project-editor';

/**
 * Spec 067 — transient realtime MIDI routing mode.
 *
 * - `focus`: new app-session default. New note-ons target the last explicitly
 *   focused eligible Track or Orchestra assignment.
 * - `channel`: pre-Spec-067 compatibility / multi-timbral path. Each event resolves
 *   to its own input channel (hardware native channel or Virtual Keyboard selection).
 */
export type MidiRoutingMode = 'focus' | 'channel';

/**
 * Stable identity for a focused Track. `projectSessionId` fences the focus to the
 * renderer project session in which it was set; `rootGroupId`/`trackId` are stable
 * project identities. `displayName` is informational only.
 */
export interface TrackFocusTarget {
  kind: 'track';
  projectSessionId: number;
  rootGroupId: string;
  trackId: string;
  displayName: string;
}

/**
 * Stable identity for a focused Orchestra assignment. `assignmentId` is the stable
 * project Orchestra-assignment identity (backed by the domain arrangement id).
 */
export interface OrchestraFocusTarget {
  kind: 'orchestra';
  projectSessionId: number;
  assignmentId: string;
  displayName: string;
}

export type FocusedMidiTarget = TrackFocusTarget | OrchestraFocusTarget;

/**
 * Reconciliation input derived from the current project snapshot. The store never
 * imports project-editor types directly to avoid a renderer/store → shared cycle
 * for the heavy snapshot union; callers pass only the minimal identity metadata.
 */
export interface TrackReconciliationEntry {
  projectSessionId: number;
  rootGroupId: string;
  trackId: string;
  displayName: string;
}

export interface OrchestraReconciliationEntry {
  projectSessionId: number;
  assignmentId: string;
  displayName: string;
}

export interface MidiRoutingReconciliation {
  projectSessionId: number;
  tracks: readonly TrackReconciliationEntry[];
  orchestra: readonly OrchestraReconciliationEntry[];
}

export interface MidiRoutingState {
  mode: MidiRoutingMode;
  focusedTarget: FocusedMidiTarget | null;
  /** Increments whenever the focus target identity changes; stable across display refresh. */
  focusRevision: number;

  setMode: (mode: MidiRoutingMode) => void;
  focusTrack: (target: Omit<TrackFocusTarget, 'kind'>) => void;
  focusOrchestra: (target: Omit<OrchestraFocusTarget, 'kind'>) => void;
  /**
   * Clear focus. When `projectSessionId` is supplied, focus is cleared only if its
   * stored session matches — used by project-replacement fencing.
   */
  clearFocusForProjectSession: (projectSessionId?: number) => void;
  /**
   * Reconcile the current focus against a fresh snapshot: refresh display metadata
   * for a matching stable identity, clear focus whose identity is missing, and clear
   * focus on session mismatch. Blue Live restart callers pass the same session.
   */
  reconcileFocus: (reconciliation: MidiRoutingReconciliation) => void;
  /**
   * Resolve the routing target for a new note-on. In channel mode (or focus mode
   * with no current-session target) the channel target is returned for direct-channel
   * compatibility; in focus mode with a current-session target the focused identity
   * is returned. Returns `null` to fail closed (no fallback).
   */
  resolveTargetForNote: (channel: number) => BlueLiveNoteTarget | null;
}

const INITIAL_FOCUS_REVISION = 0;

export const useMidiRoutingStore = create<MidiRoutingState>((set, get) => ({
  mode: 'focus',
  focusedTarget: null,
  focusRevision: INITIAL_FOCUS_REVISION,

  setMode: (mode) => {
    set({ mode });
  },

  focusTrack: (target) => {
    set((state) => ({
      focusedTarget: { kind: 'track', ...target },
      mode: state.mode === 'channel' ? state.mode : 'focus',
      focusRevision: state.focusRevision + 1,
    }));
  },

  focusOrchestra: (target) => {
    set((state) => ({
      focusedTarget: { kind: 'orchestra', ...target },
      mode: state.mode === 'channel' ? state.mode : 'focus',
      focusRevision: state.focusRevision + 1,
    }));
  },

  clearFocusForProjectSession: (projectSessionId) => {
    set((state) => {
      if (projectSessionId !== undefined) {
        const current = state.focusedTarget;
        if (current && current.projectSessionId !== projectSessionId) {
          return state;
        }
      }
      if (state.focusedTarget === null) return state;
      return { focusedTarget: null, focusRevision: state.focusRevision + 1 };
    });
  },

  reconcileFocus: (reconciliation) => {
    set((state) => {
      const current = state.focusedTarget;
      if (!current) return state;
      // Session mismatch always clears focus.
      if (current.projectSessionId !== reconciliation.projectSessionId) {
        return { focusedTarget: null, focusRevision: state.focusRevision + 1 };
      }
      if (current.kind === 'track') {
        const match = reconciliation.tracks.find(
          (entry) => entry.rootGroupId === current.rootGroupId && entry.trackId === current.trackId,
        );
        if (!match) {
          return { focusedTarget: null, focusRevision: state.focusRevision + 1 };
        }
        if (match.displayName !== current.displayName) {
          return {
            focusedTarget: { ...current, displayName: match.displayName },
            focusRevision: state.focusRevision + 1,
          };
        }
        return state;
      }
      const match = reconciliation.orchestra.find(
        (entry) => entry.assignmentId === current.assignmentId,
      );
      if (!match) {
        return { focusedTarget: null, focusRevision: state.focusRevision + 1 };
      }
      if (match.displayName !== current.displayName) {
        return {
          focusedTarget: { ...current, displayName: match.displayName },
          focusRevision: state.focusRevision + 1,
        };
      }
      return state;
    });
  },

  resolveTargetForNote: (channel) => {
    const { mode, focusedTarget } = get();
    if (mode === 'channel') {
      return { kind: 'channel', channel };
    }
    if (!focusedTarget) {
      return null;
    }
    if (focusedTarget.kind === 'track') {
      return { kind: 'track', trackId: focusedTarget.trackId };
    }
    return { kind: 'orchestra', assignmentId: focusedTarget.assignmentId };
  },
}));
