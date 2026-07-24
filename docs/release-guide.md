# Blue Release Guide

This guide defines the maintainer procedure and security boundary for Blue desktop packages.

Blue's first packaged release supports macOS x64 and arm64, Windows x64, and Linux x64. It ships Blue and its Java helper, but does not include Csound, `blue-engine`, or a Java runtime. Playback users must install those runtime prerequisites separately.

## Signing Policy

Contributor builds, CI package checks, development prereleases, and stable releases are unsigned by default. They must not require Apple Developer ID credentials, notarization credentials, Azure Trusted Signing values, or GitHub OIDC signing permissions.

The protected GitHub `release` Environment is still used for stable releases, but its current purpose is publication approval. Signing and notarization are future work. `pnpm release:preflight` remains as an advisory future-readiness check and is not part of the current stable-release gate.

## Release Channels

| Channel                | Trigger                                       | Signing  | Publication                                                         |
| ---------------------- | --------------------------------------------- | -------- | ------------------------------------------------------------------- |
| CI verification        | Pull requests and pushes to `dev` or `main`   | Unsigned | No GitHub Release; diagnostics only                                 |
| Development prerelease | Nightly schedule on `main` or manual dispatch | Unsigned | One clearly labeled GitHub prerelease with source SHA and checksums |
| Stable release         | Immutable `vX.Y.Z` tag                        | Unsigned | One public GitHub Release after complete platform verification and protected publication approval |

Do not create a stable release from an untagged commit, a branch name, or a tag whose version does not match `packages/blue-app/package.json`.

### Implemented commands

| Workflow            | Implemented commands                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CI verification     | `pnpm verify:package-inputs`, `pnpm --filter @blue/app package:<target>`, `pnpm --filter @blue/app verify:packaged-app`, `pnpm --filter @blue/app release:manifest`                                                                       |
| Development release | `node scripts/release-metadata.mjs --out release-metadata.json --channel development` in the promoter job; the workflow uploads per-target artifacts and creates one GitHub prerelease                                                     |
| Stable release      | `pnpm --filter @blue/app verify:release-version -- --repository <owner/repo>`, unsigned per-target package jobs, manifest consolidation, draft creation, and final `gh release edit --draft=false` from the protected publisher job |

## Local Prerequisites

Install the following before any local package build:

- Node.js 22 and pnpm 10 through Corepack.
- Java 17+ and Maven 3+ so the Java helper can produce `blue-java.jar` and `pythonLib`.
- The platform tools required by `electron-builder` for the current host operating system.
- For playback testing only, a separately installed Java runtime, Csound 7, and `blue-engine`.

Use a clean checkout and the lockfile:

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

The implemented host-platform package and smoke commands are:

```bash
pnpm verify:package-inputs
pnpm --filter @blue/app rebuild:native
pnpm --filter @blue/app package:dir
pnpm --filter @blue/app verify:packaged-app
```

`verify:package-inputs` runs from the repository root and checks that the Java helper JAR, Python library, built Electron entries, externalized workspace packages, pinned Electron version, ZeroMQ native binary, and Vite externals contract are all present before packaging. It is automatically invoked as the first step of every `package:*` script, so it can also be run on its own to diagnose a failing CI target.

`rebuild:native` rebuilds the native `zeromq` addon against the installed Electron runtime. Run it after a fresh `pnpm install` if you change Node or Electron versions.

`package:dir` builds an unsigned unpacked application into `packages/blue-app/release/`. `package:current` and the per-target scripts `package:macos-x64`, `package:macos-arm64`, `package:windows-x64`, and `package:linux-x64` produce the host platform installer formats declared in `packages/blue-app/electron-builder.yml`. The builder configuration disables macOS signing identity auto-discovery so local macOS packages stay unsigned by default.

`verify:packaged-app` must prove that the installed app resolves the bundled Java helper at `resources/assets/java`, retains the externalized workspace modules, loads `zeromq`, and uses the Electron-pinned `node:sqlite` runtime. It launches the packaged application with `BLUE_VERIFY_MODE=packaged-resources` and exits non-zero if any runtime dependency cannot be resolved. It must not require Csound or `blue-engine`.

### Diagnosing missing prerequisites

