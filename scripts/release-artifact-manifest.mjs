#!/usr/bin/env node
/**
 * Release asset manifest and checksum generation/validation.
 *
 * Generates a deterministic machine-readable manifest of the package outputs
 * produced by electron-builder. The manifest is the single source of truth
 * used by the final release promoter to verify that every required target is
 * present and intact before publishing a stable GitHub Release.
 *
 * Manifest shape (matches specs/062-app-release-builds/data-model.md):
 *   {
 *     "version": 1,
 *     "appVersion": string,            // packages/blue-app/package.json version
 *     "sourceRevision": string,        // git SHA or "unknown" when git is unavailable
 *     "generatedAt": string,           // ISO8601 UTC
 *     "targets": [
 *       {
 *         "targetId": "macos-x64" | "macos-arm64" | "windows-x64" | "linux-x64",
 *         "platform": "macOS" | "Windows" | "Linux",
 *         "arch": "x64" | "arm64",
 *         "format": "DMG" | "NSIS" | "AppImage" | "Deb",
 *         "path": string,              // absolute path to the package file
 *         "size": number,              // file size in bytes
 *         "sha256": string,            // hex digest of SHA-256
 *         "verificationStatus": "pending" | "verified"
 *       }
 *     ]
 *   }
 *
 * Usage:
 *   node scripts/release-artifact-manifest.mjs generate \
 *       --out <manifest.json> [--release-dir <dir>] [--app-version <ver>] \
 *       [--source-revision <sha>]
 *
 *   node scripts/release-artifact-manifest.mjs validate \
 *       --manifest <manifest.json> [--expected-targets macos-x64,macos-arm64,...]
 *
 * The script never logs secret values: it only reads filesystem paths and
 * hashes published package bytes.
 */

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, createReadStream } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const appPkgPath = join(repoRoot, 'packages', 'blue-app', 'package.json');

/** @typedef {'macos-x64' | 'macos-arm64' | 'windows-x64' | 'linux-x64'} TargetId */

const TARGET_DEFINITIONS = /** @type {const} */ ([
  { targetId: 'macos-x64', platform: 'macOS', arch: 'x64', format: 'DMG', extensions: ['.dmg'] },
  { targetId: 'macos-arm64', platform: 'macOS', arch: 'arm64', format: 'DMG', extensions: ['.dmg'] },
  { targetId: 'windows-x64', platform: 'Windows', arch: 'x64', format: 'NSIS', extensions: ['.exe'] },
  { targetId: 'linux-x64', platform: 'Linux', arch: 'x64', format: 'AppImage', extensions: ['.AppImage'] },
  { targetId: 'linux-x64', platform: 'Linux', arch: 'x64', format: 'Deb', extensions: ['.deb'] },
]);

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
function computeSha256(filePath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', rejectPromise);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolvePromise(hash.digest('hex')));
  });
}

/**
 * @returns {{ appVersion: string }}
 */
function readAppVersion() {
  if (!existsSync(appPkgPath)) {
    throw new Error(`Cannot read app package.json at ${appPkgPath}`);
  }
  const parsed = JSON.parse(readFileSync(appPkgPath, 'utf-8'));
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error('packages/blue-app/package.json is missing a "version" string');
  }
  return { appVersion: parsed.version };
}

/**
 * @returns {string}
 */
function detectSourceRevision() {
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
      return 'unknown';
    }
    return sha;
  } catch {
    return 'unknown';
  }
}

/**
 * Parse argv into a flag map.
 *
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
 * Resolve a package file for the given target by walking the release dir.
 *
 * @param {{ targetId: TargetId, platform: string, arch: string, format: string, extensions: readonly string[] }} target
 * @param {string} releaseDir
 * @param {string} appVersion
 * @returns {string | null}
 */
