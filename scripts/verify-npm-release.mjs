#!/usr/bin/env node
/**
 * Release manifest, tag/version validation, and idempotent npm publish checks
 * for @kunstmusik/blue-data and @kunstmusik/blue-cli.
 *
 * Subcommands:
 *   validate-tag          [--tag <npm-vX.Y.Z>] [--workspace-root <dir>] [--github-output <path>]
 *   check-registry-absent --version <ver>
 *   create-manifest       --data <tgz> --cli <tgz> --version <ver> --revision <sha> --dist-tag <tag> --out <path> [--github-output <path>]
 *   verify-manifest       --manifest <path> --artifacts-dir <dir> [--expected-version <ver>] [--expected-tag <tag>] [--expected-revision <sha>] [--expected-data-integrity <sri> --expected-cli-integrity <sri>] [--github-output <path>]
 *   publish               --manifest <path> --artifacts-dir <dir> [--expected-version <ver>] [--expected-tag <tag>] [--expected-revision <sha>] [--expected-data-integrity <sri> --expected-cli-integrity <sri>] [--provenance] [--dry-run]
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlags } from './parse-cli-flags.mjs';
import {
  REPO_ROOT,
  STRICT_SEMVER_NO_BUILD,
  readTarballEntries,
  runNpm,
  spawnNpm,
  validateArchiveManifest,
} from './verify-npm-packages.mjs';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;
const SRI_SHA512_PATTERN = /^sha512-[A-Za-z0-9+/]+=*$/;
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/i;

const EXPECTED_PACKAGES = [
  { role: 'data', dir: 'blue-data', publicName: '@kunstmusik/blue-data' },
  { role: 'cli', dir: 'blue-cli', publicName: '@kunstmusik/blue-cli' },
];

/**
 * Derive canonical tag and npm dist-tag metadata from a strict SemVer version (no build metadata).
 *
 * @param {string} version
 * @returns {{ version: string, tag: string, isPrerelease: boolean, distTag: 'latest' | 'next' }}
 */
export function deriveVersionPolicy(version) {
  if (typeof version !== 'string' || !STRICT_SEMVER_NO_BUILD.test(version)) {
    throw new Error(
      `Invalid SemVer version ${JSON.stringify(version)}: expected X.Y.Z or X.Y.Z-prerelease without leading zeros or build metadata.`,
    );
  }
  const isPrerelease = version.includes('-');
  return {
    version,
    tag: `npm-v${version}`,
    isPrerelease,
    distTag: isPrerelease ? 'next' : 'latest',
  };
}

/**
 * Parse and validate an `npm-v<version>` release tag.
 *
 * @param {string} tag
 * @returns {{ tag: string, version: string, isPrerelease: boolean, distTag: 'latest' | 'next' }}
 */
