# Tasks: Validated Cleanup Second Batch

**Input**: Design documents from `specs/099-cleanup-second-batch/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/simplification-compatibility.md`, and `quickstart.md`

**Status**: Complete — T001 through T029 are implemented and the final convergence audit found no remaining gaps.

**Organization**: Tasks are grouped by user story. The implementation stays in four reviewable slices: dead maintenance surface, renderer-store pruning, standard-runtime substitutions, and import guidance/closure.

**Execution rule**: Run commands from the repository root. Keep ambiguous or active consumers retained and record them as deferred; do not migrate a consumer only to make a deletion possible.

## Phase 1: Setup (Shared Baseline)

**Purpose**: Establish the supported commands and consumer evidence before changing the cleanup surface.

- [x] T001 [P] Establish the pre-change test, build, lint, and verification baseline from `specs/099-cleanup-second-batch/quickstart.md`, `package.json`, `packages/blue-app/package.json`, and `packages/blue-engine-client/package.json`; record existing failures without modifying source files.
- [x] T002 [P] Run the deletion-gate inventory for every candidate in `specs/099-cleanup-second-batch/contracts/simplification-compatibility.md` across `packages/`, `scripts/`, `native/`, `README.md`, `package.json`, `.github/`, and current documentation; classify each candidate as zero-consumer, active, or ambiguous.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lock the compatibility, state-ownership, boundary, and protection constraints required by all stories.

- [x] T003 [P] Run the pre-change focused renderer, OSC, snapshot, BlueX7, and engine-client checks listed in `specs/099-cleanup-second-batch/quickstart.md` so later failures can be attributed to this batch.
- [x] T004 [P] Confirm that the change introduces no persistence or host-boundary change by reviewing `specs/099-cleanup-second-batch/data-model.md`, `specs/099-cleanup-second-batch/contracts/simplification-compatibility.md`, `packages/blue-app/src/shared/project-editor.ts`, `packages/blue-engine-client/src/`, and `packages/blue-data/src/`; keep `.blue` ownership, IPC contracts, engine protocol, and the portable data core unchanged.
- [x] T005 [P] Capture the protected asset baseline by checking `packages/blue-app/src/renderer/assets/blue-x7/algorithm-images.ts`, `packages/blue-app/src/renderer/tests/blue-x7-algorithms.test.tsx`, `scripts/verify-blue-x7-java-resources.mjs`, `AGENTS.md`, and application source for existing `import.meta.glob` usage.

**Checkpoint**: Baseline evidence and scope boundaries are established; user-story work can proceed independently.

## Phase 3: User Story 1 - Remove Confirmed Dead Maintenance Surface (Priority: P1) - MVP

**Goal**: Remove only verified zero-consumer files and renderer-store members while preserving active store state, engine-client contracts, and supported workflows.

**Independent Test**: The deletion/protection gate finds no stale references to removed surfaces, protected files and retained state remain present, focused renderer-store tests pass, and the engine-client package still tests and builds.

### Verification for User Story 1

- [x] T006 [US1] Re-run the final consumer gate from `specs/099-cleanup-second-batch/quickstart.md` immediately before deletion, using `specs/099-cleanup-second-batch/contracts/simplification-compatibility.md` to defer any active or ambiguous candidate instead of migrating its consumer.

### Implementation for User Story 1

- [x] T007 [P] [US1] Delete the confirmed dead maintenance files `scripts/engine-realtime-automation-benchmark.mjs`, `packages/blue-engine-client/src/automation-errors.ts`, `vitest.workspace.ts`, and `packages/blue-app/src/renderer/stores/library-routing.ts`; remove only the related stale native comment in `native/blue-engine/src/automation/AutomationErrors.h` and README tree entry in `README.md`.
- [x] T008 [P] [US1] Remove `focusPanel` and `isPanelOpen` from `packages/blue-app/src/renderer/stores/workbench-store.ts` and retarget `packages/blue-app/src/renderer/tests/workbench-mixer-panel.test.tsx` to prove active-panel behavior without the dead members.
- [x] T009 [P] [US1] Remove `closeTab` and `setTabColor` from `packages/blue-app/src/renderer/stores/output-store.ts`, retarget `packages/blue-app/src/renderer/tests/output-store.test.ts`, and preserve `colorOverrides` consumers.
- [x] T010 [P] [US1] Remove `getRecentFiles`, `setEnginePath`, `setWindowBounds`, `setMidiInputDevice`, `setMidiOutputDevice`, `setOscInputPort`, `setOscOutputPort`, and `setOscOutputHost` from `packages/blue-app/src/renderer/stores/settings-store.ts`; retarget `packages/blue-app/src/renderer/tests/settings-store.test.tsx` while preserving synchronized legacy settings fields.
- [x] T011 [P] [US1] Remove `isSelected`, `getSelectedVisibleLayers`, `getOperationAvailability`, and `getRemovalPlan` from `packages/blue-app/src/renderer/stores/layer-selection-store.ts`; retarget `packages/blue-app/src/renderer/tests/layer-selection-store.test.ts` and `packages/blue-app/src/renderer/tests/score-layer-operations.test.tsx` while preserving `getSelectedRanges`.
- [x] T012 [P] [US1] Remove `mode`, `activeLayerId`, `activeParameterId`, `setMode`, `setActiveParameter`, and the test-only `clearAutomationState` teardown path from `packages/blue-app/src/renderer/stores/score-automation-store.ts`; retarget `packages/blue-app/src/renderer/tests/score-timeline-automation-multi-line.test.tsx` while preserving range/point selection and preview state.
- [x] T013 [P] [US1] Remove `selectedLayer`, `zoom`, `selectLayer`, and `setZoom` from `packages/blue-app/src/renderer/stores/ui-store.ts`; retarget `packages/blue-app/src/renderer/tests/app.test.ts` and any current canvas-selection assertions while preserving active-panel state.
- [x] T014 [P] [US1] Remove `beginDraftFromSaved`, `resetDraftToSaved`, `savedMidiInput`, and exported `defaultRuntimeDevices` from `packages/blue-app/src/renderer/stores/midi-input-store.ts`; retarget `packages/blue-app/src/renderer/tests/midi-settings.test.tsx` and `packages/blue-app/src/renderer/tests/midi-input-lifecycle.test.tsx` while preserving draft, dirty-state, snapshot, and runtime-device editing behavior.

