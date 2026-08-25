# Feature Specification: Fix Popout Portal Correctness

**Feature Branch**: `089-fix-popout-portals`

**Created**: 2026-08-24

**Status**: Complete

**Input**: User description: "Fix wrong-window portal and popout correctness
issues found in the codebase audit: Radix context menus in floated score panels
opening in the main window, EditableLineCanvas portals and window listeners,
cross-realm containment checks, and document-scoped dismissal/Escape listeners
in floateable workbench panel content." Follow-up from live acceptance:
preserve exact floating-group state when quitting and restarting the app.

## Clarifications

### Session 2026-08-24

- Q: Should FR-009's "one reusable mechanism" mean one unified API, or one convention supported by several focused shared primitives? → A: One convention with shared focused primitives.
- Q: What test granularity should "each corrected surface" require? → A: Tests per distinct code path, with representative coverage per surface category.
- Q: Which cross-window events, if any, should dismiss a popup? → A: Host-window input only; close/re-dock lifecycle events may dismiss.
- Q: Does the feature include preserving floated-group membership across app
  shutdown and restart after the live popup work exposed restore failures? → A:
  Yes. A panel that was floated at quit must restore in a separate window with
  exactly the saved panels; shutdown teardown must not overwrite that intent.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Context menus work inside floated score panels (Priority: P1)

A user floats the Score panel (or a track-group/patterns sub-view) into its own
window and right-clicks an object, layer, fade handle, or pattern. The context
menu must open next to the cursor inside that floating window, remain visible
while the pointer moves over it, let the user choose an item, and close on
selection, outside click, or Escape — all inside the same window.

Today these menus open in the main application window instead, leaving the
floating window apparently unresponsive to right-clicks.

**Why this priority**: This is the most frequently used interaction on the score
timeline and the exact scenario class that produced the already-fixed color
picker defect. Right-click management of objects is unusable in a floated Score
panel today.

**Independent Test**: Float the Score panel, right-click each menu-bearing
surface (timeline object, layer row header, fade handle, pattern), and confirm
the menu appears, functions, and dismisses entirely within the floating window.

**Acceptance Scenarios**:

1. **Given** a floated Score panel, **When** the user right-clicks a score
   object on the timeline, **Then** a context menu appears adjacent to the
   cursor inside the floating window and choosing an item applies the action.
2. **Given** a floated Score panel with a context menu open, **When** the user
   presses Escape or clicks elsewhere in the floating window, **Then** the menu
   closes without affecting the main window's UI state.
3. **Given** a floated Score panel, **When** the user opens a nested submenu
   (e.g., fade adjustments), **Then** the submenu appears in the floating
   window attached to its parent item.

---

### User Story 2 - Line editor overlays work inside floated editor panels (Priority: P2)

A user floats a panel containing a line-based editor (line object editor,
Zak line editor, sound editor envelopes, BSB line widgets). The editor's
right-click context menu, hover coordinate tooltip, and point-editor overlay
must render, position, and dismiss inside the floating window using that
window's viewport bounds.

**Why this priority**: These editors are common authoring surfaces; their
overlays currently appear in the wrong window or clamp to the wrong viewport,
which corrupts editing sessions.

**Independent Test**: Float a panel containing a line editor, hover to trigger
the tooltip, right-click for the context menu, and open the point editor;
confirm each renders inside the floating window at sensible positions.

**Acceptance Scenarios**:

1. **Given** a floated panel with a line editor, **When** the user hovers over
   the plot, **Then** the coordinate tooltip appears near the pointer inside
   the floating window, clamped to that window's edges.
2. **Given** a floated line editor with its context menu open, **When** the
   user mousedowns outside the menu (but inside the floating window), **Then**
   the menu closes; mousedown inside the menu keeps it open.
3. **Given** a floated line editor, **When** the user opens the point editor,
   **Then** the modal overlay covers the floating window and Escape closes it.

---

### User Story 3 - Dismissal and keyboard handling follow the hosting window everywhere (Priority: P3)

All remaining popup-like surfaces in floateable panel content — inline dropdown
menus (e.g., note processor Add/Import menus), panel-opened dialogs' Escape
handling, and selection tracking in the output panel — must detect dismissal
input in the window that actually hosts them, so they behave identically docked
or floated.

**Why this priority**: Lower individual visibility than menus/tooltips but part
of the same correctness contract; leaving them broken produces confusing
half-working floating panels.

**Independent Test**: For each listed surface, float the host panel, invoke the
popup, and verify outside-click/Escape dismiss it within the floating window.

**Acceptance Scenarios**:

1. **Given** a floated panel showing the note processor chain editor, **When**
   the user opens the Add menu and clicks elsewhere in the floating window,
   **Then** the menu closes.
