# Tasks: Import MIDI File

**Input:** Design documents from `/specs/068-midi-file-import/`
**Implementation target:** Electron main + preload + React renderer + portable `@blue/data`

## Phase 1: Setup

**Purpose:** Add the parser dependency and establish the feature's owned files.

- [X] T001 Add pinned `midi-file@1.2.4` dependency to `packages/blue-app/package.json` and update `pnpm-lock.yaml`.
- [X] T002 [P] Add serializable MIDI import preview, stream-settings, warning, and start/commit result types in `packages/blue-app/src/shared/midi-import.ts`.
- [X] T003 [P] Add parser-independent MIDI import model and converter test fixture locations under `packages/blue-data/src/midi/midi-file-import.ts` and `packages/blue-data/src/midi/midi-file-import.test.ts`.

---

## Phase 2: Foundational

**Purpose:** Establish the portable conversion contract, host boundary, and regression fixtures before UI or project mutation work.

- [X] T004 [P] Define normalized PPQ MIDI document, track/stream, note-event, and diagnostic types in `packages/blue-data/src/midi/midi-file-import.ts` without Node/Electron imports.
- [X] T005 [P] Add pure converter regression fixtures for PPQ timing, note-on velocity zero, overlapping notes, multiple channels, and malformed-event warnings in `packages/blue-data/src/midi/midi-file-import.test.ts`.
- [X] T006 [P] Add parser-adapter SMF byte fixtures for format 0, format 1, running status, variable-length deltas, malformed chunks, SMPTE division, and format 2 in `packages/blue-app/src/main/midi-import-parser.test.ts`.
- [X] T007 [P] Add IPC validation tests for stale tokens, unknown stream keys, empty settings, and serializable preview shape in `packages/blue-app/src/shared/midi-import.test.ts`.
- [X] T008 Verify the existing `.specify/feature.json`, `.gitignore`, package scripts, and TypeScript project references remain unchanged except where required by the MIDI import dependency in `packages/blue-app/package.json` and `pnpm-lock.yaml`.

**Checkpoint:** The pure model, IPC contract, and parser fixtures are defined; no current project mutation is possible yet.

---

## Phase 3: User Story 1 — Import a MIDI file (Priority: P1) 🎯 MVP

**Goal:** Parse a valid binary PPQ SMF and construct a new Blue project containing playable GenericScore objects.

**Independent test:** Feed the parser and converter a format-0 fixture containing running status and velocity-zero note-offs; assert the configured root layer group, one generated score layer, correct beat timing, and generated Csound note text.

### Verification for User Story 1

- [X] T009 [P] [US1] Add assertions for Java-compatible key, pitch-class, octave, CPS, velocity, and velocity-amplitude placeholders in `packages/blue-data/src/midi/midi-file-import.test.ts`.
- [X] T010 [P] [US1] Add parser-adapter assertions for header validation, track names, absolute tick accumulation, note-on/off normalization, and rejected division/format cases in `packages/blue-app/src/main/midi-import-parser.test.ts`.

### Implementation for User Story 1

- [X] T011 [US1] Implement Java-compatible note-template expansion, numeric formatting, channel/key pairing, dangling-note recovery, PPQ beat conversion, trim behavior, and GenericScore/root-layer-group construction in `packages/blue-data/src/midi/midi-file-import.ts`.
- [X] T012 [US1] Export the MIDI import converter and normalized types from `packages/blue-data/src/index.ts`.
- [X] T013 [US1] Implement the static `midi-file` parser adapter that reads normalized events, splits note-bearing `(track, channel)` streams, collects previews/warnings, and rejects unsupported files in `packages/blue-app/src/main/midi-import-parser.ts`.
- [X] T014 [US1] Run the focused `@blue/data` and parser-adapter tests and correct only implementation defects surfaced by those fixtures in `packages/blue-data/src/midi/` and `packages/blue-app/src/main/midi-import-parser.ts`.

**Checkpoint:** The feature can parse and convert an SMF entirely in tests without touching the current Electron project.

---

## Phase 4: User Story 2 — Map imported streams (Priority: P2)

**Goal:** Let the user review note-bearing streams and edit instrument/template/trim settings before commit.

