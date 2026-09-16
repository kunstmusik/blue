import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AudioClip,
  BSBDropdown,
  BSBHSlider,
  BSBKnob,
  BlueData,
  BlueSynthBuilder,
  BlueX7,
  Channel,
  GenericInstrument,
  ScoreTrack,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
  cloneBlueX7Voice,
  resolveMixerGateIntent,
} from '@blue/data';
import { ProjectRuntimeReconciliation } from './project-runtime-reconciliation';
import type { RuntimeOperationAck } from './project-runtime-reconciliation';
import type { RuntimeWorkOperation } from './project-runtime-reconciliation';
import { ProjectHistory } from './project-history';
import { ProjectSession } from './project-session';
import { developmentEnginePath } from './engine-runtime';
import { EngineSession } from './engine-session';
import { allocateTcpEndpointPair } from './engine-endpoints';
import { MixerGatePublisher, type MixerGateEngineIO } from './mixer-mute-solo-runtime';
import {
  createTestGateCatalog,
  TEST_GATE_SIGNATURE,
  FakeMixerGateEngine,
} from './mixer-mute-solo-test-support';
import type { CompiledMixerGateBindings } from '@blue/data';
import { createProjectEditorSnapshot } from '../shared/project-editor';
import {
  buildRuntimeBindingRegistry,
  syncCompiledRuntimeParameterNames,
} from './runtime-parameter-sync';

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

  it('keeps generated timeline and Blue Live gate outcomes independent during history replay (T080)', async () => {
    const data = new BlueData();
    data.getMixer().setEnabled(true);
    data.getScore().length = 0;
    const group = new TrackLayerGroup();
    const track = new ScoreTrack();
    track.setUniqueId('track-a');
    const clip = new AudioClip();
    clip.setStartTime(TimePosition.beats(0));
    clip.setSubjectiveDuration(TimeDuration.beats(1));
    clip.setAudioFile('generated-history-source.wav');
    track.push(clip);
    group.push(track);
    data.getScore().push(group);

    const channel = new Channel();
    channel.setName('Audio A');
    channel.setAssociation('track-a');
    data.getMixer().getChannels().push(channel);

    const timelineCsd = data.toRealtimePlaybackCSD();
    const blueLiveCsd = data.toBlueLiveCSD();
    const catalog = timelineCsd.mixerGateBindings;
    expect(catalog).toBeDefined();
    expect(blueLiveCsd.mixerGateBindings?.signature).toBe(catalog?.signature);
    expect(timelineCsd.csdText).toContain('generated-history-source.wav');
    expect(timelineCsd.csdText).toContain('BlueMixer');
    expect(blueLiveCsd.csdText).toContain('BlueMixer');
    if (!catalog) return;

    const timelineEngine = new FakeMixerGateEngine();
    const timelinePublisher = new MixerGatePublisher(timelineEngine, {
      observeAttempts: 20,
      observeDelayMs: 1,
    });
    timelinePublisher.setBindings('timeline', catalog);
    const timelineClient = {
      applyOperation: async (operation: RuntimeWorkOperation): Promise<RuntimeOperationAck> => {
        if (operation.kind !== 'mixer-gates') {
          return { status: 'rejected', message: 'generated gate fixture only' };
        }
        const result = await timelinePublisher.publish(
          'timeline',
          operation.signature,
          operation.values,
        );
        return result.ok ? { status: 'applied' } : { status: 'rejected', message: result.message };
      },
    };
    const blueLiveClient = {
      applyOperation: async (): Promise<RuntimeOperationAck> => ({
        status: 'rejected',
        message: 'Injected Blue Live gate failure',
      }),
    };
    const reconciliation = new ProjectRuntimeReconciliation({
      resolveMixerGates: () => resolveMixerGateIntent(data.getMixer()),
    });
    const bindings = new Map([
      ['mixer-gates::gates', { kind: 'mixer-gates' as const, signature: catalog.signature }],
    ]);
    reconciliation.registerPerformance('timeline', 1, timelineClient, bindings);
    reconciliation.registerPerformance('blueLive', 1, blueLiveClient, bindings);

    const session = new ProjectSession();
    session.replace(data, '/tmp/t111-generated-history.blue', {
      documentId: 'doc-t111-generated-history',
    });
    const history = new ProjectHistory({ session, reconciliation });
    history.setSavedStateId(session.read().stateId);
    const channelRef = session.read().data!.getMixer().getChannels()[0]!;
    const docId = session.read().documentId!;
    const patch = {
      mixer: {
        type: 'updateChannel' as const,
        channelId: 'track-a',
        patch: { muted: true },
      },
    };

    const commit = await history.commit({
      documentId: docId,
      operationId: 't111-generated-mute',
      expectedRevision: 0,
      contextSequence: 1,
      label: 'Mute Generated Audio Channel',
      patches: [patch],
    });
    expect(commit.status).toBe('committed');
    if (commit.status !== 'committed') return;
    expect(commit.runtimeOutcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ performanceKind: 'timeline', status: 'applied' }),
        expect.objectContaining({
          performanceKind: 'blueLive',
          status: 'failed',
          message: 'Injected Blue Live gate failure',
        }),
      ]),
    );
    expect(channelRef.isMuted()).toBe(true);
    expect(channelRef.getAssociation()).toBe('track-a');
    expect(history.isDirty()).toBe(true);

    const undo = await history.undo({
      documentId: docId,
      operationId: 't111-generated-undo',
      expectedRevision: 1,
      contextSequence: 2,
    });
    expect(undo.status).toBe('committed');
    if (undo.status !== 'committed') return;
    expect(channelRef.isMuted()).toBe(false);
    expect(channelRef.getAssociation()).toBe('track-a');
    expect(undo.runtimeOutcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ performanceKind: 'timeline', status: 'applied' }),
        expect.objectContaining({ performanceKind: 'blueLive', status: 'failed' }),
      ]),
    );
    expect(history.isDirty()).toBe(false);

    const redo = await history.redo({
      documentId: docId,
      operationId: 't111-generated-redo',
      expectedRevision: 2,
      contextSequence: 3,
    });
    expect(redo.status).toBe('committed');
    if (redo.status !== 'committed') return;
    expect(channelRef.isMuted()).toBe(true);
    expect(channelRef.getAssociation()).toBe('track-a');
    expect(redo.runtimeOutcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ performanceKind: 'timeline', status: 'applied' }),
        expect.objectContaining({ performanceKind: 'blueLive', status: 'failed' }),
      ]),
    );
    expect(history.isDirty()).toBe(true);
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

  it('keeps compiled BSB slider bindings through dropdown history replay (T135)', async () => {
    const data = new BlueData();
    const instrument = new BlueSynthBuilder();
    const slider = new BSBHSlider();
    slider.id = 'history-cutoff-slider';
    slider.objectName = 'cutoff';
    slider.value = 0.37;
    const dropdown = new BSBDropdown();
    dropdown.id = 'history-mode-dropdown';
    dropdown.objectName = 'mode';
    dropdown.dropdownItems = [
      { name: 'Gate', value: 'gate', uniqueId: 'mode-gate' },
      { name: 'Envelope', value: 'envelope', uniqueId: 'mode-envelope' },
    ];
    dropdown.setValue(0);
    instrument.setInstrumentText('aout oscili <cutoff> + <mode>, 440\nout aout');
    instrument.getGraphicInterface().getRootGroup().addChild(slider);
    instrument.getGraphicInterface().getRootGroup().addChild(dropdown);
    data.getArrangement().addInstrument(instrument, 'arr-bsb-slider-history');

    const render = data.toRealtimePlaybackCSD();
    syncCompiledRuntimeParameterNames(data.getArrangement(), data.getMixer(), render.parameters);
    const bindings = buildRuntimeBindingRegistry(data, render.parameters);
    const ownerKey = 'arrangement:arr-bsb-slider-history';
    const sliderBinding = bindings.get(`${ownerKey}::bsb:history-cutoff-slider`);
    const dropdownBinding = bindings.get(`${ownerKey}::bsb:history-mode-dropdown:selectedIndex`);
    if (sliderBinding?.kind !== 'channel' || dropdownBinding?.kind !== 'channel') {
      throw new Error('Expected compiled BSB slider and dropdown bindings');
    }

    const session = new ProjectSession();
    session.replace(data, '/tmp/test-bsb-slider-runtime-history.blue', {
      documentId: 'doc-bsb-slider-runtime-history',
    });
    const reconciliation = new ProjectRuntimeReconciliation();
    const timeline = makeEngineClient();
    const blueLive = makeEngineClient();
    reconciliation.registerPerformance('timeline', 1, timeline, bindings);
    reconciliation.registerPerformance('blueLive', 1, blueLive, bindings);
    const history = new ProjectHistory({ session, reconciliation });
    const documentId = session.read().documentId!;

    const liveState = () => {
      const current = session
        .read()
        .data?.getArrangement()
        .getInstrumentById('arr-bsb-slider-history');
      if (!(current instanceof BlueSynthBuilder)) throw new Error('BSB fixture missing');
      const children = current.getGraphicInterface().getRootGroup().getChildren();
      const currentSlider = children.find((child) => child.id === slider.id) as BSBHSlider;
      const currentDropdown = children.find((child) => child.id === dropdown.id) as BSBDropdown;
      return {
        sliderId: currentSlider?.id,
        sliderValue: currentSlider?.value,
        dropdownId: currentDropdown?.id,
        dropdownIndex: currentDropdown?.selectedIndex,
      };
    };

    const preview = await reconciliation.previewChannelValue({
      ownerKey,
      parameterId: 'bsb:history-cutoff-slider',
      value: 0.91,
      gestureId: 'bsb-slider-preview',
    });
    expect(preview.status).toBe('applied');
    expect(timeline.channelValues.get(sliderBinding.channel)).toBe(0.91);
    expect(liveState()).toMatchObject({ sliderValue: 0.37 });
    await reconciliation.drainPreviews('bsb-slider-preview');
    timeline.applied.length = 0;
    blueLive.applied.length = 0;

    const dropdownPatch = {
      orchestra: {
        type: 'updateInstrument' as const,
        assignmentId: 'arr-bsb-slider-history',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties' as const,
            widgetId: dropdown.id,
            properties: { selectedIndex: 1 },
          },
        },
      },
    };
    const dropdownCommit = await history.commit({
      documentId,
      operationId: 'bsb-slider-dropdown',
      expectedRevision: session.read().revision,
      contextSequence: 1,
      label: 'Select BSB Mode',
      patches: [dropdownPatch],
    });
    expect(dropdownCommit.status).toBe('committed');
    expect(liveState()).toMatchObject({
      sliderId: slider.id,
      sliderValue: 0.37,
      dropdownId: dropdown.id,
      dropdownIndex: 1,
    });
    expect(timeline.channelValues.get(dropdownBinding.channel)).toBe(1);

    const sliderPatch = {
      orchestra: {
        type: 'updateInstrument' as const,
        assignmentId: 'arr-bsb-slider-history',
        patch: {
          bsbInterface: {
            type: 'updateWidgetProperties' as const,
            widgetId: slider.id,
            properties: { value: 0.73 },
          },
        },
      },
    };
    const sliderCommit = await history.commit({
      documentId,
      operationId: 'bsb-slider-value',
      expectedRevision: session.read().revision,
      contextSequence: 2,
      label: 'Adjust BSB Cutoff',
      patches: [sliderPatch],
    });
    expect(sliderCommit.status).toBe('committed');
    expect(liveState()).toMatchObject({ sliderId: slider.id, sliderValue: 0.73, dropdownIndex: 1 });
    expect(timeline.channelValues.get(sliderBinding.channel)).toBe(0.73);
    expect(reconciliation.getOutcome('timeline')?.status).toBe('applied');
    expect(reconciliation.getOutcome('blueLive')?.status).toBe('applied');

    const undoSlider = await history.undo({
      documentId,
      operationId: 'bsb-slider-undo',
      expectedRevision: session.read().revision,
      contextSequence: 3,
    });
    expect(undoSlider.status).toBe('committed');
    expect(liveState()).toMatchObject({ sliderValue: 0.37, dropdownIndex: 1 });
    expect(timeline.channelValues.get(sliderBinding.channel)).toBe(0.37);

    const undoDropdown = await history.undo({
      documentId,
      operationId: 'bsb-dropdown-undo',
      expectedRevision: session.read().revision,
      contextSequence: 4,
    });
    expect(undoDropdown.status).toBe('committed');
    expect(liveState()).toMatchObject({ sliderValue: 0.37, dropdownIndex: 0 });
    expect(timeline.channelValues.get(dropdownBinding.channel)).toBe(0);

    const redoDropdown = await history.redo({
      documentId,
      operationId: 'bsb-dropdown-redo',
      expectedRevision: session.read().revision,
      contextSequence: 5,
    });
    expect(redoDropdown.status).toBe('committed');
    expect(liveState()).toMatchObject({ sliderValue: 0.37, dropdownIndex: 1 });
    expect(timeline.channelValues.get(dropdownBinding.channel)).toBe(1);

    const redoSlider = await history.redo({
      documentId,
      operationId: 'bsb-slider-redo',
      expectedRevision: session.read().revision,
      contextSequence: 6,
    });
    expect(redoSlider.status).toBe('committed');
    expect(liveState()).toMatchObject({
      sliderId: slider.id,
      sliderValue: 0.73,
      dropdownId: dropdown.id,
      dropdownIndex: 1,
    });
    expect(timeline.channelValues.get(sliderBinding.channel)).toBe(0.73);
    expect(blueLive.channelValues.get(sliderBinding.channel)).toBe(0.73);
  });

  it('stages a >256-entry gate vector through the two-bank protocol within the latency budget (Spec 111 T016/T058)', async () => {
    const enginePath = resolveAcceptanceEnginePath();
    if (!enginePath) {
      throw new Error(
        'real-engine gate publication requires a built engine; set BLUE_ENGINE_PATH or build native/blue-engine first',
      );
    }

    const outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-history-t111-'));
    let engine: { session: EngineSession; channelName: string } | null = null;
    try {
      const gateCount = 300;
      const catalog: CompiledMixerGateBindings = createTestGateCatalog(gateCount);
      const bankLines: string[] = [];
      for (const gate of catalog.gates) {
        for (const symbol of gate.bankSymbols) {
          bankLines.push(`${symbol} init 1`);
          bankLines.push(`${symbol} chnexport "${symbol}", 3`);
        }
      }
      bankLines.push(`${catalog.commitChannel} init 0`);
      bankLines.push(`${catalog.commitChannel} chnexport "${catalog.commitChannel}", 3`);
      bankLines.push(`${catalog.appliedChannel} init 0`);
      bankLines.push(`${catalog.appliedChannel} chnexport "${catalog.appliedChannel}", 3`);

      const transport = process.platform === 'win32' ? 'tcp' : 'ipc';
      const endpointPair =
        transport === 'tcp' ? await allocateTcpEndpointPair({ basePort: 46000 }) : null;
      const gateSession = new EngineSession({
        kind: 'realtime',
        enginePath,
        transport,
        port: endpointPair?.controlPort,
        pubPort: endpointPair?.pubPort,
        extraArgs: ['--disable-shared-memory', '--disable-thread-priority-elevation'],
      });
      engine = { session: gateSession, channelName: 't111_gates' };
      await gateSession.spawn();
      const ready = await gateSession.awaitReady();
      if (ready.status !== 'ready') {
        throw new Error(ready.errorMessage ?? 'gate engine did not become ready');
      }
      const client = gateSession.getClient();
      if (!client) throw new Error('gate engine client unavailable');

      const output = await client.setOption(`-o${path.join(outputDirectory, 't111-gates.wav')}`);
      const compiled = await client.compileOrc(
        [
          'sr = 44100',
          'ksmps = 64',
          'nchnls = 2',
          '0dbfs = 1',
          '',
          ...bankLines,
          '',
          'instr 1',
          '  a0 init 0',
          '  out(a0, a0)',
          'endin',
          '',
          // BlueMixer's protocol tail: echo the sampled commit token so the
          // publisher can observe audible bank selection.
          `instr blueGateEcho`,
          `  ${catalog.appliedChannel} = ${catalog.commitChannel}`,
          'endin',
          '',
        ].join('\n'),
      );
      const score = await client.readScore('i1 0 60\ni"blueGateEcho" 0 60');
      const started = await client.start();
      if (!output.ok) throw new Error(`setOption failed: ${output.message}`);
      if (!compiled.ok) throw new Error(`compileOrc failed: ${compiled.message}`);
      if (!score.ok) throw new Error(`readScore failed: ${score.message}`);
      if (!started.ok) throw new Error(`start failed: ${started.message}`);

      const io: MixerGateEngineIO = {
        setChannels: (entries) => client.setChannels(entries),
        getChannels: (names) => client.getChannels(names),
      };
      const publisher = new MixerGatePublisher(io, {
        maxBatchEntries: 256,
        observeAttempts: 200,
        observeDelayMs: 5,
      });
      publisher.setBindings('timeline', catalog);

      const values = Array.from({ length: gateCount }, (_, i) => (i % 2 === 0 ? 0 : 1));
      const startedAt = performance.now();
      const result = await publisher.publish('timeline', TEST_GATE_SIGNATURE, values);
      const elapsedMs = performance.now() - startedAt;
      expect(result.ok).toBe(true);
      expect(result.commitToken).toBe(1);

      // The applied echo proves the engine selected the staged bank.
      const applied = await client.getChannels([catalog.appliedChannel]);
      expect(applied.ok && applied.values[0] === 1).toBe(true);

      // Bank 1 (inactive at token 0) carries the full staged vector.
      const bankRead = await client.getChannels(
        catalog.gates.slice(0, 8).map((gate) => gate.bankSymbols[1]),
      );
      expect(bankRead.ok).toBe(true);
      if (bankRead.ok) {
        expect(bankRead.values).toEqual(values.slice(0, 8));
      }

      // A second publication alternates banks and advances the token.
      const second = await publisher.publish(
        'timeline',
        TEST_GATE_SIGNATURE,
        Array.from({ length: gateCount }, () => 1),
      );
      expect(second.ok).toBe(true);
      expect(second.commitToken).toBe(2);

      // Publication of a 300-gate vector (2 stage batches + commit + echo)
      // settles well inside the 100 ms audible-response budget on the
      // reference local engine.
      expect(elapsedMs).toBeLessThan(100);

      // Batch double: >256 gates split at the 256-entry engine bound.
      const fake = new FakeMixerGateEngine();
      const fakePublisher = new MixerGatePublisher(fake, { maxBatchEntries: 256 });
      const batchCatalog = createTestGateCatalog(700);
      fakePublisher.setBindings('blueLive', batchCatalog);
      const batchResult = await fakePublisher.publish('blueLive', TEST_GATE_SIGNATURE, [
        ...Array(700).fill(1),
      ]);
      expect(batchResult.ok).toBe(true);
      for (const write of fake.writes) {
        expect(write.length).toBeLessThanOrEqual(256);
      }
    } finally {
      if (engine) {
        await engine.session.shutdown('t111-complete');
      }
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }, 30_000);
});

