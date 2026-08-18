# Feature Specification: Consistent Multi-Layer Selection and Operations

**Feature Branch**: `077-multi-layer-selection`

**Created**: 2026-08-17

**Status**: Complete — manual acceptance passed; dependency-gated automated checks are documented (2026-08-17)

**Input**: User description: "Layer selection highlighting is inconsistent: Pattern Layers have the preferred styling, Track layers only put a box around the row, and SoundObject Layers have no highlight. Review the current layer selection system. Use the Pattern Layer track styling for selected layers and support multi-layer selection and operations, including the push behavior and cross-layer-group protections that existed in Java Blue. Create a branch and spec for this."

The attached screenshot is visual context for the current Track-layer appearance. It is not an additional source of requirements.

## Clarifications

### Session 2026-08-17

- Q: How should Add Layer Above/Below behave under the new layer-selection model? → A: Single-selection only, matching Java Blue: visible/enabled only when exactly one layer is selected, inserting relative to that selected layer (FR-007 anchor rules); hidden for multi-layer selections.
- Q: How far should keyboard support go in the first implementation? → A: Full keyboard model — Arrow Up/Down navigation of layer rows through visible layer order, Shift+Arrow range selection, and keyboard invocation of Push Up/Push Down/Remove, all communicating the same selection and boundary state as pointer gestures.
- Q: How should Push Up/Down unavailability be presented for mixed-group selections and boundary positions? → A: The commands are always visible and disabled with an explanatory reason for both mixed-group selections and same-group boundary positions — an intentional divergence from Java Blue, which hides them for multi-group selections.
- Q: What confirmation behavior should layer Remove use under multi-layer selection? → A: Java parity — Remove always confirms before deleting; a multi-group removal uses one confirmation showing the total selected layer count; when any selected group would be emptied, the dialog includes a "Delete empty Layer Groups" option, default checked.
- Q: Where should selected-layer highlighting appear? → A: Confine the visual selection treatment to the layer header panel. Aligned score-area rows retain their normal canvas/background treatment while exposing selection state accessibly when needed.
- Q: What should a Pattern layer header display? → A: Java parity — render only the Pattern layer's `name`; an unnamed layer remains blank, with no generated "Pattern Layer" fallback and no appended SoundObject name or type.
- Q: What should Delete/Backspace do while editing a layer name? → A: Keep normal text-field editing behavior. The layer Remove shortcut applies only when focus is outside editable fields.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent selected-layer styling (Priority: P1)

When a user selects a Pattern, Track, or SoundObject layer, the selected layer is immediately recognizable using the Pattern Layer treatment the user prefers: an accent edge, filled selection background, and stronger layer label. A Track layer must not appear selected only because it has a surrounding box or MIDI-focused border, and a SoundObject layer must not appear unselected when it is the active layer.

**Why this priority**: The current visual differences make it unclear which layer receives a layer operation. Consistent feedback is the foundation for safe multi-layer editing.

**Independent Test**: Open a score containing Pattern, Track, and SoundObject layer groups, select one layer from each group in turn, and compare the selected and unselected states without exercising any layer operation.

**Acceptance Scenarios**:

1. **Given** a score with Pattern, Track, and SoundObject layers, **When** the user selects one layer of each type in turn, **Then** each selected layer uses the same Pattern-derived selected treatment and each previously selected layer returns to the unselected treatment.
2. **Given** a Track layer has MIDI routing focus, **When** the user changes layer selection, **Then** MIDI focus remains a separate state and does not replace, suppress, or falsely imply the selected-layer treatment.
3. **Given** no layer is selected, **When** the user views the layer headers and aligned layer rows, **Then** the headers and score area use their normal unselected appearance without stale selection styling.

### User Story 2 - Select a contiguous range across layer groups (Priority: P1)

The user can select more than one layer as a contiguous range. A normal row selection replaces the current selection, and a Shift selection extends from the current anchor to the clicked row. The range can remain within one layer group or span adjacent layer groups in the score’s visible layer order, with partial endpoint groups and all intervening groups represented accurately.

**Why this priority**: Multi-layer operations are only predictable when the user can see exactly which layers are included, including selections that cross group boundaries.

**Independent Test**: Use only row-selection gestures in a score with at least two adjacent layer groups; verify same-group ranges, cross-group ranges, replacement, clearing, and anchor behavior from the visible selected states.

**Acceptance Scenarios**:

