import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { developmentEnginePath, EngineRuntimeService } from './engine-runtime';

const readyReport = JSON.stringify({
  schemaVersion: 1,
  engine: {
    schemaVersion: 1,
    engineVersion: '0.1.0',
    protocolVersion: 1,
    sourceRevision: 'test',
    features: ['csound-probe-v1', 'csound-performance-v1'],
  },
  csound: {
    status: 'ready',
    requestedPath: null,
    loadedPath: '/csound',
    versionRaw: 7000,
    major: 7,
    minor: 0,
    patch: 0,
    supportedMajors: [7],
    missingSymbols: [],
    message: 'ready',
  },
  ready: true,
});

describe('Csound runtime operation isolation', () => {
  it('cancels one offline child without affecting a concurrent child', async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), 'blue-runtime-isolation-'));
    const enginePath = developmentEnginePath(repoRoot, 'darwin', 'arm64');
    await mkdir(path.dirname(enginePath), { recursive: true });
    const bytes = Buffer.from('workspace engine');
    await writeFile(enginePath, bytes);
    await chmod(enginePath, 0o755);
    await writeFile(path.join(path.dirname(enginePath), 'artifact.json'), JSON.stringify({
      schemaVersion: 1,
      protocolVersion: 1,
      platform: 'darwin',
      arch: 'arm64',
      executableName: 'blue-engine',
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }));

    const signals: AbortSignal[] = [];
    const runtime = new EngineRuntimeService({
      isPackaged: false,
      resourcesPath: '/unused',
      repoRoot,
      platform: 'darwin',
      arch: 'arm64',
      environment: { PATH: '/empty' },
      getSettingsEnginePath: () => 'blue-engine',
      runProbeProcess: async () => ({ exitCode: 0, stdout: readyReport, stderr: '', timedOut: false }),
      runExecutionProcess: async (_path, _args, _cwd, signal) => {
        signals.push(signal!);
        await new Promise((resolve) => setTimeout(resolve, 0));
        return { exitCode: 0, signal: null, stdout: '', stderr: '', started: true };
      },
    });
    const controller = new AbortController();
    const cancelled = runtime.executeCsound({
      kind: 'performance', operationId: 'offline-cancelled', cwd: repoRoot, args: [],
    }, { signal: controller.signal });
    const independent = runtime.executeCsound({
      kind: 'performance', operationId: 'offline-independent', cwd: repoRoot, args: [],
    });
    controller.abort();
    const [cancelledResult, independentResult] = await Promise.all([cancelled, independent]);
    expect(cancelledResult.state).toBe('cancelled');
    expect(independentResult.state).toBe('completed');
    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
  });
});
