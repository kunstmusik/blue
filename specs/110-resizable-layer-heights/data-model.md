# Data Model: Resizable Layer Heights

## 1. Persisted layer height

**Owners:** SoundLayer and Track within canonical main-process BlueData. Serialized in `.blue`; not a view preference.

| Field | Meaning | Invariants |
| --- | --- | --- |
| heightIndex | Existing integer legacy size index | Preserve existing valid legacy load semantics; no fractional index. |
| customHeight (optional) | Exact effective logical-pixel height | Integer 22–660 inclusive; absent for a newly selected type-specific fixed preset. |
| opaque customHeight (existing unknown-attribute map) | Original unsupported/invalid raw value | Retain verbatim when untouched; not used for rendering; cannot coexist with a validated owned value. |

Effective height: valid customHeight first; otherwise the existing type's valid effective index height; invalid/nonfinite/nonpositive rendering values fall back to valid group default or 22. Preserve non-height fields and unknown data. Validation of invalid loaded legacy values must not auto-dirty the project; retain their raw value if normalization would otherwise destroy it. Track's existing load clamp is preserved, not relaxed; SoundLayer retains valid legacy heights above the new editing maximum. “Valid legacy” uses the current loader's effective behavior, not a newly imposed custom-edit limit.

Strict custom parser accepts a complete base-10 integer string (optional surrounding whitespace); reject fractions, suffixes, exponent notation, NaN/Infinity, negative and out-of-range values. Preserve rejected strings through the existing unknown map. Generated values serialize as ordinary decimal integers.

For a genuinely changed explicit numeric height `h`:

- Compute nearest fixed index `round(h / 22) - 1`, clamped to 0–8 for SoundLayer or 0–9 for Track. Positive half-way values round upward.
- Store this integer as heightIndex.
- If `h` equals one of that type's presets, omit customHeight; otherwise store `h`.
- Remove any old opaque customHeight attribute.
- Compare effective current height before normalization: a request at the same effective value is a no-op, preserving opaque/legacy representation. This also prevents an unmoved drag from rewriting data.

For reset, resolve that target's group default in main. Set its legacy index and clear custom state only when its effective height changes. Existing valid imported defaults can exceed the numeric-edit range; resetting them restores their legacy size. Invalid defaults resolve to 22 for rendering/reset and remain untouched until the separate default-edit action.

Examples:

| Request/type | heightIndex | customHeight | Effective height |
| --- | --- | --- | --- |
| 57 / either | 2 | 57 | 57 |
| 55 / either (tie) | 2 | 55 | 55 |
| 66 / either | 2 | absent | 66 |
| 220 / SoundLayer | 8 | 220 | 220 |
| 220 / Track | 9 | absent | 220 |
| 660 / SoundLayer | 8 | 660 | 660 |
| Untouched legacy SoundLayer index 40 | 40 | absent | 902 |
| Legacy Track index 40 on load | 9 (existing clamp) | absent | 220 |

XML examples (attributes shown only; existing children remain intact):

```xml
<soundLayer name="Layer 1" muted="false" solo="false" heightIndex="2" customHeight="57" />
<track name="Track 1" muted="false" solo="false" heightIndex="9" customHeight="333" uniqueId="existing-id" />
```

SoundLayer load/save lives in `sound-objects/poly-object.ts`; Track load/save lives in `score/track/track.ts`. Copy constructors, deep copies, library/project copies, frozen payloads where applicable, and BlueData historyCopy must carry custom state and unknown maps. No extra UUID, serialized view ID, or schema version is introduced. Java-supported SoundLayers display the fallback; Java saves omit customHeight. Electron Tracks remain in their existing format.

## 2. Group creation default

**Owners:** existing PolyObject/TrackLayerGroup models and their existing `.blue` defaultHeightIndex field.

