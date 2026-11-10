import { useEffect } from 'react';
import { create } from 'zustand';
import {
  createEmptyToolbarProjectTransportSnapshot,
  type PlaybackClockSnapshot,
  type ToolbarProjectTransportSnapshot,
} from '../../shared/project-editor';
import type { ProgramSettingsSnapshot } from '../../shared/program-settings';
import { useProjectStore } from './project-store';

export type PlaybackStatus = 'idle' | 'starting' | 'playing' | 'stopping' | 'stopped' | 'error';
export type PlaybackMode = 'normal' | 'audition';
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

export function clonePlaybackTransportAnchor(
  transport: ToolbarProjectTransportSnapshot,
): PlaybackTransportAnchor {
  return {
    renderStartTime: transport.renderStartTime,
    renderEndTime: transport.renderEndTime,
    loopRendering: transport.loopRendering,
    tempoMap: {
      enabled: transport.tempoMap.enabled,
      visible: transport.tempoMap.visible,
      points: transport.tempoMap.points.map((point) => ({ ...point })),
    },
    meterMap: {
      entries: transport.meterMap.entries.map((entry) => ({ ...entry })),
    },
    sampleRate: transport.sampleRate,
    smpteFrameRate: transport.smpteFrameRate,
    smpteDropFrame: transport.smpteDropFrame,
  };
}
export interface PlaybackLifecycleIdle {
  readonly phase: 'idle';
  readonly message: string;
}

export interface PlaybackLifecycleStopped {
  readonly phase: 'stopped';
  readonly message: string;
}

export interface PlaybackLifecycleError {
  readonly phase: 'error';
  readonly message: string;
}

export interface PlaybackLifecycleStarting {
  readonly phase: 'starting';
  readonly attemptId: number;
  readonly mode: PlaybackMode;
  readonly message: string;
  readonly transportAnchor: PlaybackTransportAnchor | null;
  readonly confirmedActive: boolean;
  readonly followApplied: boolean;
}

export interface PlaybackLifecyclePlaying {
  readonly phase: 'playing';
  readonly attemptId: number;
  readonly mode: PlaybackMode;
  readonly message: string;
  readonly transportAnchor: PlaybackTransportAnchor | null;
  readonly followApplied: boolean;
}

export interface PlaybackLifecycleStopping {
  readonly phase: 'stopping';
  readonly attemptId: number;
  readonly mode: PlaybackMode;
  readonly message: string;
  readonly transportAnchor: PlaybackTransportAnchor | null;
  readonly wasPlaying: boolean;
  readonly auditionExplicitlyCleared?: boolean;
}

export type PlaybackLifecycle =
  | PlaybackLifecycleIdle
  | PlaybackLifecycleStopped
  | PlaybackLifecycleError
  | PlaybackLifecycleStarting
  | PlaybackLifecyclePlaying
  | PlaybackLifecycleStopping;

export function isPlaybackLifecycleTerminal(lifecycle: PlaybackLifecycle): boolean {
  return lifecycle.phase === 'idle' || lifecycle.phase === 'stopped' || lifecycle.phase === 'error';
}

export interface ProjectedPlaybackLifecycle {
  status: PlaybackStatus;
  isPlaying: boolean;
  isAuditioning: boolean;
  message: string;
  transportAnchor: PlaybackTransportAnchor | null;
  mode: PlaybackMode | null;
}

export function projectPlaybackLifecycle(lifecycle: PlaybackLifecycle): ProjectedPlaybackLifecycle {
  switch (lifecycle.phase) {
    case 'idle':
    case 'stopped':
    case 'error':
      return {
        status: lifecycle.phase,
        isPlaying: false,
        isAuditioning: false,
        message: lifecycle.message,
        transportAnchor: null,
        mode: null,
      };
    case 'starting':
      return {
        status: 'starting',
        isPlaying: false,
        isAuditioning: lifecycle.mode === 'audition',
        message: lifecycle.message,
        transportAnchor: lifecycle.transportAnchor,
        mode: lifecycle.mode,
      };
    case 'playing':
      return {
        status: 'playing',
        isPlaying: true,
        isAuditioning: lifecycle.mode === 'audition',
        message: lifecycle.message,
        transportAnchor: lifecycle.transportAnchor,
        mode: lifecycle.mode,
      };
    case 'stopping':
      return {
        status: 'stopping',
        isPlaying: lifecycle.wasPlaying,
        isAuditioning: lifecycle.auditionExplicitlyCleared ? false : lifecycle.mode === 'audition',
        message: lifecycle.message,
        transportAnchor: lifecycle.transportAnchor,
        mode: lifecycle.mode,
      };
  }
}

