import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import {
  EDITOR_OPEN_DIAGNOSTIC_MAX_ATTEMPTS,
  EDITOR_OPEN_DIAGNOSTIC_MAX_FRAME_OBSERVATIONS,
  EDITOR_OPEN_DIAGNOSTIC_MAX_MILESTONES,
  isAudioObservation,
  isDiagnosticEnvironment,
  isDiagnosticRun,
  isEditorMilestoneName,
  isEngineControlTrafficObservation,
  isEditorTargetIdentity,
  isEngineFrameBracket,
  isQualifyingPlaybackWorkload,
  type AudioObservation,
  type DiagnosticCondition,
  type DiagnosticEnvironment,
  type DiagnosticRun,
  type DiagnosticTimestamp,
  type EditorAppMode,
  type EditorMilestone,
  type EditorMilestoneName,
  type EditorOpenAttempt,
  type EditorTargetIdentity,
  type EngineFrameBracket,
  type EngineControlTrafficObservation,
  type QualifyingPlaybackWorkload,
} from '../shared/track-instrument-editor-contract';

const DEFAULT_OUTPUT_DIRECTORY_NAME = 'blue-editor-open-diagnostics';
const DEFAULT_ARTIFACT_FILE_NAME = 'editor-open-diagnostics.jsonl';
const MAX_WARNING_LENGTH = 300;

export interface DiagnosticClock {
  nowMonotonicNs(): bigint | number;
}

export interface DiagnosticIdFactory {
  createRunId(): string;
  createAttemptId(): string;
}

export interface EngineStateSample {
  readonly sampleFrame: DiagnosticTimestamp;
  readonly sampleRate: number;
  readonly ksmps: number;
}

export interface EditorOpenEngineStateSampler {
  sampleEngineState(): Promise<EngineStateSample | null>;
}

export interface EditorOpenDiagnosticArtifactWriter {
  writeRun(run: DiagnosticRun): Promise<void>;
  flush?(): Promise<void>;
}

export interface DiagnosticRunInput {
  readonly candidateId: string;
  readonly condition: DiagnosticCondition;
  readonly environment: DiagnosticEnvironment;
  readonly workload: QualifyingPlaybackWorkload;
  readonly notes?: readonly string[];
}

export interface DiagnosticAttemptInput {
  readonly target: EditorTargetIdentity;
  readonly classification: EditorOpenAttempt['classification'];
  readonly appMode: EditorAppMode;
}

export interface EditorOpenDiagnosticAttempt {
  readonly attemptId: string;
  milestone(name: EditorMilestoneName, metadata?: Pick<EditorMilestone, 'durationNs' | 'count'>): boolean;
  bracketEngineState(milestone: EditorMilestoneName): Promise<EngineFrameBracket | null>;
  recordAudioObservation(observation: AudioObservation): boolean;
  recordControlTraffic(observation: EngineControlTrafficObservation): boolean;
  complete(outcome: EditorOpenAttempt['outcome'], errorCode?: string): boolean;
}

export interface EditorOpenDiagnosticRun {
  readonly runId: string;
  startAttempt(input: DiagnosticAttemptInput): EditorOpenDiagnosticAttempt | null;
  complete(disposition: DiagnosticRun['disposition'], notes?: readonly string[]): boolean;
  snapshot(): DiagnosticRun | null;
}

export interface EditorOpenDiagnostics {
  readonly enabled: boolean;
  readonly outputDirectory: string | null;
  beginRun(input: DiagnosticRunInput): EditorOpenDiagnosticRun | null;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}

export interface EditorOpenDiagnosticsOptions {
  readonly enabled?: boolean;
  readonly outputDirectory?: string;
  readonly clock?: DiagnosticClock;
  readonly ids?: DiagnosticIdFactory;
  readonly sampler?: EditorOpenEngineStateSampler;
  readonly writer?: EditorOpenDiagnosticArtifactWriter;
  readonly warn?: (message: string) => void;
  readonly maxRuns?: number;
  readonly maxAttemptsPerRun?: number;
  readonly maxMilestonesPerAttempt?: number;
  readonly maxFrameObservationsPerAttempt?: number;
}

const systemClock: DiagnosticClock = {
  nowMonotonicNs: () => process.hrtime.bigint(),
};

const systemIds: DiagnosticIdFactory = {
  createRunId: () => randomUUID(),
  createAttemptId: () => randomUUID(),
};

function enabledByEnvironment(): boolean {
  return process.env.BLUE_EDITOR_OPEN_DIAGNOSTICS === '1';
}

