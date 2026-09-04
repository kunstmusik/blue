#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function assertNoFuse2(report) {
  if (/libfuse\.so\.2/i.test(report)) {
    throw new Error('BLUE_APPIMAGE_LEGACY_FUSE2_DEPENDENCY');
  }
  return true;
}

export function findBundledEngine(extractedRoot) {
  const candidates = [
    join(extractedRoot, 'resources', 'assets', 'engine', 'blue-engine'),
    join(extractedRoot, 'usr', 'lib', 'blue', 'resources', 'assets', 'engine', 'blue-engine'),
  ];
  const enginePath = candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
  if (!enginePath) {
    throw new Error(`BLUE_APPIMAGE_ENGINE_MISSING: tried ${candidates.join(', ')}`);
  }
  return enginePath;
}

function defaultAppImage() {
  return readdirSync(join(appRoot, 'release'))
    .filter((entry) => entry.endsWith('.AppImage'))
    .sort()
    .map((entry) => join(appRoot, 'release', entry))
    .at(-1);
}

function runVerifier(executablePath, userDataPath, extraEnv = {}) {
  const result = spawnSync(executablePath, [], {
    encoding: 'utf8',
    timeout: 90_000,
    env: {
      ...process.env,
      BLUE_VERIFY_MODE: 'packaged-resources',
      BLUE_VERIFY_USER_DATA_PATH: userDataPath,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      ...extraEnv,
    },
  });
  if (result.status !== 0) {
    throw new Error(
      `BLUE_APPIMAGE_RUNTIME_FAILED: ${result.stderr || result.stdout || `status ${result.status}`}`,
    );
  }
}

function main() {
  if (process.platform !== 'linux') {
    throw new Error('BLUE_APPIMAGE_LINUX_REQUIRED');
  }
  const flagIndex = process.argv.indexOf('--appimage');
  const requested = flagIndex === -1 ? defaultAppImage() : process.argv[flagIndex + 1];
  if (!requested) throw new Error('BLUE_APPIMAGE_MISSING: no AppImage was selected');
  const appImage = resolve(requested);
  if (!existsSync(appImage)) {
    throw new Error(`BLUE_APPIMAGE_MISSING: ${appImage}`);
  }
  chmodSync(appImage, 0o755);
  const linkage = spawnSync('ldd', [appImage], { encoding: 'utf8' });
  assertNoFuse2(`${linkage.stdout}\n${linkage.stderr}`);

  const workRoot = mkdtempSync(join(tmpdir(), 'blue-appimage-verify-'));
  const userDataPath = join(workRoot, 'user-data');
  try {
    const extract = spawnSync(appImage, ['--appimage-extract'], {
      cwd: workRoot,
      encoding: 'utf8',
      timeout: 90_000,
    });
    if (extract.status !== 0) {
      throw new Error(`BLUE_APPIMAGE_EXTRACT_FAILED: ${extract.stderr || extract.stdout}`);
    }
    const extractedRoot = join(workRoot, 'squashfs-root');
    const appRun = join(extractedRoot, 'AppRun');
    if (!existsSync(appRun)) throw new Error('BLUE_APPIMAGE_APPRUN_MISSING');
    findBundledEngine(extractedRoot);
    runVerifier(appRun, userDataPath);
    runVerifier(appImage, userDataPath, { APPIMAGE_EXTRACT_AND_RUN: '1' });
    process.stderr.write(
      '[ok] AppImage direct and extracted no-Csound verification passed without FUSE 2\n',
    );
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
