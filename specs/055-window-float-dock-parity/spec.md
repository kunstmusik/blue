# Feature Specification: Window Float/Dock Parity

**Feature Branch**: `055-window-float-dock-parity`
**Created**: 2026-07-08
**Status**: Complete (2026-07-10)
**Input**: User description: "Use spec-kit to make a spec for the current window-system work. Float should match Java NetBeans/Blue by opening a separate window frame, Dock should return the tab to the main workbench, auxiliary panels should participate in Float/Dock unless explicitly non-floatable, tab context-menu actions should match Java Blue/NetBeans expectations, and the workbench should preserve correct behavior across editor, output, properties, edge/minimized, and floating states."

**Reference Review**: Java Blue delegates tab/window behavior to the NetBeans window system through `TopComponent` registrations. NetBeans treats Float/Undock as a move into a separate window frame, treats Dock as a return to a previous or fallback mode, remembers prior mode/index information for restored tabs, and enables tab context-menu actions according to the current tab, group, and mode state. This feature specifies the Electron workbench parity target for those behaviors.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Float A Tab Or Tab Group Into A Separate Window (Priority: P1)

As a Blue user, I need Float to move the selected tab into a separate application window frame, and Float Group to move the selected tab's whole group, so the Electron workbench matches Java Blue/NetBeans rather than creating another in-workbench pane.

**Why this priority**: The current user-visible mismatch is that Float does not mean the same thing as Java Blue/NetBeans. Correct float behavior is the foundation for docking, persistence, and context-menu parity.

**Independent Test**: Open a project with editor and auxiliary tabs, right-click a tab in a multi-tab group, choose Float, and verify only that tab appears in a separate movable and resizable application window. Repeat with Float Group and verify the whole tab group appears in a separate window while tab order, active tab, content, titles, selections, and panel identities are preserved.

**Acceptance Scenarios**:

1. **Given** a docked editor tab is active in a multi-tab group, **When** the user chooses Float from that tab's context menu, **Then** only the selected tab moves into a separate window frame outside the main workbench.
2. **Given** a docked editor tab is active in a multi-tab group, **When** the user chooses Float Group, **Then** the containing tab group moves into a separate window frame outside the main workbench.
3. **Given** an output, properties, or auxiliary tab is docked in a bottom, side, or edge-managed group, **When** the user chooses Float or Float Group, **Then** the selected tab or selected group appears in a separate window frame and is no longer duplicated in its original location.
4. **Given** a floated group contains multiple tabs, **When** the group appears in the separate window, **Then** the same tabs, order, active tab, and tab titles are preserved.
5. **Given** a floated tab contains editable, live, playback-related, or selection-sensitive UI state, **When** the tab is floated, **Then** the visible content remains the same logical panel instance from the user's perspective and does not reset to a blank or default state.
6. **Given** a tab is already floating, **When** the user opens its tab context menu, **Then** Float and Float Group remain visible but disabled while Dock and Dock Group reflect the available return actions.

---

### User Story 2 - Dock A Floating Group Back To Its Workbench Location (Priority: P1)

As a Blue user, I need Dock to return a floating tab to the workbench location it came from, and Dock Group to return the whole floating group, so I can temporarily detach panels without manually rebuilding my layout.

**Why this priority**: Float is incomplete without a reliable return path. Java NetBeans remembers where a window came from and restores it to that mode or a sensible fallback.

**Independent Test**: Float a single tab and a full group from each major workbench area, use Dock or Dock Group from the floating tab context menu, and verify the selected tab or group returns to its previous tab group, edge assignment, minimized/docked state, and relative order whenever that location still exists.

**Acceptance Scenarios**:

1. **Given** a tab was floated from a tab group that still exists, **When** the user chooses Dock, **Then** that tab returns to the original group with its previous relative tab order where possible.
2. **Given** a group was floated from a tab group that still exists, **When** the user chooses Dock Group, **Then** the group returns to an appropriate workbench group with its previous relative tab order where possible.
3. **Given** a tab or group was floated from an auxiliary edge, minimized edge tab, or slide-out presentation, **When** the user chooses Dock or Dock Group, **Then** the affected tab or group returns to the prior edge association and presentation state when that state is still valid.
4. **Given** the original group or edge location was removed or no longer has a valid location, **When** the user chooses Dock or Dock Group, **Then** the tab or group returns to the appropriate default workbench mode for those panel types.
5. **Given** multiple tabs or groups are floated from different areas, **When** each is docked, **Then** each returns independently without corrupting the other floating or docked groups.
6. **Given** the user closes the separate floating window using the window close control, **When** close is allowed for every affected tab, **Then** the result is equivalent to closing those tabs from their tab context menu.
7. **Given** at least one affected tab cannot be closed, **When** the user attempts to close the floating window, **Then** the standard tab-close policy prevents or prompts for the close in the same way it would while docked.

