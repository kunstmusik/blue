# Tasks: Csound Runtime Services

**Input**: Design documents from `/specs/071-csound-runtime-services/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Verification**: Native/runtime, typed boundary, settings migration, renderer UI, cancellation, path, and caller regressions are mandatory under the project constitution. Tests are listed before the corresponding implementation where the harness supports reproducing the old behavior.

**Status**: Complete — T001 through T065 are implemented and the validation record is captured in [quickstart.md](quickstart.md).

**Organization**: Tasks are grouped by user story. US1 and US2 are both P1; US1 is the smallest demonstrable MVP, while the complete P1 delivery includes removal of the known direct-Csound bypasses in US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it changes different files and does not depend on another incomplete task in the same group
- **[Story]**: Maps to a user story in [spec.md](spec.md)
- Every task includes an exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish native source/test locations and deterministic fixtures before runtime behavior changes.

- [X] T001 Create the `CsoundRuntimeServices` module skeleton and register it in `native/blue-engine/src/csound/CsoundRuntimeServices.h`, `native/blue-engine/src/csound/CsoundRuntimeServices.cpp`, and `native/blue-engine/CMakeLists.txt`
- [X] T002 [P] Add a minimal deterministic null-audio performance fixture in `native/blue-engine/tests/fixtures/csound-runtime.csd`
- [X] T003 Register fake-ABI and installed-runtime test targets, including skip-code-77 integration labeling, in `native/blue-engine/tests/cpp/CMakeLists.txt`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the ABI, capability, shared-contract, process-runner, and settings foundations required by every story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase is complete.

- [X] T004 Add failing ABI and lifecycle-harness coverage for fixed device structures, message buffers, and void `csoundReset` in `native/blue-engine/tests/cpp/test_csound_runtime_services.cpp`
- [X] T005 Correct `csoundReset_t`, define exact Csound 7 audio/MIDI device structures, and add module, device, compile, utility, and message-buffer function pointer types in `native/blue-engine/src/csound/CsoundTypes.h`
- [X] T006 Load, clear, and report every required runtime-services symbol without adding a link-time Csound dependency in `native/blue-engine/src/csound/CsoundLoader.h`, `native/blue-engine/src/csound/CsoundLoader.cpp`, and `native/blue-engine/tests/cpp/test_csound_probe.cpp`
- [X] T007 Implement injectable Csound instance/message-buffer RAII, bounded message draining, and reset/destroy cleanup primitives in `native/blue-engine/src/csound/CsoundRuntimeServices.h`, `native/blue-engine/src/csound/CsoundRuntimeServices.cpp`, and `native/blue-engine/tests/cpp/test_csound_runtime_services.cpp`
- [X] T008 [P] Define `csound-io-v1`, `csound-utility-v1`, and `csound-performance-v1` feature constants and capability regressions in `packages/blue-engine-client/src/capabilities.ts` and `packages/blue-engine-client/tests/capabilities.test.ts`
- [X] T009 Advertise the three additive capabilities without changing protocol version 1 in `native/blue-engine/src/protocol/Capabilities.h`, `native/blue-engine/src/protocol/Capabilities.cpp`, and `native/blue-engine/tests/cpp/test_engine_capabilities.cpp`
- [X] T010 [P] Define runtime module/device, query, diagnostic, execution-request, and execution-result types plus normalization helpers in `packages/blue-app/src/shared/csound-runtime.ts`
- [X] T011 Add strict malformed-value, NUL, absolute-path, discriminated-union, and synthetic Windows-path contract tests in `packages/blue-app/src/shared/csound-runtime.test.ts`
- [X] T012 Add an injectable bounded JSON runner and streaming non-shell execution runner with `AbortSignal` semantics to `packages/blue-app/src/main/engine-runtime.ts` and reproduce timeout/start-error/output-truncation/abort races in `packages/blue-app/src/main/engine-runtime.test.ts`
- [X] T013 Advance program settings to version 3, add normalized `appSpecific.csoundLibraryPath`, and preserve all version-2 executable/render-method/module/device values in `packages/blue-app/src/shared/program-settings.ts`, `packages/blue-app/src/shared/program-settings.test.ts`, `packages/blue-app/src/main/program-settings-store.ts`, and `packages/blue-app/src/main/program-settings-store.test.ts`

**Checkpoint**: The native loader can safely host new Csound calls; feature negotiation, strict shared types, process execution, and settings migration are available.

---

## Phase 3: User Story 1 - Discover and Select Runtime Devices (Priority: P1) 🎯 MVP

**Goal**: Enumerate exact runtime modules, automatically refresh one selected audio/MIDI module at settings load or module change, provide a manual rescan for hardware changes, and save discovered or custom identifiers without losing unavailable values.

**Independent Test**: With Csound available, query modules and selected devices at settings load, change one module and verify only its device query refreshes, manually rescan it, choose a device identifier, Apply settings, reopen them, and verify the exact value persists. Repeat with zero devices and a saved unavailable value.

### Verification for User Story 1

- [X] T014 [P] [US1] Add fake-ABI tests for module termination, selected-module application, count-then-fill input/output queries, zero counts, negative counts, duplicate identities, and JSON escaping in `native/blue-engine/tests/cpp/test_csound_runtime_services.cpp`
- [X] T015 [P] [US1] Add installed-Csound schema tests that accept zero hardware devices and never probe every backend in `native/blue-engine/tests/cpp/test_csound_integration.cpp`
- [X] T016 [P] [US1] Add strict I/O report decoder tests for wrong schemas, missing capability, invalid kinds/directions, inconsistent selected modules, and empty-versus-error results in `packages/blue-app/src/shared/csound-runtime.test.ts`
- [X] T017 [P] [US1] Reproduce exact `--list-io --json` argument construction, deadline, invalid JSON, unavailable module, retry, and engine-feature failures in `packages/blue-app/src/main/engine-runtime.test.ts`
- [X] T018 [P] [US1] Add preload/main IPC contract tests for the narrow discovery channel and ensure no generic execution method is exposed in `packages/blue-app/src/preload/csound-runtime-api.test.ts` and `packages/blue-app/src/main/engine-runtime-ipc.test.ts`
- [X] T019 [P] [US1] Add React tests for module-only loading, selected-only automatic refreshes, manual rescans, stale response suppression, exact device IDs, empty results, saved-unavailable/custom values, and retry in `packages/blue-app/src/renderer/tests/engine-runtime-settings.test.tsx`

### Implementation for User Story 1

- [X] T020 [US1] Implement exact module enumeration and selected audio/MIDI device queries with zero/error distinction in `native/blue-engine/src/csound/CsoundRuntimeServices.cpp` and `native/blue-engine/src/csound/CsoundRuntimeServices.h`
- [X] T021 [US1] Add `--list-io --json`, selected-module flags, absolute Csound-library validation, single-JSON stdout, and exit-code mapping in `native/blue-engine/src/main.cpp`
- [X] T022 [US1] Implement strict I/O report decoding and query-result mapping in `packages/blue-app/src/shared/csound-runtime.ts`
- [X] T023 [US1] Implement `EngineRuntimeService.queryCsoundIo()` with engine resolution, probe/capability gating, selected-only flags, 3-second deadline, bounded diagnostics, and retry in `packages/blue-app/src/main/engine-runtime.ts`
- [X] T024 [US1] Add `engine-runtime:query-csound-io` handling and typed preload/global declarations in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`
- [X] T025 [US1] Build an editable discovered/custom device control with accessible status text in `packages/blue-app/src/renderer/components/settings/RuntimeDeviceField.tsx`
- [X] T026 [US1] Replace static-only driver/device UI with Csound platform-default module seeds, selected-first runtime module choices, source-derived friendly labels with exact-ID option values, automatic page-load and selected-module refreshes, manual rescan actions, unavailable-value preservation, and the Csound library override in `packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx`
- [X] T027 [US1] Update driver/device usage entries and exact realtime option regressions for runtime identifiers in `packages/blue-app/src/main/program-settings-usage.ts` and `packages/blue-app/src/main/program-settings-usage.test.ts`

