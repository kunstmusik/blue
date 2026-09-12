# Quickstart: Validate the Undo History Panel

Date: 2026-09-11 | Branch: `106-implement-undo-panel`

Validation guide for the Undo History panel. Requirements traceability references
`spec.md` FR/SC ids; boundary shapes live in `data-model.md` and `contracts/`.

## Prerequisites and setup

```bash
# from the worktree root (.worktrees/106-implement-undo-panel)
pnpm install
pnpm --filter @blue/app build:main   # main/preload/shared compile gate
pnpm --filter @blue/app dev          # launch the app for manual scenarios
```

Use any project with a few editable surfaces (score objects, mixer, scratch pad); the
`demo2026` projects or a fresh project both work.

## Automated gates

Run from the worktree root; all must pass before handoff.

```bash
pnpm --filter @blue/app test   # focused suites below run within this
pnpm test                      # repo-wide when the change is complete
pnpm lint
git diff --check
```

### Focused suites to extend or add

| Suite | Add/extend | Asserts | Traces |
|-------|-----------|---------|--------|
| `src/main/project-history.test.ts` | extend | `readEntries` summaries (entryId/label/timestamp/afterStateId), oldest-first order, memento/patch exclusion, cursor across commit→undo→redo, eviction, gesture merge = one row | FR-002, FR-003, FR-008, FR-010; SC-005 |
| `src/main/global-project-history.integration.test.ts` (or sibling main integration suite) | extend | entries channel returns snapshot for the active document; `invalid` + reason on `documentId` mismatch; read has no side effects on history/revision | FR-006, FR-007; contracts/history-entries-ipc.md |
| `src/preload/project-history-api.test.ts` | extend | `readProjectHistoryEntries` invokes the channel with the passed request | FR-008 |
| `src/main/application-menu.test.ts` | extend | Window → Properties submenu lists "Undo History"; click dispatches `onFocusPanel('UndoHistoryTopComponent')` | FR-001 |
| auxiliary-layout-model tests | extend if panel sets enumerated | panel absent from default seeds; present in `properties-main` seed ordering | FR-001, FR-013 |
| `UndoHistoryPanel.test.tsx` (new) | add | most-recent-first rendering; position divider between applied/undone; muted redoable rows; saved marker; Undo/Redo disabled states and dispatch through the history hook; retention footnote; no-project and empty states | FR-002–FR-005, FR-009, FR-010, FR-012; SC-001 |
| entries store tests (beside `use-project-history.ts` tests) | add | seed on load, clear on close/replace, refresh on fingerprint change, last-write-wins | FR-006, FR-011; SC-002 |

## Native application scenarios (manual)

Each scenario maps to a spec acceptance scenario; record results with screenshots.

1. **Default closed (Story 1.1)**: fresh layout (Window → Reset Windows) → restart → panel
   is not open anywhere.
2. **Menu open + dock (Story 1.2)**: Window → Properties → Undo History → panel opens
   docked with the right-edge properties group.
3. **List + ordering (Story 2.1)**: make three distinct edits (move a score object, set a
   mixer level, type in the scratch pad) → rows appear most-recent-first with the same
   labels the Edit menu's Undo item shows.
4. **Position split (Story 2.2/2.3)**: undo once via ⌘Z → top row becomes visually
   undone, divider moves below it; redo via panel button → row returns to applied.
5. **Button parity (Story 3.1–3.3)**: click panel Undo/Redo repeatedly → one action per
   click, all views update, and Edit menu labels/enablement always match the buttons;
   at history bounds the buttons disable.
6. **Saved marker (Story 2.4)**: save → marker on the row matching the saved state;
   edit → marker stays on that row; undo back → dirty state clears (matches SC-005 of 103).
7. **Cross-window (Story 4.1, SC-003)**: float an editor panel to an OS window, edit
   there → the open panel's list updates without refresh.
8. **Gesture merge (Story 4.2)**: type a short burst in one field → one row.
9. **Retention (Story 4.3)**: temporarily lower the retention entry limit via the
   existing history configuration, exceed it → footnote appears, oldest rows vanish,
   no row remains that Undo cannot reach.
10. **Project switch (Story 4.4)**: open another project → list shows only the new
    project's history; close project → empty state.
11. **Layout persistence (Story 1.3/1.4, SC-006)**: open + move + minimize to rail →
    restart → placement restored; close panel → reopen from menu → prior placement.
12. **Read-only guarantee (SC-004)**: with the panel open, open/close/refresh it in
    every presentation (docked, slideout, maximized, floated) → no new history rows, no
    dirty-state change.

## Evidence recording

Append per-scenario results (command output tails + screenshots) under
**Implementation evidence** in this file when implementation lands, mirroring
`specs/103-global-undo-redo/quickstart.md`.

