export interface TimelineRuntimeChannelTarget {
  isCurrentlyPlaying(): boolean;
  setChannel(name: string, value: number): Promise<void>;
}

export interface BlueLiveRuntimeChannelTarget {
  isRunning(): boolean;
  setChannel(name: string, value: number): Promise<void>;
}

export type RuntimeChannelSyncTarget = 'timeline' | 'blueLive';

export interface RuntimeChannelWriteOutcome {
  target: RuntimeChannelSyncTarget;
  /** True when the target was running and the write acknowledged cleanly. */
  ok: boolean;
  /** Skipped targets report why; failed writes report the error. */
  message: string;
}

export interface RuntimeChannelSyncResult {
  routedTo: RuntimeChannelSyncTarget[];
  outcomes: RuntimeChannelWriteOutcome[];
}

async function writeToTarget(
  target: RuntimeChannelSyncTarget,
  engine: TimelineRuntimeChannelTarget | BlueLiveRuntimeChannelTarget,
  name: string,
  value: number,
): Promise<RuntimeChannelWriteOutcome> {
  try {
    await engine.setChannel(name, value);
    return { target, ok: true, message: '' };
  } catch (error) {
    // A rejected transport promise is a failed write, never a success.
    return {
      target,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fans a channel value out to every running performance. Each write produces
 * a distinguishable outcome: skipped (not running), applied, or failed.
 * Missing and stopped engines are reported, not silently ignored.
 */
export async function syncRuntimeChannel(
  name: string,
  value: number,
  timelineEngine: TimelineRuntimeChannelTarget | null,
  blueLiveEngine: BlueLiveRuntimeChannelTarget | null,
): Promise<RuntimeChannelSyncResult> {
  const outcomes: RuntimeChannelWriteOutcome[] = [];
  const routedTo: RuntimeChannelSyncTarget[] = [];

  if (timelineEngine) {
    if (timelineEngine.isCurrentlyPlaying()) {
      routedTo.push('timeline');
      outcomes.push(await writeToTarget('timeline', timelineEngine, name, value));
    } else {
      outcomes.push({ target: 'timeline', ok: false, message: 'Timeline engine not playing' });
    }
  }

  if (blueLiveEngine) {
    if (blueLiveEngine.isRunning()) {
      routedTo.push('blueLive');
      outcomes.push(await writeToTarget('blueLive', blueLiveEngine, name, value));
    } else {
      outcomes.push({ target: 'blueLive', ok: false, message: 'Blue Live not running' });
    }
  }

  return { routedTo, outcomes };
}