### User Story 1 Completion

- [x] T015 [US1] Run the post-cleanup deletion/protection checks in `specs/099-cleanup-second-batch/quickstart.md`, then run the focused renderer-store suite in `packages/blue-app/src/renderer/tests/` plus `pnpm --filter @blue/engine-client test` and `pnpm --filter @blue/engine-client build`; confirm public engine-client exports and native diagnostics remain intact.

**Checkpoint**: User Story 1 is independently functional and supplies the MVP cleanup increment.

## Phase 4: User Story 2 - Prefer Existing Platform Facilities (Priority: P2)

**Goal**: Replace duplicate OSC option scanning and renderer snapshot cloning with Node/Electron runtime facilities while retaining the existing domain validation and copy contract.

**Independent Test**: OSC subprocess coverage passes for every supported success and failure mode, and renderer snapshot tests prove structural equality and nested copy independence.

### Verification for User Story 2

- [x] T016 [P] [US2] Add or strengthen subprocess regression coverage in `packages/blue-app/src/shared/send-osc-script.test.ts` for help, listing, literal `--`, defaults, command/address selection, `--port=9000`, invalid options and values, no-send failures, help text, and exit status.
- [x] T017 [P] [US2] Add or strengthen snapshot-copy regression coverage in `packages/blue-app/src/renderer/tests/project-store.test.ts` and `packages/blue-app/src/renderer/tests/bsb-interface-snapshot.test.ts` for primitives, `undefined`, nested records, arrays, structural equality, and independent nested mutation.

### Implementation for User Story 2

- [x] T018 [US2] Replace the hand-written argument scanner in `packages/blue-app/scripts/send-osc.mjs` with `node:util.parseArgs`; normalize package-manager `--` tokens and retain existing defaults, port/domain validation, command lookup, address rules, help/list behavior, send behavior, and failure exit semantics.
- [x] T019 [P] [US2] Replace the renderer-local `cloneSnapshotValue` implementation in `packages/blue-app/src/renderer/stores/project-store.ts` with `structuredClone` without changing the declared project-editor snapshot shape or the shared `cloneBsbSnapshotValue` helper.
- [x] T020 [P] [US2] Replace the renderer-local `cloneSnapshotValue` implementation in `packages/blue-app/src/renderer/stores/project-store/bsb-interface-snapshot.ts` with `structuredClone`; keep unsupported non-serializable values failing through the native clone boundary.

### User Story 2 Completion

- [x] T021 [US2] Run the focused OSC and snapshot commands from `specs/099-cleanup-second-batch/quickstart.md`, inspect `packages/blue-app/src/shared/project-editor.ts` to confirm the shared clone helper is unchanged, and verify no malformed OSC input reaches a network send.

**Checkpoint**: User Story 2 is independently functional with standard runtime facilities owning only generic parsing and cloning.

## Phase 5: User Story 3 - Keep Asset Membership Explicit (Priority: P3)

**Goal**: Make the explicit-import policy durable while keeping the fixed 32-entry BlueX7 manifest and protected application surfaces unchanged.

**Independent Test**: `AGENTS.md` states the explicit-import default and exception gate, application source has no glob imports, and BlueX7/resource/protected UI checks pass.

### Verification and Implementation for User Story 3

