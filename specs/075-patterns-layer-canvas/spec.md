# Feature Specification: Patterns Layer-Group Canvas

**Feature Branch**: `075-patterns-layer-canvas`
**Date**: 2026-08-15
**Status**: Course-corrected implementation

## Context

`PatternsLayerGroupCanvas.tsx` previously rendered only empty row containers. The first implementation of this feature treated each active boolean cell as an ordinary movable `SoundObject` bar. That is not Java Blue’s model and makes the UI misleading: a pattern row owns one embedded source object, while its `PatternData` only turns that source on or off at a shared pattern step.

This specification follows Java Blue’s `PatternsLayerPanel`, `PatternsLayerPanelMouseListener`, `PatternsHeaderListPanel`, and `PatternLayerPanel`:

- the timeline is a beat-scaled on/off grid;
- active cells are solid pattern blocks, not labeled `RenderBar` objects;
- clicking a row header selects that row’s embedded source object and opens the SoundObject editor;
- dragging in the grid paints a contiguous run using the first pressed cell’s on/off mode;
- source-object timing remains the generator’s template timing, not a cell-placement coordinate.

## User stories and acceptance scenarios

### US1 — See pattern data on the score timeline (P1)

As a composer, I need each pattern row to show its active and inactive steps on the shared score timeline.

- A group renders one row per `PatternLayer`, including empty rows.
- Each step boundary is `effectivePatternBeatsLength * pixelsPerBeat` wide and aligns with the score ruler.
- Each active cell is a solid block spanning one pattern step. It has no source-object label and is not represented as an independent score object.
- Zoom and horizontal scroll change geometry without changing cell indices.
- A malformed/non-positive raw step length uses a positive display fallback without rewriting canonical XML.

### US2 — Edit the grid with the mouse (P1)

As a composer, I need to paint pattern steps directly in the grid.

- Pressing an inactive cell starts an “on” gesture; pressing an active cell starts an “off” gesture.
- Dragging fills every integer cell between successive positions, even when pointer events skip over cells.
- The gesture remains bound to the row where it started; vertical pointer movement cannot paint another row.
- Release commits one `updatePatternCells` patch through the existing project-document bridge.
- Grid boundaries are the snap points. The score snap preference does not create fractional pattern cells.
- A drag released outside the canvas finalizes from the last horizontal position and leaves no stuck gesture state.

Occurrence selection, occurrence move, edge resize, and marquee selection are explicitly out of scope for this Java-faithful correction. The canonical model has no independent occurrence records to move or resize; changing the shared step length is a separate group-level operation and remains available to the appropriate group/model workflow.

### US3 — Select and edit a pattern row’s source object (P1)

As a composer, I need the row header to expose the SoundObject that generates that row.

- A plain left click on a pattern row header selects its embedded source-object editor target and focuses `ScoreObjectEditorTopComponent`.
- The selected header has a visible selected state and displays the row name plus the source-object name.
- Shift-click clears the single editor target because the existing editor accepts one source object; it must not pretend multiple rows resolve to one editable object.
- Double-clicking the row name edits the layer name.
- Mute and solo remain row-level controls.
- The header context menu includes Edit Sound Object/Properties and existing layer add/remove/reorder operations.

### US4 — Use grid context commands (P2)

As a composer, I need common commands without turning a cell into a fake score object.

- Right-clicking a cell targets that row/cell.
- Cut, Copy, Paste, and Delete operate on active boolean cells through `updatePatternCells`; they never delete or duplicate the embedded source object.
- The renderer clipboard stores a relative cell shape and survives repeated paste operations.
- Properties routes to the source object for the targeted row.

These commands are a small additive convenience. They do not introduce occurrence selection or ordinary score-object clipboard records.

### US5 — Follow shared playback (P2)

- The existing `ScoreOverlayLines` playhead crosses all pattern rows at the same beat/pixel position as the score ruler and neighboring groups.
- The pattern canvas adds no local clock or second cursor.
- Idle/stopped playback hides the shared playhead without changing pattern data.

## Functional requirements

- **FR-001**: The canvas MUST use the shared `pixelsPerBeat` mapping for beat/pixel conversion and the inverse mapping for cell hit-testing.
- **FR-002**: The renderer snapshot MUST expose raw/effective group step length, stable row/source identities, and sorted active cell indices without exposing inactive trailing capacity as content.
- **FR-003**: Active cells MUST render as fixed grid blocks; the renderer MUST NOT use `RenderBar` or source labels for active cells.
- **FR-004**: Cell interaction MUST capture the initial boolean mode, fill contiguous integer indices, stay on the pressed row, and commit one canonical cell patch on release.
- **FR-005**: Pattern source selection MUST route through `ScoreObjectEditorTargetSnapshot.patternSource` and the existing SoundObject editor document flow.
- **FR-006**: Header mute, solo, rename, add/remove, and reorder behavior MUST preserve existing layer semantics.
- **FR-007**: Cell Cut/Copy/Paste/Delete and Properties MUST be target-aware, canonical, and source-object preserving.
- **FR-008**: The shared playback cursor MUST remain the only cursor over pattern rows.
- **FR-009**: Renderer selection, clipboard, hover, context target, and gesture preview state MUST remain transient and never enter `.blue` XML.
- **FR-010**: Pattern edits MUST preserve the existing `PatternsLayerGroup`/`PatternLayer` XML contract and source-object data.
- **FR-011**: `PatternLayer.generateForCSD` MUST normalize the embedded source start to beat zero before repeating its generated notes, matching Java Blue.
- **FR-012**: Tests MUST cover mapping, empty/sparse/dense grid rendering, on/off painting, skipped-cell fill, row binding, header source selection/editor focus, context commands, shared playhead alignment, performance shape, and XML/CSD generation parity.

## Compatibility and ownership

The Electron main-process `BlueData` model remains canonical. The renderer receives `PatternLayerSnapshot`/`PatternsLayerGroupSnapshot` data and sends typed `PatternScorePatch` intents through the existing project document queue. The existing `.blue` XML remains the only durable store.

The embedded source object is a source template. Its editor target uses `patternSource: { groupId, layerId, sourceObjectId }`; it is not an ordinary timeline item and is not eligible for ordinary move/remove/audition paths.

## Out of scope

- independent timing or duration per active cell;
- rendering source-object names/labels as timeline bars;
- moving, resizing, or marquee-selecting derived occurrences;
- a second pattern-specific playback clock or persistence format.

## Java references

- `blue-score-layers-patterns-ui/.../PatternsLayerPanel.java`
- `blue-score-layers-patterns-ui/.../PatternsLayerPanelMouseListener.java`
- `blue-score-layers-patterns-ui/.../PatternsHeaderListPanel.java`
- `blue-score-layers-patterns-ui/.../PatternLayerPanel.java`
- `blue-score-layers-patterns-core/.../PatternLayer.java`
