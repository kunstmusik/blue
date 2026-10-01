---
description: "Implementation tasks for standards-based SMPTE timecode"
---

# Tasks: Standards-Based SMPTE Timecode

**Input**: Design documents from specs/115-smpte-timecode/

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/timecode-contract.md, quickstart.md

**Organization**: Tasks are ordered by blocking foundation and then by user story priority. Verification tasks precede the implementation they protect.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Reuse the repository's existing pnpm workspace, Vitest suites, project document bridge, and ProjectHistory. No new package, dependency, or test harness setup is required.

_No setup tasks are needed._

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the browser-safe conversion owner, canonical TimeState mode, shared snapshot contract, and stable tempo inverse required by every story.

- [X] T001 [P] Add fixed independent vectors for all supported rates, valid 29.97/59.94 DF boundaries, malformed labels, exact frame starts, extended hours, and the supported physical-frame limit in packages/blue-data/src/time/smpte-timecode.test.ts, using specs/115-smpte-timecode/public-calculation-basis.md as the expected-value source.
- [X] T002 Implement the original rational-rate resolver, strict label parser, physical-frame formatter, duration conversion, and boundary tolerance in packages/blue-data/src/time/smpte-timecode.ts; use 24000/1001, 30000/1001, and 60000/1001 for fractional aliases and cite the public counting basis without adapting third-party source.
- [X] T003 [P] Add TimeState tests for the false default, true-only optional XML emission, legacy 29.97df/30df recovery as NDF, invalid-rate recovery, and cloned unknown child/attribute preservation in packages/blue-data/src/time/time-state.test.ts.
- [X] T004 Add smpteDropFrame to TimeState and its copy/XML behavior in packages/blue-data/src/time/time-state.ts. Preserve the data-model constraints verbatim: smpteFrameRate is one of 23.976, 24, 25, 29.97, 30, 50, 59.94, 60; smpteDropFrame is Boolean, defaults false, is true only at 29.97/59.94, and is emitted as an optional XML child only when true. Clone unknown XML children and attributes without retaining shadow copies of modeled fields.
- [X] T005 [P] Add snapshot contract assertions that score time state and toolbar transport derive the same format from canonical TimeState, including the 24/NDF empty default, in packages/blue-app/src/renderer/tests/tempo-map-contract.test.ts.
- [X] T006 Add smpteDropFrame to TimeConversionContext, ScoreTimeStateSnapshot, and ToolbarProjectTransportSnapshot and propagate it through packages/blue-app/src/shared/project-editor/contract.ts, packages/blue-app/src/shared/project-editor/snapshot-score.ts, packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts, and packages/blue-app/src/renderer/stores/playback-store.ts.
- [X] T007 [P] Add a regression for exact-frame inversion on a shallow 120-to-120.000001 BPM ramp over 1000 beats in packages/blue-data/src/time/tempo-map.test.ts.
- [X] T008 Stabilize the existing linear-segment secondsToBeats inverse while retaining its tempo law and constant-segment branch in packages/blue-data/src/time/tempo-map.ts.

**Checkpoint**: The portable converter, canonical mode field, snapshot contract, and full-tempo-map inverse are ready for story work.

---

## Phase 3: User Story 1 - Match the Project's Timecode Format (Priority: P1)

**Goal**: Let users select the project's rate and counting mode, then show matching SMPTE labels in transport, rulers, markers, and score-object editors without changing stored positions or durations.

**Independent Test**: Set 29.97 NDF and DF with a known tempo map; verify the independent 60-second, minute-transition, and tenth-minute examples across each affected display and a score-object time entry.

### Verification for User Story 1

