# Layer sizing investigation

Researched 2026-09-14. This is specification-stage research, not an implementation plan. Sources below are vendor manuals; no DAW was run interactively. Versioned evidence is identified rather than presented as verified current-release behavior. “Not established” means the reviewed material did not establish the capability, not that the product lacks it.

## DAW comparison

| Product / evidence | Direct sizing and scope | Presets, reset, and related operations | Implication for Blue |
| --- | --- | --- | --- |
| Ardour, online manual | Drag the bottom of a header; all selected tracks resize. Height menu also applies to selection. | Standard sizes; fit selection vertically; visual undo restores fit. Empty-header double-click toggles Normal/Largest. | Selection-aware dragging plus fixed sizes is a coherent combination. |
| REAPER 7.48 / 7.40 manuals | Lower-boundary drag for one track; Alt-drag for selected, Ctrl-drag for all in the documented Windows bindings. | Min/max toggles restore previous heights; enlarge selected/minimize others; equalize-and-grow/shrink; height locking. | Explicit scope and recovery are valuable; locking and focus layouts add separate state and can wait. |
| Logic Pro 10.7 manual | Drag bottom-left corner; Command-drag adjusts all. | Shift-drag resets all to default zoom; individual reset, reset all, individual/window zoom toggle, and focused-track zoom. Heights relate to overall window zoom. | Reset must name its baseline. Blue should retain project defaults rather than import a second zoom factor. |
| Ableton Live 12 online manual | Drag split line below unfold control; Alt/Option while resizing affects all. Keyboard height adjustment is documented. | Fold/unfold selected or all; Optimize Height fits the arrangement. Named size preset libraries and user-defined height defaults not established by reviewed sections. | Keep collapse, fit, and manual height distinct. |
| Pro Tools 2020.3 / 2020.12 reference guides | Header lower-boundary drag is incremental; Command/Control enables continuous sizing. Option/Alt-drag affects all; adding Shift affects selected tracks. | Micro, Mini, Small, Medium, Large, Jumbo, Extreme, Fit To Window; height choice propagates to Edit Group; zoom toggle offers target height choices. | Free and fixed sizing can coexist. Do not equate Blue layer groups with automatically linked Pro Tools Edit Groups. |

### Source evidence

