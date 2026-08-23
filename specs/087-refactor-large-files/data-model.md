# Data Model: Large Module Refactoring Foundations

Phase 1 output. This feature changes no persisted data; the entities below are the
design entities the refactor produces and consumes. The in-memory data structures
being relocated (`ProjectEditorSnapshot`, `AuxiliaryLayoutState`, `StoredWorkbenchLayout`,
`ScoreObjectEditorDocumentSnapshot`, the `BlueData` aggregate and its `.blue` XML) are
unchanged in shape and are listed only where a boundary decision touches them.

## Entities

### Module Boundary Decision

A documented choice governing one extraction.

| Field | Type | Rules |
|---|---|---|
| responsibility | string | One primary domain responsibility (FR-003); "reduce file size" is not a responsibility |
| public façade | module path | Existing entry point that stays importable unchanged |
| extracted modules | list of module paths | Package-internal; not added to package `index.ts` |
| canonical state owner | enum | main-process document / renderer session / program settings — MUST be unchanged by the extraction |
| dependency direction | DAG edge list | One-way; builders never import appliers; no cycles (FR-005) |
| compatibility strategy | enum | re-export barrel / same-file façade delegates / module re-export |
| test seam | list of test targets | Lowest practical boundary; must run without unrelated responsibilities |
| rollback boundary | commit | One seam = one independently revertible staged unit (FR-012) |

Lifecycle: proposed → reviewed against the modularization rule (docs/modularization.md) →
applied → recorded in the boundary map; or deferred with rationale into the inventory.

### Compatibility Façade

The stable entry point preserving existing callers.

| Field | Type | Rules |
|---|---|---|
| specifier | import path | MUST keep resolving for every existing consumer |
| export surface | symbol set | Exactly the previously public symbols (FR-004, internal-first clarification); new public exports require a demonstrated external consumer |
| implementation | re-export / delegate | No logic of its own beyond delegation |
| lifetime | "until an intentionally approved API migration" | Façade cleanup is later, separately reviewed work (spec Assumptions) |

Instances: `packages/blue-app/src/shared/project-editor/index.ts` (barrel),
`packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts` (barrel),
`packages/blue-data/src/blue-data.ts` (class façade + aggregate),
`ScoreObjectEditorPanel.tsx` re-export of `applyPatchToDocument`.

### Canonical Project Document

Unchanged by this feature: the main-process-owned `BlueData` instance. XML load dispatch,
save ordering, and CSD policy *move behind* the façade; `.blue` structure, unknown-data
preservation (`pluginDataXml`), and migration-before-deserialization ordering are
behavioral invariants that must survive the move verbatim (FR-007/FR-008).

### Renderer Snapshot / Optimistic Reducer

`ScoreObjectEditorDocumentSnapshot` + `ScorePatch` → `ScoreObjectEditorDocumentSnapshot`
(the extracted `applyPatchToDocument`). Rules: renderer session state; never enters
`.blue` XML; lives in a renderer-local pure module with no React dependency (spec
clarification); its patch semantics are pinned by existing tests, including the
shared-reference mutation semantics of the BSB structured branch (research R5) —
identical outputs, not an "improved" reducer.

### Deferred Refactoring Inventory

| Field | Type | Rules |
|---|---|---|
| module | path | One of the five named follow-ups (FR-013) |
| next candidate seam | string | Responsibility-based, not line-count-based |
| risk class | enum | e.g. orchestration ordering / store pipeline callers / canvas perf |
| deferral reason | string | Why not first delivery |

Recorded in `docs/modularization.md` (research R6).

## First-wave boundary decisions (summary)

The full per-module maps live in the contracts/ files and `docs/modularization.md`;
the authoritative summary:

| Seam | Façade | Extracted (internal) modules | Key invariant |
|---|---|---|---|
| 1 project-editor | `project-editor/index.ts` barrel | `contract`, `identity`, `bsb-widgets`, `snapshot-score`, `snapshot-mixer-orchestra`, `patch-score`, `patch-mixer-bluelive`, `patch-document` | `identity.ts` WeakMap registries are a single instance shared by builders and appliers |
| 2 auxiliary-layout | `auxiliary-layout.ts` barrel | `auxiliary-layout-model`, `auxiliary-layout-migrations`, `workbench-layout-envelope`, `auxiliary-layout-dockview` | Pure model never imports the adapter; migration funnel + envelope codec move as one unit with their tests |
| 3 BlueData | `blue-data.ts` class façade | `blue-data/xml-policy`, `blue-data/csd-policy`, `blue-data/runtime-policy` | Public class API unchanged; policy modules use `import type { BlueData }` (no runtime cycle); sync/async CSD duplication moved verbatim |
| 4 score-object reducer | `ScoreObjectEditorPanel.tsx` re-export | `score-object/score-object-document-reducer.ts` | Verbatim move; BSB shared-reference mutation semantics preserved; no React dependency |

## State transitions

Only one stateful relocation matters: the six module-level WeakMap ID registries
(mixer channel/entry IDs; score-object/layer/pattern/layer-selection IDs) move from
`project-editor.ts` into `identity.ts`. They are process-lifetime caches, not persisted
state; the transition is valid iff exactly one instance exists afterward and both the
snapshot builders and the patch appliers import that instance. ID stability across a
`createProjectEditorSnapshot` → later `resolveTimelineScoreObjects`/patch call is the
acceptance condition, covered by the existing duplicate/stale-ID rejection tests.
