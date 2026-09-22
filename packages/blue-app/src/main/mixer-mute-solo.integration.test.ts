import { existsSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AudioClip,
  BlueData,
  BlueSynthBuilder,
  Channel,
  Effect,
  Send,
  ScoreTrack,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
  buildStandardCSD,
  buildStandardCSDAsync,
  CurveType,
  resolveMixerGateIntent,
  TempoPoint,
} from '@blue/data';
import type { CompiledMixerGateBindings } from '@blue/data';
import { decodeWavFile, peakResidualDbfs } from '@blue/data/test-support';
import type { DecodedWav } from '@blue/data/test-support';
import { ProjectHistory } from './project-history';
import { ProjectSession } from './project-session';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';
import { ProjectRuntimeReconciliation } from './project-runtime-reconciliation';
import type { RuntimeWorkOperation } from './project-runtime-reconciliation';
import type { ProjectDocumentPatch } from '../shared/project-editor/contract';
import { MixerGatePublisher, type MixerGateEngineIO } from './mixer-mute-solo-runtime';
import { EngineSession } from './engine-session';
import { allocateTcpEndpointPair } from './engine-endpoints';
import { developmentEnginePath } from './engine-runtime';

// Spec 111 real-engine acceptance: (T045) optimized (pruned) versus
// unoptimized disk renders of one certified project produce identical
// sample counts and an inaudible residual; (T054) a mute commit on a RUNNING
// performance publishes the new gate vector, and undo/redo reconciles the
// engine back and forth with observed applied tokens.

/**
 * Deterministic 16-bit mono PCM WAV writer for the render fixture.
 */
function writeSineWav(
  filePath: string,
  seconds: number,
  sampleRate = 44100,
  frequency = 440,
): void {
  const frames = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 12000);
    data.writeInt16LE(sample, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(filePath, Buffer.concat([header, data]));
}

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

interface GateEngine {
  session: EngineSession;
  client: {
    setChannels(entries: readonly { name: string; value: number }[]): Promise<{
      ok: boolean;
      message: string;
    }>;
    getChannels(
      names: readonly string[],
    ): Promise<{ ok: true; values: number[] } | { ok: false; message: string }>;
  };
  gateCount: number;
}

async function startGateEngine(
  enginePath: string,
  outputDirectory: string,
  tag: string,
  gateSymbols: readonly string[],
  commitChannel: string,
  appliedChannel: string,
): Promise<GateEngine> {
  const transport = process.platform === 'win32' ? 'tcp' : 'ipc';
  const endpointPair =
    transport === 'tcp' ? await allocateTcpEndpointPair({ basePort: 46200 }) : null;
  const session = new EngineSession({
    kind: 'realtime',
    enginePath,
    transport,
    port: endpointPair?.controlPort,
    pubPort: endpointPair?.pubPort,
    extraArgs: ['--disable-shared-memory', '--disable-thread-priority-elevation'],
  });
  await session.spawn();
  const ready = await session.awaitReady();
  if (ready.status !== 'ready') {
    await session.shutdown('t111-setup-failed');
    throw new Error(ready.errorMessage ?? 'engine did not become ready');
  }
  const client = session.getClient();
  if (!client) {
    await session.shutdown('t111-setup-failed');
    throw new Error('engine client unavailable');
  }

  const lines: string[] = ['sr = 44100', 'ksmps = 64', 'nchnls = 2', '0dbfs = 1', ''];
  for (const symbol of gateSymbols) {
    lines.push(`${symbol} init 1`);
    lines.push(`${symbol} chnexport "${symbol}", 3`);
  }
  lines.push(`${commitChannel} init 0`);
  lines.push(`${commitChannel} chnexport "${commitChannel}", 3`);
  lines.push(`${appliedChannel} init 0`);
  lines.push(`${appliedChannel} chnexport "${appliedChannel}", 3`);
  lines.push('instr 1');
  lines.push('  a0 init 0');
  lines.push('  out(a0, a0)');
  lines.push('endin');
  lines.push(`instr blueGateEcho`);
  lines.push(`  ${appliedChannel} = ${commitChannel}`);
  lines.push('endin');
  lines.push('');

  const setOption = await client.setOption(`-o${path.join(outputDirectory, `${tag}.wav`)}`);
  const compiled = await client.compileOrc(lines.join('\n'));
  const score = await client.readScore('i1 0 300\ni"blueGateEcho" 0 300');
  const started = await client.start();
  for (const [label, result] of [
    ['setOption', setOption],
    ['compileOrc', compiled],
    ['readScore', score],
    ['start', started],
  ] as const) {
    if (!result.ok) {
      await session.shutdown('t111-setup-failed');
      throw new Error(`${label} failed: ${result.message}`);
    }
  }
  return { session, client, gateCount: gateSymbols.length };
}

/** Certified two-track project: A (2 s clip) muted, B (1 s clip) audible. */
function createRenderProject(wavPath: string): BlueData {
  const data = new BlueData();
  data.getMixer().setEnabled(true);
  const group = new TrackLayerGroup();
  data.getScore().length = 0;
  (data.getScore() as unknown as unknown[]).push(group);

  const trackA = new ScoreTrack();
  trackA.setUniqueId('track-a');
  const clipA = new AudioClip();
  clipA.setStartTime(TimePosition.beats(0));
  clipA.setSubjectiveDuration(TimeDuration.beats(2));
  clipA.setAudioFile(wavPath.split(path.sep).join('/'));
  trackA.push(clipA);
  group.push(trackA);

  const trackB = new ScoreTrack();
  trackB.setUniqueId('track-b');
  const clipB = new AudioClip();
  clipB.setStartTime(TimePosition.beats(0));
  clipB.setSubjectiveDuration(TimeDuration.beats(1));
  clipB.setAudioFile(wavPath.split(path.sep).join('/'));
  trackB.push(clipB);
  group.push(trackB);

  const channelA = new Channel();
  channelA.setName('CA');
  channelA.setAssociation('track-a');
  channelA.setMuted(true);
  const channelB = new Channel();
  channelB.setName('CB');
  channelB.setAssociation('track-b');
  const sendB = new Send();
  sendB.setSendChannel('Master');
  channelB.getPostEffects().push(sendB);
  data.getMixer().getChannels().push(channelA, channelB);
  return data;
}

/**
 * Generated realtime fixture with distinguishable sources and both pre/post
 * send paths into a shared return. The muted A source should disappear from
 * both its dry output and its pre-send, while B's post-send remains audible.
 */
