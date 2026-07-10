# Contract: Workbench Window IPC

This is an internal application contract between Electron main, preload, and workbench renderers. Type names are illustrative and should be implemented as browser-safe shared TypeScript types.

## Goals

- Register main and floating workbench renderer windows.
- Track which window owns each panel.
- Route Window menu reveal commands to the existing owner window.
- Share project/playback/layout events across all workbench windows.
- Apply close policy before a floating window removes panels.

## Channels

### `workbench-window:register`

Renderer invokes on startup or popout creation.

```ts
interface WorkbenchWindowRegisterRequest {
  role: 'main' | 'floating';
  popoutGroupId?: string;
  projectSessionId?: number;
}

interface WorkbenchWindowRegisterResponse {
  windowId: string;
}
```

### `workbench-window:update-ownership`

Renderer sends after layout, active tab, popout, Dock, Float, or panel close changes.

```ts
interface WorkbenchWindowOwnershipUpdate {
  windowId: string;
  role: 'main' | 'floating';
  popoutGroupId?: string;
  panelIds: string[];
  activePanelId?: string;
  projectSessionId?: number;
}
```

Main stores the latest ownership snapshot for reveal routing and duplicate prevention.

### `workbench-window:reveal-panel`

Main uses this command when a Window menu item or equivalent stable command targets a panel.

```ts
interface WorkbenchRevealPanelRequest {
  panelId: string;
  source: 'window-menu' | 'shortcut' | 'programmatic';
}

interface WorkbenchRevealPanelResult {
  handled: boolean;
  focusedWindowId?: string;
  openedInDefaultMode?: boolean;
}
```

Main resolution rules:

1. If a live registered window owns `panelId`, focus that window and send `native-menu-command` or equivalent reveal message to select the tab.
2. If no live owner exists, send the reveal command to the main workbench renderer.
3. If the target panel is no longer registered, the renderer must ignore the command and report `handled: false` if a response path is used.

### `workbench-window:request-close`

Main or renderer uses this when a floating workbench window is closing.

```ts
interface WorkbenchWindowCloseRequest {
  windowId: string;
  popoutGroupId?: string;
  panelIds: string[];
  source: 'window-close' | 'tab-close' | 'reset-windows' | 'dock';
}

interface WorkbenchWindowCloseResult {
  allowed: boolean;
  blockedPanelIds?: string[];
  requiresPrompt?: boolean;
}
```

Rules:

- If `allowed` is false, the close must be prevented or the group restored without panel loss.
- Close policy must match the same tabs while docked.
- Reset Windows may bypass normal persistence but must not modify project data.

### `workbench-window:dock-group`

Renderer command used by the tab context menu.

```ts
interface DockFloatingGroupRequest {
  popoutGroupId: string;
  requestedPanelId: string;
}

interface DockFloatingGroupResult {
  docked: boolean;
  fallbackUsed?: boolean;
  skippedPanelIds?: string[];
}
```

Rules:

- Dock uses `DockingOrigin` when valid.
- Invalid origins fall back to the registry default mode for the group.
- No panel may remain duplicated in the floating window after successful Dock.

### Shared session broadcasts

The existing project/playback events must reach every registered workbench renderer, not only the main window:

- `project-loaded`
- `project-closed`
- `playback-status`
- `playback-clock`
- `playback-error`
- `window-layout:reset`

Add a project mutation broadcast if needed:

```ts
interface ProjectDocumentUpdatedEvent {
  sessionId: number;
  revision: number;
  snapshot: ProjectEditorSnapshot;
  sourceWindowId?: string;
}
```

Renderer rules:

- Ignore broadcasts for stale project sessions.
- Apply newer revisions idempotently.
- Preserve renderer-local selection only when the selected entity still exists.
