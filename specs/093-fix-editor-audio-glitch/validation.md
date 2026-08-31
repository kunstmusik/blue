# Validation: Glitch-Free Track Instrument Editor Opening

Status: Blue Electron implementation and local validation complete (2026-08-31).
The channel-mutex contention hypothesis is falsified for the confirmed battery
event. Packaged release acceptance and a direct Csound AuHAL A/B remain deferred
because they require a qualifying packaged workload and changes in the external
Csound dependency, respectively.

## Evidence Rules

- A workload qualifies only after a clean no-open control interval of at least 60
  seconds with measurable processing headroom.
- An engine scheduling gap is supporting timing evidence, not an audible dropout.
- Development traces select candidates; packaged runs decide acceptance.
- A completed JSONL line must validate against
  `contracts/editor-open-diagnostic.schema.json`. Only an incomplete final line
  from an interrupted run may be ignored.

## Workload Qualification

| Workload | Fixture/project | Sample rate | ksmps | Control duration | Baseline interruptions | Headroom evidence | Output mode | Disposition |
|---|---|---:|---:|---:|---:|---|---|---|
| Lightweight | `blue-x7-pop-song.blue` | 44100 | 64 | 60s | 0 | blue-engine ~15% CPU (Activity Monitor) | audible, MacBook Pro Speakers | qualified |
| High-load | pending | pending | pending | pending | pending | pending | pending | pending |

Control observations (2026-08-30, operator run): main window open, no
instrument editors, no audible interruption over the 60-second interval.
Engine console: Csound 7.0 (double samples, Aug 12 2026, commit fee3593e),
kr = 689.062, AuHAL 256-frame buffer, 512-sample blocks of 64-bit floats.

## Fixed Environment

| Field | Value |
|---|---|
| Platform and architecture | macOS arm64 (darwin) |
| App build and mode | development (uncommitted spec 093 tree) |
| Engine build and tracking flag | `build-macos-arm64-benchmark`, performance-tracking ON |
| Audio device | MacBook Pro Speakers (AuHAL), 44100 Hz, 256-frame buffer |
| Power/background conditions | macOS arm64; battery for the pre-mailbox causal runs; background workload not controlled |
| Project/fixture identity | `blue-x7-pop-song.blue` (2 BlueX7 Tracks exercised) |
| Sample rate | 44100 |
| ksmps | 64 |
| Diagnostic output directory | `${TMPDIR:-/tmp}/blue-editor-open-diagnostics` |

Derived analysis anchors: one k-period budget = 64 / 44100 = 1.451 ms; the
native gap threshold flags loop deltas at or above 2.90 ms.

## Controlled Conditions

| Candidate | Condition | Attempts | Interruptions | Budget-gap change | p95 usable latency | CPU/memory/startup change | Disposition |
|---|---|---:|---:|---|---|---|---|
| Baseline | no-open | 1 × 60s | 0 | n/a | n/a | ~15% engine CPU | qualified |
| Existing session | focus-existing | 4 | 0 | loop-delta p95 5.4 ms absorbed by device buffer | pending | pending | accepted by operator (below ≥10 target; clean, no duplicate windows; playback continuity during later clicks unconfirmed — piece is ~19 s) |
| Snapshot transfer | shell-with-snapshot | 12 | 0 | brackets captured on 11 window opens; no interruption correlated | pending | pending | accepted by operator (clean; looped ~100 s playback) |
| Historical comparison control (before mailbox/effect diagnostics) | effect-interface | several (deterministic) | **every open** | unavailable | pending | pending | reproducible historical symptom; not a candidate result |
| Mailbox engine, dependency A/B before eager-timing correction | effect-interface legacy + isolated | several; exact count not recorded | 0 heard | no effect JSONL record | pending | pending | encouraging but inconclusive: isolated import waited for snapshot and required diagnostic metadata was absent |
| Mailbox engine, eager dependency A/B | effect-interface legacy + isolated | several; exact count not recorded | 0 heard | no effect JSONL record | pending | pending | encouraging but still inconclusive: both modes now start eagerly, but required run metadata was again absent |
| Pre-mailbox mutex engine, eager isolated UI | effect-interface | 20 (13 + 7) | 1 reported | native gap summary unavailable in pre-diagnostic engine; zero channel traffic in all attempts | pending | glitched seven-open run confirmed on battery; first quiet run power unknown | symptom reproduced once, but channel-mutex contention is not established |
| Pre-mailbox mutex-wait diagnostic engine, eager isolated UI | effect-interface | 14 | at least 1 confirmed; operator heard smaller events elsewhere | open 12 bracket followed by a 25.466 ms `csoundPerformKsmps`-interval stall; mutex maximum 0.150 ms elsewhere; zero channel traffic | pending | battery confirmed | `channelMutex_` ruled out for the confirmed event; Csound-call wall-time stall is the next causal seam |
| Pre-mailbox perform wall/thread-CPU diagnostic, eager isolated UI | effect-interface | 21 | suspected on opens 17 and 18 | open 17 overlaps 17.624 ms wall / 0.983 ms CPU; open 18 overlaps consecutive 45.902 ms wall / 0.225 ms CPU and 17.383 ms wall / 0.903 ms CPU calls | pending | battery confirmed | actual computation ruled out; thread descheduling or AuHAL output-ring/callback blocking confirmed as the remaining seam |
| Window construction | minimal-shell | pending | pending | pending | pending | pending | pending |
| Snapshot transfer | shell-with-snapshot | pending | pending | pending | pending | pending | pending |
| Requested editor | editor-mount | pending | pending | pending | pending | pending | pending |
| Library work | library-init | pending | pending | pending | pending | pending | pending |
| Live readback | bluex7-readback | pending | pending | pending | pending | pending | pending |
| Comparison control | effect-interface | pending | pending | pending | pending | pending | pending |

