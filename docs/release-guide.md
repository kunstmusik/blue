# Blue Release Guide

This guide defines the maintainer procedure and security boundary for Blue desktop packages.

For standalone npm packages (`@kunstmusik/blue-data` and `@kunstmusik/blue-cli`) and the tagged `blue-projects` agent skill, see the [npm tooling release guide](npm-release-guide.md). Desktop `v*.*.*` releases and npm/skill `npm-v*` releases are independent, with separate versions, tags, GitHub Environments (`release` vs. `npm-release`), and release workflows.

Blue's packaged release supports macOS arm64, Windows x64, and Linux x64. It
ships Blue, its Java helper, and a revision-matched Blue Engine sidecar. Csound
7 remains an optional runtime installation required for playback/rendering,
and users need a Java runtime for Java-backed features. Blue can start,
open/edit/save projects, and report Csound diagnostics without Csound.

## Signing Policy

Contributor builds, CI package checks, develop-branch artifacts, prereleases, and stable releases are unsigned. They must not require Apple Developer ID credentials, notarization credentials, Azure Trusted Signing values, or GitHub OIDC signing permissions.

The GitHub `release` Environment is still used as the tagged-release publisher boundary and future signing-credential scope. Because Blue currently has one maintainer, it does not require a second-person reviewer: pushing the immutable version tag is the maintainer's explicit publication decision. Signing and notarization are future work because the project does not currently fund the required signing programs and keys. `pnpm release:preflight` remains as an advisory future-readiness check and is not part of the current tagged-release gate.

## Release Channels

| Channel            | Trigger                              | Signing  | Publication                                                |
| ------------------ | ------------------------------------ | -------- | ---------------------------------------------------------- |
| PR verification    | Pull requests to `develop` or `main` | Unsigned | Versioned GitHub Actions artifacts only; no GitHub Release |
| Develop build      | Pushes to `develop`                  | Unsigned | Versioned GitHub Actions artifacts only; no GitHub Release |
| Prerelease release | Immutable `vX.Y.Z-<prerelease>` tag  | Unsigned | One public GitHub prerelease after complete verification   |
| Stable release     | Immutable `vX.Y.Z` tag               | Unsigned | One public GitHub Release after complete verification      |

Do not create a tagged release from an untagged commit, a branch name, or a tag whose version does not match `packages/blue-app/package.json`.

### Implemented commands

| Workflow        | Implemented commands                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PR verification | Package input checks, tests, lint, target packaging, and packaged-app smoke checks; directly uploads `blue-{os}-{cputype}-{version}-pr{number}.{ext}` Actions artifacts                          |
| Develop build   | The same package checks on pushes to `develop`; directly uploads `blue-{os}-{cputype}-{version}-{short-sha}.{ext}` Actions artifacts and creates no GitHub Release                               |
| Tagged release  | Tag/version validation, unsigned native-package staging, verified manifest consolidation, draft creation, and final `gh release edit --draft=false` from the `release` Environment publisher job |

## Local Prerequisites

Install the following before any local package build:

- A Node.js version supported by the [workspace toolchain](../README.md#prerequisites)
  and the pnpm version pinned in the root `package.json` `packageManager` field.
- Java 17+ and Maven 3+ so the Java helper can produce `blue-java.jar` and `pythonLib`.
- Quarto to render the bundled user manual.
- The platform tools required by `electron-builder` for the current host operating system.
- For playback testing, a Java runtime and Csound 7. Blue Engine is built from this checkout and bundled.
- CMake 3.21+ and a supported C/C++ toolchain. The native build bootstraps its
  pinned vcpkg checkout automatically unless `VCPKG_ROOT` selects an existing
  bootstrapped checkout.

Use a clean checkout and the lockfile. The install supplies the project-local
Vite+ CLI used by the build, test, and lint scripts.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

The implemented host-platform package and smoke commands are:

```bash
pnpm --filter @blue/app rebuild:native
pnpm --filter @blue/app package:dir
pnpm --filter @blue/app verify:packaged-app
```

Every `package:*` script is the authoritative packaging boundary. It stages the selected Blue Engine, generates `release-metadata.json`, verifies the complete package inputs, and only then invokes `electron-builder`. Do not place a standalone input check before the package command: the generated metadata it validates does not exist yet in a clean checkout.

For focused input diagnostics after the build prerequisites are present, generate metadata before running the root verifier:

```bash
pnpm --filter @blue/app release:metadata
pnpm verify:package-inputs
```

`release:metadata` defaults to the `development` channel. PR and develop jobs explicitly use that channel, while tagged-release package jobs derive `BLUE_RELEASE_CHANNEL` from the version: a hyphenated version uses `prerelease`, and a plain `X.Y.Z` version uses `stable`. The generated, ignored `packages/blue-app/release-metadata.json` records the application version, build time, full source revision, channel, release version, name, and notes. `electron-builder` embeds it in the ASAR for the About Blue window.

`verify:package-inputs` runs from the repository root and validates that metadata, including its version, timestamp, full revision, required release fields, and expected channel. It also checks that the Java helper JAR, Python library, built Electron entries (including shared runtime modules), externalized workspace packages, pinned Electron version, ZeroMQ native binary, Vite externals contract, and exactly one revision/protocol/target/hash-matched Blue Engine are present before packaging. Every `package:*` script invokes it automatically after generating metadata.

`rebuild:native` rebuilds the native `zeromq` addon against the installed Electron runtime. Run it after a fresh `pnpm install` if you change Node or Electron versions.

`package:dir` builds an unsigned unpacked application into `packages/blue-app/release/`. `package:current` and the release-target scripts `package:macos-arm64`, `package:windows-x64`, and `package:linux-x64` produce the installer formats declared in `packages/blue-app/electron-builder.yml`. `package:macos-x64` remains available for local developer experiments but is not part of the hosted build or published release matrix. The builder configuration disables macOS signing identity auto-discovery so local macOS packages stay unsigned.

`verify:packaged-app` launches the installed application in four deterministic verification modes. `BLUE_VERIFY_MODE=packaged-metadata` proves that the embedded About Blue metadata matches the packaged application version and requested release channel. `BLUE_VERIFY_MODE=packaged-resources` proves that the bundled Java helper at `resources/assets/java`, bundled Blue Engine at `resources/assets/engine`, externalized workspace modules, `zeromq`, and Electron-pinned `node:sqlite` runtime resolve. It also runs the engine's side-effect-free probe against an intentionally missing Csound path and requires a structured recoverable result. `BLUE_VERIFY_MODE=packaged-project` loads `fixtures/smoke-test.blue` through the normal main-process project path and proves that it became the current project. Finally, `BLUE_VERIFY_MODE=packaged-engine-mismatch` proves that an incompatible engine is rejected before playback while the project remains open. Any failure exits non-zero. All modes use an isolated temporary user-data directory; none starts audio or touches the maintainer's normal Blue profile.

### Diagnosing missing prerequisites

| Symptom                                                                                                     | Likely cause                                                                                                        | Corrective action                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify:package-inputs` reports `[FAIL] Java helper JAR` or `Java helper Python library`                    | `@blue/java-runtime` has not been built                                                                             | `pnpm --filter @blue/java-runtime build`, then re-run `verify:package-inputs`.                                                                            |
| `verify:package-inputs` reports `[FAIL] Externalized workspace package @blue/data` or `@blue/engine-client` | Workspace packages have not been built                                                                              | `pnpm --filter @blue/data build` and `pnpm --filter @blue/engine-client build` if present, then re-run.                                                   |
| `verify:package-inputs` reports a missing Electron main, preload, renderer, or shared runtime output        | `packages/blue-app` build has not completed                                                                         | `pnpm --filter @blue/app build`, then re-run.                                                                                                             |
| `verify:package-inputs` reports an Electron pin mismatch                                                    | The app manifest and the [package-input verifier](../scripts/verify-package-inputs.mjs) disagree on the runtime pin | Align the manifest, verifier, installed Electron, and native addon rebuild before packaging.                                                              |
| `verify:package-inputs` reports `[FAIL] Native ZeroMQ .node binary`                                         | `zeromq` has not been rebuilt for Electron                                                                          | `pnpm --filter @blue/app rebuild:native`, then re-run.                                                                                                    |
| `verify:packaged-app` reports `[FAIL] Java helper JAR not found` from inside the packaged app               | electron-builder did not copy `assets/java/*` to installed `resources/assets/java`                                  | Inspect the unpacked application's `Resources/assets/java` directory; rebuild after confirming the assets exist in `packages/blue-app/assets/java`.       |
| The packaged application launches but an engine operation reports Csound unavailable                        | Csound 7 is not installed or cannot be loaded                                                                       | Install Csound 7, then use Realtime Render settings to retry the compatibility probe. Blue Engine itself is bundled and must not be installed separately. |
| A local package unexpectedly attempts signing                                                               | The unsigned builder configuration was changed or signing variables were exported in the shell                      | Restore `mac.identity: null` in `packages/blue-app/electron-builder.yml` and clear signing variables for the unsigned default path.                       |

## Publication credentials

The active release workflows publish unsigned packages. Use
`pnpm release:preflight -- --scope publish --advisory` to check local publishing
readiness without printing credential values. Platform signing configuration is
documented in the [release feature quickstart](../specs/062-app-release-builds/quickstart.md).

| Variable       | Purpose                                                                                 | Exact expected format                                                                                                                                      | Storage and scope                                                                                                                                                                                                                                 | Consuming workflow or command                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GITHUB_TOKEN` | Check for an existing release and publish the verified tagged release                   | Opaque job token generated by GitHub Actions; no project-defined value or fixed textual shape                                                              | Generated automatically for each Actions job; never add it as a repository or Environment secret. The validation job receives `contents: read`; only the `publish-release` job in the protected `release` Environment receives `contents: write`. | Current `.github/workflows/release.yml` `validate-version` and `publish-release` jobs                                                                                                      |
| `GH_TOKEN`     | Authenticate optional local duplicate-release checks or local `gh` publication commands | Non-empty opaque token accepted by GitHub CLI; permissions must match the local operation (`contents: read` for checks, `contents: write` for publication) | Maintainer's local shell environment or GitHub CLI credential store only; never commit it and do not add it to PR or develop workflows                                                                                                            | Current advisory `pnpm release:preflight -- --scope publish`; optional local `gh` commands only. GitHub Actions maps its generated `GITHUB_TOKEN` to `GH_TOKEN` for the publisher command. |

## GitHub Configuration

Create a GitHub Environment named `release` before enabling tagged publication. For the current unsigned workflow it does not need Apple or Azure signing values. It scopes the final publisher job, permits tag-only deployment policy, and provides the future home for release-only signing configuration.

Configure it under **Repository Settings → Environments → release**:

1. Leave **Required reviewers** empty while Blue is a one-person project. Requiring another reviewer would make releases impossible, and self-approval would add ceremony without independent review.
2. Under **Deployment branches and tags**, select **Selected branches and tags**, add a **Tag** rule for `v*.*.*`, and do not add a branch rule. This admits both `vX.Y.Z` and hyphenated prerelease tags such as `v3.0.0-beta.1`.
3. Do not add current signing secrets. Scope any future signing values to the protected release Environment.

With no required reviewer, pushing a matching version tag is the deliberate release action. The three unsigned package jobs must succeed before `publish-release` receives `contents: write`; that job then verifies the complete checksummed asset set, stages a draft, marks it as a prerelease when the tag has a suffix, and publishes it. If Blue gains another active maintainer, add a required reviewer and enable **Prevent self-review** as an optional policy hardening step.

`GITHUB_TOKEN` is injected by GitHub Actions. Do not create, store, or substitute a personal access token for normal artifact publication. PR, develop, and tagged-release package jobs receive `contents: read`; only the tagged-release publisher job receives `contents: write`.

The PR and develop workflows must not reference the `release` Environment. Pull requests from forks and Dependabot must remain able to run secret-free validation.

## Develop Actions Artifact Procedure

1. Push the intended source revision to `develop`.
2. Wait for the macOS arm64, Windows x64, and Linux x64 jobs in `.github/workflows/develop.yml`.
3. Confirm the Actions artifacts use these exact forms:
   - `blue-macos-arm64-{version}-{short-sha}.dmg`
   - `blue-windows-x64-{version}-{short-sha}.exe`
   - `blue-linux-x64-{version}-{short-sha}.AppImage`
   - `blue-linux-x64-{version}-{short-sha}.deb`
4. Download at least one artifact on its matching platform and run the packaged-app smoke validation:
   ```bash
   pnpm --filter @blue/app verify:packaged-app -- --package-dir <unpacked-dir>
   ```
5. Confirm the workflow created no GitHub Release and used no production credentials.

Develop artifacts are retained by GitHub Actions for 30 days. They are not release assets and are never promoted in place; every prerelease or stable tag always triggers a fresh build.

## Tagged Release Procedure

This procedure covers both prereleases and stable releases. Beta and release-candidate builds use the same verified packaging pipeline; the prerelease identifier communicates the maturity:

- Use versions such as `3.0.0-beta.1`, `3.0.0-beta.2`, and `3.0.0-beta.3` while collecting broader beta feedback.
- Use `3.0.0-rc.1`, `3.0.0-rc.2`, and so on when the candidate is intended to become the final release unless a release-blocking defect is found.
- Publish the final stable release as `3.0.0`, without a prerelease suffix.

Every hyphenated version is published as a GitHub prerelease. Release tags use a SemVer core plus dot-separated prerelease identifiers; build metadata after a `+` is intentionally not used for publication tags. There is no special CI branch for beta versus RC, and a published tag is immutable: move to the next identifier instead of reusing a tag.

1. Update `@blue/app` to the intended version and add its changelog entry following [Maintaining the changelog](changelog.md). For example, set `packages/blue-app/package.json` to `3.0.0-beta.1` and add the matching dated entry.
2. Run the clean local validation commands, including an unsigned host package and packaged-app smoke check.
3. Confirm the candidate commit has passed the cross-platform develop workflow and any required pull-request checks.
4. Locally verify the tag/version agreement before pushing:
   ```bash
   pnpm --filter @blue/app verify:release-version -- \
       --tag vX.Y.Z[-prerelease] --app-version X.Y.Z[-prerelease] \
       --repository <owner/repo> --allow-no-gh-token
   ```
5. Create an annotated, immutable `vX.Y.Z[-prerelease]` tag matching the app version and push it. For the example above:
   ```bash
   git tag -a v3.0.0-beta.1 -m "Blue 3.0.0-beta.1"
   git push origin v3.0.0-beta.1
   ```
6. Wait for all target package jobs to report success:
   - **macOS**: produces an unsigned arm64 DMG.
   - **Windows**: produces an unsigned NSIS installer for x64.
   - **Linux**: produces checksummed AppImage and Debian packages.
7. No approval prompt is expected for the current single-maintainer policy; after all package jobs succeed, confirm that the `publish-release` job starts automatically in the `release` Environment.
8. The final publisher downloads and validates exactly `blue-macos-arm64-X.Y.Z[-prerelease].dmg`, `blue-windows-x64-X.Y.Z[-prerelease].exe`, `blue-linux-x64-X.Y.Z[-prerelease].AppImage`, and `blue-linux-x64-X.Y.Z[-prerelease].deb`.
9. The publisher requires verified checksums, matching version/source metadata, and no missing, duplicate, or unexpected package. It then creates a draft GitHub Release with the native-package filenames, `checksums-sha256.txt`, and `release-manifest.json`. A hyphenated version is marked as a prerelease; a plain `X.Y.Z` version is published as stable.
10. Add the matching [changelog entry](changelog.md#publishing-on-github) to the GitHub release body. Inspect the published release from a clean machine for each supported platform before announcing it. If testing finds a defect, fix it and publish a new tag such as `v3.0.0-beta.2` or `v3.0.0-rc.2`; do not overwrite `v3.0.0-beta.1`. After the final candidate is accepted, publish a fresh stable tag `v3.0.0`.

The final publisher is the only workflow job allowed to create or publish a tagged GitHub Release. It validates the exact expected artifact manifest, stages the release as a draft with all native packages, checksums, and manifest metadata attached, then publishes it. No individual platform job may publish a release asset by itself.

## Failure Recovery

| Failure                                                   | Required Action                                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Build, test, package, resource smoke, or checksum failure | Do not publish. Fix the defect and run validation again.                                                                   |
| Incomplete artifact set                                   | Leave the draft unpublished or remove an empty draft. Never publish a partial tagged release.                              |
| Future signing credential or signature failure            | Keep the current unsigned path separate; fix the signed-release configuration in a dedicated future signed-release branch. |
| Defect in an already published release                    | Withdraw or mark the release as affected, document the issue, and publish a newer version. Never replace assets.           |

## Security Rules

- Never commit certificates, passwords, Apple credentials, Azure credentials, `.env` files, or release tokens.
- Never use secrets as command-line arguments. Use environment variables or the release environment only.
- Never expose future production signing credentials to a pull request, a develop build, a fork, Dependabot, or a renderer process.
- Never overwrite a published release tag or replace an existing release artifact.
- Treat package checksums, source revision, release notes, and, when future signing is enabled, signature/notarization results as required release evidence.

## Intentional Scope Boundaries

This release system does not add automatic in-app updates, bundle Csound,
bundle a Java runtime, ship Windows arm64, or add extra Linux package formats.
Blue Engine is bundled. Signed release credentials remain a release-policy
concern; the nested engine signing hook and engine-only entitlement are ready
for a configured macOS identity.

Desktop `v*.*.*` releases and standalone npm/skill `npm-v*` releases (`@kunstmusik/blue-data`, `@kunstmusik/blue-cli`, and `skills/blue-projects`) are also independent; npm publication uses separate versions, `npm-v*` tags, the `npm-release` Environment, and the [npm tooling release guide](npm-release-guide.md).
