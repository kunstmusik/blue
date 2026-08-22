# Research: Parallel ScoreObject Freezing

Phase 0 findings for spec [085-parallel-freeze](spec.md). Research was performed after merging `develop` into the branch; all file references reflect the merged tree.

## Current architecture (verified against merged code)

- **Entry**: `ScoreTimeCanvas.handleFreezeUnfreeze` sends `window.blueAPI.freezeScoreObjects({ targets, operationId })`; the renderer opens `FreezeOperationDialog`, whose rows come from the `freeze-operation-store` keyed by `selectionId` (`packages/blue-app/src/renderer/stores/freeze-operation-store.ts`).
- **Main handler**: `handleFreezeScoreObjects` in `packages/blue-app/src/main/main.ts:1174` enforces the single-active-operation guard, creates a cancellation signal plus `activeRenderAbortController`, loads program settings, runs project on-load scripts, and calls `executeFreezeUnfreeze` with a status callback, the Csound seam, and a per-item event callback broadcasting on `FREEZE_ITEM_STATUS_CHANNEL`.
- **Executor**: `executeFreezeUnfreeze` in `packages/blue-app/src/main/freeze-score-objects.ts` resolves targets, emits per-item `pending` events, then renders objects **strictly sequentially** in a `for` loop (`freezeOneObject` per object), staging `FrozenSoundObject` replacements, and finally verifies and atomically commits all replacements, emits `complete` events, and reference-count-deletes unfreeze artifacts.
- **Per-object job** (`freezeOneObject`): `buildFreezeRenderData` → `generateDiskCsd` (uses the shared `javaScriptSession` / `javaRuntimeClient`) → `allocateFreezeFileName` (scans the project directory) → temp CSD write → `planFreezeCommand` → seam `runCsound` → artifact inspection (format, duration, channels).
- **Subprocess seam**: `createCsoundExecutionSeam` in `main.ts:922` delegates to `EngineRuntimeService.executeCsound`, which probes the engine runtime and spawns **one engine subprocess per call**; calls are independent of each other (`operationId` is pass-through labeling only). When `trackRenderProcess` is true (freeze and disk render), every call shares `activeRenderAbortController`, so a single `abort()` already cancels **all** in-flight executions — cancellation is parallel-capable today.
- **Java reference**: `FreezeUnfreezeAction` (blue-ui-core) is sequential; Java `UtilitySettings` has only `csoundExecutable` and `freezeFlags`. Parallel freeze and the max-jobs setting are documented divergences.

## Decisions

### D1 — Execution model: sequential prepare, parallel render

**Decision**: Split the per-object work into a sequential **prepare phase** (temporary project construction, CSD generation, freeze-filename allocation, temp CSD write, command planning) and a **parallel render phase** (Csound execution + artifact inspection + `FrozenSoundObject` construction) run through a bounded worker pool of `utility.freezeMaxJobs`.

**Rationale**: Preparation is the only phase touching shared state — the `javaScriptSession` behind `generateDiskCsd` has no established reentrance guarantee, and `allocateFreezeFileName` derives its counter from directory scans, so concurrent allocation would race on names. Rendering is the expensive, CPU-bound phase (minutes per object versus milliseconds for CSD generation) and is naturally independent: each job gets its own temp CSD, its own pre-allocated output filename, and its own engine subprocess. Serializing prepare also makes filename uniqueness structural rather than coordinated (FR-006, FR-011).

**Alternatives considered**: (a) Fully parallel per-job pipeline including preparation — rejected: requires proving script-session reentrance and adding coordinated filename reservation for no measurable gain. (b) Keeping the current loop and only firing `runCsound` promises concurrently — rejected: CSD generation and filename allocation would still interleave unsafely.

### D2 — Concurrency vehicle: promise-based bounded pool in the executor

**Decision**: Implement an internal bounded pool (start up to `maxJobs` jobs, dispatch the next queued job as each finishes) inside `freeze-score-objects.ts`. No new dependency.

**Rationale**: The pool is ~30 lines against the executor's existing callback plumbing; a library (`p-limit`) would add a dependency for behavior the tests must control precisely anyway (overlap observation, dispatch-stop on failure).

**Alternatives considered**: `p-limit` dependency — rejected (unnecessary dependency); a main-process job queue service — rejected (speculates infrastructure beyond the demonstrated need; executor owns sequencing semantics).

### D3 — Failure classification: typed error codes through the seam

**Decision**: Extend `FreezeExecutionSeam.runCsound`'s result with an optional `errorCode` (passing through `EngineRuntimeService.executeCsound`'s existing codes) and classify in the executor:

- **Systemic** (stop dispatch, abort all in-flight via the shared controller): `CSOUND_UNAVAILABLE`, `ENGINE_CAPABILITY_MISSING`, `CSOUND_EXECUTION_INVALID_CWD`, `CSOUND_PROCESS_FAILED`, and an unavailable runtime service — failures of the shared command/environment that no job can survive.
- **Per-object** (stop dispatch, drain in-flight, discard results): nonzero Csound exit, missing/invalid artifact, format/duration inspection failures, and prepare-phase failures for a single object (CSD generation errors).

