# Implementation Plan: Blue App Builds and Releases

**Branch**: `062-app-release-builds` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/062-app-release-builds/spec.md`

## Summary

Package the existing Blue Electron application as a downloadable desktop app, make local unsigned packaging repeatable, validate build and package output on native macOS arm64, Windows x64, and Linux x64 runners, and promote only complete unsigned ZIP bundles into stable GitHub releases. Use `electron-builder` for native installer generation and GitHub Actions matrices plus a final publisher job for atomic promotion. Signing and notarization are reserved until the required signing programs and keys are funded. Develop builds run on pushes to `develop`, remain available only as Actions artifacts, and stable releases are triggered by matching `vX.Y.Z` tags.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode, Node.js 22, Electron 35.7.5, Java 17+ / Maven 3 for the helper runtime, YAML for GitHub Actions

**Primary Dependencies**: React 19, Vite 7, `vite-plugin-electron`, pnpm 10 workspaces, `electron-builder`, `@electron/rebuild`, existing `zeromq` native dependency, GitHub Actions

**Storage**: Source-controlled package/workflow configuration; GitHub Actions artifacts, verified checksum manifests, and GitHub Release metadata; tag-restricted GitHub `release` Environment; no new project XML or application-settings persistence

**Testing**: Vitest 4 existing suites; existing Java runtime packaged-resource tests; focused package-input and packaged-app smoke checks; unsigned artifact manifest verification; `pnpm test`; `pnpm lint`

**Target Platform**: Hosted macOS arm64, Windows x64, and Linux x64 bundles; the local macOS x64 command is retained only as an unsupported developer experiment

**Project Type**: Electron desktop application in a pnpm monorepo

**Performance Goals**: Complete each platform CI or release job within a 45-minute workflow timeout; make a developer package build and all release artifacts reproducible from the same tagged source revision

**Constraints**: Preserve the Electron 35.7.5 / Node 22.16.0 / SQLite runtime relationship; retain externalized `@blue/data`, `@blue/engine-client`, `zeromq`, and `node:sqlite` resolution; keep `blue-java.jar` and `pythonLib` addressable from installed resources; no production signing credentials in source, pull requests, CI, development builds, or current stable builds; no bundled Csound, `blue-engine`, Java runtime, updater, signed release path, or extra distribution channels in this slice

**Scale/Scope**: One package configuration, package verification scripts, a shared Actions setup action, pull-request and develop Actions workflows, a stable-release workflow, protected release documentation, and focused tests; no change to Blue project data or end-user audio behavior

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Portable data core**: **PASS**. `@blue/data` remains unchanged and receives no Electron, Node.js, DOM, or packaging implementation detail. Packaging behavior is limited to `@blue/app`, root scripts, and GitHub configuration.
- **Java and project compatibility**: **PASS**. No Java Blue behavior, `.blue` XML, or CSD output changes. The packaged-resource contract is the existing `java-runtime-path.ts` candidate order and its focused tests. The documented divergence is that Csound, `blue-engine`, and Java remain external user prerequisites.
- **Canonical ownership and contracts**: **PASS**. `BlueData` remains main-process owned and `.blue` remains canonical project persistence. Release artifacts and metadata are hosted by GitHub; workflow/package configuration is source controlled; future signing identities are held only in local environments or protected GitHub release storage when signing is enabled. The workflow contract is defined in [contracts/release-workflows.md](./contracts/release-workflows.md).
- **Runtime and engine isolation**: **PASS**. Java helper file access, ZeroMQ module loading, package smoke checks, manifest generation, and filesystem work stay in Electron main/build tooling and CI. The renderer and `@blue/data` remain isolated from host package operations.
- **Verification evidence**: **PASS**. Add package-input/unit coverage, a packaged-app smoke check, platform package runs, recomputed checksums, exact source revision, and a verified manifest, plus the scoped and repository-wide commands in [quickstart.md](./quickstart.md). Future signing/notarization evidence is intentionally outside this slice.

## Project Structure

### Documentation (this feature)

```text
specs/062-app-release-builds/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
  └── release-workflows.md
```

### Source Code (repository root)

```text
.github/
├── actions/setup-blue-build/action.yml       # Shared install/cache/build preparation
└── workflows/
    ├── pr.yml                                # PR validation matrix (build + test + package, no release)
    ├── develop.yml                           # Develop branch build (build + test + package, no release)
    └── release.yml                           # Tag-triggered stable release (unsigned by default)

docs/
└── release-guide.md                          # Maintainer local, GitHub, and optional signing guide

