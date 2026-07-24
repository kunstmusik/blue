# Implementation Plan: Blue App Builds and Releases

**Branch**: `062-app-release-builds` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/062-app-release-builds/spec.md`

## Summary

Package the existing Blue Electron application as a downloadable desktop app, make local unsigned packaging repeatable, validate build and package output on native macOS, Windows, and Linux runners, and promote only complete unsigned artifacts into GitHub releases. Use `electron-builder` for installer generation and GitHub Actions matrices plus a final publisher job for atomic promotion. Signing and notarization are reserved for a future release slice. Development prereleases remain unsigned, scheduled from `main`, and stable releases are triggered by matching `vX.Y.Z` tags.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode, Node.js 22, Electron 35.7.5, Java 17+ / Maven 3 for the helper runtime, YAML for GitHub Actions

**Primary Dependencies**: React 19, Vite 7, `vite-plugin-electron`, pnpm 10 workspaces, `electron-builder`, `@electron/rebuild`, existing `zeromq` native dependency, GitHub Actions

**Storage**: Source-controlled package/workflow configuration; GitHub Actions artifacts, attestations, and GitHub Release metadata; protected GitHub Environment approval; no new project XML or application-settings persistence

**Testing**: Vitest 4 existing suites; existing Java runtime packaged-resource tests; focused package-input and packaged-app smoke checks; unsigned artifact manifest verification; `pnpm test`; `pnpm lint`

**Target Platform**: Packaged macOS x64 and arm64 apps, Windows x64 installer, Linux x64 AppImage and Debian package; macOS, Windows, and Ubuntu GitHub-hosted build runners

**Project Type**: Electron desktop application in a pnpm monorepo

**Performance Goals**: Complete each platform CI or release job within a 45-minute workflow timeout; make a developer package build and all release artifacts reproducible from the same tagged source revision

**Constraints**: Preserve the Electron 35.7.5 / Node 22.16.0 / SQLite runtime relationship; retain externalized `@blue/data`, `@blue/engine-client`, `zeromq`, and `node:sqlite` resolution; keep `blue-java.jar` and `pythonLib` addressable from installed resources; no production signing credentials in source, pull requests, CI, development builds, or current stable builds; no bundled Csound, `blue-engine`, Java runtime, updater, signed release path, or extra distribution channels in this slice

**Scale/Scope**: One package configuration, package verification scripts, a shared Actions setup action, CI, scheduled prerelease, stable-release workflows, protected release documentation, and focused tests; no change to Blue project data or end-user audio behavior

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Portable data core**: **PASS**. `@blue/data` remains unchanged and receives no Electron, Node.js, DOM, or packaging implementation detail. Packaging behavior is limited to `@blue/app`, root scripts, and GitHub configuration.
- **Java and project compatibility**: **PASS**. No Java Blue behavior, `.blue` XML, or CSD output changes. The packaged-resource contract is the existing `java-runtime-path.ts` candidate order and its focused tests. The documented divergence is that Csound, `blue-engine`, and Java remain external user prerequisites.
- **Canonical ownership and contracts**: **PASS**. `BlueData` remains main-process owned and `.blue` remains canonical project persistence. Release artifacts and metadata are hosted by GitHub; workflow/package configuration is source controlled; future signing identities are held only in local environments or protected GitHub release storage when signing is enabled. The workflow contract is defined in [contracts/release-workflows.md](./contracts/release-workflows.md).
- **Runtime and engine isolation**: **PASS**. Java helper file access, ZeroMQ module loading, package smoke checks, manifest generation, and filesystem work stay in Electron main/build tooling and CI. The renderer and `@blue/data` remain isolated from host package operations.
- **Verification evidence**: **PASS**. Add package-input/unit coverage, a packaged-app smoke check, platform package runs, checksums and provenance, plus the scoped and repository-wide commands in [quickstart.md](./quickstart.md). Future signing/notarization evidence is intentionally outside this slice.

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
    ├── ci.yml                                # PR and dev/main validation matrix
    ├── dev-release.yml                       # Scheduled/manual unsigned prerelease
    └── release.yml                           # Tag-triggered unsigned stable release

docs/
└── release-guide.md                          # Maintainer local, GitHub, and future signing guide

packages/blue-app/
├── electron-builder.yml                      # App identity, files, resources, and targets
├── build/
│   └── entitlements.mac.plist                # Hardened-runtime entitlements
├── scripts/
│   ├── verify-packaged-app.mjs               # Installed-resource and native-module smoke check
│   └── verify-release-version.mjs            # Tag/package version agreement
└── src/main/java-runtime/
    └── java-runtime-path.test.ts             # Existing packaged-resource test anchor

scripts/
└── verify-package-inputs.mjs                 # Built helper/workspace/runtime input validation
```

