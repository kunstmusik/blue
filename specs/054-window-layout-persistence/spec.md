# Feature Specification: Window Layout Persistence

**Feature Branch**: `054-window-layout-persistence`
**Created**: 2026-07-05
**Status**: Closed
**Input**: User description: "Use speckit to create a new branch and spec for Window sizing/location + split view location saving/loading. What I'd like is for splits to default to 200px from a side or bottom, and for all split locations to be saved. Also, I'd like all window locations and sizes to be maintained. Review Java Blue for parity on the 200 px sizing location and window size/location saving. Check where we are storing current application-wide config data and plan to save data there too. Also, in java Blue, there's a \"Reset Windows\" option that returns the app to the defaults, which I'd like implemented too. Be sure to use test-driven development as part of the spec and have sufficient test coverage of settings saving."

**Reference Review**: Java Blue and current Electron storage findings are summarized in [research.md](research.md).

## Release Compatibility

This feature is still pre-release and has not shipped in Blue 3.0.0. Before that
release, the active `SplitId` set may change without a backward-compatibility
reader; removed pre-release split IDs are intentionally not accepted or migrated.
No migration is required in this pre-release change. Once 3.0.0 is released, a
follow-up versioned migration must handle settings written by pre-3.0 builds
before compatibility is promised for later layout-schema changes. After 3.0.0,
removing or renaming a persisted split ID requires migration first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Restore Window Size And Location (Priority: P1)

As a composer using Blue across sessions, I need every movable or resizable application window to reopen where I left it so I can keep a stable workspace on my displays.

**Why this priority**: Window position and size persistence is the primary user-visible gap. Without it, every restart requires manual workspace setup.

**Independent Test**: Move and resize the main window and every currently implemented app-owned secondary window in scope, close and reopen the app, and verify each window restores to its previous size, location, and display state.

**Acceptance Scenarios**:

1. **Given** the app has no saved window state, **When** it opens, **Then** the main window uses the default Java Blue-inspired placement and no window appears offscreen.
2. **Given** the user moves and resizes the main window, **When** the app is restarted, **Then** the main window opens at the saved size and location.
3. **Given** the user moves and resizes an in-scope secondary application window, **When** that same window type is opened again, **Then** it appears at the saved size and location for that window identity.
4. **Given** a saved window was maximized or fullscreen, **When** that window is reopened, **Then** its normal bounds and display state are restored without losing the pre-maximized size.

---

### User Story 2 - Persist Split Locations With 200px Defaults (Priority: P1)

As a composer arranging the workbench, I need side and bottom splits to default to a useful 200px location and remember every splitter adjustment so editors reopen exactly as I arranged them.

**Why this priority**: Java Blue commonly initializes splitter panes at 200px, and repeated manual split adjustment is disruptive in score, orchestra, UDO, BSB, library, and output workflows.

**Independent Test**: Start from a clean settings file, verify representative side and bottom splits default to 200px, move each splitter, restart the app, and verify all moved splitter locations are restored.

**Acceptance Scenarios**:

1. **Given** no split state has been saved, **When** a side split appears, **Then** its controlled side pane defaults to 200px wide.
2. **Given** no split state has been saved, **When** a bottom split appears, **Then** its controlled bottom pane defaults to 200px tall.
3. **Given** no split state has been saved, **When** a view contains nested or multiple splitters, **Then** every individual user-adjustable splitter gets its own 200px controlled-pane default unless a documented Java parity exception or minimum-size constraint applies.
4. **Given** the user resizes a workbench side or bottom split, **When** the app is restarted, **Then** that split location is restored as the saved controlled-pane pixel size.
5. **Given** the user resizes an editor-owned split view, **When** that editor is reopened in a later session, **Then** that split location is restored as the saved controlled-pane pixel size.
6. **Given** a saved split location no longer fits the available window size, **When** the split view opens, **Then** the divider is clamped to usable bounds for display while preserving the saved value for larger future windows.

---

### User Story 3 - Reset Windows To Defaults (Priority: P1)

As a user whose workspace layout has become unusable, I need a Reset Windows command like Java Blue so I can return all windows and splits to their default positions without touching my project.

**Why this priority**: Persistence must include a reliable escape hatch; otherwise bad saved bounds, monitor changes, or accidental layout edits can trap users in a broken workspace.

**Independent Test**: Save non-default window bounds and split locations, invoke Reset Windows, verify the current session immediately returns to defaults, restart the app, and verify the reset default state persists.

**Acceptance Scenarios**:

