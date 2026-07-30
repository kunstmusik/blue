import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import * as path from 'node:path';
import {
  BLUE_ENGINE_PROTOCOL_VERSION,
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

export interface EngineRuntimeOptions {
  isPackaged: boolean;
  resourcesPath: string;
  repoRoot: string;
  platform?: NodeJS.Platform;
  arch?: string;
  environment?: NodeJS.ProcessEnv;
  getSettingsEnginePath: () => string;
  probeTimeoutMs?: number;
  runProbeProcess?: ProbeProcessRunner;
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
  private readonly probeCache = new Map<string, EngineProbeResult>();
  private selection: EngineSelection | null = null;

  constructor(private readonly options: EngineRuntimeOptions) {
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.environment = options.environment ?? process.env;
    this.timeoutMs = options.probeTimeoutMs ?? 3000;
    this.runProbeProcess = options.runProbeProcess ?? defaultProbeProcess;
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
