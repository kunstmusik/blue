# Layer Selection Contracts

**Feature**: `077-multi-layer-selection`

These are design-time contracts for the renderer session model and the existing shared score patch
boundary. They are not a new external IPC protocol and they do not persist selection state.

## Snapshot Contract

`ScoreLayerSnapshot` gains a renderer-facing, transient `layerSelectionId` field. Snapshot creators
populate it from the in-memory layer object; it is not written by `BlueData.saveToString()` and is
not used as an existing object-location or automation identity. Existing `layerId` remains intact
for current score-object/editor/automation contracts.

Fallback behavior for old fixtures or partial snapshots: use `layerId` as the selection identity.
Production snapshots must provide `layerSelectionId` so PolyObject reordering does not change the
selection key.

## Renderer Selection Contract

The selection store exposes the following semantic operations:

- `selectSingle(target, visibleLayers)` — replace selection and set anchor/focus.
- `extendTo(target, visibleLayers)` — select the inclusive anchor-to-target visible range.
- `moveFocus(direction, visibleLayers, extend)` — Arrow Up/Down navigation, optionally extending
  from the anchor.
- `clear()` — remove selected keys, anchor, and focus.
- `reconcile(scopeKey, visibleLayers)` — prune missing keys and clear invalid anchors/focus.
- `isSelected(target)` — read-only styling query.

The store never calls the document bridge and never owns object editor targets or MIDI focus.

## Score Patch Contract

The shared `ScorePatch` union adds these atomic variants:

```text
moveLayerRange {
  type: "moveLayerRange"
  groupId: string
  startIndex: number       // inclusive
  endIndex: number         // inclusive
  targetIndex: number      // insertion index after removing the selected block
}

removeLayerRanges {
  type: "removeLayerRanges"
  ranges: Array<{
    groupId: string
    startIndex: number      // inclusive
    endIndex: number        // inclusive
  }>
  deleteEmptyLayerGroups: boolean
}
```

Application rules:

1. `moveLayerRange` accepts exactly one group and moves the inclusive block to `targetIndex`. It
   returns no mutation for invalid indices, an empty range, an invalid target, or a target equal to
   the current start index.
2. `removeLayerRanges` validates all ranges, removes each group’s ranges from highest local index
   to lowest, and optionally removes groups that are empty after removal. It applies as one
   document patch; invalid ranges must not cause a partial cross-group mutation.
3. Both operations retain layer order within the selected block and never transfer a layer to a
   different group.
4. Renderer optimistic projection and main-process BlueData application must implement identical
   index and boundary semantics.
5. Existing `addLayer` remains the single-layer insertion contract. Add Above sends the existing
   preceding index; Add Below sends the existing layer index because the canonical handler inserts
   at `patch.layerIndex + 1`.

## Operation Menu Contract

- Add Above/Below: omit when selection count is not one.
- Push Up/Down: always render; disable for no selection, mixed-group selection, or the relevant
  same-group boundary; expose an explanatory accessible reason.
- Remove: enabled for any selected layer and opens one confirmation with total count and the
  default-checked “Delete empty Layer Groups” option when applicable.

Clicking a context-menu trigger outside the current selection replaces selection with that row
before evaluating the menu. Clicking inside the current selection preserves the full selection for
the operation.

## Keyboard Contract

Layer rows are keyboard targets with an exposed selected state:

| Gesture | Meaning |
|---|---|
| Arrow Up / Arrow Down | Select/focus previous or next visible row |
| Shift+Arrow Up / Shift+Arrow Down | Extend from the current anchor |
| Alt+Arrow Up / Alt+Arrow Down | Invoke enabled Push Up/Down |
| Delete / Backspace | Invoke Remove confirmation |

The keyboard path uses the same availability and patch builders as pointer menus. Remove and
Backspace shortcuts apply only when focus is outside editable fields; layer-name inputs retain
normal text editing and do not open Remove confirmation. Row controls (Mute, Solo, Note
Processors, Automation, and Track Instrument) stop propagation and retain their existing action
behavior.

## Failure and Recovery Contract

- A cancelled confirmation submits no patch.
- A rejected/no-op canonical patch leaves the current project unchanged; the next canonical
  snapshot reconciles selection against actual layer identities.
- A project-session or score-path change clears the transient store.
- Selection-only changes do not call the document bridge, increment project revision, or dirty the
  `.blue` document.
