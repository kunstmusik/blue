# Research: Layer and Clip Colors

## Decision 1: Use copy-on-create, not live inheritance

**Decision**: A new item copies the destination layer's current color once and thereafter owns an independent concrete color. Changing a layer color does not recolor existing items. Explicit commands reapply current layer colors when requested.

**Rationale**: DAWs use both models. Ableton documents that a new clip takes its track color and offers “Assign Track Color to Clips” to reapply it; this closely matches Blue's established concrete score-object colors. Cubase, Studio One, Bitwig, Pro Tools, and Ardour expose variations of track-following or inherited region colors, while Logic supports both following the track and independent region colors. Blue's Java-compatible item XML has no inheritance marker, so a live link would either be lost on Java resave or require a new semantic state Java cannot preserve. Copy-on-create is predictable and preserves the strongest cross-version behavior.

**Alternatives considered**:

- Live inheritance for all clips: rejected because it changes existing item-color semantics and cannot survive Java Blue round trips.
- Live inheritance until manual override: rejected because it requires persisted inherited-versus-explicit state and substantially expands migration and UI semantics.
- Recolor all items whenever a layer changes: rejected because it destroys intentional item colors.

**Reference material**:

- [Ableton Live Manual — Clip View and clip color](https://www.ableton.com/en/manual/clip-view/#clip-color)
- [Cubase — Setting event colors to track colors](https://www.steinberg.help/r/cubase-pro/15.0/en/cubase_nuendo/topics/project_window/project_window_setting_event_colors_to_track_colors_t.html)
- [Logic Pro — Change track or region colors](https://support.apple.com/en-hk/guide/logicpro/lgcpf7c0db8c/12.3/mac/15.6)
- [Ardour Manual — color preferences](https://manual.ardour.org/preferences-and-session-properties/preferences-dialog/)

## Decision 2: Persist a concrete signed ARGB value on every layer

**Decision**: Ordinary sound layers, Tracks, and Pattern layers expose `getBackgroundColor()` and `setBackgroundColor()`. They serialize `<backgroundColor>` as signed 32-bit integer text, matching score-object XML. The neutral opaque dark gray is `#404040`, represented canonically as signed ARGB `-12566464` (`0xFF404040`).

**Rationale**: Matching the existing item representation minimizes conversion rules and keeps Java-readable item colors concrete. The `backgroundColor` name already appears in models, snapshots, and UI contracts. Normalizing layer colors to opaque ARGB removes ambiguity between RGB and signed Java integer inputs while the renderer can continue masking the low 24 bits for CSS.

**Alternatives considered**:

- CSS hex strings: rejected because they diverge from `.blue` item storage and require translation across every bridge.
- Optional model property: rejected because the clarified requirement makes every in-memory and newly saved layer color concrete. Optionality belongs only at legacy XML input and creation-intent boundaries.
- A separate palette identifier: rejected because palette assignment is explicitly deferred.

## Decision 3: Materialize the neutral color for legacy and malformed input

**Decision**: Missing or malformed layer color XML loads as the neutral color. Every subsequent save emits a valid `<backgroundColor>` for the layer. Existing item values are never changed as part of this fallback.

**Rationale**: This provides a total in-memory model, makes rendering simple, and satisfies the clarified requirement that all saved layers have concrete color data. Recognized layer-color children must be excluded from unknown-child preservation to avoid duplicate output, especially in Track serialization.

**Alternatives considered**:

- Retain `undefined` until a user edit: rejected because it spreads optional handling and contradicts save materialization.
- Reject the project on malformed color data: rejected because color metadata should not prevent recovery of the rest of a project.

## Decision 4: Make item color optional only for genuine creation intents

**Decision**: `ScoreLayerSnapshot.backgroundColor` and persisted model colors are required. `updateLayerState.patch.backgroundColor` is optional because the patch is partial. Item color in add-item bridge payloads may be omitted only when the caller is asking the canonical document to create a genuinely new item; omission means copy the resolved destination layer color.

Serialized XML, imported content, copied/duplicated items, and source-target reification must retain the object's existing color or carry it explicitly. A canonical handler must not replace a restored object's color merely because the transport field is absent.

**Rationale**: The document bridge is the only authority that can resolve the actual destination layer at commit time. Optionality represents an intent—“choose the destination default”—rather than unknown project state. Keeping snapshots required prevents `undefined` from becoming a fourth visual state.

**Alternatives considered**:

- Require the renderer to resolve all new colors: rejected because queued/rebased edits could use a stale layer color and other callers would duplicate policy.
- Make all colors optional everywhere: rejected because it weakens canonical invariants and obscures whether a color is missing, inherited, or deliberately neutral.
- Default every absent transfer to the layer color: rejected because it would silently recolor legacy/imported serialized content.

## Decision 5: Use one atomic multi-target recolor patch

**Decision**: Add `setScoreObjectBackgroundColors` with a list of target/color updates. Before mutation, the canonical handler validates every target, color, scope, and duplicate; if any entry is invalid, none are applied. The same patch shape is used for selected-item and whole-layer actions and for forward/inverse undo.

**Rationale**: One canonical call satisfies all-or-nothing behavior, gives the optimistic reducer an exact mirror, and scales to 1,000 items without 1,000 document-bridge round trips. Per-target colors are necessary for “Set to Layer Color” across a selection spanning differently colored layers and for precise undo.

**Alternatives considered**:

- Dispatch one existing item patch per object: rejected because partial failure violates atomicity and creates excessive bridge traffic.
- A patch containing only a layer ID: rejected because it cannot cover multi-layer selections or encode inverse colors.
- A generic transaction framework: rejected as unnecessary for this bounded feature.

## Decision 6: Add bounded score-color history, not general project undo

**Decision**: Implement a renderer-local, bounded score-color history containing a label plus forward and inverse typed score patches. Each layer picker gesture and each explicit application command records one entry. Undo flushes pending project patches before sending the inverse; redo sends the forward patch. History clears when the project session is replaced and when structural edits make recorded targets unsafe.

Expose score-scoped undo/redo controls in the score toolbar. Do not take over Electron's native Edit menu roles, which currently serve text editing.

**Rationale**: The repository has editor-local histories for Piano Roll and BlueX7 but no general score/project command history. FR-017 requires reliable one-step reversal of these color actions, not a speculative application-wide undo architecture. A bounded, disposable stack is sufficient and avoids persistence or migration concerns.

**Alternatives considered**:

- Introduce project-wide command history: rejected as much larger than the color feature and likely to create false undo guarantees for unrelated edits.
- Reuse native Electron undo roles: rejected because they target focused editable controls and do not reverse canonical project patches.
- Store history in `.blue`: rejected because undo state is session UI state, not project content.

## Decision 7: Reuse the existing host-aware color picker with a commit callback

**Decision**: Place the existing `ColorPickerButton` in ordinary/Track and Pattern layer headers. Add an optional gesture-level commit callback while preserving existing continuous `onChange` behavior. The layer UI previews and persists changes as the picker moves, then records one prior/final history entry when the picker closes if the value changed.

**Rationale**: Reuse preserves interaction consistency and the existing host-document portal behavior needed by floated panels. The commit callback lets slider movement remain responsive while ensuring one undo step instead of one entry per intermediate value. Existing picker consumers need no behavior change.

**Alternatives considered**:

- Add a second layer-only picker: rejected as duplicate UI and popout logic.
- Record every `onChange`: rejected because a drag would flood undo history.
- Defer all visual change until close: rejected because it removes useful live feedback.

## Decision 8: Preserve Java compatibility as an intentional asymmetric round trip

**Decision**: Electron Blue writes layer `<backgroundColor>` children and concrete item colors. Current Java Blue may ignore and later omit unknown layer-color children, but must continue to open the project and retain item colors. Electron reopening such a Java-resaved project uses the neutral layer fallback without changing clips.

**Rationale**: Java Blue has no layer-color field, while its score objects already use concrete background colors. This is the maximum compatible behavior without modifying Java Blue in the same feature.

**Alternatives considered**:

- Encode layer color in names or unrelated Java fields: rejected as corrupting semantics.
- Block Java opening: rejected because the extra layer child can remain forward-compatible and item content remains readable.
