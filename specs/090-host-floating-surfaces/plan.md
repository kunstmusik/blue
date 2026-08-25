# Implementation Plan: Host-Aware Floating Surfaces

**Branch**: `090-host-floating-surfaces` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/090-host-floating-surfaces/spec.md`

## Summary

Keep workbench context menus, tooltips, and automation/line-editor readouts fully visible inside
whichever Electron window hosts the panel content (docked or floated) by generalizing the SPEC 089
host-document mechanism into one shared host-surface module. The module resolves the host document
and host viewport, portals the surface into the host body, collision-positions it (flip/shift plus
constrained sizing), follows its anchor while open (menus instead close on host scroll), binds
dismissal to the host window with cross-realm containment checks, and cleans up on close/unmount.
Radix menus and tooltips keep their existing primitives and `Popout*Portal` wrappers; the new module
serves hand-rolled DOM/SVG/canvas surfaces and positions them with `@floating-ui/dom`, added as a
direct dependency. The automation readout moves from an SVG group clipped by its row to a portaled
DOM annotation in the host document while preserving its Java Blue content and edge-flip behavior.
No native menus, no overlay windows, no persistence changes.

## Technical Context

**Language/Version**: TypeScript (strict mode), React 19, Electron 35.

**Primary Dependencies**: `dockview` 5 (panel floating/popout), Radix UI
(`react-context-menu`, `react-dropdown-menu`, `react-tooltip` — already direct dependencies),
`@floating-ui/dom` (to be **added as a direct dependency**; today it only exists transitively
through Radix), `@rgrove/parse-xml` untouched.

**Storage**: N/A — popup open/anchor/placement/dismissal state is renderer-owned disposable
interaction state. No `.blue` XML, settings, or IPC persistence changes (spec FR-013).

**Testing**: Vitest with JSDOM and the existing two-document (main + popout realm) popup test
pattern; manual Electron acceptance for real docked/floated windows per `quickstart.md`.

**Target Platform**: Electron desktop renderer (macOS, Windows, Linux); two JS realms share one
renderer context when Dockview floats a panel.

**Project Type**: Desktop app (renderer-layer feature inside `packages/blue-app`).

**Performance Goals**: At most one placement update per rendered frame during continuous anchor
motion (point drags, active scrolling) — spec SC-007; no placement work after close/unmount.

**Constraints**: No native OS context menus and no transparent/frameless overlay `BrowserWindow`s
(spec FR-012, research decision). Application-owned popup text uses the seven semantic typography
roles with the 11 logical-pixel readability floor (`docs/typography.md`); annotation-style surfaces
use `text-role-subheadline`. Popups from panel content follow `docs/popout-popup-conventions.md`.

**Scale/Scope**: Named acceptance set (spec Clarifications): score-canvas context menus, the
line-editor tooltip and context menu, and the automation point readout; the category rule governs
all other workbench surfaces, whose inventory is enumerated during implementation. Smallest
supported host-panel size for validation is pinned to **240 × 160 CSS px** (plan decision resolving
the deferred clarification for SC-005).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: PASS — every change lives in `packages/blue-app` renderer source and
  tests. `@blue/data` is untouched: no new imports, no DOM/Node/Electron APIs, no dynamic imports.
- **Java and project compatibility**: PASS — Java reference is
  `blue-ui-core/src/main/java/blue/automation/ParameterLinePanel.java` (`drawPointInformation`).
  The readout keeps its `x:`/`y:` text, appended parameter label, point-selection behavior, and
  opposite-side overflow flip; the intentional divergence (styled in-window DOM surface instead of
  Swing text drawing) is already recorded in the spec. No `.blue`/CSD/persistence changes exist in
  this feature, so no serialization fixtures are affected; docked regression coverage (SC-004)
  guards the unchanged command semantics.
- **Canonical ownership and contracts**: PASS — popup open state, anchor descriptors, placement,
  and dismissal are renderer-owned disposable state owned by the new host-surface module and its
  consumers. No state enters `.blue` XML; no IPC/preload/engine contracts change. The module's
  typed renderer-internal contracts are documented in `contracts/`.
- **Runtime and engine isolation**: PASS — no Java-runtime, filesystem, process, ZeroMQ, or engine
  work. Pure renderer DOM feature.
- **Host-path portability**: N/A — no filesystem paths, host identities, or external path text are
  involved; all coordinates are within-realm CSS pixel spaces.
- **Verification evidence**: PASS — focused Vitest coverage: new host-surface module tests
  (edge placement, cross-realm dismissal, scroll-close vs follow, frame batching, no-DOM), plus
  extensions to `editable-line-canvas-popover`, `score-canvas-popout-menus`,
  `score-timeline-automation-popout`, and `cross-realm-containment` test files; keyboard parity
  coverage (arrows/Enter/Escape, focus restoration) in the two-document pattern; deterministic
  quickstart for manual docked/floated Electron acceptance. Commands: `pnpm --filter @blue/app test`
  (focused files first), then `pnpm --filter @blue/app build:renderer`, `pnpm lint`, `git diff --check`.

## Project Structure

### Documentation (this feature)

```text
specs/090-host-floating-surfaces/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── host-surface-module.md
│   ├── radix-surface-integration.md
│   └── automation-readout-parity.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/blue-app/src/renderer/
├── components/
│   ├── host-surface/                        # NEW shared module
│   │   ├── use-host-surface.ts              # anchor descriptor -> placement/lifecycle hook
│   │   ├── HostSurfacePortal.tsx             # host-body portal + event isolation + dismissal
│   │   └── host-surface-options.ts           # typed options (kind, gap, margin, closeOnHostScroll…)
│   ├── floating-position-utils.ts           # EXISTING seam; unchanged for ColorPicker/Settings consumers
│   └── workbench/panels/
│       ├── shared/line-editor/EditableLineCanvas.tsx      # consumer: tooltip + context menu
│       └── score/automation/AutomationLineView.tsx        # consumer: point readout
├── hooks/
│   ├── host-portals.tsx                     # EXISTING Radix Popout*Portal wrappers + isolation props
│   └── use-host-document.ts                 # EXISTING host document resolution
├── utils/
│   └── cross-realm-dom.ts                   # EXISTING isNodeLike/containsNode checks
└── tests/
    ├── host-surface-placement.test.tsx      # NEW module tests (pure placement + realms + no-DOM)
    ├── host-surface-lifecycle.test.tsx      # NEW scroll-close/follow, frame batching, cleanup
    ├── editable-line-canvas-popover.test.tsx        # EXTEND tooltip/menu edge cases
    ├── score-canvas-popout-menus.test.tsx           # EXTEND keyboard parity + edges
    ├── score-timeline-automation-popout.test.tsx    # EXTEND readout out-of-row placement
    └── cross-realm-containment.test.tsx             # EXTEND if new containment paths appear
