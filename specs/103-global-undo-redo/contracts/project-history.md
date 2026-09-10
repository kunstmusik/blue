# Project History Contract

## Main module interface

`commit(request)`, `undo(request)`, `redo(request)`, `read(documentId)` are the external history interface. Save/load/close coordination uses existing lifecycle composition with explicit history boundary transitions. Internal preparation is shared by all canonical writers, including legacy IPC and dedicated editor adapters.

Proposed serializable request fields:

| Field | Rule |
| --- | --- |
| documentId | Must match active document lifetime |
| operationId | Unique per logical action submission; retry uses same ID |
| expectedRevision | Required; mismatch returns stale before mutation |
| contextSequence | Strictly ordered per trusted renderer context |
| label | Bounded human-readable semantic action label |
| gestureId, fieldId | Optional grouping identities scoped to sender/document |
| phase | single, begin, update, end, cancel |
| patches | Existing typed patch intents; validated nested values and targets |
| preconditions | Exact target values/identities used to detect stale intent |
| origin | Optional bounded selection/view hints; no arbitrary executable content |

Sender identity is derived from the registered webContents, not trusted from payload. Host actions use a separately registered host source and the same commit preparation. Shared contracts and preload expose no closures, model instances, runtime clients, or arbitrary property-path writes.

## Replies and publication

Reply union: `committed`, `unchanged`, `stale`, `invalid`, `busy`, `oversize`, `failed`.

Committed includes operationId, documentId, revision, stateId, isDirty, history labels/availability, changed targets and initial runtime outcomes. Unchanged preserves redo and checkpoint. Stale includes current revision and canonical reconciliation data; it is not permission to replay blindly. Failed is document failure only; runtime errors after successful commit are outcome events. Batches are all-or-nothing: invalid/no-longer-existing targets reject the action, while valid equal-value assignments are no-ops.

A `project-document-updated` event includes documentId, sessionId, revision, stateId, authoritative dirty/history projection, accepted operation IDs/source sequence, snapshot, and optional replay selection hints. Renderer rejects wrong-document and older/equal-revision snapshots; duplicate replies may acknowledge pending work without applying snapshots twice. Initial registration/load explicitly accepts the current snapshot even at revision zero.

Extend existing preload exports, shared types, renderer declarations and IPC registrar inventory together. Existing handler response envelopes may be adapted from this result during migration, but no handler may mutate before invoking preparation. Remove old bypasses after all callers migrate.

## Settlement barrier

1. Main queues the undo/redo/save/replacement request and sends `prepare-history-boundary` with barrier ID to all registered independent contexts.
2. Each context pauses new durable submissions, captures its queue watermark, finishes composition/grouping, and drains that prefix in sequence. Main captures ordinary submissions already queued behind the boundary command, and ordinary arrivals from a participant still awaiting acknowledgement, as that participant's pre-pause prefix. They settle through the same document, sequence, and revision validation as explicitly tagged prefix commits. A captured submission resolves before the boundary command without executing again when its original ordered-queue slot is reached. Once a context acknowledges, its ordinary submissions wait, as do unrelated commands.
3. On ordinary stale prefix work, exact preconditions permit a bounded retry for unchanged targets; conflicting work becomes a retained draft and causes barrier failure. No unbounded retries.
4. Each participant acknowledges after its captured prefix is committed or explicitly resolved, supplying last acknowledged revision/sequence and zero outstanding prefix work. Clean context closure is acknowledged by host; disappearance with unknown work aborts.
5. Once all acknowledge, main selects the current top history action and executes once. It publishes the canonical result before `release-history-boundary`.
6. Release resumes editing from that result. New input accumulated during the pause remains a draft; it is submitted only after target/base revalidation, never blindly replayed.

Five-second timeout releases participants with an actionable failure and performs no undo/redo. Already committed prefix edits remain committed. Undo during long-running external preparation rejects or waits explicitly; stale external results cannot publish afterward. Rapid commands queue and each execute at a fresh settled boundary; do not drop intentional repeated undo requests.

## Deduplication and grouping

Deduplicate the lifetime of the active document using per-context monotonic sequence high-watermarks plus bounded receipt cache. Evicted duplicate receipts return already-processed with a fresh canonical projection, never reapply. Conflicting reused operation IDs are invalid. Group only adjacent compatible actions from the same source/field/gesture; save, selection changes, context changes, undo/redo or another action close the group. 500 ms typing gap uses main-observed ordered submissions plus explicit renderer composition metadata; network delay cannot split a declared composition.

## Atomic application and side effects

Typed scalar operations first validate every target/value; synchronous writes have exact non-throwing restoration from captured fields. A setter with side effects, allocation or uncertain rollback cannot use the scalar path. Structural/mixed operations apply to a history-copy candidate, then publish it with preserved path/documentId and new revision. Retained mementos remain isolated. Only afterward close invalid editors, publish library notifications, invalidate runtime bindings and dispatch immutable engine plans.

