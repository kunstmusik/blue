# Tasks: Score Timeline Automation Editing

**Input**: Design documents from `/specs/052-score-timeline-automation/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/score-timeline-automation-surface.md](contracts/score-timeline-automation-surface.md), [quickstart.md](quickstart.md)

**Tests**: Tests are required by FR-021 and are listed before implementation work in each phase.

## Phase 1: Setup

- [x] T001 Review Java Blue automation references listed in `/Users/stevenyi/work/blue-electron/specs/052-score-timeline-automation/research.md` before editing TypeScript code.
- [x] T002 Review existing renderer reuse targets in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx`, `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`, and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/AudioLayerGroupCanvas.tsx`.
- [x] T003 Create the reusable automation component folder in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/`.
- [x] T004 Create the score automation store placeholder in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/score-automation-store.ts`.
- [x] T005 Add score timeline automation test fixture helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-fixtures.ts`.
- [x] T006 Add shared score automation test fixture helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/score-timeline-automation-test-utils.ts`.

## Phase 2: Foundational Data And Contract

**Purpose**: Complete the canonical automation layer model, XML compatibility, and shared snapshot/patch contract before user-facing renderer workflows.

- [x] T007 [P] Add `ParameterIdList` serialization and selected-index tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/automation/parameter-id-list.test.ts`.
- [x] T008 Implement unique add/remove/contains/clear/selected-index behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/automation/parameter-id-list.ts`.
- [x] T009 [P] Add `Parameter` line color XML, point sorting, and deep-copy tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/automation/parameter.test.ts`.
- [x] T010 Implement Java-compatible line color accessors, XML load/save, and deep-copy behavior in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/automation/parameter.ts`.
- [x] T011 Update `AutomatableLayer` to expose `getAutomationParameters()` in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/layers/automatable-layer.ts`.
- [x] T012 [P] Add sound layer automation XML tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/sound-layer-automation.test.ts`.
- [x] T013 Implement `SoundLayer` as an `AutomatableLayer` with a `ParameterIdList` in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/sound-layer.ts`.
- [x] T014 Persist and load `soundLayer` `parameterId` children in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/sound-objects/poly-object.ts`.
- [x] T015 [P] Add audio layer automation XML tests in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/audio/audio-layer-automation.test.ts`.
- [x] T016 Implement `AudioLayer` as an `AutomatableLayer` with copied automation assignments in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/audio/audio-layer.ts`.
- [x] T017 Persist and load `audioLayer` `parameterId` children in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/score/audio/audio-layer.ts`.
- [x] T018 [P] Add BlueData round-trip tests for soundObject and audio layer assignments in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-automation.test.ts`.
- [x] T019 Add `AutomationParameterSnapshot`, `ScoreLayerAutomationSnapshot`, and target menu types in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T020 Add `ScoreAutomationPatch` union and layer reference types in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T021 [P] Add shared contract snapshot tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/score-timeline-automation-contract.test.ts`.
- [x] T022 [P] Add shared patch mutation tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/score-timeline-automation-patches.test.ts`.
- [x] T023 Implement automation target collection for soundObject layer instrument and mixer parameters in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T024 Implement automation target collection for audio layer associated mixer channel parameters in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T025 Attach `automation` snapshots to eligible `ScoreLayerSnapshot` rows in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T026 Implement assignment, removal, move, clear, select, color, and point patch handlers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T027 Implement stale parameter id detection and cleanup patch handling in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T028 Update project store patch dispatch typing for score automation patches in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/project-store.ts`.
- [x] T029 Add score automation mode and range state actions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/score-automation-store.ts`.
- [x] T030 Run focused foundational tests for `@blue/data` automation and shared score automation contracts.

## Phase 3: User Story 1 - Choose Layer Automations From The A Button (P1)

**Goal**: SoundObject and audio layer headers expose an A button menu for assigning, removing, and moving timeline automation ownership.

**Independent Test**: Open a project with one soundObject layer and one audio layer that each have available automation targets, use each layer's A button to select and remove an automation, and verify the layer header and timeline reflect the chosen parameter.

- [x] T031 [P] [US1] Add A button menu rendering tests for soundObject layers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-menu.test.tsx`.
- [x] T032 [P] [US1] Add A button menu rendering tests for audio layers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-menu.test.tsx`.
- [x] T033 [P] [US1] Add assignment ownership movement tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/score-timeline-automation-patches.test.ts`.
- [x] T034 [US1] Implement `AutomationTargetMenu` with grouped target state styling in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationTargetMenu.tsx`.
- [x] T035 [US1] Implement `AutomationLayerHeaderControls` with A button, color control, parameter name, and previous/next controls in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerHeaderControls.tsx`.
- [x] T036 [US1] Add menu state helpers for current-layer, elsewhere-assigned, available, and missing targets in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-selection-utils.ts`.
- [x] T037 [US1] Integrate soundObject layer header controls into existing score row rendering in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`.
- [x] T038 [US1] Integrate audio layer header controls into existing audio row rendering in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/AudioLayerGroupCanvas.tsx`.
- [x] T039 [US1] Wire A button assignment actions through score automation patches in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationTargetMenu.tsx`.
- [x] T040 [US1] Add line selector footer visibility behavior for small and tall rows in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerHeaderControls.tsx`.
- [x] T041 [US1] Add parameter color selection patch dispatch in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerHeaderControls.tsx`.
- [x] T042 [US1] Ensure soundObject A button menus include Instrument and Mixer groups from the snapshot in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationTargetMenu.tsx`.
- [x] T043 [US1] Ensure audio A button menus show only associated channel targets in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationTargetMenu.tsx`.
- [x] T044 [US1] Add missing-target display and cleanup affordance in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerHeaderControls.tsx`.
- [x] T045 [US1] Preserve existing score object row interactions while header controls are present in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`.
- [x] T046 [US1] Preserve existing audio clip row interactions while header controls are present in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/AudioLayerGroupCanvas.tsx`.
- [x] T047 [US1] Add regression coverage for existing audio clip canvas interactions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/audio-layer-group-canvas.test.tsx`.
- [x] T048 [US1] Add regression coverage for existing score object canvas interactions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-time-canvas-cross-group.test.tsx`.
- [x] T049 [US1] Run the A button menu and assignment test set for `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-menu.test.tsx`.

## Phase 4: User Story 2 - Edit One Automation Line In Single-Line Mode (P1)

**Goal**: Single-line mode focuses the selected automation line and supports direct point editing, range movement, scaling, color changes, and undoable canonical patches.

**Independent Test**: Select an automation on a soundObject layer and an automation on an audio layer, switch to single-line mode, add and move points on each line, create a time-range selection, move or scale that selection, and verify the resulting line values are saved.

- [x] T050 [P] [US2] Add coordinate conversion and value clamping tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-single-line.test.tsx`.
- [x] T051 [P] [US2] Add point insert, move, delete, and snap tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-single-line.test.tsx`.
- [x] T052 [P] [US2] Add single-line range move, scale, and vertical shift tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-single-line.test.tsx`.
- [x] T053 [US2] Implement beat/value conversion, snap, and resolution helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-line-utils.ts`.
- [x] T054 [US2] Implement point insertion, deletion eligibility, move, and full-line replacement helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-line-utils.ts`.
- [x] T055 [US2] Implement single-line range selection, range move, range scale, and vertical shift helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-selection-utils.ts`.
- [x] T056 [US2] Implement `AutomationLineView` SVG or canvas line rendering with active and inactive line styles in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLineView.tsx`.
- [x] T057 [US2] Implement `AutomationLayerOverlay` single-line point editing gestures in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerOverlay.tsx`.
- [x] T058 [US2] Integrate `AutomationLayerOverlay` into soundObject rows without replacing object bars in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`.
- [x] T059 [US2] Integrate `AutomationLayerOverlay` into audio rows without replacing audio clip bars or fade handles in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/AudioLayerGroupCanvas.tsx`.
- [x] T060 [US2] Add score automation mode controls to the existing score toolbar in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/ScoreToolbar.tsx`.
- [x] T061 [US2] Wire single-line overlay gestures to score automation store drag state in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/score-automation-store.ts`.
- [x] T062 [US2] Dispatch canonical point and range patches from completed single-line gestures in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerOverlay.tsx`.
- [x] T063 [US2] Ensure selected-line cycling updates active renderer state and snapshot selection patches in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerHeaderControls.tsx`.
- [x] T064 [US2] Add undo grouping for single-line completed gestures in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T065 [US2] Add root-timeline-only guard for automation overlays in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/LayerPanel.tsx`.
- [x] T066 [US2] Add visual regression assertions for inactive assigned lines in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-single-line.test.tsx`.
- [x] T067 [US2] Run the single-line automation test set for `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-single-line.test.tsx`.

## Phase 5: User Story 3 - Edit Multiple Layers In Multi-Line Mode (P2)

**Goal**: Multi-line mode selects a time/layer range across soundObject and audio rows and moves or scales all included automation lines with selected score objects or audio clips.

**Independent Test**: Select a range spanning soundObject layers and audio layers with active automation, move and scale the selected range, and verify only the selected layers and selected time range are affected.

- [x] T068 [P] [US3] Add multi-line range creation tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-multi-line.test.tsx`.
- [x] T069 [P] [US3] Add multi-line move and scale tests for soundObject and audio layer automation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-multi-line.test.tsx`.
- [x] T070 [P] [US3] Add alignment tests for selected score objects, audio clips, and automation ranges in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-multi-line.test.tsx`.
- [x] T071 [US3] Implement multi-line range geometry helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-selection-utils.ts`.
- [x] T072 [US3] Implement multi-line move and scale point transforms in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-line-utils.ts`.
- [x] T073 [US3] Add multi-line selection state actions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/score-automation-store.ts`.
- [x] T074 [US3] Add multi-line overlay selection drawing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerOverlay.tsx`.
- [x] T075 [US3] Reuse existing soundObject move and scale gesture transforms for selected objects in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx`.
- [x] T076 [US3] Reuse existing audio clip move and resize gesture transforms for selected clips in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/AudioLayerGroupCanvas.tsx`.
- [x] T077 [US3] Implement shared range move and scale patch handling for automation lines in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T078 [US3] Clamp multi-line move and scale operations that would cross beat zero in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T079 [US3] Add undo grouping for multi-line move and scale operations in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T080 [US3] Run the multi-line automation test set for `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-multi-line.test.tsx`.

