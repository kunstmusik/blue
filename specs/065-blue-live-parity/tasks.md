# Tasks: Java Blue Live Trigger Parity

**Input**: Design documents from `/specs/065-blue-live-parity/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/blue-live-trigger-contract.md`, `quickstart.md`

**Verification**: Java-parity behavior, project/XML preservation, canonical ownership, runtime/IPC boundaries, lifecycle fencing, and affected builds require focused automated coverage under the project constitution.

**Organization**: Tasks are grouped by user story so each behavior can be implemented and verified as a coherent increment. The two P1 stories together form the safe releasable baseline.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it uses different files and does not depend on another incomplete task in the same group
- **[Story]**: Maps the task to a user story in `spec.md`
- Every task names the exact repository file or directory it changes

## Phase 1: Setup (Shared Test Evidence)

**Purpose**: Establish reusable Java-parity oracles and injected test doubles before behavior changes.

- [X] T001 [P] Add modern, old-format, sparse-grid, missing-saved-set-ID, multi-enabled, native-object, and runtime-backed Java Blue Live fixture builders with expected column-major targets and p2/p3 values in `packages/blue-data/src/live/blue-live-trigger-fixtures.ts`
- [X] T002 [P] Add controllable deferred preparation, fake Java/JavaScript runtime, fake canonical-project, and fake Blue Live engine submission helpers in `packages/blue-app/src/renderer/tests/helpers/blue-live-trigger-harness.ts`

---

## Phase 2: Foundational (Blocking Copy and Contract Safety)

**Purpose**: Make an isolated, identity-coherent project snapshot possible and establish shared boundary types.

**⚠️ CRITICAL**: Manual Trigger implementation must not begin until the aggregate deep-copy regressions pass.

- [X] T003 Add failing regressions proving `BlueData.deepCopy()` currently aliases Live Data, SoundObject/instrument libraries, opcode definitions, and library-backed `Instance` targets in `packages/blue-data/src/blue-data-deep-copy.test.ts`
- [X] T004 [P] Implement recursive category/instrument copy support in `packages/blue-data/src/instruments/instrument-category.ts` and `packages/blue-data/src/instruments/instrument-library.ts`
- [X] T005 [P] Implement original-to-copy SoundObject-library mapping and copied `Instance` reference remapping support in `packages/blue-data/src/sound-objects/sound-object-library.ts` and `packages/blue-data/src/sound-objects/instance.ts`
- [X] T006 Complete aggregate isolation in `packages/blue-data/src/blue-data.ts` by copying Live Data, SoundObject/instrument libraries, opcode definitions, and remapping copied library references across library, Live Space, and Score graphs until `packages/blue-data/src/blue-data-deep-copy.test.ts` passes
- [X] T007 Define `LegacyBlueLiveTriggerRequest`, discriminated trigger result/error types, request validation, and the `changed` field on `ProjectDocumentCommitReceipt` in `packages/blue-app/src/shared/project-editor.ts`
- [X] T008 Export the pure trigger types/service entry points without adding host imports in `packages/blue-data/src/index.ts` and add a forbidden-import/static-boundary assertion to `packages/blue-data/src/blue-data-deep-copy.test.ts`

**Checkpoint**: Whole-project copies are isolated and coherent; typed trigger and acknowledgement contracts exist.

---

## Phase 3: User Story 1 - Trigger Live Space Material (Priority: P1) 🎯 Demonstration MVP

**Goal**: Trigger one selected populated cell or all enabled cells as one immediate Java-compatible score batch in the running Blue Live session.

**Independent Test**: With no pending edits, trigger a selected disabled cell and then a non-exclusive enabled set; verify exact target membership, `60 / tempo` note scaling, one Blue Live engine submission, unchanged enabled flags, and no realtime-engine call.

### Verification for User Story 1

