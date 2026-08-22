# Tasks: Bundled Blue Engine Integration

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/064-bundle-blue-engine/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/engine-artifact-contract.md`, `contracts/engine-probe-contract.md`, `contracts/engine-selection-contract.md`, `quickstart.md`

**Verification**: The constitution and plan require regression-first coverage for runtime, protocol, IPC, packaging, settings, project-preservation, and cross-platform behavior. Complete the listed verification task before its paired implementation when the harness can demonstrate the missing behavior.

**Status**: Complete — T001 through T060 are implemented. Dated local and hosted
evidence, together with credential-gated release exceptions, is recorded in
[quickstart.md](quickstart.md).

**Organization**: Tasks are grouped by user story so each priority is independently testable. Repository-relative paths are rooted at `/Users/stevenyi/work/blue-electron`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same execution wave because it changes different files and has no dependency on their incomplete work.
- **[Story]**: Maps to User Story 1, 2, 3, or 4 from `spec.md`.
- Every checklist item names the exact file or files it changes or validates.

---

## Phase 1: Setup (Source Import)

**Purpose**: Move the reviewed Blue Engine checkpoint into the monorepo without history or generated files.

- [X] T001 Verify `/Users/stevenyi/work/csound/blue-engine` remains clean at checkpoint `6d59daa180cd6474d4fe181918539695d5512101`; stop and update `specs/064-bundle-blue-engine/research.md` if it diverges
- [X] T002 Copy the reviewed checkpoint's source, tests, documentation, examples, license, and CMake files into `native/blue-engine/`, excluding `.git`, build trees, binaries, vcpkg installed/download caches, editor metadata, and generated test output, and record the source/upstream SHAs plus validation evidence in `native/blue-engine/IMPORT.md`
- [X] T003 Add generated native build, vcpkg, distribution, and application staging exclusions in `native/blue-engine/.gitignore`, `.gitignore`, and `scripts/clean.mjs`
- [X] T004 Update the imported build/developer guidance for monorepo ownership, runtime-loaded Csound, and supported local prerequisites in `native/blue-engine/README.md` and `native/blue-engine/tests/README.md`

**Checkpoint**: The complete selected source state is ordinary tracked monorepo content with a reviewable provenance record and no nested repository.

---

## Phase 2: Foundational (Blocking Native Build and Contracts)

**Purpose**: Establish the reproducible native package, static-dependency policy, artifact metadata, and typed protocol primitives required by every user story.

**⚠️ CRITICAL**: No user story implementation begins until this phase is complete.

- [X] T005 Add a pinned ZeroMQ vcpkg manifest, default registry configuration, and explicit static triplets for macOS arm64/x64, Windows x64 static-md, and Linux x64 in `native/blue-engine/vcpkg.json`, `native/blue-engine/vcpkg-configuration.json`, and `native/blue-engine/triplets/`
- [X] T006 Configure release/test presets and make static ZeroMQ mandatory without pkg-config or dynamic fallback in `native/blue-engine/CMakePresets.json` and `native/blue-engine/CMakeLists.txt`
- [X] T007 Add the private `@blue/engine-native` package and cross-platform target/build/clean orchestration commands in `native/blue-engine/package.json`, `native/blue-engine/scripts/target.mjs`, `native/blue-engine/scripts/build.mjs`, and `native/blue-engine/scripts/clean.mjs`
- [X] T008 [P] Write failing Node tests for target/triplet selection, manifest schema/hash validation, wrong platform/architecture, dirty CI revisions, and invalid external-dependency allowlists in `native/blue-engine/scripts/target.test.mjs` and `native/blue-engine/scripts/verify-artifact.test.mjs`
- [X] T009 Implement deterministic `dist/<platform>-<arch>` staging, `artifact.json` generation, SHA-256 validation, and stable verification errors in `native/blue-engine/scripts/artifact.mjs` and `native/blue-engine/scripts/verify-artifact.mjs`
- [X] T010 Register `native/*` as a pnpm workspace, update the lockfile, and include the native package in root build/test/lint/clean orchestration in `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package.json`, and `scripts/clean.mjs`
- [X] T011 [P] Preserve and label the existing C++ tests that run without Csound, disable examples by default for workspace builds, and add package scripts for unit, compile-time-disabled/performance-tracking, and Csound integration suites in `native/blue-engine/CMakeLists.txt`, `native/blue-engine/tests/cpp/CMakeLists.txt`, and `native/blue-engine/package.json`
- [X] T012 [P] Write failing capability-schema tests, then add the shared protocol version, engine capability type, strict decoder, and public exports in `packages/blue-engine-client/tests/capabilities.test.ts`, `packages/blue-engine-client/src/capabilities.ts`, and `packages/blue-engine-client/src/index.ts`

**Checkpoint**: A reproducible private native package builds from imported source, produces a verifiable artifact, and exposes the typed protocol metadata needed by runtime integration.

---

## Phase 3: User Story 1 - Install Blue Without a Separate Engine Setup (Priority: P1) 🎯 MVP

**Goal**: Package and launch the revision-matched Blue Engine by default, keep Blue usable without Csound, and provide recoverable engine/Csound failures.

**Independent Test**: Package Blue on the current platform with no standalone engine on `PATH`; verify the installed app opens/edits/saves without Csound, finds its bundled engine, reports missing Csound recoverably, and completes a minimal render after Csound 7 is available.

### Verification for User Story 1

- [X] T013 [P] [US1] Write failing C++ tests for capability JSON, Csound candidate precedence, required-symbol reporting, Csound 7 version acceptance, unsupported-version rejection, and retry through a fresh process in `native/blue-engine/tests/cpp/test_csound_probe.cpp` and `native/blue-engine/tests/cpp/CMakeLists.txt`
- [X] T014 [US1] Write failing C++ protocol tests for `GET_CAPABILITIES` command byte `0x09`, response envelope, feature list, and no-engine side effects in `native/blue-engine/tests/cpp/test_engine_capabilities.cpp` and `native/blue-engine/tests/cpp/CMakeLists.txt`
- [X] T015 [P] [US1] Write failing client tests for `getCapabilities()`, successful protocol matching, malformed capability payloads, mismatch rejection before `CREATE_ENGINE`, and socket teardown in `packages/blue-engine-client/tests/engine-client.test.ts` and `packages/blue-engine-client/tests/protocol.test.ts`
- [X] T016 [P] [US1] Write failing main-process tests for packaged/development resolution, legacy `blue-engine` sentinel behavior, absolute spawn paths, missing/non-executable artifacts, probe timeout/invalid JSON, project-safe no-Csound errors, and development selection with `/usr/local/bin/blue-engine` absent and `PATH` fallback forbidden in `packages/blue-app/src/main/engine-runtime.test.ts`
- [X] T017 [P] [US1] Write failing package-input and installed-resource tests for exactly one engine, matching manifest/hash/protocol/architecture, Unix execute permission, and no-Csound startup/open/save in `scripts/verify-package-inputs.test.mjs`, `packages/blue-app/src/main/packaged-runtime-verification.test.ts`, and `packages/blue-app/scripts/verify-packaged-app.mjs`

### Implementation for User Story 1

- [X] T018 [US1] Add `csoundGetVersion`, structured loader status, explicit/default candidate reporting, supported-major enforcement, and deterministic unload behavior in `native/blue-engine/src/csound/CsoundTypes.h`, `native/blue-engine/src/csound/CsoundLoader.h`, and `native/blue-engine/src/csound/CsoundLoader.cpp`
- [X] T019 [US1] Add immutable engine build/protocol metadata and implement `--probe-csound --json [--csound-library]` without sockets, shared memory, or performance startup in `native/blue-engine/src/protocol/Capabilities.h`, `native/blue-engine/src/protocol/Capabilities.cpp`, `native/blue-engine/src/main.cpp`, and `native/blue-engine/CMakeLists.txt`
- [X] T020 [US1] Implement `GET_CAPABILITIES` command `0x09` using the existing binary response envelope in `native/blue-engine/src/protocol/Protocol.h`, `native/blue-engine/src/ipc/ZmqHandler.cpp`, and `native/blue-engine/src/ipc/ZmqHandler.h`
- [X] T021 [US1] Add `CMD_GET_CAPABILITIES`, strict payload decoding, `getCapabilities()`, and protocol rejection before engine creation in `packages/blue-engine-client/src/protocol.ts`, `packages/blue-engine-client/src/engine-client.ts`, and `packages/blue-engine-client/src/index.ts`
- [X] T022 [US1] Define the typed selection/probe request/result contract and stable error codes without project persistence in `packages/blue-app/src/shared/engine-runtime.ts` and `packages/blue-app/src/shared/engine-runtime.test.ts`
- [X] T023 [US1] Implement the main-owned resolver, artifact validation, bounded probe subprocess, cache key, retry, protocol comparison, and sanitized diagnostics in `packages/blue-app/src/main/engine-runtime.ts`
- [X] T024 [US1] Replace implicit path searching with injected absolute selection, probe gating, live capability handshake, and structured playback errors in `packages/blue-app/src/main/engine-bridge.ts` and `packages/blue-app/src/main/engine-bridge.test.ts`
- [X] T025 [US1] Construct one `EngineRuntimeService`, pass it into realtime and Blue Live sessions, and preserve isolated endpoints/process-registry ownership in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/blue-live-engine.ts`, and `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`
- [X] T026 [US1] Stage the verified current-platform artifact for both `pnpm --filter @blue/app run dev` and packaging, package it at `resources/assets/engine`, and ensure development startup has a workspace-engine build dependency through `packages/blue-app/scripts/stage-blue-engine.mjs`, `packages/blue-app/package.json`, and `packages/blue-app/electron-builder.yml`
- [X] T027 [US1] Extend package preflight and installed-app verification to fail closed for absent, stale, mismatched, or non-executable engine resources and to prove startup/open/save without Csound in `scripts/verify-package-inputs.mjs`, `packages/blue-app/scripts/verify-packaged-app.mjs`, and `packages/blue-app/src/main/main.ts`
- [X] T028 [US1] Add a Csound 7 null-audio engine integration test and execute the complete User Story 1 package scenario, recording dated results in `native/blue-engine/tests/cpp/test_csound_integration.cpp`, `native/blue-engine/tests/cpp/CMakeLists.txt`, and `specs/064-bundle-blue-engine/quickstart.md`

**Checkpoint**: A locally built release package is self-contained with respect to Blue Engine, remains usable without Csound, and succeeds with supported Csound.

---

## Phase 4: User Story 2 - Build Engine and Application From One Revision (Priority: P1)

**Goal**: Make the root pnpm build and CI compile, test, verify, and package a matching native engine/client pair from one checkout.

**Independent Test**: From a clean checkout with documented vcpkg/toolchain prerequisites, run `pnpm build`; verify native build precedes `@blue/app`, packaging consumes that revision's verified artifact, and a mismatched or stale artifact fails before electron-builder.

### Verification for User Story 2

- [X] T029 [P] [US2] Write failing workspace-graph tests for native workspace discovery, the `@blue/app` dependency edge, root build/test/lint participation, development startup without a system engine, and absence of runtime JavaScript imports in `scripts/verify-native-workspace.test.mjs`
- [X] T030 [P] [US2] Write failing package-preflight tests for stale source revision, protocol mismatch, wrong target, missing manifest, and arbitrary pre-existing executable rejection in `scripts/verify-package-inputs.test.mjs`

### Implementation for User Story 2

- [X] T031 [US2] Add `@blue/engine-native: workspace:*` as an app build dependency and make app package commands build/verify/stage the dependency without importing it at runtime in `packages/blue-app/package.json`, `package.json`, and `pnpm-lock.yaml`
- [X] T032 [US2] Install/cache a pinned vcpkg checkout, expose `VCPKG_ROOT`, build the native workspace package, and retain Node/Java/native-module setup in `.github/actions/setup-blue-build/action.yml`
- [X] T033 [US2] Run the root topological build and native CTest/protocol tests before every PR package and fail on artifact verification in `.github/workflows/pr.yml`
- [X] T034 [US2] Require the same source revision/protocol metadata in stable package jobs and include verified engine metadata in consolidated evidence in `.github/workflows/release.yml`, `scripts/release-artifact-manifest.mjs`, and `scripts/release-artifact-manifest.test.mjs`
- [X] T035 [US2] Execute the clean-checkout `pnpm install --frozen-lockfile`, `pnpm build`, development engine-resolution test with no system engine, native/client tests, and package-preflight sequence on each hosted target and record commands/results or scoped platform exceptions in `specs/064-bundle-blue-engine/quickstart.md`

**Checkpoint**: Contributors and CI build an atomic engine/client/application revision through the root workspace, with no other repository or downloaded runtime artifact.

---

## Phase 5: User Story 3 - Distribute Native Packages Across Platforms (Priority: P2)

**Goal**: Produce verified macOS arm64, Windows x64, and Linux x64 packages with static third-party engine dependencies and cross-distribution AppImage behavior.

**Independent Test**: Inspect and launch each hosted package on a clean matching system; verify exactly one correct engine, no shared ZeroMQ/libsodium or load-time Csound dependency, no legacy FUSE 2 requirement, and successful no-Csound plus supported-Csound smoke paths.

### Verification for User Story 3

- [X] T036 [P] [US3] Write failing fixture-driven dependency-inspector tests for allowed/disallowed macOS load commands, Windows PE imports, Linux dynamic entries, executable architecture, and glibc symbol floors in `native/blue-engine/scripts/verify-artifact.test.mjs` and `native/blue-engine/tests/fixtures/dependency-reports/`
- [X] T037 [P] [US3] Extend failing loader tests for macOS framework/Homebrew paths, safe Windows Csound 7 discovery, Linux `/usr/lib64` and multiarch directories, versioned SONAMEs, explicit override precedence, and current-directory exclusion in `native/blue-engine/tests/cpp/test_csound_probe.cpp`
- [X] T038 [P] [US3] Write failing resolver/package-layout tests for macOS app resources, Windows `.exe`, Linux resources, future macOS x64 metadata, and rejection of cross-architecture artifacts in `packages/blue-app/src/main/engine-runtime.test.ts` and `packages/blue-app/src/main/packaged-runtime-verification.test.ts`
- [X] T039 [P] [US3] Add an AppImage compatibility harness that asserts no `libfuse.so.2`, validates direct/extracted `AppRun`, locates the bundled engine, and runs the no-Csound verifier in `packages/blue-app/scripts/verify-appimage.mjs` and `packages/blue-app/package.json`

### Implementation for User Story 3

- [X] T040 [US3] Implement platform dependency and architecture inspection with explicit OS-runtime allowlists and glibc floor reporting in `native/blue-engine/scripts/verify-artifact.mjs`
- [X] T041 [US3] Harden Windows runtime loading to use explicit/safe Csound paths and static vcpkg libraries while excluding current-directory DLL resolution in `native/blue-engine/src/csound/CsoundLoader.cpp`, `native/blue-engine/triplets/blue-x64-windows.cmake`, and `native/blue-engine/CMakePresets.json`
- [X] T042 [US3] Add Linux versioned Csound SONAME search, explicit static native triplet flags, and the supported glibc build baseline in `native/blue-engine/src/csound/CsoundLoader.cpp`, `native/blue-engine/triplets/blue-x64-linux.cmake`, and `native/blue-engine/README.md`
- [X] T043 [P] [US3] Register the nested resource executable for signing and add per-file/custom macOS signing that applies the library-validation exception only to Blue Engine in `packages/blue-app/build/entitlements.blue-engine.mac.plist`, `packages/blue-app/build/entitlements.mac.plist`, `packages/blue-app/scripts/sign-blue-engine.mjs`, and `packages/blue-app/electron-builder.yml`
- [X] T044 [US3] Select electron-builder `toolsets.appimage: "1.0.3"`, keep exactly one staged engine, and wire the AppImage verifier in `packages/blue-app/electron-builder.yml` and `packages/blue-app/package.json`
- [X] T045 [US3] Run platform-specific native linkage/architecture verification and packaged no-Csound/project smoke checks before artifact upload, retaining actual Csound 7 playback as a clean-machine release-candidate gate, in `.github/workflows/pr.yml` and `.github/workflows/release.yml`
- [X] T046 [US3] Add Debian-, Arch-, and Fedora-family AppImage jobs that consume the same Linux artifact and publish diagnostic evidence in `.github/workflows/appimage-compat.yml`
- [X] T047 [US3] Collect macOS arm64, Windows x64, Linux dependency-closure, signed-helper-shape, AppImage direct/extracted, and macOS supported-Csound evidence, and append dated evidence plus scoped signing and clean-machine Windows/Linux playback gates to `specs/064-bundle-blue-engine/quickstart.md`

**Checkpoint**: The three release targets contain a verified static-dependency engine, and the Linux AppImage is demonstrably usable outside Debian-family distributions without FUSE 2.

---

## Phase 6: User Story 4 - Diagnose or Override the Engine Safely (Priority: P3)

**Goal**: Expose a typed compatibility check and explicit external-engine override while preserving bundled-default selection and project safety.

**Independent Test**: From Realtime Render settings, probe the bundled engine with supported/missing Csound, retry after changing the environment, select a matching external engine, and verify an incompatible engine is rejected before playback.

### Verification for User Story 4

- [X] T048 [P] [US4] Write failing shared contract tests for request validation, stable probe error codes, transient report semantics, bounded diagnostics, and serializable IPC payloads in `packages/blue-app/src/shared/engine-runtime.test.ts`
- [X] T049 [P] [US4] Extend failing runtime tests for environment/settings/bundled/development precedence, invalid relative override rejection, changed-path cache invalidation, fresh-process retry, and mismatched external-engine teardown in `packages/blue-app/src/main/engine-runtime.test.ts`
- [X] T050 [P] [US4] Write failing renderer tests for bundled labeling, external path draft Apply/Cancel/Reset, probe status/details, missing-Csound recovery, retry, and mismatch display in `packages/blue-app/src/renderer/tests/engine-runtime-settings.test.tsx`

### Implementation for User Story 4

- [X] T051 [US4] Normalize empty and legacy `blue-engine` values as bundled while validating absolute external overrides without a settings-version bump in `packages/blue-app/src/shared/program-settings.ts` and `packages/blue-app/src/shared/program-settings.test.ts`
- [X] T052 [US4] Register `engine-runtime:probe`, validate requests in main, expose `probeEngineRuntime`, and add the renderer type surface in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`
- [X] T053 [US4] Add bundled/external engine controls, probe/retry action, and structured engine/Csound result display to the existing Apply/Cancel workflow in `packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx` and `packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`
- [X] T054 [US4] Refresh the current runtime selection after settings Apply, invalidate stale probe cache entries, and route recoverable diagnostics consistently to realtime and Blue Live status in `packages/blue-app/src/main/engine-runtime.ts`, `packages/blue-app/src/main/main.ts`, and `packages/blue-app/src/main/blue-live-engine.ts`
- [X] T055 [US4] Add an incompatible-engine fixture and integration test proving probe/live protocol rejection before `CREATE_ENGINE` while a project remains open in `packages/blue-app/fixtures/engine/`, `packages/blue-app/src/main/engine-runtime.test.ts`, and `packages/blue-app/scripts/verify-packaged-app.mjs`
- [X] T056 [US4] Execute the bundled/missing/supported/override/mismatch/retry settings scenarios and append dated results to `specs/064-bundle-blue-engine/quickstart.md`

**Checkpoint**: Advanced users can inspect and override the engine deliberately, while ordinary use remains bundled and all failure modes remain recoverable.

---

## Phase 7: Polish & Cross-Cutting Validation

**Purpose**: Preserve concurrent runtime behavior, finish release guidance, and produce repository-wide acceptance evidence.

- [X] T057 Add a regression that runs realtime and Blue Live with separate engine processes/endpoints/registry records and proves stopping either session does not affect the other in `packages/blue-app/src/main/engine-concurrency.test.ts`, `packages/blue-app/src/main/engine-process-registry.test.ts`, and `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`
- [X] T058 [P] Update user/build/release documentation to state that Blue Engine is bundled, Csound 7 is runtime-loaded and optional at startup, vcpkg/toolchain prerequisites apply only to source builds, and Linux compatibility has a glibc baseline in `README.md`, `native/blue-engine/README.md`, and `.github/workflows/release.yml`
- [X] T059 Execute every runnable scenario in `specs/064-bundle-blue-engine/quickstart.md`, replacing provisional expectations with dated results and documenting only evidence-backed platform exceptions in `specs/064-bundle-blue-engine/quickstart.md`
- [X] T060 Run `pnpm --filter @blue/engine-native test`, `pnpm --filter @blue/engine-native test:profiling`, `pnpm --filter @blue/engine-native verify`, `pnpm --filter @blue/engine-client test`, `pnpm --filter @blue/app test`, the no-system-engine development resolver/startup check, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm verify`, `pnpm verify:package-inputs`, and `git diff --check`, resolving feature regressions in `native/blue-engine/`, `packages/blue-engine-client/`, `packages/blue-app/`, `scripts/`, and `.github/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependency; establishes the imported source.
- **Foundational (Phase 2)**: Depends on Setup and blocks every story.
- **User Story 1 (Phase 3)**: Depends on Foundation and delivers the installable bundled-engine MVP.
- **User Story 2 (Phase 4)**: Depends on Foundation and may begin alongside User Story 1, but T034 package evidence consumes the artifact/manifest contract completed by US1.
- **User Story 3 (Phase 5)**: Depends on US1 packaging/runtime integration and US2 CI build graph.
- **User Story 4 (Phase 6)**: Depends on US1 runtime service/probe contract; it can proceed alongside most US3 platform work.
- **Polish (Phase 7)**: Depends on every selected user story.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 (bundled runtime MVP) ----\
                   \-> US2 (atomic root build) -------+-> US3 (platform releases) -> Polish
                                      \---------------+-> US4 (diagnostics/override) -/
```

### Within Each User Story

- Write and confirm the focused failure-contract tests before their paired production changes.
- Build/verify native artifacts before staging or packaging them.
- Decode and validate capabilities before creating a Csound engine.
- Resolve/probe in Electron main before exposing results through preload.
- Finish the story-specific independent test before advancing past its checkpoint.

### Parallel Opportunities

- **Setup**: T003 and T004 can follow the copied tree independently.
- **Foundation**: T008, T011, and T012 touch separate Node, C++, and TypeScript test surfaces; T005-T007 establish inputs for T009.
- **US1**: T013 and T015-T017 can be written in parallel by native, client, main, and packaging owners; T014 follows the first C++ test-target edit because it shares `tests/cpp/CMakeLists.txt`. After T018-T023 establish contracts, T024-T027 divide bridge, session, staging, and packaged verification work.
- **US2**: T029 and T030 can run in parallel; workflow changes T033 and release evidence T034 can divide after T031-T032.
- **US3**: T036-T039 are independent verification surfaces. Windows T041 and Linux T042 run sequentially because they share `CsoundLoader.cpp`, while macOS T043 is platform-isolated; T045-T046 can divide hosted packaging and AppImage compatibility.
- **US4**: T048-T050 can run in parallel; T052 IPC and T053 renderer work can divide after the shared contract is stable.

---

## Parallel Examples

### User Story 1

```text
Task T013: C++ Csound probe/version tests
Task T015: TypeScript engine-client handshake tests
Task T016: Electron main resolver/probe tests
Task T017: Package-input and installed-resource tests
```

### User Story 2

```text
Task T029: Workspace graph/build-order tests
Task T030: Stale/mismatched package-preflight tests
```

### User Story 3

```text
Task T036: Native dependency-inspector fixture tests
Task T037: Cross-platform Csound loader tests
Task T038: Packaged path/layout tests
Task T039: AppImage compatibility harness
```

### User Story 4

```text
Task T048: Shared IPC/result contract tests
Task T049: Main selection/cache/retry tests
Task T050: Settings renderer interaction tests
```

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete User Story 1.
3. Stop and validate the bundled-engine package on the current platform both without and with Csound 7.
4. Add User Story 2 before treating the result as a releasable P1 baseline, because atomic root/CI builds prevent engine-client drift.

### Incremental Delivery

1. Import source and establish reproducible native builds.
2. Deliver the bundled runtime/no-Csound-safe application path (US1).
3. Make the root build and CI atomic (US2).
4. Harden and prove all platform packages, including cross-distribution AppImage behavior (US3).
5. Add advanced diagnostics and explicit override UX (US4).
6. Complete concurrency, documentation, and repository-wide validation.

### Parallel Team Strategy

After Foundation:

- Native/runtime owner: US1 Csound loader, probe, and C++ capability work.
- Electron owner: US1 resolver, bridge, staging, and packaged verification.
- Build/release owner: US2 workspace/CI work, then US3 platform matrices.
- UI/contract owner: US4 IPC and settings work after the US1 runtime contract stabilizes.

---

## Notes

- `[P]` means different files and no dependency on an incomplete task in the same wave.
- Story labels provide direct traceability to `spec.md`.
- Build outputs, vcpkg installed trees, and `.engine-stage` are derived and must never be committed.
- Csound remains a runtime-loaded exception to static linking; ZeroMQ/libsodium do not.
- Cross-platform release tasks are complete only with platform evidence, not by configuration review alone.
- Commit after each task or coherent task group when using the optional Git hook.
