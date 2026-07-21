# Tasks: App Zooming

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/061-app-zooming/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/app-zoom.md`, `quickstart.md`

**Tests**: The feature plan and quickstart require test-first coverage. Write each listed test task first, confirm the new assertions fail for the expected missing behavior, and then complete its paired implementation task.

**Organization**: Tasks are grouped by user story so each priority can be implemented and accepted as a distinct increment. Repository-relative paths below are rooted at `/Users/stevenyi/work/blue-electron`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same execution wave because it changes different files and has no dependency on their incomplete work
- **[Story]**: Maps the task to User Story 1, 2, or 3 from `spec.md`
- Every checklist item names the exact file or files it changes or validates

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Expose the existing Playwright/Electron tooling as a repeatable feature acceptance command without adding dependencies.

- [x] T001 Add a `verify:app-zoom` script that invokes the planned Electron acceptance driver in `packages/blue-app/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the exact browser-safe zoom value contract and app-settings field used by every user story.

**⚠️ CRITICAL**: No user story implementation begins until this phase is complete.

- [x] T002 Write failing exhaustive tests for the 26 legal percentages, malformed-value normalization, exact command stepping/clamping, Actual Size, and factor conversion in `packages/blue-app/src/shared/app-zoom.test.ts`
- [x] T003 Implement the static-import-only zoom constants, `AppZoomCommand` type, validator, normalizer, command resolver, and factor converter in `packages/blue-app/src/shared/app-zoom.ts`
- [x] T004 [P] Write failing tests for the 100% default, valid/off-step/invalid merge behavior, validation path, sibling preservation, and unchanged settings version in `packages/blue-app/src/shared/program-settings.test.ts`
- [x] T005 Add required `appSpecific.appZoomPercent` defaulting, merge normalization, and save validation without a version bump in `packages/blue-app/src/shared/program-settings.ts`

**Checkpoint**: Exact zoom arithmetic and a backward-compatible settings scalar are available to all story phases.

---

## Phase 3: User Story 1 - Adjust the Application Scale (Priority: P1) 🎯 MVP

**Goal**: Provide View > Zoom In, Zoom Out, and Actual Size with exact 10-point application scaling and conventional application-local shortcuts.

**Independent Test**: Start Blue at 100%, invoke each View item and its Command/Control shortcut while normal content and a CodeMirror editor have focus, and verify 110%, 100%, bounded 50%/300% behavior, and no inserted shortcut character.

### Tests for User Story 1

