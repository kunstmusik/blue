# Implementation Validation Records

Feature: Mixer Generation Optimization (`codex/118-mixer-optimization`)
Baseline production revision: `6d884110241e55b779210eb93dee5071c0068c02`

**Current status (2026-10-25): INCOMPLETE / NOT ACCEPTED.** Convergence fixes
T041–T051 and T054 are implemented. T052 is resolved by the Phase 8 scoped
owner decision despite the numerical >=10% failure at 32 samples. T038/T053
still require platform evidence; T057 records a scoped utility exception. The
checkpoint and raw evidence references at the end supersede earlier
provisional acceptance wording.

## Phase 1 — Setup (T001–T003)

### T001 Licensing and provenance recheck (2026-10-24)

- `LICENSING.md` scope map re-read. Affected scopes: `packages/blue-data` (MIT,
  Apache-2.0 msfa tables already inventoried), `native/blue-engine` (MIT,
  MPL-2.0 libzmq static link and BSL-1.0 Boost headers already inventoried),
  `packages/blue-app` (GPL-3.0-or-later repository default for host test code).
- `packages/blue-data/LICENSE`, `packages/blue-data/package.json`,
  `packages/blue-data/THIRD_PARTY_NOTICES.md`,
  `native/blue-engine/LICENSE.txt`, `native/blue-engine/package.json`,
  `native/blue-engine/THIRD_PARTY_NOTICES.md`, and affected file headers were
  re-checked. No new dependency, asset, bundled table, or third-party snippet is
  introduced by this feature; existing inventories remain accurate.
- Java reference (`~/work/nbprojects/blue`, pinned revision
  `3ca3f40579c48a023299a68130d8ab6b9e950974`, GPL-2.0 files) and Csound
  sources (LGPL-2.1-or-later, inspected at `efbcabb4d56e6237e2cabc9949cfadadda946cf9`)
  remain behavioral references only; no source is translated or copied.
- `evidence/provenance.json` updated with the original-code scope statement and
  the local host/runtime identities. No third-party material incorporated.

### T002 Data-model/boundary audit and baseline regressions (2026-10-24)

- Planned diff audited against `data-model.md` and `docs/modularization.md`:
  - Canonical models, XML, history, IPC, and `arrangement.ts` are untouched.
    The only production edit is inside `generateBlueMixer`/`applyEffectsChain`
    in `packages/blue-data/src/blue-data/csd-policy.ts` (existing owner).
  - Combined send gain and the final clear set remain ordinary compile-local
    values inside one BlueMixer emission call: deterministic allocation,
    discarded after generation, no serialized or cross-render cache, no durable
    writer, no migration.
  - No new module boundary is created; the two local changes stay in the
    existing policy façade per the modularization review rule.
- Baseline regressions (pre-change, recorded separately from any acceptance):
  - `pnpm --filter @blue/data test`: 221 files passed, 1 skipped file;
    3089 tests passed, 1 skipped (3089+1). Exit 0.
  - `pnpm --filter @blue/app test src/main/runtime-parameter-sync.test.ts
    src/main/mono-clip-panning.integration.test.ts`: 2 files, 27 tests passed.
    Exit 0. (Render sub-suites may skip without a CLI runtime; not acceptance.)
- Runtime `clear` argument verification (prerequisite for T016 batching):
  with local Csound 7.0 double (`efbcabb…`, see T003), `clear` with 1024
  inputs compiles and performs; 2000 inputs fails with
  `syntax error, Found 2000 inputs for clear which is more than the 1999
  allowed`. The emitter therefore keeps one statement for realistic fixtures
  and splits deterministically at the verified 1999-input bound.

### T003 Engine build and host prerequisites (2026-10-24)

- `pnpm --filter @blue/app engine:prepare` completed (exit 0); staged engine at
  `packages/blue-app/.engine-stage/blue-engine` from the darwin-arm64 Release
  build. Stage artifact identity (`artifact.json`): engineVersion 0.1.0,
  protocolVersion 2, sourceRevision `6d8841102…` (matches the pinned baseline
  revision; the working tree is at that revision with only the untracked
  `specs/118-mixer-optimization/` present), buildType Release, sha256
  `09e3d70bfed717fa203140dd32670a417073779f4a76a0e85d532794801fe698`.
- Engine discovery: `BLUE_ENGINE_PATH` override supported;
  `developmentEnginePath(root, platform, arch)` and
  `native/blue-engine/build-<platform>-<arch>/<exe>` fallbacks exist in the
  app test convention (`resolveAcceptanceEnginePath` in
  `mixer-mute-solo.integration.test.ts`). Production discovery is unchanged.
- Csound runtime: `/usr/local/bin csound` on PATH — Csound 7.0 double samples,
  build `Oct 19 2026 [commit: efbcabb4d56e6237e2cabc9949cfadadda946cf9]`
  (the exact revision inspected in research.md).
- Reference host: macOS 14.2.1, arm64. Native build tools present (cmake,
  vcpkg baseline `9d7f79f56ae1a9b4704d6a7fb8237e347a974133`, triplet
  `blue-arm64-osx`).
