# Quickstart Validation: Audition Selected ScoreObjects

## Prerequisites

- Work from branch `070-audition-scoreobjects`.
- Install the repository’s existing dependencies.
- Have a project with at least two audible score items; include a Track LayerGroup with a Track instrument and an audio clip for Track coverage.

## Automated validation

Run the focused tests added by this feature first, then the affected package checks:

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/main/audition-score-objects.test.ts \
  src/main/application-menu.test.ts \
  src/shared/project-editor.test.ts \
  src/renderer/tests/playback-store.test.ts \
  src/renderer/tests/score-panel-session-reset.test.tsx \
  src/renderer/tests/workbench-store.test.ts \
  src/renderer/tests/use-ipc-listeners.test.tsx
pnpm --filter @blue/data build
pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.main.json
pnpm --filter @blue/app exec tsc --noEmit -p tsconfig.preload.json
pnpm lint
```

Use the repository’s standard build command after focused checks pass.

Expected results:

- Filtering tests show selected conventional-layer objects, Track sound objects, and Track audio clips only.
- Tests verify retained containers are audible despite normal mute/solo state, loop is disabled, selection bounds include mixer tail, and source data is unchanged.
- Menu tests show Cmd+Shift+A on macOS and Ctrl+Shift+A on Windows/Linux through `CmdOrCtrl+Shift+A`.
- IPC/orchestration tests reject stale IDs and do not start the engine on rejection.

The repository does not define package-level `typecheck` or TypeScript `lint`
scripts; the commands above use the existing build/typecheck entry points and
workspace lint script.

## Validation record

Automated validation completed on 2026-08-11:

- `pnpm --filter @blue/app test`: 297 files passed; 2740 tests passed and 2 skipped.
- Main, preload, and renderer production builds passed.
- `pnpm lint` passed.
- `git diff --check` passed.
- Karpathy complexity review found no issue in the new data/orchestration modules; warnings in existing large renderer modules are pre-existing and unrelated to this feature.

T026 remains a manual follow-up because this workspace did not launch the packaged
Electron application or a separate Ctrl-based desktop target.

## Manual validation

1. Open a project with two audible score objects and select only one.
2. Confirm **Project > Audition ScoreObjects** is enabled and displays the platform shortcut; clear the selection and confirm it disables.
3. Trigger the action through the menu, then through Cmd+Shift+A on macOS or Ctrl+Shift+A on Windows/Linux. Confirm only the selected item plays and then stops at its end.
4. Enable project looping, audition again, and confirm the audition does not loop.
5. Put selected and unselected items on muted/soloed Tracks, including one audio clip. Audition the selected mix and confirm selected items are audible, unselected items are absent, and Track instrument/routing remains effective.
6. Stop the audition, then start normal project playback. Confirm normal playback and its loop/mute/solo behavior are unchanged.
7. Delete or change a selected object before invoking the action. Confirm no unrelated playback starts and the project is unchanged.

The automated menu contract runs in this macOS workspace; the same
`CmdOrCtrl+Shift+A` Electron accelerator is the Ctrl+Shift+A mapping on Linux
and Windows. A second desktop target should repeat steps 2–3 when available.
