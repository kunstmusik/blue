import { describe, expect, it, vi } from 'vitest';
import { OscCommandRouter } from '../services/osc-command-router';
import type { OscCommandEvent } from '../../shared/osc-control';

function event(commandId: OscCommandEvent['commandId'], sequence = 1): OscCommandEvent {
  return {
    sequence,
    commandId,
    receivedAddress: '/test',
    receivedAt: new Date().toISOString(),
  };
}

function makeRouter(options: { loaded?: boolean; running?: boolean } = {}) {
  const calls: string[] = [];
  const project = {
    loaded: options.loaded ?? true,
    flushPendingPatches: vi.fn(async () => { calls.push('flush'); }),
    rewindToStart: vi.fn(() => { calls.push('rewind'); }),
    navigateToNextMarker: vi.fn(() => { calls.push('next'); }),
    navigateToPreviousMarker: vi.fn(() => { calls.push('previous'); }),
  };
  const playback = {
    startFresh: vi.fn(async () => { calls.push('play'); }),
    stop: vi.fn(async () => { calls.push('stop'); }),
  };
  const blueLive = { running: options.running ?? false };
  const api = {
    toggleBlueLive: vi.fn(async () => { calls.push('live-toggle'); }),
    recompileBlueLive: vi.fn(async () => { calls.push('live-recompile'); }),
    sendBlueLiveAllNotesOff: vi.fn(async () => { calls.push('live-all-notes-off'); }),
  };
  const onError = vi.fn();
  return {
    calls,
    project,
    playback,
    blueLive,
    api,
    onError,
    router: new OscCommandRouter({
      getProject: () => project,
      getPlayback: () => playback,
      getBlueLive: () => blueLive,
      blueLiveApi: api,
      onError,
    }),
  };
}

describe('OscCommandRouter', () => {
  it('serializes score range changes before fresh playback', async () => {
    const harness = makeRouter();
    await Promise.all([
      harness.router.dispatch(event('score.rewind', 1)),
      harness.router.dispatch(event('score.play', 2)),
    ]);

    expect(harness.calls).toEqual(['rewind', 'flush', 'flush', 'play']);
  });

  it('stops regular playback even with no project but no-ops project-dependent score commands', async () => {
    const harness = makeRouter({ loaded: false });
    await harness.router.dispatch(event('score.stop'));
    await harness.router.dispatch(event('score.markerNext'));
    await harness.router.dispatch(event('score.play'));

    expect(harness.playback.stop).toHaveBeenCalledOnce();
    expect(harness.project.navigateToNextMarker).not.toHaveBeenCalled();
    expect(harness.playback.startFresh).not.toHaveBeenCalled();
  });

  it('routes both marker directions through their canonical actions and flushes each patch', async () => {
    const harness = makeRouter();
    await harness.router.dispatch(event('score.markerNext', 1));
    await harness.router.dispatch(event('score.markerPrevious', 2));

    expect(harness.project.navigateToNextMarker).toHaveBeenCalledOnce();
    expect(harness.project.navigateToPreviousMarker).toHaveBeenCalledOnce();
    expect(harness.project.flushPendingPatches).toHaveBeenCalledTimes(2);
  });

  it('routes all retained Blue Live commands under their preconditions', async () => {
    const harness = makeRouter({ loaded: true, running: true });
    await harness.router.dispatch(event('blueLive.onOff', 1));
    await harness.router.dispatch(event('blueLive.recompile', 2));
    await harness.router.dispatch(event('blueLive.allNotesOff', 3));

    expect(harness.api.toggleBlueLive).toHaveBeenCalledOnce();
    expect(harness.api.recompileBlueLive).toHaveBeenCalledOnce();
    expect(harness.api.sendBlueLiveAllNotesOff).toHaveBeenCalledOnce();
  });

  it('does not start/recompile Blue Live without a project or send notes while stopped', async () => {
    const harness = makeRouter({ loaded: false, running: false });
    await harness.router.dispatch(event('blueLive.onOff', 1));
    await harness.router.dispatch(event('blueLive.recompile', 2));
    await harness.router.dispatch(event('blueLive.allNotesOff', 3));

    expect(harness.api.toggleBlueLive).not.toHaveBeenCalled();
    expect(harness.api.recompileBlueLive).not.toHaveBeenCalled();
    expect(harness.api.sendBlueLiveAllNotesOff).not.toHaveBeenCalled();
  });

  it('catches one command failure and continues processing later commands', async () => {
    const harness = makeRouter();
    harness.playback.startFresh.mockRejectedValueOnce(new Error('engine unavailable'));

    await Promise.all([
      harness.router.dispatch(event('score.play', 1)),
      harness.router.dispatch(event('score.stop', 2)),
    ]);

    expect(harness.onError).toHaveBeenCalledOnce();
    expect(harness.playback.stop).toHaveBeenCalledOnce();
  });
});
