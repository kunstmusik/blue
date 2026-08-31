---

description: "Actionable implementation and validation tasks for glitch-free Track instrument editor opening"
---

# Tasks: Glitch-Free Track Instrument Editor Opening

**Input**: Design documents from `/specs/093-fix-editor-audio-glitch/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Verification**: The constitution requires regression, typed-boundary, runtime/IPC, UI, native, host-path, packaging, and quickstart evidence. Audio continuity remains a packaged-workload acceptance claim; automated tests cover every isolatable lifecycle and contributor boundary.

**Organization**: The two P1 stories are ordered by the plan's evidence dependency: the diagnostic story establishes the accepted candidate before the audio-continuity story selects or ships a mitigation. The P2 story then protects live editing and BlueX7 behavior.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: The task can run in parallel after the containing phase's stated prerequisites because it targets a distinct file set and has no dependency on another incomplete task.
- **[Story]**: Maps to a user story in `spec.md`; setup, foundational, and polish tasks intentionally omit this label.
- Every task names an exact implementation, test, or evidence path.

## Phase 1: Setup (Shared Evidence Infrastructure)

**Purpose**: Establish disposable fixtures, native test registration, and a durable place for controlled-run evidence before behavior changes are made.

- [X] T001 [P] Create valid/invalid `DiagnosticRun` JSONL fixtures and a schema-validation test entrypoint in `packages/blue-app/src/main/editor-open-diagnostics.test.ts`.
- [X] T002 [P] Register a compile-gated editor-open diagnostics CTest target and test source in `native/blue-engine/tests/cpp/CMakeLists.txt` and `native/blue-engine/tests/cpp/test_editor_open_diagnostics.cpp`.
- [X] T003 [P] Create the controlled-trial results template (workload, environment, conditions, attempts, disposition, and tradeoffs) in `specs/093-fix-editor-audio-glitch/validation.md`.

---

## Phase 2: Foundational (Blocking Contracts and Seams)

**Purpose**: Establish the typed boundary, ownership rules, no-op diagnostics path, and reusable timing seams required by every story.

**⚠️ CRITICAL**: Complete this phase before user-story implementation. Diagnostics must be disabled by default and must never block editor opening or audio rendering.

- [X] T004 [P] Define serializable target identities, milestone names, attempt/run records, runtime status payloads, channel constants, and validation guards in `packages/blue-app/src/shared/track-instrument-editor-contract.ts`.
- [X] T005 Add malformed-payload, sequence-ordering, target-identity, and JSON-serializability contract coverage in `packages/blue-app/src/shared/track-instrument-editor-contract.test.ts`.
- [X] T006 [P] Define the injected clock, bounded-run options, artifact writer, engine-state sampler, and disabled no-op interface for the diagnostic coordinator in `packages/blue-app/src/main/editor-open-diagnostics.ts`.
- [X] T007 Implement monotonic timestamp capture, native output-directory resolution, engine-frame bracket bounds, and warning-only sampler failures in `packages/blue-app/src/main/editor-open-diagnostics.ts`.
- [X] T008 Wire one coordinator instance into main-process startup, project replacement, project close, and application quit disposal in `packages/blue-app/src/main/main.ts`.
- [X] T009 Add disabled-by-default, bounded-memory, write-failure, native-path, no-project-content, and no-lifecycle-side-effect tests in `packages/blue-app/src/main/editor-open-diagnostics.test.ts`.
- [X] T010 [P] Add an existing-`GET_ENGINE_STATE` adapter seam and failure/omitted-bracket coverage in `packages/blue-app/src/main/engine-bridge.ts` and `packages/blue-app/src/main/engine-bridge.test.ts`.

**Checkpoint**: The app has typed, serializable contracts, one main-owned disposable diagnostics coordinator, native path handling, and a reusable frame-correlation seam without changing `@blue/data`, the public engine protocol, shared memory, or project persistence.

---

## Phase 3: User Story 2 — Diagnose the Glitch From Reproducible Evidence (Priority: P1)

**Goal**: Reproduce the symptom under a qualified workload, correlate editor milestones with bounded engine progress and observed audio continuity, isolate contributors, and produce an explicit adopt/reject/defer decision.

**Independent Test**: On one fixed machine, device, project, build mode, sample rate, and `ksmps`, qualify a clean no-open interval and run at least 10 attempts for every diagnostic condition in `quickstart.md`; each complete JSONL run validates against the schema and records audio observation, lifecycle milestones, and any budget-relative native gaps.

### Verification for User Story 2

- [X] T011 [US2] Add failing coordinator tests for attempt/run limits, unique IDs, append-only milestones, terminal outcomes, stale callbacks, cancellation, closed-before-usable, and incomplete-last-line handling in `packages/blue-app/src/main/editor-open-diagnostics.test.ts`.
- [X] T012 [P] [US2] Add main/open-flow integration tests for cold, reused, reopened, invalid-target, navigation-failure, and engine-state-bracket warning records in `packages/blue-app/src/main/editor-open-diagnostics.integration.test.ts`.
- [X] T013 [P] [US2] Add native tests for `ksmps / sampleRate` budget calculation, threshold-relative gap aggregation, bounded top-N retention, stop-time emission, and absence of audio-thread writes in `native/blue-engine/tests/cpp/test_editor_open_diagnostics.cpp`.
- [X] T014 [P] [US2] Extend the non-modal Effect Interface control coverage to assert shared milestone vocabulary and unchanged modal/effect lifecycle behavior in `packages/blue-app/src/main/effect-editor-window-manager.test.ts`.

### Implementation for User Story 2

- [X] T015 [US2] Implement bounded opt-in run/attempt collection, milestone validation, terminal disposal, JSONL serialization, and artifact-write degradation in `packages/blue-app/src/main/editor-open-diagnostics.ts`.
- [X] T016 [US2] Integrate target validation, focus-existing/cold/reopened classification, lifecycle milestones, and failure/cancellation reporting with the Track open path in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/track-instrument-editor-window-manager.ts`.
- [X] T017 [US2] Bracket selected editor milestones with the existing engine-state request and record bounded pre-request/post-response timestamps, frame, sample rate, and `ksmps` through `packages/blue-app/src/main/engine-bridge.ts`.
- [X] T018 [US2] Implement compile-gated k-period scheduling-gap aggregation, bounded largest-gap retention, and performance-stop emission without changing production timing or public protocol fields in `native/blue-engine/src/engine/CsoundEngine.cpp` and `native/blue-engine/src/engine/CsoundEngine.h`.
- [X] T019 [US2] Bind `BLUE_EDITOR_OPEN_DIAGNOSTICS` and `BLUE_EDITOR_OPEN_DIAGNOSTICS_DIR` to the coordinator, keep paths in native `path`/`os` form, flush completed runs atomically, and keep all failure handling non-blocking in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/editor-open-diagnostics.ts`.
- [ ] T020 [US2] Qualify lightweight and high-load playback workloads with a 60-second no-open control, headroom evidence, device/build metadata, and audible or loopback observation, then record accepted/rejected controls in `specs/093-fix-editor-audio-glitch/validation.md`.
- [ ] T021 [US2] Run the controlled matrix (no-open, focus-existing, minimal shell, shell plus snapshot, editor mount, library initialization, BlueX7 readback, and Effect Interface) with at least 10 attempts per condition in development and the documented baseline modes, and record every candidate disposition in `specs/093-fix-editor-audio-glitch/validation.md`.
- [ ] T022 [US2] Validate every completed JSONL line against `specs/093-fix-editor-audio-glitch/contracts/editor-open-diagnostic.schema.json`, explicitly ignore only an incomplete final line, compare the Effect Interface control, identify confirmed contributors versus hypotheses, and update `specs/093-fix-editor-audio-glitch/validation.md` and `specs/093-fix-editor-audio-glitch/research.md`.

**Checkpoint**: The investigation has a reproducible baseline, causal evidence that distinguishes audible interruption from timing-only lateness, a tested Effect Interface control, and a documented candidate decision that can gate the shipping startup path.

---

## Phase 4: User Story 1 — Open a Track Instrument Without Interrupting Playback (Priority: P1) 🎯 MVP

**Goal**: Open, focus, close, reopen, and switch Track instrument editors during clean real-time playback without audible/captured discontinuity, duplicate sessions, incorrect identity, or material readiness/resource regression.

**Independent Test**: Using the accepted candidate from User Story 2, exercise first open, focus-existing, close/reopen, sequential different-Track opens, rapid repeated clicks, and stopped-playback opens for generic, Blue Synth Builder, and BlueX7 instruments; verify one snapshot, usable readiness, correct Track binding, and continuous audio in the packaged acceptance workload.

### Verification for User Story 1

- [X] T023 [P] [US1] Add failing manager regressions for focus-before-snapshot, one window per stable session/group/Track identity, rapid duplicate requests, stale target rejection, close cleanup, and no navigation/snapshot on focus-existing in `packages/blue-app/src/main/track-instrument-editor-window-manager.test.ts`.
- [X] T024 [P] [US1] Add renderer regressions for one document pull, shell-to-editor-ready ordering, editor-kind selection, deferred optional work, late response cancellation, and recoverable load failure in `packages/blue-app/src/renderer/tests/track-instrument-editor-window.test.tsx`.
- [ ] T025 [P] [US1] Add Track-control regressions for rapid repeated clicks, close/reopen, sequential different Tracks, and functionally equivalent stopped-playback behavior in `packages/blue-app/src/renderer/tests/track-instrument-control.test.tsx`.
- [X] T026 [P] [US1] Add compatibility coverage proving an editor-open/focus/close operation does not mutate `.blue`-owned snapshots, automation data, generated CSD semantics, or engine lifecycle state in `packages/blue-app/src/shared/project-editor-track-instrument.test.ts` and `packages/blue-app/src/main/engine-bridge.test.ts`.

### Implementation for User Story 1

- [X] T027 [US1] Refactor the `open-track-instrument-editor` handler to validate current project/session and stable Track identity, ask the window manager to focus an existing usable session first, and only then resolve the current revision fence in `packages/blue-app/src/main/main.ts`.
- [X] T028 [US1] Update Track window manager state and lifecycle callbacks to preserve focus, placement, identity, project/group/Track cleanup, milestone reporting, and recoverable failure behavior in `packages/blue-app/src/main/track-instrument-editor-window-manager.ts`.
- [X] T029 [US1] Rework the detached entry and page into a lightweight shell that accepts exactly one renderer snapshot, dynamically loads only the requested editor, marks `editor-usable` before optional work, and preserves existing editor props in `packages/blue-app/src/renderer/track-instrument-editor.tsx`, `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx`.
- [X] T030 [US1] Defer library snapshot/subscription/root-browse initialization until after editor usability, keep initialization cancellable and disposable on unmount, and surface library failures without blocking the editor in `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx` and `packages/blue-app/src/renderer/stores/library-store.ts`.
- [X] T031 [US1] Preserve `ready-to-show`, shown/focus, saved window placement, project-update, target-removal, and close-before-ready behavior while progressive startup is active in `packages/blue-app/src/main/track-instrument-editor-window-manager.ts` and `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx`.
- [X] T032 [US1] Apply only the accepted mitigation from `specs/093-fix-editor-audio-glitch/validation.md`; if minimal-shell evidence remains causal, implement at most one Track-only standby shell with atomic rebind, binding-generation validation, complete renderer reset, inactive-runtime replenishment, and destroy-on-failure in `packages/blue-app/src/main/track-instrument-editor-window-manager.ts` and its focused test; otherwise document the deferred pool decision in `specs/093-fix-editor-audio-glitch/validation.md`.
- [ ] T033 [US1] Run the focused Track manager, renderer, and control suites plus development cold/focus/reopen/different-target trials, and record readiness, interruption, binding, and resource results in `specs/093-fix-editor-audio-glitch/validation.md`.

**Checkpoint**: The accepted startup candidate opens all supported Track editor kinds without duplicate snapshot work or incorrect identity, and the user-visible editor workflow remains usable while audio-continuity evidence is ready for packaged acceptance.

---

## Phase 5: User Story 3 — Retain Complete Live Editing Behavior (Priority: P2)

**Goal**: Keep canonical edits, undo/save/project updates, target isolation, and BlueX7 effective-value display correct while gating runtime work until the detached editor is usable and activity is real.

**Independent Test**: During playback and Blue Live, open generic, Blue Synth Builder, and Track-owned BlueX7 editors; edit values, observe BlueX7 at 20 Hz after readiness, start/stop activity, close/reopen, switch Tracks, remove a target, and verify no stale values, project mutation, or audio interruption.

### Verification for User Story 3

- [X] T034 [P] [US3] Add runtime-status contract tests for inactive, playback-only, Blue-Live-only, both-active, subscription-before-query, newer-sequence-wins, and fail-closed states in `packages/blue-app/src/shared/track-instrument-editor-contract.test.ts`.
- [X] T035 [P] [US3] Add preload query/subscribe/unsubscribe, serializable-boolean-only payload, sender teardown, and IPC failure tests in `packages/blue-app/src/preload/track-editor-runtime-status.test.ts`.
- [X] T036 [P] [US3] Add main authorization, active-window delivery, monotonic sequence, close/project replacement, and stale-generation rejection tests in `packages/blue-app/src/main/track-editor-runtime-status.test.ts`.
- [X] T037 [P] [US3] Add renderer tests proving no BlueX7 readback before `editor-usable`, exactly one 20 Hz observation loop after activity becomes true, newer status ordering, stale-target rejection, and clear-on-inactive behavior in `packages/blue-app/src/renderer/tests/blue-x7-effective-values.test.tsx` and `packages/blue-app/src/renderer/tests/track-instrument-editor-window.test.tsx`.
- [ ] T038 [US3] Add regressions proving generic and Blue Synth Builder editors do not start BlueX7 work and that edits retain patch, undo/save, project-update, and runtime synchronization behavior in `packages/blue-app/src/renderer/tests/track-instrument-editor-window.test.tsx` and `packages/blue-app/src/main/blue-x7-runtime-sync.test.ts`.

### Implementation for User Story 3

- [X] T039 [US3] Extend the shared Track contract with `TrackInstrumentRuntimeStatus`, channel names, payload guards, and the typed preload query/subscription surface in `packages/blue-app/src/shared/track-instrument-editor-contract.ts` and `packages/blue-app/src/preload/preload.ts`.
- [X] T040 [US3] Implement the main-owned runtime-status coordinator with sequence allocation, correctly bound Track-window authorization, unsubscribe teardown, and binding reset semantics in `packages/blue-app/src/main/track-editor-runtime-status.ts`.
- [X] T041 [US3] Publish runtime-status changes from playback and Blue Live state transitions and register/unregister Track windows without broad workbench listener coupling in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/engine-bridge.ts`, and `packages/blue-app/src/main/blue-live-engine.ts`.
- [X] T042 [US3] Subscribe before or atomically with the initial status query, accept only newer sequences for the current target/binding, and reset both flags on failure, unload, or target change in `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx`.
- [X] T043 [US3] Gate BlueX7 effective-value polling on both `editor-usable` and playback/Blue Live activity while preserving one in-flight request, visible-control filtering, 20 Hz steady cadence, stale-response rejection, and disposable clear-on-stop state in `packages/blue-app/src/renderer/components/instruments/blue-x7/use-blue-x7-effective-values.ts`, `packages/blue-app/src/renderer/components/instruments/blue-x7-editor.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/orchestra/InstrumentEditorPanel.tsx`.
- [X] T044 [US3] Preserve canonical Track patch application, direct BSB runtime updates, undo/save/project-update broadcasts, target-removal cleanup, and recoverable initialization errors without engine restart/recompile in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/renderer/components/track-instrument-editor/TrackInstrumentEditorPage.tsx`.
- [ ] T045 [US3] Exercise the full 60-second BlueX7 active-playback/Blue-Live workflow, including start/stop, close/reopen, Track switching, edits, and target removal, and record 20 Hz cadence, isolation, mutation, and audio results in `specs/093-fix-editor-audio-glitch/validation.md`.

**Checkpoint**: Detached editors receive only the narrow activity contract, BlueX7 readback begins after readiness at the established cadence, and all canonical editing/lifecycle behavior remains isolated and recoverable.

---

## Phase 6: Polish & Cross-Cutting Acceptance

**Purpose**: Close constitutional portability, compatibility, native regression, packaged acceptance, and repository validation obligations.

- [X] T046 Add explicit native-path, synthetic Windows-path, unwritable-directory, and injected write-error coverage without POSIX permission assumptions in `packages/blue-app/src/main/editor-open-diagnostics.test.ts`.
- [X] T047 Add a compatibility guard that compares pre/post editor-open project snapshots and confirms no `.blue` XML, generated CSD, automation, or persistent setting is written by diagnostics in `packages/blue-app/src/shared/project-editor-track-instrument.test.ts` and `packages/blue-app/src/main/editor-open-diagnostics.test.ts`.
- [X] T048 [P] Build the profiling native target, run all profiling CTest cases, run the Spec 072 null-audio `benchmark_engine` guard, and record commands/results (without treating the benchmark as audible proof) in `specs/093-fix-editor-audio-glitch/validation.md`.
- [ ] T049 [P] Build the unpacked packaged app and run 30 consecutive cold opens (10 generic/text, 10 Blue Synth Builder, 10 BlueX7 with post-ready live values), five comparable resource trials, and the Effect Interface control; record zero-interruption/binding and ≤10% gates in `specs/093-fix-editor-audio-glitch/validation.md` (release gate deferred; no packaged result is claimed).
- [X] T050 Run the affected focused suites and builds from `packages/blue-app/package.json`, including main/preload/renderer builds, engine-client tests, app tests, schema validation, and the quickstart commands in `specs/093-fix-editor-audio-glitch/quickstart.md`; record scoped failures in `specs/093-fix-editor-audio-glitch/validation.md`.
- [X] T051 Run repository-wide `pnpm test`, `pnpm lint`, and `git diff --check` from `/Users/stevenyi/work/blue-electron/package.json`, resolve failures or document approved scoped exceptions in `specs/093-fix-editor-audio-glitch/validation.md` (two scoped `@blue/data` baseline mismatches are documented; no data source or expected hash was changed).
- [X] T052 Review the implementation and evidence against `AGENTS.md`, `.specify/memory/constitution.md`, `specs/093-fix-editor-audio-glitch/spec.md`, `specs/093-fix-editor-audio-glitch/plan.md`, `specs/093-fix-editor-audio-glitch/data-model.md`, and both runtime/diagnostic contracts; update confirmed decisions, platform limitations, and final disposition in `specs/093-fix-editor-audio-glitch/research.md`, `specs/093-fix-editor-audio-glitch/quickstart.md`, and `specs/093-fix-editor-audio-glitch/validation.md`.
- [X] T053 Replace the perform-thread channel mutex/deque handoff with a fixed-capacity, generation-fenced SPSC mailbox of pre-resolved channel pointers; preserve whole-batch ordering and bound consumption to one batch per k-cycle in `native/blue-engine/src/engine/RealtimeChannelMailbox.h` and `native/blue-engine/src/engine/CsoundEngine.cpp`.
- [X] T054 Serve live batch readback from the atomic shared-memory mirror, aggregate channel command/entry deltas per diagnostic attempt, and validate the observation in the JSONL contract.
- [X] T055 Give Effect Interface the shared diagnostic lifecycle and a separate dynamic renderer chunk that excludes the full code-editor/UDO workspace cold path.
- [X] T056 Start both Effect Interface diagnostic dependency modes immediately in parallel with snapshot loading and replace transient Effect/Track loading labels with neutral app-background shells so UI delay cannot mask the A/B comparison.
- [X] T057 Preserve the shutdown-safe recent-files settings IPC handlers after project-domain teardown until renderer shutdown, with regression coverage for the teardown order.
- [X] T058 Paint every first-party BrowserWindow and renderer HTML entry with the canonical app background before renderer CSS loads, preventing the native/Chromium white startup flash without adding a visible loading message.
- [X] T059 Build an isolated pre-mailbox diagnostic control engine that measures the perform thread's actual `channelMutex_` acquisition wait without logging or allocating in the real-time loop, retaining the maximum wait, worst sample frame, and threshold counts until stop.
- [X] T060 Distinguish computation from descheduling or audio-backend blocking inside correlated `csoundPerformKsmps` wall-time stalls by recording per-cycle thread CPU time alongside wall time and correlating retained sample frames with editor-open attempts.
- [X] T061 Record the Csound AuHAL circular-buffer lock/callback experiment as an external follow-up; no Csound source, framework binary, or temporary causal instrumentation belongs in this Blue Electron spec.

## Closure

The Blue Electron implementation is complete and locally validated. T049 remains
an explicit packaged release gate, while T020–T022, T025, T033, T038, and T045
remain manual or matrix-expansion follow-ups whose results cannot be inferred from
the local suite. The Csound AuHAL experiment is external to this repository and is
not required to retain the channel-mailbox hardening.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately. T001–T003 create fixtures and the evidence destination.
- **Foundational (Phase 2)**: Depends on Phase 1. T004/T006 establish the shared contract and diagnostics seam; T005, T009, and T010 verify them; T008 wires lifecycle disposal. No story starts until diagnostics are safely opt-in and bounded.
- **User Story 2 (Phase 3, P1)**: Depends on Foundation. T011–T014 can be authored in parallel where marked; T015–T019 implement the evidence channel before T020–T022 run and interpret the controlled matrix.
- **User Story 1 (Phase 4, P1/MVP)**: Test scaffolding T023–T026 can start after Foundation and overlap the diagnostic runs. T027–T031 implement the accepted startup path after T022; T032 is conditional on the T021 minimal-shell result; T033 is the story checkpoint.
- **User Story 3 (Phase 5, P2)**: Depends on the accepted US1 lifecycle and the Foundation contract seam. T034–T037 can be authored in parallel; T038 depends on the preceding renderer fixtures; T039–T044 implement the narrow runtime status path; T045 is the live-behavior checkpoint.
- **Polish (Phase 6)**: Depends on all selected story work and the accepted candidate. T046–T050 cover independent validation seams; T051 and T052 are final repository/evidence gates.

### User Story Dependencies

```text
Setup -> Foundation -> US2 diagnostic evidence
                         |
                         v
                US1 accepted startup path (MVP)
                         |
                         v
                US3 runtime/live behavior
                         |
                         v
                 packaged + repository polish