export function parseNpmTag(tag) {
  if (typeof tag !== 'string' || !tag.startsWith('npm-v')) {
    throw new Error(`Invalid npm release tag "${tag}": expected prefix "npm-v".`);
  }
  const version = tag.slice('npm-v'.length);
  try {
    return deriveVersionPolicy(version);
  } catch (error) {
    throw new Error(
      `Invalid npm release tag "${tag}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validate that workspace manifests agree with the expected release version and public publishConfig.
 *
 * @param {{ workspaceRoot?: string, expectedVersion?: string | null }} [options]
 * @returns {{ version: string, packages: Record<string, { version: string, publishName: string }> }}
 */
export function validateWorkspaceVersions({
  workspaceRoot = REPO_ROOT,
  expectedVersion = null,
} = {}) {
  /** @type {Record<string, { version: string, publishName: string }>} */
  const summary = {};
  let agreedVersion =
    expectedVersion !== null ? deriveVersionPolicy(expectedVersion).version : null;

  for (const spec of EXPECTED_PACKAGES) {
    const pkgPath = path.join(workspaceRoot, 'packages', spec.dir, 'package.json');
    if (!existsSync(pkgPath)) {
      throw new Error(`Missing package manifest: ${pkgPath}`);
    }
    const manifest = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const pkgPolicy = deriveVersionPolicy(manifest.version);
    if (!agreedVersion) {
      agreedVersion = pkgPolicy.version;
    } else if (pkgPolicy.version !== agreedVersion) {
      throw new Error(
        `${pkgPath}: version mismatch — expected "${agreedVersion}", found "${pkgPolicy.version}".`,
      );
    }

    const publishConfig = manifest.publishConfig ?? {};
    if (publishConfig.name !== spec.publicName) {
      throw new Error(
        `${pkgPath}: expected publishConfig.name "${spec.publicName}", found ${JSON.stringify(publishConfig.name)}.`,
      );
    }
    if (publishConfig.access !== 'public') {
      throw new Error(
        `${pkgPath}: expected publishConfig.access "public", found ${JSON.stringify(publishConfig.access)}.`,
      );
    }

    summary[spec.publicName] = {
      version: pkgPolicy.version,
      publishName: publishConfig.name,
    };
  }

  return {
    version: /** @type {string} */ (agreedVersion),
    packages: summary,
  };
}

/**
 * Validate a recorded per-package `files` array for uniqueness, strict sorting, and safe paths.
 *
 * @param {unknown} files
 * @param {string} contextLabel
 * @returns {string[]}
 */
function validateArchiveFilesArray(files, contextLabel) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error(`${contextLabel}: files inventory must be a non-empty array.`);
  }
  for (let i = 0; i < files.length; i += 1) {
    const entry = files[i];
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new Error(`${contextLabel}: invalid file inventory entry at index ${i}.`);
    }
    if (
      entry.startsWith('/') ||
      entry.startsWith('package/') ||
      entry.includes('\\') ||
      entry.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')
    ) {
      throw new Error(
        `${contextLabel}: invalid archive file path ${JSON.stringify(entry)} at index ${i}.`,
      );
    }
    if (i > 0) {
      if (entry === files[i - 1]) {
        throw new Error(
          `${contextLabel}: duplicate file inventory entry ${JSON.stringify(entry)}.`,
        );
      }
      if (entry < files[i - 1]) {
        throw new Error(
          `${contextLabel}: file inventory must be sorted (${JSON.stringify(files[i - 1])} before ${JSON.stringify(entry)}).`,
        );
      }
    }
  }
  return [...files];
}

/**
 * Create a digest- and inventory-pinned manifest for the verified pair of npm archives.
 *
 * @param {{
 *   dataPath: string,
 *   cliPath: string,
 *   version: string,
 *   sourceRevision: string,
 *   distTag: 'latest' | 'next',
 * }} options
 */
export async function createReleaseManifest({
  dataPath,
  cliPath,
  version,
  sourceRevision,
  distTag,
}) {
  const policy = deriveVersionPolicy(version);
  if (typeof sourceRevision !== 'string' || !FULL_GIT_SHA.test(sourceRevision)) {
    throw new Error(`Invalid full 40-character git revision: ${JSON.stringify(sourceRevision)}`);
  }
  if (distTag !== policy.distTag) {
    throw new Error(
      `Invalid distTag ${JSON.stringify(distTag)} for version "${policy.version}"; expected "${policy.distTag}".`,
    );
  }

  const dataInfo = readTarballEntries(dataPath);
  const cliInfo = readTarballEntries(cliPath);
  const dataMeta = validateArchiveManifest(dataInfo, 'data', policy.version);
  const cliMeta = validateArchiveManifest(cliInfo, 'cli', policy.version);

  if (dataMeta.version !== cliMeta.version) {
    throw new Error(
      `Archive version mismatch: ${dataMeta.name}@${dataMeta.version} vs ${cliMeta.name}@${cliMeta.version}.`,
    );
  }

  const dataFiles = [...dataInfo.entries.keys()].sort();
  const cliFiles = [...cliInfo.entries.keys()].sort();

  return {
    schemaVersion: 1,
    version: policy.version,
    tag: policy.tag,
    distTag: policy.distTag,
    isPrerelease: policy.isPrerelease,
    sourceRevision,
    generatedAt: new Date().toISOString(),
    packages: [
      {
        role: 'data',
        name: dataMeta.name,
        version: dataMeta.version,
        filename: dataInfo.filename,
        bytes: dataInfo.bytes,
        integrity: dataInfo.integrity,
        sha256: dataInfo.sha256,
        entryCount: dataFiles.length,
        files: dataFiles,
      },
      {
        role: 'cli',
        name: cliMeta.name,
        version: cliMeta.version,
        filename: cliInfo.filename,
        bytes: cliInfo.bytes,
        integrity: cliInfo.integrity,
        sha256: cliInfo.sha256,
        entryCount: cliFiles.length,
        files: cliFiles,
      },
    ],
  };
}

/**
 * Validate a single manifest package record and compare it against its archive bytes and inventory.
 *
 * @param {{
 *   pkg: Record<string, unknown>,
 *   expectedSpec: { role: string, publicName: string },
 *   manifestVersion: string,
 *   artifactsDir: string,
 *   expectedIntegrity?: string | null,
 * }} options
 */
function verifyPackageRecord({
  pkg,
  expectedSpec,
  manifestVersion,
  artifactsDir,
  expectedIntegrity = null,
}) {
  if (pkg.version !== manifestVersion) {
    throw new Error(
      `Manifest entry ${pkg.name} version "${pkg.version}" disagrees with manifest version "${manifestVersion}".`,
    );
  }

  if (
    typeof pkg.filename !== 'string' ||
    pkg.filename.length === 0 ||
    pkg.filename === '.' ||
    pkg.filename === '..' ||
    pkg.filename.includes('/') ||
    pkg.filename.includes('\\') ||
    path.basename(pkg.filename) !== pkg.filename
  ) {
    throw new Error(
      `Manifest entry ${pkg.name} has unsafe or invalid archive filename ${JSON.stringify(pkg.filename)}.`,
    );
  }

  if (!Number.isSafeInteger(pkg.bytes) || pkg.bytes <= 0) {
    throw new Error(
      `Manifest entry ${pkg.name} has invalid byte count ${JSON.stringify(pkg.bytes)}.`,
    );
  }
  if (typeof pkg.integrity !== 'string' || !SRI_SHA512_PATTERN.test(pkg.integrity)) {
    throw new Error(
      `Manifest entry ${pkg.name} has invalid SHA-512 integrity ${JSON.stringify(pkg.integrity)}.`,
    );
  }
  if (typeof pkg.sha256 !== 'string' || !HEX_SHA256_PATTERN.test(pkg.sha256)) {
    throw new Error(
      `Manifest entry ${pkg.name} has invalid SHA-256 digest ${JSON.stringify(pkg.sha256)}.`,
    );
  }
  if (expectedIntegrity && pkg.integrity !== expectedIntegrity) {
    throw new Error(
      `Expected SHA-512 integrity mismatch for ${pkg.name}: manifest has ${pkg.integrity}, expected ${expectedIntegrity}.`,
    );
  }

  const expectedFiles = validateArchiveFilesArray(
    pkg.files,
    `Manifest entry ${expectedSpec.publicName}`,
  );
  if (!Number.isSafeInteger(pkg.entryCount) || pkg.entryCount !== expectedFiles.length) {
    throw new Error(
      `Manifest entry ${pkg.name} entryCount (${pkg.entryCount}) disagrees with files inventory length (${expectedFiles.length}).`,
    );
  }

  const archivePath = path.join(artifactsDir, pkg.filename);
  if (!existsSync(archivePath)) {
    throw new Error(`Missing retained release archive: ${archivePath}`);
  }

  const info = readTarballEntries(archivePath);
  const meta = validateArchiveManifest(info, expectedSpec.role, manifestVersion);
  if (meta.name !== pkg.name || meta.version !== manifestVersion) {
    throw new Error(
      `Archive ${pkg.filename} metadata (${meta.name}@${meta.version}) disagrees with manifest.`,
    );
  }
  if (info.bytes !== pkg.bytes) {
    throw new Error(
      `Archive byte count mismatch for ${pkg.filename}: expected ${pkg.bytes}, got ${info.bytes}.`,
    );
  }
  if (info.integrity !== pkg.integrity) {
    throw new Error(
      `SHA-512 integrity mismatch for ${pkg.filename}: expected ${pkg.integrity}, got ${info.integrity}.`,
    );
  }
  if (info.sha256.toLowerCase() !== pkg.sha256.toLowerCase()) {
    throw new Error(
      `SHA-256 digest mismatch for ${pkg.filename}: expected ${pkg.sha256}, got ${info.sha256}.`,
    );
  }

  const actualFiles = [...info.entries.keys()].sort();
  const expectedSet = new Set(expectedFiles);
  const missingFromArchive = expectedFiles.filter((file) => !info.entries.has(file));
  const unexpectedInArchive = actualFiles.filter((file) => !expectedSet.has(file));
  if (missingFromArchive.length > 0 || unexpectedInArchive.length > 0) {
    throw new Error(
      `Archive file inventory mismatch for ${pkg.filename}: missing=[${missingFromArchive.slice(0, 5).join(', ')}] (${missingFromArchive.length}), unexpected=[${unexpectedInArchive.slice(0, 5).join(', ')}] (${unexpectedInArchive.length}).`,
    );
  }

  return pkg;
}

/**
 * Verify that retained archives in `artifactsDir` match the release manifest, policy, and inventories.
 *
 * @param {{
 *   manifest: Awaited<ReturnType<typeof createReleaseManifest>>,
 *   artifactsDir: string,
 *   expectedVersion?: string | null,
 *   expectedTag?: string | null,
 *   expectedRevision?: string | null,
 *   expectedIntegrities?: { data?: string | null, cli?: string | null } | null,
 * }} options
 */
export async function verifyReleaseManifest({
  manifest,
  artifactsDir,
  expectedVersion = null,
  expectedTag = null,
  expectedRevision = null,
  expectedIntegrities = null,
}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Release manifest is missing or invalid.');
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error(
      `Unsupported manifest schemaVersion: ${JSON.stringify(manifest.schemaVersion)}`,
    );
  }

  const policy = deriveVersionPolicy(manifest.version);
  if (expectedVersion !== null && expectedVersion !== undefined) {
    const expectedPolicy = deriveVersionPolicy(expectedVersion);
    if (manifest.version !== expectedPolicy.version) {
      throw new Error(
        `Release version mismatch: manifest has "${manifest.version}", expected "${expectedPolicy.version}".`,
      );
    }
  }

  if (manifest.tag !== policy.tag) {
    throw new Error(
      `Manifest tag mismatch: expected "${policy.tag}" for version "${policy.version}", found ${JSON.stringify(manifest.tag)}.`,
    );
  }
  if (expectedTag !== null && expectedTag !== undefined) {
    const expectedTagPolicy = parseNpmTag(expectedTag);
    if (manifest.tag !== expectedTagPolicy.tag) {
      throw new Error(
        `Release tag mismatch: manifest has "${manifest.tag}", expected "${expectedTagPolicy.tag}".`,
      );
    }
  }

  if (typeof manifest.isPrerelease !== 'boolean' || manifest.isPrerelease !== policy.isPrerelease) {
    throw new Error(
      `Manifest isPrerelease mismatch: expected ${policy.isPrerelease} for version "${policy.version}", found ${JSON.stringify(manifest.isPrerelease)}.`,
    );
  }
  if (manifest.distTag !== policy.distTag) {
    throw new Error(
      `Manifest distTag mismatch: expected "${policy.distTag}" for version "${policy.version}", found ${JSON.stringify(manifest.distTag)}.`,
    );
  }

  if (typeof manifest.sourceRevision !== 'string' || !FULL_GIT_SHA.test(manifest.sourceRevision)) {
    throw new Error(
      `Manifest sourceRevision must be a full 40-character git SHA, got ${JSON.stringify(manifest.sourceRevision)}.`,
    );
  }
  if (expectedRevision !== null && expectedRevision !== undefined) {
    if (typeof expectedRevision !== 'string' || !FULL_GIT_SHA.test(expectedRevision)) {
      throw new Error(
        `Expected source revision must be a full 40-character git SHA, got ${JSON.stringify(expectedRevision)}.`,
      );
    }
    if (manifest.sourceRevision !== expectedRevision) {
      throw new Error(
        `Source revision mismatch: manifest has "${manifest.sourceRevision}", expected "${expectedRevision}".`,
      );
    }
  }

  if (!Array.isArray(manifest.packages) || manifest.packages.length !== EXPECTED_PACKAGES.length) {
    throw new Error(
      `Release manifest must contain strictly ${EXPECTED_PACKAGES.length} package entries (@kunstmusik/blue-data and @kunstmusik/blue-cli), found ${Array.isArray(manifest.packages) ? manifest.packages.length : typeof manifest.packages}.`,
    );
  }

  /** @type {Map<string, Record<string, unknown>>} */
  const byRole = new Map();
  /** @type {Set<string>} */
  const seenNames = new Set();

  for (const entry of manifest.packages) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Release manifest contains an invalid package entry.');
    }
    const spec = EXPECTED_PACKAGES.find(
      (candidate) => candidate.role === entry.role && candidate.publicName === entry.name,
    );
    if (!spec) {
      throw new Error(
        `Unexpected package entry in release manifest: role=${JSON.stringify(entry.role)}, name=${JSON.stringify(entry.name)}.`,
      );
    }
    if (byRole.has(spec.role) || seenNames.has(spec.publicName)) {
      throw new Error(`Duplicate package entry in release manifest: ${spec.publicName}.`);
    }
    byRole.set(spec.role, /** @type {Record<string, unknown>} */ (entry));
    seenNames.add(spec.publicName);
  }

  const validatedPackages = EXPECTED_PACKAGES.map((expectedSpec) => {
    const pkg = byRole.get(expectedSpec.role);
    if (!pkg) {
      throw new Error(
        `Release manifest is missing required package entry for ${expectedSpec.publicName}.`,
      );
    }
    const expectedIntegrity =
      expectedIntegrities && expectedSpec.role in expectedIntegrities
        ? (expectedIntegrities[/** @type {'data' | 'cli'} */ (expectedSpec.role)] ?? null)
        : null;
    return verifyPackageRecord({
      pkg,
      expectedSpec,
      manifestVersion: policy.version,
      artifactsDir,
      expectedIntegrity,
    });
  });

  return {
    ...manifest,
    packages: validatedPackages,
  };
}

/**
 * Decide whether a package version should be published, skipped safely, or blocked due to conflict.
 *
 * @param {{
 *   pkg: { name: string, version: string, integrity: string },
 *   registryIntegrity: string | null,
 * }} options
 * @returns {{ action: 'publish' } | { action: 'skip', reason: 'matching-integrity' }}
 */
export function decidePublishAction({ pkg, registryIntegrity }) {
  if (registryIntegrity === null || registryIntegrity === undefined) {
    return { action: 'publish' };
  }
  if (registryIntegrity === pkg.integrity) {
    return { action: 'skip', reason: 'matching-integrity' };
  }
  throw new Error(
    `Registry integrity mismatch for ${pkg.name}@${pkg.version}: registry has ${registryIntegrity}, retained archive has ${pkg.integrity}. Refusing to overwrite; cut a new version.`,
  );
}

/**
 * Query npm for the published `dist.integrity` of `<name>@<version>`, returning `null` if absent.
 *
 * @param {{ name: string, version: string }} target
 * @returns {Promise<string | null>}
 */
export async function defaultQueryRegistryIntegrity({ name, version }) {
  const result = spawnNpm(['view', `${name}@${version}`, 'dist.integrity', '--json'], {
    maxBuffer: 4 * 1024 * 1024,
    label: `npm view ${name}@${version} dist.integrity`,
  });

  if (result.status !== 0) {
    const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (/E404|404 Not Found|is not in this registry/i.test(combined)) {
      return null;
    }
    throw new Error(
      `npm view ${name}@${version} dist.integrity failed (${result.status}):\n${combined.trim()}`,
    );
  }

  const trimmed = (result.stdout ?? '').trim();
  if (!trimmed) {
    return null;
  }
  const parsed = JSON.parse(trimmed);
  if (typeof parsed !== 'string' || !parsed) {
    throw new Error(
      `Unexpected npm view response for ${name}@${version} dist.integrity: ${trimmed}`,
    );
  }
  return parsed;
}

/**
 * Assert that neither `@kunstmusik/blue-data@<version>` nor `@kunstmusik/blue-cli@<version>` already exists on npm.
 *
 * Used before packing an initial tagged release run so an already-published version fails fast
 * before creating new archives.
 *
 * @param {{
 *   version: string,
 *   queryRegistryIntegrity?: (target: { name: string, version: string }) => Promise<string | null>,
 * }} options
 */
export async function assertRegistryVersionsAbsent({
  version,
  queryRegistryIntegrity = defaultQueryRegistryIntegrity,
}) {
  const policy = deriveVersionPolicy(version);
  const existing = [];
  for (const spec of EXPECTED_PACKAGES) {
    const integrity = await queryRegistryIntegrity({
      name: spec.publicName,
      version: policy.version,
    });
    if (integrity !== null && integrity !== undefined) {
      existing.push(`${spec.publicName}@${policy.version} (${integrity})`);
    }
  }
  if (existing.length > 0) {
    throw new Error(
      `Registry already contains version ${policy.version} before initial pack: ${existing.join(', ')}. Cut a new version or follow docs/npm-release-guide.md#failure-and-partial-release-recovery.`,
    );
  }
}

