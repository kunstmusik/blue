# Quickstart: Diagnose and Validate Track Editor Audio Continuity

Run all commands from the repository root. The first controlled reproduction target
is macOS with the same audio device, sample rate, `ksmps`, project, power mode, and
background workload held constant across baseline and candidate runs.

## 1. Prepare and run focused automated checks

Install dependencies and build the affected Electron layers:

```bash
pnpm install
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
```

Run the existing focused suites before implementation and add new cases to the same
command as files are introduced:

```bash
pnpm --filter @blue/engine-client test
pnpm --filter @blue/app test -- \
  track-instrument-editor-window-manager.test.ts \
  track-instrument-editor-window.test.tsx \
  blue-x7-effective-values.test.tsx \
  blue-x7-runtime-sync.test.ts
```

The focused suite must cover focus-existing, snapshot count, cold/reopen/different
targets, stale session/generation rejection, target removal, startup failure, runtime
status ordering, editor-specific lazy work, and cancellation.

## 2. Build the instrumented engine

Create an opt-in Release engine with native performance tracking:

```bash
pnpm --filter @blue/engine-native build -- --performance-tracking --no-stage
cmake --build native/blue-engine/build-macos-arm64-benchmark --parallel
ctest --test-dir native/blue-engine/build-macos-arm64-benchmark \
  --output-on-failure
```

Start the development application with that engine and editor-open diagnostics:

```bash
BLUE_ENGINE_PATH="$PWD/native/blue-engine/build-macos-arm64-benchmark/blue-engine" \
BLUE_EDITOR_OPEN_DIAGNOSTICS=1 \
BLUE_EDITOR_OPEN_DIAGNOSTICS_DIR="${TMPDIR:-/tmp}/blue-editor-open-diagnostics" \
BLUE_EDITOR_OPEN_DIAGNOSTIC_CONDITION=effect-interface \
BLUE_EDITOR_OPEN_DIAGNOSTIC_EFFECT_LOAD_MODE=isolated \
BLUE_EDITOR_OPEN_DIAGNOSTIC_DEVICE="MacBook Pro Speakers" \
BLUE_EDITOR_OPEN_DIAGNOSTIC_HEADROOM_SOURCE="qualified no-open control" \
BLUE_EDITOR_OPEN_DIAGNOSTIC_BASELINE_INTERRUPTION_COUNT=0 \
BLUE_EDITOR_OPEN_DIAGNOSTIC_OUTPUT_MODE=audible \
pnpm --filter @blue/app dev
```

The output directory is a native filesystem path. Do not convert its separators for
Csound or other embedded text. Replace the device and headroom descriptions with the
actual qualified workload. The device, headroom source, and baseline interruption
count are required; without them the app deliberately does not create a diagnostic
run or append a JSONL record.

## 3. Qualify each playback workload

Use both a lightweight project and a representative high-load project. For the
high-load project:

1. Start real-time playback and allow startup transients to settle.
2. Play for at least 60 seconds without opening an editor.
3. Record the device, sample rate, `ksmps`, build, project/fixture identity, CPU/load
   evidence, and audible or loopback observation.
4. Reject the workload/run if the no-open interval contains any interruption or if
   it is already missing real-time budget due to overload.

Only a clean no-open control qualifies the workload for causal comparisons.

## 4. Run the controlled diagnostic matrix

Use at least 10 attempts for every condition, resetting only what the condition
defines and keeping all environmental variables fixed.

| Condition | Action | Question answered |
|---|---|---|
| No open | Continue playback for the control duration | Is the workload clean? |
| Focus existing | Invoke editor action on an already usable editor | Is lookup/focus safe and duplicate-free? |
| Minimal shell | Create/show only the detached Track shell | Is `BrowserWindow` construction itself causal? |
| Shell + snapshot | Add the single document snapshot | Does serialization/transfer materially contribute? |
| Editor mount | Load only the requested editor type | Which editor interface adds material cost? |
| Library init | Enable deferred library snapshot/subscriptions/browse | Does library startup overlap the interruption? |
| BlueX7 readback | After usable, enable the first and steady readback batches | Does restored runtime observation contribute? |
| Effect Interface | Repeat with the non-modal effect workflow | Is the cause shared or Track-specific? |

For the Effect Interface condition, run two otherwise identical passes and set a
distinct `BLUE_EDITOR_OPEN_DIAGNOSTIC_CANDIDATE_ID` for each:

| Effect load mode | Environment value | Purpose |
|---|---|---|
| Legacy dependency burst | `BLUE_EDITOR_OPEN_DIAGNOSTIC_EFFECT_LOAD_MODE=legacy` | Dynamically starts the former full effect-editor dependency graph immediately while still rendering interface-only UI |
| Isolated interface | `BLUE_EDITOR_OPEN_DIAGNOSTIC_EFFECT_LOAD_MODE=isolated` | Starts only the interface dependency graph immediately, in parallel with snapshot loading |

This A/B comparison holds the mailbox-enabled engine and functional UI constant.
Both modes now start their selected import immediately, so snapshot timing does not
give either candidate an artificial delay advantage. It isolates the heavy renderer
dependency burst; it does not by itself prove that
the removed native mutex caused or did not cause an earlier-build interruption.
If no candidate ID is supplied, the app records `effect-interface-legacy` or
`effect-interface-isolated` automatically from the selected load mode.

