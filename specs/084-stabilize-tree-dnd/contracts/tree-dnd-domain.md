# Contract: Tree Drag Ownership Domain

## Application interface

All React Arborist trees must import and render the application adapter `BlueTree<T>` instead of importing Arborist's `Tree` directly. Node/renderer types may continue to come from `react-arborist`.

Conceptual interface:

```ts
function BlueTree<T>(props: BlueTreeProps<T>): ReactElement;
```

`BlueTreeProps<T>` preserves the supported Arborist `TreeProps<T>` and forwarded tree ref. Callers do not provide `dndManager`, `dndBackend`, or `dndRootElement`; those are owned by the adapter.

## Invariants

- Every mounted `BlueTree` resolves the `Document` that owns its rendered DOM.
- All `BlueTree` instances in the same `Document` receive the exact same `DragDropManager` object.
- Trees in different documents receive different managers rooted in their respective documents.
- Arborist is never mounted without the coordinated manager; document resolution may render an empty tree host for one commit.
- Portal/popout remount into another document re-resolves ownership before mounting handlers there.
- Manager and active-drag state are transient and never serialized.

## Error and lifecycle behavior

- Missing/closed documents leave the tree unmounted rather than creating a manager against the wrong global window.
- Unmount unregisters that tree's handlers. Closing one document cannot tear down another document's manager.
- Development remount must reuse the live document domain and must not leave a stale backend marker.

## Participating inventory

| Surface | Disposition |
|---|---|
| File Manager | Migrate to `BlueTree`; retain disabled Arborist drag/drop and all selection/expansion/scroll behavior |
| Code Repository | Migrate to `BlueTree`; retain move, rename, selection, and context actions |
| Presets Manager | Migrate to `BlueTree`; retain move, delete, rename, and keyboard behavior |
| Effects Library | Migrate to `BlueTree`; retain move, rename, selection, and activation |
| Libraries | Explicit native-HTML-drag non-participant; retain `draggable`/`DataTransfer` behavior and coexistence coverage |

## Future integration rule

A future React Arborist tree must use `BlueTree`. A future tree based on another drag system must document whether it joins this domain through an adapter or remains non-participating without creating another HTML5 backend on the same document root.
