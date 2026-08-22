# Release Build Validation Guide

This guide is the end-to-end acceptance procedure for the release implementation described in [plan.md](./plan.md). Implemented commands:

| Step                   | Implemented command                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local build/test/lint  | `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm lint`                                                                                                            |
| Full repository verify | `pnpm verify` (package inputs + workflow contract + release-artifact integrity tests + credential preflight tests + advisory credential availability)                            |
| Package inputs only    | `pnpm verify:package-inputs`                                                                                                                                                       |
| App build (unpacked)   | `pnpm app:build` (compiles all workspace deps + electron-builder `--dir`)                                                                                                          |
| App package (installer)| `pnpm app:package` (host-platform DMG/NSIS/AppImage+Deb)                                                                                                                           |
| Clean all artifacts    | `pnpm clean`                                                                                                                                                                       |
| Hosted target packages | `pnpm --filter @blue/app package:macos-arm64 \| package:windows-x64 \| package:linux-x64`; `package:macos-x64` remains a local-only developer experiment                          |
| Packaged-app smoke     | `pnpm --filter @blue/app verify:packaged-app [-- --package-dir <dir>] [-- --no-playwright]`                                                                                        |
| Release manifest       | `pnpm --filter @blue/app release:manifest` (writes `packages/blue-app/release/release-manifest.json` and `.sha256`)                                                                |
| Version validation     | `pnpm --filter @blue/app exec node scripts/verify-release-version.mjs --tag vX.Y.Z --app-version X.Y.Z --repository <owner/repo> [--allow-no-gh-token]`                            |
| Credential preflight  | `node scripts/release-credential-preflight.mjs [--scope macos\|windows\|publish] [--advisory] [--emit-availability]`                                                               |

## Prerequisites

- Node.js 22 and pnpm 10.
- Java 17+ and Maven for the Blue Java helper runtime.
- A hosted target platform: macOS arm64, Windows x64, or Linux x64. A macOS x64 local package command remains available as a developer experiment but is not a hosted or published target.
- For end-user playback validation, separately install Csound and `blue-engine`; they are intentionally not included in the first Blue installer.
- Production signing and publication are optional for local unsigned packages and are isolated in the GitHub `release` Environment.

## Workflow Structure

| Workflow        | File                          | Triggers                              | Output                                                                 |
| --------------- | ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| PR validation   | `.github/workflows/pr.yml`    | `pull_request` → develop, main        | Build + test + lint + package; installer artifacts uploaded, no release |
| Develop build   | `.github/workflows/develop.yml` | `push` → develop                    | Build + test + lint + package; installer artifacts uploaded, no release |
| Stable release  | `.github/workflows/release.yml` | `vX.Y.Z` tag push                  | Complete unsigned native package set published to GitHub Releases      |

### Artifact Naming

Primary artifacts follow `blue-{os}-{cputype}-{versionInfo}.{ext}`:

- macOS: `blue-macos-arm64-{versionInfo}.dmg`
- Windows: `blue-windows-x64-{versionInfo}.exe`
- Linux AppImage: `blue-linux-x64-{versionInfo}.AppImage`
- Linux Debian package: `blue-linux-x64-{versionInfo}.deb`

`{versionInfo}` is `{version}-pr{number}` for PR builds, `{version}-{short-sha}` for develop builds, and `{version}` for stable builds. Each native installer is uploaded directly; the Linux AppImage and Debian package are separate artifacts.

## Local Unsigned Package

1. Start from a clean checkout and install dependencies using the lockfile.
2. Run `pnpm app:build` to compile all workspace packages and produce an unpacked app.
3. Run `pnpm --filter @blue/app verify:packaged-app` to smoke-test the unpacked app.
4. Run `pnpm app:package` for the host-platform installer.

Expected outcome:

- The package output exists under `packages/blue-app/release/`.
- The smoke check finds `blue-java.jar` and `pythonLib` through the installed-resource path, loads the native ZeroMQ dependency, verifies the pinned Electron SQLite runtime, then loads `fixtures/smoke-test.blue` through the normal main-process project path.
- No release asset is created and no signing credential is required.

## PR Validation

1. Open a pull request targeting `develop` or `main`.
2. Confirm the `pr.yml` workflow reports independent macOS arm64, Windows x64, and Linux x64 jobs.
3. Confirm each target completes build, test, lint, unsigned package, and packaged-app smoke verification.
4. Download installer artifacts from the workflow run page if needed for review.

## Develop Build

1. Push a change to `develop`.
2. Confirm the `develop.yml` workflow reports independent platform jobs.
3. Download installer artifacts from the workflow run page for testing.

Expected outcome: all target jobs are green. Artifacts are retained for 30 days.

The develop workflow uploads Actions artifacts only. It must not create or update a GitHub Release.

## Stable Release

Stable releases are intentionally unsigned because the signing programs and keys are not currently funded. The workflow never enables signing automatically from ambient credentials.

1. Confirm `packages/blue-app/package.json` contains the intended semantic version.
2. Run `pnpm verify` and `pnpm app:package` locally to validate the release candidate.
3. Create and push the matching immutable `vX.Y.Z` tag.
4. For the current one-maintainer policy, expect no separate approval prompt: pushing the immutable version tag is the explicit publication decision.
5. Wait for all target jobs and the final promotion job in the `release` Environment to complete.
6. Inspect the published release from a clean machine for each supported platform.

Expected outcome:

- The release is not public until all target assets and checksums pass validation.
- The Release contains exactly `blue-macos-arm64-X.Y.Z.dmg`, `blue-windows-x64-X.Y.Z.exe`, `blue-linux-x64-X.Y.Z.AppImage`, and `blue-linux-x64-X.Y.Z.deb`, using the same filenames as the stable Actions artifacts.
- The release body includes source SHA, unsigned status, installation instructions, runtime prerequisites, and an auto-generated changelog (merged PR titles + new contributors).
- Every native package matches the published checksum and verified manifest.

## Credentials

**Current policy: no signing credentials are consumed.** Publication uses only the workflow-provided token. Signing values are documented as future inputs and must not change current workflow behavior if present.

| Name                                        | GitHub location                          | Required for                         | Notes                                                  |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `GH_TOKEN`                                  | Automatically provided as `GITHUB_TOKEN` | GitHub stable publication            | Requires only release-content authority               |
| `CSC_LINK`                                  | Future `release` Environment secret      | Future macOS signing                 | Do not configure until a signed-release feature is funded |
| `CSC_KEY_PASSWORD`                          | Future `release` Environment secret      | Future macOS signing                 | Never print or pass on a command line                  |
| `APPLE_ID`                                  | Future `release` Environment secret      | Future macOS notarization            | Use a dedicated release account where possible         |
| `APPLE_APP_SPECIFIC_PASSWORD`               | Future `release` Environment secret      | Future macOS notarization            | Never use the normal Apple account password            |
| `APPLE_TEAM_ID`                             | Future `release` Environment variable    | Future macOS notarization            | Match the Developer ID signing team                    |
| `AZURE_CLIENT_ID`                           | Future `release` Environment variable    | Future Windows signing               | Pair with a federated GitHub identity; no client secret |
| `AZURE_TENANT_ID`                           | Future `release` Environment variable    | Future Windows signing               | Pair with a federated GitHub identity; no client secret |
| `AZURE_SUBSCRIPTION_ID`                     | Future `release` Environment variable    | Future Windows signing               | Pair with a federated GitHub identity; no client secret |
| `AZURE_TRUSTED_SIGNING_ENDPOINT`            | Future `release` Environment variable    | Future Windows signing               | Non-secret service configuration                       |
| `AZURE_TRUSTED_SIGNING_ACCOUNT`             | Future `release` Environment variable    | Future Windows signing               | Non-secret account identifier                          |
| `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE` | Future `release` Environment variable    | Future Windows signing               | Non-secret profile identifier                          |

## Release Failure Recovery

- Missing publication or token authority: correct the Environment tag policy or workflow permissions and rerun against the unchanged tag only if no release was published. Future signing credentials do not block the current unsigned workflow.
- Missing target asset or failed platform verification: fix the source/workflow defect, create a new version and tag, and release again. Never overwrite a published version.
- Published artifact defect: mark the release as withdrawn, document the affected platforms, and publish a new version. Do not replace assets under an existing version.

## Direct Native Artifact Verification

- Local workflow-contract validation passes all 69 checks.
- Local native-package manifest generation and validation passes for the DMG, NSIS installer, AppImage, and Debian package.
- Hosted PR, develop, and stable-release evidence for the revised direct-artifact contract remains pending.

## Historical Convergence Verification Record — 2026-07-26

The following record verified the superseded three-ZIP contract and is retained as historical evidence:

```text
Release-workflow contract validation
  PASS — all 57 checks
Packaged runtime/project verifier unit coverage
  PASS — 1 file; 6 passed
Electron main production build
  PASS — TypeScript main bundle
Unsigned macOS arm64 directory package
  PASS — release/mac-arm64/Blue.app
Packaged shared-runtime inclusion
  PASS — dist/shared is included in the ASAR; static and package-input guards cover the dependency
Installed-package smoke (plain-spawn CI path)
  PASS — packaged-resources followed by packaged-project; fixtures/smoke-test.blue accepted as the current project
PR #1 workflow run 30208009454 at source b4885819738e0ed697766bb874690bdee056ab67
  PASS — macos-arm64, windows-x64, and linux-x64 completed
  PASS — blue-macos-arm64-0.0.1-pr1.zip
  PASS — blue-windows-x64-0.0.1-pr1.zip
  PASS — blue-linux-x64-0.0.1-pr1.zip
Develop workflow run 30208008087 at source b4885819738e0ed697766bb874690bdee056ab67
  PASS — macos-arm64, windows-x64, and linux-x64 completed
  PASS — blue-macos-arm64-0.0.1-b488581.zip
  PASS — blue-windows-x64-0.0.1-b488581.zip
  PASS — blue-linux-x64-0.0.1-b488581.zip
  PASS — PR and Develop created no GitHub Release; v0.0.2 remains the latest release
Stable Release workflow run 30182366369 at source cf502861ef25520db2273022e603e8be48623fa6
  PASS — public, non-prerelease v0.0.2
  PASS — Actions and GitHub Release both use blue-macos-arm64-0.0.2.zip
  PASS — Actions and GitHub Release both use blue-windows-x64-0.0.2.zip
  PASS — Actions and GitHub Release both use blue-linux-x64-0.0.2.zip
  PASS — release-manifest.json and checksums-sha256.txt published
GitHub release Environment
  PASS — required reviewers: none
  PASS — protected-branch deployments: disabled
  PASS — custom deployment policies: enabled
  PASS — sole deployment policy: tag v*.*.*
```

The two smoke stages are intentionally separate. Resource resolution still exits before normal application startup; project acceptance waits for Electron readiness, invokes the normal main-owned project load path, verifies the requested file became the current document, and exits without creating a window or starting audio.
