# Tasks: Large File Refactor — Project Store and Main Process

**Input**: Design documents from `/specs/088-large-file-refactor/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Verification**: This structural refactor requires focused renderer, main-process, IPC, lifecycle, runtime, serialization-preservation, host-path, build, and quickstart evidence. Existing behavior is the oracle; no semantic divergence is authorized.

**Status**: Complete — T001 through T068 are implemented; automated, manual-sanity, exception,
and follow-up evidence is recorded in [implementation-notes.md](implementation-notes.md).

**Organization**: Tasks are grouped by user story so the renderer seam and main-process seam can be implemented and reviewed independently before their compatibility evidence is combined.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it changes different files and has no dependency on an incomplete task in the same phase
- **[Story]**: Maps a task to a user story from `spec.md`
- Every task names the exact repository file or files it changes or uses as its evidence record

---

## Phase 1: Setup (Freeze the Baseline)

**Purpose**: Capture the pre-refactor state and inventories before any behavior moves.

- [x] T001 Run the baseline environment checks and `pnpm --filter @blue/app test`, then record versions, understood worktree changes, pass/fail output, owner, and residual risk in `specs/088-large-file-refactor/implementation-notes.md`
- [x] T002 [P] Record the complete current responsibility, caller, state-read/write, side-effect, failure, lifecycle, test-seam, and rollback inventory for `packages/blue-app/src/renderer/stores/project-store.ts` and `packages/blue-app/src/main/main.ts` in `docs/modularization.md`
- [x] T003 [P] Reconcile all 177 inbound endpoints, the 112 direct registrations, the 65 existing-registrar registrations, invoke/listen modes, ordinals, owners, and lifecycle order against current sources in `specs/088-large-file-refactor/contracts/main-process-ipc-inventory.md`

---

## Phase 2: Foundational (Compatibility Oracles)

**Purpose**: Freeze the stable façade and registration contracts that all extractions must preserve.

**⚠️ CRITICAL**: Complete this phase before moving renderer behavior or main-process handlers.

- [x] T004 [P] Add a current-state fake-`IpcMain`/source-capture oracle that asserts the exact 177-channel count, 112 direct-channel count, 65 existing-registrar count, unique channel/mode pairs, listener identities, and recorded registration sequence in `packages/blue-app/src/main/ipc/main-process-ipc-inventory.test.ts`
- [x] T005 [P] Extend stable façade coverage for exported revision helpers, BSB reducer access, test flush hooks, immediate optimistic updates, refresh/no-refresh classes, and representative score/mixer/orchestra/MIDI/document patches in `packages/blue-app/src/renderer/tests/project-store.test.ts`

**Checkpoint**: The pre-move renderer façade and process-wide IPC inventory are executable compatibility oracles.

---

## Phase 3: User Story 1 — Change One Renderer Domain Without Understanding the Whole Store (Priority: P1) 🎯 MVP

**Goal**: Place BSB optimistic snapshot behavior and the patch batching/revision protocol behind focused store-independent interfaces while keeping `project-store.ts` as the stable façade.

**Independent Test**: Apply nested BSB, preset, metadata, score-object, score, mixer, orchestra, MIDI, and project-document patches through the focused seams and stable façade; verify aliasing, immediate snapshots, 100 ms batching, FIFO order, one in-flight commit, revision/session fences, dirty restoration, refresh ordering, and failure behavior with fake timers and injected adapters.

### Verification for User Story 1

- [x] T006 [P] [US1] Add direct value, affected-path identity, unaffected-sibling alias, widget-metadata preservation/replacement, preset, layout, UDO, malformed-target, and structured score-object BSB regression cases in `packages/blue-app/src/renderer/tests/bsb-interface-snapshot.test.ts`
- [x] T007 [P] [US1] Add fake-timer and injected-adapter tests for trailing 100 ms scheduling, FIFO/non-overlapping batches, active-drain enqueue, session/revision fencing, dirty baselines, refresh classifiers, explicit/background failures, no retry, and reset behavior in `packages/blue-app/src/renderer/tests/project-patch-queue.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Extract `applyBsbInterfacePatchToSnapshot`, the store-facing metadata-preserving operation, and the private metadata classifier into `packages/blue-app/src/renderer/stores/project-store/bsb-interface-snapshot.ts` without Zustand, React, IPC, host imports, deep cloning, or changed tolerated-error behavior
- [x] T009 [US1] Preserve the public BSB reducer export and delegate optimistic BSB store actions through the single extracted implementation in `packages/blue-app/src/renderer/stores/project-store.ts`
- [x] T010 [US1] Repoint the reducer-leaf BSB import without changing its exported document-reducer behavior in `packages/blue-app/src/renderer/components/workbench/panels/score-object/score-object-document-reducer.ts`
- [x] T011 [US1] Implement `createProjectPatchQueue` as the sole owner of pending FIFO patches, the trailing timer, active commit, revision/session fence, dirty baseline, refresh classification, and error delivery in `packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts`
- [x] T012 [US1] Replace the inline queue protocol with one injected coordinator while preserving optimistic action timing and delegating `getProjectDocumentRevision`, `acceptProjectDocumentRevision`, `__testFlushPendingPatches`, `__testAwaitPendingPatches`, and `__testClearPendingPatches` in `packages/blue-app/src/renderer/stores/project-store.ts`
- [x] T013 [US1] Keep cross-domain and façade integration assertions in `packages/blue-app/src/renderer/tests/project-store.test.ts`, moving only lower-level queue protocol assertions to `packages/blue-app/src/renderer/tests/project-patch-queue.test.ts` and leaving unrelated reducer families in the façade
- [x] T014 [US1] Run the BSB, presets, performance, score-object sound-patch, project-store, project-patch-queue, and track-instrument queue tests plus `build:renderer`, then record the exact checkpoint and rollback result in `specs/088-large-file-refactor/implementation-notes.md`

