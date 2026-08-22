# Quickstart: Recover Blue Engine Lifecycle

## Prerequisites

- Discoverable supported Csound 7
- Current-platform engine artifact and native build prerequisites
- Node.js 22, pnpm 10, installed workspace dependencies
- Native target execution for Windows process/TCP evidence

## Baseline State & Defect Profile

Prior to feature implementation:
- **Rapid Restart**: `EngineBridge` stores mutable `engineProcess`, `client`, and `playbackSessionId` on the bridge instance. Asynchronous exit and error callbacks from a terminated session clear current bridge fields, disconnect replacement clients, and emit erroneous stopped/error states for new playback sessions.
- **Shutdown Semantics**: `killEngineProcess()` sends `SIGKILL` without awaiting child exit or observing exit status. Replaced engines and newly spawned engines race on shared memory and port bindings.
- **Process Registry & Manifests**: Version 1 manifests lack session IDs. Mismatched or delayed exit handlers can delete active manifests. Sweep relies on unconfirmed PIDs.
- **TCP Endpoints**: Realtime and Blue Live use fixed/adjacent ports (5555/5556, 5560/5561). Running multiple Blue instances or concurrent forced TCP sessions causes port collisions and connection failures.
- **Owner-Loss**: Native engine sidecar has no owner process lifetime monitor. Abrupt termination of the Electron parent leaves orphaned engine processes running.
- **Affected Commands**: `playCSD`, `stopPlayback`, `stopEngine`, `startEngine`, `recompile`, `dispose`, `killAndWait`, application quit (`before-quit`/`will-quit`), and startup sweep `sweepStaleBlueEngineProcesses`.


## Foundational Checkpoint

- Shared recovery contract defined (`engine-recovery.ts`), strict decoder validated with 8 tests (`engine-recovery.test.ts`).
- Manifest version 2 and safe sweep plan implemented (`engine-process-registry.ts`), validated with 9 tests (`engine-process-registry.test.ts`).
- Immutable `EngineSession` state, error classification, and diagnostic reporting established (`engine-session.ts`).
- Test fixtures ready in `engine-session.test-support.ts` and `OwnerMonitorTestSupport.h`.

## User Story 1 Checkpoint (Play Reliably After Rapid Restarts)

- `EngineSession` lifecycle ordering, delayed exit fencing, exit-before-registration, disconnect error handling, idempotent graceful-to-force shutdown, retained manifest evidence, and awaited ZeroMQ teardown verified in `engine-session.test.ts` (12 tests).
- 100-cycle rapid Play/Stop stress regression executed with delayed child exits, verifying 0 leaked manifests and strict replacement authority in `engine-session-stress.test.ts`.
- `EngineBridge` refactored to use captured `EngineSession`, verifying fallback/start serialization, current client authority, natural completion, and `killAndWait` in `engine-bridge.test.ts` (8 tests).
- Native cross-platform `OwnerMonitor` implemented (`OwnerMonitor.h`/`.cpp`) and integrated into `main.cpp` with `--owner-pid` CLI parsing and `owner-liveness-v1` capability advertisement (`Capabilities.cpp`), validated with 11 CTest unit tests (`test_owner_monitor`, `test_engine_capabilities`, etc.).
- `@blue/engine-client` extended with `OWNER_LIVENESS_FEATURE` constant and strict capabilities decoding tests (35 tests passing).
## User Story 2 Checkpoint (Run Multiple Blue Apps Safely)

- Dynamic TCP endpoint-pair selection and bounded retry policy implemented in `engine-endpoints.ts` and tested with 5 unit tests (`engine-endpoints.test.ts`).
- Cross-owner session isolation, independent manifests, foreign live-owner protection, and concurrent realtime/Blue Live session independence tested in `engine-concurrency.test.ts` (5 tests).
- Native C++ integration test `test_engine_concurrency.cpp` executed with 2 simultaneous ZMQ request/pub handlers on separate TCP ports, passing in 100% CTest runs.
## User Story 3 Checkpoint (Recover Without Terminal Commands)

- `EngineRecoveryCoordinator` implemented in `engine-recovery.ts`, providing automatic 1-retry recovery on recoverable engine failures, strict failure classification, and diagnostic sanitization (9 tests in `engine-recovery.test.ts`).
- Renderer keyed recovering/recovered/failed toast transitions implemented in `use-ipc-listeners.ts` and verified with strict recovery decode tests (2 tests in `engine-recovery.test.tsx`).
- Realtime Play integrated with recovery coordination and native failure actions ('Restart Audio Engine', 'Show Diagnostics', 'Cancel') in `main.ts`.
- Preload and global types safely exposed for display-only recovery events (`preload.ts`, `global.d.ts`).

## Final Verification & Polish Checkpoint

