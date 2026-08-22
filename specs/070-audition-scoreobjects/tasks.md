# Tasks: Audition Selected ScoreObjects

**Input**: Design documents from `/specs/070-audition-scoreobjects/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/audition-scoreobjects.md](./contracts/audition-scoreobjects.md), [quickstart.md](./quickstart.md)

**Verification**: Add portable filtering/CSD regressions, typed IPC/preload and native-menu contract coverage, renderer command coverage, main-process engine-orchestration tests, and manual quickstart validation. No project XML change is expected, but the disposable-copy tests must prove canonical serialization/state remains unchanged.

**Organization**: Tasks are grouped by user story. P1 conventional-score audition is the first independently demonstrable increment; Track LayerGroup coverage and preservation/stale-request behavior follow as separately testable increments.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared test fixture and selection-resolution seam used by all stories.

- [X] T001 [P] Add reusable conventional-layer and Track fixture builders for selected/unselected score items, mute/solo state, mixer tail, and canonical-data snapshots in `packages/blue-data/src/score/audition-project.test.ts`.
- [X] T002 Add an exported, canonical-data-only resolver for a unique list of timeline score-object IDs in `packages/blue-app/src/shared/project-editor.ts` and focused resolution/rejection coverage in `packages/blue-app/src/shared/project-editor.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the typed command/IPC boundaries and reusable realtime-start seam before any user-story behavior is wired.

**⚠️ CRITICAL**: Complete this phase before implementing the Project-menu action.

- [X] T003 [P] Add the `audition-score-objects` native-menu command to `packages/blue-app/src/shared/workbench-menu.ts` and extend its command-union coverage in `packages/blue-app/src/renderer/tests/workbench-store.test.ts`.
- [X] T004 [P] Add typed `syncAuditionScoreObjectAvailability` and `auditionScoreObjects` preload methods in `packages/blue-app/src/preload/preload.ts` and corresponding declarations in `packages/blue-app/src/renderer/types/global.d.ts`.
- [X] T005 Add a testable temporary-render data handoff/orchestration seam in `packages/blue-app/src/main/audition-score-objects.ts` while retaining the existing main-process realtime startup, playback status, output, error, Java/on-load, and `EngineBridge` lifecycle semantics in `packages/blue-app/src/main/main.ts`.
- [X] T006 Add the orchestration test seam and success/failure engine stubs in `packages/blue-app/src/main/audition-score-objects.test.ts` before wiring menu or IPC callers.

**Checkpoint**: Stable IDs can be resolved in main, the renderer/main/native-menu contracts are typed, and realtime playback can accept a disposable render source without changing canonical project state.

---

## Phase 3: User Story 1 - Audition the Current Score Selection (Priority: P1) 🎯 MVP

**Goal**: A selected conventional score-layer object can be auditioned from the Project menu or Java-compatible platform shortcut, after pending edits flush, with only the selected content rendered.

**Independent Test**: Select one of two audible conventional score-layer objects, invoke Project > Audition ScoreObjects and Cmd+Shift+A/Ctrl+Shift+A, and verify the generated realtime CSD includes only that object within its one-shot selection window.

### Verification for User Story 1

- [X] T007 [P] [US1] Write failing selected-only, cleared-layer-mute/solo, loop-disabled, selection-bound, mixer-tail, and immutable-source tests in `packages/blue-data/src/score/audition-project.test.ts`.
- [X] T008 [P] [US1] Add menu-template tests for selection gating, `CmdOrCtrl+Shift+A`, and the dedicated audition handler in `packages/blue-app/src/main/application-menu.test.ts`.
- [X] T009 [P] [US1] Add renderer native-command tests proving pending patches flush and the current selected IDs are submitted, with an empty/stale renderer selection ignored, in `packages/blue-app/src/renderer/tests/workbench-store.test.ts`.

### Implementation for User Story 1

