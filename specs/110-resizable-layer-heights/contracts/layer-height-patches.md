# Layer Height Document Contract

These are proposed additions to `packages/blue-app/src/shared/project-editor/contract.ts`, carried through the existing `commit-project-document-patches` / ProjectHistory route. No new channel is introduced.

## ScorePatch additions

```ts
type LayerHeightTarget = {
  groupId: string;
  layerIndex: number;
  layerSelectionId: string;
};

type LayerHeightPatch =
  | {
      type: 'setLayerHeights';
      scopeGroupId: string | null;
      updates: Array<LayerHeightTarget & { height: number | 'default' }>;
    }
  | {
      type: 'setLayerGroupDefaultHeight';
      scopeGroupId: string | null;
      groupId: string;
      defaultHeightIndex: number;
    };
```

Numeric values are final absolute heights, even for relative gestures; renderer computes the original-height delta. `'default'` requests main-owned default resolution, not a renderer guess. A single aggregate can reset selected rows from different root groups to their respective defaults. Group-default patch changes only creation default; applying it to existing rows uses the first variant separately.

## Validation and atomicity

1. Existing document/session identity and expectedRevision must match. No auto-rebase of index-based requests or update of the captured fence. Identity resolution uses existing transferred `layerSelectionId`, never a new persisted UUID.
2. scopeGroupId null allows direct root groups; non-null requires a reachable opened PolyObject and only its direct rows. Reject unsupported or unreachable groups/targets, including Pattern rows.
3. layerIndex is a nonnegative integer, within group bounds, and must match layerSelectionId at that position. Reject duplicates rather than silently applying an entry twice.
4. Numeric height must be a finite integer in 22–660. Only literal `'default'` has reset semantics; no other string coercion, numeric-string, undefined, or null acceptance.
5. New default index must be a finite integer in 0–8 (PolyObject) or 0–9 (Track). Import/load defaults retain their separate compatibility rules.
6. Resolve/validate the entire update array and computed defaults before setters run. An empty update list is a valid no-op. Mixed numeric/default entries are allowed but every target must be valid.
7. Main runs the patch on a detached history candidate. Invalid input throws a contextual validation error that existing preparation turns into `invalid`/error; it must not return false as though accepted. Even a batch containing another valid patch publishes nothing on such failure.
8. Effective-value equality is an accepted no-op and must not change raw XML representation. Normalization happens only with a genuine height change. Do not derive “changed” merely from whether a setter was invoked.

## Commit envelope and responses

Renderer submits one isolated transaction with:

- Semantic label, `phase: 'single'`, unique operationId, existing context sequence and origin.
- `expectedRevision` captured before the drag/menu operation; document lifetime checked before enqueue and by the existing main route.
- One aggregate patch, not N separately enqueued row patches.
- Existing selection hints from the originating view, including unchanged object selection; resizing must not fabricate a selection replacement.

The existing ProjectDocumentCommitReceipt reports `changed`, `patchChanged`, `patchAccepted`, revision, session/document identity and optional error. Committed and valid unchanged responses are distinct from invalid/stale/failed responses. Queue handling must recognize any error and refresh canonical state. Do not change global receipt semantics or add silent partial-success behavior for height mutations.

Flush earlier patches before submitting, then compare captured revision and targets again. If they changed, cancel with a recoverable message and reload; never preserve a preview by retargeting new rows. Explicit revision metadata must survive queue preparation. Completed resize transactions must not coalesce with unrelated edits.

For an uncertain transport result, use the same operationId if retrying, reconcile against authoritative state, and avoid promising cancellation of work that may already have committed. Existing oversize history proposals retain their existing handling; preview ends, and no feature-specific approval flow is added.

## Snapshot changes

- SoundLayer and Track snapshot `height` is the effective logical-pixel height from the model.
- `layerSelectionId` must be populated for eligible targets by existing assignment helpers.
- PolyObjectLayerGroupSnapshot gains `defaultHeightIndex`; TrackLayerGroupSnapshot retains it.
- No preview, pointer, custom raw XML, or UI scope state crosses IPC.

## Integration classification

- Both variants: structural in `SCORE_PATCH_PREPARATION_CLASS`; add exhaustive classification and history roundtrip cases.
- Both variants: cosmetic in runtime reconciliation for normal commit and replay, no restart-required owner.
- Extend affected-target reporting for every updated layer/default group.
- Extend existing optimistic score reducer for committed commands, not for pointer previews. Invalidate/refresh nested score snapshots after successful commit/undo/redo so open nested views do not retain old heights.
- Legacy `updateLayerState.heightIndex` remains compatible; validate before any other fields mutate and clear custom state when height changes. All current UI height writers use the new path, including wheel presets.

## Required examples

| Case | Expected outcome |
| --- | --- |
| 44/88 +13 selection | 57/101; one entry; unselected rows unchanged. |
| Two roots, reset defaults 44/66 | Respective targets become 44/66 atomically. |
| One missing/reordered/Pattern target among valid targets | Entire request rejected; no mutation/history/revision. |
| Valid equal height | Accepted unchanged, no raw XML cleanup or history. |
| Numeric 21, 661, 57.5, NaN, Infinity, or string '57' | Invalid; no partial changes. |
| Captured revision 10, current revision 11 | Stale/rejected; refresh, no automatic retry with 11. |
| Default edit to index 2 | Future rows use 66; existing heights unchanged; one undoable entry. |
| Undo resize with malformed prior customHeight | Exact prior model/raw XML representation and dirty state restored. |
