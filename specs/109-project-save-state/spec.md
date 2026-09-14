# Feature Specification: Project Save State

**Feature Branch**: `109-project-save-state`

**Created**: 2026-09-14

**Status**: Closed — implementation converged, automated validation passed, and project-owner manual acceptance recorded (2026-09-14)

**Input**: User description: "Provide one authoritative project save state based on global undo/redo; prompt on project close or app exit only when saving is needed; and show saved, never-saved, or modified state in the window title."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Avoid unnecessary save prompts (Priority: P1)

As a user closing a project or exiting Blue, I am prompted to save only when that project has work that is not safely represented by its on-disk file.

**Why this priority**: Accurate close protection prevents data loss while eliminating disruptive prompts for projects that are already saved.

**Independent Test**: Open, create, edit, save, undo, and redo projects, then close the project or exit the application and verify that a save decision is requested exactly when the project's current state needs saving.

**Acceptance Scenarios**:

1. **Given** an existing project was opened and has not changed, **When** the user closes it or exits Blue, **Then** it closes without a save dialog.
2. **Given** an existing project has changed since it was opened or last saved, **When** the user closes it or exits Blue, **Then** Blue presents the existing save decision dialog before closing.
3. **Given** a new project has never been saved, **When** the user closes it or exits Blue, **Then** Blue presents the existing save decision dialog even if no edit has been made.
4. **Given** a project needed saving and was saved successfully, **When** the user closes it or exits Blue without another change, **Then** it closes without a save dialog.
5. **Given** multiple projects are open when Blue exits, **When** exit processing evaluates them, **Then** only projects that need saving require a save decision.

---

### User Story 2 - See project state in the window title (Priority: P2)

As a user, I can tell from the Blue window title whether the current project is saved, is a new project that has never been saved, or is an existing project with unsaved modifications.

**Why this priority**: Persistent, glanceable state helps users decide whether to save before switching context or ending a session.

**Independent Test**: Move a project through new, saved, modified, undone-to-saved, and redone states and verify the exact title after each transition.

**Acceptance Scenarios**:

1. **Given** an opened or successfully saved project whose current content matches its save point, **When** its window is shown, **Then** the title is `Blue - Project Name`.
2. **Given** a new project that has never been saved, **When** its window is shown, **Then** the title is `Blue - Project Name - [UNSAVED PROJECT]`.
3. **Given** a project with an on-disk file whose current content differs from its most recent save point, **When** its window is shown, **Then** the title is `Blue - Project Name - [modified]`.
4. **Given** a modified on-disk project, **When** undo restores the most recently saved state, **Then** the `[modified]` marker disappears without requiring another save.
5. **Given** a project restored to its save point by undo, **When** redo reapplies a post-save change, **Then** the `[modified]` marker returns.

---

### User Story 3 - Keep one consistent save-state answer (Priority: P3)

As a user, I receive consistent save prompts and title indicators because every feature consults the same authoritative project save state.

**Why this priority**: A single answer prevents the title and close protection from disagreeing, especially across save, undo, redo, and failed-save transitions.

**Independent Test**: Exercise each state transition and confirm that the close decision and displayed title always reflect the same state.

**Acceptance Scenarios**:

1. **Given** any project state transition, **When** the title and close behavior are evaluated, **Then** both derive their result from the same authoritative project save state.
2. **Given** a save is cancelled or fails, **When** the user returns to the project, **Then** its prior save state, title marker, and close protection remain unchanged.
3. **Given** a successful save after undoing to an earlier revision, **When** the user later navigates through history, **Then** the new save point determines whether each visited revision is modified.

### Edge Cases

