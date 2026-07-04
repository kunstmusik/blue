# Tasks: Missing Audio Asset Check On Project Load

**Input**: Design documents from `/Users/stevenyi/work/blue-electron/specs/053-missing-audio-assets/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/missing-audio-assets-ipc.md](contracts/missing-audio-assets-ipc.md), [quickstart.md](quickstart.md)

**Tests**: Required by FR-020 and SC-007. Write the listed tests before implementation and verify they fail for the missing behavior.

**Organization**: Tasks are grouped by user story so each Java Blue parity behavior can be implemented and verified independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared types and renderer state slots used by all missing-audio workflows.

- [x] T001 Create shared missing-audio IPC/session types in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/missing-audio-assets.ts`
- [x] T002 [P] Add optional `missingAudioAssets` to `ProjectLoadedPayload` in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/project-editor.ts`
- [x] T003 [P] Add missing-audio API declarations to `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/types/global.d.ts`
- [x] T004 [P] Add missing-audio modal state and actions to `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/project-store.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the main-process service and IPC hooks that all user stories depend on.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T005 Create main-process missing-audio service skeleton in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.ts`
- [x] T006 Add missing-audio preload bridge methods in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/preload.ts`
- [x] T007 Register missing-audio IPC handler placeholders in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`

**Checkpoint**: Shared contracts and IPC skeletons exist; story tests can target stable paths.

---

## Phase 3: User Story 1 - Identify Missing Audio Files When Opening A Project (Priority: P1)

**Goal**: Opened projects are scanned for unique unresolved AudioFile score-object paths and the renderer shows the modal only when missing paths exist.

**Independent Test**: Open or simulate a project with mixed found and missing AudioFile paths; verify the project loads and the modal lists only unique unresolved paths.

### Tests for User Story 1

- [x] T008 [P] [US1] Add collector tests for found paths, missing paths, duplicate paths, blank paths, nested PolyObjects, and non-AudioFile exclusions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.test.ts`
- [x] T009 [P] [US1] Add project-loaded listener tests for receiving a missing-audio session and clearing loading state in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx`
- [x] T010 [P] [US1] Add modal display tests for unique original-path rows and no modal when no session exists in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/missing-audio-assets-modal.test.tsx`

### Implementation for User Story 1

- [x] T011 [US1] Implement AudioFile traversal, Java-compatible path resolution, and unique missing-path collection in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.ts`
- [x] T012 [US1] Refactor project load notification to attach `missingAudioAssets` after successful load in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T013 [US1] Store missing-audio sessions from `project-loaded` events in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`
- [x] T014 [US1] Render `MissingAudioAssetsModal` from the app shell in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/App.tsx`
- [x] T015 [US1] Implement the missing-audio modal table with original and replacement columns in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/MissingAudioAssetsModal.tsx`

**Checkpoint**: User Story 1 is complete when missing AudioFile rows appear after project load and no modal appears for clean projects.

---

## Phase 4: User Story 2 - Resolve Missing Files From The Modal (Priority: P1)

**Goal**: Users can choose replacements, confirm partial or full mappings, and update every matching AudioFile path with Java-compatible project-relative normalization.

**Independent Test**: Open or simulate a project with two missing original paths, resolve one row, confirm, and verify only mapped exact matches changed.

### Tests for User Story 2