**Checkpoint**: The BSB seam and patch coordinator are independently testable, and all existing renderer consumers still compile through `project-store.ts`.

---

## Phase 4: User Story 2 — Change One Main-Process Domain Without Editing a God Module (Priority: P1)

**Goal**: Establish one project-session identity owner, explicit project-transition orchestration, transactional IPC registration, startup rollback, and five focused registrars while retaining `main.ts` as the composition and normal-shutdown owner.

**Independent Test**: Exercise session transitions, project replacement, registration leases, failed-startup rollback, exact registrar channel sets, representative success/error/broadcast cases, composition order, and normal shutdown through injected fakes; assert all 177 endpoints and build the main process.

### Project Session and Transition Ownership

- [x] T015 [P] [US2] Add transition-table, monotonic receipt, invalid-operation, idempotent shutdown, and native POSIX/Windows-drive/UNC path-preservation tests in `packages/blue-app/src/main/project-session.test.ts`
- [x] T016 [US2] Implement the semantic `read`, `replace`, `close`, `publishPath`, `recordMutation`, and `resetForShutdown` boundary with no public setters or ownership of unrelated runtimes/windows in `packages/blue-app/src/main/project-session.ts`
- [x] T017 [P] [US2] Add open/new/save/save-as/revert/close ordering, candidate-load failure, stale-session, cleanup, and broadcast-target tests around injected owners in `packages/blue-app/src/main/project-lifecycle.test.ts`
- [x] T018 [US2] Implement project open/new/save/save-as/revert/replacement/close orchestration around `ProjectSession` and injected runtime/editor/missing-audio/recent-file operations in `packages/blue-app/src/main/project-lifecycle.ts`
- [x] T019 [US2] Replace module-level writes of active `BlueData`, native path, revision, and session identity with `ProjectSession` transitions and route replacement coordination through `project-lifecycle.ts` in `packages/blue-app/src/main/main.ts`

### Transactional Registration and Startup Safety

