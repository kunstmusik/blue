# Status: Program Settings Parity

**Date**: 2026-05-19  
**Branch**: `044-program-settings-parity`  
**State**: Closed, validated

## Handoff Summary

Spec 044 is closed. The slice delivered Java Blue program-settings parity across the six active settings panels, a main-process JSON-backed settings store with typed preload access, new-project seeding for the project-owned defaults that exist in the TypeScript app, retained app-specific setting migration/segregation, and a complete usage matrix plus missing-feature report for the remaining unavailable Java workflows.

During closeout, the remaining review findings were fixed rather than documented away: realtime audio/MIDI usage flags now seed new projects, root `PolyObject` layer-height defaults affect newly created layers, realtime option construction preserves `ProjectProperties` parsing semantics for advanced settings and complete override behavior, and the `SoundLayer` array-species bug uncovered by score-object move/remove tests was repaired.

## Artifact Inventory

- `spec.md`: Closed feature spec with the delivered parity scope and no remaining draft markers.
- `plan.md`: Implementation plan used to sequence the settings store, UI, defaults, and usage work.
- `research.md`: Java panel inventory, consumer audit, migration decisions, and missing-feature analysis.
- `data-model.md`: Program settings snapshot, usage matrix, missing-feature dependency, and retained app-setting entities.
- `contracts/program-settings-surface.md`: Settings window, IPC, and usage-matrix contract for the slice.
- `quickstart.md`: Updated validation commands plus the remaining manual smoke scenarios.
- `tasks.md`: Implementation checklist updated to reflect delivered work; all 79 tasks are checked off.
- `missing-feature-report.md`: Final blocked-workflow report aligned with the runtime matrix.
- `status.md`: This handoff summary.

## Delivered Scope

- Added a main-process JSON-backed program settings store with defaults, validation, panel reset, legacy sync, and typed preload IPC.
- Replaced the placeholder Settings surface with the six active Java Blue panels: General, Project Defaults, Playback, Utility, Realtime Render, and Disk Render.
- Applied saved settings to new projects for author, mixer enabled state, root layer-height behavior, score ruler state, snap state/value, SMPTE frame rate, realtime properties, disk properties, and realtime audio/MIDI usage flags.
- Routed realtime option construction through program settings while preserving `ProjectProperties` ownership of advanced-settings tokenization, message flags, and complete-override semantics.
- Hydrated playback defaults from program settings for FPS, follow playback, follow-on-start, and latency correction.
- Preserved and segregated retained app-specific settings rather than turning them into additional Java settings panels.
- Produced a usage matrix covering all active Java settings plus the stale Text Settings resources, with named missing-feature dependencies for unavailable workflows.
- Fixed closeout regressions in `@blue/data` needed to validate the slice: `PolyObject` default layer height now propagates to new layers, `SoundLayer` supports Array-species numeric construction, and stale test setup now uses explicit root score groups where required.

## Key Policy Decisions

- Program settings remain app-wide JSON and are not serialized into `.blue` files except through Java-compatible new-project defaults.
- `projectDefaults.defaultUdoStyle` remains editable but intentionally blocked until UDO/effect creation exists in the TypeScript app.
- Runtime option synthesis keeps `ProjectProperties` as the source of truth for project-owned realtime flags while program settings provide program-level driver/device/display/color defaults.
- Existing app-specific settings such as recent files, window bounds, engine path, and MIDI/OSC placeholders remain outside the six active Java settings panels.

## Validation State

Automated validation completed:

- `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/program-settings-store.test.ts src/main/program-settings-application.test.ts src/main/program-settings-usage.test.ts src/renderer/tests/program-settings-window.test.tsx --browser.enabled=false` — pass
- `pnpm --filter @blue/app test` — pass (`91` files, `980` tests, `2` skipped)
- `pnpm --filter @blue/app build` — pass
- `pnpm --filter @blue/data test -- --maxWorkers=1` — pass (`94` files, `894` tests)
- `./.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks` — pass
- `git diff --check` — pass

## Notes

- `@blue/app` consumes `packages/blue-data/dist`, so rebuilding `@blue/data` remains necessary before rerunning app-side tests after data-layer edits.
- The final usage-matrix distribution is 21 `used-by-workflow`, 33 `used-as-new-project-default`, 19 `blocked-by-missing-feature`, and 1 `resource-only-stale` for 74 classified entries.
- `AGENTS.md` already reflected the SPEC044 technology context and did not require a manual update during closeout.
- Manual Settings-window smoke scenarios were not rerun during the documentation closeout step; the recorded automated coverage and matrix audit are the basis for closure.

## Next Action

Spec 044 can be treated as closed. The highest-value follow-up specs are UDO/effect creation runtime and disk render execution.
