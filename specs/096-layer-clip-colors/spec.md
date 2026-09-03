# Feature Specification: Layer and Clip Colors

**Feature Branch**: `096-layer-clip-colors`

**Created**: 2026-09-03

**Status**: Complete

**Input**: User description: "Add project-persisted colors to all score layer types and make newly created clips and score objects copy the destination layer color while existing, copied, imported, and moved clips keep independent colors, with explicit actions to apply a layer color to existing clips."

## Clarifications

### Session 2026-09-03

- Q: How should a layer's color be persisted in the `.blue` XML? → A: Mirror the item-color representation exactly: each layer element (sound layer, Track, Pattern layer) stores a `<backgroundColor>` child element with signed 32-bit integer text.
- Q: Should the neutral fallback for legacy layers without stored colors become persisted data? → A: Yes, materialize on save: when a project is saved, every layer lacking a stored color is written with the neutral fallback as a concrete `<backgroundColor>`, so FR-001's "concrete color for every layer" is literal stored data.
- Q: How should a newly created layer's initial color be chosen from the palette? → A: Single neutral default: every newly created layer starts with the same neutral dark gray. Multi-color palette strategies (creation-order cycling, position-based) are deferred future work building on this feature.
- Q: What undo/redo granularity is required for color actions? → A: One undo step per action: each layer-color change, "Set to Layer Color" on a selection, and "Apply Layer Color to All Clips" is a single undoable step restoring all prior colors; redo reapplies it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Color Layers and New Clips (Priority: P1)

A composer can see and change the color assigned to any score layer. When the composer creates a new clip or score object on that layer, the new item starts with the layer's current color so that related material is visually grouped without extra work.

**Why this priority**: Layer color and creation-time defaults provide the core organizational value of the feature.

**Independent Test**: Change a layer from its initial color to a different color, create an item on it, and verify that the new item begins with the chosen layer color.

**Acceptance Scenarios**:

1. **Given** a newly created ordinary score layer, Track, or Pattern layer, **When** it first appears, **Then** it has a visible layer color that the user can change.
2. **Given** a layer with a chosen color, **When** the user creates a new clip or score object on that layer, **Then** the item receives that color at creation.
3. **Given** a Pattern layer with a chosen color, **When** its initial pattern source object is created, **Then** that source object receives the layer color.
4. **Given** a layer whose color was just changed, **When** the user invokes undo once, **Then** the layer returns to its prior color in a single step, and redo reapplies the new color.

---

### User Story 2 - Preserve Independent Clip Colors (Priority: P2)

A composer can color individual clips independently. Changing a layer color affects the layer and future items, but does not unexpectedly recolor existing work. Copying, importing, duplicating, or moving an item also preserves the item's own color.

**Why this priority**: Existing projects already treat item color as durable project content; preserving that behavior prevents surprising visual changes and data loss.

**Independent Test**: Create two clips on a red layer, recolor one clip green, change the layer to blue, and verify that both existing clips retain their respective red and green colors while the next new clip begins blue.

**Acceptance Scenarios**:

1. **Given** one or more existing items on a layer, **When** the layer color changes, **Then** every existing item retains its current color.
2. **Given** an item with an explicitly chosen color, **When** it is copied, duplicated, imported, or moved to another layer, **Then** the resulting item retains that color.
3. **Given** a layer whose color has changed, **When** another item is created on it, **Then** only the newly created item starts with the new layer color.

---

### User Story 3 - Reapply a Layer Color (Priority: P3)

A composer can explicitly apply a layer's current color to selected items or to all items on that layer when they want to restore visual consistency.

**Why this priority**: Copy-on-create keeps existing colors safe, while an explicit reapply action supports users who intentionally want existing material to match.

**Independent Test**: Place differently colored items on one layer, apply the layer color to them, and verify that the intended items all receive the layer's current color while unrelated items remain unchanged.

**Acceptance Scenarios**:

1. **Given** selected items with different colors, **When** the user chooses "Set to Layer Color," **Then** each selected item receives the color of its containing layer.
2. **Given** a layer containing differently colored items, **When** the user chooses "Apply Layer Color to All Clips," **Then** every colorable item on that layer receives the layer's current color.
3. **Given** items on other layers, **When** a layer-color application is performed, **Then** those unrelated items remain unchanged.
4. **Given** items recolored by a layer-color application, **When** the user invokes undo once, **Then** every affected item returns to its prior color in a single step, and redo reapplies the application.

---

### User Story 4 - Retain Colors Across Projects and Versions (Priority: P4)

A composer can save, reopen, and share a project without losing layer or clip colors. Older projects remain visually stable when opened because their existing item colors are preserved.

**Why this priority**: Color assignments are project organization data and must travel with the project without destabilizing legacy content.

**Independent Test**: Save and reopen a project containing colored layers and clips, then open a legacy project without layer colors and verify both outcomes.

**Acceptance Scenarios**:

1. **Given** a project containing colored layers and clips, **When** it is saved and reopened, **Then** all layer and clip colors are restored exactly.
2. **Given** a legacy project with no stored layer colors, **When** it is opened, **Then** each layer receives the documented neutral fallback and no existing clip color changes.
3. **Given** a project created by this feature, **When** it is opened in current Java Blue, **Then** Java Blue can still read the project and display the concrete colors of its clips, even though it does not display layer colors.

### Edge Cases

