# Tasks: Consistent Multi-Layer Selection and Operations

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/077-multi-layer-selection/`

**Branch**: `077-multi-layer-selection`

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/layer-selection.md](contracts/layer-selection.md),
and [quickstart.md](quickstart.md)

**Implementation scope**: `@blue/app` renderer/main/shared project-editor paths. No new
`@blue/data` persistence model or `.blue` XML field is planned.

## Phase 1: Setup

**Purpose**: Reproduce the current behavior and establish the regression baseline before
implementation.

- [x] T001 [P] Capture the pre-change Pattern, Track, and SoundObject layer-selection failures and Track MIDI-focus behavior in `packages/blue-app/src/renderer/tests/pattern-layer-header.test.tsx`, `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx`, and `packages/blue-app/src/renderer/tests/score-panel-session-reset.test.tsx`, using the Java references `/Users/stevenyi/work/nbprojects/blue/blue-ui-utilities/src/main/java/blue/ui/utilities/LayerSelectionCoordinator.java` and `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-ui/src/main/java/blue/score/layers/audio/ui/AudioHeaderListPanel.java` as the parity baseline.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish transient identity, pure selection semantics, state ownership, and
testable contracts before story-specific UI or mutation work begins.

**Checkpoint**: The foundation must be complete before User Stories 1–4 are implemented.

- [x] T002 [P] Add the transient `layerSelectionId` to `ScoreLayerSnapshot` and populate it for Pattern, Track, and PolyObject/SoundObject snapshot builders in `packages/blue-app/src/shared/project-editor.ts`, preserving existing `layerId` values and ensuring the new identity is generated from the in-memory layer object rather than serialized project data.
- [x] T003 [P] Implement visible-layer flattening, selection-key creation, inclusive same-group/cross-group range calculation, grouped selected-range derivation, operation availability, and snapshot reconciliation helpers in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-selection-utils.ts` without document-bridge or UI dependencies.
- [x] T004 [P] Create the transient Zustand layer-selection store with `selectSingle`, `extendTo`, `moveFocus`, `clear`, `reconcile`, and `isSelected` semantics in `packages/blue-app/src/renderer/stores/layer-selection-store.ts`, keeping anchor, focus, scope, and selected keys separate from `packages/blue-app/src/renderer/stores/score-selection-store.ts` object/editor state.
- [x] T005 Add invariant and contract coverage for snapshot-only identities, non-serialized selection state, visible-order range semantics, invalid-anchor recovery, and store transitions in `packages/blue-app/src/shared/project-editor-layer-selection.test.ts`, `packages/blue-app/src/renderer/tests/layer-selection-utils.test.ts`, and `packages/blue-app/src/renderer/tests/layer-selection-store.test.ts`.

---

## Phase 3: User Story 1 — Consistent Selected-Layer Styling (Priority: P1) 🎯 MVP

**Goal**: Every selected Pattern, Track, and SoundObject layer header uses the Pattern-derived
accent edge, filled background, and normal-weight label treatment without conflating layer
selection with Pattern editor selection or Track MIDI focus. Aligned score-area rows retain their
normal background while exposing selection state accessibly.

**Independent Test**: Open a score with all three layer types, select each type one at a time, and
verify the selected and unselected visual states while changing MIDI focus and Pattern source
selection independently.

### Verification for User Story 1

- [x] T006 [P] [US1] Add failing component assertions for common selected styling, unselected-state cleanup, accessible selected state, Pattern editor coexistence, and Track MIDI-focus separation in `packages/blue-app/src/renderer/tests/score-layer-selection.test.tsx`, `packages/blue-app/src/renderer/tests/pattern-layer-header.test.tsx`, and `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx`.

### Implementation for User Story 1