- [x] T006 [P] [US1] Write failing controller tests for initialization, exact Zoom In/Out/Actual Size transitions, absolute factors, boundary no-ops, and command results against one live window in `packages/blue-app/src/main/app-zoom-controller.test.ts`
- [x] T007 [P] [US1] Write failing menu tests for View placement between Edit and Project, item order/labels, `CommandOrControl+Plus`, `CommandOrControl+-`, `CommandOrControl+0`, custom callbacks, no zoom roles, and availability without a project in `packages/blue-app/src/main/application-menu.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Implement the injectable main-owned runtime state and exact command execution surface in `packages/blue-app/src/main/app-zoom-controller.ts`
- [x] T009 [US1] Add the top-level View menu and route its three custom items through new handler options in `packages/blue-app/src/main/application-menu.ts`
- [x] T010 [US1] Construct the app zoom controller and connect its commands to every application-menu rebuild without renderer IPC or focused-window dependence in `packages/blue-app/src/main/main.ts`

**Checkpoint**: User Story 1 is usable and independently testable as the MVP; existing project/timeline zoom controls remain unchanged.

---

## Phase 4: User Story 2 - Retain the Chosen Scale (Priority: P2)

**Goal**: Persist each changed scale, restore it before first visible main content, default invalid input safely, and keep runtime zoom effective when saving fails.

**Independent Test**: Select 130%, restart Blue, and verify the first visible main content is already 130%; repeat after Actual Size, invalid saved input, an induced write failure, and applying a Settings draft opened before a later zoom change.

### Tests for User Story 2

- [x] T011 [P] [US2] Write failing store tests for valid zoom round-trip, missing/malformed/off-step fallback to 100%, sibling preservation, and no eager version migration in `packages/blue-app/src/main/program-settings-store.test.ts`
- [x] T012 [P] [US2] Extend failing controller tests for changed-command writes, boundary no-write behavior, cloned snapshots, non-fatal persistence failure, later-command recovery, and stale full-Settings snapshot preservation in `packages/blue-app/src/main/app-zoom-controller.test.ts`

### Implementation for User Story 2

- [x] T013 [US2] Implement controller initialization from the normalized store, apply-before-save ordering, guarded cloned-snapshot persistence, failure results without rollback, and `preserveCurrentZoom` in `packages/blue-app/src/main/app-zoom-controller.ts`
- [x] T014 [US2] Initialize restored zoom before the first `createWindow()`, seed the main window through `webPreferences.zoomFactor`, and preserve controller zoom before `program-settings:save` in `packages/blue-app/src/main/main.ts`

**Checkpoint**: User Story 2 restores one durable app-profile preference without visible default-scale flash or loss from stale Settings drafts.

---

## Phase 5: User Story 3 - Use One Scale Across Blue Windows (Priority: P3)

**Goal**: Apply one scale to every open main, Settings, effect, and floating workbench window and to every Blue content window created afterward.

**Independent Test**: Open the main workbench, Settings, an effect editor/interface, and a Dockview popout; change zoom from a secondary focused window, verify all live windows update within 250 ms, then reopen each kind and verify its first visible content uses the current factor.

### Tests for User Story 3

- [x] T015 [P] [US3] Extend failing controller tests for all-window broadcasts, destroyed/failing-window isolation, continued persistence, and newly created window application in `packages/blue-app/src/main/app-zoom-controller.test.ts`
- [x] T016 [P] [US3] Write failing Settings factory tests for declarative initial zoom while preserving secure preferences and `show: false` behavior in `packages/blue-app/src/main/settings-window.test.ts`
- [x] T017 [P] [US3] Write failing effect editor/interface factory tests for declarative initial zoom while preserving existing modal, sizing, and security behavior in `packages/blue-app/src/main/effect-editor-window-manager.test.ts`

### Implementation for User Story 3

- [x] T018 [US3] Implement safe `applyToWindow` and `applyToAllWindows` behavior over live `BrowserWindow` instances with per-window failure isolation in `packages/blue-app/src/main/app-zoom-controller.ts`
- [x] T019 [P] [US3] Accept the current zoom factor in the Settings factory and pass it through `webPreferences.zoomFactor` in `packages/blue-app/src/main/settings-window.ts`
- [x] T020 [P] [US3] Accept the current zoom factor in both effect window factories and pass it through `webPreferences.zoomFactor` in `packages/blue-app/src/main/effect-editor-window-manager.ts`
- [x] T021 [US3] Register creation/navigation zoom handling before the first main window, seed the Dockview window-open override, retain popout registration, and pass current factors to Settings/effect call sites in `packages/blue-app/src/main/main.ts`

**Checkpoint**: All three stories are independently accepted, and recreated/new application-owned windows share the current session value even after a failed write.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Supply measurable acceptance evidence and verify the feature does not regress unrelated zoom or layout behavior.

- [x] T022 Build the temporary-profile Playwright/Electron driver covering all 26 factors, exact menu contracts and callbacks with a focused interactive control, representative multi-window timing under 250 ms, stale drafts, invalid settings, write failure, and 100 same-profile restart cycles across three non-default values in `packages/blue-app/scripts/verify-app-zoom.mjs`
- [ ] T023 [P] Execute the real native-shortcut, first-frame visual, bounds/reachability, and domain-zoom independence matrix on macOS, Windows, and Linux and append dated platform results to `specs/061-app-zooming/quickstart.md`
- [x] T024 Run the focused Vitest list, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, `pnpm --filter @blue/app verify:app-zoom`, `pnpm lint`, and `git diff --check`, resolving feature regressions in `packages/blue-app/src/`, `packages/blue-app/scripts/verify-app-zoom.mjs`, and `packages/blue-app/package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; adds only the acceptance command.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational and delivers the MVP controller/menu path.
- **User Story 2 (Phase 4)**: Depends on User Story 1's controller integration; its persistence behavior remains independently restart-testable.
- **User Story 3 (Phase 5)**: Depends on User Story 1's controller integration and may proceed in parallel with User Story 2 until both touch `main.ts`; its multi-window behavior remains independently testable.
- **Polish (Phase 6)**: Depends on all selected stories; T024 follows T022 and the desired portion of T023.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 (MVP) -> US2
                              \-> US3