**Checkpoint**: US1 works without any offline caller migration. Settings discovery is independently demonstrable and project XML remains unchanged.

---

## Phase 4: User Story 2 - Run Offline Csound Work Through Blue Engine (Priority: P1)

**Goal**: Execute general Csound performances in one-shot Blue Engine processes and migrate SoundFont inspection, freezing, and disk rendering away from configured Csound executables.

**Independent Test**: With no direct Csound executable configured, complete SoundFont inspection, one freeze/unfreeze, and disk render; verify output/progress, cancel a longer operation, retry, and confirm realtime/Blue Live is unaffected.

### Verification for User Story 2

- [X] T028 [P] [US2] Add fake-ABI tests for compile/start/perform/reset success, compile/start failure, message draining, and cleanup in `native/blue-engine/tests/cpp/test_csound_runtime_services.cpp`
- [X] T029 [P] [US2] Add installed-Csound null-audio performance coverage using the committed fixture in `native/blue-engine/tests/cpp/test_csound_integration.cpp`
- [X] T030 [P] [US2] Reproduce exact `--run-csound --` argument forwarding, native `cwd`, streamed output, nonzero exit, bounded retention, abort race, and distinct-child cancellation in `packages/blue-app/src/main/engine-runtime.test.ts`
- [X] T031 [P] [US2] Update command-planner tests to require argument-only disk/freeze plans and preserve complete-override/output-path behavior in `packages/blue-app/src/main/disk-render-command.test.ts`
- [X] T032 [P] [US2] Update SoundFont tests to require an executable-free seam while preserving Windows Csound-embedded path normalization, combined message parsing, error bounding, and temp cleanup in `packages/blue-app/src/main/soundfont-viewer.test.ts`
- [X] T033 [P] [US2] Update freeze regressions for an executable-free seam, cancellation cleanup, output format/metadata validation, and no project mutation on failure in `packages/blue-app/src/main/freeze-score-objects.test.ts`
- [X] T034 [P] [US2] Update disk-render regressions for engine-owned execution, stderr progress parsing, cancellation/completion races, artifact validation, and retry in `packages/blue-app/src/main/render-to-disk.test.ts`
- [X] T035 [P] [US2] Add main integration coverage proving realtime/Blue Live and one offline process retain separate cancellation/output ownership in `packages/blue-app/src/main/csound-runtime-isolation.test.ts`