- [X] T009 [P] [US1] Add failing pure tests for selected-disabled targeting, enabled column-major batching, empty targets, invalid tempo, copied `TimeBehavior.NONE`, note-field preservation, and atomic failure in `packages/blue-data/src/live/blue-live-trigger.test.ts`
- [X] T010 [P] [US1] Add failing request/result validation and stable-ID snapshot contract tests in `packages/blue-app/src/renderer/tests/blue-live-contract.test.ts`
- [X] T011 [P] [US1] Add failing expected-session, empty-score, named-instrument normalization, engine rejection, and realtime-isolation submission tests in `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`
- [X] T012 [P] [US1] Replace the placeholder-alert expectation with failing Trigger button, selected-cell, Command/Ctrl+T, Command/Ctrl+Shift+T, running-state, busy-state, and result-feedback tests in `packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx`

### Implementation for User Story 1

- [X] T013 [US1] Export Java-compatible NoteList timing scaling from `packages/blue-data/src/utilities/score.ts` and implement target selection, copied-time-behavior override, synchronous/asynchronous generation dispatch, atomic merging, validation, and prepared score results in `packages/blue-data/src/live/blue-live-trigger.ts`
- [X] T014 [US1] Add expected-session-aware prepared score submission that reuses normalization and `readScore` without exposing the engine client in `packages/blue-app/src/main/blue-live-engine.ts`
- [X] T015 [US1] Implement an injected single-flight `BlueLiveTriggerController` for canonical snapshot copying, target preparation, origin capture, busy/empty/failure mapping, and prepared submission in `packages/blue-app/src/main/blue-live-trigger-controller.ts`
- [X] T016 [US1] Instantiate the controller and register validated `blue-live:trigger-objects` IPC handling against canonical `BlueData` and the dedicated Blue Live session in `packages/blue-app/src/main/main.ts`
- [X] T017 [US1] Expose `triggerBlueLiveObjects` through the context-isolated bridge and renderer declaration in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`
- [X] T018 [US1] Replace the Trigger placeholder with enabled-batch invocation, stable selected-cell ID invocation, scoped keyboard shortcuts, single-flight disabled state, and transient success/empty/error feedback in `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`
- [X] T019 [US1] Mirror only transient trigger busy/result status without changing persistent enabled flags in `packages/blue-app/src/renderer/stores/blue-live-store.ts`

**Checkpoint**: Manual Trigger works for native/synchronous LiveObjects from a stable project state and is independently demonstrable.

---

## Phase 4: User Story 2 - Always Use the Current Project and Session (Priority: P1) 🎯 Releasable MVP

**Goal**: Make start, recompile, and Trigger wait for canonical edits; make revisions meaningful; reject stale work; and stop every non-idle old-project Blue Live session.

**Independent Test**: Edit tempo/enabled state and immediately start, recompile, or trigger; then delay preparation while stopping, recompiling, or replacing the project. Verify latest acknowledged state is used and zero obsolete events are submitted.

### Verification for User Story 2

- [X] T020 [P] [US2] Add failing assertions that toolbar Start/Recompile await patch flush before preload calls and abort after flush rejection in `packages/blue-app/src/renderer/tests/blue-live-toolbar.test.tsx`
- [X] T021 [P] [US2] Add failing commit-failure propagation, acknowledgement ordering, `changed:false` reconciliation, and no stale-command continuation tests in `packages/blue-app/src/renderer/tests/project-store.test.ts`
- [X] T022 [P] [US2] Add failing semantic no-op tests for unchanged options/tempo/text/enabled state, invalid bin operations, set rename/move/remove/apply, and batch revision retention in `packages/blue-app/src/renderer/tests/blue-live-contract.test.ts`
- [X] T023 [P] [US2] Add failing stale-document, stale-session, busy, stop-during-prepare, and recompile-during-prepare controller tests in `packages/blue-app/src/renderer/tests/blue-live-trigger-controller.test.ts`
- [X] T024 [P] [US2] Add failing starting/running/stopping project close, new, open, revert, and replacement lifecycle tests in `packages/blue-app/src/renderer/tests/blue-live-project-lifecycle.test.ts`

### Implementation for User Story 2

- [X] T025 [US2] Make `flushPendingPatches()` reject after canonical recovery on commit failure and consume `ProjectDocumentCommitReceipt.changed` without falsely dirtying an acknowledged no-op in `packages/blue-app/src/renderer/stores/project-store.ts`
- [X] T026 [US2] Await the project-store acknowledgement barrier before Start/Recompile in `packages/blue-app/src/renderer/components/menu-bar/ToolbarBlueLive.tsx` and before selected/enabled Trigger in `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`
- [X] T027 [US2] Make bin structural operations and saved-set mutations report actual changes in `packages/blue-data/src/live/live-object-bins.ts`, `packages/blue-data/src/live/live-object-set-list.ts`, and `packages/blue-app/src/shared/project-editor.ts`
- [X] T028 [US2] Aggregate changed patches in the canonical batch handler, synchronize/broadcast/publish only actual mutations, preserve revision for all-no-op batches, and return `changed` receipts in `packages/blue-app/src/main/main.ts`
- [X] T029 [US2] Remove start/recompile increments from the canonical document revision, keep Blue Live session generation independent, and enforce document/session checks before and after preparation and immediately before submission in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/blue-live-trigger-controller.ts`, and `packages/blue-app/src/main/blue-live-engine.ts`
- [X] T030 [US2] Add an active-lifecycle predicate and await Blue Live trigger-gate closure plus session stop for `starting`, `running`, and `stopping` states before canonical project close/new/open/revert/replacement in `packages/blue-app/src/main/blue-live-engine.ts` and `packages/blue-app/src/main/main.ts`

