# Research: Large Module Refactoring Foundations

Phase 0 output. Line numbers refer to the branch state at planning time (2026-08-22) and are
orientation aids, not move specifications; the move is defined by symbol.

## R1 — Façade strategy per seam

**Decision**: Façade-first with three shapes matched to each module:
1. `project-editor.ts` remains as a one-line compatibility façade over the internal
   `project-editor/index.ts` barrel. The module specifier and emitted CommonJS file path stay
   unchanged, so all 284 consumer files (13 main-process, preload type-imports, ~100 renderer,
   11 shared siblings, 134 tests) compile without edits and incremental builds cannot resolve a
   stale pre-refactor `dist/shared/project-editor.js` ahead of a directory index.
2. `auxiliary-layout.ts` stays as a file but becomes a pure re-export barrel of the new sibling
   modules (7 runtime consumers + 10 test files unchanged).
3. `blue-data.ts` stays as the aggregate class + façade with thin delegates; policy modules live
   in a new `src/blue-data/` subdirectory and are package-internal.
4. `ScoreObjectEditorPanel.tsx` keeps a re-export of `applyPatchToDocument` after the reducer
   moves to `score-object/score-object-document-reducer.ts`; the five test files that import it
   are repointed to the new module in the same change.

**Rationale**: Every existing import keeps resolving (FR-004); no staged migration needed; the
panel re-export plus repointed tests give both compatibility and a clean canonical home.

**Alternatives considered**: (a) mass-repoint all consumers to new modules — high-churn, violates
the first-delivery compatibility stance; (b) keep everything in one file with section headers —
rejected: does not create testable seams or ownership; (c) delete `project-editor.ts` and rely on
directory-index resolution — rejected after review because `tsc` does not clean `dist`, allowing
the previous CommonJS file to shadow the new directory in an incremental checkout.

## R2 — Seam 1: `shared/project-editor.ts` (11,672 lines)

**Findings**: 250 direct exports plus 4 `bsb-widget-keys` re-exports in three separable clusters,
plus hazards:
- **Contracts** (~124–2525): all snapshot/patch/realtime type declarations + 9 embedded
  validators/factories (`BLUE_LIVE_SOUND_OBJECT_TYPES`, `isValidLayerRange*`,
  `areLayerRangesValid`, `validateLegacyBlueLiveTriggerRequest`, `createBsbRealtimeControlUpdate`,
  `isBsbRealtimeControlUpdate`, `isValidBlueX7Voice/Patch`, `isBlueLiveSoundObjectType`).
  Depends only on `@blue/data` types and 3 type-only sibling imports. Zero-risk extraction.
- **Snapshot builders** (~2527–6762): empty-factories, mixer/bar-renderer/score/orchestra
  builders, `createScoreObjectEditorDocument` (~480 lines), `createProjectEditorSnapshot`
  orchestrator + helper belt, instrument restore + `applyBsbInterfacePatch` (~307 lines).
- **Patch appliers** (~6763–11671): `applyProjectDocumentPatch` orchestrator,
  `applyScoreObjectPatch` (~1,155 lines — largest function), score/layer/automation/track
  appliers, tempo/meter, mixer, BlueLive, arrangement reconciliation.
- **Hazards**: (1) six module-level WeakMap ID registries (`MIXER_CHANNEL_IDS`, `MIXER_ENTRY_IDS`,
  `LAYER_GROUP_ID_MAP`, `SCORE_OBJECT_ID_MAP`, `PATTERN_LAYER_ID_MAP`, `LAYER_SELECTION_ID_MAP`)
  are load-bearing for cross-call ID stability and are used by *both* builders and appliers —
  they must be extracted once into `identity.ts` as the single instance; duplication silently
  breaks patch targeting (guarded today by "rejects duplicate and stale IDs" tests). (2) The
  instrument/BSB cluster (5786–6762) straddles the builder/applier boundary
  (`applyProjectDocumentPatch`'s orchestra branch calls `createInstrumentForType/FromSnapshot`,
  `applyInstrumentPatch`, `convertGenericToBsb`; `createScoreObjectEditorDocument` calls
  instrument builders) — it must live in one module (`bsb-widgets.ts` +
  `snapshot-mixer-orchestra.ts`) with a one-way dependency: appliers → builders, never back.
- **No runtime cycles exist today**: all 11 shared siblings use `import type` only; `@blue/data`
  never imports `project-editor`.

