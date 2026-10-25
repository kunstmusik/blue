> Implementation complete and accepted for closure on 2026-10-25. The owner
> accepts the recorded SC-001 shortfall (32 samples 9.56% / 9.14%; 64 samples
> 11.49%). Native Windows/Linux release validation is deferred to
> T038/T053/T056/T059 and remains unchecked. The numerical benchmark threshold
> and correctness/regression limits are unchanged; cross-platform release
> acceptance is not claimed.

# Validation Quickstart: Mixer Generation Optimization

This guide describes the implemented acceptance harness. The archived arithmetic
results are research inputs, not passed acceptance gates. Native Windows/Linux
platform evidence is still pending (see `evidence/platform-acceptance.json`).
The accepted emitter improves the fixed primary by 9.56% and 9.14% at 32
samples in independent seven-pair runs and by 11.49% at 64 samples. T052 is
resolved by the scoped owner decision while its raw 32-sample numerical verdict
remains false. See `evidence/convergence-performance-results.json`. The macOS
matrix passes; native Windows/Linux release evidence remains pending.

## Prerequisites

- Install repository dependencies with the configured pnpm version and use the repository root for commands.
- Have a supported double-sample Csound 7 runtime, native engine build dependencies, and the existing managed-engine runtime/discovery setup available.
- Preserve unrelated work. The feature branch is `codex/118-mixer-optimization`; baseline revision is `6d884110241e55b779210eb93dee5071c0068c02`.
- Build/stage the engine through the existing app command; `BLUE_ENGINE_PATH` can override discovery when needed:

```sh
pnpm --filter @blue/app engine:prepare
```

- Use original fixture signals/effects. Generate paths with host path utilities; do not edit global path separators or use chmod as a Windows permission test.
- Reserve a native evidence directory outside tracked project state. On POSIX, for example:

```sh
mixer_evidence_root=$(mktemp -d)
```

On Windows PowerShell use `Join-Path ([System.IO.Path]::GetTempPath()) 'blue-mixer-evidence'`, create the directory, and set environment variables with `$env:NAME = 'value'` instead of POSIX inline assignments. Keep baseline/candidate paths containing spaces in the path-portability case.

## Existing regression commands

These commands exist and pass with the optimized emitter:

```sh
pnpm --filter @blue/data test src/blue-data/mixer-gate-csd.test.ts src/blue-data/csd-policy.test.ts src/blue-data/csd-disk-pruning.test.ts src/blue-data/mono-clip-panning.test.ts src/blue-data/mixer-optimization-csd.test.ts
pnpm --filter @blue/data test src/blue-data-csd-determinism.test.ts src/blue-data-csd-copy-safety.test.ts src/blue-data-csd-parity.test.ts src/blue-data-csd-disk.test.ts src/blue-live-csd.test.ts
pnpm --filter @blue/data test
pnpm --filter @blue/data build
pnpm --filter @blue/app test src/main/runtime-parameter-sync.test.ts src/main/mono-clip-panning.integration.test.ts
BLUE_RUN_REAL_ENGINE=1 pnpm --filter @blue/app test src/main/mixer-mute-solo.integration.test.ts
```

Expected: focused generation/binding/copy-safety regressions pass. Real-engine
tests require the built engine and runtime. Note one **pre-existing unrelated
defect**: with `BLUE_RUN_REAL_ENGINE=1`, Spec 111 cases T045/T080 currently
fail at generation with `AudioLayoutCompileError: MISSING_AUDIO_LAYOUT`
(AudioClip projects with panning enabled and no layout manifest); the Spec 118
live case disables panning in its fixture and is unaffected. The defect is
reported separately and is not feature acceptance.

## Implemented baseline/candidate capture and comparison

The feature harness lives in
`packages/blue-app/src/main/mixer-optimization.integration.test.ts` (capture,
compare, generation determinism, routing compatibility, tap values, bus
observation) with fixtures from `mixer-optimization-test-support.ts` and
decode/compare support from `mixer-optimization-render-support.ts`.

