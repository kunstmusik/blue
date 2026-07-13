# Tasks: MIDI Device Input And Blue Live Routing

**Input**: Design documents from `/specs/058-midi-live-input/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/midi-input-runtime.md](./contracts/midi-input-runtime.md), [quickstart.md](./quickstart.md)
**Tests**: Required by FR-027. Write the focused test tasks first and confirm they fail for the missing behavior before implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Work can proceed in parallel because it targets different files and has no unfinished dependency on another task in the same phase.
- **[Story]**: User story served by the task.
- Every task names its implementation or verification path.

## Phase 1: Setup And Shared Contracts

**Purpose**: Establish one serializable vocabulary for settings, runtime state, commands, and notes before process-specific work begins.

- [X] T001 Add validated MIDI preference, runtime snapshot, service command, command acknowledgement, and normalized note types in `packages/blue-app/src/shared/midi-input.ts`; extend `BlueLiveNoteTriggerRequest` source metadata compatibly in `packages/blue-app/src/shared/project-editor.ts`.
- [X] T002 [P] Add reusable fake `MIDIAccess`, `MIDIInput`, message, open/close, and statechange fixtures in `packages/blue-app/src/renderer/tests/helpers/fake-midi-access.ts`.
- [X] T003 Add shared contract/default/range validation tests in `packages/blue-app/src/shared/midi-input.test.ts`, `packages/blue-app/src/shared/program-settings.test.ts`, and `packages/blue-app/src/main/program-settings-store.test.ts`.

---

## Phase 2: Foundational Electron And Persistence Infrastructure

**Purpose**: Make main-owned preferences, permission policy, cross-window coordination, and the narrow preload bridge available to every user story.

**⚠️ CRITICAL**: No user-story implementation begins until this phase is complete.

### Tests

- [X] T004 [P] Add failing program-settings version/default/migration/round-trip tests for structured MIDI input preferences and preserved legacy input/output strings in `packages/blue-app/src/main/program-settings-store.test.ts`.
- [X] T005 [P] Add failing coordinator tests for primary-renderer validation, initialization, cached instance/revision handling, applied-settings reconciliation, queued/coalesced rescan, acknowledgements, and observer broadcasts in `packages/blue-app/src/main/midi-input-coordinator.test.ts`.
- [X] T006 [P] Add failing permission-policy tests for trusted primary-window `midi` and Electron's ordinary-MIDI `midiSysex` alias, secondary/untrusted denial, and retained `local-fonts` behavior in `packages/blue-app/src/main/midi-permission.test.ts`.
- [X] T007 [P] Add failing preload/global API contract tests for the narrow initialization, command, report, status, and rescan surface in `packages/blue-app/src/renderer/tests/midi-input-contract.test.ts`.

### Implementation

- [X] T008 Add the versioned `midiInput.devices` default, panel ID, validation, deduplication, and legacy-preserving migration in `packages/blue-app/src/shared/program-settings.ts` and `packages/blue-app/src/main/program-settings-store.ts`.
- [X] T009 Implement the primary-service command/status cache and application-window observer coordinator in `packages/blue-app/src/main/midi-input-coordinator.ts`.
- [X] T010 Implement the narrow MIDI methods/events in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`.
- [X] T011 Implement the testable trusted permission decision in `packages/blue-app/src/main/midi-permission.ts`; register both Electron permission handlers and coordinator IPC in `packages/blue-app/src/main/main.ts` without broadening unrelated permissions.

**Checkpoint**: Main can persist device intent, authorize only one transport owner, relay commands, and publish serializable runtime state without any renderer owning raw cross-process MIDI objects.

---

## Phase 3: User Story 1 - Configure MIDI Input Devices (Priority: P1) 🎯 MVP

**Goal**: Discover, rescan, enable, persist, and inspect zero or more MIDI input devices from app-wide Settings.

**Independent Test**: Attach a controller, open Settings > MIDI, rescan, enable and Apply it, verify connected status, restart with it absent, and confirm its remembered unavailable row remains.

### Tests For User Story 1

- [X] T012 [P] [US1] Add failing discovery/reconciliation tests for stable IDs, duplicate names, remembered unavailable devices, multiple enabled devices, one-listener-per-port, rescan coalescing, and per-device open failure in `packages/blue-app/src/renderer/tests/midi-input-service.test.ts` using `fake-midi-access.ts`.
- [X] T013 [P] [US1] Add failing component tests for the MIDI category, device identity/details, draft enablement, Apply behavior, live Rescan, empty/unsupported/denied/error states, and runtime badges in `packages/blue-app/src/renderer/tests/midi-settings.test.tsx`.
- [X] T014 [P] [US1] Add a failing Settings integration test proving MIDI draft changes persist app-wide without modifying project MIDI mappings, realtime-render MIDI options, or legacy output data in `packages/blue-app/src/renderer/tests/settings-window.test.tsx`.

