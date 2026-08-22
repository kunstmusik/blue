# Tasks: AudioFile and FrozenSoundObject Editor Detail Parity

**Input**: Design documents from `/specs/074-audio-frozen-editor-parity/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/score-object-file-operations.md](./contracts/score-object-file-operations.md), [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story. The shared foundation establishes the pure metadata value, canonical project contracts, host-owned file operations, and typed IPC boundary before story-specific UI work begins.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish deterministic fixtures and test seams for the Java-parity behavior.

- [x] T001 [P] Add deterministic WAV, AIFF, AIFC, malformed-header, and partial-metadata fixtures to `packages/blue-data/src/audio/audio-file-metadata.test.ts`.
- [x] T002 [P] Add injectable filesystem, dialog, project-context, and temporary-project test doubles to `packages/blue-app/src/main/score-object-file-operations.test.ts`.
- [x] T003 [P] Add renderer snapshot builders and fixture props for readable, missing, unsupported AudioFile and valid/missing FrozenSoundObject states to `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the shared data, ownership, contract, and host-operation boundaries required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add failing regression assertions for WAV/AIFF/AIFC classification, byte length, sample fields, endianness, duration, malformed input, and explicit unsupported results in `packages/blue-data/src/audio/audio-file-metadata.test.ts`.
- [x] T005 Extend the browser-safe metadata parser with Java-editor fields, AIFC normalization, malformed/unsupported result handling, and preserved existing fields in `packages/blue-data/src/audio/audio-file-metadata.ts`.
- [x] T006 [P] Define `audioFile` and `frozenSoundObject` editor snapshot discriminators, metadata/status values, typed file-operation results, and `replaceAudioFileSource`/post-code score intents in `packages/blue-app/src/shared/project-editor.ts`.
- [x] T007 Update score editor document creation and patch application to populate both type-specific snapshots, atomically apply AudioFile source/name changes, preserve Csound post code, and reject FrozenSoundObject file-path mutation in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/main/score-object-editor-document.test.ts`.
- [x] T008 Implement the injected main-process `selectScoreObjectAudioFile` and `saveFrozenSoundObjectCopy` service with Java-compatible lookup, media-copy collision, freeze-artifact resolution, destination guards, overwrite confirmation, exact-byte copying, cancellation, and recoverable failures in `packages/blue-app/src/main/score-object-file-operations.ts`.
- [x] T009 Add main-process operation tests for regular-file selection, cancellation, project-relative/SFDIR resolution, media-copy collisions, missing/unsupported metadata, Save Copy byte equality, directory/freeze-prefixed/ordinary-overwrite handling, and no-project-mutation guarantees in `packages/blue-app/src/main/score-object-file-operations.test.ts`.
- [x] T010 Register the typed score-object file-operation IPC handlers and expose them through preload without arbitrary filesystem access in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`.
- [x] T011 Add renderer boundary assertions for serializable selection/copy result shapes, cancellation/error handling, and the absence of a FrozenSoundObject file-path mutation intent in `packages/blue-app/src/renderer/tests/score-object-editor-contract.test.ts`.
- [x] T012 Replace the generic editable file-path control with a type-discriminated editor dispatch shell and explicit empty/unsupported fallback in `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx`.

**Checkpoint**: Pure parsing, canonical project ownership, host file operations, typed IPC, and the type-specific editor boundary are ready for story implementation.

---

## Phase 3: User Story 1 - Inspect and Replace an AudioFile (Priority: P1) 🎯 MVP

**Goal**: Deliver the Java Blue-style AudioFile editor with chooser, metadata, channel variables, Csound post-code editing, project/media path behavior, and persistence.

**Independent Test**: Open an AudioFile with a valid fixture, verify the non-editable path, Audio File/Csound views, and metadata, choose a second fixture, verify the coherent source/name/metadata update, edit post code, and save/reopen the project.

### Verification for User Story 1

- [x] T013 [P] [US1] Add failing renderer tests for non-editable path display, Audio File/Csound views, metadata rows, channel variables, chooser cancellation, and replacement refresh in `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx`.
- [x] T014 [P] [US1] Add failing document tests for basename-derived AudioFile naming, atomic source replacement, media-copy preference behavior, Csound post-code editing, and save/reopen persistence in `packages/blue-app/src/main/score-object-editor-document.test.ts`.