**Independent test:** Open the renderer dialog with a serialized preview, edit a row, verify the submitted settings, and verify cancel closes without calling commit.

### Verification for User Story 2

- [X] T015 [P] [US2] Extend native menu tests to assert the MIDI item is enabled only with a loaded project and calls `onImportMidiFile` in `packages/blue-app/src/main/application-menu.test.ts`.
- [X] T016 [P] [US2] Add React dialog tests for row rendering, default values, editable settings, warning display, cancel, and accept validation in `packages/blue-app/src/renderer/tests/midi-import-dialog.test.tsx`.

### Implementation for User Story 2

- [X] T017 [US2] Add the `open-midi-import` native command and route it through `packages/blue-app/src/shared/workbench-menu.ts` and `packages/blue-app/src/renderer/stores/workbench-store.ts`.
- [X] T018 [US2] Add typed preload bridge methods and renderer global declarations for MIDI import start/commit/cancel in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`.
- [X] T019 [US2] Replace the File menu placeholder with `onImportMidiFile` in `packages/blue-app/src/main/application-menu.ts` and wire the callback from `packages/blue-app/src/main/main.ts`.
- [X] T020 [US2] Implement the stream-mapping modal with Java defaults, track/channel metadata, warnings, template help, local validation, and stable callback handlers in `packages/blue-app/src/renderer/components/workbench/panels/MidiImportDialog.tsx`.
- [X] T021 [US2] Mount `MidiImportDialog` in `packages/blue-app/src/renderer/App.tsx` and keep its state renderer-local/transient.

**Checkpoint:** The native menu opens a usable mapping dialog, but main does not install a new project until the commit handler is implemented.

---

## Phase 5: User Story 3 — Preserve the current project safely (Priority: P3)

**Goal:** Make file selection, preview, commit, cancellation, and failure safe with respect to canonical project state.

**Independent test:** Exercise start cancellation, parser failure, stale-token commit, and successful commit against mocked main dependencies; assert only successful commit replaces `currentData`.

### Verification for User Story 3

- [X] T022 [P] [US3] Add pending-session and settings validation tests for cancellation, stale session IDs, malformed settings, and retry-safe errors in `packages/blue-app/src/main/midi-import-service.test.ts`.
- [X] T023 [P] [US3] Add renderer error-state assertions for file/parser/commit failures and verify the modal remains open or closes according to the result contract in `packages/blue-app/src/renderer/tests/midi-import-dialog.test.tsx`.

### Implementation for User Story 3

- [X] T024 [US3] Implement main-owned pending MIDI import state, native file chooser start, preview token validation, cancel handling, and error conversion in `packages/blue-app/src/main/midi-import-service.ts`.
- [X] T025 [US3] Register `start-midi-import`, `commit-midi-import`, and `cancel-midi-import` IPC handlers and connect them to the pure converter in `packages/blue-app/src/main/main.ts`.
- [X] T026 [US3] Reuse the existing render guard, save/library confirmation, Blue Live shutdown, editor disposal, JavaScript-session reset, revision/session update, and project-loaded broadcast lifecycle for successful MIDI replacement in `packages/blue-app/src/main/main.ts`.
- [X] T027 [US3] Connect the dialog's native-menu open event to the start/commit/cancel bridge and surface actionable errors without exposing parser internals in `packages/blue-app/src/renderer/components/workbench/panels/MidiImportDialog.tsx`.

**Checkpoint:** Cancel and failure are no-ops for the current project; successful acceptance installs a new unsaved project and refreshes the workbench.

---

## Phase 6: User Story 4 — Retain Java Blue behavior (Priority: P4)

**Goal:** Verify observable output structure, formatting, trim semantics, and XML persistence against Java Blue behavior.

**Independent test:** Convert equivalent normalized fixtures in TypeScript, save/load the resulting BlueData XML, and compare note text, object timing, layer count, and placeholder output.

### Verification for User Story 4

- [X] T028 [P] [US4] Add `.blue` XML round-trip assertions for imported layer-group/score structure and trim placement in `packages/blue-data/src/midi/midi-file-import.test.ts`.
- [X] T029 [P] [US4] Add menu integration assertions that the implemented MIDI action no longer invokes `onNotYetImplemented` in `packages/blue-app/src/main/application-menu.test.ts`.
- [X] T030 [P] [US4] Record the intentional multi-channel splitting and malformed-event recovery differences from Java Blue in `specs/068-midi-file-import/research.md` and `specs/068-midi-file-import/quickstart.md`.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose:** Validate the full feature against repository constraints and the documented smoke path.

- [X] T031 [P] Add focused regression coverage for the portable-data constraint and ensure `packages/blue-data/src/midi/midi-file-import.ts` has no Node/Electron/dynamic-import dependency.
- [X] T032 Run `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/data build`, and `pnpm --filter @blue/app build:main` from `/Users/stevenyi/work/blue-electron`.
- [X] T033 Run repository lint and the MIDI import quickstart checks from `specs/068-midi-file-import/quickstart.md`; fix only feature-related failures in the touched files.
- [X] T034 Review the final diff for task traceability, unused imports, accidental feature-state changes, and parser dependency lockfile integrity in `packages/blue-app/`, `packages/blue-data/`, `specs/068-midi-file-import/`, and `pnpm-lock.yaml`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1:** T001–T003 can start immediately; T001 must finish before package builds.
- **Phase 2:** T004–T007 can run in parallel after T002/T003; T008 is a read-only verification checkpoint.
- **Phase 3:** T009/T010 are verification-first and can run in parallel; T011/T012 precede T013; T014 follows both implementations.
- **Phase 4:** T015/T016 can run in parallel; T017–T019 establish the bridge/menu seams before T020/T021.
- **Phase 5:** T022/T023 are verification-first; T024 precedes T025; T026 and T027 follow the IPC seam.
- **Phase 6:** T028–T030 can run in parallel after the converter/menu work.
- **Phase 7:** T031–T034 run after all required stories are complete.

### User story dependency graph

```text
Foundation (T001–T008)
        |
        v