2. **Given** a dialog opened from a floated panel (e.g., ruler configuration),
   **When** the user presses Escape while the floating window has focus,
   **Then** the dialog closes.
3. **Given** a floated output panel, **When** text selection changes inside
   it, **Then** selection-dependent UI in that panel updates as it does docked.

---

### User Story 4 - One consistent rule prevents future regressions (Priority: P3)

Developers adding new popup surfaces to workbench panel content have a single
documented convention, supported by reusable focused primitives, for "render
into and listen to the window that hosts your anchor," so new panels do not
reintroduce wrong-window behavior. The convention is recorded in project
documentation and applied consistently by the fixes above.

**Why this priority**: Prevents recurrence; cheap once Stories 1–3 establish
the pattern.

**Independent Test**: Reading the project documentation explains the rule and
how to apply it; a code review of any new popup can check against one named
convention instead of per-component folklore.

**Acceptance Scenarios**:

1. **Given** the updated project documentation, **When** a developer adds a
   new context menu to a panel, **Then** the documentation states where the
   popup must render and how dismissal must be bound, with a reference
   example in the codebase.

---

### User Story 5 - Floated groups survive app restart exactly (Priority: P1)

A user floats Score (or a multi-panel group), quits the application, and
restarts it. The same group must reopen as a separate native window with
exactly the saved panel membership. Other editors must remain in the main
window, and application shutdown must not visibly redock the group or replace
the saved floated layout with teardown state.

**Why this priority**: The portal fixes are not usable as a durable workflow if
quitting either loses the floating window or restores every editor into it.
This failure was found during live acceptance of Story 1.

**Independent Test**: Reset the window layout, float only Score, quit, restart,
and wait beyond startup stabilization. Confirm that the popout remains open
with only Score and the main window retains all other editors and auxiliary
panels.

**Acceptance Scenarios**:

1. **Given** only Score is floated when the user quits, **When** the app
   restarts, **Then** one floating window remains open containing only Score,
   while every other editor remains in the main window.
2. **Given** an exact multi-panel group is floated when the user quits,
   **When** the app restarts, **Then** the floating window contains that exact
   group and no panels outside the saved membership.
3. **Given** floating-window restoration cannot complete, **When** startup
   recovers, **Then** the affected panels remain usable in the main window and
   Reset Windows remains functional rather than leaving the app windowless.

### Edge Cases

- A panel is re-docked (or its floating window closes) while a popup is open:
  the popup closes cleanly with no orphaned visuals in either window and no errors.
- A popup interaction starts immediately after floating (panel DOM not yet
  interacted with in the new window): first click behaves correctly.
- Multi-monitor setups: positioning uses the hosting window's viewport, never a
  global screen assumption.
- Node/test environments without a real second document: components must not
  crash; two-document simulation in tests mirrors the floating mechanism.
- Docked behavior must remain byte-for-byte identical in feel: no popup may
  change position, stacking, or timing when panels are docked.
- Shutdown closes native popout windows as part of teardown: the transient
  redocked state produced by that close must not replace the last user-visible
  floated layout.
- Saved popout identifiers may differ from runtime group identifiers after
  restore; restored origin metadata must follow the new runtime identity.
- A floating window may initially expose a provisional document before its
  intended page is ready; startup must neither treat that transient state as a
  successful restore nor destroy a window that is still navigating.
- Rebuilding auxiliary edge groups after a restore must use an anchor that is
  resident in the main grid, never a panel hosted in another window.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every popup surface (context menu, submenu, dropdown, tooltip,
  hover card, color picker, inline dialog) invoked from UI hosted in a floating
  panel MUST render visually inside the floating window that hosts the
  interacting content.
- **FR-002**: Popup positioning MUST be computed against the viewport of the
  window that hosts the interacting content, including clamping and flip
  decisions.
- **FR-003**: Dismissal inputs (outside pointer-down, Escape key) MUST be
  observed in the window that hosts the popup; inputs in other windows MUST NOT
  dismiss it. Explicit panel lifecycle events, including closing the floating
  window or re-docking its panel, MAY dismiss the popup as required by FR-006.
- **FR-004**: Hit-containment logic (deciding whether a pointer event landed
  inside a popup or its anchor) MUST work regardless of which window's objects
  originated the event or the popup content.
- **FR-005**: All popup behavior for docked panels MUST remain unchanged from
  current behavior.
- **FR-006**: When a floating panel closes or is re-docked while a popup is
  open, the popup MUST be dismissed without errors or leftover artifacts in
  either window.
- **FR-007**: Settings windows and standalone dialogs that do not participate
  in panel floating MUST continue to behave exactly as today.