**Checkpoint**: User Stories 1 and 2 form the safe releasable Manual Trigger baseline.

---

## Phase 5: User Story 3 - Trigger Generative Objects Without Corrupting the Project (Priority: P2)

**Goal**: Support JavaScript, Jython, Clojure, Python ObjectBuilder, nested, and runtime-backed note-processor paths asynchronously with clear all-or-nothing diagnostics.

**Independent Test**: Trigger curated native, JavaScript, Jython, and Clojure objects with available and unavailable runtimes; verify expected score or specific recoverable failure, no partial enabled batch, no canonical mutation, and no stale submission.

### Verification for User Story 3

- [X] T031 [P] [US3] Add failing Live Space traversal tests for Java-runtime detection and on-load processing of direct, nested, library-instance, and Python-note-processor LiveObjects in `packages/blue-data/src/blue-data-python-processor-runtime.test.ts` and `packages/blue-data/src/live-data.test.ts`
- [X] T032 [P] [US3] Add failing fake-runtime tests for JavaScript, Jython, Clojure, Python ObjectBuilder, nested async generation, runtime absence, syntax errors, atomic batch abort, and unchanged canonical serialization in `packages/blue-data/src/live/blue-live-trigger.test.ts`
- [X] T033 [P] [US3] Add failing controller tests for runtime acquisition, object-specific diagnostic mapping, runtime completion after invalidation, and recovery on the next request in `packages/blue-app/src/renderer/tests/blue-live-trigger-controller.test.ts`

### Implementation for User Story 3

