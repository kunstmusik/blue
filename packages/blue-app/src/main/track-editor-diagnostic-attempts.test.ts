import type { BlueData } from '@blue/data';
import { describe, expect, it } from 'vitest';

import type {
  EffectEditorRequest,
  TrackInstrumentEditorRequest,
} from '../shared/project-editor';
import type {
  EditorMilestoneName,
  EngineControlTrafficObservation,
  EngineFrameBracket,
} from '../shared/track-instrument-editor-contract';
import type {
  EditorOpenDiagnosticAttempt,
  EditorOpenDiagnosticRun,
} from './editor-open-diagnostics';
import {
  TrackEditorDiagnosticAttemptTracker,
  type TrackEditorDiagnosticAttemptOutcome,
  type TrackEditorDiagnosticAttemptState,
  type TrackEditorDiagnosticAttemptTrackerDeps,
} from './track-editor-diagnostic-attempts';

/** Reads fake-only observation fields from a materialized attempt. */
function attemptOf(state: TrackEditorDiagnosticAttemptState): FakeAttempt {
  if (!state.attempt) throw new Error('expected a materialized diagnostic attempt');
  return state.attempt as FakeAttempt;
}

class FakeAttempt implements EditorOpenDiagnosticAttempt {
  readonly attemptId: string;
  readonly milestoneNames: EditorMilestoneName[] = [];
  outcome: TrackEditorDiagnosticAttemptOutcome | null = null;
  errorCode?: string;
  controlTraffic: EngineControlTrafficObservation | null = null;

  constructor(id: string) {
    this.attemptId = id;
  }

  milestone(name: EditorMilestoneName): boolean {
    this.milestoneNames.push(name);
    return true;
  }

  async bracketEngineState(): Promise<EngineFrameBracket | null> {
    return null;
  }

  recordAudioObservation(): boolean {
    return false;
  }

  recordControlTraffic(observation: EngineControlTrafficObservation): boolean {
    this.controlTraffic = observation;
    return true;
  }

  complete(outcome: TrackEditorDiagnosticAttemptOutcome, errorCode?: string): boolean {
    if (this.outcome !== null) return false;
    this.outcome = outcome;
    this.errorCode = errorCode;
    return true;
  }
}

class FakeRun implements EditorOpenDiagnosticRun {
  readonly runId: string;
  readonly attempts: FakeAttempt[] = [];
  readonly dispositions: string[] = [];

  constructor(id: string) {
    this.runId = id;
  }

  startAttempt(): FakeAttempt {
    const attempt = new FakeAttempt(`attempt-${this.attempts.length + 1}`);
    this.attempts.push(attempt);
    return attempt;
  }

  complete(disposition: string): boolean {
    this.dispositions.push(disposition);
    return true;
  }

  snapshot(): null {
    return null;
  }
}

function createTracker() {
  const runs: FakeRun[] = [];
  let projectData: BlueData | null = { stub: true } as unknown as BlueData;
  let currentSessionId = 7;
  let generation = 0;
  let generationBumps = 0;
  let setupGate: Promise<void> = Promise.resolve();
  let releaseSetup: () => void = () => {};
  let nextSetupReturnsNull = false;
  let nextSetupThrows = false;
  const controlTraffic = {
    readCommands: 0,
    readEntries: 0,
    writeCommands: 0,
    writeEntries: 0,
  };

  const deps: TrackEditorDiagnosticAttemptTrackerDeps = {
    getProjectData: () => projectData,
    getCurrentProjectSessionId: () => currentSessionId,
    getAppMode: () => 'development',
    getGeneration: () => generation,
    bumpGeneration: () => {
      generation += 1;
      generationBumps += 1;
    },
    getOrCreateRun: async (_data, expectedGeneration) => {
      await setupGate;
      if (expectedGeneration !== generation) return null;
      if (nextSetupThrows) throw new Error('setup failed');
      if (nextSetupReturnsNull) return null;
      const run = new FakeRun(`run-${runs.length + 1}`);
      runs.push(run);
      return run;
    },
    getControlTrafficSnapshot: () => ({ ...controlTraffic }),
  };
  const tracker = new TrackEditorDiagnosticAttemptTracker(deps);
  const request = (projectSessionId = 7, trackId = 'track-1'): TrackInstrumentEditorRequest => ({
    track: { rootGroupId: 'group-1', trackId, projectSessionId, projectRevision: 1 },
  });
  const deferSetup = () => {
    setupGate = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
  };

  return {
    tracker,
    runs,
    request,
    effectRequest: (): EffectEditorRequest => ({
      ownerType: 'project',
      effectId: 'effect-1',
      projectRef: { channelId: 'channel-1', chain: 'pre', entryId: 'effect-1' },
    }),
    deferSetup,
    releaseSetup: () => releaseSetup(),
    setProjectData: (value: BlueData | null) => {
      projectData = value;
    },
    setCurrentSessionId: (value: number) => {
      currentSessionId = value;
    },
    setNextSetupReturnsNull: () => {
      nextSetupReturnsNull = true;
    },
    setNextSetupThrows: () => {
      nextSetupThrows = true;
    },
    addControlTraffic: (delta: Partial<EngineControlTrafficObservation>) => {
      controlTraffic.readCommands += delta.readCommands ?? 0;
      controlTraffic.readEntries += delta.readEntries ?? 0;
      controlTraffic.writeCommands += delta.writeCommands ?? 0;
      controlTraffic.writeEntries += delta.writeEntries ?? 0;
    },
    get generationBumps() {
      return generationBumps;
    },
  };
}

