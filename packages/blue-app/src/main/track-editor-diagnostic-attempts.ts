import type { BlueData } from '@blue/data';

import type {
  EffectEditorRequest,
  TrackInstrumentEditorRequest,
} from '../shared/project-editor';
import type {
  EditorAppMode,
  EditorInstrumentKind,
  EditorMilestoneName,
  EditorOpenAttempt,
  EditorTargetIdentity,
  EngineControlTrafficObservation,
} from '../shared/track-instrument-editor-contract';
import type {
  EditorOpenDiagnosticAttempt,
  EditorOpenDiagnosticRun,
} from './editor-open-diagnostics';

export type TrackEditorDiagnosticAttemptOutcome = Parameters<EditorOpenDiagnosticAttempt['complete']>[0];

export interface TrackEditorDiagnosticAttemptState {
  key: string;
  attempt: EditorOpenDiagnosticAttempt | null;
  usable: boolean;
  completed: boolean;
  pendingMilestones: Array<{ name: EditorMilestoneName; errorCode?: string }>;
  pendingBrackets: EditorMilestoneName[];
  terminal: { outcome: TrackEditorDiagnosticAttemptOutcome; errorCode?: string } | null;
  controlTrafficBaseline: EngineControlTrafficObservation | null;
  controlTrafficThroughUsable: EngineControlTrafficObservation | null;
}

export interface TrackEditorDiagnosticAttemptTrackerDeps {
  /** Canonical project data for the current session, or null when no project is open. */
  getProjectData(): BlueData | null;
  getCurrentProjectSessionId(): number;
  getAppMode(): EditorAppMode;
  getGeneration(): number;
  bumpGeneration(): void;
  getOrCreateRun(data: BlueData, generation: number): Promise<EditorOpenDiagnosticRun | null>;
  getControlTrafficSnapshot?(): EngineControlTrafficObservation;
}

export interface StartedTrackEditorDiagnosticAttempt {
  state: TrackEditorDiagnosticAttemptState;
  key: string;
  ready: Promise<void>;
}

/**
 * Owns per-open diagnostic attempt lifecycle for Track instrument editors:
 * deferred attempt materialization while the diagnostic run setup settles,
 * milestone/bracket queuing, first-terminal-wins completion, and finalization
 * that records terminal outcomes instead of dropping in-flight opens.
 */
export class TrackEditorDiagnosticAttemptTracker {
  private readonly activeAttempts = new Map<string, TrackEditorDiagnosticAttemptState>();
  private readonly states = new Set<TrackEditorDiagnosticAttemptState>();
  private readonly pendingReady = new Set<Promise<void>>();
  private readonly seenTargets = new Set<string>();
  private finalizing = false;
  private finalization: Promise<void> | null = null;

  constructor(private readonly deps: TrackEditorDiagnosticAttemptTrackerDeps) {}

  keyFor(request: TrackInstrumentEditorRequest): string {
    return `${request.track.projectSessionId}:${request.track.rootGroupId}:${request.track.trackId}`;
  }

  effectKeyFor(request: EffectEditorRequest, mode: 'interface' | 'edit'): string {
    return `effect:${mode}:${request.ownerType}:${request.effectId}`;
  }

  isTargetSeen(key: string): boolean {
    return this.seenTargets.has(key);
  }

  markTargetSeen(key: string): void {
    this.seenTargets.add(key);
  }

  getEffectState(
    request: EffectEditorRequest,
    mode: 'interface' | 'edit',
  ): TrackEditorDiagnosticAttemptState | undefined {
    return this.activeAttempts.get(this.effectKeyFor(request, mode));
  }

  startAttempt(
    request: TrackInstrumentEditorRequest,
    instrumentKind: EditorInstrumentKind,
    classification: EditorOpenAttempt['classification'],
    retain = true,
  ): StartedTrackEditorDiagnosticAttempt | null {
    return this.startTargetAttempt(
      this.keyFor(request),
      {
        kind: 'track-instrument',
        projectSessionId: String(request.track.projectSessionId),
        layerGroupId: request.track.rootGroupId,
        trackId: request.track.trackId,
        instrumentKind,
      },
      classification,
      retain,
    );
  }

