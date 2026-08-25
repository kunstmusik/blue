# Quickstart: Host-Aware Floating Surfaces

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Deterministic validation for the feature. Focused automated tests run first; the manual section
exercises real docked and floated Electron windows, which JSDOM cannot reproduce (spec
Assumptions). Contracts: [host-surface module](contracts/host-surface-module.md),
[Radix integration](contracts/radix-surface-integration.md),
[readout parity](contracts/automation-readout-parity.md).

## Prerequisites

- Dependencies installed (`pnpm install` from repo root)
- A runnable dev app: `pnpm --filter @blue/app dev` (or a packaged build)
- Any `.blue` project with an automation parameter and a sound layer using the line editor

## 1. Focused automated tests

```bash
# New module coverage (placement edges, realms, scroll policy, frame budget, no-DOM)
pnpm --filter @blue/app test -- src/renderer/tests/host-surface-placement.test.tsx src/renderer/tests/host-surface-lifecycle.test.tsx

# Extended consumers
pnpm --filter @blue/app test -- src/renderer/tests/editable-line-canvas-popover.test.tsx \
    src/renderer/tests/score-canvas-popout-menus.test.tsx \
    src/renderer/tests/score-timeline-automation-popout.test.tsx \
    src/renderer/tests/cross-realm-containment.test.tsx

# Package + repo gates
pnpm --filter @blue/app build:renderer
pnpm --filter @blue/app test
pnpm lint
git diff --check
```

Expected: all listed files pass; no new main-process or preload code, so `build:main` is only
needed if repository practice requires it for handoff.

## 2. Manual Electron acceptance

Run the app, then execute each scenario **docked first, then floated** (float via the panel's
popout control; resize the floated window down to **240 × 160 px** — the smallest supported
host-panel size — for the small-viewport checks).

### A. Context menus at every edge (Story 1, SC-001)

1. In the Score timeline, right-click near the **top, bottom, left, and right** edges of the
   score canvas and of a sound layer row.
2. Right-click near the same four edges of the line editor canvas.
3. Expected every time: the full menu is visible (flipped or shifted inward), every item is
   clickable, no canvas selection/drag handler fires through the menu, Escape and an
   outside click close it, and clicks in the *other* window do not close a floated menu.

### B. Tooltips and readouts at edges (Story 2, SC-001, SC-005)

1. Hover and drag line-editor points at each canvas edge: the tooltip stays readable inside
   the host window and follows the point while dragging.
2. Select/hover an automation point at the **top and bottom of its timeline row**: the complete
   `x:`/`y:` (+ label) readout renders *outside* the row's clip region, on the expected side,
   with values and formatting unchanged from docked behavior today.
3. While the readout is open, scroll the timeline: the readout follows the point (or closes if
   the point leaves view). While a context menu is open, scroll: the menu closes; scrolling
   inside the menu's own content does not.
4. At 240 × 160 px: the readout is still readable and no application text shrinks below the
   11 px typography floor.

### C. Lifecycle (Story 3, SC-003)

1. Open each surface, then float the panel, re-dock it, close it, and unmount the panel.
2. Expected: no popup remnant, ghost, or stuck dismissal in either window after any
   transition; a menu opened before floating is either moved to the new host window or closed.

### D. Keyboard parity (deferred clarification, FR-006/FR-010)

1. Open a score-canvas context menu with the keyboard (or open by pointer, then use keys) in a
   **floated** panel: arrow keys move selection, Enter activates, Escape closes and focus
   returns to the invoker — identical to docked.

## 3. Parity spot-check

With the Java reference (`ParameterLinePanel.drawPointInformation`) in mind: confirm the docked
readout shows the same `x:`/`y:` values and label placement as before this feature; compare a
drag at the row's top edge — the readout must flip to the opposite side exactly as before,
while now remaining fully visible (contract:
[automation-readout-parity.md](contracts/automation-readout-parity.md)).

## Pass criteria

SC-001 … SC-007 of the spec, exercised over the named acceptance set (score-canvas context
menus, line-editor tooltip + context menu, automation readout).