- Native short-lived owner integration test `test_owner_monitor_integration.cpp` verified with 5-second exit bound and registered in CTest suite (13/13 native tests passing on macOS; Windows and Linux native runs are pending the updated CI matrix executing on this branch).
- Packaged-app regression coverage for owner-argument gating, legacy external engines, and secret-free diagnostics verified (12 tests in `packaged-runtime-verification.test.ts`).
- GitHub Actions CI workflow `.github/workflows/pr.yml` updated to run the native unit suite (owner monitoring, endpoint concurrency) across the macOS, Windows, and Linux matrix.
- Repository-wide `pnpm test` passed across all workspace packages and script tests: `@blue/app` 338 files with 3,182 passing tests and 2 skipped, `@blue/data` 1,626 tests, `@blue/engine-client` 35 tests, `@blue-cli` 5 tests, native CTest coverage, and Java tests.
- All three Electron builds (`build:main`, `build:preload`, `build:renderer`) verified clean.
- Code quality checks `pnpm lint` and `git diff --check` passing with 0 warnings or whitespace errors.
- Shutdown teardown regression verified: a real pending ZeroMQ request closes before
  process teardown, and `EngineSession` waits for `EngineClient.disconnect(false)`
  before completing app shutdown.

### Re-Verification Fix Pass (2026-08-18)

Independent verification found and fixed the following after the initial
implementation pass:

- `--owner-pid` is now capability-negotiated: the bridge retries once without
  the flag when a selected engine rejects it, so legacy external engines start
  normally (`engine-bridge.test.ts`).
- Startup failures fail fast when the engine exits before readiness instead of
  waiting out the connection timeout (`engine-session.test.ts`).
- Endpoint-pair exhaustion fails the transport attempt with an
  `address-contention` classification instead of silently falling back to the
  fixed default ports.
- Recovery cleanup and the Restart Audio Engine action now sweep provably
  orphaned managed engines in addition to current-owner cleanup (FR-017).
- Structured lifecycle diagnostics (owner, session state, client connection,
  actions, outcome) are appended to the Csound output tab on failure and shown
  by Show Diagnostics (FR-018).
- Recovery-failure dialog actions are extracted and unit-tested
  (`engine-recovery-dialog.test.ts`).
- Blue Live start participates in the single-retry recovery policy and failure
  dialog (FR-012).
- Runtime failure classification prefers runtime-library errors over generic
  not-found matches; session stdout/stderr capture is bounded; shutdown before
  spawn completes cleanly.
- Audition shutdown no longer leaves ZeroMQ/N-API work running after `app.quit()`;
  the client drains request/subscriber teardown and the session awaits it.




```sh
pnpm --filter @blue/app test -- engine-session engine-process-registry engine-concurrency engine-recovery playback-store
pnpm --filter @blue/engine-client test
pnpm --filter @blue/engine-native test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
git diff --check
```

Expected: old events cannot alter replacements; shutdown awaits exit and escalates boundedly; exit-before-registration leaves no record; PID-reused/unverifiable targets are not signaled; TCP pairs are distinct; recovery decoding/toasts pass; owner negotiation/monitor tests pass.

## Rapid restart stress

Run at least 100 deterministic fake-process Play/Stop cycles with delayed exits, connection failures, and repeated shutdown. Every accepted replacement remains authoritative, at most one non-exited session exists per bridge after serialized replacement, final state has no active managed child/record, and cleanup stays bounded.

## Realtime and Blue Live

Run both concurrently; rapidly restart each while the other remains active. Their identity, endpoints, client, status, and record remain independent, and final stop leaves no engines.

## Multiple applications and TCP

Launch two app owners, force TCP, and play in both. Trigger recovery/restart in one. Both use distinct endpoints; neither connects to or terminates the other; an occupied candidate causes bounded fresh-pair retry rather than broad cleanup.

## Recovery UX

Inject one recoverable failure. The UI shows recovery and the original click starts playback after retry. Then fail both initial and automatic attempts: no loop occurs; Restart Audio Engine, Show Diagnostics, and Cancel appear. Diagnostics focus Csound output, report lifecycle actions/outcome, and contain no project/CSD content, environment dump, or user path.

## Abrupt owner loss

On each supported OS, launch a supporting engine under a short-lived owner, confirm readiness, and terminate the owner without normal shutdown. The engine exits within five seconds and releases runtime artifacts. Explicit shutdown joins monitoring. A legacy engine without the feature receives no owner argument and remains sweep-recoverable.

## Broader compatibility

Open, play, stop, save, and reopen a representative project, then run:

```sh
pnpm test
pnpm lint
git diff --check
```

Project XML/CSD remain unchanged; existing playback, Blue Live, capability, output, and settings tests stay green; no host dependency enters `@blue/data`; native Windows CI covers owner handles, termination, path identity, and TCP isolation.
