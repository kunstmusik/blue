# Feature Specification: Score Timeline Automation Editing

**Feature Branch**: `052-score-timeline-automation`
**Created**: 2026-06-04
**Status**: Closed
**Input**: User description: "Review the implementation of automation on the score timeline for audio and soundObject layers in Java Blue. Use spec-kit to create a branch and create a new spec for implementing automation editing with single-line and multi-line modes, as well as using A button to choose automations to use."

**Reference Review**: Java Blue score timeline automation behavior is summarized in [research.md](research.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose Layer Automations From The A Button (Priority: P1)

As a composer working in the score timeline, I need an A button on soundObject and audio layer headers so I can choose which automation parameters appear and are editable on each layer.

**Why this priority**: Automation editing is inaccessible until a user can assign available parameters to the correct timeline layer.

**Independent Test**: Open a project with one soundObject layer and one audio layer that each have available automation targets, use each layer's A button to select and remove an automation, and verify the layer header and timeline reflect the chosen parameter.

**Acceptance Scenarios**:

1. **Given** a soundObject layer with available instrument and mixer automation targets, **When** the user opens the layer's A button menu, **Then** the menu groups available targets and indicates which parameters are already active on this layer or another layer.
2. **Given** an audio layer associated with a mixer channel, **When** the user opens the layer's A button menu, **Then** the menu shows the channel's automatable targets and lets the user assign one to that audio layer.
3. **Given** a parameter is assigned to a layer, **When** the user selects it again from the same layer's A button menu, **Then** the parameter is removed from that layer's timeline automation list.
4. **Given** a parameter is assigned to another layer, **When** the user selects it from the current layer's A button menu, **Then** ownership moves to the current layer without leaving duplicate timeline assignments.

---

### User Story 2 - Edit One Automation Line In Single-Line Mode (Priority: P1)

As a composer shaping one automated parameter, I need single-line mode to focus the selected automation line and provide direct point editing, range selection, movement, scaling, and undoable changes.

**Why this priority**: Single-line editing is the core automation authoring workflow and must work before broader multi-line gestures are useful.

**Independent Test**: Select an automation on a soundObject layer and an automation on an audio layer, switch to single-line mode, add and move points on each line, create a time-range selection, move or scale that selection, and verify the resulting line values are saved.

**Acceptance Scenarios**:

1. **Given** a layer has multiple assigned automation parameters, **When** the user cycles the selected parameter in the layer header, **Then** the selected line becomes the active editable line and other assigned lines remain visible but inactive.
2. **Given** single-line mode is active, **When** the user clicks, drags, deletes, or range-selects points on the active line, **Then** the line updates with the expected time and value changes while respecting snap settings.
3. **Given** a single-line edit is complete, **When** the user invokes undo, **Then** the automation line returns to its previous points and values.
4. **Given** the user changes the selected line color from the layer header, **When** the timeline redraws or the project reloads, **Then** the automation line uses the chosen color.

---

### User Story 3 - Edit Multiple Layers In Multi-Line Mode (Priority: P2)

As a composer reshaping a passage across multiple layers, I need multi-line mode to select a time range across soundObject and audio layers and move or scale all included automation lines together.

**Why this priority**: Multi-line mode is essential for preserving automation alignment when moving or stretching larger score regions.

**Independent Test**: Select a range spanning soundObject layers and audio layers with active automation, move and scale the selected range, and verify only the selected layers and selected time range are affected.

**Acceptance Scenarios**:

1. **Given** multi-line mode is active, **When** the user drags a range across one or more automatable layers, **Then** the timeline shows a range selection covering the chosen time and layers.
2. **Given** a multi-line range selection includes assigned automation lines, **When** the user moves the selection, **Then** selected automation points move in time together and do not move before time zero.
3. **Given** a multi-line range selection includes assigned automation lines, **When** the user scales the selection from either edge, **Then** selected automation points scale around the selection while unselected points stay unchanged.
4. **Given** a multi-line operation also includes selected score objects or audio clips, **When** the operation completes, **Then** object timing and automation timing remain aligned.

---

### User Story 4 - Persist And Use Timeline Automation During Playback (Priority: P2)

As a composer, I need assigned automation lines and edits to remain part of the project and drive the same automated parameters during playback, render, export, and reload.

**Why this priority**: Timeline editing is only valuable if edits are durable and feed the existing automation playback path.

**Independent Test**: Assign and edit automations on soundObject and audio layers, save and reopen the project, then play or export and verify the automated parameter values follow the edited lines.

**Acceptance Scenarios**:

1. **Given** a project has assigned timeline automations, **When** the project is saved and reopened, **Then** each layer retains its assigned automation parameter list and selected line.
2. **Given** automation points are edited on the timeline, **When** playback or export runs, **Then** the edited points are used for the corresponding automated parameter.
3. **Given** an automation target is removed from the project, **When** the score timeline refreshes, **Then** stale layer assignments are removed or marked unavailable without breaking the score view.

### Edge Cases

- No project is loaded or the project has no automatable targets.
- A layer has no assigned automation parameters.
- A parameter is already assigned to another layer.
- A previously assigned parameter no longer exists because an instrument, mixer channel, effect, send, or audio layer association was removed.
- An audio layer has no associated mixer channel or the associated channel is disabled.
- The score is viewed inside a nested score path where root-level timeline automation may not be available.
- Layer height is too small to show the parameter selector footer.
- Snap is enabled, disabled, or bypassed for a single edit gesture.
- Automation lines contain zero points, one point, duplicate-time points, or points at time zero.
- Multi-line scaling would partially cross object or clip boundaries.
- Undo or redo is invoked after assigning parameters, editing points, moving a range, scaling a range, or changing line color.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST support score timeline automation for both soundObject layers and audio layers.
- **FR-002**: Each supported layer header MUST expose an A button that opens the available automation targets for that layer.
- **FR-003**: The A button menu MUST let users add, remove, and move automation assignments while preventing duplicate ownership of the same automation line across layers.
- **FR-004**: The A button menu MUST clearly distinguish targets already assigned to the current layer from targets assigned elsewhere.
- **FR-005**: SoundObject layer menus MUST include eligible instrument automation targets and eligible mixer automation targets.
- **FR-006**: Audio layer menus MUST include eligible automation targets for the layer's associated mixer channel, including channel level and automatable effects or sends.
- **FR-007**: Each layer with assigned automation MUST show a parameter selector footer when space allows, including current parameter name, line color, and previous/next controls.
- **FR-008**: Users MUST be able to change the visible line color for the selected automation parameter from the layer header.
- **FR-009**: Single-line mode MUST allow direct editing of the selected automation line only, while displaying other assigned lines as inactive context.
- **FR-010**: Single-line mode MUST support adding points, moving points, deleting eligible points, selecting a time range, moving a selected range, scaling a selected range, and vertically shifting selected values.
- **FR-011**: Single-line edits MUST respect timeline snap settings and the same time/value boundaries used by the underlying automation parameter.
- **FR-012**: Multi-line mode MUST allow range selection across one or more supported layers.
- **FR-013**: Multi-line move and scale operations MUST update assigned automation lines on selected supported layers while leaving unselected layers and out-of-range points unchanged.
- **FR-014**: Multi-line operations MUST preserve alignment between selected score objects or audio clips and the selected automation range.
- **FR-015**: Automation assignment, point edits, range movement, range scaling, and color changes MUST be undoable and redoable.
- **FR-016**: Assigned automation parameters, selected layer parameter, line colors, and edited line points MUST persist through project save and reload.
- **FR-017**: Playback, render, and export MUST use the edited timeline automation data without requiring a separate synchronization step from the user.
- **FR-018**: The score timeline MUST handle stale or missing automation targets without crashing and without leaving uneditable phantom lines.
- **FR-019**: Existing soundObject editor automation tabs MUST remain available; this feature adds score timeline editing and MUST NOT replace object-specific editor workflows.
- **FR-020**: The implementation MUST preserve current score timeline object, audio clip, ruler, snap, navigation, and selection behavior while adding automation editing.
- **FR-021**: Tests MUST cover layer assignment menus, single-line editing, multi-line editing, persistence, missing-target handling, and playback/export data flow for both supported layer families.

### Key Entities *(include if feature involves data)*

- **Automation Parameter**: An automatable value with identity, display name, bounds, line color, current value, enabled state, and editable time/value points.
- **Layer Automation Assignment**: The ordered set of automation parameter identities assigned to one score timeline layer, including the currently selected parameter.
- **Automation Target Menu**: The A button menu that lists assignable targets and indicates assignment state.
- **Automation Line**: The timeline curve drawn for one assigned automation parameter.
- **Single-Line Selection**: A focused time range on one automation line used for line-level move, scale, copy, paste, and vertical-shift operations.
- **Multi-Line Selection**: A time and layer range used for bulk movement or scaling across score objects, audio clips, and assigned automation lines.
- **Automation Edit Mode**: The current score mode that determines whether the timeline is editing score objects, one automation line, or multiple automation lines.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can assign and unassign an automation from both a soundObject layer and an audio layer using the A button in no more than three user actions per layer.
- **SC-002**: A reviewer can create, move, delete, range-move, and range-scale points on a selected automation line in single-line mode, then undo each completed edit.
- **SC-003**: A reviewer can select a multi-layer range containing soundObject and audio layer automation, move or scale it, and verify only the selected layers and selected time range changed.
- **SC-004**: After saving and reopening a project, all assigned timeline automations, selected layer parameters, line colors, and edited points match the pre-save state.
- **SC-005**: Playback or export of a representative automated project uses the edited timeline automation values for both soundObject and audio-layer targets.
- **SC-006**: Automated tests cover the primary assignment, editing, persistence, stale-target, and playback/export scenarios for both layer families.

## Assumptions

- This feature targets score timeline automation; existing object-specific automation editor tabs remain separate.
- "SoundObject layers" refers to the timeline layers used by PolyObject-style score contents.
- "Audio layers" refers to AudioLayerGroup rows containing audio clips; audio-layer automation targets the associated mixer channel parameters rather than audio clip fade handles.
- The existing automation playback bridge is available and this feature focuses on timeline assignment and editing.
- Root score timeline parity is the first target; nested path behavior may remain unavailable if matching Java Blue's root-only automation overlay is required for parity.
- Java Blue is the behavioral reference for A button assignment state, single-line editing gestures, multi-line range operations, and persistence of layer parameter ids.
