export interface TimelineRuntimeChannelTarget {
  isCurrentlyPlaying(): boolean;
  setChannel(name: string, value: number): Promise<void>;
}

export interface BlueLiveRuntimeChannelTarget {
  isRunning(): boolean;
  setChannel(name: string, value: number): Promise<void>;
}

export async function syncRuntimeChannel(
  name: string,
  value: number,
  timelineEngine: TimelineRuntimeChannelTarget | null,
  blueLiveEngine: BlueLiveRuntimeChannelTarget | null,
): Promise<void> {
  const writes: Promise<void>[] = [];

  if (timelineEngine?.isCurrentlyPlaying()) {
    writes.push(timelineEngine.setChannel(name, value));
  }

  if (blueLiveEngine?.isRunning()) {
    writes.push(blueLiveEngine.setChannel(name, value));
  }

  await Promise.all(writes);
}
