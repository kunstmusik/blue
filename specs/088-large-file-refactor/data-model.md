# Phase 1 Data Model

This feature adds no persisted data shape. The entities below are transient architectural state and interfaces. `.blue` XML and all existing IPC payload types remain unchanged.

## ProjectSessionState

Canonical main-process identity for the active project.

| Field | Type | Invariant |
|---|---|---|
| `data` | `BlueData \| null` | Non-null only while a project is active; never cloned into a second canonical owner. |
| `filePath` | `string \| null` | Native OS path. May be null for an unsaved active project. |
| `revision` | non-negative integer | Starts at zero for each new session and increases only for accepted changed mutations. |
| `sessionId` | non-negative integer | Monotonically advances when project identity is replaced, closed, or explicitly invalidated. |

### Valid states

- **Empty**: `data = null`, `filePath = null`, `revision = 0`.
- **Unsaved active project**: `data != null`, `filePath = null`.
- **Path-backed active project**: `data != null`, `filePath != null`.

`data = null` with a non-null path is invalid. Revision is never carried across a session-identity transition.

### Transitions

| Operation | Preconditions | Result |
|---|---|---|
| `replace(data, filePath)` | `data` is a valid loaded/new `BlueData`; path is native or null | Replaces identity, increments `sessionId`, sets `revision = 0`. |
| `close()` | Any state | Clears document/path, increments `sessionId`, sets `revision = 0`; idempotent cleanup remains safe. |
| `publishPath(filePath)` | Active project | Updates only path, preserving document, revision, and session identity. |
| `recordMutation({ changed: false })` | Active project | Returns an unchanged receipt; revision does not advance. |
| `recordMutation({ changed: true })` | Active project | Increments revision exactly once and returns the matching receipt. |
| `recordMutation({ changed: true, invalidateSession: true })` | Active project and a mutation that changes Java/runtime dependencies | Increments revision, then advances `sessionId` without resetting that revision, matching the current stale-runtime fence. |
| `resetForShutdown()` | Any state | Leaves the empty state and is safe when called more than once. |

## ProjectDocumentCommitReceipt

Existing serializable acknowledgement returned to renderer clients.

| Field | Meaning |
|---|---|
| `changed` | Whether the canonical document accepted a semantic change. |
| `revision` | Authoritative revision after the batch. |
| `sessionId` | Authoritative project-session identity for stale receipt rejection. |

The refactor does not change the shared contract's exact shape. A renderer accepts the receipt only when its session matches and advances its revision monotonically.

## RendererProjectPatchQueueState

Transient renderer coordination state; it is not project data.

| Field | Type | Invariant |
|---|---|---|
| `sessionId` | current renderer session identity | Acknowledgements from other sessions are ignored. |
| `revision` | non-negative integer | Monotonic within one session. |
| `pending` | FIFO `ProjectDocumentPatch[]` | Order equals enqueue order; a patch belongs to at most one batch. |
| `timer` | timer handle or null | One trailing 100 ms timer at most. |
| `inFlight` | promise or null | At most one commit batch is in flight. |
| `dirtyBaseline` | boolean or unset | Captured from the first patch in the current drain sequence. |

### Queue state transitions

1. `idle -> scheduled`: first patch is enqueued, dirty baseline is captured, and the 100 ms timer is armed.
2. `scheduled -> in-flight`: timer or explicit flush takes the pending FIFO batch.
3. `in-flight -> in-flight`: newly queued patches remain pending; explicit flush continues draining after the active promise.
4. `in-flight -> idle`: no patches remain; dirty state is finalized from all batch receipts.
5. `any -> reset`: timer and unsent pending entries are cleared and session/revision state is reset; an already sent IPC call is not cancelled.
6. `in-flight failure -> idle/drain-next`: the failed batch is dropped, canonical refresh is attempted, background callers are notified, explicit callers reject, and already queued later edits retain existing ordering behavior.

## BsbSnapshotMutation

An in-memory application of a typed BSB patch to an instrument snapshot supplied by the caller.

### Identity rules

- The caller owns the outer instrument copy used for optimistic update.
- Affected supported tree paths may be copied.
- Unaffected sibling branches retain their existing references.
- Patches classified as metadata-preserving keep the established `objectNames` and `widgets` references.
- Preset, layout, UDO, and structured-patch results must equal current behavior.
- No implicit `structuredClone`, serialization round trip, or host access is permitted.

## IpcRegistrationLease

Internal ownership record for one registrar instance.

| Field | Meaning |
|---|---|
| `ipcMain` | Injected Electron/fake registration target; registry identity is scoped to it. |
| `key` | Stable domain key used to reject concurrent duplicate initialization. |
| `generation` | Opaque lease identity preventing an old disposer from releasing a newer lease. |
| `handlers` | Exact invoke channels installed by this lease. |
| `listeners` | Exact channel/function pairs installed by this lease. |
| `disposed` | Once-only teardown flag. |

### Lifecycle

`unregistered -> acquiring -> active -> disposing -> unregistered`.

Failure during `acquiring` removes recorded work in reverse order and releases only that generation. Calling the disposer repeatedly is a no-op. A second acquire while active throws before registering anything.

## StartupStage

One completed application-startup operation and its optional rollback.

| Field | Meaning |
|---|---|
| `name` | Diagnostic stage name. |
| `start` | Operation invoked in the current startup order. |
| `rollback` | Idempotent cleanup for a successfully completed stage, when the operation is reversible. |

If a stage fails, its internal transaction first cleans partial work; the composition root then rolls back previously completed stages in reverse order. Cleanup errors are reported without replacing the initiating startup failure. Normal shutdown is a separate ordered procedure, not a transition of this stack.

## BoundaryMapEntry

Review record stored in documentation, not runtime state.

| Field | Required content |
|---|---|
| `responsibility` | Cohesive behavior hidden by the module. |
| `interface` | Narrow façade/registrar operations. |
| `dependencies` | Inbound callers and injected/owned outbound dependencies. |
| `stateOwner` | Single canonical writer for every state read or changed. |
| `sideEffects` | IPC, filesystem, window, process, runtime, event, and logging effects. |
| `failureContract` | Returned/thrown errors, rollback, and user notification behavior. |
| `testSeam` | Lowest practical focused oracle plus stable-façade coverage. |
| `rollbackUnit` | Independently revertible implementation change. |
| `status` | Accepted, retained, or deferred with revisit condition. |