1. **Given** a layer group with several layers and no active range, **When** the user selects one layer and Shift-selects another in the same group, **Then** every layer between the anchor and the second selection is selected, in the original order, and all selected headers use the common selected treatment while score-area rows retain their normal background.
2. **Given** a cross-group layer list with an anchor in one group, **When** the user Shift-selects a layer in another group, **Then** the selection includes the appropriate suffix of the anchor group, all layers in between, and the appropriate prefix of the target group according to visible order.
3. **Given** an existing multi-layer selection, **When** the user selects a row without Shift, **Then** the old selection is replaced by that single row and the new row becomes the range anchor.
4. **Given** an existing selection, **When** the user clicks a non-layer area or changes to a different score path, **Then** the layer selection is cleared or reconciled so that no row remains highlighted without a corresponding layer.
5. **Given** a Pattern layer is selected alone, **When** the user performs the existing single-layer Pattern selection gesture, **Then** its embedded SoundObject editor behavior remains available; **when** the gesture creates a multi-layer selection, **Then** the layer selection remains distinct from object/editor selection and does not open an ambiguous multi-object editor target.
6. **Given** keyboard focus is on a layer row, **When** the user navigates with Arrow Up/Down or extends the selection with Shift+Arrow, **Then** selection follows the same visible-order, anchor, and range rules as pointer gestures (including crossing adjacent layer groups), and keyboard-invoked Push Up, Push Down, and Remove communicate the same availability and boundary state as pointer-invoked operations.

### User Story 3 - Operate on selected layers without crossing group protections (Priority: P1)

The user can invoke layer operations against the visible multi-layer selection. Push Up and Push Down move a selected contiguous block within its layer group as a unit, preserving internal order and keeping the selection attached to the same layers. Removal operates on the selected ranges without silently moving layers between groups. Operations that cannot safely span multiple groups are explicit rather than applying a partial or surprising result.

**Why this priority**: The value of multi-selection is reduced if operations affect only one row or can violate the rules of the selected layer groups.

**Independent Test**: Select one range within a group, invoke each supported operation, and then repeat with a range spanning groups. Compare layer order, selection identity, group membership, and boundary behavior.

**Acceptance Scenarios**:

1. **Given** several contiguous layers selected within one group, **When** the user invokes Push Up or Push Down, **Then** the selected layers move as one block, retain their internal order, remain in the same group, and remain selected after the move.
2. **Given** a selected block at the first or last movable position in its group, **When** the user opens layer operations, **Then** the corresponding push direction is visible but disabled with an explanatory reason, and no layer crosses the group boundary.
3. **Given** a context action is opened on a row already inside the current selection, **When** the user invokes a selection-aware operation, **Then** it applies to the complete current selection; **when** the action is opened on a row outside the selection, **Then** that row becomes the operation target before the action is applied.
4. **Given** selected ranges in more than one layer group, **When** the user invokes Remove, **Then** the selected range in each affected group is handled deliberately as one user action behind a single confirmation showing the total selected layer count, with no layer reparenting and with the "Delete empty Layer Groups" option offered when any affected group would be emptied.
5. **Given** a selection spans more than one layer group, **When** the user opens Push Up or Push Down, **Then** the command is visible but disabled with an explanatory reason (e.g., the selection spans multiple layer groups) rather than moving layers across group boundaries. Same-group push remains fully available.
6. **Given** selected layers contain objects that have group-specific placement rules, **When** the user performs a layer operation or a related object move, **Then** existing compatibility protections remain in force and no incompatible object placement is introduced as a side effect.
7. **Given** exactly one layer is selected, **When** the user invokes Add Layer Above or Add Layer Below, **Then** the new layer is inserted relative to that selected layer; **when** a multi-layer selection is active, **Then** the Add Above/Below actions are not shown.

### User Story 4 - Preserve editing context while selection changes (Priority: P2)

Layer selection is a temporary editing context. It helps the user see and operate on layers without changing the saved project merely by selecting rows, and it does not conflate layer selection with object selection, MIDI focus, or other editor targets.

**Why this priority**: Clear state ownership prevents selection-only interactions from changing `.blue` files and avoids regressions in object editing and track routing.

**Independent Test**: Select and range-select layers, change object selection and MIDI focus independently, reload or change the score path, and compare the resulting transient states and saved project data.

**Acceptance Scenarios**:

1. **Given** a layer selection exists, **When** the user changes object selection or MIDI focus, **Then** each state changes independently unless an explicit operation requires coordination.
2. **Given** a layer selection exists, **When** the user selects a different score path, reloads the project, or causes a selected layer to be removed or reordered, **Then** the selection is cleared or reconciled to existing layer identities and no stale layer is presented as selected.
3. **Given** the user only selects or clears layers, **When** the project is saved, **Then** the project’s canonical layer data and `.blue` representation are unchanged by the transient selection state.

