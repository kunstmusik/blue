# Tasks: Program Settings Parity

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/program-settings-surface.md, quickstart.md
**Tests**: Required by FR-029. Test tasks are included before implementation tasks in each phase.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the foundational program-settings model and IPC contract are in place.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on an incomplete task.
- **[Story]**: User-story label from the feature spec. Setup, foundational, and polish tasks do not use story labels.
- Every task includes an exact file path.

---

## Phase 1: Setup (Shared Structure)

**Purpose**: Create the program-settings modules and renderer panel files that later phases fill in.

- [x] T001 Create shared Program Settings type/default module in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/program-settings.ts`
- [x] T002 Create main-process Program Settings store module skeleton in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.ts`
- [x] T003 Create main-process new-project settings application module skeleton in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.ts`
- [x] T004 Create main-process runtime usage and parity-matrix module skeleton in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`
- [x] T005 [P] Create reusable settings layout section component in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsSection.tsx`
- [x] T006 [P] Create Project Defaults settings panel placeholder in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/ProjectDefaultsSettings.tsx`
- [x] T007 [P] Create Playback settings panel placeholder in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/PlaybackSettings.tsx`
- [x] T008 [P] Create Utility settings panel placeholder in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/UtilitySettings.tsx`
- [x] T009 [P] Create Realtime Render settings panel placeholder in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx`
- [x] T010 [P] Create Disk Render settings panel placeholder in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/DiskRenderSettings.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the shared snapshot, persistence, validation, IPC, and base parity matrix required by every user story.

**Checkpoint**: No user story work should start until this phase is complete.

### Tests

- [x] T011 [P] Add shared defaults, platform choices, validation, and reset tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/program-settings.test.ts`
- [x] T012 [P] Add main-process load/save/migration/reset tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.test.ts`
- [x] T013 [P] Add Settings BrowserWindow singleton and IPC channel tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/settings-window.test.ts`
- [x] T014 [P] Add preload API contract tests for program settings methods in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/settings-window.test.tsx`

### Implementation

- [x] T015 Implement `ProgramSettingsSnapshot`, panel ids, choice lists, Java-compatible defaults, and validation issue types in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/program-settings.ts`
- [x] T016 Implement default merging, invalid-value recovery, panel reset, and atomic JSON persistence in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.ts`
- [x] T017 Wire `program-settings:get`, `program-settings:save`, `program-settings:reset-panel`, `program-settings:usage-matrix`, and `program-settings:sync-legacy-renderer-settings` IPC handlers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T018 Expose typed `window.blueAPI` program settings methods in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/preload.ts`
- [x] T019 Update shared preload-facing declarations for the new program settings APIs in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T020 Keep Settings window open/focus behavior singleton-safe while loading program settings without a project in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/settings-window.ts`
- [x] T021 Implement the initial usage-matrix registry with every panel, stale Text Settings classification, and missing-feature dependency ids in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`

---

## Phase 3: User Story 1 - Edit Every Active Java Blue Settings Panel (Priority: P1)

**Goal**: The Settings window exposes exactly the six active Java Blue panels, every option is editable with validation, and Apply/Cancel persistence works without a loaded project.

**Independent Test**: Open Settings with no project loaded, edit one value in General, Project Defaults, Playback, Utility, Realtime Render, and Disk Render, apply, reopen, and verify the saved values. Then edit several fields, cancel, reopen, and verify the previous saved values remain.

### Tests for User Story 1

