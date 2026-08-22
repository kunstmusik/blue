# Feature Specification: Parallel ScoreObject Freezing

**Feature Branch**: `085-parallel-freeze`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Implement parallel freezing so that if a user has selected multiple items to freeze, they will run in parallel. Add a max jobs program setting that defaults to 4."

Freeze/Unfreeze currently renders each selected object one at a time inside a single operation: the second object's render does not start until the first finishes. This feature runs the per-object freeze render jobs concurrently within one freeze operation, bounded by a new app-wide Maximum Freeze Jobs program setting that defaults to 4. All existing freeze guarantees — Java-compatible artifact naming, atomic all-or-nothing replacement, cancellation, and cleanup — are preserved.

## Clarifications

### Session 2026-08-22

- Q: What allowed range should the Maximum Freeze Jobs setting validate (default 4)? → A: Integer 1–32; invalid values are normalized on load and rejected in the settings UI.
- Q: When one freeze render job fails while others are still running, what should happen to the in-flight jobs? → A: Hybrid — systemic failures (e.g., missing executable, unusable shared environment) stop all in-flight jobs immediately; per-object failures stop new job dispatch and let in-flight jobs finish before cleanup.
- Q: Which Program Settings panel should host the Maximum Freeze Jobs setting? → A: Utility panel, alongside the freeze executable and freeze flags.
- Q: (Manual test feedback, 2026-08-22) How should the progress dialog behave when parallel jobs interleave? → A: Two refinements: (1) Focus model — the output console follows one focused row, defaulting to the first object; only a user row click changes focus; item events never move it (the old follow-the-running-row behavior caused the selection to flash across all rows under parallelism). (2) Row completion timing — a `rendered` item phase reports each job finishing its render before the atomic commit, so rows stop showing "Running" while the aggregate status already counts them; `complete` still means committed, and rendered-but-uncommitted rows settle to "Not applied" if the operation fails.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Freeze a Multi-Object Selection in Parallel (Priority: P1)

As a composer, I need freezing several selected ScoreObjects to render them concurrently so that total waiting time shrinks as my machine allows, instead of paying the sum of every render sequentially.

**Why this priority**: This is the core value of the feature; every other story either configures or protects it.

**Independent Test**: In a saved project, select several freeze-eligible objects, invoke Freeze/Unfreeze, and observe (through the progress output or an instrumented execution seam) that multiple renders are in flight simultaneously and that the operation completes with every source replaced by its frozen object.

**Acceptance Scenarios**:

1. **Given** a saved project with four eligible objects selected and Maximum Freeze Jobs set to 4, **When** the user invokes Freeze/Unfreeze, **Then** all four renders run concurrently and the operation completes with four `FrozenSoundObject` replacements satisfying the existing single-object freeze contract (name, channels, duration, start time, nested source).
2. **Given** six eligible objects selected and Maximum Freeze Jobs set to 4, **When** the freeze runs, **Then** at most four renders execute at once and remaining objects start as earlier renders finish, until all six have rendered.
3. **Given** Maximum Freeze Jobs set to 1, **When** multiple objects are frozen, **Then** renders execute one at a time with the same outcomes as the current sequential behavior.
4. **Given** exactly one eligible object selected, **When** the user freezes it, **Then** behavior is unchanged from today.

---

### User Story 2 - Configure Maximum Freeze Jobs (Priority: P1)

As a composer, I need to control how many freeze renders may run at once so I can balance render speed against CPU load on my machine, with a sensible default that works without configuration.

**Why this priority**: The setting is the user-facing control for the feature and must exist for the parallel behavior to be tunable and safe on varied hardware.

**Independent Test**: Open the Utility settings panel, change the Maximum Freeze Jobs value, save, restart the application, freeze a multi-object selection, and verify the configured concurrency is honored.

**Acceptance Scenarios**:

1. **Given** a fresh installation with no saved setting, **When** a multi-object freeze runs, **Then** at most four renders execute concurrently.
2. **Given** the user sets the value to 2 and saves, **When** the application restarts and a multi-object freeze runs, **Then** at most two renders execute concurrently.
3. **Given** an out-of-range value entered in the settings UI (zero, negative, non-integer, or above the allowed maximum), **When** the user saves, **Then** the save is rejected with an actionable validation error.
4. **Given** a settings file that is missing the field or contains an invalid value, **When** settings load, **Then** the application starts without errors using the default of 4.
5. **Given** the Utility panel is reset to defaults, **When** the user views the setting, **Then** it returns to 4.

---

### User Story 3 - Trustworthy Outcomes Under Parallel Execution (Priority: P1)

As a composer, I need parallel freezing to preserve the existing safety guarantees — all-or-nothing replacement, unique artifact files, full cancellation, and no leftover files — so that concurrency never corrupts my project or disk state.

**Why this priority**: Freezing mutates the score and writes project files; users must be able to trust parallel runs exactly as much as sequential ones.

**Independent Test**: Exercise a failing job among passing ones, cancellation mid-run, and a full successful run; verify the project score, freeze artifacts, and temporary files in each case.

**Acceptance Scenarios**:

1. **Given** a parallel freeze in which one object's render fails, **When** the operation settles, **Then** no score changes are committed, every artifact generated by the operation is removed, and the reported error identifies the failed object(s).
2. **Given** a per-object failure with other renders still in flight, **When** the failure is detected, **Then** no new jobs start, running jobs are allowed to finish, and their results are discarded during cleanup.
3. **Given** a systemic failure such as a missing Csound executable, **When** the failure is detected, **Then** all in-flight jobs stop immediately and cleanup proceeds without waiting for remaining renders.
4. **Given** a parallel freeze with several renders in flight, **When** the user cancels, **Then** all in-flight renders stop, no score changes are committed, and no freeze artifacts or temporary render files from the operation remain.
5. **Given** two or more freeze renders running concurrently, **Then** each writes to a distinct `freezeN` artifact; no file is ever overwritten by another job of the same operation.
6. **Given** a parallel freeze that succeeds, **Then** each committed frozen object and artifact satisfies the existing Java-compatible freeze contract exactly as a sequential freeze would.
7. **Given** a selection mixing frozen and unfrozen objects, **When** freeze/unfreeze runs, **Then** unfreezes complete without occupying render-job slots and freezes run under the concurrency cap.

---

### User Story 4 - Follow Overall Progress During a Parallel Freeze (Priority: P2)

As a composer, I need meaningful progress feedback while several renders run at once, so I can tell how far the whole operation has progressed rather than how far a single job is.

**Why this priority**: Feedback keeps long operations usable but is not required for the parallel execution itself to be correct.

**Independent Test**: Freeze a multi-object selection with stubbed renders of known durations and verify the reported progress reflects the whole operation, reaching 100% only at true completion.

**Acceptance Scenarios**:

1. **Given** several concurrent render jobs each reporting progress, **When** statuses are emitted, **Then** the operation reports a single aggregate progress that reflects completion across all jobs and reaches 100% only when the entire operation succeeds.
2. **Given** jobs that finish in a different order than they started, **Then** progress and artifact naming remain correct and independent of completion order.

### Edge Cases

