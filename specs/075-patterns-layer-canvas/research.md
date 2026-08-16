# Research: Patterns Layer-Group Canvas

## Java Blue evidence

The Java implementation was inspected before course-correcting the renderer:

- `blue-score-layers-patterns-ui/.../PatternsLayerPanel.java` sizes the panel from the shared pattern step and draws solid active squares plus vertical step lines. It does not render source-object bars or labels.
- `PatternsLayerPanelMouseListener.java` computes a row and cell from the pointer, captures `setSquareOn = !isPatternSet(index)`, and fills every index between the previous and current cell during a drag.
- `PatternsHeaderListPanel.java` owns row-header selection. A single left click selects the row’s source SoundObject and opens the source-object editor; a shift range clears the one-source selection because multiple rows cannot share one editor target.
- `PatternLayerPanel.java` exposes the embedded source object for editing and keeps row name/mute/solo/layer operations separate from grid painting.
- Java core `PatternLayer.generateForCSD()` sets the embedded source start to beat zero before generating template notes, then repeats those notes at `index * patternBeatsLength`.

Reference roots:

- `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-patterns-ui/src/main/java/blue/score/layers/patterns/ui/`
- `/Users/stevenyi/work/nbprojects/blue/blue-score-layers-patterns-core/src/main/java/blue/score/layers/patterns/core/`

## Decisions

1. Keep `PatternLayerSnapshot.items` empty. A pattern row owns one source object and boolean cell data; active cells are not ordinary timeline objects.
2. Render fixed grid blocks. The source object’s name/color/editor identity belongs in the row header/editor route, not on every active cell.
3. Keep the existing snapshot/patch bridge added for this feature. `activeCellIndices`, raw/effective step length, `patternSource`, and `updatePatternCells` are the right canonical boundary.
4. Add a dedicated `PatternLayerHeader` and route its single-click selection through the existing score selection and workbench stores.
5. Use cell-bound painting as the snap behavior. Fractional positions, per-cell duration, move, resize, occurrence selection, and marquee behavior have no Java/model basis and are removed from this slice.
6. Keep cell context commands as a small additive extension, using a renderer-only relative clipboard shape and canonical boolean-cell patches.
7. Reuse the existing shared `ScoreOverlayLines` playhead; do not add a pattern-local cursor.

## Rejected interpretation

The previous implementation derived `pattern-occurrence:*` IDs, wrapped active cells in `RenderBar`, and gave them move/resize/marquee semantics. That was internally testable but contradicted the Java UI and made the pattern grid look like a collection of independent score objects. It was replaced rather than cosmetically restyled.

## Validation boundaries

- Pure renderer helpers: beat/pixel conversion, cell index, contiguous cell ranges, row hit-testing, extents, clipboard mapping.
- Renderer: fixed block geometry, no source labels/occurrence nodes, on/off painting, row-bound gestures, header source routing, shared playhead.
- Main/shared: source target resolution, atomic pattern patches, optimistic projection, XML round-trip.
- Data: embedded source start normalization and repeated CSD generation.