packages/blue-app/
├── electron-builder.yml                      # App identity, files, resources, and targets
├── build/
│   └── entitlements.mac.plist                # Hardened-runtime entitlements
├── scripts/
│   ├── verify-packaged-app.mjs               # Installed-resource and representative-project smoke checks
│   └── verify-release-version.mjs            # Tag/package version agreement
└── src/main/
    ├── packaged-runtime-verification.ts      # No-audio installed-runtime verification seam
    └── java-runtime/
        └── java-runtime-path.test.ts         # Packaged-resource test anchor

scripts/
├── verify-package-inputs.mjs                 # Built helper/workspace/runtime input validation
├── release-artifact-manifest.mjs             # Per-target SHA-256 manifest generation/validation
├── release-credential-preflight.mjs          # Advisory signing credential availability check
├── release-credential-preflight.test.mjs     # Sanitized preflight test suite
├── release-metadata.mjs                      # Dev/stable release metadata derivation
├── validate-release-workflows.mjs            # Workflow contract validator (57 checks)
├── verify.mjs                                # Top-level repository verifier
└── clean.mjs                                 # Build artifact cleaner
```

**Structure Decision**: Three workflows split by trigger: `pr.yml` for PR validation, `develop.yml` for develop-branch builds, and `release.yml` for tag-triggered stable releases. Neither `pr.yml` nor `develop.yml` publishes a GitHub Release; both upload installer-only artifacts for download from the Actions run page. Only `release.yml` publishes, and only after the complete asset set validates.

## Implementation Sequence

1. **Define package inputs and local commands**: Add the packaging dependencies and root scripts. Create `electron-builder.yml` with the Blue app identity, Electron version pin, macOS x64/arm64 DMG targets, Windows x64 NSIS target, Linux x64 AppImage/Deb targets, `.blue` file association, ASAR behavior, explicit Java helper resources, and native-node unpacking. Add package-input validation that fails before packaging when the helper JAR, Python library, compiled workspace runtime dependencies, or expected Electron version are absent.
2. **Protect runtime resolution**: Extend tests around `java-runtime-path.ts` and add a packaged-app smoke path that verifies `blue-java.jar`, `pythonLib`, externalized workspace dependencies, `node:sqlite`, and `zeromq` resolve from a packaged application. Run the resulting application in a deterministic no-audio smoke mode so Csound and `blue-engine` are not required for package validation.
3. **Create local release ergonomics**: Add unsigned `package:dir`, `package:current`, and host/target package commands. Add tag-version validation and checksum generation. Document a single clean-machine unsigned package procedure plus explicit diagnostic messages for missing build inputs, user runtime prerequisites, and future signing variables if they are accidentally present.
4. **Create reusable CI preparation**: Add a repository-local setup action that pins pnpm, Node, and Java; restores the pnpm cache; installs with the lockfile; and builds the Java helper before package consumers. Keep all third-party Actions pinned to reviewed revisions or maintained major releases under repository policy.
5. **Expand CI validation**: Replace the macOS-only workflow with a native target matrix. Each matrix entry runs install, the full build, focused package-input checks, affected tests, repository tests, lint, an unsigned directory package, and packaged-app smoke verification. Upload logs and package evidence even when a validation stage fails.
6. **Distribute develop Actions artifacts**: On each push to `develop`, build the full unsigned hosted matrix, append the short source SHA to the version information, and upload `blue-{os}-{cputype}-{versionInfo}.zip` artifacts only after their checks pass. Do not create a GitHub Release or grant `contents: write`.
7. **Publish protected stable releases**: Add a tag-triggered workflow that first validates tag/package version agreement, then runs the unsigned platform packaging matrix. Each platform job wraps its native output in exactly one `blue-{os}-{cputype}-{version}.zip`; the Linux ZIP contains both the AppImage and Debian package. The final protected publisher job downloads exactly the three expected bundles, recomputes their checksums, validates a verified manifest, and publishes those same filenames as GitHub Release assets. It must never publish after a failed, skipped, missing, duplicate, unexpected, or altered bundle.
8. **Document operations and recovery**: Add `docs/release-guide.md` covering pull-request and develop Actions artifacts, stable releases, GitHub Environment publication protection, future signing inputs, external user runtime prerequisites, release rollback, and incident response. Link the guide from the README release section.

## Validation Strategy

- Unit-test package input validation and Java resource-path contracts.
- Run local unsigned package and packaged-app smoke checks on a supported macOS machine.
- Require the multi-platform package matrix for pull requests and pushes to `develop`.
- Verify a develop push produces exactly three primary `.zip` Actions artifacts whose filenames include the source SHA, with no GitHub Release and no production-secret access.
- Use a protected test tag/release to verify unsigned stable publication before the first production release. Validate macOS signing/notarization and Windows cloud signing later in a dedicated future signed-release slice.
- Verify published release assets from a clean macOS, Windows, and Linux environment using [quickstart.md](./quickstart.md).

## Complexity Tracking

No constitution violations or exceptional abstractions are required.
