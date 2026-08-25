# Research: 089-fix-popout-portals

Date: 2026-08-24. Unknowns were resolved by direct inspection of the renderer,
Electron main shutdown path, and installed Dockview source, plus an isolated
Electron-profile reproduction (no external research required).

## R1. How do floated panels host content — adoption or re-render?

**Decision**: Treat the mechanism as "panel React tree stays in the main
renderer; DOM lives in the popout document" and build a mechanism that works
regardless of which hosting form dockview uses.

**Rationale**: In-repo evidence: `use-ipc-listeners.ts:244` ("Dockview popouts
share the main renderer's JS context"), `BlueTree.tsx:55` ("Dockview adopts
live panel DOM into popout documents without remounting"),
`popout.html` is a bare host that dockview populates. The live-verified color
picker defect confirms panel UI can render into the wrong document while its
React tree executes in the main window. A ref-based `ownerDocument` lookup at
the panel shell resolves correctly under either adoption or portal rendering,
so the mechanism does not depend on dockview internals.

**Alternatives considered**:
- Pin to dockview's internal popout implementation (`createPortal` into popout
  document): rejected — couples us to a library detail that may change between
  releases.
- Separate renderer bundles per popout with their own React roots: rejected —
  contradicts the existing SPEC 055 architecture, massive scope.

## R2. How should popup surfaces learn their host document?

**Decision**: Provide a `HostDocumentContext` from the panel shell component
(`DockviewPanel.tsx`) using its own rendered node's `ownerDocument`, consumed
via a `useHostDocument()` hook; popups pass it to Radix `Portal container`,
positioning, and dismissal listeners.

**Rationale**: `DockviewPanel.tsx` already renders the outer shell div for
every panel and holds a `forwardRef` to it — one insertion point covers all
panels. React context flows through portals/adoption because context follows
the React tree, not the DOM tree. The precedent exists: `AuxiliaryTab.tsx:344`
passes `container={props.api.getWindow().document.body}` and is the only
currently-correct Radix usage; the new approach achieves the same result
without threading dockview API props through every layer.

**Alternatives considered**:
- Thread `props.api.getWindow().document.body` down through `WorkbenchPanelContent`
  → every panel → every canvas/editor: rejected — invasive across ~20 files'
  prop signatures and breaks the panel registry's api-free decoupling.
- Global mutable "current popup document" module variable: rejected — race-prone
  with multiple windows/panels and hostile to tests.
- Per-event resolution only (`event.currentTarget.ownerDocument`): insufficient —
  Radix Portal needs a container at render time, before events fire.

## R3. Can Radix portals target a custom container?

**Decision**: Yes — use the existing `container` prop on `ContextMenu.Portal`,
`DropdownMenu.Portal`, and `Tooltip.Portal`.

**Rationale**: Installed versions (@radix-ui/react-context-menu ^2.2.16,
react-dropdown-menu ^2.1.16, react-tooltip ^1.2.8) all wrap
@radix-ui/react-portal, whose `Portal` accepts `container: HTMLElement | null`
(falls back to global body when undefined). Proven in-repo by AuxiliaryTab.

**Alternatives considered**: Wrapping/forking Radix primitives — rejected;
unnecessary abstraction over a first-class prop.

## R4. Realm-safe containment: how do we detect "inside the popup" cross-window?

**Decision**: Replace all `target instanceof Node/HTMLElement` gates in popup
containment checks with a shared structural check (`nodeType` number +
`contains` function) plus plain `contains()` tree walks, exported as one util.

**Rationale**: Verified empirically during the color picker evaluation: React
creates portal children via the container's `ownerDocument`, so popup nodes in
a popout belong to that window's realm and FAIL `instanceof` against the main
realm — any mousedown inside such a popup would be misread as an outside click.
Structural duck-typing is realm-independent; `contains()` performs pure tree
walks that work across documents. The pattern is already shipped and
mutation-tested in `ColorPicker.tsx` on the foundation branch.

