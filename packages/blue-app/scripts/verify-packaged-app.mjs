#!/usr/bin/env node
/**
 * Installed-package smoke driver.
 *
 * Launches the packaged Blue application in two modes. A direct-spawn
 * `BLUE_VERIFY_MODE=packaged-resources` run checks the Java helper JAR, Python
 * library, ZeroMQ native module, Electron node:sqlite built-in, and externalized
 * workspace packages. `BLUE_VERIFY_MODE=packaged-project` then uses Playwright
 * when available to load a representative .blue file through the normal
 * main-process project path. Both modes exit with a deterministic status code.
 *
 * The driver does not render windows or play audio.
 *
 * Usage:
 *   node packages/blue-app/scripts/verify-packaged-app.mjs \
 *       [--package-dir <path>] [--binary <path>] [--blue-file <path>]
 *       [--no-playwright]
 *
 * --package-dir: directory produced by `electron-builder --dir`
 *   (defaults to packages/blue-app/release/{mac-arm64,mac,win-unpacked,linux-unpacked}
 *    depending on the host platform)
 * --binary: explicit path to the Blue executable inside the package
 * --blue-file: .blue project used by packaged-project verification
 *   (defaults to fixtures/smoke-test.blue)
 * --no-playwright: fall back to a plain child_process.spawn launch when
 *   Playwright is unavailable (useful in environments without Playwright's
 *   Electron entry installed). The verifier exit code is the same.
 *
 * Exit codes:
 *   0 - the packaged application launched and reported verification success.
 *   1 - the packaged application could not be located or reported a failure.
 *   2 - invalid invocation.
 *
 * No secrets are read or logged. Diagnostics come straight from stderr.
 */

import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const appRoot = join(repoRoot, 'packages', 'blue-app');
const releaseDir = join(appRoot, 'release');
const defaultSmokeProject = resolve(repoRoot, 'fixtures', 'smoke-test.blue');
const verifierTimeoutMs = 90_000;

/**
 * Build a minimal environment object for spawned Electron processes.
 * Only forwards variables that the runtime needs, avoiding leakage of
 * unrelated shell credentials into the child.
 *
 * @param {Record<string, string>} extras
 * @returns {Record<string, string>}
 */
function buildMinimalEnv(extras) {
  /** @type {Record<string, string>} */
  const env = {
    HOME: process.env.HOME ?? '',
    PATH: process.env.PATH ?? '',
    TMPDIR: process.env.TMPDIR ?? '',
    LANG: process.env.LANG ?? '',
    ...extras,
  };
  if (process.platform === 'win32') {
    env.APPDATA = process.env.APPDATA ?? '';
    env.USERPROFILE = process.env.USERPROFILE ?? '';
    env.TEMP = process.env.TEMP ?? '';
    env.TMP = process.env.TMP ?? '';
    env.LOCALAPPDATA = process.env.LOCALAPPDATA ?? '';
  }
  if (process.env.DISPLAY) {
    env.DISPLAY = process.env.DISPLAY;
  }
  if (process.env.XAUTHORITY) {
    env.XAUTHORITY = process.env.XAUTHORITY;
  }
  return env;
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseFlags(argv) {
  /** @type {Record<string, string>} */
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = 'true';
      }
    }
  }
  return flags;
}

/**
 * Default per-platform package directory produced by `electron-builder --dir`.
 *
 * @returns {string[]}
 */
function defaultPackageCandidates() {
  /** @type {string[]} */
  const candidates = [];
  if (process.platform === 'darwin') {
    candidates.push(join(releaseDir, 'mac-arm64'));
    candidates.push(join(releaseDir, 'mac'));
    candidates.push(join(releaseDir, 'mac-universal'));
  } else if (process.platform === 'win32') {
    candidates.push(join(releaseDir, 'win-unpacked'));
  } else {
    candidates.push(join(releaseDir, 'linux-unpacked'));
  }
  return candidates;
}

/**
 * Default per-platform binary path inside the unpacked package directory.
 *
 * @param {string} packageDir
 * @returns {string}
 */