- [x] T007 [US1] Integrate the transient selection store into the visible score scope and apply the Pattern-derived selected class, stronger label treatment, and `aria-selected` state to Pattern and SoundObject/Track headers in `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, while leaving existing Pattern source-editor and Track MIDI-focus state independent.
- [x] T008 [P] [US1] Expose accessible selected state on aligned SoundObject and Pattern timeline rows in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/PatternGridRow.tsx` while retaining normal score-area styling and existing object hit-testing/marquee behavior.
- [x] T009 [P] [US1] Apply the selected-layer class only to Track headers and expose accessible selection state on aligned Track rows in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`, ensuring the MIDI-focused border remains a separate visual state and cannot substitute for layer selection.
- [x] T010 [US1] Preserve single Pattern-layer source/editor behavior and independent Track MIDI-focus updates while rendering the common selected state, updating `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, and `packages/blue-app/src/renderer/stores/score-selection-store.ts` only where the existing behavior requires an explicit single-target guard.
- [x] T011 [US1] Run the User Story 1 focused component tests from `specs/077-multi-layer-selection/quickstart.md` and confirm selected styling, stale-highlight clearing, Pattern source selection, and MIDI-focus regressions are covered before proceeding to range-selection work.

**Checkpoint**: User Story 1 is independently demonstrable with consistent styling and no
operation changes required.

---

## Phase 4: User Story 2 — Contiguous Range Selection Across Layer Groups (Priority: P1)

**Goal**: Pointer and keyboard gestures select a predictable visible-order range within or across
layer groups, while maintaining anchor/focus semantics and preserving existing editor behavior.

**Independent Test**: Select a row, Shift-select within its group, Shift-select across an adjacent
group, replace the range with a normal click, and repeat with Arrow and Shift+Arrow navigation.

### Verification for User Story 2

- [x] T012 [P] [US2] Add pure selection tests for normal replacement, same-group ranges, cross-group partial endpoints, complete intervening groups, missing anchors, clamped Arrow navigation, and Shift+Arrow extension in `packages/blue-app/src/renderer/tests/layer-selection-utils.test.ts`.
- [x] T013 [P] [US2] Add store transition tests for anchor/focus updates, scope changes, pruning removed layer identities, keyboard focus ownership, and clearing from non-layer surfaces in `packages/blue-app/src/renderer/tests/layer-selection-store.test.ts`.

### Implementation for User Story 2

- [x] T014 [US2] Wire normal row selection, Shift-click range selection, cross-group visible-order flattening, and selection-aware Pattern source targeting into `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`.
- [x] T015 [US2] Add Arrow Up/Down and Shift+Arrow keyboard navigation through the flattened visible layer order, row focus management, clamping, and accessible selected/focus attributes in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx` and the three layer-group canvas components under `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/`.
- [x] T016 [US2] Keep multi-layer selection distinct from a single embedded SoundObject editor target and prevent Mute, Solo, Note Processor, Automation, Instrument, and other row controls from creating ranges by updating `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/score-timeline-gesture-utils.ts`.
- [x] T017 [US2] Connect active score-path/session changes, non-layer clicks, collapsed views, and snapshot refreshes to `clear`/`reconcile` so stale selected rows disappear in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx` and `packages/blue-app/src/renderer/stores/layer-selection-store.ts`.
- [x] T018 [US2] Run the range-selection, header, canvas, and session-reset tests listed in `specs/077-multi-layer-selection/quickstart.md`, confirming pointer and keyboard selection have identical anchor, scope, and multi-object-editor behavior.

**Checkpoint**: User Story 2 is independently testable with visible same-group and cross-group
selection, pointer/keyboard parity, and no stale or ambiguous editor target.

---

## Phase 5: User Story 3 — Group-Safe Operations on Selected Layers (Priority: P1)

**Goal**: Push, Remove, and single-selection Add operations consume the complete visible selection,
preserve group boundaries and object compatibility, and use one canonical mutation path.

**Independent Test**: Operate on a same-group selected block and a cross-group selection; verify
order, group membership, selection identity, disabled reasons, confirmation count, and empty-group
handling.

### Verification for User Story 3