Gesture previews already heard cannot be undone in time; cancel restores latest document/runtime values and removes the uninterrupted forming entry. Atomicity concerns each committed update/compound action, not erasing previously audible preview time.

## Save, retention and oversize confirmation

Save runs a settlement boundary, closes groups, captures bytes and stateId, then releases editing while disk I/O proceeds. Success updates savedStateId for those bytes and publishes current dirty state; failure preserves the old checkpoint. Save As publishes path only after successful write. Checkpoint metadata is not undone.

Oversize preparation returns size and explanation plus a one-use proposal token bound to document/revision/payload. Existing `ConfirmationDialog` defaults to Cancel and identifies history loss as destructive. Confirmation revalidates the unchanged proposal and publishes with empty retained history; Escape, dismissal, timeout or stale proposal cancels safely. Do not expose a reusable skip-history option.

## Coverage audit and FR-002 canonical-writer matrix

Every project-modifying write path must participate in canonical history preparation. Direct mutations, unacknowledged preview mutations, and silent bypasses are prohibited.

### Canonical-Writer Inventory

| Writer Origin | Bridge / API Entry Point | Commit Route | Classification |
| --- | --- | --- | --- |
| Main / Renderer Patch Queue | `window.blueAPI.commitProjectDocumentPatchBatch` | `ProjectHistory.commit(request)` | Scalar or Structural (per-patch table) |
| Score Object Freeze / Unfreeze | `handleFreezeScoreObjects` IPC | `ProjectHistory.recordDirectStructureMutation` | Structural |
| Unified Sound / Instrument Library | `UnifiedLibraryProjectAdapter.commit` | `ProjectHistory.recordDirectStructureMutation` | Structural |
| Missing Audio Relink | `relinkProjectAudioPaths` | `ProjectHistory.recordDirectStructureMutation` or Patch Batch | Structural |
| Code & Text Editors | `commitProjectDocumentPatchBatch` (orchestra / udo / properties / global) | `ProjectHistory.commit(request)` | Scalar (text properties) or Structural |
| PianoRoll Note Stack | `pianoroll-undo-store.ts` via patch batch | `ProjectHistory.commit(request)` | Structural |
| BlueX7 Parameter Stack | `use-blue-x7-history.ts` via patch batch | `ProjectHistory.commit(request)` | Structural |
| Score and Layer Color Actions | `score-color-actions.ts` and score UI via patch batch | `ProjectHistory.commit(request)` | Structural |

### FR-002 Coverage Matrix: Patch Union Members & Classification

