# Quickstart Validation: Java Blue Live Trigger Parity

## Prerequisites

- Node.js and pnpm versions supported by the repository
- Workspace dependencies installed
- Built/staged Blue Engine and a supported Csound installation for manual audio validation
- Java 17+ and the packaged Java helper for Jython/Clojure validation
- Representative Java-authored `.blue` fixtures, including sparse bins, saved sets with missing IDs, native score objects, and runtime-backed score objects

## 1. Focused Automated Validation

From `/Users/stevenyi/work/blue-electron`:

```bash
pnpm --filter @blue/data test
pnpm --filter @blue/app test
pnpm --filter @blue/data build
pnpm --filter @blue/app build
git diff --check
```

Expected:

- Selected and enabled target tests reproduce Java target membership.
- p2/p3 scaling fixtures match `60 / tempo`.
- Aggregate copy tests prove no canonical alias and correct copied `Instance` references.
- Native and fake Java/JavaScript runtime tests cover async success and failure.
- Patch flush, no-op receipt, lifecycle, stale fence, IPC, renderer, and engine submission tests pass.
- Static builds preserve package boundaries and forbidden-import constraints.

## 2. Selected-Cell Trigger

1. Open a project with at least two populated Live Space cells.
2. Disable the cell to be selected and enable another cell.
3. Start Blue Live.
4. Select the disabled populated cell.
5. Press Command/Ctrl+T.

Expected:

- Only the selected cell’s generated score is submitted.
- The cell remains disabled.
- The project does not become dirty from the trigger.
- Repeating the action produces the same canonical project serialization for deterministic content.

## 3. Enabled-Batch Trigger

1. Enable several cells in different rows and columns, including more than one cell in a row or column.
2. Leave another populated cell disabled.
3. Press Trigger, then repeat with Command/Ctrl+Shift+T.

Expected:

- Every enabled cell and no disabled cell contributes to one submitted batch.
- No row/column exclusivity is imposed.
- Enabled colors remain authoring state; they do not claim that a clip is playing.
- An empty enabled mask returns benign no-op feedback and sends no engine event.

## 4. Tempo Scaling

1. Use a fixture whose generated notes have known p2/p3 values.
2. Set Blue Live tempo to 120 and trigger.
3. Set Blue Live tempo to 30 and trigger again.

Expected:

- At 120, p2/p3 values are multiplied by `0.5`.
- At 30, p2/p3 values are multiplied by `2`.
- Other generated p-fields are unchanged.
- Invalid or zero tempo is rejected without engine submission.

## 5. Pending-Edit Barrier

1. Toggle an enabled cell or change Blue Live tempo.
2. Immediately press Trigger before the normal 100 ms patch delay.
3. Change a compile-affecting project value and immediately press Start or Recompile.

Expected:

- Each action waits for the pending commit.
- Trigger uses the new enabled mask/tempo.
- Start/recompile uses the newly acknowledged project.
- Simulated commit failure blocks the live command and restores the canonical snapshot.

## 6. Session and Project Fencing

1. Use a deliberately slow fake/runtime-backed LiveObject and begin Trigger.
2. Before preparation finishes, Stop Blue Live.
3. Repeat while choosing Recompile.
4. Repeat while closing the project and opening another project.

Expected:

- No prepared result from the old session is submitted.
- The replacement session/project receives no old score event.
- The result reports a stale session/document rather than an unhandled error.
- A session still in `starting` is stopped before project replacement completes.

## 7. Runtime-Backed Objects

1. With Java available, trigger representative Jython and Clojure LiveObjects.
2. Trigger a JavaScript LiveObject through the existing JavaScript session.
3. Repeat with Java unavailable or with a fixture containing a runtime syntax error.

Expected:

- Available runtime-backed objects prepare asynchronously and submit to the originating Blue Live session.
- Unavailable/syntax-failed objects return specific recoverable diagnostics.
- An enabled batch containing a failed member submits no partial batch.
- The engine and project remain usable after failure.

## 8. XML and Saved-Set Preservation

1. Open Java-authored fixtures with sparse bins, key/MIDI trigger values, Repeat values, Live Code, and saved sets containing missing IDs.
2. Apply each saved set.
3. Perform selected and enabled Manual Triggers.
4. Save and reopen.

