---
description: "Task list for feature implementation"
---

# Tasks: Host-Aware Floating Surfaces

**Input**: Design documents from `/specs/090-host-floating-surfaces/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Verification**: Include the regression, serialization, contract, runtime, UI, cross-platform
host-path, and quickstart tasks required by the constitution and plan. A behavior or data change
cannot omit verification merely because the feature specification does not request TDD.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- All feature work is in the Electron app renderer: `packages/blue-app/src/renderer/`
- Shared host-surface module: `packages/blue-app/src/renderer/components/host-surface/` (new)
- Tests: `packages/blue-app/src/renderer/tests/` (Vitest + JSDOM two-document pattern)
- Smallest supported host-panel size for all viewport tests: **240 × 160 CSS px** (plan decision)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency groundwork for the host-surface module

- [X] T001 Add `@floating-ui/dom` as a direct dependency in `packages/blue-app/package.json` (pin a version compatible with the one Radix resolves transitively; run `pnpm install` and commit the lockfile)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared host-surface module every user story consumes (plan Key Design Decisions 1–3; contracts/host-surface-module.md)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create `packages/blue-app/src/renderer/components/host-surface/host-surface-options.ts` with `HostSurfaceKind`, `HostSurfaceOptions` (kind, gap=8, margin=8, align, closeOnHostScroll defaulting true for `menu` / false otherwise, onDismiss reasons), and the `HostSurfaceAnchor` discriminated union (`element` / `rect` / `point`) per specs/090-host-floating-surfaces/data-model.md
- [X] T003 Implement `packages/blue-app/src/renderer/components/host-surface/use-host-surface.ts`: resolve host via `useHostDocument()`, compute placement with `@floating-ui/dom` `computePosition` + `flip`/`shift`/`size` against the host-realm viewport (never global `window`), follow `rect`/`point` anchors with `autoUpdate` animation-frame scheduling (≤1 update per rendered frame, SC-007), stop on close/unmount, expose `state`/`placement`/`setSurfaceElement`/`close` per contracts/host-surface-module.md (depends on T001, T002)
- [X] T004 Implement `packages/blue-app/src/renderer/components/host-surface/HostSurfacePortal.tsx`: portal into the host document body, apply placement and `maxHeight` with internally scrollable overflow, spread `portalEventIsolationProps` semantics on the root, bind Escape + outside-pointer dismissal to the host document only using `isNodeLike`/`containsNode` from `packages/blue-app/src/renderer/utils/cross-realm-dom.ts`, render nothing and attach nothing when no host document (FR-011), detach all listeners on close/unmount (depends on T003)
- [X] T005 Add module placement tests in `packages/blue-app/src/renderer/tests/host-surface-placement.test.tsx`: element/rect/point anchors, top/bottom/left/right edge flip and shift, oversized surface clamped with `maxHeight` and internal scrolling, viewport limits computed from the second (popout) document's window rather than the main window, and no-DOM/SSR renders nothing with zero listeners (depends on T004)
- [X] T006 Add module lifecycle tests in `packages/blue-app/src/renderer/tests/host-surface-lifecycle.test.tsx`: `menu` closes on host-viewport scroll while scrolling inside the menu content does not dismiss (FR-005), tooltip/readout kinds follow anchors frame-batched (SC-007), Escape/outside-pointer in a foreign document is ignored (FR-006), and float/re-dock/unmount leave no orphaned DOM or listener (SC-003) (depends on T004)

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Context menus remain visible near panel edges (Priority: P1) 🎯 MVP

**Goal**: Every in-scope workbench context menu stays fully visible and usable at panel, viewport, scroll-container, and window edges, docked and floated, without native menus or overlay windows.

**Independent Test**: Quickstart §A — right-click near top/bottom/left/right edges of the score canvas, a sound layer row, and the line editor, docked and floated; menu flips/shifts inward, items clickable, no behind-surface handler activation, Escape/outside-click dismissal bound to the host window only.

### Verification for User Story 1

> **NOTE: For a bug or behavior change, reproduce the failure before implementation when the harness supports it.**

- [X] T007 [P] [US1] Reproduce the line-editor context-menu clipping in `packages/blue-app/src/renderer/tests/editable-line-canvas-popover.test.tsx`: add failing edge cases showing the current menu renders at raw pointer coordinates with no measure/flip (anchor at each viewport edge in a 240 × 160 host), so the new tests fail before T009
- [X] T008 [P] [US1] Add Radix host-window coverage in `packages/blue-app/src/renderer/tests/score-canvas-popout-menus.test.tsx`: menu near the second document's viewport edges clamps inside that viewport (FR-004), and keyboard parity in the two-document pattern — arrows navigate, Enter activates, Escape closes, focus returns to the invoker (FR-006/FR-010, deferred clarification)

### Implementation for User Story 1

- [X] T009 [US1] Migrate the context menu in `packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx` onto the host-surface module: `point` anchor at the pointer, measured flip/shift, keep existing "Edit Points"/"Reset Line" commands and host-bound dismissal (depends on T005, T007)
- [X] T010 [US1] Verify and fix Radix collision realm for score-canvas context menus: inspect where Radix's popper measures when portaled through `PopoutContextMenuPortal` in `packages/blue-app/src/renderer/hooks/host-portals.tsx`; if it clamps against the main window, pass the host viewport as `collisionBoundary` in the score-canvas menu components under `packages/blue-app/src/renderer/components/workbench/panels/score/` (depends on T008)
- [X] T011 [US1] Close floated menus on host scroll with no dismissal from foreign-realm input by wiring the module's `closeOnHostScroll`/`onDismiss` contract through menu consumers, confirming internal menu scrolling never dismisses (depends on T006, T009)

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - Tooltips and automation readouts remain visible (Priority: P1)

**Goal**: Line-editor tooltips and the automation point readout escape row/SVG/scroll clipping, follow their anchors through drags and resizes, and preserve content and Java edge-placement parity.

**Independent Test**: Quickstart §B — hover/drag line-editor points at each canvas edge; select/hover an automation point at row top/bottom edges; readout renders outside the row with unchanged `x:`/`y:`(+label) content; at 240 × 160 px everything stays readable above the 11 px typography floor.

### Verification for User Story 2

- [X] T012 [P] [US2] Reproduce the tooltip clipping in `packages/blue-app/src/renderer/tests/editable-line-canvas-popover.test.tsx`: failing cases exposing the hard-coded 176×44 assumptions at host-viewport edges (tooltip must fit at all four edges with a measured size), failing before T014
- [X] T013 [P] [US2] Extend `packages/blue-app/src/renderer/tests/score-timeline-automation-popout.test.tsx`: readout fully visible outside an `overflow: hidden` row in BOTH the main and second documents, content/formatting parity (`x:`/`y:` + appended label via `formatAutomationDouble`), opposite-side flip preserved, informational-only (never steals pointer input), readable at the 240 × 160 px floor, failing before T015

### Implementation for User Story 2

- [X] T014 [US2] Migrate the hover tooltip in `packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx` onto the host-surface module: `rect` anchor at the point, measured size replacing the fixed 176×44 clamps, anchor-following during drags (depends on T005, T012)
- [X] T015 [US2] Replace the SVG `ReadoutText` group in `packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLineView.tsx` with a `HostSurfacePortal` DOM annotation: `rect` anchor following the point, `text-role-subheadline` typography with the dark backing box, same two-line content and hover-priority selection semantics, pointer-events none (depends on T005, T013; contract specs/090-host-floating-surfaces/contracts/automation-readout-parity.md)
- [X] T016 [US2] Java parity spot-check against `~/work/nbprojects/blue/blue-ui-core/src/main/java/blue/automation/ParameterLinePanel.java` `drawPointInformation`: compare values, label placement, and opposite-side flip; record any divergence in specs/090-host-floating-surfaces/spec.md Intentional Divergences if one is found (constitution II/V)

**Checkpoint**: User Stories 1 AND 2 independently functional

---

## Phase 5: User Story 3 - Popup behavior stays consistent through panel lifecycle changes (Priority: P2)

**Goal**: Floating, re-docking, closing, or unmounting a panel moves or safely removes its open popups — no orphaned visuals, stale listeners, or cross-window dismissal in either realm.

**Independent Test**: Quickstart §C — open each surface, float the panel, re-dock, close, unmount; after every transition no popup remnant or stuck dismissal exists in either window; a menu opened before floating lands in (or closes with) the new host.

### Verification for User Story 3

- [X] T017 [P] [US3] Add lifecycle transition tests to `packages/blue-app/src/renderer/tests/host-surface-lifecycle.test.tsx` and, if new containment paths appear, `packages/blue-app/src/renderer/tests/cross-realm-containment.test.tsx`: open surface → host document swaps (float/re-dock) → surface re-anchors or closes; inside/outside target classification across both realms; full cleanup with zero retained listeners (SC-003), failing before T018

### Implementation for User Story 3

- [X] T018 [US3] React to host-document changes mid-interaction: subscribe the module to the shell's location-change resolution (`useShellHostDocument` pattern in `packages/blue-app/src/renderer/hooks/use-host-document.ts`) so an open surface re-resolves its host or closes on float/re-dock (depends on T006, T017)
- [X] T019 [US3] Verify consumer cleanup on unmount/window-close for both consumers (`EditableLineCanvas.tsx`, `AutomationLineView.tsx`): panel close and popout-window close remove surfaces and listeners from both documents (depends on T018)

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, constitution audit, and full validation

- [X] T020 [P] Update `docs/popout-popup-conventions.md` to name the host-surface module as the canonical path for hand-rolled (non-Radix) surfaces, linking specs/090-host-floating-surfaces/contracts/host-surface-module.md
- [X] T021 [P] Confirm `docs/typography.md` needs no change: readout adopted the existing `text-role-subheadline` role and no role/metric/ownership boundary moved (AGENTS.md typography guidance)
- [X] T022 Audit constitution compliance for the finished feature: `@blue/data`, `src/main/`, `src/preload/`, and all IPC/engine/Java-runtime surfaces untouched; popup state remains disposable renderer state with no new persistence (constitution I/III/IV; FR-013)
- [ ] T023 Run the manual Electron acceptance in `specs/090-host-floating-surfaces/quickstart.md` end to end (docked + floated, including the 240 × 160 px floor and keyboard parity §D)
- [X] T024 Run full validation from the repository root: `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:renderer`, `pnpm lint`, `git diff --check`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; blocks Phase 2 (module imports the dependency)
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Stories (Phases 3–5)**: Depend on Phase 2 completion
  - US1 (menus) and US2 (tooltips/readouts) are P1 and independent of each other; they may proceed in parallel
  - US3 (lifecycle) is P2 and builds on the same module; run after US1/US2 consumers exist
- **Polish (Phase 6)**: After all desired user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2 — independent of US2/US3
- **User Story 2 (P1)**: After Phase 2 — independent of US1 (different consumers of the same module; note T012/T007 share `editable-line-canvas-popover.test.tsx`, so sequence those two verification tasks if run in parallel streams)
- **User Story 3 (P2)**: After Phase 2 and realistically after US1/US2 consumers exist (its tests exercise those surfaces)

### Within Each User Story

- Constitution-required regression tests accompany behavior changes; reproductions (T007, T012, T013, T017) MUST fail before their implementation tasks
- Module (models/contracts) before consumers; consumers before cross-cutting lifecycle work
- Story complete before moving to the next priority

### Parallel Opportunities

- T002 is the only Phase 2 [P] task (T003 → T004 → T005/T006 are sequential on the same files)
- Within US1: T007 ∥ T008 (different test files); then T009–T011 share `EditableLineCanvas.tsx`/menu components — sequence them
- Within US2: T012 ∥ T013 (different test files); T014 (line editor) ∥ T015 (automation view) after that (different source files)
- US1 and US2 streams can run in parallel once Phase 2 is done, minding the shared test file noted above
- T020 ∥ T021 ∥ T022 in Phase 6

---

## Parallel Example: User Story 2

```bash
# Launch independent verification tasks together:
Task: "T012 Reproduce tooltip clipping in packages/blue-app/src/renderer/tests/editable-line-canvas-popover.test.tsx"
Task: "T013 Extend packages/blue-app/src/renderer/tests/score-timeline-automation-popout.test.tsx"

# After both fail-for-the-right-reason, launch independent consumers together:
Task: "T014 Migrate line-editor tooltip in packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx"
Task: "T015 Port automation readout in packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLineView.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`@floating-ui/dom`)
2. Complete Phase 2: Foundational host-surface module + its tests
3. Complete Phase 3: User Story 1 (context menus visible docked + floated)
4. **STOP and VALIDATE**: Quickstart §A independently
5. Ship/demo if ready — menus are the highest-value surface

### Incremental Delivery

1. Setup + Foundational → module proven by its own tests
2. Add US1 → validate §A (MVP!)
3. Add US2 → validate §B (tooltips + readout parity)
4. Add US3 → validate §C (lifecycle safety)
5. Polish + full validation → quickstart end to end

### Parallel Team Strategy

1. Team completes Phases 1–2 together
2. Then: Developer A → US1; Developer B → US2 (coordinate the shared `editable-line-canvas-popover.test.tsx`)
3. US3 afterwards (single developer), then Phase 6 together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Reproduction tasks (T007, T012, T013, T017) must fail before their implementation task runs
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