- [x] T020 [P] [US2] Add duplicate-before-side-effect, partial reverse rollback, exact-listener removal, idempotent disposal, stale-disposer isolation, and re-registration tests in `packages/blue-app/src/main/ipc/ipc-registration.test.ts`
- [x] T021 [US2] Implement the `(IpcMainLike, registrarKey)` registration lease, exact handler/listener tracking, generation guard, rollback, and once-only disposer in `packages/blue-app/src/main/ipc/ipc-registration.ts`
- [x] T022 [P] [US2] Add completed-stage reverse rollback, continued cleanup after rollback error, initiating-error preservation, irreversible-stage documentation, and separate normal-shutdown-order tests in `packages/blue-app/src/main/startup-lifecycle.test.ts`
- [x] T023 [US2] Implement the startup-stage runner used only for failed-startup unwind, leaving normal shutdown as an explicit separate policy in `packages/blue-app/src/main/startup-lifecycle.ts`
- [x] T024 [P] [US2] Adopt the shared registration lease, exact 44-channel assertion, partial rollback, and idempotent exact teardown in `packages/blue-app/src/main/unified-library/ipc.ts` and `packages/blue-app/src/main/unified-library/ipc.test.ts`
- [x] T025 [P] [US2] Adopt the shared registration lease, exact 11-channel assertion, partial rollback, and idempotent exact teardown in `packages/blue-app/src/main/code-repository/ipc.ts` and `packages/blue-app/src/main/code-repository/ipc.test.ts`
- [x] T026 [P] [US2] Replace silent duplicate workbench initialization with deterministic pre-side-effect failure and exact ownership-listener teardown in `packages/blue-app/src/main/workbench-window-host.ts` and `packages/blue-app/src/main/workbench-window-host.test.ts`
- [x] T027 [P] [US2] Replace silent duplicate MIDI initialization with the shared lease while preserving sender checks, command acknowledgements, three invoke handlers, two listeners, and shutdown behavior in `packages/blue-app/src/main/midi-input-coordinator.ts` and `packages/blue-app/src/main/midi-input-coordinator.test.ts`

### Domain Registrar Verification

- [x] T028 [P] [US2] Add the exact 17-channel set/order plus representative open/new/save/replacement, MIDI-import, missing-audio, recent-file, BSB path, cancellation, error, broadcast, and disposer cases in `packages/blue-app/src/main/ipc/project-lifecycle-ipc.test.ts`
- [x] T029 [P] [US2] Add the exact 15-channel set/order plus dialog cancellation, native-path, validation-error, SoundFont, CsoundRC, import/export, owner-window, and disposer cases in `packages/blue-app/src/main/ipc/project-artifacts-ipc.test.ts`
- [x] T030 [P] [US2] Add the exact 30-channel set/order plus playback mutual exclusion, sender-authorized listeners, Blue Live, evaluation, REPL/runtime, realtime control, render/freeze/cancel, error, event-target, and disposer cases in `packages/blue-app/src/main/ipc/playback-runtime-ipc.test.ts`
- [x] T031 [P] [US2] Add the exact 27-channel set/order plus document receipt/fence/broadcast, editor-window, audio authorization, score-object tool, unavailable/error, and disposer cases in `packages/blue-app/src/main/ipc/project-document-ipc.test.ts`
- [x] T032 [P] [US2] Add the exact 23-channel set/order plus fail-closed confirmation, settings/about, program settings/OSC, file-manager native paths, layout targeting, error, and disposer cases in `packages/blue-app/src/main/ipc/application-ipc.test.ts`

### Domain Registrar Implementation and Composition

