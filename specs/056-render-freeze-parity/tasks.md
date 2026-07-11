# Tasks: Render to Disk and ScoreObject Freezing Parity

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/`

- `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/spec.md`
- `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/plan.md`
- `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/research.md`
- `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/data-model.md`
- `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/contracts/render-freeze-ipc.md`
- `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/quickstart.md`

**Prerequisites**: The existing `@blue/data` score/sound-object model, project snapshot IPC, Java runtime integration, program settings store, application menu, and score timeline are available as described in the design artifacts.

**Tests**: Automated tests are required for serialization, CSD generation, command construction, IPC contracts, operation failure/cancellation, filename allocation, reference counting, and project persistence. Manual Java parity scenarios remain in the quickstart.

**Organization**: Tasks are grouped by setup, shared foundation, and the four specification user stories. Within each story, tests are introduced before or alongside the implementation they verify. `[P]` marks work that can proceed in parallel without editing the same file or depending on unfinished work.

## Phase 1: Setup

- [x] T001 [P] Add the typed render/freeze request, result, status, operation, and rejection contracts in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/render-freeze-contract.ts`, including the single-active-operation and main-owned-path invariants from the IPC contract.
- [x] T002 [P] Expose `renderToDisk`, `freezeScoreObjects`, `cancelRenderOperation`, and render-operation status subscriptions through `/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/preload.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/types/global.d.ts` without accepting renderer-supplied executables, output paths, raw XML, or arbitrary commands.
- [x] T003 [P] Add reusable selected-target builders in the render/freeze tests and deterministic WAV/AIFF byte fixtures alongside `/Users/stevenyi/work/blue-electron/packages/blue-data/src/audio/audio-file-metadata.ts`.

## Phase 2: Foundational