- [X] T034 [US3] Add reusable LiveObject graph traversal and async on-load support in `packages/blue-data/src/live/live-object-bins.ts` and `packages/blue-data/src/live-data.ts`, then include Live Space content in `BlueData.usesJavaRuntime()` and `BlueData.processOnLoadAsync()` in `packages/blue-data/src/blue-data.ts`
- [X] T035 [US3] Inject the existing JavaScript session and Java runtime client into request-local `CompileData`, always await available async generators, and map unavailable/generation failures without partial output in `packages/blue-data/src/live/blue-live-trigger.ts`
- [X] T036 [US3] Acquire/reuse the host-owned Java runtime through the existing project session manager and pass Java/JavaScript contracts into the controller without adding host dependencies to `@blue/data` in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/blue-live-trigger-controller.ts`

**Checkpoint**: Supported generative legacy objects are audible or fail explicitly without corrupting project/runtime state.

---

## Phase 6: User Story 4 - Preserve Legacy Blue Live Projects (Priority: P2)

**Goal**: Preserve Java-authored sparse bins, identities, saved enabled masks, missing set references, Repeat/key/MIDI metadata, and unknown project XML without inferring launcher state.

**Independent Test**: Round-trip the curated Java fixtures, apply sets, manually trigger, save/reopen, and verify all covered data remains compatible while no scene/track data or automatic Repeat behavior appears.

### Verification for User Story 4

- [X] T037 [P] [US4] Add failing XML round-trip fixtures for modern/old Live Data, sparse bins, missing saved-set references, key/MIDI metadata, Repeat settings, Live Code, and trigger-only serialization invariance in `packages/blue-data/src/live-data.test.ts`
- [X] T038 [P] [US4] Add failing saved-set tests proving missing IDs are retained in XML, existing IDs resolve safely, applying a set only changes the enabled mask, and repeated application is a semantic no-op in `packages/blue-data/src/live/live-object-bins.test.ts`
- [X] T039 [P] [US4] Add failing renderer tests that label audible Repeat as deferred, preserve its editable values, and never call Trigger when a saved set is applied in `packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx`

### Implementation for User Story 4

- [X] T040 [US4] Retain unresolved `liveObjectRef` identifiers during load/save while resolving only currently existing objects for mask application in `packages/blue-data/src/live/live-object-set.ts` and `packages/blue-data/src/live/live-object-set-list.ts`
- [X] T041 [US4] Finalize lossless trigger-only XML behavior and old-format compatibility in `packages/blue-data/src/live-data.ts`, `packages/blue-data/src/live/live-object.ts`, and `packages/blue-data/src/live/live-object-bins.ts`
- [X] T042 [US4] Keep Repeat fields editable but visibly mark automatic Repeat as deferred, keep enabled color as authoring state, and keep saved-set selection non-triggering in `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`

**Checkpoint**: Legacy projects remain a lossless compatibility source and are not silently migrated.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Prove the stress, isolation, documentation, and build gates across all stories.

- [X] T043 [P] Add 100-iteration rapid edit/start/recompile/trigger and stop/recompile/project-replacement stale-work stress cases for SC-003/SC-004 in `packages/blue-app/src/renderer/tests/blue-live-trigger-controller.test.ts`
- [X] T044 [P] Add concurrent realtime/Blue Live command and output isolation coverage for SC-007 in `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts` and `packages/blue-app/src/renderer/tests/blue-live-hardware-parity.test.ts`
- [X] T045 Update the Phase 0 delivery decision to cross-reference Spec 065 and record Manual Trigger now versus audible Repeat later in `BLUE_LIVE_FEATURE_PLAN.md`, then record deterministic manual results under a validation-results section in `specs/065-blue-live-parity/quickstart.md`
- [X] T046 Run `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/data build`, `pnpm --filter @blue/app build`, and `git diff --check`, and resolve every failure against `specs/065-blue-live-parity/spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Starts immediately.
- **Phase 2 Foundational**: Depends on fixture/harness setup and blocks Manual Trigger because canonical copies must be safe first.
- **Phase 3 User Story 1**: Depends on Phase 2 and delivers the audible native-object demonstration.
- **Phase 4 User Story 2**: Can start its patch/lifecycle tests after Phase 2; tasks T029-T030 integrate with the controller/session from User Story 1. User Stories 1 and 2 together are the releasable P1 baseline.
- **Phase 5 User Story 3**: Runtime traversal/tests can start after Phase 2; main/controller integration depends on User Story 1.
- **Phase 6 User Story 4**: Data preservation work can start after Phase 2; its `LiveSpaceTab.tsx` task should follow User Story 1’s UI edit to avoid overlap.
- **Phase 7 Polish**: Depends on all selected user stories.

### User Story Dependency Graph

```text
Setup
  └─> Foundational deep copy + contracts
        ├─> US1 Manual Trigger ─────┬─> US2 fence integration
        │                          └─> US3 runtime integration
        ├─> US2 patch/lifecycle foundation
        ├─> US3 runtime traversal/tests
        └─> US4 XML/saved-set preservation

US1 + US2 + US3 + US4
  └─> Cross-cutting stress/build validation
```