  startEffectAttempt(
    request: EffectEditorRequest,
    mode: 'interface' | 'edit',
    classification: EditorOpenAttempt['classification'],
    retain = true,
  ): StartedTrackEditorDiagnosticAttempt | null {
    const effectOwnerId = request.projectRef
      ? `${request.projectRef.channelId}:${request.projectRef.chain}`
      : `library:${request.libraryRef?.libraryEffectId ?? request.effectId}`;
    return this.startTargetAttempt(
      this.effectKeyFor(request, mode),
      {
        kind: mode === 'interface' ? 'effect-interface' : 'effect-editor',
        projectSessionId: String(this.deps.getCurrentProjectSessionId()),
        effectOwnerId,
        effectId: request.effectId,
      },
      classification,
      retain,
    );
  }

  private startTargetAttempt(
    key: string,
    target: EditorTargetIdentity,
    classification: EditorOpenAttempt['classification'],
    retain: boolean,
  ): StartedTrackEditorDiagnosticAttempt | null {
    const data = this.deps.getProjectData();
    if (!data || this.finalizing) return null;
    const generation = this.deps.getGeneration();
    const state: TrackEditorDiagnosticAttemptState = {
      key,
      attempt: null,
      usable: false,
      completed: false,
      pendingMilestones: [],
      pendingBrackets: [],
      terminal: null,
      controlTrafficBaseline: this.deps.getControlTrafficSnapshot?.() ?? null,
      controlTrafficThroughUsable: null,
    };
    this.states.add(state);
    if (retain) {
      this.activeAttempts.set(key, state);
    }

    const ready = new Promise<void>((resolve) => {
      queueMicrotask(() => {
        void this.deps.getOrCreateRun(data, generation).then((run) => {
          if (!run) {
            this.markStateCompleted(state);
            return;
          }

          const attempt = run.startAttempt({
            target,
            classification,
            appMode: this.deps.getAppMode(),
          });
          if (!attempt) {
            this.markStateCompleted(state);
            return;
          }

          state.attempt = attempt;
          attempt.milestone('request-received');
          attempt.milestone('target-validated');
          for (const pending of state.pendingMilestones) {
            attempt.milestone(pending.name);
          }
          state.pendingMilestones = [];
          for (const bracketMilestone of state.pendingBrackets) {
            void attempt.bracketEngineState(bracketMilestone);
          }
          state.pendingBrackets = [];
          if (state.terminal) {
            this.completeAttempt(key, state);
          }
        }).catch(() => {
          this.markStateCompleted(state);
        }).finally(resolve);
      });
    });
    this.pendingReady.add(ready);
    void ready.finally(() => this.pendingReady.delete(ready));
    return { state, key, ready };
  }

  queueMilestone(
    state: TrackEditorDiagnosticAttemptState | undefined,
    milestone: EditorMilestoneName,
    errorCode?: string,
  ): boolean {
    if (!state || state.completed) return false;
    if (state.attempt) return state.attempt.milestone(milestone);
    if (state.pendingMilestones.some((pending) => pending.name === milestone)) return false;
    state.pendingMilestones.push({ name: milestone, ...(errorCode ? { errorCode } : {}) });
    return true;
  }

  queueBracket(state: TrackEditorDiagnosticAttemptState | undefined, milestone: EditorMilestoneName): void {
    if (!state || state.completed) return;
    if (state.attempt) {
      void state.attempt.bracketEngineState(milestone);
      return;
    }
    if (!state.pendingBrackets.includes(milestone)) state.pendingBrackets.push(milestone);
  }

  recordLifecycle(
    request: TrackInstrumentEditorRequest,
    milestone: EditorMilestoneName,
    errorCode?: string,
    expectedState?: TrackEditorDiagnosticAttemptState,
  ): void {
    this.recordLifecycleForKey(this.keyFor(request), milestone, errorCode, expectedState);
  }

  recordEffectLifecycle(
    request: EffectEditorRequest,
    mode: 'interface' | 'edit',
    milestone: EditorMilestoneName,
    errorCode?: string,
    expectedState?: TrackEditorDiagnosticAttemptState,
  ): void {
    this.recordLifecycleForKey(
      this.effectKeyFor(request, mode),
      milestone,
      errorCode,
      expectedState,
    );
  }

