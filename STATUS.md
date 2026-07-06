# Project Status - blue-electron

**Date**: 2026-07-06
**Branch**: `054-window-layout-persistence`
**Current Focus**: Spec 054 Closed

## Summary

Spec 054 is closed. Review findings have been fixed, all tasks are complete, and validation is passing. All 1594 tests pass (149 test files, 2 skipped). The full TypeScript build (`main`, `preload`, `renderer`) compiles clean. Window bounds, workbench layout, and every user-adjustable split location are now persisted in the existing `program-settings.json` file under `appSpecific.windowLayout`.

Key outcomes:
- **Window bounds**: `main`, `settings`, `effect-editor`, and `effect-interface` windows persist normal bounds and display state; restore applies before `show()`.
- **Split persistence**: All user-adjustable splits save controlled-pane pixel sizes with `200px` defaults, plus the documented BSB property-pane Java parity exception at `250px`. `SplitPane` is backward-compatible with legacy ratio-only call sites.
- **Reset Windows**: Window > Reset Windows clears only layout state, resets tracked live windows and workbench state, suppresses stale legacy re-import, and does not prompt for project save/discard.
- **Legacy migration**: `blue-settings.windowBounds` and `blue-workbench-layout` are migrated once into app-wide settings; stale localStorage cannot overwrite newer app-wide values.
- **FR-025**: Round-trip and invalid-value preservation tests confirm all layout persistence flows through `program-settings.json`.

## Current Artifacts

- `.specify/feature.json` points to `specs/054-window-layout-persistence`.
- `specs/054-window-layout-persistence/spec.md` is in Closed status.
- `specs/054-window-layout-persistence/plan.md` captures the implementation plan.
- `specs/054-window-layout-persistence/research.md` captures Java Blue and current Electron findings.
- `specs/054-window-layout-persistence/data-model.md` defines the layout settings entities.
- `specs/054-window-layout-persistence/contracts/window-layout-settings.md` defines the settings, preload, and menu contracts.
- `specs/054-window-layout-persistence/quickstart.md` lists targeted tests, manual smoke scenarios, and implementation notes.
- `specs/054-window-layout-persistence/tasks.md` contains all phases marked complete.
- `specs/054-window-layout-persistence/checklists/requirements.md` remains from the specification quality pass.
- `AGENTS.md` was refreshed by `.specify/scripts/bash/update-agent-context.sh codex` for Spec 054 technology/storage context.

## Key Decisions

- Store canonical layout state under existing app-wide `program-settings.json`, inside `ProgramSettingsSnapshot.appSpecific.windowLayout`.
- Keep `.blue` project XML unchanged; this is application layout state, not project data.
- Persist splits as controlled-pane pixel sizes, not ratios. Side and bottom controlled panes default to `200` px unless a documented Java parity or minimum-size exception is required; the BSB property pane uses Java Blue's `250` px property-side exception.
- Clamp invalid or too-large split values for display only; do not overwrite the saved value solely because the current window is smaller.
- In-scope window identities are `main`, `settings`, `effect-editor`, and `effect-interface`.
- Migrate legacy renderer-only `blue-settings.windowBounds` and `blue-workbench-layout` once, without overwriting newer app-wide layout values.
- Rename and expand Window > `Reset Default Layout` into Window > `Reset Windows`; do not keep both commands.
- `Reset Windows` clears only layout state and must not prompt for project save/discard or mutate project data.
- `window.on`/`removeListener` calls in `window-state-manager.ts` use `.bind()` casts to satisfy Electron's per-event TypeScript overloads while iterating a single event list.

## Validation Performed

- `pnpm --filter @blue/app test` — 1594 passed, 2 skipped (149 test files).
- `pnpm --filter @blue/app build` — clean for Java runtime, `@blue/data`, main, preload, and renderer targets.
- `pnpm lint` — clean.
- `git diff --check` — clean, no whitespace errors.
- Focused layout contract suite — 69 tests passed.
- Focused BSB editor suite — 44 tests passed.
- Round-trip tests for all 4 window identities and 12 split identities: pass.
- Invalid-value preservation tests (bad window-state, bad split, unknown split key): pass.
- Reset preserves unrelated program settings (enginePath, recentFiles, audioDriver): pass.
- Legacy migration idempotence and renderer-to-main migration payload persistence: pass.

## Follow-Up Considerations

- Multiple effect editor/interface instances currently use type-level identities. If stable per-instance owner keys are needed later, update the data model and tasks.
- Legacy localStorage migration crosses renderer and main boundaries; the migration is idempotent and now covered through the renderer-to-main payload path, but first-launch smoke testing is still useful.
- Window bounds validation handles offscreen saved positions before showing windows, but multi-monitor hot-plug scenarios are not explicitly tested.

## Next Recommended Step

Spec 054 can be treated as closed. Future work should use a follow-up spec for per-instance secondary window layout identities or deeper multi-monitor hot-plug behavior. The manual smoke scenarios in `specs/054-window-layout-persistence/quickstart.md` remain available as optional local UI checks.