### Implementation For User Story 1

- [X] T015 [US1] Implement the injected, idempotent Web MIDI discovery and preference reconciliation service—non-SysEx access, union of live/remembered devices, per-port open/close, status derivation, and rescan—in `packages/blue-app/src/renderer/services/midi-input-service.ts`.
- [X] T016 [P] [US1] Implement the serializable runtime snapshot store in `packages/blue-app/src/renderer/stores/midi-input-store.ts`.
- [X] T017 [US1] Implement the primary-window lifetime host, initialization, command subscription, snapshot reporting, Strict Mode-safe teardown, and App mount in `packages/blue-app/src/renderer/hooks/use-midi-input-service.ts` and `packages/blue-app/src/renderer/App.tsx`.
- [X] T018 [US1] Replace the orphaned placeholder MIDI settings surface with the device table, enabled draft controls, connection/error badges, Rescan, and explanatory states in `packages/blue-app/src/renderer/components/settings/MidiSettings.tsx`; register it in `packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`.
- [X] T019 [US1] Wire successful program-settings saves to coordinator `reconcile` commands and runtime snapshots to all app Settings observers in `packages/blue-app/src/main/main.ts`, `packages/blue-app/src/main/midi-input-coordinator.ts`, and `packages/blue-app/src/renderer/components/settings/SettingsApp.tsx`.
- [X] T020 [US1] Run the available Electron Web MIDI permission/enumeration proof, record the user-reported development-app result, production bundle result, and unavailable release-platform checks in `specs/058-midi-live-input/research.md` and `specs/058-midi-live-input/quickstart.md`, and decide whether fallback transport is warranted.

**Checkpoint**: Settings independently manages real input-device intent and accurately observes connection outcomes, including remembered missing devices and partial open failures.

---

## Phase 4: User Story 2 - Use MIDI Without An Extra Toolbar Toggle (Priority: P1)

**Goal**: Applied enabled preferences remain active across Blue Live state and reconnect on app startup, with no second global capture button.

**Independent Test**: Enable and Apply a device, verify automatic connection, restart and verify reconnection, disable and Apply to close it, and confirm the Blue Live toolbar has no `MIDI Input` control while the project MIDI panel remains available.

### Tests For User Story 2

- [X] T021 [P] [US2] Add failing startup/reload tests for automatic enabled-device reconciliation, absent enabled devices, disabled-device close, and no dependency on Blue Live running state in `packages/blue-app/src/renderer/tests/midi-input-lifecycle.test.tsx`.
- [X] T022 [P] [US2] Update `packages/blue-app/src/renderer/tests/blue-live-toolbar.test.tsx` to require removal of `MIDI Input`, and update `packages/blue-app/src/renderer/tests/midi-input-panel.test.tsx` to preserve the project mapping panel’s independent workbench registration.

### Implementation For User Story 2

- [X] T023 [US2] Complete startup and post-Apply automatic reconciliation so every enabled available port opens, absent enabled ports remain visible, and no service state models a global capture/running toggle in `packages/blue-app/src/renderer/hooks/use-midi-input-service.ts` and `packages/blue-app/src/renderer/services/midi-input-service.ts`.
- [X] T024 [US2] Remove the obsolete `MIDI Input` button and its incorrect panel-opening handler from `packages/blue-app/src/renderer/components/menu-bar/ToolbarBlueLive.tsx` while leaving workbench/window registration unchanged.
- [X] T025 [US2] Implement deterministic disabled-device listener detachment, source release, port close, and application teardown paths in `packages/blue-app/src/renderer/services/midi-input-service.ts` and `packages/blue-app/src/main/midi-input-coordinator.ts`.

**Checkpoint**: Per-device Settings preferences are the only capture controls; enabled devices are continuously available to the app without making Blue Live own their lifecycle.

---

## Phase 5: User Story 3 - Play Blue Live Instruments From Hardware (Priority: P1)

**Goal**: Hardware and Virtual Keyboard note events share one normalized renderer route and the existing canonical main-process project mapping.

**Independent Test**: Start Blue Live, play hardware note-on/off on two mapped channels, compare one equivalent Virtual Keyboard note, test velocity-zero note-off, and confirm an unmapped channel is ignored diagnostically.

### Tests For User Story 3

