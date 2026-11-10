// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PLAYBACK_FPS,
  derivePlaybackDisplayState,
  getPlaybackDisplayTickMs,
  hasStartingAuthority,
  IDLE_PLAYBACK_DISPLAY,
  PLAYBACK_DISPLAY_TICK_MS,
  projectPlaybackLifecycle,
  transitionPlaybackLifecycle,
  usePlaybackStore,
  __testResetPlaybackSessionWatermark,
  type PlaybackLifecycle,
  type PlaybackLifecycleEvent,
} from '../stores/playback-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import { useProjectStore } from '../stores/project-store';

it('preserves an active audition through a partial internal restart (T052)', () => {
  const anchor = { ...createEmptyProjectEditorSnapshot().transport, renderStartTime: 42 };
  const active: PlaybackLifecycle = {
    phase: 'playing',
    attemptId: 7,
    mode: 'audition',
    message: '',
    transportAnchor: anchor,
    followApplied: true,
  };
  const restarting = transitionPlaybackLifecycle(active, {
    type: 'status-reported',
    status: 'starting',
    message: '',
  });
  expect(restarting).toMatchObject({
    phase: 'starting',
    attemptId: 7,
    mode: 'audition',
    transportAnchor: anchor,
    followApplied: true,
    confirmedActive: true,
  });
});

function seedProject(renderStartTime = 8): void {
  const snapshot = createEmptyProjectEditorSnapshot();

  useProjectStore.getState().setProjectInfo({
    title: 'Playback Test',
    author: 'Test Author',
    sampleRate: '44100',
    version: '2.10.0',
    filePath: '/tmp/playback-test.blue',
    loaded: true,
    globalOrc: snapshot.globalOrc,
    globalSco: snapshot.globalSco,
    orchestra: {
      ...snapshot.orchestra,
      loaded: true,
    },
    projectProperties: {
      ...snapshot.projectProperties,
      title: 'Playback Test',
      author: 'Test Author',
    },
    transport: {
      ...snapshot.transport,
      renderStartTime,
      tempoMap: {
        enabled: true,
        points: [
          { beat: 0, tempo: 120, curveType: 'constant' },
          { beat: 8, tempo: 120, curveType: 'constant' },
        ],
      },
    },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  __testResetPlaybackSessionWatermark();
  usePlaybackStore.getState().reset();
  usePlaybackStore.setState({
    followPlayback: true,
    savedFollowPlayback: true,
    followPlaybackOnStart: true,
    playbackFps: DEFAULT_PLAYBACK_FPS,
  });
  useProjectStore.getState().clearProject();
  (window as unknown as { blueAPI?: unknown }).blueAPI = {
    togglePlay: vi.fn().mockResolvedValue(true),
    restartPlayback: vi.fn().mockResolvedValue(true),
    stopPlayback: vi.fn().mockResolvedValue(undefined),
    auditionScoreObjects: vi.fn().mockResolvedValue(true),
    syncFollowPlaybackState: vi.fn(),
    updatePlaybackPreferences: vi.fn().mockResolvedValue({ ok: true }),
    commitProjectDocumentPatches: vi.fn().mockResolvedValue({ revision: 1, sessionId: 1 }),
  };
});

function playbackApi(): {
  syncFollowPlaybackState: ReturnType<typeof vi.fn>;
  updatePlaybackPreferences: ReturnType<typeof vi.fn>;
  commitProjectDocumentPatches: ReturnType<typeof vi.fn>;
} {
  return window.blueAPI as unknown as {
    syncFollowPlaybackState: ReturnType<typeof vi.fn>;
    updatePlaybackPreferences: ReturnType<typeof vi.fn>;
    commitProjectDocumentPatches: ReturnType<typeof vi.fn>;
  };
}

function hydrate(followPlayback: boolean, followPlaybackOnStart: boolean): void {
  usePlaybackStore.getState().hydrateFromProgramSettings({
    schemaVersion: 1,
    general: {} as never,
    playback: {
      followPlayback,
      followPlaybackOnStart,
      playbackLatencyCorrection: 0,
    },
  } as never);
}

function startConfirmedPlayback(): void {
  usePlaybackStore.setState({ isPlaying: true, status: 'playing' });
}

afterEach(() => {
  usePlaybackStore.getState().reset();
  useProjectStore.getState().clearProject();
  vi.useRealTimers();
});

describe('playback store authoritative clock', () => {
  it('stores the authoritative display anchor and leaves interpolation to consumers', () => {
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Playing' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 100,
      sequence: 1,
      sampleRate: 1000,
      ksmps: 64,
    });

    const initial = usePlaybackStore.getState().display;
    expect(initial.sampleFrames).toBe(100);
    expect(initial.elapsedSeconds).toBe(0.1);
    expect(initial.source).toBe('engine-authority');

    vi.advanceTimersByTime(100);

    const unchanged = usePlaybackStore.getState().display;
    expect(unchanged).toBe(initial);

    const interpolated = derivePlaybackDisplayState(usePlaybackStore.getState().clock!, Date.now());
    expect(interpolated.sampleFrames).toBeGreaterThanOrEqual(199);
    expect(interpolated.sampleFrames).toBeLessThanOrEqual(201);
    expect(interpolated.elapsedSeconds).toBeGreaterThanOrEqual(0.199);
    expect(interpolated.elapsedSeconds).toBeLessThanOrEqual(0.201);
    expect(interpolated.source).toBe('interpolated');
  });

  it('keeps the live clock when playing status arrives after the first engine clock', () => {
    usePlaybackStore.getState().setStatus({ status: 'starting', message: 'Preparing playback...' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 0,
      sequence: 0,
      sampleRate: 1000,
      ksmps: 64,
    });

    const beforeStatus = usePlaybackStore.getState();

    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Playing' });

    const afterStatus = usePlaybackStore.getState();
    expect(afterStatus.clock).toEqual(beforeStatus.clock);
    expect(afterStatus.display).toBe(beforeStatus.display);
    expect(afterStatus.status).toBe('playing');
  });

  it('clears the live clock when playback stops', () => {
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Playing' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 256,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });

    usePlaybackStore.getState().setStatus({ status: 'stopped', message: 'Stopped' });
    vi.advanceTimersByTime(500);

    expect(usePlaybackStore.getState().clock).toBeNull();
    expect(usePlaybackStore.getState().display.sampleFrames).toBe(0);
    expect(usePlaybackStore.getState().display.elapsedSeconds).toBe(0);
    expect(usePlaybackStore.getState().display.source).toBe('idle-anchor');
  });

  it('captures a stable transport anchor at playback start', async () => {
    seedProject(8);

    await usePlaybackStore.getState().togglePlay();

    expect(usePlaybackStore.getState().transportAnchor?.renderStartTime).toBe(8);

    seedProject(20);

    expect(usePlaybackStore.getState().transportAnchor?.renderStartTime).toBe(8);
    expect(usePlaybackStore.getState().transportAnchor?.tempoMap.points[0]?.tempo).toBe(120);
  });

  it('starts fresh playback through the non-toggle restart IPC path', async () => {
    seedProject(12);
    await usePlaybackStore.getState().startFresh();

    const api = window.blueAPI as unknown as { restartPlayback: ReturnType<typeof vi.fn> };
    expect(api.restartPlayback).toHaveBeenCalledOnce();
    expect(usePlaybackStore.getState()).toMatchObject({
      status: 'playing',
      isPlaying: true,
    });
    expect(usePlaybackStore.getState().transportAnchor?.renderStartTime).toBe(12);
  });

  it('anchors an audition playhead to the audition copy render start', () => {
    seedProject(0);

    usePlaybackStore.getState().setStatus({
      status: 'starting',
      message: 'Preparing audition...',
      renderStartTime: 12,
    });

    expect(usePlaybackStore.getState().transportAnchor?.renderStartTime).toBe(12);
  });

  it('keeps audition identity across engine status updates until playback stops', () => {
    seedProject(0);

    usePlaybackStore.getState().setStatus({
      status: 'starting',
      renderStartTime: 12,
      auditioning: true,
    });
    usePlaybackStore
      .getState()
      .setStatus({ status: 'playing', message: 'Playing via blue-engine' });

    expect(usePlaybackStore.getState().isAuditioning).toBe(true);

    usePlaybackStore.getState().setStatus({ status: 'stopped', message: 'Playback stopped' });

    expect(usePlaybackStore.getState().isAuditioning).toBe(false);
  });

  it('flushes pending edits and routes selected IDs through the audition IPC path', async () => {
    seedProject(12);
    const flushPendingPatches = vi
      .spyOn(useProjectStore.getState(), 'flushPendingPatches')
      .mockResolvedValue(undefined);

    await usePlaybackStore.getState().auditionScoreObjects(['sobj-1', 'aclp-2']);

    const api = window.blueAPI as unknown as {
      auditionScoreObjects: ReturnType<typeof vi.fn>;
    };
    expect(flushPendingPatches).toHaveBeenCalledOnce();
    expect(api.auditionScoreObjects).toHaveBeenCalledWith(['sobj-1', 'aclp-2']);
    expect(usePlaybackStore.getState()).toMatchObject({
      status: 'playing',
      isPlaying: true,
      isAuditioning: true,
      transportAnchor: null,
    });
    flushPendingPatches.mockRestore();
  });

  it('stops only an active audition when the score timeline requests audition cancellation', async () => {
    seedProject(4);
    await usePlaybackStore.getState().auditionScoreObjects(['sobj-1']);

    await usePlaybackStore.getState().stopAuditioning();

    const api = window.blueAPI as unknown as { stopPlayback: ReturnType<typeof vi.fn> };
    expect(api.stopPlayback).toHaveBeenCalledOnce();
    expect(usePlaybackStore.getState().isAuditioning).toBe(false);

    api.stopPlayback.mockClear();
    await usePlaybackStore.getState().stopAuditioning();
    expect(api.stopPlayback).not.toHaveBeenCalled();
  });

  it('does not stop ordinary project playback when the score timeline requests audition cancellation', async () => {
    seedProject(4);
    usePlaybackStore.setState({
      isPlaying: true,
      isAuditioning: false,
      status: 'playing',
    });

    await usePlaybackStore.getState().stopAuditioning();

    const api = window.blueAPI as unknown as { stopPlayback: ReturnType<typeof vi.fn> };
    expect(api.stopPlayback).not.toHaveBeenCalled();
    expect(usePlaybackStore.getState()).toMatchObject({
      isPlaying: true,
      isAuditioning: false,
      status: 'playing',
    });
  });

  it('clears audition state when main declines to start the temporary render', async () => {
    seedProject(4);
    const api = window.blueAPI as unknown as {
      auditionScoreObjects: ReturnType<typeof vi.fn>;
    };
    api.auditionScoreObjects.mockResolvedValueOnce(false);

    await usePlaybackStore.getState().auditionScoreObjects(['sobj-1']);

    expect(usePlaybackStore.getState()).toMatchObject({
      status: 'stopped',
      isPlaying: false,
      isAuditioning: false,
    });
  });
});

