# Data Model: Recover Blue Engine Lifecycle

All entities are transient runtime state. None is stored in `.blue` XML or program settings.

## Engine Session

One launched engine process with immutable `sessionId`, bridge-local `generation`, `kind`, `ownerPid`, `enginePid`, native `enginePath`, exact `spawnArguments`, `transport`, captured control/publication endpoints, shared-memory name, captured child/client, bounded diagnostics, manifest registration, exit outcome, and shared shutdown operation.

### Validation

- Identity, owner, executable, endpoints, and shared-memory name exist before readiness.
- Engine PID is positive before manifest validity.
- IPC identity is session-unique; TCP endpoints are distinct loopback addresses.
- Diagnostics exclude project/CSD content, environment dumps, and user paths.
- Commands target only the active session in a command-accepting state.

### State transitions

```text
allocated -> spawning -> connecting -> ready -> stopping -> exited
                    \-> failed -----> stopping -> exited
       any nonterminal state --------> stopping -> cleanup-failed
```

Only the first transition to `stopping` performs cleanup; later callers join it. `exited` requires observed child termination. `cleanup-failed` retains recovery evidence. Superseded sessions may finish cleanup but cannot mutate active status.

## Engine Process Manifest (Version 2)

Fields: `version`, `sessionId`, `kind`, `ownerPid`, `enginePid`, `enginePath`, exact arguments, endpoints, shared-memory name, and start time.

### Recovery classification

- `live-owner`: keep and never terminate from another owner.
- `orphan-match`: owner dead and session/process identity exact; eligible for bounded termination.
- `engine-exited`: remove record.
- `identity-mismatch`: remove obsolete record without signaling.
- `unverifiable`: do not signal automatically; retain/report conservatively.
- `invalid-record`: remove without signaling.

Version 1 remains readable for legacy cleanup but does not gain stronger identity through migration.

## Recovery Operation

Fields: unique `operationId`, session kind, `phase` (`recovering`, `recovered`, `failed`), automatic attempt count, explicit restart count, classified failure, eligible captured sessions, performed actions, and bounded outcome message.

Rules: at most one automatic retry; at most one additional user-confirmed restart; concurrent recovery joins or returns busy; eligibility never expands beyond current-owner or verified orphan sessions.

## Engine Diagnostic Report

Includes operation/session identity, owner classification, transport category, failure category, shutdown/escalation/exit/manifest/retry outcomes, and ordering durations. Excludes project content, generated CSD/orchestra/score, environment dumps, user paths, and unbounded output.

## Owner Monitor

Fields: `ownerPid`, platform mechanism, state (`inactive`, `watching`, `owner-lost`, `cancelled`, `failed`), and whether shutdown was requested.

Monitoring starts only after owner validation, requests shutdown once, and is cancelled/joined during normal exit. Engines lacking the capability omit the owner argument and rely on managed shutdown plus registry sweep.