**Decision**: Eight internal modules behind the `index.ts` barrel (see plan.md Project
Structure), staged in risk order: `contract.ts` → `identity.ts` → `bsb-widgets.ts` →
`snapshot-score.ts` + `snapshot-mixer-orchestra.ts` → `patch-score.ts` + `patch-mixer-bluelive.ts`
→ `patch-document.ts`. `applyScoreObjectPatch` and `createScoreObjectEditorDocument` move whole —
no in-move decomposition. The existing re-exports from `./bsb-widget-keys` move to `index.ts`.

**Alternatives considered**: (a) a single `project-editor/parts.ts` split later — rejected:
defeats test-seam goal; (b) splitting `applyScoreObjectPatch` by patch kind during the move —
rejected as a semantic change mixed into a mechanical move (FR-012); (c) extracting the WeakMaps
per-domain into each consumer — rejected: single instance is the correctness requirement.

## R3 — Seam 2: `renderer/components/workbench/auxiliary-layout.ts` (2,543 lines)

**Findings**: Clean pure/adapter divide:
- Pure: model types (state `version: 5`; envelope `StoredWorkbenchLayout` `version: 7`),
  seed catalog + classification, pure selectors (presentation/minimized/slideout), pure state
  commands, invariant normalization (`normalizeAuxiliaryLayoutState`), migration funnel
  (`upgradeV2ToV5`/`V3ToV5`/`V4ToV5`, guards v7→v2→bare-dockview→default, seed relocation),
  envelope codec.
- Adapter (Dockview/DOM): size capture/restore, drop policy, `buildDefaultWorkbenchLayout`,
  `applyAuxiliaryLayout` (destructive rebuild), the transition engine
  (`transitionAuxiliaryLayout` + `reconcileDockedEdges` + rollback, SPEC 084), ten api-coupled
  commands, mount helpers.
- Purity leaks to handle: `clampSlideoutSize`/`clampAuxiliaryDockedSize` read `window`
  (parameterize viewport or keep SSR-guard fallback); `hasActiveTreeDrag` (imports
  `dnd-core` via `tree-dnd-domain`) sits inside `transitionAuxiliaryLayout` — the check moves to
  the adapter layer so the pure model does not drag in dnd; `getPanel`/panel-registry lookups are
  acceptable (leaf module, browser-safe).
- Persistence is *not* in this file: envelope flows through `layout-settings-store` → main
  `window-layout-store.ts` (program settings), with legacy `localStorage` mirror in
  `WorkbenchShell.tsx`. The refactor must not touch that wiring.
- Coverage: `tests/workbench-auxiliary.test.ts` (1,704 lines) covers every migration version,
  transitions, ownership invariants, rollback, and 200px Java Blue parity using a Dockview stub.

**Decision**: Four modules — `auxiliary-layout-model.ts`, `auxiliary-layout-migrations.ts`,
`workbench-layout-envelope.ts`, `auxiliary-layout-dockview.ts` — with `auxiliary-layout.ts` as a
pure re-export barrel (no logic, so no barrel↔adapter cycle). `isAuxiliaryInteractionTarget`
(DOM hit-test) moves to the adapter module. Migrations + envelope codec move together with their
tests as one unit (guard ordering and seed relocation are only safe together).

**Alternatives considered**: (a) moving the pure model to `src/shared/` — rejected for the first
delivery: no main-process consumer, and the move would be a pure relocation with no seam value;
(b) merging envelope codec into migrations — rejected: envelope v7 and auxiliary model v5 are
independent version chains with different responsibilities.

## R4 — Seam 3: `blue-data/src/blue-data.ts` (2,415 lines)

**Findings**:
- Raw-XML migration is *already extracted* (`migration/UpgradeManager.performUpgrades` runs
  before deserialization at line 295). What remains embedded: the load dispatch table (element →
  `X.loadFromXML` incl. legacy shims), save section-ordering policy, and ~1,300 lines of CSD
  pipeline.
- CSD pipeline already operates on clones (`createRenderSnapshot`); helpers read only 5–6 live
  fields via getters — extraction as functions receiving the aggregate is mechanical.