US1 parser + converter (T009–T014)
        |
        v
US2 mapping UI + menu (T015–T021)
        |
        v
US3 safe main lifecycle (T022–T027)
        |
        v
US4 parity + persistence (T028–T030)
        |
        v
Polish + repository verification (T031–T034)
```

### Parallel opportunities

- T002/T003, T004–T007, T009/T010, T015/T016, T022/T023, and T028–T030 can be worked on in parallel when their file ownership does not overlap.
- Do not parallelize tasks that edit `main.ts`, `application-menu.ts`, `preload.ts`, or the same converter/test file.

## Follow-up extension: tempo and project layer-group defaults

The following tasks were added after the initial import flow to cover Score tempo configuration and project-default layer-group selection.

- [X] T035 [P] Preserve MIDI `SET_TEMPO` events as normalized beat-positioned BPM changes in `packages/blue-app/src/main/midi-import-parser.ts` and `packages/blue-data/src/midi/midi-file-import.ts`; use 120 BPM when the SMF has no tempo event.
- [X] T036 Read and normalize `projectDefaults.defaultLayerGroupType` during the main-process commit in `packages/blue-app/src/main/main.ts`, then construct the matching `TrackLayerGroup`/`Track` or `PolyObject`/`SoundLayer` root in the portable converter.
- [X] T037 Add parser/converter coverage and update the MIDI import design documents for tempo-map points, default layer-group selection, and both output shapes.

## Review hardening

- [X] T038 Include unmatched/dangling pairing diagnostics in the renderer preview and render their actionable messages in the mapping table.
- [X] T039 Preserve source-stream order for both Track and SoundObject roots and verify Track XML reification with multiple streams.
- [X] T040 Defer replacement confirmations until commit, revalidate the pending session after asynchronous prompts, and keep the dialog open when replacement is cancelled.
- [X] T041 Validate tempo changes and malformed event velocities at the portable converter boundary, and normalize editable text settings before score generation.

## Implementation Strategy

### MVP first

Complete Phases 1–3 and validate a format-0 file through parser and converter tests. This proves the binary-to-GenericScore core before UI and project replacement are introduced.

### Incremental delivery

1. Add parser/converter and tests.
2. Add dialog and native menu routing.
3. Add safe main-process commit lifecycle.
4. Add Java parity/XML verification and repository checks.

Every phase leaves the previous phase's tests runnable; no second parser or new persistence format is introduced.
