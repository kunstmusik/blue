---
description: "Task list for feature implementation"
---

# Tasks: Parallel ScoreObject Freezing

**Input**: Design documents from `/specs/085-parallel-freeze/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Verification**: Include the regression, serialization, contract, runtime, UI, cross-platform
host-path, and quickstart tasks required by the constitution and plan. A behavior or data change
cannot omit verification merely because the feature specification does not request TDD.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Establish a green baseline in the worktree before any change

- [x] T001 Run the existing freeze and settings suites to confirm a green baseline in the worktree: `pnpm --filter @blue/app test -- freeze-score-objects program-settings` (all pass before any edit)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared settings schema and seam contract that every user story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Add the `freezeMaxJobs` setting to `packages/blue-app/src/shared/program-settings.ts` per [contracts/freeze-max-jobs-setting.md](contracts/freeze-max-jobs-setting.md): constants `FREEZE_MAX_JOBS_DEFAULT = 4`, `FREEZE_MAX_JOBS_MIN = 1`, `FREEZE_MAX_JOBS_MAX = 32`; field on `UtilitySettingsSnapshot`; default from `createDefaultUtilitySettings`; `normalizeFreezeMaxJobs` wired into `mergeWithDefaults` (missing/invalid → 4, clamp 1–32); `validateProgramSettings` error issue at path `utility.freezeMaxJobs`
- [x] T003 [P] Add settings regressions in `packages/blue-app/src/shared/program-settings.test.ts`: default is 4 on fresh defaults; load-merge normalization for missing, non-integer, below-1, above-32; validation errors for 0, 33, 1.5; Utility-panel reset restores 4; saved valid values persist through the merge unchanged
- [x] T004 [P] Extend the Csound seam result in `packages/blue-app/src/main/main.ts` (`createCsoundExecutionSeam`) with an optional pass-through `errorCode` from `EngineRuntimeService.executeCsound` results, and mirror the optional `errorCode?: string | null` on `FreezeExecutionSeam.runCsound` in `packages/blue-app/src/main/freeze-score-objects.ts` per [contracts/freeze-parallel-execution.md](contracts/freeze-parallel-execution.md) — additive only, existing callers unchanged

**Checkpoint**: Foundation ready — `pnpm --filter @blue/app test -- program-settings` passes; executor still sequential but seam carries typed failure codes

---

## Phase 3: User Story 1 - Freeze a Multi-Object Selection in Parallel (Priority: P1) 🎯 MVP

**Goal**: Freeze render jobs for a multi-object selection run concurrently, bounded by `utility.freezeMaxJobs`, with queueing, unique artifacts, and unchanged outcomes

**Independent Test**: With a seam stub tracking unresolved `runCsound` calls, freezing N objects at cap N shows N overlapping calls and completes with N `FrozenSoundObject` replacements and N distinct `freezeN` artifacts

### Verification for User Story 1

> NOTE: These tests assert the NEW parallel behavior; they must fail against the current sequential executor (write them first).

- [x] T005 [P] [US1] Add overlap/cap test in `packages/blue-app/src/main/freeze-score-objects.test.ts`: 4 targets with `freezeMaxJobs: 4` → peak concurrent unresolved `runCsound` calls equals 4; all four freeze successfully with correct frozen objects
- [x] T006 [P] [US1] Add queueing and order-independence tests in `packages/blue-app/src/main/freeze-score-objects.test.ts`: 6 targets cap 4 → concurrency never exceeds 4 and all complete; completion order differing from dispatch order yields identical staged results and filenames
- [x] T007 [P] [US1] Add filename-uniqueness regression in `packages/blue-app/src/main/freeze-score-objects.test.ts`: N parallel jobs produce N pairwise-distinct `freezeN` names; no path is written twice (stub records output paths)
- [x] T008 [P] [US1] Add parity tests in `packages/blue-app/src/main/freeze-score-objects.test.ts`: `freezeMaxJobs: 1` dispatches strictly one-at-a-time in input order with results equal to the pre-change sequential behavior; a single target behaves exactly as before
- [x] T009 [P] [US1] Add mixed-selection test in `packages/blue-app/src/main/freeze-score-objects.test.ts`: a selection mixing frozen and unfrozen objects stages unfreezes without any `runCsound` call for them; freezes run under the cap

### Implementation for User Story 1

- [x] T010 [US1] Restructure `executeFreezeUnfreeze` in `packages/blue-app/src/main/freeze-score-objects.ts` into the two-phase model of [contracts/freeze-parallel-execution.md](contracts/freeze-parallel-execution.md): sequential prepare per freeze target (`buildFreezeRenderData` → `generateDiskCsd` → `allocateFreezeFileName` → `writeTempCsdSnapshot` → `planFreezeCommand`; a prepare failure rejects that target only), then a bounded promise pool (`min(freezeMaxJobs, pending jobs)`, defensively ≥ 1) running render + artifact inspection + `FrozenSoundObject` construction per job; keep the existing staging, source verification, atomic commit, and unfreeze reference-counted cleanup unchanged
- [x] T011 [US1] Keep per-item `FreezeItemStatus` events correct under parallel dispatch in `packages/blue-app/src/main/freeze-score-objects.ts`: `pending` at resolve, `running` with `freezeFile` at job dispatch, `failed` with reason per failed target, `complete` after commit — keyed by `selectionId`, independent of completion order

**Checkpoint**: Multi-object freeze runs in parallel; `pnpm --filter @blue/app test -- freeze-score-objects` passes; sequential parity at cap 1 verified

---

## Phase 4: User Story 2 - Configure Maximum Freeze Jobs (Priority: P1)

**Goal**: Users view, edit, persist, and reset the freeze concurrency cap in the Utility settings panel with validation and safe loading

**Independent Test**: Open Settings → Utility, change the value, save, restart, and freeze a multi-object selection — the configured concurrency is honored; invalid input blocks save

### Verification for User Story 2

- [x] T012 [P] [US2] Add settings-window regressions in `packages/blue-app/src/renderer/tests/settings-window.test.tsx`: the Utility panel renders the numeric field with default 4; editing flows through the panel `set` path; out-of-range input surfaces the `utility.freezeMaxJobs` validation error and blocks save; panel reset restores 4

### Implementation for User Story 2

- [x] T013 [US2] Add the "Maximum Freeze Jobs" numeric field to `packages/blue-app/src/renderer/components/settings/UtilitySettings.tsx` beside Freeze Flags: min 1, max 32, `parseInt` with fallback to the current valid value (pattern of `directoryTempFileLimit` in `GeneralSettings.tsx`), description stating it caps concurrent freeze renders; use only approved semantic typography roles per `docs/typography.md`
- [x] T014 [P] [US2] Record the setting in the parity matrix in `packages/blue-app/src/main/program-settings-usage.ts` and its test `packages/blue-app/src/main/program-settings-usage.test.ts`: `utility.freezeMaxJobs`, default 4, blue-electron extension with no Java counterpart, consumer path `freeze-score-objects.ts`

**Checkpoint**: The setting is configurable, validated, persisted, reset-able, and documented as an intentional divergence

---

## Phase 5: User Story 3 - Trustworthy Outcomes Under Parallel Execution (Priority: P1)

**Goal**: Hybrid failure handling (systemic aborts all, per-object drains) and cancellation preserve all-or-nothing semantics with zero leftovers under parallelism

**Independent Test**: Stub one failing job among passing ones, a systemic engine failure, and a mid-run cancel — in every case: no score mutation, no `freezeN` or `tempCsd*` leftovers, and the error names the failed objects

### Verification for User Story 3

> NOTE: Write these tests against the intended classification before implementing it; systemic-vs-drain must be distinguishable through the stub.

- [x] T015 [P] [US3] Add per-object-failure regression in `packages/blue-app/src/main/freeze-score-objects.test.ts`: one job exits nonzero → no new jobs dispatched, in-flight jobs run to completion, their staged artifacts discarded, zero score mutations, artifacts and temp CSDs removed, rejected target named with reason
- [x] T016 [P] [US3] Add systemic-failure regression in `packages/blue-app/src/main/freeze-score-objects.test.ts`: seam returns `errorCode: 'CSOUND_UNAVAILABLE'` → all in-flight jobs aborted immediately (not drained), cleanup runs, operation fails with the runtime error and no mutations
- [x] T017 [P] [US3] Add parallel-cancellation regression in `packages/blue-app/src/main/freeze-score-objects.test.ts`: cancel while several jobs run → `cancelled` result, all jobs settle, zero freeze artifacts and zero temp CSD snapshots remain

### Implementation for User Story 3

- [x] T018 [US3] Implement failure classification in `packages/blue-app/src/main/freeze-score-objects.ts` per [contracts/freeze-parallel-execution.md](contracts/freeze-parallel-execution.md): systemic set = seam `errorCode` ∈ {`CSOUND_UNAVAILABLE`, `ENGINE_CAPABILITY_MISSING`, `CSOUND_EXECUTION_INVALID_CWD`, `CSOUND_PROCESS_FAILED`} or unavailable runtime; everything else per-object. Systemic: set an internal flag, invoke the abort hook, map aborted jobs to the systemic failure (not user-cancel); per-object: stop dispatch, drain, discard
- [x] T019 [US3] Add `abortInFlight?: () => void` to `FreezeContext` in `packages/blue-app/src/main/freeze-score-objects.ts` and wire it in `handleFreezeScoreObjects` in `packages/blue-app/src/main/main.ts` to `activeRenderAbortController.abort()` — leaving `activeRenderCancellationSignal` untouched so a systemic abort is not misreported as user cancellation
- [x] T020 [US3] Harden cleanup for the parallel paths in `packages/blue-app/src/main/freeze-score-objects.ts`: `removeGeneratedArtifacts` covers every staged artifact including drained-then-discarded jobs; `cleanupTempCsdSnapshots` runs after the pool settles on success, failure, and cancellation paths

**Checkpoint**: All safety guarantees hold under parallelism; the three failure/cancel suites pass

---

## Phase 6: User Story 4 - Follow Overall Progress During a Parallel Freeze (Priority: P2)

**Goal**: One aggregate progress value reflects whole-operation completion regardless of job order, and the existing renderer dialog handles concurrent running rows

**Independent Test**: Stub jobs with known progress curves — aggregate progress is order-independent, monotonic in aggregate, and reaches 100% only on success; the store tracks concurrent running rows independently

### Verification for User Story 4

- [x] T021 [P] [US4] Add aggregate-progress tests in `packages/blue-app/src/main/freeze-score-objects.test.ts`: rendering-phase progress equals `(completed + Σ inflight/100) / total` scaled to 0–90; order-independent under shuffled completion; 95 at committing; 100 only on completed
- [x] T022 [P] [US4] Add a concurrent-rows regression in `packages/blue-app/src/renderer/tests/freeze-operation-dialog.test.tsx` (exercising `packages/blue-app/src/renderer/stores/freeze-operation-store.ts`): several `running` rows with interleaved `outputAppend` chunks stay independent per `selectionId`; terminal settle maps unfinished rows to `cancelled`/`notApplied` correctly after a failed parallel operation

### Implementation for User Story 4

- [x] T023 [US4] Implement the aggregate progress formula and count-based rendering messages (running/complete/total) in `packages/blue-app/src/main/freeze-score-objects.ts`, keeping `RenderOperationStatus` shape-compatible — no changes to `packages/blue-app/src/shared/render-freeze-contract.ts` or preload

**Checkpoint**: Progress is trustworthy under parallelism with no renderer protocol change

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Repository-wide validation and end-to-end confirmation

- [x] T024 Run the full validation battery from the repository root: `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build:main`, `pnpm lint`, `git diff --check`
- [X] T025 Execute the manual validation in [quickstart.md](quickstart.md) sections 1–8 (setting lifecycle, parallel cap 4, queueing cap 2, cancellation, per-object failure, systemic failure, cap-1 parity, mixed unfreeze batch) and record results

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Phase 2
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2 — no story dependencies (MVP)
- **User Story 2 (P1)**: After Phase 2 — independent of US1; different files, can proceed in parallel with US1
- **User Story 3 (P1)**: After **US1** — builds on the render pool inside the same file (`freeze-score-objects.ts`); do not start the US3 implementation before T010 lands
- **User Story 4 (P2)**: After **US1** — replaces the pool's progress reporting in the same file; T022 (renderer store test) is independent and can run anytime after Phase 2

### Within Each User Story

- Constitution-required regressions accompany every behavior change (verification tasks precede implementation tasks; parallel-behavior tests must fail against the sequential executor first)
- Contracts (T002, T004) before executor work (T010)
- Executor restructure (T010) before event polish (T011), failure handling (T018–T020), and progress (T023)
- Story complete and tested before moving to the next priority

### Parallel Opportunities

- T002, T003, T004 are mutually parallel (different files)
- T005–T009 test tasks are mutually parallel (same test file but additive cases — coordinate or land sequentially if conflicting)
- T012/T014 (US2) parallel with any US1 task after Phase 2
- T022 (renderer store test) parallel with US3 implementation
- US2 as a whole can proceed in parallel with US1/US3/US4 (no shared files beyond Phase 2 outputs)

---

## Parallel Example: User Story 1

```bash
# After Phase 2, launch the independent verification tasks together:
Task T005: "Overlap/cap test in freeze-score-objects.test.ts"
Task T007: "Filename-uniqueness regression in freeze-score-objects.test.ts"
Task T012: "Settings-window regressions in settings-window.test.tsx"   # US2, independent

