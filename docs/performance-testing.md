# Application performance testing

Normal application and data tests verify behavior independently of host speed. Tests that
enforce elapsed-time, frame-rate, or delivery-rate budgets carry Vitest's native
`performance` tag. Normal Node and browser configurations filter that tag out;
dedicated configurations select it and run one file/worker at a time, without retries.
The `real-engine` tag further separates engine measurements from Node measurements.
See [Vitest test tags](https://vitest.dev/guide/test-tags).

Run performance measurements on a known desktop/reference machine when changing
performance-sensitive code, investigating a regression, or gathering release
acceptance evidence. They are opt-in and do not run on ordinary CI pushes or PRs.
Keep the machine, OS, runtime/browser versions, power mode, display configuration,
and workload consistent when comparing revisions. Run without competing builds or
other heavy applications, and retain each revision's reports before the next run
overwrites them. Recorded environment metadata aids diagnosis but does not make
uncontrolled machines comparable.

Mixed workloads use one local scenario function with two test entries: functional
and performance. Both exercise the same state changes and correctness assertions;
the performance command evaluates speed observations. This preserves large-fixture, pagination,
history restoration, ownership, and lifecycle coverage without duplicating fixtures.
Filtered cases appear as skipped in Vitest output; the dedicated runner checks the
selected performance cases separately and rejects missing/skipped measurements.

## Adding or changing tests

Keep correctness coverage in the default suite, including large fixtures, positive
acknowledgements, failure recovery, undo/redo, and exact audio/output equivalence.
Share a local workload function when the same scenario also measures speed. Tag
only its measurement entry `performance` (also `real-engine` when applicable), add
it to the appropriate explicit performance configuration, and update the runner's
expected case count and this inventory together. For a mixed behavior/speed case,
a timing-free entry must continue to assert the functional outcomes in ordinary CI.

Use fake clocks for debounce, scheduling, and timeout behavior, and deterministic
work/render counts for bounded work. Ordinary test timeouts are hang guards, not
responsiveness budgets. Investigate races and split oversized correctness matrices
into independent cases; moving a slow functional test out of CI loses coverage.
For each speed requirement, record the measured boundary and whether it is a
component proxy or an end-to-end user action. Keep its reference configuration,
sampling rules, raw evidence, and acceptance decision in the feature quickstart.

## Commands

Run from the repository root after installing and building `@blue/data` and
`@blue/engine-client` for app measurements. The data suite runs directly from source
after installing dependencies:

`pnpm test:performance` runs each package's `test:performance` script serially,
currently data and app Node measurements. It continues collecting other packages
if one fails and returns a failing exit status when any package fails. Browser
and engine measurements use the explicit commands below.

```sh
pnpm test:performance
pnpm --filter @blue/app test
pnpm --filter @blue/app test:browser
pnpm --filter @blue/app test:performance
pnpm --filter @blue/app test:performance:browser
pnpm --filter @blue/app test:performance:engine
pnpm --filter @blue/data test:performance
```

The performance commands run **three fresh Vitest processes**, in sequence, even
when an earlier round fails. Test, setup, and collection errors fail the command.
The meter comparison is evaluated once across all fixed pairs, while the other
performance cases retain their existing assertion semantics. Set
`BLUE_PERFORMANCE_ROUNDS=1` for a local diagnostic run; manual CI uses the default three.
This is fixed repetition, not retry-until-pass. Do not run other builds or test
commands concurrently with measurements.

Browser performance uses the Chromium version pinned by the installed Playwright
dependency. Install it with `pnpm --filter @blue/app exec playwright install chromium`
(add `--with-deps` on CI). The ordinary browser suite defaults to installed Chrome;
`BLUE_TEST_BROWSER_CHANNEL=chromium` selects Playwright's Chromium in CI.

Engine performance requires a built Blue Engine and a loadable **Csound 7** runtime.
Build the engine with `pnpm --filter @blue/engine-native build`. `BLUE_ENGINE_PATH`
may select an explicit engine binary and `LIBCSOUND_PATH` an explicit Csound library.
The dedicated suite enables `BLUE_RUN_REAL_ENGINE=1`, probes prerequisites, and
fails collection/setup if they are unavailable. Ordinary engine integration tests
retain their existing availability rules.

## Measurement inventory

The runner checks that each round selects exactly eight app Node, four browser,
five engine, or four data cases. Update the inventory and expected counts together when adding/removing
a case. A Node timing check must carry `performance`; an engine timing check must
carry both `performance` and `real-engine`.

| Suite       | Cases and preserved budgets                                                                                                                                                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node (8)    | Opcode menu: every warm sample <50 ms; 500-node Custom menu <1 s; 500-node Code Repository React/JSDOM commit <2 s; 1,000-target score color patch <1 s; 600-UDO completion requests p95 <100 ms; 1,000-clip history coordinator commit/undo/redo p95 ≤200 ms; 10,000-item library browse/search/preview limits; 600 direct BlueX7 model edits p95 <100 ms. |
| Browser (4) | 64-strip meter FPS/interaction regression ≤20%; component-only history publication-to-paint p95 ≤200 ms; renderer history routing through two views p95 ≤200 ms plus injected-error handler ≤1 s; dense 64×256 pattern grid React commit <5 s.                                                                                                              |
| Engine (5)  | 300-gate publication through applied echo <100 ms; real undo/redo with positive timeline and Blue Live readback p95 ≤250 ms; meter delivery ≥30 Hz with no gap ≥200 ms; stop request to meter reset <1 s; short-score startup/playback/natural reset <5 s.                                                                                                  |
| Data (4)    | Load 100 clips <500 ms; generate their CSD <200 ms; save 100 clips <100 ms; build/clone/save/load the 1,000-clip, 32-instrument, 128-parameter fixture <1,000 / <500 / <1,000 / <2,000 ms respectively.                                                                                                                                                     |

All these budgets remain separate from ordinary test timeouts, which prevent hangs.
Deterministic work-count/render-count guards, fake-clock debounce/grouping tests,
and audio sample/duration/output equivalence remain in correctness testing.

The redundant mock-engine command-to-failure <1 s assertion was removed from the
functional test: its timing boundary did not represent the specification's
failure-determination-to-visible-error requirement. Failure outcomes and canonical
commit preservation remain asserted, and the browser reporting budget remains.

## Results and interpretation

The workspace runner is `scripts/run-performance-tests.mjs`, shared by both packages.
App commands write `packages/blue-app/performance-results/<suite>/` (`node`, `browser`,
or `engine`); data measurements write `packages/blue-data/performance-results/data/`:

- `measurements.json`: package, tested revision, dirty-checkout flag, OS/architecture/CPU,
  Node/Vitest versions, browser version or engine/Csound probe, selected case results,
  raw metric samples, paired observations, and summaries for each round, plus an explicit verdict.
- `round-<n>.json`: Vitest's test report, including failures and filtered cases.
- `round-<n>.log`: complete output, including measurements recorded before budget
  assertions. A failing budget retains its measurements.

Metric labels state the measured boundary. The shared helper reports p50/p95 using
nearest rank (`ceil(p × n) - 1`), consistently across completion and history checks.
The opcode menu now records five warmups followed by 40 measured calls, enforcing
the existing 50 ms limit on the maximum. Existing cold/single-call workloads remain
single observations per fresh process; three observations do not establish a reliable
tail-latency distribution. Browser frame intervals and interaction batches are retained.

These measurements do not all establish user-visible acceptance. In particular:

- React/JSDOM and grid commit timings exclude browser paint.
- Library tests use in-memory SQLite and time service work, excluding renderer display.
- Direct BlueX7 model edits exclude engine acknowledgement and audible output.
- Coordinator timings exclude production view painting. Browser history uses a main
  stand-in, and error timing currently ends at the handler before toast paint.

The separate packaged verifier `pnpm --filter @blue/app verify:global-history`
continues to measure native Electron menu commands through painted restoration.
Specification acceptance on the supported reference setup remains authoritative;
lower-level measurements aid diagnosis and do not replace it. Follow-up measurement
work should address the remaining boundaries above, representative disk workloads,
and controlled platform baselines before selecting tight blocking gates.

## Paired meter comparison (SC-003)

Each fresh process collects four fixed pairs in AB, BA, AB, BA order, where A is
non-metering baseline and B is the metered fixture. Both phases mount the same
64-strip workload afresh, allow 250 ms of settling, warm the interactions, and
skip the first three animation frames. Setup is excluded. Each phase records all
frame intervals across at least 1,500 ms and five interaction batches, verifies
that real handlers ran, and tracks page visibility. The feeder runs only in the
metered phase, preserving the feature's telemetry cost.

Frame throughput is `frame interval count × 1,000 / sum(frame intervals in ms)`.
Frame-time medians and p95 values remain diagnostic data; their reciprocals are
not used as FPS. For each pair, calculate metered/baseline FPS and interaction-time
ratios. Evaluate the median of those ratios across all planned pairs (12 in the
standard three-round run). A valid comparison passes only when FPS ratio ≥0.8 and
interaction ratio ≤1.2, with no rounding or absolute-time escape. Every observation,
including isolated slow pairs, remains in the artifact.

Before applying that budget, require all planned baseline observations to satisfy
this initial environment-health policy:

- Both measured phases remained visible.
- Every baseline sustained at least 24 actual FPS.
- Each baseline's frame-time p95 is no greater than twice its median.
- Baseline throughput spread, `(maximum - minimum) / maximum`, is at most 20%
  across the planned pairs.

These conservative comparability rules are declared before collecting results;
they are not product responsiveness targets. An unhealthy baseline yields
**INCONCLUSIVE**, not a pass or a measured regression. No pairs are discarded to
obtain a favorable result. Candidate-only stalls do not invalidate the baseline
or excuse a regression. Missing pairs, incorrect order, invalid samples, skipped
performance cases, broken handlers, and setup failures remain errors. Inconclusive results
require follow-up on stable, controlled reference hardware before acceptance.

The browser test itself collects observations and asserts functional behavior;
use `test:performance:browser` to obtain the aggregate performance verdict.
`measurements.json` and the GitHub job summary distinguish PASSED, FAILED,
INCONCLUSIVE, and ERROR. A failed budget or test/collection error exits nonzero.
An inconclusive run exits successfully **as collection**, emits a warning, and
explicitly does not establish performance acceptance. The CI job is named
“Measurement collection” to reflect this distinction. A green collection check
alone is insufficient for release performance sign-off.

## CI policy

Ordinary PR validation continues to run workspace correctness tests, lint, builds,
packaging, and smoke checks across Windows, macOS, and Linux. The separate
`.github/workflows/browser-correctness.yml` runs the full browser correctness suite
on Linux for PRs to develop/main and develop pushes. Both normal test configurations
exclude the tagged performance cases; deterministic tests of the measurement and
verdict helpers remain part of ordinary correctness testing.
The data package's default configuration also excludes its tagged speed cases,
including when invoked by root `pnpm test`.

`.github/workflows/performance.yml` supports **manual dispatch only**. Use it for
targeted cross-platform investigation when useful. It collects serial app Node/data/browser
measurements on Windows, macOS, and Linux, plus real-engine measurements on Linux
with Csound 7.0.0, and uploads observations and job summaries. Node failure does not
suppress browser observations. There is no scheduled performance collection.

Hosted-runner measurements are diagnostic evidence, not the reference for release
performance acceptance. Shared hosted runners can remain noisy despite serial
execution. Collection errors and measured failures remain visible; inconclusive
comparisons receive explicit warnings and verdicts. A green collection status does
not replace a passing measurement on controlled reference hardware. Performance
collection is not a required branch check; this change does not modify GitHub
branch protection or product performance budgets.

## Data separation verification

`packages/blue-data/tests/integration/performance-benchmark.test.ts` now defines
four shared workloads, each registered as correctness and tagged measurement cases.
The normal suite exercises loading, CSD generation, cloning, saving, and reloading
without reading the measurement clock or enforcing elapsed-time budgets. The opt-in
suite records the same seven operation boundaries and preserves their budgets.

- [x] Preserve all four workloads' model, count, CSD, clone, and XML round-trip
      assertions in default data correctness tests.
- [x] Select four tagged cases only with `pnpm --filter @blue/data test:performance`;
      normal selection runs four correctness cases and filters all four speed cases.
- [x] Collect three fresh processes, four measurement cases and seven raw timing
      observations per successful round (21 observations total), with package/revision
      and environment metadata. Missing timings cannot produce a passing collection;
      failed rounds retain observations recorded before the failure.

Data operations are cold/single observations after module/fixture setup, without
warmup or a statistical baseline comparison. Three such samples do not establish a
tail-latency distribution. The large fixture's build/clone/save/load boundaries are
measured independently, excluding its intervening correctness assertions. These
component measurements do not establish painted UI, engine, or audible latency.
Use the controlled reference configuration described above for acceptance.

## License and provenance

Application and workspace-runner changes remain in the existing GPL-3.0-or-later
scope; the runner moved from app scripts to repository scripts within that scope.
Data test/configuration additions are original within the data package's MIT scope.
Existing Vitest and Playwright dependencies are reused;
no new dependency or third-party source implementation is incorporated.
Documentation additions are original within their existing scopes; the developer
manual chapter retains its GFDL 1.3 license.

The engine CI job downloads the official
[Csound 7.0.0 Linux minimal runtime](https://github.com/csound/csound/releases/tag/7.0.0)
only into the runner's temporary directory, with SHA-256
`f74e897cbd1f266d85aaa0dc9d331dfb8fe4b976d8724b44aefe7eb5f4f6a43f`.
Csound's [COPYING](https://github.com/csound/csound/blob/7.0.0/COPYING) supplies its
LGPL-2.1 terms. The runtime is used as an external test dependency, is not bundled
into Blue or copied into observation artifacts, and does not change release inventories.