function defaultBinaryPath(packageDir) {
  if (process.platform === 'darwin') {
    // electron-builder writes a .app bundle whose Electron binary lives at
    // Contents/MacOS/<productName>.
    return join(packageDir, 'Blue.app', 'Contents', 'MacOS', 'Blue');
  }
  if (process.platform === 'win32') {
    return join(packageDir, 'Blue.exe');
  }
  const candidateLower = join(packageDir, 'blue');
  if (isExecutableFile(candidateLower)) return candidateLower;
  return join(packageDir, 'Blue');
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isExecutableFile(path) {
  try {
    const stats = statSync(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} flagValue
 * @returns {string | null}
 */
function resolveBinary(flagValue) {
  if (flagValue) {
    const explicit = resolve(flagValue);
    if (!isExecutableFile(explicit)) {
      process.stderr.write(`--binary path is not an executable file: ${explicit}\n`);
      return null;
    }
    return explicit;
  }

  for (const candidate of defaultPackageCandidates()) {
    if (!existsSync(candidate)) continue;
    const binary = defaultBinaryPath(candidate);
    if (isExecutableFile(binary)) {
      return binary;
    }
  }
  return null;
}

/**
 * Playwright Electron launch path. Falls back to plain spawn if Playwright
 * is not available so the script remains runnable in minimal environments.
 *
 * @returns {boolean}
 */
function isPlaywrightAvailable() {
  try {
    require.resolve('playwright', { paths: [appRoot] });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} binary
 * @param {'packaged-resources' | 'packaged-project'} verificationMode
 * @param {string | null} blueFile
 * @param {string} userDataPath
 * @returns {Promise<number>}
 */
async function launchViaPlaywright(binary, verificationMode, blueFile, userDataPath) {
  const playwright = require('playwright');
  /** @type {Record<string, string>} */
  const verificationEnv = {
    BLUE_VERIFY_MODE: verificationMode,
    BLUE_VERIFY_USER_DATA_PATH: userDataPath,
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
  };
  if (blueFile) {
    verificationEnv.BLUE_VERIFY_PROJECT_PATH = blueFile;
  }
  const electronApp = await playwright._electron.launch({
    executablePath: binary,
    args: blueFile ? [blueFile] : [],
    env: buildMinimalEnv(verificationEnv),
    timeout: 60_000,
  });

  try {
    const exitCode = await electronApp.waitForEvent('exit', { timeout: verifierTimeoutMs });
    return typeof exitCode === 'number' ? exitCode : 1;
  } catch (error) {
    process.stderr.write(
      `[verify-packaged-app] verifier did not exit cleanly: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    try {
      await electronApp.close();
    } catch {
      // ignore
    }
    return 1;
  }
}

/**
 * @param {string} binary
 * @param {'packaged-resources' | 'packaged-project'} verificationMode
 * @param {string | null} blueFile
 * @param {string} userDataPath
 * @returns {Promise<number>}
 */
function launchViaSpawn(binary, verificationMode, blueFile, userDataPath) {
  return new Promise((resolvePromise) => {
    /** @type {Record<string, string>} */
    const verificationEnv = {
      BLUE_VERIFY_MODE: verificationMode,
      BLUE_VERIFY_USER_DATA_PATH: userDataPath,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    };
    if (blueFile) {
      verificationEnv.BLUE_VERIFY_PROJECT_PATH = blueFile;
    }
    const env = buildMinimalEnv(verificationEnv);

    /** @type {string[]} */
    const args = blueFile ? [blueFile] : [];
    process.stderr.write(
      `[verify-packaged-app] launching ${verificationMode}: ${binary} ${args.join(' ')}\n`,
    );

    const child = spawn(binary, args, {
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    let finished = false;
    const finish = (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolvePromise(code);
    };
    const timeout = setTimeout(() => {
      process.stderr.write(
        `[verify-packaged-app] ${verificationMode} timed out after ${verifierTimeoutMs}ms\n`,
      );
      child.kill();
      finish(1);
    }, verifierTimeoutMs);

    child.on('error', (error) => {
      process.stderr.write(
        `[verify-packaged-app] failed to spawn: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      finish(1);
    });

    child.on('close', (code) => {
      finish(typeof code === 'number' ? code : 1);
    });
  });
}

/**
 * @param {string} binary
 * @param {'packaged-resources' | 'packaged-project'} verificationMode
 * @param {string | null} blueFile
 * @param {boolean} usePlaywright
 * @param {string} userDataPath
 * @returns {Promise<number>}
 */
async function runVerifier(binary, verificationMode, blueFile, usePlaywright, userDataPath) {
  if (usePlaywright && isPlaywrightAvailable()) {
    try {
      return await launchViaPlaywright(binary, verificationMode, blueFile, userDataPath);
    } catch (error) {
      process.stderr.write(
        `[verify-packaged-app] Playwright launch failed, falling back to spawn: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }
  return launchViaSpawn(binary, verificationMode, blueFile, userDataPath);
}

/**
 * @param {string} binary
 * @param {string} blueFile
 * @param {boolean} usePlaywright
 * @returns {Promise<number>}
 */
async function runSmokeChecks(binary, blueFile, usePlaywright) {
  const userDataPath = mkdtempSync(join(tmpdir(), 'blue-packaged-smoke-'));
  try {
    // The resource verifier exits before Electron opens Playwright's control
    // channel, so launch that fast pre-ready stage directly.
    const resourcesCode = await launchViaSpawn(
      binary,
      'packaged-resources',
      null,
      userDataPath,
    );
    if (resourcesCode !== 0) {
      return resourcesCode;
    }
    return runVerifier(
      binary,
      'packaged-project',
      blueFile,
      usePlaywright,
      userDataPath,
    );
  } finally {
    rmSync(userDataPath, { recursive: true, force: true });
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const blueFile = flags['blue-file'] ? resolve(flags['blue-file']) : defaultSmokeProject;
  const usePlaywright = flags['no-playwright'] !== 'true';

  if (!existsSync(blueFile)) {
    process.stderr.write(`--blue-file not found: ${blueFile}\n`);
    process.exit(2);
  }

  if (flags['package-dir']) {
    const packageDir = resolve(flags['package-dir']);
    if (!existsSync(packageDir)) {
      process.stderr.write(`--package-dir not found: ${packageDir}\n`);
      process.exit(2);
    }
    const binary = defaultBinaryPath(packageDir);
    if (!isExecutableFile(binary)) {
      process.stderr.write(
        `Could not find Blue executable inside ${packageDir}: expected ${binary}\n`,
      );
      process.exit(1);
    }
    const code = await runSmokeChecks(binary, blueFile, usePlaywright);
    process.exit(code);
  }

  const binary = resolveBinary(flags.binary);
  if (!binary) {
    process.stderr.write(
      'Packaged Blue application not found. Run `pnpm --filter @blue/app package:dir` first.\n' +
        `Looked under: ${releaseDir}\n`,
    );
    process.exit(1);
  }

  const code = await runSmokeChecks(binary, blueFile, usePlaywright);
  process.exit(code);
}

main().catch((error) => {
  process.stderr.write(
    `[verify-packaged-app] crashed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