- [X] T009 [P] [US1] Add time-unit integration cases for 29.97 NDF at 60 elapsed seconds, entry of 00:01:00:00, DF frames 1799/1800 and 17981/17982, and entry through a preceding tempo change in packages/blue-app/src/renderer/tests/time-unit-logic.test.ts.
- [X] T010 [P] [US1] Add toolbar transport and secondary-display agreement cases for NDF/DF mode and shared physical-frame labels in packages/blue-app/src/renderer/tests/toolbar-formatters.test.ts.
- [X] T011 [P] [US1] Add score-ruler label agreement cases for the 29.97 DF skipped-minute and tenth-minute transitions in packages/blue-app/src/renderer/tests/score-ruler-parity.test.ts.
- [X] T012 [P] [US1] Add marker-bar display cases proving markers use the selected project mode without changing marker time in packages/blue-app/src/renderer/tests/markers-bar.test.tsx.
- [X] T013 [P] [US1] Add score-object position and duration editor cases proving format/parse use the project mode and complete tempo context in packages/blue-app/src/renderer/tests/score-object-editor-contract.test.ts.
- [X] T014 [P] [US1] Add a piano-roll time-bar regression for selected SMPTE mode and its local-zero origin in packages/blue-app/src/renderer/tests/piano-roll-timebar.test.tsx.
- [X] T015 [P] [US1] Add rate/mode selection cases, including automatic NDF selection when an NDF-only rate is chosen, in packages/blue-app/src/renderer/tests/ruler-config-update.test.ts.

### Implementation for User Story 1

- [X] T016 [US1] Route SMPTE formatting and parsing through the portable converter and the full tempo map for positions and durations in packages/blue-app/src/renderer/time/time-unit-logic.ts.
- [X] T017 [US1] Replace the toolbar's duplicate SMPTE arithmetic and pass the snapshot mode into its formatters in packages/blue-app/src/renderer/components/menu-bar/toolbar-formatters.ts and packages/blue-app/src/renderer/components/menu-bar/ToolbarDisplays.tsx.
- [X] T018 [US1] Replace score-header SMPTE arithmetic with the shared converter and render labels from physical frame indices in packages/blue-app/src/renderer/components/workbench/panels/score/ColumnHeader.tsx.
- [X] T019 [US1] Use the shared formatter and project mode for marker-bar labels in packages/blue-app/src/renderer/components/workbench/panels/score/MarkersBar.tsx and packages/blue-app/src/renderer/components/workbench/panels/MarkersPanel.tsx.
- [X] T020 [US1] Pass the project TimeConversionContext into score-object and tempo-map time fields so position and duration editors use the same mode in packages/blue-app/src/renderer/components/workbench/panels/score-object/ScoreObjectPropertiesForm.tsx, packages/blue-app/src/renderer/components/workbench/panels/score-object/TimeUnitEditor.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score/TempoMapEditorDialog.tsx.
- [X] T021 [US1] Propagate the project format into the piano-roll ruler while preserving its local-zero behavior in packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/PianoRollEditor.tsx and packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/pianoroll/TimeBar.tsx.
- [X] T022 [US1] Add an explicit DF/NDF control, normalize rate/mode as one supported pair, and apply it through the existing updateTimeState patch with the semantic label Change SMPTE Format in packages/blue-app/src/renderer/components/workbench/panels/score/RulerConfigDialog.tsx and packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx.

**Checkpoint**: Ruler, transport, marker, piano-roll, and score-object displays agree for a selected project format; existing content positions and durations remain unchanged.

---

## Phase 4: User Story 2 - Enter Valid Timecode and Snap to Physical Frames (Priority: P1)

**Goal**: Reject invalid or mismatched labels, preserve exact frame-start round trips, and snap edits to the physical frame grid through tempo changes.

**Independent Test**: Exercise valid and invalid boundary labels at each supported rate, test extended hours and 24-hour-plus values, and compare floor/nearest snap results on both constant and changing tempo maps while switching DF/NDF.

### Verification for User Story 2

- [X] T023 [P] [US2] Cover rejected skipped DF labels, wrong separators, negative/non-finite/trailing input, invalid fields, valid frame 29 in NDF, exact-start round trips, and 24-hour-plus entry in packages/blue-app/src/renderer/tests/time-unit-logic.test.ts.
- [X] T024 [P] [US2] Add focused floor/nearest physical-frame snap tests proving the grid is identical in DF and NDF and uses exact rational rates in packages/blue-app/src/renderer/tests/snap-grid-utils.test.ts.
- [X] T025 [P] [US2] Add integration cases for snap results before and after tempo changes in score, marker, and automation paths in packages/blue-app/src/renderer/tests/smpte-frame-snap.test.ts.

### Implementation for User Story 2

