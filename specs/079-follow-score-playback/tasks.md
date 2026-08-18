---

description: "Implementation tasks for Follow Score Playback and Page Scrolling"
---

# Tasks: Follow Score Playback and Page Scrolling

**Input**: Design documents from `/specs/079-follow-score-playback/`

**Prerequisites**: [plan.md](/Users/stevenyi/work/blue-electron/specs/079-follow-score-playback/plan.md), [spec.md](/Users/stevenyi/work/blue-electron/specs/079-follow-score-playback/spec.md), [research.md](/Users/stevenyi/work/blue-electron/specs/079-follow-score-playback/research.md), [data-model.md](/Users/stevenyi/work/blue-electron/specs/079-follow-score-playback/data-model.md), [contracts](/Users/stevenyi/work/blue-electron/specs/079-follow-score-playback/contracts)

**Verification**: Focused Vitest/jsdom regression tests, main/preload contract coverage, `@blue/app` builds and tests, repository lint/test checks proportional to the change, `git diff --check`, and the manual scenarios in [quickstart.md](/Users/stevenyi/work/blue-electron/specs/079-follow-score-playback/quickstart.md).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the baseline and reusable renderer test harness without changing project data or adding dependencies.

- [x] T001 Run the current score-panel and playback-store tests to capture the existing lead-window rubber-band behavior and hard-coded follow reset behavior, recording the baseline commands and observations in `specs/079-follow-score-playback/research.md`
- [x] T002 [P] Create the jsdom score-follow test harness with root `ScorePanel` mocks, body/header scroll containers, `ResizeObserver`, and `window.blueAPI` doubles in `packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the typed settings boundary, native-menu command shapes, and renderer/main synchronization plumbing required by every user story.

**⚠️ CRITICAL**: No user story implementation is complete until these ownership and contract tasks are finished.

- [x] T003 [P] Define the validated `PlaybackPreferencePatch` request and result-facing types for `followPlayback` and `followPlaybackOnStart` in `packages/blue-app/src/shared/program-settings.ts`
- [x] T004 [P] Extend the typed `NativeMenuCommand` union with resolved-value `set-follow-playback` and `set-follow-playback-on-render-start` commands in `packages/blue-app/src/shared/workbench-menu.ts`
- [x] T005 Implement an atomic partial playback-preference update that merges only the provided follow fields, preserves unrelated settings, and retains existing version/timestamp behavior in `packages/blue-app/src/main/program-settings-store.ts`
- [x] T006 Add main-settings regression coverage for valid partial merges, invalid non-boolean payloads, missing-field requests, and failed-write preservation in `packages/blue-app/src/main/program-settings-store.test.ts`
- [x] T007 Wire the typed playback-preference update bridge and its renderer declaration through `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`
- [x] T008 Add the main-process IPC handler, settings hydration for native-menu mirrors, sender validation, and active-state mirror handling for follow playback in `packages/blue-app/src/main/main.ts` and `packages/blue-app/src/main/workbench-window-host.ts`
- [x] T009 Update renderer IPC/menu plumbing to consume explicit resolved follow values without double toggles or full-snapshot writes in `packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts` and `packages/blue-app/src/renderer/stores/workbench-store.ts`
- [x] T010 [P] Add shared contract tests for follow-preference patch validation, unrelated-setting preservation, and explicit resolved-value command typing in `packages/blue-app/src/shared/program-settings.test.ts` and `packages/blue-app/src/renderer/tests/workbench-store.test.ts`

**Checkpoint**: The settings owner, preload boundary, native-menu mirror, and renderer command path are typed and testable before story-specific behavior is added.

---

## Phase 3: User Story 1 - Follow Playback by Score Pages (Priority: P1) 🎯 MVP

**Goal**: Replace continuous lead-window repositioning with Java-compatible page/catch-up scrolling on the active root score while preserving vertical position and body/header alignment.

**Independent Test**: Start active playback on a root score wider than the viewport with Follow enabled. The viewport remains stationary while the playhead is visible, then makes one instant pointer-x page jump per boundary; stopped/paused playhead changes do not scroll.

### Verification for User Story 1

- [x] T011 [US1] Add failing pure viewport tests for visible playheads, right-edge crossings, backward/out-of-view catch-up, pointer-x clamping, short scores, invalid geometry, and stopped/paused no-op behavior in `packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx`

### Implementation for User Story 1

- [x] T012 [US1] Implement the pure `getFollowScrollTarget` page/catch-up decision helper with active-playback, root-scope, finite-geometry, visible-interval, and scroll-range rules in `packages/blue-app/src/renderer/components/workbench/panels/score/follow-playback.ts`
- [x] T013 [US1] Replace the lead-padding display-clock effect with the pure page/catch-up decision, active root-score gating, pointer-x target writes, preserved `scrollTop`, and synchronized body/time-header updates in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- [x] T014 [US1] Extend the score-follow component tests for stationary in-page playback, one automatic boundary advance, immediate catch-up, backward seek/wrap visibility, vertical-scroll preservation, body/header alignment, root-only scope, and no movement while stopped or paused in `packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx`

**Checkpoint**: User Story 1 is independently demonstrable as Java-compatible page following without manual navigation or preference lifecycle changes.

---

## Phase 4: User Story 2 - Browse Freely During Playback (Priority: P1)

**Goal**: Suspend only the active follow session when the user horizontally navigates, while ignoring vertical-only movement, zoom, resize, layout synchronization, and automatic follow writes.

**Independent Test**: During active playback with follow enabled, move the body, time header, scrollbar, and ruler horizontally. Follow becomes inactive, audio continues, and subsequent clock/loop updates do not reclaim the user's position; vertical scrolling and zoom/resize leave follow active.

### Verification for User Story 2

- [x] T015 [US2] Add failing source-provenance tests for body/header scroll, scrollbar movement, ruler navigation, vertical-only scroll, follow-generated writes, layout sync, horizontal zoom, resize catch-up, and user-position-wins behavior in `packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx`

### Implementation for User Story 2

- [x] T016 [US2] Add expected horizontal target tracking and `follow`/`view-scale`/`layout-sync`/`user-navigation` provenance classification to body and time-header scroll handling in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- [x] T017 [P] [US2] Mark Shift/wheel horizontal navigation as user-originated and pinch/cursor-anchored/macOS gesture zoom as view-scale-originated through the smallest callback changes in `packages/blue-app/src/renderer/components/workbench/panels/score/useScoreWheelZoom.ts`
- [x] T018 [P] [US2] Expose explicit user-navigation callbacks for time-ruler click/drag and render-range auto-scroll without changing transport semantics in `packages/blue-app/src/renderer/components/workbench/panels/score/useScoreRulerSelection.ts`
- [x] T019 [US2] Complete score-panel wiring so unmatched horizontal body/header/scrollbar/ruler movement suspends only active follow, automatic targets are consumed without self-suspension, vertical movement is ignored, and explicit marker/rewind navigation wins in `packages/blue-app/src/renderer/components/workbench/panels/ScorePanel.tsx`
- [x] T020 [US2] Extend component regression coverage for suspension visibility, continued playback, no snap-back after clock/loop updates, body/header/scrollbar/ruler origins, vertical-only scroll, zoom, resize catch-up, and concurrent user-versus-follow movement in `packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx`

**Checkpoint**: User Story 2 is independently testable as a browsing workflow that respects the user's horizontal position without interrupting audio.

---

## Phase 5: User Story 3 - Re-engage Follow with an Explicit Control (Priority: P2)

**Goal**: Make the toolbar, native Project menu, and guarded unmodified `F` shortcut perform the same explicit persistent toggle and immediate playhead catch-up.

**Independent Test**: Suspend follow during active playback, then re-enable it separately from the toolbar, native menu, and unmodified `F`; each action catches up to the current playhead, persists the preference, and resumes page following. No-project and editing-focus cases do nothing.

### Verification for User Story 3

- [x] T021 [P] [US3] Add keyboard regression cases for unmodified `F`, modifier rejection, `event.repeat`, no-project state, input/textarea/select/contenteditable/code-editor/context-menu targets, and preserved text/control interaction in `packages/blue-app/src/renderer/tests/app.test.ts` *(executed in `score-follow-playback.test.tsx` instead: `app.test.ts` runs in the node environment and cannot mount the jsdom keydown listener; its `isTextEditingTarget` coverage remains)*
- [x] T022 [P] [US3] Add explicit-toggle persistence and active-playhead catch-up cases for the renderer action in `packages/blue-app/src/renderer/tests/playback-store.test.ts`
- [x] T023 [P] [US3] Add resolved native-menu command cases that prove one state transition, no duplicate toggle, and no duplicate settings write in `packages/blue-app/src/renderer/tests/workbench-store.test.ts` and `packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx`

### Implementation for User Story 3

- [x] T024 [US3] Add the guarded, unmodified, non-repeating `F` keyboard branch using the existing editing-target and project-presence guards in `packages/blue-app/src/renderer/hooks/use-keyboard-shortcuts.ts`
- [x] T025 [US3] Implement the explicit follow action that updates active and saved state, calls the narrow preload preference update, mirrors the active value, and requests immediate catch-up when a valid playhead is available in `packages/blue-app/src/renderer/stores/playback-store.ts`
- [x] T026 [US3] Route the toolbar Follow `F` control through the explicit persistent action and preserve its disabled/unavailable behavior when no project is loaded in `packages/blue-app/src/renderer/components/menu-bar/PlaybackControls.tsx`
- [x] T027 [US3] Handle resolved `set-follow-playback` and `set-follow-playback-on-render-start` native/settings commands in the renderer without toggling twice or persisting a second time in `packages/blue-app/src/renderer/stores/workbench-store.ts` and `packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`
- [x] T028 [US3] Verify toolbar, native-menu, and `F` re-engagement all invoke the same catch-up path and update the visible state within the interaction budget in `packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx`

**Checkpoint**: User Story 3 is independently testable through all three explicit controls, including keyboard safety and immediate catch-up.

---

## Phase 6: User Story 4 - Keep Follow Preferences and Controls Consistent (Priority: P2)

**Goal**: Preserve durable preferences across runtime/project lifecycle changes, separate saved preference from temporary session suspension, and keep toolbar/native menu/settings state consistent through stop, error, reset, loop, and internal restart paths.

**Independent Test**: Toggle and persist follow preferences, suspend during playback, exercise loop/internal restart and stop/error/project-close/reset paths, then start again with follow-on-start enabled and disabled. Toolbar and native menu must always show the same active/saved state, and no `.blue` data changes.

### Verification for User Story 4

- [x] T029 [P] [US4] Add saved-vs-active lifecycle tests for hydration, explicit persistence, temporary suspension, on-start enabled/disabled branches, stop/error/reset restoration, failed starts, loop boundaries, and internal engine restarts in `packages/blue-app/src/renderer/tests/playback-store.test.ts`
- [x] T030 [P] [US4] Add native-menu mirror tests for hydrated saved values, active suspension, explicit restoration, and application-menu checkmark state in `packages/blue-app/src/main/application-menu.test.ts`
- [x] T031 [P] [US4] Add full settings-save/reset and renderer hydration/project-close synchronization tests for resolved follow values in `packages/blue-app/src/main/program-settings-application.test.ts` and `packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx`

### Implementation for User Story 4

- [x] T032 [US4] Add separate saved preference, active session state, and on-start transition handling to the playback store, restoring saved follow on stop/error/project close/reset while preserving suspension across loops and internal restarts in `packages/blue-app/src/renderer/stores/playback-store.ts`
- [x] T033 [US4] Update playback status/start/reset integration so only a confirmed stopped-to-playing session applies follow-on-start and failed starts never overwrite hydrated preferences in `packages/blue-app/src/renderer/stores/playback-store.ts` and `packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`
- [x] T034 [US4] Refresh the main menu cache and broadcast explicit resolved preference commands after Settings-window full saves and playback-panel resets, while keeping active-state mirroring non-persistent in `packages/blue-app/src/main/main.ts`
- [x] T035 [US4] Apply project-presence, project-close, runtime-reset, and playback-status transitions to toolbar/native-menu state without writing follow-session or viewport data to `.blue` in `packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts` and `packages/blue-app/src/renderer/stores/workbench-store.ts`
- [x] T036 [US4] Add assertions that follow actions use only application settings and never invoke project-document mutation or `.blue` serialization paths in `packages/blue-app/src/renderer/tests/playback-store.test.ts` and `packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx`

**Checkpoint**: User Story 4 is independently testable across persistence, native-menu synchronization, lifecycle resets, and loop/recovery behavior without project-data mutation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Run the constitution-required verification, build checks, and deterministic manual validation across the completed stories.

- [x] T037 [P] Run all focused renderer, main, and shared tests listed in `specs/079-follow-score-playback/quickstart.md` from `/Users/stevenyi/work/blue-electron`
- [x] T038 [P] Run `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:preload`, `pnpm --filter @blue/app build:renderer`, and the affected-package lint/type checks described by `packages/blue-app/package.json`
- [x] T039 [P] Review the implementation diff for Java parity, state ownership, typed IPC failure handling, and absence of `@blue/data`, engine, `.blue`, or CSD changes against `specs/079-follow-score-playback/plan.md` and `.specify/memory/constitution.md`
- [x] T040 Run `git diff --check` and verify the existing unrelated `MISSING_FEATURE_GPT.md` remains untouched from the repository root, recording any scoped validation exception in `specs/079-follow-score-playback/quickstart.md`
- [x] T041 Execute the long-score playback, manual-navigation, zoom/resize, keyboard-scope, persistence, stop/error/reset, and loop/internal-restart scenarios in `specs/079-follow-score-playback/quickstart.md`, recording the user-confirmed final acceptance evidence there

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; T002 establishes the renderer harness and T001 captures the regression baseline.
- **Foundational (Phase 2)**: Depends on Setup; T003--T010 establish the typed settings, IPC, menu, and renderer command boundaries that block story completion.
- **User Story 1 (Phase 3)**: Depends on Foundational; it is the MVP and establishes the page-follow decision and ScorePanel seam.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because provenance must extend the page-follow writes and the same root-score scroll handlers.
- **User Story 3 (Phase 5)**: Depends on Foundational and the User Story 1 catch-up path; its keyboard and IPC test preparation can proceed in parallel with User Story 2 once the foundation is complete.
- **User Story 4 (Phase 6)**: Depends on the explicit action and catch-up behavior from User Story 3 plus the page/provenance behavior from User Stories 1 and 2.
- **Polish (Phase 7)**: Depends on all selected user stories; run T037--T041 before handoff.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on another user story after Phase 2; suggested MVP.
- **User Story 2 (P1)**: Depends on US1's ScorePanel page-follow integration; it is independently testable after that seam exists.
- **User Story 3 (P2)**: Depends on the US1 catch-up helper and the Phase 2 typed preference boundary; keyboard/command tests can be prepared in parallel with US2.
- **User Story 4 (P2)**: Depends on US3's explicit action contract and integrates all lifecycle/state surfaces.

### Parallel Opportunities

- **Foundational**: T003 and T004 can run in parallel; T006 and T010 can run in parallel after their shared type prerequisites; T007 can proceed independently after T003.
- **User Story 1**: T011 can be written as a failing regression before T012; T014 can be split by pure/component cases if multiple implementers are available, but both target the shared score test file and should normally be serialized.
- **User Story 2**: T017 (`useScoreWheelZoom.ts`) and T018 (`useScoreRulerSelection.ts`) can run in parallel after T016 defines the callback/provenance seam.
- **User Story 3**: T021 (keyboard tests), T022 (store tests), and T023 (native command tests) touch separate test surfaces and can run in parallel before T024--T027.
- **User Story 4**: T029, T030, and T031 touch separate test surfaces and can run in parallel before T032--T035.
- **Polish**: T037, T038, and T039 are independent validation/review passes and can run in parallel; T040 and T041 are final handoff checks.

### Parallel Example: User Story 1

```text
After Phase 2:
1. Add the failing page/catch-up regression cases in
   packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx (T011).