- [x] T022 [P] [US1] Add renderer test for active category inventory, excluding stale Text Settings and prior MIDI/OSC placeholders, in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/program-settings-window.test.tsx`
- [x] T023 [P] [US1] Add renderer test for apply, cancel, invalid numeric fields, and panel reset behavior in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/program-settings-window.test.tsx`
- [x] T024 [P] [US1] Add main-process save validation test for all Java panel field groups in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.test.ts`

### Implementation for User Story 1

- [x] T025 [US1] Replace the current Settings category model with General, Project Defaults, Playback, Utility, Realtime Render, and Disk Render in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`
- [x] T026 [US1] Add draft loading, dirty tracking, Apply, Cancel, validation issue display, and reset-panel dispatch in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`
- [x] T027 [US1] Extend shared settings controls for booleans, text paths/commands, numeric fields, enum selects, dependent enable/value rows, and inline validation in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsField.tsx`
- [x] T028 [US1] Implement the General panel fields and Java defaults display in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/GeneralSettings.tsx`
- [x] T029 [US1] Implement the Project Defaults panel fields, TimeBase choices, SnapValue choices, layer height choices, UDO style choices, and SMPTE frame-rate choices in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/ProjectDefaultsSettings.tsx`
- [x] T030 [US1] Implement the Playback panel fields for FPS, latency correction, follow playback, and follow-on-start in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/PlaybackSettings.tsx`
- [x] T031 [US1] Implement the Utility panel fields with platform-specific executable and freeze-flag defaults in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/UtilitySettings.tsx`
- [x] T032 [US1] Implement the Realtime Render panel with Java-compatible sr, ksmps, nchnls, 0dbfs, audio/MIDI driver, device, buffer, message flag, display, advanced, and render-method controls in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx`
- [x] T033 [US1] Implement the Disk Render panel with Java-compatible sr, ksmps, nchnls, 0dbfs, file/sample format, header, dither, message flag, display, advanced, render-method, render-and-play, and render-and-open controls in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/DiskRenderSettings.tsx`
- [x] T034 [US1] Render non-blocking dependency notes for fields whose consumers are not yet implemented by reading usage-matrix entries in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsSection.tsx`

**Checkpoint**: User Story 1 is complete when Settings can be used without a loaded project and all six active Java panels persist valid applied values while cancel discards drafts.

---

## Phase 4: User Story 2 - Create New Projects From Program Defaults (Priority: P1)

**Goal**: New projects are initialized from program Project Defaults, Realtime Render defaults, and Disk Render defaults without serializing app settings into `.blue` files.

**Independent Test**: Change project-default, realtime-render, and disk-render settings, create a new project, and verify the project author, mixer state, score time state, realtime properties, disk properties, and future-create defaults reflect the saved program settings.

### Tests for User Story 2

- [x] T035 [P] [US2] Add unit tests for applying Project Defaults to a new `BlueData` instance in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.test.ts`
- [x] T036 [P] [US2] Add unit tests for applying Realtime Render and Disk Render defaults to a new `BlueData` instance in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.test.ts`
- [x] T037 [P] [US2] Add regression test proving program settings are not serialized as app settings in new project XML in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.test.ts`
- [x] T038 [P] [US2] Add integration-style test for `newFile()` using saved program settings in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-new-file.test.ts`

### Implementation for User Story 2

- [x] T039 [US2] Implement `applyProgramSettingsToNewProject()` for author, mixer enabled state, layer height default, score ruler state, snap state/value, SMPTE frame rate, realtime properties, and disk properties in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.ts`
- [x] T040 [US2] Call `applyProgramSettingsToNewProject()` from the new project creation path before project snapshots are published in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T041 [US2] Ensure project editor snapshots expose the program-seeded project fields needed by renderer verification in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T042 [US2] Apply or classify Default UDO Style for new UDO/effect creation paths in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/mixer-effects-library.ts`
- [x] T043 [US2] Record any project-default field that cannot yet be applied as a missing-feature dependency rather than silently ignoring it in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`

**Checkpoint**: User Story 2 is complete when a changed settings snapshot can seed a new project and a saved `.blue` file contains only normal Java-compatible project values.

---

## Phase 5: User Story 3 - Use Program Settings In Runtime Behavior (Priority: P1)

**Goal**: Runtime workflows consume saved program settings wherever equivalent workflows exist, and unavailable workflows are classified instead of treated as complete.

**Independent Test**: Save changed realtime, playback, disk, utility, and general settings; start realtime playback or inspect generated command options; verify playhead follow/latency behavior; generate disk output or inspect disk render classification; inspect utility classifications for unavailable workflows.

### Tests for User Story 3

- [x] T044 [P] [US3] Add deterministic realtime option generation tests for General and Realtime Render settings in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts`
- [x] T045 [P] [US3] Add playback FPS, latency correction, follow playback, and follow-on-render-start tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/playback-settings-parity.test.ts`
- [x] T046 [P] [US3] Add disk render and utility workflow usage-status tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts`
- [x] T047 [P] [US3] Add render command integration tests for program settings option ordering in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-command.test.ts`

### Implementation for User Story 3