Rows marked `pending` are explicit release-gate work that was not run in this
close-out; they are not interpreted as passing evidence. The implemented path is
accepted for local development based on the automated checks and the controlled
Track/effect trials recorded below. Packaged acceptance must be completed before
making the zero-interruption success-criteria claim for a release.

## Attempt Log

For each run, retain the JSONL artifact reference and record the environment,
workload, app mode, target kind, classification, outcome, ready milestone, audio
observation, and any frame bracket or native gap evidence.

| Run ID | Candidate | Mode | Target/editor kind | Classification | Attempts | Artifact | Outcome summary |
|---|---|---|---|---|---:|---|---|
| ab0fa59e-b1e5-4c8e-85ab-706133466bf0 | progressive-startup | development | blue-x7 (`blue-x7-pop-song.blue`) | cold ×1, reused ×3 | 4 | `$(TMPDIR)/blue-editor-open-diagnostics/editor-open-diagnostics.jsonl` (schema VALID) | All outcomes usable; zero audible interruptions; one window per Track; cold timeline shows shown → mounted → usable → library/live deferral; 2 engine brackets on the cold open |
| 16f52c09-e8c8-475f-a4a8-128b23968fe6 | progressive-startup | development | blue-x7 ×2 Tracks (same project) | cold ×2, reopened ×9, reused ×1 | 12 | same artifact, line 2 (schema VALID) | ~100 s looped playback; opens alternated between two Tracks with closes between; all usable; engine brackets on all 11 window-creating opens; zero audible interruptions |
| (none — historical effect path before diagnostic wiring) | progressive-startup | development | effect interface (opened from mixer) | n/a | several, deterministic | no artifact record | **Audible interruption on EVERY open.** Different (heavier?) project; control for that project not established; retained as historical symptom only |
| (none — required run metadata absent) | effect-interface legacy + isolated | development | effect interface | mixed cold/reopen, exact count not recorded | several | no new line; configured JSONL still contains only the 3 prior Track runs when inspected 2026-08-31 | Operator heard no interruption in either mode. Inconclusive because the isolated mode still waited for snapshot in that build and no effect lifecycle/control-traffic/native-gap artifact was retained. |
| (none — required run metadata absent, eager build) | effect-interface legacy + isolated | development | effect interface | mixed cold/reopen, exact count not recorded | several | no new line; configured JSONL still contains only the 3 prior Track runs when inspected 2026-08-31 | Operator again heard no interruption in either mode after both dependency paths were made eager. This removes the loading-delay confound, but no effect lifecycle/control-traffic/native-gap artifact was retained. |
| babb0f01-0f27-4ec8-9331-3a14c6feb85b | effect-interface-pre-mailbox-isolated | development | effect interface | cold ×1, reopened ×12 | 13 | configured JSONL line 4 | All 13 usable and operator heard no glitch; 52 frame observations; zero channel read/write commands or entries; power state not retained; native gap summary unavailable in this older engine. |
| 0a39a59d-0556-49a1-bd3f-867cd38098ac | effect-interface-pre-mailbox-isolated | development | effect interface | cold ×1, reopened ×6 | 7 | configured JSONL line 5 | All 7 usable; operator confirmed one audible glitch on battery during open 3. Zero channel read/write commands or entries. Open 3 was also the control-response/usable-latency outlier (11.08 ms maximum frame-sample response, 496.99 ms usable vs 344.86–366.07 ms for the other opens), but this is not perform-loop gap evidence. |
| 28ffb295-3a7c-403f-886d-9e4649976d7a | effect-interface-pre-mailbox-mutexdiag-battery | development | effect interface | cold ×1, reopened ×13 | 14 | configured JSONL line 6 plus `pre-mailbox-mutexdiag-battery.log` | Operator confirmed a glitch during open 12 (third-to-last), with smaller pauses/glitches elsewhere. Open 12 bracketed sample 1,381,568; the retained rank-4 host spike at sample 1,384,640, about 69.7 ms later and within that open, spent 25.460 ms of 25.466 ms inside the `csoundPerformKsmps` interval. The run's worst mutex wait was only 0.150 ms at sample 1,218,240 near open 11, with zero waits >= the 1.451 ms k-period and zero channel traffic. |
| 8b52a8c1-4322-4c32-8604-e1527489bd2f | effect-interface-pre-mailbox-perfcpu-battery | development | effect interface | cold ×1, reopened ×20 | 21 | configured JSONL line 7 plus `pre-mailbox-perfcpu-battery.log` | Operator suspected glitches on opens 17 and 18. Open 17 bracketed sample 2,167,744 and overlaps the sample-2,177,600 call: 17.624 ms wall, 0.983 ms thread CPU, 16.642 ms non-CPU. Open 18 bracketed sample 2,384,832 and overlaps consecutive sample-2,392,512/2,392,576 calls: 45.902/17.383 ms wall, 0.225/0.903 ms CPU, 45.678/16.481 ms non-CPU. Mutex maximum was 0.130 ms elsewhere, no mutex wait reached one k-period, and channel traffic was zero. |