### Within Each User Story

- Write the specified failing regression/contract tests before changing behavior.
- Complete data/contract models before controller or UI integration.
- Keep the main process canonical and revalidate origin after every asynchronous boundary.
- Complete focused tests before moving to the next checkpoint.

## Parallel Opportunities

- T001 and T002 can run in parallel.
- After T003 defines the failure boundary, T004 and T005 can run in parallel; T006 then integrates both copy domains.
- T009-T012 are independent failing tests for data, contract, engine, and UI boundaries.
- T020-T024 are independent P1 safety regression suites.
- T031-T033 split runtime behavior across data traversal, generation, and controller orchestration.
- T037-T039 split legacy preservation across data XML, saved-set semantics, and UI.
- After Phase 2, US2 patch/lifecycle work, US3 runtime traversal, and US4 preservation can proceed alongside the core US1 implementation where their files do not overlap.
- T043 and T044 can run in parallel before final validation.

## Parallel Example: User Story 1

```text
Task T009: Pure target/generation/scaling regressions in blue-live-trigger.test.ts
Task T010: Shared request/result contract regressions in blue-live-contract.test.ts
Task T011: Engine submission/session regressions in blue-live-engine.test.ts
Task T012: Live Space interaction regressions in blue-live-panels.test.tsx
```

## Parallel Example: User Story 2

```text
Task T020: Toolbar acknowledgement ordering
Task T021: Project-store commit/error behavior
Task T022: No-op patch semantics
Task T023: Trigger controller stale fences
Task T024: Project replacement lifecycle
```

## Parallel Example: User Story 3

```text
Task T031: Live Space runtime detection/on-load traversal
Task T032: Data-layer async generation and atomic failure
Task T033: Main controller runtime acquisition and stale completion
```

## Parallel Example: User Story 4

```text
Task T037: Java-compatible XML round-trip
Task T038: Saved-set missing-reference and no-op semantics
Task T039: Deferred Repeat and non-triggering saved-set UI
```

## Implementation Strategy

### Demonstration MVP

1. Complete Setup and Foundational phases.
2. Complete User Story 1.
3. Demonstrate selected-cell and enabled-batch Trigger for deterministic native LiveObjects.
4. Do not release this slice by itself; it does not yet close stale-edit/session hazards.

### Releasable MVP

1. Complete Setup and Foundational phases.
2. Complete User Story 1.
3. Complete User Story 2.
4. Run the P1 quickstart scenarios and stress tests.
5. Release only after latest-edit, no-op revision, session fence, and project-replacement tests pass.

### Incremental Completion

1. Add User Story 3 for generative/runtime-backed project parity.
2. Add User Story 4 for the complete legacy preservation boundary and deferred-Repeat communication.
3. Run cross-cutting validation.
4. Use the finished parity adapter as the regression oracle for the separate future launcher feature.

## Notes

- Whole-project copies preserve `LiveObject.uniqueId`; user-facing duplicate identity is outside this feature.
- Prepared event batches are disposable and uncached.
- A busy response is deliberate backpressure; this feature does not queue or quantize manual triggers.
- `enabled` is persistent authoring state, never authoritative playing state.
- Audible Repeat, key/MIDI LiveObject execution, tracks, scenes, loops, stop slots, and performance capture remain out of scope.

---

## Phase 8: Convergence

**Purpose**: Close the implementation and verification gaps found by the post-implementation Spec Kit review.

