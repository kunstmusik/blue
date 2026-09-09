import { describe, expect, it, vi } from 'vitest';
import { syncRuntimeChannel } from './runtime-channel-sync';

describe('syncRuntimeChannel', () => {
  it('fans a BSB channel update out to timeline playback and Blue Live', async () => {
    const timelineSetChannel = vi.fn().mockResolvedValue(undefined);
    const blueLiveSetChannel = vi.fn().mockResolvedValue(undefined);

    await syncRuntimeChannel(
      'gk_blue_auto2',
      0.75,
      {
        isCurrentlyPlaying: () => true,
        setChannel: timelineSetChannel,
      },
      {
        isRunning: () => true,
        setChannel: blueLiveSetChannel,
      },
    );

    expect(timelineSetChannel).toHaveBeenCalledOnce();
    expect(timelineSetChannel).toHaveBeenCalledWith('gk_blue_auto2', 0.75);
    expect(blueLiveSetChannel).toHaveBeenCalledOnce();
    expect(blueLiveSetChannel).toHaveBeenCalledWith('gk_blue_auto2', 0.75);
  });

  it('skips inactive engine sessions', async () => {
    const timelineSetChannel = vi.fn().mockResolvedValue(undefined);
    const blueLiveSetChannel = vi.fn().mockResolvedValue(undefined);

    const result = await syncRuntimeChannel(
      'gk_blue_auto2',
      0.5,
      {
        isCurrentlyPlaying: () => false,
        setChannel: timelineSetChannel,
      },
      {
        isRunning: () => false,
        setChannel: blueLiveSetChannel,
      },
    );

    expect(timelineSetChannel).not.toHaveBeenCalled();
    expect(blueLiveSetChannel).not.toHaveBeenCalled();
    // Skipped engines are reported, not silently ignored (T042).
    expect(result.routedTo).toEqual([]);
    expect(result.outcomes).toEqual([
      { target: 'timeline', ok: false, message: 'Timeline engine not playing' },
      { target: 'blueLive', ok: false, message: 'Blue Live not running' },
    ]);
  });

  it('reports a rejected write as failed instead of successful (T042)', async () => {
    const result = await syncRuntimeChannel(
      'gk_gain',
      0.4,
      {
        isCurrentlyPlaying: () => true,
        setChannel: vi.fn().mockRejectedValue(new Error('Engine rejected channel assignment')),
      },
      {
        isRunning: () => true,
        setChannel: vi.fn().mockResolvedValue(undefined),
      },
    );

    expect(result.routedTo).toEqual(['timeline', 'blueLive']);
    expect(result.outcomes).toEqual([
      {
        target: 'timeline',
        ok: false,
        message: 'Engine rejected channel assignment',
      },
      { target: 'blueLive', ok: true, message: '' },
    ]);
  });

  it('keeps partial outcomes distinguishable when one engine times out', async () => {
    const result = await syncRuntimeChannel(
      'gk_gain',
      0.6,
      {
        isCurrentlyPlaying: () => true,
        setChannel: vi.fn().mockRejectedValue('setChannel timed out'),
      },
      {
        isRunning: () => false,
        setChannel: vi.fn(),
      },
    );

    expect(result.outcomes).toEqual([
      { target: 'timeline', ok: false, message: 'setChannel timed out' },
      { target: 'blueLive', ok: false, message: 'Blue Live not running' },
    ]);
  });
});
