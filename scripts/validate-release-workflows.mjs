#!/usr/bin/env node
/**
 * Release workflow contract validator.
 *
 * Statically validates that the release workflow/action files declared
 * in this repository satisfy the release-workflow contract:
 *
 *   - .github/actions/setup-blue-build/action.yml exists and uses composite.
 *   - .github/workflows/pr.yml:
 *       * runs on pull requests to develop and main.
 *       * matrix covers macos-arm64, windows-x64, linux-x64.
 *       * workflow-level `permissions.contents: read` only.
 *       * uploads versioned native packages only after success and diagnostics
 *         with `if: always()`.
 *       * never references the protected `release` Environment.
 *       * never references signing secrets.
 *   - .github/workflows/develop.yml:
 *       * runs on pushes to develop.
 *       * uploads versioned native package artifacts without creating a
 *         GitHub Release.
 *   - .github/workflows/release.yml:
 *       * triggered by `v*.*.*` tags.
 *       * publishes unsigned native packages with exact versioned names.
 *       * validates the complete verified package manifest before publication.
 *       * references the protected `release` Environment only for publishing.
 *       * does not reference signing credentials or Azure OIDC.
 *       * final publisher job has `contents: write`.
 *   - packages/blue-app/electron-builder.yml:
 *       * disables macOS identity auto-discovery so local package scripts are
 *         unsigned by default too.
 *       * packages the shared runtime modules imported by main and preload.
 *
 * The validator is YAML-structural only. It removes full-line YAML comments
 * before checking required substrings/anchors so disabled matrix entries cannot
 * satisfy coverage checks. It deliberately remains dependency-free.
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
  const text = readFileSync(fullPath, 'utf-8');
  if (!/\.ya?ml$/i.test(relPath)) {
    return text;
  }
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
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

// === pr.yml ===
requireSubstring(
  '.github/workflows/pr.yml',
  'permissions:\n  contents: read',
  'PR_PERMS',
  'pr.yml must declare workflow-level contents: read only',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'pull_request:',
  'PR_TRIGGER',
  'pr.yml must trigger on pull requests',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'BLUE_RELEASE_CHANNEL: development',
  'PR_METADATA_CHANNEL',
  'pr.yml must build development-channel metadata',
);
forbidRegex(
  '.github/workflows/pr.yml',
  /^\s*push:/m,
  'PR_NO_PUSH',
  'pr.yml must not trigger on push (use develop.yml or release.yml for branch pushes)',
);
requireSubstring('.github/workflows/pr.yml', 'target-id: macos-arm64', 'PR_MACOS_ARM64', 'pr.yml must cover macos-arm64');
requireSubstring('.github/workflows/pr.yml', 'target-id: windows-x64', 'PR_WINDOWS_X64', 'pr.yml must cover windows-x64');
requireSubstring('.github/workflows/pr.yml', 'target-id: linux-x64', 'PR_LINUX_X64', 'pr.yml must cover linux-x64');
forbidRegex(
  '.github/workflows/pr.yml',
  /package:macos-x64/,
  'PR_NO_MACOS_X64',
  'pr.yml must keep intentionally unsupported macos-x64 packaging out of the active matrix',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'if: always()',
  'PR_ALWAYS_UPLOAD',
  'pr.yml must retain diagnostic artifacts with if: always()',
);
requireSubstring(
  '.github/workflows/pr.yml',
  "if: runner.os == 'Linux'\n        shell: bash\n        run: xvfb-run --auto-servernum pnpm --filter @blue/app verify:packaged-app -- --no-playwright",
  'PR_LINUX_SMOKE_DISPLAY',
  'pr.yml must provide a virtual display for the Linux packaged-project smoke',
);
forbidRegex(
  '.github/workflows/pr.yml',
  /- name:\s*Upload (?:macOS installer|Windows installer|Linux AppImage|Linux Debian package)\s+if:\s*always\(\)/,
  'PR_PACKAGES_ONLY_AFTER_SUCCESS',
  'pr.yml must not retain distribution packages after a failed verification step',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'path: packages/blue-app/release/artifacts/blue-macos-arm64-${{ steps.version.outputs.app-version }}-pr${{ github.event.pull_request.number }}.dmg\n          archive: false',
  'PR_MACOS_ARTIFACT',
  'pr.yml must directly upload the versioned macOS DMG',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'path: packages/blue-app/release/artifacts/blue-windows-x64-${{ steps.version.outputs.app-version }}-pr${{ github.event.pull_request.number }}.exe\n          archive: false',
  'PR_WINDOWS_ARTIFACT',
  'pr.yml must directly upload the versioned Windows installer',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'path: packages/blue-app/release/artifacts/blue-linux-x64-${{ steps.version.outputs.app-version }}-pr${{ github.event.pull_request.number }}.AppImage\n          archive: false',
  'PR_LINUX_APPIMAGE_ARTIFACT',
  'pr.yml must directly upload the versioned Linux AppImage',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'path: packages/blue-app/release/artifacts/blue-linux-x64-${{ steps.version.outputs.app-version }}-pr${{ github.event.pull_request.number }}.deb\n          archive: false',
  'PR_LINUX_DEB_ARTIFACT',
  'pr.yml must directly upload the versioned Linux Debian package',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'uses: actions/upload-artifact@v7',
  'PR_DIRECT_UPLOAD_VERSION',
  'pr.yml must use upload-artifact v7 direct-file support',
);
requireSubstring(
  '.github/workflows/pr.yml',
  'name: blue-${{ matrix.target-id }}-${{ steps.version.outputs.app-version }}-pr${{ github.event.pull_request.number }}-diagnostics.zip',
  'PR_DIAGNOSTICS_NAME',
  'pr.yml diagnostic artifact names must follow the blue target prefix and end in .zip',
);
forbidRegex(
  '.github/workflows/pr.yml',
  /\benvironment:\s*release\b/,
  'PR_NO_RELEASE_ENV',
  'pr.yml must not reference the protected release Environment',
);
forbidRegex(
  '.github/workflows/pr.yml',
  /\b(CSC_LINK|APPLE_ID|AZURE_CLIENT_ID)\b/,
  'PR_NO_SIGNING_SECRETS',
  'pr.yml must not reference macOS or Windows signing secrets',
);
forbidRegex(
  '.github/workflows/pr.yml',
  /pull_request_target/,
  'PR_NO_PULL_REQUEST_TARGET',
  'pr.yml must not use pull_request_target (security contract)',
);

// === develop.yml ===
requireSubstring(
  '.github/workflows/develop.yml',
  'permissions:\n  contents: read',
  'DEVELOP_PERMS',
  'develop.yml must declare workflow-level contents: read only',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'branches: [develop]',
  'DEVELOP_TRIGGER',
  'develop.yml must trigger on push to develop',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'BLUE_RELEASE_CHANNEL: development',
  'DEVELOP_METADATA_CHANNEL',
  'develop.yml must build development-channel metadata',
);
requireSubstring('.github/workflows/develop.yml', 'target-id: macos-arm64', 'DEVELOP_MACOS_ARM64', 'develop.yml must cover macos-arm64');
requireSubstring('.github/workflows/develop.yml', 'target-id: windows-x64', 'DEVELOP_WINDOWS_X64', 'develop.yml must cover windows-x64');
requireSubstring('.github/workflows/develop.yml', 'target-id: linux-x64', 'DEVELOP_LINUX_X64', 'develop.yml must cover linux-x64');
forbidRegex(
  '.github/workflows/develop.yml',
  /package:macos-x64/,
  'DEVELOP_NO_MACOS_X64',
  'develop.yml must keep intentionally unsupported macos-x64 packaging out of the active matrix',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'if: always()',
  'DEVELOP_ALWAYS_UPLOAD',
  'develop.yml must retain diagnostic artifacts with if: always()',
);
requireSubstring(
  '.github/workflows/develop.yml',
  "if: runner.os == 'Linux'\n        shell: bash\n        run: xvfb-run --auto-servernum pnpm --filter @blue/app verify:packaged-app -- --no-playwright",
  'DEVELOP_LINUX_SMOKE_DISPLAY',
  'develop.yml must provide a virtual display for the Linux packaged-project smoke',
);
forbidRegex(
  '.github/workflows/develop.yml',
  /- name:\s*Upload (?:macOS installer|Windows installer|Linux AppImage|Linux Debian package)\s+if:\s*always\(\)/,
  'DEVELOP_PACKAGES_ONLY_AFTER_SUCCESS',
  'develop.yml must not retain distribution packages after a failed verification step',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'path: packages/blue-app/release/artifacts/blue-macos-arm64-${{ steps.meta.outputs.app-version }}-${{ steps.meta.outputs.short-sha }}.dmg\n          archive: false',
  'DEVELOP_MACOS_ARTIFACT',
  'develop.yml must directly upload the versioned macOS DMG',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'path: packages/blue-app/release/artifacts/blue-windows-x64-${{ steps.meta.outputs.app-version }}-${{ steps.meta.outputs.short-sha }}.exe\n          archive: false',
  'DEVELOP_WINDOWS_ARTIFACT',
  'develop.yml must directly upload the versioned Windows installer',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'path: packages/blue-app/release/artifacts/blue-linux-x64-${{ steps.meta.outputs.app-version }}-${{ steps.meta.outputs.short-sha }}.AppImage\n          archive: false',
  'DEVELOP_LINUX_APPIMAGE_ARTIFACT',
  'develop.yml must directly upload the versioned Linux AppImage',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'path: packages/blue-app/release/artifacts/blue-linux-x64-${{ steps.meta.outputs.app-version }}-${{ steps.meta.outputs.short-sha }}.deb\n          archive: false',
  'DEVELOP_LINUX_DEB_ARTIFACT',
  'develop.yml must directly upload the versioned Linux Debian package',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'uses: actions/upload-artifact@v7',
  'DEVELOP_DIRECT_UPLOAD_VERSION',
  'develop.yml must use upload-artifact v7 direct-file support',
);
requireSubstring(
  '.github/workflows/develop.yml',
  'name: blue-${{ matrix.target-id }}-${{ steps.meta.outputs.app-version }}-${{ steps.meta.outputs.short-sha }}-diagnostics.zip',
  'DEVELOP_DIAGNOSTICS_NAME',
  'develop.yml diagnostic artifact names must follow the blue target prefix and end in .zip',
);
forbidRegex(
  '.github/workflows/develop.yml',
  /\benvironment:\s*release\b/,
  'DEVELOP_NO_RELEASE_ENV',
  'develop.yml must not reference the protected release Environment',
);
forbidRegex(
  '.github/workflows/develop.yml',
  /\b(CSC_LINK|APPLE_ID|AZURE_CLIENT_ID)\b/,
  'DEVELOP_NO_SIGNING_SECRETS',
  'develop.yml must not reference macOS or Windows signing secrets',
);
forbidRegex(
  '.github/workflows/develop.yml',
  /softprops\/action-gh-release|gh release create|prerelease:/,
  'DEVELOP_NO_PUBLICATION',
  'develop.yml must not publish GitHub Releases or prereleases',
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
  'BLUE_RELEASE_CHANNEL: stable',
  'RELEASE_METADATA_CHANNEL',
  'release.yml must build stable-channel metadata',
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
  /package:macos-x64/,
  'RELEASE_NO_MACOS_X64',
  'release.yml must keep intentionally unsupported macos-x64 packaging out of the active matrix',
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
  'needs: [validate-version, package-macos, package-windows, package-linux]',
  'RELEASE_VERSION_OUTPUT_DEPENDENCY',
  'release.yml publisher must directly depend on validate-version before using its outputs',
);
requireSubstring(
  '.github/workflows/release.yml',
  'path: packages/blue-app/release/blue-macos-${{ matrix.arch }}-${{ needs.validate-version.outputs.app-version }}.dmg\n          archive: false',
  'RELEASE_MACOS_ARTIFACT',
  'release.yml must directly upload the versioned macOS DMG',
);
requireSubstring(
  '.github/workflows/release.yml',
  'path: packages/blue-app/release/blue-windows-x64-${{ needs.validate-version.outputs.app-version }}.exe\n          archive: false',
  'RELEASE_WINDOWS_ARTIFACT',
  'release.yml must directly upload the versioned Windows installer',
);
requireSubstring(
  '.github/workflows/release.yml',
  'path: packages/blue-app/release/blue-linux-x64-${{ needs.validate-version.outputs.app-version }}.AppImage\n          archive: false',
  'RELEASE_LINUX_APPIMAGE_ARTIFACT',
  'release.yml must directly upload the versioned Linux AppImage',
);
requireSubstring(
  '.github/workflows/release.yml',
  'path: packages/blue-app/release/blue-linux-x64-${{ needs.validate-version.outputs.app-version }}.deb\n          archive: false',
  'RELEASE_LINUX_DEB_ARTIFACT',
  'release.yml must directly upload the versioned Linux Debian package',
);
requireRegex(
  '.github/workflows/release.yml',
  /package:linux-x64[\s\S]*?xvfb-run --auto-servernum pnpm --filter @blue\/app verify:packaged-app -- --no-playwright/,
  'RELEASE_LINUX_SMOKE_DISPLAY',
  'release.yml must provide a virtual display for the Linux packaged-project smoke',
);
requireSubstring(
  '.github/workflows/release.yml',
  'uses: actions/upload-artifact@v7',
  'RELEASE_DIRECT_UPLOAD_VERSION',
  'release.yml must use upload-artifact v7 direct-file support',
);
requireSubstring(
  '.github/workflows/release.yml',
  'uses: actions/download-artifact@v8',
  'RELEASE_DIRECT_DOWNLOAD_VERSION',
  'release.yml must use download-artifact v8 direct-file support',
);
requireSubstring(
  '.github/workflows/release.yml',
  '--asset-mode packages',
  'RELEASE_PACKAGE_MANIFEST',
  'release.yml must generate and validate the native package manifest',
);
requireSubstring(
  '.github/workflows/release.yml',
  '--require-verified',
  'RELEASE_REQUIRE_VERIFIED',
  'release.yml must require verified manifest entries',
);
requireSubstring(
  '.github/workflows/release.yml',
  'consolidated/blue-*.dmg',
  'RELEASE_PUBLISH_DMG',
  'release.yml must publish the standardized macOS DMG',
);
requireSubstring(
  '.github/workflows/release.yml',
  'consolidated/blue-*.exe',
  'RELEASE_PUBLISH_EXE',
  'release.yml must publish the standardized Windows installer',
);
requireSubstring(
  '.github/workflows/release.yml',
  'consolidated/blue-*.AppImage',
  'RELEASE_PUBLISH_APPIMAGE',
  'release.yml must publish the standardized Linux AppImage',
);
requireSubstring(
  '.github/workflows/release.yml',
  'consolidated/blue-*.deb',
  'RELEASE_PUBLISH_DEB',
  'release.yml must publish the standardized Linux Debian package',
);
forbidRegex(
  '.github/workflows/release.yml',
  /Create stable release ZIP|--asset-mode bundles|consolidated\/blue-\*\.zip/,
  'RELEASE_NO_DISTRIBUTION_ZIPS',
  'release.yml must not wrap native distribution packages in ZIP files',
);
forbidRegex(
  '.github/workflows/release.yml',
  /\bname:\s*stable-release-/,
  'RELEASE_NO_LEGACY_ARTIFACT_NAMES',
  'release.yml must not use legacy stable-release-* artifact names',
);
forbidRegex(
  '.github/workflows/release.yml',
  /sha256sum[^\n]*\|\|\s*true/,
  'RELEASE_CHECKSUM_FAILURES_BLOCK',
  'release.yml must not suppress checksum failures',
);

// === electron-builder.yml ===
requireSubstring(
  'packages/blue-app/electron-builder.yml',
  'identity: null',
  'BUILDER_MAC_UNSIGNED',
  'electron-builder must disable macOS signing identity auto-discovery by default',
);
requireSubstring(
  'packages/blue-app/electron-builder.yml',
  '- dist/shared/**/*',
  'BUILDER_SHARED_RUNTIME',
  'electron-builder must package shared runtime modules imported by main and preload',
);
requireSubstring(
  'packages/blue-app/electron-builder.yml',
  '- release-metadata.json',
  'BUILDER_RELEASE_METADATA',
  'electron-builder must package generated release metadata for the About dialog',
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
