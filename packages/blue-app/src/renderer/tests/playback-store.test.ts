// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  derivePlaybackDisplayState,
  usePlaybackStore,
} from '../stores/playback-store';
import { createEmptyProjectEditorSnapshot } from '../../shared/project-editor';
import { useProjectStore } from '../stores/project-store';

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
  usePlaybackStore.getState().reset();
  usePlaybackStore.setState({
    followPlayback: true,
    savedFollowPlayback: true,
    followPlaybackOnStart: true,
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
    usePlaybackStore.getState().setStatus({ status: 'playing', message: 'Playing via blue-engine' });

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
});
