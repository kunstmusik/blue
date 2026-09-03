---

description: "Dependency-ordered implementation tasks for layer and clip colors"
---

# Tasks: Layer and Clip Colors

**Input**: Design documents from `/specs/096-layer-clip-colors/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/layer-color-contract.md`, `quickstart.md`

**Verification**: The tasks below include the regression, serialization, contract, UI, compatibility, state-ownership, atomicity, performance, and quickstart evidence required by the project constitution and implementation plan.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and does not depend on an incomplete task
- **[Story]**: Maps the task to a user story in `spec.md`
- Every task names the exact file or files it changes or validates

## Phase 1: Setup (Shared Test Assets)

**Purpose**: Prepare reusable fixtures for the three layer implementations and the Java-compatible legacy/current project cases.

- [X] T001 [P] Add legacy-without-layer-colors and current-three-layer XML fixtures in packages/blue-data/src/score/fixtures/layer-colors/legacy-no-layer-colors.blue.xml and packages/blue-data/src/score/fixtures/layer-colors/all-layer-colors.blue.xml
- [X] T002 [P] Add reusable ordinary, Track, and Pattern snapshot/target builders in packages/blue-app/src/shared/project-editor-layer-color-test-utils.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish one portable color representation and carry required layer colors across the typed canonical document boundary.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 Add the neutral signed-ARGB constant plus strict UI/patch normalization and forgiving XML normalization helpers in packages/blue-data/src/score/layers/layer-color.ts
- [X] T004 Extend the browser-safe Layer interface with concrete background-color accessors in packages/blue-data/src/score/layers/layer.ts
- [X] T005 [P] Extend ScoreLayerSnapshot and updateLayerState with required snapshot and optional patch backgroundColor fields in packages/blue-app/src/shared/project-editor/contract.ts
- [X] T006 Populate backgroundColor for ordinary, Track, and Pattern layer snapshots in packages/blue-app/src/shared/project-editor/snapshot-score.ts
- [X] T007 Export the portable layer-color API through the existing public data-package barrel in packages/blue-data/src/index.ts

**Checkpoint**: Every in-memory layer can own one normalized color, and renderer snapshots/patch intents can carry it without introducing a second canonical owner.

---

## Phase 3: User Story 1 - Color Layers and New Clips (Priority: P1) 🎯 MVP

**Goal**: Show and edit a concrete color on every layer type, use the current destination-layer color for genuinely new items, and undo or redo one picker gesture as one step.

**Independent Test**: Change each supported layer type to a distinct color, create a new item or Pattern source object, and verify the new item matches the latest layer color while one undo/redo step reverses/reapplies the layer edit.

### Verification for User Story 1

- [X] T008 [P] [US1] Add failing model tests for neutral defaults, deep-copy behavior, and Pattern source initialization in packages/blue-data/src/score/layer-color-model.test.ts
- [X] T009 [P] [US1] Add failing canonical bridge tests for layer-only updates, invalid-value rejection, and destination-color defaulting for new ordinary and Track items in packages/blue-app/src/shared/project-editor-layer-colors.test.ts
- [X] T010 [P] [US1] Add failing optimistic reducer tests for layer updates and omitted-color new-item defaults in packages/blue-app/src/renderer/tests/project-store-layer-colors.test.ts
- [X] T011 [P] [US1] Add failing picker tests for one opening/final gesture-completion callback without changing existing onChange consumers in packages/blue-app/src/renderer/tests/color-picker.test.tsx
- [X] T012 [P] [US1] Add failing layer-header tests for visible swatches, accessible names, keyboard operation, and ordinary/Track/Pattern edit dispatch in packages/blue-app/src/renderer/tests/score-layer-color-controls.test.tsx
- [X] T013 [P] [US1] Add failing bounded-history tests for no-op suppression, one-entry picker gestures, undo/redo, failure handling, and project-session reset in packages/blue-app/src/renderer/tests/score-color-history-store.test.ts

