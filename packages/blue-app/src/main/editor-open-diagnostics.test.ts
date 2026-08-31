import Ajv2020 from 'ajv/dist/2020.js';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import diagnosticSchema from '../../../../specs/093-fix-editor-audio-glitch/contracts/editor-open-diagnostic.schema.json';
import {
  createEditorOpenDiagnostics,
  resolveEditorOpenDiagnosticsDirectory,
  type DiagnosticClock,
  type DiagnosticRunInput,
} from './editor-open-diagnostics';
import {
  TrackEditorDiagnosticAttemptTracker,
  type TrackEditorDiagnosticAttemptTrackerDeps,
} from './track-editor-diagnostic-attempts';

const request = (trackId = 'track-1') => ({
  track: { rootGroupId: 'group-1', trackId, projectSessionId: 7, projectRevision: 1 },
});

const validDiagnosticRun = {
  schemaVersion: 1,
  runId: 'run-001',
  candidateId: 'baseline',
  condition: 'editor-mount',
  environment: {
    platform: 'darwin-arm64',
    appBuild: 'test-build',
    engineBuild: 'test-engine',
    device: 'test-device',
    sampleRate: 48000,
    ksmps: 32,
    diagnosticsEnabled: true,
  },
  workload: {
    fixtureId: 'fixture-001',
    sampleRate: 48000,
    ksmps: 32,
    controlDurationSeconds: 60,
    baselineInterruptionCount: 0,
    headroomEvidence: { clean: true, cpuPercent: 42 },
    outputMode: 'audible',
  },
  attempts: [{
    attemptId: 'attempt-001',
    target: {
      kind: 'track-instrument',
      projectSessionId: 'session-001',
      layerGroupId: 'group-001',
      trackId: 'track-001',
      instrumentKind: 'generic',
    },
    classification: 'cold',
    appMode: 'development',
    startedMonotonicNs: '1000',
    milestones: [
      { name: 'request-received', monotonicNs: '1000' },
      { name: 'target-validated', monotonicNs: '1100' },
      { name: 'editor-usable', monotonicNs: '2000' },
      { name: 'shown', monotonicNs: '2100' },
    ],
    frameObservations: [{
      milestone: 'editor-usable',
      requestBeforeMonotonicNs: '1900',
      sampleFrame: '96000',
      sampleRate: 48000,
      ksmps: 32,
      responseAfterMonotonicNs: '1950',
    }],
    controlTraffic: {
      readCommands: 1,
      readEntries: 32,
      writeCommands: 0,
      writeEntries: 0,
    },
    audioObservation: {
      method: 'audible',
      interruptionCount: 0,
    },
    outcome: 'usable',
  }],
  disposition: 'accepted',
};

export const validDiagnosticRunJsonl = `${JSON.stringify(validDiagnosticRun)}\n`;

export const invalidDiagnosticRunJsonl = `${JSON.stringify({
  ...validDiagnosticRun,
  environment: {
    ...validDiagnosticRun.environment,
    diagnosticsEnabled: false,
  },
})}\n`;

const schemaValidator = new Ajv2020({ allErrors: true }).compile(diagnosticSchema);

function parseJsonlFixture(jsonl: string): unknown[] {
  return jsonl.trimEnd().split('\n').map((line) => JSON.parse(line));
}

describe('editor-open diagnostic JSONL fixtures', () => {
  it('accepts a complete DiagnosticRun record', () => {
    const [record] = parseJsonlFixture(validDiagnosticRunJsonl);

    expect(schemaValidator(record)).toBe(true);
  });

  it('rejects a record that disables diagnostics', () => {
    const [record] = parseJsonlFixture(invalidDiagnosticRunJsonl);

    expect(schemaValidator(record)).toBe(false);
    expect(schemaValidator.errors?.some((error) => error.keyword === 'const')).toBe(true);
  });
});

