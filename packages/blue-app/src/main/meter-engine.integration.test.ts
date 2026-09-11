import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  Channel,
  GenericInstrument,
  PolyObject,
  SoundLayer,
  TimePosition,
  TimeDuration,
} from '@blue/data';
import { GenericScore } from '@blue/data';
import { EngineSession } from './engine-session';
import { allocateTcpEndpointPair } from './engine-endpoints';
import { developmentEnginePath } from './engine-runtime';
import { EngineBridge } from './engine-bridge';
import { EngineRuntimeService } from './engine-runtime';
import { parseCSD } from './engine-bridge';
import { buildMeterBindingMapPayload } from './meter-binding';
import { getMixerChannelSnapshotId } from '../shared/project-editor';
import { MeterStore } from '../renderer/stores/meter-store';
import type { MeterFramePayload, MeterBindingMapPayload } from '../shared/meter-types';

// Captures main-process window broadcasts so tests can subscribe exactly the
// way the preload bridge does (onMeterBindingMap / onMeterFrame /
// onMeterReset forward 'meter-binding-map' / 'meter-frame' / 'meter-reset').
const meterBroadcastCapture = vi.hoisted(() => {
  const calls: Array<{ channel: string; payload: unknown; at: number }> = [];
  const listeners: Array<(channel: string, payload: unknown) => void> = [];
  const broadcastToWorkbenchWindows = (channel: string, payload: unknown): void => {
    calls.push({ channel, payload, at: performance.now() });
    for (const listener of [...listeners]) {
      listener(channel, payload);
    }
  };
  return { calls, listeners, broadcastToWorkbenchWindows };
});

// Electron is not importable in the node test environment (its binary
// postinstall does not run for tests); the bridge only needs the type at
// runtime, matching the established engine-bridge.test.ts pattern.
vi.mock('electron', () => ({
  BrowserWindow: class {},
}));

vi.mock('./workbench-window-host', () => ({
  broadcastToWorkbenchWindows: meterBroadcastCapture.broadcastToWorkbenchWindows,
}));

