---
description: "Actionable implementation tasks for stabilizing tree drag and drop"
---

# Tasks: Stabilize Tree Drag and Drop

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/084-stabilize-tree-dnd/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Organization**: Tasks are grouped by user story. Shared renderer seams are completed in the foundational phase so each P1 story can be tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the direct package inputs required by the renderer-only implementation.

- [X] T001 Add direct `dnd-core@14.0.1` and `react-dnd-html5-backend@14.1.0` dependencies to `packages/blue-app/package.json` and update `pnpm-lock.yaml` without changing the existing React Arborist version or stored workbench envelope version.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the one-document drag ownership seam and migrate the shared File Manager surface before story-specific work begins.

**⚠️ CRITICAL**: User story work depends on this phase.

- [X] T002 Add failing jsdom contract tests for same-`Document` manager identity, independent managers across documents, safe unmount/remount and closed-document cleanup, active-drag reporting, and transient non-serialization in `packages/blue-app/src/renderer/tests/tree-dnd-domain.test.tsx`.
- [X] T003 Implement the renderer-local `Document`-keyed drag manager registry, HTML5 backend construction, active-drag monitoring, and cleanup rules from `specs/084-stabilize-tree-dnd/contracts/tree-dnd-domain.md` in `packages/blue-app/src/renderer/components/tree/tree-dnd-domain.ts`.
- [X] T004 Implement the `BlueTree<T>` adapter with DOM-owner-document resolution, render gating until the manager exists, forwarded React Arborist props/ref behavior, document-change remount handling, and closed-document safety in `packages/blue-app/src/renderer/components/tree/BlueTree.tsx`.
- [X] T005 Migrate File Manager from a direct React Arborist `Tree` to `BlueTree` while preserving its `TreeApi` ref, disabled Arborist drag/drop configuration, selection, expansion, scrolling, and file payload callbacks in `packages/blue-app/src/renderer/components/workbench/panels/tools/file-manager/FileManagerTree.tsx`.

**Checkpoint**: The shared manager contract, adapter, and File Manager participant are ready; user stories can proceed independently.

---

## Phase 3: User Story 1 - Move a populated tool panel safely (Priority: P1) 🎯 MVP

**Goal**: Move populated Libraries among the left, right, and bottom edges without duplicate-backend errors, renderer fallback, or loss of File Manager usability.

**Independent Test**: Mount populated Libraries and File Manager in a real Dockview browser fixture, move Libraries through all three edges for 20 cycles, and verify every placement and interaction remains usable.

### Verification for User Story 1

- [X] T006 [P] [US1] Add a failing real Dockview browser regression that mounts populated Libraries and File Manager, exercises an edge move, and captures duplicate-backend errors, fallback rendering, panel identity, and initialization counts in `packages/blue-app/src/renderer/browser/workbench-tree-movement.browser.test.tsx`.
- [X] T007 [P] [US1] Add failing transition-contract cases for applied, deferred-on-active-drag, preflight-failed, and runtime-failed moves, asserting that non-applied results retain the current canonical state, in `packages/blue-app/src/renderer/tests/workbench-auxiliary.test.ts`.

### Implementation for User Story 1

- [X] T008 [US1] Implement `transitionAuxiliaryLayout(api, current, desired, options)` in `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts` with normalization/preflight, affected-only Dockview add/move/close operations, live panel reuse, active/maximize/title/size restoration, active-drag deferral, and best-effort rollback according to `specs/084-stabilize-tree-dnd/contracts/auxiliary-layout-transition.md`.
- [X] T009 [US1] Route `moveAuxiliaryEdge`, `moveGroupToEdge`, `movePanelToEdge`, and `mergeBackToSeededGroup` through the transition result in `packages/blue-app/src/renderer/stores/workbench-store.ts`, replacing canonical auxiliary state only for `status === 'applied'` and preserving captured docked sizes.
- [X] T010 [US1] Route runtime auxiliary reveal, closed-panel restore, dock, minimize, close, maximize, and restore actions through the typed transition in `packages/blue-app/src/renderer/stores/workbench-store.ts` while retaining `applyAuxiliaryLayout` for explicit full-apply callers.
- [X] T011 [US1] Update edge-drag and panel-movement callbacks to consume safe deferred/failed outcomes, clear pending movement state, and keep the last valid layout usable in `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx` and `packages/blue-app/src/renderer/components/workbench/AuxiliaryTab.tsx`.
- [X] T012 [US1] Complete the 20-cycle Libraries left/right/bottom browser regression in `packages/blue-app/src/renderer/browser/workbench-tree-movement.browser.test.tsx`, asserting requested placement, no renderer error or duplicate HTML5 backend, preserved File Manager session state, and successful follow-up drag/selection.
- [X] T013 [US1] Add store-level assertions that deferred or failed transitions do not publish desired placement or serialize it, covering `packages/blue-app/src/renderer/tests/workbench-auxiliary.test.ts` and `packages/blue-app/src/renderer/tests/workbench-store.test.ts`.

