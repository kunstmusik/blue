import { create } from 'zustand';
import type {
  PlaybackClockSnapshot,
  ToolbarProjectTransportSnapshot,
} from '../../shared/project-editor';
import type { ProgramSettingsSnapshot } from '../../shared/program-settings';
import { useProjectStore } from './project-store';

export type PlaybackStatus = 'idle' | 'starting' | 'playing' | 'stopping' | 'stopped' | 'error';

export type PlaybackClockSource = 'idle-anchor' | 'engine-authority' | 'interpolated';

export interface PlaybackClockState {
  sessionId: number;
  sampleFrames: number;
  sequence: number;
  sampleRate: number | null;
  ksmps: number | null;
  receivedAtMs: number;
}

export interface PlaybackDisplayState {
  sampleFrames: number;
  elapsedSeconds: number;
  source: PlaybackClockSource;
}

export type PlaybackTransportAnchor = ToolbarProjectTransportSnapshot;

interface PlaybackState {
  isPlaying: boolean;
  isAuditioning: boolean;
  status: PlaybackStatus;
  message: string;
  /** Active follow state for the current playback session (may be suspended). */
  followPlayback: boolean;
  /** Hydrated durable preference; restores active state when a session ends. */
  savedFollowPlayback: boolean;
  followPlaybackOnStart: boolean;
  latencyCorrection: number;
  clock: PlaybackClockState | null;
  display: PlaybackDisplayState;
  transportAnchor: PlaybackTransportAnchor | null;
}

interface PlaybackActions {
  togglePlay: () => Promise<void>;
  startFresh: () => Promise<void>;
  auditionScoreObjects: (objectIds: string[]) => Promise<void>;
  stopAuditioning: () => Promise<void>;
  stop: () => Promise<void>;
  setPlaying: (playing: boolean) => void;
  setStatus: (info: {
    status: string;
    message?: string;
    renderStartTime?: number;
    auditioning?: boolean;
  }) => void;
  setError: (error: string) => void;
  acceptPlaybackClock: (snapshot: PlaybackClockSnapshot) => void;
  /** Explicit user toggle (toolbar, native menu, `F`): persists immediately. */
  toggleFollowPlayback: () => void;
  /** Explicit user action: updates active + saved follow and persists it. */
  setFollowPlaybackEnabled: (enabled: boolean) => void;
  /**
   * Main-originated resolved follow value (native menu / settings window).
   * Applies active + saved state without persisting again; main already wrote
   * the durable preference before sending the command.
   */
  applyResolvedFollowPlayback: (enabled: boolean) => void;
  /**
   * Session-only suspension from manual horizontal navigation. Never touches
   * the durable preference; mirrors the active state to the native menu.
   */
  suspendFollowForSession: () => void;
  /** Ends the session's follow override: active state returns to the saved value. */
  restoreFollowFromSaved: () => void;
  /** Explicit user toggle of the follow-on-start preference; persists it. */
  toggleFollowPlaybackOnStart: () => void;
  /** Main-originated resolved on-start value; does not persist again. */
  applyResolvedFollowPlaybackOnStart: (enabled: boolean) => void;
  hydrateFromProgramSettings: (settings: ProgramSettingsSnapshot) => void;
  tickDisplay: () => void;
  reset: () => void;
}

export const PLAYBACK_DISPLAY_TICK_MS = 33;

export function createIdlePlaybackDisplayState(): PlaybackDisplayState {
  return {
    sampleFrames: 0,
    elapsedSeconds: 0,
    source: 'idle-anchor',
  };
}

export function derivePlaybackDisplayState(
  clock: PlaybackClockState,
  nowMs: number,
): PlaybackDisplayState {
  const sampleRate = clock.sampleRate && clock.sampleRate > 0 ? clock.sampleRate : null;
  const elapsedMs = Math.max(0, nowMs - clock.receivedAtMs);
  const interpolatedFrames =
    sampleRate !== null ? clock.sampleFrames + (elapsedMs / 1000) * sampleRate : clock.sampleFrames;
  const elapsedSeconds = sampleRate !== null ? interpolatedFrames / sampleRate : interpolatedFrames;

  return {
    sampleFrames: interpolatedFrames,
    elapsedSeconds,
    source: elapsedMs > 0 ? 'interpolated' : 'engine-authority',
  };
}

