# Quickstart: Centralized Renderer Theming

Use this checklist after implementation to validate the theming migration.

## 1. Verify Theme Source

1. Open `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/styles/index.css`.
2. Confirm the `@theme` block contains the canonical `app-*` roles and any temporary `blue-*` aliases.
3. Confirm `--color-blue-text` and any other still-used aliases resolve to canonical roles.

## 2. Run Static Audit

Run `pnpm audit:renderer-theme`. It must report:

- `unapprovedArbitraryUtilities: 0`
- `unapprovedRawCssColors: 0`
- `unapprovedStaticInlineColors: 0`
- `undefinedThemeAliases: 0`

If an exception remains, verify it is listed with path, value, kind, reason, owner surface, and revisit status.

## 3. Build and Test

```bash
pnpm --filter @blue/app build
pnpm --filter @blue/app test
```

If the implementation only touches a focused renderer slice, a targeted Vitest command may be run first, but the package build is required before closeout.

## 4. Visual Smoke Checks

Inspect these surfaces in the app or with targeted renderer/browser tests:

- Settings window
- Main toolbar and workbench shell
- Dockview tabs and auxiliary rails
- Context menus
- Selected code editor
- Score panel and ruler/dialog surfaces
- Mixer and output panels
- BSB interface and property sheet
- Blue Live panel
- Effect editor and modal surfaces

## 5. Single-Role Change Probe

Temporarily change one representative app surface role in the theme definition and rebuild. Verify at least four independent surfaces consume the changed role without local component edits. Revert the probe before closeout.

## 6. Handoff

Update `/Users/stevenyi/work/blue-electron/STATUS.md` and the feature `status.md` with:

- Final audit summary.
- Surfaces completed.
- Approved exceptions.
- Validation commands and results.

## 7. Closeout Results

Closeout validation on 2026-06-02:

- `pnpm audit:renderer-theme` - pass (`0` unapproved arbitrary utilities, `0` raw CSS colors, `0` static inline colors, `0` undefined aliases, `31` approved exceptions)
- `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/settings-window.test.tsx src/renderer/tests/workbench-auxiliary.test.ts src/renderer/tests/auxiliary-slideout.test.tsx src/renderer/tests/effects-library-modal.test.tsx src/renderer/tests/effect-editor-window.test.tsx src/renderer/tests/blue-live-panels.test.tsx src/renderer/tests/score-panel-session-reset.test.tsx src/renderer/tests/tempo-map-modal.test.tsx src/renderer/tests/meter-map-modal.test.tsx src/renderer/tests/mixer-panel.test.tsx src/renderer/tests/bsb-interface-editor.test.tsx src/renderer/tests/csound-editor-parity.test.ts src/renderer/tests/app.test.ts src/renderer/tests/tempo-line-view.test.tsx --browser.enabled=false` - pass (`14` files, `202` passed, `2` skipped)
- `pnpm --filter @blue/app build:renderer` - pass
- `pnpm --filter @blue/app test` - pass (`127` files, `1338` passed, `2` skipped)
- `pnpm --filter @blue/app build` - pass
- Single-role change probe - pass (temporarily changed `--color-app-surface`, rebuilt the renderer, confirmed the probe color emitted into built CSS utilities, verified shared-role routing through settings navigation, the main toolbar shell, `SelectedCodeEditor` chrome, Blue Live, and tempo-dialog surfaces, then reverted the probe)
- `./.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks` - pass
- `git diff --check` - pass

## 8. Completion Criteria

- All `62` tasks in `tasks.md` are checked off.
- `spec.md` is `Closed`.
- `status.md`, `theme-exceptions.md`, and top-level `STATUS.md` match the shipped implementation.
- The validation commands above pass.
- The quickstart smoke checklist is satisfied by the focused renderer/browser suite plus the completed single-role change probe; an extra in-app visual pass remains optional.