US2 + US3 -> Polish and acceptance gates
```

### Within Each User Story

- Complete the failing test tasks before their paired production changes.
- Keep browser-safe value/settings work in `src/shared` and Electron/window/file behavior in `src/main`.
- Apply a changed runtime value to windows before attempting its settings write.
- Finish story-specific focused tests before moving to the story checkpoint.

### Parallel Opportunities

- **Foundation**: T004 can be authored alongside T002/T003 because it changes the existing settings test file.
- **US1**: T006 and T007 can be written concurrently; T008 and T009 then work in separate production files before T010 integrates them.
- **US2**: T011 and T012 can be written concurrently; store normalization already comes from Foundation while controller persistence is isolated in T013.
- **US3**: T015, T016, and T017 can be written concurrently; after their seams are established, T019 and T020 can be implemented concurrently before T021 integrates call sites.
- **Cross-story**: After US1, US2 store/controller work and US3 factory tests can proceed concurrently, coordinating the final edits to `main.ts`.
- **Polish**: T023 can run alongside acceptance-driver work where a platform build is already available; T024 remains the final automated gate.

---

## Parallel Examples

### User Story 1

```text
Task T006: Controller command and boundary tests in packages/blue-app/src/main/app-zoom-controller.test.ts
Task T007: Native View menu contract tests in packages/blue-app/src/main/application-menu.test.ts
```

### User Story 2

```text
Task T011: Durable store round-trip/fallback tests in packages/blue-app/src/main/program-settings-store.test.ts
Task T012: Controller persistence/failure/stale-draft tests in packages/blue-app/src/main/app-zoom-controller.test.ts
```

### User Story 3

```text
Task T015: Multi-window controller tests in packages/blue-app/src/main/app-zoom-controller.test.ts
Task T016: Settings first-paint factory tests in packages/blue-app/src/main/settings-window.test.ts
Task T017: Effect window first-paint factory tests in packages/blue-app/src/main/effect-editor-window-manager.test.ts

Then, after those test seams exist:
Task T019: Settings factory implementation in packages/blue-app/src/main/settings-window.ts
Task T020: Effect factory implementation in packages/blue-app/src/main/effect-editor-window-manager.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational tasks T001-T005.
2. Complete User Story 1 tasks T006-T010 test-first.
3. Run the US1 focused tests and manually verify menu selection plus shortcuts at 50%, 100%, and 300%.
4. Stop and demonstrate the conventional View-menu scaling increment before adding persistence or secondary-window scope.

### Incremental Delivery

1. **Foundation**: exact percentage/settings contract ready.
2. **US1**: native View menu and exact app-scale commands ready as the MVP.
3. **US2**: restart restoration, safe defaults, write-failure behavior, and stale-draft protection added without changing the UI contract.
4. **US3**: open/new secondary windows join the same controller state.
5. **Polish**: automate measurable criteria, complete the platform/manual matrix, and run all repository gates.

### Parallel Team Strategy

1. Complete T001-T005 together because they establish shared types used everywhere.
2. Pair controller and menu work in US1 using the T006/T007 split.
3. After US1, work on US2 persistence tests and US3 window-factory tests concurrently.
4. Serialize only the small `main.ts` integration tasks T014 and T021, then converge on T022-T024.

---

## Notes

- `[P]` tasks never edit the same file in the same execution wave.
- Do not add preload APIs, IPC channels, renderer stores, project XML fields, or changes to `ui-store.zoom` or score/timeline zoom state.
- Use `setZoomFactor(percent / 100)`, never exponential `setZoomLevel` accumulation or Electron zoom roles.
- Treat one window update or settings write failure as isolated; neither may roll back the main-owned runtime percentage.
- Keep all production imports static and all new `src/shared` code free of Electron and Node built-ins.