### Implementation for User Story 1

- [X] T014 [P] [US1] Add normalized background-color state, copy construction, and accessors to SoundLayer in packages/blue-data/src/sound-objects/sound-layer.ts
- [X] T015 [P] [US1] Add normalized background-color state, copy construction, and accessors to Track in packages/blue-data/src/score/track/track.ts
- [X] T016 [P] [US1] Add normalized background-color state, copy construction, accessors, and matching initial-source color to PatternLayer in packages/blue-data/src/score/patterns/pattern-layer.ts
- [X] T017 [US1] Validate and apply layer-color updates and resolve destination-layer defaults only for genuinely new ordinary/Track item requests in packages/blue-app/src/shared/project-editor/patch-score.ts
- [X] T018 [US1] Make genuine-new-item backgroundColor optional and mirror canonical layer/default behavior in optimistic snapshots and store actions in packages/blue-app/src/renderer/stores/project-store.ts
- [X] T019 [US1] Add the optional opening/final color gesture-completion callback to ColorPickerButton while preserving host-document portal behavior in packages/blue-app/src/renderer/components/ColorPicker.tsx
- [X] T020 [US1] Render and edit layer colors through ColorPickerButton in ordinary/Track headers and Pattern headers in packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx and packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx
- [X] T021 [US1] Implement a bounded renderer-session stack of forward/inverse color patches with pending-patch flush, safe failure reconciliation, and reset APIs in packages/blue-app/src/renderer/stores/score-color-history-store.ts
- [X] T022 [US1] Connect picker commits and score-scoped undo/redo controls without replacing native text undo roles in packages/blue-app/src/renderer/components/workbench/panels/score/ScoreToolbar.tsx and packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx

**Checkpoint**: User Story 1 is independently usable and testable as the MVP.

---

## Phase 4: User Story 2 - Preserve Independent Clip Colors (Priority: P2)

**Goal**: Keep all existing, explicitly colored, copied, duplicated, imported, pasted, and moved items independent from later layer-color changes.

**Independent Test**: Create two items on a red layer, recolor one green, change the layer blue, then copy/import/move the items and verify only the next genuinely new item starts blue.

### Verification for User Story 2

- [X] T023 [P] [US2] Add failing canonical regression cases for explicit, serialized, source-target, copied, duplicated, imported, and moved item-color preservation in packages/blue-app/src/shared/project-editor-layer-color-preservation.test.ts
- [X] T024 [P] [US2] Add failing renderer journey tests proving paste, import, duplicate, and cross-layer move payloads retain concrete colors in packages/blue-app/src/renderer/tests/score-layer-color-preservation.test.tsx
- [X] T025 [P] [US2] Extend direct score-object color regression coverage so individual item edits remain canonical and round-trip through snapshots in packages/blue-app/src/renderer/tests/score-object-color-roundtrip.test.ts

### Implementation for User Story 2

- [X] T026 [US2] Preserve reified/source item colors before applying new-item defaults and leave move operations color-neutral in packages/blue-app/src/shared/project-editor/patch-score.ts
- [X] T027 [US2] Classify genuinely new versus transferred objects and retain concrete colors across create, clipboard, library import, duplicate, and move call sites in packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx and packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx

**Checkpoint**: Existing item colors remain stable independently of the layer default across every supported transfer path.

---

## Phase 5: User Story 3 - Reapply a Layer Color (Priority: P3)

**Goal**: Recolor a selection from each item's containing layer or recolor all colorable items on one layer through one atomic, undoable patch.

**Independent Test**: Apply layer colors to a mixed multi-layer selection and to one full 1,000-item layer, verify unrelated items do not change, inject one invalid target to prove all-or-nothing rejection, then undo and redo each accepted action once.

### Verification for User Story 3

