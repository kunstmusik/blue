import { describe, expect, it, vi } from 'vitest';
import { buildEngineEndpoints, createEngineSharedMemoryName } from './engine-bridge';
import {
  getEngineProcessManifestPath,
  planEngineProcessSweep,
  type EngineProcessManifestV2,
} from './engine-process-registry';
import { allocateTcpEndpointPair } from './engine-endpoints';
import { EngineSession, isSessionActive } from './engine-session';
import {
  FakeChildProcess,
  FakeEngineClient,
  FakeProcessRegistry,
} from './engine-session.test-support';

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showErrorBox: vi.fn() },
}));

function manifestV2(
  kind: 'realtime' | 'blue-live',
  pid: number,
  ownerPid: number,
  sessionId: string,
  shmName: string,
  controlEndpoint: string,
  pubEndpoint: string,
): EngineProcessManifestV2 {
  return {
    version: 2,
    sessionId,
    kind,
    pid,
    ownerPid,
    enginePath: '/app/resources/assets/engine/blue-engine',
    spawnArgs: [
      '--control-endpoint',
      controlEndpoint,
      '--pub-endpoint',
      pubEndpoint,
      '--shm',
      shmName,
    ],
    controlEndpoint,
    pubEndpoint,
    shmName,
    startedAt: kind === 'realtime' ? 1 : 2,
  };
}

describe('concurrent realtime and Blue Live engine isolation', () => {
  it('keeps POSIX shared-memory names within the macOS 31-character limit', () => {
    const token = 'db4e7e97-f64e-453e-9a58-e14ac4c74c2a';
    const maximumSignedPid = 0x7fffffff;
    const realtimeShm = createEngineSharedMemoryName('realtime', maximumSignedPid, token);
    const liveShm = createEngineSharedMemoryName('blue-live', maximumSignedPid, token);

    expect(`/${realtimeShm}`.length).toBeLessThanOrEqual(31);
    expect(`/${liveShm}`.length).toBeLessThanOrEqual(31);
    expect(realtimeShm).toMatch(/^be-r-[0-9a-z]+-[0-9a-f]{16}$/);
    expect(liveShm).toMatch(/^be-l-[0-9a-z]+-[0-9a-f]{16}$/);
  });

  it('allocates distinct shared memory, endpoints, and registry records', () => {
    const realtimeShm = createEngineSharedMemoryName('realtime', 1234, 'realtime-token');
    const liveShm = createEngineSharedMemoryName('blue-live', 1234, 'live-token');
    const realtimeEndpoints = buildEngineEndpoints('ipc', 5555, 5556, realtimeShm);
    const liveEndpoints = buildEngineEndpoints('ipc', 5560, 5561, liveShm);
    const realtime = manifestV2(
      'realtime',
      2001,
      1234,
      'rt-session-uuid',
      realtimeShm,
      realtimeEndpoints.controlEndpoint,
      realtimeEndpoints.pubEndpoint,
    );
    const live = manifestV2(
      'blue-live',
      2002,
      1234,
      'live-session-uuid',
      liveShm,
      liveEndpoints.controlEndpoint,
      liveEndpoints.pubEndpoint,
    );

    expect(realtime.shmName).not.toBe(live.shmName);
    expect(realtime.controlEndpoint).not.toBe(live.controlEndpoint);
    expect(realtime.pubEndpoint).not.toBe(live.pubEndpoint);
    expect(getEngineProcessManifestPath(realtime)).not.toBe(getEngineProcessManifestPath(live));
  });

  it('isolates sessions across two distinct app owners and preserves live foreign owner', async () => {
    const registry = new FakeProcessRegistry();

    // Owner 1001 (App 1)
    const childApp1 = new FakeChildProcess(3001);
    const sessionApp1 = new EngineSession(
      { kind: 'realtime', enginePath: '/bin/blue-engine' },
      {
        ownerPid: 1001,
        spawn: () => childApp1 as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
      },
    );
    await sessionApp1.spawn();
    await sessionApp1.awaitReady();

    // Owner 1002 (App 2)
    const childApp2 = new FakeChildProcess(3002);
    const sessionApp2 = new EngineSession(
      { kind: 'blue-live', enginePath: '/bin/blue-engine' },
      {
        ownerPid: 1002,
        spawn: () => childApp2 as any,
        createClient: () => new FakeEngineClient() as any,
        registerManifest: (m) => registry.registerEngineProcess(m),
        removeManifest: (p) => registry.removeEngineProcessRecord(p),
      },
    );
    await sessionApp2.spawn();
    await sessionApp2.awaitReady();

    expect(registry.getAllRecords().size).toBe(2);

    // App 1 shuts down its session
    await sessionApp1.shutdown('app1-quit');
    expect(isSessionActive(sessionApp1, sessionApp1)).toBe(false);

    // App 2 remains fully active and unaffected
    expect(isSessionActive(sessionApp2, sessionApp2)).toBe(true);
    expect(sessionApp2.getState()).toBe('ready');
    expect(registry.getAllRecords().size).toBe(1);

    // App 2 finally shuts down
    await sessionApp2.shutdown('app2-quit');
    expect(registry.getAllRecords().size).toBe(0);
  });

  it('allocates distinct TCP endpoint pairs across multiple simultaneous sessions', async () => {
    const allocatedPorts = new Set<number>();
    const isPortAvailable = async (port: number) => !allocatedPorts.has(port);

    const pair1 = await allocateTcpEndpointPair({ basePort: 5555, isPortAvailable });
    allocatedPorts.add(pair1.controlPort);
    allocatedPorts.add(pair1.pubPort);

    const pair2 = await allocateTcpEndpointPair({ basePort: 5555, isPortAvailable });
    allocatedPorts.add(pair2.controlPort);
    allocatedPorts.add(pair2.pubPort);

    expect(pair1.controlPort).not.toBe(pair2.controlPort);
    expect(pair1.pubPort).not.toBe(pair2.pubPort);
    expect(pair1.controlPort).toBe(5555);
    expect(pair1.pubPort).toBe(5556);
    expect(pair2.controlPort).toBe(5557);
    expect(pair2.pubPort).toBe(5558);
  });

  it('stopping one tracked process does not select the other for termination', () => {
    const realtime = manifestV2(
      'realtime',
      2001,
      1234,
      'rt-uuid',
      'realtime-shm',
      'tcp://localhost:5555',
      'tcp://localhost:5556',
    );
    const live = manifestV2(
      'blue-live',
      2002,
      1234,
      'live-uuid',
      'live-shm',
      'tcp://localhost:5560',
      'tcp://localhost:5561',
    );
    const livePlan = planEngineProcessSweep(live, {
      ownerAlive: true,
      engineAlive: true,
      commandLine: `${live.enginePath} ${live.spawnArgs.join(' ')}`,
    });
    const realtimePlan = planEngineProcessSweep(realtime, {
      ownerAlive: false,
      engineAlive: false,
      commandLine: null,
    });

    expect(realtimePlan.action).toBe('remove');
    expect(livePlan.action).toBe('keep');
  });
});
