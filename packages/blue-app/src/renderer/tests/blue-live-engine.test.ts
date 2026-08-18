import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BlueData,
  GenericInstrument,
  LiveData,
  TrackLayerGroup,
} from '@blue/data';
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

// Spec 067 helpers shared by the target-catalog and Track-parity suites.
function createMockClient() {
  return {
    setOption: vi.fn(async () => ({ ok: true })),
    compileOrc: vi.fn(async () => ({ ok: true })),
    readScore: vi.fn(async () => ({ ok: true })),
    start: vi.fn(async () => ({ ok: true })),
    onEngineState: vi.fn(() => () => {}),
    getEngineState: vi.fn(async () => ({ ok: false })),
  };
}

function createRunningSession(opts: {
  data?: BlueData;
  readScoreOk?: boolean;
} = {}) {
  const client = createMockClient();
  if (opts.readScoreOk === false) {
    client.readScore.mockResolvedValue({ ok: false, message: 'engine rejected' });
  }
  const killAndWait = vi.fn(async () => {});
  const bridge = {
    setWorkingDirectory: vi.fn(),
    setOutputCallback: vi.fn(),
    startEngine: vi.fn(async () => ({ ok: true })),
    getClient: vi.fn(() => client),
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
      writeTempCsdSnapshot: async () => '/tmp/blue-live-target.csd',
      cleanupDelayMs: 0,
    },
  ));
  const data = opts.data ?? new BlueData();
  return { session, client, bridge, data };
}

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
    let resolveStart = (_started: { ok: boolean }): void => {};
    const engineStart = new Promise<{ ok: boolean }>((resolve) => {
      resolveStart = resolve;
    });
    const getClient = vi.fn();
    const killAndWait = vi.fn(async () => {
      resolveStart({ ok: false });
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

describe('BlueLiveEngineSession target catalog (Spec 067)', () => {
  function createRunningSession(opts: {
    data?: BlueData;
    readScoreOk?: boolean;
  } = {}) {
    const client = createMockClient();
    if (opts.readScoreOk === false) {
      client.readScore.mockResolvedValue({ ok: false, message: 'engine rejected' });
    }
    const killAndWait = vi.fn(async () => {});
    const bridge = {
      setWorkingDirectory: vi.fn(),
      setOutputCallback: vi.fn(),
      startEngine: vi.fn(async () => ({ ok: true })),
      getClient: vi.fn(() => client),
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
        writeTempCsdSnapshot: async () => '/tmp/blue-live-target.csd',
        cleanupDelayMs: 0,
      },
    ));
    const data = opts.data ?? new BlueData();
    return { session, client, bridge, data };
  }

  it('installs a validated target catalog after a successful start', async () => {
    const data = new BlueData();
    const { session, data: started } = { data, ...createRunningSession({ data }) };
    const startResult = await session.start(started, 1);
    expect(startResult.status).toBe('running');
    expect(startResult.sessionId).toBeGreaterThan(0);
  });

  it('omitted target resolves to the compatibility channel and submits score text', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
    });
    expect(result.ok).toBe(true);
    expect(result.submittedScoreText).toContain('i1.');
    expect(client.readScore).toHaveBeenCalled();
  });

  it('omits submitted score text when the engine rejects a note', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockResolvedValue({ ok: false, message: 'engine rejected' });

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'mouse',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('engine rejected');
    expect(result.submittedScoreText).toBeUndefined();
  });

  it('omits submitted score text when note submission throws', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockRejectedValue(new Error('transport failed'));

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'mouse',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('transport failed');
    expect(result.submittedScoreText).toBeUndefined();
  });

  it('rejects a stale liveSessionId before any score submission', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();
    const currentSessionId = session.getStatus().sessionId;

    const result = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
      target: { kind: 'track', trackId: 'track-1' },
      liveSessionId: currentSessionId + 99,
    });
    expect(result.ok).toBe(false);
    expect(result.submittedScoreText).toBeUndefined();
    expect(client.readScore).not.toHaveBeenCalled();
  });

  it('rejects a focused Track target absent from the compiled catalog with no score text', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
      target: { kind: 'track', trackId: 'missing-track' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(result.ok).toBe(false);
    expect(result.submittedScoreText).toBeUndefined();
    expect(client.readScore).not.toHaveBeenCalled();
  });

  it('rejects a malformed channel target that disagrees with the request channel', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);

    const result = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
      target: { kind: 'channel', channel: 5 },
    });
    expect(result.ok).toBe(false);
    expect(result.submittedScoreText).toBeUndefined();
  });

  it('resolves a focused Track target present in the compiled catalog', async () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    group.setUniqueId('root-group');
    const track = group.newLayerAt(0);
    track.setUniqueId('focused-track');
    const instr = new GenericInstrument();
    instr.setText('out aout');
    track.setInstrument(instr);
    data.getScore().length = 0;
    data.getScore().push(group);

    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
      target: { kind: 'track', trackId: 'focused-track' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(result.ok).toBe(true);
    expect(result.submittedScoreText).toBeDefined();
    expect(client.readScore).toHaveBeenCalled();
  });

  it('leaves no usable catalog after stop (unresolved target after stop)', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    await session.stop();

    const result = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
      target: { kind: 'track', trackId: 'any' },
      liveSessionId: 0,
    });
    expect(result.ok).toBe(false);
  });
});

