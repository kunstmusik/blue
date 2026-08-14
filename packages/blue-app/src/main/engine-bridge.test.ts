import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineStateSnapshot } from '@blue/engine-client';
import { EngineBridge } from './engine-bridge';
import type { EngineRuntimeService } from './engine-runtime';

const { showErrorBox } = vi.hoisted(() => ({ showErrorBox: vi.fn() }));

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showErrorBox },
}));

function windowStub() {
  return { webContents: { send: vi.fn() } } as never;
}

describe('EngineBridge runtime selection', () => {
  beforeEach(() => showErrorBox.mockClear());

  it('does not search PATH for a legacy relative engine name', () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    expect((bridge as unknown as { findEngine(): string | null }).findEngine()).toBeNull();
  });

  it('accepts only an existing absolute legacy constructor path', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'blue-bridge-engine-'));
    const executablePath = path.join(root, 'blue-engine');
    writeFileSync(executablePath, 'fixture');
    const bridge = new EngineBridge(windowStub(), executablePath);
    expect((bridge as unknown as { findEngine(): string | null }).findEngine())
      .toBe(executablePath);
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
    const bridge = new EngineBridge(windowStub(), undefined, undefined, undefined, 'realtime', runtime);

    await expect(bridge.startEngine()).resolves.toBe(false);
    expect(runtime.probe).toHaveBeenCalledOnce();
    expect(showErrorBox).toHaveBeenCalledWith(
      'Csound Is Not Available',
      'Csound 7 was not found',
    );
  });

  it('notifies the configured warning callback for terminal Csound errors', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const warning = vi.fn();
    bridge.setPlaybackErrorWarningCallback(warning);

    const internals = bridge as unknown as {
      awaitingPlaybackTerminalState: boolean;
      finalizePlaybackFromEngine: (snapshot: EngineStateSnapshot, source: 'pubsub' | 'poll') => Promise<void>;
    };
    internals.awaitingPlaybackTerminalState = true;

    await internals.finalizePlaybackFromEngine({
      state: 'stopped',
      stopReason: 'error',
      engineCreated: true,
      running: false,
      sampleFrames: 0,
      sampleRate: 44100,
      ksmps: 64,
      sequence: 1,
      lastError: 'invalid orchestra',
    }, 'pubsub');

    expect(warning).toHaveBeenCalledWith('Engine error: invalid orchestra');
  });

  it('notifies the configured warning callback when orchestra compilation fails', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const warning = vi.fn();
    const compileOrc = vi.fn(async () => ({ ok: false, message: 'Failed to compile orchestra' }));
    bridge.setPlaybackErrorWarningCallback(warning);

    const internals = bridge as unknown as {
      client: { compileOrc: typeof compileOrc };
      startEngine: () => Promise<boolean>;
    };
    internals.startEngine = vi.fn(async () => true);
    internals.client = { compileOrc };

    await expect(bridge.playCSD(
      '<CsoundSynthesizer><CsInstruments>asdf</CsInstruments><CsScore>e</CsScore></CsoundSynthesizer>',
    )).resolves.toBe(false);

    expect(compileOrc).toHaveBeenCalledWith('asdf');
    expect(warning).toHaveBeenCalledWith('Orchestra compile failed: Failed to compile orchestra');
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
    let resolveState!: (value: { ok: boolean; state: EngineStateSnapshot; message: string }) => void;
    const stateReady = new Promise<{ ok: boolean; state: EngineStateSnapshot; message: string }>((resolve) => {
      resolveState = resolve;
    });
    const client = {
      stop: vi.fn().mockResolvedValue({ ok: true, message: '' }),
      getEngineState: vi.fn().mockReturnValue(stateReady),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const internals = bridge as unknown as {
      client: typeof client;
      isPlaying: boolean;
      awaitingPlaybackTerminalState: boolean;
    };
    internals.client = client;
    internals.isPlaying = true;
    internals.awaitingPlaybackTerminalState = true;

    let settled = false;
    const stopPromise = bridge.stopPlayback().then(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(client.stop).toHaveBeenCalledOnce();
    expect(client.getEngineState).toHaveBeenCalledOnce();
    expect(settled).toBe(false);

    resolveState({ ok: true, state: stoppedState, message: '' });
    await stopPromise;

    expect(settled).toBe(true);
  });
});
