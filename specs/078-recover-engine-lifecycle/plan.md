# Implementation Plan: Recover Blue Engine Lifecycle

**Branch**: `078-recover-engine-lifecycle` | **Date**: 2026-08-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/078-recover-engine-lifecycle/spec.md`

## Summary

Eliminate the rapid stop/start race by replacing bridge-wide mutable child/client fields with one immutable, generation-fenced engine session whose callbacks and registry record remain session-local. All replacement, fallback, stop, Blue Live, and application-shutdown paths will use one idempotent shutdown operation that disconnects the client, requests termination, awaits the captured child exit, escalates after a bounded timeout, and removes only the captured manifest after confirmed exit.

Keep IPC endpoints unique and allocate independent TCP endpoint pairs with bounded collision retries for Windows and compatibility fallback. Add one ownership-safe automatic recovery attempt to the original playback request, a keyed recovery status in the renderer, and native Restart Audio Engine / Show Diagnostics / Cancel actions after an unrecovered failure. Add a capability-gated native owner monitor so a supporting engine exits when its Electron owner disappears; retain the process registry sweep for legacy engines and abnormal cleanup.

## Technical Context

**Language/Version**: TypeScript 5.8.x strict mode; C++17; Node.js 22 and pnpm 10

**Primary Dependencies**: Electron 35.7.5; Node child-process/filesystem/process facilities in Electron main; React 19, Zustand, and Sonner; `@blue/engine-client` and ZeroMQ 6.1; native libzmq; `prctl` on Linux, `kqueue` on macOS, and process handles on Windows

**Storage**: Versioned transient engine-process manifests in the existing OS temporary-directory registry; in-memory recovery status and output-panel diagnostics; `.blue` XML and program settings unchanged

**Testing**: Vitest 4.x for deterministic main/shared/renderer lifecycle and UX tests; CTest through `@blue/engine-native`; native macOS/Windows/Linux CI; bounded stress and multi-app validation

**Target Platform**: macOS arm64, Windows x64, and Linux x64, retaining architecture-neutral behavior for other packaged targets

**Project Type**: Electron desktop application with a separately spawned native sidecar in a pnpm monorepo

**Performance Goals**: No recovery delay on normal startup; shutdown or owner-loss reaches a terminal result within 5 seconds; automatic recovery adds at most one retry; 100 rapid Play/Stop cycles leak no engines

**Constraints**: Electron main is the sole process authority; renderer contracts expose status/actions rather than PIDs or kill primitives; healthy engines owned by another live Blue app are never terminated; recovery is bounded and idempotent; default diagnostics exclude project/CSD content and user paths; no host APIs enter `@blue/data`; legacy compatible external engines continue to work

**Scale/Scope**: Realtime and Blue Live lifecycle, startup sweep, native owner monitoring, recovery status, existing Csound output UX, three operating systems, and concurrent multiple-app operation

## Constitution Check

### Pre-Design Gate

- **Portable data core — PASS**: No `@blue/data` change. Process, filesystem, endpoint, and owner-monitor work remains in Electron main and `native/blue-engine`; the renderer consumes typed serializable status only.
- **Java and project compatibility — PASS**: Java Blue is not authoritative for Electron sidecar lifecycle. `.blue` XML, CSD generation, rendering, settings, and successful playback/Blue Live behavior remain unchanged.
- **Canonical ownership and contracts — PASS**: Electron main owns sessions, manifests, endpoints, termination, recovery policy, and diagnostics. Blue Engine owns performance state and observes owner lifetime. Recovery contracts are typed; manifests are validated transient records.
- **Runtime and engine isolation — PASS**: Engine communication stays through `@blue/engine-client`. Renderer actions cannot target processes. Realtime, Blue Live, and app owners receive isolated sessions.
- **Host-path portability — PASS**: Registry and IPC paths use native `os.tmpdir()`/`path.join()` forms. Endpoint and shared-memory strings are explicit external-text forms. Windows behavior is tested on native Windows.
- **Verification evidence — PASS**: Required evidence covers delayed exit, exit-before-registration, timeout escalation, PID reuse, endpoint collision, owner loss, retry, privacy, Blue Live, multi-owner, 100-cycle stress, affected builds/tests, root lint/test, and `git diff --check`.

### Post-Design Re-check

- **Portable data core — PASS**: [data-model.md](data-model.md) locates new entities in Electron main, native engine, or disposable renderer state.
- **Java and project compatibility — PASS**: [quickstart.md](quickstart.md) preserves generated CSD, project round-trip behavior, realtime playback, and Blue Live.
- **Canonical ownership and contracts — PASS**: [engine-session-contract.md](contracts/engine-session-contract.md) defines session authority, shutdown, manifest identity, and sweeping; [engine-recovery-contract.md](contracts/engine-recovery-contract.md) defines display-only UX.
- **Runtime and engine isolation — PASS**: [owner-liveness-contract.md](contracts/owner-liveness-contract.md) capability-gates native owner observation; session recovery cannot terminate another live owner.
- **Host-path portability — PASS**: Contracts preserve native registry/executable paths and explicit endpoint text; quickstart requires native Windows evidence.
- **Verification evidence — PASS**: Tests target the session, registry planning, shared decoder, renderer listener, native owner monitor, and packaged cross-platform seams.

No constitution violations require an exception.

## Project Structure

### Documentation (this feature)

```text
specs/078-recover-engine-lifecycle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── engine-recovery-contract.md
│   ├── engine-session-contract.md
│   └── owner-liveness-contract.md
├── checklists/requirements.md
└── tasks.md                         # created by /speckit-tasks
```

### Source Code (repository root)

```text
packages/blue-app/src/
├── main/
│   ├── engine-bridge.ts
│   ├── engine-session.ts
│   ├── engine-session.test.ts
│   ├── engine-process-registry.ts
│   ├── engine-process-registry.test.ts
│   ├── engine-concurrency.test.ts
│   ├── blue-live-engine.ts
│   └── main.ts
├── preload/preload.ts
├── shared/
│   ├── engine-recovery.ts
│   └── engine-recovery.test.ts
└── renderer/
    ├── hooks/use-ipc-listeners.ts
    ├── stores/playback-store.ts
    └── tests/engine-recovery.test.tsx

