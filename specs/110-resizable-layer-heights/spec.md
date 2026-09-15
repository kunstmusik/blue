# Feature Specification: Resizable Layer Heights

**Feature Branch**: `codex/110-resizable-layer-heights`

**Created**: 2026-09-14

**Status**: Draft — implementation design complete; ready for task generation

**Input**: Investigate replacing fixed multiples-of-22px layer sizing with dragging in the header or main score area; research Ardour, REAPER, Logic Pro, Ableton Live, and Pro Tools for bulk resizing, reset, and size defaults.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resize where I am working (Priority: P1)

A composer drags a layer's lower boundary in its header panel to make more room for editing, without leaving the score or choosing a fixed size.

**Why this priority**: Direct manipulation is the core requested improvement.

**Independent Test**: Resize a Sound Layer and a Track layer through the header panel, including during playback, then cancel, undo, redo, and reopen the project.

**Acceptance Scenarios**:

1. **Given** a 44-unit layer, **When** its lower boundary is dragged down 13 units in the header panel, **Then** both header and score surfaces show a 57-unit layer while dragging and after release, with subsequent rows aligned.
2. **Given** a resize preview, **When** Escape is pressed, focus is lost, or the interaction is cancelled, **Then** original heights return and neither project dirty state nor undo history changes.
3. **Given** a completed resize, **When** the user undoes and redoes it, **Then** exact before/after heights return in one step each, with layer identities, selection, content, and saved-state accuracy preserved.
4. **Given** a score containing objects and automation, **When** the user resizes a layer during playback, **Then** object timing, automation values, MIDI routing focus, and playback remain unchanged; subsequent editing targets the correctly aligned row.
5. **Given** a custom height, **When** the project is saved and reopened in Blue Electron, **Then** its exact height returns.

---

### User Story 2 - Resize selected layers together (Priority: P2)

A composer uses the existing layer selection to resize several rows at once, including selections across layer groups, without changing their musical grouping.

**Why this priority**: Repeated individual resizing is costly in larger scores.

**Independent Test**: Select layers with unequal heights in two groups, drag a selected boundary, and compare selected and unselected heights before commit, cancel, undo, and redo.

**Acceptance Scenarios**:

1. **Given** selected layers at 44 and 88 units, **When** a selected boundary is dragged down 13 units, **Then** their heights become 57 and 101; unselected layers stay unchanged.
2. **Given** a multi-selection, **When** a boundary outside that selection is dragged, **Then** only that layer is resized and the existing selection is preserved.
3. **Given** selected layers near the minimum or maximum, **When** a drag exceeds a limit, **Then** each layer is clamped independently; reversing the drag calculates from original heights so clamping does not cause drift.
4. **Given** a mixed selection containing fixed-height Pattern rows, **When** resize is requested, **Then** the whole operation is unavailable with an explanation; no subset is silently changed.
5. **Given** multiple resized layers, **When** the gesture ends, **Then** one history entry covers the entire operation; cancellation or a failed commit restores every target.

---

### User Story 3 - Return to predictable sizes (Priority: P2)

A composer chooses a familiar fixed size or resets a set of layers to their default after detailed editing.

**Why this priority**: Free sizing needs a quick, discoverable way to recover a tidy layout.

**Independent Test**: Apply presets and reset to a single layer, selection, and current group; check exact heights, scope, and undo.

**Acceptance Scenarios**:

1. **Given** a custom-height layer, **When** a fixed preset is chosen, **Then** it receives the displayed size exactly; the menu identifies a non-preset height as Custom rather than marking an incorrect preset.
2. **Given** unequal selected heights, **When** a preset is applied to Selected Layers, **Then** all targets receive that same absolute size, unlike the relative drag operation.
3. **Given** a group default of 66 units, **When** Reset Height to Default is applied, **Then** affected layers in that group become 66 units; targets in other groups use their own defaults.
4. **Given** a group default, **When** it is changed, **Then** existing rows retain their heights and newly created rows use the new default; the separate Apply Default to Group action changes existing rows in one undoable operation.
5. **Given** keyboard-only operation, **When** the user opens height commands, **Then** presets, reset, and numeric height entry are usable without dragging, with the same scope and limits.

### Edge Cases