Session notes (focus-existing, 2026-08-30):

- Engine counters from the session: loop-delta p95 = 5.39 ms vs the 1.45 ms
  k-period budget (max 15.7 ms, startup-attributable); AuHAL buffer
  (256/1024 frames ≈ 5.8–23 ms) absorbed these — operator heard no
  interruption, confirming budget-relative gaps are timing evidence only.
- `slow_host_pct=100.000` at the fixed 50 µs threshold reconfirms that fixed
  thresholds are meaningless against the 1.45 ms budget; the budget-relative
  threshold (2.90 ms) is the meaningful signal.
- The fixture's score is ~19 s and ended naturally mid-session; playback
  continuity during all attempts must be confirmed/looped before this
  condition's tally is final (see gap: only 3 of ≥10 reused attempts so far).
- The fixture clipped during the session (11,431 out-of-range samples);
  gain-staging should be lowered for remaining trials so audible observations
  stay unambiguous.

## BlueX7 Live Validation

| Check | Result |
|---|---|
| No readback before `editor-usable` | pending |
| Steady cadence | pending |
| Observation duration | pending |
| Start/stop playback isolation | pending |
| Blue Live isolation | pending |
| Close/reopen and Track switching | pending |
| No canonical project or automation mutation | pending |
| No cross-instrument or stale-session values | pending |

## Packaged Acceptance

| Category | Attempts | Usable within 2 seconds | Interruptions | Incorrect bindings | Disposition |
|---|---:|---:|---:|---:|---|
| Generic/text | 10 | pending | pending | pending | pending |
| Blue Synth Builder | 10 | pending | pending | pending | pending |
| BlueX7 with live values | 10 | pending | pending | pending | pending |

| Resource metric | Baseline | Candidate | Delta | Gate | Result |
|---|---:|---:|---:|---:|---|
| Application-ready time | pending | pending | pending | <= 10% | pending |
| Project-open time | pending | pending | pending | <= 10% | pending |
| p95 editor-usable time | pending | pending | pending | <= 10% | pending |
| First-edit response | pending | pending | pending | <= 10% | pending |
| Steady idle CPU | pending | pending | pending | <= 10% | pending |
| Retained memory | pending | pending | pending | <= 10% | pending |

