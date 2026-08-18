# Quickstart Validation: Multi-Layer Selection

**Feature**: `077-multi-layer-selection`
**Branch**: `077-multi-layer-selection`

This guide validates the feature after implementation. It assumes dependencies are installed and
commands run from the repository root.

## Prerequisites

- Check out branch `077-multi-layer-selection`.
- Install the workspace dependencies with the repository’s normal `pnpm` setup.
- Use a score fixture or project containing at least one Pattern group, one Track group, and one
  SoundObject/PolyObject group, with multiple layers in at least two groups.

## Focused Automated Checks

Run the pure selection and patch tests first:

```bash
pnpm --filter @blue/app test -- \
  src/renderer/tests/layer-selection-utils.test.ts \
  src/renderer/tests/layer-selection-store.test.ts \
  src/renderer/tests/pattern-layer-header.test.tsx \
  src/renderer/tests/score-layer-selection.test.tsx \
  src/renderer/tests/score-layer-range-selection.test.tsx \
  src/renderer/tests/score-layer-keyboard-navigation.test.tsx \
  src/renderer/tests/score-layer-operations.test.tsx \
  src/renderer/tests/score-manager-dialog.test.tsx \
  src/renderer/tests/project-store.test.ts \
  src/renderer/tests/score-panel-session-reset.test.tsx \
  src/shared/project-editor-layer-selection.test.ts
```

Expected outcomes:

- Same-group and cross-group ranges select the exact visible rows, including partial endpoint
  groups and complete intermediate groups.
- Normal selection replaces the range; Shift+Arrow follows the same anchor rules as Shift-click;
  empty/outdated anchors and score-path changes reconcile safely.
- Pattern, Track, and SoundObject headers expose the same selected styling; aligned rows retain
  their normal score-area background while exposing selection state accessibly. Pattern source
  selection and Track MIDI focus remain separate.
- Same-group range pushes preserve order and selection identity; mixed-group/boundary pushes are
  visible but disabled with a reason.
- Multi-group removal produces one confirmation-aware patch; descending range removal and the
  optional empty-group deletion are atomic and do not reparent layers.
- Delete/Backspace pressed while editing a layer-name field edits the text and does not open the
  Remove confirmation.

Run the existing browser/layout coverage when the implementation updates aligned timeline rows:

```bash
pnpm --filter @blue/app test -- \
  src/renderer/browser/score-stacked-selection.browser.test.tsx
```

## Main-Process and Build Checks

```bash
pnpm --filter @blue/app build:main
pnpm --filter @blue/app test -- \
  src/main/move-score-objects-guard.test.ts \
  src/shared/project-editor.test.ts \
  src/shared/project-editor-layer-selection.test.ts
```

Expected outcomes:

- The new score patch union type-checks through renderer, main, and shared project-editor code.
- Canonical range operations use existing Blue data group methods and preserve object placement
  guards.
- Existing project-editor and Track movement tests remain green.

## Manual UI Walkthrough

1. Open the prepared multi-group score in the app.
2. Click a Pattern, Track, and SoundObject layer header one at a time. Each selected header should
   have the Pattern-derived accent edge, filled selection background, and stronger label without
   bolding. The aligned score-area row should retain its normal background. Track MIDI focus may
   coexist but must not replace the header highlight.
3. Select a row, Shift-click another row in the same group, then Shift-click across an adjacent
   group. Confirm the exact contiguous visible range is highlighted in the headers while aligned
   timeline rows retain their normal score-area styling.
4. Use Arrow Up/Down and Shift+Arrow to navigate and extend; use Alt+Arrow Up/Down at valid and
   boundary positions; use Delete/Backspace and cancel the confirmation once. Double-click a layer
   name, use Delete and Backspace in the editor, and confirm text editing works without opening
   Remove.
5. Open the context menu inside a selected range and verify operations target the full range. Open
   it outside the range and verify the clicked row becomes the single target.
6. Confirm Push Up/Down moves a same-group block as a unit and leaves it selected. Confirm mixed
   group and top/bottom pushes stay visible but disabled with explanatory reasons.
7. Confirm Add Above/Below appears only for exactly one selected layer.
8. Confirm Remove shows one dialog with the total selected count. When a group would be emptied,
   verify “Delete empty Layer Groups” is present and checked by default; test both checked and
   unchecked outcomes.
9. Change Pattern object selection, Track MIDI focus, and score path independently. Confirm layer
   selection is transient and selection-only actions do not alter saved project data.

## Full Validation Before Handoff

```bash
git diff --check
pnpm test
pnpm lint
```

If the feature remains limited to `@blue/app` and shared score patch behavior, the focused tests,
`build:main`, and the full repository checks above are the required handoff evidence. Any scoped
exception must be recorded in the implementation tasks and reported with the failing command and
reason.

## Current Validation Record

**2026-08-17**

- `git diff --check`: PASS.
- TypeScript syntax parsing of all changed `.ts`/`.tsx` files with the workspace-adjacent TypeScript
  5.9 runtime: PASS.
- Java parity follow-up: Pattern headers render only `layer.name`; unnamed layers remain blank, with
  regression coverage for the absence of fallback/source suffix text.
- Editable-header keyboard guard: Delete/Backspace in layer-name fields does not open Remove, with
  a focused ScorePanel regression covering both keys.
- Manual UI walkthrough: PASS — user confirmed the implemented styling, multi-layer operations,
  and latest Pattern-label/edit-field fixes look correct.
- Vitest, `build:main`, and repository-wide checks: BLOCKED because this checkout has no installed
  dependencies. `pnpm install --offline --frozen-lockfile` reported a missing cached eslint tarball,
  and the online retry could not resolve `registry.npmjs.org` (`ENOTFOUND`). Re-run the focused and
  full commands above after dependencies are available.