## Phase 6: User Story 4 - Persist And Use Timeline Automation During Playback (P2)

**Goal**: Assigned automation lines and edits remain part of the project and drive playback, render, export, and reload.

**Independent Test**: Assign and edit automations on soundObject and audio layers, save and reopen the project, then play or export and verify the automated parameter values follow the edited lines.

- [x] T081 [P] [US4] Add save/reload persistence tests for layer assignments and line colors in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-persistence.test.ts`.
- [x] T082 [P] [US4] Add missing-target handling tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-persistence.test.ts`.
- [x] T083 [P] [US4] Add playback/export data-flow tests for edited automation parameters in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-automation.test.ts`.
- [x] T084 [US4] Ensure score automation patches mark the current project document dirty in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T085 [US4] Ensure assigned soundObject layer automation ids survive project snapshot refresh in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T086 [US4] Ensure assigned audio layer automation ids survive project snapshot refresh in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T087 [US4] Verify soundObject editor automation tabs still read and write the same parameter data in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.
- [x] T088 [US4] Ensure runtime parameter sync consumes edited timeline parameter points in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/runtime-parameter-sync.test.ts`.
- [x] T089 [US4] Ensure CSD generation uses edited soundObject automation points in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-automation.test.ts`.
- [x] T090 [US4] Ensure audio-layer mixer channel automation lines flow through render/export data in `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-automation.test.ts`.
- [x] T091 [US4] Run persistence and playback/export automation tests for `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/score-timeline-automation-persistence.test.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/runtime-parameter-sync.test.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-data/src/blue-data-csd-automation.test.ts`.

## Phase 7: Polish And Cross-Cutting

- [x] T092 Audit all automation renderer components for existing score panel styling and component reuse in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/`.
- [x] T093 Add accessible labels and keyboard focus behavior for A button, previous/next, mode controls, and color controls in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerHeaderControls.tsx`.
- [x] T094 Verify renderer text and controls do not overlap in small row heights in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerHeaderControls.tsx`.
- [x] T095 Run existing score renderer regression tests under `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/`.
- [x] T096 Run `@blue/data` automation and score serialization regression tests under `/Users/stevenyi/work/blue-electron/packages/blue-data/src/`.
- [x] T097 Run repository lint and test commands from `/Users/stevenyi/work/blue-electron/`.
- [x] T098 Update implementation notes and any changed assumptions in `/Users/stevenyi/work/blue-electron/specs/052-score-timeline-automation/status.md`.
- [x] T099 Update root handoff status in `/Users/stevenyi/work/blue-electron/STATUS.md`.

