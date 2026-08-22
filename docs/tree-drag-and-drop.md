# Tree Drag and Drop Ownership

This document records the drag-and-drop ownership rules for interactive trees
in the Blue Electron workbench (SPEC 084).

**Implementation status**: Complete. SPEC 084 converged on 2026-08-22 with all
tasks T001–T037 complete. Manual acceptance by the project owner found no
remaining issues.

## The per-`Document` ownership rule

Every React Arborist tree rendered into the same DOM `Document` must share
**one** drag-and-drop manager. React DnD's HTML5 backend refuses a second
setup on the same root, and uncoordinated managers are what produced the
historical `Cannot have two HTML5 backends at the same time.` renderer
failure when workbench panels moved.

The renderer keeps one manager per `Document` in a `WeakMap`
(`packages/blue-app/src/renderer/components/tree/tree-dnd-domain.ts`), created
with `createDragDropManager(HTML5Backend, document.defaultView,
{ rootElement: document })`. Separate documents — the main window, Dockview
popouts, iframes — receive independent managers, and closing one document
cannot tear down another document's domain. Manager and active-drag state is
renderer-session state and is never serialized into the workbench layout.

The domain also reports active drags (`hasActiveTreeDrag`); runtime workbench
layout transitions defer while a drag owns the document.

## Integration path: `BlueTree`

All React Arborist trees must render the application adapter
`packages/blue-app/src/renderer/components/tree/BlueTree.tsx` instead of
importing Arborist's `Tree` directly:

```tsx
import { BlueTree } from '../../../tree/BlueTree';

<BlueTree<MyNode> ref={treeApiRef} data={nodes} /* ordinary Arborist props */>
  {RowRenderer}
</BlueTree>
```

`BlueTree` keeps the ordinary Arborist props and forwarded `TreeApi` ref.
Callers never pass `dndManager`, `dndBackend`, or `dndRootElement`; the
adapter resolves the owning `Document`, gates rendering until that
document's manager exists, re-resolves ownership when Dockview adopts the
panel DOM into another document, and leaves the tree unmounted for documents
without a usable window. Node and renderer types may still be imported from
`react-arborist`.

Participating surfaces: File Manager, Code Repository, Presets Manager, and
Effects Library all render `BlueTree`.

## Native Libraries disposition

`packages/blue-app/src/renderer/components/libraries/LibraryTree.tsx` is an
explicit **non-participant**: it uses native HTML `draggable`/`DataTransfer`
events and never creates a React DnD backend. Its native drag payloads
(`application/x-blue-library-drag`) must keep working beside participating
trees; the coexistence regression covers it. Do not migrate it to React DnD
without replacing that coverage.

## Future trees

- A future React Arborist tree must use `BlueTree`. No other integration is
  accepted.
- A future tree based on another drag system must document whether it joins
  this domain through an adapter or remains non-participating, and it must
  not create another HTML5 backend on the same document root.

## Runtime transitions versus full layout application

`applyAuxiliaryLayout` (full reconstruction) is reserved for startup
hydration, legacy/default layout application, and explicit Reset Windows.
Every runtime action — reveal, dock, minimize, close, maximize, restore,
edge/group/panel moves, merge, and popout dock-back — goes through
`transitionAuxiliaryLayout` (`auxiliary-layout.ts`), which:

- reuses live Dockview panel objects and only touches affected panels/groups,
- defers with `status: 'deferred'` while a participating tree drag is active,
- fails closed with `status: 'failed'` and the previous layout when preflight
  or Dockview mutation errors occur, and
- only an `status: 'applied'` result may replace canonical workbench state.

The serialized workbench envelope remains version 7; drag managers, active
drags, and transition statuses are never persisted.

## Required regression commands

From the repository root:

```sh
pnpm --filter @blue/app exec vitest run --config vitest.config.ts src/renderer/tests/tree-dnd-domain.test.tsx src/renderer/tests/workbench-auxiliary.test.ts src/renderer/tests/workbench-store.test.ts src/renderer/tests/workbench-layout-persistence.test.ts
pnpm --filter @blue/app exec vitest run --config vitest.browser.config.ts src/renderer/browser/tree-dnd-coexistence.browser.test.tsx src/renderer/browser/workbench-tree-movement.browser.test.tsx
```

The browser suites mount real Arborist trees and a real Dockview workbench:
the movement suite moves populated Libraries across all edges for twenty
cycles while tracking File Manager panel identity, initialization counts,
selection, expansion, scroll, focus, presentation, and edge sizes; the
coexistence suite cycles every tree surface together with the native
Libraries tree, verifies independent managers across documents, and keeps a
canary that fails if a raw uncoordinated Arborist tree rejoins a document.

## Completion verification

The final focused unit suite passed 103 tests, and the convergence browser
suite passed all 13 tests. The affected renderer build and repository lint
also passed. Drag managers, active drags, and transition statuses remain
renderer-session state; no project, library, settings, or serialized layout
data was changed.