**Rationale**: `executeCsound` already returns structured `errorCode`s, but the current seam collapses them into `exitCode: -1` + message text, which would force fragile string matching. Passing the code through is a main-internal typed-contract change (constitution principle III). Misconfigured shared freeze flags surface as per-object failures on every job — the operation still fails all-or-nothing; only the stop-early optimization is skipped, matching the user's confirmed hybrid rule ("only kill all if systemic").

**Alternatives considered**: String-matching stderr — rejected (fragile); treating every failure as systemic — rejected (contradicts the confirmed clarification); retrying failed jobs — rejected (out of scope).

### D4 — Cancellation: reuse the existing signal + shared AbortController

**Decision**: Keep the current model unchanged: the executor checks `isCancelled()` before dispatching each job and after each completes; the cancel handler flips the signal and calls `activeRenderAbortController.abort()`, which cancels every in-flight engine execution at once. Cleanup removes all generated artifacts and temp CSDs after the pool settles.

**Rationale**: The merged architecture already provides exactly the fan-out cancellation parallel freeze needs; no new mechanism is required.

**Alternatives considered**: Per-job AbortControllers — rejected: `executeCsound` already keys cancellation to the passed signal, and one controller per operation is the current contract.

### D5 — Aggregate progress: completed-plus-inflight fraction

**Decision**: Overall `rendering`-phase progress = `(completedJobs + Σ inFlightJobProgress/100) / totalJobs`, scaled into the existing 0–90 band; `committing` remains 95 and `completed` 100. Per-item detail continues through `FREEZE_ITEM_STATUS_CHANNEL`, which already drives the dialog rows; the aggregate message reports counts (e.g., "Freezing 2 running, 3 of 6 complete").

**Rationale**: Keeps `RenderOperationStatus` shape-compatible (FR-009), stays order-independent, and monotonic per job. The per-object dialog carries the fine-grained story, so the aggregate number only needs to be honest about overall completion.

**Alternatives considered**: Per-job progress in the aggregate message — rejected (noisy, unbounded); dropping aggregate progress — rejected (breaks existing consumers).

### D6 — Settings: `freezeMaxJobs` on the Utility snapshot

**Decision**: Add `freezeMaxJobs: number` to `UtilitySettingsSnapshot` with constants `FREEZE_MAX_JOBS_DEFAULT = 4`, `FREEZE_MAX_JOBS_MIN = 1`, `FREEZE_MAX_JOBS_MAX = 32`; a `normalizeFreezeMaxJobs` helper used by `mergeWithDefaults` (missing/invalid → 4, non-integers/out-of-range clamped to the range, mirroring the `appZoomPercent` pattern); a `validateProgramSettings` error path `utility.freezeMaxJobs` ("Must be an integer between 1 and 32"); defaults restored by `createDefaultUtilitySettings`; a numeric Utility-panel field (`min`/`max` enforced, `parseInt` fallback like `directoryTempFileLimit`); and a parity-matrix entry marked as a blue-electron extension with no Java counterpart.

**Rationale**: Every behavior follows an established settings pattern in `packages/blue-app/src/shared/program-settings.ts` (bounded numeric setting with load-time normalization plus save-time validation). The executor reads `context.utility.freezeMaxJobs` once at operation start — the `utility` snapshot is already in `FreezeContext`.

**Alternatives considered**: Per-project setting — rejected (spec confirms app-wide); unbounded positive integer — rejected (confirmed clarification: 1–32); a separate "Freeze" settings panel — rejected (confirmed clarification: Utility panel).

### D7 — Renderer: verify, don't change

**Decision**: No renderer protocol or component changes are required. The freeze-operation store keys rows by `selectionId` and the dialog renders each row with its own spinner, so multiple simultaneous `running` rows display correctly by construction. Add a store regression test covering concurrent `running` rows and terminal settling; adjust dialog copy only if testing reveals a single-running-row assumption.

**Rationale**: The merged per-item dialog was built for per-object tracking; parallelism only changes how many rows are `running` at once. FR-009 explicitly requires shape compatibility rather than UI work.

**Alternatives considered**: Adding a concurrency summary to the dialog — optional polish, deferred (not required by spec).

## Open questions resolved during research

- **Can the engine runtime run concurrent Csound executions?** Yes — `executeCsound` is per-call stateless: probe → spawn one engine process → result; nothing keys or serializes on `operationId`. Each parallel freeze job is an independent engine subprocess.
- **Do temp CSD names collide under parallelism?** No — `writeTempCsdSnapshot` names files `tempCsd${Date.now()}${random}.csd`; with preparation serialized this is moot anyway. Bulk cleanup (`cleanupTempCsdSnapshots`) must run after the pool settles, which the two-phase structure guarantees in a `finally`.
- **Does anything else consume `allocateFreezeFileName`?** Only `freezeOneObject`; sequential preparation preserves the Java-compatible counter behavior including gaps and collision advancing.
