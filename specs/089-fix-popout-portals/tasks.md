---

description: "Task list for 089-fix-popout-portals"
---

# Tasks: Fix Popout Portal Correctness

**Input**: Design documents from `/specs/089-fix-popout-portals/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/host-document-mechanism.md, quickstart.md

**Verification**: Constitution-driven. Every corrected popup surface ships a
focused two-document regression test (FR-008); bug regressions are reproduced
(failing test or mutation check) before/at implementation; docked-mode
non-regression is proven by the existing suite passing unchanged.

**Organization**: Grouped by user story (US1 score-panel context menus, US2
line-editor overlays + picker consolidation, US3 remaining dismissal/Escape
surfaces, US4 convention documentation, US5 exact float persistence across
restart).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

Most popup work is in the Electron renderer package; the restart follow-up also
touches the existing Electron main shutdown boundary:

- Components: `packages/blue-app/src/renderer/components/…`
- Hooks/utils: `packages/blue-app/src/renderer/hooks/`, `packages/blue-app/src/renderer/utils/`
- Tests: `packages/blue-app/src/renderer/tests/`
- Main shutdown persistence: `packages/blue-app/src/main/main.ts`
- Docs: `docs/`, root `AGENTS.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring verified foundation work onto this branch so shared helpers
consolidate instead of duplicate (research.md R7).

