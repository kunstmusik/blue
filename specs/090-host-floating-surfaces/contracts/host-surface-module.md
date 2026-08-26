# Contract: Host-Surface Module

**Feature**: [spec.md](../spec.md) | Internal renderer contract for
`packages/blue-app/src/renderer/components/host-surface/` (new module).

This is a **UI contract inside `@blue/app`'s renderer** — not an IPC, preload, or data-package
API. It defines what hand-rolled workbench surfaces (line-editor tooltip, line-editor context
menu, automation readout, future SVG/canvas popovers) may rely on, so no caller re-implements
edge behavior (spec FR-008).

## Consumer interface

```ts
// host-surface-options.ts
type HostSurfaceKind = 'menu' | 'tooltip' | 'readout' | 'popover';

interface HostSurfaceOptions {
  kind: HostSurfaceKind;
  /** Explicit hosting document override (undefined = panel context). */
  hostDocument?: Document | null;
  gap?: number;              // default 8 — space between anchor and surface
  margin?: number;           // default 8 — space kept inside the host viewport
  align?: 'start' | 'center' | 'end';
  closeOnHostScroll?: boolean; // default: true for 'menu', false otherwise
  onDismiss?: (reason: 'escape' | 'outside-pointer' | 'host-scroll' | 'host-unmount' | 'caller') => void;
}
```

```ts
// use-host-surface.ts
function useHostSurface(
  anchor: HostSurfaceAnchor | null,   // null ⇒ closed
  options: HostSurfaceOptions,
): {
  state: 'opening' | 'open' | 'closed';
  placement: PlacementResult | null;  // null until first measurement
  setSurfaceElement: (el: HTMLElement | null) => void;  // measured-size source
  close: () => void;
};
```

```tsx
// HostSurfacePortal.tsx
<HostSurfacePortal session={session} className="…">
  {children}   // rendered into hostDocument.body at session.placement
</HostSurfacePortal>
```

## Guarantees the module makes

1. **Host binding**: portals into `useHostDocument()`'s body; renders and attaches nothing when
   it resolves `null` (no-DOM/SSR safe — FR-011). Placement and clamping are computed against
   `hostDocument.defaultView` and the nearest host-realm scroll viewport — never the global
   `window` (FR-004).
2. **Visibility**: measured-size flip/shift via `@floating-ui/dom`; when neither side fits, the
   surface is clamped with `maxHeight` and internal scrolling stays usable (FR-003, SC-001).
3. **Anchor following**: while `open`, rect/point anchors are re-read and placement recomputed at
   most once per rendered frame; recomputation stops on close or host unmount (FR-005, SC-007).
4. **Scroll policy**: `kind: 'menu'` closes on host-viewport scroll (`onDismiss('host-scroll')`);
   pointer/wheel events whose target is inside the surface never dismiss (FR-005).
5. **Dismissal**: Escape and outside-pointer listeners attach to the host document/window only;
   equivalent input from any other document is ignored (FR-006). Target classification uses
   `isNodeLike`/`containsNode` from `utils/cross-realm-dom.ts`. Pointer input inside the surface
   or inside an `element` anchor's subtree never dismisses — the trigger toggles an
   element-anchored surface through its own handler (mirrors Radix trigger/DismissableLayer
   coordination).
6. **Event isolation**: the portal root spreads the existing `portalEventIsolationProps` semantics
   so interactive surfaces never activate React ancestor handlers (selection, focus, drag,
   audition) behind them (FR-007, `docs/popout-popup-conventions.md`).
7. **Cleanup**: close/unmount detach every listener and remove the portal from both documents;
   no orphaned DOM or stale listener survives float, re-dock, close, or unmount (SC-003).
8. **Typography**: the module imposes no text styling; consumers use semantic `text-role-*`
   classes (annotation surfaces: `text-role-subheadline`, 11 px floor).

## Guarantees callers keep

- Anchor elements must live in the host realm; `rect`/`point` anchors are expressed in
  host-viewport client coordinates.
- Callers own surface content, styling, and semantics (menu items, readout text) and route any
  project mutation through existing bridges — the module never touches project state.
- Radix-based surfaces must NOT use this module; they use the `Popout*Portal` wrappers
  (see [radix-surface-integration.md](radix-surface-integration.md)).
