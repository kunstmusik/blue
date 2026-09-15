# Layer Height Interaction Contract

## Surfaces and gesture priority

The layer header panel exposes the resize action along the bottom 4 logical pixels of an eligible row. The final row has the same affordance. To mimic DAWs like Logic Pro and REAPER, the main score viewport canvas does not expose layer resize handles, keeping the canvas dedicated to score object and timeline manipulation. A `row-resize` cursor (horizontal divider bar with up/down arrows) and target-scope tooltip/readout identify the action; hover and press highlight lines are omitted.

The resize strip takes priority over layer header selection only within that strip. Outside it existing selection, MIDI focus, and layer reorder behaviors remain unchanged. Mark handles with a dedicated data attribute, and exempt them in ScorePanel's ancestor mousedown capture (audition stop), header mousedown (selection), and header pointerdown (MIDI focus). Stop propagation alone cannot override ancestor capture behavior. Popup event exemptions remain intact.

Primary-pointer down captures the stable target set, original heights, document/revision, view scope, pointer ID and host document. On a selected row use the complete selection in that view; on an unselected row use just that row without altering selection. Mixed Pattern selections disable selected resizing entirely and display the reason.

The header resize handle invokes `useLayerHeightResize`. Native pointer capture owns subsequent movement, including outside the row/window content until cancellation. Use CSS clientY without multiplying by DPR or dividing by Electron zoom. Coalesce display updates with the host window animation frame; round the total delta, not each incremental movement. The header, score, group extents, overlays, wheel targeting, and hit testing consume the same projected heights.

## Boundaries and cancellation

- Per-target clamp: 22–660 for real numeric/drag edits. Start at original heights on every move to avoid clamping drift. Returning to delta zero restores originals, including legacy heights outside the edit range.
- Hover readout shows “This layer” or the selected count. Active readout shows the dragged layer's result and count; never change the selection to make the label true.
- No resize autoscroll. Ignore scroll/zoom wheel gestures while dragging. External scroll/zoom, host-document change, Escape, pointercancel, unexpected capture loss, blur, unmount, path/session change, target reorder/removal, or a new canonical revision cancels before another edit proceeds.
- Prevent scroll anchoring from changing the pointer baseline while heights alter group extents; normal scrollTop clamping is permitted when content becomes shorter. Use one viewport position for both header/score synchronization.
- Register with `registerHistoryEditorSettlement` for the panel's ownerDocument. An active preview cancels on save/undo/redo boundary. An already-released commit is awaited and reconciled before the boundary completes.
- On changed pointerup, release capture deliberately, submit once, retain final display values until canonical acknowledgement, then clear projection. Expected capture loss after pointerup must not cancel the submitted operation.
- Failures restore authoritative state. Transport failure does not prove main rejected the command; refresh before telling the user it failed to save.

## Height commands

Expose scope explicitly rather than relying on hidden modifiers:

| Scope | Target set |
| --- | --- |
| This Layer | Context row only, regardless of selection. |
| Selected Layers | Existing selection within the current score view; disabled if empty or any target is unsupported. |
| This Layer Group | All direct rows of the context group, including offscreen rows; no nested descendants. |

Each scope offers fixed numeric presets, Set Custom Height, and Reset Height to Default. Presets are 22, 44, 66, 88, 110, 132, 154, 176, 198; Track-only scopes also offer 220. Mixed eligible scopes expose common presets; numeric entry supports 220 and other legal custom values across both types. Check presets by exact effective-height equality; show Custom for a uniform non-preset height and Mixed for unequal heights.

At group scope also expose Change Default for New Layers, Reset Height to Default, and Apply Default to Group. Change Default edits the existing default index with the group-type choices and affects future layers only. Reset Height to Default is the explicit existing-row reset over the group's direct rows, using the semantic label `Reset Layer Group Heights`; Apply Default to Group remains a separately named explicit propagation action over those same direct rows, using the semantic label `Apply Default to Group`. They are distinct user actions and history transactions even though both may submit the same effective-height patch. Labels must distinguish future-layer defaults from existing-row changes. Retain current ProgramSettings creation defaults; do not silently overwrite them from group UI.

The existing modified-wheel gesture remains single-row-at-pointer sizing with current platform modifiers. Resolve eligible type and effective numeric height; choose the nearest strictly higher/lower preset. No candidate means no-op. Pattern row wheel sizing is disabled. Do not extend this gesture implicitly to the selection or apply the 198 cap to Track's 220 preset.

## Keyboard and accessibility

- Each eligible header provides a focusable height affordance with accessible layer name, action, scope, current height and limits. A keyboard user must reach it via existing row focus/Tab navigation; a permanently tabIndex=-1 row alone is insufficient.
- Enter/Space opens height commands; keyboard context-menu invocation and height affordance focus must not change layer/object selection or MIDI routing.
- Numeric dialog uses the existing numeric-input and dialog primitives: labeled value in logical pixels, min 22, max 660, step 1, current or Mixed state, inline validation, Apply and Cancel. Mixed starts empty; Apply requires an entered valid value. Do not silently clamp typed out-of-range values.
- Enter applies one command; Escape/Cancel/closure discards the form. Invalid input keeps the form open and communicates the error. Focus returns to the invoking control when it still exists.
- Arrow-size manipulation is not required on the tiny pointer handle because numeric and preset alternatives provide keyboard access. Resize feedback should not announce every pointer frame; announce completion/cancellation and expose current value on demand.

## Host-window rules

Follow `packages/blue-app/AGENTS.md` and `docs/popout-popup-conventions.md`: useHostDocument, PopoutContextMenuPortal/other host wrappers, portalEventIsolationProps, and realm-safe checks. Position readouts and bind listeners to ownerDocument/defaultView. Cancel and rebind when the panel changes hosting document, even without remount. Use existing semantic typography roles and cn(); runtime dimensions belong in inline styles. No window.prompt/confirm, new positioning library, or arbitrary font sizes.

## Acceptance fixtures

Cover root groups, opened root PolyObject, nested PolyObject, SoundLayer/Track mixed selection, Pattern mixed selection, 22-pixel row, last row, offscreen group members, automation editing mode, active audition, timeline playback, 80/100/150% app zoom, pointer leaving the window, two host documents, and move-to-popout during preview. For every fixture, verify exact row alignment plus unchanged timing, selection and routing focus.
