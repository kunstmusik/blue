#!/usr/bin/env node
/**
 * Development and stable release metadata derivation.
 *
 * Produces a release-metadata.json file describing the source revision and a
 * generated prerelease version, without mutating packages/blue-app/package.json
 * and without creating a repository tag. The generated prerelease version uses
 * the package version as the base and appends a `-dev.<timestamp>.<short-sha>`
 * pre-release identifier so GitHub Releases can label the artifact set
 * deterministically.
 *
 * Usage:
 *   node scripts/release-metadata.mjs \
 *       --out <release-metadata.json> \
 *       [--channel development|stable] \
 *       [--app-version <ver>] \
 *       [--source-revision <sha>] \
 *       [--prerelease-timestamp <unix-seconds>]
 *
 * Output shape:
 *   {
 *     "channel": "development" | "stable",
 *     "appVersion": string,
 *     "sourceRevision": string,
 *     "generatedAt": string,
 *     "releaseVersion": string,
 *     "releaseName": string,
 *     "releaseNotes": string
 *   }
 *
 * Stable releases do not use this script: the tag itself is the version. The
 * stable workflow calls verify-release-version.mjs instead. This script
 * remains safe to invoke for stable channels so a single runner can emit a
 * manifest for both kinds, but the releaseVersion will simply equal
 * appVersion in that case.
 *
 * No secrets are read or logged.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const appPkgPath = join(repoRoot, 'packages', 'blue-app', 'package.json');

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
 * @returns {string}
 */
function readAppVersion() {
  if (!existsSync(appPkgPath)) {
    throw new Error(`Cannot read app package.json at ${appPkgPath}`);
  }
  const parsed = JSON.parse(readFileSync(appPkgPath, 'utf-8'));
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error('packages/blue-app/package.json is missing a "version" string');
  }
  return parsed.version;
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
 * @param {string} sha
 * @returns {string}
 */
function shortSha(sha) {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    return 'unknown';
  }
  return sha.slice(0, 7);
}

/**
 * @param {string} appVersion
 * @param {string} sha
 * @param {number} timestamp
 * @param {string} channel
 * @returns {string}
 */
function buildReleaseVersion(appVersion, sha, timestamp, channel) {
  if (channel === 'stable') {
    return appVersion;
  }
  // Strip any existing prerelease suffix from appVersion so we never compose
  // something like "0.0.1-dev-dev...".
  const base = appVersion.split('-')[0];
  const short = shortSha(sha);
  const utcDate = new Date(timestamp * 1000);
  // YYYYMMDD-HHMM in UTC keeps generated prerelease versions sortable and
  // avoids local-timezone drift between runners.
  const stamp = utcDate.toISOString().slice(0, 10).replace(/-/g, '') + '-' + utcDate.toISOString().slice(11, 16).replace(':', '');
  return `${base}-dev.${stamp}.${short}`;
}

/**
 * @param {string} channel
 * @param {string} releaseVersion
 * @param {string} sha
 * @returns {{ name: string, notes: string }}
 */
function buildReleaseNameAndNotes(channel, releaseVersion, sha) {
  const short = shortSha(sha);
  if (channel === 'stable') {
    return {
      name: `Blue ${releaseVersion}`,
      notes: `Blue ${releaseVersion}\n\nSource revision: ${sha}\n`,
    };
  }
  return {
    name: `Blue Development Build ${releaseVersion}`,
    notes:
      `Blue development build ${releaseVersion}.\n\n` +
      'This is an unsigned development build produced from the selected source revision. ' +
      'It is intended for tester feedback and is not a stable release.\n\n' +
      `Source revision: ${sha}\n` +
      `Short SHA: ${short}\n`,
  };
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.out) {
    process.stderr.write('Usage: release-metadata.mjs --out <release-metadata.json> [--channel development|stable] [--app-version <ver>] [--source-revision <sha>] [--prerelease-timestamp <unix-seconds>]\n');
    process.exit(2);
  }

  const channel = flags.channel === 'stable' ? 'stable' : 'development';
  const appVersion = flags['app-version'] ?? readAppVersion();
  const sourceRevision = flags['source-revision'] ?? detectSourceRevision();
  const timestamp = flags['prerelease-timestamp']
    ? Number.parseInt(flags['prerelease-timestamp'], 10)
    : Math.floor(Date.now() / 1000);

  if (Number.isNaN(timestamp) || timestamp <= 0) {
    process.stderr.write(`--prerelease-timestamp must be a positive Unix seconds value, got "${flags['prerelease-timestamp']}".\n`);
    process.exit(2);
  }

  const releaseVersion = buildReleaseVersion(appVersion, sourceRevision, timestamp, channel);
  const { name, notes } = buildReleaseNameAndNotes(channel, releaseVersion, sourceRevision);

  const metadata = {
    channel,
    appVersion,
    sourceRevision,
    generatedAt: new Date().toISOString(),
    releaseVersion,
    releaseName: name,
    releaseNotes: notes,
  };

  const outPath = resolve(flags.out);
  writeFileSync(outPath, JSON.stringify(metadata, null, 2) + '\n', 'utf-8');
  process.stderr.write(`Release metadata written: ${outPath}\n`);
  process.stderr.write(`Channel:          ${channel}\n`);
  process.stderr.write(`App version:      ${appVersion}\n`);
  process.stderr.write(`Release version:  ${releaseVersion}\n`);
  process.stderr.write(`Source revision:  ${sourceRevision}\n`);
  process.exit(0);
}

main();
