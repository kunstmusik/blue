# Contract: Java Runtime Ownership and Disposal

**Requirements**: FR-013–FR-019, FR-024; SC-004, SC-006.

## Stable external boundary

Retain `JavaRuntimeSessionManager` construction and public methods: getClient, getJythonStateRevision, ensureReady, reinitialize, reinitializeClojure, reinitializeJython, and dispose. Runtime protocol/reply envelopes and per-dependency loading results remain unchanged. Main owns files, native project directories, helper clients and processes; renderers/data do not gain host access.

## Readiness order and reuse

- Snapshot immutable project session ID, native project directory, dependency list/key and lifecycle epoch at invocation, including requests that queue behind another initializer.
- Serialize cache check, process replacement, initialization and readiness publication. Recheck epoch/cache after acquiring ownership; recover the chain after rejection.
- Same session/directory/dependencies reuse readiness without resetting script state. Different session with compatible directory/dependencies reuses the healthy process and initializes that session once. Changed directory or dependencies already requested requires replacement.
- Clear active-session readiness and record requested dependencies before init. A top-level init failure does not restore the old active-session claim or forget dependencies partially loaded. Individual dependency-load diagnostics retain existing protocol meaning.
- Publication and Jython revision changes require current epoch and matching owned process. Apply the same checks to explicit Jython/Clojure reinitialization responses; delayed failure/success cannot change a newer owner.

## Cancellation at asynchronous boundaries

Recheck authority after prior cleanup, Java probe, port reservations/process creation, connection, health and initialization, before the next operation or state publication. A constructor exception after spawn still requires cleanup of that captured handle.

The private process factory receives cancellation and an onSpawned ownership callback. Production creation checks cancellation after asynchronous port reservation and immediately before spawn, then invokes onSpawned synchronously after creating/observing the child and before resolving its promise. The callback records a manager-owned spawning handle with client=null until client construction. Thus disposal can skip genuinely unspawned cancelled reservations and still prevent a future helper launch. A child already created but waiting for the initializer's await continuation is not an unavailable handle: it is registered, and disposal must await its bounded cleanup. Injected factories must honor the same synchronous registration contract; fallback cleanup of an unannounced late handle does not replace production ownership. A late handle returned by an injected or racing factory is terminated before client construction/connection/publication. Disposal never treats an unknown pending handle as confirmed exited.

Every queued pre-disposal request retains its invalidated epoch; it cannot recapture the new epoch and revive. Fresh post-disposal requests may initialize after earlier ownership is released and conflicting process cleanup is confirmed.

## Explicit disconnect versus transport recovery

`JavaRuntimeClient.disconnect()` invalidates the connection lifetime and queued operations, and closes the current socket. Requests queued under the old lifetime cannot call ensureRequestSocket to reopen it. Explicit reconnect starts a new lifetime; old queued results remain stale, and an old generation's failure/reset path cannot close the new socket. Ordinary current transport failure resets the broken socket without permanently disabling a valid client's later retry. Preserve current response/error envelopes.

## Termination and exit confirmation

Internal `terminateJavaRuntimeProcess` returns a promise of exited, not-started, or failed with reason. Update the private terminateProcess injection and all fakes to that result contract; a void fake is not confirmed exit.

1. Register exit/error observation before signaling; check known exit/spawn failure.
2. Send SIGTERM synchronously before the first await.
3. If exit remains unconfirmed after the existing 2000 ms grace, request SIGKILL. `child.killed` only indicates signal delivery and must not suppress escalation.
4. Wait up to 1000 ms for force-exit confirmation. Keep awaited deadline timers referenced and clear timers/listeners on completion.
5. Exit events/status or known failure to spawn establish completion. Failed kill requests with no subsequent exit, signal errors, and expired confirmation deadlines produce failed, never exited.

These are bounded cleanup safety deadlines; they are not new product performance budgets. Native Windows signal semantics require actual Windows evidence.

`dispose(): Promise<void>` increments/aborts epoch and detaches published ownership synchronously, starts per-handle termination immediately, invalidates/disconnects client work, then awaits bounded cleanup. It never waits for initialization or queues graceful shutdown behind it. Share idempotent cleanup promises for repeated/stale paths. Reject disposal on failed cleanup and retain enough diagnostic/ownership information to avoid claiming clean termination or starting a conflicting replacement over it. Existing main shutdown error handling must receive that rejection; verify its behavior, changing it narrowly if it would report clean success.

## Required test schedules

- Deferred probe: dispose, then probe success; zero helper launches.
- Deferred reservation: abort before spawn; zero launches. Injected late handle: terminated before any client work.
- Pause after actual spawn/onSpawned but before manager adoption/await continuation: disposal observes the handle and does not succeed until its bounded cleanup resolves.
- Constructor, connect, health throw/negative response: attempt resources cleaned, retry possible.
- Dispose during connect/health/init: immediate signal, no late readiness/revision; no queued shutdown dependency.
- Three distinct requests: one initializer at a time, final successful owner matches established order; same-key calls initialize once.
- Init failure then removed/changed dependencies: fresh helper; unchanged retry remains allowed without stale readiness.
- Explicit disconnect with queued work: no socket recreation; ordinary transport recovery still passes; an old generation's later failure cannot reset a newly reconnected socket.
- Realistic fake child sets killed=true on SIGTERM without exit: SIGKILL still occurs; test exit during grace, confirmed forced exit, signal failure and timeout.
- Repeated cleanup and late notifications cannot clear a newer session. Existing native directory and project-relative script behavior remains unchanged.
