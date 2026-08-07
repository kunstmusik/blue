/**
 * Packaged-runtime verification seam.
 *
 * Deterministic no-audio smoke check used by the `BLUE_VERIFY_MODE=packaged-resources`
 * launch path. It verifies that every runtime dependency required by the
 * installed application is resolvable without launching Csound or `blue-engine`
 * and without spawning the Java helper process.
 *
 * The verifier is intentionally main-process-only: it never touches the
 * renderer, the project model, IPC, or audio devices. It returns a structured
 * report so the caller (the test/CI smoke driver or the application itself
 * during a verify launch) can emit actionable, secret-free diagnostics.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import {
  resolveJavaRuntimeArtifactPath,
  resolveJavaRuntimePythonLibraryPaths,
  type JavaRuntimePathContext,
} from './java-runtime/java-runtime-path';
import { resolveAppMetadata } from './app-metadata';
import type { AppRuntimeVersions } from '../shared/app-metadata';

/** Kinds of runtime aspects the verifier inspects. */
export type RuntimeAspect =
  | 'java-helper'
  | 'python-library'
  | 'zeromq-native'
  | 'node-sqlite'
  | 'workspace-data'
  | 'workspace-engine-client'
  | 'bundled-engine';

/** Single aspect verification result. */
export interface RuntimeVerificationResult {
  aspect: RuntimeAspect;
  ok: boolean;
  code: string;
  message: string;
  detail?: string[];
}

export interface RuntimeVerificationReport {
  ok: boolean;
  results: RuntimeVerificationResult[];
}

export interface PackagedMetadataVerificationContext {
  isPackaged: boolean;
  appVersion?: string;
  appPath?: string;
  resourcesPath?: string;
  releaseChannel?: string;
  processVersions?: Partial<AppRuntimeVersions>;
  readFile?: (filePath: string) => string;
}

export interface PackagedMetadataVerificationResult {
  ok: boolean;
  code: string;
  message: string;
}

export interface RuntimeVerificationContext extends JavaRuntimePathContext {
  /** Root used to resolve @blue/data and @blue/engine-client (typically __dirname). */
  mainModuleDir: string;
  /** Optional override for resolving the externalized workspace packages. */
  resolveExternalModule?: (packageName: string) => string | null;
  /** Optional override for checking node:sqlite availability. */
  resolveNodeSqlite?: () => string | null;
  /** Optional override for verifying zeromq's native .node binary. */
  resolveZeromqNative?: () => string | null;
  /** Optional platform/architecture overrides for installed-layout tests. */
  platform?: NodeJS.Platform;
  arch?: string;
  /** Optional process seam for the side-effect-free Csound probe. */
  runBlueEngineProbe?: (
    executablePath: string,
    missingCsoundPath: string,
  ) => { status: number | null; stdout: string; stderr: string };
}

export interface PackagedProjectVerificationContext {
  isPackaged: boolean;
  projectPath: string | null;
  projectSavePath?: string | null;
  loadProject: (projectPath: string) => Promise<boolean>;
  getLoadedProject: () => { filePath: string | null; title: string } | null;
  saveProjectCopy?: (projectSavePath: string) => Promise<boolean>;
}

export interface PackagedProjectVerificationResult {
  ok: boolean;
  code: string;
  message: string;
}

function failedProjectVerification(
  code: string,
  message: string,
): PackagedProjectVerificationResult {
  return { ok: false, code, message };
}

export function verifyPackagedMetadata(
  context: PackagedMetadataVerificationContext,
): PackagedMetadataVerificationResult {
  if (!context.isPackaged) {
    return {
      ok: false,
      code: 'APP_NOT_PACKAGED',
      message: 'Packaged metadata verification requires an installed application.',
    };
  }

  const metadata = resolveAppMetadata({
    appVersion: context.appVersion,
    appPath: context.appPath,
    resourcesPath: context.resourcesPath,
    isPackaged: context.isPackaged,
    releaseChannel: context.releaseChannel,
    processVersions: context.processVersions,
    readFile: context.readFile,
  });
  if (context.appVersion && metadata.version !== context.appVersion) {
    return {
      ok: false,
      code: 'APP_METADATA_VERSION_MISMATCH',
      message: `Packaged release metadata version ${metadata.version} does not match ${context.appVersion}.`,
    };
  }
  const runtimeValues = Object.values(metadata.runtime);
  const hasCompleteMetadata =
    metadata.version !== 'unknown'
    && /^[0-9a-f]{40}$/i.test(metadata.sourceRevision)
    && metadata.buildDate !== 'unknown'
    && metadata.channel !== 'unknown'
    && runtimeValues.every((value) => value !== 'unknown');
  if (!hasCompleteMetadata) {
    return {
      ok: false,
      code: 'APP_METADATA_INVALID',
      message: 'Packaged release metadata is missing or incomplete.',
    };
  }
  if (
    (context.releaseChannel === 'development' || context.releaseChannel === 'stable')
    && metadata.channel !== context.releaseChannel
  ) {
    return {
      ok: false,
      code: 'APP_METADATA_CHANNEL_MISMATCH',
      message: `Packaged release metadata channel ${metadata.channel} does not match ${context.releaseChannel}.`,
    };
  }

  return {
    ok: true,
    code: 'OK',
    message: `Packaged release metadata: ${metadata.version}, ${metadata.channel}, ${metadata.sourceRevision}`,
  };
}