2. Once the cases are reviewed, implement the pure helper in
   packages/blue-app/src/renderer/components/workbench/panels/score/follow-playback.ts (T012).
3. Integrate the helper into ScorePanel.tsx (T013), then run the component checkpoint (T014).
```

### Parallel Example: User Story 2

```text
After T016 establishes ScorePanel provenance callbacks:
1. Update useScoreWheelZoom.ts for navigation versus view-scale origins (T017).
2. Update useScoreRulerSelection.ts for explicit user navigation (T018).
3. Run the shared ScorePanel provenance regression suite in
   packages/blue-app/src/renderer/tests/score-follow-playback.test.tsx (T020).
```

### Parallel Example: User Story 3

```text
After Phase 2 and the US1 catch-up path:
1. Add keyboard-scope cases in packages/blue-app/src/renderer/tests/app.test.ts (T021).
2. Add explicit-toggle persistence cases in packages/blue-app/src/renderer/tests/playback-store.test.ts (T022).
3. Add resolved native-command cases in packages/blue-app/src/renderer/tests/workbench-store.test.ts
   and packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx (T023).
4. Implement the hook, store action, toolbar route, and resolved command handling (T024--T027).
```

### Parallel Example: User Story 4

```text
After US3's explicit action is complete:
1. Add playback lifecycle cases in packages/blue-app/src/renderer/tests/playback-store.test.ts (T029).
2. Add native-menu mirror cases in packages/blue-app/src/main/application-menu.test.ts (T030).
3. Add full-settings and hydration cases in packages/blue-app/src/main/program-settings-application.test.ts
   and packages/blue-app/src/renderer/tests/use-ipc-listeners.test.tsx (T031).
4. Implement the store, status integration, main broadcast, and renderer lifecycle wiring (T032--T035).
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2 so the typed boundary and test harness are available.
2. Complete User Story 1: pure Java-compatible page/catch-up logic and root ScorePanel integration.
3. Run the US1-focused tests and manually verify a long score across at least 10 page boundaries.
4. Stop for an MVP review before adding manual-navigation suspension or additional controls.

### Incremental Delivery

1. Add User Story 2 to make horizontal browsing safe during playback.
2. Add User Story 3 to make re-engagement discoverable and consistent across toolbar, native menu, and `F`.
3. Add User Story 4 to complete durable preference and lifecycle consistency.
4. Run Phase 7 after each story checkpoint and before handoff.

### Notes

- `[P]` tasks touch different files and have no dependency on incomplete work.
- `[US1]`--`[US4]` map directly to the prioritized user stories in `spec.md`.
- Every behavior/data/runtime boundary has a focused regression or contract task before final validation.
- No task changes `@blue/data`, engine protocol, project XML, generated CSD, or unrelated working-tree files.