- **FR-008**: Every distinct corrected code path or shared primitive MUST have
  a focused automated regression test at the lowest practical boundary that
  reproduces the wrong-window failure mode (two-document simulation where
  practical). Each surface category in the confirmed scope inventory MUST
  also have representative integration coverage; individual UI instances
  that share an already-covered code path do not require duplicate tests.
- **FR-009**: The repository MUST document a single named convention for
  popup hosting/dismissal in floateable panel content. The corrected surfaces
  MUST follow that convention through shared, focused primitives for the
  relevant concerns rather than a single monolithic API or ad hoc
  per-component fixes.
- **FR-010**: The persisted workbench layout MUST preserve whether a panel or
  group was floated at the last user-visible state before quit, including its
  exact ordered panel membership, active panel, bounds, and docking origin.
- **FR-011**: Application shutdown MUST NOT persist transient redocking caused
  solely by closing native floating windows after quitting has begun.
- **FR-012**: Startup restoration MUST recreate each saved floating group from
  its serialized panel membership and MUST NOT infer group membership from an
  ambiguous panel/group identifier.
- **FR-013**: Main-grid layout rebuilding after popout restoration MUST use
  only main-grid panels as positional anchors.
- **FR-014**: A failed or superseded asynchronous popout restore MUST recover
  to a usable docked layout, MUST NOT publish stale state, and MUST leave the
  window reset path operational.

*Scope inventory (confirmed instances to correct under FR-001..FR-004):*
score timeline context menus (score time canvas incl. object/fade/pattern
submenus, track group canvas incl. fade submenus, patterns layer group canvas),
line editor overlays (context menu, hover tooltip, point editor, viewport
clamping), note processor chain inline menus, panel-opened dialog Escape
handling (ruler config ×2, tracker editor, presets manager, note processor code
modal), output panel selection tracking and explicit-container menu, and
realm-sensitive containment checks in arrangement/live-space/piano-roll
surfaces. The follow-up lifecycle scope also includes workbench layout save on
quit, asynchronous popout recreation on startup, exact group membership,
auxiliary edge rebuilding, and failure recovery.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: N/A — panel floating is an Electron-host capability
  with no Java Blue counterpart; Java parity is unaffected.
- **Compatibility Requirements**: Project data (.blue XML), CSD generation,
  non-layout program settings, and library stores are untouched. The existing
  program-settings workbench-layout schema remains unchanged, but its save and
  restore semantics are corrected. Docked-panel popup behavior and existing
  test contracts MUST be preserved. The previously fixed color picker behavior
  MUST NOT regress.
- **Intentional Divergences**: None beyond what already exists between the
  Electron host UI and Java Blue (this feature changes no parity-relevant
  behavior).
- **State Ownership**: Popup open/closed state remains renderer-session state.
  Window/group placement remains owned by the existing canonical workbench
  layout inside program settings; no second persistence location or schema is
  introduced. Canonical project data remains untouched.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the inventoried popup surfaces operate correctly inside a
  floated panel (renders in-window, positions in-window, dismisses in-window),
  verified by the acceptance scenarios above.
- **SC-002**: Zero behavioral regressions in docked mode: the full automated
  suite passes unchanged except for additions.
- **SC-003**: Every distinct corrected code path or shared primitive has a
  regression test that fails when its wrong-window behavior is reintroduced,
  and every inventoried surface category has representative integration
  coverage (demonstrated at least once via mutation during development).
- **SC-004**: A reviewer can locate the single documented convention and its
  shared focused primitives for popup hosting in under 5 minutes from the
  project's agent/documentation entry points.
- **SC-005**: In a real Electron float → quit → restart check, the saved
  floating window remains open beyond startup stabilization, contains exactly
  the serialized panels, and produces zero restore-related console errors.

## Assumptions

- Floating workbench panels exist today (SPEC 055) and share the main
  renderer's execution context while living in separate OS windows/documents;
  this feature treats that architecture as given.
- Existing valid and previously failed workbench snapshots may be encountered.
  Valid serialized popout intent is restored exactly; unrecoverable intent may
  fall back to a usable docked layout without changing the persisted schema.
- Scope covers the *confirmed* wrong-window instances from the audit (listed in
  the scope inventory). Window-level drag-handler behavior in floated panels
  (sliders, splitters, canvas drags) is suspected affected but unverified; it is
  OUT OF SCOPE here and should get its own investigation unless trivially
  covered by the same focused primitives.
- The settings BrowserWindow and other non-floating windows are excluded.
- Verification relies primarily on two-document simulated-environment tests
  plus targeted live acceptance on the score panel; full manual sweeps of every
  floateable panel are not required if the shared focused primitives and
  required category-level integration tests pass.
- Documentation updates land in the existing agent guidance/docs structure
  referenced by AGENTS.md.
