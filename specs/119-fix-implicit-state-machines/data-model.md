# Data Model: Lifecycle Owners and Transitions

This is internal application state design, not a persistence schema. See [spec.md](spec.md) for behavior and [contracts](contracts/gestures-and-history.md) for integration rules.

## 1. Active Gesture

Each existing component/listener remains its gesture owner. A small host-listener helper owns subscriptions only.

| Field or association            | Rule                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Gesture identity and generation | Unique per press; duplicate completion/cancellation is inert                                           |
| Host document/window            | Captured from the event's current target at press; never a mount-time cached realm                     |
| Project identity                | Captured document/session plus stable target IDs; not just array indices or the latest callback        |
| Baseline                        | Affected values, insertion ownership, and applicable selection/layout state captured before first edit |
| Mode and payload                | Component-specific mutually exclusive mode data; shared helper does not store musical geometry         |
| Scheduled work                  | Owned frame/timer handles cancelled before a terminal callback can dispatch                            |
| Settlement                      | Active project gesture registers one callback returning actual queue/history completion                |
| Terminal outcome                | Commit, cancel, selection-only finish, or stale invalidation, chosen once before awaiting I/O          |

### Gesture transitions

| Current                | Event                                                      | Next/outcome                                                                          |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Idle                   | Valid press                                                | Active local preview or active live project group; capture host/identity/baseline     |
| Active preview         | Move                                                       | Update only the owned preview/projection                                              |
| Active live            | Move                                                       | Queue labeled update for the same group; preserve baseline and cancellation authority |
| Active content         | Release / required settlement                              | Detach listeners/work; publish final value once; await canonical completion           |
| Active local draft     | Editor closure                                             | Cancel draft without mutation                                                         |
| Active live            | Editor closure                                             | Settle valid latest edit and await/drain its queued work                              |
| Active non-BSB         | Escape / host blur / pointer cancel                        | Cancel preview or live history group; restore affected baseline                       |
| Active BSB move/resize | Host blur                                                  | Settle latest edit                                                                    |
| Active BSB move/resize | Escape / pointer cancel                                    | Cancel whole gesture                                                                  |
| Active                 | Target removal / project replacement / source invalidation | Revoke old authority; no mutation of a new target/project                             |
| Terminal               | Any late input/frame/callback                              | No action                                                                             |

Layout follows the same local lifecycle, with release writing existing layout persistence and cancel restoring initial size/ratio. Arrangement columns currently have no persistence. Selection-only gestures never create project history entries.

## 2. Transient Score Gesture Projection

Owner: existing score selection/session domain. Canonical score snapshots and dirty state are unchanged during preview.

Fields: gesture identity, document/session identity, origin scope, affected stable object IDs, original timing/placement, projected timing and destination group/layer, and any audio-specific preview values. Derive displayed groups using the existing pure snapshot move transform and the current canonical groups. Compose this projection before existing layer-height projection.

A single active gesture projection is sufficient; multiple floating views read the same transient owner. Never apply a captured full-score snapshot to cancel. On cancellation or target invalidation remove the projection. On release retain or reconcile it only through the fenced commit receipt, then clear it without a visual jump. An unrelated revision alone does not invalidate a draft; replacement/removal of its actual source does.

## 3. History Group and Cancellation Checkpoint

Canonical owner: existing main `ProjectHistory` coordinator. Existing requests already carry document ID, operation ID, expected revision, monotonic context sequence, origin, label, gesture ID, and phase. No new IPC channel is needed; marker and tempo snapshots and their creation patches carry optional transient identity fields on the existing serializable contract.

The app-side identity map associates marker IDs with their ordered list and tempo-point IDs with point objects. History copies retain those IDs; edits retain the target ID, while deletion and creation allocate a new one. IDs are neither project content nor XML fields, and are included in retained-history memory estimates.

An active live group additionally owns one cancellation checkpoint: baseline cursor/history references, saved-state association, prior redo suffix and any entries that would otherwise be evicted while that group remains cancellable. Share immutable entry/memento references; never clone the complete ledger per frame. Keep the public chronological ledger within its existing action limit. Its one bounded active cancellation checkpoint is transient rollback state, not another published action; account the union of unique retained bytes, including checkpoint-only entries, before admitting mutation or group growth. Small gestures at the normal 200-action capacity remain allowed.

| Event                              | Group behavior                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Begin with changed value           | Admit bounded checkpoint, then establish one cancellable action                                                                            |
| Update                             | Merge into that group; reject growth before mutation if rollback state cannot be retained                                                  |
| End, including no-op/metadata-only | Close matching group; discard a whole-group net-zero result and restore its checkpoint; otherwise retain one action and release checkpoint |
| Cancel matching active tail        | Restore canonical baseline and saved/dirty projection; restore pre-gesture redo availability; reconcile runtime and publish once           |
| Intervening settled action         | Close old group/checkpoint and revoke old cancel authority before the new action                                                           |
| Late terminal for superseded group | Cannot close/cancel a different group; return existing no-change/stale outcome                                                             |
| Budget admission fails             | Leave canonical state unchanged, or cancel the already-open group back to baseline; surface existing oversize/failure handling             |

At a full byte budget, a live cancellable edit can require more retained data than a single final edit. The ordinary chronological action limit alone must not reject a small live gesture. Do not silently exceed the existing limits or evict its rollback baseline. Any existing explicit history-reset agreement is a separate user decision; only subsequent authorized work establishes a new baseline. An old drag cannot resume just because a reset was approved.

Group finalization compares the complete original/final affected content and stable identity/reference topology, using existing memento/identity support. Scalar equality alone is insufficient for structural edits, and XML equality alone cannot establish identity preservation. A net-zero result uses the baseline restoration/publication path without adding an action.