The pre-mailbox mutex-wait and wall/thread-CPU controls used during the
investigation are archived in `validation.md`. Their isolated binaries and
post-stop logs are local diagnostic artifacts, not part of the normal app launch
or the shipping validation command.

For baseline coverage, separately record first cold open, focus-existing, reopen after
close, and sequential opens of different Tracks in development and packaged modes.
Rapid repeated clicks must still yield one editor session per stable Track identity.

For every attempt, record editor readiness, interruption count, app milestones,
available frame brackets/native budget-gap events, channel `controlTraffic` deltas
from request receipt through `editor-usable`,
and failure/cancellation outcome. A zero channel-traffic delta falsifies channel
read/write contention as the bridge for that attempt; a nonzero delta identifies
the exact command and entry volume but still requires timing/audio correlation.
Never classify a native timing event alone as an audible dropout.

## 5. Validate diagnostic artifacts

Confirm the schema file is valid JSON:

```bash
node -e 'JSON.parse(require("node:fs").readFileSync(
  "specs/093-fix-editor-audio-glitch/contracts/editor-open-diagnostic.schema.json",
  "utf8"
)); console.log("diagnostic schema JSON: OK")'
```

Validate each JSONL record against
`contracts/editor-open-diagnostic.schema.json` using the project's selected JSON
Schema validator when the diagnostic reader is implemented. Ignore an incomplete
final line after an interrupted run, but do not silently accept other invalid lines.

Create a comparison table for the final investigation record:

| Candidate | Condition | Attempts | Interruptions | Budget-gap change | p95 usable latency | CPU/memory/startup change | Disposition |
|---|---:|---:|---:|---:|---:|---:|---|
| Baseline | | | | | | | |
| Single snapshot | | | | | | | |
| Progressive startup | | | | | | | |
| Bounded shell pool, if tested | | | | | | | |

Mark every candidate adopted, rejected, or deferred and distinguish confirmed
findings from hypotheses.

## 6. Select the smallest passing implementation

Evaluate candidates in this order:

1. Focus-before-snapshot and single snapshot construction.
2. Progressive requested-editor loading with library and live observation deferred
   until the editor is usable.
3. A single bounded Track-only standby shell, only if the minimal-shell condition
   remains correlated with interruptions.

Do not adopt stronger scheduling, a larger audio buffer, a public engine protocol
change, or shared Track/effect pooling without new controlled evidence. A candidate
that removes interruptions but exceeds any 10% latency/startup/idle/memory gate is
rejected or explicitly deferred for further design.

## 7. Exercise BlueX7 live behavior

With a Track-owned BlueX7 instrument automated during active playback:

1. Open the editor and confirm no live-value read occurs before `editor-usable`.
2. Observe the full visible live-value set for at least 60 seconds at 20 Hz or better.
3. Start/stop playback and Blue Live, close/reopen, and switch to another Track.
4. Confirm there are no cross-instrument values, stale-session acceptances, project
   mutations, or audio interruptions.
5. Edit a canonical fixed value and verify the existing document mutation, undo,
   save, project-update, and runtime synchronization paths remain intact.

## 8. Run packaged acceptance

Build an unpacked production application with the accepted engine/application
candidate:

```bash
pnpm --filter @blue/app build
pnpm --filter @blue/app package:dir
```

On the qualifying high-load workload, run 30 consecutive cold opens during clean
playback:

- 10 generic/text instrument opens
- 10 Blue Synth Builder opens
- 10 BlueX7 opens with live values active after readiness

Acceptance requires zero audible/captured discontinuities, zero newly observed
playback interruptions, zero incorrect Track bindings, and no failure to reach a
recoverable usable/error outcome. At least 95% of opens must be usable within two
seconds.

Across five comparable trials, record application-ready time, project-open time,
p95 editor-usable time, first-edit response, steady idle CPU, and retained memory.
No candidate metric may regress by more than 10% from the accepted baseline.

Repeat the diagnostic reproduction with Effect Interface. Leave its behavior
unchanged unless the shared cause and the selected fix are both demonstrated.

## 9. Run regression guards and final checks

The null-audio benchmark is a regression guard only; it does not replace packaged
audio acceptance:

```bash
cmake --build native/blue-engine/build-macos-arm64-benchmark \
  --target benchmark_engine --parallel
native/blue-engine/build-macos-arm64-benchmark/benchmark_engine \
  --scenario live_compile_32 --trials 1 --warmup-cycles 1024 \
  --measure-cycles 4096 --json
```

Run repository validation in proportion to the final change:

```bash
pnpm --filter @blue/app test
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:preload
pnpm --filter @blue/app build:renderer
pnpm test
pnpm lint
git diff --check
```

The final validation record must include environment/workload identity, the clean
control, all candidate results and tradeoffs, the 30 packaged attempts, BlueX7
60-second results, Effect Interface outcome, automated commands, and any untested
platform limitation.

For this close-out, the local implementation checks and causal controls are
recorded in `validation.md`. Packaged acceptance and the Csound AuHAL experiment
remain separate follow-ups; do not treat the opt-in diagnostic JSONL or native
timing counters as audible proof.
