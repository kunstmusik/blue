# Tasks: Window Float/Dock Parity

**Input**: Design documents from `/specs/055-window-float-dock-parity/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (tab-command-contract.md, workbench-window-ipc.md)

**Tests**: INCLUDED — FR-032 explicitly requires automated coverage for Float, Float Group, Dock, Dock Group, context-menu enablement, tab shifting, close scope, layout restore, offscreen correction, reset behavior, Window-menu reveal routing, shared-session behavior, and duplicate-prevention. Test-first (RED) tasks precede implementation in each story phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. User stories (from spec.md): US1 Float (P1), US2 Dock (P1), US3 Tab Context Menu (P1), US4 Persist Layout (P2), US5 Tab Group Management (P2), US6 Reveal Panels (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- This feature lives entirely in the `@blue/app` package of the monorepo.
- Shared browser-safe contracts: `packages/blue-app/src/shared/`
- Electron main process: `packages/blue-app/src/main/`
- Electron preload: `packages/blue-app/src/preload/`
- Renderer (React/Dockview): `packages/blue-app/src/renderer/`
- Test files are co-located as `*.test.ts` (Vitest 4.x), matching existing convention.
- No changes to `@blue/data`, `@blue/engine-client`, or Java runtime packages (constitution constraint).

---

## Phase 1: Setup (Shared Browser-Safe Contracts)

**Purpose**: Establish the pure shared TypeScript contract module that every later phase imports. This module MUST stay browser-safe (no Node/Electron built-ins) so main, preload, and renderer can all import it.

- [x] T001 Create workbench window IPC + docking-origin contract module in `packages/blue-app/src/shared/workbench-window-contract.ts` implementing the channels/types in `specs/055-window-float-dock-parity/contracts/workbench-window-ipc.md`: `WorkbenchWindowRegisterRequest/Response`, `WorkbenchWindowOwnershipUpdate`, `WorkbenchRevealPanelRequest/Result`, `WorkbenchWindowCloseRequest/Result`, `DockFloatingGroupRequest/Result`, `ProjectDocumentUpdatedEvent`, plus channel-name string constants
- [x] T002 [P] Add the `DockingOrigin` and `FloatingWorkbenchWindow` data shapes to `packages/blue-app/src/shared/workbench-window-contract.ts` per `specs/055-window-float-dock-parity/data-model.md` (originGroupId, originPanelOrder, originActivePanelId, originMode, originIndex, auxiliarySeedGroupId, edge, presentation, dockedSize, slideoutSize, capturedAt; FloatingWorkbenchWindow: windowId, popoutGroupId, panelIds, activePanelId, bounds, displayState, projectSessionId)
- [x] T003 [P] Add pure validation helpers to `packages/blue-app/src/shared/workbench-window-contract.ts`: `isValidDockingOrigin(candidate): boolean`, `normalizeFloatingOriginMap(candidate): Record<string, DockingOrigin>`, and `isOnScreenBounds(bounds, workAreas): boolean` (browser-safe, finite-number checks)
- [x] T004 [P] Write Vitest tests for the shared contract validation helpers in `packages/blue-app/src/shared/workbench-window-contract.test.ts` covering valid/invalid origins, missing fields, non-finite bounds, and offscreen-bounds detection

**Checkpoint**: Shared contract compiles standalone (`pnpm --filter @blue/app build` should still pass). No Electron code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented: the layout envelope migration, the main-process workbench window registry, the preload IPC bridge, and shared-session broadcast plumbing.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Layout Envelope Migration

- [x] T005 Add RED Vitest tests in `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.test.ts` for a new workbench layout envelope version 6: parsing/migration from version 5, round-trip of `floatingOrigins: Record<popoutGroupId, DockingOrigin>`, and safe fallback to defaults when version < 6 or when floating-origin data is missing/invalid (FR-030)
- [x] T006 Bump the workbench layout envelope to version 6 in `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts`: add `floatingOrigins` to the v6 snapshot type, add a v5→v6 migrator, extend the v5/v4/v3/v2 parsers to normalize through to v6, and keep `createDefault`/serialize producing version 6 (depends on T002)

### Workbench Window Registry (main process)

- [x] T007 Add RED Vitest tests in `packages/blue-app/src/main/workbench-window-manager.test.ts` for a new `WorkbenchWindowManager`: register main/floating windows, update ownership, resolve reveal target (prefer live owner over duplicate), deny/allow close per panel close eligibility, and remove destroyed windows from the registry
- [x] T008 Implement `WorkbenchWindowManager` in `packages/blue-app/src/main/workbench-window-manager.ts`: in-memory registry keyed by `windowId`, methods `register/updateOwnership/resolveReveal/requestClose/dispose`, close-policy delegation matching tab close rules, and destroyed-window cleanup hooks (depends on T001)

### Preload IPC Bridge

- [x] T009 Extend `packages/blue-app/src/preload/preload.ts` `blueAPI` with workbench-window IPC: `registerWorkbenchWindow`, `updateWorkbenchOwnership`, `revealWorkbenchPanel`, `requestWorkbenchWindowClose`, `dockFloatingGroup`, and `onProjectDocumentUpdated` listener, wired to the channel constants from T001
- [x] T010 Wire the corresponding `ipcMain.handle`/`ipcMain.on` handlers in `packages/blue-app/src/main/main.ts` (or a new `packages/blue-app/src/main/workbench-window-host.ts` imported by `main.ts`) that delegate to `WorkbenchWindowManager` (depends on T008)

### Shared-Session Broadcast Plumbing

- [x] T011 [P] Update the existing project/playback/layout-reset event senders in `packages/blue-app/src/main/main.ts` (`project-loaded`, `project-closed`, `playback-status`, `playback-clock`, `playback-error`, `window-layout:reset`) to broadcast to every registered workbench window (via `WorkbenchWindowManager`) instead of only `mainWindow.webContents`
- [x] T012 [P] Add a `project-document-updated` broadcast in `packages/blue-app/src/main/main.ts` (and the mutation response path) that emits `ProjectDocumentUpdatedEvent` (sessionId, revision, snapshot, sourceWindowId) to every registered workbench renderer (FR-010)

**Checkpoint**: Foundation ready — registry, IPC bridge, broadcast plumbing, and v6 envelope all testable. User story implementation can now begin.

---

## Phase 3: User Story 3 — Java-Style Tab Context Menu (Priority: P1)

**Goal**: Every tab shows the same practical right-click actions Java Blue exposes, with correct state-dependent enablement, computed from the tab that opened the menu.

**Independent Test**: Right-click tabs in editor, properties, output, minimized/auxiliary, and floating contexts and verify labels, disabled states, and command results match the expected state of the selected tab. The pure helper is unit-tested without rendering.

**Note**: This story is placed before US1/US2 because Float and Dock are surfaced as context-menu commands; the pure command-state helper is the menu enablement layer Float/Dock wire into.

### Tests for User Story 3 (RED first)

- [x] T013 [P] [US3] Write Vitest tests in `packages/blue-app/src/renderer/components/workbench/tab-command-state.test.ts` implementing the contract in `specs/055-window-float-dock-parity/contracts/tab-command-contract.md`: first-tab (Shift Left disabled), last-tab (Shift Right disabled), middle tab, single tab, non-closable tab, docked tab (Float/Float Group enabled, Dock/Dock Group disabled), floating tab (Dock/Dock Group enabled, Float/Float Group disabled), minimized/slideout floatability, auxiliary view-mode commands, and editor document tab-group commands

### Implementation for User Story 3

- [x] T014 [US3] Implement the pure helper `computeTabCommandState(context: TabCommandContext): TabCommandState` in `packages/blue-app/src/renderer/components/workbench/tab-command-state.ts` per the contract's Required Command Rules (depends on T001 for the DockingOrigin/`canDockFromDetachedState` shape)
- [x] T015 [US3] Refactor `WorkbenchTabMenu` in `packages/blue-app/src/renderer/components/workbench/AuxiliaryTab.tsx` to build the Radix Context Menu from `computeTabCommandState` output instead of inline booleans; map each `TabCommandDescriptor` to a `ContextMenu.Item` with `disabled={!enabled}`, preserving existing handlers and adding the Float/Dock dispatch hooks (FR-012 through FR-019)
- [x] T016 [US3] Ensure the context menu is available on every visible tab surface by confirming `AuxiliaryTab` is the registered tab renderer for editor, auxiliary, bottom/output, properties, edge-managed, slide-out, and floating-window tab strips in `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx`; register it on any tab strip that lacks it (FR-011)

**Checkpoint**: Tab context menu parity for command list + enablement is complete and independently testable. Float/Dock items render but Float still uses the old in-workbench overlay and Dock is inert until US1/US2.

---

## Phase 4: User Story 1 — Float A Tab Group Into A Separate Window (Priority: P1) 🎯 MVP

**Goal**: Float moves the selected tab into a separate OS-level application window frame, while Float Group moves the selected tab's containing group into a separate OS-level application window frame (Dockview popout), preserving tabs, order, active tab, titles, content, selections, and panel identity.

**Independent Test**: Right-click a tab in a multi-tab editor or auxiliary group, choose Float, and verify only the selected tab appears in a separate movable/resizable OS window. Repeat with Float Group and verify the whole group appears in a separate window, is removed from its origin, and preserves all tab state. Verify a floated tab's menu enables Dock/Dock Group and disables Float/Float Group.

### Tests for User Story 1 (RED first)

- [x] T017 [P] [US1] Add RED Vitest tests in `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.test.ts` for `captureDockingOrigin(...)` producing a complete `DockingOrigin` from a group context (group id, panel order, active panel, mode, edge, presentation, auxiliary seed, sizes) and for recording it into the v6 envelope `floatingOrigins` keyed by popout group id

### Implementation for User Story 1

- [x] T018 [US1] Implement `captureDockingOrigin` and `recordFloatingOrigin` in `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts` (or a new `packages/blue-app/src/renderer/components/workbench/floating-origin.ts`) that snapshot group/mode/edge/presentation/order/active/seed into a `DockingOrigin` and merge it into the layout envelope (depends on T002, T006)
- [x] T019 [US1] Replace the old `props.containerApi.addFloatingGroup(...)` call path in `packages/blue-app/src/renderer/components/workbench/AuxiliaryTab.tsx` with store-backed `floatPanel` and `floatGroup` actions using Dockview `addPopoutGroup(...)`: `Float` detaches only the selected panel, `Float Group` detaches the containing group, both capture origin metadata and report ownership (depends on T018, T009)
- [x] T020 [US1] On popout-group creation/open, register the floating renderer window with main via `registerWorkbenchWindow({ role: 'floating', popoutGroupId, projectSessionId })` and send `updateWorkbenchOwnership` whenever the layout, active tab, or popout membership changes in `packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx` (FR-003, FR-004, FR-009, FR-010; depends on T009, T010)
- [x] T021 [US1] Ensure Float is enabled for editor, output, properties, and auxiliary panels, and Float Group for eligible groups, unless a specific panel type is documented non-floatable by exposing `isFloatable` from the panel registry/metadata consumed by `computeTabCommandState` in `packages/blue-app/src/renderer/components/workbench/tab-command-state.ts` (FR-016, FR-017; depends on T014)

**Checkpoint**: Float opens a separate OS-level window frame for representative editor, output, properties, and auxiliary groups (SC-001). Panel identity is preserved (no duplicates). MVP demonstrable.

---

## Phase 5: User Story 2 — Dock A Floating Group Back To Its Workbench Location (Priority: P1)

**Goal**: Dock returns a floated tab and Dock Group returns a floated group to the previous group/edge/presentation/order when valid, or to the appropriate default mode fallback when not. Closing a floating window/tab follows the same close rules as docked.

**Independent Test**: Float a tab and Float Group from each major workbench area, use Dock or Dock Group from the floating tab context menu, and verify the selected tab or group returns to its previous group, edge, presentation, and relative order when valid, or the default mode when not.

### Tests for User Story 2 (RED first)

- [x] T022 [P] [US2] Add RED Vitest tests for a `dockFloatingGroup(popoutGroupId)` reducer/selector in `packages/blue-app/src/renderer/components/workbench/auxiliary-layout.test.ts`: valid origin restores prior group/edge/presentation/order; invalid origin (origin group gone) falls back to panel registry default mode; missing panel ids are skipped while valid siblings are kept; the floating window ends with no remaining panels (no duplicates)

### Implementation for User Story 2

- [x] T023 [US2] Implement the Dock and Dock Group commands in `packages/blue-app/src/renderer/components/workbench/AuxiliaryTab.tsx` and `workbench-store.ts`: `Dock` restores the selected floating panel to its origin when possible; `Dock Group` restores the group to its origin or applies the panel-registry default-mode fallback, re-selects the prior active tab, and removes or updates the floating-origin entry from the envelope (depends on T018)
- [x] T024 [US2] Wire the `dockFloatingGroup` IPC path end-to-end: renderer handler calls `dockFloatingGroup({ popoutGroupId, requestedPanelId })`, main forwards through `WorkbenchWindowManager` (or renderer resolves locally and reports result) per `workbench-window-ipc.md` (depends on T009, T010)
- [x] T025 [US2] Intercept floating-window close (Electron `close` event on popout BrowserWindow) through `WorkbenchWindowManager.requestClose` so it consults tab close eligibility for every hosted panel, preventing or prompting the close the same way docked tabs would; map window-close to the equivalent of closing those tabs (FR-009, US2 acceptance 6 & 7; depends on T008, T010)

**Checkpoint**: Dock returns floated groups correctly and floating-window close respects docked close policy (SC-002).

---

## Phase 6: User Story 4 — Preserve Layout Across Restarts (Priority: P2)

**Goal**: Floated and docked window state survives app restart: saved popout bounds, active tabs, docked locations, and origins restore with valid on-screen bounds; Reset Windows clears floating state.

**Independent Test**: Float groups from multiple areas, move/resize their windows, restart, and verify windows, docked groups, active tabs, and safe on-screen bounds restore. Reset Windows clears floating state without touching the project.

### Tests for User Story 4 (RED first)

- [x] T026 [P] [US4] Add RED Vitest tests in `packages/blue-app/src/shared/window-layout-settings.test.ts` (or `workbench-window-contract.test.ts`) for offscreen-bounds correction: saved bounds intersecting no work area are corrected to a visible position on an available display; bounds smaller than the minimum are clamped (FR-022; depends on T003)

### Implementation for User Story 4

- [x] T027 [US4] Persist floating workbench state across restart by serializing Dockview `popoutGroups` + the supplemental `floatingOrigins` map + active tabs + popout bounds into the v6 `workbench.serializedLayout` envelope stored via the existing `updateWindowLayout({ type: 'workbench-layout' })` path (FR-023; depends on T006, T009)
- [x] T028 [US4] On app start, restore floating windows from the serialized envelope: re-create popout groups with Electron as normal app windows using the app preload + popout route, validate/correct bounds against current displays via `screen.getAllDisplays()` work areas before `BrowserWindow` show, and skip panels no longer in the registry (FR-024, FR-030; depends on T003, T020)
- [x] T029 [US4] Extend Reset Windows in `packages/blue-app/src/main/main.ts` (and the renderer reset handler) so `window-layout:reset` clears floated-window state, dock-back origins, saved floating bounds, and related presentation state while preserving project data and unrelated program settings (FR-025; depends on T011)

**Checkpoint**: Two floating windows restore with valid bounds after restart; Reset Windows clears floating state and leaves the project untouched (SC-005, SC-006).

---

## Phase 7: User Story 5 — Manage Tab Groups Without Losing Panel Identity (Priority: P2)

**Goal**: Group-level and multi-tab actions behave predictably so panels never duplicate, disappear, or return to the wrong mode: Close All, Close Other, Maximize/Restore, Shift.

**Independent Test**: Use Close Other/Close All/Maximize/Restore/Shift in groups containing multiple editor and auxiliary tabs; verify each panel has exactly one visible/restorable instance and each group keeps its expected active tab.

### Tests for User Story 5 (RED first)

- [x] T030 [P] [US5] Add RED Vitest tests in `packages/blue-app/src/renderer/components/workbench/tab-command-state.test.ts` asserting `canCloseAll`/`canCloseOther` scope flags and that Shift Left/Right edge-disablement is derived from `groupPanelIds` position (FR-019, FR-020, FR-021; depends on T013)

### Implementation for User Story 5

- [x] T031 [US5] Harden `handleCloseAll` and `handleCloseOther` in `packages/blue-app/src/renderer/components/workbench/AuxiliaryTab.tsx` to operate strictly within the context tab's own group (not across workbench groups or other floating windows), skipping non-closable panels, and to keep the active tab stable where possible (FR-021; depends on T015)
- [x] T032 [US5] Ensure Maximize and Restore preserve the selected tab, group membership, and the prior presentation state needed to return to the original layout by storing/restoring pre-maximize presentation in `packages/blue-app/src/renderer/components/workbench/AuxiliaryTab.tsx` and `workbench-store.ts` (FR-022; depends on T015)
- [x] T033 [US5] Confirm Shift Left/Right reorder within the current group only without changing panel identity/content/docking mode by routing the existing `shiftPanel` through `computeTabCommandState` enablement in `packages/blue-app/src/renderer/components/workbench/AuxiliaryTab.tsx` (FR-018; depends on T015)

**Checkpoint**: Group-level commands are scope-correct and identity-stable (SC-003, SC-004).

---

## Phase 8: User Story 6 — Reveal Panels Across Docked And Floating Windows (Priority: P2)

**Goal**: Window menu entries and reveal commands focus the existing panel wherever it lives (docked, floating, minimized, slide-out, maximized) instead of opening a duplicate; panels not currently open open in their default Java Blue-inspired mode.

**Independent Test**: Float a multi-tab group, select a different tab in the main window, invoke reveal for each floated tab, and verify the existing floating window is focused and the requested tab is selected rather than duplicated.

### Tests for User Story 6 (RED first)

- [x] T034 [P] [US6] Extend `packages/blue-app/src/main/workbench-window-manager.test.ts` with RED cases for `resolveReveal(panelId)`: live floating owner → focus owner + select tab; no owner → route to main workbench default-mode open; destroyed owner → treated as no owner (depends on T007)

### Implementation for User Story 6

- [x] T035 [US6] Update the Window menu `focus-panel` handlers in `packages/blue-app/src/main/main.ts` (and `application-menu.ts`) to route through `WorkbenchWindowManager.resolveReveal` instead of unconditionally `mainWindow.webContents.send('native-menu-command', { type: 'focus-panel', panelId })`: focus the owning OS window first, then send the reveal message to select the tab (FR-026, FR-027; depends on T008, T011)
- [x] T036 [US6] Handle the reveal message in the renderer (`packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx` native-menu-command listener) so that if the target panel is floating the owning popout window is focused and the tab selected, if minimized/slide-out it follows existing edge behavior, and if absent it opens in the panel registry default mode (FR-028, FR-029; depends on T020)
- [x] T037 [US6] Ensure no reveal flow creates a duplicate logical panel instance by checking the registry before opening in `WorkbenchWindowManager.resolveReveal` and the renderer open path (FR-004, FR-026, SC-003; depends on T035)

**Checkpoint**: Window menu reveal focuses existing floating/minimized/slide-out panels and selects the requested tab without duplication (SC-007).

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Parity classification, shared-session robustness, and final verification across all stories.

- [x] T038 [P] Document the Java/NetBeans tab-command classification (Float, Float Group, Dock, Dock Group, Clone, New Document Tab Group, Collapse Document Tab Group, Close Group, Minimize, Minimize Group, Move, Move Group, Size Group, New Window) as implemented/visible-disabled/omitted in `specs/055-window-float-dock-parity/parity-review.md` per the tab-command-contract table
- [x] T039 [P] Verify shared project session across windows: a mutation from a floating renderer applies to all workbench windows (same sessionId/revision) and stale sessions are ignored, covered by a focused test in `packages/blue-app/src/main/workbench-window-manager.test.ts` or a new broadcast test (FR-011, FR-032; depends on T012)
- [x] T040 [P] Cover the edge cases from `spec.md` (dock after origin removed, last-tab float leaving empty group, float while maximized/minimized/slide-out, multiple floating windows, offscreen saved location, mixed close eligibility, focus mismatch, restricted commands, reset with floats open, legacy v≤5 data) as Vitest cases in the relevant `*.test.ts` files (spec Edge Cases; depends on T006, T018)
- [x] T041 Run focused verification: `pnpm --filter @blue/app test -- tab-command-state`, `-- workbench-window-manager`, `-- window-layout-settings`, `-- auxiliary-layout`, `-- application-menu`
- [x] T042 Run full verification: `pnpm --filter @blue/app test` and `pnpm --filter @blue/app build`
- [x] T043 Perform the manual parity pass in `specs/055-window-float-dock-parity/quickstart.md` and record results in `specs/055-window-float-dock-parity/parity-review.md` (FR-031, SC-008)
- [x] T044 [P] Update `AGENTS.md` recent-changes note to reflect SPEC 055 completion
- [x] T045 [US6] Capture a durable close origin for each closable editor/auxiliary panel, route every tab-close affordance through the workbench store, and restore that origin on Window-menu reopen; preserve auxiliary edge/presentation/size and editor tab index/split placement without retaining empty Dockview groups (FR-028, FR-034, SC-009).
- [x] T046 [US2] Remove Dockview's hidden auxiliary popout reference before rebuilding its edge and restore the Float-captured controlled size so Dock never leaves a blank splitter or collapses the panel width/height (FR-005, FR-006, SC-010).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. Produces the shared contract module.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories. Produces the v6 envelope, main registry, preload bridge, and broadcast plumbing.
- **User Stories (Phase 3–8)**: All depend on Phase 2 completion.
- **Polish (Phase 9)**: Depends on all targeted user stories being complete.

### User Story Dependencies

- **US3 (Phase 3, P1)**: Depends on Phase 2. The pure command-state helper is the menu layer Float/Dock wire into, so US3 is executed before US1/US2.
- **US1 (Phase 4, P1)**: Depends on Phase 2 AND US3 (menu Float item + `isFloatable`). MVP story.
- **US2 (Phase 5, P1)**: Depends on US1 (Floating groups + stored `DockingOrigin` must exist before Dock can use them).
- **US4 (Phase 6, P2)**: Depends on US1 (persisting popout state that Float produces) and Phase 2 (v6 envelope, reset).
- **US5 (Phase 7, P2)**: Depends on US3 (command-state enablement drives scope-correct handlers).
- **US6 (Phase 8, P2)**: Depends on US1 (ownership reporting from floating windows) and Phase 2 (registry + reveal routing).

### Within Each User Story

- Tests (RED) MUST be written and FAIL before implementation.
- Contract/pure helpers before React/UI wiring.
- Main-process/IPC before renderer integration where a round-trip is involved.
- Story complete and independently testable before the next priority.

### Parallel Opportunities

- Phase 1: T002, T003, T004 can run in parallel once T001 exists (all different concerns in the same new module — coordinate the single file or split into focused edits).
- Phase 2: T011 and T012 (broadcast plumbing) can run in parallel with the registry/envelope tasks since they touch different regions of `main.ts`.
- Phase 3: T013 (tests) is parallel-safe.
- Phase 4/6/7: their RED test tasks are parallel-safe.
- Phase 9: T038, T039, T040, T044 are parallel-safe.

---

## Parallel Example: Phase 2

```bash
# Once T001–T004 land, launch independent foundational tracks together:
Task T005/T006: "v6 workbench layout envelope migration in auxiliary-layout.ts"
Task T007/T008: "WorkbenchWindowManager registry in main/workbench-window-manager.ts"
Task T009/T010: "preload + main IPC handlers for workbench-window channels"
Task T011:       "broadcast project/playback/layout-reset to all workbench windows"
Task T012:       "project-document-updated broadcast"
```

---

## Parallel Example: Phase 3 (US3)

```bash
# Write the RED contract test first, then implement:
Task T013: "tab command-state tests in tab-command-state.test.ts"
Task T014: "computeTabCommandState helper in tab-command-state.ts"
Task T015: "refactor AuxiliaryTab.tsx to render from command state"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3)