- The last row remains resizable; the lower boundary belongs to the row above it, not the following row or group header.
- At minimum height, controls remain reachable and resize affordances remain discoverable.
- Resizing must not start object movement, trimming, automation editing, marquee selection, or layer reordering. A distinct boundary affordance identifies the resize action before pressing; outside it existing tools retain their behavior.
- Scrolling and application zoom must not change the meaning of a saved height or desynchronize the header and canvas.
- Changing score path, closing the project, or removing/reordering a target during a preview cancels the preview before another operation proceeds.
- A no-motion gesture, or an action whose result equals current values, creates no history entry.
- Unsupported or invalid height data falls back to a valid legacy/default height without losing unrelated project data.
- Nested PolyObjects are separate score paths: group operations never recurse into unopened child scores.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sound Layers and Track layers MUST support free height resizing from a lower-boundary affordance in the layer header panel (matching Logic Pro and REAPER; the main score canvas area is not draggable for height). Pattern rows remain fixed-height in this iteration.
- **FR-002**: Heights MUST be expressed in application logical pixels, independently of display density and application zoom. New custom heights MUST accept whole-unit values from 22 through 660 inclusive, without snapping to multiples of 22. Existing valid legacy heights outside this editing range MUST remain unchanged until explicitly resized.
- **FR-003**: Both surfaces and following rows MUST update together during preview. Hover and active dragging MUST indicate resizing via cursor change to the standard `row-resize` cursor (horizontal divider bar with up/down arrows) and tooltip/title readout without displaying hover or press highlight lines.
- **FR-004**: Dragging a selected layer MUST apply the same height delta to all selected eligible layers in the current score path. Dragging an unselected layer MUST affect only that row without replacing selection. Targets MUST remain fixed throughout the gesture.
- **FR-005**: Bulk resizing MUST clamp each target independently using its original height and the current drag delta. If any target is unsupported, the operation MUST be disabled rather than partly applied.
- **FR-006**: Height commands MUST explicitly distinguish This Layer, Selected Layers, and This Layer Group. Group scope includes all direct rows of the addressed group, including rows outside the viewport, and excludes nested score contents. Empty selections or unsupported scopes MUST have explained disabled states. All visible eligible rows can be resized through existing layer selection; no project-wide implicit scope is introduced.
- **FR-007**: Fixed presets MUST retain the familiar 22-unit sizes from 22 through 198, labeled with their numeric size. Any existing additional type-specific preset MUST remain available. Numeric custom entry MUST use FR-002 limits. Presets and numeric entry apply absolute heights to every target.
- **FR-008**: Reset Height to Default MUST restore each target's group creation default, falling back to 22 where that group has no configurable default. Custom and mixed values MUST be identified accurately.
- **FR-009**: Existing configurable group defaults MUST remain available as fixed-size choices. Changing a creation default MUST affect future rows only; applying it to existing rows MUST be a separate explicit action. This feature MUST NOT create an application-wide default store or saved custom-preset library.
- **FR-010**: Presets, numeric entry, and reset MUST be keyboard accessible and expose action, target scope, current value, and bounds to assistive technology. Existing modified-wheel sizing MUST remain available and step to the next strictly higher/lower preset from a custom value without deriving an incorrect legacy index.
- **FR-011**: Every completed durable height/default change MUST be one undoable action with a semantic label such as Resize Layer, Resize Selected Layers, Set Layer Height, or Change Default Layer Height. Undo/redo MUST preserve identities, references, ordering, selection, dirty state, and runtime behavior. Preview, cancellation, and no-op MUST create no history entries.
- **FR-012**: Commit failure, cancellation, loss of focus, or target invalidation MUST restore all previewed heights. Save during a preview MUST persist the last committed state.
- **FR-013**: Saved custom heights MUST survive Blue Electron save/reopen and project copying without losing unrelated project data. Legacy projects MUST load at exactly their previous heights. For projects otherwise readable by Java Blue, Java MUST still open saved projects with usable legacy fallback heights and unchanged musical content. Existing Electron TrackLayerGroup incompatibility with the inspected Java version is outside this feature; it MUST NOT be worsened or misrepresented as supported.
- **FR-014**: Resizing MUST preserve musical content, horizontal timeline scale, object selection, and routing focus. Playback MUST continue without a resize-induced engine restart or interruption.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java SoundLayer derives height from `(heightIndex + 1) × 22`. Its PolyObject properties expose nine default sizes and a separate action applying the default to all layers. Blue Electron SoundLayer and Track retain index-derived sizing, while PatternLayer returns a fixed height. Source evidence and current inconsistencies are recorded in [research.md](research.md).
- **Compatibility Requirements**: Existing `.blue` documents and valid legacy heights retain their appearance until edited. Musical content, generated CSD, and unknown project data remain unchanged by resizing. The plan must establish a Java-readable fallback and test loading an otherwise Java-compatible custom-height project in Java. The planning probe confirms that Java discards the custom-height extension on save; reopening that file in Electron uses the retained fixed-size fallback. The inspected Java version does not support Electron TrackLayerGroup projects, independently of this feature; those projects require Electron round-trip validation rather than a false Java-open guarantee.
- **Intentional Divergences**: Continuous custom sizing, header-panel direct resizing, and selection-wide resizing are deliberate improvements over fixed-index sizing. Existing fixed sizes and default behavior remain available. The plan must name and validate these divergences and the custom-height fallback behavior.
- **State Ownership**: Committed layer heights and existing group defaults remain project-owned, stored with the canonical BlueData document in `.blue` project data. The Electron main process owns committed state through the document bridge. Preview and selection are disposable renderer session state, cleared on cancellation/path changes and never serialized. No sidecar, preference store, or library database is introduced. The plan must specify compatible persistence fields, legacy migration, and recovery from invalid or partial data before implementation.
- **Undo/Redo Impact**: All durable height and group-default changes use canonical ProjectHistory. Focused commit→undo→redo validation must cover exact heights, stable identities/references, saved-state transitions, canonical publication, and unchanged running-engine behavior. There is no non-undoable project-mutation exception.