### Implementation for User Story 2

- [X] T036 [US2] Implement argument-driven Csound compile/start/perform/reset execution and streaming message drains in `native/blue-engine/src/csound/CsoundRuntimeServices.cpp`
- [X] T037 [US2] Add `--run-csound [--csound-library ...] -- <args>` parsing, signal handling, exit mapping, and no-ZMQ one-shot dispatch in `native/blue-engine/src/main.cpp`
- [X] T038 [US2] Implement the `performance` branch of `EngineRuntimeService.executeCsound()` with feature gating, explicit `cwd`, non-shell spawn, bounded retained output, streaming hooks, and abort authority in `packages/blue-app/src/main/engine-runtime.ts`
- [X] T039 [US2] Remove executable ownership from `DiskCommandPlan` and freeze command inputs while preserving all Csound argument construction in `packages/blue-app/src/main/disk-render-command.ts`
- [X] T040 [US2] Remove the SoundFont executable parameter and route its generated `['-n', csdPath]` performance through the injected engine-owned seam in `packages/blue-app/src/main/soundfont-viewer.ts`
- [X] T041 [US2] Remove the freeze executable dependency and route freeze arguments through the engine-owned seam without changing staging, cleanup, or artifact validation in `packages/blue-app/src/main/freeze-score-objects.ts`
- [X] T042 [US2] Remove the disk-render executable dependency and route render arguments/progress through the engine-owned seam without changing output dialogs, validation, or post-render actions in `packages/blue-app/src/main/render-to-disk.ts`
- [X] T043 [US2] Replace `createCsoundExecutionSeam` and raw `activeRenderProcess` ownership with an `EngineRuntimeService` adapter and operation-owned abort controller in `packages/blue-app/src/main/main.ts`
- [X] T044 [US2] Hide inactive Csound executable controls, retain freeze flags and render options, and explain the managed runtime in `packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx`, `packages/blue-app/src/renderer/components/settings/DiskRenderSettings.tsx`, and `packages/blue-app/src/renderer/components/settings/UtilitySettings.tsx`
- [X] T045 [US2] Mark legacy executable/render-method settings retained-but-inactive, add the active library-path consumer, and correct the stale realtime executable claim in `packages/blue-app/src/main/program-settings-usage.ts` and `packages/blue-app/src/main/program-settings-usage.test.ts`
- [X] T046 [US2] Run the focused US2 suite and resolve regressions in `native/blue-engine/tests/cpp/test_csound_integration.cpp`, `packages/blue-app/src/main/soundfont-viewer.test.ts`, `packages/blue-app/src/main/freeze-score-objects.test.ts`, and `packages/blue-app/src/main/render-to-disk.test.ts`