- [X] T047 CRITICAL Add regressions and make the explicit project patch acknowledgement barrier drain in-flight and newly queued patches while propagating every commit failure before Start, Recompile, or Trigger per FR-011 and SC-003 (contradicts) in `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/renderer/tests/project-store.test.ts`, `packages/blue-app/src/renderer/tests/blue-live-toolbar.test.tsx`, and `packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx`
- [X] T048 CRITICAL Add lifecycle regressions and make project replacement close the trigger gate, cancel or fence asynchronous startup, and await starting/running/stopping Blue Live cleanup before installing a replacement per FR-013, FR-014, and SC-004 (contradicts) in `packages/blue-app/src/main/blue-live-engine.ts`, `packages/blue-app/src/main/blue-live-trigger-controller.ts`, `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/renderer/tests/blue-live-engine.test.ts`, `packages/blue-app/src/renderer/tests/blue-live-trigger-controller.test.ts`, and `packages/blue-app/src/renderer/tests/blue-live-project-lifecycle.test.ts`
- [X] T049 Return benign `empty` without an engine call for populated targets that generate zero notes, and map missing selected targets to the contractually required rejected result per US1/AC5 and FR-016 (partial) in `packages/blue-data/src/live/blue-live-trigger.ts`, `packages/blue-data/src/live/blue-live-trigger.test.ts`, `packages/blue-app/src/main/blue-live-trigger-controller.ts`, and `packages/blue-app/src/renderer/tests/blue-live-trigger-controller.test.ts`
- [X] T050 Recursively remap copied `Instance` references across copied library, Live Space, and Score SoundObject graphs and add nested/library isolation regressions per FR-007 and FR-008 (partial) in `packages/blue-data/src/blue-data.ts` and `packages/blue-data/src/blue-data-deep-copy.test.ts`
- [X] T051 Consume `ProjectDocumentCommitReceipt.changed`, reconcile renderer dirty state after semantic no-ops, and make invalid saved-set/bin operations true no-ops per FR-015 (partial) in `packages/blue-app/src/renderer/stores/project-store.ts`, `packages/blue-app/src/shared/project-editor.ts`, `packages/blue-data/src/live/live-object-bins.ts`, `packages/blue-data/src/live/live-object-set-list.ts`, `packages/blue-app/src/renderer/tests/project-store.test.ts`, and `packages/blue-app/src/renderer/tests/blue-live-contract.test.ts`
- [X] T052 Use one request-local `CompileData`, recursively process runtime-backed LiveObject graphs, acquire the current host runtime when needed, and add exact fake-runtime success/failure coverage per FR-005, FR-009, and SC-005 (partial) in `packages/blue-data/src/live/blue-live-trigger.ts`, `packages/blue-data/src/blue-data.ts`, `packages/blue-data/src/live/blue-live-trigger.test.ts`, `packages/blue-data/src/blue-data-python-processor-runtime.test.ts`, `packages/blue-data/src/live-data.test.ts`, `packages/blue-app/src/main/blue-live-trigger-controller.ts`, and `packages/blue-app/src/renderer/tests/blue-live-trigger-controller.test.ts`
- [X] T053 Scope Command/Ctrl+T and Command/Ctrl+Shift+T to the active Live Space surface without intercepting editable controls per FR-004 and the Keyboard/UI contract (partial) in `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx` and `packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx`
- [X] T054 Replace permissive stale/runtime/stress/XML assertions with deterministic forbidden-outcome checks, add the missing lifecycle suite, and correct validation claims so checked evidence proves FR-023 and SC-003 through SC-007 (partial) in `packages/blue-app/src/renderer/tests/blue-live-trigger-controller.test.ts`, `packages/blue-app/src/renderer/tests/blue-live-project-lifecycle.test.ts`, `packages/blue-data/src/live/blue-live-trigger.test.ts`, `packages/blue-data/src/live-data.test.ts`, `packages/blue-data/src/live/live-object-bins.test.ts`, and `specs/065-blue-live-parity/quickstart.md`

---

## Phase 9: Java Cell Menu and Shared Clipboard Parity

**Purpose**: Replace the non-Java structural controls with the cell-relative menu and restore Java's cross-editor ScoreObject and BSB Instrument buffer workflows.

### Verification