/**
 * Publish one exact verified archive via `npm publish`.
 *
 * @param {{
 *   archivePath: string,
 *   distTag: string,
 *   access: string,
 *   provenance: boolean,
 *   dryRun: boolean,
 * }} call
 */
export async function defaultPublishArchive({ archivePath, distTag, access, provenance, dryRun }) {
  const args = ['publish', archivePath, '--access', access, '--tag', distTag];
  if (provenance) {
    args.push('--provenance');
  }
  if (dryRun) {
    args.push('--dry-run');
  }
  runNpm(args, { label: `npm publish ${path.basename(archivePath)}` });
}

/**
 * Publish absent packages from verified retained archives, skipping matches and blocking conflicts.
 *
 * Validates the manifest and archives before performing any registry lookup or publish.
 *
 * @param {{
 *   manifest: Awaited<ReturnType<typeof createReleaseManifest>>,
 *   artifactsDir: string,
 *   expectedVersion?: string | null,
 *   expectedTag?: string | null,
 *   expectedRevision?: string | null,
 *   expectedIntegrities?: { data?: string | null, cli?: string | null } | null,
 *   queryRegistryIntegrity?: (target: { name: string, version: string, pkg: any }) => Promise<string | null>,
 *   publishArchive?: (call: any) => Promise<void>,
 *   provenance?: boolean,
 *   dryRun?: boolean,
 * }} options
 * @returns {Promise<{ published: string[], skipped: string[] }>}
 */
