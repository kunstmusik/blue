# Tasks: Note Processor Parity

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/048-note-processor-parity/`
**Prerequisites**: plan.md, spec.md, audit.md, research.md, data-model.md, contracts/

**Tests**: Tests are required by FR-016, FR-017, FR-018, and the constitution's serialization rule. Write or update the relevant tests before implementation in each phase.

**Organization**: Tasks are grouped by user story so processor catalog parity, score-object editing, scoped chain editing, and verification coverage can be implemented and validated incrementally.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm source anchors and establish shared test fixture locations.

- [x] T001 Review Java source anchors and local audit findings in `/Users/stevenyi/work/blue-electron/specs/048-note-processor-parity/audit.md`
- [x] T002 [P] Inventory current processor exports, registry entries, and helper classes in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/`
- [x] T003 [P] Inventory current score-object, layer, group, and root chain application points in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/score.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/`
- [x] T004 [P] Inventory current chain UI and patch paths in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/ScoreObjectPropertiesForm.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared processor catalog, snapshot, reification, and target contracts used by all stories.

**Critical**: No user story implementation should begin until this phase is complete.

### Tests

- [x] T005 [P] Add processor catalog tests for the 16 in-scope processors, Java plugin ordering, and exclusion of `Code`/addable Python in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-catalog.test.ts`
- [x] T006 [P] Add chain snapshot and reification tests for supported, deferred, unsupported, and legacy Code XML entries in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-snapshot.test.ts`
- [x] T007 [P] Add PythonProcessor preservation-only load/save tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/deferred-python-processor.test.ts`
- [x] T008 [P] Add scoped note-processor target contract tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/note-processor-chain-target.test.ts`

### Implementation

- [x] T009 Create centralized in-scope processor metadata and default constructors in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-catalog.ts`
- [x] T010 Create chain snapshot, parameter extraction, and chain reification helpers in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-snapshot.ts`
- [x] T011 Update processor loading to use catalog metadata, preserve PythonProcessor as deferred, and treat legacy `blue.noteProcessor.Code` as preserved unsupported XML in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-chain.ts`
- [x] T012 Update unsupported/deferred processor display and XML-preservation behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/unsupported-processor.ts`
- [x] T013 Update public exports for catalog and snapshot helpers in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/index.ts`
- [x] T014 Extend shared app note-processor snapshot and scoped target types in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T015 Update renderer project-store patch normalization and local score snapshot application for scoped chain patches in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/project-store.ts`

**Checkpoint**: Processor metadata, snapshots, reification, and scoped target contracts are available for all UI and render work.

---

## Phase 3: User Story 1 - Preserve and Execute In-Scope Java Processor Types (Priority: P1) MVP

**Goal**: Make the 16 non-Python Java Blue note processor types first-class, editable, serializable, and executable with Java-compatible behavior while preserving PythonProcessor as deferred XML.

**Independent Test**: Load or create a chain containing each in-scope processor type, edit values, process representative notes, save and reload, and confirm PythonProcessor XML is preserved and labeled deferred.

### Tests for User Story 1

- [x] T016 [P] [US1] Add arithmetic and pch processor parity tests for Add, Multiply, PchAdd, Inversion, and PchInversion in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-parity.test.ts`
- [x] T017 [P] [US1] Add selection, ordering, and switch processor parity tests for SubList, Rotate, Retrograde, Equals, and Switch in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-selection-ordering-parity.test.ts`
- [x] T018 [P] [US1] Add random processor parity tests for seeded and unseeded RandomAdd and RandomMultiply behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-random-parity.test.ts`
- [x] T019 [P] [US1] Add line/time/tuning processor parity tests for LineAdd, LineMultiply, TimeWarp, and Tuning in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-line-time-tuning-parity.test.ts`
- [x] T020 [P] [US1] Add XML serialization matrix tests for all 16 in-scope processors and deferred PythonProcessor preservation in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-serialization-parity.test.ts`
- [x] T021 [P] [US1] Add invalid-parameter failure tests matching Java behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-error-parity.test.ts`

### Implementation for User Story 1

- [x] T022 [US1] Align Add, Multiply, PchAdd, Inversion, and PchInversion processing and XML behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/add-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/multiply-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/pch-add-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/inversion-processor.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/pch-inversion-processor.ts`
- [x] T023 [US1] Align SubList, Rotate, Retrograde, Equals, and Switch processing and XML behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/sublist-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/rotate-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/retrograde-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/equals-processor.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/switch-processor.ts`
- [x] T024 [US1] Align RandomAdd and RandomMultiply seeded/unseeded processing and XML behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/random-add-processor.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/random-multiply-processor.ts`
- [x] T025 [US1] Align LineAdd, LineMultiply, TimeWarp, Tuning, and ValueTimeMapper helper behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/line-add-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/line-multiply-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/time-warp-processor.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/tuning-processor.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/value-time-mapper.ts`
- [x] T026 [US1] Remove `Code` from the addable processor registry while preserving legacy `blue.noteProcessor.Code` XML in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/code.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/note-processor-chain.ts`
- [x] T027 [US1] Update README or package docs for in-scope processors and deferred PythonProcessor behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/README.md`

**Checkpoint**: User Story 1 is independently testable through direct processor construction, chain XML round-trip, and note-list processing.

---

## Phase 4: User Story 2 - Edit ScoreObject Processor Chains (Priority: P1)

**Goal**: Replace the read-only ScoreObject Properties chain summary with a Java Blue-style editable chain surface for selected score objects.

**Independent Test**: Select a supported score object, add/edit/reorder/remove processors through ScoreObject Properties, save/reload, and verify generated notes reflect the edited chain.

### Tests for User Story 2

- [x] T028 [P] [US2] Add main/shared document tests for editable processor snapshots on selected score objects in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/score-object-editor-document.test.ts`
- [x] T029 [P] [US2] Add reified non-empty score-object chain replacement tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/score-object-note-processor-chain-patch.test.ts`
- [x] T030 [P] [US2] Add reusable chain editor component tests for add/remove/reorder/clear/cut/copy/paste in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/note-processor-chain-editor.test.tsx`
- [x] T031 [P] [US2] Add processor parameter editor tests for numeric, boolean, string, multiline, and readonly/deferred fields in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/note-processor-parameter-editor.test.tsx`
- [x] T032 [P] [US2] Add ScoreObject Properties integration tests for committing edited object chains in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-object-properties-panel.test.tsx`
- [x] T033 [P] [US2] Add named-chain import/save tests for object-chain editing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/note-processor-named-chain-ui.test.tsx`

### Implementation for User Story 2

- [x] T034 [US2] Populate score-object processor snapshots from `@blue/data` snapshot helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T035 [US2] Implement non-empty score-object chain replacement by reifying snapshots in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T036 [US2] Create reusable chain editor component in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor.tsx`
- [x] T037 [US2] Create processor add menu and row list components (inlined in NoteProcessorChainEditor) in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor.tsx`
- [x] T038 [US2] Create parameter editor components (inlined in NoteProcessorChainEditor) in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor.tsx`
- [x] T039 [US2] Create shared chain dialog wrapper in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/note-processors/NoteProcessorChainDialog.tsx`
- [x] T040 [US2] Integrate the chain editor into ScoreObject Properties in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/ScoreObjectPropertiesForm.tsx`
- [x] T041 [US2] Add named-chain import/save UI wiring in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/note-processors/NoteProcessorNamedChainControls.tsx`
- [x] T042 [US2] Update project-store local patch application for edited object chains in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/project-store.ts`