native/blue-engine/
├── src/
│   ├── main.cpp
│   ├── ipc/ZmqHandler.cpp
│   └── process/
│       ├── OwnerMonitor.cpp
│       └── OwnerMonitor.h
├── tests/cpp/
│   ├── test_owner_monitor.cpp
│   └── test_engine_capabilities.cpp
└── CMakeLists.txt

packages/blue-engine-client/
├── src/capabilities.ts
└── tests/capabilities.test.ts
```

**Structure Decision**: Add one deep main-process `engine-session` module at the subprocess seam. It owns child/client/manifest/timer complexity behind a narrow create/shutdown interface; `EngineBridge` retains playback orchestration. Recovery presentation uses one shared validated contract and existing output infrastructure. Native monitoring is one platform-backed module advertised through existing capabilities.

## Design Decisions

### Session ownership and shutdown

- Each launch captures a unique ID, child, client, endpoints, shared-memory name, stderr, manifest registration, listeners, exit promise, lifecycle state, and shutdown promise.
- `EngineBridge` holds one `activeSession`. Async callbacks may alter canonical status/references only when their captured session is still active.
- Process listeners attach immediately after spawn. Exit racing registration awaits and removes only its exact record.
- An injected spawn/client/registry/clock/termination seam makes ordering deterministic in tests.
- Shutdown is idempotent: fence commands, detach listeners, disconnect the captured client, request graceful termination, await exit, escalate after a timeout, and await again.
- Remove a manifest only after confirmed exit; retain evidence on unresolved cleanup failure.
- Start, fallback, Stop, Blue Live, dispose, and `killAndWait` all await shutdown before replacement.

### Identity and endpoints

- Manifest version 2 adds a random session ID to owner PID, engine PID, start time, executable, arguments, endpoints, and shared-memory identity.
- Automatic termination requires dead/current owner eligibility plus exact process/session identity. Live other owners are always kept; mismatches are record-only cleanup.
- Preserve unique IPC paths. TCP launches choose two independent loopback port candidates rather than fixed/adjacent ports.
- Engine bind is authoritative. A classified collision fully shuts down that session and retries a bounded number of fresh endpoint pairs.

### Recovery UX

- One main-owned playback request owns one automatic retry. A classified startup/connect/readiness/unresponsive failure publishes recovering status, performs safe cleanup, selects fresh endpoints, and retries.
- Successful recovery continues the original Play request. A second failure offers Restart Audio Engine, Show Diagnostics, and Cancel.
- Explicit restart grants one additional attempt while preserving ownership rules.
- Lifecycle diagnostics append to and focus the existing Csound output panel; default reports exclude CSD/project content, environment dumps, and user paths.
- Existing playback status remains canonical; a shared recovery-status event drives only a keyed loading/success/error toast.

### Owner-loss backstop

- Add `--owner-pid` and advertise `owner-liveness-v1`; pass the argument only when supported.
- Linux uses parent-death notification plus immediate parent validation; macOS observes exact owner exit; Windows waits on an exact owner process handle.
- Owner loss requests normal handler shutdown and wakes the loop. Normal engine exit cancels/joins the monitor.
- Startup manifest sweep remains defense in depth for legacy engines and failures before monitor activation.

## Complexity Tracking

No constitution violations or exception-bearing complexity are planned.

## Closure Evidence (2026-08-18)

- The implementation is complete and all tasks are checked off. Local macOS arm64
  validation passed with repository-wide `pnpm test`, `pnpm lint`, all three
  `@blue/app` builds, `@blue/engine-client` build/tests, native CTest, and
  `git diff --check`.
- The final app suite reports 338 test files, 3,182 passing tests, and 2 skipped;
  native owner-monitor, endpoint-concurrency, recovery, Blue Live, registry, and
  rapid-restart coverage is included.
- A shutdown-specific regression now ensures ZeroMQ/N-API sockets are closed and
  their in-flight work is settled before Electron teardown. Engine shutdown uses
  `disconnect(false)` because child termination owns engine destruction at that
  boundary.
- The CI workflow contains the Windows/Linux native matrix; those platform runs
  remain the cross-platform evidence gate because this validation host is macOS.
