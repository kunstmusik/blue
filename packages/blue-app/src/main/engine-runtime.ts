import { execFile, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  createReadStream,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  realpathSync,
} from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { openMacRenderScratch } from './macos-render-scratch';
import { BLUE_ENGINE_PROTOCOL_VERSION, hasEngineFeature } from '@blue/engine-client/capabilities';
import {
  boundedDiagnostic,
  decodeEngineCompatibilityReportJson,
  isProtocolCompatible,
  normalizeEngineProbeRequest,
  type EngineProbeErrorCode,
  type EngineProbeRequest,
  type EngineProbeResult,
  type EngineSelection,
  type EngineSelectionSource,
} from '../shared/engine-runtime';
import type { RenderBeforeLaunchCheck } from './render-to-disk';
import {
  CSOUND_IO_FEATURE,
  decodeCsoundIoReportJson,
  normalizeCsoundExecutionRequest,
  normalizeCsoundIoQueryRequest,
  requiredFeatureForExecution,
  type CsoundExecutionRequest,
  type CsoundExecutionResult,
  type CsoundIoQueryRequest,
  type CsoundIoQueryResult,
} from '../shared/csound-runtime';

interface EngineArtifactManifest {
  schemaVersion: number;
  protocolVersion: number;
  platform: string;
  arch: string;
  executableName: string;
  sha256: string;
}

export interface ProbeProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type ProbeProcessRunner = (
  executablePath: string,
  args: string[],
  timeoutMs: number,
) => Promise<ProbeProcessResult>;

export interface ExecutionProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  started: boolean;
  errorMessage?: string;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
}

export type ExecutionOutputSource = 'stdout' | 'stderr';

export type ExecutionProcessRunner = (
  executablePath: string,
  args: string[],
  cwd: string,
  signal: AbortSignal | undefined,
  onOutput: (text: string, source: ExecutionOutputSource) => void,
  stdin?: string,
  stdoutFd?: number,
) => Promise<ExecutionProcessResult>;

export interface NativeConfinedFsResult {
  status: number | null;
  stderr: string;
}

export interface EngineRuntimeOptions {
  isPackaged: boolean;
  resourcesPath: string;
  repoRoot: string;
  scratchProfile?: string;
  platform?: NodeJS.Platform;
  arch?: string;
  environment?: NodeJS.ProcessEnv;
  getSettingsEnginePath: () => string;
  getCsoundLibraryPath?: () => string;
  probeTimeoutMs?: number;
  runProbeProcess?: ProbeProcessRunner;
  runExecutionProcess?: ExecutionProcessRunner;
  publishConfinedWav?: (
    executablePath: string,
    args: string[],
    wavFd: number,
  ) => NativeConfinedFsResult;
  cleanupConfinedStaging?: (
    executablePath: string,
    args: string[],
    wavFd?: number,
  ) => NativeConfinedFsResult;
}

class EngineRuntimeError extends Error {
  constructor(
    readonly code: EngineProbeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EngineRuntimeError';
  }
}

function executableName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'blue-engine.exe' : 'blue-engine';
}

function targetKey(platform: NodeJS.Platform, arch: string): string {
  return `${platform}-${arch}`;
}

function isLegacyBundledValue(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? '';
  return normalized === '' || normalized === 'blue-engine';
}

async function fileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function defaultProbeProcess(
  enginePath: string,
  args: string[],
  timeoutMs: number,
): Promise<ProbeProcessResult> {
  return new Promise((resolve) => {
    execFile(
      enginePath,
      args,
      {
        timeout: timeoutMs,
        maxBuffer: 256 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const processError = error as
          | (NodeJS.ErrnoException & {
              code?: string | number;
              killed?: boolean;
            })
          | null;
        resolve({
          exitCode: typeof processError?.code === 'number' ? processError.code : error ? null : 0,
          stdout,
          stderr,
          timedOut: Boolean(processError?.killed),
        });
      },
    );
  });
}