- A layer with no items can still be colored, saved, and restored.
- Creating an item immediately after changing a layer color uses the newly chosen color.
- Moving an item between layers does not silently adopt the destination layer color.
- Pasted or imported project content keeps its stored item color rather than receiving the destination layer default.
- Applying a layer color to an empty layer succeeds without changing unrelated project state.
- Applying a layer color to many items completes atomically: either all intended item colors change or none do.
- Invalid or unsupported stored layer-color data falls back safely without altering existing clip colors or preventing the project from opening.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST assign a concrete color to every ordinary score layer, Track, and Pattern layer.
- **FR-002**: Users MUST be able to identify a layer's color from its header and change that color using the existing application color-selection experience.
- **FR-003**: Newly created layers MUST receive the single neutral default layer color (the existing neutral dark gray). Multi-color palette assignment strategies are deferred future work.
- **FR-004**: Newly created clips and score objects MUST copy the current color of their destination layer when no explicit incoming item color is supplied.
- **FR-005**: A newly created Pattern layer's initial source object MUST copy the Pattern layer color.
- **FR-006**: Changing a layer color MUST NOT automatically change the colors of existing items.
- **FR-007**: Copying, duplicating, importing, or moving an existing item MUST preserve its concrete item color.
- **FR-008**: Users MUST remain able to assign a color directly to an individual clip or score object.
- **FR-009**: Users MUST be able to copy each selected item's containing layer color onto that item through an explicit action.
- **FR-010**: Users MUST be able to copy a layer's current color onto all colorable items on that layer through an explicit action.
- **FR-011**: Bulk layer-color application MUST be atomic and MUST NOT modify items outside the requested selection or layer.
- **FR-012**: Layer colors and concrete item colors MUST be stored as project data and restored when the project is reopened.
- **FR-013**: A legacy project that has no stored layer colors MUST open with a documented neutral layer-color fallback while preserving every existing item color. On save, layers still lacking a stored color MUST have the neutral fallback materialized as a concrete `<backgroundColor>` value.
- **FR-014**: Invalid layer-color data MUST fall back safely and MUST NOT prevent the rest of the project from loading.
- **FR-015**: Layer-color controls MUST remain keyboard identifiable, screen-reader labeled, and usable in both docked and floated score panels.
- **FR-016**: Color operations MUST flow through the same authoritative project-mutation path as other score edits so that displayed state cannot diverge from saved project state.
- **FR-017**: Each layer-color change and each layer-color application MUST be recorded as a single undoable step that restores all prior colors; redo MUST reapply the action.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue defines no layer color or layer-to-item inheritance. Each score object owns a concrete background color that is copied with the object and stored with the project.
- **Compatibility Requirements**: Existing item colors, including intentional dark gray, MUST retain their current meaning. Existing projects MUST open without recoloring any item. New item colors MUST remain concrete project content readable by Java Blue. Resaving a legacy project intentionally adds materialized neutral `<backgroundColor>` layer values; this documented save-output change does not alter any item color.
- **Intentional Divergences**: Electron Blue will add project-level layer colors and layer-color controls that current Java Blue does not understand. Current Java Blue may ignore and discard layer colors when it resaves a project, but it must continue to read and preserve each item's concrete color. Live layer-to-clip synchronization is intentionally excluded because Java Blue cannot preserve such inheritance metadata and because Blue's established item-color model is independent.
- **State Ownership**: The active project document is the canonical owner of layer and item colors. Layer colors and item colors live for the lifetime of the project and are saved with it, each as a `<backgroundColor>` child element with signed 32-bit integer text on its owning layer or item element. The renderer only displays project snapshots and submits explicit edit intents; no application-wide color preference owns assigned project colors.

### Key Entities *(include if feature involves data)*

- **Layer Color**: The concrete display color assigned to an ordinary score layer, Track, or Pattern layer and used as the default for newly created items. Persisted on each layer element as a `<backgroundColor>` child element with signed 32-bit integer text, mirroring the existing item-color representation.
- **Item Color**: The concrete, independently owned display color of a clip, score object, or Pattern source object.
- **Layer Default Color** (formerly referred to as "Score-Layer Palette"): The single neutral dark gray assigned to newly created layers. Multi-color palette assignment (creation-order cycling, position-based) is deferred future work and does not replace user-selected project colors.
- **Layer-Color Application**: An explicit, atomic user action that copies current layer colors onto selected items or all colorable items on one layer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all three supported layer categories, 100% of newly created items without an explicit incoming color initially match their destination layer color.
- **SC-002**: Across layer recoloring, copying, duplication, importing, and cross-layer movement, 100% of pre-existing item colors remain unchanged unless the user explicitly requests a color change.
- **SC-003**: Users can identify and change any visible layer's color in no more than two direct interactions from the layer header.
- **SC-004**: A save-and-reopen cycle restores 100% of assigned layer and item colors exactly.
- **SC-005**: The existing item colors in the legacy-project compatibility suite remain unchanged after opening and saving with the feature enabled.
- **SC-006**: Applying one layer color to 1,000 items completes as one all-or-nothing user action with no changes to items outside the target layer.
- **SC-007**: Every layer-color control has an accessible name and can be reached and operated without relying on color perception alone.

## Assumptions

- “Clip” refers to all colorable timeline items, including audio clips and score objects; a Pattern layer's source object is included where equivalent behavior applies.
- Layer colors are concrete project values. Clips do not maintain a live inheritance relationship after creation.
- Newly created layers start with the single neutral default color (the existing neutral dark gray), and legacy layers without color data display the same default until the next save, at which point it is materialized as stored `<backgroundColor>` data.
- Imported or pasted content with a stored item color is considered explicit content and keeps that color.
- The existing application color picker and existing direct item-color editing remain the user-facing selection mechanisms.
- Automatic coloring by layer name, instrument type, or user-defined rules is outside this feature.
- Project-wide palette editing and application-wide color-policy preferences are outside this feature.
- Multi-color score-layer palette assignment strategies (creation-order cycling, position-based indexing) are deferred future work on top of this feature.