- Evidence directories are caller-selected (tmp dirs / env-provided paths).
- Pending platform evidence (not a passed gate): native Windows and Linux
  correctness/performance runs are still missing on this host; recorded as
  incomplete until T038 runs there.

## Phase 2 — Foundation (T004–T012)

Completed 2026-10-24, before any production emitter edit (working tree at
`6d8841102…` plus test-only/spec files, recorded via dirty-diff/exporter hashes).

- **T004** `packages/blue-app/src/main/mixer-optimization-test-support.ts`:
  original deterministic fixtures built through public `@blue/data` APIs — the
  128-strip/4-send/8-subchannel primary fixture, small (1/16 strips), fan-in
  groups 2/4/8/16/32 (unweighted/weighted/direct-bus-input), barrier-rich
  (pre/post sends around controlled one-pole stateful and tanh nonlinear
  effects, a nested bus-observer effect), panning matrix (balance/stereo
  pan/dual pan/mono source), metering, disabled-mixer, muted disk-pruned
  (AudioClip), sound-then-silence, zero/unity/non-unity/muted send levels, and
  a representative 8-voice additive project. Benchmark durations cover
  1,024 warmup + 65,536 measured blocks plus margin per rate/block
  (e.g. 50 s at 44.1 kHz/ksmps32, 98 s at 44.1 kHz/ksmps64); comparison
  fixtures use 2 s scores. Fixture identity = sha256 of a canonical descriptor
  (options + routing + score text), stable across revisions.
- **T005/T006** decoder/comparison contract tests (11 cases) and the host-only
  `mixer-optimization-render-support.ts` helper: float64 and float32 WAV
  decoding without a Float32 intermediate, explicit rejection of malformed/
  truncated/unsupported output, independent finiteness assertions (a NaN delta
  never wins the residual peak comparison), equal rate/channel/format/frame
  checks, and whole-buffer residual limits 1e-12 (linear) / 1e-6 (stateful)
  with proof that plateau-only or Float32-cast comparisons cannot hide the
  covered failure classes. No production `@blue/data` host import.
- **T007** `mixer-optimization.integration.test.ts` modes: default
  generation-determinism + failure-contract tests (missing/malformed baseline
  manifest, CSD hash mismatch, absent scenario, identity mismatch — all fail
  explicitly); `BLUE_MIXER_CAPTURE=1`+`BLUE_MIXER_EVIDENCE_DIR` capture writing
  per-fixture CSD + hashed manifest (`audioAccepted: false` — capture alone
  never claims audio acceptance); `BLUE_RUN_REAL_ENGINE=1`+
  `BLUE_MIXER_BASELINE_DIR` compare mode rendering both revisions with the
  same double-sample Csound CLI (runtime resolution: PATH → common install
  locations → `BLUE_CSOUND_PATH`; explicit failure when absent) and enforcing
  whole-buffer/structural/binding equality. Binding manifests compare
  structure only: per-compilation runtime identities (per-process counters in
  `*Identity` fields) are scrubbed; ordinals, bank symbols, initial values,
  routes, associations, and parameter names are exact.
- **T008** immutable baseline captured before emitter edits: 84 fixture CSDs +
  manifest at the evidence root (identity recorded in
  [baseline-manifest.json](baseline-manifest.json), artifacts under the
  caller-selected evidence directory). Baseline revision
  `6d884110241e55b779210eb93dee5071c0068c02` with test-only exporter staged;
  exporter and dirty-diff hashes recorded separately in the manifest.
- **T009–T011** native branch: `benchmark.test.mjs` (17 tests: argument/
  report contracts, spaces/synthetic Windows paths, metadata mismatches,
  non-finite/zero/incomplete-window gates, seeded paired ordering),
  `benchmark_main.cpp --csd FILE` mode (mutually exclusive with
  `--scenario`/`--compare`; derives sr/ksmps/nchnls from the supplied CSD and
  cross-checks the engine snapshot; ≥1,024-cycle warmup; incomplete
  65,536-cycle window fails; `benchmarkKind: mixer-generated-csd`,
  `schemaVersion: 1`; original FIPS 180-4 SHA-256, no new dependencies), and
  `benchmark.mjs --csd/--baseline-csd` paired seeded interleaving (default
  7 trials, same Release executable/runtime for both sides, metadata matching,
  raw trials + medians + delta retained). Historical fixed-scenario mode
  verified unchanged (23 scenarios, same gate shape).
- **T012** foundation proof: audio self-comparison of the unchanged baseline —
  all 21 comparison fixtures render with peak residual 0 (limit 1e-12/1e-6),
  identical ordered reset sets and structural bindings
  (`comparison-results.json` `audioAccepted: true`); native self-comparison on
  the captured 128-strip 44.1 kHz/ksmps32 fixture — 7 paired trials,
  medianDeltaPct +0.23% (noise; identical CSD both sides), gate passed, median
  ≈ 89.6 µs/block. No baseline-vs-itself speedup is claimed. Recorded in
  [foundation-results.json](foundation-results.json).