- [x] T004 [P] Add contract-level tests for request validation, result discriminants, status transitions, cancellation identity, and rejected-target serialization in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/render-freeze-contract.test.ts`.
- [x] T005 [P] Add pure disk-render command-plan types, format validators, and argument serialization seams in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/disk-render-command.ts`, keeping executable resolution and filesystem access outside the pure planner.
- [x] T006 [P] Add a cancellable main-process operation lifecycle seam with `preparing`, `rendering`, `inspecting`, `committing`, `completed`, `cancelled`, and `failed` states in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-to-disk.ts`, so freeze can reuse the same status and process-control behavior.
- [x] T007 [P] Add baseline disk-CSD regression coverage for project-owned sample rate, ksmps, channel count, 0dbfs, message flags, and render-window behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-disk.test.ts`.
- [x] T008 Update the project-facing export barrel and renderer API declarations needed by the new render/freeze data helpers in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/index.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/types/global.d.ts` without introducing Node or Electron dependencies into `@blue/data`.

## Phase 3: User Story 1 — Render the Project to Disk (Priority: P1) 🎯 MVP

**Goal**: Render the active project using Java Blue’s ordinary Disk Render settings, project properties, generated disk CSD, and configured Disk Render executable.

**Independent Test**: With a saved project and configured Csound executable, invoke Render to Disk and verify the selected output exists, uses the project’s disk CSD values and message flags, honors format toggles and advanced override semantics, and does not mutate score objects.

- [x] T009 [P] [US1] Add exact command-plan tests covering normal mode, `diskCompleteOverride`, `-o` output placement, project `-m` flags, project `diskAdvancedSettings`, program Disk Render flags, format/sample-format enable toggles, and all supported Java Blue format values in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/disk-render-command.test.ts`.
- [x] T010 [US1] Implement Java-compatible command-plan construction in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/disk-render-command.ts`, including separate program Disk Render settings versus project `ProjectProperties`, no flag merging in complete override mode, output validation, and argv-safe tokenization.
- [x] T011 [P] [US1] Add render orchestration tests for CSD generation, project-relative output resolution, subprocess success/failure/cancellation, operation status, output-exists validation, and unchanged canonical project state in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-to-disk.test.ts`.
- [x] T012 [US1] Implement the main-process Render to Disk service in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-to-disk.ts`, loading the active project and three-layer settings, generating disk CSD, launching the configured Disk Render executable, reporting status, and returning only verified output paths.
- [x] T013 [US1] Register `renderToDisk` and `cancelRenderOperation` IPC handlers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`, enforce one active operation, and broadcast status through the typed channel defined in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/render-freeze-contract.ts`.
- [x] T014 [US1] Connect application-menu Render, Render and Play, and Render and Open actions to the main-process service in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/application-menu.ts`, ensuring play/open occurs only after a successful verified render.
- [x] T015 [P] [US1] Add menu behavior tests for render, render-and-play, render-and-open, disabled/busy operations, and failed-render follow-up suppression in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/application-menu.test.ts`.
- [x] T016 [US1] Update the program-settings usage matrix and tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts` so Disk Render executable, format/sample-format values and enable toggles, output flags, and advanced settings are marked as active consumers with their program-level provenance.
- [x] T017 [US1] Add project-default and persistence tests for `fileName`, `askOnRender`, `diskCompleteOverride`, `diskAlwaysRenderEntireProject`, disk message flags, and disk CSD values in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-disk.test.ts`, confirming project settings are not incorrectly read from program preferences.

## Phase 4: User Story 2 — Freeze and Unfreeze ScoreObjects (Priority: P1)

**Goal**: Freeze eligible timeline ScoreObjects to rendered audio and restore the original nested objects with Java-compatible replacement, restoration, and reference-count behavior.

**Independent Test**: Select an eligible timeline ScoreObject, freeze it, verify the rendered file and frozen replacement, unfreeze it, verify the nested original is restored, and confirm failed/cancelled renders leave the canonical score unchanged.

- [x] T018 [P] [US2] Add `FrozenSoundObject` XML round-trip and nested-original preservation tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/frozen-sound-object.test.ts`, including relative filenames, channel count, basic properties, and Java-compatible nested `<soundObject>` structure.
- [x] T019 [P] [US2] Add freeze temporary-project construction tests for deep-copy isolation, selected target replacement, Java-compatible temporary window/mixer data, and original-project immutability in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/utilities/freeze-render-data.test.ts`.
- [x] T020 [P] [US2] Add freeze orchestration tests for eligible target validation, non-eligible target rejection, render/inspect/commit ordering, replacement and restoration, revision/broadcast behavior, and no mutation after failed or cancelled render in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.test.ts`.
- [x] T021 [US2] Implement Java-compatible `FrozenSoundObject` XML serialization, nested original restoration, duration/channel fields, and frozen playback CSD generation in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/frozen-sound-object.ts`.
- [x] T022 [US2] Implement deep-copied freeze render data construction and temporary project cleanup in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/utilities/freeze-render-data.ts`, preserving the canonical project and using only serializable data-model inputs.
- [x] T023 [US2] Implement freeze/unfreeze orchestration in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.ts`, using UtilitySettings’ separate executable and freeze flags, rendering to Java-compatible freeze filenames, inspecting verified audio, replacing/restoring objects, and broadcasting the updated project snapshot only after commit.
- [x] T024 [US2] Register `freezeScoreObjects` and its status/cancellation integration in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`, resolving targets against the active project rather than trusting renderer-provided object data.
- [x] T025 [US2] Wire ScoreObject context actions and selected-target requests to the typed freeze API in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`, including freeze/unfreeze availability and rejected-target feedback.
- [x] T026 [P] [US2] Add renderer interaction tests for freeze/unfreeze actions, status display, busy-state disabling, rejected selections, and project snapshot refresh in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/render-freeze-actions.test.tsx`.
- [x] T027 [US2] Mark UtilitySettings executable and freeze flags as active consumers, with explicit separation from Disk Render settings, in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts`.

## Phase 5: User Story 3 — Preserve Java-Compatible Frozen Artifacts (Priority: P1)

**Goal**: Preserve Java Blue’s filenames, formats, metadata, CSD playback representation, `.blue` persistence, and shared-file cleanup semantics.

**Independent Test**: Freeze and save/reopen a project on each supported platform policy, inspect the generated WAV/AIFF metadata and XML, freeze multiple objects, unfreeze shared references one at a time, and confirm the file is deleted only after the final reference is removed.

- [x] T028 [P] [US3] Add WAV and AIFF metadata parser tests for channels, sample rate, sample count/duration, malformed headers, and unsupported formats in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/audio/audio-file-metadata.test.ts`.
- [x] T029 [US3] Implement pure WAV/AIFF metadata parsing in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/audio/audio-file-metadata.ts` and export it through `/Users/stevenyi/work/blue-electron/packages/blue-data/src/index.ts`, with file reads remaining in the Electron main process.
- [x] T030 [P] [US3] Add deterministic freeze filename allocation tests for `freeze0.wav`/`freeze0.aif`, highest parseable counter plus collision handling, macOS AIFF versus non-macOS WAV, project-relative paths, and format mismatch rejection in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.test.ts`.
- [x] T031 [US3] Implement Java-compatible freeze filename allocation and project-relative artifact resolution in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.ts`, preserving the original file format during unfreeze and preventing traversal outside the project.
- [x] T032 [P] [US3] Add reference-count and cleanup tests for duplicate frozen references, stale/missing files, unfreeze ordering, and delete-only-at-zero-reference behavior in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.test.ts`.
- [x] T033 [US3] Implement reference counting, missing-artifact handling, and safe cleanup in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.ts`, retaining nested originals when an artifact is missing and deleting only after the final successful unfreeze.
- [x] T034 [P] [US3] Add generated-CSD fixture tests verifying frozen objects use Java-compatible `diskin2` playback and preserve render duration/channel behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/frozen-sound-object.test.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-disk.test.ts`.
- [x] T035 [US3] Add save/reopen `.blue` round-trip coverage for frozen objects, nested originals, relative filenames, channel count, and project revision stability in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-frozen-roundtrip.test.ts`.
- [x] T036 [US3] Verify existing project snapshot conversion carries Frozen editor/bar metadata and update main/renderer refresh handling in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts` so canonical freeze mutations reload in the score editor.
- [x] T037 [US3] Add a Java parity fixture checklist and expected artifact assertions to `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/quickstart.md`, covering filenames, WAV/AIFF extensions, nested XML, `diskin2`, and reference-count cleanup.