### Edge Cases

- A Shift selection with no valid anchor starts a new single-layer selection rather than selecting an accidental range.
- A cross-group range selects only the visible ordered rows between the two endpoints; it does not include unrelated groups outside the range.
- A group containing one layer, or a selected block at a group boundary, cannot be pushed beyond that group.
- Remove always confirms before deleting layers. When a selection would empty one or more groups, the confirmation includes a "Delete empty Layer Groups" option (default checked); it must not silently delete an entire group.
- A layer can be renamed, reordered, added, or removed while the selection exists. Selection reconciliation is based on the layer identity that still exists, not a stale row index.
- Delete/Backspace in a layer-name editor edits the text and must not open the layer-removal confirmation.
- Clicking mute, solo, notification, automation, instrument, or other row controls must not accidentally create a range selection unless the control is explicitly a layer-selection target.
- Pattern source/editor selection and layer selection can coexist for one layer, but a multi-layer selection must not claim a single embedded object as its editor target.
- Collapsed or unavailable score views must not leave selected styling visible in headers for rows that are no longer part of the active layer view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST maintain a transient layer selection that is separate from object selection, embedded Pattern source selection, MIDI routing focus, and other editor targets.
- **FR-002**: The layer selection MUST identify selected layers by stable score/group/layer identity and MUST retain an anchor and current endpoint sufficient to reproduce same-group and cross-group range selection.
- **FR-003**: Every visible Pattern, Track, and SoundObject layer header MUST expose the selected-layer visual treatment derived from the preferred Pattern Layer styling: accent edge, filled selection background, and stronger selected label treatment. Aligned score-area rows MUST retain their normal canvas/background styling and MAY expose selection state through accessibility/data attributes without applying the header highlight.
- **FR-004**: A normal selection gesture MUST replace the current layer selection with one target layer; a Shift selection gesture MUST select the contiguous range between the anchor and target in visible layer order.
- **FR-005**: Cross-group range selection MUST select the correct partial endpoint ranges and all intervening layers, while preserving group membership and selection order.
- **FR-006**: The system MUST clear or reconcile layer selection when the active score path, visible layer view, or selected layer identities change, and MUST prevent stale visual selection from surviving those changes.
- **FR-007**: A selection-aware layer context action MUST apply to the full current selection when invoked on a selected row and MUST establish a new single-row target when invoked outside the current selection.
- **FR-008**: Push Up and Push Down MUST move a same-group selected block as a unit, preserve its internal order, preserve group membership, update the selected identities after the move, and enforce group boundaries.
- **FR-009**: Push Up and Push Down MUST remain visible and be disabled with an explanatory reason for a selection spanning multiple layer groups and for a same-group selected block at a group boundary; the system MUST NOT use a mixed selection to reparent or cross group boundaries.
- **FR-010**: Remove MUST operate on the selected layer ranges without silently reparenting layers, MUST confirm before removal with one confirmation covering the entire selection (showing the total selected layer count for multi-group removals), MUST offer a "Delete empty Layer Groups" option (default checked) when any selected group would be fully emptied, and MUST preserve existing safeguards for invalid empty groups or full-group removal.
- **FR-011**: Layer operations MUST preserve existing layer-group compatibility protections for contained score objects and MUST NOT weaken the current cross-group object movement or placement rules.
- **FR-012**: Single Pattern-layer selection MUST retain its current embedded SoundObject/editor behavior, while multi-layer selection MUST remain an explicit layer context and MUST NOT open an ambiguous single-object editor target. The Pattern layer header MUST render only `layer.name`; an empty name MUST remain blank rather than using a generated fallback or appending source-object metadata.
- **FR-013**: Layer selection and layer operations MUST use the existing canonical score/document mutation path for project changes; selection-only changes MUST remain transient and MUST NOT be serialized into `.blue` project data.
- **FR-014**: Layer rows MUST be keyboard-navigable: Arrow Up/Down MUST move layer selection/focus through the visible layer order including across adjacent layer groups, Shift+Arrow MUST extend the range following FR-004/FR-005, keyboard invocation of Push Up, Push Down, and Remove MUST behave identically to pointer invocation when focus is outside editable fields, editable layer-name fields MUST retain Delete/Backspace text-editing behavior, and selected layers MUST expose an accessible selected state.
- **FR-015**: Add Layer Above and Add Layer Below MUST be visible and enabled only when exactly one layer is selected, MUST insert relative to that selected layer following the FR-007 anchor rules, and MUST be hidden when a multi-layer selection is active (Java Blue parity).

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue’s coordinated layer-selection workflow is the behavioral reference, especially `LayerSelectionCoordinator`, `LayerSelectionProvider`, `AudioHeaderListPanel`, `PatternsHeaderListPanel`, `LayersPanel`, and the layer-group `pushUpLayers`/`pushDownLayers` operations in the Java Blue core and UI modules. The reference supports provider-local ranges, cross-group Shift selection, selection-aware removal, and group-safe push behavior.
- **Compatibility Requirements**: Preserve the existing score layer order and group membership semantics; preserve the current single Pattern-layer editor gesture; preserve object selection, object movement, clipboard compatibility, and Track MIDI-focus behavior; and keep push operations equivalent to moving the selected block within its owning group.
- **Intentional Divergences**: Two intentional divergences from Java Blue: (1) Push Up/Down are always visible and disabled with an explanatory reason for mixed-group selections and boundary positions, where Java hides the items for multi-group selections; (2) the keyboard layer-selection model (Arrow Up/Down navigation, Shift+Arrow range selection, keyboard invocation of Push Up/Push Down/Remove) is an intentional addition beyond the pointer-driven Java header panels. Observable pointer behavior otherwise remains equivalent to Java Blue. The implementation may represent selection with stable layer identities and the existing editor state model rather than Java’s selection model, provided the observable range, styling, operation, and boundary behavior remains equivalent.
- **State Ownership**: Layer selection, its anchor, and its visual state are transient score-editing state. Canonical layer order and mutations remain owned by the score document/BlueData path and are persisted through the existing project mutation boundary. Object selection remains in its existing object-selection state, MIDI focus remains in its routing state, and no selection-only state is written to `.blue` XML.

