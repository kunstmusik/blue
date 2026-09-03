# Data Model: Layer and Clip Colors

## Color value

All layer colors are canonical opaque signed 32-bit ARGB integers.

- Default: `-12566464` (`0xFF404040`, displayed as `#404040`)
- XML: decimal signed integer text in `<backgroundColor>`
- Display: low 24 bits formatted as an RGB/CSS color
- Accepted UI/bridge input: an integer in signed/unsigned 32-bit range; its low 24 bits are normalized to opaque signed ARGB
- Invalid XML input: neutral fallback; project loading continues
- Invalid patch input: reject the whole patch without mutation

Existing score-object color values remain compatible and are not mechanically rewritten by this feature. New layer-derived item values use the canonical opaque form.

## Entities

### Score layer

Implemented by ordinary `SoundLayer`, `Track`, and `PatternLayer`.

| Field | Type | Required | Notes |
|---|---|---:|---|
| stable identity | existing layer ID/address | yes | Used by snapshot and patch targeting |
| `backgroundColor` | signed 32-bit integer | yes | Concrete color; never inherited or nullable in memory |
| existing name/mute/solo/height fields | existing types | varies | Unchanged |

Behavior:

- A newly constructed layer starts neutral dark gray.
- A layer loaded without valid color data starts neutral dark gray.
- Changing the value affects the layer header and future creation defaults only.
- Saving always writes one recognized `<backgroundColor>` child.

### Colorable score item

Existing score objects, audio clips, Track items, and Pattern source objects continue to own a concrete background color.

| Field | Type | Required | Notes |
|---|---|---:|---|
| target identity | `ScoreObjectEditorTarget` or equivalent stable target | yes | Resolves canonical object |
| `backgroundColor` | existing numeric color | yes in model/snapshot | Independent after creation |
| serialized/source payload | existing form | contextual | Its concrete color takes precedence over layer default |

Behavior:

- Genuinely new item + no explicit incoming color: copy destination layer color once.
- Explicit incoming color: preserve it.
- Restored/imported/copied/duplicated item: preserve the object's concrete color.
- Moved item: retain the same color.
- Pattern layer initialization: source object copies the new Pattern layer color.

### Layer snapshot

`ScoreLayerSnapshot` adds required `backgroundColor: number`. All layer snapshot variants expose the field so renderer behavior does not depend on layer kind.

### Layer state patch

`updateLayerState.patch` adds `backgroundColor?: number`. It is optional because the patch updates any subset of layer state. If present, the value is validated and normalized before canonical mutation.

### Add-item intent

Add-item contracts allow `backgroundColor?: number` only where omission can express new-item defaulting.

Precedence rules:

1. An explicit incoming color wins.
2. A serialized, imported, copied, duplicated, or source-reified object retains its concrete model color.
3. Only a genuinely new object without either source form copies the resolved destination layer color.

Callers that transport existing content must include or preserve its concrete color. The optimistic reducer mirrors the same classification; it must not treat every absent transport value as permission to recolor restored data.

### Multi-target recolor patch

```ts
type SetScoreObjectBackgroundColorsPatch = {
  type: "setScoreObjectBackgroundColors";
  updates: Array<{
    target: ScoreObjectEditorTarget;
    backgroundColor: number;
  }>;
};
```

Validation before mutation:

- The update list may be empty as a no-op.
- Every target resolves to a colorable project timeline item or Pattern source object.
- Targets are distinct.
- Every color is a valid integer input.

If any entry fails, the patch returns an error and no item changes. After validation, all updates apply within the single canonical patch operation.

### Score-color history entry

```ts
type ScoreColorHistoryEntry = {
  label: string;
  forward: UpdateLayerStatePatch | SetScoreObjectBackgroundColorsPatch;
  inverse: UpdateLayerStatePatch | SetScoreObjectBackgroundColorsPatch;
};
```

History is renderer-session state, bounded to a small fixed maximum (proposed: 100 entries), and never serialized. The inverse captures concrete prior colors at action time. A no-op is not recorded.

## Relationships

```text
BlueData project
├── layer (owns concrete backgroundColor)
│   └── item(s) (each owns independent concrete backgroundColor)
└── renderer snapshot (required copies of canonical values)
    └── score-color history (disposable forward/inverse edit intents)
```

The relationship from layer color to item color exists only during genuine item creation or an explicit apply command. There is no persistent inheritance edge.

## State transitions

### Layer color edit

1. Capture prior layer color when the picker gesture begins.
2. Submit partial layer-state color patches during preview.
3. On gesture completion, if changed, record one forward/inverse history entry.
4. Future new items copy the current canonical layer color; existing items remain unchanged.

### New item

1. Resolve destination layer in canonical project data.
2. Reify the item from its request.
3. If it is genuinely new and lacks an explicit color, set its color to the destination layer color.
4. Insert and snapshot the item with a concrete color.

### Explicit apply

1. Resolve intended selected targets or all colorable targets on one layer from the current snapshot.
2. Build forward updates using each containing layer's color and inverse updates using each item's prior color.
3. Submit one atomic patch.
4. Record one history entry for the accepted optimistic action.

### Undo/redo

1. Flush pending project edits so patch order is stable.
2. Undo submits the inverse patch, then moves the history cursor.
3. Redo submits the forward patch, then advances the cursor.
4. A failed canonical application refreshes authoritative state and does not silently advance history.

## XML mapping

Each layer's existing element gains exactly one recognized child:

```xml
<backgroundColor>-12566464</backgroundColor>
```

- `SoundLayer`: read/write within `PolyObject` layer serialization.
- `Track`: read/write in Track serialization and exclude the recognized child from unknown-child preservation.
- `PatternLayer`: read/write in Pattern layer serialization.
- Missing child: load neutral, write it on the next save.
- Multiple recognized children: use the parser's established single-value convention and emit only one canonical child on save.
- Malformed child: load neutral and emit the canonical neutral value on save.