**Checkpoint**: All known Blue-owned offline Csound performance bypasses are removed; existing outputs and cancellation behavior remain independently validated.

---

## Phase 5: User Story 3 - Execute Supported Csound Utilities Consistently (Priority: P2)

**Goal**: Provide a main-owned named Csound utility service using the host API rather than `-U`, a shell, or direct Csound executable.

**Independent Test**: Run `sndinfo` against `examples/techniques/hellorcb.aif`, verify its report/status, pass a path with spaces as one argument, then invoke an unavailable utility and recover with another valid call.

### Verification for User Story 3

- [X] T047 [P] [US3] Add fake-ABI tests for utility listing, exact argv construction, unavailable utility, nonzero result, message capture, and reset/destroy cleanup in `native/blue-engine/tests/cpp/test_csound_runtime_services.cpp`
- [X] T048 [P] [US3] Add installed-Csound `sndinfo` coverage with `examples/techniques/hellorcb.aif` and a copied path containing spaces in `native/blue-engine/tests/cpp/test_csound_integration.cpp`
- [X] T049 [P] [US3] Reproduce utility name validation, capability gating, exact argument forwarding, failure mapping, abort, and successful retry in `packages/blue-app/src/main/engine-runtime.test.ts`

### Implementation for User Story 3

- [X] T050 [US3] Implement registered-utility validation and direct `csoundRunUtility()` lifecycle/message handling in `native/blue-engine/src/csound/CsoundRuntimeServices.cpp`
- [X] T051 [US3] Add `--run-utility <name> [--csound-library ...] -- <args>` parsing and stable exit mapping without synthesizing `-U` in `native/blue-engine/src/main.cpp`
- [X] T052 [US3] Implement the `utility` branch of `EngineRuntimeService.executeCsound()` with the same engine resolution, feature gate, path, output, and cancellation rules in `packages/blue-app/src/main/engine-runtime.ts`
- [X] T053 [US3] Add a regression guard that rejects new production direct-Csound or shell-`-U` launch patterns in `packages/blue-app/src/main/csound-runtime-boundary.test.ts`

**Checkpoint**: Trusted main workflows have one supported named-utility service; no arbitrary execution primitive crosses preload.

---

## Phase 6: User Story 4 - Diagnose and Recover Runtime Failures (Priority: P3)

**Goal**: Make missing/incompatible runtime, capability, module, device, process, and cancellation failures actionable and retryable without restarting or losing project work.

**Independent Test**: Exercise missing Csound, old engine capabilities, invalid module, query timeout, failed execution, and cancellation; correct each condition and retry while the same project/settings window remains open.

### Verification for User Story 4