describe('track editor diagnostic attempt tracker', () => {
  it('materializes a deferred attempt with replayed milestones once the run setup settles', async () => {
    const h = createTracker();
    h.deferSetup();
    const started = h.tracker.startAttempt(h.request(), 'generic', 'cold');
    expect(started).not.toBeNull();
    expect(h.tracker.queueMilestone(started!.state, 'snapshot-start')).toBe(true);
    expect(h.tracker.queueMilestone(started!.state, 'snapshot-start')).toBe(false);
    expect(h.runs).toHaveLength(0);

    h.releaseSetup();
    await started!.ready;

    expect(h.runs).toHaveLength(1);
    expect(started!.state.attempt).not.toBeNull();
    expect(attemptOf(started!.state).milestoneNames).toEqual([
      'request-received',
      'target-validated',
      'snapshot-start',
    ]);
  });

  it('records close-before-usable when finalization settles a pending setup', async () => {
    const h = createTracker();
    h.deferSetup();
    const started = h.tracker.startAttempt(h.request(7, 'track-9'), 'blue-x7', 'cold');
    h.tracker.queueMilestone(started!.state, 'snapshot-start');
    h.tracker.recordLifecycle(h.request(7, 'track-9'), 'closed');

    const finalizing = h.tracker.finalize();
    h.releaseSetup();
    await finalizing;

    expect(h.runs).toHaveLength(1);
    const attempt = h.runs[0]!.attempts[0]!;
    expect(attempt.outcome).toBe('closed-before-usable');
    expect(attempt.milestoneNames).toContain('snapshot-start');
    expect(h.generationBumps).toBe(1);
    expect(h.tracker.isTargetSeen(h.tracker.keyFor(h.request(7, 'track-9')))).toBe(false);
  });

  it('completes an in-flight unterminalled attempt as cancelled at finalization', async () => {
    const h = createTracker();
    h.deferSetup();
    const started = h.tracker.startAttempt(h.request(), 'generic', 'cold');

    const finalizing = h.tracker.finalize();
    h.releaseSetup();
    await finalizing;

    expect(attemptOf(started!.state).outcome).toBe('cancelled');
    expect(h.tracker.isTargetSeen(h.tracker.keyFor(h.request()))).toBe(false);
  });

  it('marks a state completed without an attempt when the deferred setup yields no run', async () => {
    const h = createTracker();
    h.setNextSetupReturnsNull();
    const started = h.tracker.startAttempt(h.request(), 'generic', 'cold');
    await started!.ready;
    expect(started!.state.completed).toBe(true);
    expect(started!.state.attempt).toBeNull();

    await expect(h.tracker.finalize()).resolves.toBeUndefined();
    expect(h.runs).toHaveLength(0);
  });

  it('completes a state without an attempt when the deferred setup throws', async () => {
    const h = createTracker();
    h.setNextSetupThrows();
    const started = h.tracker.startAttempt(h.request(), 'generic', 'cold');
    await expect(started!.ready).resolves.toBeUndefined();
    expect(started!.state.completed).toBe(true);
  });

  it('records a navigation failure with its error code', async () => {
    const h = createTracker();
    const started = h.tracker.startAttempt(h.request(), 'generic', 'reopened');
    await started!.ready;
    h.tracker.queueMilestone(started!.state, 'snapshot-start');

    h.tracker.recordLifecycle(h.request(), 'failed', 'window-unavailable');

    expect(attemptOf(started!.state).outcome).toBe('failed');
    expect(attemptOf(started!.state).errorCode).toBe('window-unavailable');
  });

  it('keeps the first terminal outcome when later terminal events arrive', async () => {
    const h = createTracker();
    const started = h.tracker.startAttempt(h.request(), 'generic', 'cold');
    await started!.ready;

    h.tracker.recordLifecycle(h.request(), 'failed', 'navigation-failed');
    h.tracker.recordLifecycle(h.request(), 'closed');

    expect(attemptOf(started!.state).outcome).toBe('failed');
    expect(attemptOf(started!.state).errorCode).toBe('navigation-failed');
  });

  it('ignores stale lifecycle callbacks for a replaced target state', async () => {
    const h = createTracker();
    const first = h.tracker.startAttempt(h.request(), 'generic', 'cold');
    await first!.ready;
    const second = h.tracker.startAttempt(h.request(), 'generic', 'reopened');
    await second!.ready;

    h.tracker.recordLifecycle(h.request(), 'snapshot-start', undefined, first!.state);
    expect(attemptOf(second!.state).milestoneNames).not.toContain('snapshot-start');

    h.tracker.recordLifecycle(h.request(), 'snapshot-start');
    expect(attemptOf(second!.state).milestoneNames).toContain('snapshot-start');
  });

  it('rejects renderer milestones from a stale project session and marks usability', async () => {
    const h = createTracker();
    const stale = h.tracker.startAttempt(h.request(6), 'generic', 'cold');
    await stale!.ready;
    expect(h.tracker.recordRendererMilestone(h.request(6), 'editor-usable')).toBe(false);

    h.setCurrentSessionId(6);
    const staleTarget = h.tracker.startAttempt(h.request(6), 'generic', 'reopened');
    await staleTarget!.ready;
    expect(h.tracker.recordRendererMilestone(h.request(6), 'editor-usable')).toBe(true);

    h.setCurrentSessionId(7);
    expect(h.tracker.recordRendererMilestone(h.request(6), 'shown')).toBe(false);
    expect(staleTarget!.state.usable).toBe(true);
  });

  it('records a usable outcome when a usable editor closes', async () => {
    const h = createTracker();
    const started = h.tracker.startAttempt(h.request(), 'blue-x7', 'cold');
    await started!.ready;
    expect(h.tracker.recordRendererMilestone(h.request(), 'editor-usable')).toBe(true);

    h.tracker.recordLifecycle(h.request(), 'closed');

    expect(attemptOf(started!.state).outcome).toBe('usable');
  });

  it('blocks new attempts while finalization is active and releases afterwards', async () => {
    const h = createTracker();
    h.deferSetup();
    const started = h.tracker.startAttempt(h.request(), 'generic', 'cold');
    h.tracker.markTargetSeen(h.tracker.keyFor(h.request()));

    const finalizing = h.tracker.finalize();
    expect(h.tracker.startAttempt(h.request(7, 'track-2'), 'generic', 'cold')).toBeNull();

    h.releaseSetup();
    await finalizing;
    expect(attemptOf(started!.state).outcome).toBe('cancelled');

    const next = h.tracker.startAttempt(h.request(7, 'track-2'), 'generic', 'cold');
    expect(next).not.toBeNull();
    await next!.ready;
    expect(next!.state.attempt).not.toBeNull();
    expect(h.runs).toHaveLength(2);
  });

  it('awaits an active finalization instead of starting a second one', async () => {
    const h = createTracker();
    h.deferSetup();
    h.tracker.startAttempt(h.request(), 'generic', 'cold');

    const first = h.tracker.finalize();
    const second = h.tracker.finalize();
    h.releaseSetup();
    await Promise.all([first, second]);

    expect(h.generationBumps).toBe(1);
  });

  it('refuses to start attempts without project data', () => {
    const h = createTracker();
    h.setProjectData(null);
    expect(h.tracker.startAttempt(h.request(), 'generic', 'cold')).toBeNull();
  });

  it('tracks effect interface milestones through the same lifecycle vocabulary', async () => {
    const h = createTracker();
    const request = h.effectRequest();
    const started = h.tracker.startEffectAttempt(request, 'interface', 'cold');
    expect(started).not.toBeNull();
    await started!.ready;

    h.tracker.recordEffectLifecycle(request, 'interface', 'window-constructed');
    h.addControlTraffic({ readCommands: 1, readEntries: 64 });
    expect(h.tracker.recordEffectRendererMilestone(
      request,
      'interface',
      'editor-usable',
    )).toBe(true);
    h.addControlTraffic({ writeCommands: 1, writeEntries: 12 });
    h.tracker.recordEffectLifecycle(request, 'interface', 'closed');

    expect(attemptOf(started!.state).milestoneNames).toContain('window-constructed');
    expect(attemptOf(started!.state).milestoneNames).toContain('editor-usable');
    expect(attemptOf(started!.state).outcome).toBe('usable');
    expect(attemptOf(started!.state).controlTraffic).toEqual({
      readCommands: 1,
      readEntries: 64,
      writeCommands: 0,
      writeEntries: 0,
    });
  });
});
