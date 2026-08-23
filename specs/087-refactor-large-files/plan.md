# Implementation Plan: Large Module Refactoring Foundations

**Branch**: `087-refactor-large-files` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/087-refactor-large-files/spec.md`

## Summary

Establish a repeatable modularization pattern and apply it to four first-wave seams while preserving observable behavior: the shared project-editor contract/snapshot/patch module (`packages/blue-app/src/shared/project-editor.ts`, ~11.7k lines), the auxiliary workbench layout module (`packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts`, ~2.5k lines), the BlueData aggregate's XML/CSD policy (`packages/blue-data/src/blue-data.ts`, ~2.4k lines), and the optimistic score-object document reducer embedded in `ScoreObjectEditorPanel.tsx` (~1.3k lines). Each seam keeps its existing public entry point as a compatibility façade; extracted modules stay package-internal (spec clarification: internal-first). The reusable modularization review rule and the first-wave boundary maps are documented in `docs/modularization.md`, and the deferred modules (`main.ts`, `project-store.ts`, score timeline canvases, `unified-library/service.ts`, `workbench-store.ts`) are recorded there with next seams, risks, and deferral reasons.

## Technical Context

**Language/Version**: TypeScript 5.8 (strict mode), pnpm workspace monorepo.

**Primary Dependencies**: Electron (main/preload/renderer), React + zustand + dockview (renderer), `@blue/data` (platform-neutral models), `@rgrove/parse-xml` via repo `Element`/`Elements`. No new dependencies are introduced.

**Storage**: N/A — no new persistence. `.blue` XML remains the canonical project format; auxiliary layout persists through the existing program-settings IPC path (`layout-settings-store` → main `window-layout-store.ts`) with the legacy `localStorage` mirror untouched.

**Testing**: vitest 4 (`pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`), plus `test:scripts`, eslint, and per-package `tsc` builds. Existing suites are the behavioral baseline: 134 test files import `project-editor`; `workbench-auxiliary.test.ts` (1,704 lines) covers layout migrations/transitions; `blue-data-csd-*` and `blue-data-frozen-roundtrip` cover XML/CSD; five test files import `applyPatchToDocument` directly.

**Target Platform**: Electron desktop (macOS, Windows, Linux). All changes are platform-neutral TypeScript module moves; no path handling changes.

**Project Type**: desktop-app monorepo (library package `@blue/data` + app package `@blue/app`).

**Performance Goals**: Behavior- and performance-preserving. Façades are static ES re-exports (tree-shakeable); no runtime wrapper layers, no lazy loading, no new allocation on hot paths. No measurable startup or render regression.

**Constraints**: No new public exports (spec FR-004 internal-first clarification); no circular dependencies; `@blue/data` production source stays browser-safe with top-level static imports only; no changes to IPC channels, `.blue` XML output, CSD output, or layout persistence format.

**Scale/Scope**: Four seams, ~19k source lines redistributed across ~16 new internal modules. 284 files import `project-editor` (all keep working via the directory-index façade); 7 runtime consumers + 10 test files import `auxiliary-layout`; `BlueData` is consumed by 177 `blue-app` files and `blue-cli` (public API unchanged).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Post-design re-check (after Phase 1, 2026-08-22): all six PASS, no violations.**
Confirmed deltas against the pre-research check: (1) the `@blue/data` policy modules'
`import type { BlueData }` rule plus the restriction of runtime imports to
non-back-importing modules keeps the split cycle-free by construction
(research R4); (2) the three dead-code deletions in `csd-policy.ts` are recorded as
deletions in the boundary map, not behavior changes, and no Java-parity oracle
references them; (3) moving the `hasActiveTreeDrag` guard into the auxiliary adapter
keeps `dnd-core`/`react-dnd` out of the pure layout model, preserving the browser-safe
purity boundary (research R3); (4) the reducer's BSB shared-reference mutation
semantics are explicitly preserved verbatim per FR-012 and pinned by existing tests
(research R5, contracts/score-object-reducer.md); (5) quickstart.md fixes the per-seam
and repository-wide validation obligations with a recorded baseline requirement.

- **Portable data core**: PASS — The `blue-data.ts` extraction stays entirely inside `@blue/data` and introduces no Node/DOM/Electron imports. New policy modules (`src/blue-data/xml-policy.ts`, `csd-policy.ts`, `runtime-policy.ts`) use `import type { BlueData }` for typing so no runtime cycle forms; runtime imports are only of modules that do not import `blue-data.ts` back (`serialization/*`, `migration/*`, `compile-data.ts`, child models). The reducer extraction moves code *within* the renderer; it does not enter `@blue/data` (spec clarification).
- **Java and project compatibility**: PASS — XML load dispatch, save section ordering, `pluginDataXml` unknown-data preservation, and raw-XML migration ordering move verbatim; `UpgradeManager.performUpgrades` still runs before deserialization. CSD policy moves verbatim; the sync/async duplication is relocated as-is (unification is explicitly out of scope). Java parity is guarded by `blue-data-csd-parity.test.ts` and `blue-data-csd-disk.test.ts` (developer-local Java-generated fixtures under `~/work/blue/...`) plus the in-repo `migration/fixtures/track-layer/*.blue.xml` integration test. No intentional divergence.
- **Canonical ownership and contracts**: PASS — No state owner changes. Main process keeps owning the active `BlueData` document; the optimistic score-object reducer stays renderer session state; auxiliary layout state stays in the program-settings store. All public entry points (`project-editor` specifier, `auxiliary-layout.ts` exports, `BlueData` class API, `ScoreObjectEditorPanel` re-export) remain valid through façades; no new IPC or persistence contracts.
- **Runtime and engine isolation**: PASS — No Electron main, preload, Java-runtime, ZeroMQ, or engine-client code is touched. The only host-coupled logic in scope (Dockview adapter, DOM size capture in auxiliary layout) stays in the renderer adapter module and does not leak into pure modules.
- **Host-path portability**: N/A — None of the four seams performs filesystem-path handling or path-to-text conversion. No native-path, canonical-identity, or embedded-text boundaries are created or moved.
- **Verification evidence**: PASS — Per seam: existing focused suites run first (see quickstart.md), import-specifier stability is itself covered by compiling the 284/7/177 consumer sets, and `pnpm --filter @blue/app build:main` type-checks main-process usage of `project-editor`. New focused tests are added only where a moved responsibility has no direct test target today (identity registry, envelope codec). Repository-wide `pnpm test` + `pnpm lint` gate the cross-package seams (`blue-data` policy extraction affects `blue-app` and `blue-cli`).

## Project Structure

### Documentation (this feature)

```text
specs/087-refactor-large-files/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── project-editor-facade.md
│   ├── auxiliary-layout-facade.md
│   ├── blue-data-facade.md
│   └── score-object-reducer.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
docs/
└── modularization.md                     # NEW: reusable review rule (FR-014) + first-wave boundary
                                          #      maps (FR-002) + deferred inventory (FR-013);
                                          #      referenced from AGENTS.md

packages/blue-app/src/shared/
└── project-editor/                       # seam 1: replaces project-editor.ts; the specifier
    ├── index.ts                          #   '../shared/project-editor' resolves here, so all 284
    │                                     #   consumers keep working unchanged (pure re-export façade
    │                                     #   incl. existing bsb-widget-keys re-exports)
    ├── contract.ts                       # snapshot/patch/realtime type declarations + embedded
    │                                     #   validators/factories (src lines ~124–2525)
    ├── identity.ts                       # WeakMap ID registries: mixer channel/entry IDs, score
    │                                     #   object/layer/group/pattern IDs — SINGLE instance,
    │                                     #   imported by both snapshot and patch modules
    ├── bsb-widgets.ts                    # BSB widget-tree/preset/serialization helpers,
    │                                     #   applyBsbInterfacePatch, ensureUniqueName
    ├── snapshot-score.ts                 # bar-renderer helpers, score document/layer/automation
    │                                     #   builders, createProjectEditorSnapshot orchestrator
    ├── snapshot-mixer-orchestra.ts       # mixer/orchestra/instrument/UDO/transport/properties/
    │                                     #   BlueLive snapshot builders and restore helpers
    ├── patch-score.ts                    # score/layer/automation/track/pattern appliers incl.
    │                                     #   applyScoreObjectPatch, tempo/meter patches
    ├── patch-mixer-bluelive.ts           # mixer/BlueLive/MIDI patches, arrangement reconciliation,
    │                                     #   nested poly-object snapshot
    └── patch-document.ts                 # applyProjectDocumentPatch orchestrator, UDO patch,
                                          #   isEmptyProjectDocumentPatch

packages/blue-app/src/renderer/components/workbench/
├── auxiliary-layout.ts                   # seam 2: becomes a pure re-export barrel (all 7 runtime
│                                         #   consumers + 10 test files unchanged)
├── auxiliary-layout-model.ts             # NEW: types, seed catalog, pure selectors, pure state
│                                         #   commands, invariant normalization, utilities
│                                         #   (viewport clamps parameterized)
├── auxiliary-layout-migrations.ts        # NEW: legacy v2–v4 types, upgradeV2/V3/V4→V5, seed
│                                         #   relocation, stored-shape validators (pure)
├── workbench-layout-envelope.ts          # NEW: StoredWorkbenchLayout v7 codec (pure)
└── auxiliary-layout-dockview.ts          # NEW: Dockview/DOM adapter — size capture/restore, drop
                                          #   policy, build/apply, transition engine, api-coupled
                                          #   commands, mount helpers, drag guard, DOM hit-test

packages/blue-app/src/renderer/components/workbench/panels/score-object/
└── score-object-document-reducer.ts      # seam 4: verbatim move of panel lines 35–316 + 318–1278
                                          #   (applyPatchToDocument + automation/BSB helper fns);
                                          #   ScoreObjectEditorPanel.tsx re-exports
                                          #   applyPatchToDocument for compatibility

packages/blue-data/src/
├── blue-data.ts                          # seam 3: stays the façade + aggregate (fields, accessors,
│                                         #   constructor, deepCopy, remap helpers) with thin
│                                         #   delegates to the policy modules; public API unchanged
└── blue-data/
    ├── xml-policy.ts                     # NEW: loadFromString dispatch, saveAsXML section
    │                                     #   ordering, pluginDataXml preservation, legacy
    │                                     #   in-loader shims (mind setter invariants)
    ├── csd-policy.ts                     # NEW: CSD render pipeline (sync + async moved verbatim),
    │                                     #   BlueLive CSD, helpers; deletes 3 dead functions
    └── runtime-policy.ts                 # NEW: processOnLoad(Async), processLiveDataOnLoad(Async),
                                          #   usesJavaRuntime traversal
```

**Structure Decision**: Façade-first, directory-index where the façade is a pure barrel (`project-editor/`), same-file façade where the aggregate remains meaningful (`blue-data.ts` keeps the class), sibling-file barrel for `auxiliary-layout.ts`, and a single new module plus panel re-export for the reducer. All new modules are package-internal (not added to `@blue/data`'s `index.ts` or any new barrel beyond the façades). Extraction order runs lowest-risk first: seam 4 → seam 3 → seam 2 → seam 1 (internally staged contract → identity → bsb-widgets → snapshots → patches → orchestrator), each step leaving the repository green and independently revertible (FR-012).

## Complexity Tracking

> No constitution violations to justify. The design keeps every extraction behind an existing public entry point, introduces no new public contracts, no new stores, and no speculative abstractions.
