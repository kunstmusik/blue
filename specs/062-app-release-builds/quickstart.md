# Release Build Validation Guide

This guide is the end-to-end acceptance procedure for the release implementation described in [plan.md](./plan.md). Implemented commands:

| Step                  | Implemented command                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local build/test/lint | `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm lint`                                                                                                            |
| Full repository verify | `pnpm verify` (package inputs + workflow contract + credential preflight tests + local advisory credential visibility)                                                         |
| Package inputs only   | `pnpm verify:package-inputs`                                                                                                                                                       |
| Workflow contract     | `pnpm verify:release-workflows`                                                                                                                                                    |
| Credential test coverage | `pnpm verify:release-credentials`                                                                                                                                               |
| Native rebuild        | `pnpm --filter @blue/app rebuild:native`                                                                                                                                           |
| Unsigned directory package | `pnpm --filter @blue/app package:dir`                                                                                                                                        |
| Per-target packages   | `pnpm --filter @blue/app package:macos-x64 \| package:macos-arm64 \| package:windows-x64 \| package:linux-x64`                                                                     |
| Packaged-app smoke    | `pnpm --filter @blue/app verify:packaged-app [-- --package-dir <dir>] [-- --no-playwright]`                                                                                        |
| Release manifest      | `pnpm --filter @blue/app release:manifest` (writes `packages/blue-app/release/release-manifest.json` and `.sha256`)                                                                |
| Release metadata      | `node scripts/release-metadata.mjs --out <release-metadata.json> [--channel development\|stable]`                                                                                  |
| Version validation    | `pnpm --filter @blue/app verify:release-version -- --tag vX.Y.Z --app-version X.Y.Z --repository <owner/repo> [--allow-no-gh-token]`                                                |
| Credential preflight  | `pnpm release:preflight -- [--scope macos\|windows\|publish] [--advisory] [--emit-availability]`                                                                                   |

## Prerequisites

- Node.js 22 and pnpm 10.
- Java 17+ and Maven for the Blue Java helper runtime.
- A supported host platform: macOS x64/arm64, Windows x64, or Linux x64.
- For end-user playback validation, separately install Csound and `blue-engine`; they are intentionally not included in the first Blue installer.
- Production signing is not required for local unsigned packages, development prereleases, or current stable releases. Stable publication requires the protected GitHub `release` Environment for maintainer approval.

## Local Unsigned Package

1. Start from a clean checkout and install dependencies using the lockfile.
2. Run the workspace build so the Java helper, externalized workspace packages, Electron main/preload code, and renderer output exist.
3. Run the host-platform unsigned directory-package command.
4. Run the packaged-app smoke command.

Expected outcome:

- The package output exists under the configured release output directory.
- The smoke check finds `blue-java.jar` and `pythonLib` through the installed-resource path, loads the native ZeroMQ dependency, and verifies the pinned Electron SQLite runtime.
- No release asset is created and no signing credential is required.
- macOS package scripts remain unsigned by default because `packages/blue-app/electron-builder.yml` disables signing identity auto-discovery.

## Multi-Platform CI

1. Open a pull request against `dev` or `main`, or push a change to either integration branch.
2. Confirm the CI workflow reports independent macOS x64, macOS arm64, Windows x64, and Linux x64 jobs.
3. Confirm each target completes build, test, lint, unsigned target package, and packaged-app smoke verification.
4. On failure, download the workflow's target-specific diagnostic artifact; confirm no release has been published.

Expected outcome: all target jobs are green before the change is eligible for stable release promotion.

## Development Prerelease

1. Trigger the scheduled development workflow from `main`, or manually dispatch it from `main`, `dev`, or an explicit source revision.
2. Wait for all unsigned target package jobs and the prerelease promoter job to succeed.
3. Open the generated GitHub prerelease.
4. Verify the prerelease label, source SHA, generated prerelease version, expected platform assets, checksum manifest, and generated notes.

Expected outcome: testers can download a complete unsigned prerelease package set without the workflow accessing production signing credentials.