/**
 * Verifies that the installed Java helper JAR exists at the preferred
 * packaged-resources location. The resolver already returns candidate paths;
 * we only inspect the filesystem.
 */
function verifyJavaHelper(
  context: RuntimeVerificationContext,
  results: RuntimeVerificationResult[],
): void {
  const resolution = resolveJavaRuntimeArtifactPath(context);
  if (resolution.exists) {
    results.push({
      aspect: 'java-helper',
      ok: true,
      code: 'OK',
      message: `Java helper JAR: ${resolution.artifactPath}`,
    });
    return;
  }
  results.push({
    aspect: 'java-helper',
    ok: false,
    code: 'JAVA_HELPER_MISSING',
    message: `Java helper JAR not found. Tried:\n${resolution.candidatePaths.map((p) => `  - ${p}`).join('\n')}`,
  });
}

function verifyPythonLibrary(
  context: RuntimeVerificationContext,
  results: RuntimeVerificationResult[],
): void {
  const resolution = resolveJavaRuntimePythonLibraryPaths(context);
  if (resolution.exists) {
    results.push({
      aspect: 'python-library',
      ok: true,
      code: 'OK',
      message: `Python library: ${resolution.packagedLibraryRoot}`,
    });
    return;
  }
  results.push({
    aspect: 'python-library',
    ok: false,
    code: 'PYTHON_LIBRARY_MISSING',
    message: `Python library not found. Tried:\n${resolution.packagedCandidateRoots.map((p) => `  - ${p}`).join('\n')}`,
  });
}

/**
 * Verifies that the @blue/data workspace package is resolvable from the
 * packaged application's main bundle directory. The Vite build leaves it
 * external, so it must be present in the application's node_modules tree.
 */
function verifyWorkspaceData(
  context: RuntimeVerificationContext,
  results: RuntimeVerificationResult[],
): void {
  const resolved = context.resolveExternalModule
    ? context.resolveExternalModule('@blue/data')
    : safeResolveExternal(context, '@blue/data');
  if (resolved) {
    results.push({
      aspect: 'workspace-data',
      ok: true,
      code: 'OK',
      message: `@blue/data: ${resolved}`,
    });
    return;
  }
  results.push({
    aspect: 'workspace-data',
    ok: false,
    code: 'WORKSPACE_DATA_MISSING',
    message: '@blue/data could not be resolved from the packaged application.',
  });
}

function verifyWorkspaceEngineClient(
  context: RuntimeVerificationContext,
  results: RuntimeVerificationResult[],
): void {
  const resolved = context.resolveExternalModule
    ? context.resolveExternalModule('@blue/engine-client')
    : safeResolveExternal(context, '@blue/engine-client');
  if (resolved) {
    results.push({
      aspect: 'workspace-engine-client',
      ok: true,
      code: 'OK',
      message: `@blue/engine-client: ${resolved}`,
    });
    return;
  }
  results.push({
    aspect: 'workspace-engine-client',
    ok: false,
    code: 'WORKSPACE_ENGINE_CLIENT_MISSING',
    message: '@blue/engine-client could not be resolved from the packaged application.',
  });
}

/**
 * Verifies that the zeromq native module is resolvable. We do not load the
 * addon to avoid spawning worker threads inside a packaging preflight.
 */
function verifyZeromqNative(
  context: RuntimeVerificationContext,
  results: RuntimeVerificationResult[],
): void {
  const resolved = context.resolveZeromqNative
    ? context.resolveZeromqNative()
    : safeResolveZeromq(context);
  if (resolved) {
    results.push({
      aspect: 'zeromq-native',
      ok: true,
      code: 'OK',
      message: `ZeroMQ module: ${resolved}`,
    });
    return;
  }
  results.push({
    aspect: 'zeromq-native',
    ok: false,
    code: 'ZEROMQ_NATIVE_MISSING',
    message: 'Native zeromq module could not be resolved from the packaged application.',
  });
}

/**
 * Verifies that the Electron-pinned node:sqlite built-in is available. We
 * attempt to resolve `node:sqlite` via Node's module loader; if the host
 * Node runtime lacks the built-in (e.g. older Electron), this check fails.
 */
