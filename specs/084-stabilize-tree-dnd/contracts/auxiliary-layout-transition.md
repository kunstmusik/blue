# Contract: Auxiliary Layout Transition

## Interface

```ts
type AuxiliaryLayoutTransitionResult =
  | { status: 'applied'; state: AuxiliaryLayoutState }
  | { status: 'deferred'; state: AuxiliaryLayoutState; reason: 'drag-active' }
  | { status: 'failed'; state: AuxiliaryLayoutState; reason: string };

function transitionAuxiliaryLayout(
  api: DockviewApi,
  current: AuxiliaryLayoutState,
  desired: AuxiliaryLayoutState,
  options?: { preserveDockedSizes?: AuxiliaryDockedSizeSnapshot },
): AuxiliaryLayoutTransitionResult;
```

The interface is synchronous because the current Dockview mutation interface is synchronous. Callers compute `desired` with existing pure layout helpers and replace workbench store state only when `status === 'applied'`.

## Preconditions

- `current` is the last successfully applied and normalized auxiliary state.
- `desired` is normalized before operation planning.
- Dockview `api` belongs to the current workbench document.
- Desired panel IDs resolve through the existing panel registry.

## Applied behavior

- Reuse each existing Dockview panel object when it remains docked, changes tab order, or moves to another docked edge.
- Add only panels newly entering a docked presentation.
- Close only panels leaving the docked presentation or the auxiliary layout.
- Create/remove only affected edge groups.
- Restore desired active tab, maximize state, panel titles, and captured edge sizes.
- Return a state synchronized from the resulting live Dockview layout.
- Preserve object identity and initialization count for every unaffected panel.

## Deferred and failure behavior

- If a participating tree drag or auxiliary panel drag is active, return `deferred` with `state === current` and perform no placement mutation.
- Preflight errors return `failed` before live mutation.
- Runtime mutation errors trigger a best-effort transition back to `current`, clear pending transition/drag UI state, and return `failed` with `state === current`.
- The workbench store must not persist `desired` for a deferred or failed result.

## Full application exception

`applyAuxiliaryLayout(api, state)` remains the explicit full-reconstruction interface for startup hydration, legacy/default layout application, and Reset Windows. Runtime reveal, dock, minimize, close, move, merge, and popout-return paths use `transitionAuxiliaryLayout`.

## Persistence compatibility

This contract changes how a valid `AuxiliaryLayoutState` is applied, not its shape or meaning. `StoredWorkbenchLayout` remains version 7; no migration or reset is permitted for this feature.
