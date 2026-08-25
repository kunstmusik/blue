# Quickstart: 089-fix-popout-portals — Validation Guide

Prerequisite: the foundation branch `fix-color-picker` is integrated onto this
feature branch (see research.md R7).

## Automated validation

From repository root:

```sh
# Affected package first
pnpm --filter @blue/app test

# Focused restore/lifecycle coverage
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/renderer/tests/clear-dockview-safely.test.ts \
  src/renderer/tests/workbench-auxiliary.test.ts

# Production renderer/main/preload artifacts
pnpm --filter @blue/app build:renderer

# Changed-file lint + repo audits touched by UI work
pnpm --filter @blue/app exec eslint <changed files>
pnpm audit:renderer-typography

# Repository-wide final lint
pnpm lint

git diff --check
```

Expected: full `@blue/app` suite passes; every new two-document and restore
regression test passes; builds, lint, and whitespace checks are clean. Recorded
evidence after the restart fix: 385 test files, 3,691 passed, 2 skipped.

Mutation spot-checks (development-time evidence, not CI): for one surface per
problem class — Radix portal container, realm-safe containment, host-document
dismissal — temporarily revert the fix and confirm the corresponding test
fails, then restore.

## Two-document regression tests (what they prove)

Each corrected surface family has a test instantiating a second JSDOM realm as
the "popout document" while the component tree renders from the primary
document:

1. **Portal placement** — popup subtree lands inside the second document's
   body; nothing appears in the main document.
2. **Inside-click retention** — a mousedown on a node INSIDE the portaled
   popup (dispatched with the popout realm's constructors) does NOT dismiss it.
3. **Outside dismissal routing** — mousedown/Escape in the popout document
   dismisses; identical events in the main document do not.
4. **Viewport correctness** — position/clamping math uses the popout window's
   viewport dimensions.
5. **Render-nothing safety** — with no real DOM environment, gated surfaces
   render null instead of throwing.

Reference implementation of the harness pattern:
`packages/blue-app/src/renderer/tests/color-picker.test.tsx` (foundation branch).

## Restart persistence regression (P1 lifecycle)

Use a fresh/reset layout because a previous failed startup may already have
saved the fallback docked state.

1. Launch the new build and choose Reset Windows.
2. Open a project/document so the Score surface is active.
3. Float **Score** (not Float Group) and verify the main window retains all
   other editors plus Output.
4. Quit the application normally while Score is still floating.
5. Restart and wait at least 12 seconds, beyond the popout-open guard.
6. Verify one separate native window remains open with exactly one tab:
   **Score**.
7. Verify the main window has Orchestra, Global Orchestra, Global Score,
   Tables, UDOs, Project Properties, Blue Live, and Output, but not Score.
8. Confirm the console has none of these restore failures:
   `invalid operation`, `parentElement`, `innerWidth`,
   `[workbench-restore] popout failed`, or
   `[workbench-restore] layout failed`.
9. Repeat with **Float Group** if exact multi-tab group persistence is under
   review; every and only the saved group tabs must restore in the popout.

Recorded implementation-time evidence used an isolated Electron user-data
directory and CDP inspection: after float → shutdown → restart and a 12-second
wait, `popout.html` contained only Score, `index.html` contained the remaining
editors plus Output, and no restore/Dockview exception was logged. The harness
was diagnostic and is not a committed project dependency.

## Live acceptance (P1 story; deterministic manual check)

1. Launch the app (`pnpm --filter @blue/app dev` or the packaged build).
2. Float the Score panel out of the main window (panel tab context menu →
   float).
3. In the floating Score panel window, right-click a score object on the
   timeline → context menu opens adjacent to the cursor IN THE FLOATING WINDOW;
   choose an action → it applies and the menu closes.
4. Repeat for: layer row header menu, fade-handle submenu, patterns group menu.
5. With a menu open, press Escape → menu closes. Click elsewhere in the
   floating window → menu closes. Interact with the main window → floating
   menu state unaffected.
6. Open Set Color… from the timeline context menu → picker opens, sliders work
   without immediate dismissal, color applies to the object.
7. Float the Score Object Properties panel → change an object's color via the
   swatch → picker usable entirely within the floating window (regression guard
   for the foundation fix).
8. Float any panel containing a line editor → hover shows tooltip clamped to
   the floating window; right-click menu and point editor behave in-window.
9. Re-dock the panel with a menu still open → no orphaned visuals remain in
   either window, console free of errors.
10. Docked-mode sanity: repeat steps 3–5 with panels docked → behavior
    identical to current released behavior.
11. Complete the restart persistence regression above before declaring the P1
    floating workflow complete.

### Final acceptance record

On 2026-08-25, after the final automation-menu event-isolation and Library
portal convergence fixes, the user completed the manual popup interaction and
float→re-dock checks above and reported that everything looked good. No
orphaned overlays or console errors were reported. The automated completion
run also passed all 390 `@blue/app` test files (3,699 tests passed, 2 skipped),
the renderer/main/preload build, repository lint, and `git diff --check`.

## Out-of-scope reminders (do NOT treat as failures of this feature)

- Window-level drag handlers (sliders, splitters) in floated panels — separate
  investigation per spec Assumptions.
- Settings window popups — different window/realm by design.
