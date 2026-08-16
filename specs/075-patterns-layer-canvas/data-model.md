# Data Model: Patterns Layer-Group Canvas

## Canonical model

`@blue/data` already models the feature correctly:

```text
PatternsLayerGroup
  patternBeatsLength: number
  PatternLayer[]
    name / muted / solo
    soundObject: SoundObject
    patternData: boolean[]
```

There is no canonical `PatternOccurrence` entity. An active cell is a boolean generator switch. Its generated notes come from the row’s one embedded source object and are repeated at `cellIndex * patternBeatsLength`.

## Renderer snapshot

```ts
interface PatternSourceObjectSnapshot {
  objectId: string;
  objectType: string;
  name: string;
  backgroundColor: number;
  editorTarget: ScoreObjectEditorTargetSnapshot;
  serializedXml?: string;
  barRenderer: ScoreObjectBarRendererSnapshot;
}

interface PatternLayerSnapshot extends ScoreLayerSnapshot {
  items: []; // Pattern rows are not ordinary timeline-object rows.
  sourceObject: PatternSourceObjectSnapshot;
  activeCellIndices: number[]; // sorted, non-negative true cells only
}

interface PatternsLayerGroupSnapshot {
  groupId: string;
  groupType: 'patterns';
  name: string;
  layerCount: number;
  isOpenableContainer: false;
  patternBeatsLength: number;          // raw canonical value
  effectivePatternBeatsLength: number; // positive display fallback
  layers: PatternLayerSnapshot[];
}
```

`activeCellIndices` intentionally omits inactive trailing `PatternData` capacity. Stable group, row, and source IDs are used for source-target resolution; no cell selection ID is created.

## Editor target

```ts
interface PatternSourceObjectLocationRef {
  groupId: string;
  layerId: string;
  sourceObjectId: string;
}
```

The source object’s `ScoreObjectEditorTargetSnapshot` carries this reference in `patternSource`. The existing editor panel can therefore load and patch the embedded object after a row-header click, while ordinary timeline add/move/remove handlers continue to reject pattern-owned targets.

## Patch contract

```ts
interface PatternCellEdit {
  layerId: string;
  cellIndex: number;
  active: boolean;
}

type PatternScorePatch =
  | { type: 'updatePatternCells'; groupId: string; changes: readonly PatternCellEdit[] }
  | { type: 'updatePatternBeatsLength'; groupId: string; patternBeatsLength: number };
```

`updatePatternCells` validates the whole list before mutation. Duplicate row/cell writes resolve in patch order. Active writes may grow `PatternData`; inactive writes do not create trailing content. The renderer uses this patch for paint and cell-targeted context commands.

`updatePatternBeatsLength` remains a separate validated group-level operation. The grid does not expose occurrence edge resize because all cells share this one value.

## Derived grid geometry

```text
pixelX = beat * pixelsPerBeat
beat = pixelX / pixelsPerBeat
cellIndex = floor(max(0, beat) / effectivePatternBeatsLength)
cellLeft = cellIndex * effectivePatternBeatsLength * pixelsPerBeat
cellWidth = effectivePatternBeatsLength * pixelsPerBeat
```

Invalid scales use a positive renderer fallback. Invalid raw step length is displayed with a positive effective fallback but remains unchanged in canonical data.

## Transient renderer state

| State | Meaning | Persistence |
| --- | --- | --- |
| `PatternClipboardShape` | Relative row/cell shape for cell paste | Renderer session only |
| `contextTarget` | Right-clicked row/cell | Renderer session only |
| `PaintGesture` | Pressed row, write mode, last cell, pending edits | Renderer session only |
| Source selection | One embedded source target selected by header | Renderer session only |
| Playhead | Shared playback beat pointer | Playback session only |

No transient state is serialized into `.blue`.
