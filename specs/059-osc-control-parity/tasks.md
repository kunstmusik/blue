# Tasks: OSC Control Parity

**Input**: Design documents from `/specs/059-osc-control-parity/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [runtime contract](./contracts/osc-control-runtime.md), and [quickstart.md](./quickstart.md)
**Status**: Complete | **Closed**: 2026-07-14

**Tests**: Required. The specification explicitly requires automated coverage for settings/migration, all eight commands, retired-command exclusion, port fallback/exhaustion, bundles, malformed traffic, lifecycle ordering, and shutdown release.

**Organization**: Tasks are grouped by user story after the shared foundation so each behavior remains independently verifiable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the OSC dependency and verify repository configuration before feature code begins.

- [X] T001 Add the `node-osc` dependency and lockfile entry in `packages/blue-app/package.json` and `pnpm-lock.yaml`.
- [X] T002 [P] Verify Node/TypeScript ignore coverage without changing unrelated patterns in `.gitignore`.
- [X] T003 [P] Create shared OSC registry, validation, runtime snapshot, event, and IPC contracts with contract tests in `packages/blue-app/src/shared/osc-control.ts` and `packages/blue-app/src/shared/osc-control.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the main-process listener, program-settings migration, and safe IPC bridge required by every user story.

**⚠️ CRITICAL**: No OSC user-story work should proceed before this phase is complete.

