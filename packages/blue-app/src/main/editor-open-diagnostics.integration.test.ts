// Open-flow diagnostics integration: composes the real coordinator, the real
// Track editor attempt tracker, and the real engine-bridge sampling adapter
// the same way main.ts wires them, then validates the emitted JSONL artifact
// against the spec schema. main.ts itself cannot be imported in tests because
// module evaluation starts the Electron application lifecycle.

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import diagnosticSchema from '../../../../specs/093-fix-editor-audio-glitch/contracts/editor-open-diagnostic.schema.json';
import { createEditorOpenDiagnostics } from './editor-open-diagnostics';
import { createEngineStateSamplingAdapter } from './engine-bridge';
import {
  TrackEditorDiagnosticAttemptTracker,
  type TrackEditorDiagnosticAttemptTrackerDeps,
} from './track-editor-diagnostic-attempts';
import type { EditorOpenEngineStateSampler } from './editor-open-diagnostics';

const schemaValidator = new Ajv2020({ allErrors: true }).compile(diagnosticSchema);

const ARTIFACT_FILE_NAME = 'editor-open-diagnostics.jsonl';

const request = (trackId = 'track-1') => ({
  track: { rootGroupId: 'group-1', trackId, projectSessionId: 7, projectRevision: 1 },
});

interface OpenFlowHarness {
  diagnostics: ReturnType<typeof createEditorOpenDiagnostics>;
  tracker: TrackEditorDiagnosticAttemptTracker;
  warnings: string[];
  lastRun: ReturnType<
    NonNullable<ReturnType<typeof createEditorOpenDiagnostics>['beginRun']>
  > | null;
}

function createOpenFlow(sampler: EditorOpenEngineStateSampler): OpenFlowHarness {
  const warnings: string[] = [];
  const diagnostics = createEditorOpenDiagnostics({
    enabled: true,
    outputDirectory: '/unused',
    writer: {
      // Keep writes bounded in-memory; the scenarios below validate the
      // serialized record through snapshot() and a real file artifact is
      // exercised by the artifact test below.
      writeRun: async () => {},
    },
    warn: (message) => warnings.push(message),
    ids: {
      createRunId: () => 'run-int',
      createAttemptId: (() => {
        let counter = 0;
        return () => `attempt-${++counter}`;
      })(),
    },
    sampler,
  });

  let generation = 0;
  const harness: OpenFlowHarness = {
    diagnostics,
    tracker: undefined as never,
    warnings,
    lastRun: null,
  };

  const trackerDeps: TrackEditorDiagnosticAttemptTrackerDeps = {
    getProjectData: () => ({}) as never,
    getCurrentProjectSessionId: () => 7,
    getAppMode: () => 'development',
    getGeneration: () => generation,
    bumpGeneration: () => {
      generation += 1;
    },
    // Mirrors main.ts getOrCreateEditorOpenDiagnosticRun: reuse the active
    // run, sample engine state, then begin the run for the current generation.
    getOrCreateRun: async (_data, expectedGeneration) => {
      if (expectedGeneration !== generation) return null;
      if (harness.lastRun) return harness.lastRun;
      const engineState = await sampler.sampleEngineState();
      if (!engineState || expectedGeneration !== generation) return null;
      harness.lastRun = diagnostics.beginRun({
        candidateId: 'integration',
        condition: 'editor-mount',
        environment: {
          platform: 'darwin-arm64',
          appBuild: 'test-build',
          engineBuild: 'test-engine',
          device: 'test-device',
          sampleRate: engineState.sampleRate,
          ksmps: engineState.ksmps,
          diagnosticsEnabled: true,
        },
        workload: {
          fixtureId: 'fixture-int',
          sampleRate: engineState.sampleRate,
          ksmps: engineState.ksmps,
          controlDurationSeconds: 60,
          baselineInterruptionCount: 0,
          headroomEvidence: { clean: true },
          outputMode: 'audible',
        },
      });
      return harness.lastRun;
    },
  };
  harness.tracker = new TrackEditorDiagnosticAttemptTracker(trackerDeps);
  return harness;
}