export async function executeReleasePublish({
  manifest,
  artifactsDir,
  expectedVersion = null,
  expectedTag = null,
  expectedRevision = null,
  expectedIntegrities = null,
  queryRegistryIntegrity = defaultQueryRegistryIntegrity,
  publishArchive = defaultPublishArchive,
  provenance = true,
  dryRun = false,
}) {
  const verifiedManifest = await verifyReleaseManifest({
    manifest,
    artifactsDir,
    expectedVersion: expectedVersion ?? manifest?.version ?? null,
    expectedTag,
    expectedRevision: expectedRevision ?? manifest?.sourceRevision ?? null,
    expectedIntegrities,
  });

  /** @type {Array<{ pkg: any, decision: { action: 'publish' | 'skip', reason?: string } }>} */
  const planned = [];
  for (const pkg of verifiedManifest.packages) {
    const registryIntegrity = await queryRegistryIntegrity({
      name: pkg.name,
      version: pkg.version,
      pkg,
    });
    const decision = decidePublishAction({ pkg, registryIntegrity });
    planned.push({ pkg, decision });
  }

  /** @type {string[]} */
  const published = [];
  /** @type {string[]} */
  const skipped = [];

  for (const { pkg, decision } of planned) {
    if (decision.action === 'skip') {
      skipped.push(pkg.name);
      continue;
    }
    const archivePath = path.resolve(artifactsDir, pkg.filename);
    await publishArchive({
      pkg,
      name: pkg.name,
      version: pkg.version,
      archivePath,
      access: 'public',
      distTag: verifiedManifest.distTag,
      provenance,
      dryRun,
    });
    published.push(pkg.name);
  }

  return { published, skipped };
}