1. Complete Phase 1: Setup (shared contract).
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: US3 (tab context menu parity + enablement).
4. Complete Phase 4: US1 (selected-tab Float and Float Group into separate OS windows).
5. **STOP and VALIDATE**: Float/Float Group open real separate windows; menu shows Dock/Dock Group for floated tabs; panel identity preserved. Demo ready.

### Incremental Delivery

1. Setup + Foundational → Foundation ready.
2. - US3 → Context-menu parity testable.
3. - US1 → Float/Float Group MVP demonstrable (separate OS windows).
4. - US2 → Dock/Dock Group round-trip complete (the core Float/Dock loop).
5. - US4 → Layout survives restart; Reset clears floating state.
6. - US5 → Group commands scope-correct and identity-stable.
7. - US6 → Window menu reveal focuses existing panels without duplication.
8. Polish → Parity review + full test/build.

---

## Notes

- [P] tasks = different files/regions, no dependencies on incomplete tasks.
- [Story] label maps each task to its user story for traceability.
- Every user story is independently completable and testable.
- Verify RED tests fail before implementing; verify GREEN after.
- Commit after each task or logical group (optional git hook `/speckit.git.commit`).
- Stop at any checkpoint to validate a story independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
- Constitution constraints: no `@blue/data` changes, no `.blue` XML changes, shared contracts stay browser-safe, Electron APIs stay in main/preload/renderer-app layers.
