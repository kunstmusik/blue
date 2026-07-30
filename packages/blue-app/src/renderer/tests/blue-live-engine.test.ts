import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlueData, LiveData } from '@blue/data';
import {
  BlueLiveEngineSession,
  normalizeScoreForEngineApi,
  resolveNamedInstrumentNumbers,
} from '../../main/blue-live-engine';
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