- [X] T010 [US1] Implement and export a portable `createAuditionProjectCopy` helper that structurally pairs source/copy conventional score layers, retains only selected objects, drops empty/unrelated root groups, clears retained layer mute/solo, calculates bounds plus mixer tail, and disables looping in `packages/blue-data/src/score/audition-project.ts` and `packages/blue-data/src/index.ts`.
- [X] T011 [US1] Replace the placeholder Project-menu item with the enabled, `CmdOrCtrl+Shift+A` audition action and selection-aware template option in `packages/blue-app/src/main/application-menu.ts`.
- [X] T012 [US1] Track effective renderer selection availability, rebuild the native menu on availability/project/render-state changes, and register validated audition IPC in `packages/blue-app/src/main/main.ts`.
- [X] T013 [US1] Publish score-selection availability changes through the new preload notification in `packages/blue-app/src/renderer/stores/score-selection-store.ts` and clear it on project-close handling in `packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`.
- [X] T014 [US1] Handle `audition-score-objects` by flushing pending patches, reading the current selection IDs, invoking the typed audition request, and reflecting existing playback-state/error behavior in `packages/blue-app/src/renderer/stores/workbench-store.ts` and `packages/blue-app/src/renderer/stores/playback-store.ts`.
- [X] T015 [US1] Resolve valid IDs, build the audition project copy, replace active realtime playback, and submit the resulting CSD through the extracted orchestration in `packages/blue-app/src/main/audition-score-objects.ts`.

**Checkpoint**: Conventional score-layer selection audition works from both menu and platform accelerator without changing the opened project.

---

## Phase 4: User Story 2 - Audition Objects in Track LayerGroups (Priority: P1)

**Goal**: Selected Track sound objects and audio clips audition with track-owned instruments/routing while unselected Track content remains absent.

**Independent Test**: Select a sound object and audio clip across muted/soloed Tracks containing unselected siblings, audition them, and verify selected output plus Track instrument/routing are retained while all unselected Track items are absent.

### Verification for User Story 2

- [X] T016 [P] [US2] Add Track LayerGroup regression cases for mixed sound-object/audio-clip selection, empty-Track/group removal, track mute/solo clearing, Track instrument retention, and selected-only CSD output in `packages/blue-data/src/score/audition-project.test.ts`.
- [X] T017 [P] [US2] Add main-process orchestration coverage proving a Track audition uses the temporary Track CSD and leaves the canonical Track project unchanged in `packages/blue-app/src/main/audition-score-objects.test.ts`.

### Implementation for User Story 2

- [X] T018 [US2] Extend `createAuditionProjectCopy` to structurally filter `TrackLayerGroup`/`Track` contents in lockstep, retain selected `SoundObject` and `AudioClip` items only, clear retained Track mute/solo state, and remove empty Tracks/groups in `packages/blue-data/src/score/audition-project.ts`.
- [X] T019 [US2] Verify Track-specific selection resolution accepts timeline Track sound objects and audio clips but rejects non-timeline/library/Blue Live IDs in `packages/blue-app/src/shared/project-editor.ts` and `packages/blue-app/src/shared/project-editor.test.ts`.

**Checkpoint**: Track LayerGroup audition is selected-only, audible despite Track mute/solo, and preserves the Track render context without altering canonical data.

---

## Phase 5: User Story 3 - Preserve the Project While Auditioning (Priority: P2)

**Goal**: Repeated, stale, failed, or interrupted auditions never modify canonical project or selection state and never start an unintended engine session.

**Independent Test**: Snapshot a project, render/stop 20 auditions, then submit deleted/duplicate/empty IDs and forced startup failures; verify unchanged project/selection/serialization and no unintended engine start.

### Verification for User Story 3

- [X] T020 [P] [US3] Add repeated-audition copy-isolation and canonical `saveToString()` preservation tests in `packages/blue-data/src/score/audition-project.test.ts`.
- [X] T021 [P] [US3] Add invalid, duplicate, missing, stale, closed-project, active-playback replacement, and engine-failure IPC/orchestration tests in `packages/blue-app/src/main/audition-score-objects.test.ts`.
- [X] T022 [P] [US3] Add renderer tests for project-close availability clearing and rejection/error handling after an audition menu command in `packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx` and `packages/blue-app/src/renderer/tests/workbench-store.test.ts`.

### Implementation for User Story 3