1. **Given** customized window bounds and split locations are saved, **When** the user invokes Window > Reset Windows, **Then** all saved window bounds and split locations are cleared or replaced with defaults.
2. **Given** Reset Windows completes, **When** the app continues running, **Then** the open workbench immediately reflects the default layout and default split locations.
3. **Given** Reset Windows completed in a prior session, **When** the app is restarted, **Then** windows and splits still use defaults rather than the pre-reset custom values.
4. **Given** Reset Windows is invoked, **When** the operation completes, **Then** project data, recent files, audio/MIDI settings, render settings, and other unrelated program settings remain unchanged.
5. **Given** a project has unsaved edits, **When** the user invokes Reset Windows, **Then** the command does not prompt to save or discard the project because project data is not modified.

---

### User Story 4 - Prove Settings Persistence With TDD (Priority: P1)

As a maintainer, I need settings persistence covered by automated tests before and during implementation so layout regressions are caught without relying on manual restart checks.

**Why this priority**: This feature spans persistent settings, window lifecycle, layout serialization, migration, and reset behavior. The highest-risk behavior is silent data loss or stale settings reuse.

**Independent Test**: Run the targeted settings, window lifecycle, workbench layout, split-pane, and menu-command tests and verify failures are written before implementation and pass after implementation.

**Acceptance Scenarios**:

1. **Given** a saved settings file contains valid window and split state, **When** settings load, **Then** automated tests verify the exact persisted values are available to the app.
2. **Given** a saved settings file is missing the new layout fields, **When** settings load, **Then** automated tests verify defaults are merged without losing unrelated settings.
3. **Given** Reset Windows is invoked, **When** settings are saved, **Then** automated tests verify only layout-related settings changed.
4. **Given** legacy renderer-only layout data exists, **When** migration runs, **Then** automated tests verify it is copied into the app-wide settings location and not repeatedly re-imported.

### Edge Cases

- The app starts for the first time with no settings file.
- The settings file exists but does not yet contain window layout fields.
- The settings file is malformed, partially corrupted, or contains invalid window bounds.
- A saved window location is outside all currently connected displays.
- A saved split location is smaller than a pane's minimum size or larger than the available space; the visible split is clamped until the window is large enough, and the saved value is not overwritten solely because clamping occurred.
- The user changes monitor scale, removes a monitor, or docks/undocks a laptop between sessions.
- The app quits while a window is maximized, fullscreen, minimized, or still being resized.
- Multiple windows of the same type are opened over time.
- Legacy renderer data exists in the older `blue-settings.windowBounds` or `blue-workbench-layout` storage at the same time as the app-wide settings file.
- Reset Windows is invoked while a project is open and unsaved.
- Reset Windows is invoked when some secondary windows are currently closed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST persist window bounds, workbench layout, and split locations in the existing app-wide settings store rather than project files.
- **FR-002**: The persisted layout data MUST include a version so future layout migrations can be performed without discarding unrelated program settings.
- **FR-003**: Every user-movable or user-resizable application window in scope MUST have a stable window identity and persisted normal bounds containing x, y, width, and height.
- **FR-004**: The in-scope window identity list MUST be documented during planning and MUST include the main application window plus every currently implemented app-owned secondary window that users can move or resize.
- **FR-005**: Windows that can be maximized or fullscreen MUST preserve normal bounds separately from their display state.
- **FR-006**: A window MUST restore saved bounds before it is shown when valid saved bounds exist for that window identity.
- **FR-007**: A window MUST fall back to defaults when saved bounds are absent, malformed, too small, or not visible on an available display.
- **FR-008**: Saving window bounds MUST occur after user-driven move, resize, maximize, fullscreen, and close lifecycle changes without requiring a project save.
- **FR-009**: The workbench layout MUST persist open panels, active panels, docked or minimized auxiliary groups, left/right/bottom edge assignment, slideout state, and docked side/bottom sizes.
- **FR-010**: Workbench side and bottom split sizes MUST be persisted as controlled-pane pixel sizes and MUST default to 200px when no saved value exists.
- **FR-011**: Reusable split views and editor-specific splitters MUST have stable split identities and MUST persist user-adjusted divider locations as controlled-pane pixel sizes.
- **FR-012**: Side-oriented split views MUST default to a 200px controlled side pane when no saved value exists.
- **FR-013**: Bottom-oriented split views MUST default to a 200px controlled bottom pane when no saved value exists.
- **FR-014**: Existing non-200 renderer defaults for user-adjustable side or bottom splits MUST NOT be treated as exceptions unless planning documents a Java parity reason or a pane minimum-size constraint.
- **FR-015**: Saved split values MUST be restored on the next app launch or editor reopen before the user begins normal interaction with that split.
- **FR-016**: Split values MUST be clamped to valid visible bounds at render time without corrupting the saved value needed for larger future windows; clamping alone MUST NOT rewrite the saved value.
- **FR-017**: Legacy renderer-only layout values from `blue-settings.windowBounds` and `blue-workbench-layout` MUST be migrated into the app-wide settings store when possible.
- **FR-018**: Legacy migration MUST run automatically after app-wide settings are available, MUST be idempotent, and MUST NOT overwrite newer app-wide layout values once those values exist.
- **FR-019**: The Window menu MUST expose exactly one user-facing reset-layout command named "Reset Windows".
- **FR-020**: The existing narrower "Reset Default Layout" command MUST be renamed and expanded to Reset Windows rather than coexisting as a second reset command.
- **FR-021**: Reset Windows MUST clear or replace saved window bounds, workbench layout, and split locations with the default layout state.
- **FR-022**: Reset Windows MUST apply to the current running session as well as future launches.
- **FR-023**: Reset Windows MUST NOT alter project XML, unsaved project contents, recent files, render settings, audio/MIDI settings, OSC settings, utility settings, or other unrelated program settings, and MUST NOT trigger a project save/discard prompt.
- **FR-024**: Settings validation MUST reject or ignore unsafe layout values while preserving the rest of the settings snapshot.
- **FR-025**: Automated tests MUST be written first for settings save/load, default merging, invalid value handling, legacy migration idempotence, window bounds save/restore, pixel-based split location save/restore, split clamping without overwrite, workbench layout reset, menu command routing, and Reset Windows persistence.
- **FR-026**: The feature MUST preserve existing workbench panel behavior except for the requested persistence, 200px defaults, storage location, and Reset Windows behavior.