- What happens when Maximum Freeze Jobs exceeds the number of selected objects? All renders start at once; no waiting and no idle job slots are required.
- How does the system handle Maximum Freeze Jobs set to 1? Rendering is sequential, matching current behavior end to end.
- What happens when a job fails while others are still running? Failure classification decides: systemic failures stop all in-flight jobs immediately; per-object failures stop new job dispatch and let in-flight jobs finish. Nothing is committed regardless of which in-flight jobs succeed; generated artifacts are cleaned up either way.
- What happens when cancellation races a job's natural completion? Whichever way the race resolves, the observable outcome is identical: no score changes and no artifacts or temporary files left behind.
- How are artifact filenames kept unique when allocation no longer happens one job at a time? Names for a batch must be assigned so that concurrent jobs can never target the same `freezeN` file.
- What happens with a hand-edited settings file containing an extreme or malformed value? Loading normalizes it to the allowed range or the default rather than starting an excessive number of renders.
- What happens with settings files written by older versions (missing the field) or by newer versions after a downgrade (extra field)? Loading must default or ignore gracefully; the freeze cap remains 4 unless configured.
- What happens if the user invokes Render to Disk or another freeze while a parallel freeze is active? The request is rejected, exactly as today; the single-active-operation rule is unchanged.
- What happens if the project changes while a parallel freeze is preparing? The existing pre-commit verification must still refuse to apply replacements.
- What about per-job preparation that touches shared project state (temporary project construction, CSD generation, shared script runtimes)? Such preparation must either be completed before render dispatch or be safe under concurrency; observable results may not depend on which approach is used.
- What happens when temporary render files are created by concurrent jobs? Each job must use a distinct temporary file, and cleanup must run only after all jobs have settled.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A freeze operation containing multiple eligible non-frozen objects MUST run their freeze render jobs concurrently, with at most Maximum Freeze Jobs renders executing at any moment; additional jobs MUST wait for a free slot. Unfreeze targets MUST NOT occupy render-job slots.
- **FR-002**: The system MUST provide an app-wide Maximum Freeze Jobs program setting in the Utility settings panel alongside the freeze executable and freeze flags. Its default MUST be 4. A suggested storage shape is a new `freezeMaxJobs` integer under the Utility settings snapshot.
- **FR-003**: The setting MUST be validated as an integer in the range 1–32; out-of-range or non-integer values entered in the settings UI MUST block saving with an actionable error. When loading settings that are missing the field or contain an invalid value, the system MUST fall back to the default of 4 without startup errors.
- **FR-004**: Resetting the Utility panel to defaults MUST restore the Maximum Freeze Jobs value to 4.
- **FR-005**: With Maximum Freeze Jobs set to 1, freeze MUST behave equivalently to the current sequential implementation, including identical outcomes and user-visible sequencing.
- **FR-006**: Under any configured concurrency, each freeze render job of an operation MUST write to a distinct Java-compatible `freezeN` artifact; artifact allocation MUST be race-free and MUST never overwrite an existing file, including files created by other jobs of the same operation.
- **FR-007**: Parallel freeze MUST preserve the existing all-or-nothing semantics: no score mutation may occur until every job has succeeded; on any failure the operation MUST report which objects failed, remove all artifacts it generated, and leave the score unchanged.
- **FR-007a**: Failures MUST be classified as systemic or per-object. Systemic failures are those attributable to the shared command or environment — the configured executable cannot be launched, or the shared render environment prevents any job from succeeding — and MUST stop all in-flight jobs immediately. Per-object failures are those attributable to a single object (its temporary CSD generation, render exit, or artifact inspection); they MUST stop dispatch of new jobs while allowing already-running jobs to finish, with their results discarded during cleanup. In both cases the all-or-nothing outcome of FR-007 applies unchanged.
- **FR-008**: Cancellation of a parallel freeze MUST stop all in-flight render jobs, MUST NOT commit any replacements, and MUST remove all artifacts and temporary render files produced by the operation.
- **FR-009**: The operation MUST report a single aggregate progress across all jobs that is independent of job completion order and reaches 100% only on successful completion; the status contract consumed by the renderer MUST remain shape-compatible with the existing render/freeze status events so existing UI continues to function without protocol changes.
- **FR-010**: The single-active-operation invariant MUST be preserved: a parallel freeze remains one operation, mutually exclusive with Render to Disk and other freeze requests.
- **FR-011**: Per-job preparation that reads shared project state or shared script/runtime sessions MUST be either completed before jobs are dispatched or made safe for concurrent use; the implementation MUST NOT introduce nondeterministic failures attributable to concurrent access.
- **FR-012**: Temporary render files created for concurrent jobs MUST be distinct per job, and temporary-file cleanup MUST occur only after all jobs of the operation have settled, including failure and cancellation paths.
- **FR-013**: The existing freeze compatibility contract MUST remain unchanged: Java-compatible artifact naming and formats, `FrozenSoundObject` data contract, unfreeze restoration, reference-counted artifact deletion, mixer extra render time, tempo-aware duration computation, and saved-project requirement.
- **FR-014**: The program-settings usage documentation/parity matrix MUST record the new setting as a blue-electron extension with no Java Blue counterpart, since Java Blue freezes sequentially and offers no equivalent setting.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's `FreezeUnfreezeAction` (blue-ui-core) freezes selected objects strictly sequentially within one progress run, and Java `UtilitySettings` exposes only `csoundExecutable` and `freezeFlags`. The TypeScript port (spec 056) mirrors that sequential behavior and adds staged, atomic commit with artifact cleanup.
- **Compatibility Requirements**: Observable freeze outcomes must remain identical to the sequential implementation for the same inputs — artifact names and formats, frozen-object properties, unfreeze and reference-counted deletion behavior, failure/cancellation guarantees, and the mutual exclusion of render/freeze operations. Existing saved settings files must load unchanged; existing renderer status consumers must keep working.
- **Intentional Divergences**: (1) Concurrent execution of freeze render jobs bounded by an app-wide Maximum Freeze Jobs setting (default 4) — a blue-electron performance extension with no Java Blue counterpart. (2) Aggregate progress across parallel jobs replaces strictly per-object progress text; overall phase semantics (preparing, rendering, inspecting, committing, completed, cancelled, failed) are retained.
- **State Ownership**: The new setting is app-wide program state persisted with the Utility settings snapshot and owned by the main-process settings store. Canonical project mutation during freeze remains owned exclusively by the main-process freeze orchestration; the renderer continues to send only target snapshots and receive status events.

