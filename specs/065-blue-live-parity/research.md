# Research: Java Blue Live Trigger Parity

## Evidence Reviewed

- Java Blue:
  - `blue-ui-core/src/main/java/blue/ui/core/blueLive/BlueLiveTopComponent.java`
  - `blue-ui-core/src/main/java/blue/ui/core/render/BlueLiveBinding.java`
  - `blue-ui-core/src/main/java/blue/ui/core/render/RealtimeRenderManager.java`
  - `blue-core/src/main/java/blue/LiveData.java`
  - `blue-core/src/main/java/blue/blueLive/LiveObject*.java`
- Electron/TypeScript:
  - `packages/blue-app/src/main/blue-live-engine.ts`
  - `packages/blue-app/src/main/main.ts`
  - `packages/blue-app/src/shared/project-editor.ts`
  - `packages/blue-app/src/preload/preload.ts`
  - `packages/blue-app/src/renderer/stores/project-store.ts`
  - `packages/blue-app/src/renderer/components/menu-bar/ToolbarBlueLive.tsx`
  - `packages/blue-app/src/renderer/components/workbench/panels/blue-live/LiveSpaceTab.tsx`
  - `packages/blue-data/src/blue-data.ts`
  - `packages/blue-data/src/live-data.ts`
  - `packages/blue-data/src/live/`
  - `packages/blue-data/src/sound-objects/`
- Existing feature work:
  - `specs/027-blue-live-part1/`
  - `specs/049-blue-java-runtime/`
  - `specs/050-jython-support/`
  - `specs/058-midi-live-input/`
  - `BLUE_LIVE_FEATURE_PLAN.md`

## Decision 1: Treat This as a Narrow Compatibility Adapter

**Decision**: Restore selected-cell and enabled-batch Manual Trigger plus the lifecycle, copy, runtime, and revision safety needed to trust it. Do not implement audible global Repeat, per-cell key/MIDI triggering, or any track/scene launcher feature.

**Rationale**: Manual Trigger is the smallest audible reference needed to compare legacy projects before migration. Repeat requires a clock/scheduler decision and would invite bug-for-bug reproduction of stale queued work. The future launcher needs a different persistent model and engine-owned quantized scheduler.

**Alternatives considered**:

- Implement the entire Java Blue Live surface first: rejected because much of it would be replaced and dormant key/MIDI fields never formed a reliable Java runtime feature.
- Begin the new launcher immediately: rejected because current deep-copy, patch-flush, project-replacement, and asynchronous-generation hazards would contaminate it and there would be no audible legacy oracle.
- Include Java global Repeat in this feature: rejected because it adds clock and backlog semantics that are not required for the manual-trigger baseline.

## Decision 2: Preserve Java Manual Trigger Semantics, Not Java Defects

**Decision**: Selected trigger targets one populated cell regardless of `enabled`. Enabled-batch Trigger flattens the column-major grid and targets every enabled cell without row/column exclusivity. Both generate with start `0`, no end bound, and scale note p2/p3 by `60 / LiveData.tempo`.

**Rationale**: These are the observable Java behaviors users depend on and the current Electron UI already preserves the relevant grid, enabled, and saved-set state.

**Intentional divergences**:

- Generate from copies instead of temporarily setting the authored SoundObject `TimeBehavior` to `NONE`.
- Fail an enabled batch atomically if any member fails instead of risking partial submission.
- Fence and discard obsolete asynchronous results.
- Retain unresolved saved-set identifiers in XML instead of reproducing Java’s lossy load behavior; resolution still ignores IDs that have no current LiveObject.
- Return explicit invalid/empty/busy/runtime diagnostics.

**Alternatives considered**:

- Preserve Java’s authored-object mutation: rejected as a data-corruption defect.
- Submit the successfully generated prefix of a failed enabled batch: rejected because the Trigger action promises one combined set and partial sound is difficult to diagnose.

## Decision 3: Add a Pure `@blue/data` Preparation Service

**Decision**: Add `packages/blue-data/src/live/blue-live-trigger.ts` with a target-selection and preparation API that operates only on an isolated `BlueData` graph, abstract runtime/session contracts, and portable note models. It returns a prepared score batch or a structured preparation failure and performs no engine submission.

**Rationale**: Selection, SoundObject generation, note scaling, and immutable-input guarantees are Blue domain behavior. Keeping them in `@blue/data` makes them independently testable and reusable by a later migration oracle without importing Electron or engine code.

**Alternatives considered**:

- Put generation directly in `LiveSpaceTab.tsx`: rejected because the renderer must not own canonical project or host runtime state.
- Put all generation in `blue-live-engine.ts`: rejected because it would mix domain generation with process/transport lifecycle and make Java-parity tests depend on Electron.
- Extend the engine protocol to generate SoundObjects: rejected because the engine receives Csound material, not Blue project models, and no new scheduling primitive is required for immediate Manual Trigger.

## Decision 4: Repair Aggregate Deep Copy and Library References First

**Decision**: Make `BlueData.deepCopy()` isolate Live Data, the SoundObject library, instrument library, and opcode list in addition to already-copied project state. Preserve stable IDs for a whole-project copy and remap copied `Instance` objects to the copied SoundObject-library entries.

**Rationale**: `BlueData.deepCopy()` currently aliases the exact domains trigger preparation needs to treat as immutable. Copying an `Instance` currently preserves its reference to the original library object, so merely calling individual `deepCopy()` methods is not enough. Whole-project copies must retain identity values while replacing object references coherently.

**Design detail**:

- Seed an original-to-copy map while copying SoundObject-library entries.
- Traverse copied library, Live Data, and score SoundObject graphs and replace any copied `Instance` reference that still points at an original library object.
- Deep-copy instrument categories/instruments and opcode definitions rather than retaining aliases.
- Keep `LiveObject.uniqueId` unchanged for whole-project snapshots; duplicate-cell identity rules remain out of scope.

**Alternatives considered**:

- Serialize and asynchronously reload the whole project for every trigger: rejected because it adds avoidable XML work, may be too slow for Manual Trigger, and does not repair the public `deepCopy()` contract.
- Copy only the selected SoundObject: rejected because library-backed `Instance` references, project time context, note processors, runtime metadata, and enabled-batch consistency need a coherent snapshot.

## Decision 5: Reuse Existing Async Runtime Contracts

**Decision**: Main obtains the existing Java runtime client when the copied project reports `usesJavaRuntime()`, reuses the current JavaScript session, attaches them to `CompileData`, and the data service calls `generateForCSDAsync` whenever the target provides it.

**Rationale**: ClojureObject, PythonObject, Python ObjectBuilder, JavaScriptObject, nested Instance/PolyObject paths, and Python note processors already have abstract async generation support. `score-object-test.ts` demonstrates the correct runtime-injection pattern. Reusing it avoids a second runtime stack.

**Failure behavior**:

- Runtime unavailable: return `runtime-unavailable` with an object-specific message.
- Generation exception: return `generation-failed`; submit nothing.
- Runtime completes after document/session invalidation: return `stale-document` or `stale-session`; submit nothing.

**Alternatives considered**:

- Fall back to synchronous generation when a runtime is missing: rejected because several supported object types cannot produce correct material synchronously.
- Start host runtimes from `@blue/data`: prohibited by the constitution.

## Decision 6: Use a Main-Owned Single-Flight Trigger Controller

**Decision**: Add an injected `BlueLiveTriggerController` in Electron main. It resolves canonical data and revision, captures Blue Live session generation, makes the isolated project copy, acquires runtime clients, awaits pure preparation, rechecks both fences, and submits through `BlueLiveEngineSession`. It accepts at most one preparation job per active session; another request returns `busy` instead of building an unbounded queue.

**Rationale**: Main is the only layer that can safely coordinate canonical project state, external runtime lifecycle, engine lifecycle, and project replacement. A small controller makes the asynchronous fence testable without turning `main.ts` into an implicit state machine.

**Alternatives considered**:

- Queue every manual trigger: rejected because expensive generators could create unbounded backlog and stale sound.
- Cancel arbitrary runtime calls forcibly: not all existing runtime contracts expose cancellation. The controller cancels logically by generation/revision fence and ignores stale completion.
- Add a prepared-content cache now: rejected as future launcher work; the manual baseline should remain simple and observable.

## Decision 7: Keep Document Revision and Session Generation Independent

**Decision**: `currentProjectRevision` advances only when canonical project data changes. Blue Live `sessionId` is the runtime generation and advances with new performance generations; it is never used as a document revision. Each trigger job captures both values.

**Rationale**: Current start/recompile code increments `currentProjectRevision` even though it does not edit the project. That prevents the revision from being a reliable cache/fence key. The existing Blue Live session already exposes a session ID that can become the runtime generation with small changes.

**Fence rules**:

- A different canonical project session, document revision, Blue Live session ID, or non-running session invalidates pending preparation.
- Stop/recompile/project replacement closes the submission gate immediately, even if physical process cleanup continues.
- A document edit made during preparation invalidates the result; the user may retrigger from the new state.