**Checkpoint**: User Story 2 is independently usable for selected score-object chains without layer/group/root UI.

---

## Phase 5: User Story 3 - Edit Layer, Layer-Group, and Root Chains (Priority: P1)

**Goal**: Add chain edit targets, UI affordances, canonical patches, and render application for sound-object layers, layer groups, and root score.

**Independent Test**: Add processors to an object, its layer, its layer group, and root score; render notes; verify Java-compatible scope order and persistence.

### Tests for User Story 3

- [x] T043 [P] [US3] Add root score chain generation tests proving final merged notes are processed in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/score-note-processor-chain.test.ts`
- [x] T044 [P] [US3] Add object/layer/group/root scope order tests with representative processors in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/note-processor-scope-order.test.ts`
- [x] T045 [P] [US3] Add score snapshot tests for root, layer-group, and layer chain summaries and targets in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/score-note-processor-targets.test.ts`
- [x] T046 [P] [US3] Add main/shared patch tests for sound-layer, layer-group, and root chain replacement in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/scoped-note-processor-chain-patch.test.ts`
- [x] T047 [P] [US3] Add renderer ScorePanel tests for layer `N` button opening the chain dialog instead of alerting in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-panel-note-processor-ui.test.tsx`
- [x] T048 [P] [US3] Add renderer tests for layer-group and root note-processor affordances and non-empty indicators in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-panel-note-processor-scope-ui.test.tsx`