```

- **User Story 2 (P1)**: Independent after Foundation; its candidate decision gates US1's shipping mitigation.
- **User Story 1 (P1)**: Verification can begin after Foundation, but implementation selection depends on US2's controlled evidence. No dependency on US3.
- **User Story 3 (P2)**: Depends on US1's detached lifecycle and snapshot contract; it must remain independently testable with runtime status and BlueX7 fixtures.

### Parallel Opportunities

- Setup T001–T003 target separate fixture, native, and documentation paths.
- Foundation T004, T006, and T010 can begin in parallel; contract and diagnostics tests follow their respective seams.
- US2 T012–T014 are independent integration/native/effect control tests and can run together.
- US1 T023–T026 are independent manager, renderer, control, and compatibility regressions.
- US3 T034–T037 target shared, preload, main, and renderer boundaries and can run together.
- Polish T048–T050 target native benchmark, package acceptance, and focused validation paths separately; run T047's compatibility guard after the diagnostics test additions.

## Parallel Example: User Story 1

```text
After Foundation (and while US2 evidence is collected):
Task T023: Track window-manager focus/snapshot and stale-target regressions
Task T024: Detached renderer one-snapshot/lazy-readiness regressions
Task T025: Track control rapid-click/reopen regressions
Task T026: Project/engine compatibility guard
```

## Parallel Example: User Story 2

```text
Task T012: Main diagnostic open-flow integration tests
Task T013: Native budget-gap and bounded-retention tests
Task T014: Effect Interface diagnostic control tests
```

## Parallel Example: User Story 3

```text
Task T034: Shared runtime-status ordering/guard tests
Task T035: Preload runtime-status IPC tests
Task T036: Main status authorization/sequence tests
Task T037: Renderer BlueX7 readiness/cadence/staleness tests
```

## Implementation Strategy

### MVP First (User Story 1 with the minimum evidence gate)

1. Complete Setup and Foundational phases.
2. Complete US2's deterministic instrumentation and enough controlled runs to select a candidate (T011–T022).
3. Complete US1 through T033, shipping duplicate-work removal and progressive startup first.
4. Add the standby shell only if the documented minimal-shell condition remains causal; otherwise keep the simpler path.
5. Stop and validate the packaged 30-open audio gate before adding runtime-status/live refinements.

### Incremental Delivery

1. **US2**: Produce reproducible evidence and a candidate decision.
2. **US1**: Deliver focus-before-snapshot, single-snapshot, progressive editor readiness, and optional evidence-gated pooling.
3. **US3**: Restore narrow detached activity status and post-ready BlueX7 readback while preserving canonical edits.
4. **Polish**: Complete native guards, packaged acceptance, resource gates, full tests, lint, portability review, and final evidence.

### Stop/Review Points

- After T010: confirm diagnostics are disabled by default, bounded, non-blocking, and use only existing engine-state requests.
- After T022: approve the root-cause/candidate decision and the workload qualification before changing startup behavior.
- After T033: verify one-snapshot/focus/reopen behavior and the accepted audio-continuity candidate.
- After T045: verify 20 Hz BlueX7 live behavior and canonical mutation/lifecycle compatibility.
- After T052: confirm every candidate is adopted, rejected, or deferred and every platform limitation is recorded.

## Requirement Traceability

| Requirement area | Task coverage |
|---|---|
| Deterministic reproduction, controls, root cause, and report (FR-001–FR-006, FR-016, FR-019) | T011–T022, T033, T049, T052 |
| No interruption, correct identity, lifecycle, and startup isolation (FR-007–FR-008, FR-011–FR-015) | T023–T033, T047, T049 |
| Canonical edits, runtime synchronization, and live values (FR-009–FR-010) | T026, T034–T045, T047 |
| Regression/manual fallback and measurable acceptance (FR-017–FR-018, SC-001–SC-008) | T001–T003, T023–T026, T033, T045–T051 |
| Constitution: ownership, typed boundaries, host paths, native isolation, compatibility | T004–T010, T018–T019, T026, T039–T044, T046–T052 |

## Notes

- `[P]` is used only where the file sets and prerequisites permit parallel work.
- No task adds a persisted project entity, changes `.blue` XML/CSD semantics, adds a public engine command, or broadens detached windows to the workbench's unrestricted IPC listeners.
- Diagnostics are disposable derived artifacts; output directories remain native host paths and never enter embedded Csound text.
- A native scheduling-gap event is supporting timing evidence only. Audible/loopback continuity and the clean no-open control decide causality and acceptance.
- Commit after each coherent task group if the optional Git hook is selected.