**Alternatives considered**:

- One counter for both document and runtime: rejected because a recompile is not a project edit and an edit does not necessarily create a new engine session.
- Trust renderer revision values: rejected because renderer snapshots and buffered patches are not canonical.

## Decision 8: Make Patch Flush an Acknowledgement Barrier

**Decision**: Start, recompile, selected trigger, and enabled-batch trigger await `project-store.flushPendingPatches()` before invoking the live command. A failed commit rejects the barrier after canonical recovery so the live command does not proceed with stale state.

**Rationale**: Blue Live controls currently bypass the 100 ms project-patch buffer. `flushPendingPatches()` exists and is already used by playback and other editor actions, but the current flush swallows commit errors. Live commands need proof that accepted edits reached main.

**Alternatives considered**:

- Add a second “flush” IPC endpoint: rejected because the existing commit receipt already provides the acknowledgement boundary.
- Read renderer state directly in main: impossible and contrary to canonical ownership.

## Decision 9: Report Whether a Patch Batch Actually Changed the Document

**Decision**: Extend `ProjectDocumentCommitReceipt` with `changed`. The main batch handler aggregates actual changes, synchronizes engines only for changed patches, advances revision/broadcasts/publishes only when at least one patch changed data, and returns the unchanged revision for an all-no-op batch. Blue Live patch application must compare old/new values and structural operation results.

**Rationale**: Current batch commit increments revision once even when every patch is rejected or semantically unchanged, and several Blue Live mutation helpers report success for invalid operations. Meaningful revisions are required for stale-work fencing.

**Renderer recovery**: If a batch is acknowledged with `changed: false`, refresh the canonical snapshot when the optimistic state may differ. Do not turn a clean project dirty solely because of an acknowledged no-op.

**Alternatives considered**:

- Hash the entire project before/after every batch: rejected as unnecessary when patch functions can accurately report mutation.
- Keep false revisions and add a separate content hash: rejected because it leaves dirty-state and other revision consumers incorrect.

## Decision 10: Reuse Immediate Engine Score Submission

**Decision**: Submit the prepared batch through the current Blue Live engine client’s `readScore` path, including existing named-instrument normalization. Add an expected-session-generation check at submission; do not change `@blue/engine-client`.

**Rationale**: Java Manual Trigger was immediate and non-quantized. The existing engine path already supports immediate score text, and the current Blue Live session is isolated from realtime playback. A new engine command is only necessary for the later quantized scheduler.

**Alternatives considered**:

- Add sample/beat scheduling now: rejected as launcher Phase 2 work.
- Evaluate score through the general editor command route: rejected because the trigger result needs its own typed target, fence, and diagnostic contract.

## Decision 11: Stop Every Non-Idle Session Before Project Replacement

**Decision**: Add/use an `isActive()` lifecycle predicate that includes `starting`, `running`, and `stopping`, and await cancellation before installing or clearing canonical project data on close, new, open, revert, or replacement paths.

**Rationale**: Current paths commonly test only `isRunning()`. A session that is still starting can retain the old `BlueData` reference and complete after project replacement.

**Alternatives considered**:

- Let project replacement proceed and rely only on the trigger fence: rejected because the engine compile/start itself may still complete against old data.

## Decision 12: Keep Runtime Feedback Separate From Persistent Enabled State

**Decision**: The orange enabled state remains an authoring flag. Trigger preparation/submission feedback is transient UI state (busy, submitted, empty, or error) and does not rewrite cells or saved sets. The Repeat control remains editable for XML compatibility but displays that audible Repeat is deferred.

**Rationale**: Treating `enabled` as playing would make saved-set and migration semantics incorrect. Manual triggers have no clip instance or durable playing state to display.

**Alternatives considered**:

- Turn enabled cells into “playing” cells: rejected because one cell can generate finite or indefinite score events with no scoped stop identity.
- Hide Repeat fields: rejected because users must be able to preserve and inspect legacy project data.

## Resolved Unknowns

- No engine protocol change is required.
- No new persistence or XML migration is required.
- No live-generation cache or scheduler is introduced.
- Main owns asynchronous job fencing and host runtime access.
- Stable `LiveObject.uniqueId`, not row/column coordinates, identifies a selected trigger target.
- Enabled batches are captured from one isolated canonical snapshot and submitted atomically.
- Audible Repeat, key/MIDI trigger execution, and modern launcher semantics are out of scope.

## Decision 13: Match Java's Cell-Relative `BufferMenu`

