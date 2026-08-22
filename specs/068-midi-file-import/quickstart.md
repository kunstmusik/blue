# MIDI Import Implementation Quickstart

This document is the verification path for the MIDI import implementation.

## Prerequisites

- A project can be opened in the Electron app.
- The Java reference sources are available under `~/work/nbprojects/blue` for parity checks.
- The implementation pins `midi-file@1.2.4` in the owning workspace package.

## Recommended implementation order

1. Add the parser dependency and main-process adapter.
2. Add normalized document types and pure `@blue/data` conversion/template utilities.
3. Add parser and converter fixtures/tests before wiring the UI.
4. Add preload/shared IPC types and the renderer mapping dialog.
5. Wire the native File menu and the existing project replacement lifecycle.
6. Run the full package checks and manually compare a generated `.blue`/CSD result with Java Blue.

## Automated checks

Use the repository's package-specific commands once the implementation exists; the exact scripts should be confirmed from each package's `package.json`:

```bash
pnpm --filter @blue/data test -- midi-import
pnpm --filter @blue/app test -- midi-import
pnpm lint
pnpm test
```

The targeted tests should cover:

- format 0 and format 1 headers;
- running status and variable-length delta times;
- note-off messages and note-on velocity zero;
- simultaneous and overlapping same-key notes;
- multiple channels in one track;
- Java placeholder and velocity-amplitude formatting;
- PPQ beat conversion and trim behavior;
- MIDI `SET_TEMPO` extraction, default 120 BPM, and Score tempo-map points;
- Track/SoundObject default layer-group selection and XML reification;
- malformed chunks, unsupported SMPTE, and format 2;
- cancellation and stale-token rejection;
- menu callback wiring and project replacement;
- `.blue` save/load round-trip of the generated GenericScores.

## Manual smoke test

1. Open a project with unsaved edits.
2. Choose **File → Import MIDI File**.
3. Cancel the file chooser; confirm the project remains open and unchanged.
4. Import a small format-0 file; confirm one mapping row, one score layer, audible notes, and the imported tempo in the Score settings.
5. Import a format-1 file containing two tracks and at least two channels; confirm separate rows and independent instrument/template edits.
6. Enable trim on one row; confirm the layer begins at the first note while note text begins at beat zero.
7. Cancel the mapping dialog; confirm no replacement occurred.
8. Save the imported project, reopen it, and confirm score text/layer timing survived the XML round-trip.
9. Try an invalid file and an SMPTE-timed file; confirm an actionable error and no project mutation.

## Java parity spot check

Use equivalent input bytes in Java Blue and Blue Electron. Compare:

- default note text;
- `<KEY_PCH>`, `<KEY_OCT>`, `<KEY_CPS>`, and `<VELOCITY_AMP>` output;
- note start/duration values in beats;
- configured TrackLayerGroup/Track or PolyObject/SoundLayer/GenericScore shape and trim placement;
- MIDI tempo changes and their beat positions in the Score tempo map.

Any intentional difference should be recorded in the converter tests, especially channel splitting and malformed-event recovery.

## Verification record (2026-08-09)

| Check | Result |
| --- | --- |
| `pnpm --filter @blue/data test` | Pass — 158 files, 1,462 tests |
| `pnpm --filter @blue/app test` | Pass — 281 files, 2,613 passed and 2 skipped |
| `pnpm --filter @blue/data build` | Pass — ESM and CJS TypeScript builds |
| `pnpm --filter @blue/app build:main` | Pass |
| `pnpm --filter @blue/app build:preload` | Pass |
| `pnpm --filter @blue/app build:renderer` | Pass; existing Vite chunk-size advisory only |
| `pnpm lint` | Pass |
| `pnpm test` | Pass — all workspace and repository script suites |

The automated parser/converter fixtures and direct Java source comparison cover deterministic parity. The interactive Electron smoke test remains a desktop verification step because it requires native dialogs, an audio engine, and user-selected MIDI fixtures.