- [X] T026 [P] [US3] Add failing router tests for validation, velocity-zero normalization, source identity, idempotent repeated messages, aggregate same-note reference counts, accepted-note bookkeeping, and safe failed/unmapped submissions in `packages/blue-app/src/renderer/tests/midi-note-router.test.ts`.
- [X] T027 [P] [US3] Extend `packages/blue-app/src/renderer/tests/midi-input-service.test.ts` with failing byte-decoding tests for `0x8n`, `0x9n`, velocity zero, channel extraction, timestamps, ignored non-note messages, and stale/disabled source rejection.
- [X] T028 [P] [US3] Add `packages/blue-app/src/renderer/tests/blue-live-hardware-parity.test.ts` and extend `packages/blue-app/src/renderer/tests/virtual-keyboard-panel.test.tsx` with hardware/virtual channel-pitch-velocity parity, source metadata, note-off score text, and unmapped-channel diagnostics.

### Implementation For User Story 3

- [X] T029 [US3] Implement the common normalized note router, source ledger, aggregate `(channel, midiNote)` reference counting, source release, and Blue Live forwarding in `packages/blue-app/src/renderer/services/midi-note-router.ts`.
- [X] T030 [US3] Decode supported hardware messages and route them with `midi:<port-id>` source identity, native channel, device metadata, and source timestamp in `packages/blue-app/src/renderer/services/midi-input-service.ts`.
- [X] T031 [US3] Extend the existing trigger bridge to accept hardware metadata while retaining canonical arrangement and `MidiInputProcessor` mapping in `packages/blue-app/src/preload/preload.ts`, `packages/blue-app/src/main/main.ts`, and `packages/blue-app/src/main/blue-live-engine.ts`.
- [X] T032 [US3] Replace direct Virtual Keyboard trigger/all-notes-off calls with the common route and source-scoped release while preserving its visual pressed-note behavior in `packages/blue-app/src/renderer/components/workbench/panels/VirtualKeyboardPanel.tsx`.

**Checkpoint**: Hardware and virtual sources produce equivalent Blue Live score events from the same project state, and non-note/unmapped/stopped input is safe.

---

## Phase 6: User Story 4 - Recover From Device And Session Changes (Priority: P2)

**Goal**: Hot-plug, rescan, partial failure, project/session transitions, and repeated setup/teardown recover without duplicate messages or stuck notes.

**Independent Test**: Hold notes while unplugging/reconnecting, rescanning, disabling, stopping Blue Live, switching projects, and exiting; verify state recovery and zero stuck notes, including the same note held by two sources.

### Tests For User Story 4

- [X] T033 [P] [US4] Add failing hot-plug tests for access statechange, port generation replacement, late callback rejection, automatic enabled-device reopen, repeated rescan, and unaffected working ports during partial failure in `packages/blue-app/src/renderer/tests/midi-input-service.test.ts`.
- [X] T034 [P] [US4] Add failing source/session cleanup tests for disconnect, disable, same-note multi-source release, Blue Live stop, project replacement, app teardown, and idempotent repeated cleanup in `packages/blue-app/src/renderer/tests/midi-note-router.test.ts` and `packages/blue-app/src/renderer/tests/midi-input-lifecycle.test.tsx`.
- [X] T035 [P] [US4] Add failing Settings tests for live attach/remove/connect/error/partial snapshots and closure/reopen without transport disruption in `packages/blue-app/src/renderer/tests/midi-settings.test.tsx`.

### Implementation For User Story 4

- [X] T036 [US4] Implement access `statechange` reconciliation, per-port generation guards, source release before close, automatic reopen, and per-device failure isolation in `packages/blue-app/src/renderer/services/midi-input-service.ts`.
- [X] T037 [US4] Connect Blue Live status, project replacement, primary renderer teardown, and acknowledged app shutdown boundaries to idempotent router/service cleanup in `packages/blue-app/src/renderer/hooks/use-midi-input-service.ts`, `packages/blue-app/src/main/midi-input-coordinator.ts`, and `packages/blue-app/src/main/main.ts`.
- [X] T038 [US4] Publish and render current attach/remove/connecting/connected/disconnecting/unavailable/partial/error transitions without closing Settings affecting the service in `packages/blue-app/src/main/midi-input-coordinator.ts`, `packages/blue-app/src/renderer/stores/midi-input-store.ts`, and `packages/blue-app/src/renderer/components/settings/MidiSettings.tsx`.
- [X] T039 [US4] Execute automated hot-plug/replacement, two-source same-note, two-device partial-failure, Settings observer lifecycle, and 100-cycle stuck-note checks and record results and manual limitations in `specs/058-midi-live-input/quickstart.md`.

**Checkpoint**: Device and Blue Live lifecycle changes are observable, recoverable, listener-safe, and note-safe.

---

## Phase 7: Polish And Cross-Cutting Verification

**Purpose**: Confirm security, latency, compatibility, build health, and documented target-platform evidence across all stories.