| Symptom                                                                                                                                    | Likely cause                                                                       | Corrective action                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify:package-inputs` reports `[FAIL] Java helper JAR` or `Java helper Python library`                                                   | `@blue/java-runtime` has not been built                                            | `pnpm --filter @blue/java-runtime build`, then re-run `verify:package-inputs`.                                                                          |
| `verify:package-inputs` reports `[FAIL] Externalized workspace package @blue/data` or `@blue/engine-client`                                | Workspace packages have not been built                                             | `pnpm --filter @blue/data build` and `pnpm --filter @blue/engine-client build` if present, then re-run.                                                 |
| `verify:package-inputs` reports `[FAIL] Electron main bundle`, `Electron preload bundle`, or `Electron renderer output`                    | `packages/blue-app` build has not completed                                        | `pnpm --filter @blue/app build`, then re-run.                                                                                                           |
| `verify:package-inputs` reports `[FAIL] Electron pin mismatch`                                                                             | `packages/blue-app/package.json` no longer pins `electron` to `35.7.5`             | Restore the pin before packaging; do not change the Electron/Node/SQLite runtime contract in this release.                                              |
| `verify:package-inputs` reports `[FAIL] Native ZeroMQ .node binary`                                                                        | `zeromq` has not been rebuilt for Electron                                         | `pnpm --filter @blue/app rebuild:native`, then re-run.                                                                                                  |
| `verify:packaged-app` reports `[FAIL] Java helper JAR not found` from inside the packaged app                                              | electron-builder did not copy `assets/java/*` to installed `resources/assets/java` | Inspect the unpacked application's `Resources/assets/java` directory; rebuild after confirming the assets exist in `packages/blue-app/assets/java`.       |
| The packaged application launches but the renderer shows an error mentioning Csound or `blue-engine`                                       | End-user audio prerequisites are not installed                                     | Install Csound 7 and `blue-engine` separately for playback testing. They are not required for `verify:packaged-app` to pass.                            |
| A local package unexpectedly attempts signing                                                                                              | The unsigned builder configuration was changed or signing variables were exported in the shell | Restore `mac.identity: null` in `packages/blue-app/electron-builder.yml` and clear signing variables for the unsigned default path. |

## Future Signing Readiness

Signing is intentionally not active in the current workflows. The following values are documented so a future signed-release slice can be prepared without changing contributor, CI, development prerelease, or current stable unsigned behavior.

`pnpm release:preflight` checks variable presence and shape without printing secret values. It is advisory today:

```bash
pnpm release:preflight -- --advisory
pnpm release:preflight -- --scope macos --advisory
pnpm release:preflight -- --scope windows --advisory
```

### Future macOS signing

| Variable                      | Purpose                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `CSC_LINK`                    | Path to, or base64-encoded value of, a Developer ID Application P12 certificate   |
| `CSC_KEY_PASSWORD`            | Password for the P12 certificate                                                  |
| `APPLE_ID`                    | Apple account used to submit notarization requests                                |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for `APPLE_ID`                                              |
| `APPLE_TEAM_ID`               | Apple Developer team identifier that owns the certificate                         |

A future signed macOS workflow should sign, notarize, staple, and perform Gatekeeper assessment before accepting either macOS artifact.

### Future Windows signing

| Variable                                    | Purpose                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`                           | Azure app or managed-identity client ID bound to the GitHub federated credential |
| `AZURE_TENANT_ID`                           | Azure Entra tenant ID                                                            |
| `AZURE_SUBSCRIPTION_ID`                     | Azure subscription containing Artifact Signing                                   |
| `AZURE_TRUSTED_SIGNING_ENDPOINT`            | Artifact Signing service endpoint                                                |
| `AZURE_TRUSTED_SIGNING_ACCOUNT`             | Artifact Signing account name                                                    |
| `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE` | Artifact Signing certificate profile name                                        |

A future signed Windows workflow should request GitHub `id-token: write`, authenticate with the configured federated identity, sign the NSIS executable, and verify the Authenticode signature before promotion. Do not use a P12 certificate, an Azure client secret, or repository-wide signing secrets for that future path.

## GitHub Configuration

Create a protected GitHub Environment named `release` before enabling stable publication. For the current unsigned workflow it does not need Apple or Azure signing values. Use it to require maintainer review before the final stable publisher makes a release public.

The Environment policy should include:

- Required reviewers: at least one maintainer who did not author the tag.
- Deployment branch policy: restrict to the immutable tag pattern (`v*.*.*`).
- Wait timer: optional, but useful for last-minute cancellation.
- No inherited secrets from repository-level variables that overlap with future release-scoped signing values.

`GITHUB_TOKEN` is injected by GitHub Actions. Do not create, store, or substitute a personal access token for normal artifact publication. The CI workflow receives `contents: read`; only the development and stable publisher jobs receive `contents: write`.

The CI and development-prerelease workflows must not reference the `release` Environment. Pull requests from forks and Dependabot must remain able to run secret-free validation.

## Development Prerelease Procedure

1. Ensure the source branch has passed CI. The schedule builds `main`; manual dispatch can build `main`, `dev`, or an explicit SHA.
2. Run the scheduled prerelease workflow or dispatch it manually with the intended source revision. To validate the metadata locally first:
   ```bash
   node scripts/release-metadata.mjs --out /tmp/release-metadata.json --channel development
   ```
3. Wait for all macOS, Windows, and Linux package jobs plus the prerelease promoter job.
4. Verify the prerelease labels, version, immutable source SHA, expected platform assets, per-target checksums, and generated release notes.
5. Download at least one artifact on its matching platform and run the packaged-app smoke validation:
   ```bash
   pnpm --filter @blue/app verify:packaged-app -- --package-dir <unpacked-dir>
   ```

Development prereleases are intentionally unsigned and must say so in their notes. They are not candidates for a stable tag without a new stable workflow run.

## Stable Release Procedure

1. Update `@blue/app` to the intended semantic version and prepare release notes.
2. Run the clean local validation commands, including an unsigned host package and packaged-app smoke check.
3. Confirm the candidate commit has passed the cross-platform CI matrix on `dev` or `main`.
4. Locally verify the tag/version agreement before pushing:
   ```bash
   pnpm --filter @blue/app verify:release-version -- \
       --tag vX.Y.Z --app-version X.Y.Z --repository <owner/repo> --allow-no-gh-token
   ```
5. Create an annotated, immutable `vX.Y.Z` tag matching the app version and push it.
6. Wait for all target package jobs to report success:
   - **macOS**: produces unsigned DMG packages for x64 and arm64.
   - **Windows**: produces an unsigned NSIS installer for x64.
   - **Linux**: produces checksummed AppImage and Debian packages.
7. Review and approve the protected `release` Environment when GitHub Actions requests it for the final publisher job.
8. The final publisher downloads every target artifact, validates the consolidated manifest (`macos-x64`, `macos-arm64`, `windows-x64`, `linux-x64`), composes a release body that labels macOS and Windows as unsigned and lists runtime prerequisites, creates a draft GitHub Release with checksum files, then publishes it via `gh release edit --draft=false`.
9. Inspect the published release from a clean machine for each supported platform before announcing it.

The final publisher is the only workflow job allowed to create or publish the stable GitHub Release. It stages the release as a draft, validates the exact expected artifact manifest, attaches all artifacts, checksums, and provenance, then publishes it. No individual platform job may publish a release asset by itself.

## Failure Recovery

| Failure                                                        | Required Action                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Build, test, package, resource smoke, or checksum failure      | Do not publish. Fix the defect and run validation again.                                                                  |
| Release environment approval or publication-permission failure | Correct the protected-environment or workflow-token configuration; inspect only redacted workflow logs.                   |
| Incomplete artifact set                                        | Leave the draft unpublished or remove an empty draft. Never publish a partial stable release.                             |
| Future signing credential or signature failure                 | Keep the current unsigned path separate; fix the signed-release configuration in a dedicated future signed-release branch. |
| Defect in an already published release                         | Withdraw or mark the release as affected, document the issue, and publish a newer version. Never replace assets.          |

## Security Rules

- Never commit certificates, passwords, Apple credentials, Azure credentials, `.env` files, or release tokens.
- Never use secrets as command-line arguments. Use environment variables or the release environment only.
- Never expose future production signing credentials to a pull request, a development prerelease, a fork, Dependabot, or a renderer process.
- Never overwrite a published release tag or replace an existing release artifact.
- Treat package checksums, source revision, release notes, and, when future signing is enabled, signature/notarization results as required release evidence.

## Intentional Scope Boundaries

This release system does not add automatic in-app updates, bundle Csound, bundle `blue-engine`, bundle a Java runtime, ship Windows arm64, add extra Linux package formats, or enable signed releases. Those are future features with separate runtime, support, and release-policy decisions.
