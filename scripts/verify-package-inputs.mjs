#!/usr/bin/env node
/**
 * Deterministic package-input validation.
 *
 * Verifies that the inputs required to package @blue/app are present and
 * internally consistent before invoking electron-builder. The check is
 * deliberately secret-free: it inspects filesystem inputs only and reports
 * missing build artifacts by path. It never inspects signing credentials,
 * environment secrets, or personal data.
 *
 * Inputs validated:
 *
 *   1. Java helper outputs (blue-java.jar, pythonLib) produced by @blue/java-runtime.
 *   2. Externalized workspace runtime packages (@blue/data, @blue/engine-client,
 *      @blue/java-runtime) that the Vite main bundle leaves un-bundled.
 *   3. Built Electron entries (dist/main, dist/preload, dist/renderer,
 *      dist/shared) that electron-builder consumes from packages/blue-app.
 *   4. The Electron version declared in packages/blue-app/package.json matches
 *      the pinned runtime constraint (35.7.5) used for native-module rebuilds.
 *   5. Native ZeroMQ (.node) availability for the host runtime so packaging
 *      does not silently ship an app that cannot load `zeromq`.
 *   6. The macOS nested-engine entitlement required for future signed builds.
 *
 * Exit codes:
 *   0 - all inputs are present and consistent.
 *   1 - one or more required inputs are missing or inconsistent. Diagnostics
 *       are written to stderr; no secret material is ever logged.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import {
  accessSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const appRoot = join(repoRoot, 'packages', 'blue-app');
const engineStageRoot = join(appRoot, '.engine-stage');
const engineProtocolVersion = 1;

/** @typedef {{ ok: boolean, code: string, message: string, detail?: string[] }} Diagnostic */

/**
 * @param {Diagnostic[]} diagnostics
 * @returns {boolean}
 */
function anyFailed(diagnostics) {
  return diagnostics.some((d) => !d.ok);
}

/**
 * @param {string} label
 * @param {string} filePath
 * @param {'file' | 'dir'} [kind]
 * @returns {Diagnostic}
 */
function checkPath(label, filePath, kind = 'file') {
  try {
    const stats = statSync(filePath);
    const kindMatches = kind === 'dir' ? stats.isDirectory() : stats.isFile();
    if (!kindMatches) {
      return {
        ok: false,
        code: 'WRONG_KIND',
        message: `${label}: expected ${kind} at ${filePath}`,
      };
    }
    return { ok: true, code: 'OK', message: `${label}: ${filePath}` };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'STAT_FAILED';
    return {
      ok: false,
      code,
      message: `${label}: missing or inaccessible at ${filePath}`,
    };
  }
}

export function resolvePackageTarget(
  argv = process.argv.slice(2),
  platform = process.platform,
  arch = process.arch,
) {
  const index = argv.indexOf('--target');
  const key = index === -1 ? `${platform}-${arch}` : argv[index + 1];
  const supported = new Set(['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64']);
  if (!key || !supported.has(key)) {
    throw new Error(`BLUE_ENGINE_UNSUPPORTED_TARGET: ${key ?? '(missing)'}`);
  }
  const separator = key.lastIndexOf('-');
  return {
    key,
    platform: key.slice(0, separator),
    arch: key.slice(separator + 1),
    executableName: key.startsWith('win32-') ? 'blue-engine.exe' : 'blue-engine',
  };
}