- [x] T033 [US2] Extract the 17 project/file-session endpoints behind injected `ProjectSession` and lifecycle operations, preserving recorded invoke/listen modes and source-relative ordering in `packages/blue-app/src/main/ipc/project-lifecycle-ipc.ts` and `packages/blue-app/src/main/main.ts`
- [x] T034 [US2] Extract the 15 import/export, SoundFont, CsoundRC, and artifact-file endpoints behind injected host operations without normalizing native paths in `packages/blue-app/src/main/ipc/project-artifacts-ipc.ts` and `packages/blue-app/src/main/main.ts`
- [x] T035 [US2] Extract the 30 playback/CSD, Blue Live, evaluation, REPL/runtime, realtime-control, and render/freeze endpoints while retaining their existing runtime owners and operation fences in `packages/blue-app/src/main/ipc/playback-runtime-ipc.ts` and `packages/blue-app/src/main/main.ts`
- [x] T036 [US2] Extract the 27 canonical-document, project-editor, audio, and score-object endpoints so all identity/revision acknowledgements pass through `ProjectSession` in `packages/blue-app/src/main/ipc/project-document-ipc.ts` and `packages/blue-app/src/main/main.ts`
- [x] T037 [US2] Extract the 23 confirmation/settings/about, program settings/OSC, file-manager, and window-layout endpoints while preserving fail-closed decisions and exact window targeting in `packages/blue-app/src/main/ipc/application-ipc.ts` and `packages/blue-app/src/main/main.ts`
- [x] T038 [US2] Update runtime and Csound source-boundary audits to inspect every new command-spawning or runtime-registering owner rather than only `main.ts` in `packages/blue-app/src/main/engine-runtime-ipc.test.ts` and `packages/blue-app/src/main/csound-runtime-boundary.test.ts`
- [x] T039 [US2] Wire all registrar leases into the current pre-ready/`whenReady` stages, use reverse-order startup rollback only on failure, retain the documented explicit normal-shutdown order, and leave `registerBlueAudioScheme` process-lifetime in `packages/blue-app/src/main/main.ts`
- [x] T040 [US2] Update the post-move oracle to invoke all domain/existing registrars and prove 177 unique endpoints, exact modes/order, rollback, and teardown; run focused session/lifecycle/registrar/replacement tests plus `build:main` and record results in `packages/blue-app/src/main/ipc/main-process-ipc-inventory.test.ts` and `specs/088-large-file-refactor/implementation-notes.md`

**Checkpoint**: Main-process domains are locally testable, `ProjectSession` is the sole identity writer, duplicate/partial registration is safe, and `main.ts` remains the single composition and normal-shutdown owner.

---

## Phase 5: User Story 3 — Continue Working Without Noticing the Refactor (Priority: P1)

**Goal**: Prove that project data, renderer edits, host workflows, runtimes, rendering, and IPC behavior remain observably identical after both extraction streams.

**Independent Test**: Run project replacement and store integration oracles, all 177 endpoint contracts, render/freeze/playback/runtime cancellation and shutdown tests, all app boundary builds, the affected app suite, and the deterministic quickstart smoke workflow with a project containing known and unknown XML data.

### Compatibility and Workflow Verification

- [x] T041 [P] [US3] Extend open/new/save/save-as/revert/close, candidate-load failure, modeled-plus-unknown-XML save/reopen preservation, path publication, cleanup order, and stale-session integration coverage in `packages/blue-app/src/main/project-replacement-entry-points.test.ts` and `packages/blue-app/src/main/project-replacement-flow.test.ts`
- [x] T042 [P] [US3] Add stable-façade integration cases for queued edits during in-flight commits, project reset, stale receipts, monotonic revisions, unchanged dirty restoration, and required canonical refresh ordering in `packages/blue-app/src/renderer/tests/project-store.test.ts`
- [x] T043 [P] [US3] Extend CSD output parity, cancellation, one-active-operation, project-replacement, temporary cleanup, and shutdown regressions across `packages/blue-app/src/main/csd-generation.test.ts`, `packages/blue-app/src/main/csd-export.test.ts`, `packages/blue-app/src/main/audition-score-objects.test.ts`, `packages/blue-app/src/main/render-to-disk.test.ts`, `packages/blue-app/src/main/freeze-score-objects.test.ts`, and `packages/blue-app/src/main/repl-console-runtime.test.ts`
- [x] T044 [P] [US3] Add representative payload/result/error/event-target integration assertions for every registrar domain while retaining the exact inventory assertion in `packages/blue-app/src/main/ipc/main-process-ipc-inventory.test.ts`
- [x] T045 [US3] Run `build:main`, `build:preload`, and `build:renderer` to prove stable IPC/preload types, renderer façade imports, host/pure dependency direction, and absence of cycles, recording output in `specs/088-large-file-refactor/implementation-notes.md`
- [x] T046 [US3] Run the affected `@blue/app` suite and the focused BSB, queue, session, replacement, registrar, source-audit, render, freeze, and runtime checkpoints from `specs/088-large-file-refactor/quickstart.md`, recording any pre-existing exception and residual risk in `specs/088-large-file-refactor/implementation-notes.md`
- [x] T047 [US3] Execute the deterministic packaged/manual smoke checkpoint with a representative known-plus-unknown-XML project, or document why it is unavailable and the exact follow-up owner, in `specs/088-large-file-refactor/implementation-notes.md`

