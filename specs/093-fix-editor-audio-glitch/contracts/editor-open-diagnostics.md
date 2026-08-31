# Contract: Editor-Open Diagnostics

## Purpose

Define an opt-in, bounded evidence channel that correlates detached-editor startup
work with engine progress and observed audio interruptions. This is an internal
diagnostic contract, not a public engine or renderer API.

## Enablement and ownership

- Diagnostics are disabled by default.
- `BLUE_EDITOR_OPEN_DIAGNOSTICS=1` enables collection for a diagnostic build/run.
- `BLUE_EDITOR_OPEN_DIAGNOSTICS_DIR` may select a native output directory. If absent,
  Electron main uses a feature-specific directory below `os.tmpdir()`.
- Electron main owns attempt IDs, monotonic timestamps, engine-state bracketing, and
  JSONL output. Renderer and native layers only emit bounded observations to main.
- Output paths remain host-native. Paths are not normalized for embedded text.
- Failure to create or write the diagnostic artifact reports a bounded warning and
  disables artifact emission; it must not block editor opening or audio rendering.

## Attempt lifecycle

1. Main receives an open request and appends `request-received`.
2. If a usable matching session exists, main focuses it, appends
   `existing-focused`, completes the attempt, and performs no snapshot/navigation.
3. Otherwise main validates the target and appends `target-validated`.
4. Main/renderer append only milestones listed in `data-model.md` for the same
   `attemptId` and current target binding.
5. Selected milestones may request an engine frame bracket through the existing
   engine-state operation. The bracket records pre-request and post-response
   monotonic times around the returned sample frame.
6. `usable`, `failed`, `cancelled`, or `closed-before-usable` makes the attempt
   terminal. Later observations are discarded.
7. Audio observation may be attached during or immediately after the controlled
   attempt. Missing device evidence is represented explicitly as `unavailable`.

## Boundedness

- One diagnostic coordinator exists per Electron main process.
- Runs and attempts have fixed maximum in-memory counts configurable only in test or
  diagnostic code; production-disabled mode allocates no attempt history.
- Native scheduling observations retain a bounded top-N set and aggregate counters,
  then emit JSONL/stderr at performance stop. They never write from the audio thread.
- Renderer milestones are one-shot per attempt/name unless the schema explicitly
  permits repetition.
- Trace payloads contain identifiers and measurements, not document snapshots,
  instrument text, control values, or credentials.

## Native scheduling-gap observation

When `BLUE_ENGINE_USE_PERFORMANCE_TRACKING` is compiled in, the engine computes the
current k-period budget as `ksmps / sampleRate`. A scheduling-gap observation records
that the interval between expected/actual performance progress exceeded a defined
multiple or fraction of this budget. The exact threshold and aggregate counters are
recorded with the run so comparisons are reproducible.

This observation indicates missed scheduling budget; it is not labelled an audio
underrun and does not independently establish an audible dropout.

## Correlation semantics

- Monotonic app timestamps are authoritative only within the app process.
- A sample frame returned by an existing engine-state request occurred somewhere
  between `requestBeforeMonotonicNs` and `responseAfterMonotonicNs`.
- A causal finding requires a repeatable relationship across controlled attempts and
  an audible or captured interruption. Timing overlap alone is supporting evidence.
- Development traces select candidate work; packaged-build trials decide acceptance.

## JSONL output

The artifact contains one JSON object per line. Each line validates against
`editor-open-diagnostic.schema.json` and represents a complete diagnostic run. A run
may first be retained in memory and written atomically at completion; partial/corrupt
last lines are ignored by analysis tooling.

Required top-level fields are `schemaVersion`, `runId`, `candidateId`, `condition`,
`environment`, `workload`, `attempts`, and `disposition`.
When native tracking is enabled, `nativePerformance` records the budget multiple,
aggregate gap count, and bounded largest-gap observations with sample-frame locations.

## Failure and cancellation behavior

- Invalid or stale targets end with a stable `errorCode` and no window construction.
- Window/navigation/import failure ends the attempt and destroys an unusable window.
- Closing a window before readiness yields `closed-before-usable`.
- Engine-state request failure omits the frame bracket and records a diagnostic
  warning; it does not fail the editor.
- Project close, app quit, and diagnostic disablement flush bounded completed records
  when possible and discard incomplete renderer callbacks.

## Non-goals

- No public engine command, capability, or shared-memory field.
- No continuous general-purpose telemetry or user analytics.
- No project serialization or mutation.
- No claim that a native timing event is an audio-device underrun.
