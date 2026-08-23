# Quickstart: Score Object Editor Tier 1 Parity

## Goal

Validate that the first grouped follow-up closes the remaining moderate score-object editor gaps for `External`, `PolyObject`, and `TrackerObject`.

## Preconditions

1. Build and run the Electron app from `/Users/stevenyi/work/blue-electron` after this slice is implemented.
2. Prepare a project that includes:
   - one `External` score object
   - one `PolyObject` with several child score objects
   - one `TrackerObject` with multiple tracks or rows

## Validation Steps

1. Load the project and open `ScoreObjectEditorTopComponent`.
2. Select the `External` score object.
3. Confirm the editor exposes code text, command line, syntax type, and the supported test affordance.
4. Edit the code and command-line values.
5. Confirm the canonical object and editor document refresh correctly.
6. Select the `PolyObject`.
7. Confirm the editor shows a child-object browser and generated-score preview instead of a placeholder message.
8. Use any supported open/test affordance and confirm it routes cleanly.
9. Select the `TrackerObject`.
10. Confirm the editor shows toolbar controls, track headers, and a styled editable grid.
11. Change toolbar state and several cells.
12. Confirm the edits persist through canonical score data and panel refresh.
13. Remove the currently selected Tier 1 object while its editor is open.
14. Confirm the editor clears safely instead of retaining stale controls.

## Expected Results

- `External` is no longer limited to a bare code editor.
- `PolyObject` is no longer a placeholder.
- `TrackerObject` provides a practical Java-style editing surface.
- Tier 1 editors continue to honor Spec 037 fallback behavior when the selection becomes invalid.

## Manual Validation Record

2026-08-23: Rechecked the TrackerObject follow-up behavior on the refactor branch. The
`USE KEYBOARD NOTES` checkbox remains enabled through the editor refresh, Arrow Up/Down moves
row focus without scrolling the tracks page, and Space toggles a tie from the dedicated
status cell or tracker-grid background. Moving a selected soundObject between layers also
keeps its editor populated. The focused regression coverage is captured in
`tracker-score-object-editor-keyboard.test.tsx`, `score-object-editor-panel-tracker-patch.test.ts`,
and `score-object-editor-fallbacks.test.tsx`.
