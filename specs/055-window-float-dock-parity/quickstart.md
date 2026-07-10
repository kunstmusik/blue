# Quickstart: Window Float/Dock Parity

## Prerequisites

- Branch: `055-window-float-dock-parity`
- Feature pointer: `.specify/feature.json` targets `specs/055-window-float-dock-parity`
- Run commands from `/Users/stevenyi/work/blue-electron`

## Recommended Implementation Order

1. Add tests for pure tab command-state calculation.
2. Add workbench layout migration tests for the new floating-origin envelope.
3. Add main-process workbench window registry tests for ownership, reveal routing, close denial, and destroyed-window cleanup.
4. Extend preload/shared contracts for workbench-window registration, ownership update, reveal, dock, and close-policy messages.
5. Replace in-workbench `addFloatingGroup()` usage with Dockview popout behavior for both selected-panel Float and group-level Float Group.
6. Add popout route/window registration and ownership reporting from main and floating renderers.
7. Add Dock and Dock Group behavior using stored `DockingOrigin`, with fallback to panel registry default modes.
8. Broadcast project/load/playback/layout-reset events to all registered workbench windows.
9. Update Window menu reveal routing to focus existing popout owners before opening defaults.
10. Run focused tests, then full package tests and a manual parity pass.

## Focused Test Commands

```bash
pnpm --filter @blue/app test -- tab-command-state
pnpm --filter @blue/app test -- workbench-window-manager
pnpm --filter @blue/app test -- window-layout-settings
pnpm --filter @blue/app test -- auxiliary-layout
pnpm --filter @blue/app test -- application-menu
```

## Full Verification

```bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build
```

## Manual Parity Checklist

- [x] Open a project and verify editor tabs remain in the main editor group by default.
- [x] Right-click an editor tab in a multi-tab group and choose Float; only the selected tab moves to a separate OS-level window.
- [x] Right-click an editor tab in a multi-tab group and choose Float Group; the whole group moves to a separate OS-level window.
- [x] Right-click an output/auxiliary tab such as Mixer or Score Object Editor and choose Float or Float Group; auxiliary panels are floatable unless specifically documented otherwise.
- [x] Use Dock from the floating window and verify the selected tab returns to its prior location.
- [x] Use Dock Group from the floating window and verify the group returns to a workbench group.
- [x] Float from a minimized or slide-out auxiliary state and Dock back; edge association and size are preserved when valid.
- [x] Invoke Window menu entries for panels already floating; the existing floating window is focused and the requested tab is selected.
- [x] Close a floating window and verify the same close policy is used as docked tabs.
- [x] Close and reopen editor and auxiliary panels from Window; their valid prior mode, position, and presentation restore without an empty splitter.
- [x] Restart the app after moving/resizing two floating windows; valid restoration or safe on-screen correction occurs.
- [x] Use Reset Windows with floating windows open; floating state clears and project data remains unchanged.