## Implementation evidence (recorded 2026-09-11, branch `106-implement-undo-panel`)

### Package, build, and lint gates

- `pnpm --filter @blue/app test` — 469 files / 4873 tests passed | 2 skipped
  (baseline before the feature: 466 files / 4845 tests; net +3 suites, +28 tests).
- `pnpm --filter @blue/app build:main` — clean (tsc strict).
- `pnpm test` (repo-wide, all packages + `test:scripts`) — green on the final run
  (49/49 script tests; one blue-data test failed under heavy parallel load on an
  intermediate run, reproduced green in isolation and on the final run — blue-data is
  untouched by this feature).
- `pnpm lint` (typography audit, eslint, package lints, prettier check) — green.
- `git diff --check` — clean.

### Automated coverage recorded (maps to the table above)

| Layer | Evidence |
|-------|----------|
| Main engine | `project-history.test.ts` → `readEntries` describe: summaries/order/exclusion/cursor/branch-discard/eviction/gesture (5 tests) |
| Main integration | `global-project-history.integration.test.ts`: 100-action workload summary + read-only side-effect guarantee (FR-007) |
| IPC registrar | `project-document-ipc.test.ts` entries passthrough; `main-process-ipc-inventory.test.ts` oracle updated to the 192-endpoint surface |
| Preload | `project-history-api.test.ts`: `project-history:entries` channel + typed response |
| Menu (FR-001) | `application-menu.test.ts`: Window → Properties lists "Undo History"; click → `onFocusPanel('UndoHistoryTopComponent')` |
| Registry/seed (FR-001/013) | `undo-history-panel-registry.test.ts`: descriptor flags, seed membership, default-seed exclusion, content-switch wiring |
| Panel UI | `undo-history-panel.test.tsx` (12 tests): ordering, divider, muted rows, saved marker, bounds/dispatch/labels, branch discard, retention footnote, project switch, rapid publications |
| Entries store | `use-project-history-entries.test.ts` (5 tests): fetch, invalid-response, coalescing, rejection, clear |
| IPC listeners | `use-ipc-listeners.test.tsx`: entries seeded on load / cleared on close with projection lifecycle |

### Native application scenarios

Status 2026-09-11 (phase 8): the automated environment cannot drive the GUI — the
session's computer-use helper lacks macOS Accessibility (input) and Screen Recording
(vision) grants, so menu/window interaction is blocked. The dev app was verified to
launch cleanly from the worktree (`pnpm --filter @blue/app dev`; main/preload build,
window created). **Remaining for the project owner:** either grant Accessibility +
Screen Recording to "ZCode Computer Use.app" (System Settings → Privacy & Security,
then restart ZCode) and re-run, or walk scenarios 1–12 by hand with
`pnpm --filter @blue/app dev`; scenario 9 (retention limit) additionally requires a
temporarily lowered entry limit via the existing history configuration. An initial
screenshot of the attempted session is at `evidence/01-initial-state.png`.

## Implementation evidence — phase 8 convergence (2026-09-11)

| Task | Result |
|------|--------|
| T035 Save checkpoint publication | `doSave` and `saveFileAsInternal` now run `projectHistory.checkpointSave()` and broadcast a `publicationKind: 'checkpoint'` `project-document-updated` event (shared type + window-contract mirror + validator). The renderer's equal-revision fence accepts checkpoint publications only. Tests: checkpoint applied at unchanged revision (saved marker + dirty flip) and non-checkpoint equal-revision echo still dropped (`use-ipc-listeners.test.tsx`). |
| T036 Document-lifetime fencing | `refreshProjectHistoryEntries` sends the active `documentId` and re-checks it after every await. Tests: in-flight old-document response dropped on switch; request carries documentId (`use-project-history-entries.test.ts`). |
| T038 Gesture refresh coalescing | Trailing 150 ms debounce (`scheduleProjectHistoryEntriesRefresh`) used by the panel; tests: 5-call burst → 1 fetch; burst during in-flight fetch re-fetches and lands the newer snapshot. |
| T039 100-action workload | `undo-history-panel-workload.test.tsx`: 100 commits asserted after every publication (labels/order/all-applied), 100 undos (muted counts + divider per step), 50 redos, branch discard → 51 rows, no divider, no duplicates/reordering/stale rows. |
| T040 Cross-context refresh | `use-ipc-listeners.test.tsx`: real `project-document-updated` event with `originContextId: 'ctx-popout'` flows through the listener and the mounted panel refreshes its rows without manual refresh (debounce advanced); different-document events leave the panel and fetch count untouched. |

Gates after phase 8: affected suites green (73 tests across 6 files), `build:main`
clean; full package/repo gates recorded below in this section per run.
