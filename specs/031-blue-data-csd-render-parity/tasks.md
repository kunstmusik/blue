# Tasks: Blue Data CSD Render Pipeline Parity

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/031-blue-data-csd-render-parity/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are required by FR-013 and the constitution test-first rule. Add Java-vs-TypeScript fixture comparisons for the high-risk render pipeline cases.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after foundational render scaffolding is complete.

The integration fixture and comparison files named in historical T005/T008 were
removed on 2026-09-24 with tests that read developer-local projects. Current
self-contained CSD helpers live under `packages/blue-data/src/test-support/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story the task serves
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Context)

**Purpose**: Confirm Java render anchors and current TypeScript render gaps before implementation.

- [X] T001 Review Java CSDRender/CompileData anchors in `/Users/stevenyi/work/blue-electron/specs/031-blue-data-csd-render-parity/research.md`
- [X] T002 [P] Inventory current `BlueData.toCSD()` and render flow in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T003 [P] Inventory current compile-time bookkeeping gaps in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/compile-data.ts`
- [X] T004 [P] Inventory arrangement/mixer/audio render integration points in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/arrangement.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/mixer/`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/audio/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared fixture infrastructure and baseline compile-context coverage used by all stories.

**Critical**: No user story work should begin until this phase is complete.

### Tests

- [X] T005 [P] Add CSD fixture harness and normalization helpers in `/Users/stevenyi/work/blue-electron/packages/blue-data/tests/integration/csd-render-fixtures.ts`
- [X] T006 [P] Add baseline compile-context tests for source ids/channels/tables in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/compile-data.test.ts`
- [X] T007 [P] Add baseline copy-safety tests for render generation in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-copy-safety.test.ts`

### Implementation

- [X] T008 Add shared CSD comparison utility for fixture assertions in `/Users/stevenyi/work/blue-electron/packages/blue-data/tests/integration/csd-comparison.ts`
- [X] T009 Add render-request snapshot helper for copy-safe pipeline entry in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T010 Wire foundational fixture helpers into dedicated CSD parity tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-parity.test.ts`

**Checkpoint**: Fixture and compile-context scaffolding are ready for parity implementation.

---

## Phase 3: User Story 1 - Generate CSD That Matches Java Blue (Priority: P1) MVP

**Goal**: Restore Java-compatible core render pipeline structure and output behavior for CSD generation.

**Independent Test**: Generate CSD from representative arrangement/tables/global-orc-sco/UDO fixtures and compare Java vs TypeScript semantic output.

### Tests for User Story 1

- [X] T011 [P] [US1] Add arrangement+global orchestra/score fixture parity tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-parity.test.ts`
- [X] T012 [P] [US1] Add render start/end boundary and duration-macro fixture tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-parity.test.ts`
- [X] T013 [P] [US1] Add UDO collision-rename and table numbering fixture tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-parity.test.ts`

### Implementation for User Story 1

- [X] T014 [US1] Refactor `BlueData.toCSD()` to follow Java CSDRender pipeline stages in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T015 [US1] Restore Java-compatible UDO merge and collision renaming behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/opcodes/udo-utilities.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T016 [US1] Restore Java-compatible table allocation and ftgen numbering behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/tables.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T017 [US1] Restore arrangement global-score generation and command-block preprocessing flow in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/arrangement.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/global-orc-sco.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T018 [US1] Restore tempo-map output and render-end handling parity in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/time/tempo-map.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T019 [US1] Restore global score macro substitution for total duration/render start in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/global-orc-sco.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`

**Checkpoint**: Core CSD pipeline output is independently testable against Java fixtures.

---

## Phase 4: User Story 2 - Preserve Compile-Time Context and Automation Behavior (Priority: P1)

**Goal**: Restore Java-compatible compile context bookkeeping, automation output, and scheduling ids.

**Independent Test**: Generate CSD from automation-heavy and always-on/audio-layer fixtures and compare compile-time ids/macros/output with Java.

### Tests for User Story 2

- [X] T020 [P] [US2] Add compile-data source-id/open-ftable/string-channel parity tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/compile-data.test.ts`
- [X] T021 [P] [US2] Add parameter-automation fixture parity tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-automation.test.ts`
- [X] T022 [P] [US2] Add always-on and audio-layer instrument id parity tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-scheduling.test.ts`

### Implementation for User Story 2

- [X] T023 [US2] Complete `CompileData` bookkeeping for source ids, channels, open ftable numbers, and original parameters in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/compile-data.ts`
- [X] T024 [US2] Wire compile-data context through render orchestration entry points in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/arrangement.ts`
- [X] T025 [US2] Restore Java-compatible automation handling for the API render path (deterministic init/export parity without extra automation score events) in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/automation/parameter-helper.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T026 [US2] Restore always-on instrument scheduling with Java-compatible source-id behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/arrangement.ts`
- [X] T027 [US2] Replace audio-layer placeholder ids with compile-time ids in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/audio/audio-layer.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/audio/playback-instrument-orc.ts`

**Checkpoint**: Compile context and automation behavior match Java for representative fixtures.

---

## Phase 5: User Story 3 - Render From Safe Copies Instead of Live Mutable State (Priority: P2)

**Goal**: Ensure deterministic, copy-safe render generation with stable compile bookkeeping.

**Independent Test**: Re-run render generation while mutating source objects and verify generated CSD stability plus no live-state mutation.

### Tests for User Story 3

- [X] T028 [P] [US3] Add repeated-run no-mutation tests for `toCSD()` in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-copy-safety.test.ts`
- [X] T029 [P] [US3] Add deterministic source-id and ftable ordering tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-determinism.test.ts`
- [X] T030 [P] [US3] Add compile-context reset/isolation tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/compile-data.test.ts`