- [x] T016 [P] [US2] Add replacement normalization and exact-match mutation tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.test.ts`
- [x] T017 [P] [US2] Add choose-replacement and confirm-flow renderer tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/missing-audio-assets-modal.test.tsx`
- [x] T018 [P] [US2] Add project-store refresh and dirty-state tests for changed replacement results in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/project-store.test.ts`

### Implementation for User Story 2

- [x] T019 [US2] Implement native replacement file chooser handling in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T020 [US2] Implement replacement mapping validation, project-relative normalization, and all-exact-match AudioFile updates in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.ts`
- [x] T021 [US2] Implement `missing-audio-assets:resolve` IPC with refreshed project snapshot return in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T022 [US2] Implement Browse and OK actions in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/MissingAudioAssetsModal.tsx`
- [x] T023 [US2] Apply refreshed snapshots and mark the project dirty only when replacements changed data in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/stores/project-store.ts`
- [x] T024 [US2] Verify AudioFile replacement paths round-trip through existing save/load behavior in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.test.ts`

**Checkpoint**: User Story 2 is complete when full and partial confirmed mappings update only matching AudioFile paths and refresh the renderer.

---

## Phase 5: User Story 3 - Preserve Java Blue Dismissal Semantics (Priority: P1)

**Goal**: Confirm-with-no-mappings, cancel, close, stale sessions, and remaining unresolved paths are all no-op or partial-update outcomes that leave the project open.

**Independent Test**: Open or simulate the same missing-file project and exercise no-mapping OK, partial OK, cancel, and close; verify project paths and open state match Java Blue.

### Tests for User Story 3

- [x] T025 [P] [US3] Add no-mapping success, cancel, close, partial remaining, and stale-session tests in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.test.ts`
- [x] T026 [P] [US3] Add renderer tests for Cancel, Escape, overlay close, and OK-with-empty-rows in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/missing-audio-assets-modal.test.tsx`
- [x] T027 [P] [US3] Add same-current-file no-rerun coverage for the project open path in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.test.ts`

### Implementation for User Story 3

- [x] T028 [US3] Implement `missing-audio-assets:dismiss` session clearing in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`
- [x] T029 [US3] Implement stale-session guards and no-mapping success as no-op behavior in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.ts`
- [x] T030 [US3] Implement Cancel, Escape, overlay close, and empty-OK modal behavior in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/MissingAudioAssetsModal.tsx`
- [x] T031 [US3] Keep the project open and loading state cleared for all modal dismissal outcomes in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`
- [x] T032 [US3] Add a current-file no-op guard so reopening the already current project does not rerun the missing-file check in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/main.ts`

**Checkpoint**: User Story 3 is complete when every dismissal path leaves AudioFile paths unchanged unless the user confirmed non-empty mappings.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate parity, tighten UI details, and run the full checks.

- [x] T033 [P] Review focus handling, button labels, and table sizing for the modal in `/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/components/workbench/panels/MissingAudioAssetsModal.tsx`
- [x] T034 [P] Update any quickstart findings in `/Users/stevenyi/work/blue-electron/specs/053-missing-audio-assets/quickstart.md`
- [x] T035 Run focused app tests for missing-audio behavior using `/Users/stevenyi/work/blue-electron/packages/blue-app/package.json`
- [x] T036 Run full app build validation using `/Users/stevenyi/work/blue-electron/packages/blue-app/package.json`
- [x] T037 Run workspace test validation using `/Users/stevenyi/work/blue-electron/package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational.
- **User Story 2 (Phase 4)**: Depends on Foundational and uses the modal/session created for User Story 1.
- **User Story 3 (Phase 5)**: Depends on Foundational and can be implemented alongside User Story 2 after User Story 1 establishes the modal.
- **Polish (Phase 6)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1**: Required MVP; establishes scanning and display.
- **US2**: Requires US1 modal/session display and adds replacement application.
- **US3**: Requires US1 session display; shares resolve/dismiss code with US2.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001.
- T008, T009, and T010 can run in parallel.
- T016, T017, and T018 can run in parallel.
- T025, T026, and T027 can run in parallel.
- T033 and T034 can run in parallel after user stories are complete.

## Parallel Example: User Story 1

```bash
Task: "Add collector tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.test.ts"
Task: "Add project-loaded listener tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx"
Task: "Add modal display tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/missing-audio-assets-modal.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Add replacement normalization tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/main/missing-audio-assets.test.ts"
Task: "Add choose-replacement renderer tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/missing-audio-assets-modal.test.tsx"
Task: "Add dirty-state tests in /Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/project-store.test.ts"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1.
3. Validate that clean projects show no modal and missing AudioFile projects show unique missing paths while remaining open.

### Incremental Delivery

1. Add User Story 1 scanning/display.
2. Add User Story 2 browse/confirm replacement application.
3. Add User Story 3 no-op dismissal and stale-session parity.
4. Run focused tests, app build, then workspace tests.

### Notes

- `[P]` tasks touch different files or isolated test cases.
- `[US1]`, `[US2]`, and `[US3]` labels map directly to `spec.md` user stories.
- Tests are explicit because the spec requires coverage of success, partial success, no-op success, cancel, relative path normalization, and no-project-directory behavior.