describe('playback store follow lifecycle (SPEC 079)', () => {
  it('hydrates saved and active follow state from program settings', () => {
    hydrate(false, false);

    expect(usePlaybackStore.getState()).toMatchObject({
      followPlayback: false,
      savedFollowPlayback: false,
      followPlaybackOnStart: false,
    });
  });

  it('persists an explicit follow toggle immediately and mirrors the active state', async () => {
    startConfirmedPlayback();

    usePlaybackStore.getState().setFollowPlaybackEnabled(false);
    await Promise.resolve();

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);
    expect(playbackApi().updatePlaybackPreferences).toHaveBeenCalledTimes(1);
    expect(playbackApi().updatePlaybackPreferences).toHaveBeenCalledWith({ followPlayback: false });
    expect(playbackApi().syncFollowPlaybackState).toHaveBeenCalledWith(false);
  });

  it('keeps the last confirmed saved preference when the durable write fails', async () => {
    startConfirmedPlayback();
    playbackApi().updatePlaybackPreferences.mockResolvedValue({ ok: false });

    usePlaybackStore.getState().setFollowPlaybackEnabled(false);
    await Promise.resolve();
    await Promise.resolve();

    // The active session keeps the user's choice; saved stays at the last
    // confirmed value until an authoritative settings result reconciles it.
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(true);

    hydrate(false, true);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);
  });

  it('persists an explicit follow-on-start toggle and reverts on failure', async () => {
    usePlaybackStore.getState().toggleFollowPlaybackOnStart();
    await Promise.resolve();

    expect(usePlaybackStore.getState().followPlaybackOnStart).toBe(false);
    expect(playbackApi().updatePlaybackPreferences).toHaveBeenCalledWith({
      followPlaybackOnStart: false,
    });

    playbackApi().updatePlaybackPreferences.mockResolvedValue({ ok: false });
    usePlaybackStore.getState().toggleFollowPlaybackOnStart();
    await Promise.resolve();
    await Promise.resolve();

    expect(usePlaybackStore.getState().followPlaybackOnStart).toBe(false);
  });

  it('applies resolved follow values without a second settings write', () => {
    usePlaybackStore.getState().applyResolvedFollowPlayback(false);

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);
    expect(playbackApi().updatePlaybackPreferences).not.toHaveBeenCalled();

    usePlaybackStore.getState().applyResolvedFollowPlaybackOnStart(false);
    expect(usePlaybackStore.getState().followPlaybackOnStart).toBe(false);
    expect(playbackApi().updatePlaybackPreferences).not.toHaveBeenCalled();
  });

  it('suspends only the active session on manual navigation', () => {
    startConfirmedPlayback();

    usePlaybackStore.getState().suspendFollowForSession();

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(true);
    expect(playbackApi().syncFollowPlaybackState).toHaveBeenCalledWith(false);

    // Repeated suspension is a no-op and writes nothing further.
    playbackApi().syncFollowPlaybackState.mockClear();
    usePlaybackStore.getState().suspendFollowForSession();
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(playbackApi().syncFollowPlaybackState).not.toHaveBeenCalled();
  });

  it('retains suspended Follow through an internal restart (T052)', () => {
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Playing' });
    usePlaybackStore.getState().suspendFollowForSession();
    usePlaybackStore.getState().setStatus({ status: 'starting', message: 'Restarting' });
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Playing' });
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(true);
    expect(playbackApi().updatePlaybackPreferences).not.toHaveBeenCalled();
  });

  it('never suspends from navigation while stopped or already inactive', () => {
    usePlaybackStore.setState({ isPlaying: false, status: 'stopped' });
    usePlaybackStore.getState().suspendFollowForSession();
    expect(usePlaybackStore.getState().followPlayback).toBe(true);

    startConfirmedPlayback();
    usePlaybackStore.setState({ followPlayback: false });
    usePlaybackStore.getState().suspendFollowForSession();
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(true);
    expect(playbackApi().syncFollowPlaybackState).not.toHaveBeenCalled();
  });

  it('restores the saved preference when a session ends', () => {
    startConfirmedPlayback();
    usePlaybackStore.getState().suspendFollowForSession();
    expect(usePlaybackStore.getState().followPlayback).toBe(false);

    usePlaybackStore.getState().setStatus({ status: 'stopped', message: 'Stopped' });

    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(true);
    expect(playbackApi().syncFollowPlaybackState).toHaveBeenCalledWith(true);
  });

  it('restores the saved preference on playback error', () => {
    startConfirmedPlayback();
    usePlaybackStore.getState().suspendFollowForSession();

    usePlaybackStore.getState().setError('engine failure');

    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(playbackApi().syncFollowPlaybackState).toHaveBeenCalledWith(true);
  });

  it('applies follow-on-start only on a confirmed new session', async () => {
    seedProject(0);
    hydrate(false, true);
    expect(usePlaybackStore.getState().followPlayback).toBe(false);

    await usePlaybackStore.getState().togglePlay();

    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);
    expect(playbackApi().syncFollowPlaybackState).toHaveBeenCalledWith(true);
  });

  it('does not force follow on start when follow-on-start is disabled', async () => {
    seedProject(0);
    hydrate(false, false);

    await usePlaybackStore.getState().startFresh();

    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
  });

  it('never applies follow-on-start when the start fails', async () => {
    seedProject(0);
    hydrate(false, true);
    const api = window.blueAPI as unknown as { togglePlay: ReturnType<typeof vi.fn> };
    api.togglePlay.mockResolvedValueOnce(false);

    await usePlaybackStore.getState().togglePlay();

    expect(usePlaybackStore.getState().status).toBe('stopped');
    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(false);
    expect(playbackApi().syncFollowPlaybackState).not.toHaveBeenCalled();
  });

  it('keeps a suspension across loop boundaries and internal restarts', () => {
    startConfirmedPlayback();
    usePlaybackStore.getState().suspendFollowForSession();

    // Loop wrap / internal position restart: the playing session continues.
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Playing' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 2,
      sampleFrames: 1000,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });

    expect(usePlaybackStore.getState().followPlayback).toBe(false);
    expect(usePlaybackStore.getState().status).toBe('playing');
  });

  it('preserves hydrated follow preferences across runtime reset', () => {
    hydrate(false, false);
    startConfirmedPlayback();
    usePlaybackStore.getState().suspendFollowForSession();

    usePlaybackStore.getState().reset();

    expect(usePlaybackStore.getState()).toMatchObject({
      followPlayback: false,
      savedFollowPlayback: false,
      followPlaybackOnStart: false,
      status: 'idle',
    });
  });

  it('mirrors the restored follow state when reset ends a suspended session', () => {
    hydrate(true, true);
    startConfirmedPlayback();
    usePlaybackStore.getState().suspendFollowForSession();
    playbackApi().syncFollowPlaybackState.mockClear();

    usePlaybackStore.getState().reset();

    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(usePlaybackStore.getState().savedFollowPlayback).toBe(true);
    expect(playbackApi().syncFollowPlaybackState).toHaveBeenCalledWith(true);
  });

  it('never touches project document patches from follow actions', async () => {
    startConfirmedPlayback();
    usePlaybackStore.getState().setFollowPlaybackEnabled(false);
    usePlaybackStore.getState().suspendFollowForSession();
    usePlaybackStore.getState().setStatus({ status: 'stopped' });
    await Promise.resolve();

    expect(playbackApi().commitProjectDocumentPatches).not.toHaveBeenCalled();
  });

  it('defaults playbackFps to 30 and hydrates playbackFps from program settings', () => {
    expect(DEFAULT_PLAYBACK_FPS).toBe(30);
    expect(PLAYBACK_DISPLAY_TICK_MS).toBe(33);
    expect(usePlaybackStore.getState().playbackFps).toBe(30);
    expect(getPlaybackDisplayTickMs(30)).toBe(33);
    expect(getPlaybackDisplayTickMs(24)).toBe(42);
    expect(getPlaybackDisplayTickMs(60)).toBe(17);

    usePlaybackStore.getState().hydrateFromProgramSettings({
      schemaVersion: 1,
      general: {} as never,
      playback: {
        followPlayback: true,
        followPlaybackOnStart: true,
        playbackFps: 20,
        playbackLatencyCorrection: 0,
      },
    } as never);

    expect(usePlaybackStore.getState().playbackFps).toBe(20);
    expect(getPlaybackDisplayTickMs(usePlaybackStore.getState().playbackFps)).toBe(50);

    // Preserved across runtime reset
    usePlaybackStore.getState().reset();
    expect(usePlaybackStore.getState().playbackFps).toBe(20);
  });
});