export function resolveEditorOpenDiagnosticsDirectory(requested?: string): string {
  const configured = requested?.trim();
  return configured && configured.length > 0
    ? path.resolve(configured)
    : path.join(tmpdir(), DEFAULT_OUTPUT_DIRECTORY_NAME);
}

function toDiagnosticTimestamp(value: bigint | number): DiagnosticTimestamp {
  if (typeof value === 'bigint') return value.toString() as `${number}`;
  if (Number.isSafeInteger(value) && value >= 0) return value;
  if (Number.isFinite(value) && value >= 0) return Math.trunc(value).toString() as `${number}`;
  return '0' as `${number}`;
}

function timestampToNumber(value: DiagnosticTimestamp): number {
  return typeof value === 'number' ? value : Number(value);
}

function boundedText(value: string, maxLength = MAX_WARNING_LENGTH): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function errorText(error: unknown): string {
  return boundedText(error instanceof Error ? error.message : String(error));
}

function boundedLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 1) return fallback;
  return Math.min(value, 1000);
}

class JsonlDiagnosticArtifactWriter implements EditorOpenDiagnosticArtifactWriter {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly outputDirectory: string) {}

  writeRun(run: DiagnosticRun): Promise<void> {
    const line = `${JSON.stringify(run)}\n`;
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(this.outputDirectory, { recursive: true });
      await appendFile(
        path.join(this.outputDirectory, DEFAULT_ARTIFACT_FILE_NAME),
        line,
        'utf8',
      );
    });
    return this.writeChain;
  }

  flush(): Promise<void> {
    return this.writeChain;
  }
}

class NoopAttempt implements EditorOpenDiagnosticAttempt {
  readonly attemptId = '';

  milestone(): boolean { return false; }
  bracketEngineState(): Promise<EngineFrameBracket | null> { return Promise.resolve(null); }
  recordAudioObservation(): boolean { return false; }
  recordControlTraffic(): boolean { return false; }
  complete(): boolean { return false; }
}

class NoopRun implements EditorOpenDiagnosticRun {
  readonly runId = '';

  startAttempt(): EditorOpenDiagnosticAttempt | null { return null; }
  complete(): boolean { return false; }
  snapshot(): DiagnosticRun | null { return null; }
}

class NoopDiagnostics implements EditorOpenDiagnostics {
  readonly enabled = false;
  readonly outputDirectory = null;

  beginRun(): EditorOpenDiagnosticRun | null { return null; }
  flush(): Promise<void> { return Promise.resolve(); }
  dispose(): Promise<void> { return Promise.resolve(); }
}

class DiagnosticAttempt implements EditorOpenDiagnosticAttempt {
  private readonly milestones: EditorMilestone[] = [];
  private readonly frameObservations: EngineFrameBracket[] = [];
  private audioObservation: AudioObservation = {
    method: 'unavailable',
    interruptionCount: 0,
  };
  private controlTraffic: EngineControlTrafficObservation | undefined;
  private terminalOutcome: EditorOpenAttempt['outcome'] | null = null;
  private terminalErrorCode: string | undefined;

  constructor(
    readonly attemptId: string,
    private readonly input: DiagnosticAttemptInput,
    private readonly startedMonotonicNs: DiagnosticTimestamp,
    private readonly run: DiagnosticRunState,
  ) {}

  milestone(
    name: EditorMilestoneName,
    metadata?: Pick<EditorMilestone, 'durationNs' | 'count'>,
  ): boolean {
    if (!this.isActive() || !isEditorMilestoneName(name)) return false;
    if (this.milestones.length >= this.run.limits.maxMilestonesPerAttempt) return false;
    if (this.milestones.some((milestone) => milestone.name === name)) return false;

    const milestone: EditorMilestone = {
      name,
      monotonicNs: this.run.timestamp(),
      ...(metadata?.durationNs !== undefined ? { durationNs: metadata.durationNs } : {}),
      ...(metadata?.count !== undefined ? { count: metadata.count } : {}),
    };
    if (!this.appendMilestone(milestone)) return false;
    return true;
  }

  async bracketEngineState(milestone: EditorMilestoneName): Promise<EngineFrameBracket | null> {
    if (!this.isActive() || !isEditorMilestoneName(milestone)) return null;
    if (this.frameObservations.length >= this.run.limits.maxFrameObservationsPerAttempt) return null;
    const sampler = this.run.sampler;
    if (!sampler) return null;

    const requestBeforeMonotonicNs = this.run.timestamp();
    try {
      const sample = await sampler.sampleEngineState();
      const responseAfterMonotonicNs = this.run.timestamp();
      if (!this.isActive() || !sample) return null;
      const bracket: EngineFrameBracket = {
        milestone,
        requestBeforeMonotonicNs,
        sampleFrame: sample.sampleFrame,
        sampleRate: sample.sampleRate,
        ksmps: sample.ksmps,
        responseAfterMonotonicNs,
      };
      if (!isEngineFrameBracket(bracket)) {
        this.run.warn('Ignored invalid engine-state diagnostic bracket.');
        return null;
      }
      this.frameObservations.push(bracket);
      return bracket;
    } catch (error: unknown) {
      this.run.warn(`Engine-state diagnostic sampler failed: ${errorText(error)}`);
      return null;
    }
  }