/**
 * Append manifest integrity and inventory outputs to `GITHUB_OUTPUT`.
 *
 * @param {string | undefined} githubOutputPath
 * @param {Awaited<ReturnType<typeof createReleaseManifest>>} manifest
 */
function writeManifestOutputs(githubOutputPath, manifest) {
  if (!githubOutputPath || githubOutputPath === 'true') {
    return;
  }
  const dataPkg = manifest.packages.find((pkg) => pkg.role === 'data');
  const cliPkg = manifest.packages.find((pkg) => pkg.role === 'cli');
  if (!dataPkg || !cliPkg) {
    throw new Error('Verified manifest is missing data or cli entry.');
  }
  appendFileSync(
    githubOutputPath,
    [
      `data-integrity=${dataPkg.integrity}`,
      `cli-integrity=${cliPkg.integrity}`,
      `data-entry-count=${dataPkg.entryCount}`,
      `cli-entry-count=${cliPkg.entryCount}`,
      '',
    ].join('\n'),
    'utf8',
  );
}

/**
 * Parse and strictly validate `--expected-data-integrity` / `--expected-cli-integrity` CLI flags.
 *
 * @param {Record<string, string>} flags
 * @returns {{ data: string, cli: string } | null}
 */
function readOptionalIntegrities(flags) {
  const hasData = Object.hasOwn(flags, 'expected-data-integrity');
  const hasCli = Object.hasOwn(flags, 'expected-cli-integrity');
  if (!hasData && !hasCli) {
    return null;
  }
  const data = flags['expected-data-integrity'];
  const cli = flags['expected-cli-integrity'];
  if (!data || data === 'true' || !cli || cli === 'true') {
    throw new Error(
      'Both --expected-data-integrity and --expected-cli-integrity require non-empty SHA-512 SRI digests when specified.',
    );
  }
  return { data, cli };
}