## Automated Checks

| Check | Command | Result | Notes |
|---|---|---|---|
| Diagnostic schema fixture test | `pnpm --filter @blue/app test -- editor-open-diagnostics.test.ts` | pass (2026-08-30) | 11 tests including incomplete-final-line tolerance, Windows-path resolution, injected EACCES write failure |
| Diagnostic attempt tracker | `pnpm --filter @blue/app test -- track-editor-diagnostic-attempts.test.ts` | pass (2026-08-30) | 13 tests including close-before-ready race regression |
| Open-flow integration | `pnpm --filter @blue/app test -- editor-open-diagnostics.integration.test.ts` | pass (2026-08-30) | 7 scenarios: cold, reused, reopened, invalid target, navigation failure, bracket degradation, JSONL artifact |
| Native profiling CTest | `ctest --test-dir native/blue-engine/build-macos-arm64-benchmark --output-on-failure` | pass (2026-08-30) | 18/18 including RealtimeChannelMailboxTests and EditorOpenDiagnosticsTests (budget/threshold/retention/stop emission); tracking-OFF release build: 16/16 |
| Main build | `pnpm --filter @blue/app build:main` | pass (2026-08-30) | |
| Full app suite | `pnpm --filter @blue/app test` | pass (2026-08-31) | 415 files, 3987 passed, 0 failed, 2 skipped after eager effect import, neutral editor shells, and shutdown-safe recent-files updates |
| Focused app suites | See `quickstart.md` | pass (2026-08-30) | covered by the full app suite run |
| Root-cause follow-up suites | `pnpm --filter @blue/app exec vitest run --config vitest.config.ts ...` | pass (2026-08-30) | 9 files, 81 tests: effect lifecycle/renderer, diagnostic traffic contract, tracker, engine bridge, Track controls |
| Native channel mailbox + bridge | `ctest --test-dir native/blue-engine/build-macos-arm64-benchmark --output-on-failure` | pass (2026-08-30) | focused mailbox, channel bridge, and automation protocol cases; sandbox rerun used native shared-memory permission |
| Null-audio benchmark guard | `native/blue-engine/build-macos-arm64-benchmark/benchmark_engine --scenario live_compile_32 --trials 1 --warmup-cycles 1024 --measure-cycles 4096 --json` | pass (2026-08-31) | `gateStatus.passed=true`; host p95/max 0.542/2.250 us; `loop_delta_max_us=7.916`; zero host/perform/SHM ≥1 ms/0.5 ms spikes. This is a scheduling/control regression guard, not audible proof |
| Main/preload/renderer builds after root-cause follow-up | `pnpm --filter @blue/app build:main && pnpm --filter @blue/app build:preload && pnpm --filter @blue/app build:renderer` | pass (2026-08-30) | production output contains separate 1.29 kB `EffectInterfacePanel` and 5.46 kB full `EffectEditorPanel` entry chunks; large shared BSB chunk remains |
| Eager-load/neutral-shell/shutdown regression | focused Vitest (6 files, 42 tests); `build:main`; `build:renderer`; `pnpm lint`; `git diff --check` | pass (2026-08-31) | both effect modes begin import before snapshot acceptance; no visible Effect/Track/lazy-instrument loading label; recent-files handler survives domain teardown |
| Native/HTML initial window paint | focused Vitest (5 files, 33 tests); `build:main`; `build:renderer`; `git diff --check` | pass (2026-08-31) | all first-party BrowserWindows, Dockview popouts, and six renderer HTML entries paint canonical app background `#1a1a2e` before application CSS loads |
| Pre-mailbox control engine | isolated source snapshot of `a4c9f712`; CMake Release arm64 with `USE_PERFORMANCE_TRACKING=ON`; build `blue-engine`; `--help`; `file` | pass (2026-08-31) | executable at `native/blue-engine/build-pre-mailbox-a4c9f712/blue-engine`; exact HEAD source still contains perform-loop `channelMutex_`; current source and user fixture were not reverted |
| Pre-mailbox mutex-wait/perform-CPU diagnostic engine | isolated `a4c9f712` source; build `blue-engine` and `benchmark_engine`; run `changing_32` | pass (2026-08-31) | executable at `native/blue-engine/build-pre-mailbox-mutexdiag-a4c9f712/blue-engine`; mutex counter and top-eight `csoundPerformKsmps` wall/thread-CPU/non-CPU records emitted after stop; no logging/allocation in the measured loop |
| Package builds | See `quickstart.md` | pending | |
| Repository test/lint | `pnpm test`; `pnpm lint` | partial (2026-08-31) | lint passes; native, engine-client, Java, and app suites pass independently. Root test has two scoped `@blue/data` failures: the preserved user-owned `fixtures/blue-x7-pop-song.blue` does not byte-match its generator, and the existing modern-render integration hash differs from the checked-in Csound/render baseline. No `packages/blue-data` source or expected hash was changed; the fixture remains uncommitted user work |

