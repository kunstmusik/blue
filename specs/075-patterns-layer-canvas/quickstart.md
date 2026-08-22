# Quickstart: Patterns Layer-Group Canvas

Run from `/Users/stevenyi/work/blue-electron`.

## Focused tests

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/patterns-layer-group-canvas.test.tsx \
  src/renderer/tests/pattern-layer-header.test.tsx \
  src/renderer/tests/score-selection-store.test.ts

pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/shared/patterns-layer-group-canvas.test.ts

pnpm --filter @blue/data test -- \
  tests/pattern/pattern-data.test.ts \
  tests/pattern/patterns-layer-group.test.ts \
  tests/integration/pattern-layer-roundtrip.test.ts
```

Expected behavior:

- empty rows remain visible;
- active cells are solid grid blocks with no source-object labels or occurrence IDs;
- widths/left edges follow `patternBeatsLength * pixelsPerBeat`;
- an inactive press paints on, an active press paints off, skipped cells are filled, and vertical drag stays on the starting row;
- row-header click selects the embedded source target and focuses `ScoreObjectEditorTopComponent`;
- the shared playhead remains aligned through the rows.

## Browser regression

```bash
pnpm --filter @blue/app exec vitest run \
  --config vitest.browser.config.ts \
  src/renderer/browser/patterns-layer-group-canvas.browser.test.tsx
```

The browser fixture covers empty, sparse, dense, non-default-step, zoomed, shared-playhead, row-bound painting, and 64×256 active-cell states. The repository harness currently uses deterministic DOM/geometry assertions rather than stored screenshot baselines.

## Package verification

```bash
pnpm --filter @blue/app run build:main
pnpm --filter @blue/app run build:preload
pnpm --filter @blue/app run build:renderer
pnpm lint
```

## Manual smoke test

Open a project with a `PatternsLayerGroup` and at least two rows.

1. Confirm the score shows fixed rows, vertical step boundaries, and solid active blocks.
2. Click a row header. The selected embedded SoundObject should appear in the existing editor panel.
3. Drag from an inactive cell across several steps; then drag from an active cell to erase a run. Move vertically while dragging and confirm only the starting row changes.
4. Right-click a cell and verify Cut/Copy/Paste/Delete/Properties operate on cells/source rows, not ordinary score bars.
5. Play the score and verify one cursor crosses all pattern rows at the ruler’s beat position.
6. Save/reload and confirm row state, source-object content, active cells, and CSD generation remain Java-compatible.

## Verification recorded 2026-08-16

- Focused renderer/shared pattern-canvas tests: pass (6 files, 48 tests).
- `pnpm --filter @blue/data test`: pass (166 files, 1,626 tests).
- Chromium browser regression: pass (4 files, 11 tests); required elevated permission because the sandbox blocks the harness's local server bind.
- `build:main`, `build:preload`, `build:renderer`, and `pnpm lint`: pass.
- Manual Electron smoke test: pass, including grid painting, row/source selection, cell context actions, shared playhead, and save/reload behavior.
- Full `pnpm --filter @blue/app test`: 310 files passed (2,878 tests, 2 skipped); 6 Electron-dependent suites could not start because this checkout's ignored `node_modules/electron` artifact is incomplete (`path.txt`/runtime binary missing). The feature-focused suites and all other app suites passed.
- `pnpm verify`: release-workflow, artifact, and credential contract checks pass, but the required `package-inputs` check fails because `packages/blue-app/release-metadata.json` is absent in this working tree. This is packaging metadata/environment state, not a pattern-canvas failure.