- [X] T055 [P] [US5] Add failing renderer tests for exact context-menu order/grouping, occupied/empty/minimum-grid enablement, clicked-cell targeting, Java-live Add submenu entries, and absence of the six structural buttons in `packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx`
- [X] T056 [P] [US5] Add failing shared-contract tests for populated-cell XML/timing metadata, canonical `setCell` add/replace/remove validation, fresh identity, beat-zero paste, no-op rejection, and XML round-trip in `packages/blue-app/src/renderer/tests/blue-live-contract.test.ts`
- [X] T057 [P] [US6] Add failing cross-surface clipboard tests proving Score-to-Live and Live-to-Score compatibility, multi/unsupported buffer rejection, repeated-paste independence, and BSB widget-buffer isolation in `packages/blue-app/src/renderer/tests/score-clipboard.test.ts` and `packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx`
- [X] T058 [P] [US6] Add failing unified-library tests for clipboard object-type metadata and exact BlueSynthBuilder-to-Sound transfer, including automation flattening, snapped insertion, non-BSB rejection, stale-target rejection, and incompatible layer rejection in `packages/blue-app/src/main/unified-library/project-transfer.test.ts` and `packages/blue-app/src/renderer/tests/score-library-drop.test.tsx`

### Implementation

- [X] T059 [US5] Extend the Blue Live snapshot and canonical patch with serialized SoundObject metadata and validated nullable `setCell` mutation while preserving column-major structure and no-op semantics in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/renderer/stores/project-store.ts`
- [X] T060 [US5] Remove the bottom structural controls and implement the Java-ordered Radix cell context menu, live-eligible Add submenu, cell-relative structural commands, and shared ScoreObject Cut/Copy/Paste in `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`
- [X] T061 [US6] Add concrete object-type metadata to the shared unified-library clipboard, introduce the exact BSB-to-Score transfer target, deep-copy/flatten the BSB into a Sound, and wire Paste BSB As Sound in `packages/blue-app/src/shared/unified-library.ts`, `packages/blue-app/src/main/unified-library/project-adapter.ts`, `packages/blue-app/src/main/unified-library/service.ts`, `packages/blue-app/src/renderer/stores/library-store.ts`, and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`
- [X] T062 Run focused Blue Live/Score/unified-library tests, full `@blue/data` and `@blue/app` tests, both package builds, and `git diff --check`; record deterministic results for SC-009 and SC-010 in `specs/065-blue-live-parity/quickstart.md`

---

## Phase 10: User Story 7 — Edit a Selected Live SoundObject

**Goal**: Match Java's shared SoundObject lookup behavior so selecting a populated Live cell activates its type-specific editor and populates editable ScoreObject Properties.

**Independent Test**: Select populated and empty cells, edit shared and type-specific fields, structurally move and remove the selected LiveObject, and verify identity-safe canonical routing.

- [X] T063 [P] [US7] Add failing shared-contract tests for Blue Live editor-document creation, shared/type-specific mutation, identity resolution after row/column changes, and removed/replaced target rejection in `packages/blue-app/src/renderer/tests/blue-live-contract.test.ts`
- [X] T064 [P] [US7] Add failing renderer tests for populated-cell shared selection, ScoreObject Editor activation, empty-cell clearing, and Properties-compatible target publication in `packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx`
- [X] T065 [US7] Add the typed Blue Live editor target, canonical identity resolver, and existing Score patch/editor-document reuse in `packages/blue-app/src/shared/project-editor.ts`; wire Live Space selection and editor activation in `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`
- [X] T066 Run focused Blue Live editor/Properties tests, full `@blue/app` tests, `@blue/app` build, and `git diff --check`; record SC-011 results in `specs/065-blue-live-parity/quickstart.md`

---

## Phase 11: Final Convergence

**Purpose**: Close the final command-barrier and verification gaps found by the completion review.

- [X] T067 CRITICAL Restrict the pending-patch acknowledgement barrier to Blue Live Start/Recompile so Stop remains immediately available after a commit failure, and add deterministic wait-order, rejection-abort, and stop-bypass coverage in `packages/blue-app/src/renderer/components/menu-bar/ToolbarBlueLive.tsx` and `packages/blue-app/src/renderer/tests/blue-live-toolbar.test.tsx`
- [X] T068 Add deterministic Trigger coverage proving the command waits for pending-patch acknowledgement and aborts after a rejected barrier per FR-011 in `packages/blue-app/src/renderer/tests/blue-live-panels.test.tsx`
