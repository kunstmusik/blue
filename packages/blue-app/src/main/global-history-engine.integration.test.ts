import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BSBKnob,
  BlueData,
  BlueSynthBuilder,
  BlueX7,
  ScoreTrack,
  TrackLayerGroup,
  cloneBlueX7Voice,
} from '@blue/data';
import { ProjectRuntimeReconciliation } from './project-runtime-reconciliation';
import type { RuntimeOperationAck } from './project-runtime-reconciliation';
import type { RuntimeWorkOperation } from './project-runtime-reconciliation';
import { ProjectHistory } from './project-history';
import { ProjectSession } from './project-session';
import { developmentEnginePath } from './engine-runtime';
import { EngineSession } from './engine-session';
import { allocateTcpEndpointPair } from './engine-endpoints';
import { createProjectEditorSnapshot } from '../shared/project-editor';

interface RecordingClient {
  applied: RuntimeWorkOperation[];
  channelValues: Map<string, number>;
}

function makeEngineClient(): RecordingClient & {
  applyOperation(operation: RuntimeWorkOperation): Promise<RuntimeOperationAck>;
} {
  const applied: RuntimeWorkOperation[] = [];
  const channelValues = new Map<string, number>();
  return {
    applied,
    channelValues,
    async applyOperation(operation) {
      applied.push(operation);
      if (operation.kind === 'channel-value') {
        channelValues.set(operation.channel, operation.value);
      }
      return { status: 'applied' };
    },
  };
}

function mixerLevel(level: number) {
  return { mixer: { type: 'updateChannel', channelId: 'Master', patch: { level } } } as const;
}

const BINDINGS = new Map([
  ['Master::level', { kind: 'channel' as const, channel: 'gkMasterLevel' }],
]);

