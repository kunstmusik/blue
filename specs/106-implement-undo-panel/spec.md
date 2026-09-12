# Feature Specification: Undo History Panel

**Feature Branch**: `106-implement-undo-panel`

**Created**: 2026-09-11

**Status**: Closed — implementation complete, feature validation green, and project-owner acceptance of the native application scenarios recorded in quickstart.md (2026-09-11)

**Input**: User description: "A panel that would default to being closed, but if opened defaults to using the Properties mode (and be shown as a menu entry from Windows -> Properties). The panel should have a list of edits with a way to represent the undo/redo stack, ordered by most recent edit first. There should be an undo and redo button up top."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the Undo History panel from the Properties menu (Priority: P1)

A composer wants to see what the undo/redo system will do next. The panel is closed by default so it never competes for workspace, and opens through the Window → Properties menu alongside the other properties panels, docking into the right-edge properties area.

**Why this priority**: The panel delivers no value if it cannot be found and opened predictably; discoverability and default-closed behavior define the feature's footprint.

**Independent Test**: Launch the application with a default layout and confirm the panel is absent; open it via Window → Properties → Undo History and confirm it appears docked in the properties area; close and reopen the application and confirm the panel's closed/open state and placement are remembered.

**Acceptance Scenarios**:

1. **Given** a fresh default workbench layout, **When** the application starts, **Then** the Undo History panel is not open.
2. **Given** the application running, **When** the user opens Window → Properties, **Then** an entry for the Undo History panel is listed and opens the panel when selected, docked with the other properties panels.
3. **Given** the panel opened, moved, minimized to the rail, or closed, **When** the application restarts, **Then** the existing workbench layout persistence restores that state the same way it does for every other panel, without new settings.
4. **Given** the panel closed after having been opened and placed, **When** the user reopens it from the menu, **Then** it returns to its prior placement rather than a default one, matching existing panel reopen behavior.

---

### User Story 2 - Read the edit history as an undo/redo stack (Priority: P1)

A composer sees the committed edits of the open project as a list, most recent first, each shown with its action label, and can tell at a glance which edits are currently applied, which have been undone, and where the document currently sits in the stack.

**Why this priority**: The list is the feature's core value: it turns the invisible undo stack into something a composer can read and trust before acting.

**Independent Test**: Make three labeled edits (for example a score move, a mixer level change, a scratch pad edit), undo one, and confirm the list still shows all three in most-recent-first order with exactly the top entry shown as undone and a clear indication of the current position between applied and undone edits.

**Acceptance Scenarios**:

1. **Given** a project with several committed edits, **When** the panel is opened, **Then** edits are listed most recent first, each with the same semantic action label the existing Undo/Redo menu items use.
2. **Given** the list, **When** the user undoes one or more edits through any means, **Then** the undone edits remain in the list, are visually distinguished from applied edits, and the current-position indicator sits between the applied and undone portions.
3. **Given** an undone edit, **When** the user redoes it, **Then** the entry returns to applied styling and the position indicator moves accordingly.
4. **Given** a save followed by further edits, **When** the user views the list, **Then** the entry corresponding to the last saved state is identifiable.
5. **Given** a project with no committed edits, or no project loaded, **When** the panel is open, **Then** a clear empty state is shown instead of a list, with no phantom entries.

---

### User Story 3 - Undo and redo from the panel (Priority: P1)

A composer uses prominent Undo and Redo buttons at the top of the panel to step through history, with the same semantics, ordering, labels, and availability as the existing application-wide Undo/Redo commands.

**Why this priority**: Co-located command and visualization make the panel a self-contained history workspace; button behavior must not diverge from the canonical undo/redo the rest of the application uses.

**Independent Test**: With edits in history, use the panel's Undo button twice and Redo once; confirm each click reverses or restores exactly one labeled action, the list and position indicator update, and the Edit menu's Undo/Redo labels and enablement always agree with the panel's buttons.

**Acceptance Scenarios**:

1. **Given** applied edits in history, **When** the user clicks the panel's Undo button, **Then** exactly one action is reversed and every affected open view updates, identical to invoking Undo from the Edit menu or keyboard shortcut.
2. **Given** no applied edits (or no redoable edits), **When** Undo (or Redo) is unavailable, **Then** the corresponding button is visibly disabled.
3. **Given** available actions, **When** the buttons render, **Then** their labels or tooltips describe the next action to be undone/redone using the same wording as the Edit menu.
4. **Given** an edit pending in another window, **When** the user clicks Undo in the panel, **Then** the existing settlement behavior applies — the pending edit is settled or explicitly rejected before the undo proceeds, with no delayed reapplication afterward.
5. **Given** a new edit committed after undos, **When** the list refreshes, **Then** the discarded redo branch disappears from the applied/undone split, matching the engine's branch discard semantics.

---

### User Story 4 - Trust the list across windows, merges, and limits (Priority: P2)

A composer can leave the panel open and rely on it: entries committed from detached panels or dedicated editor windows appear without manual refresh; a typing gesture appears as one entry; and when retention limits drop the oldest edits the list says so instead of silently mismatching the stack.

**Why this priority**: A stale or silently truncated list is worse than no list; cross-window correctness and limit transparency protect trust in the P1 stories.

**Independent Test**: With the panel open, commit an edit from a detached popout editor and a short burst of typing in one field; then fill history past the retention limit and confirm the list shows the burst as one entry, includes the popout edit, and indicates that oldest edits were dropped.

**Acceptance Scenarios**:

1. **Given** the panel open, **When** an edit is committed from any participating window or popout, **Then** the list reflects it without manual refresh.
2. **Given** continuous typing in one field within the gesture grouping window, **When** the entries are viewed, **Then** the typing appears as a single labeled entry, consistent with how it would undo.
3. **Given** history retention limits reached, **When** oldest entries are evicted, **Then** the list shows the remaining entries and indicates that a limit was reached, and never displays an entry the engine can no longer undo.
4. **Given** the current project closed or replaced, **When** another project is opened, **Then** the list shows only the new project's history, with no entries carried over.

### Edge Cases

- Rapid consecutive commits, undos, and redos must leave the displayed list matching the engine's history state, with no out-of-order or duplicated rows and no stale snapshot overwriting a newer one.
- Unchanged values, rejected edits, and cancelled gestures create no entries (and thus no rows), consistent with the no-phantom-steps rule of the underlying history system.
- Opening, closing, or merely viewing the panel must never create a history entry or mark the project dirty.
- A project switch while an undo/redo is in flight must not show or apply the previous project's entries.
- An oversize-action history reset (already user-approved elsewhere) must leave the panel showing an empty or consistent history, not a dangling list.
- The panel must render correctly in every presentation the auxiliary panel system supports: docked, minimized to the rail, slideout, maximized, and floated as an OS window.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The panel MUST be closed by default in a fresh workbench layout and MUST be openable through the existing Window → Properties menu, registering in the properties panel mode and its default dock placement.
- **FR-002**: The panel MUST list the open project's committed history entries ordered most recent first, showing each entry's semantic action label and commit time.
- **FR-003**: The list MUST represent the undo/redo split: entries before the current history position shown as applied, entries at or after it shown as undone and visually distinct, with a clearly identifiable indicator of the current position between the two groups.
- **FR-004**: The panel MUST provide Undo and Redo buttons at the top that invoke the same canonical project undo/redo behavior as the existing application commands, including settlement of outstanding edits, revision fencing, and reconciliation of all affected views.
- **FR-005**: Button availability MUST exactly mirror underlying history availability, and button labels/tooltips MUST describe the next action using the same semantic labels as the existing Undo/Redo menu items.
- **FR-006**: The list MUST update to match the engine's history state after every commit, undo, redo, gesture merge, retention eviction, and branch discard, without manual refresh, including edits originating in other windows and popouts.
- **FR-007**: The panel MUST be read-only with respect to project content and history: viewing, opening, closing, refreshing, or repositioning it MUST NOT create history entries, alter the history position, or affect project dirty state.
- **FR-008**: History data crossing the process boundary for this panel MUST be limited to lightweight per-entry summaries (identity, label, time) plus the current position — never full document snapshots or patch payloads.
- **FR-009**: The entry matching the last saved state MUST be identifiable in the list, consistent with the existing saved-state checkpoint semantics.
- **FR-010**: When history retention limits have caused eviction, the panel MUST indicate that oldest entries were dropped; entries outside retention MUST NOT be displayed.
- **FR-011**: On project close or replacement, the panel MUST clear its list; on project open, it MUST show the new project's history only.
- **FR-012**: The panel MUST present clear empty states when no project is loaded and when the loaded project has no history entries.
- **FR-013**: The panel's open/closed state, dock placement, and reopen-at-prior-placement behavior MUST be governed exclusively by the existing workbench layout persistence, with no new persistent settings.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue has no equivalent undo-history panel; this is an additive UI over the port's project-wide history (spec 103). Panel identity follows the existing `*TopComponent` naming and the Window → Properties grouping established by the ported window system.
- **Compatibility Requirements**: `.blue` XML, generated CSD, and project data are untouched. The existing native Window menu structure (including the Properties submenu), keyboard shortcuts, and Edit menu Undo/Redo items MUST continue to behave unchanged; the panel adds an entry point, not a second undo system.
- **Intentional Divergences**: None relative to Java Blue (additive feature). Within the port, no behavior diverges from spec 103's history semantics.
- **State Ownership**: The main process remains the canonical owner of project history and the saved-state checkpoint. The renderer owns only derived, disposable display state for the panel. Panel visibility and placement remain workbench layout state owned by the existing layout persistence; no state enters `.blue` XML.
- **Undo/Redo Impact**: N/A for new project mutations — the feature introduces no durable project writer. The panel's Undo/Redo buttons route to the existing canonical history commands and MUST inherit their commit→undo→redo guarantees (spec 103) without modification.