Expected:

- Existing set members update enabled flags; missing IDs are ignored safely.
- Applying a set does not trigger sound.
- Repeat/key/MIDI values are preserved but do not acquire audible behavior.
- Covered modeled values and unknown XML remain preserved.
- No tracks, scenes, or launcher data are inferred or written.

## 9. Concurrent Engine Isolation

1. Start realtime playback.
2. Start Blue Live.
3. Trigger selected and enabled Live Space material.
4. Recompile and stop Blue Live.

Expected:

- Trigger score is sent only to the Blue Live engine.
- Realtime playback continues and receives no Blue Live trigger/stop/recompile command.
- Blue Live output remains in its distinct output context.

## 10. Repeat Scope Check

1. Load a project with `repeatEnabled=true` and a non-default Repeat value.
2. Start Blue Live and wait several repeat intervals without pressing Trigger.

Expected:

- No automatic repeat scheduling is introduced by this feature.
- The UI states that audible Repeat is deferred.
- The stored Repeat values survive save/reopen.

## 11. Java-Compatible Live Cell Menu

1. Open a Live Space with at least two rows and two columns.
2. Right-click an empty cell and a populated cell.
3. Compare menu order and separators with Java Blue.
4. Insert before and after the clicked row and column, then remove the clicked row and column.
5. Reduce one dimension to one and reopen the menu.

Expected:

- The menu contains all 11 commands in Java order.
- Remove/Cut/Copy follow cell occupancy; final-row/final-column removal is disabled.
- Every structural operation is relative to the clicked cell.
- The old six-button row/column strip is absent.

## 12. Score and Blue Live Shared Buffer

1. Copy one Java-live-compatible SoundObject on the Score timeline.
2. Right-click an empty Live Space cell and paste.
3. Copy the new Live Space cell and paste it twice onto compatible Score layers.
4. Cut the Live Space cell and verify the buffer remains pasteable.
5. Repeat with multiple Score selections and an unsupported or AudioClip selection.

Expected:

- Single compatible SoundObjects move in both directions with preserved XML content.
- Blue Live paste starts at beat zero and creates a fresh LiveObject identity.
- Repeated Score pastes are independent of the source and each other.
- Multi-object and incompatible payloads leave Blue Live Paste disabled.

## 13. Paste BSB As Sound

1. Copy a BlueSynthBuilder assignment in Orchestra.
2. Right-click an empty position on a compatible Score sound layer.
3. Choose Paste BSB As Sound.
4. Repeat after copying a non-BSB instrument and on an incompatible audio layer.

Expected:

- The BSB action is enabled only for the BlueSynthBuilder buffer.
- A new Sound appears at the snapped time with a deep copy of the BSB.
- Embedded automation is disabled and flattened to current constant values.
- Non-BSB and incompatible targets make no project change.
- Copying or pasting BSB canvas widgets remains independent of the whole-Instrument buffer.

## Validation Results (2026-07-31)

### Focused Automated Validation

All automated validation gates pass:

- `pnpm --filter @blue/data test` — 1349 tests pass (140 files).
- `pnpm --filter @blue/app test` — 2,345 tests pass, 2 skipped (240 files).
- `pnpm --filter @blue/data build` — succeeds.
- `pnpm --filter @blue/app build` — succeeds.
- `pnpm test` — succeeds across all workspace projects.
- `pnpm lint` — succeeds across all configured workspace linters.
- `git diff --check` — clean (no whitespace errors).

### Automated Deterministic Results

- **Selected-cell trigger**: targets exactly one populated cell by stable
  `uniqueId`, regardless of its persistent `enabled` flag. The cell remains
  disabled and the project does not become dirty. (Covered by
  `blue-live-trigger.test.ts` and `blue-live-trigger-controller.test.ts`.)
- **Enabled-batch trigger**: targets every non-null enabled cell in
  column-major order with no row/column exclusivity, submitted as one score
  batch. An empty enabled mask returns benign `empty` feedback and sends no
  engine event. (Covered by target-selection and controller tests.)
