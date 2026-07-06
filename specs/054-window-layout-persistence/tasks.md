# Tasks: Window Layout Persistence

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/window-layout-settings.md`, `quickstart.md`
**Feature Branch**: `054-window-layout-persistence`

**Tests**: Required by FR-025. Each behavior phase starts with failing tests before implementation tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because the task touches independent files.
- **[Story]**: User story covered by the task, for example `[US1]`.
- Include exact file paths in every task.

## Phase 1: Setup

**Purpose**: Establish compile targets and test files for the layout settings slice.

- [X] T001 Create minimal shared layout settings exports in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/window-layout-settings.ts`.
- [X] T002 Create minimal main-process layout settings store exports in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-layout-store.ts`.
- [X] T003 Create minimal main-process window state manager exports in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-state-manager.ts`.
- [X] T004 Create minimal renderer layout settings store exports in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/layout-settings-store.ts`.
- [X] T005 [P] Add shared layout settings test file at `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/window-layout-settings.test.ts`.
- [X] T006 [P] Add main layout store test file at `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-layout-store.test.ts`.
- [X] T007 [P] Add main window state manager test file at `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-state-manager.test.ts`.
- [X] T008 [P] Add renderer layout settings test file at `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/layout-settings-store.test.ts`.

---

## Phase 2: Foundation - Settings Contract And IPC

**Purpose**: Build the versioned app-wide layout settings contract before story-specific UI behavior.

**Tests first**

- [X] T009 Write failing defaults, validation, merge, reset, and clamp-helper tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/window-layout-settings.test.ts`.
- [X] T010 Write failing program-settings default merge tests for `appSpecific.windowLayout` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/program-settings.test.ts`.
- [X] T011 Write failing main store load/save/update/reset/idempotent-migration tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-layout-store.test.ts`.
- [X] T012 Write failing preload/API type exposure coverage for layout methods in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/types/global.d.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/layout-settings-store.test.ts`.

**Implementation**

- [X] T013 Implement `WindowLayoutSettingsSnapshot`, `WindowId`, `SplitId`, defaults, merge, validation, and reset helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/window-layout-settings.ts`.
- [X] T014 Extend `ProgramSettingsSnapshot.appSpecific` defaults and merge behavior for `windowLayout` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/program-settings.ts`.
- [X] T015 Implement durable layout update/reset operations over the existing program settings store in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-layout-store.ts`.
- [X] T016 Wire layout IPC handlers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`.
- [X] T017 Expose `getProgramSettings`, `updateWindowLayout`, `resetWindows`, and `onWindowLayoutReset` through `/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/preload.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/types/global.d.ts`.

**Checkpoint**

- [X] T018 Run the shared/main foundation tests from `/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/quickstart.md` and confirm T009-T012 fail before T013-T017 and pass after implementation.

---

## Phase 3: User Story 1 - Restore Window Size And Location

**Goal**: Persist and restore the main window plus currently implemented app-owned secondary windows.

**Independent Test**: Move and resize each in-scope window, close/reopen or restart, and verify valid saved normal bounds and display state restore before show.

**Tests first**

- [X] T019 [P] [US1] Write failing bounds validation, offscreen rejection, minimum size, maximized, and fullscreen tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-state-manager.test.ts`.
- [X] T020 [P] [US1] Write failing main window restore-before-show tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-state-manager.test.ts`.
- [X] T021 [P] [US1] Write failing Settings window bounds save/restore tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/settings-window.test.ts`.
- [X] T022 [P] [US1] Write failing effect editor and effect interface bounds save/restore tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/effect-editor-window-manager.test.ts`.

**Implementation**

- [X] T023 [US1] Implement BrowserWindow attach/capture/restore helpers in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-state-manager.ts`.
- [X] T024 [US1] Apply persisted `main` window bounds before the window is shown in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`.
- [X] T025 [US1] Attach the `settings` window identity to Settings BrowserWindow creation and lifecycle saves in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/settings-window.ts`.
- [X] T026 [US1] Attach `effect-editor` and `effect-interface` identities to effect window creation and lifecycle saves in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/effect-editor-window-manager.ts`.
- [X] T027 [US1] Persist normal bounds and display state on user-driven move, resize, maximize, fullscreen, unmaximize, leave-fullscreen, and close events in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-state-manager.ts`.

**Checkpoint**