**Decision**: Remove the fixed bottom row/column controls. Right-clicking a cell captures that exact row and column and opens the following menu: Add SoundObject; Remove; Cut/Copy/Paste; Insert Row Before/After/Remove Row; Insert Column Before/After/Remove Column, with separators between those groups.

**Java evidence**: `BlueLiveTopComponent.BufferMenu` constructs the items in that order. Its mouse listener records `mouseRow` and `mouseColumn` from the popup event. Structural actions use `mouseRow`, `mouseRow + 1`, `mouseColumn`, and `mouseColumn + 1`; final-row/final-column removal is disabled.

**Rationale**: This restores the established interaction and makes every structural command relative to user context. The current TypeScript buttons expose only outer-edge insertion and outer-edge removal.

## Decision 14: Reuse the Score Timeline's ScoreObject Clipboard

**Decision**: Blue Live Cut/Copy writes one serialized SoundObject entry to the existing renderer Score selection clipboard, and Blue Live Paste reads that same clipboard. Paste requires exactly one Java-live-compatible SoundObject, parses a new object graph, resets start to beat zero, and assigns a fresh LiveObject identity.

**Java evidence**: Both `BlueLiveTopComponent.BufferMenu` and `ScoreController` write `ScoreObjectCopy` to `BlueClipboardUtils.getClipboard()`. Blue Live paste accepts exactly one `SoundObject` whose class is present in `liveSoundObjectTemplates`.

**Rationale**: The Score timeline already maintains serialized XML for independent paste. Reusing that store gives bidirectional Score/Blue Live interoperability without system-clipboard permissions or a second renderer buffer.

**Supported live families**: External, GenericScore, JMask, ObjectBuilder, PatternObject, PianoRoll, PythonObject, JavaScriptObject, and TrackerObject, matching Java `@SoundObjectPlugin(live=true)` declarations and current TypeScript factories.

## Decision 15: Reuse the Instrument Clipboard for Paste BSB As Sound

**Decision**: Preserve the existing application-wide unified-library Instrument clipboard used by Orchestra Copy/Cut, add copied object-type metadata, and permit an exact Score transfer only when the payload is a `BlueSynthBuilder`. The target conversion deep-copies the BSB, disables automation, reads each parameter's resulting fixed current value, replaces its line with constant endpoints, and embeds it in a new `Sound`.

**Java evidence**: `ArrangementEditPanel` stores copied instruments under `CopyBuffer.INSTRUMENT`; `PasteBSBAsSoundAction` reads the same buffer, accepts only `BlueSynthBuilder`, clears automation to constant values, creates `Sound`, and inserts it at the snapped Score position.

**Rationale**: The TypeScript unified-library clipboard already supplies cross-panel, main-owned deep-copy payloads and stale-source validation. One typed conversion target is smaller and safer than creating another Instrument buffer or reconstructing a BSB from a renderer snapshot.

## Decision 16: Keep the BSB Widget Clipboard Separate

**Decision**: `useBsbClipboardStore` remains exclusively for BSB canvas widget payloads. It does not overwrite the ScoreObject or Instrument clipboard.

**Rationale**: Java's BSB-as-Sound bridge copies a whole `BlueSynthBuilder` instrument, not selected BSB widgets. Merging widget and score/instrument payloads would make Paste enablement ambiguous and weaken type safety.

## Decision 17: Publish Live SoundObjects Through the Shared ScoreObject Selection

**Decision**: A populated Live Space cell selection writes exactly one stable `blueLive` editor target into the renderer ScoreObject selection store and activates the ScoreObject Editor. Both the type-specific editor and ScoreObject Properties reuse the existing editor-document and Score patch boundary. An empty cell clears the shared selection. The Properties panel is populated when visible but is not force-opened.

**Java evidence**: `BlueLiveTopComponent` is a `SoundObjectProvider`; its table selection listener places `LiveObject.getSoundObject()` into the component lookup or clears the lookup for an empty cell. `ScoreObjectEditorTopComponent` and `SoundObjectPropertiesTopComponent` both listen to the global `ScoreObject` lookup while a `SoundObjectProvider` is active. The editor selects the associated type-specific plugin, while Properties exposes the shared ScoreObject and SoundObject fields. Neither listener changes LiveObject identity or grid structure.

**Identity rule**: The TypeScript target carries the LiveObject unique ID and coordinate hints. Canonical resolution checks the hinted cell first, then locates the same LiveObject by unique ID so row/column insertion cannot redirect edits. Removal or replacement invalidates the target.

**Rationale**: Reusing the existing editor/property document and mutation path avoids a parallel Live-only editor stack while preserving main-process project ownership and Java's shared-selection semantics.