### Implementation for User Story 3

- [X] T031 [US3] Ensure render pipeline runs from copied project snapshots in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T032 [US3] Isolate `CompileData` lifecycle per render invocation in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/compile-data.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data.ts`
- [X] T033 [US3] Route arrangement/mixer/global render stages to snapshot state only in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/arrangement.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/mixer/mixer.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/global-orc-sco.ts`
- [X] T034 [US3] Stabilize deterministic compile-time numbering/order across runs in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/compile-data.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/tables.ts`

**Checkpoint**: Render generation is deterministic and does not mutate live project state.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and handoff updates after implementation.

- [X] T035 [P] Update fixture validation notes and normalization rules in `/Users/stevenyi/work/blue-electron/specs/031-blue-data-csd-render-parity/quickstart.md`
- [X] T036 [P] Update handoff notes and validation outcomes in `/Users/stevenyi/work/blue-electron/STATUS.md`
- [X] T037 Run `pnpm --filter @blue/data test` from `/Users/stevenyi/work/blue-electron`
- [X] T038 Run `git diff --check` from `/Users/stevenyi/work/blue-electron`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; this is the MVP for render parity.
- **User Story 2 (Phase 4)**: Depends on US1 core pipeline behavior so compile-context parity is validated on final render stages.
- **User Story 3 (Phase 5)**: Depends on US1 and US2 so copy-safety and determinism are validated on completed pipeline semantics.
- **Polish (Phase 6)**: Depends on selected stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundational.
- **US2 (P1)**: Depends on US1.
- **US3 (P2)**: Depends on US1 and US2.

### Parallel Opportunities

- Setup inventory tasks T002-T004 can run in parallel.
- Foundational tests T005-T007 can run in parallel.
- US1 tests T011-T013 can run in parallel.
- US2 tests T020-T022 can run in parallel.
- US3 tests T028-T030 can run in parallel.
- Polish documentation tasks T035 and T036 can run in parallel.

## Parallel Example: User Story 1

```text
Task: "Add arrangement/global-orchestra fixture parity tests in packages/blue-data/src/blue-data-csd-parity.test.ts"
Task: "Add render boundary and duration-macro fixture tests in packages/blue-data/src/blue-data-csd-parity.test.ts"
Task: "Add UDO collision and table numbering fixture tests in packages/blue-data/src/blue-data-csd-parity.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "Add compile-data source-id and channel parity tests in packages/blue-data/src/compile-data.test.ts"
Task: "Add automation fixture parity tests in packages/blue-data/src/blue-data-csd-automation.test.ts"
Task: "Add always-on/audio-layer scheduling parity tests in packages/blue-data/src/blue-data-csd-scheduling.test.ts"
```

## Parallel Example: User Story 3

```text
Task: "Add repeated-run no-mutation tests in packages/blue-data/src/blue-data-csd-copy-safety.test.ts"
Task: "Add deterministic numbering tests in packages/blue-data/src/blue-data-csd-determinism.test.ts"
Task: "Add compile-context reset isolation tests in packages/blue-data/src/compile-data.test.ts"
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete User Story 1 only.
3. Validate fixture-level CSD parity for arrangement/global/table/UDO and render boundaries.
4. Stop and review before expanding to compile-context and copy-safety behavior.

### Incremental Delivery

1. Restore Java-compatible core render pipeline structure and output.
2. Restore compile-context bookkeeping plus automation and scheduling parity.
3. Enforce copy-safe deterministic rendering across repeated runs.
4. Re-run full `@blue/data` validation and publish handoff notes.

### Handoff Notes

- Keep this slice focused on `@blue/data` render generation and compile context.
- Renderer/Electron menu behavior remains out of scope for this spec.
- Use Java CSDRender/CompileData behavior as the parity source of truth when TypeScript differs.
- **Java vs TS string-channel divergence (T031)**: Java sets `channelName` on the original arrangement's `StringChannel` objects before cloning; the `StringChannel` copy constructor preserves `channelName`. Our BSB copy constructor XML-round-trips (`loadFromXML(saveAsXML())`), which loses `channelName`. Instead, we call `collectStringChannels(clonedArrangement)` on the cloned arrangement after cloning. Both produce equivalent output. This is documented for parity awareness.
