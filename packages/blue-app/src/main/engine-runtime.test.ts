import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { developmentEnginePath, EngineRuntimeService, type ProbeProcessRunner } from './engine-runtime';

function report(protocolVersion = 1, ready = true): string {
  return JSON.stringify({
    schemaVersion: 1,
    engine: {
      schemaVersion: 1,
      engineVersion: '0.1.0',
      protocolVersion,
      sourceRevision: 'test',
      features: ['csound-probe-v1'],
    },
    csound: {
      status: ready ? 'ready' : 'not-found',
      requestedPath: null,
      loadedPath: ready ? '/csound' : null,
      versionRaw: ready ? 7000 : null,
      major: ready ? 7 : null,
      minor: ready ? 0 : null,
      patch: ready ? 0 : null,
      supportedMajors: [7],
      missingSymbols: [],
      message: ready ? 'Csound 7 is ready' : 'No supported Csound library was found',
    },
    ready,
  });
}

describe('EngineRuntimeService', () => {
  let repoRoot: string;
  let enginePath: string;
  let runner: ProbeProcessRunner;

  beforeEach(async () => {
    repoRoot = await mkdtemp(path.join(tmpdir(), 'blue-runtime-'));
    enginePath = developmentEnginePath(repoRoot, 'darwin', 'arm64');
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
    runner = async () => ({
      exitCode: 0,
      stdout: report(),
      stderr: '',
      timedOut: false,
    });
  });

  function service(overrides: Partial<ConstructorParameters<typeof EngineRuntimeService>[0]> = {}) {
    return new EngineRuntimeService({
      isPackaged: false,
      resourcesPath: '/unused',
      repoRoot,
      platform: 'darwin',
      arch: 'arm64',
      environment: { PATH: '/empty' },
      getSettingsEnginePath: () => 'blue-engine',
      runProbeProcess: runner,
      ...overrides,
    });
  }

  it('resolves the workspace artifact without a system engine or PATH fallback', async () => {
    const selection = await service().resolve();
    expect(selection.source).toBe('development');
    expect(selection.executablePath).toBe(enginePath);
    expect(selection.executablePath).not.toContain('/usr/local/bin');
  });

  it.each([
    ['darwin', 'arm64', 'blue-engine'],
    ['darwin', 'x64', 'blue-engine'],
    ['win32', 'x64', 'blue-engine.exe'],
    ['linux', 'x64', 'blue-engine'],
  ] as const)(
    'resolves the packaged %s-%s resource layout',
    async (platform, arch, executableName) => {
      const resourcesPath = await mkdtemp(path.join(tmpdir(), 'blue-packaged-engine-'));
      const packagedPath = path.join(resourcesPath, 'assets', 'engine', executableName);
      const bytes = Buffer.from(`${platform}-${arch}`);
      await mkdir(path.dirname(packagedPath), { recursive: true });
      await writeFile(packagedPath, bytes);
      await chmod(packagedPath, 0o755);
      await writeFile(path.join(path.dirname(packagedPath), 'artifact.json'), JSON.stringify({
        schemaVersion: 1,
        protocolVersion: 1,
        platform,
        arch,
        executableName,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      }));
      const selection = await service({
        isPackaged: true,
        resourcesPath,
        platform,
        arch,
      }).resolve();
      expect(selection.source).toBe('bundled');
      expect(selection.executablePath).toBe(packagedPath);
    },
  );

  it('normalizes the legacy sentinel and requires absolute explicit overrides', async () => {
    expect((await service({ getSettingsEnginePath: () => '' }).resolve()).source).toBe('development');
    await expect(service({ getSettingsEnginePath: () => 'relative-engine' }).resolve())
      .rejects.toThrow('absolute path');
  });

  it('uses an absolute environment override before settings', async () => {
    const selection = await service({
      environment: { BLUE_ENGINE_PATH: enginePath, PATH: '/empty' },
      getSettingsEnginePath: () => '/other/engine',
    }).resolve();
    expect(selection.source).toBe('environment-override');
    expect(selection.executablePath).toBe(enginePath);
  });

  it('returns an actionable build instruction when the development artifact is absent', async () => {
    await expect(service({ repoRoot: path.join(repoRoot, 'missing') }).resolve())
      .rejects.toThrow('pnpm --filter @blue/engine-native build');
  });

  it('probes with an absolute path and returns structured Csound failures', async () => {
    runner = async (selectedPath, args) => {
      expect(selectedPath).toBe(enginePath);
      expect(args).toEqual(['--probe-csound', '--json']);
      return { exitCode: 2, stdout: report(1, false), stderr: '', timedOut: false };
    };
    const result = await service().probe();
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('CSOUND_UNAVAILABLE');
    expect(result.report?.csound.status).toBe('not-found');
  });

  it('rejects timeout, invalid JSON, and protocol mismatches', async () => {
    runner = async () => ({ exitCode: null, stdout: '', stderr: '', timedOut: true });
    expect((await service().probe()).errorCode).toBe('ENGINE_PROBE_TIMEOUT');

    runner = async () => ({ exitCode: 0, stdout: '{', stderr: '', timedOut: false });
    expect((await service().probe()).errorCode).toBe('ENGINE_PROBE_INVALID_JSON');

    runner = async () => ({ exitCode: 0, stdout: report(99), stderr: '', timedOut: false });
    expect((await service().probe()).errorCode).toBe('ENGINE_PROTOCOL_MISMATCH');
  });

  it('rejects the incompatible-engine fixture while caller-owned project state remains open', async () => {
    const fixture = await readFile(
      path.join(__dirname, '..', '..', 'fixtures', 'engine', 'incompatible-engine-report.json'),
      'utf8',
    );
    let projectOpen = true;
    runner = async () => ({
      exitCode: 0,
      stdout: fixture,
      stderr: '',
      timedOut: false,
    });

    const result = await service().probe();
    expect(result.errorCode).toBe('ENGINE_PROTOCOL_MISMATCH');
    expect(projectOpen).toBe(true);
    projectOpen = false;
  });

  it('uses a fresh process on retry and invalidates cached reports', async () => {
    let calls = 0;
    runner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: report(), stderr: '', timedOut: false };
    };
    const runtime = service();
    await runtime.probe();
    await runtime.probe();
    await runtime.probe(undefined, { retry: true });
    expect(calls).toBe(2);
  });

  it('does not reuse a cached report after the selected external path changes', async () => {
    const secondPath = path.join(repoRoot, 'external-blue-engine');
    await writeFile(secondPath, 'external');
    await chmod(secondPath, 0o755);
    let selected = enginePath;
    let calls = 0;
    runner = async () => {
      calls += 1;
      return { exitCode: 0, stdout: report(), stderr: '', timedOut: false };
    };
    const runtime = service({ getSettingsEnginePath: () => selected });
    await runtime.probe();
    selected = secondPath;
    runtime.invalidate();
    await runtime.probe();
    expect(calls).toBe(2);
    expect(runtime.getCurrentSelection()?.executablePath).toBe(secondPath);
  });
});