- [x] T019 [P] [US3] Add canonical patch tests for valid/invalid `moveLayerRange`, descending grouped `removeLayerRanges`, atomic cross-group validation, optional recursive empty-group removal, boundary no-ops, and selection-preserving layer order in `packages/blue-app/src/shared/project-editor-layer-selection.test.ts`.
- [x] T020 [P] [US3] Add renderer optimistic-projection tests for `moveLayerRange` and `removeLayerRanges`, canonical refresh classification, removed-layer pruning, and unchanged Add Above/Below behavior in `packages/blue-app/src/renderer/tests/project-store.test.ts`.

### Implementation for User Story 3

- [x] T021 [US3] Extend the typed `ScorePatch` union and canonical BlueData application with `moveLayerRange` and `removeLayerRanges` in `packages/blue-app/src/shared/project-editor.ts`, delegating same-group moves to existing range methods, validating all ranges before mutation, removing ranges in descending local-index order, and optionally removing empty groups without reparenting layers.
- [x] T022 [US3] Mirror the new range-patch semantics in optimistic renderer snapshot projection, canonical-refresh classification, and selection reconciliation in `packages/blue-app/src/renderer/stores/project-store.ts`, preserving existing single-layer Add/Remove/Move behavior.
- [x] T023 [US3] Update main-process patch side effects for range removal in `packages/blue-app/src/main/main.ts`, including Track instrument-editor cleanup, mixer/audio-channel reconciliation, automation cleanup, and any existing removed-layer bookkeeping, while leaving engine synchronization and object-placement guards unchanged.
- [x] T024 [US3] Extend `packages/blue-app/src/renderer/components/workbench/panels/score/layer-selection-utils.ts` with grouped operation plans and availability reasons for single-selection Add, same-group Push boundaries, mixed-group disabled Push, and count-aware Remove confirmation.
- [x] T025 [US3] Update selection-aware context menus in `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas.tsx`, and `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx` so an inside-selection trigger preserves the full selection and an outside trigger establishes a single-row target.
- [x] T026 [US3] Implement one Remove confirmation for the complete selection, showing the total selected layer count and a default-checked `Delete empty Layer Groups` option when needed, and submit no patch on cancellation in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx` and the existing score context-menu surfaces.
- [x] T027 [US3] Add Alt+Arrow Push Up/Down and Delete/Backspace Remove dispatch through the same operation availability and patch builders as pointer menus, while leaving editable layer-name fields to handle their own Delete/Backspace text editing, in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`, and `packages/blue-app/src/renderer/stores/layer-selection-store.ts`.
- [x] T028 [P] [US3] Extend object-placement and cross-group compatibility regressions in `packages/blue-app/src/main/move-score-objects-guard.test.ts`, `packages/blue-app/src/shared/project-editor.test.ts`, and `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx` to prove layer operations do not weaken existing object movement, clipboard, or group-protection behavior.
- [x] T029 [US3] Route the secondary single-group layer operations in `packages/blue-app/src/renderer/components/workbench/panels/score/ScoreManagerDialog.tsx` through the shared operation availability and patch builders, retaining its local group navigation while preventing semantic drift from the main ScorePanel menus.
- [x] T030 [US3] Run the operation, patch, main-process guard, and Score Manager checks specified in `specs/077-multi-layer-selection/quickstart.md`, including boundary, mixed-group, cancellation, empty-group, and selection-after-push cases.

**Checkpoint**: User Story 3 is independently demonstrable with canonical, atomic, group-safe
operations and consistent pointer/keyboard/menu behavior.

---

## Phase 6: User Story 4 — Preserve Editing Context While Selection Changes (Priority: P2)

**Goal**: Selection remains disposable renderer context, independent from object selection and MIDI
focus, and never changes saved project data unless an explicit layer operation is confirmed.

**Independent Test**: Change layer selection, object selection, MIDI focus, score path, and project
session in sequence; verify each transient state and the saved snapshot/XML independently.

### Verification for User Story 4

- [x] T031 [P] [US4] Add regression coverage for independent layer/object/MIDI state, score-path/session reset, selected-layer reorder/removal reconciliation, and selection-only no-dirty/no-serialization behavior in `packages/blue-app/src/renderer/tests/score-panel-session-reset.test.tsx`, `packages/blue-app/src/renderer/tests/project-store.test.ts`, and `packages/blue-app/src/shared/project-editor-layer-selection.test.ts`.