- [x] T048 [US3] Implement `buildRealtimeEngineOptions()` with deterministic Java-compatible ordering in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`
- [x] T049 [US3] Feed saved Program Settings into realtime playback command/options construction in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T050 [US3] Merge project-level render flags with program-level realtime executable, driver, device, buffer, display, message color, and advanced settings in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-command.ts`
- [x] T051 [US3] Pass resulting realtime options through the existing engine launch path without bypassing `blue-engine` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/engine-bridge.ts`
- [x] T052 [US3] Hydrate playback store defaults from Program Settings and apply latency correction when converting engine time to score time in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/playback-store.ts`
- [x] T053 [US3] Sync toolbar/native follow-playback changes with the saved Playback settings or a documented runtime preference field in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/application-menu.ts`
- [x] T054 [US3] Apply available Disk Render settings to CSD export or disk-render helper boundaries and mark missing full execution behavior in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/csd-export.ts`
- [x] T055 [US3] Mark Utility Csound executable, freeze flags, SoundObject freeze, and SoundFont inspection consumers as used or blocked by named dependencies in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`
- [x] T056 [US3] Apply General message color, work-directory, temp-file limit, new-user-defaults, and Csound error warning consumers where workflows exist and classify unavailable consumers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`

**Checkpoint**: User Story 3 is complete when each runtime-affecting setting either changes a current workflow in tests or appears in the usage matrix with a named missing-feature dependency.

---

## Phase 6: User Story 4 - Preserve And Classify Existing Current-App Settings (Priority: P2)

**Goal**: Existing app-specific settings remain available and do not conflict with the Java-compatible program settings model.

**Independent Test**: Start with persisted current-app engine path, recent files, window bounds, MIDI placeholder values, and OSC placeholder values; load the expanded model; verify values are migrated, retained, or explicitly deprecated with documented precedence.

### Tests for User Story 4

- [x] T057 [P] [US4] Add migration tests for engine path, recent files, window bounds, MIDI placeholders, and OSC placeholders in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/program-settings-migration.test.tsx`
- [x] T058 [P] [US4] Add current app retention and precedence tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/settings-store.test.tsx`
- [x] T059 [P] [US4] Add main-process legacy sync tests for `syncLegacyRendererSettings` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.test.ts`

### Implementation for User Story 4

- [x] T060 [US4] Add `CurrentAppSettingsSnapshot` support and legacy merge precedence to the persisted settings model in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.ts`
- [x] T061 [US4] Expose retained app-specific values without reintroducing MIDI/OSC as Java Blue settings panels in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/settings-store.ts`
- [x] T062 [US4] Sync legacy renderer-local settings to the main Program Settings store during renderer startup in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`
- [x] T063 [US4] Add app-specific retained setting labels and migration decision display inside the Settings surface without adding a seventh Java category in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`
- [x] T064 [US4] Classify retained engine path, recent files, window bounds, MIDI placeholder values, and OSC placeholder values in the usage matrix in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`

**Checkpoint**: User Story 4 is complete when existing app-specific preferences survive migration and the Settings UI no longer presents them as active Java `blue-settings` panels.

---

## Phase 7: User Story 5 - Report Missing Feature Dependencies (Priority: P2)

**Goal**: Every Java Blue setting has a usage status, stale Text Settings are reported as resource-only, and unavailable Java workflows are named with follow-up scope.

**Independent Test**: Review the usage parity matrix and missing-feature report; confirm every setting from FR-004 through FR-015 is marked used, new-project default, app-specific retained, resource-only/stale, or blocked by a named follow-up feature.

### Tests for User Story 5

