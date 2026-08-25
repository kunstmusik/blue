# Contract: Radix Surface Integration

**Feature**: [spec.md](../spec.md) | How themed Radix menus/tooltips adopt the host-aware
visibility policy without changing their semantics (spec FR-010).

## Rules

1. **Portals**: Radix surfaces inside workbench panel content mount through
   `PopoutContextMenuPortal` / `PopoutDropdownMenuPortal` / `PopoutTooltipPortal`
   (`hooks/host-portals.tsx`) — never bare `<X.Portal>` (`docs/popout-popup-conventions.md`).
2. **Host viewport clamping**: Radix's collision handling must resolve the *host* window's
   viewport when a panel is floated. Implementation must verify Radix's popper measurement
   realm; if it clamps against the main window, pass the host viewport as `collisionBoundary`.
   Docked and floated behavior must be identical (FR-001, FR-004).
3. **Event isolation**: every interactive `Content`/`SubContent` root spreads
   `portalEventIsolationProps`; every relevant ancestor capture handler exempts popup targets
   via `isEventInsidePortalPopup` (FR-007). This is existing convention — the feature must not
   regress it.
4. **Dismissal**: Radix `DismissableLayer` input binds to the hosting document via the portal
   container; outside-pointer/Escape from unrelated documents must not dismiss a floated menu
   (FR-006).
5. **Keyboard parity (verification obligation)**: in a floated panel, a Radix menu must remain
   fully keyboard-operable — arrow navigation, Enter activation, Escape dismissal — and restore
   focus to the invoker on close, identical to docked behavior. Proven by two-document tests
   and manual acceptance; this is explicit work, not an assumption under FR-010.
6. **Semantics unchanged**: item structure, submenu behavior, styling, shortcuts, and command
   activation stay exactly as today in docked mode (SC-004). No menu is rebuilt on the
   host-surface module.

## Relationship to the host-surface module

The host-surface module serves hand-rolled DOM/SVG/canvas surfaces only. It must not be used to
re-implement Radix menu semantics, and Radix must not be portaled through it — one policy, two
execution paths, per the research decision.