export type PlaybackLifecycleEvent =
  | {
      type: 'start-requested';
      attemptId: number;
      mode: PlaybackMode;
      message?: string;
      transportAnchor?: PlaybackTransportAnchor | null;
    }
  | {
      type: 'start-confirmed';
      attemptId: number;
      playing: boolean;
      defaultAnchor?: PlaybackTransportAnchor | null;
    }
  | {
      type: 'stop-requested';
      message?: string;
    }
  | {
      type: 'status-reported';
      status: PlaybackStatus;
      message?: string;
      renderStartTime?: number;
      auditioning?: boolean;
      attemptId?: number;
      defaultAnchor?: PlaybackTransportAnchor | null;
    }
  | {
      type: 'set-playing-requested';
      playing: boolean;
      attemptId?: number;
      defaultAnchor?: PlaybackTransportAnchor | null;
    }
  | {
      type: 'error-occurred';
      message: string;
    }
  | {
      type: 'reset-requested';
    };

export function hasStartingAuthority(lifecycle: PlaybackLifecycle, attemptId: number): boolean {
  return lifecycle.phase === 'starting' && lifecycle.attemptId === attemptId;
}

export function transitionPlaybackLifecycle(
  current: PlaybackLifecycle,
  event: PlaybackLifecycleEvent,
): PlaybackLifecycle {
  switch (event.type) {
    case 'start-requested': {
      return {
        phase: 'starting',
        attemptId: event.attemptId,
        mode: event.mode,
        message:
          event.message ||
          (event.mode === 'audition' ? 'Preparing audition...' : 'Preparing playback...'),
        transportAnchor: event.transportAnchor ?? null,
        confirmedActive: false,
        followApplied: false,
      };
    }

    case 'start-confirmed': {
      if (current.phase === 'starting' && current.attemptId === event.attemptId) {
        if (event.playing) {
          return {
            phase: 'playing',
            attemptId: current.attemptId,
            mode: current.mode,
            message:
              current.mode === 'audition'
                ? 'Auditioning selected ScoreObjects'
                : 'Playing via blue-engine',
            transportAnchor: current.transportAnchor ?? event.defaultAnchor ?? null,
            followApplied: true,
          };
        }
        return {
          phase: 'stopped',
          message: '',
        };
      }
      if (current.phase === 'playing' && current.attemptId === event.attemptId) {
        if (event.playing && !current.followApplied && current.mode === 'normal') {
          return {
            ...current,
            followApplied: true,
          };
        }
        return current;
      }
      return current;
    }

    case 'stop-requested': {
      if (
        current.phase === 'starting' ||
        current.phase === 'playing' ||
        current.phase === 'stopping'
      ) {
        const wasPlaying =
          current.phase === 'playing'
            ? true
            : current.phase === 'starting'
              ? current.confirmedActive
              : current.wasPlaying;

        return {
          phase: 'stopping',
          attemptId: current.attemptId,
          mode: current.mode,
          transportAnchor: current.transportAnchor,
          message: event.message || 'Stopping playback...',
          wasPlaying,
          auditionExplicitlyCleared: true,
        };
      }
      return current;
    }

    case 'status-reported': {
      switch (event.status) {
        case 'starting': {
          if (current.phase === 'starting' || current.phase === 'playing') {
            const mode =
              event.auditioning !== undefined
                ? event.auditioning
                  ? 'audition'
                  : 'normal'
                : current.mode;
            const transportAnchor =
              event.renderStartTime !== undefined && Number.isFinite(event.renderStartTime)
                ? clonePlaybackTransportAnchor({
                    ...(current.transportAnchor ??
                      event.defaultAnchor ??
                      createEmptyToolbarProjectTransportSnapshot()),
                    renderStartTime: event.renderStartTime,
                  })
                : current.transportAnchor;
            return {
              phase: 'starting',
              attemptId: current.attemptId,
              mode,
              message: event.message || current.message,
              transportAnchor,
              confirmedActive: current.phase === 'playing' || current.confirmedActive,
              followApplied: current.followApplied,
            };
          }
          const attemptId = event.attemptId ?? 1;
          const mode = event.auditioning ? 'audition' : 'normal';
          const transportAnchor =
            event.renderStartTime !== undefined && Number.isFinite(event.renderStartTime)
              ? clonePlaybackTransportAnchor({
                  ...(event.defaultAnchor ?? createEmptyToolbarProjectTransportSnapshot()),
                  renderStartTime: event.renderStartTime,
                })
              : mode === 'normal' && event.defaultAnchor
                ? clonePlaybackTransportAnchor(event.defaultAnchor)
                : null;
          return {
            phase: 'starting',
            attemptId,
            mode,
            message:
              event.message ||
              (mode === 'audition' ? 'Preparing audition...' : 'Preparing playback...'),
            transportAnchor,
            confirmedActive: false,
            followApplied: false,
          };
        }

        case 'playing': {
          const activeAttemptId =
            !isPlaybackLifecycleTerminal(current) && 'attemptId' in current
              ? current.attemptId
              : (event.attemptId ?? 1);

          const activeMode =
            event.auditioning !== undefined
              ? event.auditioning
                ? 'audition'
                : 'normal'
              : !isPlaybackLifecycleTerminal(current) && 'mode' in current
                ? current.mode
                : 'normal';

          let activeAnchor: PlaybackTransportAnchor | null = null;
          if (event.renderStartTime !== undefined && Number.isFinite(event.renderStartTime)) {
            activeAnchor = clonePlaybackTransportAnchor({
              ...((!isPlaybackLifecycleTerminal(current) && 'transportAnchor' in current
                ? current.transportAnchor
                : null) ??
                event.defaultAnchor ??
                createEmptyToolbarProjectTransportSnapshot()),
              renderStartTime: event.renderStartTime,
            });
          } else if (
            !isPlaybackLifecycleTerminal(current) &&
            'transportAnchor' in current &&
            current.transportAnchor !== null
          ) {
            activeAnchor = current.transportAnchor;
          } else if (activeMode === 'normal' && event.defaultAnchor) {
            activeAnchor = clonePlaybackTransportAnchor(event.defaultAnchor);
          }

          const alreadyApplied =
            current.phase === 'playing' ||
            (!isPlaybackLifecycleTerminal(current) && 'followApplied' in current
              ? current.followApplied
              : false);

          const shouldApplyFollow = activeMode === 'normal' && !alreadyApplied;

          return {
            phase: 'playing',
            attemptId: activeAttemptId,
            mode: activeMode,
            message:
              event.message ||
              (activeMode === 'audition'
                ? 'Auditioning selected ScoreObjects'
                : 'Playing via blue-engine'),
            transportAnchor: activeAnchor,
            followApplied: alreadyApplied || shouldApplyFollow,
          };
        }

        case 'stopping': {
          const activeAttemptId =
            !isPlaybackLifecycleTerminal(current) && 'attemptId' in current
              ? current.attemptId
              : (event.attemptId ?? 1);

          const activeMode =
            event.auditioning !== undefined
              ? event.auditioning
                ? 'audition'
                : 'normal'
              : !isPlaybackLifecycleTerminal(current) && 'mode' in current
                ? current.mode
                : 'normal';

          let activeAnchor: PlaybackTransportAnchor | null = null;
          if (event.renderStartTime !== undefined && Number.isFinite(event.renderStartTime)) {
            activeAnchor = clonePlaybackTransportAnchor({
              ...((!isPlaybackLifecycleTerminal(current) && 'transportAnchor' in current
                ? current.transportAnchor
                : null) ??
                event.defaultAnchor ??
                createEmptyToolbarProjectTransportSnapshot()),
              renderStartTime: event.renderStartTime,
            });
          } else if (!isPlaybackLifecycleTerminal(current) && 'transportAnchor' in current) {
            activeAnchor = current.transportAnchor;
          }

          return {
            phase: 'stopping',
            attemptId: activeAttemptId,
            mode: activeMode,
            transportAnchor: activeAnchor,
            message: event.message || 'Stopping playback...',
            wasPlaying: true,
            auditionExplicitlyCleared: event.auditioning === false,
          };
        }

        case 'stopped': {
          return {
            phase: 'stopped',
            message: event.message || '',
          };
        }

        case 'idle': {
          return {
            phase: 'idle',
            message: event.message || '',
          };
        }

        case 'error': {
          return {
            phase: 'error',
            message: event.message || 'Playback error',
          };
        }
      }
    }

    case 'set-playing-requested': {
      if (event.playing) {
        if (current.phase === 'starting') {
          return {
            phase: 'playing',
            attemptId: current.attemptId,
            mode: current.mode,
            message:
              current.message ||
              (current.mode === 'audition'
                ? 'Auditioning selected ScoreObjects'
                : 'Playing via blue-engine'),
            transportAnchor:
              current.transportAnchor ??
              (event.defaultAnchor ? clonePlaybackTransportAnchor(event.defaultAnchor) : null),
            followApplied: current.followApplied || current.mode === 'normal',
          };
        }
        if (current.phase === 'playing') {
          return current;
        }
        if (current.phase === 'stopping') {
          return {
            ...current,
            wasPlaying: true,
          };
        }
        return {
          phase: 'playing',
          attemptId: event.attemptId ?? 1,
          mode: 'normal',
          message: 'Playing via blue-engine',
          transportAnchor: event.defaultAnchor
            ? clonePlaybackTransportAnchor(event.defaultAnchor)
            : null,
          followApplied: true,
        };
      }
      if (!isPlaybackLifecycleTerminal(current)) {
        return {
          phase: 'stopped',
          message: '',
        };
      }
      return current;
    }

    case 'error-occurred': {
      return {
        phase: 'error',
        message: event.message,
      };
    }

    case 'reset-requested': {
      return {
        phase: 'idle',
        message: '',
      };
    }
  }
}