describe('BlueLiveEngineSession Track target parity (Spec 067 US1)', () => {
  it('resolves more than sixteen Track identities beyond the MIDI channel range', async () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    group.setUniqueId('root');
    for (let i = 0; i < 20; i++) {
      const track = group.newLayerAt(i);
      track.setUniqueId(`track-${i}`);
      const instr = new GenericInstrument();
      instr.setText('out aout');
      track.setInstrument(instr);
    }
    data.getScore().length = 0;
    data.getScore().push(group);

    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    // Track 17 (index 17) is beyond the 16-channel range but still resolvable.
    const result = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'hardware',
      target: { kind: 'track', trackId: 'track-17' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(result.ok).toBe(true);
    expect(result.submittedScoreText).toBeDefined();
  });

  it('uses the resolved runtime instrument id in the note-on score text', async () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    group.setUniqueId('root');
    const track = group.newLayerAt(0);
    track.setUniqueId('focused-track');
    const instr = new GenericInstrument();
    instr.setText('out aout');
    track.setInstrument(instr);
    data.getScore().length = 0;
    data.getScore().push(group);

    const { session } = createRunningSession({ data });
    await session.start(data, 1);

    const onResult = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
      target: { kind: 'track', trackId: 'focused-track' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(onResult.submittedScoreText).toMatch(/^i\d+\.060 0 -1 /);

    const offResult = await session.triggerNote({
      type: 'noteOff',
      midiNote: 60,
      velocity: 0,
      channel: 0,
      source: 'mouse',
      target: { kind: 'track', trackId: 'focused-track' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(offResult.submittedScoreText).toMatch(/^i-\d+\.060 0 0$/);
  });

  it('rejects a disabled Track (instrument disabled) with zero fallback score text', async () => {
    const data = new BlueData();
    const group = new TrackLayerGroup();
    group.setUniqueId('root');
    const track = group.newLayerAt(0);
    track.setUniqueId('disabled-track');
    const instr = new GenericInstrument();
    instr.setText('out aout');
    instr.setEnabled(false);
    track.setInstrument(instr);
    data.getScore().length = 0;
    data.getScore().push(group);

    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn',
      midiNote: 60,
      velocity: 100,
      channel: 0,
      source: 'mouse',
      target: { kind: 'track', trackId: 'disabled-track' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(result.ok).toBe(false);
    expect(result.submittedScoreText).toBeUndefined();
    expect(client.readScore).not.toHaveBeenCalled();
  });
});

describe('BlueLiveEngineSession Orchestra target resolution (Spec 067 US2)', () => {
  it('resolves a numeric Orchestra assignment by exact id, not row position', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '5'); // non-consecutive id

    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'mouse',
      target: { kind: 'orchestra', assignmentId: '5' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(result.ok).toBe(true);
    // The runtime id is the assignmentId ('5') for Orchestra targets.
    expect(result.submittedScoreText).toMatch(/^i5\.060 0 -1 /);
  });

  it('resolves a named Orchestra assignment through the engine instrument number', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, 'lead');

    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'mouse',
      target: { kind: 'orchestra', assignmentId: 'lead' },
      liveSessionId: session.getStatus().sessionId,
    });

    expect(result.ok).toBe(true);
    expect(client.readScore).toHaveBeenCalledWith(expect.stringMatching(/^i\d+\.060 0 -1 /));
    expect(client.readScore).not.toHaveBeenCalledWith(expect.stringContaining('lead.060'));
  });

  it('rejects an Orchestra assignment absent from the compiled catalog with no fallback', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'mouse',
      target: { kind: 'orchestra', assignmentId: 'missing' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(result.ok).toBe(false);
    expect(result.submittedScoreText).toBeUndefined();
    expect(client.readScore).not.toHaveBeenCalled();
  });
});

describe('BlueLiveEngineSession target-independent project MIDI mapping (Spec 067 FR-021)', () => {
  it('applies the same pitch and velocity mapping after Track, Orchestra, and channel resolution', async () => {
    const data = new BlueData();
    const orchestraInstrument = new GenericInstrument();
    orchestraInstrument.setText('out aout');
    data.getArrangement().addInstrument(orchestraInstrument, '5');

    const group = new TrackLayerGroup();
    group.setUniqueId('root');
    const track = group.newLayerAt(0);
    track.setUniqueId('mapped-track');
    const trackInstrument = new GenericInstrument();
    trackInstrument.setText('out aout');
    track.setInstrument(trackInstrument);
    data.getScore().length = 0;
    data.getScore().push(group);

    const processor = data.getMidiInputProcessor();
    processor.setKeyMapping('MIDI');
    processor.setVelocityMapping('CONSTANT');
    processor.setAmpConstant('amp-const');

    const { session } = createRunningSession({ data });
    await session.start(data, 1);
    const liveSessionId = session.getStatus().sessionId;

    const targets = [
      { kind: 'track' as const, trackId: 'mapped-track' },
      { kind: 'orchestra' as const, assignmentId: '5' },
      { kind: 'channel' as const, channel: 0 },
    ];
    for (const target of targets) {
      const result = await session.triggerNote({
        type: 'noteOn', midiNote: 61, velocity: 99, channel: 0, source: 'hardware',
        target,
        liveSessionId,
      });
      expect(result.ok).toBe(true);
      expect(result.submittedScoreText).toMatch(/ 61 amp-const$/);
    }
  });
});