- [X] T028 [P] [US3] Add failing contract tests for empty no-op, duplicate/invalid rejection, mixed target kinds, 1,000-target atomic success, and one revision result in packages/blue-app/src/shared/project-editor-score-color-application.test.ts
- [X] T029 [P] [US3] Add failing optimistic parity tests for multi-target recolor success, no-op, and rejection reconciliation in packages/blue-app/src/renderer/tests/project-store-score-color-application.test.ts
- [X] T030 [P] [US3] Add failing command-builder tests for multi-layer selection colors, single-layer enumeration, inverse capture, and unrelated-item exclusion in packages/blue-app/src/renderer/tests/score-color-actions.test.ts
- [X] T031 [P] [US3] Add failing UI/history tests for Set to Layer Color and Apply Layer Color to All Clips as single undoable actions in packages/blue-app/src/renderer/tests/score-layer-color-actions.test.tsx

### Implementation for User Story 3

- [X] T032 [US3] Add the typed setScoreObjectBackgroundColors patch variant and serializable update shape in packages/blue-app/src/shared/project-editor/contract.ts
- [X] T033 [US3] Resolve and validate the complete recolor request before mutating regular, Track, or Pattern-source targets atomically in packages/blue-app/src/shared/project-editor/patch-score.ts
- [X] T034 [US3] Mirror setScoreObjectBackgroundColors as one optimistic edit with authoritative-refresh recovery in packages/blue-app/src/renderer/stores/project-store.ts
- [X] T035 [US3] Build forward/inverse selected-item and whole-layer recolor patches from current snapshots in packages/blue-app/src/renderer/components/workbench/panels/score/score-color-actions.ts
- [X] T036 [US3] Add Set to Layer Color to selection menus and Apply Layer Color to All Clips to ordinary/Track layer menus in packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx and packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx
- [X] T037 [US3] Add Pattern-source recolor actions and route every accepted application through one score-color history entry in packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx and packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx
- [X] T038 [US3] Clear unsafe score-color history on structural score edits while retaining it across unrelated snapshot refreshes in packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts and packages/blue-app/src/renderer/stores/score-color-history-store.ts

**Checkpoint**: Both explicit application commands are atomic, scoped, performant at 1,000 items, and reversible as one step.

---

## Phase 6: User Story 4 - Retain Colors Across Projects and Versions (Priority: P4)

**Goal**: Round-trip layer/item colors exactly, recover legacy or malformed layer data safely, preserve unknown XML, and remain compatible with Java Blue's concrete item colors.

**Independent Test**: Save/reopen custom colors for all three layer types, load/save a legacy or malformed project, and verify neutral layer materialization, unchanged item colors, one canonical child per layer, preserved unknown XML, and Java-readable item colors.

### Verification for User Story 4

- [X] T039 [P] [US4] Add failing SoundLayer, Track, and PatternLayer XML tests for signed/RGB/unsigned values, missing/malformed fallback, deep-copy, one-child save output, and unknown-child preservation in packages/blue-data/src/score/layer-color-serialization.test.ts
- [X] T040 [P] [US4] Add failing legacy project load-save regression coverage proving neutral layer materialization without rewriting existing item colors in packages/blue-data/src/score/layer-color-compatibility.test.ts
- [X] T041 [P] [US4] Add a bridge-level save/reopen test for exact layer and item snapshot colors across all layer types in packages/blue-app/src/shared/project-editor-layer-color-roundtrip.test.ts
- [X] T042 [P] [US4] Add deterministic assertions that feature-produced XML retains Java Blue-readable concrete item backgroundColor values while allowing layer children to be ignored in packages/blue-data/src/score/score-model-compatibility.test.ts

### Implementation for User Story 4

- [X] T043 [US4] Read and write one canonical backgroundColor child with safe fallback in SoundLayer/PolyObject serialization in packages/blue-data/src/sound-objects/poly-object.ts
- [X] T044 [US4] Read/write canonical backgroundColor, exclude it from unknown-child replay, and preserve all other unknown Track XML in packages/blue-data/src/score/track/track.ts
- [X] T045 [US4] Read and write one canonical backgroundColor child with safe fallback in PatternLayer serialization in packages/blue-data/src/score/patterns/pattern-layer.ts