export function checkStagedBlueEngine({
  stageRoot = engineStageRoot,
  target = resolvePackageTarget(),
  expectedRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim(),
  ci = process.env.CI === 'true',
} = {}) {
  let entries;
  try {
    entries = readdirSync(stageRoot).sort();
  } catch (error) {
    return {
      ok: false,
      code: 'BLUE_ENGINE_STAGE_MISSING',
      message: `Bundled Blue Engine stage is missing at ${stageRoot}`,
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }
  const expectedEntries = ['artifact.json', target.executableName].sort();
  if (entries.length !== expectedEntries.length ||
      entries.some((entry, index) => entry !== expectedEntries[index])) {
    return {
      ok: false,
      code: 'BLUE_ENGINE_STAGE_CONTENTS',
      message: `Blue Engine stage must contain exactly ${expectedEntries.join(', ')}`,
      detail: entries,
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(stageRoot, 'artifact.json'), 'utf8'));
  } catch (error) {
    return {
      ok: false,
      code: 'BLUE_ENGINE_MANIFEST_INVALID',
      message: 'Bundled Blue Engine manifest is missing or invalid',
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }
  if (manifest.schemaVersion !== 1 ||
      manifest.protocolVersion !== engineProtocolVersion ||
      manifest.platform !== target.platform ||
      manifest.arch !== target.arch ||
      manifest.executableName !== target.executableName) {
    return {
      ok: false,
      code: 'BLUE_ENGINE_MANIFEST_MISMATCH',
      message: `Bundled Blue Engine manifest does not match ${target.key} protocol ${engineProtocolVersion}`,
    };
  }
  if (typeof manifest.sourceRevision !== 'string') {
    return {
      ok: false,
      code: 'BLUE_ENGINE_SOURCE_REVISION_INVALID',
      message: 'Bundled Blue Engine manifest has no source revision',
    };
  }
  const dirtyRevision = manifest.sourceRevision.startsWith('dirty:');
  const revision = dirtyRevision ? manifest.sourceRevision.slice('dirty:'.length) : manifest.sourceRevision;
  if (revision !== expectedRevision || (ci && dirtyRevision)) {
    return {
      ok: false,
      code: dirtyRevision && ci
        ? 'BLUE_ENGINE_DIRTY_CI_REVISION'
        : 'BLUE_ENGINE_SOURCE_REVISION_MISMATCH',
      message: `Bundled Blue Engine revision ${manifest.sourceRevision} does not match ${expectedRevision}`,
    };
  }

  const executablePath = join(stageRoot, target.executableName);
  let stats;
  try {
    stats = statSync(executablePath);
    accessSync(executablePath, target.platform === 'win32' ? constants.R_OK : constants.X_OK);
  } catch (error) {
    return {
      ok: false,
      code: 'BLUE_ENGINE_NOT_EXECUTABLE',
      message: `Bundled Blue Engine is missing or non-executable at ${executablePath}`,
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }
  if (!stats.isFile()) {
    return {
      ok: false,
      code: 'BLUE_ENGINE_NOT_EXECUTABLE',
      message: `Bundled Blue Engine is not a file at ${executablePath}`,
    };
  }
  const hash = createHash('sha256').update(readFileSync(executablePath)).digest('hex');
  if (hash !== manifest.sha256) {
    return {
      ok: false,
      code: 'BLUE_ENGINE_HASH_MISMATCH',
      message: 'Bundled Blue Engine hash does not match artifact.json',
    };
  }
  return {
    ok: true,
    code: 'OK',
    message: `Bundled Blue Engine: ${executablePath} (${target.key}, protocol ${engineProtocolVersion})`,
  };
}

/**
 * @returns {Diagnostic[]}
 */
function checkJavaHelperOutputs() {
  const jar = join(appRoot, 'assets', 'java', 'blue-java.jar');
  const pythonLib = join(appRoot, 'assets', 'java', 'pythonLib');
  return [checkPath('Java helper JAR', jar, 'file'), checkPath('Java helper Python library', pythonLib, 'dir')];
}

/**
 * Verifies that the workspace packages the Vite main bundle leaves external
 * (@blue/data, @blue/engine-client) resolve from the app package.
 * `@blue/java-runtime` is intentionally excluded: it is a Java-only package
 * with no JavaScript entry point and is validated separately by the Java
 * helper JAR/Python library filesystem checks. electron-builder keeps the
 * JS-only externals outside the ASAR via the `extraResources`/node modules
 * rules; the build will fail to load them at runtime if they are not
 * installed before packaging.
 *
 * @returns {Diagnostic[]}
 */
function checkExternalizedWorkspacePackages() {
  const externalPackages = ['@blue/data', '@blue/engine-client'];
  /** @type {Diagnostic[]} */
  const diagnostics = [];
  for (const pkgName of externalPackages) {
    // Resolve the package main entry (not "/package.json", because some of
    // these packages use a strict `exports` map that does not expose it).
    let resolvedPath;
    try {
      resolvedPath = require.resolve(pkgName, { paths: [appRoot] });
    } catch (error) {
      diagnostics.push({
        ok: false,
        code: 'EXTERNAL_PACKAGE_MISSING',
        message: `Externalized workspace package ${pkgName} could not be resolved from ${appRoot}`,
        detail: [error instanceof Error ? error.message : String(error)],
      });
      continue;
    }
    diagnostics.push({
      ok: true,
      code: 'OK',
      message: `Externalized workspace package ${pkgName}: ${resolvedPath}`,
    });
  }
  return diagnostics;
}

/**
 * @returns {Diagnostic[]}
 */
function checkBuiltElectronEntries() {
  return [
    checkPath('Electron main bundle', join(appRoot, 'dist', 'main', 'main.js'), 'file'),
    checkPath('Electron preload bundle', join(appRoot, 'dist', 'preload', 'preload.js'), 'file'),
    checkPath('Electron renderer output', join(appRoot, 'dist', 'renderer', 'index.html'), 'file'),
    checkPath(
      'Electron shared runtime output',
      join(appRoot, 'dist', 'shared', 'window-layout-settings.js'),
      'file',
    ),
    checkPath(
      'macOS Blue Engine entitlements',
      join(appRoot, 'build', 'entitlements.blue-engine.mac.plist'),
      'file',
    ),
  ];
}

/**
 * @returns {Diagnostic}
 */
function checkElectronVersion() {
  const expectedPin = '35.7.5';
  let pkgText;
  try {
    pkgText = readFileSync(join(appRoot, 'package.json'), 'utf-8');
  } catch (error) {
    return {
      ok: false,
      code: 'PACKAGE_JSON_MISSING',
      message: `Could not read ${join(appRoot, 'package.json')}`,
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(pkgText);
  } catch (error) {
    return {
      ok: false,
      code: 'PACKAGE_JSON_INVALID',
      message: `Could not parse ${join(appRoot, 'package.json')}`,
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }

  const declared = parsed?.devDependencies?.electron;
  if (typeof declared !== 'string' || declared.length === 0) {
    return {
      ok: false,
      code: 'ELECTRON_PIN_MISSING',
      message: 'packages/blue-app/package.json does not declare a pinned electron devDependency',
    };
  }

  // Accept exact pins ("35.7.5") or caret ranges that still resolve to the pin
  // ("^35.7.5"). Reject "~" or ">= " ranges because they do not lock the
  // Node/SQLite runtime contract documented in the release plan.
  const cleaned = declared.replace(/^[^0-9]*/, '');
  if (cleaned !== expectedPin) {
    return {
      ok: false,
      code: 'ELECTRON_PIN_MISMATCH',
      message: `Electron pin mismatch: package.json declares "${declared}", expected ${expectedPin}`,
    };
  }

  return {
    ok: true,
    code: 'OK',
    message: `Electron runtime pin: ${declared}`,
  };
}

/**
 * @returns {Diagnostic}
 */
function checkNativeZeroMQ() {
  let zeromqExports;
  try {
    zeromqExports = require.resolve('zeromq', { paths: [appRoot] });
  } catch (error) {
    return {
      ok: false,
      code: 'ZEROMQ_MODULE_MISSING',
      message: `Native zeromq module could not be resolved from ${appRoot}`,
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }

  // Resolve a native .node binary by walking the package directory. zeromq
  // ships its binaries under `build/<platform>/<arch>/node/<libc>-<abi>-Release/addon.node`,
  // so we walk a bounded three-level subtree to find them without loading the
  // addon (which would spawn worker threads and is unsafe inside a packaging
  // preflight). We do not follow `node_modules` symlinks.
  let foundNodeFile = false;
  try {
    const zeromqDir = dirname(zeromqExports);
    const { readdirSync, statSync: stat } = require('node:fs');
    /** @param {string} dir */
    const listDir = (dir) => {
      try {
        return readdirSync(dir);
      } catch {
        return [];
      }
    };
    const packageRootWalk = (startDir) => {
      // Walk up from the resolved entry to find the package root (the directory
      // containing the addon's sibling `build/` tree). One level is usually
      // sufficient because zeromq's main entry sits at the package root, but we
      // allow a couple of levels of nesting for safety.
      let current = startDir;
      for (let depth = 0; depth < 3; depth += 1) {
        const buildDir = join(current, 'build');
        const stats = (() => {
          try {
            return stat(buildDir);
          } catch {
            return null;
          }
        })();
        if (stats && stats.isDirectory()) {
          return current;
        }
        const parent = dirname(current);
        if (parent === current) return null;
        current = parent;
      }
      return null;
    };

    const packageRoot = packageRootWalk(zeromqDir) ?? dirname(zeromqExports);

    /** @param {string} dir @param {number} depth */
    const walk = (dir, depth) => {
      if (foundNodeFile || depth > 6) return;
      for (const entry of listDir(dir)) {
        if (entry === 'node_modules') continue;
        const full = join(dir, entry);
        let stats;
        try {
          stats = stat(full);
        } catch {
          continue;
        }
        if (stats.isFile() && entry.endsWith('.node')) {
          foundNodeFile = true;
          return;
        }
        if (stats.isDirectory()) {
          walk(full, depth + 1);
          if (foundNodeFile) return;
        }
      }
    };
    walk(packageRoot, 0);
  } catch (error) {
    return {
      ok: false,
      code: 'ZEROMQ_INSPECT_FAILED',
      message: `Failed to inspect zeromq package at ${zeromqExports}`,
      detail: [error instanceof Error ? error.message : String(error)],
    };
  }

  if (!foundNodeFile) {
    return {
      ok: false,
      code: 'ZEROMQ_NATIVE_BINARY_MISSING',
      message: `Native ZeroMQ .node binary not found inside ${dirname(zeromqExports)}`,
    };
  }

  return {
    ok: true,
    code: 'OK',
    message: `Native ZeroMQ module: ${zeromqExports}`,
  };
}

/**
 * @returns {Diagnostic}
 */
function checkViteExternalizationContract() {
  // The release contract requires that the Vite main bundle leaves
  // node:sqlite, zeromq, @blue/engine-client, and @blue/data external so the
  // packaged application can resolve them as runtime dependencies rather than
  // embedding a stale copy.
  const viteConfigPath = join(appRoot, 'vite.config.ts');
  if (!existsSync(viteConfigPath)) {
    return {
      ok: false,
      code: 'VITE_CONFIG_MISSING',
      message: `vite.config.ts is missing at ${viteConfigPath}`,
    };
  }

  const text = readFileSync(viteConfigPath, 'utf-8');
  const requiredExternals = ['node:sqlite', 'zeromq', '@blue/engine-client', '@blue/data'];
  const missing = requiredExternals.filter((external) => !text.includes(external));
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'VITE_EXTERNALS_MISSING',
      message: `vite.config.ts main rollupOptions.external is missing entries: ${missing.join(', ')}`,
      detail: missing,
    };
  }

  return {
    ok: true,
    code: 'OK',
    message: 'Vite main bundle externalizes node:sqlite, zeromq, @blue/engine-client, @blue/data',
  };
}

export function collectPackageInputDiagnostics({
  target = resolvePackageTarget(),
} = {}) {
  /** @type {Diagnostic[]} */
  return [
    ...checkJavaHelperOutputs(),
    ...checkExternalizedWorkspacePackages(),
    ...checkBuiltElectronEntries(),
    checkStagedBlueEngine({ target }),
    checkElectronVersion(),
    checkNativeZeroMQ(),
    checkViteExternalizationContract(),
  ];
}

function main() {
  const diagnostics = collectPackageInputDiagnostics();

  for (const diagnostic of diagnostics) {
    const prefix = diagnostic.ok ? '[ok]' : '[FAIL]';
    process.stderr.write(`${prefix} ${diagnostic.message}\n`);
    if (diagnostic.detail && diagnostic.detail.length > 0) {
      for (const line of diagnostic.detail) {
        process.stderr.write(`        ${line}\n`);
      }
    }
  }

  if (anyFailed(diagnostics)) {
    process.stderr.write(
      '\nPackage input validation failed. Build the workspace (pnpm build) and ensure the Java helper JAR and Python library are present before packaging.\n',
    );
    process.exit(1);
  }

  process.stderr.write('\nPackage input validation passed.\n');
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
