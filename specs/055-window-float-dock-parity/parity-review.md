# Parity Review: Window Float/Dock (SPEC 055)

**Status**: Complete — automated verification and the user-performed Electron parity pass completed on 2026-07-10.
**Reference**: Java Blue / NetBeans window system (`TopComponent`, `UndockWindowAction`, `UndockModeAction`, `DockWindowAction`, `DockModeAction`).

## Implemented

| Behavior                                                     | Status              | Notes                                                                                                                                                          |
| ------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Float → selected tab in separate OS window frame             | Implemented         | `floatPanel` creates a one-panel Dockview popout group with stable origin metadata. Runtime verification required.                                             |
| Float Group → selected group in separate OS window frame     | Implemented         | `floatGroup` uses Dockview `addPopoutGroup(group)` + Electron `setWindowOpenHandler`.                                                                          |
| Dock → return selected floating tab                          | Implemented         | `dockPanel` restores the selected panel to the remembered origin group when possible.                                                                          |
| Dock Group → return floating group                           | Implemented         | `dockGroup` uses stored `DockingOrigin`, restores auxiliary edge state and controlled size when valid, and falls back to panel default mode.                   |
| Origin capture                                               | Implemented         | `captureDockingOrigin` (pure, tested).                                                                                                                         |
| Tab context menu (NetBeans editor/view popup shape)          | Implemented         | `computeTabCommandState` drives Radix tab menus and the delegated header menu.                                                                                 |
| Clone / New Document Tab Group / Collapse Document Tab Group | Implemented/visible | Clone is visible disabled; New/Collapse document group commands are implemented for eligible editor groups.                                                    |
| Close Group / Minimize / Minimize Group                      | Implemented         | View/auxiliary popup commands route through existing workbench auxiliary layout actions.                                                                       |
| Auxiliary panels floatable                                   | Implemented         | `isFloatable` defaults true (FR-014).                                                                                                                          |
| Layout persistence (v7 envelope)                             | Implemented         | `floatingOrigins` and `closedPanelOrigins` round-trip; Dockview `popoutGroups` serialize in `api.toJSON()` (FR-021).                                           |
| Close → Window-menu reopen                                   | Implemented         | A close origin restores editor group/index or an auxiliary edge, size, presentation, and derived group; default placement is used only without a valid origin. |
| Offscreen-bounds correction                                  | Implemented         | `correctOffscreenBounds` / `clampPopoutBounds` on restore (FR-022).                                                                                            |
| Reset Windows clears floating state                          | Implemented         | `loadLayout(null)` + existing `broadcastWindowLayoutReset` (FR-023).                                                                                           |
| Shared project/playback session                              | Implemented         | main broadcasts project/playback/document-updated to all registered windows (FR-010).                                                                          |
| Window-menu reveal routing                                   | Implemented         | `routeFocusPanel` via `WorkbenchWindowManager.resolveReveal` (FR-024/025).                                                                                     |
| Floating-window close policy                                 | Implemented         | floating `BrowserWindow` close and IPC close requests call `WorkbenchWindowManager.requestClose` with shared panel closability policy.                         |

## Deferred Java/NetBeans Tab Commands (FR-029)

| Command family          | First-slice status                | Rationale                                                                                         |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| Move / keyboard drag    | Visible disabled for menu command | Existing Dockview drag already supports panel moving; submenu-style menu parity remains deferred. |
| Move Group / Size Group | Visible disabled                  | Existing Dockview drag/resize covers the core workflow; submenu/dialog parity remains deferred.   |
| Dock to Editor          | Omitted                           | Not evidenced in Java Blue tab menu for this context.                                             |
| New Window / duplicate  | Omitted                           | Distinct from Float (Float moves the group, does not duplicate); intentionally not provided.      |

## Manual Parity Checklist

- [x] Editor tabs remain in the main editor group by default.
- [x] Right-click an editor tab in a multi-tab group → Float: only the selected tab moves to a separate OS window.
- [x] Right-click an editor tab in a multi-tab group → Float Group: the whole group moves to a separate OS window.
- [x] Right-click an output/auxiliary tab (e.g. Mixer) → Float and Float Group: auxiliary panels are floatable.
- [x] From the floating window tab menu → Dock: the selected tab returns to a workbench group.
- [x] From the floating window tab menu → Dock Group: the group returns to a workbench group.
- [x] Float from a minimized/slide-out auxiliary state, then Dock back: edge association and controlled size are preserved without an empty splitter.
- [x] Window menu entry for an already-floating panel: the existing floating window is focused and the requested tab is selected (no duplicate).
- [x] Close a floating window: same close policy as docked tabs.
- [x] Close an editor tab, then reopen it from Window: it returns to the same group and tab order.
- [x] Close a moved/minimized/slide-out auxiliary tab, then reopen it from Window: it returns to the same edge and presentation without an empty splitter.
- [x] Move/resize two floating windows, restart: restored with valid on-screen bounds.
- [x] Reset Windows with floating windows open: floating state clears; project data unchanged.

## Manual Verification Result

The user completed the Electron parity pass on 2026-07-10. The auxiliary Dockview hidden-reference artifact and collapsed auxiliary re-dock size were identified during that pass, fixed, regression-tested, and rechecked successfully.