describe('editor-open diagnostics open-flow integration', () => {
  let outputDirectory: string;

  beforeEach(async () => {
    outputDirectory = await mkdtemp(path.join(tmpdir(), 'editor-open-diagnostics-int-'));
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  it('records a cold open with ordered milestones and a real engine-state bracket', async () => {
    const engineClient = {
      getEngineState: async () => ({
        ok: true,
        state: {
          state: 'running' as const,
          stopReason: 'none' as const,
          engineCreated: true,
          running: true,
          sampleFrames: 96000,
          sampleRate: 48000,
          ksmps: 32,
          sequence: 7,
          lastError: '',
        },
        message: '',
      }),
    };
    const harness = createOpenFlow(createEngineStateSamplingAdapter(() => engineClient));

    const started = harness.tracker.startAttempt(request(), 'generic', 'cold');
    expect(started).not.toBeNull();
    harness.tracker.queueMilestone(started!.state, 'snapshot-start');
    harness.tracker.queueBracket(started!.state, 'snapshot-start');
    await started!.ready;
    expect(harness.tracker.recordRendererMilestone(request(), 'editor-usable')).toBe(true);
    harness.tracker.recordLifecycle(request(), 'shown');
    harness.tracker.recordLifecycle(request(), 'closed');

    await harness.tracker.finalize();
    harness.lastRun?.complete('accepted');
    await harness.diagnostics.flush();

    const record = harness.lastRun!.snapshot()!;
    expect(record.attempts).toHaveLength(1);
    const attempt = record.attempts[0]!;
    expect(attempt.classification).toBe('cold');
    expect(attempt.outcome).toBe('usable');
    expect(attempt.milestones.map(({ name }) => name)).toEqual([
      'request-received',
      'target-validated',
      'snapshot-start',
      'editor-usable',
      'shown',
    ]);
    expect(attempt.frameObservations).toHaveLength(1);
    expect(attempt.frameObservations[0]).toMatchObject({
      milestone: 'snapshot-start',
      sampleFrame: 96000,
      sampleRate: 48000,
      ksmps: 32,
    });
    expect(schemaValidator(record)).toBe(true);
  });

  it('records a reused focus-existing attempt without a new run', async () => {
    const sampler: EditorOpenEngineStateSampler = {
      sampleEngineState: async () => ({ sampleFrame: 48000, sampleRate: 48000, ksmps: 32 }),
    };
    const harness = createOpenFlow(sampler);

    const reused = harness.tracker.startAttempt(request(), 'blue-x7', 'reused', false);
    expect(reused).not.toBeNull();
    await reused!.ready;
    harness.tracker.queueMilestone(reused!.state, 'existing-focused');
    harness.tracker.setTerminal(reused!.state, { outcome: 'usable' });
    harness.tracker.completeAttempt(reused!.key, reused!.state);

    await harness.tracker.finalize();

    const record = harness.lastRun!.snapshot()!;
    expect(record.attempts).toHaveLength(1);
    expect(record.attempts[0]).toMatchObject({
      classification: 'reused',
      outcome: 'usable',
    });
    expect(record.attempts[0]!.milestones.map(({ name }) => name)).toEqual([
      'request-received',
      'target-validated',
      'existing-focused',
      'editor-usable',
    ]);
  });

  it('classifies a repeat open of the same target as reopened', async () => {
    const sampler: EditorOpenEngineStateSampler = {
      sampleEngineState: async () => ({ sampleFrame: 0, sampleRate: 48000, ksmps: 32 }),
    };
    const harness = createOpenFlow(sampler);

    const first = harness.tracker.startAttempt(request(), 'generic', 'cold');
    await first!.ready;
    harness.tracker.markTargetSeen(first!.key);
    harness.tracker.recordLifecycle(request(), 'closed');

    const second = harness.tracker.startAttempt(request(), 'generic', 'reopened');
    await second!.ready;
    harness.tracker.recordLifecycle(request(), 'closed');

    await harness.tracker.finalize();

    const record = harness.lastRun!.snapshot()!;
    expect(record.attempts.map((attempt) => attempt.classification)).toEqual([
      'cold',
      'reopened',
    ]);
    expect(record.attempts.every((attempt) => attempt.outcome === 'closed-before-usable')).toBe(true);
  });

  it('rejects invalid target identities without writing an attempt', async () => {
    const sampler: EditorOpenEngineStateSampler = {
      sampleEngineState: async () => ({ sampleFrame: 0, sampleRate: 48000, ksmps: 32 }),
    };
    const harness = createOpenFlow(sampler);

    const run = harness.diagnostics.beginRun({
      candidateId: 'integration',
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
        fixtureId: 'fixture-int',
        sampleRate: 48000,
        ksmps: 32,
        controlDurationSeconds: 60,
        baselineInterruptionCount: 0,
        headroomEvidence: { clean: true },
        outputMode: 'audible',
      },
    });
    expect(run).not.toBeNull();
    const invalidTarget = {
      kind: 'track-instrument',
      projectSessionId: '7',
      // layerGroupId and trackId are missing on purpose.
    } as never;
    expect(
      run!.startAttempt({ target: invalidTarget, classification: 'cold', appMode: 'development' }),
    ).toBeNull();

    run!.complete('rejected');
    const record = run!.snapshot()!;
    expect(record.attempts).toHaveLength(0);
    expect(schemaValidator(record)).toBe(true);
  });

  it('records navigation failure with its error code', async () => {
    const sampler: EditorOpenEngineStateSampler = {
      sampleEngineState: async () => ({ sampleFrame: 0, sampleRate: 48000, ksmps: 32 }),
    };
    const harness = createOpenFlow(sampler);

    const started = harness.tracker.startAttempt(request(), 'generic', 'cold');
    await started!.ready;
    harness.tracker.recordLifecycle(request(), 'failed', 'navigation-failed');

    await harness.tracker.finalize();

    const record = harness.lastRun!.snapshot()!;
    expect(record.attempts[0]).toMatchObject({
      outcome: 'failed',
      errorCode: 'navigation-failed',
    });
  });

  it('degrades brackets to warnings when the engine state sampler fails', async () => {
    let engineCalls = 0;
    const engineClient = {
      getEngineState: async () => {
        engineCalls += 1;
        if (engineCalls === 1) {
          // The first sample creates the run, so the attempt materializes.
          return {
            ok: true,
            state: {
              state: 'running' as const,
              stopReason: 'none' as const,
              engineCreated: true,
              running: true,
              sampleFrames: 48000,
              sampleRate: 48000,
              ksmps: 32,
              sequence: 1,
              lastError: '',
            },
            message: '',
          };
        }
        if (engineCalls === 2) {
          // An unavailable engine state degrades silently to no bracket.
          return { ok: false, state: null, message: 'not running' };
        }
        throw new Error('engine unavailable');
      },
    };
    const harness = createOpenFlow(
      createEngineStateSamplingAdapter(
        () => engineClient as unknown as Pick<import('@blue/engine-client').EngineClient, 'getEngineState'>,
      ),
    );

    const started = harness.tracker.startAttempt(request(), 'generic', 'cold');
    await started!.ready;

    harness.tracker.queueBracket(started!.state, 'snapshot-start');
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    expect(harness.warnings).toHaveLength(0);

    // A throwing engine state produces a warning and still no bracket.
    harness.tracker.queueBracket(started!.state, 'snapshot-end');
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    expect(harness.warnings.some((message) => message.includes('sampler failed'))).toBe(true);

    harness.tracker.setTerminal(started!.state, { outcome: 'usable' });
    harness.tracker.completeAttempt(started!.key, started!.state);
    await harness.tracker.finalize();

    const record = harness.lastRun!.snapshot()!;
    expect(record.attempts[0]!.frameObservations).toHaveLength(0);
    expect(record.attempts[0]!.outcome).toBe('usable');
  });

  it('writes a schema-valid JSONL artifact through the real file writer', async () => {
    const sampler: EditorOpenEngineStateSampler = {
      sampleEngineState: async () => ({ sampleFrame: 48000, sampleRate: 48000, ksmps: 32 }),
    };
    const diagnostics = createEditorOpenDiagnostics({
      enabled: true,
      outputDirectory,
      ids: {
        createRunId: () => 'run-file',
        createAttemptId: () => 'attempt-file',
      },
      sampler,
    });
    const run = diagnostics.beginRun({
      candidateId: 'integration',
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
        fixtureId: 'fixture-int',
        sampleRate: 48000,
        ksmps: 32,
        controlDurationSeconds: 60,
        baselineInterruptionCount: 0,
        headroomEvidence: { clean: true },
        outputMode: 'audible',
      },
    })!;
    const attempt = run.startAttempt({
      target: {
        kind: 'track-instrument',
        projectSessionId: '7',
        layerGroupId: 'group-1',
        trackId: 'track-1',
        instrumentKind: 'generic',
      },
      classification: 'cold',
      appMode: 'development',
    })!;
    attempt.milestone('request-received');
    expect(attempt.complete('usable')).toBe(true);
    expect(run.complete('accepted')).toBe(true);
    await diagnostics.flush();

    const text = await readFile(path.join(outputDirectory, ARTIFACT_FILE_NAME), 'utf8');
    const records = text.trimEnd().split('\n').map((line) => JSON.parse(line) as unknown);
    expect(records).toHaveLength(1);
    expect(schemaValidator(records[0])).toBe(true);
    await diagnostics.dispose();
  });
});