**Alternatives considered**:
- `instanceof` against the event's own realm (`target instanceof
  target.ownerDocument.defaultView.Node`): rejected — convoluted and still
  breaks for mixed trees.
- Tag-name sniffing: rejected — fragile.

## R5. Dismissal listener binding

**Decision**: Reuse/extend `useDocumentMouseDownOutside({ targetDocument })`
(foundation branch) for pointer dismissal; bind Escape keydown to the same
host document; add an analogous small helper where components hand-roll
listeners today.

**Rationale**: The hook already accepts an optional target document and is
consumed by ColorPicker + RuntimeDeviceField without breakage (default
preserves current behavior). Hand-rolled sites (NoteProcessorChainEditor,
EditableLineCanvas, panel dialogs) migrate onto host-document binding.

**Alternatives considered**: A single global focus/window tracker service —
rejected; over-engineered for per-popup document binding.

## R6. Test strategy for two-document behavior

**Decision**: Unit-level regression tests instantiate a second JSDOM realm and
assert portal placement, inside-click retention, outside-click dismissal, and
Escape routing — exactly the established pattern in `tests/color-picker.test.tsx`;
iframe-based browser-mode tests remain available (tree DnD precedent) where a
real same-process second browsing context matters. Each corrected surface gets
a focused test; mutation verification (temporarily reverting the fix) proves
test sensitivity at least once per problem class. Live acceptance follows
quickstart.md for the P1 score-panel story. The restart-only follow-up also uses
a temporary isolated-profile Electron/CDP harness because native window
lifetime and exact cross-window tab membership cannot be proven in jsdom.

**Alternatives considered**: A committed Playwright/E2E multi-window suite —
rejected for this feature; no such harness exists in-repo today. A temporary
CDP diagnostic was sufficient to verify the native restart boundary without
adding a new project dependency. A maintained multi-window harness remains a
possible future investment.

## R7. Sequencing relative to the uncommitted color-picker work

**Decision**: Treat branch `fix-color-picker` (worktree
`.worktrees/fix-color-picker`, based on c1027b41) as a hard prerequisite:
merge or cherry-pick it onto this feature branch BEFORE implementing, so the
shared helpers consolidate rather than duplicate (`isNodeLike`,
`useDocumentMouseDownOutside.targetDocument`, viewport-by-ownerDocument).

**Rationale**: That branch contains verified, mutation-tested fixes for the
same mechanism on the highest-profile surface; rebuilding them here risks
divergence. Its round-trip test and floating-panel tests become part of this
feature's regression net.

**Alternatives considered**: Reimplementing equivalent fixes inside 089 —
rejected (duplication); landing foundation directly on develop first —
acceptable variant if review completes early; either way 089 builds on top of
it.

## R8. Scope boundary for unverified drag handlers

**Decision**: Out of scope (per spec Assumptions). Window-level mousemove/
mouseup drag handlers in panels are catalogued but not touched unless a surface
already being modified exposes the defect trivially.

**Rationale**: Spec explicitly excludes them pending runtime verification;
mixing unverified behavioral changes into this feature would blur regression
attribution.

**Alternatives considered**: Fixing speculative drag issues now — rejected;
violates constitution's surgical-change discipline.

## R9. Why did a Score-only saved popout restore every editor or no popout?

**Decision**: Do not use Dockview 5.2's generic `fromJSON` popout branch.
Prepare a fully docked hydration snapshot plus explicit popout intents, hydrate
the grid synchronously, then await `addPopoutGroup` for each intent and verify
exact panel membership.

**Rationale**: Direct inspection of the installed Dockview 5.2 source showed
that serialized `gridReferenceGroup` is a group id, but the restore path
resolves it through `getPanel()`. Depending on id collisions and group state,
that ambiguity either fails panel removal or moves the complete editor group
into a Score-only popout. Explicit restoration distinguishes the single-panel
and exact-group cases and permits runtime group-id remapping.

**Alternatives considered**:
- Patch/fork Dockview in `node_modules`: rejected while its public awaited API
  can express the required restore safely.
- Edit serialized group ids to resemble panel ids: rejected; preserves the
  library ambiguity and corrupts the docking-origin identity contract.
- Accept any restored popout then move unexpected panels back: retained only
  as defensive intent enforcement, not the primary restore mechanism.

## R10. Which layout is canonical while the app is quitting?

**Decision**: Once application quit begins, retain the last in-session
workbench snapshot and ignore later renderer layout updates caused by closing
native popout windows.

**Rationale**: Dockview correctly redocks a popout's panels when that window
closes. During normal user interaction this is a layout change; during app
teardown it is transient cleanup. The renderer's final `beforeunload` save was
therefore replacing the valid floated snapshot with an all-docked snapshot.
The existing main-process layout handler is the authoritative boundary and can
distinguish `running` from `isQuitting` without a new IPC channel or schema.

**Alternatives considered**:
- Disable renderer `beforeunload` persistence entirely: rejected; it protects
  legitimate final state outside this teardown ordering.
- Serialize after every popout window closes: rejected; that records the exact
  transient state causing the bug.
- Add a second shutdown-layout file: rejected; violates canonical ownership.

## R11. How should startup handle Electron's provisional popout document?

**Decision**: The popout-open guard waits until the child window has navigated
to `popout.html` before considering a reload, never reloads the initial
`about:blank` proxy, and retains a bounded failure fallback.

**Rationale**: Electron can expose a ready-looking `WindowProxy` before the
native BrowserWindow has attached its intended navigation. Reloading that
proxy can cancel the real navigation; failing to await the open path can leave
an empty window or a missed Dockview load event. The guard is lifecycle
defense, while the awaited public API remains the source of success.

**Alternatives considered**:
- Immediate unconditional reload: rejected; reproduced the navigation race.
- Treat native-window creation as restore success: rejected; the Dockview host
  container and panel DOM may not yet exist.
- Infinite wait: rejected; startup must recover to a usable docked layout.

## R12. Why did a successfully opened restored popout flash and close?

**Decision**: Auxiliary edge rebuilding must choose a grid-resident editor as
its positional anchor and skip all popout/floating panels.

**Rationale**: Isolated Electron logging exposed the primary caught exception:
`Cannot read properties of null (reading 'parentElement')` from Dockview group
creation. Score is the first default editor, so after a correct Score popout
restore the auxiliary-layout code still selected it as the anchor for rebuilding
Output. Dockview then attempted to compute a main-grid location through a tab
whose DOM belonged to the popout document. The outer restore fallback closed
the valid popout; Dockview's pending debounced resize callback subsequently
produced the user-visible `innerWidth` null error. Selecting only a live `grid`
panel removes the primary failure; the `innerWidth` error disappears with it.

**Alternatives considered**:
- Catch/suppress Dockview's `innerWidth` callback: rejected; it was secondary
  fallout and would leave the layout reset bug intact.
- Skip auxiliary restoration whenever any popout exists: rejected; Output and
  other auxiliary panels must restore normally.
- Delay auxiliary restoration: rejected; time does not change the anchor's
  cross-window location.