### Key Entities *(include if feature involves data)*

- **Window Layout Settings**: App-wide persisted data for user-adjustable window and workbench layout state, including a layout version.
- **Application Window**: A top-level app window with a stable identity, normal bounds, and optional display state; the required identity inventory is determined during planning from currently implemented app-owned windows.
- **Split Location**: A saved controlled-pane pixel size for a specific workbench edge or editor split view, recorded under a stable split identity.
- **Workbench Layout**: The saved arrangement of docked panels, auxiliary groups, minimized panels, active panels, edge assignments, and side/bottom sizes.
- **Reset Windows Defaults**: The default layout state used when no saved layout exists or after the user invokes Reset Windows.
- **Legacy Layout Data**: Existing renderer-side saved layout or window bounds data that predates app-wide layout settings, specifically `blue-settings.windowBounds` and `blue-workbench-layout`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated tests, valid saved main-window bounds restore exactly on the next app launch simulation in 100% of tested cases.
- **SC-002**: In automated tests, valid saved bounds for every in-scope secondary window identity restore exactly when those windows are reopened.
- **SC-003**: In automated tests, representative side and bottom split views default to 200px when no saved split value exists.
- **SC-004**: In automated tests, user-adjusted controlled-pane pixel sizes for one workbench split and at least three editor-owned split identities survive save/load cycles.
- **SC-005**: Reset Windows restores default window and split state immediately and after restart while preserving unrelated settings in 100% of tested cases.
- **SC-006**: Invalid or offscreen saved window bounds are rejected or safely corrected without preventing the app from opening.
- **SC-007**: Legacy renderer-only layout data migrates once into app-wide settings without duplicating or overwriting newer app-wide layout data.
- **SC-008**: No `.blue` project file changes are required for window or split persistence.

## Assumptions

- Java Blue is the behavioral reference for this slice; its many 200px split defaults establish the requested split baseline.
- Java Blue's NetBeans window system provides the conceptual Reset Windows behavior by restoring shipped window-system defaults and discarding user window overrides.
- The existing app-wide program settings file is the correct persistence home for this app-level state.
- Split locations are canonicalized as pixel sizes for the controlled pane. A split implementation may still use ratios internally during rendering, but settings save/load behavior must preserve the user-facing pixel size.
- Native operating-system file dialogs are outside this feature because their bounds are owned by the OS.
- If multiple instances of the same secondary window type exist, the feature may persist a type-level default unless the window has a stable per-instance identity available.
- Reset Windows is an application layout reset only; it is not a full settings reset.