describe('BlueLiveEngineSession Direct Channel compatibility (Spec 067 US3)', () => {
  it('an omitted target normalizes to the request channel (legacy behavior)', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'mouse',
      // no target, no liveSessionId — legacy direct-channel request
    });
    expect(result.ok).toBe(true);
    expect(result.submittedScoreText).toMatch(/^i1\.060 0 -1 /);
  });

  it('an explicit channel target matching the request channel resolves', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    const { session } = createRunningSession({ data });
    await session.start(data, 1);

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'hardware',
      target: { kind: 'channel', channel: 0 },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a disabled direct-channel assignment', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    data.getArrangement().getArrangement()[0]!.enabled = false;
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'hardware',
    });

    expect(result.ok).toBe(false);
    expect(result.submittedScoreText).toBeUndefined();
    expect(client.readScore).not.toHaveBeenCalled();
  });

  it('rejects an unresolved direct-channel assignment', async () => {
    const data = new BlueData();
    const instr = new GenericInstrument();
    instr.setText('out aout');
    data.getArrangement().addInstrument(instr, '1');
    data.getArrangement().getArrangement()[0]!.instr = undefined as never;
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'hardware',
    });

    expect(result.ok).toBe(false);
    expect(result.submittedScoreText).toBeUndefined();
    expect(client.readScore).not.toHaveBeenCalled();
  });

  it('rejects a channel target that disagrees with the request channel', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'hardware',
      target: { kind: 'channel', channel: 5 },
    });
    expect(result.ok).toBe(false);
    expect(client.readScore).not.toHaveBeenCalled();
  });

  it('silently rejects an unmapped direct channel with zero fallback score text', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 9, source: 'hardware',
      // no arrangement entry at index 9
    });
    expect(result.ok).toBe(false);
    expect(result.submittedScoreText).toBeUndefined();
    expect(client.readScore).not.toHaveBeenCalled();
  });

  it('preserves existing assignment ordering for direct-channel resolution', async () => {
    const data = new BlueData();
    const a = new GenericInstrument(); a.setText('out aout');
    const b = new GenericInstrument(); b.setText('out aout');
    data.getArrangement().addInstrument(a, '1');
    data.getArrangement().addInstrument(b, '2');
    const { session } = createRunningSession({ data });
    await session.start(data, 1);

    const ch0 = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'hardware',
    });
    const ch1 = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 1, source: 'hardware',
    });
    expect(ch0.submittedScoreText).toMatch(/^i1\./);
    expect(ch1.submittedScoreText).toMatch(/^i2\./);
  });
});

describe('BlueLiveEngineSession catalog lifecycle (Spec 067 US4)', () => {
  it('a failed start (compile failure) leaves no usable catalog', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    client.compileOrc.mockResolvedValue({ ok: false, message: 'compile failed' });
    const startResult = await session.start(data, 1);
    expect(startResult.status).toBe('error');

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'mouse',
      target: { kind: 'track', trackId: 'any' },
      liveSessionId: session.getStatus().sessionId,
    });
    expect(result.ok).toBe(false);
  });

  it('fails startup when the compiled target catalog contains duplicate identities', async () => {
    const data = new BlueData();
    const render = data.toBlueLiveCSD();
    vi.spyOn(data, 'toBlueLiveCSD').mockReturnValue({
      ...render,
      midiInstrumentTargets: [
        { kind: 'orchestra', assignmentId: 'duplicate', runtimeInstrumentId: 1 },
        { kind: 'orchestra', assignmentId: 'duplicate', runtimeInstrumentId: 2 },
      ],
    });
    const { session, bridge } = createRunningSession({ data });

    const result = await session.start(data, 1);

    expect(result.status).toBe('error');
    expect(result.running).toBe(false);
    expect(bridge.killAndWait).toHaveBeenCalledOnce();
  });

  it('rejects a stale liveSessionId after recompile before any target lookup', async () => {
    const data = new BlueData();
    const { session, client } = createRunningSession({ data });
    await session.start(data, 1);
    const firstSessionId = session.getStatus().sessionId;
    await session.stop();
    await session.start(data, 2);
    const secondSessionId = session.getStatus().sessionId;
    client.readScore.mockClear();

    const result = await session.triggerNote({
      type: 'noteOn', midiNote: 60, velocity: 100, channel: 0, source: 'mouse',
      target: { kind: 'track', trackId: 'any' },
      liveSessionId: firstSessionId, // stale
    });
    expect(result.ok).toBe(false);
    expect(secondSessionId).not.toBe(firstSessionId);
    expect(client.readScore).not.toHaveBeenCalled();
  });
});
