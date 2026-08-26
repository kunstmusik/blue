# Status: Window Layout Persistence (Spec 054)

**State**: Closed
**Date**: 2026-07-06
**Branch**: `054-window-layout-persistence`

## Closeout Summary

All 6 phases plus Phase 7 polish are complete. Review findings have been addressed. 1594 tests pass across 149 test files. TypeScript compiles clean for main, preload, and renderer targets.

## What Was Implemented

### Phase 1-2: Foundation
- `WindowLayoutSettingsSnapshot` versioned contract with `windows`, `splits`, `workbench`, `legacyMigration`, and `lastResetAt` fields.
- `mergeWindowLayoutSettings` deep-merges partial snapshots, drops unknown split/window keys, and fills defaults.
- Main-process `window-layout-store` wraps `program-settings-store` for durable load/save/update/reset with broadcast.
- Preload exposes `getProgramSettings`, `updateWindowLayout`, `resetWindows`, and `onWindowLayoutReset`.
- Renderer `layout-settings-store` Zustand store mirrors the canonical main-process snapshot.

### Phase 3: US1 — Window Bounds
- `window-state-manager` captures `normalBounds` and `displayState` on resize/move/maximize/fullscreen/close.
- `restoreWindowState` validates bounds against minimum size and display work areas before applying.
- Main window, settings window, effect editor, and effect interface all restore bounds before `show()`.
- "Reset Default Layout" renamed to "Reset Windows" in application menu.

### Phase 4: US2 — Split Persistence
- `SplitPane` extended with `splitId`, `controlledPane`, `defaultSizePx` props; debounced save; display-only clamping.
- Auxiliary left/right/bottom defaults changed from 360/228 to 200px.
- All split call sites converted: Orchestra, Score, UDO, BSB, Piano Roll, SoundFont Viewer, LineObject, ZakLineObject, and PatternObject.
- BSB property pane controls the right-side pane at 250px to match Java Blue's documented parity exception.
- Legacy `blue-settings.windowBounds` and `blue-workbench-layout` migrate once into the app-wide settings store, including copied values and migration markers.

### Phase 5: US3 — Reset Windows
- `resetWindowLayout()` clears layout state, marks legacy migration complete so stale localStorage cannot re-import pre-reset values, resets tracked live BrowserWindows to defaults, and broadcasts `window-layout:reset` to all windows.
- Renderer applies reset immediately via `applyReset()` without project save/discard prompts.
- Workbench layout, split locations, and window state all return to defaults.

### Phase 6: US4 — FR-025 Coverage
- Round-trip tests for all 4 window identities and 10 active split identities.
- Invalid-value preservation: bad window-state, bad split, unknown split key all drop cleanly.
- Reset preserves unrelated settings (enginePath, recentFiles, audioDriver, etc.).
- Legacy migration idempotence and renderer-to-main migration payload persistence verified.
- Pre-3.0 split identity removals are intentional because the layout schema has not shipped; no migration is required in this change, but a versioned migration for pre-3.0 settings is required after 3.0.0 is released.

## Validation

- `pnpm --filter @blue/app test`: 1594 passed, 2 skipped
- `pnpm --filter @blue/app build`: clean (main, preload, renderer)
- `pnpm lint`: clean
- `git diff --check`: clean
- Focused layout contract suite: 69 passed
- Focused BSB editor suite: 44 passed

## Follow-Up Considerations

- Effect editor/interface instances use type-level identities; per-instance owner keys may be needed later.
- Multi-monitor hot-plug scenarios not explicitly tested.
- Add and test the pre-3.0 split-settings migration after the 3.0.0 release, before promising compatibility for a later layout-schema change.

Spec 054 is closed. Future work should use a follow-up spec for per-instance secondary window identities or deeper multi-monitor hot-plug behavior.
