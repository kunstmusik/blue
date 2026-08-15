# Implementation Plan: AudioFile and FrozenSoundObject Editor Detail Parity

**Branch**: `074-audio-frozen-editor-parity` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from [spec.md](./spec.md)

## Summary

Replace the current generic file-backed score-object editor with two explicit Java Blue-compatible detail workflows. AudioFile receives a native file chooser, project/media path handling, source metadata, channel variables, and Csound post-code editing. FrozenSoundObject becomes a read-only inspector with source and frozen-artifact metadata plus a guarded Save Copy action. The implementation keeps `BlueData` and existing `.blue` fields canonical, routes filesystem and dialog work through Electron main, and uses typed renderer contracts for selection, metadata, patches, and copy results.

## Technical Context

**Language/Version**: TypeScript 5.8.x with strict mode; React 19.x; Electron 35.7.5 with Node 22 in the main process  
**Primary Dependencies**: `@blue/data` audio and sound-object models, existing project-editor snapshot/patch bridge, Electron `dialog`/`fs`/`path`/IPC APIs, Zustand renderer stores, Vitest 4.x  
**Storage**: Existing `.blue` XML fields remain canonical. Audio media and frozen wave files remain project-relative or user-selected disk artifacts. Metadata and operation status are transient editor state. Save Copy never mutates the project document.  
**Testing**: Focused `@blue/data` and `@blue/app` Vitest suites, renderer contract/component tests, main/preload/renderer builds, and a manual Electron dialog/file-operation pass from [quickstart.md](./quickstart.md)  
**Target Platform**: Electron desktop on macOS, Windows, and Linux  
**Project Type**: Existing Electron monorepo with a pure data package, Electron main/preload bridge, and React renderer  
**Performance Goals**: Keep chooser, metadata inspection, and copy operations asynchronous; refresh metadata for one selected source without blocking the renderer; avoid full score snapshot replacement for editor-local display state; permit at most one active chooser/copy operation per editor action  
**Constraints**: `@blue/data` stays browser-safe and contains no Node.js or UI imports. File I/O, path resolution, dialogs, and overwrite decisions stay in main. IPC payloads are serializable and typed. Do not add XML fields or a new persistence format. Preserve Csound path normalization at the text-generation boundary. FrozenSoundObject's persisted frozen filename is not editable from this editor. Match Java Blue's project-relative/SFDIR lookup, media-copy collision, and Save Copy safety semantics. Do not add a decoder dependency for this parity slice.  
**Scale/Scope**: Two type-specific editor views, one main-process file-operation seam, two typed IPC operations, an extended pure metadata value, explicit score patch intents, and focused regression coverage  

## Constitution Check

*Gates evaluated before implementation; all are passing.*

1. **Portable data core** — PASS. Audio metadata parsing and value shaping stay in `@blue/data`; Electron filesystem, path, dialog, and IPC work stays in main; React only presents snapshots and dispatches intents.
2. **Java compatibility and lossless persistence** — PASS. The plan follows Java Blue's AudioFile chooser/metadata flow, project/media path rules, FrozenSoundObject read-only state, and Save Copy guards while retaining existing `.blue` fields and unknown XML. No intentional Java divergence is introduced by the plan.
3. **Canonical ownership and typed contracts** — PASS. Main-process `BlueData` remains authoritative. Renderer metadata/status is transient, and typed discriminated snapshots, file-operation results, and score patch intents define the boundary. Cancellation, missing files, unsupported files, and failed copies return recoverable results without partially applying project mutations.
4. **Runtime and engine isolation** — PASS. This feature does not modify engine protocols, freeze rendering, Java runtime integration, or Csound execution. The data package remains free of Node and dynamic imports.
5. **Verification evidence** — PASS. The plan includes pure parser tests, Java-compatible path/collision tests, document/patch tests, renderer behavior and contract tests, build checks, and a manual native-dialog acceptance pass.

