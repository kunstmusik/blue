# Phase 0 Research: Large File Refactor

## R1. Use demonstrated seams, not line-count targets

**Decision**: Treat `project-store.ts` and `main.ts` as façades/composition points and extract only modules whose interface is materially smaller than the implementation it hides. The accepted renderer seams are BSB snapshot application and patch-queue coordination. The accepted main seams are project-session identity, project lifecycle orchestration, registrar lifecycle, and five domain registrars.

**Rationale**: These seams have cohesive state, identifiable callers, and focused behavior oracles. They improve responsibility locality while leaving existing import specifiers and host ownership intact.

**Alternatives considered**:

- Split each file by line range or target size: rejected because it creates shallow forwarding modules and arbitrary cycles.
- Move every optimistic reducer immediately: deferred because score, mixer, track, and orchestra reducers share reconciliation responsibilities without a narrow interface or isolated oracle.
- Create one registrar per IPC channel: rejected because registration lifecycle would become more complex than the behavior hidden.

**Revisit condition**: Extract another renderer reducer only after its owner, dependency direction, deliberately small interface, and focused cross-domain regression suite are documented.

## R2. Preserve the BSB reducer's actual structural-sharing contract

**Decision**: Move the BSB implementation to `project-store/bsb-interface-snapshot.ts`. Keep `applyBsbInterfacePatchToSnapshot(instrument, patch): void` as the compatibility entry point and add a store-facing operation that also owns the private widget-metadata preservation policy. Re-export the existing public symbol from `project-store.ts`.

**Rationale**: The implementation is independent of Zustand, React, IPC, Electron, Node APIs, and host adapters. Its contract is not “pure deep cloning”: the surrounding store supplies an instrument copy, supported tree edits path-copy affected branches, and unaffected sibling references remain aliased. Selected patches deliberately preserve `objectNames` and `widgets` metadata references.

**Alternatives considered**:

- Replace the logic with `structuredClone`: rejected because it changes reference identity, metadata behavior, and hot-path allocation.
- Export `shouldPreserveWidgetMetadataForBsbPatch`: rejected because it is an implementation policy, not a useful consumer interface.
- Migrate all consumers to the new file: rejected; the stable façade avoids broad churn, while the existing score-object leaf reducer may use the focused module directly.

**Verification target**: Existing BSB editor, presets manager, BSB performance-store, and score-object sound-patch tests, plus direct identity and metadata cases for supported nested edits.

## R3. Give patch batching one injected coordinator

**Decision**: Introduce `createProjectPatchQueue(dependencies)` with operations to enqueue a patch with its dirty baseline, flush, reset for a session, accept a revision, and read the current revision. Inject commit, canonical snapshot fetch/apply, dirty-state update, background error notification, and logging functions.

**Rationale**: The current queue, 100 ms timer, single in-flight promise, revision acknowledgement, dirty baseline, refresh classifiers, and failure handling form one protocol. Keeping them together prevents a second scheduler or revision owner and allows deterministic tests with fake timers and fake host functions.

**Preserved protocol**:

- The timer is trailing-edge and remains 100 ms.
- Patches retain FIFO order and batches never overlap in flight.
- Explicit flush waits for the active batch and continues draining edits queued during that batch.
- The first queued patch captures the prior dirty value; a fully unchanged result restores it only when no batch changed the document.
- A `changed: false` receipt is an error only for create, replace, or clear Track-instrument operations that promise a structural change.
- Score, mixer, and Clojure structural classes that currently refresh continue to do so.
- Background failures notify the user; an explicit flush rejects.
- A failed batch is dropped after the existing best-effort canonical refresh; no retry is added.
- Failure of the post-commit refresh is logged but does not turn a successful commit into failure.
- Revision acceptance is monotonic within a session; changing sessions resets the renderer fence; receipts are accepted only for the matching session.
- Reset does not cancel an IPC request already sent.

**Alternatives considered**:

- Model the queue as middleware or a generic event bus: rejected as a broader framework with weaker invariants.
- Add retry, cancellation tokens, or generation fences: rejected as semantic changes outside this refactor.
- Let the Zustand store continue owning the timer and revision fields: rejected because that leaves the protocol split across owners.

**Mechanical note**: The current `storeGet` assignment appears unused. Removing it is a separately recorded FR-017 cleanup, not part of the move.

## R4. Make project identity a deep main-process module

**Decision**: Add `ProjectSession` as the sole writer of active `BlueData`, native project path, revision, and numeric session identity. It exposes immutable reads and semantic transitions (`replace`, `close`, `publishPath`, `recordMutation`, `resetForShutdown`) rather than public field setters.

**Rationale**: These values define one canonical identity and stale-client fence. A semantic interface makes invalid combinations harder to represent and prevents domain registrars from incrementing or assigning identity fields directly. `ProjectSession` owns identity only; existing domain code may continue mutating the one active `BlueData` object through coordinated operations.

**Alternatives considered**:

- A bag of getters and setters around the existing globals: rejected because it preserves diffuse write ownership.
- Put runtime sessions, windows, missing-audio sessions, MIDI import, and caches into `ProjectSession`: rejected because that would create a replacement god object.
- Make the renderer snapshot canonical: rejected by the constitution and existing `.blue` ownership model.

**Transition rules**:

- `replace(data, path)` increments the session identity and resets revision to zero.
- `close()` clears document/path, increments session identity, and resets revision.
- `publishPath(path)` changes only the native path for the active session.
- `recordMutation({ changed, invalidateSession? })` increments revision only on a changed mutation and optionally advances the session fence according to existing replacement semantics.
- `resetForShutdown()` is idempotent and leaves no active document.

## R5. Keep project transition orchestration outside ProjectSession

**Decision**: Add `project-lifecycle.ts` to coordinate open, new, save, save-as, revert/replacement, close, missing-audio, editor/runtime cleanup, and broadcasts around `ProjectSession` transitions.

**Rationale**: Project replacement affects many owners but does not transfer ownership of them. A coordinator can make transition order explicit while the engine, Java/JavaScript runtimes, Blue Live, editors, missing-audio flow, on-load cache, MIDI import service, and temporary files remain in their current focused modules.

**Alternatives considered**:

- Have each registrar perform project replacement cleanup: rejected because transition order and partial failure would again be distributed.
- Move every dependent service into the lifecycle module: rejected because the module should orchestrate through injected operations, not absorb implementations.

**Verification target**: Existing open/new/save/revert/project-replacement tests plus focused transition-order and stale-session tests.

## R6. Use one exact, transactional IPC registration primitive

**Decision**: Add an internal registration scope keyed by the injected `IpcMain`. A domain registrar acquires its key before any registration, records exact handlers/listeners as it installs them, rolls back partial work in reverse order, and returns an idempotent disposer that removes only its own registrations.

**Rationale**: Electron permits listeners to accumulate, while handler duplication fails at registration time. Existing registrars vary: some return broad disposers, and workbench/MIDI currently silently ignore repeated initialization. One primitive makes the clarified duplicate and partial-startup behavior uniform and testable.

**Required behavior**:

- Duplicate registration of the same registrar key fails before any handler/listener side effect.
- Partial registration failure removes everything installed by that attempt.
- Teardown is idempotent and releases the key for later registration.
- Listener cleanup uses the exact function and `removeListener`, never `removeAllListeners`.
- A stale disposer cannot remove a later successful registration.

**Alternatives considered**:

- Rely on Electron's duplicate-handler exception: rejected because listeners may already have been installed.
- Make duplicate registration a no-op: rejected by clarification and because it hides composition defects.
- Call `removeHandler`/`removeAllListeners` from ad hoc disposers: rejected because it can remove another owner's later registration.

## R7. Group direct handlers into five domain registrars

**Decision**: Preserve global source registration order while moving direct `main.ts` registrations into:

1. `project-lifecycle-ipc.ts` for project/file sessions, MIDI import, missing-audio, recent files, and BSB project-file operations.
2. `project-artifacts-ipc.ts` for import/export, SoundFont, CsoundRC, and other artifact file operations.
3. `playback-runtime-ipc.ts` for playback/CSD, Blue Live, evaluation, REPL/script runtimes, realtime controls, and render/freeze.
4. `project-document-ipc.ts` for the canonical document bridge, project editor windows/documents, audio/score-object tools, and document mutation.
5. `application-ipc.ts` for confirmation, settings/about, program/runtime settings, file manager, and window layout.

**Rationale**: Each interface hides a meaningful group of host operations without turning each channel into a module. Dependencies are injected or explicitly owned, and every external channel remains defined by the existing shared/preload contract.

**Alternatives considered**:

- One new mega `ipc.ts`: rejected because it merely renames the locality problem.
- Group by synchronous versus asynchronous handlers: rejected because async form is not a domain owner.
- Rewrite already extracted unified-library, code-repository, workbench, or MIDI services: rejected; they retain their owners and adopt only the common lifecycle behavior at their composition seam.

## R8. Separate startup rollback from normal shutdown policy

**Decision**: Introduce a completed-stage rollback stack for startup failures. Do not use that stack as the normal shutdown implementation. Keep normal shutdown in its current explicit order and make every cleanup idempotent/fail-safe.

**Rationale**: Startup rollback must undo only completed setup in reverse order and preserve the original error. Successful shutdown has a deliberately different dependency order: OSC; unified-library unregister/stop; code-repository unregister/stop; MIDI; Blue Live; engine; Java; JavaScript; editor windows; project state; temporary cleanup; `app.quit`.

**Alternatives considered**:

- Reuse one reverse-order disposer list for quit: rejected because it silently changes observable cleanup order.
- Continue after startup registration failure: rejected by clarification.
- Stop rollback on the first cleanup error: rejected because it leaks later completed stages and obscures the initiating failure.

**Platform lifetime exception**: `registerBlueAudioScheme` is a process-lifetime Electron protocol registration. It remains pre-ready and is documented as irreversible for the process rather than given a fictitious disposer.

## R9. Treat path conversions and source audits as boundary contracts

**Decision**: Store native paths unchanged in `ProjectSession`; retain `project-path.ts` for canonical host identity and `normalizeBsbSelectedPath` for Csound/embedded-text forward-slash conversion. Update source-audit tests to inspect extracted owners as well as `main.ts`.

**Rationale**: A structural move can accidentally broaden path normalization or make source-text tests pass while behavior moved elsewhere. Explicit boundaries and updated audits preserve portability and ensure the tests follow the code.

**Required audit updates**:

- `engine-runtime-ipc.test.ts` must inspect the new runtime registrar source.
- `csound-runtime-boundary.test.ts` must include every extracted source that spawns or assembles Csound commands.
- MIDI duplicate-registration tests must assert deterministic failure at the registration/composition seam rather than the current silent no-op.

**Alternatives considered**:

- Normalize all stored paths to `/`: rejected because native filesystem APIs require native paths.
- Drop source audits in favor of unit tests only: rejected because the audits protect architectural boundaries not visible from results alone.

## R10. Stage by reversible ownership changes

**Decision**: Implement in this order: freeze inventory and baseline; extract BSB; extract patch queue; introduce project session and lifecycle; introduce registration scope and startup rollback; move registrar groups in current source order; compose, update boundary maps, and run full validation. Each stage retains its façade and has a focused checkpoint.

**Rationale**: The order moves the lowest-risk pure seam first, establishes canonical state ownership before handlers depend on it, and establishes safe registration before the large IPC move. Each stage can be reverted without undoing unrelated accepted seams.

**Alternatives considered**:

- Move all code in one mechanical commit: rejected because failures cannot be localized or safely rolled back.
- Move IPC first and repair ownership afterward: rejected because registrars would capture the same globals through new files.