function createRealtimeAudioProject(
  wavAPath: string,
  wavBPath: string,
  clipDurationBeats = 2,
): BlueData {
  const data = new BlueData();
  data.getMixer().setEnabled(true);
  data.getScore().length = 0;
  const group = new TrackLayerGroup();
  const trackA = new ScoreTrack();
  trackA.setUniqueId('track-a');
  const clipA = new AudioClip();
  clipA.setStartTime(TimePosition.beats(0));
  clipA.setSubjectiveDuration(TimeDuration.beats(clipDurationBeats));
  clipA.setAudioFile(wavAPath.split(path.sep).join('/'));
  trackA.push(clipA);
  const trackB = new ScoreTrack();
  trackB.setUniqueId('track-b');
  const clipB = new AudioClip();
  clipB.setStartTime(TimePosition.beats(0));
  clipB.setSubjectiveDuration(TimeDuration.beats(clipDurationBeats));
  clipB.setAudioFile(wavBPath.split(path.sep).join('/'));
  trackB.push(clipB);
  group.push(trackA, trackB);
  data.getScore().push(group);

  const returnChannel = new Channel();
  returnChannel.setName('Return');
  returnChannel.setOutChannel('Master');

  const channelA = new Channel();
  channelA.setName('CA');
  channelA.setAssociation('track-a');
  channelA.setOutChannel('Master');
  channelA.setMuted(true);
  const preSendA = new Send();
  preSendA.setSendChannel('Return');
  channelA.getPreEffects().push(preSendA);

  const channelB = new Channel();
  channelB.setName('CB');
  channelB.setAssociation('track-b');
  channelB.setOutChannel('Master');
  const postSendB = new Send();
  postSendB.setSendChannel('Return');
  channelB.getPostEffects().push(postSendB);

  data.getMixer().getChannels().push(channelA, channelB);
  data.getMixer().getSubChannels().push(returnChannel);
  return data;
}

function createBlueLiveAudioProject(): BlueData {
  const data = new BlueData();
  data.getMixer().setEnabled(true);

  const returnChannel = new Channel();
  returnChannel.setName('Return');
  returnChannel.setOutChannel('Master');

  const channelA = new Channel();
  channelA.setName('CA');
  channelA.setAssociation('track-a');
  channelA.setOutChannel('Master');
  const preSendA = new Send();
  preSendA.setSendChannel('Return');
  channelA.getPreEffects().push(preSendA);

  const channelB = new Channel();
  channelB.setName('CB');
  channelB.setAssociation('track-b');
  channelB.setOutChannel('Master');
  const postSendB = new Send();
  postSendB.setSendChannel('Return');
  channelB.getPostEffects().push(postSendB);

  data.getMixer().getChannels().push(channelA, channelB);
  data.getMixer().getSubChannels().push(returnChannel);

  for (const [channelName, frequency] of [
    ['CA', 440],
    ['CB', 660],
  ] as const) {
    const instrument = new BlueSynthBuilder();
    instrument.setName(`T111 ${channelName} always-on source`);
    // The generated CSD uses Csound's 32768 full-scale convention. Match the
    // level of the WAV fixture so the finite capture has useful headroom.
    instrument.setAlwaysOnInstrumentText(
      `aout oscili 12000, ${frequency}\nblueMixerOut aout, aout`,
    );
    data.getArrangement().addInstrumentWithId(instrument, channelName);
  }

  return data;
}

function configureAdvancedDiskFixture(data: BlueData): void {
  const group = data.getScore()[0] as TrackLayerGroup;
  for (const track of group) {
    const clip = track[0];
    if (!(clip instanceof AudioClip)) continue;
    clip.setAudioDuration(2);
    clip.setFileStartTime(0.25);
    clip.setFadeIn(0.1);
    clip.setFadeOut(0.1);
    clip.setLooping(null, true);
  }

  const tempoMap = data.getScore().getTimeContext().getTempoMap();
  tempoMap.setTempoPoint(0, 0, 90, CurveType.LINEAR);
  tempoMap.addTempoPoint(new TempoPoint(4, 150, CurveType.CONSTANT));
  tempoMap.setEnabled(true);
  data.setRenderStartTime(0.25);
  data.setRenderEndTime(3.25);
  data.getMixer().setExtraRenderTime(0.5);
}

function configureGlobalDurationFixture(data: BlueData): void {
  data
    .getGlobalOrcSco()
    .setGlobalOrc(
      ['instr T111GlobalDuration', '  aout init 0', '  outc aout, aout', 'endin'].join('\n'),
    );
  data.getGlobalOrcSco().setGlobalSco('i"T111GlobalDuration" 0 5');
  data.getMixer().setExtraRenderTime(0.5);
}

async function renderCsdToWav(
  enginePath: string,
  outputDirectory: string,
  tag: string,
  csdText: string,
): Promise<DecodedWav> {
  const instrumentsMatch = csdText.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/);
  const scoreMatch = csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/);
  expect(instrumentsMatch).toBeTruthy();
  expect(scoreMatch).toBeTruthy();

  const transport = process.platform === 'win32' ? 'tcp' : 'ipc';
  const endpointPair =
    transport === 'tcp' ? await allocateTcpEndpointPair({ basePort: 46400 }) : null;
  const session = new EngineSession({
    kind: 'realtime',
    enginePath,
    transport,
    port: endpointPair?.controlPort,
    pubPort: endpointPair?.pubPort,
    extraArgs: ['--disable-shared-memory', '--disable-thread-priority-elevation'],
  });
  const wavPath = path.join(outputDirectory, `${tag}.wav`);
  try {
    await session.spawn();
    const ready = await session.awaitReady();
    if (ready.status !== 'ready') {
      throw new Error(ready.errorMessage ?? 'render engine did not become ready');
    }
    const client = session.getClient();
    if (!client) throw new Error('render engine client unavailable');

    const setOption = await client.setOption(`-o${wavPath}`);
    // T072: float WAV output so quantization never fakes or masks a residual.
    const wavContainer = await client.setOption('-W');
    if (!wavContainer.ok) throw new Error(`-W failed: ${wavContainer.message}`);
    const wavFloat = await client.setOption('-f');
    if (!wavFloat.ok) throw new Error(`-f failed: ${wavFloat.message}`);
    const compiled = await client.compileOrc(instrumentsMatch![1]);
    const score = await client.readScore(scoreMatch![1]);
    const started = await client.start();
    for (const [label, result] of [
      ['setOption', setOption],
      ['compileOrc', compiled],
      ['readScore', score],
      ['start', started],
    ] as const) {
      if (!result.ok) throw new Error(`${label} failed: ${result.message}`);
    }

    // The engine performs in real time; wait for the output file to appear
    // and then stay byte-stable before decoding it.
    const deadline = Date.now() + 60_000;
    let lastSize = -1;
    let stableSince = 0;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!existsSync(wavPath)) continue;
      const size = statSync(wavPath).size;
      if (size === lastSize) {
        if (Date.now() - stableSince > 1500 && size > 44) break;
      } else {
        lastSize = size;
        stableSince = Date.now();
      }
    }
    expect(existsSync(wavPath)).toBe(true);
    return decodeWavFile(wavPath);
  } finally {
    await session.shutdown('t111-render-complete');
  }
}