```

**Structure Decision**: The feature stays entirely inside the `@blue/app` renderer. The new
`components/host-surface/` module deepens the existing SPEC 089 seams (`hooks/use-host-document.ts`,
`hooks/host-portals.tsx`, `utils/cross-realm-dom.ts`) rather than adding a package or layer:
`floating-position-utils.ts` is intentionally left as-is for its current consumers (ColorPicker,
Settings `RuntimeDeviceField`), because the new module needs measured-size collision, virtual
anchors, and anchor-following updates those callers never asked for. Consolidating those callers
onto the new module is a follow-up, not part of this feature.

## Key Design Decisions

1. **Wrap `@floating-ui/dom`, do not hand-roll collision math.** The module needs measured-size
   flip/shift, viewport-relative `size` constraints, virtual anchors (pointer points, SVG point
   coordinates), and scroll/resize-following updates — exactly Floating UI's `computePosition`,
   virtual elements, `flip`/`shift`/`size`, and `autoUpdate`. Re-implementing that next to Radix
   (which already ships Floating UI transitively) would duplicate tested logic with different math;
   adding it as a direct dependency pins the version the app actually uses. `autoUpdate` runs with
   the anchor's own realm (`ownerDocument.defaultView`), so cross-realm following falls out for free.
2. **One anchor descriptor, three shapes.** `HostSurfaceAnchor` is either a host-realm element, a
   virtual client rectangle (SVG point, canvas point), or a pointer coordinate. Every consumer —
   menus at pointer, tooltip at point, readout at moving point — expresses placement through the
   same contract (see `contracts/host-surface-module.md`).
3. **Scroll policy is a per-kind option, not caller logic.** `closeOnHostScroll` defaults true for
   menu-kind surfaces and false for tooltip/readout kinds, implementing FR-005's split policy;
   scrolling inside the surface's own content never dismisses. Updates are frame-batched
   (`autoUpdate` animation-frame scheduling) to satisfy SC-007.
4. **Radix surfaces keep Radix.** Existing themed menus/tooltips stay on Radix primitives inside
   `Popout*Portal` wrappers; a verification task confirms their collision viewport resolves from
   the host document (passing the host viewport as `collisionBoundary` if Radix defaults to the
   main window). The host-surface module is for hand-rolled surfaces only and must not fork menu
   semantics (research decision).
5. **Readout parity, relocated rendering.** `AutomationLineView` keeps computing `x:`/`y:` text,
   label, and selection semantics, but renders the annotation through the host-surface portal as a
   `text-role-subheadline` DOM box anchored to the point, preserving Java's opposite-side flip via
   the module's flip behavior. The SVG `ReadoutText` group is removed.
6. **Deferred clarifications resolved here.** Smallest supported host-panel size = 240 × 160 CSS px
   (used by JSDOM viewports and manual acceptance for SC-005/SC-007); keyboard parity (arrows,
   Enter, Escape, focus restoration in floated windows) is explicit verification work, not an
   assumption under FR-010.

## Complexity Tracking

No constitution violations. The one dependency addition (`@floating-ui/dom`) resolves a
demonstrated need (measured collision + auto-update across realms) with the simplest design that
preserves existing contracts; the rejected compliant alternative — extending
`floating-position-utils.ts` by hand — would re-implement Floating UI's flip/shift/size/autoUpdate
pipeline inside the repository and permanently diverge from Radix's positioning math.