function verifyNodeSqlite(
  context: RuntimeVerificationContext,
  results: RuntimeVerificationResult[],
): void {
  const resolved = context.resolveNodeSqlite
    ? context.resolveNodeSqlite()
    : safeResolveNodeSqlite();
  if (resolved) {
    results.push({
      aspect: 'node-sqlite',
      ok: true,
      code: 'OK',
      message: `node:sqlite: ${resolved}`,
    });
    return;
  }
  results.push({
    aspect: 'node-sqlite',
    ok: false,
    code: 'NODE_SQLITE_MISSING',
    message: 'node:sqlite built-in module is not available in the host runtime.',
  });
}

export function verifyBundledEngine(
  context: RuntimeVerificationContext,
): RuntimeVerificationResult {
  const platform = context.platform ?? process.platform;
  const arch = context.arch ?? process.arch;
  const executableName = platform === 'win32' ? 'blue-engine.exe' : 'blue-engine';
  const engineRoot = path.join(context.resourcesPath ?? '', 'assets', 'engine');
  const executablePath = path.join(engineRoot, executableName);
  const manifestPath = path.join(engineRoot, 'artifact.json');
  let entries: string[];
  let manifest: {
    schemaVersion?: number;
    protocolVersion?: number;
    platform?: string;
    arch?: string;
    executableName?: string;
    sha256?: string;
  };
  try {
    entries = fs.readdirSync(engineRoot).sort();
    const expected = ['artifact.json', executableName].sort();
    if (entries.length !== expected.length ||
        entries.some((entry, index) => entry !== expected[index])) {
      return {
        aspect: 'bundled-engine',
        ok: false,
        code: 'BLUE_ENGINE_RESOURCE_CONTENTS',
        message: `Expected exactly ${expected.join(', ')} in ${engineRoot}`,
        detail: entries,
      };
    }
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as typeof manifest;
    const stats = fs.statSync(executablePath);
    if (!stats.isFile() || (platform !== 'win32' && (stats.mode & 0o111) === 0)) {
      throw new Error('engine resource is not executable');
    }
  } catch (error) {
    return {
      aspect: 'bundled-engine',
      ok: false,
      code: 'BLUE_ENGINE_RESOURCE_MISSING',
      message: `Bundled Blue Engine is missing or invalid at ${engineRoot}`,
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }
  if (manifest.schemaVersion !== 1 ||
      manifest.protocolVersion !== 1 ||
      manifest.platform !== platform ||
      manifest.arch !== arch ||
      manifest.executableName !== executableName) {
    return {
      aspect: 'bundled-engine',
      ok: false,
      code: 'BLUE_ENGINE_RESOURCE_MISMATCH',
      message: `Bundled Blue Engine metadata does not match ${platform}-${arch} protocol 1`,
    };
  }
  const hash = createHash('sha256')
    .update(fs.readFileSync(executablePath))
    .digest('hex');
  if (hash !== manifest.sha256) {
    return {
      aspect: 'bundled-engine',
      ok: false,
      code: 'BLUE_ENGINE_RESOURCE_HASH_MISMATCH',
      message: 'Bundled Blue Engine does not match artifact.json',
    };
  }

  const missingCsoundPath = path.join(engineRoot, '__blue_verify_missing_csound__');
  const probe = context.runBlueEngineProbe
    ? context.runBlueEngineProbe(executablePath, missingCsoundPath)
    : (() => {
        const result = spawnSync(
          executablePath,
          ['--probe-csound', '--json', '--csound-library', missingCsoundPath],
          { encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024, windowsHide: true },
        );
        return { status: result.status, stdout: result.stdout, stderr: result.stderr };
      })();
  try {
    const report = JSON.parse(probe.stdout) as {
      schemaVersion?: number;
      ready?: boolean;
      engine?: { protocolVersion?: number };
      csound?: { status?: string };
    };
    if (probe.status !== 2 ||
        report.schemaVersion !== 1 ||
        report.ready !== false ||
        report.engine?.protocolVersion !== 1 ||
        report.csound?.status === 'ready') {
      throw new Error(`unexpected probe status ${probe.status}`);
    }
  } catch (error) {
    return {
      aspect: 'bundled-engine',
      ok: false,
      code: 'BLUE_ENGINE_NO_CSOUND_PROBE_FAILED',
      message: 'Bundled Blue Engine did not report missing Csound recoverably',
      detail: [
        error instanceof Error ? error.message : String(error),
        probe.stderr.slice(0, 4096),
      ],
    };
  }
  return {
    aspect: 'bundled-engine',
    ok: true,
    code: 'OK',
    message: `Bundled Blue Engine: ${executablePath} (no-Csound probe is recoverable)`,
  };
}

function safeResolveExternal(context: RuntimeVerificationContext, packageName: string): string | null {
  try {
    // Dynamic require resolution: this code runs in the Electron main
    // process where CommonJS require is available.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module') as typeof import('module');
    const resolved = Module.createRequire(path.join(context.mainModuleDir, '__verify__.js')).resolve(packageName);
    return resolved;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(packageName) ? null : null;
  }
}

function safeResolveZeromq(_context: RuntimeVerificationContext): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module') as typeof import('module');
    return Module.createRequire(__filename).resolve('zeromq');
  } catch {
    return null;
  }
}

