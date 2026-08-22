# Research: Stabilize Tree Drag and Drop

## Decision 1: Inject one React DnD manager per DOM Document

**Decision**: Create a renderer-local manager registry keyed by `Document`. Construct each manager with `createDragDropManager(HTML5Backend, document.defaultView, { rootElement: document })`, and make every React Arborist tree consume it through a local `BlueTree<T>` adapter.

**Rationale**: React Arborist 3.5 wraps every `Tree` in its own `DndProvider` unless the caller supplies `dndManager`. React DnD's HTML5 backend marks its root with `__isReactDndBackendSetUp` and throws `Cannot have two HTML5 backends at the same time.` when another manager sets up on the same root. Supplying the same manager to every Arborist tree in one document uses Arborist's supported integration seam and guarantees one backend. Keying by `Document` gives Dockview popouts and other supported documents independent lifetimes.

**Alternatives considered**:

- A single `DndProvider` around the main React root: rejected because Dockview renders panels through portals into popout documents while preserving React context; a main-window manager would listen on the wrong document.
- A separate `dndRootElement` per tree: rejected because it avoids the exception by creating isolated domains rather than satisfying the one-domain rule, and it weakens cross-surface drag handling.
- Removing React Arborist, React DnD, and the HTML5 backend: rejected because all four Arborist trees would need replacement and FR-013 requires the lower-risk coordinated solution unless it proves inadequate.
- Suppressing or catching the backend error: rejected because ownership would remain undefined and one tree could silently lose interaction.

## Decision 2: Hide document detection and mount ordering in BlueTree

**Decision**: `BlueTree<T>` preserves the normal Arborist tree props/ref interface while internally waiting for a DOM sentinel/container, resolving its `ownerDocument`, obtaining that document's manager, and only then mounting Arborist with `dndManager`.

**Rationale**: Passing `undefined` for the first render would briefly let Arborist create another backend before an effect can inject the shared manager. The adapter must own render gating and document changes so four callers cannot implement subtly different mount ordering. This is a deep module: callers select the application tree adapter; manager lifecycle, popout detection, and HMR-safe reuse stay local.

**Alternatives considered**:

- A hook returning a container ref and manager: rejected as a shallow interface that requires every caller to repeat gating and ref-composition rules.
- Direct `dndManager` wiring at every tree: rejected because manager construction and document selection would spread across four modules and future trees could bypass policy.

## Decision 3: Treat native Libraries drag/drop as an explicit non-participant

**Decision**: Keep `LibraryTree.tsx` on native HTML `draggable`/`DataTransfer` events. Document it as non-participating in React DnD manager ownership, while testing that it coexists with participating trees.

**Rationale**: Libraries does not create a React DnD backend and already supports application-specific external/native payloads. Migrating it would add compatibility risk without addressing the duplicate backend. The observed Libraries move triggers the defect because broad auxiliary reconstruction remounts participating trees such as File Manager, not because Libraries owns a competing manager.

**Alternatives considered**:

- Port Libraries into Arborist/React DnD: rejected as unrelated tree replacement and a regression risk to native/external drag payloads.

## Decision 4: Use incremental Dockview reconciliation for runtime layout transitions

**Decision**: Retain `applyAuxiliaryLayout` for startup/reset, and add `transitionAuxiliaryLayout(api, current, desired, options)` for live changes. The transition preflights descriptors/groups, reuses existing `IDockviewPanel` objects, moves only panels whose edge/order changes, adds newly docked panels, closes only panels leaving the docked presentation, restores active panel/maximize/size state, and reports applied/deferred/failed status.

**Rationale**: Current `applyAuxiliaryLayout` calls `clearLiveAuxiliaryPanels` for every auxiliary panel and recreates all edge groups. That destroys unrelated React portal sessions, repeats data loads, and allows old/new Arborist providers to overlap during Dockview/React lifecycle commits. Dockview already exposes panel move operations that preserve a live panel object. A transition interface concentrates ordering and failure behavior while keeping the workbench store declarative.

**Alternatives considered**:

- Continue full reconstruction after coordinating managers: rejected because it would mask the backend crash but still violate FR-006/FR-007 and lose transient panel state.
- Cache each panel's local state before teardown and restore it after rebuild: rejected because focus, subscriptions, pending requests, and third-party component state cannot be captured reliably; it treats lifecycle destruction rather than removing it.
- Rewrite the workbench layout model or upgrade its serialized envelope: rejected because desired placement is already represented and the defect is in applying that state to live Dockview objects.

## Decision 5: Fail closed with preflight, deferral, and rollback

**Decision**: A runtime transition returns the prior canonical state when a drag is active, preflight fails, or Dockview throws. Active tree or auxiliary drags defer/reject the move and clear pending UI state. If execution fails after a partial move, the implementation best-effort reconciles back to `current`; the store persists only an applied result.

**Rationale**: The store must never publish desired placement as completed when live Dockview placement failed. A typed result gives callers one safe rule and provides a stable test surface for FR-008.

**Alternatives considered**:

- Let exceptions reach the renderer error boundary: rejected because a panel movement failure must leave the workbench usable.
- Persist desired state before moving live panels: rejected because restart would restore a transition the user never successfully completed.

## Decision 6: Verify through real trees and real Dockview lifecycle

**Decision**: Pair focused jsdom module tests with Vitest Browser/Playwright tests that mount real Arborist trees and a real Dockview workbench fixture. Instrument panel mount/initialization and use actual movement interfaces for repeated cycles.

**Rationale**: Existing auxiliary tests primarily exercise layout-state helpers and Dockview stubs; they cannot reproduce HTML5 backend setup or React portal overlap. Browser tests supply actual `Document`, drag events, React effects, and Dockview panel identity. Unit tests remain useful for transition ordering, rollback, and stored-layout compatibility.

**Alternatives considered**:

- Store-only tests: rejected explicitly by FR-010.
- Manual Electron testing only: rejected because SC-006 requires a regression that fails when an uncoordinated manager or broad reconstruction returns.

## Dependency and compatibility findings

- React Arborist currently brings React DnD transitively, but the application will directly import `dnd-core` and `react-dnd-html5-backend`; they must therefore be declared direct `@blue/app` dependencies at compatible major 14 versions.
- File Manager disables Arborist drag/drop behavior but still receives Arborist's provider today, so it must adopt `BlueTree` despite being read-only from Arborist's perspective.
- Code Repository, Presets Manager, and Effects Library use Arborist move/rename interactions and must retain their existing callbacks and payload behavior.
- No Java parity lookup is applicable. No project/library/settings schema or layout-envelope migration is needed.