export interface PlaybackState {
  lifecycle: PlaybackLifecycle;
  isPlaying: boolean;
  isAuditioning: boolean;
  status: PlaybackStatus;
  mode: PlaybackMode | null;
  message: string;
  /** Active follow state for the current playback session (may be suspended). */
  followPlayback: boolean;
  /** Hydrated durable preference; restores active state when a session ends. */
  savedFollowPlayback: boolean;
  followPlaybackOnStart: boolean;
  playbackFps: number;
  latencyCorrection: number;
  clock: PlaybackClockState | null;
  display: PlaybackDisplayState;
  transportAnchor: PlaybackTransportAnchor | null;
}

export interface PlaybackActions {
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
  /** Main-originated saved display cadence; main already persisted it. */
  applyResolvedPlaybackFps: (fps: number) => void;
  hydrateFromProgramSettings: (settings: ProgramSettingsSnapshot) => void;
  tickDisplay: () => void;
  reset: () => void;
}

export const DEFAULT_PLAYBACK_FPS = 30;
export const PLAYBACK_DISPLAY_TICK_MS = Math.round(1000 / DEFAULT_PLAYBACK_FPS);

export function normalizePlaybackFps(fps: unknown): number {
  return typeof fps === 'number' && Number.isFinite(fps) && fps >= 1 && fps <= 120
    ? Math.round(fps)
    : DEFAULT_PLAYBACK_FPS;
}