- [x] T065 [P] [US5] Add coverage test asserting every FR-004 through FR-015 setting key appears exactly once in the usage matrix in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts`
- [x] T066 [P] [US5] Add stale Text Settings and missing-feature dependency report tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts`
- [x] T067 [P] [US5] Add renderer test showing blocked settings remain editable with dependency notes in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/program-settings-window.test.tsx`

### Implementation for User Story 5

- [x] T068 [US5] Complete usage matrix entries for every General, Project Defaults, Playback, Utility, Realtime Render, and Disk Render setting in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`
- [x] T069 [US5] Add stale Text Settings matrix entries with `resource-only-stale` status in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`
- [x] T070 [US5] Add named missing-feature dependencies for Disk Render Execution, Utility Freeze/Unfreeze, SoundFont Utility, Device Discovery/Render Method Selection, General Work Directory Consumers, New User Defaults, and Csound Error Warning in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.ts`
- [x] T071 [US5] Surface missing-feature dependency notes from the matrix in each affected settings panel in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/SettingsSection.tsx`
- [x] T072 [US5] Produce the implementation missing-feature report from the final matrix in `/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/missing-feature-report.md`

**Checkpoint**: User Story 5 is complete when the matrix and report classify 100% of active Java settings plus stale Text Settings resources.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole feature and update project context after the independently testable stories are complete.

- [x] T073 [P] Update implementation notes and validation results in `/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/quickstart.md`
- [x] T074 [P] Update generated agent context if implementation changes technology or paths in `/Users/stevenyi/work/blue-electron/AGENTS.md`
- [x] T075 Run focused Program Settings test suite for `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.test.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.test.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/program-settings-window.test.tsx`
- [x] T076 Run `pnpm --filter @blue/app test` from `/Users/stevenyi/work/blue-electron`
- [x] T077 Run `pnpm --filter @blue/app build` from `/Users/stevenyi/work/blue-electron`
- [x] T078 Run `pnpm --filter @blue/data test` from `/Users/stevenyi/work/blue-electron` if User Story 2 touches `@blue/data` behavior
- [x] T079 Run `git diff --check` from `/Users/stevenyi/work/blue-electron`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2.
- **User Story 2 (Phase 4)**: Depends on Phase 2; can be developed in parallel with US1 after the shared model exists, but final verification benefits from US1 because the UI edits the defaults.
- **User Story 3 (Phase 5)**: Depends on Phase 2; can be developed in parallel with US1/US2 using direct test snapshots.
- **User Story 4 (Phase 6)**: Depends on Phase 2; integrates with US1 Settings surface but migration tests can start independently.
- **User Story 5 (Phase 7)**: Depends on Phase 2 and should be finalized after US2/US3/US4 classify actual consumers.
- **Polish**: Depends on all selected user stories.

### User Story Dependencies

- **US1 (P1)**: Independent after foundation; delivers the editable settings surface.
- **US2 (P1)**: Independent after foundation with direct helper tests; final user demo uses US1 to change settings.
- **US3 (P1)**: Independent after foundation with direct settings snapshots; classifies missing runtime workflows.
- **US4 (P2)**: Independent after foundation; requires coordination with US1 to keep category count exact.
- **US5 (P2)**: Depends on final consumer decisions from US2, US3, and US4 for accurate statuses.

### Within Each User Story

- Write tests first and confirm they fail for the missing behavior.
- Implement shared model/service code before wiring UI or runtime consumers.
- Complete story-specific verification before moving to the next priority story when working sequentially.
- Update the usage matrix whenever a setting is implemented or intentionally blocked.

---

## Parallel Opportunities

- T005 through T010 can run in parallel after the shared skeleton tasks start.
- T011 through T014 can run in parallel because they target distinct test files.
- US1 panel implementations T028 through T033 can run in parallel after T025 through T027.
- US2 tests T035 through T038 can run in parallel before T039.
- US3 tests T044 through T047 can run in parallel before runtime wiring.
- US4 tests T057 through T059 can run in parallel before migration implementation.
- US5 tests T065 through T067 can run in parallel once the base usage-matrix API exists.
- T073 and T074 can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
# After Phase 2, different developers or agents can split the six panel files:
Task: "T028 [US1] Implement the General panel fields in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/GeneralSettings.tsx"
Task: "T029 [US1] Implement the Project Defaults panel fields in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/ProjectDefaultsSettings.tsx"
Task: "T032 [US1] Implement the Realtime Render panel fields in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/RealtimeRenderSettings.tsx"
Task: "T033 [US1] Implement the Disk Render panel fields in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/settings/DiskRenderSettings.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T035 [US2] Add Project Defaults application tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.test.ts"
Task: "T036 [US2] Add Realtime/Disk defaults application tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.test.ts"
Task: "T037 [US2] Add XML non-persistence regression tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-application.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T044 [US3] Add realtime option generation tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-usage.test.ts"
Task: "T045 [US3] Add playback settings tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/playback-settings-parity.test.ts"
Task: "T047 [US3] Add render command integration tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/main/render-command.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 so all six active Java panels can be edited and persisted.
3. Stop and validate US1 independently with Settings opened before any project is loaded.

### Priority P1 Completion

1. Add US2 so Settings values seed new projects.
2. Add US3 so runtime workflows consume settings or classify blocked dependencies.
3. Validate P1 by changing settings, creating a project, starting playback, and inspecting command/options behavior.

### Full Feature Completion

1. Add US4 migration/retention for current app settings.
2. Add US5 final matrix and missing-feature report.
3. Run the Final Phase validation commands and update quickstart evidence.

---

## Notes

- Text Settings resource strings are not an active Java panel and must remain classified as `resource-only-stale`.
- MIDI and OSC placeholder settings from the current app are retained as app-specific preferences, not promoted into active Java `blue-settings` panels.
- Disk render execution, utility freeze/unfreeze, SoundFont utility, device discovery/render-method selection, work-directory consumers, new-user defaults, and Csound error warnings must be implemented where current workflows exist or named in the missing-feature report. Alpha marquee is intentionally excluded as a legacy Swing-only presentation option.