Only now may the emitter change.

## Phase 3 — User Story 1 (T013–T020)

Completed 2026-10-25.

- **T013** `packages/blue-data/src/blue-data/mixer-optimization-csd.test.ts`: 12
  focused expectations authored before the emitter change (verified failing
  against the pre-change forms): one tap-local k-rate product
  (`kMixSendGain = amount * gate`) shared across channels, immediate
  expiry before the next send, mono sharing, authored-unity combination,
  unchanged disk/ungated/fixed-muted paths, deterministic scratch symbol, the
  exact ordered final clear set after `outc` and the applied echo, disk-pruned
  sources retained, no zero-argument clear, and deterministic splitting below
  the verified 1,999-input runtime limit.
- **T015** `applyEffectsChain` in `csd-policy.ts`: live-gated non-unity sends
  emit one k-rate `kMixSendGain` product at the tap, reused by that send's
  channel accumulations, emitted immediately before them. Unity, no-gate,
  disk (fixed-gate) paths keep their exact prior text. Scratch allocation is a
  fixed symbol, independent of parameter/gate/panner ordinals.
- **T016** the three final reset loops replaced by one ordered `clear` over
  the identical variable sequence (sources with channel ids — including
  disk-pruned ones —, render-ordered subchannels, master), after output and
  live applied-token echo; deterministic ≤1,999-argument groups.
- **T017** narrow exact-text updates only: `mixer-gate-csd.test.ts` (3 send-tap
  assertions), `mono-clip-panning.test.ts` (1), `csd-disk-pruning.test.ts` (1
  clear-list assertion). The BlueX7 checked-in fixture regenerated through its
  own `BLUE_X7_REGEN_FIXTURE=1` contract; its diff is exactly the six `= 0`
  lines replaced by one `clear` line. Intentional Java generated-text
  divergence: the combined send-gain statement and the batched clear statement
  differ from Java Blue's generated per-channel two-sweep accumulation and
  per-variable zero assignments. All unrelated text expectations unchanged.
- **T014** independent tap-value cases (mono/stereo, zero/unity/non-unity,
  pre/post-fader, muted, controlled nonlinear/stateful effects, disk
  unchanged-path) pass against mathematically expected amplitudes.
- **T018** lifecycle matrix: baseline re-captured in a pinned-revision
  worktree (`.worktrees/118-baseline`, production revision
  `6d8841102…`, exporter staged and hashed separately per the plan's
  worktree rule); candidate comparison across 44.1/48 kHz × ksmps
  1/32/64/128 for the send-level/silence/single/barrier fixtures — 49
  fixtures, worst whole-buffer peak residual **0**, identical ordered reset
  sets and structural bindings.
- **T019** live managed-engine trace (`mixer-mute-solo.integration.test.ts`,
  Spec 118 case): generated realtime + BlueLive CSDs use the combined-gain
  statements (2 sends); a live engine performance with an initial muted strip
  shows the closed window matching the baked closed reference and the open
  window matching the baked open reference to ~1e-10 RMS after a full-vector
  bank commit with observed applied-token echo, and a live automated send
  amount change (0.5 → 0.25) matching the correlated/uncorrelated RMS model.
- **T020** correctness green (66 focused data tests; 26 app harness tests);
  paired Release benchmarks on the primary 128-strip fixture recorded in
  [us1-results.json](us1-results.json) with raw artifacts under `us1-raw/`.
  Honest verdict on this shared host: ksmps64 improves −8.2% to −11.2%
  (≥10% in 2 of 3 runs); ksmps32 improves −9.7% to −10.0%, straddling the
  SC-001 gate; one 15-trial run was visibly contaminated by external machine
  load (retained, excluded from the summary). The deciding SC-001 verdict is
  deferred to T038's isolated reference-platform runs; no gate was weakened
  and no arithmetic microbenchmark is claimed as acceptance.
- **Unrelated pre-existing defect observed** (not caused by or repaired under
  this feature; reported separately per spec): with
  `BLUE_RUN_REAL_ENGINE=1`, the existing Spec 111 acceptance cases T045/T080
  currently fail at generation time with `AudioLayoutCompileError: Missing
  audio layout observation` — realtime/disk AudioClip projects with panning
  enabled and no audio-layout manifest now throw from
  `track-audio-playback.ts`. This predates the 118 changes (reproduced on the
  baseline revision `6d8841102…` worktree as well? — at minimum it is
  independent of the emitter edits, which touch only send-accumulation and
  clear statements). T019 avoids the affected path by disabling panning in
  its fixture; the defect itself is out of scope here.

## Phase 4 — User Story 3 (T021–T027)

Completed 2026-10-25. Full record: [compatibility-results.json](compatibility-results.json).

- **T021** determinism/BlueLive: optimized paths byte-identical across
  repeated sync/async builds; disabled-mixer unchanged; BlueLive uses the
  combined statements with sequential gate ordinals (blue-data-csd-determinism,
  blue-live-csd).