async function defaultExecutionProcess(
  executablePath: string,
  args: string[],
  cwd: string,
  signal: AbortSignal | undefined,
  onOutput: (text: string, source: ExecutionOutputSource) => void,
  stdin?: string,
  stdoutFd?: number,
): Promise<ExecutionProcessResult> {
  return new Promise((resolve) => {
    const outputLimit = 1024 * 1024;
    let started = false;
    let settled = false;
    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
    const retain = (current: string, text: string, stream: 'stdout' | 'stderr'): string => {
      if (current.length >= outputLimit) {
        if (stream === 'stdout') stdoutTruncated = true;
        else stderrTruncated = true;
        return current;
      }
      const remaining = outputLimit - current.length;
      if (text.length > remaining) {
        if (stream === 'stdout') stdoutTruncated = true;
        else stderrTruncated = true;
      }
      return current + text.slice(0, remaining);
    };
    const child = spawn(executablePath, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: [
        stdin !== undefined ? 'pipe' : 'ignore',
        stdoutFd !== undefined ? stdoutFd : 'pipe',
        'pipe',
      ],
    });
    if (stdin !== undefined && child.stdin) {
      child.stdin.on('error', () => {
        // Ignore EPIPE if the engine rejects arguments before draining stdin.
      });
      child.stdin.end(stdin, 'utf8');
    }
    const finish = (result: ExecutionProcessResult) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = () => {
      try {
        child.kill(stdin === undefined ? 'SIGTERM' : 'SIGKILL');
      } catch {
        // The child may have exited between the abort and kill calls.
      }
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout = retain(stdout, text, 'stdout');
      onOutput(text, 'stdout');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr = retain(stderr, text, 'stderr');
      onOutput(text, 'stderr');
    });
    child.once('spawn', () => {
      started = true;
    });
    let processError: string | undefined;
    child.on('error', (error) => {
      // A signal-delivery error can occur while the child still owns stdout.
      // Record it here and settle only once the writer has closed.
      processError = error.message;
    });
    child.once('close', (exitCode, closeSignal) => {
      finish({
        exitCode: processError ? null : exitCode,
        signal: closeSignal,
        errorMessage: processError,
        stdout,
        stderr,
        started,
        stdoutTruncated,
        stderrTruncated,
      });
    });
  });
}

// On Linux x64/arm64, O_TMPFILE = __O_TMPFILE (0o20000000) | O_DIRECTORY.
const LINUX_O_TMPFILE_BIT = 0o20000000;
const CONFINED_CLEANUP_DIR_NOT_EMPTY = 74;

interface ConfinedStaging {
  wavFd: number;
  wavDev: bigint;
  wavIno: bigint;
  cwdPath: string;
  cwdDev: bigint;
  cwdIno: bigint;
  clear?: () => void;
  stageDir?: { path: string; dev: bigint; ino: bigint };
}

function defaultNativeConfinedFs(
  executablePath: string,
  args: string[],
  wavFd?: number,
): NativeConfinedFsResult {
  const result = spawnSync(executablePath, args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: [wavFd !== undefined ? wavFd : 'ignore', 'ignore', 'pipe'],
  });
  return {
    status: result.status,
    stderr: result.stderr || result.error?.message || '',
  };
}