**Structure Decision**: Keep package assembly configuration inside `@blue/app`, keep cross-package validation at the root, and use one shared GitHub Action to eliminate duplicated environment setup. No application architecture or persistence layer changes are needed.

## Implementation Sequence

1. **Define package inputs and local commands**: Add the packaging dependencies and root scripts. Create `electron-builder.yml` with the Blue app identity, Electron version pin, macOS x64/arm64 DMG targets, Windows x64 NSIS target, Linux x64 AppImage/Deb targets, `.blue` file association, ASAR behavior, explicit Java helper resources, and native-node unpacking. Add package-input validation that fails before packaging when the helper JAR, Python library, compiled workspace runtime dependencies, or expected Electron version are absent.
2. **Protect runtime resolution**: Extend tests around `java-runtime-path.ts` and add a packaged-app smoke path that verifies `blue-java.jar`, `pythonLib`, externalized workspace dependencies, `node:sqlite`, and `zeromq` resolve from a packaged application. Run the resulting application in a deterministic no-audio smoke mode so Csound and `blue-engine` are not required for package validation.
3. **Create local release ergonomics**: Add unsigned `package:dir`, `package:current`, and host/target package commands. Add tag-version validation and checksum generation. Document a single clean-machine unsigned package procedure plus explicit diagnostic messages for missing build inputs, user runtime prerequisites, and future signing variables if they are accidentally present.
4. **Create reusable CI preparation**: Add a repository-local setup action that pins pnpm, Node, and Java; restores the pnpm cache; installs with the lockfile; and builds the Java helper before package consumers. Keep all third-party Actions pinned to reviewed revisions or maintained major releases under repository policy.
5. **Expand CI validation**: Replace the macOS-only workflow with a native target matrix. Each matrix entry runs install, the full build, focused package-input checks, affected tests, repository tests, lint, an unsigned directory package, and packaged-app smoke verification. Upload logs and package evidence even when a validation stage fails.
6. **Publish development prereleases**: Add a nightly/manual workflow for the current `main` revision. It builds the full matrix unsigned, assigns a generated prerelease version, uploads artifacts only after their checks pass, and publishes one clearly marked GitHub prerelease with source SHA, checksums, and generated notes. Give only its publisher job `contents: write`.
7. **Publish protected stable releases**: Add a tag-triggered workflow that first validates tag/package version agreement, then runs the unsigned platform packaging matrix. macOS emits unsigned DMGs; Windows emits an unsigned NSIS installer; Linux emits checksummed AppImage and Debian packages. The final protected publisher job downloads all expected assets, verifies the asset manifest, creates a draft release, attaches packages, checksums, and provenance, then publishes the draft. It must never publish after a failed, skipped, missing, duplicate, or unexpected package.
8. **Document operations and recovery**: Add `docs/release-guide.md` covering prerelease and stable workflows, GitHub Environment publication protection, future signing secret and environment-variable names, external user runtime prerequisites, release rollback, and incident response. Link the guide from the README release section.

## Validation Strategy

- Unit-test package input validation and Java resource-path contracts.
- Run local unsigned package and packaged-app smoke checks on a supported macOS machine.
- Require the multi-platform CI package matrix for pull requests and the `dev`/`main` integration branches.
- Run a manual prerelease before enabling the schedule, verifying its artifact names, source SHA, checksums, and no production-secret access.
- Use a protected test tag/release to verify unsigned stable publication before the first production release. Validate macOS signing/notarization and Windows cloud signing later in a dedicated future signed-release slice.
- Verify published release assets from a clean macOS, Windows, and Linux environment using [quickstart.md](./quickstart.md).

## Complexity Tracking

No constitution violations or exceptional abstractions are required.