- [X] T004 [P] Add program-settings OSC default, panel-order, validation, and legacy-placeholder migration fixtures in `packages/blue-app/src/shared/program-settings.test.ts` and `packages/blue-app/src/main/program-settings-store.test.ts`.
- [X] T005 Implement structured OSC preference normalization, schema migration, default/reset behavior, and preserved legacy placeholders in `packages/blue-app/src/shared/program-settings.ts` and `packages/blue-app/src/main/program-settings-store.ts`.
- [X] T006 [P] Add deterministic socket/decode tests for bind success, prefix registry behavior, argument ignoring, nested bundle order, malformed packets, fallback, non-conflict errors, exhaustion, and close/restart races in `packages/blue-app/src/main/osc-control-service.test.ts`.
- [X] T007 Implement the generation-guarded `udp4` listener, upward-only `EADDRINUSE` retry, runtime snapshots, packet diagnostics, recursive decode, and command event dispatch in `packages/blue-app/src/main/osc-control-service.ts`.
- [X] T008 Add listener lifecycle tests for startup, preference restart, port release, and shutdown state in `packages/blue-app/src/main/osc-control-service.test.ts`.
- [X] T009 Wire the OSC service into app startup, settings IPC, primary-window command delivery, snapshot broadcasts, and quit cleanup in `packages/blue-app/src/main/main.ts`.
- [X] T010 [P] Add preload API contract tests in `packages/blue-app/src/preload/osc-control-api.test.ts`.
- [X] T011 Expose typed OSC snapshot/command subscriptions with idempotent cleanup in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`.

**Checkpoint**: One service can bind/rebind/close safely, persist a preferred port, publish status, and send recognized command events to the primary renderer.

---

## Phase 3: User Story 1 - Start And Configure OSC Control (Priority: P1) 🎯 MVP

**Goal**: Users can find OSC immediately after MIDI, configure a valid preferred server port, and see the listener's actual runtime port and errors.

**Independent Test**: With no project open, start Blue, open Application Settings, verify default preferred/active port 8000, occupy it to verify upward fallback, then verify Apply, Cancel, Reset Panel, validation, and migration behavior.

### Tests for User Story 1

- [X] T012 [P] [US1] Add settings UI tests for OSC navigation order, preferred/active/fallback presentation, validation, Apply/Cancel, Reset Panel, and diagnostics in `packages/blue-app/src/renderer/tests/osc-settings.test.tsx`.
- [X] T013 [P] [US1] Add focused legacy/default settings behavior coverage in `packages/blue-app/src/shared/program-settings.test.ts` and `packages/blue-app/src/main/program-settings-store.test.ts`.

### Implementation for User Story 1

- [X] T014 [US1] Replace the orphan OSC placeholder with a preferred-port and read-only listener-status panel in `packages/blue-app/src/renderer/components/settings/OscSettings.tsx`.
- [X] T015 [US1] Add the `osc` panel ID immediately after `midi`, draft persistence, listener snapshot subscription, Apply/Cancel, and Reset Panel wiring in `packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`.
- [X] T016 [US1] Add user-facing trusted-network/help copy for the unauthenticated all-interface inbound listener in `packages/blue-app/src/renderer/components/settings/OscSettings.tsx`.

**Checkpoint**: User Story 1 is independently usable with a project closed and correctly distinguishes saved preference from transient fallback.

---

## Phase 4: User Story 2 - Control Score Transport And Navigation (Priority: P1)

**Goal**: OSC score commands perform Java-compatible transport and score navigation using canonical renderer project/playback state.

**Independent Test**: In a marked project, send all `/score/*` commands, including suffixes/arguments and no-project cases, and verify fresh regular playback, stop isolation, exact marker behavior, score-end/zero fallbacks, view follow, and committed range updates.

### Tests for User Story 2

- [X] T017 [P] [US2] Add ordered score-command router tests for fresh play, regular-only stop, rewind, strict marker navigation, no-project no-ops, suffixes, and patch flushing in `packages/blue-app/src/renderer/tests/osc-command-router.test.ts`.
- [X] T018 [P] [US2] Add explicit fresh-play/restart store coverage in `packages/blue-app/src/renderer/tests/playback-store.test.ts`.

### Implementation for User Story 2

- [X] T019 [US2] Add a non-toggle, serialized fresh regular-playback IPC path that stops/restarts active regular playback without touching Blue Live in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/preload/preload.ts`, and `packages/blue-app/src/renderer/types/global.d.ts`.
- [X] T020 [US2] Add the matching fresh-play action and visible lifecycle/error state handling in `packages/blue-app/src/renderer/stores/playback-store.ts`.
- [X] T021 [US2] Implement queued score command routing that reuses canonical rewind/marker actions and flushes pending project patches before later play in `packages/blue-app/src/renderer/services/osc-command-router.ts`.
- [X] T022 [US2] Subscribe the primary application window once and route score command events without auxiliary-window duplication in `packages/blue-app/src/renderer/hooks/use-osc-control-commands.ts` and `packages/blue-app/src/renderer/App.tsx`.

**Checkpoint**: All five score commands match the Java behavior without a project-level OSC setting or changes to `.blue` XML.

---

## Phase 5: User Story 3 - Control Blue Live (Priority: P1)

**Goal**: External controllers can operate the retained Java Blue Live commands in deterministic order while the retired MIDI-toggle address remains inert.

**Independent Test**: With Blue Live stopped and running, send on/off, recompile, and all-notes-off commands; verify project/running preconditions, stop/start semantics, and one all-notes-off submission. Send the retired address during MIDI input and verify no state change.

### Tests for User Story 3

- [X] T023 [P] [US3] Add Blue Live OSC router tests for on/off, stopped-state recompile, active-only all-notes-off, no-project no-ops, and serialized lifecycle ordering in `packages/blue-app/src/renderer/tests/osc-command-router.test.ts`.
- [X] T024 [P] [US3] Add explicit retired-address exclusion coverage proving no command event or MIDI preference/runtime action in `packages/blue-app/src/shared/osc-control.test.ts` and `packages/blue-app/src/main/osc-control-service.test.ts`.

### Implementation for User Story 3

- [X] T025 [US3] Extend the ordered OSC command router to await existing Blue Live toggle, recompile, and all-notes-off bridges while preserving their project/session preconditions in `packages/blue-app/src/renderer/services/osc-command-router.ts`.
- [X] T026 [US3] Keep the command registry limited to the eight supported entries and add no MIDI-toggle fallback, mapping, or subscription in `packages/blue-app/src/shared/osc-control.ts` and `packages/blue-app/src/main/osc-control-service.ts`.

**Checkpoint**: The three Blue Live commands are independently usable and `/blueLive/toggleMidiInput` is always unknown/no-op.

---

## Phase 6: User Story 4 - Operate Reliably Across Network And Lifecycle Errors (Priority: P2)

**Goal**: Traffic, failures, port changes, and shutdown remain observable and deterministic without duplicate engine sessions or leaked sockets.

**Independent Test**: Exercise malformed/unknown messages, nested timed bundles, rapid repeated lifecycle commands, settings restart under traffic, port exhaustion, no project, and app quit; verify listener status, final engine state, and released port.

### Tests for User Story 4

- [X] T027 [P] [US4] Add deterministic UDP-socket contract tests for decoded messages, nested bundles, ignored timetags, malformed recovery, port release, and bind failures in `packages/blue-app/src/main/osc-control-service.test.ts`.
- [X] T028 [P] [US4] Add rapid mixed score/Blue Live command queue tests that verify arrival-order final state and no permanently rejected queue in `packages/blue-app/src/renderer/tests/osc-command-router.test.ts`.

### Implementation for User Story 4

- [X] T029 [US4] Harden listener restart/shutdown sequencing, stale generation rejection, error diagnostics, and snapshot ordering in `packages/blue-app/src/main/osc-control-service.ts` and `packages/blue-app/src/main/main.ts`.
- [X] T030 [US4] Ensure the renderer command queue catches individual action failures, reports through existing UI paths, and continues with later events in `packages/blue-app/src/renderer/services/osc-command-router.ts`.

**Checkpoint**: Listener availability and command ordering survive normal UDP and lifecycle error cases, and shutdown consistently releases the port.

---

## Phase 7: Polish & Cross-Cutting Validation

**Purpose**: Confirm the integrated feature remains compatible with application constraints and the documented acceptance path.

- [X] T031 [P] Run shared/main/preload/renderer OSC suites and repair type, lint, or behavior regressions in `packages/blue-app/src/**/*.test.*`.
- [X] T032 [P] Run the repository build, test, and lint commands and record results in `specs/059-osc-control-parity/quickstart.md` only if commands or expectations changed.
- [X] T033 Review the manual quickstart scenarios against automated coverage for settings fallback, eight command outcomes, retired-address exclusion, bundle order, and shutdown in `specs/059-osc-control-parity/quickstart.md`.
- [X] T034 Re-check that no OSC code or persistence change touches `packages/blue-data/` or `.blue` XML paths, and update completed task markers in `specs/059-osc-control-parity/tasks.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** has no dependency and establishes the dependency/contract surface.
- **Phase 2** depends on Phase 1 and blocks every user story because settings, listener lifecycle, and preload delivery are shared.
- **US1, US2, and US3** can be validated independently after Phase 2; implementation proceeds in P1 order because the settings panel supplies runtime observability and the command router shares the primary subscription.
- **US4** depends on the complete listener and router paths.
- **Polish** depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: Shared foundation only; it is the MVP for configuration and listener visibility.
- **US2 (P1)**: Shared foundation plus the primary command subscription; it does not require Blue Live behavior.
- **US3 (P1)**: Shared foundation plus the primary command subscription; it does not require score navigation behavior.
- **US4 (P2)**: Exercises both listener and renderer command paths after US1-US3.

