#!/usr/bin/env node
/**
 * Release asset manifest and checksum generation/validation.
 *
 * Generates a deterministic machine-readable manifest of native package
 * outputs or legacy platform ZIP bundles. The manifest is the single source of
 * truth used by the final release promoter to verify that every required
 * target is present and intact.
 *
 * Manifest shape (matches specs/062-app-release-builds/data-model.md):
 *   {
 *     "version": 1,
 *     "appVersion": string,            // packages/blue-app/package.json version
 *     "sourceRevision": string,        // git SHA or "unknown" when git is unavailable
 *     "engine": {
 *       "protocolVersion": number,
 *       "sourceRevision": string,
 *       "verificationStatus": "pending" | "verified"
 *     },
 *     "generatedAt": string,           // ISO8601 UTC
 *     "targets": [
 *       {
 *         "targetId": "macos-x64" | "macos-arm64" | "windows-x64" | "linux-x64",
 *         "platform": "macOS" | "Windows" | "Linux",
 *         "arch": "x64" | "arm64",
 *         "format": "DMG" | "NSIS" | "AppImage" | "Deb" | "ZIP",
 *         "path": string,              // portable file name beside the manifest
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
 *       [--source-revision <sha>] [--asset-mode packages|bundles] \
 *       [--verification-status pending|verified] [--checksums-out <path>]
 *
 *   node scripts/release-artifact-manifest.mjs validate \
 *       --manifest <manifest.json> [--asset-mode packages|bundles] \
 *       [--expected-targets macos-arm64,windows-x64,linux-x64] \
 *       [--require-verified] [--app-version <ver>] [--source-revision <sha>]
 *
 * The script never logs secret values: it only reads filesystem paths and
 * hashes published package bytes.
 */

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, createReadStream } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const appPkgPath = join(repoRoot, 'packages', 'blue-app', 'package.json');

/** @typedef {'macos-x64' | 'macos-arm64' | 'windows-x64' | 'linux-x64'} TargetId */
/** @typedef {'packages' | 'bundles'} AssetMode */

const PACKAGE_TARGET_DEFINITIONS = /** @type {const} */ ([
  { targetId: 'macos-x64', platform: 'macOS', arch: 'x64', format: 'DMG', extensions: ['.dmg'] },
  { targetId: 'macos-arm64', platform: 'macOS', arch: 'arm64', format: 'DMG', extensions: ['.dmg'] },
  { targetId: 'windows-x64', platform: 'Windows', arch: 'x64', format: 'NSIS', extensions: ['.exe'] },
  { targetId: 'linux-x64', platform: 'Linux', arch: 'x64', format: 'AppImage', extensions: ['.AppImage'] },
  { targetId: 'linux-x64', platform: 'Linux', arch: 'x64', format: 'Deb', extensions: ['.deb'] },
]);

const BUNDLE_TARGET_DEFINITIONS = /** @type {const} */ ([
  { targetId: 'macos-arm64', platform: 'macOS', arch: 'arm64', format: 'ZIP' },
  { targetId: 'windows-x64', platform: 'Windows', arch: 'x64', format: 'ZIP' },
  { targetId: 'linux-x64', platform: 'Linux', arch: 'x64', format: 'ZIP' },
]);

const DEFAULT_TARGET_IDS = ['macos-arm64', 'windows-x64', 'linux-x64'];

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
 * @returns {string[]}
 */
function findPackageFilesForTarget(target, releaseDir, appVersion) {
  if (!existsSync(releaseDir)) {
    return [];
  }
  // electron-builder emits files like:
  //   Blue-0.0.1-arm64.dmg
  //   Blue-0.0.1-x64.dmg
  //   blue-macos-arm64-0.0.1.dmg
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
    return [];
  }

  /** @type {string[]} */
  const matches = [];
  // Architecture token filter
  const archTokens = target.arch === 'arm64' ? ['arm64', 'aarch64'] : ['x64', 'amd64', 'x86_64'];
  for (const ext of target.extensions) {
    for (const entry of entries) {
      if (!entry.endsWith(ext)) continue;
      const lower = entry.toLowerCase();
      if (!lower.includes(appVersion.toLowerCase())) continue;

      if (target.platform === 'macOS' && target.format === 'DMG') {
        const builderName = lower.endsWith(`-${target.arch}.dmg`);
        const standardizedName = lower === `blue-${target.targetId}-${appVersion.toLowerCase()}.dmg`;
        if (!builderName && !standardizedName) continue;
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
      matches.push(join(releaseDir, entry));
    }
  }
  return matches;
}

/**
 * @param {string} targetId
 * @param {string} appVersion
 * @returns {string}
 */
function bundleFileName(targetId, appVersion) {
  return `blue-${targetId}-${appVersion}.zip`;
}

/**
 * @param {AssetMode} mode
 */
