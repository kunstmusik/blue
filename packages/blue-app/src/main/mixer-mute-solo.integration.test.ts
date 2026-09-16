import { existsSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AudioClip,
  BlueData,
  Channel,
  Send,
  ScoreTrack,
  TimeDuration,
  TimePosition,
  TrackLayerGroup,
  buildStandardCSD,
  resolveMixerGateIntent,
} from '@blue/data';
import type { CompiledMixerGateBindings } from '@blue/data';
import { ProjectHistory } from './project-history';
import { ProjectSession } from './project-session';
import { MockHistoryContext, FakePublicationRecorder } from './project-history-test-support';
import { ProjectRuntimeReconciliation } from './project-runtime-reconciliation';
import type { RuntimeWorkOperation } from './project-runtime-reconciliation';
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
function writeSineWav(filePath: string, seconds: number, sampleRate = 44100): void {
  const frames = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000);
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

interface DecodedWav {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Float64Array; // interleaved
}

function decodeWav(filePath: string): DecodedWav {
  const buffer = require('node:fs').readFileSync(filePath) as Buffer;
  expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buffer.toString('ascii', 8, 12)).toBe('WAVE');
  let offset = 12;
  let formatTag = 1;
  let channels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let dataStart = -1;
  let dataLength = 0;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      formatTag = buffer.readUInt16LE(offset + 8);
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataStart = offset + 8;
      dataLength = chunkSize;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  expect(dataStart).toBeGreaterThan(0);
  const bytesPerSample = bitsPerSample / 8;
  const count = Math.floor(dataLength / bytesPerSample);
  const samples = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] =
      bitsPerSample === 16
        ? buffer.readInt16LE(dataStart + i * 2)
        : buffer.readFloatLE(dataStart + i * 4);
  }
  void formatTag;
  return { sampleRate, channels, bitsPerSample, samples };
}

/** Peak residual in dBFS between two interleaved buffers; -Infinity when identical. */
function peakResidualDbfs(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length) return 0;
  let peak = 0;
  for (let i = 0; i < a.length; i++) {
    const delta = Math.abs(a[i] - b[i]);
    if (delta > peak) peak = delta;
  }
  return peak === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(peak);
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
    const wavFormat = await client.setOption('-W');
    if (!wavFormat.ok) throw new Error(`-W failed: ${wavFormat.message}`);
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
    return decodeWav(wavPath);
  } finally {
    await session.shutdown('t111-render-complete');
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
        expect(prunedWav.samples.length).toBe(unprunedWav.samples.length);
        expect(prunedWav.samples.length).toBeGreaterThan(0);
        const residual = peakResidualDbfs(prunedWav.samples, unprunedWav.samples);
        expect(residual).toBeLessThanOrEqual(-120);
      } finally {
        await rm(outputDirectory, { recursive: true, force: true });
      }
    }, 180_000);

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