### Implementation for User Story 4

- [x] T032 [US4] Audit and correct lifecycle/state ownership in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`, `packages/blue-app/src/renderer/stores/layer-selection-store.ts`, `packages/blue-app/src/renderer/stores/score-selection-store.ts`, and `packages/blue-app/src/renderer/stores/project-store.ts` so selection changes never call the document bridge, dirty the project, or overwrite object/editor/MIDI state.
- [x] T033 [US4] Verify canonical snapshot refresh, reload, rename, add, reorder, remove, and unavailable-view paths prune or clear transient selected identities without changing `.blue` serialization in `packages/blue-app/src/shared/project-editor.ts`, `packages/blue-app/src/renderer/stores/project-store.ts`, and `packages/blue-app/src/renderer/tests/score-panel-session-reset.test.tsx`.

**Checkpoint**: User Story 4 is independently testable as a state-ownership and persistence
regression suite.

---

## Phase 7: Polish & Cross-Cutting Validation

**Purpose**: Exercise the integrated UI, preserve existing regressions, and collect constitution-
required handoff evidence.

- [x] T034 [P] Update the stacked timeline/browser coverage for aligned row styling, pointer selection, keyboard selection, and object hit-testing in `packages/blue-app/src/renderer/browser/score-stacked-selection.browser.test.tsx` and `packages/blue-app/src/renderer/browser/patterns-layer-group-canvas.browser.test.tsx`.
- [x] T035 [P] Run the existing shared and main-process regression suites in `packages/blue-app/src/shared/project-editor.test.ts`, `packages/blue-app/src/main/move-score-objects-guard.test.ts`, `packages/blue-app/src/renderer/tests/patterns-layer-group-canvas.test.tsx`, and `packages/blue-app/src/renderer/tests/track-layer-group-canvas.test.tsx`, recording any scoped exception in `specs/077-multi-layer-selection/quickstart.md`.
- [x] T036 Run the affected-package focused tests and main build from `specs/077-multi-layer-selection/quickstart.md` with `pnpm --filter @blue/app test` and `pnpm --filter @blue/app build:main`, including the new layer-selection and project-editor patch tests.
- [x] T037 Run repository-level `pnpm test`, `pnpm lint`, and `git diff --check` from the repository root, and record failures with their scope and recovery status in `specs/077-multi-layer-selection/quickstart.md`.
- [x] T038 Complete the deterministic manual walkthrough in `specs/077-multi-layer-selection/quickstart.md` on a score containing Pattern, Track, and SoundObject groups, covering styling, cross-group selection, keyboard operations, disabled Push reasons, one-confirmation Remove, empty-group handling, and transient-state isolation.

## Phase 8: Closure Corrections

- [x] T039 [P] Align Pattern header labels with Java Blue by rendering only `layer.name`, leaving unnamed layers blank, and add regression coverage in `packages/blue-app/src/renderer/components/workbench/panels/score/PatternLayerHeader.tsx` and `packages/blue-app/src/renderer/tests/pattern-layer-header.test.tsx`.
- [x] T040 [P] Prevent Delete/Backspace from invoking layer removal while editing any layer-name field, and add ScorePanel regression coverage in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx` and `packages/blue-app/src/renderer/tests/score-layer-operations.test.tsx`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 has no implementation dependency and establishes the baseline.
- **Foundational (Phase 2)**: T002–T005 depend on the baseline where applicable and block all
  story implementation because every story consumes the transient identity/selection contract.
- **User Story 1 (Phase 3)**: T006–T011 depend on T002–T005. This is the recommended MVP slice.
- **User Story 2 (Phase 4)**: T012–T018 depend on T002–T005 and share renderer surfaces with US1;
  sequence T014–T017 after the common styling integration or merge those edits carefully.
- **User Story 3 (Phase 5)**: T019–T030 depend on T002–T005 and the selection behavior from
  T012–T017; patch application must be complete before menu/keyboard operations are enabled.