- **T022** copy-safety/parity: generation (realtime/disk/BlueLive) leaves
  project XML, authored text, runtime identities, and parameter state
  untouched; the legacy Java XML fixture keeps its routing text with the
  batched clear covering the same accumulator set (blue-data-csd-copy-safety,
  blue-data-csd-parity, blue-data-csd-disk).
- **T023** binding manifests: repeated timeline compilation identical
  structural manifests (CSD text, gate ordinals/banks/initials/routes, panner
  channels, meter keys, parameter names); BlueLive catalog structure equals
  timeline; identities copied/reused, never replaced. 17 tests.
- **T024** panning: whole-buffer float64 equivalence for balance/stereoPan/
  dualPan with gated sends (peak residual 0; correlated input retains both
  channels); two-term panner expressions and clip fade templates untouched.
  16 tests.
- **T025** routing compatibility: empty-source mixer, direct authored
  `blueMixerOut` into sub+Master (legacy statement text preserved),
  `blueMixerIn` Master fallback, self-route drop, cyclic subchannels
  (existing behavior), unresolved send targets, Java XML load without
  mutation. No XML acceptance or migration change.
- **T026** history/preview/reconciliation regressions: 219 tests passed
  (project-history-mute-solo, -roundtrip, mixer-gain-preview,
  project-runtime-reconciliation). No new writer/label/undo mechanism.
- **T027** full matrix: 49-fixture compare-mode run worst residual 0 with
  structural reset/binding equality; data suites 52 passed.

## Phase 5 — User Story 2 (T028–T035)

Completed 2026-10-25. Full record: [candidate-decisions.md](candidate-decisions.md),
[us2-results.json](us2-results.json) (+ `us2-raw/`).

- **T028/T029** eligibility barriers pinned by tests: no batching opcodes are
  emitted; the shared gain scratch alias, the opaque-effect full-flush
  barrier (emission order proven between contributors), and the
  prior-destination-content rule are asserted; the interleaved bus observer
  case verifies the original partial contribution set against an independent
  RMS model through a real render.
- **T030** preliminary matched fan-in measurements (test-only synthetic CSDs,
  native `--csd` mode, 7 paired trials each): `sum` −11.7…−15.6%, `mac`
  −15.2…−18.4%, `vincr` −1.8…−3.9% across fan-ins 2–32 (macOS/ksmps32).
- **T031/T032/T033** resolved as documented deferrals (production unchanged):
  no worthwhile generator-owned safe region survives the barrier analysis
  (shared gain scratch lifetimes; opaque-effect flush-all; replacement-output
  seeding; no cross-platform threshold evidence). `vincr` additionally fails
  the measured-benefit bar on its own best case.
- **T034/T035** ledger finalized for every surveyed family (sum/mac/vincr
  defer; maca, product/dot, polynomial/chebyshev, scale/scale2, ntrpol,
  divz/limit, pan2/modmatrix reject; two-term panner mac reject).

## Phase 6 — Polish and cross-cutting (T036–T040)

- **T036** quickstart.md rewritten to the implemented harness (flags, emitted
  filenames, benchmark behavior, runtime-resolution fallbacks, the pre-existing
  defect note, pending platform gates).
- **T037** final provenance recheck recorded in [provenance.json](provenance.json):
  original code only; no dependency/asset/inventory change required.
- **T038** [platform-acceptance.json](platform-acceptance.json): macOS
  reference evidence recorded (correctness residual 0; timing −9.7…−11.2%);
  **native Windows and Linux runs unavailable on this host — task remains
  unchecked and the release gate INCOMPLETE** by its own rule.
- **T039** final checks (after dedicated performance jobs finished):
  `pnpm --filter @blue/app build:main` exit 0;
  `pnpm --filter @blue/engine-native test` pass (node tests + 14/14 ctest);
  `test:integration` completed; explicit app engine runs:
  Spec 118 T019 and T054 pass; **T045/T080/T081/T088 fail with the
  pre-existing `AudioLayoutCompileError: MISSING_AUDIO_LAYOUT` defect**
  (requirement introduced by the earlier panning feature commit `ae388c4d9`,
  already present at the pinned baseline revision; the 118 diff does not
  touch `track-audio-playback.ts`; reported separately, not repaired here).
  Final workspace run after Prettier normalization of the changed files:
  `pnpm test` green — blue-data 3113 passed/1 skipped, blue-cli 7,
  blue-app 5791 passed/2 skipped (one earlier engine-bridge flake did not
  recur and passes in isolation), native 14/14; `pnpm lint` clean;
  `git diff --check` clean. Bulky baseline/candidate CSD artifacts retained
  under the ignored `.worktrees/118-evidence/` (baseline manifest hashes in
  this directory remain the reviewable identities).
- **T040** requirement reconciliation: see final section.

### T040 final reconciliation

- **FR-001/FR-005** delivered: send amount × live gate combined once at the
  k-rate tap; final resets batched over the exact ordered set including
  disk-pruned sources.
- **FR-002** delivered by evaluation + recorded dispositions (all US2
  candidates deferred/rejected with evidence).
- **FR-003/FR-004/FR-013** preserved: tap positions, effect/fader/pan/gate
  order, observers (T029), panning semantics (T024), conservative fallback
  everywhere (T028).