- [X] T026 [US2] Keep invalid SMPTE text from committing or falling back to the previous value; show a field-level validation message in packages/blue-app/src/renderer/components/workbench/panels/score-object/TimeUnitEditor.tsx, packages/blue-app/src/renderer/components/workbench/panels/MarkersPanel.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score/TempoMapEditorDialog.tsx.
- [X] T027 [US2] Add the FRAME-specific beat-to-seconds-to-physical-frame-to-seconds-to-beat snap branch while retaining musical, TIME, SAMPLE, and AUTO behavior in packages/blue-app/src/renderer/components/workbench/panels/score/snap-grid-utils.ts and packages/blue-data/src/time/snap-value.ts.
- [X] T028 [US2] Wire the full-tempo-map frame snap operation through score canvases, ruler selection, marker editing, and tempo-map utilities in packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/useScoreRulerSelection.ts, packages/blue-app/src/renderer/components/workbench/panels/score/MarkersBar.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score/tempo-map-utils.ts.
- [X] T029 [US2] Wire physical-frame snapping through automation overlays and line utilities without changing sample-frame units in packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLayerOverlay.tsx, packages/blue-app/src/renderer/components/workbench/panels/score/automation/MultiLineOverlay.tsx, and packages/blue-app/src/renderer/components/workbench/panels/score/automation/automation-line-utils.ts.
- [X] T030 [US2] Derive visible SMPTE frame-grid marks from integer physical frame indices at a display-appropriate stride in packages/blue-app/src/renderer/components/workbench/panels/score/ColumnHeader.tsx.

**Checkpoint**: Invalid labels leave content unchanged, exact starts retain their labels, and all FRAME snapping follows the same physical grid across supported tempos and counting modes.

---

## Phase 5: User Story 3 - Save, Reopen, and Undo Timecode Settings (Priority: P1)

**Goal**: Persist project mode and defaults compatibly, validate updates atomically, and preserve canonical state, identities, dirty state, and playback position through history.

**Independent Test**: Load legacy and new XML, copy project state, change format, save/reopen, commit→undo→redo, and verify mode, unrelated data, identity, dirty state, and current playback timing.

### Verification for User Story 3

- [X] T031 [P] [US3] Add project load/save compatibility cases for absent mode, explicit DF, legacy 29.97df and 30df tokens, malformed rates, and unrelated unknown XML in packages/blue-data/src/blue-data-root-compatibility.test.ts.
- [X] T032 [P] [US3] Add copy/history-copy cases proving mode survives and opaque unknown XML nodes are cloned without mutable aliasing in packages/blue-data/src/blue-data-history-copy.test.ts.
- [X] T033 [P] [US3] Test defaultSmpteDropFrame=false, missing old preference migration to NDF, and supported rate/mode validation in packages/blue-app/src/shared/program-settings.test.ts.
- [X] T034 [P] [US3] Test that new-project creation seeds the selected default pair while opening an existing project does not apply defaults in packages/blue-app/src/main/program-settings-application.test.ts.
- [X] T035 [P] [US3] Test that unsupported submitted pairs reject updateTimeState atomically, NDF-only rate changes include smpteDropFrame:false, and canceled/no-op dialogs add no history in packages/blue-app/src/renderer/tests/ruler-config-update.test.ts and packages/blue-app/src/renderer/tests/panel-dialog-dismissal.test.tsx.
- [X] T036 [P] [US3] Extend the ProjectHistory commit→undo→redo test to verify canonical format restoration, stable score/marker identities, clean/dirty state, snapshot publication, and playback position in packages/blue-app/src/main/project-history-roundtrip.test.ts.

### Implementation for User Story 3

- [X] T037 [US3] Validate the effective rate/mode pair before any updateTimeState mutation and reject invalid patches without changing unrelated TimeState fields in packages/blue-app/src/shared/project-editor/patch-score.ts.
- [X] T038 [US3] Add defaultSmpteDropFrame with false migration and supported-pair recovery/validation in packages/blue-app/src/shared/program-settings.ts and packages/blue-app/src/renderer/utils/program-settings-defaults.ts.
- [X] T039 [US3] Add project-default mode selection and visibly normalize DF to NDF when the selected rate does not support DF in packages/blue-app/src/renderer/components/settings/ProjectDefaultsSettings.tsx.
- [X] T040 [US3] Seed the new-project TimeState with both validated default fields without applying preferences to opened projects in packages/blue-app/src/main/program-settings-application.ts.
- [X] T041 [US3] Keep score, conversion-context, and toolbar transport snapshots in sync on format commit and rollback while retaining the current playback position in packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx and packages/blue-app/src/renderer/stores/playback-store.ts.

