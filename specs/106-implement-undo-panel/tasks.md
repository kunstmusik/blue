# Tasks: Undo History Panel

**Input**: Design documents from `/specs/106-implement-undo-panel/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/history-entries-ipc.md, contracts/undo-panel-registry.md, quickstart.md — all complete.

**Verification**: Contract, integration, UI, and read-only-history verification tasks are included per the constitution and plan; this feature introduces no new durable project writer (accounted for in Phase 2), so its history obligation is the side-effect-free guarantee, not new commit→undo→redo suites (which remain owned by spec 103).

**Organization**: Tasks grouped by user story (spec.md Stories 1–4) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Paths are relative to the repository root; work happens in `.worktrees/106-implement-undo-panel`.

---

## Phase 1: Setup

**Purpose**: Baseline the worktree before any change.

- [x] T001 Baseline the worktree: run `pnpm install`, `pnpm --filter @blue/app test`, and `pnpm --filter @blue/app build:main` from `.worktrees/106-implement-undo-panel` and confirm green before starting (no file changes) — note: a full `pnpm build` was required first so workspace dependency artifacts (`@blue/data` types/dist) exist in the fresh worktree

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The entries data path (shared contract → main → preload → renderer store) that every user story consumes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `PROJECT_HISTORY_ENTRIES_CHANNEL`, `ProjectHistoryEntrySummary`, `ProjectHistoryEntriesSnapshot`, and `ProjectHistoryEntriesResponse` (request reuses `ProjectHistoryReadRequest`) to packages/blue-app/src/shared/project-history.ts exactly per contracts/history-entries-ipc.md
- [x] T003 [P] Implement `readEntries()` in packages/blue-app/src/main/project-history.ts beside `read()` (~line 879): oldest-first summaries of `getEntries()` excluding `record`/patches/hints, with `documentId`, `revision`, `cursor` per data-model.md
- [x] T004 Register the entries IPC handler in packages/blue-app/src/main/main.ts beside the `PROJECT_HISTORY_READ_CHANNEL` handler (~line 5941): validate request, fence `documentId` against the active session, return the snapshot; read-only, so no `validateHistoryRequestSender` ownership check
- [x] T005 [P] Expose `readProjectHistoryEntries(request)` via `ipcRenderer.invoke` in packages/blue-app/src/preload/preload.ts (history block ~lines 784–825) and type it on `window.blueAPI` in packages/blue-app/src/renderer/types/global.d.ts
- [x] T006 [P] Extend packages/blue-app/src/preload/project-history-api.test.ts: `readProjectHistoryEntries` invokes `project-history:entries` with the passed request and returns the response union
- [x] T007 Add the entries snapshot store to packages/blue-app/src/renderer/hooks/use-project-history.ts: `setProjectHistoryEntries`/`getProjectHistoryEntries`/`useProjectHistoryEntries()` mirroring the projection singleton pattern, with fingerprint-keyed refresh (`${revision}:${cursor}:${length}`) and an in-flight guard
- [x] T008 Seed entries on project load and clear on close/replace at the projection lifecycle points in packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts (~lines 203, 220–227)
- [x] T009 [P] Extend packages/blue-app/src/main/project-history.test.ts with `readEntries` coverage: summary fields, oldest-first order, memento/patch exclusion, cursor across commit→undo→redo, retention eviction, gesture merge = one entry (FR-002/003/008/010; SC-005)
- [x] T010 [P] Extend packages/blue-app/src/main/global-project-history.integration.test.ts: entries channel returns a snapshot for the active document, `invalid` on `documentId` mismatch, and is side-effect-free (no new entries, no revision/dirty change) (FR-006/007; contracts/history-entries-ipc.md)
- [x] T011 Record the project-history obligation outcome — no new durable project writer exists in this feature; panel dispatch must reuse `executeProjectUndo`/`executeProjectRedo` — as a short note appended to specs/106-implement-undo-panel/research.md §4 (constitution accounting for writer-free features)

**Checkpoint**: Entries data path complete and tested; user story work can begin.

---

## Phase 3: User Story 1 - Open the panel from the Properties menu (Priority: P1) 🎯

**Goal**: The panel is closed by default, appears in Window → Properties, docks with the properties group, and persists placement through the existing layout system.

**Independent Test**: Reset Windows → restart → panel absent; Window → Properties → Undo History opens it docked right; move/minimize → restart → placement restored (quickstart scenarios 1, 2, 11).

### Verification for User Story 1

- [x] T012 [P] [US1] Extend packages/blue-app/src/main/application-menu.test.ts (~lines 388–411): the Window → Properties submenu lists "Undo History" and its item click calls `onFocusPanel('UndoHistoryTopComponent')` (FR-001)
- [x] T013 [P] [US1] Assert registry/seed invariants: descriptor `mode: 'properties'` + `openAtStartup: false`; id excluded from default seeded auxiliary groups and present in `properties-main` seed ordering — extend auxiliary-layout-model tests where panel sets are enumerated, otherwise add a focused test beside packages/blue-app/src/renderer/components/workbench/auxiliary-layout-model.ts (FR-001, FR-013)

### Implementation for User Story 1

- [x] T014 [P] [US1] Add the `UndoHistoryTopComponent` descriptor (title "Undo History", `mode: 'properties'`, `openAtStartup: false`, `auxiliaryGroupId: 'properties-main'`, `auxiliaryRailLabel: 'Undo History'`) to packages/blue-app/src/shared/workbench-menu.ts per contracts/undo-panel-registry.md
- [x] T015 [P] [US1] Append `'UndoHistoryTopComponent'` to `AUXILIARY_SEED_DEFINITIONS['properties-main'].panelIds` in packages/blue-app/src/renderer/components/workbench/auxiliary-layout-model.ts
- [x] T016 [US1] Create the panel shell packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.tsx: fills its container (presentation-agnostic for docked/slideout/maximized/floated), no-project and no-entries empty states, `text-role-*` roles + `cn()` + Tailwind per packages/blue-app/AGENTS.md
- [x] T017 [US1] Wire `case 'UndoHistoryTopComponent': return <UndoHistoryPanel />;` in packages/blue-app/src/renderer/components/workbench/WorkbenchPanelContent.tsx
- [x] T018 [US1] Create packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.test.tsx with initial cases: renders both empty states; `WorkbenchPanelContent` resolves the id to the panel (not `PlaceholderPanel`)

**Checkpoint**: Story 1 independently demoable — discoverable, default-closed, persistent panel.

---

## Phase 4: User Story 2 - Read the edit history as a stack (Priority: P1)

**Goal**: Most-recent-first labeled list with a position divider between applied and undone edits, saved marker, and empty states.

**Independent Test**: Make three labeled edits, undo one → list still shows all three, top row visually undone, divider below it, saved marker on the save-point row (quickstart scenarios 3, 4, 6).

### Verification for User Story 2

- [x] T019 [P] [US2] Extend packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.test.tsx: most-recent-first rendering from a fixture snapshot; applied rows normal and redoable rows muted; divider row at the cursor; saved marker when `afterStateId === savedStateId`; entry label + time columns (FR-002/003/009/012; SC-001)
- [x] T020 [P] [US2] Add entries-store tests beside packages/blue-app/src/renderer/hooks/use-project-history.ts coverage: seeded on load, cleared on close/replace, refreshed on fingerprint change, last-write-wins on overlapping fetches (FR-006/011)

### Implementation for User Story 2

- [x] T021 [US2] Implement the list in packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.tsx: consume `useProjectHistoryEntries()`; reverse for display; row shows label + `HH:MM:SS` time; divider ("Current") at the cursor; muted styling for `index >= cursor`; saved marker from the projection's `savedStateId`
- [x] T022 [US2] Verify display math lives only in the renderer: packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.tsx derives `applied = index < cursor` from the snapshot and never recomputes eviction positions (asserted via the T019/T020 fixtures; no main-process display logic added)

**Checkpoint**: Stories 1 and 2 together form the minimum useful feature (panel + readable stack).

---

## Phase 5: User Story 3 - Undo and redo from the panel (Priority: P1)

**Goal**: Header Undo/Redo buttons with identical semantics, labels, and availability to the application-wide commands.

**Independent Test**: Click Undo twice, Redo once → one action per click, list/divider update, Edit-menu labels and enablement always agree; buttons disable at history bounds (quickstart scenario 5).

### Verification for User Story 3

- [x] T023 [P] [US3] Extend packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.test.tsx: buttons disabled exactly when `canUndo`/`canRedo` are false; clicks dispatch the history hook's `undo()`/`redo()` (mocked), never `window.blueAPI.undoProjectHistory` directly; accessible names/tooltips render `` Undo ${undoLabel} `` / `` Redo ${redoLabel} `` matching the Edit-menu wording (FR-004/005)

### Implementation for User Story 3

- [x] T024 [US3] Implement the header button row in packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.tsx: calls `useProjectHistory().undo()/.redo()` (routes through `executeProjectUndo`/`executeProjectRedo` in packages/blue-app/src/renderer/lib/history-scope-router.ts — settlement, fencing, and reconciliation inherited, no new dispatch code)
- [x] T025 [US3] Confirm branch-discard display: after undo + new commit, the discarded redo rows disappear from the list in the same update (extend the T019 fixture in packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.test.tsx with a post-commit snapshot)

**Checkpoint**: All P1 stories complete — panel, list, and buttons usable end-to-end.

---

## Phase 6: User Story 4 - Trust the list across windows, merges, limits (Priority: P2)

**Goal**: The open panel stays correct for popout edits, typing gestures, retention eviction, and project switches.

**Independent Test**: Edit from a floated panel's OS window → row appears without refresh; short typing burst → one row; exceed retention → footnote + dropped oldest rows; open another project → only its history (quickstart scenarios 7–10).

### Verification for User Story 4

- [x] T026 [P] [US4] Extend panel/store tests: retention footnote renders when `retentionStatus` is `at-entry-limit`/`at-byte-limit`; entries clear on project close and seed for the newly opened document (packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.test.tsx + entries-store tests) (FR-010/011/012)
- [x] T027 [P] [US4] Extend packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts entries coverage: a `project-document-updated` event from another context (popout) triggers the fingerprint refresh so the list updates without manual refresh (FR-006; SC-003)

### Implementation for User Story 4

- [x] T028 [US4] Add the retention footnote line to packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.tsx keyed on the projection's `retentionStatus` ("History limit reached; oldest edits were dropped.")
- [x] T029 [US4] Verify no stale-render paths: rapid interleaved commit/undo/redo fixture ends with the displayed snapshot matching the final projection fingerprint (extend T019/T020 in packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.test.tsx and the entries-store tests; SC-002)

**Checkpoint**: All user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T030 [P] UI review of packages/blue-app/src/renderer/components/workbench/panels/UndoHistoryPanel.tsx: only `text-role-*` roles, `cn()` composition, focusable buttons before the list, no custom CSS classes, no popup/portal surfaces
- [x] T031 [P] Boundary scope review against plan.md: confirm no changes to `@blue/data`, `.blue` XML, CSD generation, the Window menu structure, `NativeMenuCommand`, or the `StoredWorkbenchLayout` schema (`git diff` review in the worktree)
- [ ] T032 Run specs/106-implement-undo-panel/quickstart.md automated gates and native application scenarios; record results and screenshots under "Implementation evidence" in quickstart.md — automated gates recorded 2026-09-11; the 12 native GUI scenarios remain pending project-owner validation
- [x] T033 Run repository-wide validation from the worktree root: `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, `pnpm test`, `pnpm lint`, `git diff --check`
- [x] T034 Update the Status field in specs/106-implement-undo-panel/spec.md from Draft to reflect implementation state, and mark tasks complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1; T002 → T003/T004 → T005/T007/T008 consume the shared types; blocks all user stories.
- **User Stories (Phases 3–6)**: Depend on Phase 2.
  - US1 (Phase 3) depends only on Phase 2 (panel shell + registration).
  - US2 (Phase 4) depends on Phase 2 (entries store) and US1's component (T016).
  - US3 (Phase 5) depends on US1 (component) and US2 (list renders its updates); dispatch code itself is independent.
  - US4 (Phase 6) depends on US2 (list) for footnote/freshness surfaces.
