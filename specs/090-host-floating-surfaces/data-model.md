# Data Model: Host-Aware Floating Surfaces

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

All entities below are **renderer-owned disposable interaction state**. Nothing in this model is
persisted, serialized to `.blue` XML, sent over IPC, or shared with the engine. When a surface
closes or its host unmounts, every instance is discarded (spec FR-011, FR-013; constitution III).

## Entities

### HostSurfaceSession

One live popup managed by the host-surface module (`components/host-surface/`).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Stable identity for one open surface (testing + placement metadata) |
| `kind` | `'menu' \| 'tooltip' \| 'readout' \| 'popover'` | Drives defaults: `menu` closes on host scroll; others follow the anchor (FR-005) |
| `anchor` | `HostSurfaceAnchor` | What the surface attaches to (below) |
| `hostDocument` | `Document \| null` | Resolved via `useHostDocument()`; `null` ⇒ render nothing, attach nothing (FR-011) |
| `state` | `'opening' \| 'open' \| 'closed'` | Lifecycle (below) |
| `placement` | `PlacementResult` | Last computed position + placement metadata |

Validation rules (from spec requirements):

- Placement and viewport limits MUST be computed from `hostDocument.defaultView`, never the
  main window (FR-004).
- `menu` kind MUST transition to `closed` when the host viewport scrolls; scrolling inside the
  surface's own scrollable content MUST NOT close it (FR-005).
- Tooltip/readout kinds MUST reposition while `open` when the anchor moves, at most once per
  rendered frame, and MUST stop when `closed` or unmounted (FR-005, SC-007).
- Escape and outside-pointer dismissal bind to `hostDocument` / its `defaultView` only; equivalent
  input in other documents is ignored (FR-006).

State transitions:

```text
(closed) --open(anchor)--> opening --measured+positioned--> open
open --host scroll (menu kind)--> closed
open --Escape / outside pointer (host doc only)--> closed
open --anchor unmount / host document lost / panel float transition--> closed or re-anchored
open --per frame while anchor moves (tooltip/readout)--> open (placement updated)
closed --> all listeners detached, portal unmounted, no orphaned DOM (FR-011, SC-003)
```

### HostSurfaceAnchor (discriminated union)

| Variant | Shape | Used by |
|---|---|---|
| `element` | `{ type: 'element'; element: HTMLElement }` | Surfaces anchored to a DOM node in the host realm |
| `rect` | `{ type: 'rect'; getRect: () => FloatingAnchorRect }` | SVG/canvas points (automation readout, line-editor points) — a Floating UI virtual element |
| `point` | `{ type: 'point'; x: number; y: number }` | Pointer-opened context menus (line-editor menu, score-canvas menus) |

Rule: an `element` anchor MUST belong to `hostDocument`'s realm; containment and target
classification use `isNodeLike`/`containsNode`, never `instanceof` (spec Story 3.3,
`docs/popout-popup-conventions.md`).

### PlacementResult

| Field | Type | Description |
|---|---|---|
| `left`, `top` | `number` | Host-viewport CSS-pixel position for the portaled surface |
| `placement` | `'top' \| 'bottom' \| 'left' \| 'right'` (side actually used) | Exposed for arrows/styling/tests (research: placement metadata) |
| `maxHeight` | `number \| null` | Constrained height when the surface exceeds available space; content becomes internally scrollable (FR-003, SC-001) |

### HostViewport

The visible coordinate space of `hostDocument.defaultView`, optionally intersected with the
nearest scroll container (reuses `getFloatingViewport` semantics against the host realm).
Oversized rule: when the surface fits on neither side of the anchor, it is clamped inside the
viewport with `maxHeight` set so it stays usable through internal scrolling (FR-003).

## Relationships

```text
HostSurfaceSession 1──1 HostSurfaceAnchor (re-resolved on demand; rect/point variants are live)
HostSurfaceSession *──1 hostDocument (many surfaces can share one host document)
HostSurfaceSession 1──1 PlacementResult (recomputed ≤ once per rendered frame while open)
```

## Persistence

None. There is no migration, recovery, or storage location because every entity dies with the
interaction. Project mutations triggered *from* a surface (e.g. resetting a line) continue to flow
through the existing `onLinesChange` → document-bridge path unchanged; the surface itself never
carries project data.