- **Tempo scaling**: generated p2/p3 values are multiplied by exactly
  `60 / tempo` at tempi 60, 120, 30, and 90; other p-fields are preserved.
  Invalid/zero/non-finite tempo is rejected without engine submission.
  (Covered by `TEMPO_SCALING_CASES` in `blue-live-trigger.test.ts`.)
- **Immutable preparation**: trigger-only workflows do not change canonical
  serialization; copied `TimeBehavior` is overridden to `NONE` on the isolated
  copy without mutating the authored value. (Covered by deep-copy isolation
  and canonical-serialization tests.)
- **Patch barrier**: Start, Recompile, and Trigger await
  `flushPendingPatches()`; a failed commit rejects the barrier so the live
  command does not proceed with stale state. (Covered by toolbar and
  controller tests.)
- **Stale-work fencing**: across 100 rapid trigger cycles and 100
  stop/recompile cycles, every command uses the latest acknowledged state and
  zero obsolete events reach a stopped or replacement session. (Covered by the
  SC-003/SC-004 stress tests in `blue-live-trigger-controller.test.ts`.)
- **Legacy preservation**: the Java-authored `examples/features/blueLiveMidi.blue`
  fixture retains its covered command-line and key/MIDI values through
  load/save and trigger-only preparation. Modeled sparse-bin, Repeat, Live
  Code, saved-set missing-ID, and unknown plugin-data preservation are covered
  by the focused XML suites; applying a saved set only updates the enabled mask
  and does not trigger sound.
- **Session isolation**: realtime and Blue Live use distinct shared-memory
  names, control/pub endpoints, and process records; process cleanup for one
  session does not select the other. Prepared score submission is accepted
  only by the injected Blue Live session boundary. (Covered by
  `engine-concurrency.test.ts`, `blue-live-engine.test.ts`, and controller
  submission tests.)
- **Deferred Repeat**: no automatic Repeat scheduling is introduced; the UI
  marks audible Repeat as deferred while preserving stored values.

### Authoring-Parity Validation

- Focused Blue Live, Score clipboard, BSB-to-Score, and unified-library
  regressions are included in the passing full app suite.
- Full `@blue/app` suite: **240 files passed; 2,345 tests passed; 2 skipped**.
- Full `@blue/data` suite: **140 files passed; 1,349 tests passed**.
- `pnpm --filter @blue/app build`: **passed**, including staged engine/runtime,
  data/client, Electron main/preload, and renderer production builds.
- `pnpm --filter @blue/data build`: **passed** for ESM and CJS outputs.
- `git diff --check`: **passed**.
- SC-009: the renderer regression verifies all 11 Java menu commands in exact
  order with three separators, the six legacy controls absent, and target,
  buffer, and minimum-grid enablement.
- SC-010: regression coverage verifies Score-to-Live and Live-to-Score
  compatibility, unsupported/multi-object rejection, independent repeated
  pastes, BSB widget-buffer isolation, and validated BlueSynthBuilder-to-Sound
  conversion with constant automation endpoints and source independence.

### Live SoundObject Editor Validation

- Focused Blue Live selection, editor, Properties, and project-store
  regressions are included in the passing full app suite.
- Full `@blue/app` suite after final convergence:
  **240 files passed; 2,345 tests passed; 2 skipped**.
- `pnpm --filter @blue/app build`: **passed**, including strict main/preload
  TypeScript and renderer production output.
- `git diff --check`: **passed**.
- SC-011: populated-cell selection publishes one identity-based Blue Live
  target and activates the ScoreObject Editor; empty-cell selection clears it.
  Editor-document tests verify type-specific and shared-property mutation,
  persistence, identity resolution after structural movement, and rejection
  after removal or replacement.

### Final Convergence Validation

- The focused toolbar/Live Space command-barrier suite passes:
  **2 files; 44 tests**.
- Start, Recompile, and Trigger wait for pending project-patch acknowledgement
  and abort after a rejected acknowledgement.
- Stop bypasses the edit barrier, so a failed project commit cannot prevent an
  active Blue Live session from being stopped.
- The final Spec Kit audit reports **39/39 functional requirements**, **11/11
  success criteria**, **68/68 tasks**, and **20/20 checklist items** covered.
