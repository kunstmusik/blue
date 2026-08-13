import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import * as path from 'node:path';
import {
  BLUE_ENGINE_PROTOCOL_VERSION,
  hasEngineFeature,
} from '@blue/engine-client/capabilities';
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
import {
  CSOUND_IO_FEATURE,
  decodeCsoundIoReportJson,
  normalizeCsoundExecutionRequest,
  normalizeCsoundIoQueryRequest,
  requiredFeatureForExecution,
  type CsoundExecutionRequest,
  type CsoundExecutionResult,
  type CsoundIoQueryErrorCode,
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
) => Promise<ExecutionProcessResult>;

export interface EngineRuntimeOptions {
  isPackaged: boolean;
  resourcesPath: string;
  repoRoot: string;
  platform?: NodeJS.Platform;
  arch?: string;
  environment?: NodeJS.ProcessEnv;
  getSettingsEnginePath: () => string;
  getCsoundLibraryPath?: () => string;
  probeTimeoutMs?: number;
  runProbeProcess?: ProbeProcessRunner;
  runExecutionProcess?: ExecutionProcessRunner;
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
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
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
        const processError = error as NodeJS.ErrnoException & {
          code?: string | number;
          killed?: boolean;
        } | null;
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
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finish = (result: ExecutionProcessResult) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = () => {
      try {
        child.kill('SIGTERM');
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
    child.once('spawn', () => { started = true; });
    child.once('error', (error) => {
      finish({
        exitCode: null,
        signal: null,
        stdout,
        stderr,
        started,
        errorMessage: error.message,
        stdoutTruncated,
        stderrTruncated,
      });
    });
    child.once('close', (exitCode, closeSignal) => {
      finish({
        exitCode,
        signal: closeSignal,
        stdout,
        stderr,
        started,
        stdoutTruncated,
        stderrTruncated,
      });
    });
  });
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

export class EngineRuntimeService {
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly timeoutMs: number;
  private readonly runProbeProcess: ProbeProcessRunner;
  private readonly runExecutionProcess: ExecutionProcessRunner;
  private readonly probeCache = new Map<string, EngineProbeResult>();
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
    options: { retry?: boolean } = {},
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
      const cacheKey = [
        selection.executablePath,
        selection.artifactSha256 ?? 'external',
        request.csoundLibraryPath ?? '',
      ].join('\0');
      if (!options.retry) {
        const cached = this.probeCache.get(cacheKey);
        if (cached) return cached;
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
      this.probeCache.set(cacheKey, result);
      return result;
    } catch (error) {
      const runtimeError = error instanceof EngineRuntimeError
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
      const csoundLibraryPath = request.csoundLibraryPath
        ?? (this.options.getCsoundLibraryPath?.().trim() || null);
      const probe = await this.probe({
        enginePathOverride: request.enginePathOverride,
        csoundLibraryPath,
      }, { retry: options.retry });
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
          message: boundedDiagnostic(processResult.stderr || 'Blue Engine returned no Csound I/O report'),
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
      const hasScopedFailure = processResult.exitCode !== 0
        || !report.ready;
      return {
        ok: !hasScopedFailure && report.ready,
        selection: probe.selection,
        report,
        errorCode: hasScopedFailure
          ? (request.audioModule || request.midiModule
            ? 'CSOUND_MODULE_UNAVAILABLE'
            : 'CSOUND_IO_QUERY_FAILED')
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
    } = {},
  ): Promise<CsoundExecutionResult> {
    const request = normalizeCsoundExecutionRequest(rawRequest);
    const failed = (message: string, errorCode: string, operationId = request.operationId): CsoundExecutionResult => ({
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

    const csoundLibraryPath = request.csoundLibraryPath
      ?? (this.options.getCsoundLibraryPath?.().trim() || null);
    const probe = await this.probe({ csoundLibraryPath }, { retry: true });
    if (!probe.ok || !probe.selection || !probe.report) {
      return failed(probe.message, probe.errorCode ?? 'CSOUND_UNAVAILABLE');
    }
    const feature = requiredFeatureForExecution(request.kind);
    if (!hasEngineFeature(probe.report.engine, feature)) {
      return failed(`Blue Engine does not advertise ${feature}`, 'ENGINE_CAPABILITY_MISSING');
    }
    if (!path.isAbsolute(request.cwd)) {
      return failed('Csound execution working directory must be absolute', 'CSOUND_EXECUTION_INVALID_CWD');
    }
    try {
      const cwdStat = await stat(request.cwd);
      if (!cwdStat.isDirectory()) {
        return failed(`Csound execution working directory is not a directory: ${request.cwd}`, 'CSOUND_EXECUTION_INVALID_CWD');
      }
    } catch {
      return failed(`Csound execution working directory was not found: ${request.cwd}`, 'CSOUND_EXECUTION_INVALID_CWD');
    }

    const args = request.kind === 'utility'
      ? ['--run-utility', request.utilityName]
      : ['--run-csound'];
    if (csoundLibraryPath) args.push('--csound-library', csoundLibraryPath);
    args.push('--', ...request.args);
    let processResult: ExecutionProcessResult;
    try {
      processResult = await this.runExecutionProcess(
        probe.selection.executablePath,
        args,
        request.cwd,
        hooks.signal,
        hooks.onOutput ?? (() => undefined),
      );
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error), 'CSOUND_PROCESS_FAILED');
    }

    const cancelled = hooks.signal?.aborted ?? false;
    const state: CsoundExecutionResult['state'] = cancelled
      ? 'cancelled'
      : processResult.exitCode === 0
        ? 'completed'
        : 'failed';
    const message = cancelled
      ? 'Csound operation cancelled'
      : processResult.exitCode === 0
        ? 'Csound operation completed'
        : processResult.errorMessage
          ?? (processResult.signal ? `Csound terminated by ${processResult.signal}` : `Csound exited with code ${processResult.exitCode ?? 'unknown'}`);
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
        : state === 'failed' ? 'CSOUND_EXECUTION_FAILED' : null,
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
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256) ||
        await fileSha256(enginePath) !== manifest.sha256) {
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
      throw new EngineRuntimeError('ENGINE_NOT_EXECUTABLE', `Blue Engine is not a file: ${enginePath}`);
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