function safeResolveNodeSqlite(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module') as typeof import('module');
    return Module.createRequire(__filename).resolve('node:sqlite');
  } catch {
    return null;
  }
}

/**
 * Runs every packaged-runtime verification and returns a structured report.
 * Never throws: each verifier reports its own failure as a result.
 */
export function verifyPackagedRuntime(
  context: RuntimeVerificationContext,
): RuntimeVerificationReport {
  const results: RuntimeVerificationResult[] = [];
  verifyJavaHelper(context, results);
  verifyPythonLibrary(context, results);
  verifyZeromqNative(context, results);
  verifyNodeSqlite(context, results);
  verifyWorkspaceData(context, results);
  verifyWorkspaceEngineClient(context, results);
  results.push(verifyBundledEngine(context));

  return {
    ok: results.every((result) => result.ok),
    results,
  };
}

/**
 * Loads a representative project through the application's normal main-owned
 * project path and verifies that it became the current document.
 */
export async function verifyPackagedProject(
  context: PackagedProjectVerificationContext,
): Promise<PackagedProjectVerificationResult> {
  if (!context.isPackaged) {
    return failedProjectVerification(
      'APP_NOT_PACKAGED',
      'Packaged project verification requires an installed application.',
    );
  }
  if (!context.projectPath) {
    return failedProjectVerification(
      'PROJECT_PATH_MISSING',
      'Packaged project verification requires BLUE_VERIFY_PROJECT_PATH.',
    );
  }
  try {
    const loaded = await context.loadProject(context.projectPath);
    const project = context.getLoadedProject();
    if (!loaded || !project || !project.filePath) {
      return failedProjectVerification(
        'PROJECT_LOAD_FAILED',
        `Project did not become the current document: ${context.projectPath}`,
      );
    }
    if (path.resolve(project.filePath) !== path.resolve(context.projectPath)) {
      return failedProjectVerification(
        'PROJECT_PATH_MISMATCH',
        `Loaded project path does not match the requested project: ${context.projectPath}`,
      );
    }

    const title = project.title.trim() || path.basename(context.projectPath);
    if (context.projectSavePath && context.saveProjectCopy) {
      const saved = await context.saveProjectCopy(context.projectSavePath);
      if (!saved) {
        return failedProjectVerification(
          'PROJECT_SAVE_FAILED',
          `Project did not round-trip to the requested save path: ${context.projectSavePath}`,
        );
      }
      return {
        ok: true,
        code: 'OK',
        message: `Project loaded and saved: ${title} (${context.projectSavePath})`,
      };
    }
    return {
      ok: true,
      code: 'OK',
      message: `Project loaded: ${title} (${context.projectPath})`,
    };
  } catch (error) {
    return failedProjectVerification(
      'PROJECT_LOAD_ERROR',
      `Project load threw an error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Convenience helper used by main.ts when BLUE_VERIFY_MODE=packaged-resources.
 * Emits a non-secret diagnostic to stderr and exits the process so the smoke
 * driver can treat the run as a deterministic pass/fail signal.
 */
export function runPackagedRuntimeVerificationAndExit(context: RuntimeVerificationContext): never {
  const report = verifyPackagedRuntime(context);
  for (const result of report.results) {
    const prefix = result.ok ? '[ok]' : '[FAIL]';
    process.stderr.write(`${prefix} ${result.message}\n`);
  }
  if (report.ok) {
    process.stderr.write('\nPackaged runtime verification passed.\n');
    process.exit(0);
  }
  process.stderr.write('\nPackaged runtime verification failed.\n');
  process.exit(1);
}

export function runPackagedMetadataVerificationAndExit(
  context: PackagedMetadataVerificationContext,
): never {
  const result = verifyPackagedMetadata(context);
  process.stderr.write(`${result.ok ? '[ok]' : '[FAIL]'} ${result.message}\n`);
  if (result.ok) {
    process.stderr.write('\nPackaged metadata verification passed.\n');
    process.exit(0);
  }
  process.stderr.write('\nPackaged metadata verification failed.\n');
  process.exit(1);
}

/**
 * Test-only helper that walks the filesystem exactly like the production
 * verifier without depending on Node's runtime require(). Exposed so unit
 * tests can drive deterministic candidate ordering.
 */
export function __inspectFilesystem(rootPath: string): boolean {
  try {
    return fs.statSync(rootPath).isDirectory();
  } catch {
    return false;
  }
}