  recordAudioObservation(observation: AudioObservation): boolean {
    if (!this.isActive() || !isAudioObservation(observation)) return false;
    this.audioObservation = { ...observation };
    return true;
  }

  recordControlTraffic(observation: EngineControlTrafficObservation): boolean {
    if (!this.isActive() || !isEngineControlTrafficObservation(observation)) return false;
    this.controlTraffic = { ...observation };
    return true;
  }

  complete(outcome: EditorOpenAttempt['outcome'], errorCode?: string): boolean {
    if (!this.isActive()) return false;
    const terminalMilestone = outcome === 'usable'
      ? 'editor-usable'
      : outcome === 'failed'
      ? 'failed'
      : outcome === 'cancelled'
      ? 'cancelled'
      : 'closed';
    this.milestone(terminalMilestone);
    this.terminalOutcome = outcome;
    this.terminalErrorCode = errorCode;
    this.run.onAttemptCompleted(this);
    return true;
  }

  toRecord(): EditorOpenAttempt {
    const outcome = this.terminalOutcome ?? 'cancelled';
    return {
      attemptId: this.attemptId,
      target: this.input.target,
      classification: this.input.classification,
      appMode: this.input.appMode,
      startedMonotonicNs: this.startedMonotonicNs,
      milestones: [...this.milestones],
      frameObservations: [...this.frameObservations],
      ...(this.controlTraffic ? { controlTraffic: this.controlTraffic } : {}),
      audioObservation: this.audioObservation,
      outcome,
      ...(this.terminalErrorCode ? { errorCode: boundedText(this.terminalErrorCode, 200) } : {}),
    };
  }

  private isActive(): boolean {
    return this.terminalOutcome === null && !this.run.isComplete;
  }

  private appendMilestone(milestone: EditorMilestone): boolean {
    const previous = this.milestones[this.milestones.length - 1];
    if (previous && timestampToNumber(milestone.monotonicNs) < timestampToNumber(previous.monotonicNs)) {
      this.run.warn('Ignored out-of-order editor-open diagnostic milestone.');
      return false;
    }
    this.milestones.push(milestone);
    return true;
  }
}

class DiagnosticRunState implements EditorOpenDiagnosticRun {
  readonly runId: string;
  readonly attempts: DiagnosticAttempt[] = [];
  isComplete = false;
  private disposition: DiagnosticRun['disposition'] = 'incomplete';
  private notes: readonly string[] | undefined;

  constructor(
    private readonly input: DiagnosticRunInput,
    readonly limits: DiagnosticLimits,
    private readonly clock: DiagnosticClock,
    private readonly ids: DiagnosticIdFactory,
    readonly sampler: EditorOpenEngineStateSampler | undefined,
    readonly warn: (message: string) => void,
    private readonly onComplete: (run: DiagnosticRun) => void,
  ) {
    this.runId = ids.createRunId();
  }

  startAttempt(input: DiagnosticAttemptInput): EditorOpenDiagnosticAttempt | null {
    if (this.isComplete || this.attempts.length >= this.limits.maxAttemptsPerRun) return null;
    if (!isEditorTargetIdentity(input.target)) return null;
    const attempt = new DiagnosticAttempt(
      this.ids.createAttemptId(),
      input,
      this.timestamp(),
      this,
    );
    this.attempts.push(attempt);
    return attempt;
  }

  complete(disposition: DiagnosticRun['disposition'], notes?: readonly string[]): boolean {
    if (this.isComplete) return false;
    this.disposition = disposition;
    this.notes = notes?.slice(0, 100).map((note) => boundedText(note));
    this.isComplete = true;
    const run = this.snapshot();
    if (run) this.onComplete(run);
    return true;
  }

