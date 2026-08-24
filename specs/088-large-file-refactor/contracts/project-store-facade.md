# Contract: Project Store Façade

## Stable module

`packages/blue-app/src/renderer/stores/project-store.ts` remains the renderer-facing composition module. Existing consumers are not required to change import specifiers.

## Required exports

The refactor preserves the names, types, and observable behavior of:

- `useProjectStore`
- `getProjectDocumentRevision`
- `acceptProjectDocumentRevision`
- `applyBsbInterfacePatchToSnapshot`
- `__testFlushPendingPatches`
- `__testAwaitPendingPatches`
- `__testClearPendingPatches`

Any other currently exported store state/action types and selectors remain available unless a separately approved semantic change removes them.

## Ownership

- The façade owns Zustand state composition and delegates focused work.
- The main process remains canonical for `BlueData`, `.blue` persistence, project revision, and project-session identity.
- The renderer snapshot is a transient projection with optimistic edits.
- The patch coordinator owns queue scheduling and local acknowledgement state, but never durable project state.

## Compatibility rules

1. An existing component importing only `project-store.ts` compiles without modification.
2. Optimistic actions update renderer state at the same point in their call sequence as before.
3. Flush/test hooks resolve or reject with the existing semantics.
4. No extraction may add a host API, Node built-in, Electron import, or IPC call to a pure snapshot module.
5. No extraction may introduce a second project-store instance, second patch queue, or second revision fence.
6. Public errors and background toast behavior remain unchanged.

## Dependency direction

```text
renderer consumers
    -> project-store.ts façade
        -> bsb-interface-snapshot.ts
        -> project-patch-queue.ts
        -> existing typed preload bridge
```

The two extracted modules must not import the façade. `score-object-document-reducer.ts` may import the BSB seam directly because it is another reducer leaf, not a store owner.

## Verification

- Typecheck/build the renderer without broad import migration.
- Keep existing project-store integration tests against the façade.
- Add direct tests only where they lower the seam: BSB identity/metadata and patch-queue protocol.

## Rollback unit

Each delegate can be restored inline independently because the façade and public symbols remain in place.
