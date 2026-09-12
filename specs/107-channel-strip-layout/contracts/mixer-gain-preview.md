# Mixer Gain Preview and Commit Contract

## Existing boundaries retained

Canonical gain edits continue through `applyProjectDocumentPatch` and the existing project patch queue into main-owned ProjectHistory:

```text
{ mixer: { type: 'updateChannel', channelId, patch: { level: gainDb } } }
```

Metadata uses `label: 'Set Channel Level'`, the unique gestureId, fieldId identifying the channel level, final phase `end`, and a revision fence. Gain values are dB; neither normalized position nor amplitude multipliers appear in this patch. No automation points or curve metadata are rewritten by the fader.

The existing `send-mixer-realtime-level-update` IPC remains the transient preview channel. Extend its shared type, preload declaration, and renderer declaration together; the only current production caller is ChannelStrip. Keep the handler a thin delegate to a mixer-specific adapter. No new native-engine operation is introduced.

## Typed lifecycle payload

All variants contain:

- `documentId`: Exact current project document lifetime, not a display name.
- `channelId`: Existing stable mixer channel snapshot identity.
- `gestureId`: Unique per interaction, never reused.
- `gestureSequence`: Monotonically increasing integer allocated by a renderer-context counter for mixer gestures; never reset within that renderer's lifetime.
- `baseRevision`: Canonical revision captured at gesture start.
- `phase`: `preview`, `finish`, or `cancel`.

Only `preview` carries `level` (finite dB in [-96,12]). `finish` and `cancel` carry no restoration/final gain; authoritative restoration always reads the current project. The sender identity comes from the IPC event, never a renderer-supplied owner ID.

Return a typed result containing `status: 'applied' | 'rejected'`, with a reason on rejection and current document revision when available. An acknowledgement means lifecycle processing completed; actual runtime pending/failure/restart-required outcomes continue through the existing runtime-outcome channel. No running engine is a successful no-audio-work case, not a failed project edit.

## Validation and ownership

- Validate shape, phase-specific fields, nonempty IDs, nonnegative integer revision, finite/range-bounded level, current document, and channel existence before queueing work.
- The first preview claims the gesture for its actual sender, document, channel, revision, sequence, and currently active performance generations. There is at most one active owner per channel. Reject a competing owner until the first settles; do not silently steal control.
- A preview/finish requires its base revision to remain current. A cancel may settle after a newer canonical revision, but only in the same document and for its owner; restore the latest canonical state.
- A terminal gesture cannot reopen. Maintain a highest-seen gestureSequence per actual sender; an unseen gesture must have a higher sequence to begin. Messages for an existing active record must match both sequence and gestureId. Retain terminal ownership until canonical reconciliation completes, then remove it; the sender sequence high-water mark rejects late previews without retaining every old gesture. Repeated finish/cancel for an already released older sequence acknowledge a no-op and cannot restore any value. Clear per-sender state on sender destruction; documentId fencing rejects old-project messages. This bounds bookkeeping by live senders/channels, not drag count.
- Existing runtime generation fences prevent a queued preview from crossing playback replacement. A gesture does not automatically preview into a newly started generation; cancel/restart the UI interaction after playback replacement.
- Recheck document/ownership after awaited queue drains. Never send a restoration value into a different project or a replaced performance.

## Preview path

Resolve the channel's existing level binding and call `ProjectRuntimeReconciliation.previewChannelValue` with ownerKey, parameterId `level`, dB value, and gestureId. No BlueData write or project patch occurs. Use the existing queue rather than direct engine calls. Propagate rejected acknowledgements to the slider so it cancels its draft instead of silently continuing.

Previews may coalesce in the renderer to the newest pending movement, but final settlement must drain all issued work and preserve last-value ordering. This does not require a new timer or frame scheduler if existing event frequency is adequate.

## Finish and commit ordering

1. Stop accepting pointer updates; preserve the intended final dB locally.
2. Await `finish`, which closes the gesture to later previews and drains queued preview work. It does not mutate canonical data or create history.
3. If still current, submit exactly one canonical gain patch through the existing document bridge with the captured revision fence. A failed/stale finish must not submit the patch.
4. Await `flushPendingPatches` and canonical settlement. `applyProjectDocumentPatch` currently returns after enqueue; its Promise alone does not prove commit success.
5. Always perform terminal canonical reconciliation via `cancel` in a finally path for this owned gesture (including after a successful commit). Here `cancel` means clear remaining temporary authority and synchronize to current canonical state, not undo a committed action. On success this reinforces the just-committed value; on rejection it restores the authoritative value. It creates no history entry and must not reverse another view's edit.
6. Clear the draft/pending UI from the settled canonical snapshot. Existing queue conflict/error UI remains responsible for a rejected project edit; do not label a renderer-local preview as saved.

Keep the terminal ownership record until step 5 completes, then release it. Repeated terminal messages are harmless. A no-net-change release uses the cancel path and does not enqueue a gain patch.

## Cancellation and interruption

Escape, pointercancel, lost capture before release, host-window blur/unmount, resizing during drag, a conflicting canonical revision, and project-history settlement stop input and call `cancel`. It closes/drains the gesture and reconciles runtime level from the current canonical channel using the existing reconciliation route. Do not feed the captured starting dB into the renderer patch path as a fake restoration edit.

For automated channels, preserve the existing automation binding/evaluation authority and parameter points. Cancellation must not create a permanent manual override or change interpolation; use the current runtime reconciliation rules and verify automation resumes its canonical behavior at intermediate playback times. If a performance cannot reconcile live, report the existing restart-required/failed outcome rather than claim restoration succeeded.

Register `registerHistoryEditorSettlement` against the slider's actual owner document. A history boundary awaits cancellation before undo/redo proceeds. Main also handles sender destruction/document replacement, so cleanup does not depend only on React unmount callbacks. Reuse existing lifecycle wiring and reconciliation queues; keep new bookkeeping limited to mixer-preview ownership.

## Required regression evidence

- Many movement previews leave canonical gain/history/dirty state unchanged; release produces one gain entry and exact final dB.
- No movement, return to exact starting position, and cancellation produce no entry or rounding of the prior value.
- Commit→undo→redo restores channel/parameter identities, values, points, snapshots, dirty state, and runtime gain.
- A delayed preview completing after finish/cancel cannot overwrite restored/committed gain.
- Invalid values, stale revisions, wrong document/channel/sender, and a competing gesture are rejected without mutation.
- Cancel after a newer canonical gain restores that newer gain, not the gesture's start value.
- Commit rejection, renderer destruction, project replacement, and engine restart do not leave a preview active or apply it to the next project/performance.
- Automated gain playback retains its points and interpolation and resumes canonical behavior after cancellation.
- Keyboard/numeric/reset edits commit through the same canonical gain semantics; no preview IPC is required for a discrete edit because runtime reconciliation handles its commit.