- **Hazards**: (1) `buildStandardCSDAsync` (939–1178) is a near line-for-line duplicate of
  `buildStandardCSD` (693–937) — move both verbatim; unification is a separate fixture-guarded
  change, explicitly out of scope. (2) Raw load assigns `renderStartTime/EndTime` directly while
  the setters carry an invariant (`setRenderStartTime` resets `renderEndTime = -1`) — extracted
  code must preserve raw assignment, not "improve" it to setters. (3) `pluginDataXml` has no
  setter (array replaced wholesale) — keep field-level access or add an internal accessor without
  widening the public API. (4) `saveAsXML` mutates `this.version` — the delegate must keep that.
  (5) Dead code (`registerNestedEffectOpcodes`, `applyOpcodeNameReplacements`,
  `getBlueLiveAlwaysOnInstrumentId` — grep-verified unused) is deleted *while moving*, recorded as
  a deletion, not a refactor.
- Cycle avoidance: policy modules use `import type { BlueData }`; runtime imports only of
  non-back-importing modules. `compile-data.ts` is the safe hub.
- Coverage: `blue-data-root-compatibility`, `blue-data-frozen-roundtrip` (unknown-data round
  trip), `blue-data-csd-{determinism,copy-safety,scheduling,automation,disk,parity}`,
  `blue-live-csd`, `migration/track-layer-migration-integration` (in-repo fixtures). Caveat: the
  two full-output oracles (`~/work/blue/demo2026`, `~/work/blue/rhythmic`) are developer-local
  absolute paths and cover only the sync path — they must be run manually on a machine that has
  them; CI-reliant coverage is structural/in-memory.

**Decision**: Three internal policy modules (`xml-policy.ts`, `csd-policy.ts`,
`runtime-policy.ts`) behind the unchanged `BlueData` class façade; `blue-data.ts` retains fields,
accessors, constructor, `deepCopy`, and remap helpers. First move is delegate-only.

**Alternatives considered**: (a) converting `BlueData` methods to free functions wholesale —
rejected: public API is the class; (b) unifying sync/async CSD pipelines now — rejected: high
drift risk against weak oracles, and FR-012 forbids mixing semantic change into a mechanical
move; (c) also extracting accessors/getter policy — rejected: no demonstrated need (FR-003).

## R5 — Seam 4: score-object document reducer (ScoreObjectEditorPanel.tsx)

**Findings**:
- `applyPatchToDocument` (lines 318–1278, ~961 lines) plus twelve private helpers (lines 35–316,
  automation spec builders, `findBsbWidgetNodeById`, rescale/snap/clamp fns) are reducer-only and
  unused by the React component (1280–1451). No hooks, no store reads, no async; the only
  platform call is `structuredClone`.
- **Load-bearing subtlety**: the structured-branch BSB path shallow-copies
  `{ ...previousInstrument }` then calls the *mutating* `applyBsbInterfacePatchToSnapshot`
  (project-store.ts:2794, ~1,024 lines, store-independent), so nested `widgetTree` nodes of the
  input document are mutated through shared references, and
  `buildSoundAutomationParametersFromSnapshot` reads "previous" through those mutated references.
  Sound-patch tests pin this. The move is verbatim; any "purification" (e.g. `structuredClone`)
  would change rename/rescale results and is a separately specified follow-up.
- `applyBsbInterfacePatchToSnapshot` thematically belongs with patch logic but is also called by
  the store's authoritative instrument pipeline — moving it is part of the `project-store.ts`
  follow-up, not this feature. The extracted reducer keeps importing it from `project-store` in
  the interim.
- Types need no moves: all come from `shared/project-editor.ts` (+ pianoroll types). Five test
  files import `applyPatchToDocument` from the panel — repoint, plus panel re-export.
- Placement per repo convention (pure modules colocated near consumers: `*-utils.ts` beside
  panels, tests in flat `src/renderer/tests/`): renderer-local
  `panels/score-object/score-object-document-reducer.ts` (spec clarification: renderer-local, not
  `@blue/data`, not `src/shared/`).

**Decision**: Verbatim move of lines 35–316 + 318–1278 to the new module; panel re-exports
`applyPatchToDocument`; five test imports repointed; no semantic edits.

**Alternatives considered**: (a) move into `@blue/data` — rejected per spec clarification
(renderer-optimistic semantics stay out of the canonical package); (b) also extract
`applyBsbInterfacePatchToSnapshot` now — rejected: bigger blast radius, belongs to the
project-store seam; (c) purify the BSB aliasing — rejected: behavior change, pinned by tests.

## R6 — Documentation home (deferred clarification from /speckit-clarify)