Capture (writes fixture CSDs, the deterministic prune-source wav, and
`baseline-manifest.json`; never claims audio acceptance):

```sh
BLUE_MIXER_CAPTURE=1 BLUE_MIXER_EVIDENCE_DIR="$mixer_evidence_root/baseline" pnpm --filter @blue/app test src/main/mixer-optimization.integration.test.ts
```

The baseline for this feature was captured in the pinned-revision worktree
`.worktrees/118-baseline` (revision `6d8841102…`, test-only exporter staged
inside the worktree; exporter and dirty-diff hashes are recorded separately in
the manifest). 379 capture entries cover the expanded comparison and benchmark matrix, lifecycle (44.1/48 kHz × ksmps
1/32/64/128), and benchmark inputs (durations sized for 1,024 warmup + 65,536
measured blocks per rate/block, e.g. 50 s at 44.1/32, 98 s at 44.1/64).

Compare (renders both revisions' CSD with the same double-sample Csound CLI;
missing runtime/baseline/scenario fails, never skips; structural reset-set and
binding-manifest equality enforced; whole-buffer residual limits 1e-12 linear
/ 1e-6 stateful; writes `comparison-results.json` when
`BLUE_MIXER_EVIDENCE_DIR` is set):

```sh
BLUE_RUN_REAL_ENGINE=1 BLUE_MIXER_BASELINE_DIR="$mixer_evidence_root/baseline" BLUE_MIXER_EVIDENCE_DIR="$mixer_evidence_root/candidate" pnpm --filter @blue/app test src/main/mixer-optimization.integration.test.ts
```

The Csound CLI is resolved from `BLUE_CSOUND_PATH`, PATH, or the common install
locations (`/usr/local/bin/csound`, `/opt/homebrew/bin/csound`) because
vitest workers may run with a stripped PATH.

## Scenario A — Local gains and reset lifecycle (implemented)

Tap-value cases (mono/stereo × zero/unity/non-unity/muted, pre/post-fader,
nonlinear/stateful effects, disk unchanged-path) assert independent expected
amplitudes. The lifecycle matrix compare (49 fixtures across rates/blocks)
passed with worst peak residual 0. Live gate/commit/automation behavior is
covered by the Spec 118 case in `mixer-mute-solo.integration.test.ts`
(`BLUE_RUN_REAL_ENGINE=1`).

## Scenario B — Candidate eligibility and observers (implemented, all deferred)

`mixer-optimization-csd.test.ts` pins the immediate accumulation path and the
flush barriers; `mixer-optimization.integration.test.ts` verifies an
interleaved bus observer sees the original partial contribution set against an
independently computed RMS model. Decision ledger: `evidence/candidate-decisions.md`
(sum/mac/vincr DEFER; remaining families rejected per research §5).

## Scenario C — Panning, modes and text compatibility (implemented)

`mono-clip-panning.integration.test.ts` adds whole-buffer float64 equivalence
for balance/stereoPan/dualPan with gated sends. Compare mode covers the
panning-matrix, metering, disabled-mixer, disk-pruned and direct-bus fixtures
against the baseline with residual 0. Legacy Java XML loads and re-saves
byte-identically.

## Implemented Release benchmark commands

The supplied-CSD mode is implemented in `native/blue-engine` (`--csd FILE` on
`benchmark_engine`; `--csd`/`--baseline-csd` on `scripts/benchmark.mjs`;
`benchmarkKind: mixer-generated-csd`, `schemaVersion: 1`; paired seeded
interleaving, default 7 trials, ≥7 enforced; metadata mismatches and
non-finite/incomplete windows fail). Supplied CSD defaults to 1,024 warmup
and 65,536 measured blocks. The default `--acceptance primary` gate requires
an unrounded median improvement of at least 10%; `--acceptance representative`
requires a median regression no greater than 5%. Metric validity is reported
separately. An apparent >5% regression triggers an independent seeded paired
run retained as `confirmation`; inconsistent runs remain unaccepted. Shorter
research runs require `--research` on both wrapper/native CLI and never pass
acceptance. Historical reports predating this correction do not establish a
performance acceptance verdict. Example for the primary 44.1 kHz/ksmps32
pair (the ksmps64 fixture is `…-98s.csd`):