---

### User Story 3 - Use A Java-Style Tab Context Menu (Priority: P1)

As a Blue user, I need every tab to show the same practical right-click actions Java Blue exposes so window management is discoverable and consistent across the workbench.

**Why this priority**: The tab context menu is the user's primary entry point for Close, Float, Dock, Maximize, and tab-order commands. Incorrect availability makes the window system feel broken even if the underlying layout can represent the state.

**Independent Test**: Right-click tabs in editor, properties, output, minimized/auxiliary, and floating contexts and verify the menu labels, disabled states, and command results match the expected state of the selected tab.

**Acceptance Scenarios**:

1. **Given** a closable editor tab is docked with peer tabs in its group, **When** the user opens the context menu, **Then** Close, Close All, Close Other, Maximize, Float, Float Group, Dock, Dock Group, Shift Left, Shift Right, Clone, New Document Tab Group, and Collapse Document Tab Group appear with valid state-dependent enablement.
2. **Given** a tab is the first tab in its group, **When** the context menu opens, **Then** Shift Left is disabled and Shift Right remains enabled if another tab follows.
3. **Given** a tab is the last tab in its group, **When** the context menu opens, **Then** Shift Right is disabled and Shift Left remains enabled if another tab precedes it.
4. **Given** a tab is floating, **When** the context menu opens, **Then** Dock and Dock Group are available while Float and Float Group are disabled but still visible.
5. **Given** a view/auxiliary tab is docked, **When** the context menu opens, **Then** Close Group, Minimize, Minimize Group, Float, Float Group, Dock, Dock Group, Move, Shift Left, Shift Right, Move Group, and Size Group are represented with implemented commands enabled and unsupported submenu-style commands disabled.
6. **Given** an auxiliary tab is docked, minimized, or shown from an edge slide-out, **When** the context menu opens, **Then** Float is available unless that specific panel type is intentionally non-floatable.
7. **Given** a panel type is intentionally non-closable, non-floatable, or mode-restricted, **When** the context menu opens, **Then** unavailable commands are disabled rather than silently failing.

---

### User Story 4 - Preserve Layout Across Restarts (Priority: P2)

As a Blue user, I need floated and docked window state to survive app restart so my workspace arrangement remains stable across sessions.

**Why this priority**: Window layout persistence already exists as a workbench goal. Float/dock parity must integrate with that saved layout instead of becoming a transient session-only feature.

**Independent Test**: Float groups from multiple workbench areas, move and resize their separate windows, restart the application, and verify windows, docked groups, active tabs, and safe on-screen bounds are restored.

**Acceptance Scenarios**:

1. **Given** the user floated a group and moved or resized its window, **When** the app restarts, **Then** the group reopens in a separate window with valid saved bounds.
2. **Given** a floating window's saved display is no longer available, **When** the app restarts, **Then** the window is restored on an available display rather than offscreen.
3. **Given** a group was floated and then docked before quitting, **When** the app restarts, **Then** the group remains docked and does not reopen in a separate window.
4. **Given** the user resets windows to defaults, **When** the reset completes and the app restarts, **Then** floating window state from this feature is cleared with the rest of the workbench layout state.

---

### User Story 5 - Manage Tab Groups Without Losing Panel Identity (Priority: P2)

As a Blue user, I need group-level and multi-tab actions to behave predictably so editor and auxiliary panels do not duplicate, disappear unexpectedly, or return to the wrong mode.

**Why this priority**: Java NetBeans window management is mode-aware. The Electron workbench must preserve stable panel identity and group relationships when users use Close All, Close Other, Maximize, Restore, Shift, Float, and Dock commands.

**Independent Test**: Use context-menu actions in tab groups containing multiple editor and auxiliary tabs, then verify each panel has exactly one visible or restorable instance and each group retains the expected active tab.

