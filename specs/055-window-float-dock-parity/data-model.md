# Data Model: Window Float/Dock Parity

## WorkbenchPanel

Represents one logical Blue workbench surface.

**Fields**:

- `panelId`: Stable panel ID from the workbench panel registry.
- `title`: Current tab title.
- `mode`: Default mode, one of editor, properties, output, or repl.
- `auxiliaryGroupId`: Optional auxiliary seed group ID for properties/output/REPL panels.
- `isClosable`: Whether the panel may close through tab/window commands.
- `isFloatable`: Whether the panel may participate in Float.
- `sessionId`: Current project session ID seen by the renderer.

**Relationships**:

- Belongs to exactly one visible/restorable `TabGroup` or auxiliary presentation at a time.
- May be targeted by `WindowMenuRevealTarget`.

**Validation Rules**:

- A `panelId` must resolve in the panel registry before opening or reveal.
- A panel must not be present in two live groups after Float, Dock, restore, or reveal.

## TabGroup

Represents a group of one or more panels sharing a tab strip.

**Fields**:

- `groupId`: Stable Dockview group ID or generated group identity.
- `panelIds`: Ordered list of panel IDs.
- `activePanelId`: Current active panel in the group.
- `mode`: Effective group mode for fallback placement.
- `presentation`: `docked`, `floating`, `minimized`, `slideout`, or `maximized`.
- `edge`: Optional auxiliary edge for properties/output groups.

**Relationships**:

- Contains one or more `WorkbenchPanel` entries.
- Has zero or one `DockingOrigin` while floating.
- May be hosted by a `FloatingWorkbenchWindow`.

**State Transitions**:

- `docked -> floating`: Float stores origin and moves the selected panel to a one-panel popout; Float Group stores origin and moves the whole group to a popout.
- `floating -> docked/minimized/slideout/maximized`: Dock restores the selected panel; Dock Group restores the group to the prior valid presentation or fallback mode.
- `docked/minimized/slideout -> maximized`: Maximize preserves previous presentation for restore.
- `maximized -> previous`: Restore returns to saved presentation.

## FloatingWorkbenchWindow

Represents a separate OS-level window hosting a floating workbench tab group.

**Fields**:

- `windowId`: Runtime workbench-window ID assigned by the main process.
- `popoutGroupId`: Dockview popout group ID.
- `panelIds`: Panels currently hosted by the window.
- `activePanelId`: Active tab in the popout window.
- `bounds`: Last known x, y, width, and height from the popout layout.
- `displayState`: Normal/maximized/fullscreen if supported for the popout.
- `projectSessionId`: Project session observed by the window.

**Relationships**:

- Hosts one `TabGroup` for the first implementation slice.
- Registers with the main-process `WorkbenchWindowRegistry`.
- Owns a `DockingOrigin` until docked or reset.

**Validation Rules**:

- Bounds must be finite and visible on at least one display before restore; otherwise restore to a safe default on an available display.
- A close request must consult tab close eligibility before removing hosted panels.

## DockingOrigin

Represents where a floating panel or group should return when Dock or Dock Group is invoked.

**Fields**:

- `originGroupId`: Previous Dockview group ID when available.
- `originPanelOrder`: Ordered panel IDs at float time.
- `originActivePanelId`: Active panel at float time.
- `originMode`: Fallback panel mode.
- `originIndex`: Previous group order/index if available.
- `restoreReferenceGroupId`: Neighboring editor group used to recreate a closed one-tab split when its original group no longer exists.
- `restoreDirection`: Relative split direction (`left`, `right`, `above`, or `below`) from that neighboring editor group.
- `auxiliarySeedGroupId`: Optional properties/output seed group ID.
- `auxiliaryGroupInstanceId`: Optional seeded or derived auxiliary group identity.
- `edge`: Optional left/right/bottom edge.
- `presentation`: Previous presentation before float.
- `dockedSize`: Optional controlled pane size.
- `slideoutSize`: Optional slide-out size.
- `capturedAt`: Optional timestamp for diagnostics and migrations.

**Relationships**:

- Belongs to one `FloatingWorkbenchWindow`, floating `TabGroup`, or closed `WorkbenchPanel`.
- References panel registry data for fallback default modes.

**Validation Rules**:

- If the original group/edge no longer exists, fallback to the panel registry mode.
- If a panel ID is missing from the current registry, skip it during restore and keep valid siblings.

## TabCommandState

Represents the computed state for a tab context menu opened on a specific tab.

**Fields**:

- `contextPanelId`: Panel whose tab opened the menu.
- `contextGroupId`: Group containing the tab.
- `location`: `docked`, `floating`, `minimized`, `slideout`, or `maximized`.
- `commands`: Ordered command descriptors with label, enabled flag, and action kind.
- `canClose`, `canCloseAll`, `canCloseOther`, `canCloseGroup`, `canFloat`, `canFloatGroup`, `canDock`, `canDockGroup`, `canMinimize`, `canMinimizeGroup`, `canShiftLeft`, `canShiftRight`, `canMaximize`, `canRestore`, `canClone`, `canNewDocumentTabGroup`, `canCollapseDocumentTabGroup`.

**Validation Rules**:

- Command state must be computed from the tab that opened the menu, not the last focused tab.
- Shift commands must be disabled at group edges.
- Float, Float Group, Dock, and Dock Group remain visible together; enablement reflects the current docked/floating state.

## WorkbenchLayoutSnapshot

Represents the persisted workbench layout envelope.

**Fields**:

- `version`: Workbench layout envelope version.
- `dockview`: Serialized Dockview layout including grid and popout groups.
- `auxiliary`: Auxiliary layout state including groups, edges, slideouts, and minimized tabs.
- `floatingOrigins`: Map from popout group ID to `DockingOrigin`.
- `closedPanelOrigins`: Map from closed panel ID to `DockingOrigin`; closed panels remain absent from the live Dockview layout until explicitly reopened.
- `updatedAt`: Optional timestamp.

**Relationships**:

- Stored as `appSpecific.windowLayout.workbench.serializedLayout`.
- Reset by Reset Windows along with other app layout settings.

**Validation Rules**:

- Unknown future versions fall back safely to defaults.
- Missing floating or close-origin data restores using default panel modes.
- Invalid popout bounds are corrected before display.

## WorkbenchWindowRegistry

Runtime main-process registry for workbench windows.

**Fields**:

- `windowId`: Runtime ID.
- `browserWindowId`: Electron BrowserWindow ID.
- `role`: `main` or `floating`.
- `panelIds`: Current panel ownership reported by the renderer.
- `activePanelId`: Last active panel in that window.
- `projectSessionId`: Session ID last reported by the renderer.

**Relationships**:

- Receives ownership updates from renderer windows.
- Used by Window menu reveal routing and reset/focus behavior.

**Validation Rules**:

- Destroyed windows must be removed from the registry.
- Reveal target resolution must prefer a live owner window over opening a duplicate.