### Implementation for User Story 1

- [x] T015 [US1] Project the resolved AudioFile source, metadata state, and channel-variable information into the type-specific editor snapshot in `packages/blue-app/src/shared/project-editor.ts`.
- [x] T016 [US1] Implement the AudioFile Audio File tab, non-editable path field, native chooser button, metadata rows, channel-variable display, and existing Csound post-code tab in `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx`.
- [x] T017 [US1] Connect the chooser result to the canonical `replaceAudioFileSource` intent, keep cancellation a no-op, surface recoverable selection failures, and keep post-code edits on the existing project patch bridge in `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx`.
- [x] T018 [US1] Complete the AudioFile renderer and document assertions, including imported-media path/name behavior and stale metadata replacement, in `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx` and `packages/blue-app/src/main/score-object-editor-document.test.ts`.

**Checkpoint**: User Story 1 is independently usable and testable as the MVP.

---

## Phase 4: User Story 2 - Inspect and Save a FrozenSoundObject Artifact (Priority: P1)

**Goal**: Deliver the read-only FrozenSoundObject inspector and safe Java-compatible Save Copy workflow without changing freeze state or project data.

**Independent Test**: Open a FrozenSoundObject with a valid artifact, verify source/artifact details and the absence of editable path controls, save a copy, compare bytes, and verify the project snapshot and dirty state are unchanged.

### Verification for User Story 2

- [x] T019 [P] [US2] Add failing renderer tests for read-only source/artifact details, channel and duration display, Save Copy availability, and the absence of an editable frozen filename control in `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx`.
- [x] T020 [P] [US2] Add failing integration assertions for successful Save Copy, exact-byte equality, unchanged project data, and unchanged dirty state in `packages/blue-app/src/main/score-object-file-operations.test.ts` and `packages/blue-app/src/main/score-object-editor-document.test.ts`.

### Implementation for User Story 2

- [x] T021 [US2] Project FrozenSoundObject source name/type, source duration, frozen artifact status, channel count, and Save Copy capability into the read-only editor snapshot in `packages/blue-app/src/shared/project-editor.ts`.
- [x] T022 [US2] Implement the FrozenSoundObject read-only inspector with source/artifact detail rows and no writable file-path input in `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx`.
- [x] T023 [US2] Connect Save Copy to the typed preload operation, render success/error/cancellation status, and ensure no project patch is dispatched for the copy action in `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx` and `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx`.
- [x] T024 [US2] Complete FrozenSoundObject renderer, operation, and document tests for valid, missing, directory, freeze-prefixed, overwrite-confirmation, and cancellation outcomes in `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx`, `packages/blue-app/src/main/score-object-file-operations.test.ts`, and `packages/blue-app/src/main/score-object-editor-document.test.ts`.

**Checkpoint**: User Stories 1 and 2 both preserve canonical project data while providing their distinct Java-style workflows.

---

## Phase 5: User Story 3 - Recover Clearly from Missing or Unsupported Audio State (Priority: P2)

**Goal**: Make missing, unreadable, unsupported, and changed-selection states explicit and recoverable for both editors without stale metadata or stale controls.

**Independent Test**: Exercise valid, missing, unreadable, unsupported, and newly reassigned fixtures for both object types, verify each status and cleared field, then choose a valid replacement and verify complete details return in the same editor session.

### Verification for User Story 3

- [x] T025 [P] [US3] Add failing renderer and main-operation tests for missing, unreadable, unsupported, partial-metadata, stale-replacement, and cancelled-recovery states in `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx` and `packages/blue-app/src/main/score-object-file-operations.test.ts`.

### Implementation for User Story 3