**Checkpoint**: Opening, editing, saving, replacing, rendering, playback, runtime use, and quitting produce the baseline-observable results with no XML, CSD, snapshot, path, event, or contract divergence.

---

## Phase 6: User Story 4 — Review and Revert the Refactor Safely (Priority: P1)

**Goal**: Make every accepted seam, retained responsibility, test checkpoint, compatibility mechanism, and rollback boundary explicit to reviewers.

**Independent Test**: A reviewer can locate the owner, narrow interface, dependency direction, canonical state, focused oracle, compatibility strategy, accepted/deferred decision, and independent rollback procedure for every renderer and main-process seam without reconstructing either original module.

### Review and Rollback Evidence

- [x] T048 [P] [US4] Add second-wave boundary maps for the BSB reducer, patch queue, project session, project lifecycle, registration lease, startup rollback, and five IPC registrars in `docs/modularization.md`
- [x] T049 [US4] Record retained `project-store.ts` reducer families, retained `main.ts` composition/lifecycle responsibilities, rejected shallow splits, and concrete revisit conditions in `docs/modularization.md`
- [x] T050 [P] [US4] Record each seam's independently revertible checkpoint, focused validation command/result, and any separately approved semantic cleanup in `specs/088-large-file-refactor/implementation-notes.md`
- [x] T051 [US4] Audit the final imports and state writes for cycles, back-imports, duplicate queues, duplicate revision/session writers, and hidden lifecycle owners, then record evidence beside each boundary map in `docs/modularization.md`
- [x] T052 [US4] Review the final diff against FR-017/FR-018 and document the exact façade restoration or ownership rollback procedure for every accepted seam in `docs/modularization.md`

**Checkpoint**: Each extraction is reviewable and revertible without reverting unrelated seams, and every retained/deferred area has a reason and revisit condition.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Synchronize validation documentation and run the final constitution/repository gates.

- [x] T053 [P] Update focused commands, exact test filenames, expected counts, rollback checkpoints, and any deterministic manual steps discovered during implementation in `specs/088-large-file-refactor/quickstart.md`
- [x] T054 [P] Verify native Windows path-sensitive coverage remains enabled in `.github/workflows/pr.yml`, run or obtain the Windows result for synthetic drive/UNC and native-path cases, and record the run or scoped exception in `specs/088-large-file-refactor/implementation-notes.md`
- [x] T055 Run `pnpm --filter @blue/app test`, repository-wide `pnpm test`, and `pnpm lint`, recording exact results, pre-existing failures, owners, and residual risk in `specs/088-large-file-refactor/implementation-notes.md`
- [x] T056 Run `git diff --check` and review the final changes for new dependencies, IPC/payload/persistence changes, global path normalization, deep clones, speculative helpers, or mixed semantic cleanup, recording the clean handoff or exception in `specs/088-large-file-refactor/implementation-notes.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies; freeze the baseline before implementation.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks both extraction streams.
- **Phase 3 — US1 Renderer seam**: Depends on Phase 2; no dependency on US2.
- **Phase 4 — US2 Main-process seam**: Depends on Phase 2; no dependency on US1.
- **Phase 5 — US3 Compatibility**: Depends on US1 and US2 because it verifies their combined observable behavior.
- **Phase 6 — US4 Review/rollback**: Final maps depend on US1 and US2; the phase can run alongside US3 once both extractions complete.
- **Phase 7 — Polish**: Depends on all user stories selected for delivery.

### User Story Dependency Graph

```text
Setup -> Foundational -> US1 (renderer) --+--> US3 (workflow compatibility) --+
                       -> US2 (main) -----+                                +--> Polish
                                         +--> US4 (review/rollback) --------+