interface LiveGateTransition {
  readonly label: string;
  readonly elapsedSeconds: number;
  readonly token: number;
  readonly activeBank: number;
  readonly values: readonly number[];
}

interface LiveGateCapture {
  readonly wav: DecodedWav;
  readonly transitions: readonly LiveGateTransition[];
}

function toneMagnitude(
  wav: DecodedWav,
  frequency: number,
  startSeconds: number,
  endSeconds: number,
): number {
  const startFrame = Math.max(0, Math.floor(startSeconds * wav.sampleRate));
  const endFrame = Math.min(
    Math.floor(wav.samples.length / wav.channels),
    Math.ceil(endSeconds * wav.sampleRate),
  );
  const frameCount = Math.max(0, endFrame - startFrame);
  if (frameCount === 0) return 0;

  let real = 0;
  let imaginary = 0;
  for (let frame = startFrame; frame < endFrame; frame++) {
    const sample = wav.samples[frame * wav.channels] ?? 0;
    const phase = (2 * Math.PI * frequency * frame) / wav.sampleRate;
    real += sample * Math.cos(phase);
    imaginary -= sample * Math.sin(phase);
  }
  return (2 * Math.hypot(real, imaginary)) / frameCount;
}

function addLiveAcceptanceTopology(data: BlueData): void {
  data.getMixer().getChannels()[0]!.setMuted(false);

  // Keep a local delay alive across gate changes. The output gate is after
  // local processing, so muting cuts the audible tail without resetting the
  // effect or retriggering the source when the route reopens.
  const tail = new Effect();
  tail.setName('T111 Stateful Tail');
  tail.setCode(
    [
      'aDelayL delayr 1',
      'aTapL deltap 0.25',
      'delayw ain1',
      'aDelayR delayr 1',
      'aTapR deltap 0.25',
      'delayw ain2',
      'aout1 = ain1 + (aTapL * 0.5)',
      'aout2 = ain2 + (aTapR * 0.5)',
    ].join('\n'),
  );
  data.getMixer().getSubChannels()[0]!.getPostEffects().push(tail);

  // The native mailbox accepts 256 entries per write. Keep the generated
  // catalog above that boundary so the real capture exercises split staging
  // and one atomic commit token for the whole route vector.
  const dummyChannels = Array.from({ length: 260 }, (_, index) => {
    const channel = new Channel();
    channel.setName(`T111 Aux ${index}`);
    return channel;
  });
  data
    .getMixer()
    .getChannels()
    .push(...dummyChannels);
}