### Key Entities *(include if feature involves data)*

- **Layer selection**: The ordered set of currently selected layer identities plus its anchor and active endpoint; it may contain one contiguous range within a group or a visible contiguous range spanning groups.
- **Layer identity**: The stable score path, layer-group identity, and layer identity needed to reconcile selection after rows move or the view changes.
- **Layer group**: A Pattern, Track, or SoundObject-bearing collection whose layer order, object compatibility rules, and push boundaries must remain intact.
- **Layer operation**: A selection-aware action such as Push Up, Push Down, or Remove that changes canonical layer data only after applying the appropriate group and boundary rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a score containing all supported layer-group types, 100% of selected Pattern, Track, and SoundObject headers use the same Pattern-derived selected treatment, and selected score-area rows retain their normal canvas/background styling.
- **SC-002**: Automated interaction coverage demonstrates exact selected-row membership for single-group ranges, cross-group ranges, replacement, clearing, and selection reconciliation across at least one multi-group score fixture, for both pointer and keyboard (Arrow/Shift+Arrow) gestures.
- **SC-003**: For every valid same-group selected block, Push Up and Push Down preserve block order, group membership, and selection identity; boundary cases produce no cross-group movement.
- **SC-004**: Mixed-group selection scenarios demonstrate that unsupported push operations are visible but disabled with an explanatory reason, and that supported removal does not reparent layers or violate empty-group safeguards.
- **SC-005**: Selection-only interaction produces no `.blue` project-data diff, while layer-order changes are persisted through the existing canonical score mutation path.
- **SC-006**: Existing single Pattern-layer editor selection, object multi-selection/movement protections, and Track MIDI focus remain behaviorally unchanged in regression coverage.
- **SC-007**: A reviewer can determine the current selected layers and the availability of Push Up, Push Down, and Remove without relying on hidden state or inspecting implementation details.

## Assumptions

- The primary selection surface is the visible score layer header list. Aligned Pattern, Track, and SoundObject timeline rows remain score-object interaction surfaces and do not receive the layer-header highlight.
- Shift-click and equivalent keyboard range-selection gestures are the required multi-selection interaction; additive toggle selection is not required for the first implementation unless it is already established by the surrounding score UI.
- Cross-group selection follows the rendered layer order and does not include hidden or out-of-view rows that are not part of the active layer list.
- Push Up and Push Down are group-local operations. A mixed-group selection is still useful for highlighting and supported removal, but it does not trigger a cross-group push.
- Existing project/document mutation boundary, group validity, object compatibility, and MIDI routing rules are reused rather than replaced.
- Mobile-specific interaction and changes to the `.blue` file format are out of scope.