**Checkpoint**: The P1 movement path is independently demonstrable and is the suggested MVP.

---

## Phase 4: User Story 2 - Use multiple interactive trees together (Priority: P1)

**Goal**: Let File Manager coexist with Code Repository, Presets Manager, Effects Library, and native Libraries interactions without competing drag ownership.

**Independent Test**: Open supported tree pairs through repeated cycles, exercise selection/expansion/rename/drag behavior, and verify same-document manager sharing plus independent popout/iframe-document ownership.

### Verification for User Story 2

- [X] T014 [US2] Add a failing real multi-tree browser fixture that mounts File Manager with each other tree surface and records the competing-backend failure, intended drag target, native Libraries coexistence, and document identity in `packages/blue-app/src/renderer/browser/tree-dnd-coexistence.browser.test.tsx`.

### Implementation for User Story 2

- [X] T015 [P] [US2] Migrate Code Repository to `BlueTree` while preserving move, rename, selection, context actions, node renderers, and existing tree refs in `packages/blue-app/src/renderer/components/workbench/panels/code-repository/CodeRepositoryTree.tsx`.
- [X] T016 [P] [US2] Migrate Presets Manager to `BlueTree` while preserving folder expansion, move/delete/rename callbacks, keyboard behavior, node renderers, and existing tree refs in `packages/blue-app/src/renderer/components/workbench/panels/orchestra/bsb/PresetsManagerDialog.tsx`.
- [X] T017 [P] [US2] Migrate Effects Library to `BlueTree` while preserving move, rename, selection, activation, node rendering, and existing tree behavior in `packages/blue-app/src/renderer/components/workbench/panels/effects-library/EffectLibraryTree.tsx`.
- [X] T018 [US2] Complete the browser coexistence regression for 10 open/close cycles, supported selection/expansion/rename/drag interactions, native `LibraryTree` `draggable`/`DataTransfer` behavior, separate document managers, and clean popout/document closure in `packages/blue-app/src/renderer/browser/tree-dnd-coexistence.browser.test.tsx`.

**Checkpoint**: All participating Arborist trees use the application seam, while Libraries remains an explicit native non-participant.

---

## Phase 5: User Story 3 - Preserve workbench sessions during layout changes (Priority: P2)

**Goal**: Rearrange one auxiliary panel without restarting unrelated sessions, losing transient state, changing presentation, or flashing through loading.

**Independent Test**: Instrument an unaffected auxiliary panel, move another panel/group through docked, minimized, slideout, maximized, and edge changes, and compare identity, initialization count, focus, selection, expansion, scroll, and size before and after.

### Verification for User Story 3

- [X] T019 [P] [US3] Add browser instrumentation for unaffected Dockview panel identity, initialization count, focus, selection, expansion, scroll offset, presentation, and configured size across repeated target moves in `packages/blue-app/src/renderer/browser/workbench-tree-movement.browser.test.tsx`.
- [X] T020 [P] [US3] Add unit scenarios for targeted add/move/close behavior, unaffected panel identity reuse, active/maximized state, edge-size restoration, and partial-mutation rollback in `packages/blue-app/src/renderer/tests/workbench-auxiliary.test.ts`.
- [X] T021 [P] [US3] Extend saved-layout regressions to cover versions 2 through 7, docked/minimized/slideout/maximized/derived-singleton/seeded-group presentations, unchanged envelope version 7, and exclusion of managers/transition statuses from persistence in `packages/blue-app/src/renderer/tests/workbench-layout-persistence.test.ts` and `packages/blue-app/src/renderer/tests/workbench-store.test.ts`.

