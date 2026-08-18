# Engine Session Lifecycle Contract

## Interface

```text
createSession(request) -> session
awaitReady(session) -> ready | classified failure
shutdownSession(session, reason) -> exited | cleanup failure
isActive(session) -> boolean
```

No caller receives a general-purpose PID termination interface.

## Creation and readiness

- Allocate immutable session ID, shared-memory identity, and endpoints before spawn.
- Attach process listeners before asynchronous registration/readiness work.
- Manifest registration remains session-owned even if exit occurs first.
- Readiness requires a live captured child, connected client, compatible handshake, and created engine.
- Fallback/retry creates a new session only after the failed session reaches a terminal shutdown result.

## Active-session fencing

- One bridge has at most one active session.
- Output, state, error, readiness, and exit callbacks carry their originating identity.
- Canonical status or bridge references change only when that identity remains active.
- Session-local cleanup and exact record removal may complete after supersession without affecting another session.

## Shutdown

- Concurrent calls share one promise and one signal sequence.
- Commands are rejected once shutdown starts.
- Detach/disconnect captured listeners and client; do not read bridge-global session fields.
- Request graceful termination and await exit for a bounded interval; escalate and await again if necessary.
- Return `exited` only after observed termination.
- Remove only the exact captured manifest after confirmed exit, including late registration.
- On unconfirmed exit return cleanup failure and retain recoverable evidence.

## Endpoint policy

- IPC and shared-memory identities are unique per session.
- TCP control/publication endpoints are distinct independently selected loopback endpoints.
- Bind collision is separate from runtime unavailability and receives bounded fresh-pair retries.

## Sweep policy

| Owner | Engine identity | Action |
|---|---|---|
| Alive | Any | Keep; never signal |
| Dead | Exact match | Bounded terminate, confirm exit, remove |
| Dead | Absent | Remove record |
| Dead | Mismatch | Remove record without signaling |
| Dead | Unverifiable | Do not signal automatically |

## Required evidence

Delayed old exit cannot clear replacement; exit-before-registration leaves no record; shutdown is idempotent and awaits exit; timeout escalation is deterministic; fallback waits for exit; rapid restart leaks nothing; live other-owner sessions survive recovery.