- [X] T028 Run `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/window-layout-store.test.ts src/main/window-state-manager.test.ts src/main/settings-window.test.ts src/main/effect-editor-window-manager.test.ts --browser.enabled=false` from `/Users/stevenyi/work/blue-electron`.

---

## Phase 4: User Story 2 - Persist Split Locations With 200px Defaults

**Goal**: Persist every user-adjustable workbench and editor split as a controlled-pane pixel size with 200px defaults.

**Independent Test**: Start clean, verify representative side and bottom splits default to 200px, resize them, restart or reopen, and verify exact saved pixel sizes restore.

**Tests first**

- [X] T029 [P] [US2] Write failing 200px auxiliary default and app-wide persistence tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/workbench-auxiliary.test.ts`.
- [X] T030 [P] [US2] Write failing workbench layout migration and save/load tests for `blue-workbench-layout` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/workbench-layout-persistence.test.ts`.
- [X] T031 [P] [US2] Write failing reusable `SplitPane` pixel default, save/restore, controlled-pane, and clamp-without-overwrite tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/orchestra-split-pane.test.tsx`.
- [X] T032 [P] [US2] Write failing editor-owned split persistence tests for LineObject, ZakLineObject, PatternObject, PianoRoll, BSB, UDO, and Effects Library surfaces in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/editor-split-persistence.test.tsx`.
- [X] T033 [P] [US2] Write failing renderer legacy `blue-settings.windowBounds` migration tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/use-ipc-listeners-layout-migration.test.ts`.

**Implementation**

- [X] T034 [US2] Implement renderer layout settings load/update/reset actions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/layout-settings-store.ts`.
- [X] T035 [US2] Replace renderer-only durable workbench storage with app-wide layout settings plus one-time localStorage migration in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx`.
- [X] T036 [US2] Change auxiliary left/right/bottom default controlled-pane sizes to 200px and persist them through `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/workbench-store.ts`.
- [X] T037 [US2] Extend `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/orchestra/SplitPane.tsx` with `splitId`, `controlledPane`, `defaultSizePx`, persisted pixel restore, debounced save, and display-only clamping.
- [X] T038 [US2] Add stable split IDs and controlled-pane defaults to Orchestra, Score, UDO, Effects Library, BSB, and Piano Roll split call sites under `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/`; BSB uses the documented 250px Java parity exception for the right property pane.
- [X] T039 [US2] Convert `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/LineObjectEditor.tsx` from local 280px state to persisted `line-object.lines` with a 200px controlled-pane default.
- [X] T040 [US2] Convert `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/ZakLineObjectEditor.tsx` from local 300px state to persisted `zak-line-object.lines` with a 200px controlled-pane default.
- [X] T041 [US2] Convert `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/PatternObjectEditor.tsx` to persisted `pattern-object.layers` and `pattern-object.score` splits with 200px controlled-pane defaults.
- [X] T042 [US2] Persist and restore the Piano Roll field/editor split in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/score-object/editors/PianoRollEditor.tsx`.
- [X] T043 [US2] Implement legacy `blue-settings.windowBounds` and `blue-workbench-layout` migration markers so stale localStorage cannot overwrite newer app-wide values in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/layout-settings-store.ts`.

**Checkpoint**

- [X] T044 Run `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/layout-settings-store.test.ts src/renderer/tests/workbench-layout-persistence.test.ts src/renderer/tests/workbench-auxiliary.test.ts src/renderer/tests/orchestra-split-pane.test.tsx src/renderer/tests/editor-split-persistence.test.tsx src/renderer/tests/use-ipc-listeners-layout-migration.test.ts --browser.enabled=false` from `/Users/stevenyi/work/blue-electron`.

---

## Phase 5: User Story 3 - Reset Windows To Defaults

**Goal**: Replace the narrower Reset Default Layout command with Java Blue-style Reset Windows that resets only layout state.

**Independent Test**: Save non-default windows, workbench layout, and splits; invoke Window > Reset Windows; verify defaults apply immediately and remain after restart while unrelated settings and dirty project state are untouched.

**Tests first**

- [X] T045 [P] [US3] Write failing native menu label and command routing tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/application-menu.test.ts`.
- [X] T046 [P] [US3] Write failing shared menu command type tests or compile coverage for `reset-windows` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/workbench-menu.ts`.
- [X] T047 [P] [US3] Write failing reset-preserves-unrelated-settings tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-layout-store.test.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/program-settings-store.test.ts`.
- [X] T048 [P] [US3] Write failing renderer reset event tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/workbench-store.test.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/workbench-layout-persistence.test.ts`.

**Implementation**

- [X] T049 [US3] Rename the Window menu item from `Reset Default Layout` to `Reset Windows` and route `{ type: 'reset-windows' }` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/application-menu.ts`.
- [X] T050 [US3] Update native menu command types and renderer command handling from `reset-layout` to `reset-windows` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/workbench-menu.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`.
- [X] T051 [US3] Implement reset persistence and broadcast behavior in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-layout-store.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`.
- [X] T052 [US3] Apply Reset Windows immediately to current workbench layout and split settings in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/workbench-store.ts`, `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/layout-settings-store.ts`, and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/WorkbenchShell.tsx`.
- [X] T053 [US3] Ensure Reset Windows does not invoke project save/discard or mutate project editor state in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`.

**Checkpoint**

- [X] T054 Run `pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/main/application-menu.test.ts src/main/window-layout-store.test.ts src/main/program-settings-store.test.ts src/renderer/tests/workbench-store.test.ts src/renderer/tests/workbench-layout-persistence.test.ts src/renderer/tests/use-ipc-listeners.test.tsx --browser.enabled=false` from `/Users/stevenyi/work/blue-electron`.

---

## Phase 6: User Story 4 - Prove Settings Persistence With TDD

**Goal**: Confirm the automated coverage required by FR-025 is complete and protects all layout persistence paths.

**Tests and hardening**

- [X] T055 [US4] Add final valid-settings round-trip coverage for every in-scope window identity and representative split identity in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/window-layout-store.test.ts`.
- [X] T056 [US4] Add final invalid-value preservation coverage proving bad layout values are ignored without dropping unrelated settings in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/window-layout-settings.test.ts` and `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/program-settings.test.ts`.
- [X] T057 [US4] Add final legacy migration idempotence coverage for both known localStorage keys in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/layout-settings-store.test.ts`.
- [X] T058 [US4] Update `/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/quickstart.md` with any implementation-specific smoke notes or documented Java parity exceptions discovered during implementation.

