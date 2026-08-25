# Contract: Automation Readout Parity

**Feature**: [spec.md](../spec.md) | Behavioral contract for the automation point readout,
anchored to Java Blue (spec FR-009).

**Java reference**: `blue-ui-core/src/main/java/blue/automation/ParameterLinePanel.java`,
`drawPointInformation` (line ~253).

## Content parity (unchanged)

- Two text lines: `x: <formatted time>` and `y: <formatted value>`; the parameter label is
  appended to the `y` line when non-empty.
- Numeric formatting stays `formatAutomationDouble` (existing util); no rounding or precision
  change.
- Readout point selection: hover point takes priority over click-selected point (existing
  behavior, mirrors Java's `mouseMoved`-driven selection).
- Point selection, dragging, and command semantics are untouched — only the annotation's
  rendering location changes.

## Placement parity (preserved, relocated)

- The annotation sits beside the point and **flips to the opposite side when it would overflow
  the visible area**, matching Java's overflow flip.
- Divergence (documented in spec): the visible area is the **host window viewport** (dock or
  float), not the Java panel bounds, and the renderer draws a solid dark backing box behind
  white text for theme-independent contrast (existing behavior, retained).
- Rendering moves from an SVG group inside the row SVG (`ReadoutText` in
  `AutomationLineView.tsx`) to a DOM surface portaled into the host document via the
  host-surface module, anchored to the point as a live `rect` anchor so it follows drags and
  scrolling (FR-002, FR-005).
- Typography: `text-role-subheadline` (11 px / 14 px line height) — the annotation role in
  `docs/typography.md`; never below the 11 px floor at any panel size (SC-005).

## Visibility requirements

- Complete readout (both lines, backing box) visible outside the row's clipping region at row
  top/bottom edges in docked and floated hosts (Story 2.1, SC-001).
- At the smallest supported host-panel size (240 × 160 CSS px, plan decision), the readout
  remains readable via flip/clamp without shrinking text below the floor (SC-005).
- The readout is informational only: it never takes pointer input and never interferes with
  editing gestures (Story 2.4).