## Implementation Notes (2026-08-30 session)

- Native control-plane audit found a confirmed real-time invariant violation:
  the perform thread acquired `channelMutex_` while the ZeroMQ control thread
  could hold it during map updates and batch allocation. Replaced that handoff
  with a fixed 128-slot SPSC mailbox containing pre-resolved channel pointers,
  bounded to 256 entries per batch and one complete batch per k-cycle. Binding
  generations reject stale pointers after rebuild; lifecycle teardown resets the
  mailbox only after the perform thread is joined. This removes a credible bridge
  but does not by itself establish audible causality.
- Live batch readback now resolves once and uses the atomic shared-memory mirror
  instead of issuing one Csound channel lookup per requested name. Each diagnostic
  attempt records aggregate playback/Blue-Live channel read/write command and entry
  deltas from request receipt through `editor-usable`, so later UI interaction is
  not misattributed to opening and the next Effect Interface run can directly
  establish whether opening the UI caused channel traffic.
- Effect Interface now emits the same main/renderer lifecycle vocabulary as Track,
  validates renderer ownership, records snapshot/import/usability brackets, and
  records reused-focus attempts. Its interface-only surface is dynamically split
  from the full effect editor, so Monaco/code-editor and UDO workspace imports no
  longer belong to the interface window's selected cold path.
- The diagnostic-only `BLUE_EDITOR_OPEN_DIAGNOSTIC_EFFECT_LOAD_MODE` switch can
  run `legacy` (former full effect dependency graph, interface-only rendering) and
  `isolated` (interface chunk only) passes against the same mailbox-enabled engine,
  avoiding a renderer/native two-change confound in the next causal comparison.
  Both modes now begin importing immediately in parallel with the snapshot; the
  isolated mode no longer receives an artificial delay advantage. Effect and Track
  windows render a neutral app-background shell until usable instead of flashing a
  loading label.
- A first informal legacy/isolated operator pass heard no interruption in either
  mode, but produced no new effect JSONL line because the launch command omitted
  required environment metadata. It therefore cannot yet attribute the improvement
  to the mailbox, dependency isolation, or run-to-run variance. The corrected
  quickstart command includes all required fields.
- A second operator pass after making both modes eager also heard no interruption
  in either mode, removing the visible-loading-delay confound. It again produced
  no effect JSONL line because required metadata was absent, so the audible root
  cause remains unproven. An exact-HEAD, performance-tracking pre-mailbox control
  engine was built separately for the next engine-only A/B.
- All first-party BrowserWindows and Dockview popouts now set Electron's native
  `backgroundColor` to the canonical app background (`#1a1a2e`), and every
  renderer HTML entry sets the same inline document background. This covers both
  paint layers that otherwise expose white before application CSS loads.
- Fixed a separate shutdown race exposed by that pass: domain IPC teardown removed
  `set-recent-files` while renderer effects were still alive. The recent-files
  settings handlers now remain available alongside the existing shutdown-safe
  window-layout handlers until the renderer closes.

- Fixed the diagnostic finalization race: finalization previously incremented
  `editorOpenDiagnosticGeneration` before deferred run setups settled, so an
  in-flight editor open could fail its generation check and vanish without an
  attempt record. Finalization now lets already-started setups settle under the
  current generation, materializes their attempts, then invalidates the
  generation and records terminal outcomes (`usable`/`cancelled`/`closed-before-usable`).
  New attempts stay blocked for the whole finalization.
- Extracted that state machine from `main.ts` into
  `packages/blue-app/src/main/track-editor-diagnostic-attempts.ts` (same
  main-owned coordinator pattern as `track-editor-runtime-status.ts`) so the
  close-before-ready, navigation-failure, cancellation, stale-callback,
  first-terminal-wins, and incomplete-run paths are unit-testable.