- [X] T054 [P] [US4] Add native tests ensuring load/symbol/module/device/utility/performance failures preserve one JSON stdout document or bounded stderr diagnostics as appropriate in `native/blue-engine/tests/cpp/test_csound_runtime_services.cpp` and `native/blue-engine/tests/cpp/test_csound_probe.cpp`
- [X] T055 [P] [US4] Add shared/main tests for every `CsoundIoQueryErrorCode` and execution terminal state, including missing-feature retry after runtime invalidation, in `packages/blue-app/src/shared/csound-runtime.test.ts` and `packages/blue-app/src/main/engine-runtime.test.ts`
- [X] T056 [P] [US4] Add renderer tests for missing runtime, old engine, invalid module, no devices, stale saved values, explicit retry, and preserved pending edits in `packages/blue-app/src/renderer/tests/engine-runtime-settings.test.tsx`

### Implementation for User Story 4

- [X] T057 [US4] Normalize native runtime diagnostics and ensure message-buffer output never corrupts JSON or leaks across instances in `native/blue-engine/src/csound/CsoundRuntimeServices.cpp` and `native/blue-engine/src/main.cpp`
- [X] T058 [US4] Map probe/query/execution timeout, invalid JSON, missing capability, module failure, signal, and cancellation into bounded typed results with cache invalidation/retry in `packages/blue-app/src/shared/csound-runtime.ts` and `packages/blue-app/src/main/engine-runtime.ts`
- [X] T059 [US4] Render accessible actionable diagnostics, saved/custom/unavailable labels, and fresh retry behavior without overwriting pending settings in `packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx` and `packages/blue-app/src/renderer/components/settings/RuntimeDeviceField.tsx`

**Checkpoint**: All specified runtime failures are recoverable and project editing/saving remains available.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close documentation, boundary audits, cross-platform validation, and full repository gates.

- [X] T060 [P] Document the three one-shot commands, feature negotiation, selected-module warning, and Csound 7 requirements in `native/blue-engine/README.md`
- [X] T061 [P] Update the audio-device/render-method entry and direct-Csound bypass status after implementation in `MISSING_FEATURE_GPT.md`
- [X] T062 Audit Csound-embedded versus native filesystem path handling, including exact synthetic Windows expectations, in `packages/blue-app/src/main/soundfont-viewer.test.ts`, `packages/blue-app/src/main/disk-render-command.test.ts`, and `packages/blue-app/src/main/engine-runtime.test.ts`
- [X] T063 Execute every scenario in `specs/071-csound-runtime-services/quickstart.md` and record any platform/Csound-unavailable skips in that file
- [X] T064 Run `pnpm --filter @blue/engine-native test`, `pnpm --filter @blue/engine-client test`, `pnpm --filter @blue/app test`, `pnpm lint`, `pnpm build`, `pnpm verify`, and `git diff --check`, resolving failures in the affected paths listed in `specs/071-csound-runtime-services/plan.md`
- [X] T065 Add native Settings-window close interception, the unsaved-settings Yes/No/Cancel prompt, renderer resolution IPC, and regression coverage for clean, apply, discard, cancel, and failed-apply closes in `packages/blue-app/src/main/settings-window.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, `packages/blue-app/src/shared/settings-window.ts`, `packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`, and the corresponding main/renderer tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Starts immediately.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **US1 Device Discovery (Phase 3)**: Depends on Phase 2; independently deliverable MVP.
- **US2 Offline Performance Migration (Phase 4)**: Depends on Phase 2. It may proceed alongside US1 after the native lifecycle/process foundation, but T044–T045 should merge after US1 settings work to avoid conflicts.
- **US3 Utilities (Phase 5)**: Depends on Phase 2 and may proceed alongside US1/US2 after shared native message/lifecycle support exists.
- **US4 Diagnostics (Phase 6)**: Depends on the selected US1–US3 services whose failures it verifies; execute after all three for the full story.
- **Polish (Phase 7)**: Depends on all desired stories; full feature completion requires all stories.

### User Story Dependencies

```text
Setup -> Foundation -> US1 (device discovery) -----------+
                    -> US2 (offline performance) --------+-> US4 diagnostics -> Polish
                    -> US3 (utilities) ------------------+
