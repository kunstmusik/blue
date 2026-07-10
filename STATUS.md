# Project Status - blue-electron

**Date**: 2026-07-10
**Branch**: `055-window-float-dock-parity`
**Current Focus**: Spec 055 Closed

## Summary

Spec 055 is closed. The Electron workbench now matches the relevant Java Blue and NetBeans window-system behavior for floating and docking editor and auxiliary panels. The user completed the manual Electron parity pass after the final fixes for startup restore, close/reopen placement restoration, Dockview auxiliary cleanup, and auxiliary re-dock sizing.

Key outcomes:
- **Separate Float windows**: Float and Float Group use Dockview popout groups hosted as Electron windows, preserving the shared renderer session and project state.
- **Dock back**: Dock and Dock Group restore the recorded editor group, auxiliary edge, ordering, minimized state, and controlled size. Auxiliary docking removes Dockview's hidden popout reference before rebuilding the edge, preventing empty splitters and stale panes.
- **Context-menu and Window-menu parity**: Context menus expose Java Blue-style enabled and disabled commands, while the Window menu reveals the requested panel or restores its saved placement.
- **Persistence and reset**: The version-7 workbench envelope persists floating origins and closed-panel origins. Reset Windows returns to the Java Blue-inspired default state without reopening disabled-by-default utilities.
- **Close and reopen restoration**: Closing a panel retains its valid last placement so reopening it from the menu restores the correct mode and position instead of applying a generic default.

## Current Artifacts

- `.specify/feature.json` points to `specs/055-window-float-dock-parity`.
- `specs/055-window-float-dock-parity/spec.md` is complete.
- `specs/055-window-float-dock-parity/plan.md`, `research.md`, `data-model.md`, and `contracts/` record the design and Java/NetBeans parity decisions.
- `specs/055-window-float-dock-parity/tasks.md` contains all implementation tasks, including the final auxiliary re-dock regression fix, marked complete.
- `specs/055-window-float-dock-parity/quickstart.md` and `parity-review.md` record the completed automated and manual verification.
- `AGENTS.md` has the Spec 055 technology and persistence context.

## Validation Performed

- `pnpm --filter @blue/app test` - 1701 passed, 2 skipped (154 test files).
- `pnpm --filter @blue/app build` - passed for Java runtime, `@blue/data`, main, preload, and renderer targets.
- `pnpm lint` - clean.
- `git diff --check` - clean, with no whitespace errors.
- Focused workbench, floating-origin, menu-command, window-manager, layout-contract, and auxiliary-layout regression suites pass.
- The user completed the manual Electron parity pass on 2026-07-10, covering Float, Float Group, Dock, Dock Group, close/reopen restoration, restart persistence, Reset Windows, tab content refresh, and auxiliary re-dock cleanup/sizing.

## Intentional Deferrals

- Move, Move Group, Size Group, and Clone remain visible but disabled where Java Blue exposes the commands without an implemented renderer equivalent.
- New Document Tab Group and Collapse Document Tab Group are implemented for editor groups. Arbitrary Move/Size submenu behavior should be a separate follow-up specification.
- Java Blue does not expose a separate `Dock to Editor` or `New Window` command in the relevant tab menu, so those commands remain absent.

## Next Recommended Step

Spec 055 is complete. Any expansion of interactive Move/Size Group behavior or broader multi-window workflows should start as a new specification.