## Dependencies

- **Setup (Phase 1)** must complete before foundational work.
- **Foundational Data And Contract (Phase 2)** blocks all user stories.
- **US1 A Button Assignment (Phase 3)** is the MVP and must complete before meaningful line editing.
- **US2 Single-Line Editing (Phase 4)** depends on US1 assignment and foundational patches.
- **US3 Multi-Line Editing (Phase 5)** depends on foundational patches and can begin after reusable overlay utilities from US2 exist.
- **US4 Persistence And Playback (Phase 6)** depends on data/model work and should be validated after US1 and US2 mutations are functional.
- **Polish (Phase 7)** follows all user stories.

## Parallel Execution Examples

- Phase 2: T007, T009, T012, T015, T018, T021, and T022 can be drafted in parallel because they target different test files.
- US1: T031, T032, and T033 can be written in parallel before menu implementation.
- US2: T050, T051, and T052 can be written in parallel before line utilities are implemented.
- US3: T068, T069, and T070 can be written in parallel before multi-line utilities are implemented.
- US4: T081, T082, and T083 can be written in parallel before persistence/playback implementation fixes.

## Implementation Strategy

1. Build the MVP by completing Phase 1, Phase 2, and US1. This makes layer automation assignable and visible from the score timeline.
2. Add US2 to make assigned automation lines directly editable in single-line mode.
3. Add US3 for Java-style multi-line range movement and scaling across layers.
4. Add US4 validation so assignments, colors, and point edits persist and drive playback/export.
5. Finish with regression, accessibility, styling, and handoff updates.

## Task Summary

- Total tasks: 99
- Setup: 6
- Foundational: 24
- US1: 19
- US2: 18
- US3: 13
- US4: 11
- Polish: 8
