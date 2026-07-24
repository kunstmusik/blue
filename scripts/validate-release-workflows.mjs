#!/usr/bin/env node
/**
 * Release workflow contract validator.
 *
 * Statically validates that the four release workflow/action files declared
 * in this repository satisfy the release-workflow contract:
 *
 *   - .github/actions/setup-blue-build/action.yml exists and uses composite.
 *   - .github/workflows/ci.yml:
 *       * runs on push/pull_request to dev and main (no tag trigger).
 *       * matrix covers macos-x64, macos-arm64, windows-x64, linux-x64.
 *       * workflow-level `permissions.contents: read` only.
 *       * uploads artifacts with `if: always()`.
 *       * never references the protected `release` Environment.
 *       * never references signing secrets.
 *   - .github/workflows/dev-release.yml:
 *       * triggered by schedule or workflow_dispatch only.
 *       * final publisher job has `permissions.contents: write`.
 *       * no signing credential references.
 *   - .github/workflows/release.yml:
 *       * triggered by `v*.*.*` tags.
 *       * publishes unsigned packages by default.
 *       * references the protected `release` Environment only for publishing.
 *       * does not reference signing credentials or Azure OIDC.
 *       * final publisher job has `contents: write`.
 *   - packages/blue-app/electron-builder.yml:
 *       * disables macOS identity auto-discovery so local package scripts are
 *         unsigned by default too.
 *
 * The validator is YAML-structural only: it parses the files as text and
 * looks for required substrings/anchors. It deliberately does not run a
 * real YAML parser (we keep this script secret-free and dependency-free).
 *
 * Usage: node scripts/validate-release-workflows.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

/** @typedef {{ ok: boolean, file: string, code: string, message: string }} Finding */

/** @type {Finding[]} */
const findings = [];

/**
 * @param {string} relPath
 * @returns {string}
 */