**Checkpoint**: Current and legacy projects round-trip safely, and the intentional asymmetric Java compatibility behavior is covered by deterministic tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify host-window behavior and collect repository-wide completion evidence.

- [X] T046 [P] Add docked/floated score-panel coverage for host-document picker placement, realm-safe dismissal, keyboard access, and accessible labels in packages/blue-app/src/renderer/tests/score-layer-color-popout.test.tsx
- [X] T047 Run the automated creation, preservation, atomicity, undo/redo, XML, and accessibility scenarios and record any scoped exceptions in specs/096-layer-clip-colors/quickstart.md
- [X] T048 Run pnpm --filter @blue/data test, pnpm --filter @blue/app test, and pnpm --filter @blue/app build:main from package.json and record the results in specs/096-layer-clip-colors/quickstart.md
- [X] T049 Run pnpm test, pnpm lint, and git diff --check from package.json and record final cross-package validation evidence in specs/096-layer-clip-colors/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 can start in parallel.
- **Foundational (Phase 2)**: Depends on Setup. T003 precedes T004 and T007; T004 and T005 precede T006. Completion blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational and establishes the MVP layer/new-item/history behavior.
- **User Story 2 (Phase 4)**: Depends on Foundational and the add-item contract from US1; its preservation cases remain independently testable.
- **User Story 3 (Phase 5)**: Depends on Foundational and the score-color history facility from US1; it does not depend on US2 implementation.
- **User Story 4 (Phase 6)**: Depends on the foundational model fields; it can proceed alongside US2/US3 after US1's model shape is stable.
- **Polish (Phase 7)**: T046 follows US1 UI work; T047-T049 follow all stories selected for delivery.

### User Story Completion Order

```text
Setup → Foundational → US1 (MVP)
                         ├──→ US2
                         ├──→ US3
                         └──→ US4
US2 + US3 + US4 → Polish and full validation
```

### Within Each User Story

- Write the listed regression/contract/UI tests before the corresponding implementation and confirm they fail for the intended missing behavior.
- Complete model and contract changes before canonical patch handlers.
- Complete canonical handlers before optimistic reducers and UI wiring.
- Capture forward/inverse colors from one snapshot before submitting an atomic history action.
- Finish the story's independent test before moving to the next priority.

## Parallel Opportunities

- T001 and T002 can run together.
- T005 can proceed independently while T003/T004 establish the portable data model.
- US1 verification tasks T008-T013 can be authored in parallel; implementations T014-T016 can then proceed in parallel.
- US2 verification tasks T023-T025 can run in parallel.
- US3 verification tasks T028-T031 can run in parallel before the contract/handler/reducer sequence T032-T034.
- US4 verification tasks T039-T042 can run in parallel; serialization implementations T043-T045 touch separate layer owners and can also run in parallel.
- After US1 stabilizes the shared shape, US2, US3, and US4 may be assigned concurrently.

## Parallel Example: User Story 1

```text
Task T008: Model defaults/copy/source tests in packages/blue-data/src/score/layer-color-model.test.ts
Task T009: Canonical layer/default tests in packages/blue-app/src/shared/project-editor-layer-colors.test.ts
Task T010: Optimistic parity tests in packages/blue-app/src/renderer/tests/project-store-layer-colors.test.ts
Task T011: Picker gesture tests in packages/blue-app/src/renderer/tests/color-picker.test.tsx
Task T012: Layer-header UI tests in packages/blue-app/src/renderer/tests/score-layer-color-controls.test.tsx
Task T013: History-store tests in packages/blue-app/src/renderer/tests/score-color-history-store.test.ts
```

## Parallel Example: User Story 2