- **FR-006** proven: sync/async byte-identity, realtime/disk/BlueLive
  fixtures, repeated generation determinism (T021, compare mode).
- **FR-007/FR-008** respected: generator-owned mixer math only; no project
  option/migration/dependency/runtime capability added; disabled-mixer,
  diagnostics, bindings unchanged (T022/T023/T025).
- **FR-009** every enabled transformation has focused generation tests,
  rendered comparisons, and negative cases (T013/T014/T018/T028).
- **FR-010** evidence separates arithmetic microbenchmarks (archived),
  synthetic fan-in synthetics (us2-raw), generated-mixer paired Release runs
  (us1-raw), and representative fixtures; environments/revisions/raw trials
  retained.
- **FR-011** US1 adopted on correctness + repeatable paired benefit; US2
  candidates deferred for lack of a safe region and platform evidence.
- **FR-012** unaffected fixtures unchanged; the two intentional divergences
  are narrowly asserted and documented; the BlueX7 fixture was regenerated
  through its own contract.
- **SC-001** INCOMPLETE pending isolated reference-platform runs (macOS
  numbers straddle the gate under external load; see us1-results.json).
- **SC-002** macOS representative fixtures show residual 0 and no observed
  regression; Windows/Linux missing → release gate incomplete.
- **SC-003/SC-004** pass (residual 0 everywhere; compatibility suites green).
- **SC-005** every candidate has a recorded disposition with evidence.
- Constitution: portable data core (no host imports in @blue/data), canonical
  ownership (disposable scratch only), no history/serialization/migration
  change, host-owned runtimes, evidence-driven validation, original-code
  provenance — all upheld; no exceptions required.

**Honest remaining gaps**: (1) native Windows/Linux correctness+performance
evidence; (2) isolated reference-machine SC-001 confirmation at ksmps32;
(3) the pre-existing Spec 111 AudioClip/panning manifest defect affecting
T045/T080/T081/T088 under `BLUE_RUN_REAL_ENGINE=1` (unrelated to this feature,
reported separately).

## Convergence follow-up (2026-10-24)

- T041 complete: supplied-CSD defaults to 65,536 measured blocks; native
  short runs require `--research` and are labeled. Wrapper compares requested
  versus reported windows, one native trial per paired observation and at least
  seven pairs. Metric validity, primary ≥10%, representative ≤5%, research,
  and acceptance verdicts are separate. Apparent >5% regressions trigger a
  separately seeded paired confirmation; both reports are retained. Earlier
  `gatePassed` fields meant only metric validity and are not acceptance.
- Regression checks failed before the correction. Release benchmark rebuilt;
  `node --test native/blue-engine/scripts/benchmark.test.mjs`: 21/21 passed,
  zero skips with native shared-memory access. Sandbox-only runs failed at
  `shm_open` and were rerun with appropriate access, not counted as passes.
- Setup ignores rechecked: existing Git/ESLint/Prettier ignore files cover
  detected build/dependency/output paths; publishable data package uses an
  explicit `files` inventory. No new Docker/Terraform/Helm setup is present.
- License recheck: original benchmark/test changes within existing MIT/GPL
  scopes; no external material or dependency introduced.

- T042 complete: input identity v2 hashes canonical original project XML and
  exact referenced audio bytes. Builder-owned persistent ids are deterministic;
  no authored code/whitespace is normalized. Only selected clip artifact paths
  are replaced on a history copy. Mutation tests cover text/whitespace, effects,
  route/order/gains/sends, mute/pan, scheduling/profile/layout and audio content.
  Relocated identical audio and independently built equivalent fixtures match.
  App harness: 25/25 passed. Baseline recaptured from pinned 6d8841102 using
  the same exporter into a new directory; prior captures remain intact. Capture
  alone is not audio acceptance. See baseline-v2.json for manifest identity.

- T043 complete: capture schema v2 includes complete-input and binding hashes,
  pinned Blue revision, tracked/untracked working-content hash and exporter
  hash. Render outcomes retain baseline manifest identity and the complete
  candidate capture record with its hash. Empty stdout from `csound --version`
  is no longer accepted: both output streams are captured and double precision
  is required. Timing accepts matching capture manifests (default beside each
  supplied CSD), validates original-input/profile/settings/exporter identities,
  checks native CSD hashes against supplied bytes, and retains both captures.
  Native reports hash the loaded library, introspect sample size and compile
  an untimed preflight instance to check all four effective header settings.
  Wrapper records executable hash, OS/CPU and actual compiler command. Engine
  source revision is explicitly separate from Blue generator revision.
  Tests: app harness 26/26; native/wrapper 24/24 with shared-memory access.

- T044/T045 complete: explicit acceptance validates baseline, double CLI and
  managed-engine binary before suite selection. Explicit CLI/engine overrides
  are authoritative; unavailable paths cannot fall back to an installed tool.
  Process-level regressions cover absent baseline/runtime/binary/scenario.
  The capture WAV writer creates its selected directory before any write.
  A subprocess capture into a nonexistent nested path with spaces failed before
  the fix and now verifies WAV/CSD/manifest artifacts and audioAccepted:false.
  App harness 28/28 passed. Native Windows path coverage remains T053.

