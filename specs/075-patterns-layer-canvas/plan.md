# Implementation Plan: Patterns Layer-Group Canvas

**Branch**: `075-patterns-layer-canvas`
**Date**: 2026-08-15
**Spec**: [spec.md](./spec.md)

## Design correction

The prior implementation flattened active cells into `RenderBar`-like occurrence tiles and gave them selection/move/resize semantics. That design was removed after comparison with Java Blue. The corrected design keeps the data model’s two independent concerns separate:

```text
PatternLayer header ── selects embedded source SoundObject ──> ScoreObjectEditorPanel
PatternLayer canvas ── paints PatternData boolean cells ────> updatePatternCells
Shared ScoreOverlayLines ── draws one playhead over both
```

## Technical context

- TypeScript 5.8 strict mode, React 19, Electron 35.
- `@blue/data` `PatternLayer`, `PatternData`, and `PatternsLayerGroup` remain the canonical generator/model.
- Zustand project, selection, and workbench stores; Radix context menus; existing shared score overlay.
- Existing main-process project-document patch bridge and `.blue` XML persistence.
- Vitest renderer/shared tests plus the existing Chromium browser harness.

## Architecture

### Snapshot and canonical mutation

Keep the course-corrected snapshot and patch contract in `packages/blue-app/src/shared/project-editor.ts`:

- `PatternLayerSnapshot.sourceObject` identifies the one embedded generator object.
- `PatternLayerSnapshot.activeCellIndices` contains only true `PatternData` cells.
- `PatternsLayerGroupSnapshot.patternBeatsLength` retains raw data while `effectivePatternBeatsLength` supplies safe display geometry.
- `ScoreObjectEditorTargetSnapshot.patternSource` resolves source-object editing without pretending the source is a normal timeline item.
- `PatternScorePatch.updatePatternCells` remains the sole renderer-to-main cell mutation.

Optimistic projection stays in `project-store.ts`; it updates active indices immutably and does not create fake score items. Remove occurrence-ID reconciliation and ordinary score-object selection for pattern cells.

### Grid canvas

`PatternsLayerGroupCanvas.tsx` owns only transient grid interaction:

1. map `beat ↔ pixel` with `pixelsPerBeat`;
2. map a point to `floor(beat / effectivePatternBeatsLength)`;
3. render row backgrounds, step boundaries, and active solid blocks;
4. capture the first cell’s write mode and pressed row on mouse down;
5. fill every integer cell between drag positions, ignoring vertical row changes;
6. commit one ordered `updatePatternCells` patch on mouse up;
7. provide cell-targeted Cut/Copy/Paste/Delete/Properties as an additive convenience.

No `RenderBar`, occurrence identity, active-cell selection, move gesture, edge resize, or local cursor is used.

### Pattern row header

Add `PatternLayerHeader.tsx` and branch `ScorePanel`’s left header rendering for `groupType === 'patterns'`.

- Plain click calls `select(sourceObject.objectId, false, sourceObject.editorTarget)` and `openPanel('ScoreObjectEditorTopComponent')`.
- The header renders row/source names, selection state, M/S controls, row rename, and existing layer management commands.
- Properties/Edit Sound Object uses the same source target; shift-click clears the single editor target.
- Header height uses the row snapshot height so left/right scrolling remains aligned.

### Source generation parity

Before `PatternLayer.generateForCSD` asks the embedded source for base notes, set its start to `TimePosition.beats(0)`, matching Java Blue’s template semantics. Active indices still repeat those notes at `index * patternBeatsLength`.

### Playback

Do not change playback ownership. `ScorePanel`/`ScoreOverlayLines` already provide the tempo-aware beat pointer and shared overlay. The pattern canvas only matches shared width/row geometry and does not draw a second playhead.

## Verification plan

1. Pure geometry tests: scale guards, beat/pixel inversion, cell indexing, contiguous ranges, extents, row hit-testing, and clipboard shape mapping.
2. Renderer tests: empty rows, active block geometry, no occurrence/bar labels, zoom scaling, active-to-off and inactive-to-on painting, skipped cells, row-bound drag, and shared overlay alignment.
3. Header tests: source target selection, editor-panel focus, selected styling, shift behavior, and source label/name rendering.
4. Browser tests: deterministic empty/sparse/dense/zoom states, real mouse painting, row binding, playhead alignment, and a 64×256 active-cell render.
5. Data tests: source start normalization, active-cell generation, XML round-trip, and existing malformed/unknown-data preservation.
6. Package verification: affected Vitest suites, `@blue/data` tests, renderer build, main/preload builds, lint, and diff review.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Header and canvas row heights drift | Both use `layer.height || DEFAULT_ROW_HEIGHT`; test row geometry. |
| A source target is mistaken for a timeline item | Keep `patternSource` resolution explicit and keep `items: []`. |
| Drag skips cells or paints another row | Store `layerId` and `lastCellIndex` in the gesture; fill ranges with pure helper tests. |
| Malformed legacy step length writes back accidentally | Separate raw/effective fields and validate only explicit canonical patches. |
| Duplicate playhead or clock drift | Reuse `ScoreOverlayLines`; no pattern-local playback state. |
