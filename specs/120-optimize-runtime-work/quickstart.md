# Validation and evidence

Run from repository root. Do not run speed collection alongside builds/tests.

- Focused app: `pnpm --filter @blue/app test src/main/engine-bridge.test.ts src/main/project-history-memento.test.ts src/main/project-history-graph.test.ts src/main/project-history-patch-classification.test.ts src/main/project-history-roundtrip.test.ts src/main/global-project-history.test.ts`
- Native: `pnpm --filter @blue/engine-native test`; also run JavaBigDecimalParityTests
  and native integration where Csound is available.
- `pnpm --filter @blue/app build:main`, `pnpm test`, `pnpm lint`, `git diff --check`.
- Opt-in acceptance commands and product budgets: [performance guide](../../docs/performance-testing.md).

## Diagnostic comparison

Baseline 56154fd3 vs current diff, same desktop/configuration. Before observing candidate
results, use five warmups plus 30 measured structural preparations on an original
1,000-clip/32-instrument fixture; measure prepare and full snapshot projection separately.
Retain all raw samples and host/runtime metadata in evidence. Counters prove copy count
and graph visits in ordinary tests. Diagnostics do not establish product acceptance;
use the existing controlled three-round product suites for that claim. Settle the machine
before collection; retain failures and report environmental limitations.

## Results

### Correctness and builds

- App: 547 files passed, 6,287 tests passed, 15 existing skips. Command:
  `pnpm --filter @blue/app test --exclude '**/__perf-probe.test.ts'`.
- Data: 225 files passed, 3,152 tests passed, five skips and one skipped file.
- Engine client: four files / 48 tests passed; ESM/CJS build passed.
- Native: 38 script tests and all 14 ordinary CTest targets passed, including Java
  exact-bit parity and added dense lookup/shared-definition/replacement cases.
- Java: `pnpm --filter @blue/java-runtime test` passed with existing Maven cache access.
- CLI: `pnpm --filter blue-cli test` passed, five files / 22 tests (including normal build).
- Root scripts: `pnpm test:scripts` passed all 72 tests.
- Browser: 17 tests in thumbnail, stacked-selection/culling and host-gesture suites passed
  in installed Chrome. Four thumbnail cases cover resize/selection and all time behaviors.
- `pnpm --filter @blue/app build:main` and `typecheck:renderer` passed.
- Root `pnpm lint` passed after removing an extra blank line before the closing
  `});` in `packages/blue-app/src/renderer/tests/pianoroll-parity.test.ts`.
- `git diff --check` passed. See the [implementation commits](spec.md#final-implementation-verification).

Workspace packages were checked individually rather than blindly running the root wrapper:
its app glob includes the pre-existing untracked timing probe `__perf-probe.test.ts`.
That probe was neither modified nor executed. The first recursive non-app attempt failed
on sandboxed Maven-cache locks and cancelled its data process; Java was rerun with host
access and data separately passed. An initial CLI filter `@blue/cli` matched no package;
the correct `blue-cli` filter was then run successfully. These failed/inapplicable attempts
are not counted as passes.

### Native integration limits

The explicit five-case native Csound integration run passed channel bridge, lifecycle
stress, meter sampling and metering soak. Its general integration case failed because
this installed Csound 7 build lacks the `sndinfo` utility. An isolated probe linked only
CsoundLoader/CsoundRuntimeServices (no AutomationManager/Store) reported
`Csound utility is unavailable: sndinfo`, result 65. Production utility code was not changed.

An additional app real-engine run used `BLUE_RUN_REAL_ENGINE=1` and the newly built
`build-darwin-arm64-debug/blue-engine`, not an old staged binary. History/meter files passed;
combined result: 23 passed, five skipped, five failed. The five failures were in the
separate legacy mixer acceptance matrix: four generated-audio fixtures omit required
layout observations, and one comparison requires `BLUE_MIXER_BASELINE_DIR`. Failures
occurred in fixture/CSD preparation or missing acceptance input; no audio equivalence
acceptance is claimed. The ordinary mixer/history suites passed. Keep these harness
prerequisites visible rather than weakening assertions or repairing unrelated fixtures.

Windows/Linux native execution, full installed-app interaction, and controlled product
speed acceptance remain outstanding. No host-path behavior or external readback defaults
changed; the existing supported-platform CI remains required before release.

### Diagnostic results

Raw observations and environment: [baseline.log](evidence/baseline.log),
[candidate.log](evidence/candidate.log), [readback-storage.json](evidence/readback-storage.json).
Apple M3 Pro, arm64, Darwin 27.0.0, Node 22.23.1 / V8 12.4; identical original fixture,
five warmups, 30 samples. Power mode/display/background applications were not controlled:
these are diagnostics, not product acceptance or a guaranteed speedup.

| Boundary | Baseline p50 / p95 / max (ms) | Candidate p50 / p95 / max (ms) |
| --- | --- | --- |
| Detached structural preparation | 73.75 / 93.75 / 109.94 | 51.33 / 71.02 / 75.75 |
| Full editor projection | 5.63 / 6.57 / 6.77 | 5.70 / 6.10 / 6.11 |

The first baseline attempt exposed lazy mixer initialization in the diagnostic fixture:
projection changed the initially unnormalized model. Its raw samples/failure were retained
in [baseline-fixture-error.log](evidence/baseline-fixture-error.log). The valid paired
workload normalizes once before warmup, then asserts unchanged canonical XML. It does
not hide, discard or relabel that initial failed collection as a successful baseline.

Storage comparison: original same-layout proxy, `c++ -std=c++17 -O2`, existing native
SharedMemory implementation, identical 80-byte entries and 16,384 scan cycles per sample,
five warmup pairs / 30 measured alternating-order pairs for each count/activity case.
No Csound, transport, concurrent reader, setup/teardown or lower-rate publication claim.

| Channels / activity | Mapped median ms | Local median ms | Local faster pairs |
| --- | --- | --- | --- |
| 64 static | 0.52800 | 0.53577 | 16 / 30 |
| 64 changing | 0.33146 | 0.33158 | 13 / 30 |
| 256 static | 1.73089 | 1.73325 | 13 / 30 |
| 256 changing | 1.32646 | 1.32618 | 14 / 30 |

Zero-channel samples are retained but timer/loop-floor dominated and not used for the
storage decision. No consistent benefit justifies a production local-backing mode.
Lower-rate snapshots remain deferred until a freshness/echo contract exists.

### Reproduce the temporary diagnostics

The temporary Vitest files were removed from app source after collection. To reproduce,
copy `evidence/structural-diagnostic.test.ts.txt` to
`packages/blue-app/src/main/optimization-diagnostic.test.ts` and the adjacent
`vitest.optimization-diagnostic.config.ts.txt` to the app root without `.txt`, then run:

```sh
pnpm --filter @blue/app exec vitest run --config vitest.optimization-diagnostic.config.ts
c++ -std=c++17 -O2 -I native/blue-engine/src specs/120-optimize-runtime-work/evidence/readback-storage-diagnostic.cpp native/blue-engine/src/ipc/SharedMemory.cpp -o /tmp/blue120-readback-diagnostic
/tmp/blue120-readback-diagnostic
```

Native collection requires OS shared-memory permission. Remove only those two copied
Vitest files afterwards; do not touch the user's unrelated probe. Initial work-count,
replay, lifetime, query-count, mount-count and exact-output tests remain in ordinary CI.
Existing opt-in three-round product suites and budgets are unchanged, not replaced by
these temporary diagnostics.