### Key Entities *(include if feature involves data)*

- **Layer height**: A committed vertical size belonging to an identified Sound Layer or Track layer; has a legacy-compatible representation and optionally a custom size.
- **Resize target set**: Stable identified rows affected by one operation within the current score path; independent of object selection and MIDI focus.
- **Height preset**: A named numeric fixed size applied absolutely, retaining Blue's familiar sizes.
- **Group creation default**: Existing project-owned size used when creating new rows; distinct from resetting existing rows.
- **Resize preview**: Temporary original and proposed heights, discarded on cancellation or committed as one edit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can set a layer to 57 logical pixels with one drag from the header panel, and to that exact height using the keyboard alternative.
- **SC-002**: A selection of 20 eligible layers across at least two groups can be resized with one drag or equalized with one preset action, changing zero unselected layers.
- **SC-003**: All accepted/cancelled resize scenarios show zero header-to-score boundary mismatch; each accepted action requires exactly one undo and one redo, while cancelled/no-op actions require none.
- **SC-004**: At least 95% of measured preview updates appear within 50 ms of pointer movement on the documented supported test machine with 100 visible rows; a 30-second resize exercise during playback produces zero engine restarts or resize-induced playback interruptions.
- **SC-005**: Compatibility fixtures preserve 100% of existing valid legacy heights on open, exact custom heights on Blue Electron reopen, and all unrelated musical data. Java opens the otherwise Java-readable fixtures successfully using the documented fallback; Electron Track fixtures retain their existing format and round-trip in Electron.
- **SC-006**: In a five-person usability check, at least four users find resizing and restore a layer to a default size within 30 seconds without instruction about modifier keys.

## Assumptions

- This deliverable is a researched specification, not implementation. [research.md](research.md) distinguishes documented DAW behavior from proposed Blue choices and remaining technical investigations.
- Header panel dragging is used for layer height resize (mimicking Logic Pro and REAPER), while the main score canvas remains dedicated to object and timeline editing.
- The initial scope covers Sound Layers (including nested score paths) and Track layers. Pattern sizing would require additional model and grid semantics and is deferred explicitly.
- 22–660 logical pixels is a proposed initial editing range: preserve the compact legacy minimum and allow substantially more editing room. It is a Blue product choice, not a claimed DAW standard.
- Existing multi-layer selection is reused; automatic resize linkage through musical groups is not introduced.
- Fit selection/all to viewport, temporary focus enlargement, height locks, minimize/maximize restore toggles, user-defined preset collections, multiple named default profiles, and per-type application defaults are researched follow-ups, outside initial delivery.
- Planning must settle the compatible custom-height representation and validate Java behavior before implementation; it must not silently substitute external view-only persistence for project-owned heights.

## Planning Clarifications (2026-09-14)

- Compatibility wording above was qualified using Java source and a layer-level load/save probe; no Track format migration is included. Whole-project Java validation remains an implementation acceptance check.
- Group creation defaults exist in the data models and Java UI; Electron currently lacks the corresponding group-edit/apply controls. This feature adds those narrow project-owned controls while retaining the existing application setting used to initialize new projects.
