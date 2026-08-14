# Quickstart: Validate Java BigDecimal Automation Parity

**Feature**: `073-bigdecimal-parity`

**Date**: 2026-08-14

**Status**: Implementation staged; current evidence recorded; final validation follow-ups remain

This guide validates the staged implementation. Normal validation consumes committed Java results and does not need Java, Maven, network access, or a Java Blue checkout.

## Prerequisites

- Node.js 22.x and pnpm 10.x
- CMake 3.21+, Ninja, vcpkg, and a C++17 compiler
- `VCPKG_ROOT` configured for the native build
- Csound 7 for integration and stress validation
- JDK 25, Maven, network/dependency cache, and the pinned Java Blue checkout only for optional fixture regeneration

Run commands from the workspace root unless a section says otherwise.

## 1. Verify the committed corpus

Confirm the canonical package exists and contains its three test sections:

```bash
test -f fixtures/java-blue-automation-parity/v1/manifest.json
test -f fixtures/java-blue-automation-parity/v1/realtime.tsv
test -f fixtures/java-blue-automation-parity/v1/resolution.tsv
test -f fixtures/java-blue-automation-parity/v1/offline.tsv
```

Expected result:

- manifest schema version is `1`;
- the manifest records exactly 2,048 seeded realtime cases plus curated cases;
- Java revision, reference source hashes, generator version, Java release, seed, command, and category counts are present;
- no timestamp or absolute local path appears in generated output.

## 2. Run focused portable-data parity tests

```bash
pnpm --filter @blue/data test
```

Expected result:

- every realtime fixture output matches raw Java bits;
- exact decimal parse/canonical text/scale/`doubleValue()` and legacy normalization pass;
- `Parameter` load, copy, save, reload, and nested-line synchronization preserve exact resolution;
- BSB widget-to-parameter synchronization and decimal resolution edits preserve `0.10`, exponent forms, and large scales;
- zero/negative and positive-underflow-to-zero resolutions remain unquantized;
- offline initialization and score fragments match Java `CSDRender` byte-for-byte.

## 3. Run engine-client and host contract tests

```bash
pnpm --filter @blue/engine-client test
pnpm --filter @blue/app test
```

The app command should be interpreted together with the Electron prerequisite. In
this workspace the non-Electron app suites pass, but six suites stop before test
collection because the installed `electron` package has no usable binary and
reports `Electron failed to install correctly, please delete node_modules/electron and try installing again`.
Do not delete the shared dependency tree as part of a
normal validation run.

Expected result:

- protocol version 2 encodes canonical resolution text with no `highPrecision`, numeric-resolution, or scale field;
- malformed lengths/text/counts and non-finite points fail with stable diagnostics;
- the Electron main bridge publishes the exact snapshot string without converting through a number;
- snapshots and patches retain authoritative `resolutionDecimal` while previews consume only the derived number;
- packaged runtime and engine capability metadata agree on protocol version 2 and `automation-decimal-v1`.

## 4. Run native unit and exact-bit tests

```bash
pnpm --filter @blue/engine-native test
```

For a focused rerun after the package creates its platform build directory:

```bash
ctest --test-dir native/blue-engine/build-darwin-arm64-debug \
  -R 'JavaBigDecimal|AutomationProtocol|AutomationManager' \
  --output-on-failure
```

Use the build directory matching the host target.

Expected result:

- native resolution parsing, exact binary64 construction/conversion, floor, remainder, and descending bias match fixtures;
- the production Java-linear evaluator matches every realtime result bit, including endpoints and duplicate times;
- the allocation test performs at least 10,000 prepared evaluations with zero upstream/system allocations and zero arena overflow;
- malformed or unpreparable definitions leave the prior store revision active;
- failure output identifies fixture ID and all relevant inputs.

## 5. Run integration tests

```bash
pnpm --filter @blue/engine-native test:integration
```

Expected result:

- the app/client protocol and native engine create/update exact-resolution automations end-to-end;
- live definition replacement remains allocation-free at the perform-thread adoption boundary;
- final values, channel rebinding, stop, and restart remain correct.

The native package unit/CTest path and its integration label passed in this
handoff. A full app-to-native localhost run through Electron remains
environment-scoped and should be repeated on a machine with a usable Electron
binary.

## 5a. Manual application smoke test for mutation reclamation

This complements the automated 300-mutation retirement-ring regression. Run the
app with a project containing one enabled automation channel and a positive
resolution:

1. Start playback and confirm the automation is actively changing its target.
2. While playback continues, disable and re-enable the automation; confirm the
   target stops and resumes without an audio-thread error or stale value.
3. Delete the automation, then recreate it with the same channel; confirm the
   new definition is used.
4. Clear the automation collection, recreate one automation, and start/stop
   playback again; confirm there is no crash, hang, stale channel write, or
   audible interruption attributable to the mutation.

The focused native `AutomationProtocolTests` covers these four operations over
300 control/performance handoffs. Manual testing is specifically for the
Electron UI, engine packaging, and audible behavior.

## 6. Check common-path and exact-path performance

Build a Release benchmark target using the host preset; for Apple Silicon:

```bash
cmake --preset macos-arm64-benchmark -S native/blue-engine
cmake --build --preset macos-arm64-benchmark --target benchmark_engine
```

Run the five-trial candidate against the retained Spec 072 baseline artifact:

```bash
native/blue-engine/build-macos-arm64-benchmark/benchmark_engine \
  --output native/blue-engine/benchmarks/073-candidate.json \
  --compare native/blue-engine/benchmarks/072-baseline.json \
  --trials 5 \
  --warmup-cycles 1024 \
  --measure-cycles 4096
```

If the implementation keeps the existing build-directory naming used by the package scripts, substitute that directory; do not change benchmark parameters between baseline and candidate.