describe('editor-open diagnostic coordinator', () => {
  const target = {
    kind: 'track-instrument' as const,
    projectSessionId: 'session-1',
    layerGroupId: 'group-1',
    trackId: 'track-1',
    instrumentKind: 'generic' as const,
  };

  const runInput: DiagnosticRunInput = {
    candidateId: 'candidate-1',
    condition: 'editor-mount',
    environment: {
      platform: 'darwin-arm64',
      appBuild: 'test-build',
      engineBuild: 'test-engine',
      device: 'test-device',
      sampleRate: 48000,
      ksmps: 32,
      diagnosticsEnabled: true,
    },
    workload: {
      fixtureId: 'fixture-1',
      sampleRate: 48000,
      ksmps: 32,
      controlDurationSeconds: 60,
      baselineInterruptionCount: 0,
      headroomEvidence: { clean: true },
      outputMode: 'audible',
    },
  };

  afterEach(() => {
    delete process.env.BLUE_EDITOR_OPEN_DIAGNOSTICS;
    delete process.env.BLUE_EDITOR_OPEN_DIAGNOSTICS_DIR;
  });

  it('is disabled by default without allocating attempts or writing artifacts', async () => {
    const writer = { writeRun: vi.fn(async () => {}) };
    const diagnostics = createEditorOpenDiagnostics({ writer });

    expect(diagnostics.enabled).toBe(false);
    expect(diagnostics.outputDirectory).toBeNull();
    expect(diagnostics.beginRun(runInput)).toBeNull();
    await diagnostics.flush();
    expect(writer.writeRun).not.toHaveBeenCalled();
  });

  it('captures one bounded, ordered run and brackets engine state', async () => {
    const timestamps = [100n, 200n, 250n, 300n, 400n];
    const clock: DiagnosticClock = {
      nowMonotonicNs: () => timestamps.shift() ?? 500n,
    };
    const writer = { writeRun: vi.fn(async () => {}) };
    const diagnostics = createEditorOpenDiagnostics({
      enabled: true,
      clock,
      ids: {
        createRunId: () => 'run-1',
        createAttemptId: () => 'attempt-1',
      },
      sampler: {
        sampleEngineState: vi.fn(async () => ({
          sampleFrame: 96000,
          sampleRate: 48000,
          ksmps: 32,
        })),
      },
      writer,
    });

    const run = diagnostics.beginRun(runInput);
    expect(run).not.toBeNull();
    const attempt = run!.startAttempt({
      target,
      classification: 'cold',
      appMode: 'development',
    });
    expect(attempt).not.toBeNull();
    expect(attempt!.milestone('request-received')).toBe(true);
    expect(await attempt!.bracketEngineState('request-received')).toMatchObject({
      sampleFrame: 96000,
      requestBeforeMonotonicNs: '250',
      responseAfterMonotonicNs: '300',
    });
    expect(attempt!.milestone('editor-usable')).toBe(true);
    expect(attempt!.recordControlTraffic({
      readCommands: 1,
      readEntries: 64,
      writeCommands: 0,
      writeEntries: 0,
    })).toBe(true);
    expect(attempt!.complete('usable')).toBe(true);
    expect(attempt!.milestone('shown')).toBe(false);
    expect(run!.complete('accepted')).toBe(true);

    await diagnostics.flush();

    const record = run!.snapshot()!;
    expect(record.attempts[0]).toMatchObject({
      attemptId: 'attempt-1',
      outcome: 'usable',
    });
    expect(record.attempts[0]!.milestones.map(({ name }) => name)).toEqual([
      'request-received',
      'editor-usable',
    ]);
    expect(record.attempts[0]!.frameObservations).toHaveLength(1);
    expect(record.attempts[0]!.controlTraffic).toEqual({
      readCommands: 1,
      readEntries: 64,
      writeCommands: 0,
      writeEntries: 0,
    });
    expect(writer.writeRun).toHaveBeenCalledWith(record);
  });

  it('warns on sampler and writer failures without failing the attempt', async () => {
    const warnings: string[] = [];
    const writer = {
      writeRun: vi.fn(async () => { throw new Error('disk full'); }),
    };
    const diagnostics = createEditorOpenDiagnostics({
      enabled: true,
      warn: (message) => warnings.push(message),
      sampler: {
        sampleEngineState: async () => { throw new Error('engine unavailable'); },
      },
      writer,
    });

    const run = diagnostics.beginRun(runInput)!;
    const attempt = run.startAttempt({ target, classification: 'reopened', appMode: 'packaged' })!;
    await expect(attempt.bracketEngineState('editor-usable')).resolves.toBeNull();
    expect(attempt.complete('usable')).toBe(true);
    expect(run.complete('incomplete')).toBe(true);
    await diagnostics.flush();

    expect(warnings.some((warning) => warning.includes('sampler failed'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('artifact write failed'))).toBe(true);
    expect(run.snapshot()!.attempts[0]!.outcome).toBe('usable');
  });

  it('bounds run and attempt allocation and resolves native output paths', async () => {
    const diagnostics = createEditorOpenDiagnostics({
      enabled: true,
      maxRuns: 1,
      maxAttemptsPerRun: 1,
      writer: { writeRun: async () => {} },
    });
    const run = diagnostics.beginRun(runInput)!;

    expect(run.startAttempt({ target, classification: 'cold', appMode: 'development' })).not.toBeNull();
    expect(run.startAttempt({ target, classification: 'cold', appMode: 'development' })).toBeNull();
    expect(run.complete('rejected')).toBe(true);
    expect(diagnostics.beginRun(runInput)).toBeNull();
    expect(resolveEditorOpenDiagnosticsDirectory('/tmp/blue-diagnostics'))
      .toBe('/tmp/blue-diagnostics');
    await diagnostics.dispose();
  });

  it('assigns unique attempt ids and keeps milestones append-only until the terminal outcome', async () => {
    const diagnostics = createEditorOpenDiagnostics({
      enabled: true,
      writer: { writeRun: async () => {} },
    });
    const run = diagnostics.beginRun(runInput)!;
    const first = run.startAttempt({ target, classification: 'cold', appMode: 'development' })!;
    const second = run.startAttempt({
      target: { ...target, trackId: 'track-2' },
      classification: 'reopened',
      appMode: 'development',
    })!;

    expect(first.attemptId).not.toBe(second.attemptId);
    expect(first.milestone('request-received')).toBe(true);
    expect(first.milestone('request-received')).toBe(false);
    expect(first.complete('usable')).toBe(true);
    expect(first.milestone('shown')).toBe(false);
    await diagnostics.dispose();
  });

  it('ignores an incomplete final JSONL line when validating fixtures', () => {
    const truncated = `${validDiagnosticRunJsonl}{"schemaVersion":1,"runId":"run-trunc`;
    const lines = truncated.trimEnd().split('\n');
    const completeRecords = lines
      .map((line, index) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          // Only the final line may be incomplete; a partial line elsewhere
          // means the artifact was corrupted mid-file.
          if (index === lines.length - 1) return null;
          throw new Error('Incomplete diagnostic line before end of file');
        }
      })
      .filter((record) => record !== null);

    expect(completeRecords).toHaveLength(1);
    expect(schemaValidator(completeRecords[0])).toBe(true);
  });

  it('keeps synthetic Windows paths in native form when resolving the output directory', () => {
    const windowsPath = 'C:\\Users\\tester\\AppData\\Local\\Temp\\blue-editor-open-diagnostics';
    // The resolver must not rewrite separators: the directory stays a native
    // host path and is never converted for embedded text.
    expect(resolveEditorOpenDiagnosticsDirectory(windowsPath))
      .toBe(path.resolve(windowsPath));
    expect(resolveEditorOpenDiagnosticsDirectory(windowsPath)).toContain('C:\\');

    // Whitespace-only configuration falls back to the default directory.
    expect(resolveEditorOpenDiagnosticsDirectory('   '))
      .toBe(path.join(tmpdir(), 'blue-editor-open-diagnostics'));
  });

  it('disables artifact writes after an injected unwritable-directory error', async () => {
    const warnings: string[] = [];
    let writeCalls = 0;
    const writeError = Object.assign(
      new Error("EACCES: permission denied, open 'C:\\Users\\tester\\diag\\editor-open-diagnostics.jsonl'"),
      { code: 'EACCES' },
    );
    const diagnostics = createEditorOpenDiagnostics({
      enabled: true,
      maxRuns: 2,
      warn: (message) => warnings.push(message),
      writer: { writeRun: async () => {
        writeCalls += 1;
        throw writeError;
      } },
    });

    const run = diagnostics.beginRun(runInput)!;
    const attempt = run.startAttempt({ target, classification: 'cold', appMode: 'development' })!;
    expect(attempt.complete('usable')).toBe(true);
    expect(run.complete('accepted')).toBe(true);
    await diagnostics.flush();

    expect(writeCalls).toBe(1);
    expect(warnings.some((message) => message.includes('artifact write failed'))).toBe(true);
    expect(warnings.some((message) => message.includes('EACCES'))).toBe(true);

    // The write path is disabled for the rest of the session: new runs are
    // refused and no further writes are attempted, while completed records
    // remain inspectable in memory.
    expect(diagnostics.beginRun(runInput)).toBeNull();
    expect(run.snapshot()!.attempts[0]!.outcome).toBe('usable');
    await diagnostics.dispose();
    expect(writeCalls).toBe(1);
  });

  it('performs no project mutation across a complete attempt lifecycle', async () => {
    // A frozen project document makes any accidental write throw, so a full
    // lifecycle passing it through the tracker canaries project writes.
    const projectDocument = Object.freeze({ fixture: 'project' });

    const attempts: Array<Record<string, unknown>> = [];
    const deps: TrackEditorDiagnosticAttemptTrackerDeps = {
      getProjectData: () => projectDocument as never,
      getCurrentProjectSessionId: () => 7,
      getAppMode: () => 'development',
      getGeneration: () => 0,
      bumpGeneration: () => {},
      getOrCreateRun: async () => ({
        runId: 'run-frozen',
        startAttempt: () => {
          const record: Record<string, unknown> = {
            attemptId: 'attempt-frozen',
            milestones: [] as string[],
            outcome: null as string | null,
          };
          attempts.push(record);
          return {
            attemptId: 'attempt-frozen',
            milestone: (name: string) => {
              record.milestones = [...(record.milestones as string[]), name];
              return true;
            },
            bracketEngineState: async () => null,
            recordAudioObservation: () => false,
            recordControlTraffic: () => false,
            complete: (outcome: string) => {
              record.outcome = outcome;
              return true;
            },
          } as never;
        },
        complete: () => true,
        snapshot: () => null,
      } as never),
    };
    const tracker = new TrackEditorDiagnosticAttemptTracker(deps);

    const started = tracker.startAttempt(request(), 'generic', 'cold');
    await started!.ready;
    expect(tracker.recordRendererMilestone(request(), 'editor-usable')).toBe(true);
    tracker.recordLifecycle(request(), 'closed');
    await tracker.finalize();

    expect(attempts[0]!.outcome).toBe('usable');
    expect((attempts[0]!.milestones as string[]).length).toBeGreaterThan(2);
    expect(Object.isFrozen(projectDocument)).toBe(true);
    expect(projectDocument).toEqual({ fixture: 'project' });
  });
});
