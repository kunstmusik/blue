# Quickstart: Score Timeline Automation Editing

**Feature**: `052-score-timeline-automation`
**Date**: 2026-06-04

## Prerequisites

- A project with at least one PolyObject/soundObject layer containing a sound object with automatable BSB parameters.
- A project mixer with automatable channel, effect, send, or volume parameters.
- An AudioLayerGroup with an audio layer associated with a mixer channel.
- Score timeline root view selected. Nested score-path automation can remain unavailable for this slice if matching Java Blue root-only behavior.

## Manual Scenario 1: SoundObject Layer A Button

1. Open the score timeline root.
2. Locate a soundObject layer header.
3. Click the layer A button.
4. Confirm the menu shows `Instrument` and `Mixer` groups when eligible targets exist.
5. Select an available parameter.
6. Confirm the parameter line appears on the layer and the selector footer shows its name and color.
7. Reopen the A button menu and select the same parameter.
8. Confirm the parameter is removed from the layer.

Expected result: current-layer assignments are visibly distinguished from available and elsewhere-assigned targets.

## Manual Scenario 2: Audio Layer A Button

1. Open the score timeline root with an audio layer associated to a mixer channel.
2. Click the audio layer A button.
3. Confirm the menu shows targets for the associated mixer channel.
4. Confirm unrelated instrument targets are not shown.
5. Assign a channel target.
6. Confirm an automation line appears over the audio layer without changing audio clip fade handles.

Expected result: audio timeline automation targets the layer's mixer channel and preserves existing clip editing.

## Manual Scenario 3: Single-Line Editing

1. Assign two automation parameters to a soundObject or audio layer.
2. Switch the score automation mode to `singleLine`.
3. Use previous/next controls in the layer selector footer.
4. Confirm the selected line is active and other assigned lines draw as inactive context.
5. Click to insert a point.
6. Drag the point with snap enabled.
7. Disable snap and drag again.
8. Create a range selection and move the selected range.
9. Scale the range from one edge.
10. Change the line color.
11. Undo each completed edit.

Expected result: point edits respect time snap, parameter bounds, parameter resolution, and undo grouping.

## Manual Scenario 4: Multi-Line Editing

1. Assign automation parameters on at least one soundObject layer and one audio layer.
2. Select score objects or audio clips that overlap the same time range.
3. Switch the score automation mode to `multiLine`.
4. Drag a time/layer selection spanning the automatable rows.
5. Move the range.
6. Scale the range from the left or right edge.
7. Confirm selected automation points move or scale with selected score objects/audio clips.
8. Confirm unselected layers and out-of-range points remain unchanged.

Expected result: automation and selected score objects/audio clips remain aligned after move and scale operations.

## Manual Scenario 5: Persistence And Playback

1. Assign automation on a soundObject layer and an audio layer.
2. Edit points and line colors.
3. Save the project.
4. Reopen the project.
5. Confirm layer assignments, selected parameter ordering, line colors, and points match the saved state.
6. Play, render, or export a representative passage.

Expected result: playback/export uses the edited canonical parameter line data without a separate synchronization step.

## Manual Scenario 6: Missing Target Handling

1. Assign an automation parameter to a layer.
2. Remove or disable the owning instrument, mixer channel, effect, send, or audio channel association.
3. Refresh or reopen the score timeline.

Expected result: the score view does not crash. Missing assignments are omitted or flagged as stale and can be cleaned up.

## Automated Checks

Run focused tests while implementing:

```bash
pnpm --filter @blue/data test -- parameter-id-list parameter audio-layer sound-layer
pnpm --filter @blue/app test -- score-timeline-automation
pnpm --filter @blue/app test -- audio-layer-group-canvas score-time-canvas
pnpm --filter @blue/data test -- blue-data-csd-automation
```

Run repository-level validation before handoff:

```bash
pnpm test
pnpm run lint
git diff --check
```

## Implementation Notes

- Keep automation UI inside the existing score panel rather than making a separate editor.
- Add reusable automation components under `packages/blue-app/src/renderer/components/workbench/panels/score/automation/`.
- Implement soundObject and audio layer automation with the same overlay component where possible.
- Model all data behavior after the Java implementation named in [research.md](research.md).
- Add XML tests before changing `@blue/data` serialization.
