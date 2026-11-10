# Contract: Hosted Gestures and Project History

**Requirements**: FR-004–FR-012, FR-024; SC-002, SC-003, SC-006.

## Host listener boundary

Proposed internal module: `packages/blue-app/src/renderer/lib/host-gesture.ts`.

Inputs are the press-time host document/window, mouse or pointer stream kind, optional pointer identity, and caller-owned movement/release/Escape/blur/pointer-cancel callbacks. Output is an idempotent disposer. The helper has no store, history, geometry, settings, or process imports.

- Attach only while an actual gesture is active; dispose with matching capture options.
- Capture-phase Escape acts only when the active caller owns it, before workspace stop. Consume an owned cancellation and leave unrelated keys/surface ownership intact.
- Exactly one terminal callback wins. Remove active listeners and revoke input synchronously before awaiting a commit/cancel receipt.
- Caller cleanup stops animation frames/autoscroll and restores captured host-body cursor/selection styles. Canvas hover remains separate from active movement.
- Caller captures document/session/target identity; late callbacks cannot retarget through updated React props.

Marker and tempo-point identities are transient app-side snapshot identifiers, not project XML fields. The existing project-editor identity map transfers them to history candidates and mementos; a marker or point update retains its identifier, while removal followed by creation gets a new one. Creation patches carry the identifier needed to keep optimistic and canonical snapshots aligned. Reject malformed or duplicate supplied identifiers. Undo/Redo restores the corresponding identities, and net-zero comparison includes them. Loading a new project lifetime establishes new identifiers.

## Preview and callback contracts

| Owner                                        | Publication contract                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Score/audio timing and placement             | Transient projection in existing selection/session state; no shared renderer score/dirty mutation during preview; final canonical patch group |
| Pattern paint, PianoRoll, field lane         | Existing local draft; one final changed project commit; cancellation sends none                                                               |
| Shared line canvas                           | Local draft lines including insertion; existing onLinesChange(nextLines) fires once on release/settlement                                     |
| JMask table                                  | Local draft table including insertion; existing onChange(nextTable) fires once on release/settlement                                          |
| Automation range transforms                  | Local previews; final labeled single/grouped commit; range creation remains selection-only                                                    |
| Marker/ruler/tempo and automation point move | Live history group with baseline before first press-time mutation                                                                             |
| BSB move/resize                              | Live group; blur and editor closure settle; Escape restores the whole baseline and cancels                                                    |
| Split pane                                   | Local drag preview; one persisted release; keyboard persistence unchanged                                                                     |
| Arrangement columns                          | Local widths only; cancellation restores previous entry, no invented persistence                                                              |

Line owner labels go through `LineObjectEditor.patchLines`, `ZakLineObjectEditor.patchLines`, `BSBLineObjectWidget.commitLines`, and the Sound automation owner. Keep line canvas callback shape. Only the private Sound automation callback requires an optional metadata parameter reaching `SoundEditor.handleAutomationPatch`. JMask labels final commits at `JMaskEditor.handleFieldChange`, without live-phase metadata through each generator adapter. PianoRoll labels through the existing `commitUndoablePatch` wrapper and canonical patch route.

Tempo drag metadata passes through `TempoLineView → ColumnHeader → ScorePanel.handleTempoPatch`. Existing standalone tempo insertion remains a single non-drag action. Automation metadata passes through `AutomationLayerOverlay.onPatch` and both `ScoreTimeCanvas`/`TrackLayerGroupCanvas` adapters. Marker start carries host identity from `MarkerWidget`'s originating event.

## Canonical history protocol

Reuse `ProjectDocumentCommitMetadata`, `ProjectHistoryCommitRequest`, and the existing `commitProjectHistory` preload endpoint; no new channel or phase is needed.