**Decision**: `docs/modularization.md` holds the reusable review rule (FR-014), the first-wave
boundary maps (FR-002), and the deferred inventory (FR-013); each façade module gets a short
header pointer; AGENTS.md gains a one-line reference (same pattern as `docs/typography.md`).

**Rationale**: AGENTS.md places stable cross-cutting rules in `docs/`; the spec dir is
feature-scoped and historical. A maintainer must find the rule after this branch merges (SC-005).

**Alternatives considered**: specs-only (undiscoverable post-merge), module-header-only
(scattered, no seam-level view).

## R7 — Validation strategy and baseline

**Decision**: Before any extraction, record the baseline: run
`pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`,
and (on a machine with the fixtures) the Java-parity suites. Any pre-existing failure is recorded
and not attributed to the refactor (spec edge case). After each extraction step, rerun the
affected package suite plus the focused seam tests (quickstart.md). New focused tests are added
only where no direct target exists: `identity.ts` ID stability and the envelope codec round-trip
already have indirect coverage — add direct unit tests at those two modules only if extraction
reveals they are the sole guard. Circular-dependency checking: dependency direction is fixed by
the module map and verified by review + type-check; introduce no new lint tooling in this
feature.

**Rationale**: Existing suites are broad and behavior-level (snapshot→patch round trips,
migration funnels, CSD determinism) — the highest-value verification is running them per step,
not writing parallel new suites for moved code.

**Alternatives considered**: snapshot-testing the full export list of façades — useful as a
one-time check during review, not a permanent test; adding `madge`/import-cycle CI tooling —
out of scope, would be a new dependency.

## R8 — Deferred inventory inputs (FR-013)

From research, the next candidate seams for the five deferred modules:
- `main.ts` (5,017): split by main-process responsibility (window lifecycle, IPC registration,
  service wiring) — needs its own contract inventory first; risk: orchestration ordering.
- `project-store.ts` (4,926): `applyBsbInterfacePatchToSnapshot` (~1,024 lines, store-independent)
  plus `shouldPreserveWidgetMetadataForBsbPatch` move together as the first seam; risk: store
  pipeline callers.
- Score timeline canvases (`ScoreTimeCanvas.tsx` 2,119, `TrackLayerGroupCanvas.tsx` 1,586):
  render-cycle state vs pure geometry/painting logic; risk: canvas perf invariants.
- `unified-library/service.ts` (1,870): repository vs project-adapter vs service orchestration.
- `workbench-store.ts` (1,715): thin orchestration over auxiliary-layout; re-evaluate after
  seam 2 lands — the split may already shrink it below threshold.

## T001 — Pre-refactor baseline (2026-08-22)

The required baseline was run from the repository root before any source extraction:

| Command | Result |
|---|---|
| `pnpm --filter @blue/data test` | PASS — 168 test files, 1,651 tests passed |
| `pnpm --filter @blue/app test` | PASS — 361 test files, 3,575 tests passed, 2 skipped |
| `pnpm --filter @blue/app build:main` | PASS |

Developer-local Java parity fixture directories were available at
`/Users/stevenyi/work/blue/demo2026` and `/Users/stevenyi/work/blue/rhythmic`.

## Final automated validation (updated 2026-08-23)

| Command | Result |
|---|---|
| `pnpm --filter @blue/app test project-editor score-timeline-automation project-store` | PASS — focused run: 22 files, 178 tests passed |
| `pnpm --filter @blue/app test score-object-editor-panel jmask-editor-contract audioclip-score-object-editor object-builder-editor-parity` | PASS — focused run: 6 files, 51 tests passed |
| `pnpm --filter @blue/app build:main` | PASS |
| `pnpm --filter @blue/app build:preload` | PASS |
| `pnpm --filter @blue/app build:renderer` | PASS |
| `pnpm test` | PASS with elevated local socket permission; native, data, Java, app, CLI, and script suites passed |
| `pnpm lint` | PASS |
| `git diff --check` | PASS |

The original seam-1 checkpoint command included a literal `--`, so Vitest ran the whole app suite;
its first attempt had one nondeterministic performance-threshold miss in
`src/main/unified-library/performance.test.ts`. The corrected focused command above passed. The
initial workspace-wide test attempt was blocked only by sandbox socket permissions and passed when
rerun with local socket binding permitted. The focused TrackerObject and score-object editor
regression follow-up was manually checked on 2026-08-23 and passed; the broader interactive
manual scenario in T033 remains open because its CSD, auxiliary-layout, and legacy-layout steps
were not part of that focused pass.
