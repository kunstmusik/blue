import { describe, expect, it } from 'vitest';
import {
  getEngineProcessManifestPath,
  matchesTrackedEngineCommandLine,
  planEngineProcessSweep,
  type EngineProcessManifest,
  type EngineProcessManifestV1,
  type EngineProcessManifestV2,
} from './engine-process-registry';

function createManifestV1(): EngineProcessManifestV1 {
  return {
    version: 1,
    kind: 'realtime',
    pid: 4321,
    ownerPid: 1234,
    enginePath: '/opt/homebrew/bin/blue-engine',
    spawnArgs: ['--port', '5555', '--pub-port', '5556', '--shm', 'blue-engine-123'],
    controlEndpoint: 'tcp://localhost:5555',
    pubEndpoint: 'tcp://localhost:5556',
    shmName: 'blue-engine-123',
    startedAt: 1700000000000,
  };
}

function createManifestV2(): EngineProcessManifestV2 {
  return {
    version: 2,
    sessionId: 'sess-abc-123',
    kind: 'realtime',
    pid: 4321,
    ownerPid: 1234,
    enginePath: '/opt/homebrew/bin/blue-engine',
    spawnArgs: ['--port', '5555', '--pub-port', '5556', '--shm', 'blue-engine-123', '--session-id', 'sess-abc-123'],
    controlEndpoint: 'tcp://localhost:5555',
    pubEndpoint: 'tcp://localhost:5556',
    shmName: 'blue-engine-123',
    startedAt: 1700000000000,
    ownerStartToken: 'owner-start-1',
    engineStartToken: 'engine-start-1',
  };
}

describe('engine-process-registry', () => {
  it('builds a version-1 registry path under the temp directory', () => {
    const manifest = createManifestV1();
    const filePath = getEngineProcessManifestPath(manifest);

    expect(filePath).toContain('blue-electron');
    expect(filePath).toContain('engine-processes');
    expect(filePath).toContain('blue-engine-realtime-1234-4321-1700000000000.json');
  });

  it('builds a version-2 registry path with session token', () => {
    const manifest = createManifestV2();
    const filePath = getEngineProcessManifestPath(manifest);

    expect(filePath).toContain('blue-electron');
    expect(filePath).toContain('engine-processes');
    expect(filePath).toContain('blue-engine-realtime-1234-4321-sess-abc-123.json');
  });

  it('matches a tracked engine command line for version-2 with session tokens', () => {
    const manifest = createManifestV2();
    const commandLine = '/opt/homebrew/bin/blue-engine --port 5555 --pub-port 5556 --shm blue-engine-123 --session-id sess-abc-123';

    expect(matchesTrackedEngineCommandLine(commandLine, manifest)).toBe(true);
  });

  it('matches synthetic Windows command paths with quotes and backslashes', () => {
    const manifest: EngineProcessManifestV2 = {
      version: 2,
      sessionId: 'sess-win-1',
      kind: 'blue-live',
      pid: 8888,
      ownerPid: 1111,
      enginePath: 'C:\\Program Files\\Blue\\blue-engine.exe',
      spawnArgs: ['--port', '6000', '--pub-port', '6001', '--shm', 'be-l-1111-shm'],
      controlEndpoint: 'tcp://127.0.0.1:6000',
      pubEndpoint: 'tcp://127.0.0.1:6001',
      shmName: 'be-l-1111-shm',
      startedAt: 1700000000000,
    };

    const winCommandLine = '"C:\\Program Files\\Blue\\blue-engine.exe" --port 6000 --pub-port 6001 --shm be-l-1111-shm';
    expect(matchesTrackedEngineCommandLine(winCommandLine, manifest)).toBe(true);
  });

  it('plans to keep engines whose owner is still alive', () => {
    const manifest = createManifestV2();
    const plan = planEngineProcessSweep(manifest, {
      ownerAlive: true,
      engineAlive: true,
      commandLine: '/opt/homebrew/bin/blue-engine --port 5555 --pub-port 5556 --shm blue-engine-123',
    });

    expect(plan.action).toBe('keep');
  });

  it('plans to terminate an orphaned tracked engine when identity matches exactly', () => {
    const manifest = createManifestV2();
    const plan = planEngineProcessSweep(manifest, {
      ownerAlive: false,
      engineAlive: true,
      commandLine: '/opt/homebrew/bin/blue-engine --port 5555 --pub-port 5556 --shm blue-engine-123 --session-id sess-abc-123',
      engineIdentityMatch: true,
    });

    expect(plan.action).toBe('terminate');
  });

  it('removes manifests whose process is dead', () => {
    const manifest = createManifestV2();
    const plan = planEngineProcessSweep(manifest, {
      ownerAlive: false,
      engineAlive: false,
      commandLine: null,
    });

    expect(plan.action).toBe('remove');
    expect(plan.reason).toContain('exited');
  });

  it('removes manifests when PID has been reused by an unrelated process without terminating', () => {
    const manifest = createManifestV2();
    const plan = planEngineProcessSweep(manifest, {
      ownerAlive: false,
      engineAlive: true,
      commandLine: '/usr/bin/other-process --flag',
    });

    expect(plan.action).toBe('remove');
    expect(plan.reason).toContain('no longer matches');
  });

  it('fails closed and keeps unverifiable targets when command line cannot be inspected', () => {
    const manifest = createManifestV2();
    const plan = planEngineProcessSweep(manifest, {
      ownerAlive: false,
      engineAlive: true,
      commandLine: null, // cannot inspect or permission denied
    });

    // Unverifiable identity must not be terminated automatically
    expect(plan.action).toBe('keep');
    expect(plan.reason).toContain('unverifiable');
  });

  it('removes a reused engine PID when the recorded process identity differs', () => {
    const manifest = createManifestV2();
    const plan = planEngineProcessSweep(manifest, {
      ownerAlive: false,
      engineAlive: true,
      commandLine: '/opt/homebrew/bin/blue-engine --port 5555 --pub-port 5556 --shm blue-engine-123 --session-id sess-abc-123',
      engineIdentityMatch: false,
    });

    expect(plan.action).toBe('remove');
    expect(plan.reason).toContain('identity');
  });

  it('does not terminate a matching command when process identity is unverifiable', () => {
    const manifest = createManifestV2();
    const plan = planEngineProcessSweep(manifest, {
      ownerAlive: false,
      engineAlive: true,
      commandLine: '/opt/homebrew/bin/blue-engine --port 5555 --pub-port 5556 --shm blue-engine-123 --session-id sess-abc-123',
    });

    expect(plan.action).toBe('keep');
    expect(plan.reason).toContain('identity');
  });
});
