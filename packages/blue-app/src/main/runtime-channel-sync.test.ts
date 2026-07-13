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

    await syncRuntimeChannel(
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
  });
});
