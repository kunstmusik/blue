# Tasks: Recover Blue Engine Lifecycle

**Input**: Design documents from `/specs/078-recover-engine-lifecycle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Verification**: Runtime, process-identity, typed-contract, UI, cross-platform, compatibility, and stress regressions are required by the constitution and plan. Bug regressions must reproduce the failure before implementation where the harness supports it.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish baseline evidence and deterministic test fixtures without changing behavior.

- [X] T001 Record the current rapid restart, shutdown, manifest, TCP, and owner-loss baseline plus affected commands in `specs/078-recover-engine-lifecycle/quickstart.md`
- [X] T002 [P] Add reusable fake child-process, fake engine-client, controllable timer, and registry adapters for lifecycle ordering tests in `packages/blue-app/src/main/engine-session.test-support.ts`
- [X] T003 [P] Add native owner-monitor test helpers for owner-exit and cancellation scenarios in `native/blue-engine/tests/cpp/OwnerMonitorTestSupport.h`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the shared state, manifest, identity, and renderer contracts required by all stories.

**⚠️ CRITICAL**: No user story implementation begins until this phase is complete.

- [X] T004 [P] Write failing strict decoder tests for recovery phases, categories, bounds, extra fields, and absence of PID/kill controls in `packages/blue-app/src/shared/engine-recovery.test.ts`
- [X] T005 [P] Define typed recovery channels, failure categories, status payloads, and strict normalization in `packages/blue-app/src/shared/engine-recovery.ts`
- [X] T006 [P] Write failing version-2 manifest tests for session tokens, version-1 compatibility, malformed records, PID reuse, unverifiable identity, and synthetic Windows command paths in `packages/blue-app/src/main/engine-process-registry.test.ts`
- [X] T007 Upgrade session manifests and sweep planning to preserve native executable paths, require session/command identity, and fail closed for unverifiable targets in `packages/blue-app/src/main/engine-process-registry.ts`
- [X] T008 Define the immutable EngineSession state, lifecycle results, dependency interface, and active-session identity helpers in `packages/blue-app/src/main/engine-session.ts`
- [X] T009 Add shared process error classification and bounded secret-free lifecycle diagnostic formatting in `packages/blue-app/src/main/engine-session.ts`
- [X] T010 Run the shared and registry contract tests and record the foundational checkpoint in `specs/078-recover-engine-lifecycle/quickstart.md`

**Checkpoint**: Shared contracts, safe registry identity, and the session seam are ready.

---

## Phase 3: User Story 1 - Play Reliably After Rapid Restarts (Priority: P1) 🎯 MVP

**Goal**: Make each playback launch a captured, generation-fenced session and ensure Stop/replacement/application exit truly await the targeted process without ghost engines.

**Independent Test**: Run 100 Play/Stop cycles with delayed exits and forced timeout escalation; every accepted replacement remains authoritative, older callbacks cannot clear it, and no child or manifest remains at the end.

### Verification for User Story 1

- [X] T011 [P] [US1] Write failing delayed-old-exit, stale-output/error/pubsub, exit-before-registration, disconnect-error, and replacement-fencing regressions in `packages/blue-app/src/main/engine-session.test.ts`
- [X] T012 [US1] Write failing idempotent shutdown tests covering pending-until-exit, graceful timeout, force escalation, signal failure, unconfirmed exit, and retained manifest evidence in `packages/blue-app/src/main/engine-session.test.ts`
- [X] T013 [P] [US1] Add a failing 100-cycle rapid Play/Stop stress regression with delayed child exits in `packages/blue-app/src/main/engine-session-stress.test.ts`
- [X] T014 [P] [US1] Extend bridge regressions for fallback/start serialization, current-client preservation, natural completion, and `killAndWait` semantics in `packages/blue-app/src/main/engine-bridge.test.ts`
- [X] T015 [P] [US1] Write failing capability and CLI parsing tests for `owner-liveness-v1`, valid owner PID, invalid/self/unrelated owner, and legacy no-owner mode in `native/blue-engine/tests/cpp/test_engine_capabilities.cpp`
- [X] T016 [P] [US1] Write failing owner-monitor unit tests for owner loss, duplicate notification, normal cancellation, initialization failure, and joined shutdown in `native/blue-engine/tests/cpp/test_owner_monitor.cpp`
- [X] T017 [P] [US1] Extend client capability decoding tests for `owner-liveness-v1` and legacy feature sets in `packages/blue-engine-client/tests/capabilities.test.ts`

### Implementation for User Story 1

- [X] T018 [US1] Implement captured spawn/readiness/exit observation and session-local manifest reconciliation in `packages/blue-app/src/main/engine-session.ts`
- [X] T019 [US1] Implement idempotent graceful-then-force shutdown with bounded waits and structured cleanup outcomes in `packages/blue-app/src/main/engine-session.ts`
- [X] T020 [US1] Refactor realtime launch, fallback, state listeners, Stop, dispose, and `killAndWait` to use only the active captured session in `packages/blue-app/src/main/engine-bridge.ts`
- [X] T021 [US1] Make application quit await captured realtime and Blue Live cleanup outcomes while preserving recoverable records on failure in `packages/blue-app/src/main/main.ts`
- [X] T022 [US1] Implement the cross-platform owner-monitor abstraction and normal handler-shutdown callback in `native/blue-engine/src/process/OwnerMonitor.h` and `native/blue-engine/src/process/OwnerMonitor.cpp`
- [X] T023 [US1] Parse and validate `--owner-pid`, advertise `owner-liveness-v1`, start/cancel the monitor, and preserve standalone signal behavior in `native/blue-engine/src/main.cpp` and `native/blue-engine/src/protocol/Capabilities.cpp`
- [X] T024 [US1] Register the owner-monitor sources and tests in `native/blue-engine/CMakeLists.txt` and `native/blue-engine/tests/cpp/CMakeLists.txt`
- [X] T025 [US1] Expose the owner-liveness capability constant and pass `--owner-pid` only for supporting selected engines in `packages/blue-engine-client/src/capabilities.ts` and `packages/blue-app/src/main/engine-bridge.ts`
- [X] T026 [US1] Remove fixed lifecycle sleeps and make Blue Live cleanup await its captured session before restart in `packages/blue-app/src/main/blue-live-engine.ts`
- [X] T027 [US1] Run the User Story 1 app/native/client tests and 100-cycle stress scenario, then record results in `specs/078-recover-engine-lifecycle/quickstart.md`

**Checkpoint**: Rapid realtime restart and abrupt owner loss are reliable without recovery UX or multi-app TCP improvements.

---

## Phase 4: User Story 2 - Run Multiple Blue Apps Safely (Priority: P2)

**Goal**: Isolate realtime and Blue Live sessions across multiple app owners and avoid fixed TCP endpoint contention without terminating another live owner's engine.

**Independent Test**: Run two app owners plus concurrent realtime/Blue Live sessions in forced TCP mode, restart each independently, inject endpoint collisions, and verify distinct endpoints and zero cross-owner mutation.

### Verification for User Story 2

- [X] T028 [P] [US2] Write failing endpoint allocation tests for independent loopback pairs, non-adjacent availability, bounded collisions, and deterministic exhaustion in `packages/blue-app/src/main/engine-endpoints.test.ts`
- [X] T029 [P] [US2] Extend concurrency tests for two app owners, realtime plus Blue Live, distinct manifests, and live-owner preservation in `packages/blue-app/src/main/engine-concurrency.test.ts`
- [X] T030 [P] [US2] Add a failing native TCP integration test proving two simultaneous endpoint pairs bind and operate independently in `native/blue-engine/tests/cpp/test_engine_concurrency.cpp`
- [X] T031 [P] [US2] Add registry sweep regressions for dead exact owner, live foreign owner, PID-reused command token, permission denial, and unverifiable command identity in `packages/blue-app/src/main/engine-process-registry.test.ts`

### Implementation for User Story 2

- [X] T032 [US2] Implement injectable independent TCP endpoint-pair selection and bounded fresh-pair retry policy in `packages/blue-app/src/main/engine-endpoints.ts`
- [X] T033 [US2] Integrate per-session TCP endpoints, bind-collision classification, full failed-session shutdown, and fresh-pair retry in `packages/blue-app/src/main/engine-session.ts`
- [X] T034 [US2] Route realtime and Blue Live construction through the same isolated endpoint policy without sharing session authority in `packages/blue-app/src/main/engine-bridge.ts` and `packages/blue-app/src/main/blue-live-engine.ts`
- [X] T035 [US2] Harden startup sweeping to terminate only exact dead-owner matches and report retained unverifiable records without blocking healthy owners in `packages/blue-app/src/main/engine-process-registry.ts`
- [X] T036 [US2] Register and run native concurrency coverage in `native/blue-engine/tests/cpp/CMakeLists.txt` and record forced-TCP multi-app results in `specs/078-recover-engine-lifecycle/quickstart.md`

**Checkpoint**: Multiple Blue owners, realtime, and Blue Live coexist safely over IPC or TCP.

---

## Phase 5: User Story 3 - Recover Without Terminal Commands (Priority: P3)

**Goal**: Recover one safely repairable failure automatically and provide bounded in-app restart and diagnostics actions when recovery fails.

**Independent Test**: Inject one recoverable startup failure and verify the original Play request succeeds after one retry; then fail both attempts and verify the three actions, diagnostic privacy, and live-owner safety.

### Verification for User Story 3

- [X] T037 [P] [US3] Write failing main-process recovery tests for one retry, fresh endpoints, no loop, busy/concurrent requests, unrecoverable classifications, and original-request continuation in `packages/blue-app/src/main/engine-recovery.test.ts`
- [X] T038 [US3] Write failing native-dialog action tests for Restart Audio Engine, Show Diagnostics, Cancel/close, and other-live-owner preservation in `packages/blue-app/src/main/engine-recovery.test.ts`
- [X] T039 [P] [US3] Write failing renderer tests for strict recovery-event handling and keyed loading-to-success/error toast transitions in `packages/blue-app/src/renderer/tests/engine-recovery.test.tsx`
- [X] T040 [US3] Add diagnostic privacy and Csound-output focus regressions excluding project/CSD text, environment dumps, and user paths in `packages/blue-app/src/main/engine-recovery.test.ts`

### Implementation for User Story 3

- [X] T041 [US3] Implement the bounded RecoveryOperation coordinator, failure classification, current-owner cleanup, and one automatic retry in `packages/blue-app/src/main/engine-recovery.ts`
- [X] T042 [US3] Integrate recovery with the serialized realtime Play request so successful retry fulfills the original request in `packages/blue-app/src/main/main.ts`
- [X] T043 [US3] Implement Restart Audio Engine, Show Diagnostics, and Cancel native actions with one explicit retry and Csound output focus in `packages/blue-app/src/main/main.ts`
- [X] T044 [US3] Expose validated display-only recovery events through preload without PID or termination methods in `packages/blue-app/src/preload/preload.ts` and `packages/blue-app/src/renderer/types/global.d.ts`
- [X] T045 [US3] Render keyed recovering/recovered/failed toast transitions while retaining playback status as canonical state in `packages/blue-app/src/renderer/hooks/use-ipc-listeners.ts`
- [X] T046 [US3] Append bounded lifecycle reports to the existing Csound output tab and redact excluded diagnostic content in `packages/blue-app/src/main/engine-recovery.ts`
- [X] T047 [US3] Run User Story 3 main/shared/renderer tests and document automatic/manual recovery evidence in `specs/078-recover-engine-lifecycle/quickstart.md`

**Checkpoint**: Users can recover safely without terminal commands and inspect actionable diagnostics.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Prove compatibility, portability, packaging, and complete feature outcomes across all stories.

- [X] T048 [P] Add native short-lived-owner integration coverage with a five-second exit bound in `native/blue-engine/tests/cpp/test_owner_monitor_integration.cpp` and register it in `native/blue-engine/tests/cpp/CMakeLists.txt`
- [X] T049 [P] Add packaged-app regression coverage for capability-gated owner arguments, legacy external engines, abrupt owner loss, and secret-free diagnostics in `packages/blue-app/src/main/packaged-runtime-verification.test.ts`
- [X] T050 [P] Add macOS, Windows, and Linux CI execution for owner monitoring, forced TCP concurrency, and engine-session stress tests in `.github/workflows/pr.yml`
- [X] T051 Verify representative `.blue` open/play/stop/save/reopen and generated-CSD compatibility, recording unchanged project/runtime boundaries in `specs/078-recover-engine-lifecycle/quickstart.md`
- [X] T052 Run `pnpm --filter @blue/app test`, `pnpm --filter @blue/engine-client test`, `pnpm --filter @blue/engine-native test`, and all three `@blue/app` builds, recording results in `specs/078-recover-engine-lifecycle/quickstart.md`
- [X] T053 Run repository-wide `pnpm test`, `pnpm lint`, and `git diff --check`, documenting any scoped platform exception in `specs/078-recover-engine-lifecycle/quickstart.md`
- [X] T054 Execute native multi-app TCP, realtime/Blue Live, recovery UX, and abrupt owner-loss quickstart scenarios on supported targets and finalize evidence in `specs/078-recover-engine-lifecycle/quickstart.md`
- [X] T055 [US1] Close the ZeroMQ/N-API shutdown teardown race by awaiting engine-client socket cleanup before Electron exit, with a regression in `packages/blue-app/src/main/engine-session.test.ts`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: starts immediately.
- **Foundational (Phase 2)**: depends on Setup and blocks all stories.
- **User Story 1 (Phase 3)**: depends on Foundation and delivers the lifecycle MVP.
- **User Story 2 (Phase 4)**: depends on Foundation and the session/shutdown interface from US1; its endpoint and registry tests can begin after Foundation.
- **User Story 3 (Phase 5)**: depends on Foundation and the safe cleanup/replacement interface from US1; its renderer contract tests can begin after Foundation.
- **Polish (Phase 6)**: depends on all selected stories.

### User story completion order

```text
Setup -> Foundation -> US1 (lifecycle MVP)
                         ├-> US2 (multi-owner isolation)
                         └-> US3 (recovery UX)