Expected result:

- zero/negative-resolution `linear_32` median is no more than 5% slower than the Spec 072 baseline;
- ordinary-scale and large-scale `quantized_exact_32` costs are reported separately;
- exact-path correctness is never relaxed to pass the common-path gate;
- allocation/arena counters remain zero during measured audio cycles.

The current worktree contains no retained Spec 072 baseline artifact under
`native/blue-engine/benchmarks/`, so the candidate timings below are evidence for
the separate paths only; the 5% common-path comparison is not claimed.

## 7. Run sanitizer and 10-minute stress validation

Configure one sanitizer family at a time:

```bash
cmake --preset macos-arm64 -S native/blue-engine \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DENABLE_TSAN=ON
cmake --build --preset macos-arm64 --target test_csound_stress
TSAN_OPTIONS=halt_on_error=1 \
  native/blue-engine/build-macos-arm64/tests/cpp/test_csound_stress \
  --duration-seconds 600 \
  --exact-decimal-automation
```

Repeat with `-DENABLE_SANITIZERS=ON` for AddressSanitizer/UndefinedBehaviorSanitizer.

Expected result:

- zero crashes, deadlocks, races, sanitizer findings, arena overflows, or system allocations from decimal evaluation;
- zero audio deadline misses or stalls attributed to decimal evaluation;
- live exact-resolution edits retire and reclaim prepared arenas on the control thread;
- channel rebinding, completion, rewind, stop, and restart retain correct final values.

TSan, ASan/UBSan, and the 600-second stress run were not completed in this
handoff.

## 8. Run repository-wide validation

```bash
pnpm build
pnpm test
pnpm lint
```

The final non-Electron package build/lint checks and focused app suites pass. The
last aggregate `pnpm test` run passed all non-Electron packages and 303/309 app
files (2,781 tests passed and 2 skipped); the remaining six app files were blocked
before collection by the incomplete Electron binary described in Section 3.

## 9. Optional: regenerate Java fixtures

This is a maintainer audit, not a normal test prerequisite. The checkout must be at the commit recorded in `manifest.json` and must have the recorded reference-file hashes.

```bash
export JAVA_BLUE_ROOT=/absolute/path/to/pinned/java-blue
pnpm fixtures:java-automation:check -- --java-blue-root "$JAVA_BLUE_ROOT"
```

To intentionally replace the corpus after reviewing a Java reference change:

```bash
pnpm fixtures:java-automation -- --java-blue-root "$JAVA_BLUE_ROOT"
git diff -- fixtures/java-blue-automation-parity/v1
```

Expected result:

- check mode regenerates in a temporary directory and reports a byte-identical corpus;
- generation invokes actual Java Blue `Line`, `Parameter`/`Line` XML, editor snapping, and `CSDRender` paths;
- the ordinary Vitest/CTest commands continue to pass if Java is subsequently unavailable.

## Completion evidence

Record the following in the completed spec/task notes:

- Java Blue commit and source hashes from the committed manifest;
- fixture counts and standard-suite runtime;
- focused/package/root test, build, and lint results;
- exact-bit realtime and byte-exact offline pass counts;
- zero-allocation test count;
- five-trial common-path comparison and separate exact-path timings;
- sanitizer results and 10-minute stress outcome;
- supported-platform results or explicitly scoped platform follow-ups;
- documentation updated to state that only resolution is BigDecimal and positive resolution always selects the exact path.

## Validation evidence from 2026-08-14

- `pnpm --filter @blue/data test`: 165 files, 1,606 tests passed.
- Canonical corpus: 2,192 cases total (2,092 realtime, 80 resolution, 20 offline); TypeScript and native consumers passed their applicable sections.
- `pnpm --filter @blue/engine-client test`: 3 files, 35 tests passed.
- `pnpm test:scripts`: 13 tests passed.
- `pnpm build`: passed, including native Release, data/client, main/preload, and renderer builds.
- `pnpm lint`: passed across the workspace.
- Focused app contract suites: 9 files, 87 tests passed; the exact `0.10` bridge assertion is included.
- Native Debug CTest: 13/13 tests passed, including the production fixture parity, protocol, allocation, and stress targets configured for the suite.
- Native Release CTest: 13/13 tests passed after rebuilding the three parity targets that were absent from the existing Release tree.
- Focused mutation-reclamation regression: 300 alternating ENABLE, DISABLE, DELETE, CLEAR, and CREATE handoffs passed with zero deferred retirements in both Debug and Release protocol tests.
- Native integration label: 3/3 tests passed (`ChannelBridgeTests`, `CsoundIntegrationTests`, and `CsoundLifecycleStress`).
- Release benchmark candidate medians (five trials, 4,096 measured cycles): `linear_32` host average `0.501442us`, `quantized_exact_32` `5.76955us`, and `quantized_exact_large_scale_32` `9.8621us`; no Spec 072 baseline was available for the 5% comparison.
- The Java fixture regeneration check, sanitizer runs, 10-minute stress run, and Linux/Windows matrices remain follow-up validation rather than completed evidence.

## Final staged review status

The exercised exact-decimal, XML, protocol-v2, TypeScript, native, and offline paths are consistent with the feature contract. This is not yet a complete spec sign-off:

- T034, T046, T051/T052, T059-T061, and T066-T067 remain unchecked and are still required for the corresponding editor, generator, baseline, stress, sanitizer, fixture-provenance, and platform claims.
- T069 is complete: all four previously missing mutation cases now reclaim retired snapshots on the control thread, and the focused regression passes in both build configurations.
- Exact arithmetic uses an explicit recoverable host-workspace guard for extreme decimal inputs; the exercised corpus covers Java-compatible scales through 3,000. The literal FR-010 extreme-domain claim should be revisited when the remaining stress/edge validation is run.