- [x] T026 [US3] Implement explicit empty, missing, unreadable, unsupported, available, and operation-error status mapping with stale metadata clearing in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx`.
- [x] T027 [US3] Clear stale editor snapshots when selection changes, a frozen object is unfreezed or removed, or the selected type becomes unsupported in `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx` and `packages/blue-app/src/renderer/tests/score-object-editor-loading.test.tsx`.
- [x] T028 [US3] Preserve existing missing-audio replacement, freeze/unfreeze, waveform, playback, and project-save behavior while adding recovery coverage in `packages/blue-app/src/main/missing-audio-assets.test.ts`, `packages/blue-app/src/main/freeze-score-objects.test.ts`, and `packages/blue-app/src/main/score-object-editor-document.test.ts`.

**Checkpoint**: All three stories have explicit recovery behavior and no stale editor state across selection or file failures.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete constitution-required persistence, regression, build, and manual validation evidence.

- [x] T029 [P] Add `.blue` round-trip and unknown-XML-preservation assertions proving metadata, Save Copy destinations, and renderer-only status do not become new project fields in `packages/blue-app/src/main/score-object-editor-document.test.ts` and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`.
- [x] T030 [P] Extend mixed-selection, empty-selection, and unsupported-editor routing coverage for the new discriminated file editor in `packages/blue-app/src/renderer/tests/score-object-editor-fallbacks.test.tsx` and `packages/blue-app/src/renderer/tests/score-object-editor-routing.test.tsx`.
- [x] T031 Run the focused automated commands and native chooser/Save Copy acceptance scenarios documented in `specs/074-audio-frozen-editor-parity/quickstart.md`, recording results for success, cancellation, rejection, and no-mutation cases.
- [x] T032 Run affected package tests, type checks, lint, main/preload/renderer builds, and `git diff --check` using the commands in `specs/074-audio-frozen-editor-parity/quickstart.md` and the repository scripts in `package.json`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependencies; T001, T002, and T003 can run in parallel.
- **Foundational (Phase 2)**: Depends on Setup. T004/T005 establish the pure metadata value; T006/T007 establish canonical snapshots and patch intents; T008/T009 implement and verify host file operations; T010/T011 complete the typed IPC boundary; T012 establishes the renderer dispatch shell. This phase blocks all story work.
- **User Story 1 (Phase 3)**: Depends on Phase 2 and is the MVP. T013 and T014 can begin together; implementation follows the failing tests.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and follows User Story 1 because both stories extend the shared `FileBackedScoreObjectEditor.tsx`; its operation contract remains independently testable from Phase 2.
- **User Story 3 (Phase 5)**: Depends on the AudioFile and FrozenSoundObject UI states from Phases 3 and 4 so recovery clears every supported editor branch.
- **Polish (Phase 6)**: Depends on all desired user stories.

### User Story Dependencies

```text
Phase 1 Setup
    ↓
Phase 2 Foundation
    ↓
Phase 3 US1 AudioFile MVP ───→ Phase 4 US2 FrozenSoundObject
                                      ↓
                                Phase 5 US3 Recovery
                                      ↓
                                Phase 6 Polish
```

US2 is semantically independent of AudioFile behavior, but the current shared renderer module is intentionally updated sequentially to keep changes surgical. The main operation tests and contracts are reusable by both stories.

### Within Each User Story

- Add or update the focused regression/contract test before the behavior implementation where the existing harness supports a failing reproduction.
- Keep canonical project mutations in `packages/blue-app/src/shared/project-editor.ts` and host file operations in `packages/blue-app/src/main/score-object-file-operations.ts`.
- Complete the story's renderer and persistence checks before moving to the next priority.
- Preserve existing freeze, waveform, playback, missing-audio, and XML behavior throughout each checkpoint.

### Parallel Opportunities

- T001, T002, and T003 can run in parallel because they create fixtures in different test files.
- T004 and T006 can run in parallel because parser assertions and shared contract definitions are in separate boundaries.
- T013 and T014 can run in parallel because renderer and document regressions use different test files.
- T019 and T020 can run in parallel after US1 because renderer and main/document verification use separate files.
- T029 and T030 can run in parallel during polish.

## Parallel Example: User Story 1

```text
Task T013: Add AudioFile renderer regression tests in packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx
Task T014: Add AudioFile document/persistence regression tests in packages/blue-app/src/main/score-object-editor-document.test.ts
```

After both tests are in place, complete T015, then T016 and T017 in order because they share the editor and canonical patch flow.

## Parallel Example: User Story 2

```text
Task T019: Add FrozenSoundObject renderer regression tests in packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx
Task T020: Add Save Copy byte/no-mutation integration tests in packages/blue-app/src/main/score-object-file-operations.test.ts
```

