# Data Model: Parallel ScoreObject Freezing

Entities and state transitions for spec [085-parallel-freeze](spec.md). No `@blue/data` model changes are involved; every entity below lives in `@blue/app` main-process state, the app-wide settings store, or renderer session state.

## Maximum Freeze Jobs setting

App-wide program setting persisted inside the Utility snapshot of the program-settings JSON.

| Field | Value |
|-------|-------|
| Path | `ProgramSettingsSnapshot.utility.freezeMaxJobs` |
| Type | integer |
| Default | `4` (`FREEZE_MAX_JOBS_DEFAULT`) |
| Allowed range | 1–32 inclusive (`FREEZE_MAX_JOBS_MIN` / `FREEZE_MAX_JOBS_MAX`) |
| Owner | Main-process program-settings store |
| Consumers | Freeze executor (read once per operation via `FreezeContext.utility`); Utility settings panel (editing) |
| Java counterpart | None — blue-electron extension (sequential freeze only in Java Blue) |

**Validation rules**

- `validateProgramSettings` emits an error issue at path `utility.freezeMaxJobs` ("Must be an integer between 1 and 32") for non-integers or out-of-range values; the settings save path blocks on error issues.
- `mergeWithDefaults` normalizes on load: missing, null, non-finite, non-integer, or out-of-range values all resolve to the default 4 (FR-003); the normalization is used in memory and persisted only on the next explicit save.
- `createDefaultUtilitySettings` restores 4; Utility-panel reset uses that creator unchanged.

**Lifecycle**: unchanged program-settings lifecycle (load → merge/normalize → mutate via settings UI → validate → atomic save).

## Freeze render job

The schedulable unit of a freeze operation. One per non-frozen resolved target.

| Field | Source |
|-------|--------|
| `selectionId` / target location | `ScoreObjectEditorTargetSnapshot` |
| source object | resolved `SoundObject` (never mutated; deep-copied into the frozen replacement) |
| prepared command | temp CSD path + planned args + pre-allocated output filename (prepare phase, sequential) |
| events | `FreezeItemStatus` rows on `FREEZE_ITEM_STATUS_CHANNEL`, keyed by `selectionId` |

**State transitions** (per job)

```text
pending ──▶ running ──▶ rendered ──▶ complete   (render staged; committed)
              │
              └───────▶ failed                  (per-object failure; reason recorded)
pending ───────────────▶ failed                 (prepare-phase failure for this object)
pending/running/rendered ─▶ cancelled           (operation cancelled; renderer-settled)
pending/running/rendered ─▶ notApplied          (operation failed after hybrid settle; renderer-settled)
```

`rendered` marks a job whose render finished and staged while the operation is still running (emitted on `FREEZE_ITEM_STATUS_CHANNEL`); `complete` is emitted only after the atomic commit. `cancelled` and `notApplied` are renderer-derived terminal states (main reports the overall phase; the store settles uncommitted rows), exactly as in the store model.

## Failure classification

Executor-internal classification attached to job failures (see [contracts/freeze-parallel-execution.md](contracts/freeze-parallel-execution.md) for the full table):

- **Systemic** — the shared command or environment cannot serve any job (runtime unavailable, engine capability missing, invalid working directory, process launch failure). Effect: stop dispatch and abort all in-flight jobs immediately.
- **Per-object** — the failure is attributable to one object (prepare failure, nonzero render exit, artifact inspection failure). Effect: stop dispatch, drain in-flight jobs, discard their results.

Both classes produce the same observable outcome: no score mutation, all generated artifacts and temp files removed, and rejected targets reporting reasons (all-or-nothing, FR-007).

## Freeze operation (unchanged shape, extended execution)

One user-invoked freeze/unfreeze with a single `operationId`, aggregate `RenderOperationStatus` stream, per-item `FreezeItemStatus` stream, staged replacements, and an atomic commit phase. Execution is now:

```text
resolve targets ─▶ prepare (sequential per freeze job: temp project, CSD,
                    filename allocation, temp CSD, command plan)
                 ─▶ render pool (bounded by freezeMaxJobs: runCsound +
                    artifact inspection + FrozenSoundObject construction)
                 ─▶ verify sources ─▶ atomic commit ─▶ unfreeze cleanup
```

Unfreeze targets stage without preparation and never occupy render-pool slots.

**Aggregate progress** (rendering phase): `(completedJobs + Σ(inFlightJobProgress / 100)) / totalRenderJobs` mapped into 0–90; `committing` = 95; `completed` = 100. Order-independent; 100 only on success.

## Freeze artifact allocation (invariant extension)

`allocateFreezeFileName` semantics are unchanged (scan `freeze*`, highest numeric suffix + 1, advance on collision). Because allocation now happens for all jobs during the sequential prepare phase, one operation's jobs receive pairwise-distinct names by construction, and names never collide with files created earlier in the same operation (FR-006).

## Renderer session state

`freeze-operation-store` rows (`selectionId`, name, action, freezeFile, status, reason, output) keep their shape; row status gains `rendered`. `selectedSelectionId` is the focus owner for the output console: it defaults to the first row and changes only when the user clicks a row — item events never move it (parallel interleaving would otherwise flash the highlight across every row).