**Acceptance Scenarios**:

1. **Given** a tab group contains multiple tabs, **When** the user chooses Close Other, **Then** only sibling tabs eligible for closing in that same context close.
2. **Given** a tab group contains multiple tabs, **When** the user chooses Close All, **Then** eligible tabs in that context close according to the same scope Java Blue users expect for a tab menu.
3. **Given** a group is maximized, **When** the user chooses Restore, **Then** the group returns to its previous workbench state with the same active tab where possible.
4. **Given** a tab is shifted left or right, **When** the command completes, **Then** the tab order changes without changing panel content, active state, or docking mode.

---

### User Story 6 - Reveal Panels Across Docked And Floating Windows (Priority: P2)

As a Blue user, I need Window menu entries and other reveal commands to focus the existing panel wherever it currently lives so floating windows do not create duplicate panels or hide active work.

**Why this priority**: Floating windows make reveal behavior more important. A user may reveal a panel from the Window menu, a shortcut, or another stable command while that panel is already docked, minimized, or floating.

**Independent Test**: Float a multi-tab group, select a different tab in the main window, invoke reveal commands for each floated tab, and verify the existing floating window is focused and the requested tab is selected rather than opening a duplicate.

**Acceptance Scenarios**:

1. **Given** a panel is already floating, **When** the user invokes that panel from the Window menu or another reveal command, **Then** the floating window is focused and the requested tab is selected.
2. **Given** a floating window contains multiple tabs, **When** the user invokes a reveal command for a non-active tab in that window, **Then** the same floating window is focused and that tab becomes active.
3. **Given** a panel is minimized or shown from an edge slide-out, **When** the user invokes a reveal command, **Then** the existing minimized or slide-out presentation is focused or restored according to the existing edge behavior.
4. **Given** a panel is not currently open but is eligible to open from a menu entry, **When** the user invokes that entry, **Then** it restores its valid close-time placement; when no such placement exists, it opens in its default Java Blue-inspired mode.

### Edge Cases