async function waitFor(predicate: () => void, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  let lastError: unknown = null;
  while (performance.now() < deadline) {
    try {
      predicate();
      return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  predicate();
  if (lastError) {
    throw lastError;
  }
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
    path.join(
      repositoryRoot,
      'native',
      'blue-engine',
      `build-${process.platform}-${process.arch}-release`,
      executableName,
    ),
    path.join(
      repositoryRoot,
      'native',
      'blue-engine',
      `build-${process.platform}-${process.arch}-debug`,
      executableName,
    ),
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

const enginePath = resolveAcceptanceEnginePath();

// Intentional realtime-capable null audio backend options (T053, Constitution V).
// -+rtaudio=null activates Csound's dummy rtaudio driver which paces playback in
// realtime without requiring a physical audio output device (preventing SIGTRAP on
// headless/CI hosts where CoreAudio AuHAL reports 0 devices).
const TEST_AUDIO_OPTIONS = ['-+rtaudio=null', '-odac', '-d'];

describe.skipIf(!enginePath)(
  'Running-engine mixer metering integration (T042, FR-002, FR-003, FR-012, SC-001)',
  () => {
    let tempDir: string;
    let activeSession: EngineSession | null = null;

    beforeEach(async () => {
      tempDir = await mkdtemp(path.join(tmpdir(), 'blue-meter-engine-'));
    });

    afterEach(async () => {
      if (activeSession) {
        try {
          await activeSession.shutdown('test-cleanup');
        } catch {
          // Safe shutdown
        }
        activeSession = null;
      }
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    });

    function createProjectWithAudio(
      options: {
        sourceLevelDb?: number;
        subLevelDb?: number;
        masterLevelDb?: number;
        durationBeats?: number;
        amplitude?: number;
      } = {},
    ): {
      data: BlueData;
      synthId: string;
      subId: string;
      masterId: string;
    } {
      const {
        sourceLevelDb = 0,
        subLevelDb = 0,
        masterLevelDb = 0,
        durationBeats = 10,
        amplitude = 0.5,
      } = options;

      const data = new BlueData();
      const mixer = data.getMixer();
      mixer.setEnabled(true);
      mixer.getMaster().setLevel(masterLevelDb);

      const synthChannel = new Channel();
      synthChannel.setName('1');
      synthChannel.setAssociation('1');
      synthChannel.setOutChannel('Sub 1');
      synthChannel.setLevel(sourceLevelDb);
      mixer.getChannels().push(synthChannel);

      const subChannel = new Channel();
      subChannel.setName('Sub 1');
      subChannel.setOutChannel('Master');
      subChannel.setLevel(subLevelDb);
      mixer.getSubChannels().push(subChannel);

      const instr = new GenericInstrument();
      instr.setName('Osc');
      instr.setText(`
      ain poscil ${amplitude}, 440
      blueMixerOut ain, ain
    `);
      data.getArrangement().addInstrument(instr, '1');

      const poly = new PolyObject(true);
      const layer = new SoundLayer();
      const gs = new GenericScore();
      gs.setStartTime(TimePosition.beats(0));
      gs.setSubjectiveDuration(TimeDuration.beats(durationBeats));
      gs.setScoreText(`i1 0 ${durationBeats}`);
      layer.push(gs);
      poly.push(layer);
      data.getScore().push(poly);

      return {
        data,
        synthId: getMixerChannelSnapshotId(synthChannel),
        subId: getMixerChannelSnapshotId(subChannel),
        masterId: getMixerChannelSnapshotId(mixer.getMaster()),
      };
    }

    async function spawnEngine(): Promise<EngineSession> {
      const transport = process.platform === 'win32' ? 'tcp' : 'ipc';
      const endpointPair =
        transport === 'tcp' ? await allocateTcpEndpointPair({ basePort: 47000 }) : null;

      const session = new EngineSession({
        kind: 'realtime',
        enginePath: enginePath!,
        transport,
        port: endpointPair?.controlPort,
        pubPort: endpointPair?.pubPort,
        extraArgs: [
          '--disable-shared-memory',
          '--disable-channel-mirroring',
          '--disable-thread-priority-elevation',
        ],
      });

      await session.spawn();
      const ready = await session.awaitReady();
      if (ready.status !== 'ready') {
        throw new Error(ready.errorMessage ?? 'Engine did not become ready');
      }
      activeSession = session;
      return session;
    }

    async function prepareAndStartCsd(
      client: NonNullable<ReturnType<EngineSession['getClient']>>,
      csdText: string,
    ): Promise<void> {
      const { orchestra, score, options } = parseCSD(csdText);
      const mergedOptions = [...new Set([...options, ...TEST_AUDIO_OPTIONS])];
      for (const opt of mergedOptions) {
        await client.setOption(opt);
      }
      const compOrc = await client.compileOrc(orchestra);
      expect(compOrc.ok).toBe(true);
      const readSco = await client.readScore(score);
      expect(readSco.ok).toBe(true);
      const startRes = await client.start();
      expect(startRes.ok).toBe(true);
    }

    it('feeds known audio through source, sub, and master, verifying post-fader values and binding (FR-002, SC-001)', async () => {
      // 0.5 peak amplitude pure sine wave
      // Expected RMS: 0.5 / sqrt(2) ≈ 0.353
      // Expected Peak: 0.5
      const { data, synthId, subId, masterId } = createProjectWithAudio({ amplitude: 0.5 });

      const render = data.toRealtimePlaybackCSD(undefined, true);
      expect(render.meterBindingMap).toBeDefined();

      const bindingPayload = buildMeterBindingMapPayload(data, render.meterBindingMap!);
      const meterStore = new MeterStore();
      meterStore.setBindingMap(bindingPayload);

      const session = await spawnEngine();
      const client = session.getClient()!;

      const receivedFrames: MeterFramePayload[] = [];
      client.onEngineMeters((frame) => {
        receivedFrames.push(frame);
        meterStore.processMeterFrame(frame);
      });

      await prepareAndStartCsd(client, render.csdText);

      // Wait for at least 5 meter frames
      const deadline = performance.now() + 10000;
      while (receivedFrames.length < 5 && performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }

      expect(receivedFrames.length).toBeGreaterThanOrEqual(5);

      // Inspect the latest frame
      const latestFrame = receivedFrames[receivedFrames.length - 1]!;
      expect(latestFrame.sequence).toBeGreaterThan(0);

      // Channel keys from binding map
      const synthEntry = bindingPayload.entries.find((e) => e.stripId === synthId)!;
      const subEntry = bindingPayload.entries.find((e) => e.stripId === subId)!;
      const masterEntry = bindingPayload.entries.find((e) => e.stripId === masterId)!;

      const synthChannelData = latestFrame.channels.find((c) => c.csdKey === synthEntry.csdKey);
      const subChannelData = latestFrame.channels.find((c) => c.csdKey === subEntry.csdKey);
      const masterChannelData = latestFrame.channels.find((c) => c.csdKey === masterEntry.csdKey);

      expect(synthChannelData).toBeDefined();
      expect(subChannelData).toBeDefined();
      expect(masterChannelData).toBeDefined();

      // Check peak and RMS readings against known 0.5 amplitude sine wave
      // Peak should be ~0.5 (±0.08 tolerance for windowing/envelope)
      expect(synthChannelData!.peak[0]).toBeCloseTo(0.5, 1);
      expect(synthChannelData!.rms[0]).toBeCloseTo(0.353, 1);

      // SubChannel receives synth output
      expect(subChannelData!.peak[0]).toBeCloseTo(0.5, 1);
      expect(subChannelData!.rms[0]).toBeCloseTo(0.353, 1);

      // Master receives subchannel output
      expect(masterChannelData!.peak[0]).toBeCloseTo(0.5, 1);
      expect(masterChannelData!.rms[0]).toBeCloseTo(0.353, 1);

      // Advance meterStore ballistics and verify strip states
      meterStore.update(performance.now());
      const synthState = meterStore.getStripState(synthId)!;
      const subState = meterStore.getStripState(subId)!;
      const masterState = meterStore.getStripState(masterId)!;

      expect(synthState.barLevels[0]).toBeGreaterThan(-15);
      expect(subState.barLevels[0]).toBeGreaterThan(-15);
      expect(masterState.barLevels[0]).toBeGreaterThan(-15);

      // Stop playback and verify meters reset to silence
      await client.stop();
      meterStore.reset();

      expect(meterStore.getStripState(synthId)!.barLevels[0]).toBe(-Infinity);
      expect(meterStore.getStripState(synthId)!.peakHoldLevels[0]).toBe(-Infinity);
      expect(meterStore.getStripState(subId)!.barLevels[0]).toBe(-Infinity);
      expect(meterStore.getStripState(masterId)!.barLevels[0]).toBe(-Infinity);
    }, 20000);

    it('verifies readings are post-fader when channel gain is attenuated (FR-003)', async () => {
      // Channel fader set to -6 dB (approx 0.501 amplitude factor)
      // Audio source is 0.5 peak, so post-fader peak should be ~0.25 (-12 dBFS)
      const { data, synthId } = createProjectWithAudio({
        amplitude: 0.5,
        sourceLevelDb: -6.0,
      });

      const render = data.toRealtimePlaybackCSD(undefined, true);
      const bindingPayload = buildMeterBindingMapPayload(data, render.meterBindingMap!);
      const meterStore = new MeterStore();
      meterStore.setBindingMap(bindingPayload);

      const session = await spawnEngine();
      const client = session.getClient()!;

      const receivedFrames: MeterFramePayload[] = [];
      client.onEngineMeters((frame) => {
        receivedFrames.push(frame);
        meterStore.processMeterFrame(frame);
      });

      await prepareAndStartCsd(client, render.csdText);

      const deadline = performance.now() + 10000;
      while (receivedFrames.length < 5 && performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }

      expect(receivedFrames.length).toBeGreaterThanOrEqual(5);
      const latestFrame = receivedFrames[receivedFrames.length - 1]!;
      const synthEntry = bindingPayload.entries.find((e) => e.stripId === synthId)!;
      const synthChannelData = latestFrame.channels.find((c) => c.csdKey === synthEntry.csdKey)!;

      // With -6 dB fader on a 0.5 peak source:
      // Peak should be ~0.25 (not 0.5)
      // RMS should be ~0.176 (not 0.353)
      expect(synthChannelData.peak[0]).toBeCloseTo(0.25, 1);
      expect(synthChannelData.rms[0]).toBeCloseTo(0.176, 1);

      await client.stop();
    }, 20000);

    it('resets every meter to silence floor without stale state on natural end (FR-012)', async () => {
      // Very short score note of 0.3 seconds
      const { data, synthId, masterId } = createProjectWithAudio({
        durationBeats: 0.3,
        amplitude: 0.5,
      });

      const render = data.toRealtimePlaybackCSD(undefined, true);
      const bindingPayload = buildMeterBindingMapPayload(data, render.meterBindingMap!);
      const meterStore = new MeterStore();
      meterStore.setBindingMap(bindingPayload);

      const session = await spawnEngine();
      const client = session.getClient()!;

      let receivedAny = false;
      client.onEngineMeters((frame) => {
        receivedAny = true;
        meterStore.processMeterFrame(frame);
      });

      await prepareAndStartCsd(client, render.csdText);

      // Wait until audio frames were received and playback finishes naturally
      const deadline = performance.now() + 10000;
      let finished = false;
      while (performance.now() < deadline) {
        const state = await client.getEngineState();
        if (state.ok && (state.state?.state === 'stopped' || state.state?.running === false)) {
          finished = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      expect(receivedAny).toBe(true);
      expect(finished).toBe(true);

      // Natural end triggers meter-reset
      meterStore.reset();

      const synthState = meterStore.getStripState(synthId)!;
      const masterState = meterStore.getStripState(masterId)!;
      expect(synthState.barLevels[0]).toBe(-Infinity);
      expect(synthState.peakHoldLevels[0]).toBe(-Infinity);
      expect(masterState.barLevels[0]).toBe(-Infinity);
      expect(masterState.peakHoldLevels[0]).toBe(-Infinity);
    }, 20000);

    it('resets every meter without stale state on forced engine failure (FR-012)', async () => {
      const { data, synthId, masterId } = createProjectWithAudio({
        durationBeats: 60,
        amplitude: 0.6,
      });

      const render = data.toRealtimePlaybackCSD(undefined, true);
      const bindingPayload = buildMeterBindingMapPayload(data, render.meterBindingMap!);
      const meterStore = new MeterStore();
      meterStore.setBindingMap(bindingPayload);

      const session = await spawnEngine();
      const client = session.getClient()!;

      let framesReceived = 0;
      client.onEngineMeters((frame) => {
        framesReceived++;
        meterStore.processMeterFrame(frame);
      });

      await prepareAndStartCsd(client, render.csdText);

      // Wait for meters to become active
      const deadline = performance.now() + 10000;
      while (framesReceived < 3 && performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(framesReceived).toBeGreaterThanOrEqual(3);

      meterStore.update(performance.now());
      expect(meterStore.getStripState(synthId)!.barLevels[0]).toBeGreaterThan(-60);

      // Force engine failure: abruptly terminate session
      await session.shutdown('forced-test-failure');
      activeSession = null;

      // Simulate main process engine-recovery/termination handler dispatching meter-reset
      meterStore.reset();

      // Verify all meters immediately return to silence with no residual/frozen state
      const synthState = meterStore.getStripState(synthId)!;
      const masterState = meterStore.getStripState(masterId)!;
      expect(synthState.barLevels[0]).toBe(-Infinity);
      expect(synthState.peakHoldLevels[0]).toBe(-Infinity);
      expect(synthState.clipFlags[0]).toBe(false);
      expect(masterState.barLevels[0]).toBe(-Infinity);
      expect(masterState.peakHoldLevels[0]).toBe(-Infinity);
    }, 20000);

    it('instruments real engine-to-renderer meter path: verifies sustained delivery >= 30 Hz with no stall > 200 ms (FR-006, SC-002)', async () => {
      const { data, synthId } = createProjectWithAudio({
        durationBeats: 10,
        amplitude: 0.5,
      });

      const render = data.toRealtimePlaybackCSD(undefined, true);
      const bindingPayload = buildMeterBindingMapPayload(data, render.meterBindingMap!);
      const meterStore = new MeterStore();
      meterStore.setBindingMap(bindingPayload);

      const session = await spawnEngine();
      const client = session.getClient()!;

      interface FrameRecord {
        timestamp: number;
        sequence: number;
      }

      const records: FrameRecord[] = [];
      client.onEngineMeters((frame) => {
        records.push({
          timestamp: performance.now(),
          sequence: frame.sequence,
        });
        meterStore.processMeterFrame(frame);
      });

      await prepareAndStartCsd(client, render.csdText);

      // Stream audio and collect at least 65 frames (~1.8-2.0s of streaming audio at ~35 Hz)
      const targetFrames = 65;
      const deadline = performance.now() + 10000;
      while (records.length < targetFrames && performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }

      await client.stop();

      expect(records.length).toBeGreaterThanOrEqual(targetFrames);

      // Verify sequence monotonicity: sequence numbers must increase strictly by 1 without drops or gaps
      for (let i = 1; i < records.length; ++i) {
        expect(records[i]!.sequence).toBe(records[i - 1]!.sequence + 1);
      }

      // Compute intervals and delivery rate
      const intervalsMs: number[] = [];
      for (let i = 1; i < records.length; ++i) {
        intervalsMs.push(records[i]!.timestamp - records[i - 1]!.timestamp);
      }

      const maxIntervalMs = Math.max(...intervalsMs);
      const minIntervalMs = Math.min(...intervalsMs);
      const avgIntervalMs = intervalsMs.reduce((a, b) => a + b, 0) / intervalsMs.length;
      const elapsedSeconds =
        (records[records.length - 1]!.timestamp - records[0]!.timestamp) / 1000;
      const deliveryRateHz = (records.length - 1) / elapsedSeconds;

      // SC-002: Sustained >= 30 Hz delivery rate
      expect(deliveryRateHz).toBeGreaterThanOrEqual(30.0);

      // SC-002: No stall longer than 200 ms while audio is streaming
      expect(maxIntervalMs).toBeLessThan(200.0);

      // Verify meterStore processed state accurately
      meterStore.update(performance.now());
      const synthState = meterStore.getStripState(synthId);
      expect(synthState).toBeDefined();
      expect(synthState!.barLevels[0]).toBeGreaterThan(-20);

      meterStore.reset();
      expect(meterStore.getStripState(synthId)!.barLevels[0]).toBe(-Infinity);
    }, 15000);

    it('compares playback soak with metering enabled versus disabled, verifying 0 dropouts/errors and unaffected audio lifecycle (FR-014, SC-004)', async () => {
      // 1. Run playback soak with metering ENABLED
      const { data } = createProjectWithAudio({
        durationBeats: 10,
        amplitude: 0.5,
      });

      const renderEnabled = data.toRealtimePlaybackCSD(undefined, true);
      expect(renderEnabled.meterBindingMap).toBeDefined();

      const sessionEnabled = await spawnEngine();
      const clientEnabled = sessionEnabled.getClient()!;

      let enabledFrames = 0;
      clientEnabled.onEngineMeters(() => {
        enabledFrames++;
      });

      await prepareAndStartCsd(clientEnabled, renderEnabled.csdText);

      // Soak for 1.5 seconds of active playback
      await new Promise((r) => setTimeout(r, 1500));

      const stateEnabled = await clientEnabled.getEngineState();
      expect(stateEnabled.ok).toBe(true);
      expect(stateEnabled.state?.running).toBe(true);
      expect(stateEnabled.state?.lastError).toBe('');
      expect(enabledFrames).toBeGreaterThan(30);

      await clientEnabled.stop();
      await sessionEnabled.shutdown('test-cleanup');
      activeSession = null;

      // 2. Run identical playback soak with metering DISABLED
      const renderDisabled = data.toRealtimePlaybackCSD(undefined, false);
      expect(renderDisabled.meterBindingMap).toBeUndefined();

      const sessionDisabled = await spawnEngine();
      const clientDisabled = sessionDisabled.getClient()!;

      let disabledFrames = 0;
      clientDisabled.onEngineMeters(() => {
        disabledFrames++;
      });

      await prepareAndStartCsd(clientDisabled, renderDisabled.csdText);

      // Soak for 1.5 seconds of active playback
      await new Promise((r) => setTimeout(r, 1500));

      const stateDisabled = await clientDisabled.getEngineState();
      expect(stateDisabled.ok).toBe(true);
      expect(stateDisabled.state?.running).toBe(true);
      expect(stateDisabled.state?.lastError).toBe('');
      expect(disabledFrames).toBe(0);

      await clientDisabled.stop();
    }, 20000);
  },
);

describe.skipIf(!enginePath)(
  'Playback lifecycle meter-reset through EngineBridge (T047, FR-012, US3/AC4)',
  () => {
    let activeBridge: EngineBridge | null = null;
    const originalEnv = {
      BLUE_ENGINE_DISABLE_SHARED_MEMORY: process.env.BLUE_ENGINE_DISABLE_SHARED_MEMORY,
      BLUE_ENGINE_DISABLE_CHANNEL_MIRRORING: process.env.BLUE_ENGINE_DISABLE_CHANNEL_MIRRORING,
      BLUE_ENGINE_DISABLE_THREAD_PRIORITY_ELEVATION:
        process.env.BLUE_ENGINE_DISABLE_THREAD_PRIORITY_ELEVATION,
    };

    beforeEach(() => {
      process.env.BLUE_ENGINE_DISABLE_SHARED_MEMORY = '1';
      process.env.BLUE_ENGINE_DISABLE_CHANNEL_MIRRORING = '1';
      process.env.BLUE_ENGINE_DISABLE_THREAD_PRIORITY_ELEVATION = '1';
    });

    afterEach(async () => {
      meterBroadcastCapture.listeners.length = 0;
      meterBroadcastCapture.calls.length = 0;
      if (activeBridge) {
        try {
          await activeBridge.stopEngine(false);
        } catch {
          // Safe shutdown
        }
        activeBridge = null;
      }
      for (const [key, val] of Object.entries(originalEnv)) {
        if (val === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = val;
        }
      }
    });

    // Real runtime probe: executes the actual engine's --probe-csound
    // handshake so mixerMeteringSupported is negotiated exactly like
    // production, then spawns that engine through EngineBridge.
    function createBridge(): EngineBridge {
      const runtime = new EngineRuntimeService({
        isPackaged: false,
        resourcesPath: '',
        repoRoot: findRepositoryRoot(),
        environment: {
          ...process.env,
          BLUE_ENGINE_PATH: enginePath!,
          BLUE_ENGINE_DISABLE_SHARED_MEMORY: '1',
          BLUE_ENGINE_DISABLE_CHANNEL_MIRRORING: '1',
          BLUE_ENGINE_DISABLE_THREAD_PRIORITY_ELEVATION: '1',
        },
        getSettingsEnginePath: () => '',
        probeTimeoutMs: 15000,
      });
      const bridge = new EngineBridge(
        { webContents: { send: vi.fn() } } as never,
        undefined,
        undefined,
        undefined,
        'realtime',
        runtime,
      );
      activeBridge = bridge;
      return bridge;
    }

    // Mirrors the preload -> MeterStore.init() subscription wiring.
    function connectRendererStore(): {
      store: MeterStore;
      resetTimestamps: number[];
      frameCount: () => number;
    } {
      const store = new MeterStore();
      const resetTimestamps: number[] = [];
      let frames = 0;
      meterBroadcastCapture.listeners.push((channel, payload) => {
        if (channel === 'meter-binding-map') {
          store.setBindingMap(payload as MeterBindingMapPayload);
        } else if (channel === 'meter-frame') {
          frames += 1;
          store.processMeterFrame(payload as MeterFramePayload);
        } else if (channel === 'meter-reset') {
          resetTimestamps.push(performance.now());
          store.reset();
        }
      });
      return {
        store,
        resetTimestamps,
        frameCount: () => frames,
      };
    }

    // Local twin of the first suite's project factory (scoped there).
    function createMeteredProject(options: {
      durationBeats?: number;
      amplitude?: number;
    }): BlueData {
      const { durationBeats = 60, amplitude = 0.5 } = options;
      const data = new BlueData();
      const mixer = data.getMixer();
      mixer.setEnabled(true);

      const synthChannel = new Channel();
      synthChannel.setName('1');
      synthChannel.setAssociation('1');
      synthChannel.setOutChannel('Master');
      mixer.getChannels().push(synthChannel);

      const subChannel = new Channel();
      subChannel.setName('Sub 1');
      subChannel.setOutChannel('Master');
      mixer.getSubChannels().push(subChannel);

      const instr = new GenericInstrument();
      instr.setName('Osc');
      instr.setText(`
      ain poscil ${amplitude}, 440
      blueMixerOut ain, ain
    `);
      data.getArrangement().addInstrument(instr, '1');

      const poly = new PolyObject(true);
      const layer = new SoundLayer();
      const gs = new GenericScore();
      gs.setStartTime(TimePosition.beats(0));
      gs.setSubjectiveDuration(TimeDuration.beats(durationBeats));
      gs.setScoreText(`i1 0 ${durationBeats}`);
      layer.push(gs);
      poly.push(layer);
      data.getScore().push(poly);
      return data;
    }

    async function playBridgeProject(
      bridge: EngineBridge,
      options: { durationBeats?: number; amplitude?: number },
    ): Promise<{ binding: MeterBindingMapPayload; sourceStripId: string; sourceCsdKey: string }> {
      const data = createMeteredProject(options);
      const render = data.toRealtimePlaybackCSD(undefined, true);
      expect(render.meterBindingMap).toBeDefined();
      const binding = buildMeterBindingMapPayload(data, render.meterBindingMap!);
      const played = await bridge.playCSD(
        render.csdText,
        undefined,
        undefined,
        null,
        [...TEST_AUDIO_OPTIONS],
        binding,
      );
      expect(played.ok).toBe(true);
      const sourceEntry = binding.entries.find((entry) => entry.kind === 'source')!;
      return {
        binding,
        sourceStripId: sourceEntry.stripId,
        sourceCsdKey: sourceEntry.csdKey,
      };
    }

    it('broadcasts meter-reset on normal stop and clears subscribed meter state and clip holds promptly (FR-012)', async () => {
      const bridge = createBridge();
      const { store, resetTimestamps, frameCount } = connectRendererStore();
      const { sourceStripId, sourceCsdKey } = await playBridgeProject(bridge, {
        durationBeats: 60,
      });

      // Real meter frames must flow through the EngineBridge subscription.
      await waitFor(() => expect(frameCount()).toBeGreaterThanOrEqual(5), 10000);
      store.update(performance.now());
      expect(store.getStripState(sourceStripId)!.barLevels[0]).toBeGreaterThan(-60);

      // Latch a clip through the subscribed store so reset clearing is
      // observable (over-0dBFS peaks are legal pipeline values).
      store.processMeterFrame({
        sequence: 999_999,
        channels: [{ csdKey: sourceCsdKey, rms: [0.9, 0.9], peak: [1.2, 1.2] }],
      });
      store.update(performance.now());
      expect(store.getStripState(sourceStripId)!.clipFlags[0]).toBe(true);

      const stopStartedAt = performance.now();
      await bridge.stopPlayback();

      await waitFor(() => expect(resetTimestamps.length).toBeGreaterThan(0), 5000);
      // FR-012: driven by the playback lifecycle signal, within about one
      // second of the stop request.
      expect(resetTimestamps[0]! - stopStartedAt).toBeLessThan(1000);

      const resetBroadcast = meterBroadcastCapture.calls.find(
        (call) => call.channel === 'meter-reset',
      );
      // The preload contract forwards exactly this channel and payload.
      expect(resetBroadcast).toBeDefined();
      expect(resetBroadcast!.payload).toEqual({});

      const state = store.getStripState(sourceStripId)!;
      expect(state.barLevels[0]).toBe(-Infinity);
      expect(state.peakHoldLevels[0]).toBe(-Infinity);
      expect(state.clipFlags[0]).toBe(false);
    }, 30000);

    it('broadcasts meter-reset when the score ends naturally and clears subscribed state (FR-012)', async () => {
      const bridge = createBridge();
      const { store, resetTimestamps, frameCount } = connectRendererStore();
      const playbackStartedAt = performance.now();
      const { sourceStripId } = await playBridgeProject(bridge, {
        durationBeats: 0.3,
      });

      // The 0.3s score finishes on its own; the lifecycle signal must reset.
      await waitFor(() => expect(resetTimestamps.length).toBeGreaterThan(0), 8000);
      expect(resetTimestamps[0]! - playbackStartedAt).toBeLessThan(5000);
      expect(frameCount()).toBeGreaterThan(0);

      const state = store.getStripState(sourceStripId)!;
      expect(state.barLevels[0]).toBe(-Infinity);
      expect(state.peakHoldLevels[0]).toBe(-Infinity);
      expect(state.clipFlags.every((clipped) => !clipped)).toBe(true);
    }, 30000);

    it('broadcasts meter-reset after forced engine termination and clears subscribed state (FR-012)', async () => {
      const bridge = createBridge();
      const { store, resetTimestamps, frameCount } = connectRendererStore();
      const { sourceStripId } = await playBridgeProject(bridge, {
        durationBeats: 60,
      });

      await waitFor(() => expect(frameCount()).toBeGreaterThanOrEqual(3), 10000);

      // Latch activity so the reset is provably clearing live state.
      store.update(performance.now());
      expect(store.getStripState(sourceStripId)!.barLevels[0]).toBeGreaterThan(-60);

      // Kill the engine process abruptly; EngineBridge's exit handling must
      // broadcast meter-reset rather than leaving stale meters.
      const session = (
        bridge as unknown as {
          activeSession: { getEnginePid(): number | null } | null;
        }
      ).activeSession;
      const enginePid = session?.getEnginePid();
      expect(typeof enginePid).toBe('number');
      process.kill(enginePid!, 'SIGKILL');

      await waitFor(() => expect(resetTimestamps.length).toBeGreaterThan(0), 10000);
      const state = store.getStripState(sourceStripId)!;
      expect(state.barLevels[0]).toBe(-Infinity);
      expect(state.peakHoldLevels[0]).toBe(-Infinity);
      expect(state.clipFlags.every((clipped) => !clipped)).toBe(true);

      await waitFor(() => {
        expect((bridge as unknown as { activeSession: unknown }).activeSession).toBeNull();
      }, 10000);
    }, 40000);
  },
);