### Implementation for User Story 3

- [x] T049 [US3] Apply the root score note processor chain after layer groups are merged in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/score.ts`
- [x] T050 [US3] Confirm and align layer and layer-group chain application behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/sound-layer.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/poly-object.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/patterns/patterns-layer-group.ts`
- [x] T051 [US3] Add root, layer-group, and sound-layer chain summary fields to score snapshots in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T052 [US3] Add target resolution and canonical mutation for sound-layer, layer-group, and root chain patches in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T053 [US3] Update renderer project store local snapshot updates for scoped chain summaries in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/project-store.ts`
- [x] T054 [US3] Replace the layer `N` alert with chain dialog opening and commit wiring in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- [x] T055 [US3] Add layer-group and root note-processor affordances to the score panel header/sidebar UI in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- [x] T056 [US3] Add non-empty chain visual indicators for object, layer, layer-group, and root scopes in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- [x] T057 [US3] Ensure preload/main project document patch flow accepts scoped chain patches without new unsafe IPC surfaces in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/preload.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`

**Checkpoint**: User Story 3 provides functional layer, layer-group, and root chain editing plus root render application.

---

## Phase 6: User Story 4 - Verify Full Processing and Serialization Coverage (Priority: P2)

**Goal**: Add exhaustive coverage proving every in-scope processor works through all supported scopes and round-trips safely.

**Independent Test**: Run the note-processor parity suite and verify each in-scope processor has direct processing, serialization, object-scope, layer-scope, group-scope, and root-scope coverage.

### Tests for User Story 4

- [x] T058 [P] [US4] Add reusable all-processor fixture factory in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-test-fixtures.ts`
- [x] T059 [P] [US4] Add all-processor object-scope matrix tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-object-scope-matrix.test.ts`
- [x] T060 [P] [US4] Add all-processor sound-layer-scope matrix tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-layer-scope-matrix.test.ts`
- [x] T061 [P] [US4] Add all-processor layer-group-scope matrix tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-layer-group-scope-matrix.test.ts`
- [x] T062 [P] [US4] Add all-processor root-scope matrix tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-root-scope-matrix.test.ts`
- [x] T063 [P] [US4] Add project round-trip test with object, layer, group, root, named chains, deferred PythonProcessor, and unsupported legacy XML in `/Users/stevenyi/work/blue-electron/packages/blue-data/tests/integration/note-processor-chain-roundtrip.test.ts`
- [x] T064 [P] [US4] Add renderer workflow coverage for object/layer/group/root chain editing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/note-processor-chain-workflows.test.tsx`

### Implementation for User Story 4

