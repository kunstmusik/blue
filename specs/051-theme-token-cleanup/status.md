# Status: Centralized Renderer Theming

**Date**: 2026-05-30  
**Branch**: `051-theme-token-cleanup`  
**State**: Automated theme cleanup complete; manual probe and visual smoke follow-up remains

## Summary

Spec 051 now has working implementation infrastructure plus a broad set of completed renderer migration slices across score, orchestra, BSB, project-properties, tracker, and piano-roll surfaces. The latest pass closed the unapproved arbitrary-utility, raw-CSS, static-inline, and undefined-alias buckets entirely, leaving only approved long-lived exceptions plus the manual role-change probe and visual smoke checklist.

The settings subsystem remains on the GPT54 utility-first baseline and still builds cleanly. `SelectedCodeEditor` continues to use theme tokens for app chrome while its syntax palette stays documented as an approved exception class.

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

- `node scripts/audit-renderer-theme.mjs` - pass with `0` unapproved arbitrary utilities, `0` raw CSS colors, `0` static inline colors, `0` undefined aliases, and `31` approved exceptions
- `pnpm --filter @blue/app build:renderer` - pass
- `pnpm --filter @blue/app test` - pass (`127` files, `1335` passed, `2` skipped)
- `pnpm --filter @blue/app build` - pass

## Next Step

Complete the remaining manual closeout tasks: run the single-role change probe from `quickstart.md`, execute the visual smoke checklist, and then update the spec status from in-progress to closed if the manual checks stay clean.