## Phase 6: User Story 4 — Handle Results Safely (Priority: P2)

**Goal**: Make long-running render and freeze operations observable, cancellable, and safe under failures, missing files, busy state, and external playback/open actions.

**Independent Test**: Exercise successful, failing, cancelled, missing-output, missing-freeze-file, busy-operation, play, and open flows and verify status/error behavior plus the absence of partial canonical mutations.

- [x] T038 [P] [US4] Add failure and cancellation tests for non-zero Csound exit, spawn failure, missing output, cancellation during rendering, temporary CSD cleanup, and canonical-state preservation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-to-disk.test.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.test.ts`.
- [x] T039 [US4] Complete cancellation, timeout/error mapping, process termination, temporary-file cleanup, and output verification in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-to-disk.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.ts`.
- [x] T040 [P] [US4] Add play/open command tests for successful output only, shell path handling, unavailable external handlers, and failure reporting in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/application-menu.test.ts`.
- [x] T041 [US4] Implement post-render play/open behavior and safe external-path dispatch in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/application-menu.ts`, with no external action on failed or cancelled operations.
- [x] T042 [P] [US4] Add missing-freeze-artifact and unavailable-executable user-feedback tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/render-freeze-actions.test.tsx`.
- [x] T043 [US4] Add renderer operation-status handling, progress/error/cancelled messaging, and disabled controls while another operation is active in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/score/ScoreTimeCanvas.tsx`.
- [x] T044 [US4] Add main-process guards for project close/switch, concurrent render/freeze requests, and stale operation IDs in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-to-disk.test.ts`.
- [x] T045 [US4] Verify all failure and cancellation paths leave no partially replaced ScoreObjects and no untracked temporary CSD files through integration coverage in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/freeze-score-objects.test.ts`.

## Phase 7: Polish & Cross-Cutting Validation

