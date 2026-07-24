# Tasks: Blue App Builds and Releases

**Input**: Design documents from `specs/062-app-release-builds/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/release-workflows.md](./contracts/release-workflows.md), and [quickstart.md](./quickstart.md)

**Verification**: Preserve `@blue/data` isolation and `.blue` XML behavior. Every package path must prove the installed Java resources, external runtime modules, and Electron SQLite runtime are resolvable. Treat GitHub workflow artifacts, checksums, source metadata, and quickstart results as release evidence. Signature/notarization evidence belongs to a future signed-release slice.

**Organization**: Tasks are grouped by user story. Complete Phase 2 before starting story work; the later release stories depend on the package contract established by User Stories 1 and 2.

## Phase 1: Setup (Shared Packaging Infrastructure)

**Purpose**: Add the packaging tools and source-controlled files required by every local or hosted package build.

- [X] T001 Add `electron-builder` and `@electron/rebuild` as app build dependencies and preserve native dependency installation rules in `packages/blue-app/package.json`, `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`.
- [X] T002 [P] Add hardened-runtime macOS entitlements in `packages/blue-app/build/entitlements.mac.plist` for Developer ID distribution without granting unnecessary capabilities.
- [X] T003 [P] Extend packaged-resource preference and fallback coverage in `packages/blue-app/src/main/java-runtime/java-runtime-path.test.ts` for `resources/assets/java/blue-java.jar` and `resources/assets/java/pythonLib`.
- [X] T004 [P] Implement deterministic package-input validation in `scripts/verify-package-inputs.mjs` for Java helper outputs, Python library contents, built Electron entries, external workspace packages, Electron version, and native ZeroMQ availability without logging secrets.
- [X] T005 [P] Implement release asset manifest and checksum generation/validation in `scripts/release-artifact-manifest.mjs` for the target matrix, version, source revision, package format, SHA-256 checksum, and verification status defined in `data-model.md`.

---

## Phase 2: Foundational (Blocking Package Contract)

**Purpose**: Establish the reusable package layout and runtime verification contract that every user story consumes.

**CRITICAL**: Do not begin user-story workflow publication work until all package layout and installed-runtime checks are passing locally.

- [X] T006 Create the Blue package definition in `packages/blue-app/electron-builder.yml` with the Electron 35.7.5 input, deterministic artifact names/output directory, `.blue` association, macOS x64/arm64 DMG, Windows x64 NSIS, Linux x64 AppImage/Deb, unsigned-by-default macOS identity configuration, `resources/assets/java` extra resources, ASAR-enabled application files, and unpacked native `.node` modules.
- [X] T007 Add a deterministic no-audio installed-runtime verification seam in `packages/blue-app/src/main/packaged-runtime-verification.ts` and invoke it from `packages/blue-app/src/main/main.ts` when `BLUE_VERIFY_MODE=packaged-resources`, checking the Java artifact, Python library, `zeromq`, and Electron `node:sqlite` without launching Csound or `blue-engine`.
- [X] T008 Add package input, directory-package, host-package, packaged-app verification, artifact-manifest, and release-version scripts to `packages/blue-app/package.json` and `package.json`, with output paths and failure messages that distinguish build inputs from signing/publication credentials.
- [X] T009 Verify the foundation on the host platform using `packages/blue-app/electron-builder.yml`, `scripts/verify-package-inputs.mjs`, `packages/blue-app/src/main/java-runtime/java-runtime-path.test.ts`, and the resulting unsigned directory package before proceeding.

**Checkpoint**: An unsigned directory package has the expected resource layout, the Electron main process can verify runtime dependencies without audio tooling, and the package scripts have stable names for local and CI callers.

---

## Phase 3: User Story 1 - Build Blue Locally (Priority: P1) MVP

**Goal**: A contributor can build, inspect, and launch an unsigned host-platform package with no release credentials and receive actionable failures for missing inputs.

**Independent Test**: From a clean host checkout, install from the lockfile, run the documented unsigned package command, run the installed-package smoke driver, and load [fixtures/smoke-test.blue](../../fixtures/smoke-test.blue) without publishing anything.

- [X] T010 [US1] Implement the installed-package smoke driver in `packages/blue-app/scripts/verify-packaged-app.mjs` using Playwright Electron launch to invoke `BLUE_VERIFY_MODE=packaged-resources`, open `fixtures/smoke-test.blue`, and fail with target-specific diagnostics when helper resources or native runtime modules are unavailable.
- [X] T011 [US1] Wire `packages/blue-app/scripts/verify-packaged-app.mjs` and `scripts/verify-package-inputs.mjs` into the package scripts in `packages/blue-app/package.json` so contributors can run `package:dir`, `package:current`, `verify:package-inputs`, and `verify:packaged-app` without signing credentials.
- [X] T012 [US1] Replace provisional local-command text and missing-prerequisite guidance in `docs/release-guide.md` with the implemented script names, output locations, current unsigned/future signing distinctions, and Java, Csound, and `blue-engine` diagnostics.
- [X] T013 [US1] Execute the clean local acceptance flow from `docs/release-guide.md` against `fixtures/smoke-test.blue` and correct any mismatch between the documented path, `packages/blue-app/electron-builder.yml`, and the produced package layout.

**Checkpoint**: User Story 1 is complete when a contributor can produce and smoke-test an unsigned package locally without access to Apple, Azure, or GitHub release credentials.

---

## Phase 4: User Story 2 - Trust Every Change (Priority: P1)

**Goal**: Pull requests and `dev`/`main` integration changes receive visible native-platform build, test, lint, package, and runtime-smoke evidence without publishing a release.

**Independent Test**: A pull request reports independent macOS x64, macOS arm64, Windows x64, and Linux x64 matrix results, retains diagnostic artifacts on failure, and creates no GitHub Release.

- [X] T014 [P] [US2] Create the reusable build bootstrap action in `.github/actions/setup-blue-build/action.yml` to install pinned Node, pnpm, Java, and Maven-compatible tooling; restore the pnpm cache; install from the lockfile; and build the Java helper before Electron package consumers.
- [X] T015 [US2] Replace the macOS-only job in `.github/workflows/ci.yml` with an explicit native runner matrix for `macos-x64`, `macos-arm64`, `windows-x64`, and `linux-x64`, with read-only permissions, bounded concurrency, and no protected release environment.
- [X] T016 [US2] Make each `.github/workflows/ci.yml` matrix job run the root build/test/lint checks plus package-input validation, unsigned directory packaging, packaged-app smoke verification, and manifest generation; upload package evidence and redacted diagnostics with `if: always` while publishing no release.

**Checkpoint**: User Story 2 is complete when a PR provides complete non-publishing package evidence for all required targets and identifies failed target/stage combinations clearly.

---

## Phase 5: User Story 3 - Publish Development and Stable Releases (Priority: P2)

**Goal**: Maintainers can publish traceable unsigned prereleases and atomically promote a complete unsigned stable release from a matching immutable tag.

**Independent Test**: A manual development workflow produces one prerelease tied to a source SHA without signing credentials; a protected test release run refuses incomplete or duplicate version assets before public publication.

- [X] T017 [P] [US3] Add development and stable release metadata derivation in `scripts/release-metadata.mjs`, generating an immutable source-revision marker and prerelease version without mutating `packages/blue-app/package.json` or creating a repository tag.
- [X] T018 [P] [US3] Implement stable tag/package version validation in `packages/blue-app/scripts/verify-release-version.mjs`, requiring an immutable `vX.Y.Z` tag that exactly matches `packages/blue-app/package.json` and refusing duplicate published versions.
- [X] T019 [US3] Add `.github/workflows/dev-release.yml` for scheduled `main` and manual-dispatch unsigned package matrices, consuming the shared bootstrap action and artifact manifest, then publishing exactly one labeled GitHub prerelease with checksums, generated notes, and source SHA from a final `contents: write` promoter job.
- [X] T020 [P] [US3] Implement non-secret credential validation in `scripts/release-credential-preflight.mjs` and expose it through `package.json`, reporting only the missing or malformed variable names reserved for future protected macOS and Windows signing paths.
- [X] T021 [US3] Add `.github/workflows/release.yml` for stable tags: validate version, package each native target unsigned, use the protected `release` Environment only for final publication approval, avoid Apple/Azure signing credentials and OIDC signing permissions, and upload checksummed manifests for all targets.
- [X] T022 [US3] Implement the final promoter in `.github/workflows/release.yml` to reject duplicate, missing, skipped, or unexpected assets; create a draft release only after complete verification; attach the exact manifest/checksums and available provenance; and publish only after all required target evidence is present.

**Checkpoint**: User Story 3 is complete when a development prerelease is complete and traceable, while a stable run cannot make an incomplete, duplicate, or unverified-artifact release public.

---

## Phase 6: User Story 4 - Configure Release Credentials Safely (Priority: P2)

**Goal**: A maintainer can configure stable publication approval and preflight future signing credentials without exposing secret values or blocking unsigned contributor workflows.

**Independent Test**: Using a sanitized environment, the advisory preflight reports absent future signing settings by name only; a maintainer can identify current publication approval policy plus every future signing value, scope, format, consuming workflow, and recovery step from one guide.

- [X] T023 [US4] Add sanitized positive and negative coverage for `scripts/release-credential-preflight.mjs` in `scripts/release-credential-preflight.test.mjs` and register its command in `package.json`, asserting that output never contains a supplied secret value.
- [X] T024 [US4] Synchronize `docs/release-guide.md` and `specs/062-app-release-builds/quickstart.md` with implemented commands, expected future signing credential formats, current protected `release` Environment publication policy, future Azure federated-identity requirements, and failure recovery.
- [X] T025 [US4] Keep the maintainer entry point concise in `README.md` while linking the final `docs/release-guide.md` local packaging, prerelease, stable release, and non-bundled runtime procedures.
- [X] T026 [US4] Configure and review the protected GitHub `release` Environment using `docs/release-guide.md`: approval protection and release-tag access policy for current unsigned publication; document future Apple secrets, Azure OIDC identifiers, and non-secret Artifact Signing variables without exposing any value in repository files or workflow logs.
- [X] T027 [US4] Run `scripts/release-credential-preflight.mjs` with missing and sanitized fixture values, then verify `docs/release-guide.md` still permits `package:dir` and packaged-app smoke validation with no production credentials.

**Checkpoint**: User Story 4 is complete when a new release maintainer can set up or diagnose current publication approval and future signing credentials from documentation alone, while contributors retain a fully secret-free package path.

---

## Phase 7: Polish and Cross-Cutting Validation

**Purpose**: Confirm the implementation meets the release contract without changing project persistence, application behavior, or unrelated work.

- [X] T028 [P] Run focused app and release-tool validation from `packages/blue-app/src/main/java-runtime/java-runtime-path.test.ts`, `packages/blue-app/scripts/verify-packaged-app.mjs`, `scripts/verify-package-inputs.mjs`, `scripts/release-artifact-manifest.mjs`, and `scripts/release-credential-preflight.test.mjs`.
- [X] T029 [P] Validate workflow syntax, least-privilege permissions, target matrix coverage, artifact retention, and secret-free fork behavior against `.github/actions/setup-blue-build/action.yml`, `.github/workflows/ci.yml`, `.github/workflows/dev-release.yml`, and `.github/workflows/release.yml`.
- [X] T030 Run `pnpm build`, `pnpm test`, and `pnpm lint` from `package.json`, then resolve only failures introduced by this release-build feature.
- [X] T031 Execute the local, CI, development prerelease, and protected stable-release acceptance procedures in `specs/062-app-release-builds/quickstart.md`; record any publication-gated evidence without adding secret material to the repository.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1**: Starts immediately. T002-T005 may proceed in parallel with T001 when their file paths do not overlap.
- **Phase 2**: Depends on Phase 1. It blocks all story work because every workflow relies on the package layout, artifact metadata, and runtime smoke seam.
- **User Story 1**: Depends on Phase 2. It is the MVP and establishes the command surface used by automation.
- **User Story 2**: Depends on Phase 2 and uses the User Story 1 commands; complete it before publishing any release channel.
- **User Story 3**: Depends on User Stories 1 and 2. T017, T018, and T020 may proceed in parallel; workflows follow their completion.
- **User Story 4**: Can begin after Phase 2 but must complete T023-T027 before enabling the protected stable workflow in User Story 3.
- **Phase 7**: Depends on all desired user-story tasks.

### User Story Dependencies

- **US1 (P1)**: Needs only the foundational package contract and is independently deliverable as the local packaging MVP.
- **US2 (P1)**: Reuses US1's commands and package contract; it must not publish a release.
- **US3 (P2)**: Requires the CI-proven package matrix and advisory credential preflight path; development prereleases and current stable releases remain independent of signing credentials.
- **US4 (P2)**: Shares the stable workflow's protected publication policy but keeps future signing preflight independently verifiable and secret-free.

### Parallel Opportunities

- Phase 1: T002, T003, T004, and T005 can run in parallel after the dependency decision in T001 is understood.
- US3: T017, T018, and T020 modify separate scripts and can run in parallel before workflow assembly.
- Phase 7: T028 and T029 can run in parallel before final repository-wide checks.

## Parallel Examples

### User Story 3

```text
Task: "Add development and stable release metadata derivation in scripts/release-metadata.mjs"
Task: "Implement stable tag/package version validation in packages/blue-app/scripts/verify-release-version.mjs"
Task: "Implement non-secret credential validation in scripts/release-credential-preflight.mjs"
```

### Final Validation

```text
Task: "Run focused app and release-tool validation from packages/blue-app/src/main/java-runtime/java-runtime-path.test.ts and scripts/release-artifact-manifest.mjs"
Task: "Validate workflow syntax and permissions in .github/actions/setup-blue-build/action.yml and .github/workflows/release.yml"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1 and run its clean local package acceptance test.
3. Stop and inspect the installed-resource, native-module, and no-audio smoke evidence before adding CI or publishing workflows.

### Incremental Delivery

1. Deliver secret-free local packaging (US1).
2. Deliver secret-free native CI (US2).
3. Deliver nightly/manual prereleases (US3 development path).
4. Provision and validate the protected release environment for final publication approval (US4).
5. Enable tag-triggered unsigned stable release promotion and run a protected test release (US3 stable path).

### Handoff Boundary

Read [handoff.md](./handoff.md) before implementation. It names the package/runtime invariants, external credential prerequisites, existing repository files to preserve, and the required evidence for each workflow channel.

## Notes

- All tasks use the required checklist format with a sequential ID and exact file path.
- `[P]` marks tasks that touch separate files and have no implementation dependency on one another.
- Do not change `@blue/data`, `.blue` XML serialization, project-document IPC ownership, CSD behavior, or unrelated untracked release-plan input documents.
- Do not commit certificate data, credential values, `.env` files, or generated package artifacts.