function findPackageFileForTarget(target, releaseDir, appVersion) {
  if (!existsSync(releaseDir)) {
    return null;
  }
  // electron-builder emits files like:
  //   Blue-0.0.1-arm64.dmg
  //   Blue-0.0.1-x64.dmg
  //   Blue Setup 0.0.1.exe
  //   Blue-0.0.1.AppImage
  //   Blue_0.0.1_amd64.deb
  // Match by extension and then by architecture/version hints. We keep the
  // matchers conservative so an unexpected sibling file does not satisfy the
  // manifest.
  let entries = [];
  try {
    entries = readdirSync(releaseDir);
  } catch {
    return null;
  }

  // Architecture token filter
  const archTokens = target.arch === 'arm64' ? ['arm64', 'aarch64'] : ['x64', 'amd64', 'x86_64'];
  for (const ext of target.extensions) {
    for (const entry of entries) {
      if (!entry.endsWith(ext)) continue;
      const lower = entry.toLowerCase();
      if (!lower.includes(appVersion.toLowerCase())) continue;

      if (target.platform === 'macOS' && target.format === 'DMG') {
        if (!lower.endsWith(`-${target.arch}.dmg`)) continue;
      } else if (target.platform === 'Windows') {
        // NSIS produces "Blue Setup 0.0.1.exe"; accept any .exe that includes
        // the version. The promoter verifies the final asset list explicitly.
        if (!lower.endsWith('.exe')) continue;
      } else if (target.platform === 'Linux' && target.format === 'AppImage') {
        if (!lower.endsWith('.appimage')) continue;
        if (target.arch === 'arm64' && !archTokens.some((t) => lower.includes(t))) continue;
        if (target.arch === 'x64' && lower.includes('arm64')) continue;
      } else if (target.platform === 'Linux' && target.format === 'Deb') {
        if (!lower.endsWith('.deb')) continue;
        if (!archTokens.some((t) => lower.includes(t))) continue;
      }
      return join(releaseDir, entry);
    }
  }
  return null;
}

async function generate(flags) {
  const outPath = flags.out ? resolve(flags.out) : join(process.cwd(), 'release-manifest.json');
  const releaseDir = flags['release-dir']
    ? resolve(flags['release-dir'])
    : join(repoRoot, 'packages', 'blue-app', 'release');
  const { appVersion } = flags['app-version'] ? { appVersion: flags['app-version'] } : readAppVersion();
  const sourceRevision = flags['source-revision'] ?? detectSourceRevision();

  /** @type {Array<Record<string, unknown>>} */
  const targets = [];

  for (const def of TARGET_DEFINITIONS) {
    const filePath = findPackageFileForTarget(def, releaseDir, appVersion);
    if (!filePath) {
      process.stderr.write(`[skip] ${def.targetId}/${def.format}: no package file in ${releaseDir}\n`);
      continue;
    }
    const stats = statSync(filePath);
    const sha256 = await computeSha256(filePath);
    targets.push({
      targetId: def.targetId,
      platform: def.platform,
      arch: def.arch,
      format: def.format,
      path: filePath,
      size: stats.size,
      sha256,
      verificationStatus: 'pending',
    });
    process.stderr.write(`[ok] ${def.targetId}/${def.format}: ${filePath}\n`);
  }

  const manifest = {
    version: 1,
    appVersion,
    sourceRevision,
    generatedAt: new Date().toISOString(),
    targets,
  };

  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  process.stderr.write(`\nManifest written: ${outPath}\n`);
  process.stderr.write(`Targets described: ${targets.length}\n`);

  if (targets.length === 0) {
    process.stderr.write('Warning: manifest contains no targets. Did the package build run first?\n');
  }

  // Write a combined checksum file next to the manifest for upload convenience.
  const checksumPath = `${outPath}.sha256`;
  const checksumText = targets
    .map((t) => `${t.sha256}  ${basename(/** @type {string} */ (t.path))}`)
    .join('\n');
  writeFileSync(checksumPath, `${checksumText}\n`, 'utf-8');
  process.stderr.write(`Checksums:        ${checksumPath}\n`);
}

/**
 * @param {Record<string, string>} flags
 */