```sh
pnpm --filter @blue/engine-native exec node scripts/benchmark.mjs --csd "$mixer_evidence_root/candidate-csd/primary-send-heavy-44100-32-50s.csd" --baseline-csd "$mixer_evidence_root/baseline/primary-send-heavy-44100-32-50s.csd" --trials 7 --cycles 65536 --output "$mixer_evidence_root/primary-32.json"
```

Acceptance requires capture schema v2 manifests beside both supplied CSDs
(`baseline-manifest.json`), or explicit `--candidate-manifest FILE` and
`--baseline-manifest FILE`. Captures must use the same exporter and original
input identity. Prior schema v1 captures remain archived and must be regenerated
from the pinned baseline. Native reports retain the loaded-library hash and
verified precision/effective header; the wrapper retains executable identity,
CPU/OS and the benchmark compiler command from `compile_commands.json`. A
build without compiler-command evidence fails explicitly. Capture mode alone
continues to record `audioAccepted: false`.

Historical fixed-scenario mode is unchanged:

```sh
pnpm --filter @blue/engine-native exec node scripts/benchmark.mjs --trials 7 --cycles 4096
```

Reference-host results (this Mac, shared machine): ksmps32 −9.7…−10.0%,
ksmps64 −8.2…−11.2% across paired runs — see `evidence/us1-results.json`
(raw artifacts in `evidence/us1-raw/`). The deciding SC-001 ≥10% verdict
requires the isolated reference-platform runs recorded in
`evidence/platform-acceptance.json`; measurement jobs must run alone.

## Final implementation checks

```sh
pnpm --filter @blue/app build:main
pnpm --filter @blue/engine-native test
pnpm --filter @blue/engine-native test:integration
pnpm test
pnpm lint

git diff --check
```

Run changed native benchmark argument/report tests and its Release build
through the wrapper as well (`node scripts/benchmark.test.mjs` runs within
`pnpm --filter @blue/engine-native test`). Record any unavailable
platform/runtime explicitly rather than marking the feature accepted.

## Evidence to retain

- Pinned baseline/candidate revisions, dirty-diff/exporter hashes, original
  fixture/CSD/binding hashes, and provenance (`evidence/baseline-manifest.json`,
  `evidence/provenance.json`).
- Per-fixture format/frame/finiteness/residual results plus structural
  tap/observer/control tests and live-trace identity
  (`evidence/foundation-results.json`, `evidence/compatibility-results.json`).
- Release/runtime/OS/CPU/compiler/threading metadata, raw paired trials,
  medians and gates (`evidence/us1-results.json` + `us1-raw/`,
  `evidence/us2-results.json` + `us2-raw/`).
- Accept/defer/reject ledger: `evidence/candidate-decisions.md`.
- Platform acceptance (macOS recorded; Windows/Linux pending):
  `evidence/platform-acceptance.json`.

The [archived microbenchmark](evidence/microbenchmark.py) may be reproduced for
research by first copying it into a temporary directory. It writes generated
CSD/raw/results alongside itself, uses Python's Unix-only resource timing, and
is not the cross-platform release harness.

## Convergence validation details

- Historical captures remain under `.worktrees/118-evidence/
  convergence-final-baseline` and `convergence-final-candidate`. Current Phase 8
  captures are `phase8 final baseline` and `phase8 final candidate`; capture schema
  v2 records complete original-input and binding hashes, expected frames and
  declared amplitude bounds. Capture can run without a runtime and records
  `csoundRuntime: null`, `audioAccepted: false`; explicit render acceptance
  still fails without the actual double runtime, baseline, or engine binary.