```text
Task T023: Canonical transfer-preservation tests in packages/blue-app/src/shared/project-editor-layer-color-preservation.test.ts
Task T024: Renderer transfer journey tests in packages/blue-app/src/renderer/tests/score-layer-color-preservation.test.tsx
Task T025: Direct item-color round-trip regression in packages/blue-app/src/renderer/tests/score-object-color-roundtrip.test.ts
```

## Parallel Example: User Story 3

```text
Task T028: Atomic canonical patch tests in packages/blue-app/src/shared/project-editor-score-color-application.test.ts
Task T029: Optimistic parity tests in packages/blue-app/src/renderer/tests/project-store-score-color-application.test.ts
Task T030: Command-builder tests in packages/blue-app/src/renderer/tests/score-color-actions.test.ts
Task T031: UI/history action tests in packages/blue-app/src/renderer/tests/score-layer-color-actions.test.tsx
```

## Parallel Example: User Story 4

```text
Task T039: Three-layer XML unit tests in packages/blue-data/src/score/layer-color-serialization.test.ts
Task T040: Legacy load/save regression in packages/blue-data/src/score/layer-color-compatibility.test.ts
Task T041: Bridge save/reopen test in packages/blue-app/src/shared/project-editor-layer-color-roundtrip.test.ts
Task T042: Java-compatible item-color assertions in packages/blue-data/src/score/score-model-compatibility.test.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational tasks.
2. Complete T008-T022 for User Story 1.
3. Run the US1 independent test across ordinary, Track, and Pattern layers.
4. Stop and demonstrate editable layer colors, creation-time defaults, and one-step picker undo/redo.

### Incremental Delivery

1. **MVP**: Layer colors, new-item defaults, and layer-color undo/redo (US1).
2. **Compatibility safety**: Lock down independent item colors across transfers (US2).
3. **Explicit consistency tools**: Add selected/all atomic recoloring and history (US3).
4. **Persistence/version safety**: Complete XML materialization and Java compatibility evidence (US4).
5. **Handoff**: Validate floated UI behavior, affected packages, and the full repository (Phase 7).

## Notes

- `[P]` tasks operate on different files and have no dependency on an unfinished task in the same batch.
- `BlueData` and `.blue` XML remain the sole durable owners; the renderer history store is bounded, disposable session state.
- Omitted item color means “use the destination default” only for genuine creation, never for restored, copied, imported, duplicated, or moved content.
- All multi-item applications validate every target and color before mutation and produce one canonical patch/revision/history entry.
- The feature deliberately does not add live inheritance, a palette subsystem, or a general project undo framework.

## Phase 8: Convergence

- [X] T050 CRITICAL: Preserve unknown attributes and children when loading and saving ordinary sound layers and Pattern layers while emitting exactly one canonical backgroundColor child in packages/blue-data/src/sound-objects/poly-object.ts, packages/blue-data/src/sound-objects/sound-layer.ts, packages/blue-data/src/score/patterns/pattern-layer.ts, and packages/blue-data/src/score/layer-color-serialization.test.ts per Constitution II (contradicts)
- [X] T051 CRITICAL: Make optimistic setScoreObjectBackgroundColors validation all-or-nothing and reconcile canonical changed-false or rejected batches in packages/blue-app/src/renderer/stores/project-store.ts, packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts, and packages/blue-app/src/renderer/tests/project-store-score-color-application.test.ts per Constitution III (contradicts)
- [X] T052 CRITICAL: Resolve the failing @blue/data modern-render integration hash or document a scoped exception, rerun the required package validation, and replace the inaccurate recorded result in specs/096-layer-clip-colors/quickstart.md per Constitution V (contradicts)
- [X] T053 Parse the complete stored layer-color value through strict forgiving XML normalization for ordinary sound layers, Tracks, and Pattern layers and cover partially numeric malformed values in packages/blue-data/src/sound-objects/poly-object.ts, packages/blue-data/src/score/track/track.ts, packages/blue-data/src/score/patterns/pattern-layer.ts, and packages/blue-data/src/score/layer-color-serialization.test.ts per FR-014 (partial)
- [X] T054 Record layer-color changes and applications only after canonical acceptance, advance undo/redo only after acknowledged forward or inverse commits, and cover rejection reconciliation in packages/blue-app/src/renderer/stores/score-color-history-store.ts, packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx, packages/blue-app/src/renderer/tests/score-color-history-store.test.ts, and packages/blue-app/src/renderer/tests/score-layer-color-actions.test.tsx per FR-017 (partial)

## Phase 9: Convergence

- [X] T055 CRITICAL: Preserve an ordinary or Pattern layer's original soundObject XML when its loader returns null so unsupported project content survives save and reopen, while retaining the documented runtime fallback, in packages/blue-data/src/sound-objects/poly-object.ts, packages/blue-data/src/sound-objects/sound-layer.ts, packages/blue-data/src/score/patterns/pattern-layer.ts, and packages/blue-data/src/score/layer-color-serialization.test.ts per Constitution II (contradicts)
- [X] T056 CRITICAL: Make canonical acceptance observable for each layer-color and item-color action even when the project patch queue also contains unrelated successful edits, including stale layer and stale item targets, and prevent phantom history entries in packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts, packages/blue-app/src/renderer/stores/project-store.ts, packages/blue-app/src/renderer/stores/score-color-history-store.ts, packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx, and focused renderer queue/history tests per Constitution III (contradicts)
- [X] T057 Abort score-color undo or redo when its prerequisite pending-patch flush fails, without enqueueing a history patch or moving the cursor, and cover first-flush-only failure separately from post-apply acknowledgement failure in packages/blue-app/src/renderer/stores/score-color-history-store.ts and packages/blue-app/src/renderer/tests/score-color-history-store.test.ts per FR-017 (partial)

## Phase 10: Convergence

- [X] T058 CRITICAL: Distinguish per-patch canonical acceptance from whether a patch mutated data so valid no-op layer and item color patches do not masquerade as rejection, while stale or invalid targets still fail closed; cover repeated identical or rounded picker-preview values, same-color direct edits, mixed batches, and genuine rejection in packages/blue-app/src/shared/project-editor/contract.ts, packages/blue-app/src/main/main.ts, packages/blue-app/src/renderer/stores/project-store/project-patch-queue.ts, packages/blue-app/src/renderer/tests/project-patch-queue.test.ts, and focused score-color picker/history tests per Constitution III (contradicts)

## Phase 11: Convergence

- [X] T059 Preserve source-target and serialized item colors in the optimistic addScoreObjects snapshot when a transfer omits backgroundColor, matching canonical transfer precedence without briefly substituting DEFAULT_LAYER_COLOR, and cover omitted-color copy/import cases in packages/blue-app/src/renderer/stores/project-store.ts and packages/blue-app/src/renderer/tests/score-layer-color-preservation.test.tsx per FR-007 and FR-016 (partial)
- [X] T060 Resolve setScoreObjectBackgroundColors targets to unique snapshot objects before optimistic mutation so alias addresses for the same object reject the entire batch exactly like canonical validation, and cover selection/location and Pattern-source aliases in packages/blue-app/src/renderer/stores/project-store.ts and packages/blue-app/src/renderer/tests/project-store-score-color-application.test.ts per FR-011 and FR-016 (partial)

## Phase 12: Convergence

- [X] T061 Preserve an omitted Pattern-source target's concrete item color in the optimistic addScoreObjects snapshot by resolving every supported source-target form rather than only timeline locations, and add a Pattern-source transfer regression case in packages/blue-app/src/renderer/stores/project-store.ts and packages/blue-app/src/renderer/tests/score-layer-color-preservation.test.tsx per FR-007 and FR-016 (partial)
