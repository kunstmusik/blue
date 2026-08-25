# Contract: Host Document Mechanism

Internal module contract for popup hosting in workbench panel content.
Everything here lives in `@blue/app` renderer code; nothing crosses IPC,
preload, or package boundaries.

This contract governs popup placement after a panel has a valid host document.
Workbench popout persistence/restoration is a separate lifecycle responsibility
documented in `data-model.md` Entities 4–7 and `research.md` R9–R12. Restore
must establish the correct native window and exact panel membership before
these consumers can satisfy the host-document invariants below.

## Module: `renderer/hooks/use-host-document.ts`

### `HostDocumentContext: React.Context<Document | null | undefined>`

- Provided by the panel shell (`DockviewPanel.tsx`) once per panel with the
  shell node's `ownerDocument`.
- `undefined` = no provider (caller is outside panel content; consumers may
  fall back to global document ONLY in main-window chrome, never inside
  panels).
- `null` = no real DOM environment (tests/SSR); popup surfaces render nothing.

### `useHostDocument(options?: { fallbackToGlobal?: boolean }): Document | null`

- Returns the nearest provided host document.
- Default (`fallbackToGlobal: false`, for panel content): returns context value
  verbatim — may be `null`; callers MUST render-nothing on null.
- `fallbackToGlobal: true` (main-window-only components such as toolbar menus):
  falls back to the global document when no provider exists.

### `usePortalContainer(): HTMLElement | null`

- Convenience returning the portal target body: the host document's `body`
  when a provider exists; falls back to the GLOBAL document body ONLY when no
  provider exists at all (`undefined` context — i.e., the caller is not inside
  any panel shell, e.g., workbench chrome or standalone tests, which do render
  in the main window). Returns null only for an explicit null provider
  (no-DOM environments).
- Intended value for Radix `<X.Portal container={…}>`. Panel-hosted callers
  therefore never need to gate rendering on null; the DockviewPanel provider
  guarantees every panel subtree resolves to its true hosting window.

## Module: cross-realm DOM util (placement decided in tasks; e.g. `renderer/utils/`)

### `isNodeLike(target: EventTarget | null): target is Node`

- Structural check: non-null, numeric `nodeType`, callable `contains`.
- MUST be used instead of `target instanceof Node/HTMLElement` anywhere a
  pointer event is classified relative to a popup or anchor.

### `containsNode(container: Node | null | undefined, target: EventTarget | null): boolean`

- `isNodeLike(target) && container?.contains(target) === true`.

### `isEventInsidePortalPopup(target: EventTarget | null): boolean`

- Structurally walks from a cross-realm target toward its popup root and
  recognizes the supported popup roles.
- Capture-phase surface handlers MUST return early for matching targets because
  a popup's bubble-phase guard cannot run before ancestor capture handlers.

## Module: `renderer/hooks/host-portals.tsx`

- `PopoutContextMenuPortal`, `PopoutDropdownMenuPortal`, and
  `PopoutTooltipPortal` bind Radix portals to `usePortalContainer()`.
- `portalEventIsolationProps` is spread onto interactive Radix `Content` and
  `SubContent` roots whose React ancestors handle mouse input. It stops
  pointer/mouse/click/context-menu dispatch through the logical React tree
  without blocking Radix's native `pointerdown` outside-dismissal bookkeeping.

## Extended hook: `useDocumentMouseDownOutside`

- Existing option retained: `targetDocument?: Document | null` — document that
  owns the popup and its dismissal listener; defaults to global document.
- Contract unchanged otherwise; existing callers unaffected.

## Consumer obligations (the documented convention)

Any popup surface rendered from workbench panel content MUST:

1. Render through the host document: Radix portals receive `container` from
   `usePortalContainer()`; hand-rolled overlays portal into
   `useHostDocument()?.body` and render nothing when it is null.
2. Compute position against the host window's viewport metrics obtained via
   the anchor element's `ownerDocument.defaultView` (never the global
   `window`) — including clamping bounds.
3. Bind dismissal (outside-pointer and Escape) listeners to the host document.
4. Classify event targets with the realm-safe containment rule above.
5. Apply both event-isolation phases where the React ancestors are interactive:
   spread `portalEventIsolationProps` on popup content roots for bubble-phase
   handlers, and exempt `isEventInsidePortalPopup(event.target)` in ancestor
   capture-phase handlers.
6. Clean up on unmount/force-close so neither window retains orphaned overlay
   DOM.

Main-window-only chrome (toolbar menus, settings windows, workbench-level
overlays) MAY keep current global-document behavior; when in doubt, prefer the
mechanism — it degrades correctly to the global document at the top level.

## Invariants (checked by review + tests)

- No corrected surface references bare `document.body` / global
  `document.addEventListener` / global `window.innerWidth` for panel-hosted
  popups.
- Docked behavior is indistinguishable from pre-change behavior.
- Every corrected surface has a two-document regression test demonstrating the
  wrong-window failure mode is fixed. Event-isolation coverage also asserts
  that popup input does not reach the React ancestor behind the portal and
  remains outside-dismissible; capture exemptions are tested separately.
  Representative tests are mutation-verified during development.