function validate(flags) {
  const manifestPath = flags.manifest ? resolve(flags.manifest) : null;
  if (!manifestPath || !existsSync(manifestPath)) {
    process.stderr.write(`Manifest not found: ${manifestPath ?? '(no --manifest flag provided)'}\n`);
    process.exit(1);
  }

  /** @type {any} */
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (error) {
    process.stderr.write(
      `Manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }

  if (!Array.isArray(manifest?.targets)) {
    process.stderr.write('Manifest "targets" field is missing or not an array.\n');
    process.exit(1);
  }

  const requiredTargetIds = flags['expected-targets']
    ? flags['expected-targets'].split(',').map((s) => s.trim()).filter(Boolean)
    : ['macos-x64', 'macos-arm64', 'windows-x64', 'linux-x64'];

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const seenTargetIds = [];
  /** @type {string[]} */
  const seenKeys = [];

  for (const target of manifest.targets) {
    if (!target || typeof target !== 'object') {
      errors.push('Manifest target entry is not an object.');
      continue;
    }
    const targetId = String(target.targetId ?? '');
    const format = String(target.format ?? '');
    const sha = String(target.sha256 ?? '');
    const packagePath = String(target.path ?? '');
    if (!targetId) {
      errors.push('Manifest target missing targetId.');
      continue;
    }
    if (!format) {
      errors.push(`Target ${targetId} missing format.`);
      continue;
    }
    if (!/^[0-9a-f]{64}$/i.test(sha)) {
      errors.push(`Target ${targetId} sha256 is not a valid 64-char hex digest.`);
      continue;
    }
    if (!packagePath || !existsSync(packagePath)) {
      errors.push(`Target ${targetId} path is missing or unreachable: ${packagePath}`);
      continue;
    }
    seenTargetIds.push(targetId);
    seenKeys.push(`${targetId}:${format}`);
  }

  for (const required of requiredTargetIds) {
    if (!seenTargetIds.includes(required)) {
      errors.push(`Required target missing from manifest: ${required}`);
    }
  }

  const requiredKeys = TARGET_DEFINITIONS
    .filter((def) => requiredTargetIds.includes(def.targetId))
    .map((def) => `${def.targetId}:${def.format}`);
  for (const requiredKey of requiredKeys) {
    if (!seenKeys.includes(requiredKey)) {
      errors.push(`Required target format missing from manifest: ${requiredKey}`);
    }
  }

  // Detect duplicate target/format pairs inside the manifest. Linux x64 is
  // expected to appear twice, once for AppImage and once for Deb.
  const duplicates = seenKeys.filter((key, index) => seenKeys.indexOf(key) !== index);
  for (const duplicate of Array.from(new Set(duplicates))) {
    errors.push(`Duplicate target format entries in manifest: ${duplicate}`);
  }

  if (errors.length > 0) {
    process.stderr.write('Manifest validation failed:\n');
    for (const error of errors) {
      process.stderr.write(`  - ${error}\n`);
    }
    process.exit(1);
  }

  process.stderr.write(`Manifest validated. Targets: ${seenKeys.join(', ')}\n`);
  process.exit(0);
}

function main() {
  const [, , subcommand, ...rest] = process.argv;
  const flags = parseFlags(rest);

  if (subcommand === 'generate') {
    generate(flags).catch((error) => {
      process.stderr.write(
        `Manifest generation failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(1);
    });
    return;
  }

  if (subcommand === 'validate') {
    try {
      validate(flags);
    } catch (error) {
      process.stderr.write(
        `Manifest validation error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(1);
    }
    return;
  }

  process.stderr.write(
    'Usage:\n' +
      '  release-artifact-manifest.mjs generate --out <manifest.json> [--release-dir <dir>] [--app-version <ver>] [--source-revision <sha>]\n' +
      '  release-artifact-manifest.mjs validate --manifest <manifest.json> [--expected-targets macos-x64,macos-arm64,windows-x64,linux-x64]\n',
  );
  process.exit(2);
}

main();