- New edits choose indices 0–8 for PolyObject and 0–9 for Track.
- Changing a default affects subsequent `newLayerAt` calls only.
- Apply Default to Group uses the aggregate layer-height patch with `height: 'default'`, changing existing direct rows without changing the default.
- Snapshot PolyObject gains `defaultHeightIndex`; Track retains its existing field. The snapshot does not invent a separate custom/default profile object.
- ProgramSettings continues to initialize new project groups as it does now; this feature does not edit or duplicate that store.

## 3. Target identity and scope

Each command target includes `groupId`, `layerIndex`, and required `layerSelectionId`. The latter is the existing process-session stable identity transferred across history copies, not the positional `layerId` and not a new XML field. Main validates index and identity together; reorder/replacement must not redirect the operation. Group IDs use existing identity helpers (Track uniqueId or assigned PolyObject ID).

`scopeGroupId: null` means direct groups at the root score. A non-null value identifies the currently opened PolyObject score view, and all targets must belong directly to that group. It may identify a root PolyObject opened in its own view as well as a nested PolyObject. Nested traversal uses the existing reachable-group resolver with cycle protection; group operations never traverse into child object rows.

Selection remains owned by the existing layer-selection store. Target arrays are captured from selection/scope, but commit does not replace layer selection, object selection, or MIDI focus. Pattern targets are invalid for the entire aggregate action.

## 4. Resize preview

**Owner:** one ScorePanel instance in its hosting renderer context.

| Field | Lifetime/use |
| --- | --- |
| documentId, sessionId, expectedRevision | Fence the originating canonical document/version. |
| scopeGroupId, scopeKey | Identify the root/opened score view. |
| targets and originalOrder | Stable identity/index pairs fixed for the gesture. |
| originalHeights | Baseline effective values; never accumulated from previous previews. |
| startClientY, pointerId, hostDocument | Pointer ownership and logical-coordinate baseline. |
| proposedHeights | Derived local values, never canonical project content. |
| operationId | Allocated once at commit; reused only for uncertain transport retry. |

`delta = round(currentClientY - startClientY)`; each target height is `clamp(originalHeight + delta, 22, 660)`. A zero-motion gesture keeps original values even for out-of-range legacy heights; entering a real resize applies the edit bounds. Returning to the original pointer position restores original values and is a no-op on release. This explicit rule prevents a click on a 902-pixel legacy row from shrinking it to 660.

No physical-pixel conversion or horizontal time scaling enters this calculation. During a drag wheel scroll/zoom is suppressed; external scroll/zoom/host changes cancel. Display groups are shallow projections with shared unchanged content and are fed to all visual/hit-test consumers.

State transitions:

```text
idle → previewing → awaitingCommit → idle
          ↓               ↓
       cancelled       failed/stale → canonical refresh → idle
```

- Idle → previewing: eligible scope, primary pointer, stable canonical base; capture target set and pointer.
- Previewing → cancelled: Escape, pointercancel/lost capture, blur, host replacement, unmount, project/path/revision/target-order change, or save/undo settlement. Drop projection; no patch/history/runtime action.
- Previewing → idle: no-op release. Drop projection without normalization.
- Previewing → awaitingCommit: changed release sends one revision-fenced action after checking earlier queue settlement; retain final display projection until canonical acknowledgement/publication.
- AwaitingCommit → idle: committed/unchanged response. Successful pointer release/lost capture must not be treated as cancellation of the submitted operation.
- AwaitingCommit failure: use authoritative refresh. If already committed, show canonical values; do not report a local rollback as undo. Save/undo settlement waits for submitted work rather than discarding it.

## 5. History and runtime

The new patch variants use existing structural mementos. Before/after includes heightIndex, customHeight, opaque XML, defaults, and stable editor identity transfer. Labels distinguish Resize Layer, Resize Selected Layers, Set Layer Height, Set Selected Layer Heights, Set Group Layer Heights, Reset Layer Height(s), Apply Default Layer Height, and Change Default Layer Height. No-op/cancel has no entry; the action's original object/layer selection hints remain intact.

Both height and group-default mutations are cosmetic. Document/save-state revisions advance normally; engine generation, audio content, routing and musical scheduling remain unchanged on commit, undo and redo. No new runtime reconciliation payload is needed.
