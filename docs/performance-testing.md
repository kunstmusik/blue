# Application performance testing

Normal application tests verify behavior independently of host speed. Tests that
enforce elapsed-time, frame-rate, or delivery-rate budgets carry Vitest's native
`performance` tag. Normal Node and browser configurations filter that tag out;
dedicated configurations select it and run one file/worker at a time, without retries.
The `real-engine` tag further separates engine measurements from Node measurements.
See [Vitest test tags](https://vitest.dev/guide/test-tags).

Mixed workloads use one local scenario function with two test entries: functional
and performance. Both exercise the same state changes and correctness assertions;
only the performance entry enforces speed. This preserves large-fixture, pagination,
history restoration, ownership, and lifecycle coverage without duplicating fixtures.
Filtered cases appear as skipped in Vitest output; the dedicated runner checks the
selected performance cases separately and rejects missing/skipped measurements.

## Commands

Run from the repository root after installing and building `@blue/data` and
`@blue/engine-client`:

```sh
pnpm --filter @blue/app test
pnpm --filter @blue/app test:browser
pnpm --filter @blue/app test:performance
pnpm --filter @blue/app test:performance:browser
pnpm --filter @blue/app test:performance:engine
```

The performance commands run **three fresh Vitest processes**, in sequence, even
when an earlier round fails. Each command fails if any round fails. Set
`BLUE_PERFORMANCE_ROUNDS=1` for a local diagnostic run; CI uses the default three.
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

The runner checks that each round selects exactly eight Node, four browser, or five
engine cases. Update the inventory and expected counts together when adding/removing
a case. A Node timing check must carry `performance`; an engine timing check must
carry both `performance` and `real-engine`.

| Suite       | Cases and preserved budgets                                                                                                                                                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node (8)    | Opcode menu: every warm sample <50 ms; 500-node Custom menu <1 s; 500-node Code Repository React/JSDOM commit <2 s; 1,000-target score color patch <1 s; 600-UDO completion requests p95 <100 ms; 1,000-clip history coordinator commit/undo/redo p95 ≤200 ms; 10,000-item library browse/search/preview limits; 600 direct BlueX7 model edits p95 <100 ms. |
| Browser (4) | 64-strip meter FPS/interaction regression ≤20%; component-only history publication-to-paint p95 ≤200 ms; renderer history routing through two views p95 ≤200 ms plus injected-error handler ≤1 s; dense 64×256 pattern grid React commit <5 s.                                                                                                              |
| Engine (5)  | 300-gate publication through applied echo <100 ms; real undo/redo with positive timeline and Blue Live readback p95 ≤250 ms; meter delivery ≥30 Hz with no gap ≥200 ms; stop request to meter reset <1 s; short-score startup/playback/natural reset <5 s.                                                                                                  |

All these budgets remain separate from ordinary test timeouts, which prevent hangs.
Deterministic work-count/render-count guards, fake-clock debounce/grouping tests,
and audio sample/duration/output equivalence remain in correctness testing.

The redundant mock-engine command-to-failure <1 s assertion was removed from the
functional test: its timing boundary did not represent the specification's
failure-determination-to-visible-error requirement. Failure outcomes and canonical
commit preservation remain asserted, and the browser reporting budget remains.

## Results and interpretation

Each command writes `packages/blue-app/performance-results/<suite>/`:

- `measurements.json`: tested revision, dirty-checkout flag, OS/architecture/CPU,
  Node/Vitest versions, browser version or engine/Csound probe, selected case results,
  raw metric samples and summaries for each round.
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
- The metering comparison retains its existing baseline-then-candidate order, so
  ordering bias remains a measurement limitation.

The separate packaged verifier `pnpm --filter @blue/app verify:global-history`
continues to measure native Electron menu commands through painted restoration.
Specification acceptance on the supported reference setup remains authoritative;
lower-level measurements aid diagnosis and do not replace it. Follow-up measurement
work should address the boundaries above, repeated comparative rounds, representative
disk workloads, and platform variability before selecting tight blocking gates.

## CI policy

`.github/workflows/performance.yml` runs on PRs to develop/main, develop pushes, and
manual dispatch. It runs serial Node/browser measurements on Windows, macOS, and
Linux, correctness for the three migrated browser files on Linux, and real-engine measurements on Linux with
Csound 7.0.0. It uploads observations and writes job summaries. Measurements run in
separate jobs from the installer workflow, so a failed speed budget does not prevent
installer generation. Node failure does not suppress browser observations.

The new measurement statuses are intended to be advisory while collecting baselines;
they still report failures visibly. Do not configure them as required branch checks
until repeatability and runner suitability have been established. This change does
not modify GitHub branch protection. Shared hosted runners can remain noisy despite
serial execution; keep the existing product requirements and use controlled runners
where tight realtime acceptance needs them.

The broader 20-file browser suite is not made required by this change. A local cold
Chromium run exposed eight failures in three existing, unrelated files: one fader
layout/drag expectation and seven hook errors associated with dependency optimizer
reloads in arrangement and tree movement. These need a separate browser-harness
investigation. The scoped CI check covers the migrated functional cases without
skipping or changing those unrelated assertions.

## License and provenance

Test/configuration changes are original work within the existing GPL-3.0-or-later
repository/application scope. Existing Vitest and Playwright dependencies are reused;
no new dependency or third-party source implementation is incorporated.

The engine CI job downloads the official
[Csound 7.0.0 Linux minimal runtime](https://github.com/csound/csound/releases/tag/7.0.0)
only into the runner's temporary directory, with SHA-256
`f74e897cbd1f266d85aaa0dc9d331dfb8fe4b976d8724b44aefe7eb5f4f6a43f`.
Csound's [COPYING](https://github.com/csound/csound/blob/7.0.0/COPYING) supplies its
LGPL-2.1 terms. The runtime is used as an external test dependency, is not bundled
into Blue or copied into observation artifacts, and does not change release inventories.