Automation structural groups also retain concrete baseline point/resolution inverse patches for every affected parameter. Preserve the earliest baseline across merges; cancellation/Undo sends those live-reconcilable inverses and Redo sends the final forward values. A generic restart-required structural fallback is not automation restoration.

## 4. PianoRoll Gesture State

Internal to `NoteCanvasMouseListener`; public interaction methods remain a façade. Optional P1b representation change follows P1a correctness.

- Idle: no preview, create note, source note data, field baseline, marquee, or autoscroll work.
- Selecting: marquee geometry, press-time selection baseline, and current pointer coordinates.
- Moving: source note positions/pitches, mouse-note anchor, preview notes, and current pointer coordinates.
- Creating: initial pitch/time and draft note/duration.
- Resizing left/right: source timing, edge constraints and preview notes.
- Field editing: affected field/notes, original values, initial pointer/pitch anchor, and preview fields.

Autoscroll handle remains a separately owned resource shared by selecting/moving. Every terminal path stops it. Commit compares original and final values; cancel clears state without invoking a project edit. Preserve linked/neighbor/scale/snap behavior from existing transforms and parity tests.

## 5. Java Runtime Ownership

| Domain                     | Representation                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Request snapshot           | Invocation epoch/signal, project session ID, native project directory, immutable dependency list/key                                         |
| Initialization authority   | One recovered promise tail; readiness/cache rechecked inside it                                                                              |
| Process state              | None; spawning with owned handle/directory and nullable client until construction; connected with handle/client/directory and readiness data |
| Requested dependencies     | Key recorded before init; retained even if a top-level initialization fails                                                                  |
| Active session             | Null until current successful init; then session ID and dependency key                                                                       |
| Lifecycle epoch            | Increment/abort at disposal; all queued old requests retain the invalidated identity                                                         |
| Cleanup                    | One idempotent promise per owned handle, separate from the currently published process state                                                 |
| Client connection lifetime | Explicit disconnect invalidates queued work; transport reset alone does not permanently close lifetime                                       |
| Termination result         | Confirmed exited, not started, or failed with reason; signal delivery is not exit confirmation                                               |

### Runtime transitions

| Current/event                           | Result                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid queued request acquires ownership | Recheck epoch and ready cache; reuse if compatible                                                                                                       |
| Probe/reservation completes             | Recheck cancellation before spawning/next operation                                                                                                      |
| Process returned to stale request       | Terminate captured handle before client construction/publication                                                                                         |
| Current process created                 | Own handle before awaiting connection; protect client construction failures                                                                              |
| Connection/health success               | Connected process, active session still null                                                                                                             |
| Init requested                          | Clear readiness; record dependency key                                                                                                                   |
| Current init success                    | Publish active session; increment Jython revision once                                                                                                   |
| Init protocol failure                   | No active session; preserve requested key for safe retry                                                                                                 |
| Transport/process failure               | Clean captured resources; clear current state only for matching owner                                                                                    |
| Disposal                                | Invalidate requests, detach current state, request termination immediately, invalidate client queue, await bounded cleanup independent of initialization |
| Cleanup deadline/failure                | Explicit failure; do not report clean exit or publish new readiness over an unconfirmed conflicting process                                              |

Production process creation receives cancellation and checks it after port reservations and immediately before spawn. Its synchronous onSpawned callback registers ownership before the factory resolves; the spawning variant permits client=null until construction. Disposal can therefore see a created child before the initializer resumes and must await that child's bounded cleanup. Only a genuinely unspawned cancelled reservation may be skipped. Termination observes exit events/status, uses the existing two-second graceful deadline, then one-second force-exit confirmation with referenced timers. Private factory/termination injection contracts change with their test doubles; public manager methods and helper protocol do not.

## 6. Playback Lifecycle and Projections

Owner: renderer playback store, reflecting main authority. Internal lifecycle variants:

| Phase        | Required data / compatibility projection                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Idle/stopped | Terminal phase/message; not playing or auditioning; no anchor/live display                                                        |
| Error        | Error message; same terminal resets                                                                                               |
| Starting     | Attempt identity, mode, optional transport anchor, confirmation bookkeeping; not playing until confirmed                          |
| Playing      | Attempt identity, mode, anchor, follow-start already applied marker; playing                                                      |
| Stopping     | Attempt identity, mode/explicit audition indication, anchor, wasPlaying confirmation; projected playing equals confirmed activity |

Message/anchor are transitioned coherently; partial host events retain omitted values. Local stop clears audition indication as today. A host stopping event is authoritative confirmation that the host was playing. Existing `setPlaying` becomes a lifecycle transition rather than an independent boolean write; false terminates coherently, true confirms activity in the current mode.

Clock, display, cadence, latency correction, saved/active follow preferences, and retired clock-session watermark remain outside the union. Clock acceptance is restricted to a non-terminal lifecycle, current/newer non-retired session IDs, and non-decreasing sequences within a session. Rate/ksmps fallback never leaks across different clock session IDs. A starting clock survives playing confirmation.

Local async actions capture attempt identity; an old response/error cannot settle a newer attempt. A normal start applies the follow-on-start rule once at its first accepted confirmation, including a host status that wins the local reply race. Terminal transitions restore saved follow and clear clock/display/anchor. Repeated terminal resets reuse the idle display object; high-cadence ticks update display only.

BSB root/widget snapshots additionally expose an optional transient `gestureTargetId` from the app-side object identity map. It identifies a canonical incarnation independently of the serialized widget ID, transfers with history copies, and changes on replacement or independent copying. The owning editor captures assignment/root/widget identities for move/resize authority; wrappers discard invalidated work before input, frames or terminals. These identifiers are never XML fields.