Complete T021 before the UI work in T022/T023, then use T024 as the story checkpoint.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 fixtures and Phase 2 foundation.
2. Complete Phase 3 User Story 1.
3. Run T018 and the AudioFile portion of T031/T032.
4. Stop for an independently testable AudioFile chooser/metadata/post-code demo.

### Incremental Delivery

1. Foundation → typed contracts and host operations.
2. US1 → AudioFile detail parity and MVP.
3. US2 → FrozenSoundObject read-only inspector and Save Copy.
4. US3 → missing/unsupported recovery and stale-state clearing.
5. Polish → round-trip preservation, regression suite, builds, and manual evidence.

### Parallel Team Strategy

1. One developer owns the pure metadata and shared contracts (T004–T007).
2. A second developer can build the main operation seam and tests (T008–T011) once the shared result types are agreed.
3. Story UI work is sequential in the current shared editor module; the renderer and document tests within each story can proceed in parallel.

## Notes

- Every task uses the required `- [ ] [TaskID] [P?] [Story?]` checklist format and names at least one concrete repository path.
- `[P]` is used only where the task can proceed without an incomplete dependency and does not require the same implementation file as another parallel task.
- No new `.blue` persistence fields, durable settings, decoder dependency, Java runtime change, or engine protocol change is planned.

## Phase 7: Convergence

- [x] T033 [US2] Render FrozenSoundObject channel count as a read-only detail and cover it in `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx` and `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx` per FR-009 (partial)
- [x] T034 [US2] Probe freeze-artifact readability and render an explicit unreadable-artifact diagnostic in `packages/blue-app/src/main/score-object-file-operations.ts` and `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx` per US2/AC3 and FR-012 (partial)
- [x] T035 [US2] Resolve FrozenSoundObject artifacts through the safe project-local resolver and reject same-file, absolute, and traversal-based artifact sources before Save Copy in `packages/blue-app/src/main/score-object-file-operations.ts` and `packages/blue-app/src/main/score-object-file-operations.test.ts` per plan: safe freeze-artifact resolution and FR-012 (contradicts)
- [x] T036 [US1/US3] Pass the effective project/media SFDIR context into score-object metadata inspection and file operations in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/score-object-file-operations.test.ts` per plan: Java-compatible path resolution (partial)
- [x] T037 [US3] Fence or clear transient AudioFile metadata when the editor target or stored file path changes in `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx`, `packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/FileBackedScoreObjectEditor.tsx`, and `packages/blue-app/src/renderer/tests/score-object-editor-loading.test.tsx` per FR-008 (partial)
- [x] T038 [US3] Model, map, and render explicit per-field unavailable metadata instead of zero-filled values for partial source inspection in `packages/blue-data/src/audio/audio-file-metadata.ts`, `packages/blue-app/src/shared/project-editor.ts`, and `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx` per FR-008 (partial)
- [x] T039 [P] Add the missing regression assertions for channel/unreadable/path-guard behavior, stale and partial recovery, successful overwrite confirmation, XML unknown-data preservation, and fallback routing in `packages/blue-app/src/main/score-object-file-operations.test.ts`, `packages/blue-app/src/main/score-object-editor-document.test.ts`, `packages/blue-app/src/renderer/tests/file-backed-score-object-editor.test.tsx`, `packages/blue-app/src/renderer/tests/score-object-editor-loading.test.tsx`, `packages/blue-app/src/renderer/tests/score-object-editor-fallbacks.test.tsx`, `packages/blue-app/src/renderer/tests/score-object-editor-routing.test.tsx`, and `packages/blue-data/src/blue-data-frozen-roundtrip.test.ts` per FR-017 and SC-006 (partial)
- [x] T040 Record the focused test/build results, native chooser/Save Copy disposition, and the full-app test result in `specs/074-audio-frozen-editor-parity/quickstart.md` before claiming completion per T031 and T032 (partial)
- [x] T041 Review and justify the out-of-plan AudioFile CSD-generation rewrite, or isolate it as separate work with Windows-path and post-code regression coverage, in `packages/blue-data/src/sound-objects/audio-file.ts` and `packages/blue-data/src/sound-objects/audio-file.test.ts` per plan: source scope and FR-014 (unrequested)