/**
 * Read an optional string CLI flag, rejecting bare `--flag` boolean placeholders.
 *
 * @param {Record<string, string>} flags
 * @param {string} name
 * @returns {string | null}
 */
function readOptionalStringFlag(flags, name) {
  if (!Object.hasOwn(flags, name)) {
    return null;
  }
  const value = flags[name];
  if (!value || value === 'true') {
    throw new Error(`--${name} requires a non-empty value.`);
  }
  return value;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (command === 'validate-tag') {
    const tag = readOptionalStringFlag(flags, 'tag');
    const workspaceRoot = path.resolve(flags['workspace-root'] ?? REPO_ROOT);
    const parsedTag = tag ? parseNpmTag(tag) : null;
    const workspace = validateWorkspaceVersions({
      workspaceRoot,
      expectedVersion: parsedTag ? parsedTag.version : null,
    });
    const policy = deriveVersionPolicy(workspace.version);
    const output = {
      tag: parsedTag?.tag ?? policy.tag,
      version: policy.version,
      distTag: parsedTag?.distTag ?? policy.distTag,
      isPrerelease: parsedTag?.isPrerelease ?? policy.isPrerelease,
    };
    if (flags['github-output'] && flags['github-output'] !== 'true') {
      appendFileSync(
        flags['github-output'],
        [
          `tag=${output.tag}`,
          `version=${output.version}`,
          `dist-tag=${output.distTag}`,
          `is-prerelease=${String(output.isPrerelease)}`,
          '',
        ].join('\n'),
        'utf8',
      );
    }
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  if (command === 'check-registry-absent') {
    const version = readOptionalStringFlag(flags, 'version');
    if (!version) {
      throw new Error('check-registry-absent requires --version <ver>.');
    }
    await assertRegistryVersionsAbsent({ version });
    process.stdout.write(`${JSON.stringify({ version, absent: true }, null, 2)}\n`);
    return;
  }

  if (command === 'create-manifest') {
    const manifest = await createReleaseManifest({
      dataPath: flags.data,
      cliPath: flags.cli,
      version: flags.version,
      sourceRevision: flags.revision,
      distTag: /** @type {'latest' | 'next'} */ (
        flags['dist-tag'] ?? deriveVersionPolicy(flags.version).distTag
      ),
    });
    const outPath = path.resolve(flags.out);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    writeManifestOutputs(flags['github-output'], manifest);
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  if (command === 'verify-manifest') {
    const manifest = JSON.parse(readFileSync(path.resolve(flags.manifest), 'utf8'));
    const verifiedManifest = await verifyReleaseManifest({
      manifest,
      artifactsDir: path.resolve(flags['artifacts-dir']),
      expectedVersion: readOptionalStringFlag(flags, 'expected-version'),
      expectedTag: readOptionalStringFlag(flags, 'expected-tag'),
      expectedRevision: readOptionalStringFlag(flags, 'expected-revision'),
      expectedIntegrities: readOptionalIntegrities(flags),
    });
    writeManifestOutputs(flags['github-output'], verifiedManifest);
    process.stdout.write(
      `${JSON.stringify({ verified: true, version: verifiedManifest.version, sourceRevision: verifiedManifest.sourceRevision }, null, 2)}\n`,
    );
    return;
  }

  if (command === 'publish') {
    const manifest = JSON.parse(readFileSync(path.resolve(flags.manifest), 'utf8'));
    const result = await executeReleasePublish({
      manifest,
      artifactsDir: path.resolve(flags['artifacts-dir']),
      expectedVersion: readOptionalStringFlag(flags, 'expected-version'),
      expectedTag: readOptionalStringFlag(flags, 'expected-tag'),
      expectedRevision: readOptionalStringFlag(flags, 'expected-revision'),
      expectedIntegrities: readOptionalIntegrities(flags),
      provenance: flags.provenance === 'true',
      dryRun: flags['dry-run'] === 'true',
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  throw new Error(
    `Unknown command ${JSON.stringify(command)}. Expected validate-tag, check-registry-absent, create-manifest, verify-manifest, or publish.`,
  );
}

const isEntryPoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
