# Modularization and ownership

Use this rule before splitting a large module. The purpose of a split is to make a
responsibility easier to locate, test, and review while preserving the existing contract;
line count alone is not a justification.

## Review questions

1. **Responsibility cohesion** — What single domain responsibility does the proposed module
   own? Keep state, persistence, pure transformation, and host/UI coordination separate only
   when their behavior and callers support a real boundary.
2. **Deliberately small interface** — Which symbols must cross the boundary? Do not add a
   general-purpose abstraction, configuration, or extension point without a demonstrated
   consumer or focused test seam.
3. **Dependency direction** — Can dependencies form a one-way graph? Leaf contracts and pure
   transformations should not import adapters or orchestration; redesign or defer any split
   that creates a cycle or reverses ownership.
4. **Canonical state owner** — Which process, store, or session owns the state? The extraction
   must not duplicate ownership or move durable data across persistence boundaries.
5. **Compatibility strategy** — How do existing importers and callers continue to work? Prefer
   a stable façade, barrel, re-export, or thin delegate; keep newly extracted modules internal
   until an external consumer demonstrates the need for a public API.
6. **Lowest practical test seam** — What focused test can verify the moved behavior without
   exercising unrelated responsibilities? Run the existing behavioral oracle before and after
   the move; add a direct test only when no adequate seam exists.
7. **Rollback boundary** — Can the change be reviewed and reverted independently? Keep
   mechanical movement separate from semantic changes, record sanctioned exceptions, and make
   one responsibility boundary the smallest useful review unit.

## Reject or defer criteria

Reject or defer the proposal when the split is justified only by line count, when no coherent
responsibility owner can be named, when the interface would be broader than the responsibility,
when it introduces a cycle or split-brain state ownership, or when it has no demonstrated
consumer or test seam. Record the rejected seam, risk, and a concrete condition for revisiting
it instead of creating speculative helper modules.

## Boundary review record

Record each accepted or deferred proposal in the owning feature plan or change description.

- responsibility and public façade;
- extracted modules and their dependency direction;
- canonical state owner and compatibility strategy;
- lowest practical test seam;
- rollback boundary and any sanctioned semantic edits;
- acceptance, retention, or deferral rationale.

## Lifecycle and gesture review

Apply this review when adding or changing lifecycle behavior, gestures, or asynchronous resource
ownership, even when no module is being split. Record the relevant decisions in the owning spec,
plan, or change description. These checks make the constitution's state ownership, history, and
regression rules concrete; they do not require a state-machine framework or conversion of existing
stores and queues.

1. **Owner and invariants** — Name one canonical owner for each state domain and the combinations
   of values that must remain valid. Use a discriminated union when phases require mutually
   exclusive data. Keep independent preferences, clocks, counters, and queue contents separate.
   Derive related flags through one selector or projection; compatibility fields must update
   atomically with their source state. Do not use object getters on Zustand state: shallow merges
   materialize them as values.
2. **Transitions and event ownership** — Write a small table of current phase, event, next phase,
   side effects/cleanup, and failure or stale-event behavior. Cover applicable start, completion,
   release, Escape, blur, cancellation, disposal, retry, and duplicate events. Name the layer that
   consumes each event. An active gesture's Escape handler must run before the global transport
   shortcut and consume the event; a later bubble listener cannot undo an earlier handler's effect.
3. **Async authority and ordering** — Serialize competing operations that replace the same
   resource, then recheck readiness after acquiring ownership. Give shared or queued requests an
   explicit identity and cancellation policy. Capture the request/session generation before
   waiting and recheck authority after awaits before starting more work or publishing state.
   Clean up an attempt's captured resources without clearing or terminating a newer owner's
   resources. A phase union alone does not establish ordering or reject stale completions.