describe('playback lifecycle transitions and atomic compatibility projection (US4 / T027)', () => {
  it('atomically projects coherent status, isPlaying, isAuditioning, mode, and message across phases', async () => {
    seedProject(8);

    // Initial state: idle
    const initial = usePlaybackStore.getState();
    expect(initial.lifecycle.phase).toBe('idle');
    expect(initial.status).toBe('idle');
    expect(initial.isPlaying).toBe(false);
    expect(initial.isAuditioning).toBe(false);
    expect(initial.mode).toBeNull();
    expect(initial.transportAnchor).toBeNull();

    // Normal starting
    const pendingPlay = usePlaybackStore.getState().togglePlay();
    const starting = usePlaybackStore.getState();
    expect(starting.lifecycle.phase).toBe('starting');
    expect(starting.status).toBe('starting');
    expect(starting.isPlaying).toBe(false);
    expect(starting.isAuditioning).toBe(false);
    expect(starting.mode).toBe('normal');
    expect(starting.message).toBe('Preparing playback...');
    expect(starting.transportAnchor?.renderStartTime).toBe(8);

    await pendingPlay;

    // Normal playing
    const playing = usePlaybackStore.getState();
    expect(playing.lifecycle.phase).toBe('playing');
    expect(playing.status).toBe('playing');
    expect(playing.isPlaying).toBe(true);
    expect(playing.isAuditioning).toBe(false);
    expect(playing.mode).toBe('normal');
    expect(playing.transportAnchor?.renderStartTime).toBe(8);

    // Stopping from playing
    await usePlaybackStore.getState().stop();
    const stopping = usePlaybackStore.getState();
    expect(stopping.lifecycle.phase).toBe('stopping');
    expect(stopping.status).toBe('stopping');
    expect(stopping.isPlaying).toBe(true);
    expect(stopping.isAuditioning).toBe(false);
    expect(stopping.mode).toBe('normal');

    // Stopped
    usePlaybackStore.getState().setStatus({ status: 'stopped', message: 'Engine finished' });
    const stopped = usePlaybackStore.getState();
    expect(stopped.lifecycle.phase).toBe('stopped');
    expect(stopped.status).toBe('stopped');
    expect(stopped.isPlaying).toBe(false);
    expect(stopped.isAuditioning).toBe(false);
    expect(stopped.mode).toBeNull();
    expect(stopped.transportAnchor).toBeNull();

    // Audition starting
    const pendingAudition = usePlaybackStore.getState().auditionScoreObjects(['sobj-1']);
    const startingAudition = usePlaybackStore.getState();
    expect(startingAudition.lifecycle.phase).toBe('starting');
    expect(startingAudition.status).toBe('starting');
    expect(startingAudition.isPlaying).toBe(false);
    expect(startingAudition.isAuditioning).toBe(true);
    expect(startingAudition.mode).toBe('audition');
    expect(startingAudition.transportAnchor).toBeNull();

    await pendingAudition;
    const playingAudition = usePlaybackStore.getState();
    expect(playingAudition.lifecycle.phase).toBe('playing');
    expect(playingAudition.status).toBe('playing');
    expect(playingAudition.isPlaying).toBe(true);
    expect(playingAudition.isAuditioning).toBe(true);
    expect(playingAudition.mode).toBe('audition');

    // Audition explicit stop clears audition indication
    await usePlaybackStore.getState().stopAuditioning();
    const stoppingAudition = usePlaybackStore.getState();
    expect(stoppingAudition.lifecycle.phase).toBe('stopping');
    expect(stoppingAudition.status).toBe('stopping');
    expect(stoppingAudition.isPlaying).toBe(true);
    expect(stoppingAudition.isAuditioning).toBe(false);
  });

  it('translates setPlaying into coherent current-mode transitions rather than writing a lone boolean', () => {
    seedProject(4);

    // 1. setPlaying(true) from starting transitions to playing
    usePlaybackStore.getState().setStatus({ status: 'starting', message: 'Starting...' });
    expect(usePlaybackStore.getState().status).toBe('starting');
    expect(usePlaybackStore.getState().isPlaying).toBe(false);

    usePlaybackStore.getState().setPlaying(true);
    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
    expect(usePlaybackStore.getState().mode).toBe('normal');

    // 2. setPlaying(false) from playing transitions to stopped and resets clock/display/anchor
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 100,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock).not.toBeNull();

    usePlaybackStore.getState().setPlaying(false);
    expect(usePlaybackStore.getState().status).toBe('stopped');
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
    expect(usePlaybackStore.getState().clock).toBeNull();
    expect(usePlaybackStore.getState().display).toBe(IDLE_PLAYBACK_DISPLAY);
    expect(usePlaybackStore.getState().transportAnchor).toBeNull();

    // 3. setPlaying(true) from stopped starts coherent playing session
    usePlaybackStore.getState().setPlaying(true);
    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
    expect(usePlaybackStore.getState().mode).toBe('normal');
    expect(usePlaybackStore.getState().transportAnchor?.renderStartTime).toBe(4);
  });

  it('preserves omitted mode and transport anchor on partial non-terminal status updates', () => {
    seedProject(10);

    // Start audition with anchor renderStartTime 12
    usePlaybackStore.getState().setStatus({
      status: 'starting',
      auditioning: true,
      renderStartTime: 12,
    });
    expect(usePlaybackStore.getState().isAuditioning).toBe(true);
    expect(usePlaybackStore.getState().mode).toBe('audition');
    expect(usePlaybackStore.getState().transportAnchor?.renderStartTime).toBe(12);

    // Host sends playing status omitting auditioning and renderStartTime
    usePlaybackStore.getState().setStatus({
      status: 'playing',
      message: 'CSound active',
    });
    expect(usePlaybackStore.getState().isAuditioning).toBe(true);
    expect(usePlaybackStore.getState().mode).toBe('audition');
    expect(usePlaybackStore.getState().transportAnchor?.renderStartTime).toBe(12);
    expect(usePlaybackStore.getState().message).toBe('CSound active');

    // Host sends explicit anchor update
    usePlaybackStore.getState().setStatus({
      status: 'playing',
      renderStartTime: 24,
    });
    expect(usePlaybackStore.getState().transportAnchor?.renderStartTime).toBe(24);
    expect(usePlaybackStore.getState().transportAnchor?.tempoMap.points.length).toBeGreaterThan(0);
    expect(usePlaybackStore.getState().isAuditioning).toBe(true);
  });

  it('handles both confirmation orders (status-first vs reply-first) with early clocks', async () => {
    seedProject(0);
    hydrate(false, true);

    // Case A: Status arrives before local start reply
    let resolvePlayA: (value: boolean) => void = () => {};
    (playbackApi() as any).togglePlay.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePlayA = resolve;
        }),
    );

    const pendingA = usePlaybackStore.getState().togglePlay();
    expect(usePlaybackStore.getState().status).toBe('starting');

    // Early clock arrives while starting
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 500,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(500);

    // Authoritative host status arrives first
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Engine running' });
    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(500);
    expect(usePlaybackStore.getState().followPlayback).toBe(true);
    expect(playbackApi().syncFollowPlaybackState).toHaveBeenCalledWith(true);

    // Drain microtasks so togglePlay IPC was reached
    await Promise.resolve();
    await Promise.resolve();

    // Later, local start reply resolves
    playbackApi().syncFollowPlaybackState.mockClear();
    resolvePlayA(true);
    await pendingA;

    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(500);
    // Follow-on-start was NOT reapplied
    expect(playbackApi().syncFollowPlaybackState).not.toHaveBeenCalled();

    // Clean up for Case B
    usePlaybackStore.getState().setStatus({ status: 'stopped' });
    hydrate(false, true);

    // Case B: Local start reply arrives before host status
    (playbackApi() as any).togglePlay.mockResolvedValue(true);
    const pendingB = usePlaybackStore.getState().togglePlay();

    // Early clock arrives while starting
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 2,
      sampleFrames: 1000,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });

    await pendingB;
    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(1000);
    expect(usePlaybackStore.getState().followPlayback).toBe(true);

    // Host status arrives later
    playbackApi().syncFollowPlaybackState.mockClear();
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Engine confirmed' });
    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(1000);
    expect(playbackApi().syncFollowPlaybackState).not.toHaveBeenCalled();
  });

  it('fences local start replies and errors by attempt identity', async () => {
    seedProject(0);

    let resolveFirst: (value: boolean) => void = () => {};
    (playbackApi() as any).togglePlay.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    // Attempt 1 starts
    const firstPending = usePlaybackStore.getState().togglePlay();
    expect(usePlaybackStore.getState().status).toBe('starting');

    // Attempt 2 supersedes attempt 1
    (playbackApi() as any).restartPlayback.mockResolvedValueOnce(true);
    await usePlaybackStore.getState().startFresh();
    expect(usePlaybackStore.getState().status).toBe('playing');

    // Attempt 1 now finishes with false (failure)
    resolveFirst(false);
    await firstPending;

    // Current playing state must not be stopped by old attempt 1!
    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
  });

  it('preserves confirmed activity on local and host stop transitions', async () => {
    seedProject(0);

    // 1. Local stop during unconfirmed starting -> wasPlaying = false, isPlaying = false
    let resolvePlay: (value: boolean) => void = () => {};
    (playbackApi() as any).togglePlay.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePlay = resolve;
        }),
    );

    const pending = usePlaybackStore.getState().togglePlay();
    expect(usePlaybackStore.getState().status).toBe('starting');
    expect(usePlaybackStore.getState().isPlaying).toBe(false);

    await usePlaybackStore.getState().stop();
    expect(usePlaybackStore.getState().status).toBe('stopping');
    expect(usePlaybackStore.getState().isPlaying).toBe(false);

    resolvePlay(true);
    await pending;

    // 2. Local stop after confirmed playing -> wasPlaying = true, isPlaying = true
    usePlaybackStore.getState().setStatus({ status: 'playing' });
    expect(usePlaybackStore.getState().isPlaying).toBe(true);

    await usePlaybackStore.getState().stop();
    expect(usePlaybackStore.getState().status).toBe('stopping');
    expect(usePlaybackStore.getState().isPlaying).toBe(true);

    // 3. Host stopping status is authoritative evidence that playback ran
    usePlaybackStore.getState().setStatus({ status: 'stopped' });
    usePlaybackStore.getState().setStatus({ status: 'stopping' });
    expect(usePlaybackStore.getState().status).toBe('stopping');
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
  });

  it('rejects clock frames while terminal, rejects retired sessions, and enforces sequence monotonicity', () => {
    // 1. Rejected while stopped
    usePlaybackStore.getState().setStatus({ status: 'stopped' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 100,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock).toBeNull();
    expect(usePlaybackStore.getState().display).toBe(IDLE_PLAYBACK_DISPLAY);

    // 2. Rejected while error
    usePlaybackStore.getState().setError('Error state');
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 100,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock).toBeNull();

    // 3. Active session 1 accepts clock
    usePlaybackStore.getState().setStatus({ status: 'playing' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 100,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(100);

    // Sequence moving backward is rejected
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 50,
      sequence: 0,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(100);

    // Sequence moving forward is accepted
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 200,
      sequence: 2,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(200);

    // Session 1 stops -> session 1 retired
    usePlaybackStore.getState().setStatus({ status: 'stopped' });

    // Late frame from retired session 1 is rejected even if new starting status arrives
    usePlaybackStore.getState().setStatus({ status: 'starting' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 300,
      sequence: 3,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock).toBeNull();

    // New session 2 arrives -> accepted
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 2,
      sampleFrames: 0,
      sequence: 0,
      sampleRate: 48000,
      ksmps: 32,
    });
    expect(usePlaybackStore.getState().clock?.sessionId).toBe(2);
    expect(usePlaybackStore.getState().clock?.sampleRate).toBe(48000);

    // Session 3 arrives with undefined sampleRate -> does NOT leak session 2's sampleRate
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 3,
      sampleFrames: 0,
      sequence: 0,
    });
    expect(usePlaybackStore.getState().clock?.sessionId).toBe(3);
    expect(usePlaybackStore.getState().clock?.sampleRate).toBeNull();
  });

  it('preserves retired-session watermark across ordinary lifecycle resets', () => {
    // Start session 1 and stop it
    usePlaybackStore.getState().setStatus({ status: 'playing' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 500,
      sequence: 5,
      sampleRate: 44100,
      ksmps: 64,
    });
    usePlaybackStore.getState().setStatus({ status: 'stopped' });

    // Reset store (e.g. project reload)
    usePlaybackStore.getState().reset();

    // Session 1 late frame must be rejected because watermark was preserved across reset
    usePlaybackStore.getState().setStatus({ status: 'starting' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 600,
      sequence: 6,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock).toBeNull();

    // New session 2 frame is accepted
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 2,
      sampleFrames: 0,
      sequence: 0,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock?.sessionId).toBe(2);
  });

  it('reuses a frozen idle display value without mutating it and keeps display ticks from recreating lifecycle state', () => {
    usePlaybackStore.getState().reset();
    const idleDisplay1 = usePlaybackStore.getState().display;
    expect(idleDisplay1).toBe(IDLE_PLAYBACK_DISPLAY);
    expect(Object.isFrozen(idleDisplay1)).toBe(true);

    usePlaybackStore.getState().setStatus({ status: 'stopped' });
    const idleDisplay2 = usePlaybackStore.getState().display;
    expect(idleDisplay2).toBe(IDLE_PLAYBACK_DISPLAY);

    usePlaybackStore.getState().setError('engine error');
    const idleDisplay3 = usePlaybackStore.getState().display;
    expect(idleDisplay3).toBe(IDLE_PLAYBACK_DISPLAY);

    // During playback, tickDisplay updates display without recreating lifecycle
    usePlaybackStore.getState().setStatus({ status: 'playing' });
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 0,
      sequence: 0,
      sampleRate: 44100,
      ksmps: 64,
    });

    const lifecycleBeforeTick = usePlaybackStore.getState().lifecycle;
    vi.advanceTimersByTime(100);
    usePlaybackStore.getState().tickDisplay();

    expect(usePlaybackStore.getState().lifecycle).toBe(lifecycleBeforeTick);
  });

  it('rejects playback clocks in idle as well as stopped/error and does not revive live display (T042 / F11)', () => {
    // 1. idle-before-first-clock: clock arriving while in initial idle state
    expect(usePlaybackStore.getState().status).toBe('idle');
    expect(usePlaybackStore.getState().clock).toBeNull();
    expect(usePlaybackStore.getState().display).toBe(IDLE_PLAYBACK_DISPLAY);

    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 100,
      sequence: 0,
      sampleRate: 44100,
      ksmps: 64,
    });

    // Clock must be rejected, display remains idle-anchor, and status remains idle
    expect(usePlaybackStore.getState().status).toBe('idle');
    expect(usePlaybackStore.getState().clock).toBeNull();
    expect(usePlaybackStore.getState().display).toBe(IDLE_PLAYBACK_DISPLAY);
    expect(usePlaybackStore.getState().display.source).toBe('idle-anchor');

    // 2. ended-performance-with-no-previous-clock: session starts, stops before any clock arrives
    usePlaybackStore.getState().setStatus({ status: 'starting', message: 'Preparing playback...' });
    expect(usePlaybackStore.getState().status).toBe('starting');
    expect(usePlaybackStore.getState().clock).toBeNull();

    // Performance ends with no clock ever delivered
    usePlaybackStore.getState().setStatus({ status: 'stopped', message: '' });
    expect(usePlaybackStore.getState().status).toBe('stopped');
    expect(usePlaybackStore.getState().clock).toBeNull();
    expect(usePlaybackStore.getState().display).toBe(IDLE_PLAYBACK_DISPLAY);

    // Late clock from the ended performance arrives
    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 250,
      sequence: 0,
      sampleRate: 44100,
      ksmps: 64,
    });

    // Clock must still be rejected and display not revived
    expect(usePlaybackStore.getState().clock).toBeNull();
    expect(usePlaybackStore.getState().display).toBe(IDLE_PLAYBACK_DISPLAY);
    expect(usePlaybackStore.getState().display.source).toBe('idle-anchor');

    // Reset back to idle: another late clock must still be rejected
    usePlaybackStore.getState().reset();
    expect(usePlaybackStore.getState().status).toBe('idle');

    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 1,
      sampleFrames: 300,
      sequence: 1,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock).toBeNull();
    expect(usePlaybackStore.getState().display).toBe(IDLE_PLAYBACK_DISPLAY);

    // 3. Early clocks during starting ARE accepted and retained
    usePlaybackStore.getState().setStatus({ status: 'starting', message: 'Preparing playback...' });
    expect(usePlaybackStore.getState().status).toBe('starting');

    usePlaybackStore.getState().acceptPlaybackClock({
      sessionId: 2,
      sampleFrames: 50,
      sequence: 0,
      sampleRate: 44100,
      ksmps: 64,
    });
    expect(usePlaybackStore.getState().clock?.sessionId).toBe(2);
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(50);
    expect(usePlaybackStore.getState().display.source).toBe('engine-authority');

    // Retained when host reports playing
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Playing' });
    expect(usePlaybackStore.getState().status).toBe('playing');
    expect(usePlaybackStore.getState().clock?.sessionId).toBe(2);
    expect(usePlaybackStore.getState().clock?.sampleFrames).toBe(50);
  });

  describe('deferred-flush Stop revokes undispatched start work (T043 / F12)', () => {
    it('revokes undispatched togglePlay when Stop is requested while patch flushing is pending', async () => {
      seedProject(0);

      let resolveFlush: () => void = () => {};
      const flushSpy = vi
        .spyOn(useProjectStore.getState(), 'flushPendingPatches')
        .mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              resolveFlush = resolve;
            }),
        );

      const togglePlayPromise = usePlaybackStore.getState().togglePlay();
      expect(usePlaybackStore.getState().status).toBe('starting');

      // Stop requested while patch flush is pending
      await usePlaybackStore.getState().stop();
      expect(usePlaybackStore.getState().status).toBe('stopping');
      expect((playbackApi() as any).stopPlayback).toHaveBeenCalledTimes(1);

      // Now patch flush resolves
      resolveFlush();
      await togglePlayPromise;

      // togglePlay IPC must NOT be called after Stop was requested!
      expect((playbackApi() as any).togglePlay).not.toHaveBeenCalled();
      expect(usePlaybackStore.getState().status).toBe('stopping');

      flushSpy.mockRestore();
    });

    it('revokes undispatched startFresh when Stop is requested while patch flushing is pending', async () => {
      seedProject(0);

      let resolveFlush: () => void = () => {};
      const flushSpy = vi
        .spyOn(useProjectStore.getState(), 'flushPendingPatches')
        .mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              resolveFlush = resolve;
            }),
        );

      const startFreshPromise = usePlaybackStore.getState().startFresh();
      expect(usePlaybackStore.getState().status).toBe('starting');

      // Stop requested while patch flush is pending
      await usePlaybackStore.getState().stop();
      expect(usePlaybackStore.getState().status).toBe('stopping');
      expect((playbackApi() as any).stopPlayback).toHaveBeenCalledTimes(1);

      // Now patch flush resolves
      resolveFlush();
      await startFreshPromise;

      // restartPlayback IPC must NOT be called after Stop was requested!
      expect((playbackApi() as any).restartPlayback).not.toHaveBeenCalled();
      expect(usePlaybackStore.getState().status).toBe('stopping');

      flushSpy.mockRestore();
    });

    it('revokes undispatched auditionScoreObjects when Stop is requested while patch flushing is pending', async () => {
      seedProject(0);

      let resolveFlush: () => void = () => {};
      const flushSpy = vi
        .spyOn(useProjectStore.getState(), 'flushPendingPatches')
        .mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              resolveFlush = resolve;
            }),
        );

      const auditionPromise = usePlaybackStore.getState().auditionScoreObjects(['obj-1', 'obj-2']);
      expect(usePlaybackStore.getState().status).toBe('starting');
      expect(usePlaybackStore.getState().isAuditioning).toBe(true);

      // Stop requested while patch flush is pending
      await usePlaybackStore.getState().stop();
      expect(usePlaybackStore.getState().status).toBe('stopping');
      expect(usePlaybackStore.getState().isAuditioning).toBe(false);
      expect((playbackApi() as any).stopPlayback).toHaveBeenCalledTimes(1);

      // Now patch flush resolves
      resolveFlush();
      await auditionPromise;

      // auditionScoreObjects IPC must NOT be called; no stopPlayback followed by auditionScoreObjects!
      expect((playbackApi() as any).auditionScoreObjects).not.toHaveBeenCalled();
      expect(usePlaybackStore.getState().status).toBe('stopping');
      expect(usePlaybackStore.getState().isAuditioning).toBe(false);

      flushSpy.mockRestore();
    });

    it('retains separate handling for a start already dispatched when Stop is requested in flight', async () => {
      seedProject(0);

      let resolvePlayIpc: (value: boolean) => void = () => {};
      (playbackApi() as any).togglePlay.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolvePlayIpc = resolve;
          }),
      );

      const playPromise = usePlaybackStore.getState().togglePlay();

      // Flush completes immediately; togglePlay IPC was dispatched
      await Promise.resolve();
      await Promise.resolve();
      expect((playbackApi() as any).togglePlay).toHaveBeenCalledTimes(1);
      expect(usePlaybackStore.getState().status).toBe('starting');

      // Stop is called while togglePlay IPC is in flight
      await usePlaybackStore.getState().stop();
      expect(usePlaybackStore.getState().status).toBe('stopping');
      expect((playbackApi() as any).stopPlayback).toHaveBeenCalledTimes(1);

      // Dispatched togglePlay IPC now resolves
      resolvePlayIpc(true);
      await playPromise;

      // Must remain in stopping, not playing, and follow must not be applied
      expect(usePlaybackStore.getState().status).toBe('stopping');
      expect(usePlaybackStore.getState().isPlaying).toBe(false);
      expect(playbackApi().syncFollowPlaybackState).not.toHaveBeenCalled();
    });
  });

  describe('pure playback lifecycle transition table (T045 / F14)', () => {
    it('hasStartingAuthority requires phase starting and matching attemptId', () => {
      const starting: PlaybackLifecycle = {
        phase: 'starting',
        attemptId: 42,
        mode: 'normal',
        message: 'Preparing...',
        transportAnchor: null,
        confirmedActive: false,
        followApplied: false,
      };
      expect(hasStartingAuthority(starting, 42)).toBe(true);
      expect(hasStartingAuthority(starting, 99)).toBe(false);

      const stopping: PlaybackLifecycle = {
        phase: 'stopping',
        attemptId: 42,
        mode: 'normal',
        message: 'Stopping...',
        transportAnchor: null,
        wasPlaying: false,
      };
      expect(hasStartingAuthority(stopping, 42)).toBe(false);

      const idle: PlaybackLifecycle = { phase: 'idle', message: '' };
      expect(hasStartingAuthority(idle, 42)).toBe(false);

      const playing: PlaybackLifecycle = {
        phase: 'playing',
        attemptId: 42,
        mode: 'normal',
        message: 'Playing',
        transportAnchor: null,
        followApplied: true,
      };
      expect(hasStartingAuthority(playing, 42)).toBe(false);
    });

    it('exercises the transition table across all phases and events', () => {
      const idle: PlaybackLifecycle = { phase: 'idle', message: '' };
      const stopped: PlaybackLifecycle = { phase: 'stopped', message: '' };
      const error: PlaybackLifecycle = { phase: 'error', message: 'Engine error' };
      const startingNormal: PlaybackLifecycle = {
        phase: 'starting',
        attemptId: 10,
        mode: 'normal',
        message: 'Preparing...',
        transportAnchor: null,
        confirmedActive: false,
        followApplied: false,
      };
      const startingAudition: PlaybackLifecycle = {
        phase: 'starting',
        attemptId: 11,
        mode: 'audition',
        message: 'Preparing audition...',
        transportAnchor: null,
        confirmedActive: false,
        followApplied: false,
      };
      const playingNormal: PlaybackLifecycle = {
        phase: 'playing',
        attemptId: 10,
        mode: 'normal',
        message: 'Playing',
        transportAnchor: null,
        followApplied: true,
      };
      const stoppingUnconfirmed: PlaybackLifecycle = {
        phase: 'stopping',
        attemptId: 10,
        mode: 'normal',
        message: 'Stopping...',
        transportAnchor: null,
        wasPlaying: false,
      };
      const stoppingConfirmed: PlaybackLifecycle = {
        phase: 'stopping',
        attemptId: 10,
        mode: 'normal',
        message: 'Stopping...',
        transportAnchor: null,
        wasPlaying: true,
      };

      // 1. start-requested from any state produces starting with specified mode and attempt
      const fromIdle = transitionPlaybackLifecycle(idle, {
        type: 'start-requested',
        attemptId: 1,
        mode: 'normal',
      });
      expect(fromIdle.phase).toBe('starting');
      expect((fromIdle as any).attemptId).toBe(1);
      expect((fromIdle as any).mode).toBe('normal');

      const auditionFromStopped = transitionPlaybackLifecycle(stopped, {
        type: 'start-requested',
        attemptId: 2,
        mode: 'audition',
      });
      expect(auditionFromStopped.phase).toBe('starting');
      expect((auditionFromStopped as any).mode).toBe('audition');

      // 2. start-confirmed
      // Success on matching starting attempt -> playing
      const confirmedPlay = transitionPlaybackLifecycle(startingNormal, {
        type: 'start-confirmed',
        attemptId: 10,
        playing: true,
      });
      expect(confirmedPlay.phase).toBe('playing');
      expect((confirmedPlay as any).attemptId).toBe(10);
      expect((confirmedPlay as any).mode).toBe('normal');

      // Declined on matching starting attempt -> stopped
      const declinedPlay = transitionPlaybackLifecycle(startingNormal, {
        type: 'start-confirmed',
        attemptId: 10,
        playing: false,
      });
      expect(declinedPlay.phase).toBe('stopped');

      // Stale attempt start-confirmed is ignored
      const staleReply = transitionPlaybackLifecycle(startingNormal, {
        type: 'start-confirmed',
        attemptId: 999,
        playing: true,
      });
      expect(staleReply).toBe(startingNormal);

      // Start confirmed while stopping is ignored
      const stoppingReply = transitionPlaybackLifecycle(stoppingUnconfirmed, {
        type: 'start-confirmed',
        attemptId: 10,
        playing: true,
      });
      expect(stoppingReply).toBe(stoppingUnconfirmed);

      // 3. stop-requested
      // During unconfirmed starting -> wasPlaying = false, auditionExplicitlyCleared = true
      const stopFromStarting = transitionPlaybackLifecycle(startingAudition, {
        type: 'stop-requested',
      });
      expect(stopFromStarting.phase).toBe('stopping');
      expect((stopFromStarting as any).wasPlaying).toBe(false);
      expect((stopFromStarting as any).auditionExplicitlyCleared).toBe(true);

      // During playing -> wasPlaying = true
      const stopFromPlaying = transitionPlaybackLifecycle(playingNormal, {
        type: 'stop-requested',
      });
      expect(stopFromPlaying.phase).toBe('stopping');
      expect((stopFromPlaying as any).wasPlaying).toBe(true);

      // During terminal -> no-op
      expect(transitionPlaybackLifecycle(idle, { type: 'stop-requested' })).toBe(idle);
      expect(transitionPlaybackLifecycle(stopped, { type: 'stop-requested' })).toBe(stopped);
      expect(transitionPlaybackLifecycle(error, { type: 'stop-requested' })).toBe(error);

      // 4. status-reported
      // Host reported starting: updates partial fields
      const hostStarting = transitionPlaybackLifecycle(startingNormal, {
        type: 'status-reported',
        status: 'starting',
        message: 'Host compiling...',
      });
      expect(hostStarting.phase).toBe('starting');
      expect(hostStarting.message).toBe('Host compiling...');

      // Host reported playing: confirms playing
      const hostPlaying = transitionPlaybackLifecycle(startingNormal, {
        type: 'status-reported',
        status: 'playing',
        message: 'Host active',
      });
      expect(hostPlaying.phase).toBe('playing');
      expect(hostPlaying.message).toBe('Host active');

      // Host reported stopping: authoritative evidence of prior activity (wasPlaying = true)
      const hostStopping = transitionPlaybackLifecycle(idle, {
        type: 'status-reported',
        status: 'stopping',
      });
      expect(hostStopping.phase).toBe('stopping');
      expect((hostStopping as any).wasPlaying).toBe(true);

      // Host reported stopped / idle / error
      const hostStopped = transitionPlaybackLifecycle(playingNormal, {
        type: 'status-reported',
        status: 'stopped',
      });
      expect(hostStopped.phase).toBe('stopped');

      const hostIdle = transitionPlaybackLifecycle(stoppingConfirmed, {
        type: 'status-reported',
        status: 'idle',
      });
      expect(hostIdle.phase).toBe('idle');

      const hostError = transitionPlaybackLifecycle(playingNormal, {
        type: 'status-reported',
        status: 'error',
        message: 'Csound crashed',
      });
      expect(hostError.phase).toBe('error');
      expect(hostError.message).toBe('Csound crashed');

      // 5. set-playing-requested compatibility
      // setPlaying(true) from terminal -> playing normal
      const setPlayingTerminal = transitionPlaybackLifecycle(stopped, {
        type: 'set-playing-requested',
        playing: true,
        attemptId: 50,
      });
      expect(setPlayingTerminal.phase).toBe('playing');
      expect((setPlayingTerminal as any).mode).toBe('normal');

      // setPlaying(true) from starting -> playing
      const setPlayingStarting = transitionPlaybackLifecycle(startingAudition, {
        type: 'set-playing-requested',
        playing: true,
      });
      expect(setPlayingStarting.phase).toBe('playing');
      expect((setPlayingStarting as any).mode).toBe('audition');

      // setPlaying(true) from stopping -> preserves stopping, sets wasPlaying = true
      const setPlayingStopping = transitionPlaybackLifecycle(stoppingUnconfirmed, {
        type: 'set-playing-requested',
        playing: true,
      });
      expect(setPlayingStopping.phase).toBe('stopping');
      expect((setPlayingStopping as any).wasPlaying).toBe(true);

      // setPlaying(false) from active -> stopped
      const setPlayingFalse = transitionPlaybackLifecycle(playingNormal, {
        type: 'set-playing-requested',
        playing: false,
      });
      expect(setPlayingFalse.phase).toBe('stopped');

      // 6. error-occurred & reset-requested
      const errState = transitionPlaybackLifecycle(playingNormal, {
        type: 'error-occurred',
        message: 'Device lost',
      });
      expect(errState.phase).toBe('error');
      expect(errState.message).toBe('Device lost');

      const resetState = transitionPlaybackLifecycle(errState, {
        type: 'reset-requested',
      });
      expect(resetState.phase).toBe('idle');
      expect(resetState.message).toBe('');

      // 7. Atomic projections match contract
      const projIdle = projectPlaybackLifecycle(idle);
      expect(projIdle).toEqual({
        status: 'idle',
        isPlaying: false,
        isAuditioning: false,
        message: '',
        transportAnchor: null,
        mode: null,
      });

      const projStartingAud = projectPlaybackLifecycle(startingAudition);
      expect(projStartingAud).toEqual({
        status: 'starting',
        isPlaying: false,
        isAuditioning: true,
        message: 'Preparing audition...',
        transportAnchor: null,
        mode: 'audition',
      });

      const projStoppingCleared = projectPlaybackLifecycle({
        ...stoppingUnconfirmed,
        mode: 'audition',
        auditionExplicitlyCleared: true,
      });
      expect(projStoppingCleared.isAuditioning).toBe(false);
      expect(projStoppingCleared.isPlaying).toBe(false);
    });
  });
});
