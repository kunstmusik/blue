# Tasks: Large Module Refactoring Foundations

**Input**: Design documents from `/specs/087-refactor-large-files/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Verification**: Verification tasks are constitution-driven. Existing suites are the
behavioral oracle for every extraction: they run per seam (US2 checkpoints T021–T024),
interleaved with implementation so each staged step stays green, plus repository-wide
validation at the end. No extraction step may proceed past a failing checkpoint.

**Organization**: Tasks are grouped by user story. Because US1 (extractions) and US2
(behavior preservation) are two lenses on the same per-seam work, the per-seam US2
checkpoints are executed interleaved (see Dependencies), not strictly after all of US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are repository-relative

---

## Phase 1: Setup

**Purpose**: Record the pre-refactor behavioral baseline (spec edge case: a baseline
failure must be recorded before extraction and never silently attributed to the refactor).

- [X] T001 Run and record the pre-refactor baseline from the repository root: `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`; append per-suite pass/fail results and whether the developer-local Java parity fixtures (`~/work/blue/demo2026`, `~/work/blue/rhythmic`) were available, to specs/087-refactor-large-files/research.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The reusable review rule governs every extraction review in US1/US3; it must
exist before the first seam.

- [X] T002 Create docs/modularization.md with the reusable modularization review rule per spec FR-014 — responsibility cohesion, deliberately small interface, dependency direction, canonical state ownership, compatibility strategy, lowest practical test seam, rollback boundary, and the reject/defer criteria (no split justified by line count alone; no abstraction without a demonstrated consumer or test seam) — with empty placeholders for the first-wave boundary maps and the deferred inventory

**Checkpoint**: Foundation ready — seam work can begin

---

## Phase 3: User Story 1 - Make Domain Responsibilities Easy to Locate (Priority: P1) 🎯

**Goal**: Each of the four first-wave seams gets focused module owners behind an unchanged public façade.

**Independent Test**: From the boundary maps in docs/modularization.md, locate the owner for contracts, pure transformations, persistence, and host/UI integration for each seam without reading the original large file (spec US1 independent test; satisfied together with T029).

**Seam order**: 4 → 3 → 2 → 1 (lowest risk first, per plan.md Structure Decision). Each task leaves the repository green and is its own commit (FR-012).

### Seam 4 - Score-object document reducer

- [X] T003 [US1] Extract the optimistic score-object document reducer verbatim from packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx (helper block and `applyPatchToDocument`, source lines 35–316 and 318–1278) into new packages/blue-app/src/renderer/components/workbench/panels/score-object/score-object-document-reducer.ts; imports per contracts/score-object-reducer.md; preserve the BSB shared-reference mutation semantics exactly — no `structuredClone` purification of the structured branch
- [X] T004 [US1] Update packages/blue-app/src/renderer/components/workbench/panels/ScoreObjectEditorPanel.tsx to import `applyPatchToDocument` from ./score-object/score-object-document-reducer and re-export it as the compatibility façade; the React component, its effects, and store wiring remain unchanged
- [X] T005 [P] [US1] Repoint the five test imports of `applyPatchToDocument` to the new module in packages/blue-app/src/renderer/tests/score-object-editor-panel-tracker-patch.test.ts, score-object-editor-panel-sound-patch.test.ts, jmask-editor-contract.test.tsx, audioclip-score-object-editor.test.tsx, and object-builder-editor-parity.test.tsx

### Seam 3 - BlueData XML/CSD/runtime policy

*(Tasks are sequential: all modify packages/blue-data/src/blue-data.ts.)*

- [X] T006 [US1] Create packages/blue-data/src/blue-data/xml-policy.ts: move `loadFromString` dispatch (incl. legacy in-loader shims and deferred wiring), `saveAsXML` section ordering, `saveToString`, and `pluginDataXml` unknown-data preservation from packages/blue-data/src/blue-data.ts verbatim; preserve raw `renderStartTime/EndTime` field assignment (NOT the invariant-carrying setters), wholesale `pluginDataXml` replacement, the `saveAsXML` `this.version` mutation, and migration-before-deserialization ordering; `BlueData` keeps thin delegates; policy module uses `import type { BlueData }` and runtime imports only of non-back-importing modules
- [X] T007 [US1] Create packages/blue-data/src/blue-data/csd-policy.ts: move the CSD pipeline verbatim — `buildStandardCSD` and `buildStandardCSDAsync` as two parallel functions (no unification), `toCSD*`/`toDiskCSD*`/`toRealtimePlaybackCSD*` internals, `toBlueLiveCSD`, `createAllNotesOffInstrument`, all CSD helpers and free functions (`appendFtgenTableNumbers`), with `CsdRenderProfile`/`RenderCsdResult`; delete the three grep-verified dead functions `registerNestedEffectOpcodes`, `applyOpcodeNameReplacements`, `getBlueLiveAlwaysOnInstrumentId`; `BlueData` keeps one-line delegates
- [X] T008 [US1] Create packages/blue-data/src/blue-data/runtime-policy.ts: move `processOnLoad`/`processOnLoadAsync`/`processLiveDataOnLoad`/`processLiveDataOnLoadAsync`, `usesJavaRuntime`, and the free-function collaborators (`resolveOnLoadSoundObject`, `processSoundObjectOnLoad(Async)`) from blue-data.ts; `BlueData` delegates
- [X] T009 [P] [US1] Verify package-internal visibility: packages/blue-data/src/index.ts gains no exports for the new policy modules and `RenderCsdResult` remains unexported (internal-first clarification, FR-004)

### Seam 2 - Auxiliary workbench layout

*(Tasks are sequential: all carve from packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts.)*

- [X] T010 [US1] Create packages/blue-app/src/renderer/components/workbench/auxiliary-layout-model.ts: model types, seed catalog and classification, pure selectors (presentation/minimized/slideout), pure state-only commands, `createDefaultAuxiliaryLayoutState`/`cloneAuxiliaryLayoutState`, invariant normalization (`normalizeAuxiliaryLayoutState`), and utilities — viewport clamps parameterized with the SSR-safe fallback preserved; no dockview runtime, dnd, or adapter imports
- [X] T011 [US1] Create packages/blue-app/src/renderer/components/workbench/auxiliary-layout-migrations.ts (legacy v2–v4 types, `upgradeV2ToV5`/`V3ToV5`/`V4ToV5`, seed-relocation normalization, stored-shape validators) and packages/blue-app/src/renderer/components/workbench/workbench-layout-envelope.ts (`StoredWorkbenchLayout` v7 codec, `createStoredWorkbenchLayout`, `parseStoredWorkbenchLayout`) preserving the guard funnel v7→v2→bare-dockview→default and degrade-to-default failure behavior
- [X] T012 [US1] Create packages/blue-app/src/renderer/components/workbench/auxiliary-layout-dockview.ts adapter: size capture/restore, drop policy, `buildDefaultWorkbenchLayout`/`applyAuxiliaryLayout`, the transition engine with reconcile/rollback and the `hasActiveTreeDrag` guard, api-coupled commands, mount helpers, and `isAuxiliaryInteractionTarget`; the SPEC 084 contract (only `applied` replaces canonical state) and single-apply-path property are preserved
- [X] T013 [US1] Convert packages/blue-app/src/renderer/components/workbench/auxiliary-layout.ts into a pure re-export barrel over the four new modules (no logic); no consumer or test file changes

### Seam 1 - Shared project-editor

*(Tasks are sequential staged steps; each creates one internal module, updates the barrel, and shrinks the source.)*

- [X] T014 [US1] Create packages/blue-app/src/shared/project-editor/contract.ts (all snapshot/patch/realtime type declarations plus the embedded validators/factories listed in contracts/project-editor-facade.md) and packages/blue-app/src/shared/project-editor/index.ts as the barrel (including the existing `./bsb-widget-keys` re-exports); delete packages/blue-app/src/shared/project-editor.ts so the `.../shared/project-editor` specifier resolves to the index and all 284 consumers compile unchanged
- [X] T015 [US1] Extract packages/blue-app/src/shared/project-editor/identity.ts as the single instance of the six WeakMap ID registries (`MIXER_CHANNEL_IDS`, `MIXER_ENTRY_IDS`, `LAYER_GROUP_ID_MAP`, `SCORE_OBJECT_ID_MAP`, `PATTERN_LAYER_ID_MAP`, `LAYER_SELECTION_ID_MAP`) with their assign/get helpers; no other module may declare a duplicate registry
- [X] T016 [US1] Extract packages/blue-app/src/shared/project-editor/bsb-widgets.ts (BSB widget-tree/preset/serialization helpers, `applyBsbInterfacePatch`, `createWidgetFromSnapshot`, `ensureUniqueName`) importing only contract and identity
- [X] T017 [US1] Extract packages/blue-app/src/shared/project-editor/snapshot-score.ts (bar-renderer helpers, score document/layer/automation builders with `createScoreObjectEditorDocument` moved whole, `createProjectEditorSnapshot` orchestrator and its helper belt) — builders must not import patch modules
- [X] T018 [US1] Extract packages/blue-app/src/shared/project-editor/snapshot-mixer-orchestra.ts (mixer/orchestra/instrument/UDO/transport/properties/BlueLive snapshot builders, `createInstrumentForType`/`createInstrumentFromSnapshot`, `applyInstrumentPatch`, `convertGenericToBsb`, JMask payload builders) — one-way dependency: patch modules may import this, never the reverse
- [X] T019 [US1] Extract packages/blue-app/src/shared/project-editor/patch-score.ts (`applyScoreObjectPatch` moved whole — no decomposition, score/layer/automation/track/pattern appliers, tempo/meter patches and validation)
- [X] T020 [US1] Extract packages/blue-app/src/shared/project-editor/patch-mixer-bluelive.ts (mixer/BlueLive/MIDI patches, `applyEffectEditablePatchToEffect`, arrangement reconciliation, `createNestedPolyObjectSnapshot`) and packages/blue-app/src/shared/project-editor/patch-document.ts (`applyProjectDocumentPatch` orchestrator, `applyProjectUdoPatch`, `snapshotToUdo`, `isEmptyProjectDocumentPatch`)

**Checkpoint**: All four seams extracted behind façades; each seam independently revertible

---

## Phase 4: User Story 2 - Preserve Existing Projects and Workflows (Priority: P1)

**Goal**: Zero unexplained behavior, fixture, or snapshot changes across all four seams.

**Independent Test**: Run the affected suites before and after each extraction (baseline from T001) and the manual end-to-end scenario (T033); compare results — identical outcomes, zero unexplained diffs.

*(Interleaved execution: each checkpoint runs immediately after its seam's US1 tasks and gates the next seam — see Dependencies.)*

- [X] T021 [US2] Seam 4 checkpoint (after T003–T005): run `pnpm --filter @blue/app test -- score-object-editor-panel jmask-editor-contract audioclip-score-object-editor object-builder-editor-parity`; all pass with zero snapshot/fixture changes
- [X] T022 [US2] Seam 3 checkpoint (after T006–T009): run `pnpm --filter @blue/data test -- blue-data`, `pnpm --filter @blue/data test -- track-layer-migration`, `pnpm --filter @blue/data build`, `pnpm --filter @blue/app test`; frozen-roundtrip, CSD determinism/copy-safety/scheduling/automation, and BlueLive suites pass unchanged; where the Java parity fixtures exist locally, `blue-data-csd-parity`/`blue-data-csd-disk` run and pass byte-identically (record skips)
- [X] T023 [US2] Seam 2 checkpoint (after T010–T013): run `pnpm --filter @blue/app test -- workbench-auxiliary workbench-layout-persistence workbench-store auxiliary-slideout`; every migration version (v2–v7 envelope, v5 model), transition/rollback contract, ownership invariant, and 200px Java Blue parity case passes unchanged against the barrel import
- [X] T024 [US2] Seam 1 checkpoints (after each of T014–T020, repeated per step): run `pnpm --filter @blue/app test -- project-editor score-timeline-automation project-store`, `pnpm --filter @blue/app build:main`, `pnpm --filter @blue/app build:preload`; specifically after T015, the duplicate/stale-ID rejection tests must pass — they prove the WeakMap registries remained a single instance
- [X] T025 [US2] After all seams: confirm zero behavioral artifacts changed — `git status` and a diff scoped to fixtures/snapshots show no modifications or additions attributable to the refactor; any diff is investigated against Java Blue and existing fixtures before proceeding (spec edge case)

**Checkpoint**: Behavior preservation proven per seam and across the whole delivery

---

## Phase 5: User Story 3 - Review Incremental Refactors With Confidence (Priority: P1)

**Goal**: Every extraction exposes its assumptions, ownership, compatibility façade, and verification evidence; each seam is independently acceptable or revertible.

**Independent Test**: Inspect the branch history and boundary maps: each seam is a bounded, independently revertible change with documented owner/ façade/ rollback, and verification runnable without unrelated feature work.

- [X] T026 [US3] Verify staging and revertibility per FR-012: `git log --stat` on the branch shows one seam per commit series with mechanical moves unmixed with semantic edits (the only sanctioned semantic edits: the three dead-code deletions in T007 and the test repoints in T005); record the commit-per-seam mapping in docs/modularization.md
- [X] T027 [US3] Verify façade compatibility: the diff for seams 1–3 touches only new internal modules plus the façade files (no consumer edits); the only consumer-file changes on the branch are the five repointed test imports from T005; compiling main/preload/renderer is the completeness proof of the barrel surface
- [X] T028 [US3] Verify dependency direction and acyclicity against the module maps in specs/087-refactor-large-files/contracts/: identity registries exist once (T015); builders never import appliers; blue-data policy modules use `import type { BlueData }`; auxiliary pure modules import no adapter/dockview-runtime/dnd; record the verification result per seam in docs/modularization.md
- [X] T029 [US3] Complete the first-wave boundary maps in docs/modularization.md (FR-002): per seam — public façade, extracted responsibilities, canonical state owner, dependency direction, lowest practical test boundary, rollback boundary; include the seam-4 BSB aliasing caveat (contracts/score-object-reducer.md) and the seam-3 dead-code deletion record

**Checkpoint**: The delivery is auditable seam by seam

---

## Phase 6: User Story 4 - Have a Repeatable Rule for Future Large Modules (Priority: P2)

**Goal**: The modularization rule is durable, discoverable, and demonstrated on the deferred modules.

**Independent Test**: Apply the rule to each deferred module and confirm it yields a responsibility boundary, compatibility strategy, and lowest-level verification target (or a documented retain/defer rationale) — recorded in docs/modularization.md.

- [X] T030 [US4] Record the deferred refactoring inventory in docs/modularization.md for packages/blue-app/src/main/main.ts, packages/blue-app/src/renderer/stores/project-store.ts, the score timeline canvases (packages/blue-app/src/renderer/components/workbench/panels/score/layer-groups/ScoreTimeCanvas.tsx, TrackLayerGroupCanvas.tsx), packages/blue-app/src/main/unified-library/service.ts, and packages/blue-app/src/renderer/stores/workbench-store.ts — each with next candidate seam, risk class, and deferral reason per FR-013 (inputs: research.md R8)
- [X] T031 [US4] Apply the docs/modularization.md review rule to each of the five deferred modules and record the outcome: seams identified and ordered by risk and value, or retained-as-cohesive with rationale, or deferred with the rejected seam (spec US4 scenarios)
- [X] T032 [P] [US4] Add a one-line reference to docs/modularization.md in AGENTS.md (matching the existing docs/typography.md reference pattern)

**Checkpoint**: Future large-module proposals have a durable, discoverable decision rule

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T033 Run the manual end-to-end scenario from specs/087-refactor-large-files/quickstart.md: project with known+unknown data open/edit/save round-trip (tracker, Sound/BSB, audioClip with loop-off clamp); CSD-to-disk diff before/after refactor; auxiliary layout rearrange (dock/minimize/slideout/move/close+restore) + restart restore; legacy layout version restore
- [X] T034 Run repository-wide validation from the repository root: `pnpm test`, `pnpm lint`, `pnpm --filter @blue/app build:main`, `git diff --check`; document any scoped exception with reason and residual risk (FR-015, SC-007)
- [X] T035 [P] Re-validate specs/087-refactor-large-files/checklists/requirements.md and the spec status against the delivered state; update the spec Clarifications section only if implementation surfaced a new decision

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run first; its baseline gates everything.
- **Phase 2 (Foundational)**: Depends on T001. **Blocks all seam work** (the rule governs every extraction).
- **Phase 3 (US1)**: Depends on Phase 2. Seams run in fixed order **4 → 3 → 2 → 1**; within seam 1, steps T014 → T015 → T016 → T017 → T018 → T019 → T020 are strictly sequential (each shrinks the same source and updates the same barrel).
- **Phase 4 (US2)**: **Interleaved, not trailing** — T021 runs after T005 and gates seam 3; T022 after T009 gates seam 2; T023 after T013 gates seam 1; T024 runs after *each* of T014–T020; T025 after all seams.
- **Phase 5 (US3)**: After Phase 3 (+ its interleaved US2 checkpoints); T029 needs all seams extracted.
- **Phase 6 (US4)**: After T029 (maps exist before the rule is applied to the inventory); T030/T031 before T032.
- **Phase 7 (Polish)**: Last; T033–T035 after all prior phases.

### Within Each Seam

- Extract → wire façade → repoint/re-export → run the seam's US2 checkpoint → commit
- Mechanical moves only; the sanctioned exceptions are recorded (T007 deletions, T005 repoints)
- A failing checkpoint stops the next seam, never proceeds around it

### Parallel Opportunities

- T005 (five test files) parallel with T004; T009 independent of other seam-3 edits
- T032 parallel with T030/T031 (different files)
- T035 parallel with T034
- Seams themselves are NOT parallelizable among agents: seams 3, 2, and 1 each carve sequentially from one source file, and seam order is risk-staged
- If multiple contributors are used, the only safe split is: contributor A on seam N while contributor B prepares the seam N+1 boundary-map draft in docs/modularization.md

---

## Implementation Strategy

### MVP First (Setup + Foundational + Seam 4)

1. Complete T001 (baseline) and T002 (rule)
2. Complete seam 4 (T003–T005) + checkpoint T021
3. **STOP and VALIDATE**: the smallest independently valuable increment — the modularization pattern established, proven, and documented for one seam
4. Continue seam 3 → 2 → 1 with interleaved checkpoints

### Incremental Delivery

1. Setup + Foundational → rule exists
2. Seam 4 + T021 → pattern proven (MVP)
3. Seam 3 + T022 → data-package policies behind façade
4. Seam 2 + T023 → layout model/adapter split
5. Seam 1 + T024 → the 11.7k-line module decomposed
6. US3 audit (T026–T029) → US4 rule application (T030–T032) → Polish (T033–T035)

Each seam adds focused ownership without breaking previous seams; every seam boundary is a safe stop point.

---

## Notes

- Existing suites are the behavioral contract; no parallel test suites are written for moved code (research R7)
- The compiler is the façade-completeness oracle for seams 1–3: consumers must compile without modification
- Commit after each task or logical group; one seam = one revertible commit series (FR-012)
- Stop at any checkpoint to validate independently
- Verify no new public exports (internal-first) and no new runtime dependencies at every seam

---

## Phase 8: Convergence

- [X] T036 Create the per-seam commit history per FR-012/SC-004/US3-AC1 (T026): stage and commit the currently uncommitted working tree as four independently revertible commit series in seam order 4 → 3 → 2 → 1, keeping mechanical moves unmixed with semantic edits (sanctioned exceptions only: the T007 dead-code deletions and T005 test repoints) and placing docs/modularization.md, AGENTS.md, and specs/087-refactor-large-files/ with the appropriate seam or a final docs commit; then record the commit-per-seam mapping in docs/modularization.md and replace the placeholder "Staging note" (partial)
- [ ] T037 Execute and record the manual end-to-end scenario from specs/087-refactor-large-files/quickstart.md per US2 independent test (T033): open/edit/save round-trip of a project with known+unknown data (tracker, Sound/BSB, audioClip with loop-off clamp), CSD-to-disk diff before/after the refactor, auxiliary layout rearrange (dock/minimize/slideout/move/close+restore) with restart restore, and legacy layout version restore; record outcomes and any investigated diffs (missing)
- [X] T038 Remove or justify the tracked stale artifact packages/blue-app/src/shared/project-editor.d.ts.map, orphaned by the seam-1 deletion of project-editor.ts, so src/shared/ carries no declaration-map debris for the deleted façade source (unrequested)