4. **Resource lifetime and terminal paths** — Associate every process, subscription, timer, frame
   callback, and gesture with one owner and idempotent cleanup. Record ownership as soon as a
   resource becomes available; immediately release a late resource returned to a cancelled attempt.
   Specify release, cancellation, unmount, and host-teardown behavior, including whether shutdown
   requests termination or waits for confirmed exit. Resolve a gesture's host document/window at
   gesture start; attach active listeners there and remove them with matching capture options.
   Follow [the popout conventions](popout-popup-conventions.md) for popup event handling.
5. **Preview, commit, and cancellation** — Trace each outward callback to its actual state owner
   before classifying an edit as local preview or live project mutation. Capture the baseline
   before the first durable edit, including mousedown changes. Local previews commit their final
   value through project history; live project patches use the existing history grouping and
   cancellation contracts. Specify whether blur settles or cancels. Cancellation restores the
   required canonical content, dirty state, history, and runtime state; clearing a drag ref is not
   rollback. Keep applicable history settlement registered while the gesture is active. Persisted
   layout/settings changes have their own cancellation owner and do not become project history.
6. **Behavioral evidence** — Add focused regression coverage for the distinct changed paths:
   competing requests, cancellation/disposal during startup, late success/failure, duplicate
   terminal events, resource cleanup, and commit/undo/redo where applicable. Use deferred promises,
   fake clocks, and work counts for deterministic scheduling checks in ordinary correctness CI.
   Verify host-realm behavior at the appropriate browser/Electron seam; a unit test alone does
   not establish popout acceptance. Keep speed acceptance under the existing performance policy.

Keep phase transitions in one place within their owner, using a reducer when it makes the rules
clearer. Extract a shared helper only when repeated behavior has a demonstrated common contract
and focused test seam. Retain cohesive queues and independent state domains; avoid a global
machine that couples unrelated features. Review changed behavior first and keep optional structural
refactors independently reviewable.

Feature-specific reference contracts and concrete retained owner boundaries:

- [Gestures and History Contract](../specs/119-fix-implicit-state-machines/contracts/gestures-and-history.md) —
  details the narrow host-gesture listener lifetime (`renderer/lib/host-gesture.ts`), transient score/audio
  projection (`renderer/stores/score-selection-store.ts`), local editor drafts (`EditableLineCanvas`, `TableEditor`),
  and canonical history settlement, net-zero release, and rollback checkpoints (`main/project-history.ts`,
  `renderer/lib/history-scope-router.ts`).
- [Java Runtime Lifecycle Contract](../specs/119-fix-implicit-state-machines/contracts/java-runtime-lifecycle.md) —
  details host-side JVM serialization, synchronous handle registration, bounded escalation termination,
  and client queue invalidation (`main/java-runtime/*`).
- [Playback and Shortcuts Contract](../specs/119-fix-implicit-state-machines/contracts/playback-and-shortcuts.md) —
  details host-document modal containment for shortcuts (`use-keyboard-shortcuts.ts`) and pure internal
  playback lifecycle transitions and atomic compatibility projection (`renderer/stores/playback-store.ts`).

## Current ownership map

Use these boundaries to choose a home for changes. Keep public import paths stable
when moving internals. Validate runtime import direction and exercise each changed
boundary through its existing callers.

### Portable project model and generation

- `@blue/data` owns `BlueData`, the canonical project model, and reads and writes
  project XML under the [compatibility contract](../specs/116-xml-compatibility-contracts/contracts/xml-loading.md).
  Keep XML validation and migration, CSD generation, and runtime policy behind
  the `BlueData` API. Policy code consumes public model getters and explicit inputs.
  Keep disk pruning, mixer code generation, and parameter/score assembly separate
  from CSD orchestration. Check XML acceptance and CSD parity at the model boundary.
- Keep JMask XML validation independent of snapshot hydration and model construction.
  The JMask field owns generator and modifier configuration. Use the JMask façade
  for existing consumers and keep implementation imports directed toward leaf code.
  Check [XML acceptance](../packages/blue-data/src/sound-objects/jmask-xml-acceptance.test.ts)
  and [generation](../packages/blue-data/src/sound-objects/j-mask.test.ts).
