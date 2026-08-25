# Popout Popup Conventions

How to render menus, popovers, tooltips, and dialogs from workbench panel
content so they work identically when a panel is docked or floated.

## The rule

**A popup must render into, position against, and take dismissal input from the
window that hosts the content the user is interacting with** — not the module's
global `window`/`document`.

Dockview popout panels (SPEC 055) live in separate OS windows while sharing the
main renderer's JS context. Two consequences drive every item below:

1. The global `document`/`window` are always the MAIN window, even for code
   running on behalf of a floated panel.
2. Each window is a separate JS realm: cross-realm objects fail `instanceof`
   checks (`Node`, `HTMLElement`, `HTMLInputElement`, …).

## Consumer obligations (checklist)

Any popup surface rendered from panel content MUST:

1. **Portal into the host document.**
   - Radix: use the wrappers from `renderer/hooks/host-portals.tsx` —
     `<PopoutContextMenuPortal>`, `<PopoutDropdownMenuPortal>`,
     `<PopoutTooltipPortal>` — instead of bare `<X.Portal>`.
   - Positioned hand-rolled surfaces (pointer menus, tooltips, SVG/canvas
     readouts): use the host-surface module
     (`renderer/components/host-surface/`) instead of positioning manually.
   - Other manual `createPortal`: portal into `useHostDocument()?.body`
     (render nothing when null).
2. **Position against the host viewport.** Use the anchor element's
   `ownerDocument.defaultView.innerWidth/innerHeight` (or the host document's)
   for clamping — never global `window`.
3. **Bind dismissal to the host window/document.** Outside-pointerdown/mousedown
   and Escape listeners attach to `useHostDocument()` /
   `hostDocument.defaultView`. `useDocumentMouseDownOutside` accepts a
   `targetDocument` option for this.
4. **Classify event targets structurally.** Never `target instanceof Node`.
   Use `isNodeLike(target)` / `containsNode(container, target)` from
   `renderer/utils/cross-realm-dom.ts`; prefer `tagName` comparisons over
   `instanceof HTML*Element`.
5. **Isolate portaled events in both React phases.** React portals bubble
   synthetic events along the REACT tree even though their DOM ancestors live
   elsewhere.
   - For bubble-phase ancestor handlers, spread `portalEventIsolationProps`
     from `renderer/hooks/host-portals.tsx` onto every interactive
     `Content`/`SubContent` root. It stops mouse/click/context-menu events
     before they reach canvas selection, row focus, or widget-drag handlers.
     The shared primitive isolates React's synthetic dispatch without stopping
     native propagation, so Radix's document-level `pointerdown`
     outside-dismissal bookkeeping still observes the event.
   - A content-root guard cannot run before ancestor capture handlers. Every
     relevant `onMouseDownCapture`, `onPointerDownCapture`, or
     `onContextMenuCapture` handler must return early when
     `isEventInsidePortalPopup(event.target)` is true.
6. **Clean up.** Overlays must close when their host panel unmounts or its
   floating window closes, leaving no orphaned DOM in either window.

Main-window-only chrome outside any Dockview panel (menu bar, settings windows,
workbench-level overlays) may keep global-document behavior;
`usePortalContainer()` intentionally falls back to the global document body
when NO provider exists, because such callers always render in the main window.

## Mechanism

- `DockviewPanel.tsx` wraps every panel's content in `HostDocumentContext`,
  resolved from the panel shell node's `ownerDocument` (the hosting window's
  document; dockview renders panel content through a React portal whose
  container lives in that window). Floating a group adopts the mounted DOM
  into the popout window WITHOUT a React remount, so the provider re-resolves
  on dockview's `onDidLocationChange` and on first interaction within the
  shell — a popup opened in the same gesture as the resolution reads the fresh
  document.
- `useHostDocument()` returns that document (`null` = no-DOM environment:
  render nothing). `usePortalContainer()` returns its `body`.
- Contract details: `specs/089-fix-popout-portals/contracts/host-document-mechanism.md`.

## Hand-rolled positioned surfaces (spec 090)

Context menus at pointer coordinates, tooltips, and SVG/canvas readouts MUST
use the shared host-surface module (`renderer/components/host-surface/`:
`useHostSurface` + `HostSurfacePortal`) rather than hand-positioning:

- accepts an element, a live rectangle, or a pointer-point anchor;
- portals into the host body, measures, and collision-positions
  (flip/shift/constrained height) against the HOST viewport via
  `@floating-ui/dom` (a direct dependency);
- follows moved anchors at most once per rendered frame; `menu` kinds close
  on host-viewport scroll instead, and scrolling inside the surface never
  dismisses;
- owns host-window Escape/outside-pointer dismissal, event isolation, and
  cleanup on close/float/unmount.

Radix surfaces keep their `Popout*Portal` wrappers and their own popper; do
NOT route them through the host-surface module. Contract details:
`specs/090-host-floating-surfaces/contracts/host-surface-module.md`.

## Reference examples

- Portal wrapper usage: `panels/score/layer-groups/PatternsLayerGroupCanvas.tsx`
- Host-surface module consumers (pointer menu, tooltip, point readout):
  `panels/shared/line-editor/EditableLineCanvas.tsx` and
  `panels/score/automation/AutomationLineView.tsx`
- Escape routing in a dialog: `panels/score/RulerConfigDialog.tsx`
- Cross-realm containment guard: `panels/orchestra/ArrangementPanel.tsx`
  (`isAddMenuTarget`) and `utils/cross-realm-dom.ts`
- Bubble-phase isolation: `hooks/host-portals.tsx`
- Capture-phase exemption: `panels/ScorePanel.tsx` and
  `panels/score-object/editors/PianoRollEditor.tsx`

## Tab renderers (special case)

Dockview tab components (e.g., `AuxiliaryTab.tsx`) mount OUTSIDE the
`HostDocumentContext` provider. They resolve their window via the dockview
panel API instead: `props.api.getWindow().document.body`.

## Testing

Every corrected surface ships a two-document regression test (second JSDOM
realm as the "popout"), asserting: placement in the popout document, retention
for inside clicks, dismissal via popout-document input only, and no synthetic
event delivery to the React ancestor behind the portal. Capture-handler tests
must separately prove popup targets are exempt. Temporarily remove the relevant
guard/exemption and confirm the focused test fails before considering the
regression mutation-sensitive. See
`tests/score-canvas-popout-menus.test.tsx` and
`tests/editable-line-canvas-popover.test.tsx` for the harness pattern.