### Implementation for User Story 3

- [X] T022 [US3] Harden the live transition in `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts` for minimized, slideout, maximized, and derived groups, restoring active panel/focus and per-edge sizes while rolling back partial Dockview mutations and clearing stale drag/movement state.
- [X] T023 [US3] Route popout-return/dock and related Dockview lifecycle paths through targeted reconciliation, retaining full `applyAuxiliaryLayout` only for startup hydration, explicit Reset Windows, and unrecoverable legacy hydration in `packages/blue-app/src/renderer/stores/workbench-store.ts` and `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx`.

**Checkpoint**: Unaffected live auxiliary sessions remain stable across the complete runtime transition matrix, with saved-layout meaning unchanged.

---

## Phase 6: User Story 4 - Prevent ownership regressions (Priority: P2)

**Goal**: Give maintainers one documented tree integration rule and automated coverage that catches a second uncoordinated drag domain or broad runtime reconstruction.

**Independent Test**: Mount a representative future tree through the supported seam beside existing surfaces and verify the focused browser regression would fail if a raw Arborist backend or wholesale runtime panel rebuild returned.

### Verification for User Story 4

- [X] T024 [US4] Add a maintainer-facing browser regression that mounts a representative new `BlueTree` beside existing participating trees and native Libraries, asserting one manager per document and preserving the failure signal for a raw uncoordinated Arborist tree in `packages/blue-app/src/renderer/browser/tree-dnd-coexistence.browser.test.tsx`.

### Implementation for User Story 4

- [X] T025 [P] [US4] Add concise integration comments and typed ownership exports that direct future Arborist callers to `BlueTree` and keep manager/active-drag state renderer-session-only in `packages/blue-app/src/renderer/components/tree/tree-dnd-domain.ts` and `packages/blue-app/src/renderer/components/tree/BlueTree.tsx`.
- [X] T026 [P] [US4] Document the per-`Document` ownership rule, `BlueTree` integration path, native Libraries disposition, runtime-transition/full-apply distinction, future-tree rule, and required regression commands in `docs/tree-drag-and-drop.md`.
- [X] T027 [P] [US4] Mark Libraries as an explicit native HTML drag/drop non-participant without changing its payload behavior, and add the source-level ownership note in `packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx`.

**Checkpoint**: Future tree work has an explicit seam, a documented exception for Libraries, and a real regression guard.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close edge cases, run the prescribed verification gates, and hand off a validated implementation.

- [X] T028 Add browser coverage for active-drag interruption, loading/empty/large trees, simultaneous modal close, minimized/slideout neighbors, popout close during drag, and development-remount cleanup in `packages/blue-app/src/renderer/browser/tree-dnd-coexistence.browser.test.tsx` and `packages/blue-app/src/renderer/browser/workbench-tree-movement.browser.test.tsx`.
- [X] T029 Run the focused unit and browser commands listed in `specs/084-stabilize-tree-dnd/quickstart.md`, including tree-domain, auxiliary, store, persistence, coexistence, and movement regressions, and record any scoped environment limitation there.
- [X] T030 Run the affected renderer build and repository lint gates from the paths documented in `packages/blue-app/package.json` and `specs/084-stabilize-tree-dnd/quickstart.md`.
- [X] T031 Run the repository-wide `pnpm test` gate and `git diff --check` for the implementation and `specs/084-stabilize-tree-dnd/tasks.md` before handoff.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 is required before importing the direct DnD packages.
- **Foundational (Phase 2)**: T002 → T003 → T004 → T005; this phase blocks all user stories.
- **User Story 1 (Phase 3)**: T006 and T007 can proceed in parallel after T005; T008 follows T007; T009–T011 follow T008; T012–T013 follow the runtime routing.
- **User Story 2 (Phase 4)**: T014 follows T005; T015–T017 can proceed in parallel after the failing fixture; T018 follows those migrations.
- **User Story 3 (Phase 5)**: T019–T021 can proceed in parallel after the P1 transition seam; T022 follows the verification cases; T023 follows the transition hardening.
- **User Story 4 (Phase 6)**: T024 follows the tree migrations; T025–T027 can proceed in parallel after the contract regression.
- **Polish (Phase 7)**: T028–T031 follow the desired story phases and are required before handoff.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on the Foundational phase and is the MVP increment.
- **User Story 2 (P1)**: Depends only on the Foundational phase because File Manager is migrated there; it can proceed independently of the runtime-layout implementation in User Story 1.
- **User Story 3 (P2)**: Depends on the transition interface and runtime routing delivered by User Story 1; it can proceed independently of the remaining tree migrations once those seams exist.
- **User Story 4 (P2)**: Depends on the Foundational phase and the complete tree inventory from User Story 2 so the maintainer regression covers every disposition.