function clonePlaybackTransportAnchor(
  transport: ToolbarProjectTransportSnapshot,
): PlaybackTransportAnchor {
  return {
    renderStartTime: transport.renderStartTime,
    renderEndTime: transport.renderEndTime,
    loopRendering: transport.loopRendering,
    tempoMap: {
      enabled: transport.tempoMap.enabled,
      points: transport.tempoMap.points.map((point) => ({ ...point })),
    },
    meterMap: {
      entries: transport.meterMap.entries.map((entry) => ({ ...entry })),
    },
    sampleRate: transport.sampleRate,
    smpteFrameRate: transport.smpteFrameRate,
  };
}

/** Mirrors the active follow state to the main-process native-menu cache. */
function mirrorFollowState(enabled: boolean): void {
  window.blueAPI?.syncFollowPlaybackState?.(enabled);
}

/**
 * Applies the follow-on-start rule for a confirmed new playback session:
 * enabled starts the session with follow active; disabled starts from the
 * saved follow preference without forcing it on. Internal loops, seeks, and
 * engine position restarts never re-run this rule.
 */
function applyFollowOnStartRule(
  state: PlaybackState,
  set: (partial: Partial<PlaybackState>) => void,
): void {
  const next = state.followPlaybackOnStart ? true : state.savedFollowPlayback;
  if (state.followPlayback === next) return;
  set({ followPlayback: next });
  mirrorFollowState(next);
}

/** Restores the active follow state from the saved preference at session end. */
function restoreFollowFromSaved(
  state: PlaybackState,
  set: (partial: Partial<PlaybackState>) => void,
): void {
  if (state.followPlayback === state.savedFollowPlayback) return;
  set({ followPlayback: state.savedFollowPlayback });
  mirrorFollowState(state.savedFollowPlayback);
}