### Parallel Opportunities

- T002, T003, T004, T006, and T010 affect separate files and can proceed in parallel once their inputs are available.
- Test tasks marked `[P]` within a user story can be authored independently before their implementation task.
- US1 UI work can proceed in parallel with US2/US3 router-test work after T011, provided `SettingsApp.tsx`, `App.tsx`, and router files are not edited concurrently.
- T027 and T028 are independent resilience suites; T031 and T032 are independent validation runs.

## Parallel Example: User Story 2

```text
Task: "Add ordered score-command router tests in packages/blue-app/src/renderer/tests/osc-command-router.test.ts"
Task: "Add fresh-play/restart tests in packages/blue-app/src/renderer/tests/playback-store.test.ts and packages/blue-app/src/main/main.test.ts"
```

## Implementation Strategy

### MVP First

1. Complete Phases 1 and 2.
2. Complete US1 and verify no-project listener configuration/fallback.
3. Add US2 score commands, then US3 Blue Live commands.
4. Add US4 stress/error coverage and run the full validation suite.

### Incremental Delivery

The listener plus Settings panel is independently deliverable. Score and Blue Live command handlers add value separately because they share a fixed command-event contract. Error hardening completes the live-performance reliability slice without expanding OSC scope.

## Notes

- Every task follows the required checkbox, ID, optional parallel marker, story label, and exact-path format.
- No task adds `/blueLive/toggleMidiInput`; its explicit negative tests guard the removed application behavior.
- Final review confirmed 34/34 tasks complete, 28/28 functional requirements covered, no constitution conflicts, and no blocking parity or implementation findings.
- Closeout verification passed the focused 77-test OSC/settings/playback set, the complete 1,956-test application suite with 2 existing skips, the workspace test suite, the application build, repository lint, and hands-on OSC command acceptance.