- T046 complete: actual managed-engine timeline and BlueLive baseline/candidate
  captures pass full-buffer float32 residual ≤1e-6 (see convergence-live-results).
  Original constant separated source channels expose both initially open/closed
  sends; block-scheduled ramp-in/out, consecutive commits and two commits within
  one block, send amount changes, exact commit/applied sampling and 30 Hz
  post-gate master-meter publication are independently asserted. Each 8,192-frame
  six-channel capture is finite and equal-format/equal-length. BlueLive's
  36,000-second events are bounded to two seconds only in the test driver on
  both revisions. Baseline CSD is loaded from the pinned capture, never reversed
  from candidate text. Raw trace CSD/WAV and identities are retained.
- Fixed an existing Spec 118 test's invalid `.csdText` access on disk CSD
  strings; the sync/async assertion now compares actual strings. Data build
  and app build:main pass after this correction and missing test imports/types.

- T047 complete: 37 pinned pre-change/candidate panning cases cover all 4 laws
  × boost on/off, verified mono clips, Balance/Stereo Pan/Dual Pan, width 0/1,
  center/endpoints/crossed and left/right/correlated/antiphase inputs with gated
  sends. An additional block-scheduled control trace switches mode/position/
  width/dual/law/boost and checks independent numeric outputs. Every complete
  float64 buffer passes ≤1e-12; gains/isolation/cancellation are separately
  asserted. See convergence-panning-results.json and compatibility-results.json.
- T048 complete: 74-fixture comparison pass; all partial-first/final, delayed
  impulse tail and sound-from-silence cases across 44.1/48kHz × 1/32/64/128
  blocks assert every expected sample, exact zero windows and complete ordered
  source/sub/master resets. Sound-then-silence uses NONE timing (Java
  GenericScore defaults SCALE; inspected Java reference before fixing fixtures).
  Fractional source duration avoids score decimal rounding boundaries; Csound
  ksmps=1 note-off rounding and vector offset truncation have separate explicit
  expected sample counts, consistent with runtime 19b39531 Engine/insert.c.
  No primary fixture or production timing/generator behavior was changed.
  Repeated timeline/BlueLive performances recreate the engine twice within the
  same managed session and compare complete finite output buffers; both pass.
  Evidence: convergence-lifecycle-results.json and convergence-live-results.json.

- T049 complete (2026-10-25): pinned render matrix passes with original Java
  format XML and the existing TypeScript BlueX7 project's original disk ksmps1
  setting; mono/stereo/four-channel unpanned direct+chained bus contributions,
  no-source exact silence, blueMixerIn replacement, nested UDO/macro observer
  and global-bus writer cases have independent expected values. Existing
  route/cycle/layout diagnostics remain intact. Actual BlueLive is covered
  by the managed trace. See convergence-routing-results.json for raw identities.
  No serialization acceptance or bus-batching change was introduced.
- Existing corpus limitation: the pinned BlueX7 CSD with global ksmps64
  stalled/exceeded subprocess output capacity in realtime and disk probes.
  It is not repaired by this feature or claimed as a passing corpus mode.
  The original disk ksmps1 project renders successfully; all authored DSP and
  source files remain unchanged. Render subprocesses now have a 60-second
  SIGKILL timeout so a stalled Csound cannot leave an orphan indefinitely.

- T050 complete: complete binding serializer replaces count/display-name
  summaries. Captures retain parameter ordinals/channels/canonical ids/owners,
  initial/range/resolution values, exported control names/access/initializers,
  full gate commit/applied/banks/locators, panner controls and parameter-owner
  links, BlueX7 semantic maps/string channels, meter identities/order/layout.
  Only process-local channel/send tokens and documented regenerated render-copy
  Parameter UUIDs are normalized; canonical parameter ids remain present.
  Meter Channel references become explicit normalized identities, avoiding
  accidental serialization of mutable model graphs. Same-project runtime ids
  are asserted unchanged and injected mapping/catalog/export/meter mismatches
  are detected. Pinned audio+complete-binding matrix passes; runtime sync and
  generation-fenced reconciliation regressions run separately. Timing pairs
  now also require equal binding-manifest hashes.

- T051 complete: controlled instrument failure occurs after the real compiler's
  preparation/global-code stage, then verifies unchanged complete XML, authored
  instrument/effect/global code whitespace, exact channel/send/parameter
  identities/references and canonical compilation names after successful and
  failed realtime/disk sync/async and BlueLive generation. The previous
  successful-not.toThrow assertion is removed. Data focused suite: 3 passed.
  Host ProjectSession tests: 9 passed, including successful/failed sync/async
  generation retaining active document/session facts, clean checkpoint, dirty
  state, empty history and stable canonical references. No writer added.

## Final convergence checkpoint (2026-10-25)

