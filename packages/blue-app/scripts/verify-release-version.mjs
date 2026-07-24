#!/usr/bin/env node
/**
 * Stable tag / package version validation.
 *
 * Requires an immutable `vX.Y.Z` Git tag that exactly matches the version
 * declared in packages/blue-app/package.json. Refuses to proceed when:
 *   - The current commit is not at a `vX.Y.Z` tag.
 *   - The tag does not match `packages/blue-app/package.json`.
 *   - The version has already been published as a non-draft GitHub Release.
 *
 * The script is intentionally GitHub-aware but does not require GitHub
 * authentication: when GH_TOKEN/GITHUB_TOKEN is unavailable, the
 * duplicate-publication check is skipped with a warning so a local maintainer
 * can still validate the tag/version agreement. In CI, the stable workflow
 * runs the script with the workflow-provided GITHUB_TOKEN so the duplicate
 * check is authoritative.
 *
 * Usage:
 *   node packages/blue-app/scripts/verify-release-version.mjs \
 *       [--tag <vX.Y.Z>] \
 *       [--app-version <ver>] \
 *       [--repository <owner/repo>] \
 *       [--allow-no-gh-token]
 *
 * Exit codes:
 *   0 - tag, package version, and (when GH token present) duplicate checks passed.
 *   1 - validation failed. Diagnostics written to stderr.
 *   2 - invalid invocation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const appPkgPath = join(repoRoot, 'packages', 'blue-app', 'package.json');

const VERSION_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

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
function detectExactTag() {
  try {
    const tag = execSync('git describe --tags --exact-match HEAD', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return tag;
  } catch {
    return '';
  }
}

/**
 * @param {string} repository
 * @returns {{ ok: boolean, status?: number, message: string }}
 */
/**
 * @param {string} repository
 * @param {string} tag Tag to check (typically expectedTag or detected tag).
 * @returns {Promise<{ ok: boolean, status?: number, message: string }>}
 */
async function checkGitHubRelease(repository, tag) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      ok: true,
      message: 'GH_TOKEN/GITHUB_TOKEN not set; skipping duplicate-release check.',
    };
  }

  if (!tag) {
    return {
      ok: false,
      message: 'Cannot check GitHub release: no tag resolved. Pass --tag or run from a tagged commit.',
    };
  }

  const url = `https://api.github.com/repos/${repository}/releases/tags/${tag}`;
  // Bound the request so a hung API cannot stall the workflow indefinitely.
  // 10 seconds is well above GitHub's typical REST latency for a single
  // release lookup and well below the runner's job timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub requires a User-Agent on REST requests.
        'User-Agent': 'blue-release-verify',
      },
    });
    if (response.status === 404) {
      return { ok: true, status: 404, message: `No existing release for tag ${tag}.` };
    }
    if (response.status === 200) {
      // Inspect the body to determine draft state. A draft release with the
      // same tag is acceptable: the promoter will publish it after asset
      // verification.
      try {
        const body = await response.json();
        if (body?.draft === true) {
          return {
            ok: true,
            status: 200,
            message: `Found existing draft release for tag ${tag}; promoter will publish it.`,
          };
        }
        return {
          ok: false,
          status: 200,
          message:
            `A non-draft GitHub Release already exists for tag ${tag}. ` +
            'Refusing to overwrite a published version. Create a new tag for a corrected release.',
        };
      } catch {
        return {
          ok: false,
          status: 200,
          message: `Existing release for tag ${tag} returned an unreadable body.`,
        };
      }
    }
    return {
      ok: false,
      status: response.status,
      message: `GitHub API returned unexpected status ${response.status} for ${url}.`,
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      message: isAbort
        ? `GitHub API request timed out for tag ${tag} (${url}).`
        : `Failed to query GitHub API for tag ${tag}: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const expectedTag = flags.tag;
  const expectedVersion = flags['app-version'] ?? readAppVersion();
  const repository = flags.repository ?? '';
  const allowNoGhToken = flags['allow-no-gh-token'] === 'true';

  /** @type {Array<{ ok: boolean, message: string }>} */
  const diagnostics = [];

  // 1. Tag/version shape and agreement.
  const detectedTag = expectedTag || detectExactTag();
  if (!detectedTag) {
    diagnostics.push({
      ok: false,
      message: 'HEAD is not at an exact vX.Y.Z tag. Stable releases must be triggered by an immutable tag.',
    });
  } else {
    const match = VERSION_PATTERN.exec(detectedTag);
    if (!match) {
      diagnostics.push({
        ok: false,
        message: `Tag "${detectedTag}" does not match the required vX.Y.Z shape.`,
      });
    } else {
      const tagVersion = `${match[1]}.${match[2]}.${match[3]}`;
      if (tagVersion !== expectedVersion) {
        diagnostics.push({
          ok: false,
          message:
            `Tag "${detectedTag}" does not match packages/blue-app/package.json version "${expectedVersion}". ` +
            'Update package.json, or create a tag that matches it.',
        });
      } else {
        diagnostics.push({ ok: true, message: `Tag/version agreement: ${detectedTag} <-> ${expectedVersion}` });
      }
    }
  }

  // 2. Duplicate-release check (only when GH token is available OR we have a
  // repository and the caller did not opt out of the token requirement).
  // Pass the resolved tag (expected or detected) so the check works even
  // before the tag is pushed locally - useful for dry-running a release
  // candidate validation against an intended tag.
  if (repository) {
    const releaseCheck = await checkGitHubRelease(repository, detectedTag);
    diagnostics.push(releaseCheck);
  } else if (!allowNoGhToken) {
    diagnostics.push({
      ok: false,
      message:
        'No --repository flag provided. Pass --repository owner/repo to enable the duplicate-release check, or --allow-no-gh-token to skip it.',
    });
  }

  for (const d of diagnostics) {
    process.stderr.write(`${d.ok ? '[ok]' : '[FAIL]'} ${d.message}\n`);
  }

  if (diagnostics.some((d) => !d.ok)) {
    process.stderr.write('\nRelease version validation failed.\n');
    process.exit(1);
  }

  process.stderr.write('\nRelease version validation passed.\n');
  process.exit(0);
}

main();