### Key Entities *(include if feature involves data)*

- **Freeze Operation**: One user-invoked freeze/unfreeze over the current selection; remains a single active operation with one identifier, one aggregate progress stream, and one all-or-nothing commit.
- **Freeze Render Job**: The per-object unit of work (temporary project construction, CSD generation, Csound render, artifact inspection); the schedulable unit whose concurrency is capped by the setting.
- **Maximum Freeze Jobs Setting**: An app-wide integer program setting, default 4, validated to the range 1–32, controlling the render-job concurrency cap per freeze operation.
- **Freeze Artifact**: The project-local `freezeN.aif`/`freezeN.wav` file produced by a job; uniqueness of allocation must hold under concurrency.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the cap set to N and at least N renders of equal, controlled duration, freezing N objects completes in approximately the duration of a single render — concurrent execution is observable as overlapping in-flight renders during the operation.
- **SC-002**: A multi-object freeze with more objects than the cap never exceeds the configured number of simultaneous renders, while all objects still freeze by completion.
- **SC-003**: With the cap set to 1, a multi-object freeze produces the same results and sequential execution pattern as the current implementation.
- **SC-004**: Across repeated parallel freeze runs, the operation produces exactly one distinct `freezeN` artifact per frozen object with zero filename collisions or overwritten files.
- **SC-005**: Failure and cancellation of a parallel freeze leave zero score mutations, zero leftover freeze artifacts, and zero leftover temporary render files — matching the sequential implementation's guarantees.
- **SC-006**: The Maximum Freeze Jobs value persists across application restarts, loads as 4 when unset or invalid, and rejects out-of-range values in the settings UI.
- **SC-007**: Users freezing multiple CPU-bound objects wait materially less than the sum of sequential render times at the default setting on a multi-core machine.

## Assumptions

- Parallelism applies within a single freeze operation; running multiple independent freeze or disk-render operations concurrently remains out of scope, and the single-active-operation rule is unchanged.
- Unfreeze requires no rendering and is unaffected beyond completing sooner as part of mixed batches.
- The setting is app-wide (program settings), not per-project; the validation range is 1–32 with default 4 (confirmed clarification, 2026-08-22), a bound chosen to prevent accidental resource exhaustion.
- On failure of any job, the observable outcome is all-or-nothing. In-flight job handling follows the confirmed hybrid strategy: systemic failures kill all in-flight jobs immediately; per-object failures drain them (confirmed clarification, 2026-08-22).
- Csound render subprocesses are independent of each other; shared pre-render resources (temporary project data, CSD generation, script runtimes) are serialized or made concurrency-safe by the implementation.
- The renderer freeze UI (busy state, toast, progress) continues to consume the existing status events unchanged; only message wording and progress aggregation evolve.
- Machines incapable of benefiting from concurrency (single render, cap of 1, or constrained hardware) are handled by the same code path with no special casing beyond the cap.
