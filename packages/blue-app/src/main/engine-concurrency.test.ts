import { describe, expect, it, vi } from 'vitest';
import {
  buildEngineEndpoints,
  createEngineSharedMemoryName,
} from './engine-bridge';
import {
  getEngineProcessManifestPath,
  planEngineProcessSweep,
  type EngineProcessManifest,
} from './engine-process-registry';

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: { showErrorBox: vi.fn() },
}));

function manifest(
  kind: 'realtime' | 'blue-live',
  pid: number,
  shmName: string,
  controlEndpoint: string,
  pubEndpoint: string,
): EngineProcessManifest {
  return {
    version: 1,
    kind,
    pid,
    ownerPid: 1234,
    enginePath: '/app/resources/assets/engine/blue-engine',
    spawnArgs: ['--control-endpoint', controlEndpoint, '--pub-endpoint', pubEndpoint, '--shm', shmName],
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
    const realtime = manifest(
      'realtime',
      2001,
      realtimeShm,
      realtimeEndpoints.controlEndpoint,
      realtimeEndpoints.pubEndpoint,
    );
    const live = manifest(
      'blue-live',
      2002,
      liveShm,
      liveEndpoints.controlEndpoint,
      liveEndpoints.pubEndpoint,
    );

    expect(realtime.shmName).not.toBe(live.shmName);
    expect(realtime.controlEndpoint).not.toBe(live.controlEndpoint);
    expect(realtime.pubEndpoint).not.toBe(live.pubEndpoint);
    expect(getEngineProcessManifestPath(realtime))
      .not.toBe(getEngineProcessManifestPath(live));
  });

  it('stopping one tracked process does not select the other for termination', () => {
    const realtime = manifest(
      'realtime',
      2001,
      'realtime-shm',
      'tcp://localhost:5555',
      'tcp://localhost:5556',
    );
    const live = manifest(
      'blue-live',
      2002,
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
