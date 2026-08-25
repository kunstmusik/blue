# Research Record: Host-Aware Floating Surfaces

**Feature**: [Host-Aware Floating Surfaces](spec.md)

**Date**: 2026-08-25

**Branch**: `090-host-floating-surfaces`

## Decision

Use a generalized, host-aware in-window DOM surface policy for themed context menus, tooltips, popovers, and automation readouts. The policy must render into the document that visually hosts the panel, escape internal clipping, and apply collision-aware placement within that host viewport.

Explicitly exclude both alternatives below from this feature:

- Native Electron/OS context menus.
- Transparent or frameless overlay `BrowserWindow` surfaces.

The outer Electron-window boundary is therefore an intentional product boundary for this feature. The goal is full visibility and usability within the active host window, including escape from row, SVG, and scroll-container clipping.

## Source Reports Evaluated

The two supplied reports reached a compatible core conclusion but emphasized different gaps:

1. **Popup/Tooltip Clipping — Analysis Report**: correctly distinguishes internal viewport clipping from true OS-surface rendering and recommends host-aware collision positioning as the core solution. It overstates the remaining work as purely geometric because it does not identify the inline automation readout as a separate clipping source. It also treats `@floating-ui/dom` as already available without noting that it is currently only transitive through Radix and is not a direct package dependency.
2. **Popups and Tooltips: Architecture Analysis and Generalized Solutions**: correctly identifies the automation readout's nested SVG/row clipping and the value of host-portaled surfaces. Its recommendation to migrate most context menus to native menus is not suitable for Blue's themed React/Radix menu system and would introduce a second menu contract, styling model, state path, and test matrix. Its table's claim that `title` tooltips provide an out-of-window solution contradicts its own later discussion; browser-managed title tooltips are not a general styled popup solution.

The combined recommendation is therefore: retain Report 1's in-window direction, add Report 2's automation-readout fix, and defer both native menus and overlay windows.

## Repository Findings

### Existing host-document mechanism

The repository already contains the foundational mechanism from SPEC 089:

- [`docs/popout-popup-conventions.md`](../../docs/popout-popup-conventions.md) requires every panel-owned popup to render into, position against, and dismiss from its hosting window.
- [`use-host-document.ts`](../../packages/blue-app/src/renderer/hooks/use-host-document.ts) resolves the active host document and portal body.
- [`host-portals.tsx`](../../packages/blue-app/src/renderer/hooks/host-portals.tsx) provides host-aware Radix portal wrappers and synthetic-event isolation.
- [`cross-realm-dom.ts`](../../packages/blue-app/src/renderer/utils/cross-realm-dom.ts) provides realm-safe target and containment checks.
- Existing SPEC 089 tests cover two-document portal placement, inside/outside dismissal, host viewport dimensions, and event isolation.

This infrastructure should be reused and deepened rather than replaced.

### Existing positioning behavior

[`floating-position-utils.ts`](../../packages/blue-app/src/renderer/components/floating-position-utils.ts) already provides pure, tested top/bottom placement, horizontal shifting, viewport margins, and a nearest-scroll-viewport lookup. `ColorPicker` and the Settings runtime-device list consume it. The line editor has not yet been consolidated onto it: its tooltip uses hard-coded assumed dimensions and its context menu uses the pointer coordinates directly.

The recommended shared surface module should either extend this existing seam or wrap a dedicated positioning engine behind it. Callers should not each implement their own viewport constants, dismissal listeners, or portal selection.

### Confirmed clipping source

[`AutomationLineView.tsx`](../../packages/blue-app/src/renderer/components/workbench/panels/score/automation/AutomationLineView.tsx) renders `ReadoutText` as an SVG group inside the per-row SVG. The SVG requests visible overflow, but its row and surrounding timeline/scroll layout can still clip the group. The readout should remain associated with the point and preserve its content, while the visual annotation itself moves to the host document body.

The Java reference is [`ParameterLinePanel.java`](/Users/stevenyi/work/nbprojects/blue/blue-ui-core/src/main/java/blue/automation/ParameterLinePanel.java:253). `drawPointInformation` displays `x:` and `y:` text, appends the parameter label when present, and switches to the opposite side when the annotation would overflow the panel.

### Existing line-editor surfaces

[`EditableLineCanvas.tsx`](../../packages/blue-app/src/renderer/components/workbench/panels/shared/line-editor/EditableLineCanvas.tsx) already uses the host document for portal mounting, host-window Escape/outside handling, and cross-realm containment. Its remaining geometry is surface-specific: the tooltip clamps against fixed assumed width/height and the context menu does not measure or flip. These are the first practical consumers of a generalized collision policy.

### Scope boundary for Settings

`RuntimeDeviceField` is rendered in the separate Settings window. SPEC 089 explicitly treats Settings-window popups as a separate realm/window by design, so it is not evidence that the Dockview host-document mechanism is incomplete for this feature.

## Primary Documentation Research

### In-window positioning

Floating UI documents the exact primitives needed for custom in-window surfaces:

- [`computePosition`](https://floating-ui.com/docs/computeposition) computes an anchor-to-surface position and supports fixed positioning.
- [`Virtual Elements`](https://floating-ui.com/docs/virtual-elements) support cursor points, range selections, and canvas/SVG coordinates that do not have a convenient DOM anchor.
- [`flip`](https://floating-ui.com/docs/flip), [`shift`](https://floating-ui.com/docs/shift), and [`size`](https://floating-ui.com/docs/size) provide collision and constrained-content behavior.
- [`autoUpdate`](https://floating-ui.com/docs/autoupdate) updates an open surface on scroll, resize, and layout changes and should be cleaned up when the surface closes.

This supports using a small host-aware surface module with a virtual-anchor interface. If `@floating-ui/dom` is used, it must be added as a direct dependency rather than imported from Radix's transitive dependency tree.

### Native alternatives intentionally rejected

Electron's [`Menu` API](https://www.electronjs.org/docs/latest/api/menu/) and [`Context Menu` guide](https://www.electronjs.org/docs/latest/tutorial/context-menu) confirm that `Menu.popup()` is a main-process context-menu surface associated with a `BaseWindow` and can be invoked from renderer code through IPC. Electron also documents that menu presentation differs by platform: Windows/Linux are Chromium-like while macOS is native. That does not fit Blue's single themed React/Radix surface policy for this feature.

Electron's [`BrowserWindow` documentation](https://www.electronjs.org/docs/latest/api/browser-window) documents Wayland limitations for programmatic window positioning, movement, focus, and resizing. A transparent overlay window would also introduce a separate renderer realm, screen/DPI coordinate conversion, focus/click-through behavior, z-order management, and a second lifecycle path. It is therefore excluded rather than used as a general popup mechanism.

## Recommended Design Direction

Create one deep renderer-owned surface module with a small caller interface:

- accepts a DOM anchor or virtual client rectangle;
- resolves the host document and host viewport;
- portals into the host body;
- measures and collision-positions the surface;
- flips, shifts, and constrains content;
- updates only while open;
- owns host-window dismissal and cleanup;
- exposes placement metadata for arrows, styling, and tests.

Radix menus and tooltips should continue to use their existing primitives and host-aware portal wrappers. The shared surface module is for hand-rolled DOM/SVG/canvas surfaces and should not duplicate Radix's menu semantics.

## Verification Plan

The focused baseline executed during research passed 5 relevant test files and 30 tests, including:

- `floating-position-utils.test.ts`
- `editable-line-canvas-popover.test.tsx`
- `score-canvas-popout-menus.test.tsx`
- `score-timeline-automation-single-line.test.tsx`
- `score-timeline-automation-popout.test.tsx`

The feature should add or extend coverage for:

1. Automation readout placement outside an overflow-hidden row in both the main and second JSDOM documents.
2. Line-editor tooltip/context-menu top, bottom, left, and right collision cases.
3. Host-document-only Escape and outside dismissal, including foreign-realm targets.
4. Scroll, resize, float, re-dock, unmount, and no-DOM cleanup behavior.
5. Synthetic event isolation in both bubble and capture phases.
6. Manual/Electron acceptance for actual docked and floated windows after the focused tests pass.

## Non-Goals

- Native operating-system context menus.
- Transparent or frameless overlay BrowserWindows.
- Rendering themed React tooltips outside the active Electron window.
- Changes to project XML, generated CSD, app persistence, or canonical project state.

## Plan Addendum (2026-08-25, /speckit-plan)

Decisions resolving the two clarifications deferred from `/speckit-clarify` plus the open
engine choice recorded above:

- **Decision**: Add `@floating-ui/dom` as a direct dependency and wrap it behind the new
  host-surface module; do not extend `floating-position-utils.ts` to cover this feature.
  - **Rationale**: The feature needs measured-size collision, virtual anchors, and
    anchor-following updates across realms — Floating UI's exact primitives. Radix already
    ships Floating UI transitively, so the direct dependency pins the version in use rather
    than adding new code to the bundle. `floating-position-utils.ts` stays unchanged for
    ColorPicker and the Settings runtime-device list; consolidating them later is a follow-up.
  - **Alternatives considered**: hand-rolled flip/shift/size/autoUpdate in
    `floating-position-utils.ts` (duplicates Floating UI next to Radix's own copy);
    migrating all surfaces to Radix primitives (forks hand-rolled SVG/canvas surfaces into
    menu semantics they do not have).
- **Decision**: The smallest supported host-panel size for SC-005/SC-007 validation is
  **240 × 160 CSS px**, used as the JSDOM host viewport in tests and as the manual
  Electron acceptance floor. No repository minimum existed; Dockview sizes popout windows
  from the floated group's bounds, so a fixed floor is required for reproducibility.
- **Decision**: Keyboard parity in floated windows (arrow navigation, Enter activation,
  Escape dismissal, focus restoration) is explicit verification work in the two-document
  test pattern plus manual acceptance, not an assumption under FR-010. Radix focus handling
  is expected to work cross-realm once portaled into the host document; the verification
  task proves it.
- **Verification addition**: confirm Radix surfaces clamp against the *host* viewport when
  floated (passing the host viewport as `collisionBoundary` if Radix's default resolves the
  main window), and confirm readout annotation text adopts `text-role-subheadline` (11 px
  floor, `docs/typography.md`) when it moves from SVG text to a DOM surface.