async function captureLiveGateTransitions(
  enginePath: string,
  outputDirectory: string,
  tag: string,
  performanceKind: 'timeline' | 'blueLive',
  data: BlueData,
  csdText: string,
  catalog: CompiledMixerGateBindings,
): Promise<LiveGateCapture> {
  const instrumentsMatch = csdText.match(/<CsInstruments>([\s\S]*?)<\/CsInstruments>/);
  const scoreMatch = csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/);
  expect(instrumentsMatch).toBeTruthy();
  expect(scoreMatch).toBeTruthy();

  const engineKind = performanceKind === 'timeline' ? 'realtime' : 'blue-live';
  const transport = process.platform === 'win32' ? 'tcp' : 'ipc';
  const endpointPair =
    transport === 'tcp' ? await allocateTcpEndpointPair({ basePort: 46600 }) : null;
  const session = new EngineSession({
    kind: engineKind,
    enginePath,
    transport,
    port: endpointPair?.controlPort,
    pubPort: endpointPair?.pubPort,
    extraArgs: ['--disable-shared-memory', '--disable-thread-priority-elevation'],
  });
  const wavPath = path.join(outputDirectory, `${tag}.wav`);
  let stopped = false;
  try {
    await session.spawn();
    const ready = await session.awaitReady();
    if (ready.status !== 'ready') {
      throw new Error(ready.errorMessage ?? `${engineKind} engine did not become ready`);
    }
    const engineClient = session.getClient();
    if (!engineClient) throw new Error(`${engineKind} engine client unavailable`);

    // Keep the performance paced like a real run without opening a physical
    // device. The null rtaudio backend is the documented CI-safe output used
    // by the metering acceptance suite. `fout` below records the monitor bus
    // independently of Csound's realtime output destination.
    for (const option of ['-+rtaudio=null', '-odac', '-d']) {
      const result = await engineClient.setOption(option);
      if (!result.ok) throw new Error(`capture option ${option} failed: ${result.message}`);
    }
    const capturePath = wavPath.replaceAll('\\', '/').replaceAll('"', '\\"');
    const captureInstrument = [
      'instr T111Capture',
      '  aCaptureL, aCaptureR monitor',
      `  fout "${capturePath}", 16, aCaptureL, aCaptureR`,
      'endin',
    ].join('\n');
    const orchestra = `${instrumentsMatch![1]}\n${captureInstrument}`;
    const scoreText = scoreMatch![1].replace(/\n\s*e(?:\s+\S+)?\s*$/, '');
    const compiled = await engineClient.compileOrc(orchestra);
    const score = await engineClient.readScore(`${scoreText}\ni"T111Capture" 0 20\ne`);
    const started = await engineClient.start();
    for (const [label, result] of [
      ['compileOrc', compiled],
      ['readScore', score],
      ['start', started],
    ] as const) {
      if (!result.ok) throw new Error(`${label} failed: ${result.message}`);
    }

    const io: MixerGateEngineIO = {
      setChannels: (entries) => engineClient.setChannels(entries),
      getChannels: (names) => engineClient.getChannels(names),
    };
    const publisher = new MixerGatePublisher(io, {
      maxBatchEntries: 256,
      observeAttempts: 200,
      observeDelayMs: 5,
    });
    publisher.setBindings(performanceKind, catalog, { generation: 1, io });

    const projectSession = new ProjectSession();
    projectSession.replace(data, path.join(outputDirectory, `${tag}.blue`), {
      documentId: `doc-t111-live-${tag}`,
    });
    const reconciliation = new ProjectRuntimeReconciliation({
      operationTimeoutMs: 10_000,
      resolveMixerGates: () => {
        const current = projectSession.read().data;
        return current ? resolveMixerGateIntent(current.getMixer()) : null;
      },
    });
    const client = {
      applyOperation(operation: RuntimeWorkOperation) {
        if (operation.kind !== 'mixer-gates') {
          return Promise.resolve({ status: 'rejected' as const, message: 'mixer gates only' });
        }
        return publisher
          .publish(
            performanceKind,
            operation.signature,
            operation.values,
            operation.expectedGeneration,
          )
          .then((result) =>
            result.ok
              ? ({ status: 'applied' as const } as const)
              : ({ status: 'rejected' as const, message: result.message } as const),
          );
      },
    };
    reconciliation.registerPerformance(
      performanceKind,
      1,
      client,
      new Map([
        ['mixer-gates::gates', { kind: 'mixer-gates' as const, signature: catalog.signature }],
      ]),
    );
    const history = new ProjectHistory({ session: projectSession, reconciliation });
    const context = new MockHistoryContext(`ctx-t111-${tag}`);
    const documentId = projectSession.read().documentId!;
    const transitions: LiveGateTransition[] = [];
    const captureStartedAt = performance.now();

    const readActiveGateValues = async (): Promise<readonly number[]> => {
      const token = publisher.getCommitToken(performanceKind);
      expect(token).not.toBeNull();
      const bank = (token! % 2) as 0 | 1;
      const names = catalog.gates.map((gate) => gate.bankSymbols[bank]);
      const values: number[] = [];
      for (let offset = 0; offset < names.length; offset += 256) {
        const result = await engineClient.getChannels(names.slice(offset, offset + 256));
        expect(result.ok).toBe(true);
        if (!result.ok) return [];
        values.push(...result.values);
      }
      return values;
    };

    const recordResponse = async (
      label: string,
      response:
        Awaited<ReturnType<ProjectHistory['commit']>> | Awaited<ReturnType<ProjectHistory['undo']>>,
    ): Promise<void> => {
      expect(response.status).toBe('committed');
      if (response.status !== 'committed') return;
      const outcome = response.runtimeOutcomes?.find(
        (candidate) => candidate.performanceKind === performanceKind,
      );
      if (outcome?.status !== 'applied') {
        const tokenRead = await engineClient.getChannels([
          catalog.commitChannel,
          catalog.appliedChannel,
        ]);
        throw new Error(
          `${label}: ${JSON.stringify(response.runtimeOutcomes)}; ` +
            `engineTokens=${JSON.stringify(tokenRead)}; ` +
            `sessionState=${session.getState()}; stderr=${session.getStderr().slice(-2000)}`,
        );
      }
      expect(outcome, JSON.stringify(response.runtimeOutcomes)).toMatchObject({
        status: 'applied',
      });
      const token = publisher.getCommitToken(performanceKind);
      expect(token).not.toBeNull();
      const values = await readActiveGateValues();
      transitions.push({
        label,
        elapsedSeconds: (performance.now() - captureStartedAt) / 1000,
        token: token!,
        activeBank: token! % 2,
        values,
      });
    };

    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
    const commit = async (label: string, patch: ProjectDocumentPatch): Promise<void> => {
      const response = await history.commit(
        context.nextCommitRequest(documentId, projectSession.read().revision, label, [patch]),
      );
      await recordResponse(label, response);
    };
    const undo = async (label: string): Promise<void> => {
      const response = await history.undo(
        context.nextUndoRequest(documentId, projectSession.read().revision),
      );
      await recordResponse(label, response);
    };

    await wait(650);
    await commit('solo-source-b', {
      mixer: { type: 'updateChannel', channelId: 'track-b', patch: { solo: true } },
    });
    await wait(550);
    await undo('undo-solo-source-b');
    await wait(550);
    await commit('mute-source-a', {
      mixer: { type: 'updateChannel', channelId: 'track-a', patch: { muted: true } },
    });
    await wait(550);
    await undo('undo-mute-source-a');
    await wait(550);
    const redo = await history.redo(
      context.nextRedoRequest(documentId, projectSession.read().revision),
    );
    await recordResponse('redo-mute-source-a', redo);
    await wait(550);
    await commit('solo-source-b-again', {
      mixer: { type: 'updateChannel', channelId: 'track-b', patch: { solo: true } },
    });
    await wait(550);
    await commit('solo-return-additive', {
      mixer: { type: 'updateChannel', channelId: 'Return', patch: { solo: true } },
    });
    await wait(550);
    await commit('mute-master', {
      mixer: { type: 'updateChannel', channelId: 'master', patch: { muted: true } },
    });
    await wait(550);
    await undo('undo-mute-master');
    await wait(650);

    await session.shutdown('t111-live-capture-complete');
    stopped = true;
    if (!existsSync(wavPath)) {
      throw new Error(`live capture file missing; stderr=${session.getStderr().slice(-3000)}`);
    }
    return { wav: decodeWavFile(wavPath), transitions };
  } finally {
    if (!stopped) await session.shutdown('t111-live-capture-failed');
  }
}

describe('Spec 111 real-engine acceptance', () => {
  it('reports the gate for plain suite runs', () => {
    // Real-engine scenarios run only with BLUE_RUN_REAL_ENGINE=1 and a built
    // engine binary; see quickstart.md for the standing command.
    expect([undefined, '1']).toContain(process.env.BLUE_RUN_REAL_ENGINE);
  });
});