export function getPlaybackDisplayTickMs(playbackFps: number): number {
  const normalized = normalizePlaybackFps(playbackFps);
  return Math.max(8, Math.round(1000 / normalized));
}

let activeDisplayTickerConsumers = 0;
let sharedDisplayTimerId: ReturnType<typeof setInterval> | null = null;
let sharedDisplayTimerIntervalMs = 0;

function syncSharedDisplayTimer(intervalMs: number): void {
  if (activeDisplayTickerConsumers <= 0) {
    if (sharedDisplayTimerId !== null) {
      clearInterval(sharedDisplayTimerId);
      sharedDisplayTimerId = null;
      sharedDisplayTimerIntervalMs = 0;
    }
    return;
  }
  if (sharedDisplayTimerId !== null && sharedDisplayTimerIntervalMs === intervalMs) {
    return;
  }
  if (sharedDisplayTimerId !== null) {
    clearInterval(sharedDisplayTimerId);
  }
  sharedDisplayTimerIntervalMs = intervalMs;
  sharedDisplayTimerId = setInterval(() => {
    usePlaybackStore.getState().tickDisplay();
  }, intervalMs);
}

/**
 * Ref-counted display clock hook shared by ScorePanel and ToolbarDisplays so
 * active playback runs at most one interval timer paced by `playbackFps`.
 */