- T054 complete: decoder validates RIFF/fmt/data/padding boundaries, stream
  byte rate/block alignment and whole samples/channel frames. Independent
  expected complete frame counts and authored amplitude declarations reject
  equal-but-short/empty/out-of-range output. New regression tests failed before
  the correction; all 14 decoder checks pass. Full final render and panning
  matrices pass these stronger checks. Primary source, routing and score
  workload remain unchanged; new range declarations are evidence metadata.
- Final baseline and candidate captures: .worktrees/118-evidence/
  convergence-final-{baseline,candidate}; matching original-input/exporter/
  complete-binding identities. Source baseline remains pinned at 6d8841102.
  Final actual managed-engine repeated timeline/BlueLive captures pass.
- Historical T052 numerical result (later owner-accepted in Phase 8): independent ksmps32 seven-pair runs improve
  9.564537037596473% and 9.141414144726173%, below the required 10%.
  ksmps64 improves 11.488734903768282%. Metrics are valid; validity is not
  acceptance. Dedicated runs had no competing agent validation/timing jobs.
  Raw trials, exact environments/executable/library/build/flags and both
  capture identities are retained in convergence-performance-results.json.
- Investigation: clear-only and gain-only generator ablations retain exact
  full double-audio baseline output (residual 0), but independently improve
  only 2.37% and 9.64%. Temporary source variants were generated from the
  pinned generator, not reversed candidate CSD text; baseline source and build
  were restored. The active candidate emitter was never changed.
- A temporary immediate-send vincr prototype passes 119 complete single-thread
  renders. Its four-thread proof cannot be established because the pinned
  baseline itself exceeds the declared small-single amplitude bound. Csound
  19b39531 Opcodes/fout.c and include/interlocks.h were inspected (LGPL source
  behavioral reference only); the opcode's WI input-write marker and partial
  block handling do not substitute for a passing concurrency proof. No vincr
  adoption or benchmark acceptance is claimed.
- Historical checkpoint: execution stopped at the numerical T052 failure.
  Phase 8 subsequently resolves T052 by scoped owner acceptance and permits
  T053/T056 to advance. Windows/Linux remain unavailable; no overall release
  completion is claimed.

## Final workspace validation

- `pnpm test` full workspace retry passes: app 5798 passed / 3 skipped,
  data 3114 passed / 1 skipped, engine-client 47 passed, CLI 7 passed,
  native 38 script checks and 14 CTest checks, root scripts 59 passed.
  The first full run failed the existing renderer meter-stress latency bound
  while lint ran concurrently. Its isolated 3-test retry and the full workspace
  retry pass without changing the test or its threshold.
- `pnpm lint`, `pnpm --filter @blue/app build:main`, and `git diff --check` pass.
- Separate `pnpm --filter @blue/engine-native test:integration` fails 1 of 5:
  `CsoundIntegrationTests`: `sndinfo utility did not complete` with the installed
  Csound 7.0 double runtime (19b39531). Channel bridge, lifecycle stress, meter
  sampling, and metering soak pass. This utility failure remains unresolved;
  it is not a passing integration result. No unrelated runtime changes made.
- Log identities and check outcomes: `convergence-final-validation.json`.
  The primary performance failure and unavailable Windows/Linux evidence
  still prevented acceptance at that checkpoint. Phase 8 resolves T052 only;
  T038/T053 remain incomplete pending platform/regression evidence.

## Phase 8 owner decision reconciliation (T058)

The 2026-10-25 owner decision recorded in tasks.md accepts the current
candidate’s SC-001 shortfall: 9.564537037596473% / 9.141414144726173%
at ksmps32 and 11.488734903768282% at ksmps64. T052 is resolved by that
scoped decision. Historical failed numerical verdicts remain unchanged;
`primaryImprovementMet: false` is still correct for both 32-sample runs.
There is no new global benchmark threshold and no requirement to optimize
or revert solely to reach 10%. Earlier halt/continue-optimizing instructions
are superseded by this decision. Correctness, the representative <=5%
regression gate, native Windows/Linux evidence, and native utility validation
remain separate obligations; overall release acceptance is incomplete.

### T057 scoped native utility validation exception

The unchanged native integration binary still fails sndinfo (1 of 5 native
integration tests). A standalone Python ctypes probe loads only the same
Csound library and no Blue code: fresh utility enumeration is empty, but
direct csoundRunUtility(sndinfo) returns 0 and reports the original audio
file, including a path with spaces. The native wrapper's pre-enumeration
check returns 65 before that call. Native loader/service/types/test/CMake
files exactly match pinned baseline 6d8841102. This establishes independence
from the emitter and benchmark changes. The exception is limited to utility
discovery/first execution on this runtime; DSP, live controls, lifecycle and
metering remain independently tested. No production repair, assertion waiver
or blanket native-green result is claimed. Raw failure/probe logs, script
and file hashes: phase8-native-utility-disposition.json.

### T055 evidence reconciliation