- CLI comparisons use `--sample-accurate -j1`, complete float64 buffers and
  independent frame/range/finiteness checks. Runtime evidence includes actual
  CLI path/hash/version, OS/CPU, options and user-rc hash.
- The managed trace compares actual timeline and BlueLive CSD against pinned
  artifacts, with block-scheduled bank/send controls, exact applied echoes,
  meter taps and repeated engine recreation inside one managed session.
- Use the original BlueX7 corpus disk ksmps1 setting. Baseline ksmps64 probes
  stall; the renderer timeout stops stalled subprocesses. A separate four-
  thread baseline small-single run violates its declared amplitude bound, so
  the temporary vincr prototype's concurrency requirement is unresolved and
  vincr remains deferred. These cases are not counted as acceptance passes.
- T052 is resolved by the Phase 8 scoped owner decision. The numerical
  >=10% gate still fails at 32 samples; do not rerun it merely to obtain a
  pass. T038/T053/T056 retain their platform and representative regression
  obligations, including native Windows/Linux evidence. Residual limits and
  the <=5% representative regression bound remain unchanged.

## Phase 8 evidence and native utility disposition

Use a fresh capture/comparison directory each time. Capture and comparison
now reject existing manifests/reports instead of overwriting prior evidence.
For a pinned pre-change generator, select only the capture test (`-t
'writes fixture CSDs'`); candidate-only optimized-text assertions in the full
ordinary test file are intentionally not baseline assertions.

The expanded capture covers 44.1/48 kHz x ksmps32/64/128 for representative
correctness and full-window timing, including explicit mono/stereo/4-channel
routing. The fixed primary workload is unchanged. The original 44.1 kHz PCM
pruning fixture has a mathematically derived 1.25x raw-peak output bound only
when resampled: four-point cubic Lagrange weights have absolute sum
1+t(1-t) <=1.25. No PCM, authored DSP, residual limit, normalization, or full-
scale overflow limit changed. The earlier incorrect raw-peak bound failure
is retained as evidence, not erased. See provenance.json for references.

The separate native integration suite remains 4/5. T057 has a scoped
validation exception in `evidence/phase8-native-utility-disposition.json`.
With the installed Csound library, utility enumeration on a fresh instance
is empty; Blue's unchanged wrapper rejects sndinfo before calling it. A
standalone direct Csound API call succeeds and prints the exact file path
with spaces. This is a validation fallback, not a production runtime repair.
Reproduce from the repository root (substitute the native library path on
other systems):

```sh
python3 specs/118-mixer-optimization/evidence/native-utility-repro.py /Library/Frameworks/CsoundLib64.framework/CsoundLib64 examples/techniques/hellorcb.aif
```

The original failure and unchanged native source identities are retained.
Mixer renders, managed-live controls, channel bridge, lifecycle, and metering
checks remain required. Owner SC-001 acceptance does not waive those checks.

### Dedicated representative timing (T056)

After correctness checks finish, run this command alone, with no competing
validation jobs. The output directory must not exist. It runs twelve workloads
at both sample rates and all three reference block sizes (72 cases), with
seven paired full-window trials per case. The wrapper independently confirms
apparent >5% regressions; every raw report and confirmation is retained. The
SC-001 owner decision and its historical numerical results are unchanged.

```sh
pnpm exec node specs/118-mixer-optimization/evidence/run-representative-matrix.mjs "$mixer_evidence_root/baseline" "$mixer_evidence_root/candidate" "$mixer_evidence_root/representative-timing"
```

The Phase 8 macOS run passes all 72 SC-002 comparisons (maximum measured
regression +3.6083%; all metrics valid, no >5% confirmation triggered).
Current raw index: `.worktrees/118-evidence/phase8 macOS representative/
matrix-index.json`. Summary and verified report hashes:
`evidence/phase8-representative-results.json`. Windows/Linux remain unavailable
and T038/T053/T056 remain unchecked; macOS evidence is not a platform waiver.
