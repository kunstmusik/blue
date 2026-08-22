# Tasks: Patterns Layer-Group Canvas

**Branch**: `075-patterns-layer-canvas`
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

The original occurrence-oriented tasks were retired during course correction. Pattern cells are boolean grid data; row headers own source-object selection/editor routing.

## Phase 1 — Java-faithful design and contract

- [X] C001 Read the Java UI/core implementations and record grid, header-selection, and source-generation behavior in `research.md`.
- [X] C002 Rewrite `spec.md`, `plan.md`, `data-model.md`, and `contracts/patterns-layer-group.md` to remove occurrence-bar/move/resize semantics.
- [X] C003 Preserve the existing pattern snapshot, source-target, optimistic projection, and canonical patch bridge in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/renderer/stores/project-store.ts`.
- [X] C004 Remove occurrence-ID selection/pruning and occurrence-specific gesture state from the renderer selection/canvas path.

## Phase 2 — Grid and source-object editor surface

- [X] C005 Reduce `patterns-timeline-utils.ts` to beat/pixel, cell-index, contiguous-range, extent, and row-hit helpers.
- [X] C006 Rewrite `PatternsLayerGroupCanvas.tsx` to render fixed row grids and solid active blocks with no `RenderBar` or source labels.
- [X] C007 Implement Java-compatible row-bound on/off painting and one canonical `updatePatternCells` patch per completed gesture.
- [X] C008 Add cell-targeted Cut/Copy/Paste/Delete/Properties commands without creating ordinary score-object clipboard entries.
- [X] C009 Add `PatternLayerHeader.tsx`, branch `ScorePanel` for pattern headers, and route single-click source selection to `ScoreObjectEditorTopComponent`.
- [X] C010 Restore Java CSD-generation parity by normalizing the embedded source start to beat zero in `PatternLayer.generateForCSD()`.

## Phase 3 — Regression coverage

- [X] C011 Replace occurrence-oriented renderer tests with grid geometry, solid-block, no-label, painting, row-binding, clipboard, and playhead assertions.
- [X] C012 Add row-header tests for source-target selection, editor-panel focus, selected state, and shift behavior.
- [X] C013 Replace the browser regression fixture with empty/sparse/dense/zoomed/shared-playhead/row-bound grid coverage and a 64×256 active-cell render case.
- [X] C014 Add a data-model regression for source start normalization and repeated generated notes.

## Phase 4 — Verification and handoff

- [X] C015 Run focused `@blue/app`, shared project-editor, `@blue/data`, and browser commands from `quickstart.md`.
- [X] C016 Run `build:main`, `build:preload`, `build:renderer`, lint, and relevant full-package tests.
- [X] C017 Run `git diff --check`, inspect the final diff for stale occurrence terminology, and confirm `MISSING_FEATURE_GPT.md` was not modified.
- [X] C018 Record actual verification results and any environment limitation in `quickstart.md`.

## Dependencies

- C001–C004 establish the corrected behavior and remove the conflicting design.
- C005–C010 implement the data-preserving UI on that contract.
- C011–C014 validate each user-visible boundary.
- C015–C018 are final verification and can be performed after implementation tasks.