No constitution exceptions are required.

## Project Structure

### Documentation

```text
specs/074-audio-frozen-editor-parity/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── score-object-file-operations.md
```

`tasks.md` contains the generated implementation checklist plus the completed convergence tasks from the implementation audit.

### Source Changes

```text
packages/blue-data/src/audio/
├── audio-file-metadata.ts             # extend normalized metadata value
└── audio-file-metadata.test.ts        # WAV/AIFF/AIFC and unsupported-input coverage

packages/blue-app/src/main/
├── score-object-file-operations.ts    # injected main-process chooser/copy seam
├── score-object-file-operations.test.ts
├── main.ts                            # register IPC handlers and bridge operations
├── freeze-score-objects.ts             # reuse frozen-artifact resolution rules
└── missing-audio-assets.ts             # reuse Java-compatible audio lookup rules

packages/blue-app/src/preload/
└── preload.ts                          # expose typed score-object file operations

packages/blue-app/src/renderer/types/
└── global.d.ts                         # declare the preload surface

packages/blue-app/src/shared/
└── project-editor.ts                   # discriminated editor snapshots and score intents

packages/blue-app/src/renderer/components/workbench/panels/score-object/
└── editors/FileBackedScoreObjectEditor.tsx
    # render dedicated AudioFile and FrozenSoundObject detail states

packages/blue-app/src/renderer/tests/
├── file-backed-score-object-editor.test.tsx
└── score-object-editor-contract.test.ts
```

The existing file-backed editor module remains the routing point, but its rendering is split by the snapshot discriminator rather than sharing one editable path control. The new main module is a narrow operation seam so filesystem behavior can be tested without starting Electron; it composes the existing missing-audio and freeze-artifact helpers rather than duplicating their lookup rules.

## Implementation Design

### 1. Extend the pure audio metadata value

- Preserve the current WAV/AIFF parsing entry point and existing fields used by waveform/player code.
- Add normalized values needed by the Java detail panel: source byte length, format/encoding type, sample rate, sample size in bits, channel count, endianness, frame count, and duration.
- Normalize WAV, AIFF, and AIFC results without introducing an audio decoder. Unsupported or malformed headers return a typed unsupported/error result for the main operation to translate into editor status.
- Add deterministic tests for the existing synthetic WAV/AIFF fixtures, AIFC classification, malformed/truncated data, and values that must be cleared when a source cannot be inspected.

### 2. Make score-object editor snapshots and mutations type-specific

- Replace the generic `kind: 'file'` editor snapshot with explicit `kind: 'audioFile'` and `kind: 'frozenSoundObject'` discriminators.
- Keep AudioFile's persisted path and Csound post-code in the existing model. Add a typed `replaceAudioFileSource` intent that atomically updates the stored source path and basename-derived object name after a successful chooser result, plus a separate post-code intent.
- Keep FrozenSoundObject's persisted frozen filename and nested source object unchanged. Remove file-path mutation from the editor's supported patch surface and expose source/frozen display fields as read-only snapshot data.
- Build source metadata and artifact status on demand from the current selection. Clear or replace stale metadata when the selected object changes, a source is missing, or inspection fails.
- Preserve the current main-process canonical document flow: renderer dispatches explicit score patches, main applies them to `BlueData`, and `.blue` serialization remains unchanged.

### 3. Add the main/preload file-operation boundary

- Implement a testable main-process service for `selectScoreObjectAudioFile` and `saveFrozenSoundObjectCopy` with injected filesystem, path, dialog, and project-context dependencies where practical.
- AudioFile selection must accept regular files only, support cancellation, resolve project-relative/absolute/SFDIR paths with Java-compatible semantics, optionally copy imported files into the configured media folder, avoid overwriting differing media collisions, derive the object name from the selected basename, and return metadata only after the final stored/read path is known.
- FrozenSoundObject Save Copy must resolve the existing frozen artifact safely, default the destination to the current project directory, reject directories, reject destinations whose basename starts with `freeze`, confirm ordinary overwrites, copy exact bytes, and return a recoverable result without changing the project document.
- Register narrow typed IPC handlers and preload methods. Do not expose arbitrary filesystem access or reuse the Audio Player's broader file-opening endpoint for editor mutation.
- Reuse `findAudioFile`, `resolveFreezeArtifactPath`, and related helpers as the semantic sources of truth; extend them only when a shared Java rule is missing. Keep host-native filesystem paths native until Csound text generation.