### Key Entities

- **History Entry Summary**: The user-visible projection of one committed action — its semantic label, commit time, stable identity, and position in the stack.
- **History Position**: The current point in the ordered stack separating applied (undoable) entries from undone (redoable) entries; moves with every undo/redo and resets on branch discard.
- **Undo History Panel**: A properties-mode workbench panel; a read-only visualization of the history plus an entry point to the canonical Undo/Redo commands.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All P1 acceptance scenarios pass: default-closed + menu-open + layout persistence (Story 1), most-recent-first labeled list with correct applied/undone split and position indicator (Story 2), and button-driven undo/redo indistinguishable from menu-driven commands (Story 3).
- **SC-002**: For a scripted sequence of at least 100 mixed edits with interleaved undos, redos, and a branch discard, the displayed list and position indicator match the engine's history state after every action with zero manual refreshes, duplicated rows, or out-of-order updates.
- **SC-003**: Edits committed from a second window or popout appear in the open panel's list without manual refresh in every scenario tested.
- **SC-004**: In no scenario does panel usage (open, view, refresh, close, reposition) create a history entry or change project dirty state.
- **SC-005**: Per-entry data crossing the process boundary is limited to summary fields, verified by contract tests asserting no document snapshot or patch payload is included.
- **SC-006**: The panel reuses the existing layout persistence with zero new settings entries, verified by inspection and by layout save/restore scenarios covering docked, rail-minimized, floated, and closed states.

## Assumptions

- The panel is titled "Undo History" and appears as an item inside the existing Window → Properties submenu (the application menu is labeled "Window"); no top-level menu item named "Properties" is added.
- Clicking an arbitrary entry to jump multiple undo/redo steps at once is out of scope for this feature; buttons step one action at a time, matching the engine's single-step API. Jump-to-entry can be a follow-up.
- History semantics, retention limits, gesture grouping, settlement, and runtime reconciliation remain governed by spec 103; this feature neither changes nor re-specifies them.
- Undo history remains session-only and is never persisted; panel placement persistence is the only durable state involved and already exists.
- The panel lists committed project edits only; local draft histories (search fields, unapplied dialogs) and non-project actions (layout, preferences) are out of scope, consistent with spec 103's scope.