**Checkpoint**: Project XML and copies retain format, legacy projects recover as NDF, defaults affect only new projects, and format changes undo/redo through canonical ProjectHistory without retiming content or playback.

---

## Phase 6: User Story 4 - Understand and Audit the Correction (Priority: P2)

**Goal**: Explain the corrected behavior to users and leave a public, license-aware audit trail for the implementation.

**Independent Test**: Review the Time chapter and release note against the independent examples; verify public links, rule sections, access date, and implementation provenance are recorded.

- [X] T042 [P] [US4] Explain rational fractional rates, DF label omissions, matching separators, extended hours, and unchanged stored timing in docs/manual/time.qmd.
- [X] T043 [P] [US4] Update the M18 history row to distinguish its earlier label-only repair from standards-based NDF/DF behavior in specs/114-integrate-blue-manual/manual-issues.md.
- [X] T044 [P] [US4] Prepare a user-facing release-note entry with one skipped-minute and one tenth-minute example in specs/115-smpte-timecode/release-notes.md.
- [X] T045 [US4] Record the implementation provenance review, public URLs and rule sections, access date, independent derivation, and no-source-adaptation/license check in specs/115-smpte-timecode/research.md.

**Checkpoint**: User documentation, release notes, M18 history, and implementation provenance describe the same corrected contract.

---

## Phase 7: Polish and Cross-Cutting Validation

**Purpose**: Complete the quickstart's deterministic manual checks and repository validation.

- [X] T046 Complete and record the manual project/UI checks for legacy loading, rate/mode switching, save/reopen, history, active playback, tempo changes, 24-hour-plus labels, piano-roll origin, and sample-frame distinction in specs/115-smpte-timecode/quickstart.md.
- [X] T047 Run the focused and full commands listed in specs/115-smpte-timecode/quickstart.md, including @blue/data and @blue/app tests/builds, renderer TypeScript, pnpm test, pnpm lint, and git diff --check.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No setup work; the existing workspace and test harness are used.
- **Foundational (Phase 2)**: Complete before user-story implementation. T001, T003, and T007 can begin in parallel; their corresponding implementation tasks follow their regressions.
- **User Stories (Phases 3–6)**: US1 and US2 depend on the foundation. US2 follows US1 because both integrate the shared entry/display path and score components. US3 follows US1's format controls and may be developed alongside US2's isolated snap work after the shared UI integration is settled. US4 follows the behavior and persistence stories so its docs describe the implemented contract.
- **Polish (Phase 7)**: Depends on the desired user stories and documentation being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2. Delivers project rate/mode selection and matching displays.
- **US2 (P1)**: Starts after Phase 2 and shared US1 entry/display integration. Its frame-snap implementation depends on T024/T025's regressions and the stable tempo inverse.
- **US3 (P1)**: Starts after Phase 2 and US1 format controls. Its XML, defaults, atomic patch, and history tests are independently verifiable within this phase.
- **US4 (P2)**: Starts after US1–US3 so manual text, release notes, and provenance can reflect the delivered behavior.

### Within Each User Story

- Complete verification tasks before their corresponding implementation tasks.
- Keep durable format mutations on the existing typed updateTimeState and ProjectHistory path with the semantic label Change SMPTE Format.
- Preserve modeled state, unknown XML, stable identities, dirty state, canonical publication, and playback position in XML/copy/history verification.
- Keep the data conversion module host-neutral and its test expectations independent of the implementation's arithmetic.

### Parallel Opportunities

