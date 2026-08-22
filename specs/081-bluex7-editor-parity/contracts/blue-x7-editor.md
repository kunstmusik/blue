# Contract: BlueX7 Editor, Snapshot, and Patch Flow

## Scope

This contract defines the complete BlueX7 snapshot, semantic mutation operations, host ownership, undo, and preview behavior shared by the orchestra panel, Track instrument editor, and library instrument editor.

## Snapshot Contract

`BlueX7InstrumentSnapshot` extends the existing instrument metadata with one complete serializable `voice` containing:

- common: transpose, algorithm, feedback, six enable flags;
- LFO: four depths/timing values, wave, sync;
- exactly six ordered operators with all oscillator, level, sensitivity, keyboard-scaling, and four-stage envelope fields;
- exactly four PEG points;
- exact Csound post code;
- derived shared-control state (`value` or `mixed`) for oscillator sync and PMS, if not calculated by the renderer.

The snapshot MUST NOT contain raw XML nodes, native paths, open files, table allocation state, engine objects, or undo history.

## Patch Contract

The existing `InstrumentPatch` gains an optional `blueX7` discriminated operation. Supported operations and required payloads are defined in [data-model.md](../data-model.md#bluex7patch).

Rules:

1. The target instrument MUST be BlueX7.
2. Operator/stage indexes MUST be integer and in bounds.
3. Editor-authored values MUST fall within the documented domain.
4. Shared sync/PMS operations MUST update all six stored operator fields atomically.
5. `replaceVoice` MUST validate the full detached value before changing any field.
6. `replaceVoice` MUST preserve assignment ID, name, comment, enabled state, raw XML template, and unknown XML; it may replace only modeled voice and post-code fields according to the caller's overlay.
7. Invalid operations MUST be rejected or reported unchanged with no partial mutation.
8. Snapshot creation after application MUST reflect the canonical result.

## Host Ownership

### Orchestra panel

The reusable editor emits `updateInstrument`. The renderer applies the same semantic operation optimistically, the document bridge commits it to main `BlueData`, dirty/revision state advances, and a canonical snapshot reconciles the renderer.

### Track instrument window

The same operation enters the Track revision-fenced queue. Coalescible operations may replace an older queued operation only when target kind, operator index, stage index, and field are identical. `replaceVoice` is indivisible and MUST NOT merge field-by-field. Stale results rebase using the returned canonical snapshot; unavailable results stop replay.

### Library instrument editor

The same operation is wrapped in `LibraryEditorDocumentPatch`. It updates only the unified-library editor session draft and serialized draft payload. The durable library item changes only through the existing Save command. Cancel/Revert leaves the durable item unchanged.

## Optimistic Projection

Every accepted semantic operation MUST have the same pure projection in renderer state and canonical application. Projection MUST copy affected arrays/objects rather than mutate a received snapshot. A failed canonical result restores/reconciles from the returned snapshot; the preview always derives from the latest visible snapshot.

## Undo/Redo Contract

- History is owned by each mounted BlueX7 editor instance.
- Context identity includes host/editor assignment identity; history clears when that identity changes, the editor unmounts/reopens, or an incompatible external replacement arrives.
- One numeric select/toggle commit is one step.
- A pointer/keyboard envelope or slider gesture records its start and final voice as one step.
- One successful SysEx voice replacement is one step.
- CodeMirror owns focused post-code text undo; project-level undo is not introduced.
- Undo/redo dispatches normal semantic/full replacement patches and observes the host's canonical receipt. It never mutates snapshots locally without a host patch.

## Preview Contract

The editor constructs preview from a deep-copied visible voice and disposable `Tables`:

1. allocate static and operator tables;
2. generate the selected Java algorithm body;
3. append exact post code;
4. derive the binding report;
5. publish `{ status, tables, instrumentBody, bindings, message? }`.

The final preview MUST appear within 500 ms after a completed edit sequence in the measured target. Earlier computations may be canceled/discarded by sequence identity. Generation failure leaves editing and saving available.

The binding report MUST distinguish Java-emitted fields from Java-persisted-but-not-emitted fields. It MUST NOT claim that an unused field changed generated sound merely because preview recomputed.

## UI Contract

- All three hosts render identical BlueX7 capabilities through the existing `InstrumentEditorPanel`.
- Main areas are Common/LFO, operator 1–6, PEG, and Csound; active context is explicit.
- Every scalar is pointer and keyboard operable with a visible current value.
- Envelope points are draggable and precisely editable; values and graph remain synchronized.
- Algorithm 1–32 displays the matching authoritative topology image and accessible algorithm label.
- Operator enable and shared/mixed states are communicated with text/controls, not color alone.
- Content reflows or scrolls without overlap at 1000×760 and at the orchestra pane's 360 px minimum.
- Dialogs have labelled actions, trap focus while open, restore focus on close, and treat Escape/Cancel as no mutation.

## Failure Guarantees

- Invalid patch: no mutation, actionable development/user diagnostic as appropriate.
- Generation error: show error, retain voice/post code, keep editor/save usable.
- Stale Track result: reconcile/rebase only against returned target identity; never apply to a different Track.
- Library Save failure: retain the dirty draft for retry.
- External snapshot/context replacement: abandon active gesture, clear local history, and render canonical data.
