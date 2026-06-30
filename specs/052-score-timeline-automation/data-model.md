# Data Model: Score Timeline Automation Editing

**Feature**: `052-score-timeline-automation`
**Date**: 2026-06-04

## Overview

Score timeline automation is modeled as a layer-level assignment to existing automation parameters. The layer stores which parameter ids are visible/editable on that row, while the parameter itself stores the line color, bounds, enabled state, fixed value, curve type, and time/value points. This mirrors Java Blue's `AutomatableLayer`, `ParameterIdList`, and `ParameterLinePanel` behavior.

## Entities

### Automation Parameter

Canonical source: `@blue/data` `Parameter`.

Fields:

- `uniqueId`: stable parameter identity used by layer assignments.
- `name`: internal display key.
- `label`: user-facing label when provided.
- `minimum` and `maximum`: value bounds used for drawing and edit clamping.
- `resolution`: value snapping increment.
- `curve`: interpolation mode.
- `fixedValue`: value used when automation is disabled.
- `automationEnabled`: whether line data should drive the parameter.
- `lineColor`: Java-compatible integer line color stored on the nested `<line>` XML element.
- `points`: sorted time/value points.

Validation:

- `uniqueId` must be non-empty before assignment.
- `points` must sort by time after load and mutation.
- Edited point values must clamp to `minimum` and `maximum`.
- Time values must not move before `0`.
- `lineColor` must round-trip through XML and default to the current Java-compatible grey when missing.

### Layer Automation Assignment

Canonical source: `@blue/data` `ParameterIdList` owned by `SoundLayer` and `AudioLayer`.

Fields:

- `parameterIds`: ordered unique list of assigned automation parameter ids.
- `selectedIndex`: selected parameter index for that layer, matching Java Blue's current line selector behavior.

Validation:

- Duplicate parameter ids are not allowed in one layer.
- One parameter id can be owned by only one visible timeline layer at a time.
- `selectedIndex` is `-1` when the list is empty; otherwise it is clamped to a valid list index.
- Removing a selected parameter chooses the nearest remaining parameter.

Persistence:

- `SoundLayer` XML persists one `parameterId` child per assigned parameter.
- `AudioLayer` XML persists one `parameterId` child per assigned parameter.
- If selected index is not represented in Java XML, renderer can derive it from assignment order and local interaction; persisted selected parameter may be encoded only if Java-compatible storage exists.

### Score Layer Automation Snapshot

Renderer snapshot attached to `ScoreLayerSnapshot`.

Fields:

- `layerId`: score layer identity.
- `layerKind`: `soundObject` or `audio`.
- `parameterIds`: assigned parameter ids.
- `selectedParameterId`: currently selected assigned parameter id, if any.
- `parameters`: resolved `AutomationParameterSnapshot` values for assigned parameters.
- `targetGroups`: menu target groups available to this layer.
- `missingParameterIds`: assigned ids that no longer resolve to a project parameter.

Validation:

- `parameters` contains only currently resolvable assigned ids.
- `missingParameterIds` is safe to show as stale and must not crash drawing.
- Audio layers expose targets from the associated mixer channel only.
- SoundObject layers expose eligible instrument and mixer targets.

### Automation Parameter Snapshot

Renderer value used for drawing and editing.

Fields:

- `parameterId`
- `name`
- `label`
- `displayName`
- `minimum`
- `maximum`
- `resolution`
- `curve`
- `fixedValue`
- `automationEnabled`
- `lineColor`
- `points`
- `targetPath`
- `sourceKind`: `instrument`, `mixer`, `audioChannel`, `effect`, `send`, or `unknown`

Validation:

- Point coordinates are finite numbers.
- Display name falls back from `label` to `name` to `parameterId`.
- `lineColor` is always present after snapshot creation.

### Automation Target Menu

Renderer menu model for the layer A button.

Fields:

- `groups`: ordered top-level menu groups such as `Instrument`, `Mixer`, or an audio channel name.
- `targets`: entries with `parameterId`, display labels, source path, enabled state, and assignment state.
- `assignmentState`: `available`, `assignedCurrentLayer`, `assignedOtherLayer`, or `missing`.
- `ownerLayerId`: current owner when assigned elsewhere.

Validation:

- SoundObject menus include instrument and mixer target groups.
- Audio menus include the associated mixer channel target group and do not include unrelated instrument menus.
- Selecting `assignedCurrentLayer` removes the assignment.
- Selecting `assignedOtherLayer` moves ownership to the current layer.
- Selecting `available` enables automation when needed and assigns the target to the current layer.

### Automation Edit Mode

Renderer-local state.

Values:

- `score`: existing score object and audio clip editing mode.
- `singleLine`: edit the selected automation line for one layer directly.
- `multiLine`: select, move, and scale automation ranges across layers.

State:

- `mode`
- `activeLayerId`
- `activeParameterId`
- `singleLineSelection`
- `multiLineSelection`
- `dragState`

Validation:

- Switching out of automation modes clears transient drag state.
- `singleLine` requires a selected layer parameter to accept point edits.
- `multiLine` can include soundObject layers, audio layers, selected score objects, and selected audio clips.

### Single-Line Selection

Renderer-local range on one automation parameter.

Fields:

- `layerId`
- `parameterId`
- `startBeat`
- `endBeat`
- `selectedPointIndexes`

Operations:

- Insert point at cursor time/value.
- Insert point on existing curve value.
- Move selected points.
- Scale selected points around a range edge.
- Vertical-shift selected point values.
- Delete eligible selected points.
- Copy and paste range.

Validation:

- First-point deletion follows Java Blue eligibility rules and must not leave an invalid line.
- Snap settings apply to edited beat values when enabled.
- Value resolution applies after vertical movement or scaling.

### Multi-Line Selection

Renderer-local time/layer range.

Fields:

- `startBeat`
- `endBeat`
- `layerIds`
- `includedObjectRefs`
- `includedClipRefs`
- `includedParameterIdsByLayer`

Operations:

- Create range from pointer drag.
- Move range in time.
- Scale range from left or right edge.

Validation:

- Move cannot shift selected automation before beat `0`.
- Scaling leaves points outside the range unchanged.
- Object, clip, and automation movement use the same beat delta to preserve alignment.

### Score Automation Patch

Canonical mutation sent through the project document patch path.

Patch families:

- Assignment: assign, remove, move from another layer, clear all, select current parameter.
- Appearance: set line color.
- Line points: set full points, insert point, delete point, move point, replace selected range.
- Range operations: move or scale selected automation lines, optionally with selected score objects/audio clips.
- Cleanup: remove stale assignment ids.

Validation:

- Patches resolve targets against the current `BlueData` instance.
- Patches fail safely when a layer or parameter is missing.
- Completed gestures produce one undoable logical edit.

## State Transitions

1. User opens a layer A button.
2. Renderer reads `targetGroups` from the score snapshot.
3. User selects a target.
4. Renderer dispatches an assignment patch.
5. Main process updates `SoundLayer` or `AudioLayer` `ParameterIdList` and parameter enabled state.
6. Snapshot refresh resolves assigned parameters and redraws the overlay.
7. User edits automation points in single-line or multi-line mode.
8. Renderer dispatches a point/range patch at gesture completion.
9. Main process mutates the canonical `Parameter` line data.
10. Save/reload and playback/export use the same canonical data.

## Java Parity Notes

- Java Blue stores assignment ids on automatable layers, not on score objects or audio clips.
- The A button behavior is a target ownership workflow, not just a visibility toggle.
- Audio layer automation is tied to the layer's associated mixer channel.
- Single-line editing treats the selected parameter as active and all other assigned parameters as context.
- Multi-line editing operates across all assigned lines for selected automatable layers and keeps score objects/audio clips aligned.
