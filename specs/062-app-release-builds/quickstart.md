# Release Build Validation Guide

This guide is the end-to-end acceptance procedure for the release implementation described in [plan.md](./plan.md). Implemented commands:

| Step                   | Implemented command                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local build/test/lint  | `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm lint`                                                                                                            |
| Full repository verify | `pnpm verify` (package inputs + workflow contract + credential preflight tests + advisory credential availability)                                                                |
| Package inputs only    | `pnpm verify:package-inputs`                                                                                                                                                       |
| App build (unpacked)   | `pnpm app:build` (compiles all workspace deps + electron-builder `--dir`)                                                                                                          |
| App package (installer)| `pnpm app:package` (host-platform DMG/NSIS/AppImage+Deb)                                                                                                                           |
| Clean all artifacts    | `pnpm clean`                                                                                                                                                                       |
| Per-target packages    | `pnpm --filter @blue/app package:macos-x64 \| package:macos-arm64 \| package:windows-x64 \| package:linux-x64`                                                                     |
| Packaged-app smoke     | `pnpm --filter @blue/app verify:packaged-app [-- --package-dir <dir>] [-- --no-playwright]`                                                                                        |
| Release manifest       | `pnpm --filter @blue/app release:manifest` (writes `packages/blue-app/release/release-manifest.json` and `.sha256`)                                                                |
| Release metadata       | `node scripts/release-metadata.mjs --out <release-metadata.json> [--channel development\|stable]`                                                                                  |
| Version validation     | `pnpm --filter @blue/app exec node scripts/verify-release-version.mjs --tag vX.Y.Z --app-version X.Y.Z --repository <owner/repo> [--allow-no-gh-token]`                            |
| Credential preflight  | `node scripts/release-credential-preflight.mjs [--scope macos\|windows\|publish] [--advisory] [--emit-availability]`                                                               |

## Prerequisites

- Node.js 22 and pnpm 10.
- Java 17+ and Maven for the Blue Java helper runtime.
- A supported host platform: macOS x64/arm64, Windows x64, or Linux x64.
- For end-user playback validation, separately install Csound and `blue-engine`; they are intentionally not included in the first Blue installer.
- Production signing and publication are optional for local unsigned packages and are isolated in the protected GitHub release environment.

## Workflow Structure

| Workflow        | File                          | Triggers                              | Output                                                                 |
| --------------- | ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| PR validation   | `.github/workflows/pr.yml`    | `pull_request` → develop, main        | Build + test + lint + package; installer artifacts uploaded, no release |
| Develop build   | `.github/workflows/develop.yml` | `push` → develop                    | Build + test + lint + package; installer artifacts uploaded, no release |
| Stable release  | `.github/workflows/release.yml` | `vX.Y.Z` tag push                  | Full signed/unsigned stable release published to GitHub Releases       |

### Artifact Naming

Artifacts follow `blue-{os}-{cputype}-{version}-{suffix}`:

- PR builds: `blue-macos-arm64-0.0.1-pr42`
- Develop builds: `blue-macos-arm64-0.0.1-abc1234`

Each artifact zip contains only the installer file(s).

## Local Unsigned Package

1. Start from a clean checkout and install dependencies using the lockfile.
2. Run `pnpm app:build` to compile all workspace packages and produce an unpacked app.
3. Run `pnpm --filter @blue/app verify:packaged-app` to smoke-test the unpacked app.
4. Run `pnpm app:package` for the host-platform installer.

Expected outcome:

- The package output exists under `packages/blue-app/release/`.
- The smoke check finds `blue-java.jar` and `pythonLib` through the installed-resource path, loads the native ZeroMQ dependency, and verifies the pinned Electron SQLite runtime.
- No release asset is created and no signing credential is required.

## PR Validation