- [x] T001 Integrate foundation branch `fix-color-picker` (worktree `.worktrees/fix-color-picker`) onto `089-fix-popout-portals` via merge or cherry-pick; resolve overlaps in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/{ScoreTimeCanvas,TrackLayerGroupCanvas}.tsx` and confirm `pnpm --filter @blue/app exec vitest run src/renderer/tests/color-picker.test.tsx src/renderer/tests/score-object-color-picker.test.tsx src/renderer/tests/score-object-color-roundtrip.test.ts` passes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The reusable host-document mechanism every user story consumes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create realm-safe DOM utilities `isNodeLike(target)` and `containsNode(container, target)` per contracts/host-document-mechanism.md in `packages/blue-app/src/renderer/utils/cross-realm-dom.ts` with unit tests in `packages/blue-app/src/renderer/tests/cross-realm-dom.test.ts` (two-JSDOM-realm cases: foreign-realm node classified node-like; contains works across documents; non-node targets rejected)
- [x] T003 Create `HostDocumentContext`, `useHostDocument(options)`, and `usePortalContainer()` exactly per contracts/host-document-mechanism.md in `packages/blue-app/src/renderer/hooks/use-host-document.ts` (undefined = no provider, null = no-DOM render-nothing; `fallbackToGlobal` only for main-window chrome callers) with unit tests in `packages/blue-app/src/renderer/tests/use-host-document.test.tsx`
- [x] T004 Provide `HostDocumentContext` from the panel shell: resolve `ownerDocument` from the shell div ref in `packages/blue-app/src/renderer/components/workbench/DockviewPanel.tsx` after mount (and re-resolve if the node moves documents) so all panel content inherits its hosting window's document
- [x] T005 Extend `useDocumentMouseDownOutside` usage docs/comment block in `packages/blue-app/src/renderer/hooks/use-document-mousedown-outside.ts` to reference the new mechanism and mark global-`document` default as main-window-chrome-only (behavior unchanged)

**Checkpoint**: Foundation ready — mechanism exists, tested, and provided to all panel content

---

## Phase 3: User Story 1 — Context menus work inside floated score panels (Priority: P1) 🎯 MVP

**Goal**: Right-click menus (objects, layer rows, fades, patterns) open,
function, and dismiss entirely within a floating Score panel window.

**Independent Test**: Float the Score panel; right-click each menu-bearing
surface; menu appears adjacent to cursor in the floating window, applies the
chosen action, closes on selection/outside-click/Escape (quickstart.md steps 2–6).

### Verification for User Story 1

> **NOTE: Reproduce the failure before implementation when the harness supports it.**

- [x] T006 [US1] Add failing two-document regression tests for score-canvas context menus in `packages/blue-app/src/renderer/tests/score-canvas-popout-menus.test.tsx`: mount a representative canvas context menu under `HostDocumentContext` = second JSDOM document and assert (a) Radix portal subtree lands in popout body, (b) mousedown inside menu (popout-realm event) does not close it, (c) popout-body mousedown and Escape close it, (d) main-document events do not; run and confirm RED against current code

### Implementation for User Story 1

- [x] T007 [US1] Route all three `ContextMenu.Portal` sites through `usePortalContainer()` in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx` (object menu ~L1763, submenu portals ~L1929/~L2025), gating render when container is null
- [x] T008 [P] [US1] Route all three `ContextMenu.Portal` sites (main menu ~L1489, nested fade submenus ~L1514/~L1549) through `usePortalContainer()` in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx`
- [x] T009 [P] [US1] Route the `ContextMenu.Portal` (~L264) through `usePortalContainer()` in `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/PatternsLayerGroupCanvas.tsx`
- [x] T010 [US1] Mutation-check T007 (temporarily revert container to default; T006 must fail; restore), then make T006 GREEN
- [x] T011 [US1] Run `pnpm --filter @blue/app test` and confirm no docked-mode regressions; perform quickstart.md steps 2–6 live and record results *(automated portion complete — suite green; live steps deferred to T033)*

**Checkpoint**: User Story 1 fully functional and independently validated (MVP)

---

## Phase 4: User Story 2 — Line editor overlays + picker consolidation (Priority: P2)

**Goal**: Line-editor tooltips/context menu/point editor render, clamp, and
dismiss inside the floating window; the fixed ColorPicker consolidates onto the
shared mechanism.

**Independent Test**: Float a panel containing a line editor; hover tooltip
clamps to the floating window, right-click menu and point editor behave
in-window (quickstart.md step 8).

### Verification for User Story 2

- [x] T012 [US2] Add failing two-document regression tests in `packages/blue-app/src/renderer/tests/editable-line-canvas-popover.test.tsx`: hover tooltip renders in popout body clamped to popout viewport dimensions; context-menu outside-mousedown dismisses while inside-mousedown does not (`instanceof`-free); point editor Escape routes through the popout document; confirm RED

### Implementation for User Story 2

- [x] T013 [US2] Fix `packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx`: portal context menu (~L847) and hover tooltip (~L878) into the host document body; replace global-window mousedown/Escape listeners (~L367-368) with host-document bindings; replace `instanceof Node` (~L355) with `isNodeLike`; clamp tooltip using the canvas element's `ownerDocument.defaultView.innerWidth/innerHeight` (~L882-883)
- [x] T014 [P] [US2] Consolidate `packages/blue-app/src/renderer/components/ColorPicker.tsx` onto shared helpers: import `isNodeLike` from `utils/cross-realm-dom.ts` replacing the local copy, and consume `useHostDocument` for the popover document while preserving null-document render-nothing behavior; keep all foundation tests passing unchanged
- [x] T015 [US2] Make T012 GREEN; mutation-check the containment fix once (revert `isNodeLike` → test fails → restore)
- [x] T016 [US2] Run `pnpm --filter @blue/app test`; live-verify quickstart.md step 8 *(automated portion complete — suite green; live step deferred to T033)*

**Checkpoint**: Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 — Dismissal/Escape follow the hosting window everywhere (Priority: P3)

**Goal**: All remaining audited popup surfaces in floateable panel content bind
portals, positioning, dismissal, and containment to the host document.

**Independent Test**: For each surface below, float the host panel, invoke the
popup, and verify outside-click/Escape dismiss within the floating window;
docked behavior unchanged.

### Verification for User Story 3

- [x] T017 [P] [US3] Add two-document regression tests for the inline-menu/dialog cluster in `packages/blue-app/src/renderer/tests/panel-dialog-dismissal.test.tsx`: NoteProcessorChainEditor add/import outside-click dismiss (`components/workbench/panels/score-object/note-processors/NoteProcessorChainEditor.tsx`), Escape routing for `RulerConfigDialog.tsx`, `pianoroll/PianoRollRulerConfigDialog.tsx`, `TrackerScoreObjectEditor.tsx`, `PresetsManagerDialog.tsx`, `NoteProcessorCodeModal.tsx`; confirm RED where applicable
- [x] T018 [P] [US3] Add two-document tests for realm-sensitive containment sites in `packages/blue-app/src/renderer/tests/cross-realm-containment.test.tsx`: `ArrangementPanel.tsx:225`, `LiveSpaceTab.tsx:647`, `PianoRollEditor.tsx:658` treat foreign-realm targets structurally; confirm RED

### Implementation for User Story 3

- [x] T019 [P] [US3] Migrate score-area Radix surfaces to `usePortalContainer()`: `TempoLineView.tsx`, `MarkersBar.tsx`, `MeterRegionBar.tsx`, `TempoRegionBar.tsx`, `PatternLayerHeader.tsx`, `TrackInstrumentControl.tsx`, `ScoreToolbar.tsx`, `ScoreManagerDialog.tsx`, `automation/AutomationTargetMenu.tsx`, `RulerConfigDialog.tsx` (all under `packages/blue-app/src/renderer/components/workbench/panels/score/`)
- [x] T020 [P] [US3] Bind Escape handlers to the host document in `RulerConfigDialog.tsx:61`, `pianoroll/PianoRollRulerConfigDialog.tsx:39`, `TrackerScoreObjectEditor.tsx:187,868`, `bsb/PresetsManagerDialog.tsx:489`, `note-processors/NoteProcessorCodeModal.tsx:35`
- [x] T021 [P] [US3] Fix `NoteProcessorChainEditor.tsx` add/import menu dismissal (document listeners ~L50-70) to bind the host document with `containsNode` membership
- [x] T022 [P] [US3] Migrate editor-surface Radix portals and containment to the mechanism: `PianoRollEditor.tsx` (+ `pianoroll/PianoRollSnapButton.tsx`), `jmask/ParameterRow.tsx`, `ArrangementContextMenu.tsx`, `ArrangementPanel.tsx:225`, `LiveSpaceTab.tsx:647` (under `packages/blue-app/src/renderer/components/workbench/panels/`)
- [x] T023 [P] [US3] Migrate BSB surfaces: `WidgetWrapper.tsx` (Tooltip + ContextMenu), `BSBInterfaceCanvas.tsx`, `BSBPresetBar.tsx`, `BSBDropdownWidget.tsx` (under `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/`)
- [x] T024 [P] [US3] Migrate mixer/tools surfaces: `ChannelStrip.tsx`, `EffectsChainContextMenu.tsx`, `OutputPanel.tsx` (menu container ~L181 → host body; `selectionchange` ~L54 bound to host document), `UdoTable.tsx`, `CodeRepositoryTree.tsx`, `FileManagerTree.tsx`, `MidiInputProcessorForm.tsx` (under `packages/blue-app/src/renderer/components/workbench/panels/`)
- [x] T025 [US3] Migrate `AuxiliaryTab.tsx:344` to `usePortalContainer()`-equivalent resolution while preserving current correct behavior, and make T017/T018 GREEN
- [x] T026 [US3] Sweep check: grep corrected surfaces for bare `document.body`, `document.addEventListener`, `window.addEventListener('keydown'`, `window.innerWidth` used by panel-hosted popups; fix stragglers or record justified exceptions (e.g., main-window chrome) in the PR description
- [x] T027 [US3] Run `pnpm --filter @blue/app test`; spot-live-verify two migrated surfaces (one BSB widget menu, output panel menu) per quickstart pattern *(automated portion complete at that checkpoint; final suite evidence is recorded in T032/T043; live spot-check deferred to T033 manual run)*

**Checkpoint**: All user stories independently functional

---

## Phase 6: User Story 4 — One consistent rule prevents future regressions (Priority: P3)

**Goal**: The convention and reusable mechanism are discoverable and referenced
from project guidance.

**Independent Test**: From `AGENTS.md`, a developer reaches the convention doc
in under 5 minutes and finds a reference example in code.

- [x] T028 [US4] Document the popup-hosting convention (rule, consumer obligations, reference examples: `DockviewPanel.tsx`, `contracts/host-document-mechanism.md`) in a new `docs/popout-popup-conventions.md`
- [x] T029 [P] [US4] Add a pointer to that document under UI guidance in root `AGENTS.md`
- [x] T030 [US4] Time-boxed self-check: navigate AGENTS.md → convention doc → reference example; adjust wording until the path is obvious

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification and cleanliness required by the constitution.

- [x] T031 [P] Confirm foundation regression net intact: color-picker, score-object picker, and round-trip tests pass unmodified (`src/renderer/tests/color-picker.test.tsx`, `score-object-color-picker.test.tsx`, `score-object-color-roundtrip.test.ts`)
- [x] T032 Run full quickstart.md automated section: `pnpm --filter @blue/app test`, ESLint on all changed files, `pnpm audit:renderer-typography`, `git diff --check` *(final rerun after restart fix: 385 files, 3691 passed, 2 skipped; repository lint/build/diff checks green)*
- [x] T033 Execute the full popup interaction acceptance checklist in quickstart.md (steps 1–10) and record outcomes *(completed by user after final convergence fixes; all tested interactions looked good)*
- [x] T034 [P] Verify no orphaned-overlay/console-error issues on float→re-dock transitions with menus open (data-model Entity 2 force-close transition) *(completed during the final user acceptance sweep; no issues reported)*
- [x] T035 Update `docs/modularization.md` boundary map entries only if any module boundary moved (expected: none)

---

## Phase 8: Live-Acceptance Follow-Up — Float Persistence Across Restart

**Purpose**: Preserve the exact floating layout through application shutdown
and restart. This work was discovered while executing the P1 live workflow and
is part of User Story 5 / FR-010..FR-014.

- [x] T036 Reproduce the two observed restore failures—Score silently docked
  after restart and all editors restored into the Score popout—and capture the
  serialized Dockview layout plus console stacks in an isolated Electron
  profile
- [x] T037 Add focused regression coverage in
  `packages/blue-app/src/renderer/tests/clear-dockview-safely.test.ts` for
  serialized popout membership, explicit single-panel/group restoration,
  stale Dockview API cancellation, failed-popout docked fallback, and
  Electron `about:blank` navigation guarding
- [x] T038 Make workbench hydration asynchronous and current-instance-safe in
  `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx` and
  `packages/blue-app/src/renderer/stores/workbench-store.ts`; await layout
  restoration before publishing ownership/listeners and ignore superseded
  restore results
- [x] T039 Replace Dockview 5.2 generic popout `fromJSON` restoration with a
  prepared docked snapshot plus explicit awaited `addPopoutGroup` intents;
  enforce exact serialized membership, remap runtime floating origins, and
  recover failed opens to a usable docked layout
- [x] T040 Preserve the last user-visible floated snapshot during quit in
  `packages/blue-app/src/main/main.ts` by dropping layout updates generated
  after shutdown begins, while retaining the existing layout IPC/storage
  schema
- [x] T041 Harden popout opening so Electron's provisional `about:blank`
  WindowProxy is not reloaded before navigation to `popout.html`; retain a
  bounded close/fallback path and diagnostic errors for failed restoration
- [x] T042 Fix auxiliary restoration in
  `packages/blue-app/src/renderer/components/workbench/auxiliary-layout-dockview.ts`
  to select only grid-resident anchor panels; add a regression proving Output
  rebuilds relative to Orchestra when Score is popped out
- [x] T043 Run the isolated Electron float Score → shutdown → restart check and
  wait 12 seconds: confirm `popout.html` contains only Score, `index.html`
  contains every other editor plus Output, and no restore/Dockview exception is
  logged; rerun focused tests, full `@blue/app` suite, build, repository lint,
  and `git diff --check`

**Checkpoint**: Restart lifecycle and the complete manual popup-interaction
sweep are verified.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: blocks everything — foundation must be on this branch first
- **Foundational (T002–T005)**: depends on Setup; BLOCKS all user stories
- **US1 (Phase 3)**: depends on Foundational — delivers the MVP alone
- **US2 (Phase 4)**: depends on Foundational; independent of US1 (may proceed in parallel)
- **US3 (Phase 5)**: depends on Foundational; verification tasks T017/T018 may start in parallel with US1/US2; implementation batches T019–T025 benefit from patterns settled in US1/US2 but have no hard dependency
- **US4 (Phase 6)**: best after US1–US3 so documented examples match shipped code
- **Polish (Phase 7)**: after all desired stories
- **Restart follow-up (Phase 8 / US5)**: discovered by live P1 verification;
  depends on the existing SPEC 055 persistence path and the hydrated workbench,
  but is otherwise independent of the popup-surface batches

### Within Each User Story

- Failing regression tests before implementation (constitution V)
- Shared-file edits (ScoreTimeCanvas/TrackLayerGroupCanvas) build on T001 merge state
- Story checkpoint runs before moving on

### Parallel Opportunities

- T002/T003/T004/T005 within Foundational (distinct files; T004 depends on T003's context export — order T003 → T004)
- US1/US2/US3 verification and implementation batches largely disjoint by file: mark [P]
- T019–T024 are disjoint file sets — fully parallelizable across contributors

---

## Parallel Example: User Story 3

```bash
# Launch independent implementation batches together (disjoint files):
Task: "T019 score-area Radix surfaces (panels/score/**)"
Task: "T022 editor-surface portals (panels/score-object/**, orchestra/Arrangement*)"
Task: "T023 BSB surfaces (panels/orchestra/bsb/**)"
Task: "T024 mixer/tools surfaces (panels/mixer/**, panels/output/**, panels/tools/**)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 integrate foundation
2. T002–T005 mechanism
3. T006–T011 score-panel context menus
4. STOP and VALIDATE (live quickstart steps 2–6)

### Incremental Delivery

Each subsequent phase adds a coherent slice without breaking prior ones; stop
after any checkpoint with a shippable state.

### Notes

- Every corrected surface = one focused two-document test (FR-008); at least
  one mutation check per problem class (portal container, containment,
  dismissal binding)
- Commit after each task or logical group
- Avoid touching window-level drag handlers (explicitly out of scope)

## Phase 9: Convergence

- [x] T044 Bind `ArrangementPanel.tsx` add-menu outside-mousedown dismissal to `useHostDocument()` via `targetDocument`, and add two-document coverage proving host-window dismissal while main-window input is ignored per FR-003
- [x] T045 Use the hosting document for `OutputPanel.tsx` Copy and Select All selection/range operations, and add focused floated-panel coverage per US3/AC3
- [x] T046 Execute and record the complete popup interaction acceptance checklist in `specs/089-fix-popout-portals/quickstart.md` (steps 1–10), resolving any failures per SC-001 and existing T033 *(user acceptance completed after final convergence fixes; all tested interactions looked good)*
- [x] T047 Verify and record that float→re-dock transitions with menus open leave no orphaned overlays or console errors, resolving any failures per FR-006 and existing T034 *(user acceptance completed; no issues reported)*

## Phase 10: Convergence

- [x] T048 Complete synthetic event isolation for every portaled score/editor/BSB popup whose React ancestors handle pointer or mouse input—including `ScoreTimeCanvas`, `TrackLayerGroupCanvas`, `PatternsLayerGroupCanvas`, `PatternLayerHeader`, `TempoLineView`, and `ScorePanel` layer-header menus—and add mutation-sensitive representative regressions per FR-001 and FR-008 *(shared `portalEventIsolationProps`; regression proves React-ancestor isolation while preserving Radix outside dismissal)*
- [x] T049 Migrate `LibraryContextMenu`, `LibraryActionsMenu`, and `LibraryDropMarker` to the host-document portal mechanism and add floated-library coverage per FR-001 and FR-009
- [x] T050 Extend `docs/popout-popup-conventions.md` and `contracts/host-document-mechanism.md` with the two-stage event rule: bubble-phase overlay guards plus capture-phase ancestor exemptions via `isEventInsidePortalPopup`; document the corresponding regression-test obligation per FR-008 and FR-009
- [x] T051 Re-run and record reliable full `@blue/app` validation after convergence; if the package run reproduces the performance-test threshold failure seen during review, stabilize it before claiming SC-002 *(390 files passed; 3,699 tests passed, 2 skipped; build, repository lint, and `git diff --check` green; performance threshold failure did not recur)*
