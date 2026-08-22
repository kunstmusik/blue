# Quickstart: Verify Stable Tree Drag and Drop

Run commands from the repository root with the checked-in pnpm version.

## Automated verification

```sh
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/tree-dnd-domain.test.tsx src/renderer/tests/workbench-auxiliary.test.ts src/renderer/tests/workbench-store.test.ts src/renderer/tests/workbench-layout-persistence.test.ts
pnpm --filter @blue/app exec vitest run --config vitest.browser.config.ts src/renderer/browser/tree-dnd-coexistence.browser.test.tsx src/renderer/browser/workbench-tree-movement.browser.test.tsx
pnpm --filter @blue/app test
pnpm --filter @blue/app build:renderer
pnpm lint
pnpm test
git diff --check
```

Expected outcomes:

- Multi-tree browser tests mount real Arborist trees with no competing-backend exception.
- The same-document fixture observes one shared manager; an iframe/popout-document fixture observes a different manager.
- Moving Libraries among all three edges retains the same live File Manager panel/session object and does not repeat File Manager root loading.
- Introducing a raw Arborist `Tree` beside `BlueTree`, or restoring full runtime panel clearing, makes the focused regressions fail.
- Existing stored-layout migration and restoration tests remain green without changing envelope version 7.

## Manual Electron matrix

Start the app:

```sh
pnpm --filter @blue/app run dev
```

### 1. Populated Libraries and File Manager

1. Open Libraries and File Manager and expand at least two File Manager directories.
2. Select a library item and a File Manager row; scroll File Manager away from the top.
3. Move Libraries to Left, then Bottom, then Right. Repeat the three-edge sequence until 20 moves have completed.
4. After every move, verify there is no `Cannot have two HTML5 backends at the same time` toast/error boundary, both panels still render, File Manager retains its expansion/selection/scroll state, and Libraries remains populated.

### 2. Tree coexistence cycles

With File Manager still open, repeat each pair for 10 open/close cycles:

- Open Code Repository, expand a group, rename a disposable test snippet, and move it within the repository.
- Open a Blue Synth Builder instrument, open Presets Manager, expand folders, and move a disposable preset.
- Open Effects Library where available, select/rename/move a disposable effect entry.

Verify File Manager remains usable and each drag is handled once by its intended tree.

### 3. Unaffected session preservation

1. Leave a focused control, expanded path, and non-zero scroll offset in an auxiliary panel that will not move.
2. Move a different panel or group among edges, including while another group is minimized, slideout-open, and maximized.
3. Verify the unaffected panel does not flash through loading, repeat its initial host request, lose its expansion/scroll state, or change presentation/size.

### 4. Active drag interruption

1. Begin dragging a Code Repository or Presets Manager row and, before dropping, attempt a panel move from another available command path.
2. Verify the move is deferred/cancelled, the previous layout remains usable, and the next ordinary drag and panel move both work.
3. Repeat while a tree is loading and while closing a tree modal.

### 5. Independent documents

1. Float/pop out a panel containing a participating tree while another participating tree remains in the main window.
2. Exercise selection and supported drags in both windows.
3. Close the popout during or immediately after a drag, then verify the main-window tree continues to work and can be moved without an ownership error.

### 6. Stored layout compatibility

Restore saved layouts containing left/right/bottom auxiliary groups in docked, minimized, slideout, maximized, derived-singleton, and seeded-group states. Verify placement and sizes match the prior semantics and no layout reset or migration prompt appears.

## Documentation check

Verify `docs/tree-drag-and-drop.md` records the per-`Document` ownership rule, `BlueTree` integration path, native Libraries disposition, runtime transition/full-apply distinction, and required regression commands.