function findRepositoryRoot(): string {
  let current = process.cwd();
  while (true) {
    if (existsSync(path.join(current, 'native', 'blue-engine'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function resolveAcceptanceEnginePath(): string | null {
  const repositoryRoot = findRepositoryRoot();
  const configuredPath = process.env.BLUE_ENGINE_PATH?.trim();
  const executableName = process.platform === 'win32' ? 'blue-engine.exe' : 'blue-engine';
  const candidates = [
    configuredPath
      ? path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(repositoryRoot, configuredPath)
      : null,
    developmentEnginePath(repositoryRoot, process.platform, process.arch),
    path.join(
      repositoryRoot,
      'native',
      'blue-engine',
      `build-${process.platform}-${process.arch}`,
      executableName,
    ),
  ].filter((candidate): candidate is string => candidate !== null);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function calculatePercentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)] ?? 0;
}

function realEngineOrchestra(channelName: string): string {
  return [
    'sr = 44100',
    'ksmps = 64',
    'nchnls = 2',
    '0dbfs = 1',
    '',
    'gk_t087_value init 0',
    `gk_t087_value chnexport "${channelName}", 3`,
    '',
    'instr 1',
    '  a0 init 0',
    '  out(a0, a0)',
    'endin',
    '',
  ].join('\n');
}

type RealEngineChannelClient = Pick<
  NonNullable<ReturnType<EngineSession['getClient']>>,
  'setChannel' | 'getChannel'
>;

async function startAcceptanceEngine(
  enginePath: string,
  kind: 'realtime' | 'blue-live',
  outputDirectory: string,
): Promise<{ session: EngineSession; channelName: string }> {
  const transport = process.platform === 'win32' ? 'tcp' : 'ipc';
  const endpointPair =
    transport === 'tcp' ? await allocateTcpEndpointPair({ basePort: 46000 }) : null;
  const channelName = `t087_${kind}`;
  const session = new EngineSession({
    kind,
    enginePath,
    transport,
    port: endpointPair?.controlPort,
    pubPort: endpointPair?.pubPort,
    extraArgs: ['--disable-shared-memory', '--disable-thread-priority-elevation'],
  });

  try {
    await session.spawn();
    const ready = await session.awaitReady();
    if (ready.status !== 'ready') {
      throw new Error(ready.errorMessage ?? `${kind} engine did not become ready`);
    }
    const client = session.getClient();
    if (!client) throw new Error(`${kind} engine client was not created`);

    const output = await client.setOption(`-o${path.join(outputDirectory, `${kind}.wav`)}`);
    const compiled = await client.compileOrc(realEngineOrchestra(channelName));
    const created = await client.createChannel(channelName, 0.25);
    const score = await client.readScore('i1 0 60');
    const started = await client.start();
    if (!output.ok || !compiled.ok || !created.ok || !score.ok || !started.ok) {
      throw new Error(
        `${kind} engine setup failed: ${[output, compiled, created, score, started]
          .filter((result) => !result.ok)
          .map((result) => result.message)
          .join('; ')}`,
      );
    }
    return { session, channelName };
  } catch (error) {
    await session.shutdown('acceptance-setup-failed');
    throw error;
  }
}

function acknowledgedReadbackClient(client: RealEngineChannelClient): {
  applyOperation(operation: RuntimeWorkOperation): Promise<RuntimeOperationAck>;
} {
  return {
    async applyOperation(operation) {
      if (operation.kind !== 'channel-value') {
        return { status: 'rejected', message: 'T087 only measures channel values' };
      }
      const written = await client.setChannel(operation.channel, operation.value);
      if (!written.ok) return { status: 'rejected', message: written.message };
      const deadline = performance.now() + 1000;
      let lastValue: number | null = null;
      while (performance.now() <= deadline) {
        const readback = await client.getChannel(operation.channel);
        if (readback.ok) {
          lastValue = readback.value;
          if (Math.abs(readback.value - operation.value) <= 1e-6) {
            return { status: 'applied' };
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      return {
        status: 'rejected',
        message:
          lastValue === null
            ? 'Engine readback failed'
            : `Engine readback mismatch: expected ${operation.value}, received ${lastValue}`,
      };
    },
  };
}

/**
 * US3 engine smoke: live reversals must be observable through engine control
 * readback — a resolved acknowledgement or an updated renderer knob alone is
 * not success. Uses the engine client protocol's channel store as the
 * readback surface.
 */
describe('global history engine integration (T040, US3)', () => {
  it('reads back live edits and audible reversals from the engine', async () => {
    const engine = makeEngineClient();
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, engine, new Map(BINDINGS));

    // Live edit during playback.
    const edit = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 2,
      patches: [mixerLevel(0.8)],
    });
    expect(edit[0]!.status).toBe('applied');
    expect(edit[0]!.appliedRevision).toBe(2);
    expect(engine.channelValues.get('gkMasterLevel')).toBe(0.8);

    // Undo restores the previous value; readback confirms the reversal.
    const undo = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 3,
      patches: [mixerLevel(0.25)],
    });
    expect(undo[0]!.status).toBe('applied');
    expect(engine.channelValues.get('gkMasterLevel')).toBe(0.25);
  });

  it('marks compiled changes restart-required without engine writes', async () => {
    const engine = makeEngineClient();
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, engine, new Map(BINDINGS));

    const result = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 4,
      patches: [{ globalOrc: 'instr 1\n endin\n' }],
    });

    expect(result[0]!.status).toBe('restart-required');
    expect(engine.applied).toHaveLength(0);
    expect(engine.channelValues.size).toBe(0);
  });

  it('never lets a superseded generation write into the new performance', async () => {
    let releaseAck: ((ack: RuntimeOperationAck) => void) | null = null;
    const oldEngine = makeEngineClient();
    oldEngine.applyOperation = async (operation) => {
      oldEngine.applied.push(operation);
      return new Promise<RuntimeOperationAck>((resolve) => {
        releaseAck = resolve;
      });
    };
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, oldEngine, new Map(BINDINGS));

    const staleCommit = reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 5,
      patches: [mixerLevel(0.9)],
    });

    // Let the plan start so the request is genuinely in flight.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(releaseAck).not.toBeNull();

    // Playback restarts (new generation) while the old plan is in flight.
    const newEngine = makeEngineClient();
    reconciliation.registerPerformance('timeline', 2, newEngine, new Map(BINDINGS));
    releaseAck!({ status: 'applied' });

    const staleResult = await staleCommit;
    expect(staleResult).toHaveLength(0);

    // The new performance only ever sees work planned for its generation.
    const newCommit = await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 6,
      patches: [mixerLevel(0.3)],
    });
    expect(newCommit[0]!.status).toBe('applied');
    expect(newEngine.channelValues.get('gkMasterLevel')).toBe(0.3);
    expect(oldEngine.channelValues.size).toBe(0);
  });

  it('writes only to running performances and skips stopped ones', async () => {
    const timelineEngine = makeEngineClient();
    const reconciliation = new ProjectRuntimeReconciliation();
    reconciliation.registerPerformance('timeline', 1, timelineEngine, new Map(BINDINGS));
    // Blue Live is stopped: not registered, no live synchronization duty.

    await reconciliation.reconcileCommit({
      documentId: 'doc-1',
      revision: 7,
      patches: [mixerLevel(0.6)],
    });

    expect(timelineEngine.channelValues.get('gkMasterLevel')).toBe(0.6);
  });

  it('keeps the canonical undo committed while reporting an injected runtime failure', async () => {
    const data = new BlueData();
    data.getMixer().getMaster().setLevel(0.25);
    const session = new ProjectSession();
    session.replace(data, '/tmp/t087-runtime-failure.blue', { documentId: 'doc-t087-failure' });
    const failureMessage = 'Injected timeline acknowledgement failure';
    let failureDeterminedAt = 0;
    const failingEngine = makeEngineClient();
    failingEngine.applyOperation = async (operation) => {
      failingEngine.applied.push(operation);
      return { status: 'rejected', message: failureMessage };
    };
    const reconciliation = new ProjectRuntimeReconciliation({
      operationTimeoutMs: 100,
      onOutcome: (outcome) => {
        if (outcome.status === 'failed') failureDeterminedAt = performance.now();
      },
    });
    reconciliation.registerPerformance('timeline', 1, failingEngine, new Map(BINDINGS));
    const history = new ProjectHistory({
      session,
      reconciliation,
      captureSnapshot: () => {
        const current = session.read();
        return current.data
          ? createProjectEditorSnapshot(
              current.data,
              current.filePath,
              current.sessionId,
              current.documentId ?? undefined,
            )
          : null;
      },
    });
    history.setSavedStateId(session.read().stateId);

    const commandReceivedAt = performance.now();
    const response = await history.commit({
      documentId: 'doc-t087-failure',
      operationId: 't087-failing-commit',
      expectedRevision: 0,
      contextSequence: 1,
      label: 'Set Master Level',
      patches: [mixerLevel(0.8)],
    });

    expect(response.status).toBe('committed');
    if (response.status !== 'committed') return;
    expect(response.runtimeOutcomes).toEqual([
      expect.objectContaining({
        performanceKind: 'timeline',
        status: 'failed',
        desiredRevision: 1,
        message: failureMessage,
      }),
    ]);
    expect(session.read().data?.getMixer().getMaster().getLevel()).toBe(0.8);
    expect(failureDeterminedAt - commandReceivedAt).toBeLessThanOrEqual(1000);
  });

  it('restores Track BlueX7 voice settings live on undo without restart-required', async () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    const blueX7 = new BlueX7();
    const initialVoice = cloneBlueX7Voice(blueX7.getVoice());
    track.setInstrument(blueX7);
    group.push(track);
    data.getScore().push(group);

    const session = new ProjectSession();
    session.replace(data, '/tmp/test.blue', { documentId: 'doc-bluex7' });
    const reconciliation = new ProjectRuntimeReconciliation();
    const engine = makeEngineClient();
    const ownerKey = `track:${group.getUniqueId()}:${track.getUniqueId()}`;
    const bindings = new Map([
      [
        `${ownerKey}::bluex7:voice`,
        {
          kind: 'automation' as const,
          supportsCreate: true,
          supportsUpdate: true,
          supportsDelete: true,
        },
      ],
    ]);
    reconciliation.registerPerformance('timeline', 1, engine, bindings);

    const history = new ProjectHistory({ session, reconciliation });

    const newVoice = cloneBlueX7Voice(initialVoice);
    newVoice.common.algorithm = 15;

    const commitRes = await history.commit({
      documentId: 'doc-bluex7',
      operationId: 'op-1',
      expectedRevision: 0,
      contextSequence: 1,
      label: 'Change Voice',
      patches: [
        {
          score: {
            type: 'updateTrackInstrument',
            track: {
              rootGroupId: group.getUniqueId(),
              trackId: track.getUniqueId(),
              projectSessionId: session.read().sessionId,
              projectRevision: session.read().revision,
            },
            patch: {
              blueX7: {
                type: 'replaceVoice',
                voice: newVoice,
              },
            },
          },
        },
      ],
    });

    expect(commitRes.status).toBe('committed');
    const lastOp = engine.applied[engine.applied.length - 1];
    expect(lastOp?.kind).toBe('automation');
    expect((lastOp as { parameterId?: string })?.parameterId).toBe('bluex7:voice');
    expect(
      (lastOp as { payload?: { voice?: { common?: { algorithm?: number } } } })?.payload?.voice
        ?.common?.algorithm,
    ).toBe(15);

    // Now execute undo:
    const undoRes = await history.undo({
      documentId: 'doc-bluex7',
      operationId: 'undo-1',
      expectedRevision: session.read().revision,
      contextSequence: 2,
    });

    expect(undoRes.status).toBe('committed');
    const undoOp = engine.applied[engine.applied.length - 1];
    expect(undoOp?.kind).toBe('automation');
    expect((undoOp as { parameterId?: string })?.parameterId).toBe('bluex7:voice');
    expect(
      (undoOp as { payload?: { voice?: { common?: { algorithm?: number } } } })?.payload?.voice
        ?.common?.algorithm,
    ).toBe(initialVoice.common.algorithm);
  });

  it('reconciles BSB instrument edits and concrete undo/redo inverses on all performances', async () => {
    const data = new BlueData();
    const instrument = new BlueSynthBuilder();
    const knob = new BSBKnob();
    knob.id = 'gain-widget';
    knob.objectName = 'gain';
    knob.value = 0.25;
    instrument.setInstrumentText('aout oscili <gain>, 440\nout aout');
    instrument.getGraphicInterface().getRootGroup().addChild(knob);
    data.getArrangement().addInstrument(instrument, 'arr-bsb');

    const session = new ProjectSession();
    session.replace(data, '/tmp/test-bsb.blue', { documentId: 'doc-bsb' });
    const reconciliation = new ProjectRuntimeReconciliation();
    const timeline = makeEngineClient();
    const blueLive = makeEngineClient();
    const ownerKey = 'arrangement:arr-bsb';
    const bindings = new Map([
      [`${ownerKey}::bsb:gain-widget`, { kind: 'channel' as const, channel: 'gkBsbGain' }],
    ]);
    reconciliation.registerPerformance('timeline', 1, timeline, new Map(bindings));
    reconciliation.registerPerformance('blueLive', 1, blueLive, new Map(bindings));

    const history = new ProjectHistory({ session, reconciliation });
    const patch = {
      orchestra: {
        type: 'updateInstrument' as const,
        assignmentId: 'arr-bsb',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties' as const,
            widgetId: 'gain-widget',
            properties: { value: 0.8 },
          },
        },
      },
    };

    const commit = await history.commit({
      documentId: 'doc-bsb',
      operationId: 'bsb-commit',
      expectedRevision: 0,
      contextSequence: 1,
      label: 'Adjust BSB Gain',
      patches: [patch],
    });
    expect(commit.status).toBe('committed');
    expect(timeline.channelValues.get('gkBsbGain')).toBe(0.8);
    expect(blueLive.channelValues.get('gkBsbGain')).toBe(0.8);

    const undo = await history.undo({
      documentId: 'doc-bsb',
      operationId: 'bsb-undo',
      expectedRevision: 1,
      contextSequence: 2,
    });
    expect(undo.status).toBe('committed');
    expect(timeline.channelValues.get('gkBsbGain')).toBe(0.25);
    expect(blueLive.channelValues.get('gkBsbGain')).toBe(0.25);

    const redo = await history.redo({
      documentId: 'doc-bsb',
      operationId: 'bsb-redo',
      expectedRevision: 2,
      contextSequence: 3,
    });
    expect(redo.status).toBe('committed');
    expect(timeline.channelValues.get('gkBsbGain')).toBe(0.8);
    expect(blueLive.channelValues.get('gkBsbGain')).toBe(0.8);
    expect(timeline.applied.map((operation) => operation.kind)).toEqual([
      'channel-value',
      'channel-value',
      'channel-value',
    ]);
    expect(blueLive.applied).toHaveLength(3);
  });
});