```

- **US1** has no dependency on US2 or US3.
- **US2** has no behavioral dependency on US1; it shares engine/Csound settings and must coordinate final settings-file edits.
- **US3** has no dependency on US1 or US2; it reuses only the foundation's lifecycle and process runner.
- **US4** is independently testable against fake failures but reaches full acceptance only after US1–US3 exist.

### Within Each User Story

- Add/reproduce contract and regression tests before changing the corresponding behavior.
- Native service behavior precedes CLI dispatch.
- Strict shared decoding precedes Electron main orchestration.
- Main orchestration precedes preload/renderer or caller integration.
- Caller completion still requires existing artifact/parsing validation; process exit zero alone is insufficient.
- Run the story's focused tests at its checkpoint before continuing.

## Parallel Opportunities

- T002 can run alongside T001; T003 follows the registered source/test names.
- T008, T010–T011, and T013 can run in parallel with native ABI work T004–T007; T009 follows T008's agreed feature names.
- US1 verification tasks T014–T019 target separate native/shared/main/preload/renderer files and can be prepared in parallel after Phase 2.
- US2 verification tasks T028–T035 can be prepared in parallel; implementation migrations T040–T042 touch separate callers after T038–T039.
- US3 verification T047–T049 can run in parallel, and US3 as a whole can run beside US1/US2 after Phase 2.
- US4 native, shared/main, and renderer tests T054–T056 can be prepared in parallel.
- Documentation T060–T061 can run in parallel after behavior stabilizes.

## Parallel Example: User Story 1

```text
Task T014: Native fake-ABI I/O discovery regressions
Task T016: Shared I/O report decoder regressions
Task T017: Main process argument/deadline/capability regressions
Task T018: IPC/preload boundary regressions
Task T019: Renderer discovery and unavailable-value regressions
```

After these tests are established, execute T020 → T021, T022 → T023 → T024, and T025 → T026; T027 can follow the settings behavior.

## Parallel Example: User Story 2

```text
Task T028: Native performance lifecycle tests
Task T031: Pure command-planner tests
Task T032: SoundFont adapter tests
Task T033: Freeze adapter tests
Task T034: Disk render adapter tests
Task T035: Process-isolation integration test
```

After the common runtime implementation T036–T039, SoundFont T040, freeze T041, and disk render T042 can proceed in parallel before the main adapter integration T043.

## Parallel Example: User Story 3

```text
Task T047: Native fake utility tests
Task T048: Installed-Csound sndinfo test
Task T049: Main utility orchestration tests
```

Then execute T050 → T051 and T052; add the boundary guard T053 after production call sites stabilize.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 through T027.
3. Validate device discovery/settings independently using [quickstart.md](quickstart.md) sections 3, 4, 6, and 7.
4. Demonstrate runtime module discovery, selected-only automatic refreshes, manual rescans, exact identifier persistence, empty lists, and unavailable custom values.

### Complete P1 Delivery

1. Keep the US1 MVP green.
2. Complete US2 through T046 in migration order: SoundFont → freeze → disk render.
3. Validate that no direct Csound executable is required and realtime/Blue Live remain isolated.

### Incremental Completion

1. Add US3 named utilities and validate `sndinfo` plus unavailable-utility recovery.
2. Complete US4 diagnostics across discovery and both execution variants.
3. Run Polish, cross-platform quickstart, and repository gates.

## Task Summary

| Area | Tasks |
|---|---:|
| Setup | 3 |
| Foundational | 10 |
| US1 — Device discovery | 14 |
| US2 — Offline performance migration | 19 |
| US3 — Utility execution | 7 |
| US4 — Diagnostics and recovery | 6 |
| Polish | 6 |
| **Total** | **65** |

## Notes

- `[P]` means file-level work can proceed concurrently after prerequisites; tasks that later touch `main.ts`, `engine-runtime.ts`, or settings components must still coordinate merges.
- Keep native OS paths for process `cwd` and arguments. Normalize separators only at the Csound-source embedding boundary.
- Do not add a renderer-facing generic utility/performance executor.
- Do not bump the ZMQ protocol solely for additive one-shot feature strings.
- Do not delete legacy settings fields during this feature; stop consuming and displaying them.
- Commit after each task or coherent test/implementation pair so another agent can bisect the migration.
