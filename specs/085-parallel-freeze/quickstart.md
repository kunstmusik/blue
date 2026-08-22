# Quickstart: Parallel ScoreObject Freezing

Validation guide for spec [085-parallel-freeze](spec.md). Automated coverage runs
through the injected subprocess seam (no real Csound needed); manual validation
exercises real concurrent renders.

## Prerequisites

- Working tree on branch `085-parallel-freeze`; dependencies installed (`pnpm install`).
- Blue Engine runtime resolvable (real Csound renders in the manual section).
- A **saved** project with several freeze-eligible SoundObjects whose renders take a
  observable amount of time (e.g., 4+ dense Pattern or PianoRoll objects of a minute
  or more).

## Automated validation

```bash
# Settings field: defaults, validation, load normalization, reset, parity matrix
pnpm --filter @blue/app test -- program-settings

# Executor: parallel overlap, cap enforcement, order independence, filename
# uniqueness, hybrid failure handling, cancellation cleanup, cap-1 parity
pnpm --filter @blue/app test -- freeze-score-objects

# Renderer: settings field UI + freeze store concurrent-running rows
pnpm --filter @blue/app test -- settings-window freeze-operation

# Full affected package + main build + lint
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm lint
git diff --check
```

Expected: all listed suites pass; the executor tests assert (via a seam stub that
tracks concurrent unresolved `runCsound` calls) that peak concurrency equals the
configured cap, never exceeds it, and that overlap actually occurs with cap ≥ 2.

## Manual validation

1. **Setting lifecycle**
   - Open Settings → Utility; confirm "Maximum Freeze Jobs" (default 4) beside Freeze Flags.
   - Set 2, save, restart the app; confirm the value persisted.
   - Enter 0 and 33; confirm both block save with a validation error.
   - Reset the Utility panel; confirm the value returns to 4.

2. **Parallel execution (cap 4)**
   - Select 4 eligible objects → Freeze/Unfreeze.
   - Expect: four dialog rows go `running` simultaneously; total wall-clock ≈ one
     render, not four; all rows reach `complete`; each object replaced by `F: <name>`
     with distinct `freezeN` artifacts in the project directory.

3. **Queueing beyond the cap (cap 2)**
   - Set the cap to 2, select 5 objects → Freeze/Unfreeze.
   - Expect: at most two `running` rows at any moment; remaining rows start as
     earlier ones finish; all five freeze successfully.

4. **Cancellation**
   - Start a multi-object freeze; cancel while several rows run.
   - Expect: all rows settle `cancelled`, no score changes, no `freezeN` artifacts
     or `tempCsd*.csd` files left in the project directory.

5. **Per-object failure (drain)**
   - Select several objects where one fails to render (e.g., one whose CSD is broken).
   - Expect: running jobs finish, no replacements are applied, generated artifacts
     are removed, and the failure names the broken object.

6. **Systemic failure (immediate stop)**
   - Temporarily point the Utility Csound runtime at an unavailable engine and freeze.
   - Expect: all jobs stop immediately, no partial state remains.

7. **Sequential parity (cap 1)**
   - Set the cap to 1 and repeat a multi-object freeze.
   - Expect: one row `running` at a time, in selection order, with identical results
     to the previous sequential implementation.

8. **Unfreeze mixed batch**
   - Select a mix of frozen and unfrozen objects → Freeze/Unfreeze.
   - Expect: unfreezes restore sources without waiting on render slots; freezes run
     under the cap; shared-artifact reference counting still protects files
     referenced by other frozen objects.

## Real-render validation record (2026-08-22)

The eight scenarios above were exercised against the production freeze executor
with real Csound 7.0 at `/usr/local/bin/csound`, using the saved
`examples/soundObjects/patternObject.blue` arrangement as the instrument source.
The setting lifecycle was also checked through the settings model and renderer
settings regression. Temporary project directories were removed after each run.

1. **PASS — Setting lifecycle:** default 4, persisted value 2, invalid 0 rejected
   at `utility.freezeMaxJobs`; renderer input regression preserves invalid drafts.
2. **PASS — Cap 4:** four real renders reached peak concurrency 4 and committed
   four frozen objects.
3. **PASS — Cap 2 queueing:** five real renders never exceeded two concurrent
   processes; all five dispatched and committed.
4. **PASS — Cancellation:** cancellation during three dispatched real renders
   left the score unchanged and removed all `freezeN` and `tempCsd*` files.
5. **PASS — Per-object failure:** an invalid CSD stopped new dispatch, drained
   in-flight work, left no replacements, and removed generated files.
6. **PASS — Systemic failure:** `CSOUND_UNAVAILABLE` aborted in-flight work with
   no score mutation or generated-file leftovers.
7. **PASS — Cap 1 parity:** peak concurrency was 1 and dispatch order was
   `freeze0.wav`, `freeze1.wav`, `freeze2.wav`.
8. **PASS — Mixed batch:** two real freezes and one unfreeze completed; the
   unfreeze did not consume a render slot and its referenced artifact was deleted.