  private recordLifecycleForKey(
    key: string,
    milestone: EditorMilestoneName,
    errorCode?: string,
    expectedState?: TrackEditorDiagnosticAttemptState,
  ): void {
    const state = this.activeAttempts.get(key);
    if (!state || state.completed || (expectedState && state !== expectedState)) return;

    if (milestone === 'closed') {
      this.setTerminal(state, {
        outcome: state.usable ? 'usable' : 'closed-before-usable',
      });
      this.completeAttempt(key, state);
      return;
    }

    if (milestone === 'failed') {
      this.setTerminal(state, {
        outcome: 'failed',
        ...(errorCode ? { errorCode } : {}),
      });
      this.completeAttempt(key, state);
      return;
    }

    this.queueMilestone(state, milestone, errorCode);
  }

  recordRendererMilestone(request: TrackInstrumentEditorRequest, milestone: EditorMilestoneName): boolean {
    if (request.track.projectSessionId !== this.deps.getCurrentProjectSessionId()) {
      return false;
    }
    return this.recordRendererMilestoneForKey(this.keyFor(request), milestone);
  }

  recordEffectRendererMilestone(
    request: EffectEditorRequest,
    mode: 'interface' | 'edit',
    milestone: EditorMilestoneName,
  ): boolean {
    return this.recordRendererMilestoneForKey(
      this.effectKeyFor(request, mode),
      milestone,
    );
  }

  private recordRendererMilestoneForKey(
    key: string,
    milestone: EditorMilestoneName,
  ): boolean {
    const state = this.activeAttempts.get(key);
    if (!state || state.completed) return false;
    if (milestone === 'editor-usable') {
      state.usable = true;
      state.controlTrafficThroughUsable = this.controlTrafficDelta(state);
    }
    return this.queueMilestone(state, milestone);
  }

  setTerminal(
    state: TrackEditorDiagnosticAttemptState,
    terminal: { outcome: TrackEditorDiagnosticAttemptOutcome; errorCode?: string },
  ): void {
    if (!state.completed && !state.terminal) state.terminal = terminal;
  }

  completeAttempt(key: string, state: TrackEditorDiagnosticAttemptState): void {
    if (state.completed || !state.attempt || !state.terminal) return;
    const controlTraffic = state.controlTrafficThroughUsable ?? this.controlTrafficDelta(state);
    if (controlTraffic) state.attempt.recordControlTraffic(controlTraffic);
    state.attempt.complete(state.terminal.outcome, state.terminal.errorCode);
    state.completed = true;
    this.removeAttempt(key, state);
  }

  /**
   * Completes every in-flight attempt and invalidates the current generation.
   * Already-started deferred setups settle under the existing generation first
   * so their attempts materialize and receive a terminal outcome instead of
   * disappearing when the generation changes. New attempts stay blocked for
   * the whole finalization.
   */
  async finalize(): Promise<void> {
    if (this.finalization) {
      await this.finalization;
      return;
    }

    this.finalizing = true;
    const finalization = (async () => {
      await Promise.allSettled([...this.pendingReady]);
      this.deps.bumpGeneration();

      for (const state of this.states) {
        if (state.completed) continue;
        this.setTerminal(state, {
          outcome: state.usable ? 'usable' : 'cancelled',
        });
        this.completeAttempt(state.key, state);
      }

      this.activeAttempts.clear();
      this.states.clear();
      this.seenTargets.clear();
    })();
    this.finalization = finalization;

    try {
      await finalization;
    } finally {
      if (this.finalization === finalization) {
        this.finalization = null;
        this.finalizing = false;
      }
    }
  }

  private markStateCompleted(state: TrackEditorDiagnosticAttemptState): void {
    state.completed = true;
    this.removeAttempt(state.key, state);
  }

  private controlTrafficDelta(
    state: TrackEditorDiagnosticAttemptState,
  ): EngineControlTrafficObservation | null {
    const currentTraffic = this.deps.getControlTrafficSnapshot?.();
    if (!state.controlTrafficBaseline || !currentTraffic) return null;
    return {
      readCommands: Math.max(0, currentTraffic.readCommands - state.controlTrafficBaseline.readCommands),
      readEntries: Math.max(0, currentTraffic.readEntries - state.controlTrafficBaseline.readEntries),
      writeCommands: Math.max(0, currentTraffic.writeCommands - state.controlTrafficBaseline.writeCommands),
      writeEntries: Math.max(0, currentTraffic.writeEntries - state.controlTrafficBaseline.writeEntries),
    };
  }

  private removeAttempt(key: string, state: TrackEditorDiagnosticAttemptState): void {
    if (this.activeAttempts.get(key) === state) {
      this.activeAttempts.delete(key);
    }
    this.states.delete(state);
  }
}