- [x] T022 [US3] Add import-discipline guidance to `AGENTS.md`: fixed application-owned asset and module sets use explicit static imports; `import.meta.glob` requires an explicit feature specification for automatic discovery and deterministic missing, duplicate, malformed, unexpected-member, and naming validation.
- [x] T023 [US3] Audit `packages/blue-app/` for `import.meta.glob`, verify the unchanged 32-entry manifest in `packages/blue-app/src/renderer/assets/blue-x7/algorithm-images.ts`, and confirm the completeness test in `packages/blue-app/src/renderer/tests/blue-x7-algorithms.test.tsx` plus `GeneratorRegistry` in `packages/blue-data/src/sound-objects/jmask-support.ts` remain protected.
- [x] T024 [US3] Run the protected-surface checks from `specs/099-cleanup-second-batch/quickstart.md`: `packages/blue-app/src/renderer/tests/blue-x7-algorithms.test.tsx`, `packages/blue-app/src/renderer/tests/blue-x7-effective-values.test.tsx`, `scripts/verify-blue-x7-java-resources.test.mjs`, and `packages/blue-app/src/renderer/browser/tree-dnd-coexistence.browser.test.tsx`; confirm `EffectLibraryTree` remains present at `packages/blue-app/src/renderer/components/workbench/panels/effects-library/EffectLibraryTree.tsx`.

**Checkpoint**: User Story 3 is independently verifiable and does not convert the protected BlueX7 manifest to discovery.

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Validate package boundaries, repository behavior, and the final reviewable slice structure.

- [x] T025 [P] Run the affected package gates from `specs/099-cleanup-second-batch/quickstart.md`: `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:renderer`, and the corresponding engine-client checks in `packages/blue-engine-client/package.json`.
- [x] T026 [P] Run the full repository gates from `specs/099-cleanup-second-batch/quickstart.md` and `package.json`: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm verify`, and `git diff --check`.
- [x] T027 Review the final diff against `specs/099-cleanup-second-batch/spec.md`, `specs/099-cleanup-second-batch/plan.md`, `specs/099-cleanup-second-batch/contracts/simplification-compatibility.md`, and `specs/099-cleanup-second-batch/quickstart.md`; confirm the four slices remain independently revertible and no protected/deferred surface or unrelated file changed.

## Phase 7: Convergence

- [x] T028 Extend `packages/blue-app/src/shared/send-osc-script.test.ts` with custom `--host` dispatch coverage and UDP-receiver assertions that malformed or invalid invocations send no message per FR-008 and SC-002 (partial)
- [x] T029 Align `scripts/verify-blue-x7-java-resources.mjs` and its test with the current explicit 32-entry SVG manifest and available BlueX7 resources, or restore the resources that verifier is intended to protect, without replacing the manifest with discovery per SC-005 and FR-011/FR-012 (partial)

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 have no prerequisites and can run in parallel.
- **Foundational (Phase 2)**: T003, T004, and T005 follow the baseline setup and block all user stories.
- **User Stories (Phases 3-5)**: US1, US2, and US3 can start in parallel after Phase 2 when separate ownership is available; sequential delivery should follow P1 -> P2 -> P3.
- **Polish (Phase 6)**: T025-T027 follow completion of the desired user stories and their focused checks.

### User Story Dependencies

- **US1 (P1)**: T006 must pass before T007-T014; T007-T014 can proceed in parallel because each owns a separate file set; T015 follows all US1 implementation tasks.
- **US2 (P2)**: T016 gates T018; T017 gates T019-T020; T021 follows the parser and clone substitutions.
- **US3 (P3)**: T022 precedes T023; T024 follows the guidance and manifest audit.

### Parallel Opportunities

- **After setup**: T003, T004, and T005 can run in parallel.
- **User Story 1**: T007, T008, T009, T010, T011, T012, T013, and T014 can run in parallel after T006 because their owned files do not overlap.
- **User Story 2**: T016 and T017 can run in parallel; after their regression coverage is established, T019 and T020 can run in parallel while T018 owns the OSC script.
- **User Story 3**: The source/manifest audit in T023 is the only follow-up that touches `AGENTS.md`, so it runs after T022; its protected test commands can run in parallel with one another.
- **Final validation**: T025 and T026 can run in parallel after all story checkpoints; T027 is the final review.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 baseline and Phase 2 boundary/protection checks.
2. Complete T006 and the dead-surface/store tasks T007-T014.
3. Complete T015 and stop for independent MVP validation.
4. Deliver only the confirmed deletion and renderer-store pruning slice if the package and protection checks pass.

### Incremental Delivery

1. Add User Story 1 and validate the cleanup boundary.
2. Add User Story 2 and validate OSC and snapshot compatibility independently.
3. Add User Story 3 and validate explicit imports plus the protected BlueX7 surface.
4. Run Phase 6 repository-wide validation and final diff review.

### Review Slices

1. Dead maintenance deletion and engine-client internal cleanup.
2. Renderer-store zero-consumer member pruning.
3. OSC parser and renderer structured-clone substitutions.
4. Import guidance, asset protection, and repository closure.

## Notes

- Every task uses the required `- [ ] [TaskID] [P?] [Story?]` checklist form.
- `[P]` appears only where the task has separate file ownership and no incomplete dependency on another parallel task.
- The shared `cloneBsbSnapshotValue` helper, explicit BlueX7 image manifest, and all named protected surfaces remain outside the implementation scope.

## Closure

All tasks T001-T029 are complete. The final convergence audit found no remaining requirement,
acceptance, plan, contract, or constitution gaps. Final automated evidence is recorded in
[quickstart.md](quickstart.md); supported-platform packaging remains enforced by the existing CI
workflows.