function definitionsForMode(mode) {
  return mode === 'bundles' ? BUNDLE_TARGET_DEFINITIONS : PACKAGE_TARGET_DEFINITIONS;
}

async function generate(flags) {
  const outPath = flags.out ? resolve(flags.out) : join(process.cwd(), 'release-manifest.json');
  const releaseDir = flags['release-dir']
    ? resolve(flags['release-dir'])
    : join(repoRoot, 'packages', 'blue-app', 'release');
  const { appVersion } = flags['app-version'] ? { appVersion: flags['app-version'] } : readAppVersion();
  const sourceRevision = flags['source-revision'] ?? detectSourceRevision();
  const mode = flags['asset-mode'] === 'bundles' ? 'bundles' : 'packages';
  const verificationStatus = flags['verification-status'] ?? 'pending';
  const engineProtocolVersion = Number(flags['engine-protocol-version'] ?? 1);
  if (verificationStatus !== 'pending' && verificationStatus !== 'verified') {
    throw new Error(`Unsupported --verification-status value: ${verificationStatus}`);
  }
  if (!Number.isSafeInteger(engineProtocolVersion) || engineProtocolVersion < 1) {
    throw new Error(`Unsupported --engine-protocol-version value: ${flags['engine-protocol-version']}`);
  }

  /** @type {Array<Record<string, unknown>>} */
  const targets = [];

  for (const def of definitionsForMode(mode)) {
    const matches =
      mode === 'bundles'
        ? [join(releaseDir, bundleFileName(def.targetId, appVersion))].filter((filePath) => existsSync(filePath))
        : findPackageFilesForTarget(
            /** @type {typeof PACKAGE_TARGET_DEFINITIONS[number]} */ (def),
            releaseDir,
            appVersion,
          );
    if (matches.length === 0) {
      process.stderr.write(`[skip] ${def.targetId}/${def.format}: no package file in ${releaseDir}\n`);
      continue;
    }
    if (matches.length > 1) {
      throw new Error(
        `Duplicate ${def.targetId}/${def.format} assets: ${matches.map((match) => basename(match)).join(', ')}`,
      );
    }
    const [filePath] = matches;
    const stats = statSync(filePath);
    const sha256 = await computeSha256(filePath);
    targets.push({
      targetId: def.targetId,
      platform: def.platform,
      arch: def.arch,
      format: def.format,
      path: basename(filePath),
      size: stats.size,
      sha256,
      verificationStatus,
    });
    process.stderr.write(`[ok] ${def.targetId}/${def.format}: ${filePath}\n`);
  }

  const manifest = {
    version: 1,
    appVersion,
    sourceRevision,
    engine: {
      protocolVersion: engineProtocolVersion,
      sourceRevision,
      verificationStatus,
    },
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
  const checksumPath = flags['checksums-out'] ? resolve(flags['checksums-out']) : `${outPath}.sha256`;
  const checksumText = targets
    .map((t) => `${t.sha256}  ${basename(/** @type {string} */ (t.path))}`)
    .join('\n');
  writeFileSync(checksumPath, `${checksumText}\n`, 'utf-8');
  process.stderr.write(`Checksums:        ${checksumPath}\n`);
}

/**
 * @param {Record<string, string>} flags
 */
async function validate(flags) {
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

  const mode = flags['asset-mode'] === 'bundles' ? 'bundles' : 'packages';
  const defaultTargetIds =
    mode === 'bundles'
      ? DEFAULT_TARGET_IDS
      : Array.from(new Set(PACKAGE_TARGET_DEFINITIONS.map((definition) => definition.targetId)));
  const requiredTargetIds = flags['expected-targets']
    ? flags['expected-targets'].split(',').map((s) => s.trim()).filter(Boolean)
    : defaultTargetIds;
  const definitions = definitionsForMode(mode);
  const requiredDefinitions = definitions.filter((def) => requiredTargetIds.includes(def.targetId));
  const expectedKeys = requiredDefinitions.map((def) => `${def.targetId}:${def.format}`);
  const manifestDir = dirname(manifestPath);

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const seenTargetIds = [];
  /** @type {string[]} */
  const seenKeys = [];

  if (!manifest.engine || typeof manifest.engine !== 'object') {
    errors.push('Manifest engine metadata is missing.');
  } else {
    const expectedProtocolVersion = Number(flags['engine-protocol-version'] ?? 1);
    if (manifest.engine.protocolVersion !== expectedProtocolVersion) {
      errors.push(
        `Manifest engine protocolVersion "${manifest.engine.protocolVersion}" does not match "${expectedProtocolVersion}".`,
      );
    }
    if (manifest.engine.sourceRevision !== manifest.sourceRevision) {
      errors.push('Manifest engine sourceRevision does not match the application sourceRevision.');
    }
    if (flags['require-verified'] === 'true' &&
        manifest.engine.verificationStatus !== 'verified') {
      errors.push('Manifest engine verificationStatus must be "verified".');
    }
  }

  for (const target of manifest.targets) {
    if (!target || typeof target !== 'object') {
      errors.push('Manifest target entry is not an object.');
      continue;
    }
    const targetId = String(target.targetId ?? '');
    const format = String(target.format ?? '');
    const sha = String(target.sha256 ?? '');
    const packagePath = String(target.path ?? '');
    const size = Number(target.size);
    const verificationStatus = String(target.verificationStatus ?? '');
    const key = `${targetId}:${format}`;
    if (!targetId) {
      errors.push('Manifest target missing targetId.');
      continue;
    }
    if (!format) {
      errors.push(`Target ${targetId} missing format.`);
      continue;
    }
    if (!expectedKeys.includes(key)) {
      errors.push(`Unexpected target or format in manifest: ${key}`);
      continue;
    }
    const expectedDefinition = requiredDefinitions.find(
      (definition) => definition.targetId === targetId && definition.format === format,
    );
    if (!expectedDefinition) {
      errors.push(`No expected definition found for manifest target: ${key}`);
      continue;
    }
    if (target.platform !== expectedDefinition.platform) {
      errors.push(`Target ${targetId} platform must be "${expectedDefinition.platform}".`);
    }
    if (target.arch !== expectedDefinition.arch) {
      errors.push(`Target ${targetId} architecture must be "${expectedDefinition.arch}".`);
    }
    if (!/^[0-9a-f]{64}$/i.test(sha)) {
      errors.push(`Target ${targetId} sha256 is not a valid 64-char hex digest.`);
      continue;
    }
    if (!packagePath || basename(packagePath) !== packagePath) {
      errors.push(`Target ${targetId} path must be a portable file name: ${packagePath}`);
      continue;
    }
    if (
      mode === 'bundles' &&
      packagePath !== bundleFileName(targetId, String(manifest.appVersion))
    ) {
      errors.push(`Target ${targetId} path does not match its required stable ZIP name: ${packagePath}`);
      continue;
    }
    const resolvedPackagePath = join(manifestDir, packagePath);
    if (!existsSync(resolvedPackagePath)) {
      errors.push(`Target ${targetId} path is missing or unreachable: ${packagePath}`);
      continue;
    }
    const stats = statSync(resolvedPackagePath);
    if (!Number.isSafeInteger(size) || size <= 0 || stats.size !== size) {
      errors.push(`Target ${targetId} size does not match ${packagePath}.`);
      continue;
    }
    const actualSha = await computeSha256(resolvedPackagePath);
    if (actualSha !== sha) {
      errors.push(`Target ${targetId} sha256 does not match ${packagePath}.`);
      continue;
    }
    if (flags['require-verified'] === 'true' && verificationStatus !== 'verified') {
      errors.push(`Target ${targetId} verificationStatus must be "verified".`);
      continue;
    }
    seenTargetIds.push(targetId);
    seenKeys.push(key);
  }

  for (const required of requiredTargetIds) {
    if (!seenTargetIds.includes(required)) {
      errors.push(`Required target missing from manifest: ${required}`);
    }
  }

  for (const requiredKey of expectedKeys) {
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

  if (typeof flags['app-version'] === 'string' && manifest.appVersion !== flags['app-version']) {
    errors.push(`Manifest appVersion "${manifest.appVersion}" does not match "${flags['app-version']}".`);
  }
  if (typeof flags['source-revision'] === 'string' && manifest.sourceRevision !== flags['source-revision']) {
    errors.push(`Manifest sourceRevision "${manifest.sourceRevision}" does not match "${flags['source-revision']}".`);
  }

  if (mode === 'bundles') {
    const expectedFiles = requiredDefinitions.map((def) => bundleFileName(def.targetId, String(manifest.appVersion)));
    const actualFiles = readdirSync(manifestDir).filter((entry) => /^blue-.+\.zip$/.test(entry));
    for (const expectedFile of expectedFiles) {
      if (!actualFiles.includes(expectedFile)) {
        errors.push(`Required release ZIP missing beside manifest: ${expectedFile}`);
      }
    }
    for (const actualFile of actualFiles) {
      if (!expectedFiles.includes(actualFile)) {
        errors.push(`Unexpected release ZIP beside manifest: ${actualFile}`);
      }
    }
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
      validate(flags).catch((error) => {
        process.stderr.write(
          `Manifest validation error: ${error instanceof Error ? error.message : String(error)}\n`,
        );
        process.exit(1);
      });
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
      '  release-artifact-manifest.mjs validate --manifest <manifest.json> [--asset-mode packages|bundles] [--expected-targets macos-arm64,windows-x64,linux-x64]\n',
  );
  process.exit(2);
}

main();