1. Settle older active editors before acquiring a new live group. Capture document/session, label, gesture ID, baseline and target references before any insertion/update.
2. A local preview committing for the first time uses phase single for one changed patch, or one identity with begin, zero or more updates, final end for multiple patches. An already-open live group instead sends zero or more final updates and exactly one end (possibly metadata-only), never a new begin or single. Never mark every selected object end.
3. A settlement callback clears active input/scheduled work, dispatches its final values once, and returns `flushPendingPatches()` so the existing history router waits for actual canonical completion. Propagate barrier metadata through the existing settlement-prefix mechanism.
4. For metadata-only end/cancel, add finishProjectGesture to the existing renderer/lib/history-scope-router.ts as a narrow adapter. It drains earlier queued patches, revalidates the captured document/session and gesture's current authority, then uses the existing commit endpoint with an empty patches array, current revision, unique operation ID, monotonic context sequence and origin. Feed its receipt/projection through existing history publication/revision handling. A dropped empty document patch is not a substitute.
5. In main, unchanged or metadata-only end closes only its matching current group without mutation or a new action. Do not allow a late terminal to close another group. Reuse existing validation, deduplication and revision fences.
6. At finalization, compare the whole group's original/final content and stable identities/reference topology. Moving away, flushing, moving back to baseline, and releasing is a net-zero action: remove it and restore its original dirty/redo checkpoint. This differs from an unchanged final mouseup value ending a genuinely changed action. Reuse canonical memento/identity support; XML equality alone does not prove stable identities.
7. Matching active-tail cancel restores scalar/structural/mixed baseline, dirty state, prior redo history and applicable runtime. If another action has settled/replaced the group, revoke its old cancel authority rather than restoring an obsolete memento.

For live score automation, extend main/project-history.ts structural inverse generation with the original group's setAutomationPoints and affected setAutomationResolution values per parameter. Retain the earliest baseline across grouped insert/move updates; cancel/Undo must send the actual baseline to active performances, and Redo the final forward state. The existing orchestra.structuralChange fallback is restart-required and cannot satisfy this contract. Cover both timeline and Blue Live runtime payloads where that parameter is active.

BSB baseline patches also restore optimistic renderer state. Enqueue baseline updates for preceding widgets and exactly one final baseline patch with phase cancel; await flush. Before initial flush, begin+cancel can merge with no canonical action. After a flush, main cancellation rolls back all grouped records. Never issue multiple terminal cancels or an update/end after cancel. Test both timelines with multiple selected widgets.

## Cancellation retention and failure

Maintain one shared-reference cancellation checkpoint per active group, including the original redo suffix and any otherwise-evicted baseline entries. Keep the public chronological ledger within its existing action count, and bound the active rollback checkpoint separately to that one group. Checkpoint-only baseline references are not extra published chronological actions, so a tiny drag at 200 actions still works. As amended by [compact project history](../../../docs/project-history-audit.md), completed history keeps its byte budget, while one active group may additionally retain up to one budget of baseline entry references for cancellation. Count all unique entries once and check the full merged action against the per-action budget. Roll back from the entry itself; do not retain another complete project baseline or a checkpoint per mousemove.

If admission cannot retain rollback safely, reject before the new canonical mutation, cancel an already-open group back to baseline if necessary, and surface existing oversize/failure handling. Reaching the completed-history byte limit alone must not reject a small live edit. Reject an individually oversized merged action or exhaustion of the bounded active-history allowance; preserve the existing checkpoint if a competing admission fails. Existing history-reset agreement remains a separate user action, never implicit authorization to resurrect an old drag. Normal end or an intervening settled edit releases the checkpoint and applies ordinary retention.

Rejected, stale, cancelled, or unchanged requests do not create phantom entries. Canonical failure is reconciled from fenced publication, not a stale full-score restore. Do not silently treat a void UI dispatch as success.

## Terminal policy and oracles

Use the scope table in [spec.md](../spec.md): Escape cancels every listed gesture; blur cancels except BSB move/resize, which settles. Editor closure discards local drafts and settles valid live edits. Target removal/project replacement invalidates obsolete work. History commands requiring settlement finish the latest valid project edit before they run.

Required oracles: initially clean/dirty cancellation; inserted marker/automation/line/table cancellation; multi-target one-action Undo/Redo; cross-group projection without dirtying; no-op end followed by a different action; cancel with an existing redo branch; retention-bound rejection plus successful small gestures at the 200-action limit; net-zero live release; concrete automation inverse/Redo runtime payloads; target replacement; pending-frame cancellation; both autoscroll modes; active Undo waits for the receipt; actual floated-window release/Escape/blur.

BSB move/resize authority also captures the instrument root and each affected widget's transient `gestureTargetId`, plus assignment/document/session identity. Canonical snapshots generate incarnation IDs from app-side object identities; history copies transfer them, and XML never stores them. A replacement may reuse serialized widget IDs but receives new incarnation IDs. The editor validates its latest owner/tree, while wrappers validate before input, scheduled frames, settlement, cancellation and unmount. Invalidated work detaches listeners and cancels frames without replaying captured positions or sizes.

A newly admitted live group that supersedes another group owns a fresh checkpoint from the exact pre-admission ledger and document. Its admission budget includes its own baseline and retained entries, excluding the former group's retired checkpoint. A failed admission leaves the former group intact; obsolete terminals cannot cancel the new owner.
