import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineStateSnapshot } from '@blue/engine-client';
import { Parameter } from '@blue/data';
import { EngineBridge } from './engine-bridge';
import { applyRuntimeChannelValuesBatch } from './project-runtime-reconciliation';
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

  it('flushes fixed startup values before automation definitions in authored order', async () => {
    const parameters = ['first', 'automated', 'last'].map((name) => {
      const parameter = new Parameter();
      parameter.setCompilationVarName(name);
      parameter.setFixedValue(0.5);
      return parameter;
    });
    parameters[1]!.setPoints([
      { time: 0, value: 0.1 },
      { time: 4, value: 0.9 },
    ]);
    parameters[1]!.setAutomationEnabled(true);
    const inactivePoints = vi.spyOn(parameters[0]!, 'getPoints');
    const order: string[] = [];
    const client = {
      clearAutomations: async () => ({ ok: true, message: '' }),
      setChannels: async (entries: readonly { name: string; value: number }[]) => {
        order.push(...entries.map((entry) => entry.name));
        return { ok: true, message: '' };
      },
      createAutomation: async (name: string) => {
        order.push(name);
        return { ok: true, message: '' };
      },
    };
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    await (
      bridge as unknown as {
        sendAutomationDefinitions(client: unknown, parameters: Parameter[]): Promise<void>;
      }
    ).sendAutomationDefinitions(client, parameters);
    expect(order).toEqual(['first', 'automated', 'last']);
    expect(inactivePoints).not.toHaveBeenCalled();
    inactivePoints.mockRestore();
  });

  it.each([true, false])(
    'batches fixed startup channels with legacy fallback (batch succeeds: %s)',
    async (batchOk) => {
      const bridge = new EngineBridge(windowStub(), 'blue-engine');
      const parameters = Array.from({ length: 300 }, (_, i) => {
        const parameter = new Parameter();
        parameter.setCompilationVarName(`channel_${i}`);
        parameter.setFixedValue(i / 300);
        return parameter;
      });
      const client = {
        clearAutomations: vi.fn(async () => ({ ok: true, message: '' })),
        setChannels: vi.fn(async (_entries: readonly { name: string; value: number }[]) => ({
          ok: batchOk,
          message: batchOk ? '' : 'unsupported',
        })),
        createChannel: vi.fn(async () => ({ ok: true, message: '' })),
        setChannel: vi.fn(async () => ({ ok: true, message: '' })),
      };
      await (
        bridge as unknown as {
          sendAutomationDefinitions(client: unknown, parameters: Parameter[]): Promise<void>;
        }
      ).sendAutomationDefinitions(client, parameters);
      expect(client.setChannels.mock.calls.map(([entries]) => entries.length)).toEqual([256, 44]);
      expect(client.createChannel).toHaveBeenCalledTimes(batchOk ? 0 : 300);
      expect(client.setChannel).not.toHaveBeenCalled();
      expect(
        client.setChannels.mock.calls.flatMap(([entries]) => entries).map((entry) => entry.name),
      ).toEqual(parameters.map((p) => p.getCompilationVarName()));
    },
  );

  it('coalesces all interleaved startup fixed channels and batches automated definitions when supported', async () => {
    const parameters = ['fixed_0', 'auto_0', 'fixed_1', 'auto_1'].map((name) => {
      const parameter = new Parameter();
      parameter.setCompilationVarName(name);
      parameter.setFixedValue(0.5);
      return parameter;
    });
    for (const idx of [1, 3]) {
      parameters[idx]!.setPoints([
        { time: 0, value: 0.1 },
        { time: 4, value: 0.9 },
      ]);
      parameters[idx]!.setAutomationEnabled(true);
    }

    const client = {
      clearAutomations: vi.fn(async () => ({ ok: true, message: '' })),
      setChannels: vi.fn(async (_entries: readonly { name: string; value: number }[]) => ({
        ok: true,
        message: '',
      })),
      createChannel: vi.fn(async () => ({ ok: true, message: '' })),
      setChannel: vi.fn(async () => ({ ok: true, message: '' })),
      createAutomations: vi.fn(async (_entries: readonly { name: string }[]) => ({
        ok: true,
        ids: [1, 2],
      })),
      createAutomation: vi.fn(async () => ({ ok: true, message: '' })),
    };

    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    await (
      bridge as unknown as {
        sendAutomationDefinitions(client: unknown, parameters: Parameter[]): Promise<void>;
      }
    ).sendAutomationDefinitions(client, parameters);

    expect(client.setChannels).toHaveBeenCalledTimes(1);
    expect(client.setChannels.mock.calls[0]?.[0]).toEqual([
      { name: 'fixed_0', value: 0.5 },
      { name: 'fixed_1', value: 0.5 },
    ]);
    expect(client.createAutomations).toHaveBeenCalledTimes(1);
    expect(client.createAutomations.mock.calls[0]?.[0].map((entry) => entry.name)).toEqual([
      'auto_0',
      'auto_1',
    ]);
    expect(client.createAutomation).not.toHaveBeenCalled();

    // Rejecting createAutomations falls back cleanly to per-item createAutomation.
    client.createAutomations.mockResolvedValueOnce({
      ok: false,
      message: 'unsupported',
    } as never);
    await (
      bridge as unknown as {
        sendAutomationDefinitions(client: unknown, parameters: Parameter[]): Promise<void>;
      }
    ).sendAutomationDefinitions(client, parameters);
    expect(client.createAutomation).toHaveBeenCalledTimes(2);
  });

  it('batches syncAutomationParameters via updateAutomations with missing-channel fallback and disable restore', async () => {
    const p1 = new Parameter();
    p1.setCompilationVarName('auto_0');
    p1.setAutomationEnabled(true);
    p1.setPoints([
      { time: 0, value: 0.1 },
      { time: 2, value: 0.9 },
    ]);

    const p2 = new Parameter();
    p2.setCompilationVarName('auto_1');
    p2.setAutomationEnabled(true);
    p2.setPoints([
      { time: 0, value: 0.2 },
      { time: 2, value: 0.8 },
    ]);

    const pDisabled = new Parameter();
    pDisabled.setCompilationVarName('fixed_0');
    pDisabled.setFixedValue(0.42);
    pDisabled.setAutomationEnabled(false);

    const client = {
      updateAutomations: vi.fn(async (_entries: readonly { name: string }[]) => ({
        ok: true,
        message: '',
      })),
      updateAutomation: vi.fn(async () => ({ ok: true, message: '' })),
      createAutomation: vi.fn(async (_name: string) => ({ ok: true, message: '' })),
      deleteAutomation: vi.fn(async () => ({ ok: true, message: '' })),
      setChannel: vi.fn(async () => ({ ok: true, message: '' })),
      createChannel: vi.fn(async () => ({ ok: true, message: '' })),
    };

    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    (bridge as unknown as { activeSession: { getClient: () => typeof client } }).activeSession = {
      getClient: () => client,
    };

    await bridge.syncAutomationParameters([p1, p2, pDisabled]);

    expect(client.updateAutomations).toHaveBeenCalledTimes(1);
    expect(client.updateAutomations.mock.calls[0]?.[0].map((e) => e.name)).toEqual([
      'auto_0',
      'auto_1',
    ]);
    expect(client.updateAutomation).not.toHaveBeenCalled();
    expect(client.deleteAutomation).toHaveBeenCalledWith('fixed_0');
    expect(client.setChannel).toHaveBeenCalledWith('fixed_0', 0.42);

    // Fallback when one entry in updateAutomations is newly enabled (AUTOMATION_NOT_FOUND)
    client.updateAutomations.mockResolvedValueOnce({
      ok: false,
      message: '[AUTOMATION_NOT_FOUND] no automation for channel',
    });
    client.updateAutomation.mockResolvedValueOnce({ ok: true, message: '' }).mockResolvedValueOnce({
      ok: false,
      message: '[AUTOMATION_NOT_FOUND] no automation for channel',
    });
    await bridge.syncAutomationParameters([p1, p2]);
    expect(client.updateAutomation).toHaveBeenCalledTimes(2);
    expect(client.createAutomation).toHaveBeenCalledTimes(1);
    expect(client.createAutomation.mock.calls[0]?.[0]).toBe('auto_1');
  });

  it('skips stale batch fallback for channels superseded by a newer automation edit', async () => {
    vi.useFakeTimers();
    try {
      const makeParam = (varName: string, value: number) => {
        const param = new Parameter();
        param.setCompilationVarName(varName);
        param.setAutomationEnabled(true);
        param.setPoints([
          { time: 0, value },
          { time: 2, value },
        ]);
        return param;
      };

      const oldA = makeParam('auto_0', 0.1);
      const oldB = makeParam('auto_1', 0.2);
      const newerA = makeParam('auto_0', 0.9);

      let resolveBatch!: (value: { ok: boolean; message: string }) => void;
      const client = {
        updateAutomations: vi.fn(
          () =>
            new Promise<{ ok: boolean; message: string }>((resolve) => {
              resolveBatch = resolve;
            }),
        ),
        updateAutomation: vi.fn(
          async (
            _name: string,
            _curve: number,
            _enabled: boolean,
            _resolutionDecimal: string,
            _points: Array<{ time: number; value: number }>,
          ) => ({ ok: true, message: '' }),
        ),
        createAutomation: vi.fn(async () => ({ ok: true, message: '' })),
        deleteAutomation: vi.fn(async () => ({ ok: true, message: '' })),
        setChannel: vi.fn(async () => ({ ok: true, message: '' })),
        createChannel: vi.fn(async () => ({ ok: true, message: '' })),
      };

      const bridge = new EngineBridge(windowStub(), 'blue-engine');
      (bridge as unknown as { activeSession: { getClient: () => typeof client } }).activeSession = {
        getClient: () => client,
      };

      // Hold the older batch open while a newer value (0.9) arrives for auto_0.
      const batchPromise = bridge.syncAutomationParameters([oldA, oldB]);
      await bridge.syncAutomationParameter(newerA, undefined, { coalesce: false });

      resolveBatch({ ok: false, message: 'batch failed' });
      await batchPromise;

      // Only the newer edit (0.9) ran for auto_0; stale fallback (0.1) never ran for auto_0,
      // while non-superseded sibling auto_1 still fell back cleanly.
      expect(
        client.updateAutomation.mock.calls.map(([name, , , , points]) => [name, points[0]?.value]),
      ).toEqual([
        ['auto_0', 0.9],
        ['auto_1', 0.2],
      ]);

      // Also guard when the newer edit is still coalesced on a timer when the old batch fails.
      client.updateAutomation.mockClear();
      let rejectBatch!: (err: Error) => void;
      client.updateAutomations.mockImplementationOnce(
        () =>
          new Promise<{ ok: boolean; message: string }>((_resolve, reject) => {
            rejectBatch = reject;
          }),
      );
      const staleBatchPromise = bridge.syncAutomationParameters([oldA, oldB]);
      await bridge.syncAutomationParameter(newerA);
      rejectBatch(new Error('transport failed'));
      await staleBatchPromise;
      expect(
        client.updateAutomation.mock.calls.map(([name, , , , points]) => [name, points[0]?.value]),
      ).toEqual([['auto_1', 0.2]]);

      await vi.advanceTimersByTimeAsync(50);
      expect(
        client.updateAutomation.mock.calls.map(([name, , , , points]) => [name, points[0]?.value]),
      ).toEqual([
        ['auto_1', 0.2],
        ['auto_0', 0.9],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels pending coalesced sync timer when coalesce is false and deduplicates legacy startup parameters', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new EngineBridge(windowStub(), 'blue-engine');
      const client = {
        clearAutomations: vi.fn(async () => ({ ok: true, message: '' })),
        setChannels: vi.fn(async (_entries: readonly { name: string; value: number }[]) => ({
          ok: true,
          message: '',
        })),
        createChannel: vi.fn(async () => ({ ok: true, message: '' })),
        setChannel: vi.fn(async () => ({ ok: true, message: '' })),
        createAutomation: vi.fn(async () => ({ ok: true, message: '' })),
        updateAutomation: vi.fn(
          async (
            _name: string,
            _curve: number,
            _enabled: boolean,
            _resolutionDecimal: string,
            _points: Array<{ time: number; value: number }>,
          ) => ({ ok: true, message: '' }),
        ),
        deleteAutomation: vi.fn(async () => ({ ok: true, message: '' })),
      };
      (bridge as unknown as { activeSession: { getClient: () => typeof client } }).activeSession = {
        getClient: () => client,
      };

      const staleParam = new Parameter();
      staleParam.setCompilationVarName('chan_dup');
      staleParam.setFixedValue(0.25);

      const latestParam = new Parameter();
      latestParam.setCompilationVarName('chan_dup');
      latestParam.setFixedValue(0.75);

      await (
        bridge as unknown as {
          sendAutomationDefinitions(client: unknown, parameters: Parameter[]): Promise<void>;
        }
      ).sendAutomationDefinitions(client, [staleParam, latestParam]);
      expect(client.setChannels).toHaveBeenCalledTimes(1);
      expect(client.setChannels.mock.calls[0]?.[0]).toEqual([{ name: 'chan_dup', value: 0.75 }]);

      const autoFirst = new Parameter();
      autoFirst.setCompilationVarName('auto_live');
      autoFirst.setAutomationEnabled(true);
      autoFirst.setPoints([
        { time: 0, value: 0.1 },
        { time: 2, value: 0.2 },
      ]);

      const autoQueuedStale = new Parameter();
      autoQueuedStale.setCompilationVarName('auto_live');
      autoQueuedStale.setAutomationEnabled(true);
      autoQueuedStale.setPoints([
        { time: 0, value: 0.3 },
        { time: 2, value: 0.4 },
      ]);

      const autoImmediate = new Parameter();
      autoImmediate.setCompilationVarName('auto_live');
      autoImmediate.setAutomationEnabled(true);
      autoImmediate.setPoints([
        { time: 0, value: 0.8 },
        { time: 2, value: 0.9 },
      ]);

      await bridge.syncAutomationParameter(autoFirst);
      await bridge.syncAutomationParameter(autoQueuedStale);
      await bridge.syncAutomationParameter(autoImmediate, undefined, { coalesce: false });
      await vi.advanceTimersByTimeAsync(100);

      expect(client.updateAutomation).toHaveBeenCalledTimes(2);
      expect(client.updateAutomation.mock.calls[1]?.[4]).toEqual([
        { time: 0, value: 0.8 },
        { time: 2, value: 0.9 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps one health poll outstanding and resumes after failure', async () => {
    vi.useFakeTimers();
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const internals = bridge as unknown as {
      activeSession: { getClient(): typeof client };
      playbackSessionId: number;
      awaitingPlaybackTerminalState: boolean;
      startStatePolling(id: number): void;
      clearStatePolling(): void;
    };
    let reject!: (error: Error) => void;
    const client = {
      getEngineState: vi.fn(() => new Promise<never>((_resolve, fail) => (reject = fail))),
    };
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      internals.activeSession = { getClient: () => client };
      internals.playbackSessionId = 1;
      internals.awaitingPlaybackTerminalState = true;
      internals.startStatePolling(1);
      await vi.advanceTimersByTimeAsync(2000);
      expect(client.getEngineState).toHaveBeenCalledOnce();
      reject(new Error('slow transport failed'));
      await vi.advanceTimersByTimeAsync(250);
      expect(client.getEngineState).toHaveBeenCalledTimes(2);
      expect(warning).toHaveBeenCalledOnce();
      internals.clearStatePolling();
      await vi.advanceTimersByTimeAsync(1000);
      expect(client.getEngineState).toHaveBeenCalledTimes(2);
    } finally {
      internals.clearStatePolling();
      warning.mockRestore();
      vi.useRealTimers();
    }
  });

  it.each(['success', 'failure'] as const)(
    'ignores an old poll %s without releasing the replacement poll',
    async (outcome) => {
      vi.useFakeTimers();
      const bridge = new EngineBridge(windowStub(), 'blue-engine');
      let resolve!: (value: unknown) => void;
      let reject!: (error: Error) => void;
      const oldClient = {
        getEngineState: vi.fn(
          () =>
            new Promise((ok, fail) => {
              resolve = ok;
              reject = fail;
            }),
        ),
      };
      const nextClient = { getEngineState: vi.fn(() => new Promise(() => {})) };
      const internals = bridge as unknown as {
        activeSession: { getClient(): unknown };
        playbackSessionId: number;
        awaitingPlaybackTerminalState: boolean;
        startStatePolling(id: number): void;
        clearStatePolling(): void;
        handleEngineState: ReturnType<typeof vi.fn>;
      };
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      internals.handleEngineState = vi.fn();
      try {
        internals.activeSession = { getClient: () => oldClient };
        internals.playbackSessionId = 1;
        internals.awaitingPlaybackTerminalState = true;
        internals.startStatePolling(1);
        await vi.advanceTimersByTimeAsync(250);
        expect(oldClient.getEngineState).toHaveBeenCalledOnce();
        internals.clearStatePolling();
        internals.activeSession = { getClient: () => nextClient };
        internals.playbackSessionId = 2;
        internals.startStatePolling(2);
        await vi.advanceTimersByTimeAsync(250);
        expect(nextClient.getEngineState).toHaveBeenCalledOnce();
        if (outcome === 'success') resolve({ ok: true, state: { state: 'stopped' } });
        else reject(new Error('old transport failed'));
        await vi.advanceTimersByTimeAsync(1000);
        expect(internals.handleEngineState).not.toHaveBeenCalled();
        expect(warning).not.toHaveBeenCalled();
        expect(nextClient.getEngineState).toHaveBeenCalledOnce();
      } finally {
        internals.clearStatePolling();
        warning.mockRestore();
        vi.useRealTimers();
      }
    },
  );

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

  it('reports a native channel rejection while applying its valid batch sibling', async () => {
    const bridge = new EngineBridge(windowStub(), 'blue-engine');
    const client = {
      setChannel: vi.fn(async (name: string) =>
        name === 'missing'
          ? { ok: false, message: 'Channel not found: missing' }
          : { ok: true, message: '' },
      ),
    };
    (bridge as unknown as { activeSession: { getClient(): typeof client } }).activeSession = {
      getClient: () => client,
    };

    const result = await applyRuntimeChannelValuesBatch(
      ['missing', 'valid'].map((channel) => ({
        kind: 'channel-value',
        ownerKey: channel,
        parameterId: channel,
        channel,
        value: 0.5,
      })),
      {
        setChannels: async () => ({ ok: false, message: 'Channel not found: missing' }),
        setChannel: (name, value) => bridge.setChannel(name, value),
      },
    );

    expect(client.setChannel.mock.calls.map(([name]) => name)).toEqual(['missing', 'valid']);
    expect(result).toEqual({ status: 'rejected', message: 'Channel not found: missing' });
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

  it('probes mixer-metering-v1 capability and falls back gracefully when unsupported', async () => {
    // 1. Engine without mixer-metering-v1 feature
    const runtimeWithoutMetering = {
      probe: vi.fn(async () => ({
        ok: true,
        report: {
          engine: {
            features: ['realtime-csound-v1'],
          },
        },
      })),
    } as unknown as EngineRuntimeService;

    const bridge1 = new EngineBridge(
      windowStub(),
      undefined,
      undefined,
      undefined,
      'realtime',
      runtimeWithoutMetering,
    );

    const supported1 = await bridge1.probeMixerMeteringSupport();
    expect(supported1).toBe(false);
    expect(bridge1.isMixerMeteringSupported()).toBe(false);

    // 2. Engine with mixer-metering-v1 feature
    const runtimeWithMetering = {
      probe: vi.fn(async () => ({
        ok: true,
        report: {
          engine: {
            features: ['realtime-csound-v1', 'mixer-metering-v1'],
          },
        },
      })),
    } as unknown as EngineRuntimeService;

    const bridge2 = new EngineBridge(
      windowStub(),
      undefined,
      undefined,
      undefined,
      'realtime',
      runtimeWithMetering,
    );

    const supported2 = await bridge2.probeMixerMeteringSupport();
    expect(supported2).toBe(true);
    expect(bridge2.isMixerMeteringSupported()).toBe(true);
  });
});