if (process.env.BLUE_RUN_REAL_ENGINE === '1') {
  describe('T116 real blue-engine acknowledgement boundary', () => {
    it('measures 100 live reversals with positive timeline and Blue Live readback', async () => {
      const enginePath = resolveAcceptanceEnginePath();
      if (!enginePath) {
        throw new Error(
          'T116 real-engine measurement requires a built engine; set BLUE_ENGINE_PATH or build native/blue-engine first',
        );
      }

      const outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-history-t087-'));
      let timeline: { session: EngineSession; channelName: string } | null = null;
      let blueLive: { session: EngineSession; channelName: string } | null = null;
      try {
        timeline = await startAcceptanceEngine(enginePath, 'realtime', outputDirectory);
        blueLive = await startAcceptanceEngine(enginePath, 'blue-live', outputDirectory);

        const reconciliation = new ProjectRuntimeReconciliation({
          operationTimeoutMs: 5000,
        });
        const timelineClient = timeline.session.getClient();
        const blueLiveClient = blueLive.session.getClient();
        if (!timelineClient || !blueLiveClient) throw new Error('T116 engine client unavailable');

        reconciliation.registerPerformance(
          'timeline',
          1,
          acknowledgedReadbackClient(timelineClient),
          new Map([['Master::level', { kind: 'channel' as const, channel: timeline.channelName }]]),
        );
        reconciliation.registerPerformance(
          'blueLive',
          1,
          acknowledgedReadbackClient(blueLiveClient),
          new Map([['Master::level', { kind: 'channel' as const, channel: blueLive.channelName }]]),
        );

        const data = new BlueData();
        data.getMixer().getMaster().setLevel(0.25);
        const session = new ProjectSession();
        session.replace(data, path.join(outputDirectory, 't087-history.blue'), {
          documentId: 'doc-t087-real-engine',
        });
        const publishedByOperation = new Map<
          string,
          { revision: number; acceptedOperationIds: string[] }
        >();
        const history = new ProjectHistory({
          session,
          reconciliation,
          captureSnapshot: () => {
            const current = session.read();
            return current.data
              ? createProjectEditorSnapshot(
                  current.data,
                  current.filePath,
                  current.sessionId,
                  current.documentId ?? undefined,
                )
              : null;
          },
          publishUpdated: (event) => {
            publishedByOperation.set(event.acceptedOperationIds[0] ?? '', {
              revision: event.revision,
              acceptedOperationIds: [...event.acceptedOperationIds],
            });
          },
        });
        history.setSavedStateId(session.read().stateId);

        let contextSequence = 0;
        const commitLevel = async (index: number): Promise<void> => {
          const result = await history.commit({
            documentId: 'doc-t087-real-engine',
            operationId: `t087-commit-${index}`,
            expectedRevision: session.read().revision,
            contextSequence: ++contextSequence,
            label: 'Set Master Level',
            patches: [mixerLevel(Number((0.2 + ((index * 7) % 70) / 100).toFixed(4)))],
          });
          expect(result.status).toBe('committed');
          if (result.status !== 'committed') return;
          expect(result.runtimeOutcomes).toHaveLength(2);
          if (!result.runtimeOutcomes?.every((outcome) => outcome.status === 'applied')) {
            throw new Error(
              `T116 commit runtime outcomes: ${JSON.stringify(result.runtimeOutcomes)}`,
            );
          }
        };

        const undoLatencies: number[] = [];
        const redoLatencies: number[] = [];
        let timelineReadbacks = 0;
        let blueLiveReadbacks = 0;
        const runCommand = async (
          direction: 'undo' | 'redo',
          index: number,
          measured: boolean,
        ): Promise<void> => {
          const operationId = `t087-${direction}-${index}`;
          const startedAt = performance.now();
          const result =
            direction === 'undo'
              ? await history.undo({
                  documentId: 'doc-t087-real-engine',
                  operationId,
                  expectedRevision: session.read().revision,
                  contextSequence: ++contextSequence,
                })
              : await history.redo({
                  documentId: 'doc-t087-real-engine',
                  operationId,
                  expectedRevision: session.read().revision,
                  contextSequence: ++contextSequence,
                });
          const elapsed = performance.now() - startedAt;

          expect(result.status).toBe('committed');
          if (result.status !== 'committed') return;
          const publication = publishedByOperation.get(operationId);
          expect(publication?.revision).toBe(result.revision);
          expect(publication?.acceptedOperationIds).toContain(operationId);
          expect(result.runtimeOutcomes).toHaveLength(2);
          expect(result.runtimeOutcomes?.map((outcome) => outcome.performanceKind).sort()).toEqual([
            'blueLive',
            'timeline',
          ]);
          if (!result.runtimeOutcomes?.every((outcome) => outcome.status === 'applied')) {
            throw new Error(
              `T116 ${direction} runtime outcomes: ${JSON.stringify(result.runtimeOutcomes)}`,
            );
          }
          timelineReadbacks +=
            result.runtimeOutcomes?.filter(
              (outcome) => outcome.performanceKind === 'timeline' && outcome.status === 'applied',
            ).length ?? 0;
          blueLiveReadbacks +=
            result.runtimeOutcomes?.filter(
              (outcome) => outcome.performanceKind === 'blueLive' && outcome.status === 'applied',
            ).length ?? 0;
          if (!measured) return;
          (direction === 'undo' ? undoLatencies : redoLatencies).push(elapsed);
        };

        await commitLevel(0);
        for (let i = 0; i < 5; i++) {
          await commitLevel(i + 1);
          await runCommand('undo', i, false);
          await runCommand('redo', i, false);
        }

        const heapBefore = process.memoryUsage().heapUsed;
        for (let i = 0; i < 100; i++) {
          await commitLevel(i + 6);
          await runCommand('undo', i + 5, true);
          await runCommand('redo', i + 5, true);
        }
        const heapAfter = process.memoryUsage().heapUsed;

        const summarize = (values: number[]) => ({
          p50: calculatePercentile(values, 50),
          p95: calculatePercentile(values, 95),
          max: Math.max(...values),
        });

        const metrics = {
          samplesPerDirection: 100,
          commandToPositiveRuntimeAckMs: {
            undo: summarize(undoLatencies),
            redo: summarize(redoLatencies),
          },
          positiveReadbacks: { timeline: timelineReadbacks, blueLive: blueLiveReadbacks },
          retainedBytes: history.read().retainedBytes,
          heapDeltaBytes: heapAfter - heapBefore,
        };
        console.log(`[T116 real-engine end-to-end metrics] ${JSON.stringify(metrics)}`);

        expect(undoLatencies).toHaveLength(100);
        expect(redoLatencies).toHaveLength(100);
        expect(metrics.commandToPositiveRuntimeAckMs.undo.p95).toBeLessThanOrEqual(250);
        expect(metrics.commandToPositiveRuntimeAckMs.redo.p95).toBeLessThanOrEqual(250);
      } finally {
        await Promise.all([
          timeline?.session.shutdown('t087-complete'),
          blueLive?.session.shutdown('t087-complete'),
        ]);
        await rm(outputDirectory, { recursive: true, force: true });
      }
    });
  });
}