- **Polish (Phase 7)**: Depends on all stories being complete.

### Within Each User Story

- Verification tasks ([P]) can be written against the contract fixtures before or alongside implementation.
- Constitution-required coverage: contract (T006/T009/T010), UI (T012/T018/T019/T023/T026), read-only-history side-effect guarantee (T010, FR-007). No commit→undo→redo suites are added because the feature adds no durable writer (T011 accounting; spec 103 owns those guarantees).
- Same-file tasks within a story are sequential (panel component tasks T016→T021→T024→T028 build on one file).

### Parallel Opportunities

- Phase 2: T003/T005/T006/T009/T010 in parallel after T002; T007/T008 sequential (one hook file pair).
- Phase 3: T012/T013 (tests) parallel with T014/T015 (registry edits); T016→T017→T018 sequential.
- Phases 4/5/6: verification tasks T019/T020/T023/T026/T027 are parallelizable across separate test files once fixtures exist.

---

## Implementation Strategy

### MVP First (Stories 1 + 2)

1. Complete Phase 1: Setup baseline.
2. Complete Phase 2: Foundational entries path.
3. Complete Phase 3 (US1): panel discoverable/open/persistent.
4. Complete Phase 4 (US2): readable stack — **STOP and VALIDATE** (this is the minimum useful feature; US1 alone is only a shell).
5. Phases 5–6 add command buttons and trust hardening; Phase 7 closes out.