- [x] T046 [P] Update the feature’s implementation notes and settings provenance table in `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/plan.md` and `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/research.md` to reflect any final path or API decisions made during implementation.
- [x] T047 [P] Add final contract assertions for renderer API shape, status listener disposal, and main-owned executable/path selection in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/render-freeze-contract.test.ts`.
- [x] T048 [P] Add final Java-compatible format and settings-layer regression cases to `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/disk-render-command.test.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts`.
- [x] T049 Run the focused data and app test commands documented in `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/quickstart.md` and resolve failures without changing Java-compatible filenames, formats, settings provenance, or XML structure.
- [x] T050 Run the full repository test and lint commands from `/Users/stevenyi/work/blue-electron/package.json`, then record any environment-only limitations in `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/quickstart.md`.
- [x] T051 Complete acceptance review using iterative user Electron reports for freeze/editor/waveform scenarios plus automated and subprocess-integration validation for normal render, settings provenance, save/reopen, failure/cancellation, and Java artifact comparisons; record results in `/Users/stevenyi/work/blue-electron/specs/056-render-freeze-parity/quickstart.md`.
- [x] T052 Add Frozen editor/bar integration, direct AIFF waveform summarization, Java-height multichannel waveform bands, and renderer regression coverage in `packages/blue-app/src/renderer/components/workbench/panels/score/bar-renderers/waveform-cache.ts`, `packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx`, and `packages/blue-app/src/renderer/tests/audio-clip-bar-renderer.test.tsx` (FR-026).

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)**: Establishes shared contracts, preload surface, and deterministic test fixtures.
2. **Foundational (Phase 2)**: Establishes pure command planning, operation lifecycle, disk-CSD regression coverage, and exports. Blocks all story phases.
3. **User Story 1 (Phase 3)**: Depends on Phase 2. This is the MVP for ordinary Render to Disk.
4. **User Story 2 (Phase 4)**: Depends on Phase 2 and the shared process/status seams. It may begin while the final US1 UI work is in progress, but main-process ownership and settings resolution must remain shared.
5. **User Story 3 (Phase 5)**: Depends on the US2 freeze/unfreeze orchestration and the data-model serialization work. It validates the artifact and persistence parity required by US2.
6. **User Story 4 (Phase 6)**: Depends on the US1 and US2 main-process flows because it hardens their cancellation, failure, busy-state, and external-action paths.
7. **Polish (Phase 7)**: Depends on all required P1 stories; manual parity validation is the final gate.

### Within Each User Story

- Add or extend tests before implementing the behavior they cover.
- Keep pure `@blue/data` work independent of Electron and Node APIs.
- Complete main-process orchestration before renderer/menu integration.
- Complete persistence and failure-path tests before calling the story complete.

### Parallel Opportunities

- T001–T003 can proceed in parallel during setup.
- T004–T008 can proceed in parallel where they touch separate modules.
- In US1, T009 and T011 can proceed in parallel before T010 and T012; T015–T017 can proceed in parallel after the main service contracts are stable.
- In US2, T018–T020 can proceed in parallel; T025 and T026 can proceed after the IPC surface exists while data-model tests continue.
- In US3, T028, T030, T032, and T034 can proceed in parallel because they cover separate test concerns; T029, T031, T033, and T035 then implement those seams.
- In US4, T038, T040, and T042 can proceed in parallel before their corresponding implementation tasks.
- T046–T048 can proceed in parallel after implementation stabilizes.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phases 1–2.
2. Complete US1 command planning, main orchestration, IPC, menu actions, settings provenance, and tests.
3. Run the focused Render to Disk tests and one manual render scenario from the quickstart.
4. Stop for review before enabling freeze UI if ordinary disk rendering is the first delivery slice.

### Incremental Delivery

1. Add US2 freeze/unfreeze with verified artifact inspection and canonical commit boundaries.
2. Add US3 Java-compatible filenames, audio metadata, persistence, CSD playback, and reference-count cleanup.
3. Add US4 cancellation, failures, busy-state guards, and play/open behavior.
4. Finish with the cross-cutting test, lint, and Java parity checks.

### Definition of Done

- All P1 story tasks and their automated tests pass.
- Normal rendering and freeze rendering use the correct independent settings layers and executables.
- Freeze/unfreeze preserves Java Blue filenames, WAV/AIFF policy, nested original XML, CSD playback, and reference-count cleanup.
- Failed or cancelled operations leave the canonical project unchanged.
- Renderer APIs cannot select arbitrary executables or output paths.
- Focused tests, full tests, lint, and documented manual parity checks are complete.

## Completion Summary

- 52 of 52 tasks complete.
- Final validation is recorded in `plan.md` and `quickstart.md`.
- Some planned file locations were satisfied through existing shared infrastructure rather than new files: renderer API declarations live in `renderer/types/global.d.ts`, project refresh uses the existing project snapshot broadcaster, and deterministic audio fixtures are co-located with the pure metadata implementation.
- Final review added missing shared-reference, cancellation/failure, platform-format, output-path, menu-routing, shared-runtime, and stereo-waveform coverage. No critical/high findings or constitution conflicts remain.
