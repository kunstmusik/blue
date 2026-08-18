# Data Model: Layer Selection and Operations

**Feature**: `077-multi-layer-selection`

This model describes transient renderer state and the typed score-operation inputs. None of the
selection entities are serialized into `.blue` project XML.

## Visible Layer Reference

`VisibleLayerRef` is the ordered, active-score-view representation used by selection gestures and
rendering.

| Field | Meaning | Source/lifetime |
|---|---|---|
| `scopeKey` | Active project session and score-path identity | Derived renderer session state |
| `groupId` | Layer-group identity | Canonical score snapshot |
| `groupType` | `patterns`, `track`, or `polyObject` | Canonical score snapshot |
| `layerSelectionId` | Stable-for-session identity used only by selection | Transient snapshot field generated from the in-memory layer object |
| `layerId` | Existing layer/location identity | Canonical snapshot; retained for existing automation/editor contracts |
| `localIndex` | Current index inside the group | Derived from current snapshot |
| `globalIndex` | Position in the flattened visible layer order | Derived from current snapshot |

`layerSelectionId` is distinct from `layerId` because PolyObject/SoundObject snapshots currently
derive `layerId` from the row index. It is regenerated on project reload/session replacement and
therefore does not require XML migration.

## Layer Selection State

| Field | Meaning | Invariant |
|---|---|---|
| `scopeKey` | Score view to which the selection belongs | Selection is cleared when scope changes |
| `selectedKeys` | Set of `groupId + layerSelectionId` keys | Every key must resolve to a current visible layer |
| `anchorKey` | First normal-click or range anchor | Null iff selection is empty |
| `focusKey` | Most recent clicked or keyboard-focused layer | Must be selected after reconciliation |
| `keyboardFocus` | Whether the focused row owns keyboard navigation | Transient UI state; does not affect object selection |

### Selection transitions

1. Normal layer-row selection replaces `selectedKeys` with one key and sets anchor/focus to it.
2. Shift-click or Shift+Arrow resolves the anchor and focused endpoint in `VisibleLayerRef[]` and
   selects the inclusive global range. With no valid anchor, it behaves as a normal selection.
3. Arrow Up/Down changes focus by one visible row. Without Shift it replaces the selection; with
   Shift it extends from the existing anchor. The first/last visible row clamps navigation.
4. Clicking a non-layer surface clears selection. Changing project session or score path clears
   selection; snapshot refresh prunes keys that no longer resolve.
5. Selecting a Pattern layer normally may also set the existing single embedded source-object
   editor target. A multi-layer gesture clears the object editor target while retaining layer
   selection.

## Selected Ranges

`SelectedLayerRange` groups selected visible references by `groupId`:

```text
SelectedLayerRange {
  groupId: string
  groupType: ScoreLayerGroupType
  startIndex: number       // inclusive, current local index
  endIndex: number         // inclusive, current local index
  layerSelectionIds: string[]
  count: number
}
```

Cross-group selection produces one range per affected group. The endpoint groups may be partial;
intermediate groups are complete. Ranges are non-overlapping and ordered by visible group order.

## Operation Availability

`LayerOperationAvailability` is derived, never persisted:

| Command | Enabled when | Disabled reason |
|---|---|---|
| Add Above/Below | Exactly one selected layer | Hidden for zero or multiple selection |
| Push Up | Exactly one group selected and `startIndex > 0` | `selection-spans-groups`, `at-group-start`, or `no-selection` |
| Push Down | Exactly one group selected and `endIndex < group.layerCount - 1` | `selection-spans-groups`, `at-group-end`, or `no-selection` |
| Remove | At least one selected layer | `no-selection` |

Push commands remain visible when disabled. The UI exposes the reason through the menu item’s
accessible description/tooltip. Add commands are omitted for multi-selection per the clarified
Java-parity rule.

## Removal Confirmation Plan

`LayerRemovalPlan` is computed before showing the dialog:

```text
LayerRemovalPlan {
  ranges: SelectedLayerRange[]
  totalLayerCount: number
  emptyGroupIds: string[]
  deleteEmptyLayerGroups: boolean // default true when emptyGroupIds is non-empty
}
```

Confirmation is cancelled without mutation. Confirmation submits one grouped patch. Applying the
patch removes each group’s ranges in descending local-index order, then removes empty groups only
if the option is enabled. No layer is copied into another group.

## Canonical Mutation State Transitions

### Push range

`selected range → moveLayerRange patch → canonical group range mutation → snapshot refresh → same
selection keys reconcile to moved layer objects`.

The range methods move the neighboring layer around the selected block, preserving the selected
block’s internal order. A boundary request is rejected/no-op and leaves selection unchanged.

### Remove ranges

`selected ranges → confirmation → removeLayerRanges patch → descending group-local removals →
optional empty-group removal → canonical snapshot → removed keys pruned`.

### Add single layer

`one selected layer → Add Above/Below → existing addLayer insertion semantics → snapshot refresh`.
The new layer does not broaden the selection into a multi-layer editor target.

## Compatibility Invariants

- Object selection, Pattern source editor target, and Track MIDI focus remain separate state
  domains.
- Existing object movement/clipboard compatibility rules remain unchanged; layer selection does
  not authorize an incompatible object move.
- Selection changes alone never mark canonical project data dirty or alter `.blue` XML.
- Canonical layer mutation still flows through `ProjectDocumentPatch` and the main-owned BlueData
  document.