if (process.env.BLUE_RUN_REAL_ENGINE === '1') {
  describe('T093 real blue-engine project-history reconciliation', () => {
    it('replays mode and mixer-enable history on both running performances and skips stopped ones', async () => {
      const enginePath = resolveAcceptanceEnginePath();
      if (!enginePath) {
        throw new Error(
          'T093 real-engine history validation requires a built engine; set BLUE_ENGINE_PATH or build native/blue-engine first',
        );
      }

      const outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-history-t093-'));
      let timeline: { session: EngineSession; channelName: string } | null = null;
      let blueLive: { session: EngineSession; channelName: string } | null = null;
      try {
        timeline = await startAcceptanceEngine(enginePath, 'realtime', outputDirectory);
        blueLive = await startAcceptanceEngine(enginePath, 'blue-live', outputDirectory);
        const timelineEngine = timeline.session.getClient();
        const blueLiveEngine = blueLive.session.getClient();
        if (!timelineEngine || !blueLiveEngine) throw new Error('T093 engine clients unavailable');

        const data = new BlueData();
        const group = new TrackLayerGroup();
        const track = new ScoreTrack();
        track.setUniqueId('track-t093-real');
        track.setMuted(false);
        track.setSolo(true);
        group.push(track);
        data.getScore().push(group);
        data.getArrangement().addInstrument(new GenericInstrument(), 'track-t093-real');

        const channel = new Channel();
        channel.setName('Audio T093 Real');
        channel.setAssociation('track-t093-real');
        channel.setMuted(true);
        channel.setSolo(false);
        data.getMixer().getChannels().push(channel);

        const session = new ProjectSession();
        session.replace(data, path.join(outputDirectory, 't093-history.blue'), {
          documentId: 'doc-t093-real-engine',
        });
        const publishedSnapshots: Array<ReturnType<typeof createProjectEditorSnapshot>> = [];
        const unexpectedOperations = new Map<'timeline' | 'blueLive', RuntimeWorkOperation[]>([
          ['timeline', []],
          ['blueLive', []],
        ]);
        const reconciliation = new ProjectRuntimeReconciliation();
        for (const kind of ['timeline', 'blueLive'] as const) {
          reconciliation.registerPerformance(kind, 1, {
            async applyOperation(operation) {
              unexpectedOperations.get(kind)!.push(operation);
              return {
                status: 'rejected',
                message: `T093 received unexpected live operation for ${kind}`,
              };
            },
          });
        }

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
            if (event.snapshot) {
              publishedSnapshots.push(
                event.snapshot as ReturnType<typeof createProjectEditorSnapshot>,
              );
            }
          },
        });
        history.setSavedStateId(session.read().stateId);

        const assertState = (mode: 'audio' | 'event', mixerEnabled: boolean, dirty: boolean) => {
          const current = session.read().data!;
          const currentChannel = current.getMixer().getChannels()[0]!;
          const currentTrack = (current.getScore()[1] as TrackLayerGroup)[0]!;
          expect(current.getScore().trackLayerMuteSoloMode).toBe(mode);
          expect(current.getMixer().isEnabled()).toBe(mixerEnabled);
          expect(currentChannel.isMuted()).toBe(true);
          expect(currentChannel.isSolo()).toBe(false);
          expect(currentTrack.isMuted()).toBe(false);
          expect(currentTrack.isSolo()).toBe(true);
          expect(currentChannel.getAssociation()).toBe('track-t093-real');
          expect(currentTrack.getUniqueId()).toBe(track.getUniqueId());
          expect(history.isDirty()).toBe(dirty);

          const snapshot = publishedSnapshots.at(-1);
          expect(snapshot).toBeDefined();
          expect(snapshot?.score?.trackLayerMuteSoloMode).toBe(mode);
          expect(snapshot?.mixer?.enabled).toBe(mixerEnabled);
          expect(snapshot?.mixer?.channels).toContainEqual(
            expect.objectContaining({
              association: 'track-t093-real',
              muted: true,
              solo: false,
            }),
          );
        };

        const assertActiveRestart = (response: {
          status: string;
          runtimeOutcomes?: readonly unknown[];
        }) => {
          expect(response.status).toBe('committed');
          expect(response.runtimeOutcomes).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ performanceKind: 'timeline', status: 'restart-required' }),
              expect.objectContaining({ performanceKind: 'blueLive', status: 'restart-required' }),
            ]),
          );
          expect(response.runtimeOutcomes).toHaveLength(2);
          expect(unexpectedOperations.get('timeline')).toHaveLength(0);
          expect(unexpectedOperations.get('blueLive')).toHaveLength(0);
        };

        let contextSequence = 0;
        const commit = (
          label: string,
          patches: Parameters<ProjectHistory['commit']>[0]['patches'],
        ) =>
          history.commit({
            documentId: 'doc-t093-real-engine',
            operationId: `t093-real-commit-${++contextSequence}`,
            expectedRevision: session.read().revision,
            contextSequence,
            label,
            patches,
          });
        const undo = () =>
          history.undo({
            documentId: 'doc-t093-real-engine',
            operationId: `t093-real-undo-${++contextSequence}`,
            expectedRevision: session.read().revision,
            contextSequence,
          });
        const redo = () =>
          history.redo({
            documentId: 'doc-t093-real-engine',
            operationId: `t093-real-redo-${++contextSequence}`,
            expectedRevision: session.read().revision,
            contextSequence,
          });

        const modeEvent = {
          score: { type: 'updateTrackLayerMuteSoloMode' as const, mode: 'event' as const },
        };
        const disableMixer = {
          mixer: { type: 'setMixerEnabled' as const, value: false },
        };

        const modeCommit = await commit('Set Track Header Mode to Event', [modeEvent]);
        assertActiveRestart(modeCommit);
        assertState('event', true, true);

        const disableCommit = await commit('Disable Mixer', [disableMixer]);
        assertActiveRestart(disableCommit);
        assertState('event', false, true);

        const undoDisable = await undo();
        assertActiveRestart(undoDisable);
        assertState('event', true, true);

        const redoDisable = await redo();
        assertActiveRestart(redoDisable);
        assertState('event', false, true);

        const undoDisableAgain = await undo();
        assertActiveRestart(undoDisableAgain);
        assertState('event', true, true);

        const undoMode = await undo();
        assertActiveRestart(undoMode);
        assertState('audio', true, false);

        const redoMode = await redo();
        assertActiveRestart(redoMode);
        assertState('event', true, true);

        reconciliation.stopPerformance('timeline');
        reconciliation.stopPerformance('blueLive');
        const stoppedCommit = await commit('Disable Mixer While Stopped', [disableMixer]);
        expect(stoppedCommit.status).toBe('committed');
        if (stoppedCommit.status !== 'committed') return;
        expect(stoppedCommit.runtimeOutcomes).toEqual([]);
        assertState('event', false, true);

        const stoppedUndo = await undo();
        expect(stoppedUndo.status).toBe('committed');
        if (stoppedUndo.status !== 'committed') return;
        expect(stoppedUndo.runtimeOutcomes).toEqual([]);
        assertState('event', true, true);

        const stoppedRedo = await redo();
        expect(stoppedRedo.status).toBe('committed');
        if (stoppedRedo.status !== 'committed') return;
        expect(stoppedRedo.runtimeOutcomes).toEqual([]);
        assertState('event', false, true);

        const timelineReadback = await timelineEngine.getChannel(timeline.channelName);
        const blueLiveReadback = await blueLiveEngine.getChannel(blueLive.channelName);
        expect(timelineReadback.ok && timelineReadback.value).toBeCloseTo(0.25, 6);
        expect(blueLiveReadback.ok && blueLiveReadback.value).toBeCloseTo(0.25, 6);
      } finally {
        await Promise.all([
          timeline?.session.shutdown('t093-complete'),
          blueLive?.session.shutdown('t093-complete'),
        ]);
        await rm(outputDirectory, { recursive: true, force: true });
      }
    });
  });

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
