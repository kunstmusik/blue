# Research: Score Timeline Automation Editing

**Feature**: `052-score-timeline-automation`
**Created**: 2026-06-04
**Scope**: Java Blue score timeline automation behavior for soundObject layers and audio layers.

## Java Blue Reference Summary

Java Blue implements score timeline automation as a layer overlay. Each automatable layer stores a `ParameterIdList`; each listed parameter has a `Line` containing automation points. The timeline draws those parameter lines over the layer rows, while layer headers provide the A button and parameter selector controls.

For soundObject layers, the main reference path is:

- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/score/layers/soundObject/ScoreTimeCanvas.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/score/layers/soundObject/AutomationLayerPanel.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/score/soundLayer/SoundLayerPanel.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-core/src/main/java/blue/SoundLayer.java`

`ScoreTimeCanvas` adds `AutomationLayerPanel` above score-object views. `AutomationLayerPanel` creates one `ParameterLinePanel` per `AutomatableLayer`, but only when the score path is at the root level. `SoundLayer` implements `AutomatableLayer` and persists assigned automation parameter ids as `parameterId` children in the layer XML.

For audio layers, the main reference path is:

- `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-ui/src/main/java/blue/score/layers/audio/ui/AudioLayersPanel.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-ui/src/main/java/blue/score/layers/audio/ui/AudioHeaderLayerPanel.java`
- `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-audio-core/src/main/java/blue/score/layers/audio/core/AudioLayer.java`

`AudioLayersPanel` also adds `AutomationLayerPanel` above `AudioClipPanel` rows. `AudioLayer` implements `AutomatableLayer` and persists `parameterId` entries in its XML. This confirms that audio timeline automation uses the same line overlay editing surface as soundObject layers, while audio clips keep their separate clip fade editing behavior.

## A Button Behavior

SoundObject layer headers use `SoundLayerPanel.automationButtonActionPerformed()` to call `AutomationManager.getAutomationMenu(layer.getAutomationParameters())`.

That menu:

- Groups instrument parameters under `Instrument`.
- Groups mixer parameters under `Mixer`, with channel, sub-channel, master, pre-effect, post-effect, send, and volume entries.
- Marks parameters already assigned to the current layer in green.
- Marks enabled parameters assigned elsewhere in orange.
- Selecting a disabled parameter enables automation, assigns a color, adds it to the current layer, and updates the parameter value from its line.
- Selecting a parameter already assigned to the current layer disables automation and removes it from that layer.
- Selecting a parameter assigned elsewhere removes it from the other layer and assigns it to the current layer.
- Offers `Clear All` for the current soundObject layer's selected parameter list.

Audio layer headers use `AudioHeaderLayerPanel.automationButtonActionPerformed()` to build a menu from the audio layer's associated mixer channel with `AutomationManager.buildChannelMenu(channel, audioLayer.getAutomationParameters())`. This means the audio layer A button targets the audio layer's mixer channel automation only, not global instrument menus.

Both header types show a parameter selector footer when the layer is tall enough and has assigned parameters. The footer shows a color selector, current parameter name, and previous/next buttons for cycling the selected parameter.

## Single-Line Mode

`ParameterLinePanel` draws all assigned parameter lines. In `ScoreMode.SINGLE_LINE`, it installs its line mouse listener and treats the selected parameter as the active editable line. Other assigned lines are drawn darker as context.

Observed single-line behaviors:

- Click inserts a point at mouse time/value.
- Alt-click inserts a point on the existing curve value at that time.
- Dragging a point moves it subject to time/value bounds, snap, resolution, and duplicate-time boundary handling.
- Right-click on a selected non-first point deletes it; right-click elsewhere opens an edit-points popup.
- Shift-drag creates a single-line time-range selection.
- Dragging a selected range translates selected points.
- Dragging a selection edge scales selected points.
- Control-drag on a selection vertically shifts selected values.
- Command/control-click pastes a copied single-line selection.
- Completed edits create undo entries through `LineChangeEdit`, `ClearLineSelectionEdit`, and related score undo infrastructure.

## Multi-Line Mode

In `ScoreMode.MULTI_LINE`, `ParameterLinePanel` removes its direct point-edit mouse listener and draws all assigned lines in selection mode. Global score mouse listeners manage range operations:

- `MultiLineSelectionMouseProcessor` creates a time-and-layer selection across `ScoreObjectLayer` rows.
- `MultiLineMoveMouseListener` moves selected score objects and every assigned automation line for selected `AutomatableLayer` rows.
- `MultiLineScaleMouseListener` scales selected score objects and every assigned automation line for selected `AutomatableLayer` rows.

Both move and scale copy each source `Line` first, apply selection drag or scale processing to a temporary line, write the result back, and add undo edits when the gesture completes. This is the core parity behavior needed for soundObject and audio layer automation in blue-electron.

## TypeScript Port Implications

- The score timeline already distinguishes `PolyObject` soundObject layers from `AudioLayerGroup` rows, so automation UI needs both layer families.
- The existing audio-layer bars and soundObject bars should not be replaced; automation is an overlay and header-control feature.
- Audio layer automation should be modeled as mixer-channel automation assignment for the layer, while audio clip fades remain clip editing/rendering behavior.
- The existing automation playback bridge should consume the same edited parameter line data after assignment and point edits.
- The first parity slice can match Java Blue's root-level automation overlay behavior and defer nested score-path automation if necessary.
