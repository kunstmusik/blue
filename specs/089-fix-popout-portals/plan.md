# Implementation Plan: Fix Popout Portal Correctness

**Branch**: `089-fix-popout-portals` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/089-fix-popout-portals/spec.md`

## Summary

Popup surfaces (context menus, dropdowns, tooltips, overlays, dismissal
listeners) inside floated Dockview workbench panels currently render into and
listen to the main application window, making them invisible or broken in the
floating window. This feature introduces one reusable "host document" mechanism
(a React context provided by the panel shell plus realm-safe containment and
dismissal helpers), applies it to every confirmed wrong-window surface in the
audit, and documents the convention so future panels follow it. Foundation work
(the color picker wrong-document fix) already exists on branch
`fix-color-picker` and is treated as a prerequisite to merge/cherry-pick first.
Live acceptance also exposed a restart-only float restoration defect, so the
feature now preserves exact popout membership through shutdown/startup and
keeps auxiliary grid rebuilding in the main-window realm.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), React 19, ES modules; pnpm workspace

**Primary Dependencies**: Electron (multi-window host), dockview 5.x (panel
layout + popout groups via `window.open('popout.html')`),
@radix-ui/react-context-menu ^2.2, react-dropdown-menu ^2.1, react-tooltip
^1.2 (all Portal components accept a `container` prop), jsdom (test-only,
two-document simulation)

**Storage**: Existing `program-settings.json`
`appSpecific.windowLayout.workbench` snapshot; schema unchanged. Save timing,
serialized popout interpretation, and restore behavior are corrected.

**Testing**: Vitest 4 — jsdom environment default per test file via
`// @vitest-environment jsdom`; two-document tests instantiate a second JSDOM
realm (established pattern in `color-picker.test.tsx`, iframe-based variant in
tree DnD coexistence tests). Restore tests use Dockview API doubles for exact
membership, stale-API cancellation, failure fallback, and grid-anchor
selection. A temporary isolated-profile Electron/CDP harness covers the real
float → shutdown → restart lifecycle.

**Target Platform**: Electron desktop app (macOS primary; Windows supported);
renderer process hosts main window + Dockview popout windows sharing one JS
context across separate documents/reals

**Project Type**: Desktop application (Electron + React renderer)

**Performance Goals**: No measurable change vs current behavior; popup open/
position/dismiss latency indistinguishable from docked mode

**Constraints**: Docked-panel behavior MUST remain unchanged; settings window
and other non-floating windows untouched; no new preload/IPC contract,
engine, persisted schema, or `@blue/data` changes. Main-process changes are
limited to preserving the existing canonical layout snapshot once shutdown
begins; existing uncommitted fix on
`.worktrees/fix-color-picker` (branch `fix-color-picker`) is the foundation and
MUST be integrated before implementation starts

**Scale/Scope**: Popup migration across
`packages/blue-app/src/renderer/components/workbench/**`, shared host-document
hooks/utils, the existing workbench layout store and shell, auxiliary grid
layout selection, one shutdown persistence boundary in Electron main, and
regression tests per corrected surface/lifecycle invariant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: PASS — all changes live in `@blue/app` renderer/main;
  `@blue/data` untouched and remains free of DOM/Electron concerns.
- **Java and project compatibility**: PASS — floating panels are an
  Electron-host capability with no Java Blue counterpart (documented N/A in
  spec); `.blue` XML, CSD generation, non-layout program settings, and
  libraries are not changed. The existing workbench-layout settings section is
  read/written through its canonical bridge with no schema change. Docked-mode
  behavior is a preservation requirement covered by the full suite.
- **Canonical ownership and contracts**: PASS — popup open/closed state remains
  ephemeral renderer session state; window placement remains in the existing
  canonical workbench-layout snapshot. No new persistence location or IPC
  contract is added; the host-document mechanism remains an internal typed
  renderer contract documented in `contracts/`.
- **Runtime and engine isolation**: PASS — the main-process adjustment only
  rejects late layout updates after shutdown begins. Preload, IPC channel
  definitions, Java runtime, project services, and engine code are unchanged.
- **Host-path portability**: N/A — feature involves no filesystem paths.
- **Verification evidence**: PASS — each corrected surface gets a focused
  two-document regression test that reproduces the wrong-window failure mode
  (mutation-verified during development); validation runs `pnpm --filter @blue/app test`,
  ESLint on changed files, typography audit, `git diff --check`; quickstart.md
  provides deterministic live acceptance steps, including float → quit →
  restart. Final evidence: 385 test files, 3,691 passing tests, 2 skipped;
  renderer/main/preload build, repository lint, and `git diff --check` pass.

## Project Structure

### Documentation (this feature)

```text
specs/089-fix-popout-portals/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── host-document-mechanism.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/blue-app/src/renderer/
├── components/workbench/
│   ├── DockviewPanel.tsx            # Provides HostDocumentContext (shell ref ownerDocument)
│   ├── AuxiliaryTab.tsx             # Migrates to shared mechanism (existing correct behavior kept)
│   ├── WorkbenchShell.tsx            # Awaits current-API layout hydration
│   ├── auxiliary-layout-dockview.ts  # Uses grid-resident anchors after popout restore
│   └── panels/
│       ├── score/layer-groups/      # ScoreTimeCanvas, TrackLayerGroupCanvas,
│       │                            # PatternsLayerGroupCanvas Radix portals → container
│       ├── score/                   # RulerConfigDialog, TempoLineView, MarkersBar,
│       │                            # MeterRegionBar, TempoRegionBar, PatternLayerHeader,
│       │                            # ScoreToolbar, TrackInstrumentControl, ScoreManagerDialog,
│       │                            # automation/AutomationTargetMenu
│       ├── shared/line-editor/      # EditableLineCanvas portals, listeners, viewport clamp
│       ├── orchestra/               # ArrangementContextMenu, ArrangementPanel containment
│       ├── orchestra/bsb/           # WidgetWrapper tooltip/context menu, BSBInterfaceCanvas,
│       │                            # PresetsManagerDialog, BSBPresetBar, BSBDropdownWidget,
│       │                            # BSBSavePresetBar widgets
│       ├── score-object/editors/    # PianoRollEditor(+SnapButton), TrackerScoreObjectEditor,
│       │                            # jmask/ParameterRow, note-processors menus+modal
│       ├── mixer/                   # ChannelStrip, EffectsChainContextMenu
│       ├── output/                  # OutputPanel selectionchange + menu container
│       └── ...                      # UdoTable, CodeRepositoryTree, FileManagerTree, LiveSpaceTab
├── components/ColorPicker.tsx       # (from foundation branch) migrates to shared helpers
├── hooks/
│   ├── use-document-mousedown-outside.ts  # (from foundation) gains targetDocument
│   └── use-host-document.ts         # NEW: context + useHostDocument/usePortalContainer hooks
└── utils/                           # NEW: cross-realm containment helper (isNodeLike/contains)

packages/blue-app/src/renderer/stores/workbench-store.ts
                                      # Exact serialized popout restore + safe fallback
packages/blue-app/src/main/main.ts     # Preserve pre-teardown layout during quit

tests under packages/blue-app/src/renderer/tests/   # per-surface two-document regression tests
docs/                                               # convention documentation referenced by AGENTS.md
```

**Structure Decision**: Single-package `@blue/app` change. One new renderer
mechanism pair (`hooks/use-host-document.ts` + cross-realm DOM util) is consumed
by the panel shell and each corrected popup surface. Existing renderer layout
modules own restoration and main-grid rebuilding; Electron main only protects
the canonical snapshot at the established shutdown boundary. Tests remain
colocated in `src/renderer/tests/`.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
