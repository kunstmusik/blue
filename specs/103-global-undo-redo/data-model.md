# Data Model: Global Project Undo and Redo

These are logical TypeScript models, not persisted schemas. Shared messages contain serializable values only; canonical graph mementos never cross preload.

## Project document state

- `documentId`: opaque identity created at successful new/open/revert/replacement; unaffected by runtime invalidation.
- `sessionId`: existing runtime/editor fence, retained for compatibility.
- `revision`: monotonically increasing on every changed publication, including undo and redo; never decremented.
- `stateId`: unique logical history position. Undo returns to an earlier stateId while revision increases.
- `savedStateId`: token for the exact last successfully saved/loaded state; null if no saved checkpoint.
- `data`, `filePath`: existing main-owned canonical graph and native path.

Dirty is `stateId !== savedStateId`. A saved token may remain known even after its memento is evicted; no fabricated checkpoint. New blank document clean-state policy preserves existing load behavior. Save As changes the native path only after successful write; path publication is not an undoable project-content edit.

## History entry

- `entryId`, `documentId`, `beforeStateId`, `afterStateId`.
- `label`, `sourceContextId`, optional `originViewId`, optional `gestureId`/stable `fieldId`.
- `record`: `values` or `structure`.
- `selectionBefore`, `selectionAfter`: bounded stable-ID selections or text ranges for the origin; no complete workspace snapshot.
- `retainedBytes`: conservative unique retained payload accounting, including identity metadata.

`values` holds ordered typed target/field/before/after records. Target IDs are stable; resolution and expected values validate before apply. Secondary effects or identity changes disqualify this representation. `structure` holds isolated canonical before/after graphs with snapshot-identity mappings; complete graph aliases are preserved internally and detached from mutable live state. Replay clones the retained graph before making it canonical. Runtime caches are excluded/rebound.

A history entry is immutable after grouping closes. A forming group retains the original preimage and latest committed postimage. Every changed incremental publication gets a new stateId; no intermediate state remains a saved checkpoint because save first closes grouping. Other-context edits close the group. Cancelling restores the preimage only when it remains the uninterrupted top group; otherwise treat already committed segments as completed actions, preserving their separate order and reporting the interruption.

## History state

`entries`, `cursor` (number of applied retained entries, 0..length), `activeGroup`, `savedStateId`, `retainedBytes`, `limitReached`, `busy`, and command label/availability projections. New changed commit truncates redo; unchanged/rejected requests do not. Evict oldest whole entries until limits hold. If a single prepared entry exceeds the byte budget, return an oversize proposal without publication. Confirmation creates the new state with empty history and unchanged saved checkpoint; cancellation changes nothing.

## Prepared transaction (main only)

`operationId`, `documentId`, `expectedRevision`, resolved targets, candidate/validated assignments, before-state capture, final changed set, affected runtime owners, editor invalidations, and optional one-use oversize approval token. No external effects run during preparation. A failed prepare/apply leaves graph, revision, cursor and checkpoint unchanged. Publication and history update form one synchronous success boundary; after-publication delivery failures are retried/reconciled, never misreported as document rejection.

## Renderer participant and draft

- Participant: trusted context identity bound to sender, documentId, accepted revision, local sequence, pending prefix, barrier state.
- Draft: stable field/object identity, base revision and value, local content, selection/composition, conflict status.
- Barrier: ID, reason, participant set, captured watermarks, drain acknowledgements, expiry and state (`pausing → draining → ready → released` or `aborted`).

Popup DOM windows in the same renderer share one participant. Conflicting drafts are preserved and do not auto-resubmit. New contexts may join only after accepting the current snapshot and any active barrier.

## Runtime projection

- Performance: kind (`timeline`/`blueLive`), documentId, generation, client, compiled baseline, binding registry.
- Binding: stable owner/parameter ID → compiled channel or automation target and capabilities, valid only for that generation.
- Work: unique ID, committed revision, immutable desired values/automation payload, touched bindings, gesture generation where applicable.
- Outcome: pending/applied/restart-required/failed plus performance identity, revision, explanation and available recovery.

Partial success is represented per performance. UI aggregate cannot hide failure behind another success. New generation clears obsolete pending work and builds new bindings from the current project; restart-required is cleared only after successful compilation/start against the desired state. Stopped performance has no pending live work.

## Validation invariants

1. No history record holds mutable aliases into the live graph; copy retains model IDs, sidecar IDs and internal reference topology.
2. Revision always rises on changed publication; stateId can revisit a prior state only through valid replay.
3. Operation IDs identify one exact payload; reuse with a different payload is invalid.
4. Saved checkpoint follows successfully written bytes, not save completion time's current revision.
5. No stale document, context epoch, barrier, or performance generation can mutate a new owner.
6. Replay itself creates no new entry; failures never advance the cursor.
7. Window closure invalidates view hints, not document history.
8. Retention counts active grouping and redo records as well as undo records; byte estimator accounting is deterministic and tested separately from total heap measurement.