---

## Phase 7: Polish And Cross-Cutting Validation

**Purpose**: Finish integration, run the required suites, and leave the branch ready for review.

- [X] T059 [P] Update `/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/data-model.md` if implementation changes any persisted field names or identity names.
- [X] T060 [P] Update `/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/contracts/window-layout-settings.md` if the final preload or native menu contract changes.
- [X] T061 Run the focused test command in `/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/quickstart.md`.
- [X] T062 Run `pnpm --filter @blue/app test` from `/Users/stevenyi/work/blue-electron`.
- [X] T063 Run `pnpm --filter @blue/app build` from `/Users/stevenyi/work/blue-electron`.
- [X] T064 Run `git diff --check` from `/Users/stevenyi/work/blue-electron`.
- [X] T065 Update `/Users/stevenyi/work/blue-electron/STATUS.md` and `/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/status.md` with implementation results, validation output, and any follow-up risks.

---

## Dependencies

- Phase 1 must complete before tests import the new layout modules.
- Phase 2 must complete before US1, US2, or US3 can persist through the canonical settings contract.
- US1 depends on T013-T017 for settings storage and IPC.
- US2 depends on T013-T017 and T034 for renderer layout settings access.
- US3 depends on T015-T017 plus the US2 renderer reset path for immediate split/workbench reset.
- US4 depends on US1-US3 coverage being present.
- Phase 7 depends on all implementation phases.

## Parallel Examples

```bash
# After Phase 1, these test authoring tasks can proceed independently:
T019 T021 T029 T031 T045

# After foundation implementation, these story implementations are separable by area:
T024 T025 T026
T035 T037 T039 T040 T041
T049 T051
```

## Implementation Strategy

1. Complete Phase 1 and Phase 2 first so all layout data flows through one app-wide settings contract.
2. Implement US1 window bounds restore/save before split persistence, because main-process settings and reset behavior are the highest-risk durable path.
3. Implement US2 split persistence next, converting ratio/local split state to controlled-pane pixel saves while keeping clamping display-only.
4. Implement US3 reset last so it can clear and refresh all layout state introduced by US1 and US2.
5. Use Phase 6 and Phase 7 to prove FR-025 coverage and update handoff docs with actual validation results.