US1 + US2 + US3 -> Cross-platform/compatibility validation
```

### Within each story

- Required regressions fail before behavior implementation where supported.
- State/contracts precede services; services precede orchestration/UI integration.
- Captured session shutdown precedes endpoint retry and recovery work.
- Story checkpoint validation completes before claiming the story done.

## Parallel Opportunities

- T002 and T003 can run in parallel.
- T004/T005 and T006 can run in parallel before T007-T009 converge.
- US1 session regressions T011-T012 are sequential within one file; bridge/stress tests T013-T014, native tests T015-T016, and client test T017 can run concurrently with that stream.
- US2 endpoint, concurrency, native, and registry tests T028-T031 can run concurrently.
- US3 main/dialog/privacy regressions T037-T038/T040 are sequential within one file while renderer regression T039 runs concurrently.
- After US1, US2 and US3 can be implemented in parallel because they share only the completed session interface.
- Cross-platform test, packaged verification, and CI tasks T048-T050 can run in parallel.

## Parallel Examples

### User Story 1

```text
Task T011 then T012: Reproduce captured-session and shutdown races in engine-session.test.ts
Task T015/T016: Reproduce native capability and owner-monitor behavior in C++ tests
Task T017: Cover legacy and owner-liveness feature decoding in engine-client tests
```

### User Story 2

```text
Task T028: Test TCP endpoint allocation and exhaustion
Task T029/T031: Test app-owner isolation and registry safety
Task T030: Test simultaneous native TCP engines
```

### User Story 3

```text
Task T037 then T038 then T040: Test recovery policy, actions, and diagnostic privacy
Task T039: Test renderer recovery status and keyed toast behavior
```

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation.
2. Complete User Story 1 regressions and implementation.
3. Stop and validate the 100-cycle rapid restart test plus abrupt owner-loss cleanup.
4. Deliver the lifecycle fix independently before adding endpoint and UX enhancements if needed.

### Incremental delivery

1. **US1** removes the race and ghost-process lifecycle defect.
2. **US2** adds safe multi-app and TCP isolation.
3. **US3** adds automatic recovery and user-facing controls/diagnostics.
4. Polish proves cross-platform, packaged, project, and generated-CSD compatibility.

## Notes

- `[P]` means the task uses different files or can proceed without incomplete task output.
- Story labels trace work to the specification's independently testable journeys.
- Runtime manifests remain disposable OS-temp data and never enter project XML or settings.
- One-shot render/freeze/probe/utility subprocesses remain on their existing bounded paths and are outside the long-lived session model.
- Never replace ownership checks with executable-name discovery or `killall` behavior.

## Re-Verification Correction (2026-08-18)

An independent verification pass against the working tree found four completion
claims that did not match the code, followed by a fix pass that closed them:

- **T025**: `--owner-pid` was passed unconditionally (`ownerLivenessCapability: true`
  hardcoded in `engine-bridge.ts`). Fixed: the bridge now negotiates the flag —
  it retries once without `--owner-pid` when a selected engine rejects the
  option and remembers the decision for that bridge, so legacy external
  engines start normally. Covered by `engine-bridge.test.ts`
  ("negotiates --owner-pid by retrying without it...").
- **T038**: no dialog-action tests existed. Fixed: dialog logic extracted to
  `engine-recovery-dialog.ts` with injectable `showMessageBox`; Restart, Show
  Diagnostics, and Cancel/close semantics covered in `engine-recovery-dialog.test.ts`.
- **T046 / FR-018**: lifecycle reports never reached the Csound output tab and
  `formatLifecycleDiagnosticReport` was dead code. Fixed: failed startups,
  unconfirmed-exit cleanups, and unexpected exits emit a bounded structured
  report (session kind, owner PID, transport, session state, client
  connection, actions, outcome) to the engine output tab; the Show Diagnostics
  action combines the failure detail with that report.
- **FR-017**: Restart Audio Engine and recovery cleanup now also run the
  manifest sweep, which removes obsolete records and terminates only provably
  orphaned engines (dead owner plus verified identity).
- **FR-012**: Blue Live start is now wrapped by the recovery coordinator with
  the same single-retry policy and failure dialog as realtime playback.
- **T050/T054 evidence status**: macOS native tests executed locally
  (13/13 CTest). Windows and Linux native behavior is covered by the updated
  `pr.yml` matrix but had not yet executed on this branch at the time of
  writing; treat cross-platform native evidence as CI-pending until a run
  completes.
- **T055**: Audition shutdown could leave ZeroMQ/N-API work running after
  `app.quit()`. `EngineClient` now serializes and settles socket teardown, and
  `EngineSession` awaits `disconnect(false)` before reporting shutdown complete.