### Parallel Opportunities

- T006 and T007 are independent verification tasks in different files.
- T015, T016, and T017 are independent surface migrations in different files.
- T019, T020, and T021 are independent verification tasks in different files.
- T025, T026, and T027 are independent documentation/ownership tasks in different files.
- The four React Arborist callers are intentionally isolated so future tree additions can follow the same seam without changing manager construction.

## Parallel Execution Examples

### User Story 1

```text
After T005, run T006 in packages/blue-app/src/renderer/browser/workbench-tree-movement.browser.test.tsx
and T007 in packages/blue-app/src/renderer/tests/workbench-auxiliary.test.ts together.
After T008, route the store actions in T009 and T010 sequentially before completing T012.
```

### User Story 2

```text
After T014 exposes the failing coexistence case, run T015, T016, and T017 together;
they modify separate tree callers. Finish with T018 in the shared browser fixture.
```

### User Story 3

```text
After User Story 1, run T019, T020, and T021 together across the browser, auxiliary,
and persistence test files. Then implement the remaining lifecycle hardening in T022–T023.
```

### User Story 4

```text
After T024, run T025, T026, and T027 together because the ownership comments, documentation,
and native Libraries disposition touch separate files.
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and the Foundational phase.
2. Complete User Story 1, including the real Libraries/File Manager movement browser regression.
3. Stop and validate the 20-cycle edge-movement journey independently.
4. Demonstrate or ship the MVP before adding the remaining tree surfaces.

### Incremental Delivery

1. Add User Story 2 to migrate every remaining Arborist tree and verify same-document and popout coexistence.
2. Add User Story 3 to protect live panel sessions and saved-layout compatibility across all presentations.
3. Add User Story 4 to publish the integration rule and regression guard.
4. Complete Polish and the repository-wide validation gates.

### Notes

- No `@blue/data`, main-process, preload, Java-runtime, IPC, project XML, library database, or path-boundary work is required; the plan explicitly marks those compatibility surfaces out of scope.
- `LibraryTree.tsx` remains native HTML drag/drop and is tested/documented as a non-participant rather than migrated to React DnD.
- `applyAuxiliaryLayout` remains available for startup, reset, and unrecoverable legacy hydration; runtime actions must use the transition contract.

## Phase 8: Convergence

- [X] T032 Extend the real multi-tree coexistence browser fixture to mount Presets Manager beside File Manager and exercise supported selection, expansion, rename, and drag interactions across the required repeated open/close cycles per FR-010
- [X] T033 Replace the synthetic Libraries panel in the Dockview movement fixture with the production native Libraries tree and verify its native drag payload and interaction behavior after the 20-cycle edge movement journey per FR-010
- [X] T034 Reconcile Dockview maximized state in both directions, including `exitMaximized()` during restore, and add a live maximize-to-restore regression per FR-009
- [X] T035 Make auxiliary close and reopen transitions atomic so drag deferral, preflight failure, and runtime rollback preserve the live panel, canonical layout, and closed-panel origin metadata per FR-008
- [X] T036 Extend movement browser assertions to verify unaffected selection, expansion, scroll, focus, presentation, and size when the target moves across all three edges, including same-edge movement per SC-004
- [X] T037 Exercise real Arborist and native Libraries drag interruption or cancellation during an auxiliary panel transition, then verify the next drag and layout move recover cleanly per FR-011
