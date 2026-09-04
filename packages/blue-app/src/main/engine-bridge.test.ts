import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineStateSnapshot } from '@blue/engine-client';
import { EngineBridge } from './engine-bridge';
import type { EngineRuntimeService } from './engine-runtime';
import { EngineSession, type EngineSessionCreationRequest } from './engine-session';
import {
  FakeChildProcess,
  FakeEngineClient,
  FakeProcessRegistry,
} from './engine-session.test-support';

const { showErrorBox } = vi.hoisted(() => ({ showErrorBox: vi.fn() }));

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showErrorBox },
}));

function windowStub() {
  return { webContents: { send: vi.fn() } } as never;
}

describe('EngineBridge runtime selection and lifecycle', () => {
  beforeEach(() => showErrorBox.mockClear());

  it('counts channel control commands and entries without sampling the engine', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const client = {
      setChannel: vi.fn(async () => ({ ok: true, message: '' })),
      getChannel: vi.fn(async () => ({ ok: true, value: 0.5, message: '' })),
      setChannels: vi.fn(async () => ({ ok: true, message: '' })),
      getChannels: vi.fn(async () => ({ ok: true, values: [1, 2, 3], message: '' })),
    };
    (
      bridge as unknown as {
        activeSession: { getClient(): typeof client } | null;
      }
    ).activeSession = { getClient: () => client };

    await bridge.setChannel('one', 1);
    await bridge.setChannels([
      { name: 'two', value: 2 },
      { name: 'three', value: 3 },
    ]);
    await bridge.getChannel('one');
    await bridge.getChannels(['one', 'two', 'three']);

    expect(bridge.getControlTrafficSnapshot()).toEqual({
      readCommands: 2,
      readEntries: 4,
      writeCommands: 2,
      writeEntries: 3,
    });
  });

  it('does not search PATH for a legacy relative engine name', () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    expect((bridge as unknown as { findEngine(): string | null }).findEngine()).toBeNull();
  });

  it('accepts only an existing absolute legacy constructor path', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'blue-bridge-engine-'));
    const executablePath = path.join(root, 'blue-engine');
    writeFileSync(executablePath, 'fixture');
    const bridge = new EngineBridge(windowStub(), executablePath);
    expect((bridge as unknown as { findEngine(): string | null }).findEngine()).toBe(
      executablePath,
    );
  });

  it('gates process startup on the runtime probe and reports missing Csound', async () => {
    const runtime = {
      probe: vi.fn(async () => ({
        ok: false,
        selection: {
          source: 'development',
          executablePath: '/workspace/native/blue-engine/dist/darwin-arm64/blue-engine',
          expectedProtocolVersion: 2,
          artifactSha256: 'hash',
          diagnostic: null,
        },
        report: null,
        errorCode: 'CSOUND_UNAVAILABLE',
        message: 'Csound 7 was not found',
        durationMs: 1,
      })),
    } as unknown as EngineRuntimeService;
    const bridge = new EngineBridge(
      windowStub(),
      undefined,
      undefined,
      undefined,
      'realtime',
      runtime,
    );

    await expect(bridge.startEngine()).resolves.toMatchObject({
      ok: false,
      failureCategory: 'runtime-unavailable',
      errorMessage: 'Csound 7 was not found',
    });
    expect(runtime.probe).toHaveBeenCalledOnce();
    expect(showErrorBox).not.toHaveBeenCalled();
  });

  it('does not notify the warning callback for an expected terminal source error', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const warning = vi.fn();
    bridge.setPlaybackErrorWarningCallback(warning);

    const internals = bridge as unknown as {
      awaitingPlaybackTerminalState: boolean;
      finalizePlaybackFromEngine: (
        snapshot: EngineStateSnapshot,
        source: 'pubsub' | 'poll',
      ) => Promise<void>;
    };
    internals.awaitingPlaybackTerminalState = true;

    await internals.finalizePlaybackFromEngine(
      {
        state: 'stopped',
        stopReason: 'error',
        engineCreated: true,
        running: false,
        sampleFrames: 0,
        sampleRate: 44100,
        ksmps: 64,
        sequence: 1,
        lastError: 'invalid orchestra',
      },
      'pubsub',
    );

    expect(warning).not.toHaveBeenCalled();
  });

  it('notifies the configured warning callback for an unexpected terminal engine error', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const warning = vi.fn();
    bridge.setPlaybackErrorWarningCallback(warning);

    const internals = bridge as unknown as {
      awaitingPlaybackTerminalState: boolean;
      finalizePlaybackFromEngine: (
        snapshot: EngineStateSnapshot,
        source: 'pubsub' | 'poll',
      ) => Promise<void>;
    };
    internals.awaitingPlaybackTerminalState = true;

    await internals.finalizePlaybackFromEngine(
      {
        state: 'stopped',
        stopReason: 'error',
        engineCreated: true,
        running: false,
        sampleFrames: 0,
        sampleRate: 44100,
        ksmps: 64,
        sequence: 1,
        lastError: 'audio device disconnected',
      },
      'pubsub',
    );

    expect(warning).toHaveBeenCalledWith('Engine error: audio device disconnected');
  });

  it('classifies orchestra compilation failures as project errors without warning', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const warning = vi.fn();
    const compileOrc = vi.fn(async () => ({ ok: false, message: 'Failed to compile orchestra' }));
    bridge.setPlaybackErrorWarningCallback(warning);

    const fakeClient = new FakeEngineClient();
    fakeClient.compileOrc = compileOrc as any;

    const fakeSession = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => new FakeChildProcess() as any,
        createClient: () => fakeClient as any,
        registerManifest: async () => '/tmp/manifest.json',
        removeManifest: async () => {},
      },
    );
    await fakeSession.spawn();
    await fakeSession.awaitReady();

    const internals = bridge as unknown as {
      activeSession: EngineSession | null;
      startEngine: () => Promise<{ ok: boolean }>;
    };
    internals.startEngine = vi.fn(async () => ({ ok: true }));
    internals.activeSession = fakeSession;

    await expect(
      bridge.playCSD(
        '<CsoundSynthesizer><CsInstruments>asdf</CsInstruments><CsScore>e</CsScore></CsoundSynthesizer>',
      ),
    ).resolves.toMatchObject({
      ok: false,
      failureKind: 'project',
      failureCategory: 'unexpected',
    });

    expect(compileOrc).toHaveBeenCalledWith('asdf');
    expect(warning).not.toHaveBeenCalled();
  });

  it('waits for the stopped engine state before resolving stop', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const stoppedState = {
      state: 'stopped',
      stopReason: 'stop-requested',
      engineCreated: true,
      running: false,
      sampleFrames: 0,
      sampleRate: 44100,
      ksmps: 64,
      sequence: 1,
      lastError: '',
    } satisfies EngineStateSnapshot;

    let resolveState!: (value: {
      ok: boolean;
      state: EngineStateSnapshot;
      message: string;
    }) => void;
    const stateReady = new Promise<{ ok: boolean; state: EngineStateSnapshot; message: string }>(
      (resolve) => {
        resolveState = resolve;
      },
    );

    const fakeClient = new FakeEngineClient();
    fakeClient.stop = vi.fn().mockResolvedValue({ ok: true, message: '' }) as any;
    fakeClient.getEngineState = vi.fn().mockReturnValue(stateReady) as any;

    const fakeSession = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => new FakeChildProcess() as any,
        createClient: () => fakeClient as any,
        registerManifest: async () => '/tmp/manifest.json',
        removeManifest: async () => {},
      },
    );
    await fakeSession.spawn();
    await fakeSession.awaitReady();

    const internals = bridge as unknown as {
      activeSession: EngineSession | null;
      isPlaying: boolean;
      awaitingPlaybackTerminalState: boolean;
    };
    internals.activeSession = fakeSession;
    internals.isPlaying = true;
    internals.awaitingPlaybackTerminalState = true;

    let settled = false;
    const stopPromise = bridge.stopPlayback().then(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(fakeClient.stop).toHaveBeenCalledOnce();
      expect(fakeClient.getEngineState).toHaveBeenCalledOnce();
    });
    expect(settled).toBe(false);

    resolveState({ ok: true, state: stoppedState, message: '' });
    await stopPromise;

    expect(settled).toBe(true);
    expect(bridge.getClient()).toBeNull();
  });

  it('preserves current-client authority and isolates replaced sessions on killAndWait', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const child = new FakeChildProcess(999);
    const registry = new FakeProcessRegistry();
    const fakeClient = new FakeEngineClient();

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => fakeClient as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
      },
    );
    await session.spawn();
    await session.awaitReady();

    const internals = bridge as unknown as { activeSession: EngineSession | null };
    internals.activeSession = session;

    expect(bridge.getClient()).not.toBeNull();

    await bridge.killAndWait();

    expect(fakeClient.stopCallCount).toBe(1);
    expect(bridge.getClient()).toBeNull();
    expect(bridge.getActiveSession()).toBeNull();
    expect(session.getState()).toBe('exited');
  });

  it('sends client.stop when stopEngine is called on an active command-accepting session even if isPlaying is false', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const child = new FakeChildProcess(777);
    const registry = new FakeProcessRegistry();
    const fakeClient = new FakeEngineClient();

    const session = new EngineSession(
      { kind: 'blue-live', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => fakeClient as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
      },
    );
    await session.spawn();
    await session.awaitReady();

    const internals = bridge as unknown as {
      activeSession: EngineSession | null;
      isPlaying: boolean;
    };
    internals.activeSession = session;
    internals.isPlaying = false;

    await bridge.stopEngine();

    expect(fakeClient.stopCallCount).toBe(1);
    expect(bridge.getClient()).toBeNull();
    expect(session.getState()).toBe('exited');
  });

  it('reports a stop failure after killing the failed session', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const fakeClient = new FakeEngineClient();
    fakeClient.stopResponse = { ok: false, message: 'stop failed' };
    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => new FakeChildProcess(778) as any,
        createClient: () => fakeClient as any,
        registerManifest: async () => '/tmp/manifest.json',
        removeManifest: async () => {},
      },
    );
    await session.spawn();
    await session.awaitReady();

    const sendPlaybackStatus = vi.fn();
    const internals = bridge as unknown as {
      activeSession: EngineSession | null;
      isPlaying: boolean;
      sendPlaybackStatus: (status: string, message?: string) => void;
    };
    internals.activeSession = session;
    internals.isPlaying = true;
    internals.sendPlaybackStatus = sendPlaybackStatus;

    await bridge.stopEngine();

    expect(sendPlaybackStatus).toHaveBeenCalledWith('error', 'Engine stop failed: stop failed');
  });

  it('bounds a stuck protocol stop before hard cleanup', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new EngineBridge(windowStub(), 'blue-engine');
      const child = new FakeChildProcess(779);
      const fakeClient = new FakeEngineClient();
      const stop = vi.fn(() => new Promise<{ ok: boolean; message: string }>(() => {}));
      fakeClient.stop = stop as any;
      const session = new EngineSession(
        { kind: 'realtime', enginePath: '/bin/blue-engine' },
        {
          spawn: () => child as any,
          createClient: () => fakeClient as any,
          registerManifest: async () => '/tmp/manifest.json',
          removeManifest: async () => {},
        },
      );
      await session.spawn();
      await session.awaitReady();

      (bridge as unknown as { activeSession: EngineSession | null }).activeSession = session;

      const cleanup = bridge.killAndWait();
      await Promise.resolve();
      expect(stop).toHaveBeenCalledOnce();

      await vi.runAllTimersAsync();
      await cleanup;

      expect(child.killSignalsReceived).toContain('SIGTERM');
      expect(session.getState()).toBe('exited');
    } finally {
      vi.useRealTimers();
    }
  });

  it('finalizes natural playback completion and shuts down active session cleanly', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const completedCallback = vi.fn();
    bridge.setPlaybackCompleteCallback(completedCallback);

    const child = new FakeChildProcess(888);
    const registry = new FakeProcessRegistry();
    const fakeClient = new FakeEngineClient();

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => fakeClient as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
      },
    );
    await session.spawn();
    await session.awaitReady();

    const internals = bridge as unknown as {
      activeSession: EngineSession | null;
      isPlaying: boolean;
      awaitingPlaybackTerminalState: boolean;
      handleEngineState: (
        snapshot: EngineStateSnapshot,
        source: 'pubsub' | 'poll',
      ) => Promise<void>;
    };
    internals.activeSession = session;
    internals.isPlaying = true;
    internals.awaitingPlaybackTerminalState = true;

    await internals.handleEngineState(
      {
        state: 'stopped',
        stopReason: 'completed',
        engineCreated: true,
        running: false,
        sampleFrames: 441000,
        sampleRate: 44100,
        ksmps: 64,
        sequence: 10,
        lastError: '',
      },
      'pubsub',
    );

    expect(completedCallback).toHaveBeenCalledWith('completed');
    expect(bridge.isCurrentlyPlaying()).toBe(false);
    expect(bridge.getActiveSession()).toBeNull();
  });

  it('cleans the active bridge when the child exits without a terminal state', async () => {
    const child = new FakeChildProcess(889);
    const registry = new FakeProcessRegistry();
    const createSession = vi.fn(
      (request: EngineSessionCreationRequest) =>
        new EngineSession(request, {
          spawn: () => child as any,
          createClient: () => new FakeEngineClient() as any,
          registerManifest: (manifest) => registry.registerEngineProcess(manifest),
          removeManifest: (manifestPath) => registry.removeEngineProcessRecord(manifestPath),
        }),
    );

    const bridgeWithDependencies = new EngineBridge(
      windowStub(),
      '/bin/blue-engine',
      5555,
      5556,
      'realtime',
      undefined,
      {
        createSession,
        allocateEndpoints: async () => ({
          controlPort: 5555,
          pubPort: 5556,
          controlEndpoint: 'tcp://127.0.0.1:5555',
          pubEndpoint: 'tcp://127.0.0.1:5556',
        }),
      },
    );
    (
      bridgeWithDependencies as unknown as { ownerLivenessSupported: boolean }
    ).ownerLivenessSupported = true;

    const startInternals = bridgeWithDependencies as unknown as {
      startEngineWithTransport: (
        enginePath: string,
        transport: 'tcp' | 'ipc',
      ) => Promise<{ ok: boolean }>;
    };
    await expect(
      startInternals.startEngineWithTransport('/bin/blue-engine', 'tcp'),
    ).resolves.toMatchObject({ ok: true });

    child.emitExit(1, null);
    await vi.waitFor(() => expect(bridgeWithDependencies.getActiveSession()).toBeNull());

    expect(bridgeWithDependencies.isCurrentlyPlaying()).toBe(false);
    expect(registry.getAllRecords().size).toBe(0);
  });

  it('negotiates --owner-pid by retrying without it when a legacy engine rejects the option', async () => {
    const requests: EngineSessionCreationRequest[] = [];
    let firstSession = true;

    const createSession = (request: EngineSessionCreationRequest): EngineSession => {
      requests.push(request);
      const child = new FakeChildProcess(firstSession ? 7101 : 7102);
      const legacyEngine = firstSession;
      firstSession = false;
      return new EngineSession(request, {
        spawn: () => {
          if (legacyEngine) {
            // Legacy engine exits before readiness, rejecting the unknown flag.
            // Emitted asynchronously so the session attaches its listeners first.
            queueMicrotask(() => {
              child.emitStderr('Unknown option: --owner-pid');
              child.emitExit(64, null);
            });
          }
          return child as any;
        },
        createClient: () => new FakeEngineClient() as any,
        registerManifest: async () => `/tmp/manifest-${child.pid}.json`,
        removeManifest: async () => {},
      });
    };

    const bridge = new EngineBridge(
      windowStub(),
      '/bin/blue-engine',
      5555,
      5556,
      'realtime',
      undefined,
      {
        createSession,
        allocateEndpoints: async () => ({
          controlPort: 5555,
          pubPort: 5556,
          controlEndpoint: 'tcp://127.0.0.1:5555',
          pubEndpoint: 'tcp://127.0.0.1:5556',
        }),
      },
    );

    (bridge as unknown as { ownerLivenessSupported: boolean }).ownerLivenessSupported = true;

    const internals = bridge as unknown as {
      startEngineWithTransport: (
        enginePath: string,
        transport: 'tcp' | 'ipc',
      ) => Promise<{ ok: boolean; retryWithoutOwnerPid: boolean; errorMessage: string }>;
    };

    const first = await internals.startEngineWithTransport('/bin/blue-engine', 'tcp');
    expect(first.ok).toBe(false);
    expect(first.retryWithoutOwnerPid).toBe(true);

    const second = await internals.startEngineWithTransport('/bin/blue-engine', 'tcp');
    expect(second.ok).toBe(true);

    expect(requests).toHaveLength(2);
    expect(requests[0].ownerLivenessCapability).toBe(true);
    expect(requests[1].ownerLivenessCapability).toBe(false);
  });

  it('fails the transport attempt when isolated TCP endpoint allocation is exhausted', async () => {
    const createSession = vi.fn(
      (request: EngineSessionCreationRequest) => new EngineSession(request),
    );
    const allocateEndpoints = async () => {
      throw new Error(
        'Exhausted available TCP endpoint pairs after 20 attempts starting from port 5555',
      );
    };

    const bridge = new EngineBridge(
      windowStub(),
      '/bin/blue-engine',
      5555,
      5556,
      'realtime',
      undefined,
      { createSession, allocateEndpoints },
    );

    const internals = bridge as unknown as {
      startEngineWithTransport: (
        enginePath: string,
        transport: 'tcp' | 'ipc',
      ) => Promise<{ ok: boolean; errorMessage: string }>;
    };

    const result = await internals.startEngineWithTransport('/bin/blue-engine', 'tcp');

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('address-contention');
    expect(result.errorMessage).toContain('Exhausted available TCP endpoint pairs');
    // No session may be spawned against a fixed fallback pair another owner could hold.
    expect(createSession).not.toHaveBeenCalled();
  });

  it('records a structured lifecycle report to the output tab when startup fails', async () => {
    const outputs: string[] = [];
    const createSession = (request: EngineSessionCreationRequest): EngineSession =>
      new EngineSession(request, {
        spawn: () => new FakeChildProcess(7201) as any,
        createClient: () => {
          throw new Error('connect ECONNREFUSED');
        },
        registerManifest: async () => '/tmp/manifest-7201.json',
        removeManifest: async () => {},
      });

    const bridge = new EngineBridge(
      windowStub(),
      '/bin/blue-engine',
      5555,
      5556,
      'realtime',
      undefined,
      {
        createSession,
        allocateEndpoints: async () => ({
          controlPort: 5555,
          pubPort: 5556,
          controlEndpoint: 'tcp://127.0.0.1:5555',
          pubEndpoint: 'tcp://127.0.0.1:5556',
        }),
      },
    );
    bridge.setOutputCallback((text) => outputs.push(text));

    const internals = bridge as unknown as {
      startEngineWithTransport: (
        enginePath: string,
        transport: 'tcp' | 'ipc',
      ) => Promise<{ ok: boolean; errorMessage: string }>;
    };

    const result = await internals.startEngineWithTransport('/bin/blue-engine', 'tcp');
    expect(result.ok).toBe(false);

    const report = outputs.find((text) => text.includes('=== Blue Engine Diagnostic Report ==='));
    expect(report).toBeTruthy();
    expect(report).toContain('Owner PID:');
    expect(report).toContain('Session State:');
    expect(report).toContain('Client Connection:');
    expect(report).toContain('Startup failed:');

    expect(bridge.getLastDiagnosticReport()?.trim()).toBe(report?.trim());
  });
});
