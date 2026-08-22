# Implementation Plan: Stabilize Tree Drag and Drop

**Branch**: `084-stabilize-tree-dnd` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/084-stabilize-tree-dnd/spec.md`

## Summary

Stabilize every interactive tree by routing React Arborist through one HTML5 drag manager per DOM `Document`, while retaining native HTML drag/drop for the custom Libraries tree. Replace runtime auxiliary-panel teardown/rebuilds with a transactional Dockview layout transition that moves or adds only affected panels and preserves live panel objects for unaffected sessions. Keep full reconstruction only for startup, explicit layout reset, and unrecoverable legacy-layout hydration. Add real multi-tree and Dockview browser regressions, document the integration rule, and leave the serialized workbench envelope unchanged.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2, HTML/CSS

**Primary Dependencies**: Electron 35, Dockview 5.2, React Arborist 3.5, React DnD 14 / `dnd-core` 14, React DnD HTML5 Backend 14, Zustand 5

**Storage**: Existing app-wide workbench-layout settings remain unchanged; drag managers and panel sessions are renderer-memory state only

**Testing**: Vitest 4 with jsdom for module/store regressions; Vitest Browser with Playwright/Chromium for real React Arborist, DOM-document, and Dockview lifecycle coverage

**Target Platform**: Electron desktop on macOS, Windows, and Linux; main and Dockview popout documents

**Project Type**: Desktop application renderer feature

**Performance Goals**: Zero unrelated panel initialization calls per transition; O(number of auxiliary panels and groups) reconciliation; no visible reload flash; existing 60 fps drag responsiveness

**Constraints**: One HTML5 backend per `Document`; independent managers across documents; preserve panel object identity when placement is unchanged; fail/rollback to the last valid layout; no project, library, IPC, or layout-envelope migration

**Scale/Scope**: Four React Arborist surfaces (File Manager, Code Repository, Presets Manager, Effects Library), one native Libraries tree, three auxiliary edges, and stored workbench envelope versions 2 through 7

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **Portable data core**: PASS — all changes remain in `@blue/app` renderer code and documentation; `@blue/data` receives no DOM, React, DnD, or Dockview dependency.
- **Java and project compatibility**: PASS — Java Blue is not the reference for DOM drag ownership. `.blue` XML, CSD generation, library data, and project behavior are untouched; existing Electron tree and layout behavior is the compatibility baseline.
- **Canonical ownership and contracts**: PASS — one renderer-memory drag manager owns participating trees per `Document`; the workbench store remains canonical for desired auxiliary placement; Dockview owns live panel objects; app-wide layout settings remain canonical for persisted placement. The two interfaces are documented in `contracts/` and no IPC or migration is introduced.
- **Runtime and engine isolation**: PASS — no Java, filesystem, process, engine, ZeroMQ, main-process, or preload work is introduced.
- **Host-path portability**: N/A — the feature neither reads nor transforms filesystem paths. File Manager path payload behavior remains unchanged.
- **Verification evidence**: PASS — focused manager-domain and layout-transition tests, a real browser multi-tree test, a real Dockview Libraries/File Manager movement test, stored-layout regressions, affected renderer builds, `pnpm --filter @blue/app test`, browser tests, lint, and repository-wide tests are specified in [quickstart.md](quickstart.md).

**Post-design re-check**: PASS. The Phase 1 design adds no persistence, IPC, data-core, runtime, or portability surface. Both new seams are renderer-local and testable through the same interfaces used by production callers. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/084-stabilize-tree-dnd/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── auxiliary-layout-transition.md
│   └── tree-dnd-domain.md
└── tasks.md             # generated later by /speckit-tasks
```

### Source Code (repository root)

```text
packages/blue-app/
├── package.json
├── src/renderer/
│   ├── components/tree/
│   │   ├── BlueTree.tsx
│   │   └── tree-dnd-domain.ts
│   ├── components/workbench/
│   │   ├── auxiliary-layout.ts
│   │   └── panels/
│   │       ├── code-repository/CodeRepositoryTree.tsx
│   │       ├── effects-library/EffectLibraryTree.tsx
│   │       ├── orchestra/bsb/PresetsManagerDialog.tsx
│   │       └── tools/file-manager/FileManagerTree.tsx
│   ├── stores/workbench-store.ts
│   ├── tests/
│   │   ├── tree-dnd-domain.test.tsx
│   │   └── workbench-auxiliary.test.ts
│   └── browser/
│       ├── tree-dnd-coexistence.browser.test.tsx
│       └── workbench-tree-movement.browser.test.tsx
└── vitest.browser.config.ts

docs/
└── tree-drag-and-drop.md
```

**Structure Decision**: Keep the feature inside the existing `@blue/app` renderer. `BlueTree` is the single adapter at the React Arborist seam; all manager construction stays behind it. Runtime layout mutation remains in the existing auxiliary-layout module, whose new transition interface hides Dockview reconciliation and rollback from the workbench store. Existing full layout application remains available only for hydration/reset callers.

## Complexity Tracking

No constitution violations or approved complexity exceptions.

## Implementation Sequence

1. Add failing browser coverage that mounts two populated React Arborist trees in one document and reproduces the competing-backend failure; add a Dockview browser fixture that moves populated Libraries while File Manager remains mounted and records panel initialization/identity.
2. Add direct `@blue/app` dependencies on `dnd-core` and `react-dnd-html5-backend` at the versions already selected through React Arborist, then implement the per-`Document` manager registry and `BlueTree<T>` adapter.
3. Migrate File Manager, Code Repository, Presets Manager, and Effects Library to `BlueTree<T>`. Record Libraries as a native-HTML-drag non-participant whose behavior must coexist with the coordinated domain.
4. Split initial/full layout application from runtime transitions. Implement preflight, targeted add/move/close operations, active-panel and size restoration, interruption handling, and best-effort rollback behind `transitionAuxiliaryLayout(current, desired)`.
5. Route auxiliary reveal, dock, minimize, close, edge/group/panel move, merge, and popout-return actions through the transition interface. Keep hydration and explicit reset on the full-apply path.
6. Expand unit and browser regressions for repeated cycles, unchanged panel identity and initialization counts, state preservation, failed transitions, active drags, saved layouts, and independent iframe/popout documents.
7. Publish `docs/tree-drag-and-drop.md`, run the quickstart gates, and reconcile the implementation against FR-001 through FR-014 and SC-001 through SC-006.