Fresh pinned-baseline and current-candidate captures use identical exporter
e3290128f653669f85e909b78b4ecce4aa601b9c5bf8ca774e36a0b46ad58592.
All 379 input/CSD/full-binding identities are checked. The expanded 197
comparison cases pass, as do 38 panning cases and two managed timeline/
BlueLive traces with repeated performances. Binding, lifecycle, and routing
raw reports now have separate immutable paths; each summary points at its
actual SHA-256. Historical summaries and the available overwritten raw
report are preserved separately, with their original hash mismatches stated
in phase8-history/index.json rather than presented as verified results.

Six pruning render CSDs use the baseline WAV path rather than the captured
candidate WAV path. The WAV bytes are identical. Substituting only that known
embedded path reproduces the originally recorded rendered-CSD hashes exactly;
those exact bytes are frozen beside the report. Baseline CSD is never guessed
or reconstructed. Complete verification: phase8-identity-verification.json.
Capture-only baseline invocation passes; candidate harness 31/31 passes.
An initial full baseline-file invocation hit four candidate-only optimized-
text assertions; the capture test itself passed. The final baseline command
selects only the capture test. Initial expanded 48 kHz pruning comparison
failed an incorrect raw-PCM-peak bound; the fixed metadata derives the cubic
interpolation bound independently from its weights, retaining the source
workload, residual thresholds, and original failed artifact.

### T056 available macOS acceptance work

The dedicated SC-002 run completes all 72 comparisons: twelve workloads at
44.1/48 kHz x ksmps32/64/128, seven paired trials each, >=1024 warmup and
65536 measured cycles per trial. All metrics and representative regression
gates pass. The greatest measured regression is +3.608284188068369%, below
5%; no apparent >5% regression required confirmation. Reports share one
Release executable and Csound library identity, verified against their bytes.
No competing agent validation jobs ran during measurement. This matrix uses
`--acceptance representative`; it does not replace the historical numerical
SC-001 failures or their scoped owner decision. All raw trials, environments,
identities, and per-case hashes: phase8-representative-results.json.

Native Windows/Linux remain unavailable. T038/T053/T056 stay unchecked and
overall release acceptance stays incomplete. macOS results do not waive
missing native platform evidence. Production emitter code and deferred bus-
candidate decisions remain unchanged in Phase 8.

### Phase 8 final validation

- `pnpm test`: full-workspace retry PASS. App 5800 passed / 3 skipped,
  data 3114 passed / 1 skipped, engine-client 47 passed, CLI 7 passed,
  native 38 script tests and 14 CTest tests, root scripts 59 passed.
- Initial full run retained: existing renderer meter-stress latency
  423.3947500000004ms exceeded 393.79084919999985ms. Its isolated 3-test
  check and the full workspace retry pass. No assertion, threshold, or
  production renderer code changed.
- `pnpm lint`, affected app `build:main`, and `git diff --check` PASS.
- Separate native integration remains a documented scoped utility exception
  (T057); it is not reported as green.
- Logs are frozen under `.worktrees/118-evidence/phase8 final validation`;
  their exact paths/hashes and final outcomes are in
  convergence-final-validation.json. Timing finished before these checks;
  no competing validation jobs ran during the dedicated measurements.
- T055/T057/T058 complete; T052 resolved by owner decision. Only
  T038/T053/T056 remain unchecked for required native platform evidence.
  Overall release acceptance remains INCOMPLETE.

Final active-summary audit: 133 recorded artifact/path/log/output SHA-256
references resolve and match their bytes, with no missing files or mismatches
(phase8-summary-audit.json). Verbatim historical snapshots are excluded from
active acceptance; their original mismatches remain documented.


## Implementation accepted and closed — 2026-10-25

The owner requested final specification documentation and the feature commit.
The implemented scope is complete: tap-local k-rate send gain combining and
bounded final accumulator clearing, with unchanged authored DSP, project formats,
public bindings, and state ownership. The SC-001 shortfall is accepted by the
owner; the raw 32-sample numerical failures are preserved. Deferred bus candidates
remain deferred, without additional production optimizer code.

Current macOS evidence verifies 379 paired capture entries, 197 offline
comparisons, 38 panning cases, two managed-live traces, and 72 representative
performance comparisons. The maximum measured regression is +3.608284188068369%,
within 5%. The existing native utility issue retains its scoped validation
exception and is not represented as a passing integration test.

Native Windows/Linux evidence remains deferred release work under
T038/T053/T056/T059. These tasks remain unchecked; implementation completion and
the requested commit do not assert cross-platform release acceptance.


Closure verification: focused data tests 52/52, focused app tests 89/89,
`pnpm --filter @blue/app build:main`, full `pnpm test` with the installed
Command Line Tools, and `pnpm lint` pass. Native integration retains only its
previously documented scoped utility exception. Fresh workspace/lint logs and
SHA-256 identities are recorded under `implementationClosureValidation` in
`convergence-final-validation.json`. Separate existing metering-test and Spec 104
documentation edits were excluded from the mixer optimization commit.

Closure evidence audit: 130 active artifact references verify. Older
temporary-log verdicts are preserved in
`phase8-history/previous-convergence-checks.json`; unavailable historical logs
are excluded from current acceptance. Current Phase 8 and closure logs remain
frozen with matching hashes.
