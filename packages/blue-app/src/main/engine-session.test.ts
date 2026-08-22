import { describe, expect, it, vi } from 'vitest';
import {
  EngineSession,
  classifyProcessError,
  formatLifecycleDiagnosticReport,
  isSessionActive,
  validateSessionAuthority,
} from './engine-session';
import {
  FakeChildProcess,
  FakeEngineClient,
  ControllableClock,
  FakeProcessRegistry,
} from './engine-session.test-support';

describe('EngineSession lifecycle and ordering', () => {
  it('fences out older sessions so delayed exit does not mutate active replacement', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();

    const child1 = new FakeChildProcess(101);
    child1.onKillBehavior = () => {}; // child1 ignores initial kill and stays running

    const child2 = new FakeChildProcess(102);

    const session1 = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine', generation: 1 },
      {
        spawn: () => child1 as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
      },
    );

    await session1.spawn();
    await session1.awaitReady();

    expect(session1.getState()).toBe('ready');

    // Replace session1 with session2
    let activeSession = session1;
    expect(isSessionActive(session1, activeSession)).toBe(true);

    const session2 = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine', generation: 2 },
      {
        spawn: () => child2 as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
      },
    );

    await session2.spawn();
    await session2.awaitReady();
    activeSession = session2;

    expect(isSessionActive(session1, activeSession)).toBe(false);
    expect(isSessionActive(session2, activeSession)).toBe(true);
    expect(validateSessionAuthority(session1, activeSession)).toBe(false);
    expect(validateSessionAuthority(session2, activeSession)).toBe(true);

    // Old child1 emits output and errors after replacement
    child1.emitStderr('old stderr after replacement');
    expect(session2.getStderr()).toBe('');

    // Old child1 exits late
    child1.emitExit(0, 'SIGTERM');

    // session2 must remain in ready/active state and not be affected by session1 exit
    expect(session2.getState()).toBe('ready');
    expect(isSessionActive(session2, activeSession)).toBe(true);
  });

  it('handles exit before manifest registration without leaking records', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();

    let resolveRegistration!: (val: string) => void;
    const delayedRegistration = new Promise<string>((resolve) => {
      resolveRegistration = resolve;
    });

    const child = new FakeChildProcess(201);

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: async (m) => {
          const path = await registry.registerEngineProcess(m);
          await delayedRegistration;
          return path;
        },
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
      },
    );

    await session.spawn();

    // Child exits immediately before registration finishes
    child.emitExit(1, null);

    const shutdownPromise = session.shutdown('immediate-exit');

    // Now resolve registration
    resolveRegistration('/tmp/fake-manifest-201.json');

    const result = await shutdownPromise;
    expect(result.status).toBe('exited');
    expect(result.exitCode).toBe(1);

    // Manifest should have been cleaned up
    expect(registry.getAllRecords().size).toBe(0);
  });

  it('handles disconnect errors gracefully during shutdown', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const child = new FakeChildProcess(301);
    const client = new FakeEngineClient();
    client.disconnect = async () => {
      throw new Error('ZMQ socket busy or destroyed');
    };

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => client as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
      },
    );

    await session.spawn();
    await session.awaitReady();

    const shutdownResult = await session.shutdown('normal');
    expect(shutdownResult.status).toBe('exited');
  });

  it('awaits socket teardown before completing app shutdown', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const child = new FakeChildProcess(302);
    const client = new FakeEngineClient();
    let releaseDisconnect!: () => void;
    const disconnect = vi.fn(() => new Promise<void>((resolve) => {
      releaseDisconnect = resolve;
    }));
    client.disconnect = disconnect;

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => client as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
      },
    );

    await session.spawn();
    await session.awaitReady();

    let settled = false;
    const shutdownPromise = session.shutdown('app-quit').then((result) => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    expect(disconnect).toHaveBeenCalledWith(false);
    expect(settled).toBe(false);

    releaseDisconnect();

    await expect(shutdownPromise).resolves.toMatchObject({ status: 'exited' });
    expect(settled).toBe(true);
  });

  it('performs idempotent shutdown with single signal sequence', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const child = new FakeChildProcess(401);

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
      },
    );

    await session.spawn();
    await session.awaitReady();

    // Call shutdown multiple times concurrently
    const p1 = session.shutdown('first');
    const p2 = session.shutdown('second');
    const p3 = session.shutdown('third');

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
    expect(child.killSignalsReceived).toEqual(['SIGTERM']);
  });

  it('escalates to SIGKILL after graceful timeout when process does not exit', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const child = new FakeChildProcess(501);

    // Ignore SIGTERM; exit only on SIGKILL
    child.onKillBehavior = (signal) => {
      if (signal === 'SIGKILL') {
        child.emitExit(null, 'SIGKILL');
      }
    };

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
        gracefulShutdownTimeoutMs: 1000,
        forceShutdownTimeoutMs: 1000,
      },
    );

    await session.spawn();
    await session.awaitReady();

    const shutdownPromise = session.shutdown('unresponsive');

    // Advance clock past graceful timeout to trigger escalation
    await clock.advanceBy(1100);

    const result = await shutdownPromise;
    expect(child.killSignalsReceived).toEqual(['SIGTERM', 'SIGKILL']);
    expect(result.status).toBe('exited');
    expect(result.signalCode).toBe('SIGKILL');
  });

  it('retains manifest record on unconfirmed exit cleanup failure', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const child = new FakeChildProcess(601);

    // Process completely refuses to exit even on SIGKILL
    child.onKillBehavior = () => {};

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
        gracefulShutdownTimeoutMs: 500,
        forceShutdownTimeoutMs: 500,
      },
    );

    await session.spawn();
    await session.awaitReady();

    const shutdownPromise = session.shutdown('stuck');

    // Advance clock past graceful and force timeouts
    await clock.advanceBy(1200);

    const result = await shutdownPromise;
    expect(result.status).toBe('cleanup-failed');
    expect(result.failureCategory).toBe('cleanup-failed');

    // Manifest should NOT be deleted if exit was unconfirmed
    expect(registry.getAllRecords().size).toBe(1);
  });

  it('classifies runtime library load failures ahead of generic not-found engine failures', () => {
    expect(classifyProcessError(null, 'dlopen: library not found')).toBe('runtime-unavailable');
    expect(classifyProcessError(null, 'Csound shared library not found')).toBe('runtime-unavailable');
    expect(classifyProcessError(new Error('Csound 7 was not found'))).toBe('runtime-unavailable');
    expect(classifyProcessError(new Error('spawn blue-engine ENOENT'))).toBe('engine-unavailable');
    expect(classifyProcessError(new Error('blue-engine not found in PATH'))).toBe('engine-unavailable');
    expect(classifyProcessError(null, '', 127)).toBe('engine-unavailable');
  });

  it('completes shutdown cleanly when called before spawn instead of reporting cleanup failure', async () => {
    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      { registerManifest: async () => '/tmp/never-written.json', removeManifest: async () => {} },
    );

    const result = await session.shutdown('never-spawned');

    expect(result.status).toBe('exited');
    expect(result.failureCategory).toBeUndefined();
    expect(session.getState()).toBe('exited');
  });

  it('bounds captured stdout and stderr buffers to a fixed tail', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const child = new FakeChildProcess(701);

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
      },
    );

    await session.spawn();
    await session.awaitReady();

    child.emitStderr('e'.repeat(20000));
    child.emitStdout('o'.repeat(40000));

    expect(session.getStderr().length).toBeLessThanOrEqual(8192);
    expect(session.getStdout().length).toBeLessThanOrEqual(16384);
    // The most recent output is retained, not the head.
    expect(session.getStderr()).toMatch(/^e+$/);
  });

  it('fails readiness immediately when the process exits during startup', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const child = new FakeChildProcess(702);

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
      },
    );

    await session.spawn();
    queueMicrotask(() => child.emitExit(64, null));

    const result = await session.awaitReady();

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('exited before becoming ready');
    expect(session.getState()).not.toBe('connecting');
  });

  it('reports owner, session state, and client connection in the diagnostic report', async () => {
    const clock = new ControllableClock();
    const registry = new FakeProcessRegistry();
    const child = new FakeChildProcess(703);

    const session = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        spawn: () => child as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
        clock,
        ownerPid: 4242,
      },
    );

    await session.spawn();
    await session.awaitReady();

    const diagnostics = session.getDiagnostics();
    expect(diagnostics.ownerPid).toBe(4242);
    expect(diagnostics.sessionState).toBe('ready');
    expect(diagnostics.clientConnected).toBe(true);

    const formatted = formatLifecycleDiagnosticReport(diagnostics);
    expect(formatted).toContain('Owner PID: 4242');
    expect(formatted).toContain('Session State: ready');
    expect(formatted).toContain('Client Connection: connected');
  });
});