- **Ardour**: [Track Height](https://manual.ardour.org/working-with-tracks/controlling-track-appearance/track-height/) documents selection-wide dragging, standard sizes, fit, minimum-size limitation, and visual undo. [Audio Track Controls](https://manual.ardour.org/working-with-tracks/audio-track-controls/) documents Normal/Largest toggle. [Zoom Controls](https://manual.ardour.org/ardours-interface/the-zoom-controls/) adds selected/all expand/shrink and fitting a specified number of tracks. Fit-selection can hide intervening unselected tracks, a behavior Blue should not copy implicitly.
- **REAPER**: [User Guide 7.48](https://dlz.reaper.fm/userguide/ReaperUserGuide748c.pdf), Project Basics / track-height mouse and keyboard tables, documents single/selected/all scope and restoring previous heights through toggles. [User Guide 7.40](https://dlz.reaper.fm/userguide/ReaperUserGuide740c.pdf) documents height locks and equalize/size commands. Modifier names here follow the guide's Windows presentation; no Mac binding equivalence is inferred. No custom preset library was established.
- **Logic Pro**: [Zoom tracks, version 10.7](https://support.apple.com/guide/logicpro/zoom-tracks-lgcpc79f5bcd/10.7/mac/11.0) documents individual dragging, all-track modification, reset, focus zoom, and keyboard operations. Reset returns to the window zoom level, not necessarily a fixed pixel number. The separate global-track Shift-click reset documentation must not be generalized to ordinary tracks. Multi-selected drag behavior and named height preset collections were not established by this source.
- **Ableton Live**: [Arrangement View, version 12](https://www.ableton.com/en/manual/arrangement-view/), sections 6.1 and 6.9, documents Optimize Height, unfold controls, split-line dragging, all-track modifier, and keyboard height commands. [Mixing, version 12](https://www.ableton.com/en/manual/mixing/) documents track-edge height dragging in Arrangement. The reviewed text does not clearly establish unequal multi-selected drag arithmetic, so no delta-versus-ratio claim is made.
- **Pro Tools**: [Reference Guide 2020.3](https://resources.avid.com/SupportFiles/PT/Pro_Tools_Reference_Guide_2020.3.pdf), printed p. 245, lists the eight choices and Edit Group propagation. [Reference Guide 2020.12](https://resources.avid.com/SupportFiles/PT/Pro_Tools_Reference_Guide_2020.12.pdf), printed p. 246, documents continuous and bulk dragging, and how smaller heights expose fewer controls. [2020.12 zoom-toggle settings](https://cdn.avid.com/ProTools/2020.12/4A5C431A/Pro_Tools_Reference_Guide_2020.12.pdf) include Last Used and named target sizes. These are historical official manuals; current-release parity was not verified.

## Blue baseline and investigation targets

Source paths below are relative to this repository except the explicitly identified Java checkout.

| Evidence | Finding / planning consequence |
| --- | --- |
| `packages/blue-data/src/score/layers/layer.ts` | Common height constant is 22. |
| `packages/blue-data/src/sound-objects/sound-layer.ts` | Index-derived height; copy constructor preserves the index. Custom height must participate in copying and persistence. |
| `packages/blue-data/src/score/track/track.ts` | Index-derived height; maximum index is 9 (220 pixels); XML reads/writes the index. Preserve this additional type-specific size rather than assuming all types expose exactly nine sizes. |
| `packages/blue-data/src/score/patterns/pattern-layer.ts` | Fixed 22-unit height; extending it needs a separate grid/model decision. |
| `packages/blue-app/src/renderer/components/workbench/panels/score/useScoreWheelZoom.ts` | Derives an index from pixel height and clamps wheel adjustment to index 8. Planning must reconcile this with custom heights and the Track model's index 9. |
| `packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx` | Hit testing/selection traversal uses per-layer heights; preview must feed consistent geometry to painting and interaction. |
| `specs/077-multi-layer-selection/spec.md` | Existing selection spans groups and is separate from MIDI focus and object selection. Reuse it; do not create another target-selection system. |
| Java checkout: `~/work/nbprojects/blue/blue-core/src/main/java/blue/SoundLayer.java` | Stores integer heightIndex in XML and calculates `(index + 1) * 22`; no exact arbitrary-pixel field in this inspected implementation. |
| Java checkout: `~/work/nbprojects/blue/blue-core/src/main/java/blue/score/layers/Layer.java` | Same 22-unit base. |
| Java checkout: `~/work/nbprojects/blue/blue-ui-core/src/main/java/blue/ui/core/score/layers/soundObject/PolyObjectPropertiesPanel.java` | Nine default choices; changing default and applying it to existing layers are distinct actions. |

## Recommended first delivery

These are Blue design judgments, not asserted DAW consensus:

1. Free whole-pixel drag from eligible header boundaries; the score consumes the projected row geometry for synchronization but exposes no resize handle. Keep fixed sizes and numeric keyboard entry. Retain 22 as minimum; propose 660 as initial custom maximum.
2. Drag on a selected row changes each selected height by the same delta. Preset/numeric commands set equal absolute heights. This makes unequal starting heights predictable without introducing proportional scaling.
3. Expose explicit single, selected, and current-group command scopes. Reject unsupported mixed scopes atomically. No implicit group linkage or recursive nested-score changes.
4. Reset to existing group creation default, with a 22-unit fallback. Keep setting a default separate from applying it. Do not add named default profiles until a concrete need appears.
5. Treat committed sizing as project data with one history action; preview remains disposable. Ardour's visual undo is useful precedent for recovery, but Blue's constitution requires ProjectHistory for durable project edits.

## Follow-up operations considered

| Operation | Initial decision | Reason |
| --- | --- | --- |
| Fit selected/all to available height | Defer | Needs overflow/minimum, hidden-row, scroll anchoring, and restoration policy. |
| Minimize/maximize with previous-size restore | Defer | Requires a second remembered layout state beyond undo. |
| Automatically enlarge focused row | Defer | Can move rows under the pointer and interacts with MIDI focus. |
| Height locks | Defer | Adds persistent exceptions to otherwise predictable bulk operations. |
| Named user presets / multiple default profiles | Defer | Existing fixed sizes and group defaults cover immediate recovery and creation needs. |
| Automatic group-linked sizing | Defer | Blue groups are structural containers; selection and explicit group commands are clearer. |
| Pattern row resizing | Defer | Fixed model and grid geometry need dedicated design. |

## Specification-stage questions (resolved below)

- Decide and test the exact project representation of custom heights while retaining an integer Java fallback. Candidate policy: nearest supported legacy size with a deterministic tie rule; this is not yet a schema decision. Never put fractional values in Java's integer heightIndex.
- Demonstrate legacy open/save, Blue Electron custom save/reopen/copy, Java open, and Java save-back behavior. Java may discard unfamiliar fields: quantify and document whether exact custom height is lost, while ensuring musical data remains compatible.
- Inventory every layer height writer, group default, snapshot, duplication path, geometry reader, and history adapter. Verify nested score paths and the 198/220 discrepancy before choosing preset presentation.
- Specify header-boundary hit targets, interaction priority, zoom conversion, scrolling/anchoring, and cancellation across docked/floating score surfaces. The score surface consumes projected row geometry and exposes no resize affordance; the header's 4-pixel strip takes priority there, while automation and clip/object controls retain their existing priority outside it.
- Plan focused geometry, cancellation, commit→undo→redo, compatibility, and playback tests plus the spec's usability/performance checks. No production code was changed or runtime behavior tested in this investigation.


## Phase 0 implementation decisions

### R1 — Compatible exact-height storage

**Decision:** Add optional `customHeight` (integer logical pixels, 22–660) to SoundLayer and Track. Continue writing integer `heightIndex`. For a new custom value choose the nearest type-specific fixed size as fallback, with midpoint ties upward and clamp to preset bounds (SoundLayer indices 0–8; Track 0–9). Exact presets use only the index; 57 becomes `heightIndex="2" customHeight="57"`, and 660 uses index 8/9 plus customHeight. Legacy loading is not clamped to the new editing range.

**Rationale:** The current `.blue` owner and integer Java reader remain intact; no preference/sidecar lifetime mismatch. SoundLayer legacy index 40 still means 902; Track's existing loader clamps index 40 to 9 (220), and this prior appearance is retained. Valid customHeight takes precedence. Malformed custom attributes remain verbatim in existing unknown-attribute maps, are ignored for rendering, and are removed only by an explicit height edit. Copy/history paths preserve both modeled and opaque state. No raw-XML rewrite/migration is needed: absence means legacy behavior. If invalid legacy data cannot yield a safe positive height, render the valid group default or 22 without silently rewriting unrelated XML.

**Alternatives considered:** Fractional heightIndex breaks Java integer parsing; replacing heightIndex loses fallback; storing per-window heights in settings violates project ownership; a migration of every old height creates unnecessary dirty changes.

### R2 — Java behavior and compatibility scope

**Decision:** Promise fallback interoperability only for otherwise Java-readable projects. Java save-back discards customHeight; Electron subsequently displays its fixed fallback. Electron TrackLayerGroup already lacks Java support and will not be converted by this feature. Spec FR-013/SC-005 are explicitly qualified accordingly.

**Evidence:** Java checkout `develop`, commit `3ca3f40579c48a023299a68130d8ab6b9e950974`, POM version 2.10.3. Source `blue-core/src/main/java/blue/SoundLayer.java:162–219` and `blue-score-layers-audio-core/src/main/java/blue/score/layers/audio/core/AudioLayer.java:178–230` read/write known fields only. Java Score rejects unknown groups (`Score.java:180–184`); its AudioLayerGroupProvider recognizes audioLayerGroup, whereas Electron TrackLayerGroup serializes trackLayerGroup. This is a baseline format limitation, not caused by the new attribute.

A Java 25 probe against the existing packaged jars under `application/target/blue` loaded empty SoundLayer and AudioLayer elements with customHeight=57 and indices 2, 29, and 40. Both returned heights 66, 660, and 902 respectively; save retained each index and omitted customHeight. Example SoundLayer output: `<soundLayer name="probe" muted="false" solo="false" heightIndex="2"><noteProcessorChain/></soundLayer>`. The packaged build was not rebuilt; exact binary/source correspondence is unproven. This verifies layer-level behavior only, not whole-project opening, musical/CSD equality, or a GUI workflow. Those are delivery checks in quickstart.md.

**Rationale:** State the actual compatibility boundary rather than expand this feature into a Java Track port or promise unsupported preservation.

**Alternatives considered:** Java source changes to preserve the extension, or conversion of Electron Tracks to Java AudioLayers, are separate cross-repository features.

### R3 — One atomic project edit

**Decision:** Add two ScorePatch variants: `setLayerHeights` with an explicit list of stable targets and numeric/default values, and `setLayerGroupDefaultHeight` for future-layer defaults. Send one isolated, labeled ProjectHistory transaction on release. Validate the complete list before any setter; reject malformed/unsupported/stale targets rather than returning a successful no-op. Use the existing structural preparation path and identity transfer, not a new scalar history mechanism.

**Rationale:** `main/project-history-memento.ts:586` prepares structural edits on detached history copies and catches failures. Existing layer-state patches are structural already. A single aggregate patch avoids a sequence of partially accepted row changes. `ProjectDocumentCommitMetadata.expectedRevision` supplies the captured revision fence; the queue must preserve it, recognize rejected receipts, refresh canonical state, and never retry against a newer index silently. Stable `layerSelectionId` is distinct from positional layerId; use `shared/project-editor/identity.ts` identity assignment/transfer.

**Alternatives considered:** Sending every pointermove through history dirties previews and increases retained copies; adding a separate bulk IPC duplicates the document bridge; multiple independent row commits break atomic undo.

### R4 — Shared preview and interaction arbitration

**Decision:** One ScorePanel-owned `useLayerHeightResize` hook produces a shallow display projection of effective layer groups for headers, canvases, overlays, selection, and wheel geometry. Eligible header handles invoke the gesture; the score canvas consumes the projection for synchronized geometry but exposes no height handle. Boundary hit targets occupy the bottom 4 logical pixels of a row and belong to the row above, including the final row. Use native pointer capture, CSS client coordinates, and the hosting document/window. No devicePixelRatio conversion, global preview store, or canvas refactor.

**Rationale:** ScorePanel already composes root/nested groups. Canvases consume layer.height. Header mousedown selects rows and pointerdown focuses Track MIDI; the score capture handler stops auditioning. All three ancestors need resize-target exemptions before their normal behavior. Outside the 4-pixel strip the existing object/automation tools retain priority. Inside it resize owns the gesture; numeric entry remains available when an edge is inconvenient. Cancel on host changes, blur, cancellation, score path/identity/order/revision changes, and history settlement. Releasing pointer capture after successful pointerup must not cancel an in-flight accepted commit.

**Alternatives considered:** Separate previews in each canvas cause disagreement; a generic geometry service would reopen a deliberately deferred modularization seam. A narrow hook plus the header handle supplies a useful test seam without moving unrelated score code.

### R5 — Defaults, presets, and scope

**Decision:** Expose This Layer / Selected Layers / This Layer Group explicitly. Group actions resolve direct rows, never child scores. Selected dragging adds a common delta; presets and numeric input set absolute heights. Reset resolves defaults in main. Add defaultHeightIndex to PolyObject snapshots (Track already exposes it), plus project-owned group-default UI. Fixed default editing accepts indices 0–8 for PolyObject or 0–9 for Track. Do not change the existing app-wide ProjectDefaultsSettings behavior that initializes newly created projects.

**Rationale:** Java separates default change from apply-to-existing. Electron models already implement default fields and newLayerAt; renderer group editing is the missing piece. Shared numeric preset policy replaces wheel rounding and preserves Track's 220 option. For mixed SoundLayer/Track scope expose common presets through 198; 220 remains available for Track-only scopes and via numeric entry for any eligible layer. From a custom height wheel chooses the nearest strictly higher/lower available preset, with no-op when none exists. Reset to a valid imported legacy default may exceed 660; the editing bound applies to new numeric input, not restoration of existing defaults.

**Alternatives considered:** User-defined preset collections, default profiles, and implicit linked groups are outside the spec and add independent persistent state.

### R6 — Runtime, popup, and verification integration

**Decision:** Classify both new patches as cosmetic in `project-runtime-reconciliation.ts` so commit/undo/redo advance document state without engine work. Retain existing project patch queue and history settlement participants. Reuse Radix context menus, host-surface portals, semantic typography, and the existing numeric-input/dialog primitives. Validate with existing Vitest/jsdom and browser Playwright configurations; no new dependencies.

**Rationale:** Existing `updateLayerState.heightIndex` is cosmetic already. Popup rules require host-document positioning and dismissal even when floating without remount. Performance pressure belongs in local projection rather than per-move project serialization. Automated correctness plus a real-engine exercise and five-person discoverability check cover different requirements.

**Alternatives considered:** Engine protocol changes have no musical purpose; a new popup or resize library adds no capability required here.

All initial technical unknowns are resolved as design decisions. Runtime implementation, whole-project interoperability, and measured acceptance remain future validation, not claims of passing tests today.
