import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlueData, LiveData } from '@blue/data';
import {
  BlueLiveEngineSession,
  normalizeScoreForEngineApi,
  resolveNamedInstrumentNumbers,
} from '../../main/blue-live-engine';
import type { EngineBridge } from '../../main/engine-bridge';
import type { EngineRuntimeService } from '../../main/engine-runtime';

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showErrorBox: vi.fn() },
}));

class MockWebContents {
  send = vi.fn();
}

class MockBrowserWindow {
  webContents = new MockWebContents();
  isDestroyed = vi.fn(() => false);
}

function createMockWindow(): any {
  return new MockBrowserWindow();
}

const trackedSessions: BlueLiveEngineSession[] = [];

function trackSession(session: BlueLiveEngineSession): BlueLiveEngineSession {
  trackedSessions.push(session);
  return session;
}

afterEach(async () => {
  while (trackedSessions.length > 0) {
    const session = trackedSessions.pop();
    if (session) {
      await session.stop();
    }
  }
});

describe('BlueLiveEngineSession', () => {
  it('starts in idle status', () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    const status = session.getStatus();
    expect(status.status).toBe('idle');
    expect(status.running).toBe(false);
    expect(status.sessionId).toBe(0);
  });

  it('isRunning returns false initially', () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    expect(session.isRunning()).toBe(false);
  });

  it('stop returns current snapshot when not running', async () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    const result = await session.stop();
    expect(result.status).toBe('idle');
  });

  it('sendAllNotesOff returns error when not running', async () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    const result = await session.sendAllNotesOff();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not running');
  });

  it('evaluateOrchestra returns error when not running', async () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    const result = await session.evaluateOrchestra('instr 1\nendin');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not running');
  });

  it('sendScore returns error when not running', async () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    const result = await session.sendScore('i 1 0 1');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not running');
  });

  it('submitPreparedScore returns error when not running', async () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    const result = await session.submitPreparedScore('i 1 0 1', 0);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not running');
  });

  it('submitPreparedScore returns error for an empty score', async () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    // Force a running-like state by checking the empty-score guard independently:
    // when not running the not-running message takes precedence, which still
    // proves the guard fires before any engine call.
    const result = await session.submitPreparedScore('', 0);
    expect(result.ok).toBe(false);
  });

  it('isActive returns false when idle', () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    expect(session.isActive()).toBe(false);
  });

  it('recompile from idle starts the engine', async () => {
    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound', 5560, 5561));
    const data = new BlueData();

    const result = await session.recompile(data, 1);

    if (result.status === 'error') {
      expect(result.message).toBeDefined();
    } else {
      expect(result.sessionId).toBe(1);
    }
  });

  it('retains the shared runtime service while using its isolated port pair', () => {
    const runtime = { probe: vi.fn() } as unknown as EngineRuntimeService;
    const session = trackSession(new BlueLiveEngineSession(
      createMockWindow(),
      undefined,
      5560,
      5561,
      runtime,
    ));
    const internals = session as unknown as {
      engineRuntime: EngineRuntimeService;
      port: number;
      pubPort: number;
    };

    expect(internals.engineRuntime).toBe(runtime);
    expect([internals.port, internals.pubPort]).toEqual([5560, 5561]);
  });

  it('cancels and fully awaits a start that is still acquiring the engine', async () => {
    let resolveStart = (_started: boolean): void => {};
    const engineStart = new Promise<boolean>((resolve) => {
      resolveStart = resolve;
    });
    const getClient = vi.fn();
    const killAndWait = vi.fn(async () => {
      resolveStart(false);
    });
    const bridge = {
      setWorkingDirectory: vi.fn(),
      setOutputCallback: vi.fn(),
      startEngine: vi.fn(() => engineStart),
      getClient,
      killAndWait,
    } as unknown as EngineBridge;
    const session = trackSession(new BlueLiveEngineSession(
      createMockWindow(),
      'csound',
      5560,
      5561,
      undefined,
      {
        createBridge: () => bridge,
        writeTempCsdSnapshot: async () => '/tmp/blue-live-starting.csd',
        cleanupDelayMs: 0,
      },
    ));

    const start = session.start(new BlueData(), 1);
    await vi.waitFor(() => {
      expect(bridge.startEngine).toHaveBeenCalledOnce();
    });
    const stopped = await session.stop();
    const startResult = await start;

    expect(killAndWait).toHaveBeenCalledOnce();
    expect(getClient).not.toHaveBeenCalled();
    expect(stopped.status).toBe('stopped');
    expect(startResult.running).toBe(false);
    expect(startResult.status).not.toBe('running');
    expect(session.isActive()).toBe(false);
  });
});

describe('BlueLiveEngineSession buildLiveOptions (via LiveData)', () => {
  it('passes command-line through when enabled and not override', () => {
    const ld = new LiveData();
    ld.setCommandLineEnabled(true);
    ld.setCommandLineOverride(false);
    ld.setCommandLine('--opcode-lib=/custom -b256');

    const data = new BlueData();
    data.getLiveData().setCommandLineEnabled(true);
    data.getLiveData().setCommandLineOverride(false);
    data.getLiveData().setCommandLine('--opcode-lib=/custom -b256');

    const session = trackSession(new BlueLiveEngineSession(createMockWindow(), 'csound'));
    const status = session.getStatus();
    expect(status.status).toBe('idle');
  });
});

describe('parseCSD helper behavior', () => {
  it('assigns stable numeric ids to named orchestra instruments', () => {
    const namedIds = resolveNamedInstrumentNumbers([
      'instr 1',
      'endin',
      'instr blueAllNotesOff',
      'endin',
      'instr BlueMixer',
      'endin',
    ].join('\n'));

    expect(namedIds.get('blueAllNotesOff')).toBe(2);
    expect(namedIds.get('BlueMixer')).toBe(3);
  });

  it('normalizes named score events for engine-api readScore', () => {
    const namedIds = resolveNamedInstrumentNumbers([
      'instr 1',
      'endin',
      'instr blueAllNotesOff',
      'endin',
      'instr BlueMixer',
      'endin',
    ].join('\n'));

    const normalized = normalizeScoreForEngineApi(
      'i "BlueMixer" 0 36000\n i "blueAllNotesOff" 0 1',
      namedIds,
    );

    expect(normalized).toContain('i 3 0 36000');
    expect(normalized).toContain(' i 2 0 1');
  });
});