if (process.env.BLUE_RUN_REAL_ENGINE === '1') {
  describe('Spec 111 real-engine acceptance', () => {
    it('renders optimized and unoptimized disk CSDs of a certified project identically (T045)', async () => {
      const enginePath = resolveAcceptanceEnginePath();
      if (!enginePath) {
        throw new Error(
          'requires a built engine; set BLUE_ENGINE_PATH or build native/blue-engine',
        );
      }
      const outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-t111-render-'));
      try {
        const wavPath = path.join(outputDirectory, 'fixture.wav');
        writeSineWav(wavPath, 1);

        const pruned = buildStandardCSD(createRenderProject(wavPath), 'disk');
        const prunedScore = pruned.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
        // Only the audible track's clip event survives pruning.
        expect(prunedScore.match(/fixture\.wav/g)?.length ?? 0).toBe(1);

        // Unoptimized oracle: a comment in the global orchestra changes no
        // audio but breaks AudioClip-only certification, so every event renders.
        const oracleProject = createRenderProject(wavPath);
        oracleProject.getGlobalOrcSco().setGlobalOrc('; pruning-disable oracle\n');
        const unpruned = buildStandardCSD(oracleProject, 'disk');
        const unprunedScore = unpruned.csdText.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
        expect(unprunedScore.match(/fixture\.wav/g)?.length ?? 0).toBe(2);

        const prunedWav = await renderCsdToWav(
          enginePath,
          outputDirectory,
          'optimized',
          pruned.csdText,
        );
        const unprunedWav = await renderCsdToWav(
          enginePath,
          outputDirectory,
          'unoptimized',
          unpruned.csdText,
        );

        expect(prunedWav.sampleRate).toBe(unprunedWav.sampleRate);
        // The planned float-audio contract: matching 32-bit float output.
        expect(prunedWav.bitsPerSample).toBe(32);
        expect(prunedWav.isFloat).toBe(true);
        expect(unprunedWav.bitsPerSample).toBe(32);
        expect(unprunedWav.isFloat).toBe(true);
        expect(prunedWav.samples.length).toBe(unprunedWav.samples.length);
        expect(prunedWav.samples.length).toBeGreaterThan(0);
        const residual = peakResidualDbfs(prunedWav.samples, unprunedWav.samples);
        expect(residual).toBeLessThanOrEqual(-120);
      } finally {
        await rm(outputDirectory, { recursive: true, force: true });
      }
    }, 180_000);

    it('renders generated realtime BlueMixer gates without leaking a muted source (T080)', async () => {
      const enginePath = resolveAcceptanceEnginePath();
      if (!enginePath) {
        throw new Error(
          'requires a built engine; set BLUE_ENGINE_PATH or build native/blue-engine',
        );
      }
      const outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-t111-live-audio-'));
      try {
        const wavAPath = path.join(outputDirectory, 'source-a-440.wav');
        const wavBPath = path.join(outputDirectory, 'source-b-660.wav');
        writeSineWav(wavAPath, 2, 44100, 440);
        writeSineWav(wavBPath, 2, 44100, 660);

        const mutedProject = createRealtimeAudioProject(wavAPath, wavBPath);
        const audibleOnlyProject = createRealtimeAudioProject(wavAPath, wavBPath);
        const audibleOnlyGroup = audibleOnlyProject.getScore()[0] as TrackLayerGroup;
        audibleOnlyGroup[0]!.length = 0;

        const mutedCsd = buildStandardCSD(mutedProject, 'realtime');
        const audibleOnlyCsd = buildStandardCSD(audibleOnlyProject, 'realtime');
        expect(mutedCsd.csdText).toContain('source-a-440.wav');
        expect(mutedCsd.csdText).toContain('source-b-660.wav');
        expect(mutedCsd.csdText).toContain('BlueMixer');
        expect(mutedCsd.mixerGateBindings).toBeDefined();
        // These are independent documents, so their disposable identities may
        // differ; the generated topology still has to be structurally equal.
        expect(audibleOnlyCsd.mixerGateBindings?.gates.length).toBe(
          mutedCsd.mixerGateBindings?.gates.length,
        );

        // BlueLive compiles the same generated mixer topology and gate catalog;
        // its long-lived score is inspected rather than rendered for 36,000 s.
        const blueLiveCsd = mutedProject.toBlueLiveCSD();
        expect(blueLiveCsd.csdText).toContain('BlueMixer');
        expect(blueLiveCsd.csdText).toContain('gk_blue_mixgate_');
        expect(blueLiveCsd.mixerGateBindings?.signature).toBe(
          mutedCsd.mixerGateBindings?.signature,
        );

        const mutedWav = await renderCsdToWav(
          enginePath,
          outputDirectory,
          'generated-muted',
          mutedCsd.csdText,
        );
        const audibleOnlyWav = await renderCsdToWav(
          enginePath,
          outputDirectory,
          'generated-audible-only',
          audibleOnlyCsd.csdText,
        );
        expect(mutedWav.bitsPerSample).toBe(32);
        expect(mutedWav.isFloat).toBe(true);
        expect(mutedWav.sampleRate).toBe(audibleOnlyWav.sampleRate);
        expect(mutedWav.samples.length).toBe(audibleOnlyWav.samples.length);
        expect(mutedWav.samples.length).toBeGreaterThan(0);
        expect(peakResidualDbfs(mutedWav.samples, audibleOnlyWav.samples)).toBeLessThanOrEqual(
          -120,
        );
      } finally {
        await rm(outputDirectory, { recursive: true, force: true });
      }
    }, 180_000);

    it('captures atomic timeline and Blue Live gate transitions over generated audio (T088)', async () => {
      const enginePath = resolveAcceptanceEnginePath();
      if (!enginePath) {
        throw new Error(
          'requires a built engine; set BLUE_ENGINE_PATH or build native/blue-engine',
        );
      }
      const outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-t111-live-history-'));
      try {
        const wavAPath = path.join(outputDirectory, 'source-a-440.wav');
        const wavBPath = path.join(outputDirectory, 'source-b-660.wav');
        writeSineWav(wavAPath, 12, 44100, 440);
        writeSineWav(wavBPath, 12, 44100, 660);

        const captures: Array<{
          kind: 'timeline' | 'blueLive';
          capture: LiveGateCapture;
          catalog: CompiledMixerGateBindings;
        }> = [];
        for (const kind of ['timeline', 'blueLive'] as const) {
          const data =
            kind === 'timeline'
              ? createRealtimeAudioProject(wavAPath, wavBPath, 20)
              : createBlueLiveAudioProject();
          addLiveAcceptanceTopology(data);
          const render =
            kind === 'timeline' ? buildStandardCSD(data, 'realtime') : data.toBlueLiveCSD();
          const catalog = render.mixerGateBindings;
          expect(catalog).toBeDefined();
          if (!catalog) continue;
          expect(catalog.gates.length).toBeGreaterThan(256);
          if (kind === 'timeline') {
            expect(render.csdText.match(/source-[ab]-\d+\.wav/g) ?? [], kind).toHaveLength(2);
          } else {
            expect(render.csdText).toContain('CA_alwaysOn');
            expect(render.csdText).toContain('CB_alwaysOn');
          }

          captures.push({
            kind,
            catalog,
            capture: await captureLiveGateTransitions(
              enginePath,
              outputDirectory,
              `generated-${kind}`,
              kind,
              data,
              render.csdText,
              catalog,
            ),
          });
        }

        expect(captures).toHaveLength(2);
        for (const { kind, capture, catalog } of captures) {
          const sourceASend = catalog.gates.find(
            (gate) =>
              gate.locator.route === 'send' &&
              gate.locator.channelIdentity === 'association:track-a' &&
              gate.locator.chainKind === 'pre',
          );
          const sourceAOutput = catalog.gates.find(
            (gate) =>
              gate.locator.route === 'output' &&
              gate.locator.channelIdentity === 'association:track-a',
          );
          const sourceBSend = catalog.gates.find(
            (gate) =>
              gate.locator.route === 'send' &&
              gate.locator.channelIdentity === 'association:track-b' &&
              gate.locator.chainKind === 'post',
          );
          const sourceBOutput = catalog.gates.find(
            (gate) =>
              gate.locator.route === 'output' &&
              gate.locator.channelIdentity === 'association:track-b',
          );
          const returnOutput = catalog.gates.find(
            (gate) => gate.locator.route === 'output' && gate.locator.channelKind === 'sub',
          );
          const masterOutput = catalog.gates.find(
            (gate) => gate.locator.route === 'output' && gate.locator.channelKind === 'master',
          );
          expect([
            sourceASend,
            sourceAOutput,
            sourceBSend,
            sourceBOutput,
            returnOutput,
            masterOutput,
          ]).not.toContain(undefined);
          if (
            !sourceASend ||
            !sourceAOutput ||
            !sourceBSend ||
            !sourceBOutput ||
            !returnOutput ||
            !masterOutput
          ) {
            continue;
          }

          const transitions = capture.transitions;
          expect(transitions.map((transition) => transition.token)).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9,
          ]);
          expect(transitions.map((transition) => transition.activeBank)).toEqual([
            1, 0, 1, 0, 1, 0, 1, 0, 1,
          ]);
          expect(
            transitions.every((transition) => transition.values.length === catalog.gates.length),
          ).toBe(true);
          expect(
            transitions.every(
              (transition, index) =>
                index === 0 ||
                transition.elapsedSeconds - transitions[index - 1]!.elapsedSeconds > 0.3,
            ),
          ).toBe(true);

          const value = (index: number, gate: { ordinal: number }): number =>
            transitions[index]!.values[gate.ordinal]!;
          const expectState = (
            index: number,
            expected: {
              sourceASend: number;
              sourceAOutput: number;
              sourceBSend: number;
              sourceBOutput: number;
              returnOutput: number;
              masterOutput: number;
            },
          ) => {
            expect(value(index, sourceASend)).toBe(expected.sourceASend);
            expect(value(index, sourceAOutput)).toBe(expected.sourceAOutput);
            expect(value(index, sourceBSend)).toBe(expected.sourceBSend);
            expect(value(index, sourceBOutput)).toBe(expected.sourceBOutput);
            expect(value(index, returnOutput)).toBe(expected.returnOutput);
            expect(value(index, masterOutput)).toBe(expected.masterOutput);
          };

          // Source-B solo, followed by a durable A mute, exercises additive
          // source/return solos and proves mute wins on every A route.
          expectState(0, {
            sourceASend: 0,
            sourceAOutput: 0,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 1,
          });
          expectState(1, {
            sourceASend: 1,
            sourceAOutput: 1,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 1,
          });
          expectState(2, {
            sourceASend: 0,
            sourceAOutput: 0,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 1,
          });
          expectState(3, {
            sourceASend: 1,
            sourceAOutput: 1,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 1,
          });
          expectState(4, {
            sourceASend: 0,
            sourceAOutput: 0,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 1,
          });
          expectState(5, {
            sourceASend: 0,
            sourceAOutput: 0,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 1,
          });
          expectState(6, {
            sourceASend: 0,
            sourceAOutput: 0,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 1,
          });
          expectState(7, {
            sourceASend: 0,
            sourceAOutput: 0,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 0,
          });
          expectState(8, {
            sourceASend: 0,
            sourceAOutput: 0,
            sourceBSend: 1,
            sourceBOutput: 1,
            returnOutput: 1,
            masterOutput: 1,
          });

          const time = (index: number) => transitions[index]!.elapsedSeconds;
          const baselineA = toneMagnitude(capture.wav, 440, 0.15, time(0) - 0.1);
          const baselineB = toneMagnitude(capture.wav, 660, 0.15, time(0) - 0.1);
          expect(baselineA, `${kind} 440 Hz baseline`).toBeGreaterThan(0.01);
          expect(baselineB, `${kind} 660 Hz baseline`).toBeGreaterThan(0.01);

          // Gate changes isolate the requested source without stopping or
          // restarting the other generated event.
          expect(toneMagnitude(capture.wav, 440, time(0) + 0.08, time(1) - 0.08)).toBeLessThan(
            baselineA * 0.25,
          );
          expect(toneMagnitude(capture.wav, 660, time(0) + 0.08, time(1) - 0.08)).toBeGreaterThan(
            baselineB * 0.25,
          );
          expect(toneMagnitude(capture.wav, 440, time(1) + 0.08, time(2) - 0.08)).toBeGreaterThan(
            baselineA * 0.5,
          );
          expect(toneMagnitude(capture.wav, 440, time(2) + 0.08, time(3) - 0.08)).toBeLessThan(
            baselineA * 0.25,
          );
          expect(toneMagnitude(capture.wav, 440, time(3) + 0.08, time(4) - 0.08)).toBeGreaterThan(
            baselineA * 0.5,
          );
          expect(toneMagnitude(capture.wav, 440, time(4) + 0.08, time(5) - 0.08)).toBeLessThan(
            baselineA * 0.25,
          );
          expect(toneMagnitude(capture.wav, 660, time(4) + 0.08, time(5) - 0.08)).toBeGreaterThan(
            baselineB * 0.25,
          );
          expect(toneMagnitude(capture.wav, 440, time(5) + 0.08, time(6) - 0.08)).toBeLessThan(
            baselineA * 0.1,
          );
          expect(toneMagnitude(capture.wav, 660, time(5) + 0.08, time(6) - 0.08)).toBeGreaterThan(
            baselineB * 0.25,
          );
          expect(toneMagnitude(capture.wav, 660, time(6) + 0.08, time(7) - 0.08)).toBeGreaterThan(
            baselineB * 0.25,
          );
          expect(toneMagnitude(capture.wav, 440, time(6) + 0.08, time(7) - 0.08)).toBeLessThan(
            baselineA * 0.1,
          );
          expect(toneMagnitude(capture.wav, 660, time(7) + 0.08, time(8) - 0.08)).toBeLessThan(
            baselineB * 0.1,
          );
          expect(toneMagnitude(capture.wav, 440, time(7) + 0.08, time(8) - 0.08)).toBeLessThan(
            baselineA * 0.1,
          );
          expect(toneMagnitude(capture.wav, 660, time(8) + 0.08, time(8) + 0.35)).toBeGreaterThan(
            baselineB * 0.25,
          );
          expect(toneMagnitude(capture.wav, 440, time(8) + 0.08, time(8) + 0.35)).toBeLessThan(
            baselineA * 0.25,
          );

          // The downstream delay keeps the local state alive during the A
          // close; its residual is present briefly without retriggering the
          // score event, then disappears once the delay has drained.
          expect(toneMagnitude(capture.wav, 440, time(4) + 0.05, time(4) + 0.2)).toBeGreaterThan(
            baselineA * 0.02,
          );
          expect(toneMagnitude(capture.wav, 440, time(4) + 0.35, time(5) - 0.08)).toBeLessThan(
            baselineA * 0.25,
          );

          // B remains audible immediately before and after every non-master
          // transition, which is the finite-capture continuity/no-retrigger
          // check for the live gate path.
          for (const index of [0, 1, 2, 3, 4, 5, 6]) {
            expect(
              toneMagnitude(capture.wav, 660, time(index) - 0.08, time(index) - 0.02),
            ).toBeGreaterThan(baselineB * 0.1);
            expect(
              toneMagnitude(capture.wav, 660, time(index) + 0.02, time(index) + 0.08),
            ).toBeGreaterThan(baselineB * 0.1);
          }
          expect(toneMagnitude(capture.wav, 660, time(7) - 0.08, time(7) - 0.02)).toBeGreaterThan(
            baselineB * 0.1,
          );
          expect(toneMagnitude(capture.wav, 660, time(7) + 0.02, time(7) + 0.08)).toBeLessThan(
            baselineB * 0.1,
          );
        }
      } finally {
        await rm(outputDirectory, { recursive: true, force: true });
      }
    }, 300_000);

    it('keeps generated disk audio identical across send, solo-return, and all-pruned routes (T081)', async () => {
      const enginePath = resolveAcceptanceEnginePath();
      if (!enginePath) {
        throw new Error(
          'requires a built engine; set BLUE_ENGINE_PATH or build native/blue-engine',
        );
      }
      const outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-t111-disk-routes-'));
      try {
        const wavAPath = path.join(outputDirectory, 'source-a-440.wav');
        const wavBPath = path.join(outputDirectory, 'source-b-660.wav');
        writeSineWav(wavAPath, 2, 44100, 440);
        writeSineWav(wavBPath, 2, 44100, 660);

        const scenarios: ReadonlyArray<{
          tag: string;
          configure: (data: BlueData) => void;
          optimizedFiles: ReadonlyArray<string>;
        }> = [
          {
            tag: 'shared-return',
            configure: () => undefined,
            optimizedFiles: ['source-b-660.wav'],
          },
          {
            tag: 'soloed-return',
            configure: (data) => {
              data.getMixer().getChannels()[0]!.setMuted(false);
              data.getMixer().getSubChannels()[0]!.setSolo(true);
            },
            optimizedFiles: ['source-a-440.wav', 'source-b-660.wav'],
          },
          {
            tag: 'master-muted-all-pruned',
            configure: (data) => data.getMixer().getMaster().setMuted(true),
            optimizedFiles: [],
          },
          {
            tag: 'window-tempo-fades-loops-extra',
            configure: configureAdvancedDiskFixture,
            optimizedFiles: ['source-b-660.wav'],
          },
          {
            tag: 'global-duration-fallback',
            configure: configureGlobalDurationFixture,
            optimizedFiles: ['source-a-440.wav', 'source-b-660.wav'],
          },
        ];

        for (const scenario of scenarios) {
          const optimizedProject = createRealtimeAudioProject(wavAPath, wavBPath);
          const unoptimizedProject = createRealtimeAudioProject(wavAPath, wavBPath);
          scenario.configure(optimizedProject);
          scenario.configure(unoptimizedProject);
          const originalGlobalOrc = unoptimizedProject.getGlobalOrcSco().getGlobalOrc() ?? '';
          unoptimizedProject
            .getGlobalOrcSco()
            .setGlobalOrc(
              `${originalGlobalOrc}${originalGlobalOrc.endsWith('\n') ? '' : '\n'}; pruning-disable ${scenario.tag} oracle\n`,
            );

          const optimized = buildStandardCSD(optimizedProject, 'disk');
          const unoptimized = buildStandardCSD(unoptimizedProject, 'disk');
          const [optimizedAsync, unoptimizedAsync] = await Promise.all([
            buildStandardCSDAsync(optimizedProject, 'disk'),
            buildStandardCSDAsync(unoptimizedProject, 'disk'),
          ]);
          expect(optimizedAsync.csdText).toBe(optimized.csdText);
          expect(unoptimizedAsync.csdText).toBe(unoptimized.csdText);
          const scoreOf = (text: string) => text.match(/<CsScore>([\s\S]*?)<\/CsScore>/)![1];
          const audioEventCount = (text: string, file: string): number =>
            scoreOf(text)
              .split('\n')
              .filter((line) => line.includes(file)).length;
          for (const file of ['source-a-440.wav', 'source-b-660.wav']) {
            expect(
              audioEventCount(optimized.csdText, file),
              `${scenario.tag} optimized ${file}`,
            ).toBe(scenario.optimizedFiles.includes(file) ? 1 : 0);
            expect(
              audioEventCount(unoptimized.csdText, file),
              `${scenario.tag} unoptimized ${file}`,
            ).toBe(1);
          }
          if (scenario.tag === 'window-tempo-fades-loops-extra') {
            const survivingLine = (text: string) =>
              scoreOf(text)
                .split('\n')
                .find((line) => line.includes('source-b-660.wav'))
                ?.replace(/^i\d+\t/, 'i*\t');
            expect(survivingLine(optimized.csdText)).toBe(survivingLine(unoptimized.csdText));
            expect(scoreOf(optimized.csdText)).toMatch(/t 0 \d+\.\d+ 3\.0 \d+\.\d+/);
          }
          if (scenario.tag === 'global-duration-fallback') {
            expect(scoreOf(optimized.csdText)).toMatch(/i"T111GlobalDuration"\s+0\s+5/);
            expect(scoreOf(optimized.csdText)).toMatch(/i"BlueMixer"\s+0(?:\.0+)?\s+5\.5/);
            expect(scoreOf(unoptimized.csdText)).toMatch(/i"T111GlobalDuration"\s+0\s+5/);
          }

          const optimizedWav = await renderCsdToWav(
            enginePath,
            outputDirectory,
            `${scenario.tag}-optimized`,
            optimized.csdText,
          );
          const unoptimizedWav = await renderCsdToWav(
            enginePath,
            outputDirectory,
            `${scenario.tag}-unoptimized`,
            unoptimized.csdText,
          );
          expect(optimizedWav.bitsPerSample).toBe(32);
          expect(optimizedWav.isFloat).toBe(true);
          expect(unoptimizedWav.bitsPerSample).toBe(32);
          expect(unoptimizedWav.isFloat).toBe(true);
          expect(optimizedWav.sampleRate).toBe(unoptimizedWav.sampleRate);
          expect(optimizedWav.samples.length).toBe(unoptimizedWav.samples.length);
          expect(optimizedWav.samples.length).toBeGreaterThan(0);
          expect(
            peakResidualDbfs(optimizedWav.samples, unoptimizedWav.samples),
          ).toBeLessThanOrEqual(-120);
        }
      } finally {
        await rm(outputDirectory, { recursive: true, force: true });
      }
    }, 240_000);

    it('publishes mute commits to a running performance and reconciles undo/redo (T054)', async () => {
      const enginePath = resolveAcceptanceEnginePath();
      if (!enginePath) {
        throw new Error(
          'requires a built engine; set BLUE_ENGINE_PATH or build native/blue-engine',
        );
      }
      const outputDirectory = await mkdtemp(path.join(tmpdir(), 'blue-t111-history-'));
      try {
        const data = new BlueData();
        data.getMixer().setEnabled(true);
        const channel = new Channel();
        channel.setName('CA');
        channel.setAssociation('track-a');
        data.getMixer().getChannels().push(channel);

        const intent = resolveMixerGateIntent(data.getMixer());
        expect(intent).not.toBeNull();
        const catalog: CompiledMixerGateBindings = {
          signature: intent!.signature,
          commitChannel: 'gk_blue_mixgate_commit',
          appliedChannel: 'gk_blue_mixgate_applied',
          gates: intent!.values.map((_, ordinal) => ({
            ordinal,
            bankSymbols: [`gk_blue_mixgate_${ordinal}_0`, `gk_blue_mixgate_${ordinal}_1`] as const,
            initial: 1 as const,
            locator: {
              route: 'output' as const,
              channelOrdinal: ordinal,
              channelKind: 'source' as const,
              channelIdentity: `source:${ordinal}`,
              entryIdentity: `source:${ordinal}:output`,
              association: '',
            },
          })),
        };

        const gateSymbols = catalog.gates.flatMap((gate) => [...gate.bankSymbols]);
        const engine = await startGateEngine(
          enginePath,
          outputDirectory,
          'history',
          gateSymbols,
          catalog.commitChannel,
          catalog.appliedChannel,
        );
        const io: MixerGateEngineIO = {
          setChannels: (entries) => engine.client.setChannels(entries),
          getChannels: (names) => engine.client.getChannels(names),
        };
        const publisher = new MixerGatePublisher(io, {
          observeAttempts: 200,
          observeDelayMs: 5,
        });
        publisher.setBindings('timeline', catalog);

        const reconciliation = new ProjectRuntimeReconciliation({
          operationTimeoutMs: 10_000,
          resolveMixerGates: () => resolveMixerGateIntent(data.getMixer()),
        });
        const client = {
          applyOperation(operation: RuntimeWorkOperation) {
            if (operation.kind !== 'mixer-gates') {
              return Promise.resolve({ status: 'rejected' as const, message: 'gates only' });
            }
            return publisher
              .publish('timeline', operation.signature, operation.values)
              .then((result) =>
                result.ok
                  ? ({ status: 'applied' as const } as const)
                  : ({ status: 'rejected' as const, message: result.message } as const),
              );
          },
        };
        reconciliation.registerPerformance(
          'timeline',
          1,
          client,
          new Map([
            ['mixer-gates::gates', { kind: 'mixer-gates' as const, signature: catalog.signature }],
          ]),
        );

        const session = new ProjectSession();
        session.replace(data, path.join(outputDirectory, 't111-history.blue'), {
          documentId: 'doc-t111-real-engine',
        });
        const recorder = new FakePublicationRecorder();
        const history = new ProjectHistory({
          session,
          reconciliation,
          publishUpdated: (evt) => recorder.record(evt),
        });
        const contextA = new MockHistoryContext('ctx-a');
        const docId = session.read().documentId!;

        const readGate = async (bank: 0 | 1): Promise<number[]> => {
          const read = await engine.client.getChannels(
            catalog.gates.map((gate) => gate.bankSymbols[bank]),
          );
          expect(read.ok).toBe(true);
          return read.ok ? read.values : [];
        };
        const readChannel = async (name: string): Promise<number> => {
          const read = await engine.client.getChannels([name]);
          expect(read.ok).toBe(true);
          return read.ok ? read.values[0]! : Number.NaN;
        };

        // Commit: mute the channel on the running performance.
        const res = await history.commit(
          contextA.nextCommitRequest(docId, 0, 'Mute Channel', [
            {
              mixer: {
                type: 'updateChannel',
                channelId: 'track-a',
                patch: { muted: true },
              },
            },
          ]),
        );
        expect(res.status).toBe('committed');
        // One output edge per source channel (CA + master = 2 gates).
        expect(catalog.gates.length).toBeGreaterThanOrEqual(2);
        expect(await readChannel(catalog.commitChannel)).toBe(1);
        expect(await readChannel(catalog.appliedChannel)).toBe(1);
        // The staged bank (1) carries the muted intent: CA's edge 0, master 1.
        expect(await readGate(1)).toEqual([0, 1]);

        // Undo: gates return to the unmuted canonical state.
        await history.undo({
          documentId: docId,
          operationId: 'undo-mute',
          expectedRevision: 1,
          contextSequence: contextA.sequence + 1,
        });
        expect(await readChannel(catalog.commitChannel)).toBe(2);
        expect(await readChannel(catalog.appliedChannel)).toBe(2);
        expect(await readGate(0)).toEqual([1, 1]);

        // Redo: the muted vector is republished.
        const redo = await history.redo({
          documentId: docId,
          operationId: 'redo-mute',
          expectedRevision: 2,
          contextSequence: contextA.sequence + 2,
        });
        expect(redo.status).toBe('committed');
        expect(await readChannel(catalog.commitChannel)).toBe(3);
        expect(await readChannel(catalog.appliedChannel)).toBe(3);
        expect(await readGate(1)).toEqual([0, 1]);

        await reconciliation.drainPreviews();
        const outcome = reconciliation.getOutcome('timeline');
        expect(outcome?.status).toBe('applied');
      } finally {
        await rm(outputDirectory, { recursive: true, force: true });
      }
    }, 120_000);
  });
}