export function usePlaybackDisplayTicker(active: boolean): void {
  const playbackFps = usePlaybackStore((s) => s.playbackFps);
  const intervalMs = getPlaybackDisplayTickMs(playbackFps);

  useEffect(() => {
    if (!active) return;
    activeDisplayTickerConsumers += 1;
    syncSharedDisplayTimer(intervalMs);
    return () => {
      activeDisplayTickerConsumers = Math.max(0, activeDisplayTickerConsumers - 1);
      syncSharedDisplayTimer(intervalMs);
    };
  }, [active, intervalMs]);
}

export const IDLE_PLAYBACK_DISPLAY: Readonly<PlaybackDisplayState> = Object.freeze({
  sampleFrames: 0,
  elapsedSeconds: 0,
  source: 'idle-anchor',
});

export function createIdlePlaybackDisplayState(): PlaybackDisplayState {
  return IDLE_PLAYBACK_DISPLAY;
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

let nextAttemptIdentity = 0;
let retiredSessionWatermark = 0;

export function __testResetPlaybackSessionWatermark(): void {
  retiredSessionWatermark = 0;
}

function isAttemptCurrent(lifecycle: PlaybackLifecycle, attemptId: number): boolean {
  return (
    !isPlaybackLifecycleTerminal(lifecycle) &&
    'attemptId' in lifecycle &&
    lifecycle.attemptId === attemptId
  );
}

const initialLifecycle: PlaybackLifecycleIdle = {
  phase: 'idle',
  message: '',
};

export const usePlaybackStore = create<PlaybackState & PlaybackActions>()((set, get) => ({
  lifecycle: initialLifecycle,
  ...projectPlaybackLifecycle(initialLifecycle),
  followPlayback: true,
  savedFollowPlayback: true,
  followPlaybackOnStart: true,
  playbackFps: DEFAULT_PLAYBACK_FPS,
  latencyCorrection: 0,
  clock: null,
  display: IDLE_PLAYBACK_DISPLAY,

  togglePlay: async () => {
    if (get().status === 'starting' || get().status === 'stopping') {
      return;
    }

    if (get().isPlaying) {
      await get().stop();
      return;
    }

    const attemptId = ++nextAttemptIdentity;
    const projectTransport = useProjectStore.getState().transport;
    const transportAnchor = clonePlaybackTransportAnchor(projectTransport);

    const startingLifecycle = transitionPlaybackLifecycle(get().lifecycle, {
      type: 'start-requested',
      attemptId,
      mode: 'normal',
      message: 'Preparing playback...',
      transportAnchor,
    });

    set({
      lifecycle: startingLifecycle,
      ...projectPlaybackLifecycle(startingLifecycle),
      clock: null,
      display: IDLE_PLAYBACK_DISPLAY,
    });

    try {
      await useProjectStore.getState().flushPendingPatches();

      if (!hasStartingAuthority(get().lifecycle, attemptId)) {
        return;
      }

      const playing = await window.blueAPI.togglePlay();

      const current = get().lifecycle;
      const transitioned = transitionPlaybackLifecycle(current, {
        type: 'start-confirmed',
        attemptId,
        playing,
        defaultAnchor: transportAnchor,
      });

      if (transitioned !== current) {
        set({
          lifecycle: transitioned,
          ...projectPlaybackLifecycle(transitioned),
          ...(transitioned.phase === 'stopped'
            ? { clock: null, display: IDLE_PLAYBACK_DISPLAY }
            : {}),
        });

        if (
          transitioned.phase === 'playing' &&
          ('followApplied' in current ? !current.followApplied : true) &&
          transitioned.mode === 'normal'
        ) {
          applyFollowOnStartRule(get(), set);
        } else if (transitioned.phase === 'stopped') {
          restoreFollowFromSaved(get(), set);
        }
      }
    } catch (err: unknown) {
      const current = get().lifecycle;
      if (
        (current.phase === 'starting' || current.phase === 'stopping') &&
        current.attemptId === attemptId
      ) {
        get().setError(err instanceof Error ? err.message : String(err));
      }
    }
  },

  startFresh: async () => {
    const attemptId = ++nextAttemptIdentity;
    const projectTransport = useProjectStore.getState().transport;
    const transportAnchor = clonePlaybackTransportAnchor(projectTransport);

    const startingLifecycle = transitionPlaybackLifecycle(get().lifecycle, {
      type: 'start-requested',
      attemptId,
      mode: 'normal',
      message: 'Preparing playback...',
      transportAnchor,
    });

    set({
      lifecycle: startingLifecycle,
      ...projectPlaybackLifecycle(startingLifecycle),
      clock: null,
      display: IDLE_PLAYBACK_DISPLAY,
    });

    try {
      await useProjectStore.getState().flushPendingPatches();

      if (!hasStartingAuthority(get().lifecycle, attemptId)) {
        return;
      }

      const playing = await window.blueAPI.restartPlayback();

      const current = get().lifecycle;
      const transitioned = transitionPlaybackLifecycle(current, {
        type: 'start-confirmed',
        attemptId,
        playing,
        defaultAnchor: transportAnchor,
      });

      if (transitioned !== current) {
        set({
          lifecycle: transitioned,
          ...projectPlaybackLifecycle(transitioned),
          ...(transitioned.phase === 'stopped'
            ? { clock: null, display: IDLE_PLAYBACK_DISPLAY }
            : {}),
        });

        if (
          transitioned.phase === 'playing' &&
          ('followApplied' in current ? !current.followApplied : true) &&
          transitioned.mode === 'normal'
        ) {
          applyFollowOnStartRule(get(), set);
        } else if (transitioned.phase === 'stopped') {
          restoreFollowFromSaved(get(), set);
        }
      }
    } catch (err: unknown) {
      const current = get().lifecycle;
      if (
        (current.phase === 'starting' || current.phase === 'stopping') &&
        current.attemptId === attemptId
      ) {
        get().setError(err instanceof Error ? err.message : String(err));
      }
    }
  },

  auditionScoreObjects: async (objectIds) => {
    if (objectIds.length === 0 || get().status === 'starting' || get().status === 'stopping') {
      return;
    }

    const attemptId = ++nextAttemptIdentity;

    const startingLifecycle = transitionPlaybackLifecycle(get().lifecycle, {
      type: 'start-requested',
      attemptId,
      mode: 'audition',
      message: 'Preparing audition...',
      transportAnchor: null,
    });

    set({
      lifecycle: startingLifecycle,
      ...projectPlaybackLifecycle(startingLifecycle),
      clock: null,
      display: IDLE_PLAYBACK_DISPLAY,
    });

    try {
      await useProjectStore.getState().flushPendingPatches();

      if (!hasStartingAuthority(get().lifecycle, attemptId)) {
        return;
      }

      const playing = await window.blueAPI.auditionScoreObjects([...objectIds]);

      const current = get().lifecycle;
      const transitioned = transitionPlaybackLifecycle(current, {
        type: 'start-confirmed',
        attemptId,
        playing,
        defaultAnchor: null,
      });

      if (transitioned !== current) {
        set({
          lifecycle: transitioned,
          ...projectPlaybackLifecycle(transitioned),
          ...(transitioned.phase === 'stopped'
            ? { clock: null, display: IDLE_PLAYBACK_DISPLAY }
            : {}),
        });

        if (transitioned.phase === 'stopped') {
          restoreFollowFromSaved(get(), set);
        }
      }
    } catch (err: unknown) {
      const current = get().lifecycle;
      if (
        (current.phase === 'starting' || current.phase === 'stopping') &&
        current.attemptId === attemptId
      ) {
        get().setError(err instanceof Error ? err.message : String(err));
      }
    }
  },

  stopAuditioning: async () => {
    if (!get().isAuditioning) return;
    await get().stop();
  },

  stop: async () => {
    const current = get().lifecycle;
    const transitioned = transitionPlaybackLifecycle(current, {
      type: 'stop-requested',
    });

    if (transitioned !== current) {
      set({
        lifecycle: transitioned,
        ...projectPlaybackLifecycle(transitioned),
      });
    }

    await window.blueAPI.stopPlayback();
  },

  setPlaying: (playing) => {
    const current = get().lifecycle;
    if (!playing && !isPlaybackLifecycleTerminal(current)) {
      const currentClock = get().clock;
      if (currentClock !== null) {
        retiredSessionWatermark = Math.max(retiredSessionWatermark, currentClock.sessionId);
      }
    }

    const defaultAnchor = clonePlaybackTransportAnchor(useProjectStore.getState().transport);
    const attemptId = ++nextAttemptIdentity;

    const transitioned = transitionPlaybackLifecycle(current, {
      type: 'set-playing-requested',
      playing,
      attemptId,
      defaultAnchor,
    });

    if (transitioned === current) {
      return;
    }

    set({
      lifecycle: transitioned,
      ...projectPlaybackLifecycle(transitioned),
      ...(!playing ? { clock: null, display: IDLE_PLAYBACK_DISPLAY } : {}),
    });

    if (playing) {
      if (
        (current.phase === 'starting' && current.mode === 'normal' && !current.followApplied) ||
        isPlaybackLifecycleTerminal(current)
      ) {
        applyFollowOnStartRule(get(), set);
      }
    } else {
      restoreFollowFromSaved(get(), set);
    }
  },

  setStatus: ({ status, message, renderStartTime, auditioning }) => {
    const current = get().lifecycle;
    const normalizedStatus: PlaybackStatus =
      status === 'starting' ||
      status === 'playing' ||
      status === 'stopping' ||
      status === 'stopped' ||
      status === 'error'
        ? status
        : 'idle';

    if (
      normalizedStatus === 'stopped' ||
      normalizedStatus === 'idle' ||
      normalizedStatus === 'error'
    ) {
      const currentClock = get().clock;
      if (currentClock !== null) {
        retiredSessionWatermark = Math.max(retiredSessionWatermark, currentClock.sessionId);
      }
    }

    const defaultAnchor = clonePlaybackTransportAnchor(useProjectStore.getState().transport);
    const attemptId = ++nextAttemptIdentity;

    const transitioned = transitionPlaybackLifecycle(current, {
      type: 'status-reported',
      status: normalizedStatus,
      message,
      renderStartTime,
      auditioning,
      attemptId,
      defaultAnchor,
    });

    const isTerminal = isPlaybackLifecycleTerminal(transitioned);
    const isNowPlaying = transitioned.phase === 'playing';
    const wasAlreadyPlaying =
      get().isPlaying || (!isPlaybackLifecycleTerminal(current) && current.phase === 'playing');
    const shouldApplyFollow =
      isNowPlaying &&
      transitioned.mode === 'normal' &&
      !wasAlreadyPlaying &&
      (!('followApplied' in current) || !current.followApplied);

    set({
      lifecycle: transitioned,
      ...projectPlaybackLifecycle(transitioned),
      ...(isTerminal ? { clock: null, display: IDLE_PLAYBACK_DISPLAY } : {}),
      ...(normalizedStatus === 'starting' && isPlaybackLifecycleTerminal(current)
        ? { clock: null, display: IDLE_PLAYBACK_DISPLAY }
        : {}),
    });

    if (shouldApplyFollow) {
      applyFollowOnStartRule(get(), set);
    } else if (isTerminal) {
      restoreFollowFromSaved(get(), set);
    }
  },

  setError: (error) => {
    const currentClock = get().clock;
    if (currentClock !== null) {
      retiredSessionWatermark = Math.max(retiredSessionWatermark, currentClock.sessionId);
    }
    const transitioned = transitionPlaybackLifecycle(get().lifecycle, {
      type: 'error-occurred',
      message: error,
    });
    set({
      lifecycle: transitioned,
      ...projectPlaybackLifecycle(transitioned),
      clock: null,
      display: IDLE_PLAYBACK_DISPLAY,
    });
    restoreFollowFromSaved(get(), set);
  },

  acceptPlaybackClock: (snapshot) => {
    set((state) => {
      if (isPlaybackLifecycleTerminal(state.lifecycle)) {
        return state;
      }

      if (snapshot.sessionId <= retiredSessionWatermark) {
        return state;
      }

      const currentClock = state.clock;

      if (currentClock && currentClock.sessionId === snapshot.sessionId) {
        if (snapshot.sequence < currentClock.sequence) {
          return state;
        }
      }

      if (currentClock && snapshot.sessionId < currentClock.sessionId) {
        return state;
      }

      if (currentClock && snapshot.sessionId > currentClock.sessionId) {
        retiredSessionWatermark = Math.max(retiredSessionWatermark, currentClock.sessionId);
      }

      const isSameSession = currentClock !== null && currentClock.sessionId === snapshot.sessionId;
      const sampleRate = snapshot.sampleRate ?? (isSameSession ? currentClock.sampleRate : null);
      const ksmps = snapshot.ksmps ?? (isSameSession ? currentClock.ksmps : null);
      const receivedAtMs = Date.now();
      const nextClock: PlaybackClockState = {
        sessionId: snapshot.sessionId,
        sampleFrames: snapshot.sampleFrames,
        sequence: snapshot.sequence,
        sampleRate,
        ksmps,
        receivedAtMs,
      };

      return {
        clock: nextClock,
        display: derivePlaybackDisplayState(nextClock, receivedAtMs),
      };
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

  applyResolvedPlaybackFps: (fps) => {
    const playbackFps = normalizePlaybackFps(fps);
    if (get().playbackFps !== playbackFps) set({ playbackFps });
  },

  hydrateFromProgramSettings: (settings) => {
    const savedFollowPlayback = settings.playback.followPlayback;
    const playbackFps = normalizePlaybackFps(settings.playback.playbackFps);
    set({
      followPlayback: savedFollowPlayback,
      savedFollowPlayback,
      followPlaybackOnStart: settings.playback.followPlaybackOnStart,
      playbackFps,
      latencyCorrection: settings.playback.playbackLatencyCorrection,
    });
  },

  tickDisplay: () => {
    const state = get();
    const { clock, latencyCorrection } = state;
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
    const prev = state.display;
    if (
      prev.source === raw.source &&
      Math.abs(prev.sampleFrames - raw.sampleFrames) < 1 &&
      Math.abs(prev.elapsedSeconds - raw.elapsedSeconds) < 0.001
    ) {
      return;
    }
    set({ display: raw });
  },

  reset: () => {
    const { savedFollowPlayback, followPlayback, followPlaybackOnStart, playbackFps } = get();
    const idleLifecycle = transitionPlaybackLifecycle(get().lifecycle, {
      type: 'reset-requested',
    });
    set({
      lifecycle: idleLifecycle,
      ...projectPlaybackLifecycle(idleLifecycle),
      followPlayback: savedFollowPlayback,
      savedFollowPlayback,
      followPlaybackOnStart,
      playbackFps,
      latencyCorrection: 0,
      clock: null,
      display: IDLE_PLAYBACK_DISPLAY,
    });
    if (followPlayback !== savedFollowPlayback) {
      mirrorFollowState(savedFollowPlayback);
    }
  },
}));