# Then implement:
Task T010: "Two-phase executor restructure in freeze-score-objects.ts" (depends on T005–T009 expectations)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup baseline
2. Complete Phase 2: Foundational settings field + seam error codes
3. Complete Phase 3: User Story 1 (parallel execution)
4. **STOP and VALIDATE**: `pnpm --filter @blue/app test -- freeze-score-objects program-settings`; parallel freeze works with the default cap 4
5. Ship-able MVP: parallel freezing at the default cap

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → parallel freeze works (MVP)
3. Add US2 → configurable cap with validation and persistence
4. Add US3 → hybrid failure handling and parallel-safe cancellation
5. Add US4 → aggregate progress; then Polish (T024–T025) closes the feature

### Parallel Team Strategy

1. Complete Setup + Foundational together
2. Then: Developer A → US1 → US3 → US4 (shared executor file, strictly ordered); Developer B → US2 (settings UI + parity matrix) in parallel
3. T022 can be picked up independently once Phase 2 lands

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1/US3/US4 all modify `packages/blue-app/src/main/freeze-score-objects.ts` — order them US1 → US3 → US4
- Parallel-behavior tests (T005–T009, T015–T017) must fail before their implementation lands; keep that red→green evidence in the commit history
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently

---

## Phase 8: Convergence

- [X] T026 Preserve invalid Maximum Freeze Jobs drafts through the Utility settings UI so zero, fractional, and malformed values reach validation and block saving with the actionable `utility.freezeMaxJobs` error per FR-003 (partial)
- [X] T027 Track every generated freeze artifact through post-render inspection and FrozenSoundObject construction failures so FR-007 and FR-012 cleanup removes it on every failure path (partial)
- [X] T028 Remove completed jobs from the aggregate progress in-flight map before reporting rendering status so FR-009 and SC-001–SC-003 cannot double-count completed work (partial)
- [X] T029 Execute and record the eight real-render validation scenarios in [quickstart.md](quickstart.md) for T025: setting lifecycle, cap-4 parallelism, cap-2 queueing, cancellation, per-object failure, systemic failure, cap-1 parity, and mixed unfreeze (missing)

## Phase 9: Convergence

- [X] T030 [US4] Preserve monotonic aggregate progress across `rendering` and interleaved `inspecting` status events in `packages/blue-app/src/main/freeze-score-objects.ts`; add a regression in `packages/blue-app/src/main/freeze-score-objects.test.ts` that checks the complete status stream never decreases before commit (partial)
