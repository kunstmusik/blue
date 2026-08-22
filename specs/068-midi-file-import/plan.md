# Implementation Plan: Import MIDI File

**Branch:** `068-midi-file-import`
**Spec:** [spec.md](spec.md)
**Research:** [research.md](research.md)
**Status:** Implemented; tempo and project-default layer-group follow-up included

## Summary

Add a native MIDI-file import flow with a pinned, low-level SMF parser in Electron main, a pure normalized MIDI-to-GenericScore converter in `@blue/data`, and a renderer mapping dialog. The flow will preserve Java Blue's ordinary PPQ format-0/1 behavior while making channel pairing and malformed-event handling deterministic.

The import replaces the current project with a new in-memory `BlueData`, following the existing CSD/ORC-SCO import lifecycle. It is not an additive score patch and does not reuse live Web MIDI routing. The new root layer-group type follows `projectDefaults.defaultLayerGroupType`, and MIDI tempo events populate the imported Score tempo map.

## Technical context

- TypeScript 5.8.x strict mode, React 19.x, Electron 35.x, Zustand 5.x, Vitest 4.x.
- `@blue/data` is browser/Node portable and cannot import Node built-ins, Electron, `require()`, or dynamic imports.
- Electron main already owns file dialogs, filesystem reads, project replacement, Blue Live shutdown, and project-loaded notifications.
- Existing native menu placeholder lives in `packages/blue-app/src/main/application-menu.ts`; its handler is rebuilt from `packages/blue-app/src/main/main.ts`.
- Existing `BlueData`, `Score`, `TrackLayerGroup`, `Track`, `PolyObject`, `SoundLayer`, and `GenericScore` classes can represent the output without a new persistence format.
- The reference implementation is Java Blue's `MidiImportUtilities`/`MidiUtilities`, not the live MIDI input code.
- Primary third-party dependency: `midi-file@1.2.4`, statically imported only by the main-process parser adapter. The adapter maps it into project-owned normalized types.

## Constitution check — pre-design

| Principle/constraint | Status | Evidence |
| --- | --- | --- |
| Java-first behavior | Pass | Research starts from `MidiImportUtilities`, settings classes, and `MidiUtilities`; deviations are limited to malformed and multi-channel safety. |
| Portable `@blue/data` | Pass | Binary reading and third-party parser integration remain in Electron main; the data converter accepts plain normalized values. |
| Main-process canonical project | Pass | Main retains the pending document and installs the generated `BlueData`; renderer submits settings only. |
| Existing XML persistence | Pass | Output uses existing `GenericScore`/score serialization; no new `.blue` schema is proposed. |
| Explicit IPC contracts | Pass | A serializable preview/settings/token contract is defined in `contracts/midi-import-surface.md`. |
| Testable strict TypeScript | Pass | Parser, converter, IPC, dialog, menu, and XML round-trip tests are planned. |

## Design

### 1. Main-process parser adapter

Create a small adapter under `packages/blue-app/src/main/` that:

- reads the selected path as bytes using the existing main-process filesystem boundary;
- calls `parseMidi` from the pinned `midi-file` package with a static import;
- validates format 0/1 and a positive PPQ `timeDivision`;
- converts delta times to absolute ticks;
- extracts track names and note-on/note-off events while retaining channel and source track identity;
- groups active note channels into normalized source streams;
- catches parser/validation exceptions and returns typed failures rather than throwing through IPC.

Do not expose `MidiData`, `MidiEvent`, `Buffer`, or the parser package to renderer code or shared project IPC.

### 2. Pure MIDI conversion in `@blue/data`

Add a portable MIDI import utility that accepts the normalized document plus validated row settings and returns a new `BlueData`/conversion result. Keep this separate from `midi-trigger-routing.ts`; live input and file import have different Java-compatible formatting requirements.

Implement:

- channel/key note pairing with FIFO queues for overlapping same-key notes;
- velocity-zero note-on normalization;
- unmatched and dangling-note diagnostics;
- PPQ-to-beat conversion without quantization;
- Java-compatible template replacement and numeric formatting;
- trim/non-trim score timing;
- Score tempo-map configuration from MIDI `SET_TEMPO` events, including the 120 BPM no-event default;
- root `TrackLayerGroup`/`Track` or `PolyObject`/`SoundLayer` with one `GenericScore` per accepted source stream, based on project defaults.

The converter should validate all finite/non-negative generated timing before constructing score text. It should never partially mutate a caller-owned `BlueData`.

### 3. Shared IPC and pending import session

Add serializable shared types for preview, stream settings, start/commit results, and warnings. Main retains the normalized document under a short-lived token bound to the current project/editor session. A stale token, renderer reload, cancellation, or project replacement clears the session.

Add preload methods for starting, committing, and cancelling an import. Keep the existing project-loaded snapshot refresh contract; no `ProjectDocumentPatch` extension is required for replacement import.

### 4. Renderer mapping dialog

Add a renderer-owned modal reached from the existing native-menu command pattern. The table should show track index/name, channel, note count, beat range, and warnings. Editable fields are instrument ID, note template, and trim time. Include a Java-style reference affordance for supported placeholders.

The dialog initializes defaults from the main preview, validates settings before commit, shows parser/pairing warnings without blocking ordinary valid notes, and treats cancel as a no-op. A cancelled replacement confirmation keeps the mapping dialog open so the user can retry. Avoid a second file parser in the renderer.

### 5. Native menu and import lifecycle

Replace the placeholder callback with `onImportMidiFile` and wire it through `main.ts`. Reuse or extract the shared project-install steps already used by CSD and ORC/SCO import:

- ensure a window/project and handle unsaved-change confirmation according to existing import behavior;
- defer save/library replacement confirmations until commit so cancelling file selection or mapping cannot change current project state;
- stop Blue Live and close/dispose state only after successful conversion is ready to install;
- set the new `currentData`, clear `currentFilePath`, update revisions/session state, and emit the normal project-loaded/editor refresh events;
- leave all current state untouched on cancel, parser error, unsupported timing, or rejected settings.

Add native-menu tests for enabled/disabled state and callback invocation, plus main-flow tests for success, cancel, error, and stale-token cases.

### 6. Dependency and packaging hygiene

- Pin `midi-file` in the package that owns the main-process adapter; do not add multiple competing parsers to production.
- Verify the package is included in the Electron/Vite main bundle and works with the repository's static-import constraints.
- Keep a small set of generated byte fixtures or inline byte builders in tests for format 0/1, running status, velocity-zero note-offs, malformed chunks, and unsupported division.
- Document the upgrade check: rerun parser compatibility tests and Java parity spot checks before changing the pin.

## Test strategy

### Unit tests

- Parser adapter: headers, VLQ/running status, track metadata, channel extraction, malformed input, format/division rejection.
- Data converter: pairing, overlap, diagnostics, all placeholders, Java velocity amplitude, beat conversion, trim, empty streams, and generated object graph.

### Integration tests

- Main/preload contract serialization and settings validation.
- Native menu → dialog start → commit/cancel lifecycle.
- Project replacement and current-file/revision behavior.
- `.blue` save/load round-trip for imported score text and timing.

### Manual parity

Compare a small PPQ format-0 and format-1 file with Java Blue, including a multi-channel track and a file using velocity-zero note-offs. Record any intentional multi-channel or malformed-event difference in tests and release notes.

## Project structure

Expected implementation locations:

```text
packages/blue-app/src/main/
  midi-import-parser.ts       # midi-file adapter and normalized preview source
  main.ts                     # handler and project replacement wiring
  application-menu.ts         # native menu callback
packages/blue-app/src/preload/
  preload.ts                  # typed bridge methods
packages/blue-app/src/shared/
  midi-import.ts               # IPC-safe preview/settings/result types
packages/blue-app/src/renderer/
  components/.../MidiImportDialog.tsx
  components/.../MidiImportStreamTable.tsx
  stores/...                   # transient dialog/session state only, if needed
packages/blue-data/src/
  midi/midi-file-import.ts     # pure normalized-document converter
  midi/midi-note-pairing.ts    # channel-local note pairing and diagnostics
  midi/midi-note-template.ts   # Java-compatible template expansion
specs/068-midi-file-import/
  spec.md
  research.md
  data-model.md
  quickstart.md
  contracts/midi-import-surface.md
```

The exact renderer directory should follow the existing workbench/modal organization discovered during implementation; do not introduce a new global UI framework for this feature.

## Constitution check — post-design

| Principle/constraint | Status | Evidence |
| --- | --- | --- |
| Java-first behavior | Pass with documented extensions | Default template, placeholders, historical SoundObject score shape, trim, PPQ beats, and replacement semantics follow Java. Channel-aware pairing/recovery, tempo import, and Track roots are explicit Electron extensions. |
| Portable data package | Pass | `@blue/data` receives normalized plain objects and creates model objects; no Node/Electron/parser import is required there. |
| Canonical main ownership | Pass | Pending source data and final `BlueData` remain main-owned; renderer state is preview/settings only. |
| Persistence compatibility | Pass | Existing XML model is reused; no new XML elements are required. |
| Simple, surgical architecture | Pass | One parser adapter, one pure converter, one dialog, and one lifecycle seam; no parser duplication or additive patch protocol. |
| Verification | Pass | Byte-level parser fixtures, pure converter tests, IPC/main tests, UI tests, and parity checks are specified before implementation. |

## Complexity tracking

No constitution violations are present. Deliberate behavior expansions beyond the Java baseline are channel-split mapping, malformed-pair recovery, MIDI tempo-map import, and project-default Track roots. They are isolated behind the normalized conversion boundary and covered by explicit tests and documentation.

## Implementation sequence

1. Add the feature spec/research/model/contracts (this plan artifact set).
   - verify: `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, and the IPC contract agree on PPQ-only input, stream mapping, and replacement semantics.
2. Add the pinned parser dependency, main-process adapter, normalized types, and byte fixtures.
   - verify: parser tests pass for format 0/1, running status, velocity-zero note-offs, malformed chunks, and rejected SMPTE/format-2 files.
3. Implement and test the pure converter, note-pairing, and template utilities.
   - verify: converter tests cover pairing, warnings, all placeholders, trim/non-trim timing, GenericScore construction, and XML round-trip.
4. Add preload/shared IPC and pending-session validation.
   - verify: shared types remain serializable and stale, cancelled, malformed, or expired tokens cannot commit.
5. Build the mapping dialog and wire native menu start/cancel/commit.
   - verify: renderer tests cover defaults, editable stream settings, warnings, local validation, cancel, and commit-error recovery; menu tests cover project gating and callback routing.
6. Reuse the existing project-install lifecycle and complete integration tests.
   - verify: only a successful conversion replaces `currentData`, clears the file path, advances the session, and emits the normal project-loaded refresh.
7. Run the quickstart checks, Java parity spot checks, and a manual Electron smoke test where the desktop environment permits.
   - verify: repository tests, lint, data/main/renderer builds, and the documented import scenarios pass; any unavailable manual check is recorded in the handoff.
8. Review the final diff and task traceability.
   - verify: `tasks.md` has no unchecked implementation or verification items, no accidental `.specify/feature.json` change remains, and only feature files plus the parser lockfile changes are present.