function acquireConfinedStaging(
  executablePath: string,
  expectedRootDev: string,
  scratchProfile: string | undefined,
  runCleanup: (executablePath: string, args: string[], wavFd?: number) => NativeConfinedFsResult,
): { ok: true; staging: ConfinedStaging } | { ok: false; message: string } {
  const tmpRoot = realpathSync(tmpdir());
  const tmpStat = lstatSync(tmpRoot, { bigint: true });
  if (!tmpStat.isDirectory() || String(tmpStat.dev) !== expectedRootDev) {
    return {
      ok: false,
      message: 'Render staging and destination require the same filesystem.',
    };
  }

  if (process.platform === 'linux') {
    const oTmpfile = (constants.O_DIRECTORY ?? 0) | LINUX_O_TMPFILE_BIT;
    let wavFd: number | null = null;
    try {
      wavFd = openSync(tmpRoot, constants.O_RDWR | oTmpfile, 0o600);
      const wavStat = fstatSync(wavFd, { bigint: true });
      if (!wavStat.isFile() || wavStat.nlink !== 0n || String(wavStat.dev) !== expectedRootDev) {
        closeSync(wavFd);
        return {
          ok: false,
          message: 'Render staging filesystem does not support anonymous temporary files.',
        };
      }
      return {
        ok: true,
        staging: {
          wavFd,
          wavDev: wavStat.dev,
          wavIno: wavStat.ino,
          cwdPath: tmpRoot,
          cwdDev: tmpStat.dev,
          cwdIno: tmpStat.ino,
        },
      };
    } catch (error) {
      if (wavFd !== null) {
        try {
          closeSync(wavFd);
        } catch {
          // Ignore close error on failed allocation.
        }
      }
      return {
        ok: false,
        message: `Could not allocate anonymous render staging: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  if (process.platform === 'darwin') {
    if (!scratchProfile) throw new Error('Missing render scratch profile.');
    const scratch = openMacRenderScratch(scratchProfile, tmpRoot, false);
    if (!scratch) throw new Error('Could not acquire render scratch.');
    const wav = fstatSync(scratch.wavFd, { bigint: true });
    return {
      ok: true,
      staging: {
        ...scratch,
        wavDev: wav.dev,
        wavIno: wav.ino,
        cwdPath: tmpRoot,
        cwdDev: tmpStat.dev,
        cwdIno: tmpStat.ino,
      },
    };
  }

  if (process.platform === 'win32') {
    let stagePath: string | null = null;
    let stageDev: bigint | null = null;
    let stageIno: bigint | null = null;
    let wavFd: number | null = null;
    let wavDev: bigint | null = null;
    let wavIno: bigint | null = null;
    try {
      stagePath = mkdtempSync(path.join(tmpRoot, 'blue-mcp-render-'));
      const stageStat = lstatSync(stagePath, { bigint: true });
      stageDev = stageStat.dev;
      stageIno = stageStat.ino;
      if (!stageStat.isDirectory() || String(stageDev) !== expectedRootDev) {
        runCleanup(executablePath, [
          '--cleanup-confined-render',
          '--root-dir',
          stagePath,
          '--root-dev',
          String(stageDev),
          '--root-ino',
          String(stageIno),
        ]);
        return {
          ok: false,
          message: 'Render staging and destination require the same filesystem.',
        };
      }
      wavFd = openSync(
        path.join(stagePath, 'render.wav'),
        constants.O_RDWR | constants.O_CREAT | constants.O_EXCL,
        0o600,
      );
      const wavStat = fstatSync(wavFd, { bigint: true });
      wavDev = wavStat.dev;
      wavIno = wavStat.ino;
      const recheckStage = lstatSync(stagePath, { bigint: true });
      if (
        !wavStat.isFile() ||
        wavStat.nlink !== 1n ||
        wavStat.dev !== stageDev ||
        !recheckStage.isDirectory() ||
        recheckStage.dev !== stageDev ||
        recheckStage.ino !== stageIno
      ) {
        runCleanup(
          executablePath,
          ['--cleanup-confined-render', '--wav-dev', String(wavDev), '--wav-ino', String(wavIno)],
          wavFd,
        );
        closeSync(wavFd);
        wavFd = null;
        runCleanup(executablePath, [
          '--cleanup-confined-render',
          '--root-dir',
          stagePath,
          '--root-dev',
          String(stageDev),
          '--root-ino',
          String(stageIno),
        ]);
        return { ok: false, message: 'Could not establish ownership of staged WAV.' };
      }
      return {
        ok: true,
        staging: {
          wavFd,
          wavDev,
          wavIno,
          cwdPath: stagePath,
          cwdDev: stageDev,
          cwdIno: stageIno,
          stageDir: { path: stagePath, dev: stageDev, ino: stageIno },
        },
      };
    } catch (error) {
      if (wavFd !== null) {
        if (wavDev !== null && wavIno !== null) {
          try {
            runCleanup(
              executablePath,
              [
                '--cleanup-confined-render',
                '--wav-dev',
                String(wavDev),
                '--wav-ino',
                String(wavIno),
              ],
              wavFd,
            );
          } catch {
            // Ignore cleanup failure during error handling.
          }
        }
        try {
          closeSync(wavFd);
        } catch {
          // Ignore close failure during error handling.
        }
      }
      if (stagePath !== null && stageDev !== null && stageIno !== null) {
        try {
          runCleanup(executablePath, [
            '--cleanup-confined-render',
            '--root-dir',
            stagePath,
            '--root-dev',
            String(stageDev),
            '--root-ino',
            String(stageIno),
          ]);
        } catch {
          // Refuse path-based fallback cleanup when native verification fails.
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    ok: false,
    message: `Confined render staging is unsupported on platform: ${process.platform}`,
  };
}

export function developmentEnginePath(
  repoRoot: string,
  platform: NodeJS.Platform,
  arch: string,
): string {
  return path.join(
    repoRoot,
    'native',
    'blue-engine',
    'dist',
    targetKey(platform, arch),
    executableName(platform),
  );
}

async function fileStamp(filePath: string): Promise<string | null> {
  try {
    const fileStat = await stat(filePath);
    return `${fileStat.dev}:${fileStat.ino}:${fileStat.size}:${fileStat.mtimeMs}:${fileStat.ctimeMs}`;
  } catch {
    return null;
  }
}

export class EngineRuntimeService {
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly timeoutMs: number;
  private readonly runProbeProcess: ProbeProcessRunner;
  private readonly runExecutionProcess: ExecutionProcessRunner;
  private readonly probeCache = new Map<
    string,
    { result: EngineProbeResult; libraryStamp: string }
  >();
  private selection: EngineSelection | null = null;

  constructor(private readonly options: EngineRuntimeOptions) {
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.environment = options.environment ?? process.env;
    this.timeoutMs = options.probeTimeoutMs ?? 3000;
    this.runProbeProcess = options.runProbeProcess ?? defaultProbeProcess;
    this.runExecutionProcess = options.runExecutionProcess ?? defaultExecutionProcess;
  }

  async resolve(requestOverride?: string | null): Promise<EngineSelection> {
    const environmentPath = this.environment.BLUE_ENGINE_PATH?.trim();
    if (environmentPath) {
      return this.selectExternal('environment-override', environmentPath);
    }

    const requestedPath = requestOverride?.trim();
    if (requestedPath && !isLegacyBundledValue(requestedPath)) {
      return this.selectExternal('settings-override', requestedPath);
    }

    const settingsPath = this.options.getSettingsEnginePath();
    if (!isLegacyBundledValue(settingsPath)) {
      return this.selectExternal('settings-override', settingsPath.trim());
    }

    const source: EngineSelectionSource = this.options.isPackaged ? 'bundled' : 'development';
    const enginePath = this.options.isPackaged
      ? path.join(this.options.resourcesPath, 'assets', 'engine', executableName(this.platform))
      : developmentEnginePath(this.options.repoRoot, this.platform, this.arch);
    const selection = await this.selectManaged(source, enginePath);
    this.selection = selection;
    return selection;
  }

  getCurrentSelection(): EngineSelection | null {
    return this.selection;
  }

  invalidate(): void {
    this.selection = null;
    this.probeCache.clear();
  }

  async probe(
    rawRequest?: EngineProbeRequest,
    options: { retry?: boolean | 'if-failed' } = {},
  ): Promise<EngineProbeResult> {
    const startedAt = Date.now();
    let request: EngineProbeRequest;
    let selection: EngineSelection | null = null;
    try {
      request = normalizeEngineProbeRequest(rawRequest);
      if (request.csoundLibraryPath && !path.isAbsolute(request.csoundLibraryPath)) {
        throw new EngineRuntimeError(
          'ENGINE_PROBE_FAILED',
          'The Csound library override must be an absolute path',
        );
      }
      selection = await this.resolve(request.enginePathOverride);
      const externalStamp =
        selection.artifactSha256 ?? `external:${await fileStamp(selection.executablePath)}`;
      const requestedLibrary = request.csoundLibraryPath ?? process.env.LIBCSOUND_PATH ?? '';
      const cacheKey = [selection.executablePath, externalStamp, requestedLibrary].join('\0');
      const cached = this.probeCache.get(cacheKey);
      const loadedPath = cached?.result.report?.csound.loadedPath;
      if (
        cached?.result.ok &&
        options.retry !== true &&
        loadedPath &&
        (await fileStamp(loadedPath)) === cached.libraryStamp &&
        this.probeCache.get(cacheKey) === cached
      ) {
        return cached.result;
      }

      const args = ['--probe-csound', '--json'];
      if (request.csoundLibraryPath) {
        args.push('--csound-library', request.csoundLibraryPath);
      }
      const processResult = await this.runProbeProcess(
        selection.executablePath,
        args,
        this.timeoutMs,
      );
      if (processResult.timedOut) {
        throw new EngineRuntimeError(
          'ENGINE_PROBE_TIMEOUT',
          `Blue Engine compatibility probe exceeded ${this.timeoutMs} ms`,
        );
      }
      if (!processResult.stdout.trim()) {
        throw new EngineRuntimeError(
          'ENGINE_PROBE_FAILED',
          boundedDiagnostic(processResult.stderr || 'Blue Engine returned no probe report'),
        );
      }

      let report;
      try {
        report = decodeEngineCompatibilityReportJson(processResult.stdout.trim());
      } catch (error) {
        throw new EngineRuntimeError(
          'ENGINE_PROBE_INVALID_JSON',
          error instanceof Error ? error.message : String(error),
        );
      }
      if (!isProtocolCompatible(report)) {
        throw new EngineRuntimeError(
          'ENGINE_PROTOCOL_MISMATCH',
          `Blue Engine protocol mismatch: expected ${BLUE_ENGINE_PROTOCOL_VERSION}, ` +
            `received ${report.engine.protocolVersion}`,
        );
      }

      const result: EngineProbeResult = report.ready
        ? {
            ok: true,
            selection,
            report,
            errorCode: null,
            message: report.csound.message,
            durationMs: Date.now() - startedAt,
          }
        : {
            ok: false,
            selection,
            report,
            errorCode: 'CSOUND_UNAVAILABLE',
            message: boundedDiagnostic(report.csound.message),
            durationMs: Date.now() - startedAt,
          };
      const libraryPath = report.csound.loadedPath;
      const libraryStamp =
        libraryPath && path.isAbsolute(libraryPath) ? await fileStamp(libraryPath) : null;
      if (result.ok && libraryStamp !== null) {
        this.probeCache.set(cacheKey, { result, libraryStamp });
      } else {
        this.probeCache.delete(cacheKey);
      }
      return result;
    } catch (error) {
      const runtimeError =
        error instanceof EngineRuntimeError
          ? error
          : new EngineRuntimeError(
              'ENGINE_PROBE_FAILED',
              error instanceof Error ? error.message : String(error),
            );
      return {
        ok: false,
        selection,
        report: null,
        errorCode: runtimeError.code,
        message: boundedDiagnostic(runtimeError.message),
        durationMs: Date.now() - startedAt,
      };
    }
  }

  async queryCsoundIo(
    rawRequest?: CsoundIoQueryRequest,
    options: { retry?: boolean } = {},
  ): Promise<CsoundIoQueryResult> {
    const startedAt = Date.now();
    let request: CsoundIoQueryRequest;
    try {
      request = normalizeCsoundIoQueryRequest(rawRequest);
      const csoundLibraryPath =
        request.csoundLibraryPath ?? (this.options.getCsoundLibraryPath?.().trim() || null);
      const probe = await this.probe(
        {
          enginePathOverride: request.enginePathOverride,
          csoundLibraryPath,
        },
        { retry: options.retry },
      );
      if (!probe.ok || !probe.report || !probe.selection) {
        return {
          ok: false,
          selection: probe.selection,
          report: null,
          errorCode: probe.errorCode,
          message: probe.message,
          durationMs: Date.now() - startedAt,
        };
      }
      if (!hasEngineFeature(probe.report.engine, CSOUND_IO_FEATURE)) {
        return {
          ok: false,
          selection: probe.selection,
          report: null,
          errorCode: 'ENGINE_CAPABILITY_MISSING',
          message: `Blue Engine does not advertise ${CSOUND_IO_FEATURE}`,
          durationMs: Date.now() - startedAt,
        };
      }

      const args = ['--list-io', '--json'];
      if (csoundLibraryPath) args.push('--csound-library', csoundLibraryPath);
      if (request.audioModule) args.push('--audio-module', request.audioModule);
      if (request.midiModule) args.push('--midi-module', request.midiModule);
      const processResult = await this.runProbeProcess(
        probe.selection.executablePath,
        args,
        this.timeoutMs,
      );
      if (processResult.timedOut) {
        return {
          ok: false,
          selection: probe.selection,
          report: null,
          errorCode: 'CSOUND_IO_QUERY_TIMEOUT',
          message: `Csound device discovery exceeded ${this.timeoutMs} ms`,
          durationMs: Date.now() - startedAt,
        };
      }
      if (!processResult.stdout.trim()) {
        return {
          ok: false,
          selection: probe.selection,
          report: null,
          errorCode: 'CSOUND_IO_QUERY_FAILED',
          message: boundedDiagnostic(
            processResult.stderr || 'Blue Engine returned no Csound I/O report',
          ),
          durationMs: Date.now() - startedAt,
        };
      }
      let report;
      try {
        report = decodeCsoundIoReportJson(processResult.stdout.trim());
      } catch (error) {
        return {
          ok: false,
          selection: probe.selection,
          report: null,
          errorCode: 'CSOUND_IO_QUERY_INVALID_JSON',
          message: boundedDiagnostic(error instanceof Error ? error.message : String(error)),
          durationMs: Date.now() - startedAt,
        };
      }
      const diagnostic = report.diagnostics[0];
      const hasScopedFailure = processResult.exitCode !== 0 || !report.ready;
      return {
        ok: !hasScopedFailure && report.ready,
        selection: probe.selection,
        report,
        errorCode: hasScopedFailure
          ? request.audioModule || request.midiModule
            ? 'CSOUND_MODULE_UNAVAILABLE'
            : 'CSOUND_IO_QUERY_FAILED'
          : null,
        message: hasScopedFailure
          ? boundedDiagnostic(diagnostic || processResult.stderr || 'Csound I/O discovery failed')
          : 'Csound modules and devices discovered',
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        ok: false,
        selection: null,
        report: null,
        errorCode: 'CSOUND_IO_QUERY_FAILED',
        message: boundedDiagnostic(error instanceof Error ? error.message : String(error)),
        durationMs: Date.now() - startedAt,
      };
    }
  }

  async executeCsound(
    rawRequest: CsoundExecutionRequest,
    hooks: {
      signal?: AbortSignal;
      onOutput?: (text: string, source: ExecutionOutputSource) => void;
      beforeLaunch?: RenderBeforeLaunchCheck;
      beforePublish?: RenderBeforeLaunchCheck;
    } = {},
  ): Promise<CsoundExecutionResult> {
    const request = normalizeCsoundExecutionRequest(rawRequest);
    const failed = (
      message: string,
      errorCode: string,
      operationId = request.operationId,
    ): CsoundExecutionResult => ({
      operationId,
      state: 'failed',
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: '',
      errorCode,
      message: boundedDiagnostic(message),
    });
    if (hooks.signal?.aborted) {
      return {
        operationId: request.operationId,
        state: 'cancelled',
        exitCode: null,
        signal: 'SIGTERM',
        stdout: '',
        stderr: '',
        errorCode: 'CSOUND_EXECUTION_CANCELLED',
        message: 'Csound operation cancelled before it started',
      };
    }

    const csoundLibraryPath =
      request.csoundLibraryPath ?? (this.options.getCsoundLibraryPath?.().trim() || null);
    const probe = await this.probe({ csoundLibraryPath }, { retry: 'if-failed' });
    if (!probe.ok || !probe.selection || !probe.report) {
      return failed(probe.message, probe.errorCode ?? 'CSOUND_UNAVAILABLE');
    }
    const feature = requiredFeatureForExecution(request.kind);
    if (!hasEngineFeature(probe.report.engine, feature)) {
      return failed(`Blue Engine does not advertise ${feature}`, 'ENGINE_CAPABILITY_MISSING');
    }
    const executionCwd = request.kind === 'confined-render' ? request.rootPath : request.cwd;
    if (!path.isAbsolute(executionCwd)) {
      return failed(
        'Csound execution working directory must be absolute',
        'CSOUND_EXECUTION_INVALID_CWD',
      );
    }
    try {
      const cwdStat = await stat(executionCwd);
      if (!cwdStat.isDirectory()) {
        return failed(
          `Csound execution working directory is not a directory: ${executionCwd}`,
          'CSOUND_EXECUTION_INVALID_CWD',
        );
      }
    } catch {
      return failed(
        `Csound execution working directory was not found: ${executionCwd}`,
        'CSOUND_EXECUTION_INVALID_CWD',
      );
    }

    if (request.kind === 'confined-render' && hooks.signal?.aborted) {
      return {
        operationId: request.operationId,
        state: 'cancelled',
        exitCode: null,
        signal: 'SIGTERM',
        stdout: '',
        stderr: '',
        errorCode: 'CSOUND_EXECUTION_CANCELLED',
        message: 'Csound operation cancelled before launch',
      };
    }

    const beforeLaunchResult = hooks.beforeLaunch?.();
    if (beforeLaunchResult && !beforeLaunchResult.ok) {
      return {
        operationId: request.operationId,
        state: beforeLaunchResult.code === 'CANCELLED' ? 'cancelled' : 'failed',
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: boundedDiagnostic(beforeLaunchResult.message),
        errorCode: beforeLaunchResult.code,
        message: boundedDiagnostic(beforeLaunchResult.message),
      };
    }

    const runCleanup = (
      executablePath: string,
      cleanupArgs: string[],
      wavFd?: number,
    ): NativeConfinedFsResult =>
      this.options.cleanupConfinedStaging
        ? this.options.cleanupConfinedStaging(executablePath, cleanupArgs, wavFd)
        : defaultNativeConfinedFs(executablePath, cleanupArgs, wavFd);
    let staging: ConfinedStaging | undefined;
    let processResult: ExecutionProcessResult;
    let published = false;
    try {
      let cwd = executionCwd;
      let args: string[];
      if (request.kind === 'confined-render') {
        if (!hooks.beforePublish) {
          return failed('Confined render requires a publication guard.', 'OUTPUT_REJECTED');
        }
        const allocated = acquireConfinedStaging(
          probe.selection.executablePath,
          request.rootDev,
          this.options.scratchProfile,
          runCleanup,
        );
        if (!allocated.ok) {
          return failed(allocated.message, 'OUTPUT_REJECTED');
        }
        staging = allocated.staging;
        cwd = staging.cwdPath;
        args = [
          '--run-confined-render',
          '--root-dir',
          staging.cwdPath,
          '--root-dev',
          String(staging.cwdDev),
          '--root-ino',
          String(staging.cwdIno),
          '--wav-dev',
          String(staging.wavDev),
          '--wav-ino',
          String(staging.wavIno),
        ];
      } else {
        args =
          request.kind === 'utility' ? ['--run-utility', request.utilityName] : ['--run-csound'];
      }
      if (csoundLibraryPath) args.push('--csound-library', csoundLibraryPath);
      args.push('--', ...request.args);
      processResult = await this.runExecutionProcess(
        probe.selection.executablePath,
        args,
        cwd,
        hooks.signal,
        hooks.onOutput ?? (() => undefined),
        request.kind === 'confined-render' ? request.csdText : undefined,
        staging?.wavFd,
      );
      if (request.kind === 'confined-render' && staging && processResult.exitCode === 0) {
        if (hooks.signal?.aborted) {
          return {
            ...failed('Render cancelled before publication.', 'CSOUND_EXECUTION_CANCELLED'),
            state: 'cancelled',
          };
        }
        const wav = fstatSync(staging.wavFd, { bigint: true });
        const expectedNlink = process.platform === 'linux' ? 0n : 1n;
        if (
          !wav.isFile() ||
          wav.dev !== staging.wavDev ||
          wav.ino !== staging.wavIno ||
          wav.nlink !== expectedNlink ||
          wav.size < 44n
        ) {
          return failed('Could not verify the staged WAV.', 'OUTPUT_REJECTED');
        }
        const publicationArgs = [
          '--publish-confined-render',
          '--root-dir',
          request.rootPath,
          '--root-dev',
          request.rootDev,
          '--root-ino',
          request.rootIno,
          '--output-name',
          request.outputFilename,
          '--wav-dev',
          String(staging.wavDev),
          '--wav-ino',
          String(staging.wavIno),
        ];
        const gate = hooks.beforePublish!();
        if (!gate.ok) {
          return {
            ...failed(gate.message, gate.code),
            state: gate.code === 'CANCELLED' ? 'cancelled' : 'failed',
          };
        }
        // This metadata-only commit runs in the same main-process turn as the authority check.
        const commit = this.options.publishConfinedWav
          ? this.options.publishConfinedWav(
              probe.selection.executablePath,
              publicationArgs,
              staging.wavFd,
            )
          : defaultNativeConfinedFs(probe.selection.executablePath, publicationArgs, staging.wavFd);
        if (commit.status !== 0) {
          return failed(commit.stderr || 'Could not publish the staged WAV.', 'OUTPUT_REJECTED');
        }
        published = true;
      }
    } catch (error) {
      return failed(
        error instanceof Error ? error.message : String(error),
        request.kind === 'confined-render' ? 'OUTPUT_REJECTED' : 'CSOUND_PROCESS_FAILED',
      );
    } finally {
      if (staging) {
        try {
          staging.clear?.();
          if (staging.stageDir && !published) {
            // Mark the owned WAV handle for delete-on-close by handle before closing wavFd.
            runCleanup(
              probe.selection.executablePath,
              [
                '--cleanup-confined-render',
                '--wav-dev',
                String(staging.wavDev),
                '--wav-ino',
                String(staging.wavIno),
              ],
              staging.wavFd,
            );
          }
        } catch (error) {
          console.warn('Could not clear private MCP render staging.', error);
        } finally {
          try {
            closeSync(staging.wavFd);
          } catch {
            // Ignore close failure if descriptor is already closed.
          }
          if (staging.stageDir) {
            try {
              const dirCleanup = runCleanup(probe.selection.executablePath, [
                '--cleanup-confined-render',
                '--root-dir',
                staging.stageDir.path,
                '--root-dev',
                String(staging.stageDir.dev),
                '--root-ino',
                String(staging.stageDir.ino),
              ]);
              if (dirCleanup.status !== 0 && dirCleanup.status !== CONFINED_CLEANUP_DIR_NOT_EMPTY) {
                console.warn(
                  'Could not remove private MCP render staging.',
                  dirCleanup.stderr || `exit ${dirCleanup.status}`,
                );
              }
            } catch (error) {
              console.warn('Could not remove private MCP render staging.', error);
            }
          }
        }
      }
    }

    const cancelled = !published && (hooks.signal?.aborted ?? false);
    const state: CsoundExecutionResult['state'] = cancelled
      ? 'cancelled'
      : processResult.exitCode === 0
        ? 'completed'
        : 'failed';
    const message = cancelled
      ? 'Csound operation cancelled'
      : processResult.exitCode === 0
        ? 'Csound operation completed'
        : (processResult.errorMessage ??
          (processResult.signal
            ? `Csound terminated by ${processResult.signal}`
            : `Csound exited with code ${processResult.exitCode ?? 'unknown'}`));
    return {
      operationId: request.operationId,
      state,
      exitCode: processResult.exitCode,
      signal: processResult.signal,
      stdout: boundedDiagnostic(
        processResult.stdout + (processResult.stdoutTruncated ? '\n[stdout truncated]' : ''),
        1024 * 1024,
      ),
      stderr: boundedDiagnostic(
        processResult.stderr + (processResult.stderrTruncated ? '\n[stderr truncated]' : ''),
        1024 * 1024,
      ),
      errorCode: cancelled
        ? 'CSOUND_EXECUTION_CANCELLED'
        : state === 'failed'
          ? 'CSOUND_EXECUTION_FAILED'
          : null,
      message: boundedDiagnostic(message),
    };
  }

  private async selectExternal(
    source: Extract<EngineSelectionSource, 'environment-override' | 'settings-override'>,
    enginePath: string,
  ): Promise<EngineSelection> {
    if (!path.isAbsolute(enginePath)) {
      throw new EngineRuntimeError(
        'ENGINE_NOT_FOUND',
        `Blue Engine override must be an absolute path: ${enginePath}`,
      );
    }
    await this.validateExecutable(enginePath);
    const selection: EngineSelection = {
      source,
      executablePath: enginePath,
      expectedProtocolVersion: BLUE_ENGINE_PROTOCOL_VERSION,
      artifactSha256: null,
      diagnostic: null,
    };
    this.selection = selection;
    return selection;
  }

  private async selectManaged(
    source: Extract<EngineSelectionSource, 'bundled' | 'development'>,
    enginePath: string,
  ): Promise<EngineSelection> {
    try {
      await this.validateExecutable(enginePath);
    } catch (error) {
      if (source === 'development' && error instanceof EngineRuntimeError) {
        throw new EngineRuntimeError(
          error.code,
          `${error.message}. Build it with pnpm --filter @blue/engine-native build`,
        );
      }
      throw error;
    }

    const manifestPath = path.join(path.dirname(enginePath), 'artifact.json');
    let manifest: EngineArtifactManifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as EngineArtifactManifest;
    } catch {
      throw new EngineRuntimeError(
        'ENGINE_NOT_FOUND',
        `Blue Engine artifact manifest is missing or invalid: ${manifestPath}`,
      );
    }
    if (
      manifest.schemaVersion !== 1 ||
      manifest.protocolVersion !== BLUE_ENGINE_PROTOCOL_VERSION ||
      manifest.platform !== this.platform ||
      manifest.arch !== this.arch ||
      manifest.executableName !== path.basename(enginePath)
    ) {
      throw new EngineRuntimeError(
        manifest.arch !== this.arch ? 'ENGINE_ARCH_MISMATCH' : 'ENGINE_PROTOCOL_MISMATCH',
        'Blue Engine artifact metadata does not match this application',
      );
    }
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256)) {
      throw new EngineRuntimeError(
        'ENGINE_PROBE_FAILED',
        'Blue Engine artifact hash does not match its manifest',
      );
    }
    const sha256 = await fileSha256(enginePath);
    if (sha256 !== manifest.sha256) {
      throw new EngineRuntimeError(
        'ENGINE_PROBE_FAILED',
        'Blue Engine artifact hash does not match its manifest',
      );
    }
    return {
      source,
      executablePath: enginePath,
      expectedProtocolVersion: BLUE_ENGINE_PROTOCOL_VERSION,
      artifactSha256: manifest.sha256,
      diagnostic: null,
    };
  }

  private async validateExecutable(enginePath: string): Promise<void> {
    let engineStat;
    try {
      engineStat = await stat(enginePath);
    } catch {
      throw new EngineRuntimeError('ENGINE_NOT_FOUND', `Blue Engine was not found: ${enginePath}`);
    }
    if (!engineStat.isFile()) {
      throw new EngineRuntimeError(
        'ENGINE_NOT_EXECUTABLE',
        `Blue Engine is not a file: ${enginePath}`,
      );
    }
    try {
      await access(enginePath, this.platform === 'win32' ? constants.R_OK : constants.X_OK);
    } catch {
      throw new EngineRuntimeError(
        'ENGINE_NOT_EXECUTABLE',
        `Blue Engine is not executable: ${enginePath}`,
      );
    }
  }
}