- [X] T040 [P] Run focused MIDI/settings/toolbar/Virtual Keyboard/main tests with `pnpm --filter @blue/app test` and resolve regressions in the files named by failing tests.
- [X] T041 [P] Run main/preload/renderer production builds and workspace lint with `pnpm --filter @blue/app build` and `pnpm lint`; verify no native MIDI dependency, dynamic import, `require()`, or `@blue/data` change was introduced.
- [X] T042 Evaluate hardware-versus-Virtual Keyboard application routing and rescan/status timing against SC-002, SC-004, and SC-006; record the shared-route method, observed manual result, automated evidence, and quantitative measurement limitation in `specs/058-midi-live-input/quickstart.md`.
- [X] T043 Complete the development, production-build, and available packaged-artifact platform matrix in `specs/058-midi-live-input/quickstart.md`, explicitly marking unexecuted release targets; retain Web MIDI because recorded evidence does not require the fallback.
- [X] T044 Re-run `pnpm test`, `pnpm lint`, and `pnpm build`; verify all FR-001–FR-028 and SC-001–SC-009 evidence is traceable in `specs/058-midi-live-input/spec.md`, `specs/058-midi-live-input/tasks.md`, and `specs/058-midi-live-input/quickstart.md`.
- [X] T045 Preserve BSB real-time control updates for both timeline playback and a concurrently running Blue Live engine, including compiled runtime parameter-name synchronization and focused fan-out tests in `packages/blue-app/src/main/runtime-channel-sync.ts`, `packages/blue-app/src/main/blue-live-engine.ts`, and their tests.

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 Shared Contracts
  -> Phase 2 Electron/Persistence Foundation
      -> Phase 3 US1 Device Settings
          -> Phase 4 US2 Automatic Lifecycle/No Toggle
              -> Phase 5 US3 Hardware Blue Live Routing
                  -> Phase 6 US4 Recovery/Cleanup
                      -> Phase 7 Verification
```

- Phase 1 defines types and fakes needed by every later phase.
- Phase 2 blocks all stories because Settings, the primary service, and observers require permission, persistence, coordinator, and preload contracts.
- US1 delivers the first usable vertical slice: device discovery/configuration/status.
- US2 depends on US1’s service and preferences to prove automatic lifecycle and remove the obsolete control.
- US3 depends on an open hardware port and the shared request contract, then adds common note routing.
- US4 depends on US3’s held-note ledger to make disconnection/session recovery deterministic.
- Final verification depends on all selected stories.

### Within Each User Story

- Write the story’s tests and confirm the missing behavior fails before implementation.
- Implement pure/stateful services before React hosts and UI wiring.
- Establish one successful device/note path before partial failure and cleanup cases.
- Complete the independent test at each checkpoint before proceeding.

### Parallel Opportunities

- T002 and T003 can proceed after T001’s intended shapes are agreed; merge T001 first if types are imported directly.
- T004–T007 target separate main/renderer test files and can run in parallel.
- T012–T014 cover service, component, and Settings integration behavior independently.
- T015 and T016 target the service and store separately; T017 integrates them afterward.
- T021 and T022 cover lifecycle and toolbar/workbench regression independently.
- T026–T028 cover router, byte decoding, and Blue Live/Virtual Keyboard parity independently.
- T033–T035 cover transport, ledger, and Settings recovery independently.
- T040 and T041 can run in parallel after implementation; T042–T044 consume their results.

## Implementation Strategy

### MVP First

1. Complete shared contracts and Electron/persistence foundation.
2. Complete US1 through T020.
3. Stop and validate device discovery, Settings Apply, rescan, connection state, persistence, and unavailable-device restoration.

This MVP proves Web MIDI and app-wide device management before note routing expands the surface.

### Incremental Delivery

1. **US1**: Users can configure and inspect devices.
2. **US2**: Enabled means continuously active; the misleading toolbar button disappears.
3. **US3**: Hardware performs Blue Live instruments through the Virtual Keyboard-aligned path.
4. **US4**: Hot-plug and session boundaries become performance-safe.
5. **Polish**: Cross-platform, latency, security, build, and complete requirement evidence.

## Notes

- The feature deliberately does not add a global MIDI running/capture state.
- `Apply` commits device enablement; `Rescan` is live and non-persistent.
- Settings observes the primary service but never calls Web MIDI directly.
- Raw Web MIDI objects remain in the primary renderer; only serializable snapshots cross IPC.
- Keep the existing project MIDI Input panel and realtime-render MIDI options distinct from app-wide device settings.
- Do not add SysEx, MIDI output, controller mapping, recording, or a native transport unless the recorded proof-of-concept fails on a required target.