- **User Story 4 (Phase 6)**: T031–T033 depend on T002–T005 and the lifecycle paths from US2;
  they harden state ownership after selection and operation flows exist.
- **Polish (Phase 7)**: T034–T038 depend on all desired story checkpoints.
- **Closure corrections (Phase 8)**: T039–T040 depend on the completed header and keyboard
  operation surfaces and must be reflected in the final validation record.

### User Story Dependencies

- **US1 (P1)**: Foundation only; independently delivers consistent visual selection.
- **US2 (P1)**: Foundation plus the common styling/state wiring; independently delivers range
  selection and keyboard navigation.
- **US3 (P1)**: Depends on the selection contract and visible-range behavior from US2 because
  operations consume grouped selected ranges.
- **US4 (P2)**: Depends on the transient store and lifecycle integration; it can be developed
  alongside US3 tests but should be validated after operation refresh paths exist.

### Within Each User Story

- Add or update regression tests before implementation when the existing harness can reproduce the
  behavior.
- Keep pure helpers and typed contracts below UI components; keep canonical mutations in the main-
  owned document path.
- Complete the story checkpoint before treating the next priority as independently deliverable.

## Parallel Execution Examples

### User Story 1

```text
T006 component regression assertions
T008 aligned Pattern/SoundObject accessible state with normal score-area styling
T009 Track header styling, row accessible state, and MIDI-focus separation
```

T007 should land before T008/T009 if those rows need the shared selection class or store
subscription.

### User Story 2

```text
T012 pure visible-order/range tests
T013 store transition tests
```

After the tests are in place, T014 and T015 can be split between pointer and keyboard surfaces;
T016 and T017 should follow their respective event wiring.

### User Story 3

```text
T019 shared canonical patch tests
T020 renderer optimistic-projection tests
T028 object-placement compatibility regressions
```

T021 must precede T022, T023, T025, and T026; T024 can proceed alongside T021 because it is pure
operation planning, and T029 follows the shared operation builders.

### User Story 4

```text
T031 state-ownership and persistence regressions
T033 snapshot refresh/reconciliation regressions
```

T032 should resolve failures after both regression surfaces are defined.

## Implementation Strategy

### MVP First

1. Complete T001–T005 to establish the baseline and transient selection foundation.
2. Complete T006–T011 for User Story 1.
3. Stop and validate the common Pattern-derived styling independently before enabling operations.

### Incremental Delivery

1. Add T012–T018 for same-group, cross-group, pointer, and keyboard selection.
2. Add T019–T030 for canonical group-safe operations and secondary-manager parity.
3. Add T031–T033 for state ownership and persistence safety.
4. Complete T034–T038 for browser coverage, package/repository checks, and manual handoff evidence.

## Traceability Summary

| Requirement area | Task coverage |
|---|---|
| FR-001–FR-006 selection state, identity, range, reconciliation | T002–T018, T031–T033 |
| FR-003 shared styling and accessibility | T006–T011, T034 |
| FR-007–FR-010 context actions, Push, Remove, Add | T019–T030 |
| FR-011 object/group compatibility | T023, T028, T035 |
| FR-012 Pattern editor, label, and MIDI separation | T006–T010, T016, T031, T039 |
| FR-013 transient/canonical persistence boundary | T002, T005, T021–T023, T031–T033 |
| FR-014 keyboard model and editable-field guard | T012–T018, T027, T034, T040 |
| FR-015 single-selection Add behavior | T020, T024–T026, T030 |
| Constitution and Java parity | T001–T005, T019–T023, T028, T035–T039 |

## Completion Criteria

- Every task above is complete and remains in strict checklist format: `- [x] [TaskID] [P?]
  [Story?] description`.
- Each user story has an independent test criterion and a checkpoint.
- The MVP is User Story 1 after the foundational phase.
- Final handoff includes focused tests, main build, repository tests/lint, `git diff --check`, and
  the deterministic manual walkthrough from `quickstart.md`.