export const usePlaybackStore = create<PlaybackState & PlaybackActions>()((set, get) => ({
  isPlaying: false,
  isAuditioning: false,
  status: 'idle',
  message: '',
  followPlayback: true,
  savedFollowPlayback: true,
  followPlaybackOnStart: true,
  latencyCorrection: 0,
  clock: null,
  display: createIdlePlaybackDisplayState(),
  transportAnchor: null,

  togglePlay: async () => {
    if (get().status === 'starting' || get().status === 'stopping') {
      return;
    }

    if (get().isPlaying) {
      await get().stop();
      return;
    }

    try {
      set({
        isPlaying: false,
        isAuditioning: false,
        status: 'starting',
        message: 'Preparing playback...',
        clock: null,
        display: createIdlePlaybackDisplayState(),
      });

      await useProjectStore.getState().flushPendingPatches();

      const transportAnchor = clonePlaybackTransportAnchor(useProjectStore.getState().transport);
      set((state) => ({
        ...state,
        transportAnchor,
      }));

      const playing = await window.blueAPI.togglePlay();

      if (get().status === 'starting') {
        set({
          isPlaying: playing,
          isAuditioning: false,
          status: playing ? 'playing' : 'stopped',
          message: playing ? 'Playing via blue-engine' : '',
          transportAnchor: playing ? transportAnchor : null,
        });
        // Only a confirmed start applies the follow-on-start rule; failed
        // starts leave the hydrated preferences untouched.
        if (playing) {
          applyFollowOnStartRule(get(), set);
        }
      }
    } catch (err: unknown) {
      get().setError(err instanceof Error ? err.message : String(err));
    }
  },

  startFresh: async () => {
    try {
      set({
        isPlaying: false,
        isAuditioning: false,
        status: 'starting',
        message: 'Preparing playback...',
        clock: null,
        display: createIdlePlaybackDisplayState(),
      });

      await useProjectStore.getState().flushPendingPatches();

      const transportAnchor = clonePlaybackTransportAnchor(useProjectStore.getState().transport);
      set((state) => ({ ...state, transportAnchor }));

      const playing = await window.blueAPI.restartPlayback();
      if (get().status === 'starting') {
        set({
          isPlaying: playing,
          status: playing ? 'playing' : 'stopped',
          message: playing ? 'Playing via blue-engine' : '',
          transportAnchor: playing ? transportAnchor : null,
        });
        if (playing) {
          applyFollowOnStartRule(get(), set);
        }
      }
    } catch (err: unknown) {
      get().setError(err instanceof Error ? err.message : String(err));
    }
  },

  auditionScoreObjects: async (objectIds) => {
    if (objectIds.length === 0 || get().status === 'starting' || get().status === 'stopping') {
      return;
    }

    try {
      set({
        isPlaying: false,
        isAuditioning: true,
        status: 'starting',
        message: 'Preparing audition...',
        clock: null,
        display: createIdlePlaybackDisplayState(),
        transportAnchor: null,
      });

      await useProjectStore.getState().flushPendingPatches();
      const playing = await window.blueAPI.auditionScoreObjects([...objectIds]);
      if (get().status === 'starting') {
        set({
          isPlaying: playing,
          isAuditioning: playing,
          status: playing ? 'playing' : 'stopped',
          message: playing ? 'Auditioning selected ScoreObjects' : '',
        });
      }
    } catch (err: unknown) {
      get().setError(err instanceof Error ? err.message : String(err));
    }
  },

  stopAuditioning: async () => {
    if (!get().isAuditioning) return;
    await get().stop();
  },

  stop: async () => {
    const state = get();
    const shouldShowStopping =
      state.status === 'starting' || state.status === 'playing' || state.status === 'stopping';

    if (shouldShowStopping) {
      set({
        isPlaying: state.isPlaying,
        isAuditioning: false,
        status: 'stopping',
        message: 'Stopping playback...',
      });
    }

    await window.blueAPI.stopPlayback();
  },

  setPlaying: (isPlaying) => set({ isPlaying }),

  setStatus: ({ status, message, renderStartTime, auditioning }) => {
    const normalizedStatus: PlaybackStatus =
      status === 'starting' ||
      status === 'playing' ||
      status === 'stopping' ||
      status === 'stopped' ||
      status === 'error'
        ? status
        : 'idle';

    set((state) => {
      const nextState: Partial<PlaybackState> = {
        status: normalizedStatus,
        isPlaying: normalizedStatus === 'playing' || normalizedStatus === 'stopping',
        message: message || '',
      };

      if (auditioning !== undefined) {
        nextState.isAuditioning = auditioning;
      }

      if (renderStartTime !== undefined && Number.isFinite(renderStartTime)) {
        nextState.transportAnchor = clonePlaybackTransportAnchor({
          ...(state.transportAnchor ?? useProjectStore.getState().transport),
          renderStartTime,
        });
      }

      if (normalizedStatus === 'starting') {
        nextState.clock = null;
        nextState.display = createIdlePlaybackDisplayState();
      } else if (
        normalizedStatus === 'idle' ||
        normalizedStatus === 'stopped' ||
        normalizedStatus === 'error'
      ) {
        nextState.isAuditioning = false;
        nextState.clock = null;
        nextState.display = createIdlePlaybackDisplayState();
        nextState.transportAnchor = null;
      } else if (
        normalizedStatus === 'playing' &&
        state.transportAnchor === null &&
        nextState.transportAnchor === undefined
      ) {
        nextState.transportAnchor = clonePlaybackTransportAnchor(
          useProjectStore.getState().transport,
        );
      }

      return nextState;
    });

    // Session end discards the session's follow state (including suspension)
    // and reverts the toolbar/native menu to the saved preference.
    if (
      normalizedStatus === 'idle' ||
      normalizedStatus === 'stopped' ||
      normalizedStatus === 'error'
    ) {
      restoreFollowFromSaved(get(), set);
    }
  },

  setError: (error) => {
    set({
      status: 'error',
      isPlaying: false,
      isAuditioning: false,
      message: error,
      clock: null,
      display: createIdlePlaybackDisplayState(),
      transportAnchor: null,
    });
    restoreFollowFromSaved(get(), set);
  },

  acceptPlaybackClock: (snapshot) => {
    set((state) => {
      const currentClock = state.clock;
      if (
        currentClock &&
        currentClock.sessionId === snapshot.sessionId &&
        snapshot.sequence < currentClock.sequence
      ) {
        return state;
      }

      const sampleRate = snapshot.sampleRate ?? currentClock?.sampleRate ?? null;
      const ksmps = snapshot.ksmps ?? currentClock?.ksmps ?? null;
      const receivedAtMs = Date.now();
      const nextClock: PlaybackClockState = {
        sessionId: snapshot.sessionId,
        sampleFrames: snapshot.sampleFrames,
        sequence: snapshot.sequence,
        sampleRate,
        ksmps,
        receivedAtMs,
      };

      const nextState: PlaybackState = {
        ...state,
        clock: nextClock,
        display: derivePlaybackDisplayState(nextClock, receivedAtMs),
      };

      return nextState;
    });
  },

  toggleFollowPlayback: () => {
    get().setFollowPlaybackEnabled(!get().followPlayback);
  },

  setFollowPlaybackEnabled: (enabled) => {
    const previousSaved = get().savedFollowPlayback;
    set({ followPlayback: enabled, savedFollowPlayback: enabled });
    mirrorFollowState(enabled);

    const updatePreferences = window.blueAPI?.updatePlaybackPreferences;
    if (!updatePreferences) return;

    void updatePreferences({ followPlayback: enabled })
      .then((result) => {
        // A failed durable write keeps the last confirmed saved preference;
        // the active session keeps the user's choice until the next
        // authoritative settings result reconciles it.
        if (!result?.ok && get().savedFollowPlayback === enabled) {
          set({ savedFollowPlayback: previousSaved });
        }
      })
      .catch(() => {
        if (get().savedFollowPlayback === enabled) {
          set({ savedFollowPlayback: previousSaved });
        }
      });
  },

  applyResolvedFollowPlayback: (enabled) => {
    set({ followPlayback: enabled, savedFollowPlayback: enabled });
  },

  suspendFollowForSession: () => {
    const state = get();
    // Navigation while stopped/paused or while follow is already inactive
    // never changes follow state (FR-008).
    if (!state.isPlaying || !state.followPlayback) return;
    set({ followPlayback: false });
    mirrorFollowState(false);
  },

  restoreFollowFromSaved: () => {
    restoreFollowFromSaved(get(), set);
  },

  toggleFollowPlaybackOnStart: () => {
    const previous = get().followPlaybackOnStart;
    const next = !previous;
    set({ followPlaybackOnStart: next });

    const updatePreferences = window.blueAPI?.updatePlaybackPreferences;
    if (!updatePreferences) return;

    void updatePreferences({ followPlaybackOnStart: next })
      .then((result) => {
        if (!result?.ok && get().followPlaybackOnStart === next) {
          set({ followPlaybackOnStart: previous });
        }
      })
      .catch(() => {
        if (get().followPlaybackOnStart === next) {
          set({ followPlaybackOnStart: previous });
        }
      });
  },

  applyResolvedFollowPlaybackOnStart: (enabled) => {
    set({ followPlaybackOnStart: enabled });
  },

  hydrateFromProgramSettings: (settings) => {
    const savedFollowPlayback = settings.playback.followPlayback;
    set({
      followPlayback: savedFollowPlayback,
      savedFollowPlayback,
      followPlaybackOnStart: settings.playback.followPlaybackOnStart,
      latencyCorrection: settings.playback.playbackLatencyCorrection,
    });
  },

  tickDisplay: () => {
    const { clock, latencyCorrection } = get();
    if (!clock) return;
    const raw = derivePlaybackDisplayState(clock, Date.now());
    if (latencyCorrection !== 0 && raw.source !== 'idle-anchor') {
      const sampleRate = clock.sampleRate && clock.sampleRate > 0 ? clock.sampleRate : null;
      if (sampleRate) {
        const correctedFrames = Math.max(0, raw.sampleFrames - latencyCorrection * sampleRate);
        raw.sampleFrames = correctedFrames;
        raw.elapsedSeconds = correctedFrames / sampleRate;
      }
    }
    set({ display: raw });
  },

  reset: () => {
    // Runtime reset preserves the hydrated follow preferences and restores the
    // active follow state from the saved preference (FR-013).
    const { savedFollowPlayback, followPlayback, followPlaybackOnStart } = get();
    set({
      isPlaying: false,
      isAuditioning: false,
      status: 'idle',
      message: '',
      followPlayback: savedFollowPlayback,
      savedFollowPlayback,
      followPlaybackOnStart,
      latencyCorrection: 0,
      clock: null,
      display: createIdlePlaybackDisplayState(),
      transportAnchor: null,
    });
    if (followPlayback !== savedFollowPlayback) {
      mirrorFollowState(savedFollowPlayback);
    }
  },
}));