- A new project remains `[UNSAVED PROJECT]` until its first save succeeds, even when its history contains no edits or returns to its initial revision.
- Saving to a new path successfully converts a never-saved project into a saved project and immediately removes the unsaved marker.
- Cancelling or failing a Save or Save As operation does not move the save point or permit an unprotected close.
- Undo can return an on-disk project exactly to its save point; a new edit after that undo creates a modified history branch without losing save-state accuracy.
- Non-project activity such as selection, playback, hover, previews, or window layout does not mark project content as modified.
- During application exit, cancelling any required save decision aborts exit according to the existing close-dialog contract; clean projects add no prompts.
- Project names containing punctuation or marker-like text remain distinguishable within the fixed title format.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Blue MUST maintain one authoritative save state for each open project.
- **FR-002**: The authoritative state MUST distinguish a new project that has never been saved, an on-disk project whose current content matches its save point, and an on-disk project whose current content differs from its save point.
- **FR-003**: A newly created project MUST need saving from creation until its first successful save, regardless of whether the user has edited it.
- **FR-004**: Opening an existing project successfully MUST establish its loaded content as the saved baseline.
- **FR-005**: A successful Save or Save As operation MUST establish the project's then-current content as the new saved baseline and record that the project has an on-disk file.
- **FR-006**: A cancelled or failed save operation MUST leave the prior saved baseline and save state unchanged.
- **FR-007**: Any durable project-content change committed through global project history MUST update whether the current project state differs from the saved baseline.
- **FR-008**: Undo and redo MUST recompute save state relative to the saved baseline, including clearing the modified state when history returns to that baseline and restoring it when history moves away.
- **FR-009**: Transient session activity that does not change durable project content MUST NOT change project save state.
- **FR-010**: Closing a project MUST show the existing save decision dialog only when that project needs saving.
- **FR-011**: Exiting Blue MUST apply the same needs-saving rule independently to every open project and MUST not request save decisions for clean projects.
- **FR-012**: Blue MUST preserve the existing user choices and cancellation behavior of the save decision dialog whenever the dialog is required.
- **FR-013**: A saved project window MUST display the exact title `Blue - Project Name`, substituting the project's displayed name for `Project Name`.
- **FR-014**: A never-saved project window MUST display the exact title `Blue - Project Name - [UNSAVED PROJECT]`.
- **FR-015**: A modified on-disk project window MUST display the exact title `Blue - Project Name - [modified]`.
- **FR-016**: The window title MUST update after project creation, opening, durable edits, undo, redo, successful save, Save As, save cancellation or failure, and active-project changes, without requiring the user to reopen the window.
- **FR-017**: All consumers that decide whether to prompt for saving or which title marker to display MUST use the authoritative project save state rather than maintain independent dirty flags.
- **FR-018**: Save-state tracking MUST remain correct when a user saves at a history position that is not the latest previously visited position and then undoes or redoes relative to that new save point.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Existing Blue project open, Save, Save As, close, application-exit, title, and global undo/redo workflows define the surrounding user experience. Java Blue may be consulted during planning for save-prompt and title parity, but this feature's explicit title strings govern any difference.
- **Compatibility Requirements**: Existing `.blue` project content and round-trip behavior MUST remain unchanged. Existing save-dialog choices and cancellation semantics MUST be preserved; only the condition that triggers the dialog changes.
- **Intentional Divergences**: The three title formats in this specification are intentional requirements even if Java Blue uses different wording.
- **State Ownership**: The active project document remains the canonical owner of project content. Each open project's save state is authoritative session metadata tied to that document and its history/save point; it is not project XML and does not persist across application sessions.
- **Undo/Redo Impact**: This feature adds no new durable project mutation. Existing history commits, undo, and redo MUST drive save-state transitions without changing project identities, references, ordering, canonical publication, or runtime reconciliation.

### Key Entities *(include if feature involves data)*

- **Project Save State**: The authoritative session state for an open project, including whether it has ever been saved and whether its current history state matches the most recent successful save point.
- **Saved Baseline**: The exact project history state established by a successful open, Save, or Save As operation and used to determine whether an on-disk project is modified.
- **Open Project**: A project document in the current application session, associated with a display name, optional on-disk file, project history, and project save state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In coverage of new, opened, edited, saved, save-cancelled, save-failed, undone, and redone states, 100% of close and application-exit decisions prompt exactly when the evaluated project needs saving.
- **SC-002**: In the same transition coverage, 100% of observed window titles match one of the three specified formats and agree with the project's close-protection state.
- **SC-003**: Returning to the saved baseline through undo removes the modified indicator, and moving away through redo restores it, within one observable UI update in 100% of tested transitions.
- **SC-004**: Existing `.blue` project compatibility and existing save-dialog decision outcomes show zero regressions in the affected validation suite.
- **SC-005**: A user can determine whether the active project is saved, never saved, or modified from the window title alone in every supported project state.

## Assumptions

- `Project Name` means the display name already chosen by Blue for the active project; this feature changes only the state suffix.
- A successful open and a successful save are the only events that establish a saved baseline.
- New projects require saving even when untouched because no recoverable on-disk project file exists.
- Save-state metadata is session-only derived state and is not added to `.blue` XML.
- Existing close and application-exit dialog wording, choices, and per-project sequencing remain in scope only insofar as their triggering condition changes.
- Only durable project-content changes tracked by global project history affect modified state; application preferences and disposable UI/runtime state are outside this feature.

## Closure

- Implementation and convergence are complete; tasks T001–T030 are checked.
- Project-owner manual smoke testing passed after the T029 terminal-boundary fix. The reported
  post-close settlement timeout was reproduced, fixed by pruning stale-document participants and
  resetting the quit guard on failed transitions, and rechecked successfully.
- Automated validation passed with `pnpm --filter @blue/app test`, `pnpm test`,
  `pnpm --filter @blue/app build:main`, and `pnpm --filter @blue/app build:preload`.
  `pnpm lint` has only the pre-existing `DESIGN.md` formatting exception, which is outside this
  feature and was left unchanged.
- No remaining gaps were found against the requirements, acceptance scenarios, plan decisions,
  compatibility constraints, or constitution. Detailed evidence is recorded in
  [quickstart.md](quickstart.md).