- [x] T065 [US4] Refactor duplicated processor test setup to the fixture factory in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/note-processors/processor-test-fixtures.ts`
- [x] T066 [US4] Update quickstart with any final validation notes discovered during implementation in `/Users/stevenyi/work/blue-electron/specs/048-note-processor-parity/quickstart.md`
- [x] T067 [US4] Update project status notes for Note Processor parity and PythonProcessor deferral in `/Users/stevenyi/work/blue-electron/STATUS.md`

**Checkpoint**: Full requested processing, serialization, scoped application, and UI workflow coverage is present.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup after selected user stories are complete.

- [x] T068 [P] Update any changed feature documentation in `/Users/stevenyi/work/blue-electron/specs/048-note-processor-parity/`
- [x] T069 Run `pnpm --filter @blue/data test` from `/Users/stevenyi/work/blue-electron`
- [x] T070 Run `pnpm --filter @blue/app test` from `/Users/stevenyi/work/blue-electron`
- [x] T071 Run `pnpm --filter @blue/app build` from `/Users/stevenyi/work/blue-electron`
- [x] T072 Run `git diff --check` from `/Users/stevenyi/work/blue-electron`
- [x] T073 [US2] Replace per-editor Note Processor copy state with one application-wide detached buffer and add cross-editor regression coverage in `packages/blue-app/src/renderer/stores/note-processor-clipboard-store.ts`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor.tsx`, and `packages/blue-app/src/renderer/tests/note-processor-shared-clipboard.test.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational. This is the MVP because catalog/reification parity is required before editing workflows are useful.
- **US2 (Phase 4)**: Depends on Foundational and should follow US1 for complete processor metadata and reification.
- **US3 (Phase 5)**: Depends on Foundational and benefits from US2's reusable chain editor, but data-layer root-chain work can begin after US1.
- **US4 (Phase 6)**: Depends on US1, US2, and US3 for complete matrix coverage.
- **Polish (Phase 7)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational.
- **US2 (P1)**: Requires Foundational; practically depends on US1 to avoid editing incomplete processor metadata.
- **US3 (P1)**: Requires Foundational; UI work reuses US2 components while data-layer scope tests can start after US1.
- **US4 (P2)**: Requires US1, US2, and US3 because it verifies complete scope and UI coverage.

### Parallel Opportunities

- Setup inventory tasks T002-T004 can run in parallel.
- Foundational tests T005-T008 can run in parallel.
- US1 test groups T016-T021 can run in parallel before implementation.
- US2 tests T028-T033 can run in parallel before UI implementation.
- US3 tests T043-T048 can run in parallel before scoped implementation.
- US4 matrix tests T058-T064 can run in parallel after the shared fixture factory shape is agreed.
- Final documentation update T068 can run in parallel with test command preparation.

## Parallel Example: User Story 1

```text
Task: "Add arithmetic and pch processor parity tests in packages/blue-data/src/note-processors/processor-parity.test.ts"
Task: "Add random processor parity tests in packages/blue-data/src/note-processors/processor-random-parity.test.ts"
Task: "Add line/time/tuning processor parity tests in packages/blue-data/src/note-processors/processor-line-time-tuning-parity.test.ts"
Task: "Add XML serialization matrix tests in packages/blue-data/src/note-processors/processor-serialization-parity.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "Add chain editor component tests in packages/blue-app/src/renderer/tests/note-processor-chain-editor.test.tsx"
Task: "Add parameter editor tests in packages/blue-app/src/renderer/tests/note-processor-parameter-editor.test.tsx"
Task: "Add score-object properties integration tests in packages/blue-app/src/renderer/tests/score-object-properties-panel.test.tsx"
```

## Parallel Example: User Story 3

```text
Task: "Add root score chain generation tests in packages/blue-data/src/score/score-note-processor-chain.test.ts"
Task: "Add score snapshot tests in packages/blue-app/src/main/score-note-processor-targets.test.ts"
Task: "Add renderer ScorePanel tests in packages/blue-app/src/renderer/tests/score-panel-note-processor-ui.test.tsx"
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 for the in-scope processor catalog, reification, serialization, and direct processing parity.
3. Validate `@blue/data` processor tests before moving into UI.

### Incremental Delivery

1. US1: complete processor catalog and data-layer parity.
2. US2: expose editable ScoreObject Properties chains using the reusable editor.
3. US3: reuse the editor for layer, layer-group, and root scopes and fix root score application.
4. US4: add exhaustive matrix and workflow coverage.
5. Polish: run data/app tests, app build, and whitespace validation.

### Handoff Notes

- PythonProcessor/Jython execution and full editing are intentionally deferred. Do not implement Python runtime behavior in this feature.
- Preserve PythonProcessor XML and label it as deferred in snapshots/UI.
- Do not add Java helper `Code` or `ValueTimeMapper` as addable processors.
- Keep `@blue/data` free of Node.js built-ins, dynamic imports, and UI dependencies.
