# Patterns Layer-Group Contracts

This feature extends the existing project-document snapshot/patch bridge. It adds no IPC channel and no persistence format.

## Snapshot contract

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
  items: [];
  sourceObject: PatternSourceObjectSnapshot;
  activeCellIndices: number[];
}

interface PatternsLayerGroupSnapshot {
  groupId: string;
  groupType: 'patterns';
  name: string;
  layerCount: number;
  isOpenableContainer: false;
  patternBeatsLength: number;
  effectivePatternBeatsLength: number;
  layers: PatternLayerSnapshot[];
}
```

Rules:

- `activeCellIndices` is sorted, unique, non-negative, and contains only true `PatternData` cells.
- `effectivePatternBeatsLength` is finite and positive; it is display-only when raw data is malformed.
- The source editor target carries `patternSource: { groupId, layerId, sourceObjectId }`.
- A pattern row is not flattened into `ScoreRowObjectSnapshot.items`.

## Source-object target resolution

When an existing editor/property flow receives a target with `patternSource`, the main process must find the group, row, and embedded source by all three stable IDs and return that source object. The target is valid for source-object editing and invalid for ordinary score-object placement, movement, removal, conversion, and audition paths.

`PatternLayerHeader` uses this target as follows:

```ts
select(sourceObject.objectId, false, sourceObject.editorTarget);
openPanel('ScoreObjectEditorTopComponent');
```

## Cell patch contract

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

`updatePatternCells` validates the complete list before mutating `PatternData`; duplicate row/cell entries use the last value. It is the canonical operation for grid paint and cell-targeted Cut/Paste/Delete. Active writes may grow the existing boolean array; inactive writes do not create content.

`updatePatternBeatsLength` accepts only finite positive integers and changes only the shared group step length. A valid no-op must not mark the project dirty. A display fallback for malformed raw data must never write back by itself.

## Grid interaction contract

`PatternsLayerGroupCanvas` receives the shared score context (`group`, `totalBeats`, `pixelsPerBeat`, and existing transport/snap props). It must:

- map `pixelX ↔ beat` using `pixelsPerBeat`;
- map `cellIndex = floor(max(0, beat) / effectivePatternBeatsLength)`;
- render one fixed row per `PatternLayer`;
- render active cells as solid blocks with `left = cellIndex * stepWidth` and `width = stepWidth`;
- render vertical step boundaries using the same `stepWidth`;
- capture initial write mode `!isPatternSet(cellIndex)` and the pressed `layerId`;
- fill every integer cell between the previous and current horizontal cell;
- commit one cell patch on mouse-up, including when the pointer leaves the canvas;
- keep the canvas free of source-object labels and `RenderBar` elements.

The shared `ScoreOverlayLines` remains a sibling overlay with `pointer-events: none`; the pattern canvas does not draw or update a local playhead.

## Cell clipboard/context contract

The renderer-only clipboard stores an immutable relative shape:

```ts
{ cells: Array<{ rowOffset: number; cellOffset: number }>; width: number; height: number }
```

Right-clicking a cell supplies the target for Cut, Copy, Paste, Delete, and Properties. Cut copies a cell shape before clearing the targeted active cell. Paste sets mapped destination cells and leaves the clipboard unchanged. Properties selects the target row’s embedded source and opens the existing SoundObject editor. These commands never create ordinary score-object clipboard entries.

## Compatibility

The existing `PatternsLayerGroup`/`PatternLayer` XML remains authoritative. Source-object XML, row state, group step length, active cells, note processors, unknown fields, and CSD generation semantics must remain round-trippable. `PatternLayer.generateForCSD` normalizes the embedded source start to beat zero before generating its template notes, matching Java Blue.