- Use static ES imports in `@blue/data`. Electron main or host-specific packages
  supply filesystem, process, engine, and Java resources at explicit boundaries.

### Shared project editor

- `packages/blue-app/src/shared/project-editor.ts` is the compatibility façade.
  Shared contracts and stable identity helpers underpin snapshot builders and patch
  appliers. Snapshots are read projections. Keep builders independent of write
  appliers, and keep patches independent of Electron and renderer state.
- Keep score time, automation, and object edits in their domain appliers. Compose
  the document change at the document patch boundary. Verify mutations and the
  resulting projections in [project editor tests](../packages/blue-app/src/shared/project-editor.test.ts).

### Main-process history and runtime

- `ProjectSession` owns active document identity, path and revision. Route durable
  edits through `ProjectHistory` with typed patches or a supported direct adapter.
  Prepare changes without publishing them. Commit and replay preserve stable
  identities and publish the model and ledger together.
- Keep patch inversion and compaction independent of the transaction coordinator.
  Store compact scalar records or reversible graph deltas. Account for retained
  payloads, including runtime replay hints and active cancellation checkpoints.
  Follow the [history data model](../specs/103-global-undo-redo/data-model.md)
  and the [gesture and history contract](../specs/119-fix-implicit-state-machines/contracts/gestures-and-history.md).
  Check canonical state, identity, dirty state, and runtime outcomes through
  commit, undo, and redo. Use [history coordinator tests](../packages/blue-app/src/main/project-history.test.ts)
  and [graph delta tests](../packages/blue-app/src/main/project-history-graph.test.ts) for the separate responsibilities.
- `main.ts` owns application composition, window lifecycle, startup rollback,
  and normal shutdown. Assemble IPC registrars through the registration lease.
  Preserve channel modes, order, and teardown with the
  [IPC inventory test](../packages/blue-app/src/main/ipc/main-process-ipc-inventory.test.ts)
  and [startup lifecycle test](../packages/blue-app/src/main/startup-lifecycle.test.ts).
- Render and freeze operations, REPL command serialization, and secondary editor
  coordination have separate main-owned coordinators. Inject host capabilities
  at composition, and keep project replacement and Java on-load policy with
  their owners. Keep Csound execution on the audited main-process boundary.
  Test render/freeze cancellation and artifact settlement at the operation seam,
  and test Electron window and menu behavior where it depends on native ownership.

### Renderer state and UI

- `project-store.ts` owns the optimistic snapshot and coordinates cross-domain
  projections. Use one patch queue for commit ordering, acknowledgements, and
  session fences. Keep domain reducers independent of the Zustand store and
  preload I/O. Inject clocks or ID creation at the specific call sites that
  need deterministic tests. Check [reducers](../packages/blue-app/src/renderer/tests/project-store-optimistic-reducers.test.ts)
  and [queue behavior](../packages/blue-app/src/renderer/tests/project-patch-queue.test.ts)
  at their own seams.
- Keep live workbench layout in the workbench store and persisted layout behind
  the main-owned layout envelope. Keep the layout model and migrations free of
  Dockview and DOM dependencies. Apply the [tree drag and drop contract](tree-drag-and-drop.md)
  when a runtime transition moves a panel between documents.
- Keep score hit-testing and geometry separate from React gesture ownership.
  Preserve the distinction between authored-duration lookup and the minimum
  pointer hit width covered by the
  [timeline geometry tests](../packages/blue-app/src/renderer/tests/score-time-canvas-geometry.test.ts).
  Apply the [popout conventions](popout-popup-conventions.md) to extracted menus.
  Keep track-grid virtualization and focus ownership in the Tracker editor,
  separate from pitch, scale, and formatting helpers.
