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
  useProjectStore.getState().clearProject();
  (window as typeof window & { blueAPI?: unknown }).blueAPI = {
    togglePlay: vi.fn().mockResolvedValue(true),
    restartPlayback: vi.fn().mockResolvedValue(true),
    stopPlayback: vi.fn().mockResolvedValue(undefined),
  };
});

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
});