### 4. Render the Java-compatible detail affordances

- AudioFile renders an Audio File tab with a non-editable path display, native `...` chooser action, metadata rows, channel-variable display, missing/unsupported/error states, and the existing Csound post-code tab/editor.
- FrozenSoundObject renders source name/type/duration, frozen wave filename/status, nested duration, channel count, and a read-only Save Copy action. No editable frozen filename input is rendered.
- Show cancellation as a no-op, keep the previous valid state until a successful replacement or explicit failure state is available, and prevent stale editor data from appearing after selection changes.
- Surface actionable errors for missing sources, unsupported metadata, invalid destinations, overwrite cancellation, and failed copies while keeping the editor usable.

### 5. Verify persistence, parity, and recovery

- Add parser tests, main-operation tests, shared document/patch tests, renderer contract tests, and renderer component tests for both editor discriminators.
- Verify `.blue` round trips still contain only the existing AudioFile/FrozenSoundObject fields and that Save Copy leaves the project snapshot and dirty state unchanged.
- Run the focused commands and manual native-dialog scenarios in [quickstart.md](./quickstart.md), then run main/preload/renderer builds and `git diff --check`.

## Phase 0: Research Output

- [research.md](./research.md) records the Java source comparison, current TypeScript gaps, resolved path/metadata/ownership decisions, and rejected reuse options.

## Phase 1: Design Output

- [data-model.md](./data-model.md) defines the transient editor state, metadata states, operation result shapes, state transitions, and persistence ownership.
- [contracts/score-object-file-operations.md](./contracts/score-object-file-operations.md) defines the typed main/preload operations, score mutation intents, discriminated snapshots, and failure guarantees.
- [quickstart.md](./quickstart.md) defines focused automated commands and manual acceptance evidence for the native chooser, metadata states, read-only FrozenSoundObject UI, Save Copy guards, and non-mutation behavior.

## Post-Design Constitution Check

*Re-evaluated after the data model and contracts were defined; all gates remain passing.*

1. **Portable data core** — PASS. The design explicitly isolates metadata parsing from Electron file operations and renderer components.
2. **Java compatibility and lossless persistence** — PASS. The design captures Java's chooser, media-copy collision, lookup, metadata, read-only, and Save Copy behavior while leaving XML schema ownership unchanged.
3. **Canonical ownership and typed contracts** — PASS. The design gives main the file-operation authority and `BlueData` the document authority; renderer state is transient and all mutations are explicit.
4. **Runtime and engine isolation** — PASS. No engine or Java helper changes are required, and no platform-only dependency leaks into `@blue/data`.
5. **Verification evidence** — PASS. Each behavior has a corresponding focused automated or manual check, including failure and cancellation recovery.

No post-design exceptions are required.

## Complexity Tracking

No constitution violations or speculative complexity require justification. The additional operation seam is a deliberate testability and ownership boundary, and the explicit snapshot discriminators remove the current ambiguous editable-file state.

The adjacent `AudioFile` CSD-generation correction is intentionally retained within FR-014's source-generation boundary: it replaces the invalid placeholder arrangement output, preserves post-code channel behavior, escapes Csound path text, and normalizes Windows filesystem separators only at the Csound boundary. It is covered by the existing CSD integration/post-code assertions and the added Windows-path regression in `packages/blue-data/src/sound-objects/audio-file.test.ts`.