1. Open a pull request targeting `develop` or `main`.
2. Confirm the `pr.yml` workflow reports independent macOS x64, macOS arm64, Windows x64, and Linux x64 jobs.
3. Confirm each target completes build, test, lint, unsigned package, and packaged-app smoke verification.
4. Download installer artifacts from the workflow run page if needed for review.

## Develop Build

1. Push a change to `develop`.
2. Confirm the `develop.yml` workflow reports independent platform jobs.
3. Download installer artifacts from the workflow run page for testing.

Expected outcome: all target jobs are green. Artifacts are retained for 30 days.

## Stable Release

**Default: unsigned.** Stable releases are published as unsigned installers because Apple Developer Program and Azure Trusted Signing both require paid accounts. Signing is performed automatically when those credentials are present in the `release` GitHub Environment.

1. Confirm `packages/blue-app/package.json` contains the intended semantic version.
2. Run `pnpm verify` and `pnpm app:package` locally to validate the release candidate.
3. Create and push the matching immutable `vX.Y.Z` tag.
4. Approve the protected GitHub `release` Environment when prompted.
5. Wait for all target jobs and the final promotion job to complete.
6. Inspect the published release from a clean machine for each supported platform.

Expected outcome:

- The release is not public until all target assets and checksums pass validation.
- The release body includes source SHA, per-platform signing status, installation instructions, runtime prerequisites, and an auto-generated changelog (merged PR titles + new contributors).
- macOS assets are signed/notarized **only if** Apple credentials are configured.
- Windows assets are Authenticode-signed **only if** Azure Trusted Signing credentials are configured.
- Linux assets always match their published checksums.

## Credentials

**Default policy: no credentials required.** All signing values are optional; when absent the workflow publishes unsigned installers.

| Name                                        | GitHub location                          | Required for                         | Notes                                                  |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `GH_TOKEN`                                  | Automatically provided as `GITHUB_TOKEN` | GitHub stable publication            | Requires only release-content authority               |
| `CSC_LINK`                                  | Protected release-environment secret     | macOS signing (optional)             | Do not commit certificate data                         |
| `CSC_KEY_PASSWORD`                          | Protected release-environment secret     | macOS signing (optional)             | Never print or pass on a command line                  |
| `APPLE_ID`                                  | Protected release-environment secret     | macOS notarization (optional)        | Use a dedicated release account where possible         |
| `APPLE_APP_SPECIFIC_PASSWORD`               | Protected release-environment secret     | macOS notarization (optional)        | Never use the normal Apple account password            |
| `APPLE_TEAM_ID`                             | Protected release-environment secret     | macOS notarization (optional)        | Match the Developer ID signing team                    |
| `AZURE_CLIENT_ID`                           | Protected release-environment secret     | Windows Azure OIDC signing (optional)| Pair with a federated GitHub identity; no client secret |
| `AZURE_TENANT_ID`                           | Protected release-environment secret     | Windows Azure OIDC signing (optional)| Pair with a federated GitHub identity; no client secret |
| `AZURE_SUBSCRIPTION_ID`                     | Protected release-environment secret     | Windows Azure OIDC signing (optional)| Pair with a federated GitHub identity; no client secret |
| `AZURE_TRUSTED_SIGNING_ENDPOINT`            | Protected release-environment variable   | Windows signing (optional)           | Non-secret service configuration                       |
| `AZURE_TRUSTED_SIGNING_ACCOUNT`             | Protected release-environment variable   | Windows signing (optional)           | Non-secret account identifier                          |
| `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE` | Protected release-environment variable   | Windows signing (optional)           | Non-secret profile identifier                          |

## Release Failure Recovery

- Missing or malformed credentials: correct the protected environment value and rerun the stable workflow against the unchanged tag only if no release was published.
- Missing target asset or failed platform verification: fix the source/workflow defect, create a new version and tag, and release again. Never overwrite a published version.
- Published artifact defect: mark the release as withdrawn, document the affected platforms, and publish a new version. Do not replace assets under an existing version.