## Stable Release

Stable releases are unsigned by default. The protected `release` GitHub Environment gates the final public publication step, not macOS or Windows signing credentials.

1. Confirm `packages/blue-app/package.json` contains the intended semantic version and release notes are ready.
2. Run the local unsigned package and packaged-app smoke check for the release candidate.
3. Create and push the matching immutable `vX.Y.Z` tag.
4. Approve the protected GitHub release environment when prompted.
5. Wait for all target jobs to complete, then approve the protected `release` Environment when the final publisher asks for review.
6. Inspect the published release from a clean machine for each supported platform.

Expected outcome:

- The release is not public until all target assets, checksums, and platform verification steps pass.
- macOS: unsigned DMG packages for x64 and arm64.
- Windows: unsigned NSIS installer for x64.
- Linux assets always match their published checksums.
- The release metadata identifies the tag, source SHA, unsigned signing status, and runtime prerequisites.

## Credentials

The current stable workflow requires only the GitHub-provided publication token plus protected `release` Environment approval. Future signing credentials are documented for readiness and are not required by local, CI, development, or current stable workflows.

| Name                                        | Local use                                   | GitHub location                          | Required for                         | Notes                                                                              |
| ------------------------------------------- | ------------------------------------------- | ---------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `GH_TOKEN`                                  | Optional for local release duplicate checks | Automatically provided as `GITHUB_TOKEN` | GitHub prerelease/stable publication | Requires only release-content authority; never needed for local unsigned packaging |
| `CSC_LINK`                                  | macOS Developer ID P12 path or base64 value | Future protected release secret          | Future macOS signing                 | Do not commit certificate data                                                     |
| `CSC_KEY_PASSWORD`                          | Password for local P12 use                  | Future protected release secret          | Future macOS signing                 | Never print or pass on a command line                                              |
| `APPLE_ID`                                  | Apple account for notarization              | Future protected release secret          | Future macOS notarization            | Use a dedicated release account where possible                                     |
| `APPLE_APP_SPECIFIC_PASSWORD`               | App-specific notarization password          | Future protected release secret          | Future macOS notarization            | Never use the normal Apple account password                                        |
| `APPLE_TEAM_ID`                             | Apple Developer team identifier             | Future protected release secret          | Future macOS notarization            | Match the Developer ID signing team                                                |
| `AZURE_CLIENT_ID`                           | Azure identity client ID                    | Future protected release secret          | Future Windows OIDC signing          | Pair with a federated GitHub identity; no client secret                            |
| `AZURE_TENANT_ID`                           | Azure tenant ID                             | Future protected release secret          | Future Windows OIDC signing          | Pair with a federated GitHub identity; no client secret                            |
| `AZURE_SUBSCRIPTION_ID`                     | Azure subscription ID                       | Future protected release secret          | Future Windows OIDC signing          | Pair with a federated GitHub identity; no client secret                            |
| `AZURE_TRUSTED_SIGNING_ENDPOINT`            | Signing service endpoint                    | Future protected release variable        | Future Windows signing               | Non-secret service configuration                                                   |
| `AZURE_TRUSTED_SIGNING_ACCOUNT`             | Artifact Signing account name               | Future protected release variable        | Future Windows signing               | Non-secret account identifier                                                      |
| `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE` | Certificate profile name                    | Future protected release variable        | Future Windows signing               | Non-secret profile identifier                                                      |

## Release Failure Recovery

- Missing publication approval or token permission: correct the protected environment or workflow-token configuration and rerun the stable workflow against the unchanged tag only if no release was published.
- Missing target asset or failed platform verification: fix the source/workflow defect, create a new version and tag, and release again. Never overwrite a published version.
- Future signing failure: inspect only redacted workflow diagnostics in the future signed-release branch; keep the current unsigned path separate.
- Published artifact defect: mark the release as withdrawn, document the affected platforms, and publish a new version. Do not replace assets under an existing version.