- A floating group is docked after its original group has been closed, hidden, minimized, or reset.
- The last remaining tab in a group is floated, closed, or docked, leaving the original group empty.
- A tab is floated while its group is maximized, minimized, or shown from an edge slide-out.
- Multiple floating windows exist at the same time, including windows from editor, output, and properties contexts.
- A saved floating window location is outside all currently connected displays or smaller than the usable minimum size.
- A user closes a floating window that contains a panel with unsaved or live project state.
- A floating window close request affects multiple tabs with mixed close eligibility.
- A context-menu command is chosen immediately after a focus change, so the focused group and the tab that opened the menu differ.
- A tab is not closable, dockable, floatable, or shiftable because of its panel type or current mode.
- A Window menu command targets a panel that is already floating, minimized, or active in a different window.
- A panel is closed from an editor tab group, auxiliary edge, minimized rail, or slide-out and is later reopened through the Window menu.
- An auxiliary panel is floated from an edge tab or slide-out and then docked after the edge group has changed.
- A single-panel auxiliary group is floated, causing Dockview to retain a hidden edge reference that must not become an empty splitter or override the saved edge size on Dock.
- Reset Windows is invoked while floating windows are open.
- Layout data from an older version contains docked tabs but no floating-window origin metadata.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Float MUST move the selected tab into a separate top-level application window frame, not into an in-workbench floating overlay.
- **FR-002**: Float Group MUST move the selected tab's containing tab group into a separate top-level application window frame, matching NetBeans `UndockModeAction` group detachment.
- **FR-003**: A floating group MUST retain its stable panel identities, tab titles, tab order, active tab, content state, active selection, close eligibility, and command eligibility from the user's perspective.
- **FR-004**: A tab MUST NOT appear as two logical panel instances after Float, Dock, restore, layout reload, or reveal commands.
- **FR-005**: Dock MUST return a floated tab to its previous tab group, edge assignment, presentation state, and relative tab order when that location is still valid.
- **FR-006**: Dock Group MUST return a floated group to its previous tab group, edge assignment, presentation state, and relative tab order when that location is still valid.
- **FR-007**: Dock and Dock Group MUST return floated content to the appropriate default mode for its panel types when its previous tab group, edge assignment, or presentation state is no longer valid.
- **FR-008**: The workbench MUST remember enough origin information for each floated tab or group to support user-visible dock-back behavior across the current session and persisted layout restore.
- **FR-009**: Closing a floating tab or floating window MUST follow the same close rules as closing the same tabs while docked, including prevention or prompting when a tab cannot be closed.
- **FR-010**: A floating window MUST participate in normal application focus, move, resize, and close behavior as a separate user-visible window.
- **FR-011**: Floating windows MUST share the same active project session, project mutation behavior, playback/live state, selection behavior, and command routing as the main workbench.
- **FR-012**: The tab context menu MUST be available from every visible tab surface in scope, including editor tabs, auxiliary tabs, bottom/output tabs, properties tabs, edge-managed tabs, slide-out tabs, and floating-window tabs.
- **FR-013**: The editor tab context menu MUST include user-facing commands for Close, Close All, Close Other, Maximize or Restore as appropriate, Float, Float Group, Dock, Dock Group, Shift Left, Shift Right, Clone, New Document Tab Group, and Collapse Document Tab Group.
- **FR-014**: The view/auxiliary tab context menu MUST include user-facing commands for Close, Close Group, Maximize or Restore as appropriate, Minimize, Minimize Group, Float, Float Group, Dock, Dock Group, Move, Shift Left, Shift Right, Move Group, and Size Group, with unsupported submenu-style commands visible but disabled.
- **FR-015**: Context-menu command labels and enabled/disabled states MUST be determined from the tab that opened the menu, not merely the most recently focused tab elsewhere in the workbench.
- **FR-016**: Float MUST be enabled for editor, output, properties, and auxiliary panels unless a specific panel type is intentionally documented as non-floatable.
- **FR-017**: Float Group MUST be enabled only when every panel in the selected group can be detached from its current context.
- **FR-018**: Dock and Dock Group MUST be enabled only when the selected tab or group is currently floating or otherwise eligible to return from a detached/minimized presentation.
- **FR-019**: Shift Left MUST be disabled for the first tab in a group, and Shift Right MUST be disabled for the last tab in a group.
- **FR-020**: Shift Left and Shift Right MUST reorder tabs within the current tab group without changing panel identity, panel content, or docking mode.
- **FR-021**: Close All, Close Other, and Close Group MUST operate within the same context scope Java Blue users expect for a tab context menu and MUST NOT close unrelated tabs in other workbench groups or floating windows.
- **FR-022**: Maximize and Restore commands MUST preserve the selected tab, group membership, and the prior presentation state needed to return to the original layout.
- **FR-023**: Floating window bounds, active tabs, docked tab locations, edge/minimized origins, and dock-back origins MUST persist through application restart as application layout state.
- **FR-024**: Persisted floating window bounds MUST be validated before display and corrected to a visible on-screen location when displays or scale factors have changed.
- **FR-025**: Reset Windows MUST clear floated-window state, dock-back origins, saved floating bounds, and any related tab presentation state while preserving project data and unrelated program settings.
- **FR-026**: Reveal commands from the Window menu or other stable panel entry points MUST focus the existing docked, floating, minimized, slide-out, or maximized panel rather than opening a duplicate instance.
- **FR-027**: Window menu entries for workbench panels in scope MUST route to the existing panel presentation state; if the target panel is floating, the floating window must be focused and the target tab selected.
- **FR-028**: A panel that is not currently open but is eligible to open from the Window menu MUST restore its close-time mode, group/edge, presentation, and tab position when a valid close origin exists; otherwise it MUST open in its default Java Blue-inspired mode.
- **FR-029**: Editor-mode panels, output-mode panels, properties panels, and auxiliary panels MUST retain their Java Blue-inspired default modes after docking or reset.
- **FR-030**: The workbench MUST handle older saved layout data that lacks float/dock origin metadata by using safe defaults instead of failing to load the layout.
- **FR-031**: Additional Java Blue/NetBeans tab context-menu commands discovered during parity review, including commands outside the required core set in FR-013/FR-014, MUST be classified before acceptance as implemented, deferred, or intentionally omitted.
- **FR-032**: Automated coverage MUST verify Float, Float Group, Dock, Dock Group, context-menu enablement, tab shifting, close scope, layout restore, offscreen correction, reset behavior, Window-menu reveal routing, shared-session behavior, and duplicate-prevention for representative editor and auxiliary panels.
- **FR-033**: Manual parity review MUST compare the completed behavior against Java Blue/NetBeans for Float, Float Group, Dock, Dock Group, Close, Close All, Close Other, Close Group, Maximize/Restore, Minimize, Minimize Group, Shift Left, Shift Right, Window-menu reveal, auxiliary-panel floatability, and edge/minimized interactions.
- **FR-034**: Close and Close Group MUST capture a restorable placement without retaining an empty Dockview group, adding a stray splitter, or reopening a closed auxiliary panel in a different edge or presentation.