  snapshot(): DiagnosticRun | null {
    if (!isDiagnosticEnvironment(this.input.environment)
      || !isQualifyingPlaybackWorkload(this.input.workload)) return null;
    const run: DiagnosticRun = {
      schemaVersion: 1,
      runId: this.runId,
      candidateId: this.input.candidateId,
      condition: this.input.condition,
      environment: this.input.environment,
      workload: this.input.workload,
      attempts: this.attempts.map((attempt) => attempt.toRecord()),
      disposition: this.disposition,
      ...(this.notes && this.notes.length > 0 ? { notes: this.notes } : {}),
    };
    return isDiagnosticRun(run) ? run : null;
  }

  timestamp(): DiagnosticTimestamp {
    return toDiagnosticTimestamp(this.clock.nowMonotonicNs());
  }

  onAttemptCompleted(_attempt: DiagnosticAttempt): void {
    // Attempt records remain in the run until its explicit disposition is known.
  }
}

interface DiagnosticLimits {
  readonly maxRuns: number;
  readonly maxAttemptsPerRun: number;
  readonly maxMilestonesPerAttempt: number;
  readonly maxFrameObservationsPerAttempt: number;
}

class EnabledDiagnostics implements EditorOpenDiagnostics {
  readonly enabled = true;
  private readonly runs: DiagnosticRunState[] = [];
  private readonly pendingWrites = new Set<Promise<void>>();
  private writesDisabled = false;
  private disposed = false;

  constructor(
    readonly outputDirectory: string,
    private readonly clock: DiagnosticClock,
    private readonly ids: DiagnosticIdFactory,
    private readonly sampler: EditorOpenEngineStateSampler | undefined,
    private readonly writer: EditorOpenDiagnosticArtifactWriter,
    private readonly warn: (message: string) => void,
    private readonly limits: DiagnosticLimits,
  ) {}

  beginRun(input: DiagnosticRunInput): EditorOpenDiagnosticRun | null {
    if (this.disposed || this.writesDisabled || this.runs.length >= this.limits.maxRuns) return null;
    if (!isDiagnosticEnvironment(input.environment)
      || !isQualifyingPlaybackWorkload(input.workload)) return null;
    const run = new DiagnosticRunState(
      input,
      this.limits,
      this.clock,
      this.ids,
      this.sampler,
      this.warn,
      (completedRun) => this.completeRun(completedRun),
    );
    this.runs.push(run);
    return run;
  }

  async flush(): Promise<void> {
    await Promise.allSettled([...this.pendingWrites]);
    await this.writer.flush?.();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.flush();
    this.runs.length = 0;
  }

  private completeRun(run: DiagnosticRun): void {
    if (this.writesDisabled || !isDiagnosticRun(run)) return;
    const write = this.writer.writeRun(run).catch((error: unknown) => {
      this.writesDisabled = true;
      this.warn(`Editor-open diagnostic artifact write failed: ${errorText(error)}`);
    });
    this.pendingWrites.add(write);
    void write.finally(() => this.pendingWrites.delete(write));
  }
}

export function createEditorOpenDiagnostics(
  options: EditorOpenDiagnosticsOptions = {},
): EditorOpenDiagnostics {
  if (!(options.enabled ?? enabledByEnvironment())) return new NoopDiagnostics();

  const outputDirectory = resolveEditorOpenDiagnosticsDirectory(options.outputDirectory
    ?? process.env.BLUE_EDITOR_OPEN_DIAGNOSTICS_DIR);
  const warn = options.warn ?? ((message: string) => console.warn(`[EditorOpenDiagnostics] ${message}`));
  const limits: DiagnosticLimits = {
    maxRuns: boundedLimit(options.maxRuns, 8),
    maxAttemptsPerRun: Math.min(
      boundedLimit(options.maxAttemptsPerRun, EDITOR_OPEN_DIAGNOSTIC_MAX_ATTEMPTS),
      EDITOR_OPEN_DIAGNOSTIC_MAX_ATTEMPTS,
    ),
    maxMilestonesPerAttempt: Math.min(
      boundedLimit(options.maxMilestonesPerAttempt, EDITOR_OPEN_DIAGNOSTIC_MAX_MILESTONES),
      EDITOR_OPEN_DIAGNOSTIC_MAX_MILESTONES,
    ),
    maxFrameObservationsPerAttempt: Math.min(
      boundedLimit(options.maxFrameObservationsPerAttempt, EDITOR_OPEN_DIAGNOSTIC_MAX_FRAME_OBSERVATIONS),
      EDITOR_OPEN_DIAGNOSTIC_MAX_FRAME_OBSERVATIONS,
    ),
  };
  return new EnabledDiagnostics(
    outputDirectory,
    options.clock ?? systemClock,
    options.ids ?? systemIds,
    options.sampler,
    options.writer ?? new JsonlDiagnosticArtifactWriter(outputDirectory),
    warn,
    limits,
  );
}
