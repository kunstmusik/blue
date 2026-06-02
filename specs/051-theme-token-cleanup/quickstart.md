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
