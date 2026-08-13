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
      features: ['csound-probe-v1', 'csound-io-v1', 'csound-utility-v1', 'csound-performance-v1'],
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

  it('queries selected modules with a bounded JSON request and preserves empty devices', async () => {
    const io = JSON.stringify({
      schemaVersion: 1,
      engine: JSON.parse(report()).engine,
      csound: JSON.parse(report()).csound,
      selectedAudioModule: 'pa_bl',
      selectedMidiModule: null,
      audioModules: [{ name: 'pa_bl', kind: 'audio' }],
      midiModules: [],
      audioInputs: [],
      audioOutputs: [],
      midiInputs: [],
      midiOutputs: [],
      diagnostics: [],
      ready: true,
    });
    let calls = 0;
    runner = async (_selectedPath, args) => {
      calls += 1;
      if (args[0] === '--probe-csound') return { exitCode: 0, stdout: report(), stderr: '', timedOut: false };
      expect(args).toEqual(['--list-io', '--json', '--audio-module', 'pa_bl']);
      return { exitCode: 0, stdout: io, stderr: '', timedOut: false };
    };
    const result = await service().queryCsoundIo({ audioModule: ' pa_bl ' });
    expect(result.ok).toBe(true);
    expect(result.report?.audioInputs).toEqual([]);
    expect(calls).toBe(2);
  });

  it('maps discovery timeout, invalid JSON, missing capability, and unavailable modules', async () => {
    const base = JSON.parse(report()) as Record<string, any>;
    const io = (overrides: Record<string, unknown> = {}) => JSON.stringify({
      schemaVersion: 1,
      engine: base.engine,
      csound: base.csound,
      selectedAudioModule: null,
      selectedMidiModule: null,
      audioModules: [{ name: 'pa_bl', kind: 'audio' }],
      midiModules: [],
      audioInputs: [],
      audioOutputs: [],
      midiInputs: [],
      midiOutputs: [],
      diagnostics: [],
      ready: true,
      ...overrides,
    });

    let mode: 'timeout' | 'invalid' | 'missing-capability' | 'unavailable' | 'ready' = 'timeout';
    runner = async (_selectedPath, args) => {
      if (args[0] === '--probe-csound') {
        const probe = mode === 'missing-capability'
          ? { ...base, engine: { ...base.engine, features: ['csound-probe-v1'] } }
          : base;
        return { exitCode: 0, stdout: JSON.stringify(probe), stderr: '', timedOut: false };
      }
      if (mode === 'timeout') return { exitCode: null, stdout: '', stderr: '', timedOut: true };
      if (mode === 'invalid') return { exitCode: 0, stdout: '{', stderr: 'invalid', timedOut: false };
      if (mode === 'unavailable') {
        return {
          exitCode: 65,
          stdout: io({ diagnostics: ['Audio module is unavailable: missing'] }),
          stderr: '',
          timedOut: false,
        };
      }
      return { exitCode: 0, stdout: io(), stderr: '', timedOut: false };
    };
    expect((await service().queryCsoundIo()).errorCode).toBe('CSOUND_IO_QUERY_TIMEOUT');
    mode = 'invalid';
    expect((await service().queryCsoundIo()).errorCode).toBe('CSOUND_IO_QUERY_INVALID_JSON');
    mode = 'missing-capability';
    expect((await service().queryCsoundIo()).errorCode).toBe('ENGINE_CAPABILITY_MISSING');
    mode = 'unavailable';
    const unavailable = await service().queryCsoundIo({ audioModule: 'missing' });
    expect(unavailable.errorCode).toBe('CSOUND_MODULE_UNAVAILABLE');
    expect(unavailable.report?.diagnostics[0]).toContain('unavailable');
    mode = 'ready';
    expect((await service().queryCsoundIo({}, { retry: true })).ok).toBe(true);
    expect((await service().probe({ csoundLibraryPath: 'relative/csound' })).errorCode)
      .toBe('ENGINE_PROBE_FAILED');
  });

  it('executes performance arguments through the resolved engine without shell interpretation', async () => {
    let executionArgs: string[] = [];
    const runtime = service({
      runExecutionProcess: async (_path, args, cwd, _signal, onOutput) => {
        executionArgs = args;
        expect(cwd).toBe(repoRoot);
        onOutput('progress', 'stderr');
        return { exitCode: 0, signal: null, stdout: 'out', stderr: 'err', started: true };
      },
    });
    const result = await runtime.executeCsound({
      kind: 'performance', operationId: 'perf-1', cwd: repoRoot,
      args: ['-n', 'file with spaces.csd'],
    });
    expect(result.state).toBe('completed');
    expect(executionArgs).toEqual(['--run-csound', '--', '-n', 'file with spaces.csd']);
  });

  it('maps process start errors, signals, and bounded output to terminal results', async () => {
    const runtime = service({
      runExecutionProcess: async () => ({
        exitCode: null,
        signal: 'SIGTERM',
        stdout: 'stdout',
        stderr: 'stderr',
        started: false,
        errorMessage: 'spawn failed',
        stdoutTruncated: true,
        stderrTruncated: true,
      }),
    });
    const result = await runtime.executeCsound({
      kind: 'performance', operationId: 'start-error', cwd: repoRoot, args: [],
    });
    expect(result.state).toBe('failed');
    expect(result.message).toBe('spawn failed');
    expect(result.stdout).toContain('[stdout truncated]');
    expect(result.stderr).toContain('[stderr truncated]');
  });

  it('dispatches a named utility without synthesizing a shell -U argument', async () => {
    let executionArgs: string[] = [];
    const runtime = service({
      runExecutionProcess: async (_path, args) => {
        executionArgs = args;
        return { exitCode: 0, signal: null, stdout: '', stderr: 'utility output', started: true };
      },
    });
    const result = await runtime.executeCsound({
      kind: 'utility', operationId: 'utility-1', utilityName: 'sndinfo', cwd: repoRoot,
      args: ['path with spaces.aif'],
    });
    expect(result.state).toBe('completed');
    expect(executionArgs).toEqual(['--run-utility', 'sndinfo', '--', 'path with spaces.aif']);
    expect(executionArgs).not.toContain('-U');
  });

  it('makes cancellation authoritative when process close races with success', async () => {
    const controller = new AbortController();
    const runtime = service({
      runExecutionProcess: async (_path, _args, _cwd, signal) => {
        controller.abort();
        expect(signal?.aborted).toBe(true);
        return { exitCode: 0, signal: null, stdout: '', stderr: '', started: true };
      },
    });
    const result = await runtime.executeCsound({
      kind: 'performance', operationId: 'race-1', cwd: repoRoot, args: [],
    }, { signal: controller.signal });
    expect(result.state).toBe('cancelled');
    expect(result.errorCode).toBe('CSOUND_EXECUTION_CANCELLED');
  });
});