### Incremental Delivery

Each story lands as an independently testable increment; quickstart scenarios 1–6 cover the MVP, 7–12 the remainder.

---

## Notes

- All work happens in `.worktrees/106-implement-undo-panel` on branch `106-implement-undo-panel`.
- Auto-commit hooks are disabled for pre/post specify/plan/tasks events in `.specify/extensions/git/git-config.yml` (only `after_implement` is enabled); commit per task or logical group per repo convention.
- Out of scope (do not add): click-to-jump multi-step undo/redo, entry grouping/filtering, label editing, Window-menu restructuring, persistence of history.

---

## Phase 8: Convergence

- [x] T035 Route successful regular Save and Save As paths through the main-owned history checkpoint and publish a fenced projection update to all active workbench renderers, with tests proving the Saved marker and dirty state update immediately (per spec.md FR-009 and quickstart.md scenario 6) (partial)
- [x] T036 Add document-lifetime fencing to renderer history-entry refreshes: pass the active `documentId`, ignore responses after close or replacement, and cover an in-flight old-project response with a project-switch test (per spec.md FR-011 and the project-switch edge case) (partial)
- [ ] T037 Complete the 12 native application scenarios in quickstart.md and record per-scenario pass/fail results and screenshots under Implementation evidence (per tasks.md T032 and spec.md SC-001/SC-003/SC-004/SC-006) — blocked in automated session: computer-use helper lacks macOS Accessibility/Screen Recording grants; dev app launches cleanly; needs owner to grant permissions and re-run, or walk by hand
- [x] T038 Coalesce or defer gesture-merge refreshes so a continuous typing gesture updates the final single summary without issuing one entries IPC read per revision, and add an invocation-count test (per plan.md Performance Goals and spec.md FR-006) (partial)
- [x] T039 Add a renderer-facing 100-action mixed commit/undo/redo/branch-discard test that asserts displayed rows and position after every publication and guards against duplicates, reordering, and stale snapshots (per spec.md SC-002 and quickstart.md automated coverage) (missing)
- [x] T040 Exercise a real `project-document-updated` event from a second context or popout through the listener and panel refresh, including no manual refresh and document-identity checks (per spec.md SC-003 and tasks.md T027) (missing)
