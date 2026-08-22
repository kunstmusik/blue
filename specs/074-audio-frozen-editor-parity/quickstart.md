# Quickstart: AudioFile and FrozenSoundObject Editor Detail Parity

## Prerequisites

- Node.js and pnpm versions supported by the repository.
- Dependencies installed from the repository root.
- A test WAV or AIFF file for the native-dialog pass.
- An existing `.blue` project containing an `AudioFile` and, for the second flow, a `FrozenSoundObject` with a valid project-local freeze artifact.

## Focused automated validation

Run the pure metadata and CSD-generation suites:

```bash
pnpm --filter @blue/data exec vitest run src/audio/audio-file-metadata.test.ts src/blue-data-frozen-roundtrip.test.ts src/sound-objects/audio-file.test.ts
```

Run the main-process, renderer, recovery, and routing suites:

```bash
pnpm --filter @blue/app exec vitest run --config vitest.config.ts \
  src/main/score-object-file-operations.test.ts \
  src/main/score-object-editor-document.test.ts \
  src/renderer/tests/file-backed-score-object-editor.test.tsx \
  src/renderer/tests/score-object-editor-contract.test.ts \
  src/renderer/tests/score-object-editor-loading.test.tsx \
  src/renderer/tests/score-object-editor-fallbacks.test.tsx \
  src/renderer/tests/score-object-editor-routing.test.tsx
```

Build the affected Electron layers:

```bash
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
```

## Native AudioFile chooser pass

1. Start the app with the repository's normal development command.
2. Open a project with an `AudioFile` and open its ScoreObject editor.
3. Confirm the path is display-only, the Audio File and Csound views are present, and the valid fixture reports duration, format, byte length, encoding, sample rate, sample size, channels, byte order, and channel-variable labels.
4. Choose a different fixture. With media copying enabled, confirm the project media folder receives the file and the stored path is project-relative; with copying disabled, confirm the selected path follows the existing Java-compatible path rules.
5. Cancel a second chooser and verify the path, name, metadata, and project revision do not change.
6. Edit Csound post code, save the project, reopen it, and verify the code and source path round-trip.
7. Temporarily point the object at a missing or unsupported file through a test project and confirm the editor clears stale metadata and offers a recoverable chooser state.

## Native FrozenSoundObject Save Copy pass

1. Select a frozen score object whose artifact exists in the project directory.
2. Confirm source name, source type, source duration, frozen filename, and channels are visibly read-only; the frozen filename must not be an editable text control.
3. Invoke `Save Copy`, choose a new temporary filename, and compare the destination bytes with the original artifact.
4. Repeat with a directory, a missing artifact, an existing `freeze...` destination, an ordinary existing destination, and chooser/overwrite cancellation. Confirm each result matches `contracts/score-object-file-operations.md` and no project revision or XML changes occur.
5. Unfreeze or remove the object while the editor is open and verify the editor clears to its existing fallback state rather than retaining stale Save Copy controls.

## Completion evidence

Automated evidence recorded 2026-08-15:

- `@blue/data`: 3 focused files, 22 tests passed; the full package suite also passed (166 files, 1620 tests); `pnpm --filter @blue/data build` passed.
- `@blue/app`: 7 focused files, 102 tests passed; `build:main`, `build:preload`, and `build:renderer` passed. Renderer build emitted only the existing large-chunk warning.
- `git -c core.fsmonitor=false diff --check` passed.
- The full `@blue/app` suite passed: 313 files, 2889 tests passed, and 2 skipped.

Native UI evidence recorded 2026-08-15:

- User-confirmed that the AudioFile native chooser and the FrozenSoundObject `Save Copy` dialogs work in the running application.
- Automated operation tests cover the missing, unreadable, directory, freeze-prefix, cancellation, overwrite-confirmation, and exact-byte-copy edge cases without mutating project state.