- [X] T023 [US3] Make the main audition IPC reject whole requests with empty, duplicate, unresolved, or unavailable selections; clear cached menu availability on project replacement/close; and guarantee no assignment to canonical `currentData` in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/audition-score-objects.ts`.
- [X] T024 [US3] Ensure renderer availability sync and native-command handling cannot submit selection IDs after selection/project teardown in `packages/blue-app/src/renderer/stores/score-selection-store.ts`, `packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`, and `packages/blue-app/src/renderer/stores/workbench-store.ts`.

**Checkpoint**: Auditions are fully disposable, stale commands are harmless, and normal project playback/serialization remains unchanged after success or failure.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the completed feature at its boundaries and against its documented manual flow.

- [X] T025 [P] Reconcile implementation behavior, test names, and command/IPC signatures with `specs/070-audition-scoreobjects/contracts/audition-scoreobjects.md` and update the contract only for intentional, documented changes.
- [ ] T026 [P] Execute the menu/shortcut, conventional-layer, Track LayerGroup, stale-request, and project-isolation scenarios in `specs/070-audition-scoreobjects/quickstart.md` on macOS and at least one Ctrl-based target or equivalent platform contract harness.

> T026 remains a manual desktop follow-up; the current run covered its conventional, Track, stale-request, isolation, and symbolic `CmdOrCtrl+Shift+A` contract cases through Vitest, but did not launch the packaged Electron app or a separate Ctrl-based desktop target.
- [X] T027 Run the focused Vitest suites and affected package typecheck, lint, and build commands recorded in `specs/070-audition-scoreobjects/quickstart.md`; record any scoped platform limitation in the implementation handoff.
- [X] T028 Add lifecycle regressions proving score-timeline presses stop auditions without stopping ordinary playback, and that audition state is cleared through the playback stop path in `packages/blue-app/src/renderer/tests/playback-store.test.ts` and `packages/blue-app/src/renderer/tests/score-panel-session-reset.test.tsx`.
- [X] T029 Add main-process arbitration so Render to Disk stops realtime/audition playback before disk setup and an interrupted audition startup cannot submit its disposable CSD after cancellation in `packages/blue-app/src/main/main.ts`.

> Final review (2026-08-11): the implementation, plan, task coverage, contract, and Java lifecycle research are consistent. Automated tests, builds, lint, and diff validation pass; T026 remains the documented manual packaged-desktop follow-up.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; creates the source-ID and fixture basis.
- **Foundational (Phase 2)**: Depends on Setup; blocks user-story work because typed command/IPC and temporary playback seams must be stable.
- **US1 (Phase 3)**: Depends on Phase 2; delivers the first independently testable conventional-layer audition.
- **US2 (Phase 4)**: Depends on the portable copy/filter seam from T010; otherwise isolates Track-specific work from menu/IPC behavior.
- **US3 (Phase 5)**: Depends on the US1 main/renderer route and extends it with failure and preservation guarantees.
- **Polish (Phase 6)**: Depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: Requires T001–T006 only; no Track behavior is needed for its conventional-layer MVP.
- **US2 (P1)**: Requires T010’s shared copy/filter API and has no dependency on US3’s lifecycle hardening.
- **US3 (P2)**: Requires the completed US1 request/start route; it is independent of Track-specific rendering except for shared immutable-copy coverage.

### Parallel Opportunities

- T003 and T004 can proceed in parallel after source-ID/fixture setup.
- T007–T009 are independent failing-regression tasks and can proceed in parallel after the foundational contracts are available.
- T016 and T017 can proceed in parallel once US1’s copy/filter and orchestration seams are stable.
- T020–T022 can proceed in parallel once the basic audition request route exists.
- T025 and T026 can proceed in parallel after all implementation tasks complete; T027 follows their results.

## Parallel Example: User Story 1

```text
Task: "Add selected-only portable data regressions in packages/blue-data/src/score/audition-project.test.ts"
Task: "Add menu accelerator/gating coverage in packages/blue-app/src/main/application-menu.test.ts"
Task: "Add flush-and-dispatch renderer coverage in packages/blue-app/src/renderer/tests/workbench-store.test.ts"
```

## Implementation Strategy

### MVP First

1. Complete T001–T006 to establish ID validation, command/IPC contracts, and temporary realtime startup.
2. Complete T007–T015 for conventional score-layer selected-only audition and the platform accelerator.
3. Run the US1 focused tests and manually validate the menu/shortcut before adding Track behavior.

### Incremental Delivery

1. Deliver conventional-layer audition as the initial parity slice.
2. Add Track LayerGroup filtering and mixed audio-clip coverage without changing the menu/IPC contract.
3. Harden stale/failure/isolation behavior and run the quickstart/regression suite.

### Format Validation

All 29 tasks use the required `- [ ] T### [P?] [US?] Description with file path` format. User-story tasks are labeled `[US1]`, `[US2]`, or `[US3]`; setup, foundational, and polish tasks intentionally have no story label.