- After foundation, US1 verification tasks T009, T010, T011, T012, T013, T014, and T015 touch separate test files and can be authored in parallel.
- Within US1, formatter, header, marker, and piano-roll implementation tasks T017, T018, T019, and T021 can proceed independently after their tests; T020 may proceed with those tasks after its own editor tests; coordinate T022 where ScorePanel props overlap.
- In US2, T024 and T025 are separate snap-unit and integration test files. After T027, automation work T029 can proceed alongside score/ruler wiring T028; T030 follows the ColumnHeader formatter work.
- In US3, T031–T036 target distinct data, settings, patch, dialog, and history test files and can be prepared in parallel after US1's UI integration.
- In US4, T042–T044 target distinct documentation files and can proceed in parallel; complete T045 against the final converter and review.

### Parallel Example: User Story 1

```text
After Phase 2, prepare T009, T010, T011, T012, T013, T014, and T015 in parallel.
Then implement the converter consumers in T016, T017, T018, T019, T020, and T021 after their corresponding verification; finish with the rate/mode dialog integration in T022.
```

### Parallel Example: User Story 2

```text
After US1, prepare T023, T024, and T025 in parallel.
Implement strict entry handling and physical snapping after those regressions; wire score and automation consumers only after T027.
```

### Parallel Example: User Story 3

```text
After US1, prepare T031, T032, T033, T034, T035, and T036 in parallel.
Then implement atomic patch validation, preference defaults, new-project seeding, and publication/rollback in T037–T041.
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 2: Foundational conversion, TimeState, snapshot, and tempo-map work.
2. Complete Phase 3: User Story 1 rate/mode selection and display agreement.
3. Stop and validate the independent 29.97 NDF/DF examples across transport, ruler, marker, piano-roll, and score-object surfaces.
4. Continue with frame-safe entry/snapping, persistence/history, then user and provenance documentation.

### Incremental Delivery

1. Foundation plus US1 delivers selectable format with consistent display.
2. US2 adds strict timecode entry and physical-frame snapping through tempo changes.
3. US3 adds durable compatibility, new-project defaults, atomic validation, and verified undo/redo.
4. US4 documents user-visible behavior and implementation provenance.
5. Run the quickstart manual checks and repository validation before handoff.

## Completion Report Inputs

- **Task count**: 51 total (47 initial + 2 convergence + 2 UI refinements); US1: 14, US2: 8, US3: 11, US4: 4; foundation: 8; polish: 2.
- **Parallel opportunities**: Converter/TimeState/tempo tests, independent user-story verification files, isolated formatter/snap consumers, persistence/default/history tests, and separate docs files as listed above.
- **Independent test criteria**: Each story's Independent Test states its standalone validation; see Phases 3–6.
- **Suggested MVP**: User Story 1 after the foundational phase.
- **Format validation**: Every checklist entry uses checkbox, sequential task ID, only justified [P] markers, required story labels within story phases, and one or more exact repository paths.

## Phase 8: Convergence

- [X] T048 Pass canonical smpteDropFrame alongside smpteFrameRate into TempoMapEditorDialog from packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx; add a caller-level regression proving a DF project displays 60.060 seconds as 00:01:00;02, accepts that DF label, rejects NDF punctuation and skipped labels without a durable edit, and retains the mode after history/reopen per FR-005, FR-006, SC-002, and T020 (partial).
- [X] T049 Refresh the snapBeat callback when frameSnapContext changes in packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/TrackLayerGroupCanvas.tsx; add a rendered track-gesture regression that changes only later tempo points while meter-map identity, initial tempo, rate, zoom, and snap settings remain stable, proving floor/nearest snapping immediately uses the new physical-frame grid during optimistic publication (29.97, beat 30 changing from 60 to 120 BPM: nearest beat 90.13 snaps to 90.12 rather than 90.12336666666667) per FR-008, plan: full-tempo-map frame snap integration, and T028 (partial).

## UI refinement

- [X] T050 Replace separate rate/mode selectors in RulerConfigDialog and ProjectDefaultsSettings with one SMPTE Format selector containing ten valid pairs; reuse the option list, retain atomic numeric/Boolean updates, update FR-001 and the manual, and cover dialog selection plus saved defaults in the existing rendered suites.

- [X] T051 Add a nested SMPTE format submenu to both Playhead channels using shared valid choices, check the canonical pair only for an explicit SMPTE readout, switch the selected readout to SMPTE, and submit Change SMPTE Format through the document bridge; verify rendered menu selection/current-format selection and retain existing history/live-clock coverage.