function readRepoFile(relPath) {
  const fullPath = join(repoRoot, relPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Required file not found: ${relPath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

/**
 * @param {string} file
 * @param {string} needle
 * @param {string} code
 * @param {string} message
 */
function requireSubstring(file, needle, code, message) {
  const text = readRepoFile(file);
  if (!text.includes(needle)) {
    findings.push({ ok: false, file, code, message });
  } else {
    findings.push({ ok: true, file, code, message: `${message} (found: "${needle.trim()}")` });
  }
}

/**
 * @param {string} file
 * @param {RegExp} pattern
 * @param {string} code
 * @param {string} message
 */
function requireRegex(file, pattern, code, message) {
  const text = readRepoFile(file);
  if (!pattern.test(text)) {
    findings.push({ ok: false, file, code, message });
  } else {
    findings.push({ ok: true, file, code, message: `${message} (matched: ${pattern})` });
  }
}

/**
 * @param {string} file
 * @param {RegExp} pattern
 * @param {string} code
 * @param {string} message
 */
function forbidRegex(file, pattern, code, message) {
  const text = readRepoFile(file);
  if (pattern.test(text)) {
    findings.push({ ok: false, file, code, message });
  } else {
    findings.push({ ok: true, file, code, message });
  }
}

// === setup-blue-build action.yml ===
requireSubstring(
  '.github/actions/setup-blue-build/action.yml',
  'using: composite',
  'SETUP_COMPOSITE',
  'setup-blue-build action must be a composite action',
);
forbidRegex(
  '.github/actions/setup-blue-build/action.yml',
  /actions\/checkout/,
  'SETUP_NO_CHECKOUT',
  'setup-blue-build must preserve the caller-selected checkout ref',
);
requireSubstring(
  '.github/actions/setup-blue-build/action.yml',
  'pnpm install --frozen-lockfile',
  'SETUP_FROZEN',
  'setup-blue-build must install from the lockfile',
);

// === ci.yml ===
requireSubstring(
  '.github/workflows/ci.yml',
  'permissions:\n  contents: read',
  'CI_PERMS',
  'ci.yml must declare workflow-level contents: read only',
);
requireSubstring(
  '.github/workflows/ci.yml',
  'branches: [develop, main]',
  'CI_DEV_MAIN_BRANCHES',
  'ci.yml must run for develop and main integration branches',
);
requireSubstring('.github/workflows/ci.yml', 'macos-13', 'CI_MACOS_X64', 'ci.yml must cover macos-x64');
requireSubstring('.github/workflows/ci.yml', 'macos-14', 'CI_MACOS_ARM64', 'ci.yml must cover macos-arm64');
requireSubstring('.github/workflows/ci.yml', 'windows-2022', 'CI_WINDOWS_X64', 'ci.yml must cover windows-x64');
requireSubstring('.github/workflows/ci.yml', 'ubuntu-22.04', 'CI_LINUX_X64', 'ci.yml must cover linux-x64');
requireSubstring('.github/workflows/ci.yml', 'if: always()', 'CI_ALWAYS_UPLOAD', 'ci.yml must upload artifacts with if: always()');
forbidRegex(
  '.github/workflows/ci.yml',
  /\benvironment:\s*release\b/,
  'CI_NO_RELEASE_ENV',
  'ci.yml must not reference the protected release Environment',
);
forbidRegex(
  '.github/workflows/ci.yml',
  /\b(CSC_LINK|APPLE_ID|AZURE_CLIENT_ID)\b/,
  'CI_NO_SIGNING_SECRETS',
  'ci.yml must not reference macOS or Windows signing secrets',
);
forbidRegex(
  '.github/workflows/ci.yml',
  /pull_request_target/,
  'CI_NO_PULL_REQUEST_TARGET',
  'ci.yml must not use pull_request_target (security contract)',
);

// === dev-release.yml ===
requireSubstring(
  '.github/workflows/dev-release.yml',
  'workflow_dispatch:',
  'DEV_DISPATCH',
  'dev-release.yml must support manual dispatch',
);
requireSubstring(
  '.github/workflows/dev-release.yml',
  "contents: write",
  'DEV_PUBLISHER_WRITE',
  'dev-release.yml publisher must receive contents: write',
);
requireSubstring(
  '.github/workflows/dev-release.yml',
  'prerelease: true',
  'DEV_PRERELEASE',
  'dev-release.yml publisher must mark the GitHub release as a prerelease',
);
requireSubstring(
  '.github/workflows/dev-release.yml',
  '*"$APP_VERSION"*.dmg|*"$APP_VERSION"*.exe|*"$APP_VERSION"*.AppImage|*"$APP_VERSION"*.deb',
  'DEV_PACKAGE_ASSET_FILTER',
  'dev-release.yml must only consolidate versioned package assets for publication',
);
forbidRegex(
  '.github/workflows/dev-release.yml',
  /\benvironment:\s*release\b/,
  'DEV_NO_RELEASE_ENV',
  'dev-release.yml must not reference the protected release Environment',
);
forbidRegex(
  '.github/workflows/dev-release.yml',
  /\b(CSC_LINK|APPLE_ID|AZURE_CLIENT_ID)\b/,
  'DEV_NO_SIGNING_SECRETS',
  'dev-release.yml must not reference signing credentials',
);

// === release.yml ===
requireSubstring('.github/workflows/release.yml', "tags:", 'RELEASE_TAG_TRIGGER', 'release.yml must trigger on tags');
requireRegex(
  '.github/workflows/release.yml',
  /v\*\.\*\.\*/,
  'RELEASE_VXYZ_PATTERN',
  'release.yml tag trigger must match vX.Y.Z',
);
requireSubstring(
  '.github/workflows/release.yml',
  'environment: release',
  'RELEASE_ENV',
  'release.yml publisher must reference the protected release Environment',
);
requireSubstring(
  '.github/workflows/release.yml',
  'contents: write',
  'RELEASE_PUBLISHER_WRITE',
  'release.yml publisher must receive contents: write',
);
requireSubstring(
  '.github/workflows/release.yml',
  'verify:release-version',
  'RELEASE_VERSION_VALIDATION',
  'release.yml must validate tag/version agreement via the package script',
);
requireSubstring(
  '.github/workflows/release.yml',
  'Build unsigned macOS package',
  'RELEASE_MACOS_UNSIGNED',
  'release.yml must build unsigned macOS packages by default',
);
requireSubstring(
  '.github/workflows/release.yml',
  'Build unsigned Windows installer',
  'RELEASE_WINDOWS_UNSIGNED',
  'release.yml must build unsigned Windows packages by default',
);
forbidRegex(
  '.github/workflows/release.yml',
  /\b(CSC_LINK|APPLE_ID|APPLE_APP_SPECIFIC_PASSWORD|APPLE_TEAM_ID|AZURE_CLIENT_ID|AZURE_TENANT_ID|AZURE_SUBSCRIPTION_ID|AZURE_TRUSTED_SIGNING_|azure\/login|id-token:\s*write|release:preflight)\b/,
  'RELEASE_NO_SIGNING_GATES',
  'release.yml must not require current signing credentials or Azure OIDC',
);
requireSubstring(
  '.github/workflows/release.yml',
  'release-artifact-manifest.mjs validate',
  'RELEASE_MANIFEST_VALIDATE',
  'release.yml promoter must validate the consolidated manifest',
);
requireSubstring(
  '.github/workflows/release.yml',
  '*"$APP_VERSION"*.dmg|*"$APP_VERSION"*.exe|*"$APP_VERSION"*.AppImage|*"$APP_VERSION"*.deb',
  'RELEASE_PACKAGE_ASSET_FILTER',
  'release.yml must only consolidate versioned package assets for publication',
);

// === electron-builder.yml ===
requireSubstring(
  'packages/blue-app/electron-builder.yml',
  'identity: null',
  'BUILDER_MAC_UNSIGNED',
  'electron-builder must disable macOS signing identity auto-discovery by default',
);

// === print findings ===
for (const finding of findings) {
  const tag = finding.ok ? '[ok]' : '[FAIL]';
  process.stderr.write(`${tag} ${finding.file} (${finding.code}): ${finding.message}\n`);
}

const failed = findings.filter((f) => !f.ok);
if (failed.length > 0) {
  process.stderr.write(`\n${failed.length} release-workflow contract check(s) failed.\n`);
  process.exit(1);
}
process.stderr.write(`\nAll ${findings.length} release-workflow contract checks passed.\n`);
process.exit(0);
