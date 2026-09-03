# Contract: Layer and Clip Color Document Bridge

## Purpose

This contract keeps `BlueData` and `.blue` XML authoritative while allowing renderer snapshots and edit intents to support layer colors, creation defaults, atomic recoloring, and score-color undo/redo.

## Snapshot contract

Every `ScoreLayerSnapshot` variant includes:

```ts
backgroundColor: number;
```

The field is required and contains a finite signed 32-bit opaque ARGB value. Legacy fallback is resolved before snapshot creation; the renderer never receives `undefined` as a layer color.

Every colorable item snapshot continues to contain a concrete item color.

## Layer update contract

`updateLayerState` accepts the existing layer target plus a partial patch extended with:

```ts
backgroundColor?: number;
```

Meaning:

- Absent: do not change layer color.
- Present and valid: normalize to opaque signed ARGB and update only the layer.
- Present and invalid: reject without mutation.

This operation never recolors existing items.

## Add-item contract

An add request may omit `backgroundColor` only to request the destination default for a genuinely new item.

| Request origin | Missing transport color means |
|---|---|
| New score object/clip | Copy resolved destination layer color |
| Serialized XML restore/import | Preserve color reified from XML |
| Copy/duplicate/source target | Preserve source object's concrete color |
| Move | Not an add default; preserve existing object color |

An explicit transport color always wins. Callers must not erase a source or serialized color merely to trigger layer defaulting.

The canonical handler resolves the destination layer at execution time, so a queued creation cannot depend solely on a stale renderer snapshot.

## Atomic recolor contract

Add one score patch variant:

```ts
{
  type: "setScoreObjectBackgroundColors";
  updates: Array<{
    target: ScoreObjectEditorTarget;
    backgroundColor: number;
  }>;
}
```

Processing rules:

1. Resolve and validate the full update set without mutation.
2. Reject duplicate, missing, unsupported, or invalid targets/colors.
3. Apply all normalized values only after validation succeeds.
4. Return/propagate the existing project revision semantics once for the patch.
5. Mirror the complete update set in one optimistic reducer action.

An empty update set is a successful no-op. It does not create a history entry.

This target form must support regular score objects, Track items, and Pattern source objects. Library or Blue Live objects are outside the project score scope and are rejected.

## User-command mapping

### Set to Layer Color

For each selected colorable project item, the renderer resolves its containing layer snapshot and produces one update with that layer's color. A selection may span layers, so update colors may differ.

### Apply Layer Color to All Clips

The renderer enumerates all colorable items owned by the invoked layer and produces one update per item using that layer's current color. Other layers are excluded.

Both commands capture inverse updates before submission and generate one history entry.

## Undo/redo contract

Layer-color history is a bounded renderer concern. Each entry contains exactly one forward and one inverse document patch:

- Layer picker gesture: paired `updateLayerState` patches.
- Selection or whole-layer application: paired `setScoreObjectBackgroundColors` patches.

Before undo or redo, pending document patches are flushed. History movement occurs only in coordination with submitting the corresponding canonical patch. Project replacement/revert clears the stack. Structural score mutations that invalidate target identity also clear the stack unless target validity can be guaranteed.

The score toolbar owns these controls. Electron native text-edit undo/redo behavior remains unchanged.

## Picker interaction contract

`ColorPickerButton` keeps its existing `onChange(color)` callback and gains an optional gesture-completion callback. The callback fires once when an open picker closes, with the opening and final colors, and only records history if they differ.

Keyboard access, accessible naming, host-window portal placement, dismissal, and floated-panel operation follow the existing picker and popout conventions.

## Failure and refresh behavior

- Invalid layer-color patch: no canonical mutation; restore/refresh authoritative state through existing patch-queue error handling.
- Invalid multi-target patch: no target mutation; optimistic state must be reconciled from the canonical snapshot.
- Patch revision conflict: use existing retry/refresh semantics, never partially apply locally.
- Undo/redo target no longer valid: do not partially apply; clear or reconcile the unsafe history entry after authoritative refresh.

## Compatibility contract

- Existing item colors are preserved exactly on load and through copy/import/move paths.
- Saving materializes valid layer colors, including neutral fallback for legacy files.
- Java Blue may ignore/drop layer color children but continues to read concrete item colors.
- Electron reopening a Java-resaved project restores neutral layer defaults without modifying item colors.
