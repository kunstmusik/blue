# Quickstart: Render to Disk and ScoreObject Freezing Parity

## Prerequisites

1. Build dependencies are installed with the repository's package manager.
2. A Csound executable is available, or the Program Disk Render and Program Utility executable settings point to valid commands.
3. Use a saved `.blue` project with at least one ordinary SoundObject and a valid orchestra/score setup.
4. For Freeze tests, the project directory must be writable.

## Automated checks

Run focused pure-data and app tests first:

```sh
pnpm --filter @blue/data test -- frozen-sound-object audio-file-metadata blue-data-csd-disk
pnpm --filter @blue/app test -- disk-render-command render-to-disk freeze-score-objects render-freeze-contract
```

Then run the repository checks:

```sh
pnpm test
pnpm lint
```

## Scenario 1: Normal Render to Disk

1. Open a saved project and configure Program Disk Render with a known executable, WAV, and SHORT sample format.
2. Set project disk properties to a recognizable sample rate/channel count and set a project output filename or enable `askOnRender`.
3. Invoke File → Render to Disk.
4. Confirm the status reaches rendering and completion without blocking the renderer.
5. Confirm the output exists at the exact selected path and is playable.
6. Repeat with `diskAlwaysRenderEntireProject` enabled and verify the generated disk CSD uses project time zero/full-project window.

## Scenario 2: Settings-layer provenance

1. Change only Program Disk Render's executable, format, or `-K`/`-Z`/`-R`/`-d` setting and confirm normal disk command construction changes.
2. Change only project disk sample rate, ksmps, channels, 0dbfs, message flags, output path, or advanced override and confirm the project CSD/command changes while program preferences remain unchanged.
3. Enable `diskCompleteOverride` and confirm normal Program Disk Render flags are not merged into the project command.
4. Change only Program Utility's executable or freeze flags and confirm Freeze changes while ordinary Render to Disk settings do not.

## Scenario 3: Freeze and unfreeze

1. With a saved project, select a supported SoundObject and invoke Freeze/Unfreeze ScoreObjects.
2. Confirm non-macOS produces `freeze0.wav`; on macOS confirm `freeze0.aif`.
3. Confirm the score bar becomes a FrozenSoundObject and the project remains dirty until saved.
4. Save, close, reopen, and verify the frozen object still contains its relative filename and nested source.
5. Invoke Freeze/Unfreeze again and confirm the original object returns to the same layer and start time.
6. Repeat with two frozen objects sharing a filename and verify the file is deleted only after the final reference is unfrozen.

## Scenario 4: Failure and cancellation

1. Point the relevant executable at a missing command and confirm the operation fails without replacing the source object.
2. Cancel an active render and confirm the operation reports cancelled and no incomplete FrozenSoundObject is committed.
3. Remove or rename a freeze artifact before unfreezing and confirm the nested source remains recoverable and the error is actionable.
4. Use an output path containing spaces and verify both normal rendering and Render-and-Play/Open preserve it.

## Java comparison checklist

- Compare generated normal disk command options with `DiskRenderSettings.getCommandLine()` and `RenderToDiskUtility.getDiskCommandLine()`.
- Compare Freeze artifact naming with `FreezeUnfreezeAction.getAvailableFreezeFileName()`.
- Compare Utility defaults with `UtilitySettings` (`-Wdo` non-macOS, `-Ado` macOS).
- Compare frozen XML fields and generated playback notes with `FrozenSoundObject.java`.

## Completion validation (2026-07-11)

- `pnpm test`: PASS. `@blue/data` reported 1,248 passing tests; `@blue/app` reported 1,803 passing and 2 skipped tests; engine-client, CLI, and Java runtime suites also passed.
- `pnpm lint`: PASS. Every configured workspace lint/validation script completed.
- `pnpm build`: PASS. Data, engine client, CLI, Java runtime, Electron main/preload, and production renderer builds completed.
- Focused acceptance coverage confirms every disk file/sample format, settings-layer separation, complete override output discovery, paths containing spaces, full-project render selection, Csound progress, cancellation/spawn/nonzero/missing-output failures, platform freeze naming and format validation, collision avoidance, shared runtime contexts, atomic multi-object replacement, missing-artifact recovery, recursive shared-reference deletion, save/reopen persistence, Frozen editor/bar integration, and mono/stereo waveform geometry.
- Iterative user acceptance in Electron confirmed multi-object freeze/unfreeze, missing-artifact recovery, measured frozen duration, settled progress toasts, Frozen editor/bar replacement, and AIFF stereo waveform display. No unresolved Java parity deviation was observed.

Expected non-failing test-environment messages are limited to the existing jsdom canvas warning, the intentional nonexistent-command failure fixture, Node deprecation/experimental warnings, the pnpm workspace-settings warning, and the existing renderer chunk-size warning.
