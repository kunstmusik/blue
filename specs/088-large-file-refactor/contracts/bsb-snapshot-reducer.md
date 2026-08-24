# Contract: BSB Snapshot Reducer

## Responsibility

Apply existing typed BSB interface patches to a caller-owned optimistic instrument snapshot, including preset/tree/layout/UDO operations and the widget-metadata preservation policy.

## Interface

```ts
export function applyBsbInterfacePatchToSnapshot(
  instrument: InstrumentSnapshot,
  patch: BsbInterfacePatch,
): void;

export function applyBsbInstrumentPatchToSnapshot(
  instrument: InstrumentSnapshot,
  patch: BsbInterfacePatch,
): void;
```

The exact existing shared type names should be imported rather than duplicated. `applyBsbInterfacePatchToSnapshot` is retained through the `project-store.ts` façade. The store-facing operation includes metadata preservation; the predicate that classifies patches stays private.

## Preconditions

- The caller supplies the same outer instrument copy it supplies today.
- The patch has already passed the same shared-contract validation path used today.
- Missing optional BSB structures are handled exactly as the current implementation handles them.

## Postconditions

- Result values for all supported patches match the baseline.
- Supported nested edits path-copy only affected branches where the current reducer does so.
- Unaffected sibling aliases remain intact.
- Metadata-preserving patches retain established `objectNames` and `widgets` references.
- Preset selection, preset updates, object naming, layout, and UDO behavior are unchanged.
- The function adds no deep clone, serialization pass, IPC, or host side effect.

## Dependencies

Allowed: shared BSB/project snapshot types and store-independent helpers.

Forbidden: Zustand, React, Sonner, preload/window APIs, Electron, Node built-ins, filesystem, process, dynamic imports, or `project-store.ts`.

## Error behavior

Preserve current behavior for malformed, missing, or non-applicable targets. The move may not replace tolerated no-ops with throws, or swallowed failures with success, without separate approval.

## Verification matrix

| Case | Required evidence |
|---|---|
| Nested widget edit | Result equality plus affected/unaffected reference identity. |
| Metadata-preserving patch | `objectNames` and `widgets` alias baseline. |
| Metadata-changing patch | Existing replacement behavior. |
| Preset add/update/remove/select | Existing presets-manager cases. |
| Performance values | Existing BSB performance-store cases. |
| Score-object embedded BSB | Existing sound-patch cases. |

## Rollback

Restore the implementation behind the façade and repoint the score-object leaf import. No consumer contract or persisted data changes need reversal.