### Key Entities _(include if feature involves data)_

- **Workbench Panel**: A logical user-facing Blue surface with a stable identity, title, default mode, content state, and command eligibility.
- **Tab Group**: A set of one or more panels sharing a tab strip, active-tab identity, ordering, and presentation state.
- **Floating Window**: A separate application window frame that hosts one or more workbench panels outside the main window while preserving panel identity and shared project-session behavior.
- **Docking Origin**: The remembered prior group, mode, edge assignment, minimized or slide-out state, tab order, split reference, and fallback placement used when a floating group is docked back or a closed panel is reopened.
- **Tab Context Menu State**: The command list and enabled/disabled state computed for the tab that opened the menu.
- **Window Menu Reveal Target**: A stable panel entry point that focuses or opens a panel according to its current presentation state without creating duplicates.
- **Window Layout Snapshot**: App-level layout data that records docked groups, floating windows, active tabs, bounds, edge/minimized state, origin metadata, and resettable presentation state.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In parity tests, Float and Float Group open separate top-level window frames for representative editor, output, properties, and auxiliary tabs/groups in 100% of tested cases.
- **SC-002**: In parity tests, Dock and Dock Group return floated tabs/groups to their prior group, edge assignment, presentation state, and tab position when valid, and to the correct default mode fallback when not valid.
- **SC-003**: In automated or scripted UI tests, no tested Float, Dock, Window-menu reveal, restart, or reset flow creates a duplicate logical panel instance.
- **SC-004**: Context-menu enabled/disabled states are correct for first tab, middle tab, last tab, single tab, non-closable tab, docked tab, and floating tab cases.
- **SC-005**: A saved layout containing at least two floating windows restores with valid on-screen bounds after restart.
- **SC-006**: Reset Windows removes floated-window state and returns the workbench to default docked placement without changing the open project document.
- **SC-007**: Window menu reveal actions focus already-floating panels and select the requested tab in 100% of tested representative cases.
- **SC-008**: Manual parity review against Java Blue/NetBeans finds no major user-visible mismatch in Float, Float Group, Dock, Dock Group, Close, Close All, Close Other, Close Group, Maximize/Restore, Minimize, Minimize Group, Shift Left, Shift Right, Window-menu reveal, auxiliary-panel floatability, or edge/minimized float interactions.
- **SC-009**: In automated tests, a closed editor tab returns to its prior tab group/index, and closed auxiliary tabs return to their prior edge, size, minimized/slide-out state, or derived group when reopened from the Window menu.
- **SC-010**: In automated and manual parity tests, docking a floated auxiliary panel removes any hidden Dockview source reference and restores its prior controlled width or height rather than a collapsed minimum size.

## Assumptions

- Java Blue and NetBeans are the parity reference for this feature whenever current Electron behavior differs.
- "Float" means a separate application window frame visible to the operating system window manager.
- "Dock" means return the selected tab from a detached or floating presentation to the main workbench, preferring the remembered origin and falling back to the panel's default mode.
- "Float Group" and "Dock Group" are the NetBeans mode/group commands; unqualified "Float" and "Dock" are selected-tab commands.
- Floating windows share the same project session as the main window; they do not create separate project documents.
- Window layout state is app-level state and does not belong in `.blue` project XML.
- Implementation mechanism is a planning decision; this specification constrains the user-visible requirement that floated content is in a separate application window and remains part of the same project session.
- The required first-slice context-menu command set is the NetBeans tab popup set for editor and view modes. Submenu-style commands that have no current Electron equivalent, such as Move, Move Group, and Size Group, must remain visible but disabled or be explicitly classified during planning or parity review.
- Existing theme and tab-strip visual work remains in place; this feature focuses on behavior, persistence, and parity of tab commands.
