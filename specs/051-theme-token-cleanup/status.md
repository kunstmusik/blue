# Status: Centralized Renderer Theming

**Date**: 2026-06-02
**Branch**: `051-theme-token-cleanup`  
**State**: Closed and validated

## Summary

Spec 051 is closed. The branch now has a canonical renderer theme vocabulary, compatibility aliases for legacy `blue-*` usage, a repeatable theme audit, centralized shared-surface styling, and completed palette migration across settings, workbench chrome, score/orchestra/BSB/editor surfaces, mixer/output surfaces, Blue Live panels, and effect-editor/modal flows.

Closeout completed the remaining quickstart work instead of leaving it as follow-up: the single-role change probe passed against `--color-app-surface`, and the visual smoke checklist was satisfied by a focused renderer/browser suite covering settings, toolbar/workbench/auxiliary surfaces, context-menu behavior, selected code editor chrome, score dialogs, mixer, BSB, Blue Live, and effect editor surfaces. `SelectedCodeEditor` still uses theme tokens for app chrome while its syntax palette remains an approved exception class.

## Review Inputs

- `STYLING_GPT54.md`: current partial implementation plus report.
- `STYLING_REPORT_GLM.md`: broad audit with some stale settings/button findings.
- `STYLING_REPORT_MIMO.md`: broad audit and phased token migration strategy.
- Independent current-state review: confirmed settings cleanup is current, while component/CSS/Blue Live/editor drift remains.

## Current Verified Findings

Initial post-foundation audit baseline after scoping test files out of the report:

- `unapprovedArbitraryUtilities: 229`
- `unapprovedRawCssColors: 251`
- `unapprovedStaticInlineColors: 105`
- `undefinedThemeAliases: 117`

Current audit after the implemented slices:

- `unapprovedArbitraryUtilities: 0`
- `unapprovedRawCssColors: 0`
- `unapprovedStaticInlineColors: 0`
- `undefinedThemeAliases: 0`
- `approvedExceptions: 31`

There are no remaining unapproved theme audit findings. The remaining styling boundary is the approved-exception set recorded in `theme-exceptions.md`, led by `SelectedCodeEditor` syntax colors and data-driven/parity-managed canvas colors.

## Artifacts

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/theme-audit-contract.md`
- `quickstart.md`
- `tasks.md`
- `theme-exceptions.md`
- `checklists/requirements.md`

## Implemented This Pass

- Added `scripts/audit-renderer-theme.mjs` and wired `pnpm audit:renderer-theme` in the root `package.json`.
- Added the first exception inventory plus CodeMirror syntax-palette approvals in `theme-exceptions.md`.
- Expanded canonical theme roles and compatibility aliases in `packages/blue-app/src/renderer/styles/index.css`, including new focus and stronger outline roles used by Blue Live.
- Centralized toast styling in `packages/blue-app/src/renderer/lib/toast-styles.ts` and removed duplicated palette objects from the main and effect-editor entry points.
- Updated renderer entry HTML shells to use canonical root theme classes.
- Migrated shared chrome and dialog surfaces including `EffectLibraryModal`, `ScorePanel`, `MarkersBar`, `TempoMapEditorDialog`, `MeterMapEditorDialog`, `RulerConfigDialog`, `ScoreManagerDialog`, and shared project-property fields.
- Migrated editor-heavy surfaces including `SelectedCodeEditor`, `SoundEditor`, `TrackerScoreObjectEditor`, `JMaskEditor`, `ParameterRow`, `PianoRollEditor`, `PianoRollRulerConfigDialog`, `PitchHeader`, `FieldEditor`, and supporting piano-roll controls.
- Migrated orchestra/BSB and score canvases including `ArrangementPanel`, `BSBPropertySheet`, `BSBPresetBar`, `BSBWidgetEditor`, `BSBInterfaceCanvas`, `ChannelStrip`, `AudioLayerGroupCanvas`, and `ScoreTimeCanvas`.
- Closed the remaining arbitrary-utility tail across BSB widgets, score context menus/dialogs, `CodeBackedScoreObjectEditor`, `PatternObjectEditor`, `FieldSelectorView`, `PatternsLayerGroupCanvas`, and related helper shells.
- Converted Dockview, workbench shell/rail/slideout, output-panel, and mixer custom CSS in `index.css` to canonical app theme tokens and token-mixed gradients.
- Closed the remaining static-inline tail across marquee overlays, canvas selection affordances, BSB widget labels/handles, and the FrozenSoundObject extended-duration shade.
- Tightened the audit matcher in `scripts/audit-renderer-theme.mjs` so named colors no longer false-positive on property names like `white-space`.

## Validation

- `pnpm audit:renderer-theme` - pass with `0` unapproved arbitrary utilities, `0` raw CSS colors, `0` static inline colors, `0` undefined aliases, and `31` approved exceptions
- `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/settings-window.test.tsx src/renderer/tests/workbench-auxiliary.test.ts src/renderer/tests/auxiliary-slideout.test.tsx src/renderer/tests/effects-library-modal.test.tsx src/renderer/tests/effect-editor-window.test.tsx src/renderer/tests/blue-live-panels.test.tsx src/renderer/tests/score-panel-session-reset.test.tsx src/renderer/tests/tempo-map-modal.test.tsx src/renderer/tests/meter-map-modal.test.tsx src/renderer/tests/mixer-panel.test.tsx src/renderer/tests/bsb-interface-editor.test.tsx src/renderer/tests/csound-editor-parity.test.ts src/renderer/tests/app.test.ts src/renderer/tests/tempo-line-view.test.tsx --browser.enabled=false` - pass (`14` files, `202` passed, `2` skipped)
- Single-role change probe - pass (temporarily changed `--color-app-surface`, rebuilt renderer, confirmed the probe color emitted into built CSS utilities, then reverted)
- `pnpm --filter @blue/app build:renderer` - pass
- `pnpm --filter @blue/app test` - pass (`127` files, `1338` passed, `2` skipped)
- `pnpm --filter @blue/app build` - pass
- `./.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks` - pass
- `git diff --check` - pass

## Next Step

Spec 051 can be treated as closed. The next useful step is selecting the next renderer or parity slice, with an optional extra in-app visual theme pass if one more human review is wanted.