| Patch Domain | Union Member / Operation | Preparation Class | Verifying Test Scenario(s) |
| --- | --- | --- | --- |
| **Global Text** | `globalOrc` | `scalar` | `project-history-patch-classification.test.ts`, `csound-editor-history.test.tsx` |
| **Global Text** | `globalSco` | `scalar` | `project-history-patch-classification.test.ts`, `csound-editor-history.test.tsx` |
| **Global Text** | `tablesText` | `scalar` | `project-history-patch-classification.test.ts`, `csound-editor-history.test.tsx` |
| **Global Text** | `scratchPad` (`text`, `wordWrapEnabled`) | `scalar` | `project-history-patch-classification.test.ts` |
| **Properties** | `projectProperties` | `structural` | `project-history-patch-classification.test.ts`, `project-history-writer-audit.test.ts` |
| **Clojure** | `clojureProject` | `structural` | `project-history-patch-classification.test.ts` |
| **Transport** | `renderStartTime`, `renderEndTime`, `loopRendering` | `scalar` | `project-history-patch-classification.test.ts` |
| **Transport** | `tempoMap`, `tempoMapPatch`, `meterMapPatch` | `structural` | `project-history-patch-classification.test.ts`, `project-runtime-reconciliation.test.ts` |
| **Mixer** | `setMixerEnabled`, `updateExtraRenderTime` | `scalar` | `project-history-patch-classification.test.ts`, `project-runtime-reconciliation.test.ts` |
| **Mixer** | `updateChannel` (fields `level`, `volume`, `pan`, `muted`, `solo`) | `scalar` | `project-history-patch-classification.test.ts`, `project-history.test.ts`, `project-runtime-reconciliation.test.ts` |
| **Mixer** | `updateChannel` (fields `name`, `outChannel`) | `structural` | `project-history-patch-classification.test.ts` |
| **Mixer** | `renameChannelListGroup`, `addSubChannel`, `removeSubChannel` | `structural` | `project-history-patch-classification.test.ts`, `global-project-history.test.ts` |
| **Mixer** | `addEffectFromLibrary`, `addSend`, `updateSend`, `updateEffect` | `structural` | `project-history-patch-classification.test.ts`, `effect-editor-window.test.tsx` |
| **Mixer** | `removeChainEntry`, `reorderChainEntry`, `duplicateChainEntry`, `copyChainEntry`, `pasteChainEntries`, `moveChainEntryAcrossChains` | `structural` | `project-history-patch-classification.test.ts`, `global-project-history.test.ts` |
| **Orchestra** | `addInstrument`, `removeAssignment`, `duplicateAssignment`, `pasteInstrument`, `updateAssignment`, `replaceInstrument`, `convertGenericToBsb`, `updateInstrument`, `updateInstrumentComment` (all 9) | `structural` | `project-history-patch-classification.test.ts`, `project-history-writer-audit.test.ts`, `global-project-history.test.ts` |
| **Score Objects** | `addScoreObjects`, `removeScoreObjects`, `moveScoreObjects`, `setScoreObjectBackgroundColors`, `convertScoreObjectToObjectBuilder`, `convertToPolyObject`, `setSubjectiveDurationToObjective`, `updateSharedProperties`, `updateSoundObjectBehavior`, `updateTimeState`, `updateTypeSpecificEditor` | `structural` | `project-history-patch-classification.test.ts`, `global-project-history.test.ts`, `score-object-editor-contract.test.ts` |
| **Score Layers** | `addLayer`, `removeLayer`, `moveLayer`, `renameLayer`, `updateLayerState`, `moveLayerRange`, `removeLayerRanges`, `addLayerGroup`, `removeLayerGroup`, `moveLayerGroup`, `renameLayerGroup` | `structural` | `project-history-patch-classification.test.ts`, `global-project-history.test.ts` |
| **Score Markers** | `addMarker`, `removeMarker`, `updateMarker` | `structural` | `project-history-patch-classification.test.ts` |
| **Track Items** | `addTrackItem`, `removeTrackItems`, `moveTrackItems`, `resizeTrackItems` | `structural` | `project-history-patch-classification.test.ts`, `project-editor-track-items.test.ts` |
| **Track Instruments** | `createTrackInstrument`, `clearTrackInstrument`, `replaceTrackInstrument`, `updateTrackInstrument` | `structural` | `project-history-patch-classification.test.ts`, `track-instrument-editor-window.test.tsx` |
| **Audio Sources** | `replaceAudioFileSource`, `updateAudioFilePostCode` | `structural` | `project-history-patch-classification.test.ts`, `missing-audio-assets.test.ts` |
| **Note Processors** | `replaceNoteProcessorChain`, `replaceScopedNoteProcessorChain`, `replaceTrackNoteProcessorChain`, `saveNamedNoteProcessorChain`, `deleteNamedNoteProcessorChain` | `structural` | `project-history-patch-classification.test.ts`, `scoped-note-processor-chain-patch.test.ts` |
| **Patterns** | `updatePatternBeatsLength`, `updatePatternCells` | `structural` | `project-history-patch-classification.test.ts`, `patterns-layer-group-canvas.test.ts` |
| **Score Automation** | `assignAutomationToLayer`, `removeAutomationFromLayer`, `moveAutomationToLayer`, `clearLayerAutomations`, `cleanupLayerAutomation`, `selectLayerAutomation`, `setAutomationLineColor`, `setAutomationPoints`, `insertAutomationPoint`, `deleteAutomationPoint`, `moveAutomationPoint`, `setAutomationResolution`, `moveAutomationRange`, `scaleAutomationRange` (all 14) | `structural` | `project-history-patch-classification.test.ts`, `score-automation-runtime-sync.test.ts` |
| **Blue Live** | `updateOptions`, `updateTempoRepeat`, `updateLiveCodeText`, `setCellEnabled`, `setCell`, `insertRow`, `removeRow`, `insertColumn`, `removeColumn`, `captureEnabledSet`, `renameSet`, `removeSet`, `moveSet`, `applySet` (all 14) | `structural` | `project-history-patch-classification.test.ts`, `blue-live-contract.test.ts` |
| **MIDI Input** | `updateKeyMapping`, `updateVelocityMapping`, `updatePitchConstant`, `updateAmpConstant`, `updateScale` (all 5) | `structural` | `project-history-patch-classification.test.ts` |
| **Project UDO** | `add`, `remove`, `update`, `reorder`, `convertStyle` (all 5) | `structural` | `project-history-patch-classification.test.ts`, `tables-udo-contract.test.ts` |
| **Freeze Audio** | `handleFreezeScoreObjects` (freeze / unfreeze) | `structural` (direct) | `freeze-score-objects.test.ts`, `project-history-writer-audit.test.ts` |
| **Library Import** | `UnifiedLibraryProjectAdapter.commit` (insert / replace) | `structural` (direct) | `unified-library/project-adapter.test.ts`, `project-history-writer-audit.test.ts` |
| **Missing Audio** | `relinkProjectAudioPaths` | `structural` (direct / patch) | `missing-audio-assets.test.ts` |