```

### Within User Story 1

1. Write the direct BSB and queue protocol tests (T006–T007).
2. Extract and wire the BSB reducer behind the façade (T008–T010).
3. Implement and wire the one queue coordinator (T011–T013).
4. Run the renderer checkpoint (T014).

### Within User Story 2

1. Establish session/lifecycle ownership (T015–T019).
2. Establish transactional registration and startup rollback (T020–T023).
3. Harden existing registrar owners after the shared lease exists (T024–T027).
4. Freeze registrar-specific contracts (T028–T032).
5. Extract registrars one reviewable source region at a time (T033–T037).
6. Update source audits and composition, then prove the process-wide inventory (T038–T040).

### Within User Stories 3 and 4

- US3 verification tasks T041–T044 can run together after US1 and US2; builds and checkpoints follow in T045–T047.
- US4 documentation tasks T048 and T050 can start together; T049, T051, and T052 finish the consolidated maps and rollback review.

---

## Parallel Execution Examples

### User Story 1

```text
T006: Direct BSB value/reference-identity contract tests
T007: Injected patch-queue protocol tests
```

After T008–T010 complete, queue implementation T011 can proceed without changing the BSB module.

### User Story 2

```text
T015: ProjectSession transition/path tests
T017: Project lifecycle orchestration tests
T020: IPC registration lease tests
T022: Startup rollback tests
```

After T021, hardening T024–T027 can proceed in parallel. After the ownership/lease foundations, registrar contract tests T028–T032 can proceed in parallel before their sequential extraction checkpoints.

### User Story 3

```text
T041: Project replacement workflows
T042: Renderer queue/session integration
T043: Playback/render/runtime cancellation and shutdown
T044: Process-wide IPC compatibility
```

### User Story 4

```text
T048: Consolidated boundary maps in docs/modularization.md
T050: Checkpoint and rollback evidence in implementation-notes.md
```

---

## Implementation Strategy

### MVP First — User Story 1

1. Complete Setup and Foundational phases.
2. Complete the BSB extraction and focused checkpoint.
3. Complete the patch-queue extraction and focused checkpoint.
4. Stop and validate US1 independently through the unchanged `project-store.ts` façade.

This is the smallest independently useful and lowest-risk delivery slice. It does not authorize shipping the combined refactor without the main-process and compatibility phases.

### Incremental Delivery

1. Freeze baseline and compatibility inventories.
2. Deliver US1 as two revertible renderer seams: BSB, then patch queue.
3. Deliver US2 as ordered ownership changes: session/lifecycle, registration safety, then one registrar group at a time.
4. Run US3 after both streams to prove unchanged composer workflows and boundary contracts.
5. Finish US4 maps and rollback records, then run all cross-cutting gates.

### Review Discipline

- Keep mechanical movement separate from any semantic cleanup; record and approve cleanup separately.
- Do not extract additional score/mixer/track/orchestra reducers without the documented revisit prerequisites.
- Do not introduce a generic event bus, plugin framework, second project owner, second queue, or second lifecycle owner.
- Preserve native paths at host APIs and convert only at the named canonical-identity or Csound/external-text boundaries.
- Stop at every checkpoint; a failing checkpoint is resolved or recorded before the next ownership move.

---

## Notes

- `[P]` means the task is parallelizable only after its stated phase prerequisites are complete.
- Existing TypeScript behavior is the primary oracle; consult Java Blue only if XML, CSD, rendering, migration, or formatting output changes.
- `ProjectSession` owns canonical document identity, native path, revision, and session fence; it does not absorb runtime/window/service ownership.
- The renderer store remains a transient optimistic projection; `.blue` XML and `BlueData` remain main-owned and canonical.
- Every registrar preserves channel strings, invoke/listen modes, payloads, results, errors, event ordering, target windows, registration timing, and exact-listener teardown.

## Phase 8: Convergence

- [x] T057 CRITICAL restore `pnpm --filter @blue/app build:main` by correcting the inventory extractor's `ipcRegistration` receiver typing, then rerun the affected and repository-wide validation gates and record exact results in `packages/blue-app/src/main/ipc/main-process-ipc-inventory.test.ts` and `specs/088-large-file-refactor/implementation-notes.md` per Constitution V and FR-020 (contradicts)
- [x] T058 CRITICAL add the exact 17-channel order plus representative open/new/save/replacement, MIDI-import, missing-audio, recent-file, BSB-path, cancellation, error, broadcast, and idempotent-disposer coverage in `packages/blue-app/src/main/ipc/project-lifecycle-ipc.test.ts` per Constitution V and FR-016 (missing)
- [x] T059 CRITICAL add the exact 15-channel order plus dialog cancellation, native-path, validation-error, SoundFont, CsoundRC, import/export, owner-window, and idempotent-disposer coverage in `packages/blue-app/src/main/ipc/project-artifacts-ipc.test.ts` per Constitution V and FR-016 (missing)
- [x] T060 CRITICAL add the exact 30-channel order plus playback mutual exclusion, authorized listeners, Blue Live, evaluation, REPL/runtime, realtime control, render/freeze/cancel, error, event-target, and idempotent-disposer coverage in `packages/blue-app/src/main/ipc/playback-runtime-ipc.test.ts` per Constitution V and FR-016 (missing)
- [x] T061 CRITICAL add the exact 27-channel order plus document receipt/fence/broadcast, editor-window, audio authorization, score-object tool, unavailable/error, and idempotent-disposer coverage in `packages/blue-app/src/main/ipc/project-document-ipc.test.ts` per Constitution V and FR-016 (missing)
- [x] T062 CRITICAL add the exact 23-channel order plus fail-closed confirmation, settings/about, program settings/OSC, file-manager native paths, layout targeting, error, and idempotent-disposer coverage in `packages/blue-app/src/main/ipc/application-ipc.test.ts` per Constitution V and FR-016 (missing)
- [x] T063 complete stable-façade integration coverage for exported revision helpers, the BSB reducer export, test flush hooks, representative score/mixer/orchestra/MIDI/document patches, project reset, stale receipts, monotonic revisions, dirty restoration, and canonical refresh ordering in `packages/blue-app/src/renderer/tests/project-store.test.ts` per FR-006 and US3/AC2 (partial)
- [x] T064 compose the pre-ready registrars and `whenReady` services through reverse-order failed-startup rollback while preserving the separate explicit normal-shutdown order, process-lifetime `registerBlueAudioScheme`, initiating errors, and existing top-level exit behavior in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/startup-lifecycle.test.ts` per FR-013 and US2/AC4 (partial)
- [x] T065 restore the documented process-wide IPC registration order and extend the executable post-move oracle to invoke all domain and existing registrars and prove 177 unique endpoints, exact modes/order, partial rollback, and teardown in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/ipc/main-process-ipc-inventory.test.ts` per FR-013 and plan: registration order (contradicts)
- [x] T066 add open/new/save/save-as/revert/close integration coverage for candidate-load failure, modeled-plus-unknown-XML save/reopen preservation, path publication, cleanup order, stale-session rejection, and broadcasts in `packages/blue-app/src/main/project-replacement-entry-points.test.ts` and `packages/blue-app/src/main/project-replacement-flow.test.ts` per FR-014 and FR-015 (partial)
- [x] T067 extend CSD, playback, render, freeze, and runtime compatibility tests across project replacement and ordered shutdown, covering mutual exclusion, cancellation, temporary cleanup, and unchanged output behavior in `packages/blue-app/src/main/csd-generation.test.ts`, `packages/blue-app/src/main/csd-export.test.ts`, `packages/blue-app/src/main/audition-score-objects.test.ts`, `packages/blue-app/src/main/render-to-disk.test.ts`, `packages/blue-app/src/main/freeze-score-objects.test.ts`, and `packages/blue-app/src/main/repl-console-runtime.test.ts` per FR-014 and US3/AC3 (partial)
- [x] T068 record the scope and result of the completed manual testing, then execute only any missing deterministic packaged smoke steps with a known-plus-unknown-XML project and document the exact follow-up owner for unavailable steps in `specs/088-large-file-refactor/implementation-notes.md` per SC-007 (partial)