- Declared the four new IPC channels (`track-instrument-editor:diagnostic-milestone`,
  `track-instrument-editor:runtime-status:get|subscribe|unsubscribe`) in
  `PROJECT_DOCUMENT_IPC_CHANNELS`. They were previously registered only through
  the main.ts collector without appearing in `MAIN_PROCESS_DOMAIN_IPC_ORDER`, so
  they would never have been registered in the real app; the inventory oracle
  now records 182 endpoints (115 collected in `main.ts`, 117 domain channels).
- Kept the shared Orchestra `InstrumentEditorPanel` lazy editor loading
  (it is also the detached Track window's progressive-load mechanism) and
  updated the renderer suites to await lazy chunk resolution instead of
  duplicating a synchronous panel.
- Implemented the compile-gated native scheduling-gap model (T013/T018): the
  perform loop records k-period loop deltas through
  `NativeGapAccumulator` (`src/engine/EditorOpenGapDiagnostics.h`) with O(1)
  fixed-capacity writes only — no allocation, locking, or ordering work on the
  audio thread. A gap is a loop delta at or above `2.0 x (ksmps / sampleRate)`.
  Retention keeps the 64 largest deltas by replacing the current minimum; the
  bounded top-8 summary is assembled on the calling thread via
  `CsoundEngine::getLastNativeGapSummary()` at performance stop. Production
  timing and public protocol fields are unchanged, and both tracking-ON and
  tracking-OFF engine builds compile and pass CTest.
- Added open-flow integration coverage (T012) composing the real coordinator,
  tracker, and engine-bridge sampling adapter; robustness coverage (T046) for
  synthetic Windows paths and injected EACCES unwritable-directory failures;
  and compatibility guards (T047) proving editor-open reads leave the
  canonical document, its `.blue` serialization, and generated CSD unchanged.

## Decisions and Tradeoffs

| Candidate | Confirmed finding | Remaining hypothesis | Tradeoff | Decision |
|---|---|---|---|---|
| Focus-before-snapshot | Implemented and covered by manager/open-flow suites (2026-08-30); duplicate snapshot work on reuse removed | Whether window construction alone interrupts audio | None observed in code paths | Adopted; packaged release gate remains |
| Progressive startup | Requested editor loading is isolated; Effect Interface imports in parallel with its snapshot and editor windows use a neutral pre-snapshot shell | Whether snapshot transfer or editor mount dominates the gap | First editor open pays one-time chunk load | Adopted; packaged release gate remains |
| Standby shell | Not implemented | Causal only if minimal-shell evidence persists after the above candidates | Extra native window + rebind complexity | Deferred pending minimal-shell evidence; do not add until then |

## Close-out disposition

The local investigation is complete. The mailbox implementation remains in the
shipping Blue Engine path because it removes an unbounded perform-thread mutex,
allocation, string lookup, and queue drain from live channel updates. It is a
real-time safety correction even though the controlled Effect Interface attempts
recorded zero channel traffic.

The exact pre-mailbox control engine reproduced the reported battery-sensitive
events. The mutex-wait and wall/thread-CPU counters showed no wait at or above one
k-period, while the correlated `csoundPerformKsmps` stalls were overwhelmingly
non-CPU. This falsifies Blue Engine `channelMutex_` contention as the cause of the
confirmed event and points to Csound's AuHAL circular-buffer producer/callback
handoff as the remaining external hypothesis. The stock Csound source uses an
`os_unfair_lock` for circular-buffer index snapshots and retries full-ring writes
with 100 us sleeps; proving that mechanism requires an isolated Csound build and
callback-underrun counters.

No temporary mutex-wait, perform-CPU, or framework changes are part of this
repository. The app's editor-open diagnostics remain disabled by default and are
retained only as bounded, opt-in evidence infrastructure. All normal editor shells
are painted with the app background and contain no transient loading message.

The packaged 30-open matrix, full BlueX7 60-second workflow, and Csound AuHAL A/B
are release/external follow-ups. They must not be reported as passing solely from
the local automated suite or subjective development runs.

## Platform Limitations

- macOS is the initial controlled and packaged acceptance platform.
- Windows and Linux portability checks remain pending until native-path and
  platform-specific validation can run on those hosts.
- Automated tests do not independently prove audible continuity; packaged audible
  or loopback observation remains required.
