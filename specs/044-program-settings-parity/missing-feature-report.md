# Missing Feature Report: Program Settings Parity (SPEC 044)

**Generated**: 2026-05-19
**Spec**: 044-program-settings-parity

## Summary

All six active Java Blue settings panels are implemented and editable in the Settings window: General, Project Defaults, Playback, Utility, Realtime Render, and Disk Render. Settings are persisted as app-wide JSON in the Electron user data directory, synced through typed IPC/preload APIs, seed new projects for the project-owned defaults that exist in the TypeScript app, and feed current realtime/playback consumers.

The closeout correction versus the draft report is that `projectDefaults.defaultUdoStyle` is not currently consumed by a live UDO/effect creation workflow. It remains editable, but it is intentionally tracked as a missing-feature dependency rather than counted as an applied new-project default.

## Missing Feature Dependencies

### 1. UDO/Effect Creation Runtime
- **Affected Settings**: `projectDefaults.defaultUdoStyle`
- **Java Workflow**: Java Blue uses the default UDO style when creating new UDOs or effects to set MODERN versus LEGACY behavior.
- **Current Status**: UDO/effect creation in the score editor is not implemented yet, so no current workflow consumes the saved style.
- **Recommended Scope**: Create a UDO/effect-creation spec and seed new UDO/effect instances from the saved default style.

### 2. Disk Render Execution
- **Affected Settings**: `diskRender.csoundExecutable`, `diskRender.fileFormat`, `diskRender.sampleFormat`, `diskRender.savePeakInformation`, `diskRender.ditherOutput`, `diskRender.rewriteHeader`, `diskRender.renderMethod`, `diskRender.externalPlayCommandEnabled`, `diskRender.externalPlayCommand`, `diskRender.externalOpenCommand`
- **Java Workflow**: Java Blue executes Csound to render audio to disk with format/sample/header flags, render-and-play, and render-and-open commands.
- **Current Status**: New-project disk defaults are seeded into `ProjectProperties`, and CSD generation/export exist, but full disk render execution, render-and-play, and render-and-open are not implemented.
- **Recommended Scope**: Create a disk-render-execution spec to implement Csound subprocess invocation for disk rendering with format/sample/header flags, external play/open commands.

### 3. Utility Freeze/Unfreeze
- **Affected Settings**: `utility.csoundExecutable`, `utility.freezeFlags`
- **Java Workflow**: Java Blue uses Utility Csound executable and freeze flags to pre-render SoundObjects to audio files.
- **Current Status**: SoundObject freeze/unfreeze workflow is not implemented.
- **Recommended Scope**: Create a score-utility-freeze spec to implement SoundObject freeze/unfreeze using the Utility Csound executable and freeze flags.

### 4. SoundFont Utility
- **Affected Settings**: `utility.csoundExecutable`
- **Java Workflow**: Java Blue uses the Utility Csound executable for SoundFont file inspection.
- **Current Status**: SoundFont utility is not implemented.
- **Recommended Scope**: Create a soundfont-utility spec if SoundFont inspection is desired.

### 5. Device Discovery and Render Method Selection
- **Affected Settings**: `realtimeRender.renderMethod`
- **Java Workflow**: Java Blue lists audio/MIDI devices and render service factories via NetBeans Lookup.
- **Current Status**: Realtime driver settings use static Java-compatible choice lists, but runtime device discovery and render-method selection are not implemented.
- **Recommended Scope**: Create a device-discovery spec to enumerate audio/MIDI devices and render service factories at runtime, or explicitly keep `renderMethod` unavailable while retaining static driver lists.

### 6. General Work Directory Consumers
- **Affected Settings**: `general.workDirectory`
- **Java Workflow**: Java Blue uses Work Directory as the default start directory for file choosers in import/export flows.
- **Current Status**: No import/export file chooser workflows consume work directory yet.
- **Recommended Scope**: Wire work directory into file chooser defaults as import/export workflows are implemented.

### 7. New User Defaults
- **Affected Settings**: `general.newUserDefaultsEnabled`
- **Java Workflow**: Java Blue inserts default code repository entries for new users.
- **Current Status**: Code repository default insertion workflow is not implemented.
- **Recommended Scope**: Create a code-repository spec if default code repository insertion is desired.

### 8. Csound Error Warning
- **Affected Settings**: `general.csoundErrorWarningEnabled`
- **Java Workflow**: Java Blue's command-line realtime renderer shows a modal warning after Csound exits with an error and points the user to the Csound output dialog.
- **Current Status**: Implemented for terminal and command-level errors reported by TypeScript Blue's realtime `EngineBridge`, including orchestra compile failures; detailed output remains available in the Csound output panel. Alpha marquee drawing is intentionally excluded as a legacy Swing-only presentation option.
- **Recommended Scope**: No follow-up required for the current realtime engine path.

## Stale Resources

- **Text Settings**: Resource bundle strings exist in Java `blue-settings` without an active panel/controller. Classified as `resource-only-stale`. No implementation needed.

## Usage Matrix Status Distribution

| Status | Count |
|--------|-------|
| used-by-workflow | 21 |
| used-as-new-project-default | 33 |
| blocked-by-missing-feature | 19 |
| resource-only-stale | 1 |
| **Total** | **74** |

## What IS Implemented

- All 6 settings panels with every field from Java Blue
- Main-process JSON persistence with validation
- Preload IPC bridge (get/save/reset/usage-matrix/sync-legacy)
- New project default application (author, mixer, score time state, root layer height, realtime properties, disk properties, realtime audio/MIDI usage flags)
- Realtime engine option generation from program settings (message colors, displays, audio/MIDI drivers/devices, buffers, advanced settings, complete-override-safe parsing through `ProjectProperties`)
- Playback store hydration from program settings (follow playback, follow-on-start, latency correction)
- Legacy/current-app setting retention and migration to the main-process store
- Full usage parity matrix with missing-feature tracking
*** Add File: /Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/status.md
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
- Preserved/segregated retained app-specific settings rather than turning them into additional Java settings panels.
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
