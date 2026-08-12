# Research: Window Float/Dock Parity

## Decision: Use Dockview Popout Groups For Java-Style Float And Float Group

Use Dockview's `addPopoutGroup()` as the mechanism for both NetBeans Float and Float Group. For Float, move only the selected panel into a one-panel popout group with a stable generated id. For Float Group, pass the selected tab's containing group. Host popouts through Electron as normal application windows with the app preload and a controlled popout route.

**Rationale**: Dockview 5.2.0 already distinguishes `addFloatingGroup()` (in-workbench overlay) from `addPopoutGroup()` ("new Window" in the local type documentation). Popout groups serialize in Dockview JSON as `popoutGroups` with group data and position, which aligns with this feature's need to persist floating workbench state. NetBeans has separate `UndockWindowAction` and `UndockModeAction` entries: `Float` moves the selected TopComponent, while `Float Group` moves the mode/group.

**Alternatives considered**:

- Keep using `addFloatingGroup()`: rejected because it stays inside the main BrowserWindow and does not satisfy the user-visible Java Blue behavior.
- Build all floating workbench windows manually with custom `BrowserWindow` instances and hand-rehydrated panels: possible fallback if Dockview popouts cannot satisfy close interception or state restore, but more custom layout code and higher duplicate-panel risk.
- Single-tab float as a future command: rejected after Java source review because NetBeans already uses unqualified `Float` for the selected TopComponent and `Float Group` for mode/group detachment.

## Decision: Persist Floating Workbench State In The Workbench Layout Envelope

Extend the stored workbench layout envelope from version 5 to a new version that preserves Dockview `popoutGroups`, active tabs, popout positions, and supplemental Blue-specific dock-back origin metadata.

**Rationale**: App-wide layout settings already persist `workbench.serializedLayout`. Floating workbench windows are part of workbench layout rather than independent project data. Keeping popout state in the workbench envelope lets Reset Windows clear floating state with the rest of workbench layout while preserving existing fixed window identities such as main/settings/effect windows.

**Alternatives considered**:

- Add every floating workbench window as a dynamic `WindowId`: rejected for the first slice because these windows are tab-group presentations, not stable application window types. Bounds and ownership are better tied to the serialized popout group.
- Store floating origins in localStorage: rejected because spec 054 made app-wide program settings the canonical layout store and Reset Windows must operate centrally.

## Decision: Model Dock-Back Origin Explicitly

Record dock-back origin metadata for each floating group, including panel IDs, active panel, previous group/mode, tab order, auxiliary seed group, edge, minimized/slide-out/maximized presentation, and fallback mode.

**Rationale**: NetBeans stores previous mode/index/constraints before undock and uses that data to dock back, falling back to default editor/view modes when the original location is no longer valid. The Electron port already has auxiliary group state for edge/minimized/slide-out/maximized behavior, so floating must preserve enough of that state to return a group to the user's previous layout.

**Alternatives considered**:

- Rely only on Dockview serialized group positions: insufficient for auxiliary edge/minimized/slide-out state and fallback-to-mode behavior.
- Recompute origin from panel registry on Dock: acceptable only as a fallback when saved origin is missing or invalid.

## Decision: Add A Workbench Window Registry For Focus, Reveal, And Close

Introduce an internal workbench-window registry in the main process. Each renderer window registers its role and reports panel ownership. Window menu reveal commands use this registry to focus the owning window and select the requested tab; if no owner exists, the main workbench opens the panel in its default mode.

**Rationale**: Current menu commands are sent only to `mainWindow`, which cannot focus a panel already living in a popout. A registry gives the main process enough information to route menu commands, reset broadcasts, and close requests across main and floating workbench windows.

**Alternatives considered**:

- Broadcast every reveal command to every renderer and let renderers race: rejected because it makes focus and duplicate prevention nondeterministic.
- Keep all reveal routing renderer-local: rejected because the native Window menu originates in the main process and must focus OS-level windows.

## Decision: Synchronize Shared Project Session Through Main-Process Broadcasts

Treat the main process as the canonical project/playback/layout session. Floating renderers subscribe to the same project load/close/playback/layout reset events as the main renderer, and project-document mutation responses are broadcast to all registered workbench renderers with session/revision metadata.

**Rationale**: Zustand stores are per renderer window. The existing main process already owns `currentData`, project session IDs, playback state, and layout settings. Broadcasting canonical snapshots after load, close, and mutation avoids assuming renderer memory is shared and prevents stale floating panels from editing a prior project session.

**Alternatives considered**:

- Share renderer stores directly across windows: not reliable because popouts are separate renderer contexts.
- Make floating windows read-only: rejected because spec requires preserved editable/live UI behavior.

## Decision: Centralize Tab Command Eligibility In A Pure Helper

Move tab-menu command-state calculation into a pure renderer helper that accepts the selected tab/group context and returns labels, enabled flags, and command payloads. `AuxiliaryTab.tsx` renders the Radix menu from that state.

**Rationale**: Current command logic lives inline in the tab component and already has parity gaps: auxiliary float is disabled, Dock is always disabled, and close/shift scopes are derived ad hoc. A pure helper makes tests straightforward for first/middle/last/single tabs, floating/docked contexts, auxiliary state, and mode restrictions.

**Alternatives considered**:

- Continue adding conditional logic directly to `AuxiliaryTab.tsx`: rejected because context-menu parity has many state combinations and needs focused automated coverage.

## Decision: Implement The NetBeans Tab Popup Shape And Auxiliary Submenus

The first-slice menu set includes the Java/NetBeans editor popup commands (Close, Close All, Close Other, Maximize/Restore, Float, Float Group, Dock, Dock Group, Shift Left, Shift Right, Clone, New Document Tab Group, Collapse Document Tab Group) and the view/auxiliary popup commands (Close, Close Group, Maximize/Restore, Minimize, Minimize Group, Float, Float Group, Dock, Dock Group, Move, Shift Left, Shift Right, Move Group, Size Group). Auxiliary Move and Move Group use left/right/bottom edge submenus, while Size Group uses larger/smaller/reset actions for docked groups. Moving auxiliary content transfers the selected panel or group of panels into a derived target-edge group; the seeded Properties and Output groups remain stable default-mode anchors for later reveals and reset.

**Rationale**: The review identified that `Float Group`, `Dock Group`, Clone, New Document Tab Group, Collapse Document Tab Group, Close Group, Minimize, and Minimize Group are part of the actual NetBeans popup surface. Rendering them with accurate enablement, alongside the auxiliary edge and size submenus, avoids silent parity gaps.

**Alternatives considered**:

- Implement every discovered NetBeans submenu now: retained as a focused auxiliary-only implementation because Dockview drag/resize remains the direct manipulation path while the commands provide the missing menu workflow. The transfer semantics follow NetBeans mode drops without mutating the app's stable seeded default-mode anchors.
- Omit extras without tracking: rejected because parity gaps should be explicit.
