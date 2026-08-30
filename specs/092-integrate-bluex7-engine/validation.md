# Validation Record: Modern BlueX7 Engine and Automation

**Branch**: `092-integrate-bluex7-engine` | **Date**: 2026-08-30

This file records the completed validation evidence required by `quickstart.md`.
All phases and convergence tasks T001–T105 are complete, including the scalar
live-state refinement and shared-UDO compatibility audit.

## 1. Provenance and generated-source check — PASS

- `pnpm --filter @blue/data generate:blue-x7 --check` passes: the generated
  `modern-orchestra.generated.ts` is byte-identical and all recorded current
  digests match. The pinned baseline digest
  `2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda` (precursor
  commit `0482f608cae693516321fa7c3f1ccef31e6ee5e4`) remains recorded; the
  current maintained source digest reflects the Blue modifications listed in
  `provenance.json`. No transient-checkout access; the resource directory
  contains only `bluex7.orc`, `ATTRIBUTION.md`, `provenance.json`, and
  `LICENSES/Apache-2.0.txt` (regression-tested).

## 2. Portable data and CSD contracts — PASS

`pnpm --filter @blue/data test` — 175 files, **1734 passed, 1 skipped**,
covering: 151 unique parameters (145 voice slots + 6 mask bits); every
transport slot and mask bit; legacy/additive XML round trips; unknown-node
preservation; stable same-owner IDs; disjoint copy IDs; whole-voice replacement
retaining identities and curves; shared sync/PMS mixed-XML policy; generated
CSD structure on the real three-BlueX7 TimewaveCanon project (one shared
module, per-instance direct-global targets, no legacy Pinkston remnants); host
wrapper semantics; the modern binding report; and compile-once global
orchestra with Track participation.

## 3. Engine protocol — PASS

- `pnpm --filter @blue/engine-client test` — 42 tests, 0 failures: batch
  golden layouts, UTF-8 names, duplicate/NUL/empty/oversized/non-finite
  rejection, response count/length mismatches, unchanged single-channel
  commands, capability negotiation with old-engine failure.
- `ctest --test-dir native/blue-engine/build-darwin-arm64-release` — **16/16
  passed**, including new batch set/get round trips through the real ZMQ
  handler (ordered f64 readback, all-or-error on missing channels,
  validation-before-write, duplicates/NUL/UTF-8/truncation/trailing-byte
  rejection, not-created-engine diagnostics) and the real-Csound bridge run.

## 4. Main/preload/project contracts — PASS

- `blue-x7-runtime-contract.test.ts`: target/update/readback validation and
  serializable result unions.
- `blue-x7-runtime-sync.test.ts`: owner resolution with duplicate names;
  stale session/revision, removed owner, malformed target, ID/key mismatch
  fail-closed; automation-authority matrix; one complete 151-value batch at
  the engine control boundary; mid-flight failure leaves the previous voice
  observable; visible-only
  readback with late/stale rejection; four owners with disjoint channels.
- `pnpm --filter @blue/app build:main` and `build:preload` pass.
- Owner-aware arrangement and Track automation lifecycle, nonzero-start
  clipping, engine rebuild reconciliation, Blue Live routing, and disk/live
  timing equivalence pass their focused suites.

## 5. Renderer/browser behavior — PASS for US2–US4

- `blue-x7-csound-preview.test.tsx` passes: modern direct-global preview, live
  wrapper body, catalog-driven binding report with active-note/next-note
  classes, and rejection of legacy dormant-field claims.
- The 20 Hz visible-value hook, automated-value overlays, next-note badges,
  nested automation chooser, two-editor rapid ordering/local undo isolation,
  Track popout target identity, and browser layout suites pass.

## 6–7. Csound render evidence (runs locally with Csound 7)

- All 32 algorithms render finite, audible output with peak ≤ 0.9
  (corpus-wide `giBlueX7OutputCalibration = 0.75`; worst observed 0.8901
  after MSFA-style per-block gain interpolation).
- Zero-mask silence; release completion with the 15 s safety cap (no stuck
  notes, no truncated tails); corrected 3-carrier metadata for algorithms
  6 and 20; accepted reference render hash locked
  (`82012869f2451e4968a0646b5a9d4329cc0c89cbcac277f7c2fe8238453882c6`).
- Live active-note adaptation verified by render: silencing operator output
  levels mid-note drops the sounding output below -50 dB while the static
  reference hash proves the init-time/static path is unchanged.
- Full generated live-capable CSD (BlueData -> toCSD -> Csound) renders
  end-to-end with finite, calibrated output.
- `pnpm --filter @blue/app exec vitest run
  src/main/blue-x7-multi-instance.integration.test.ts` passes the real Csound
  four-owner scenario: 32 notes over 60 seconds, a bounded 70-second render
  window for release completion, finite stereo samples, peak `0.53524`, and a
  silent final second after the release cap.
- The owner-routed stress path executes 600 changes: 540 fixed writes, 60
  automation-authority skips, four distinct readbacks, and zero cross-owner
  writes/readbacks. A standalone 600-operation timing sample recorded p95
  `0.000583 ms` and max `0.05425 ms`, below the 100-ms target.
- Final acceptance rerun:
  `pnpm --filter @blue/data exec vitest run
  src/instruments/blue-x7/modern-render.integration.test.ts
  src/instruments/blue-x7/modern-live.integration.test.ts` — 2 files, 11 tests,
  all pass; and `pnpm --filter @blue/app exec vitest run
  src/preload/blue-x7-effective-values.test.ts
  src/renderer/tests/blue-x7-effective-values.test.tsx
  src/main/blue-x7-runtime-sync.test.ts
  src/main/blue-x7-automation-equivalence.test.ts
  src/main/blue-x7-multi-instance.integration.test.ts` — 5 files, 22 tests,
  all pass. This covers the 20 Hz readback contract, disk/live automation
  tolerance, 100 alternating atomic whole-voice publications, all-algorithm
  and active-note rendering, and the real four-owner stress render.

## 8. Legacy migration and atomic replacement — PASS

- Real Java-default and boundary/unknown XML fixtures load without a
  `parameterList`, acquire 151 unique IDs on first save, and retain those IDs,
  all known fields, mixed shared fields, and unknown XML on reopen.
- Whole-voice/SysEx replacement retains Parameter IDs, curves, points, colors,
  enabled state, and owner assignments. Cancel, invalid input, and stale-editor
  results emit no project patch. Import, undo, and redo each emit one complete
  replacement patch.
- Library and Track migration copy automation content by semantic identity,
  allocate disjoint destination IDs, and retain no mutable source references.
- The migration and accepted sonic differences are documented in
  `docs/blue-x7-modern-renderer.md`.

## 9. Full handoff validation

- `pnpm --filter @blue/data test` — 175 files, 1,734 passed and 1 skipped.
- `pnpm --filter @blue/engine-client test` — 3 files, 42 tests passed.
- `ctest --test-dir native/blue-engine/build-darwin-arm64-release
  --output-on-failure` — 16/16 targets passed.
- `pnpm --filter @blue/app test` — 409 files, 3,920 tests passed and 2 skipped.
- `pnpm --filter @blue/app build:main` and `build:preload` pass.
- Repository-wide `pnpm test` passes all workspace package/native/script
  suites. The complete `@blue/data` suite passes at 175 files with 1,734
  passing tests and 1 skipped; the complete `@blue/app` suite passes at 409
  files with 3,920 passing tests and 2 skipped.
- Repository-wide `pnpm lint` passes, including the renderer typography audit,
  ESLint, native engine lint, and Java validation. `git diff --check` passes.

## 10. Architecture and compatibility audit — PASS

- Reviewed the affected data, app, engine-client, and native-engine boundaries
  against `AGENTS.md`, `docs/modularization.md`, constitution 2.1.0, `spec.md`,
  and `plan.md`. Production `@blue/data` remains browser/host neutral with
  static imports; Node filesystem work stays in the generator/test boundary.
- `BlueData` in Electron main remains canonical. Renderer polling is disposable,
  serializable preload state; durable edits still flow through the project
  document bridge. Engine bindings, channel values, and readback remain scoped
  to one performance generation.
- Main owns engine/Blue Live routing and fail-closed owner resolution. The new
  runtime-sync and patch-intent modules are narrow, directly tested seams and
  do not introduce a second durable state owner or dependency cycle.
- The audit found and resolved one ownership defect: a deep-copied Track
  regenerated BlueX7 Parameter IDs but retained source automation assignment
  IDs. Track copy now remaps only instrument-owned assignments by semantic name,
  preserves unrelated project references and selection, and has focused
  regression coverage.
- Java-compatible voice ordering/defaults and unknown XML remain preserved;
  the intentional modern synthesis divergence and older-Java metadata limit are
  explicitly documented. No unexplained exception remains.

## 11. Phase 10 convergence (T088–T092) — PASS

- **T088**: BlueX7 editor widget bounds and `BLUE_X7_*_FIELD_RANGES`
  patch-validation tables are now derived from the 151-entry parameter
  catalog (`getBlueX7Descriptor`) via field→semantic-key maps in
  `contract.ts` and a shared `catalog-domains.ts` helper used by
  common/lfo/operator panels and the envelope editor slider ARIA bounds.
  A behavioral lockstep test walks every patchable field against its
  catalog descriptor (accepts min/max, rejects min−1/max+1), and a panel
  test proves widget gestures clamp to catalog domains
  (feedback 99→7, transpose 99→stored 48, PMS 9→7).
- **T089**: removed the dead 484 KB legacy
  `algorithm-orchestra.ts` module (zero source importers, not exported);
  added a generated-CSD hygiene regression asserting one shared modern
  module per render (`; bluex7.orc` banner and `opcode bluex7_voice` each
  occur exactly once across a two-owner CSD, one wrapper call per
  instance) and zero legacy `dx701..dx732`/`Yamaha DX7 Emulation
  Instrument` body content; renamed the misleading transport-clamping
  test in `blue-x7.test.ts`.
- **T090**: direct fail-closed coverage for the `binding-not-found`
  reason through `applyBlueX7LiveUpdate`,
  `applyBlueX7CompleteVoiceBatch`, and `requestBlueX7EffectiveValues`
  against a missing compiled binding — each returns the recoverable
  diagnostic naming the owner and performs zero channel writes.
- **T091**: four-instance SC-009 fixtures — the contract test builds four
  same-named arrangement BlueX7 instruments (plus two same-named
  Track-owned instruments) and asserts 151 targets per owner,
  pairwise-distinct location labels, and that a Track's chooser never
  presents another Track's targets; the chooser UI test drives
  open → owner → group (three interactions) across four same-named
  owners to a visible target.
- **T092**: explicit pause/resume cycle test — after edits made while
  paused, resync from a later origin reprojects the automated curve,
  keeps automation authoritative (no fixed write on the automated
  channel), restores fixed-only channels from their paused canonical
  values, and a disable-then-resume clears stale engine automation and
  surfaces the underlying fixed value.
- Validation: `pnpm --filter @blue/data test` — 175 files, 1734 passed,
  1 skipped (includes the Csound-gated render/live suites);
  `pnpm --filter @blue/app test` — 409 files, 3920 passed / 2 skipped;
  `pnpm --filter @blue/app build:main` and `build:preload` pass;
  repo-wide `pnpm lint` passes; `git diff --check` clean.

## 12. Phase 11 performance convergence (T093–T100) — PASS

The opt-in harness is reproducible with:

```bash
BLUE_X7_PERF=1 pnpm --filter @blue/data exec vitest run \
  src/instruments/blue-x7/performance-benchmark.test.ts
```

On the local macOS arm64 development build (Csound 7.0, `sr=44100`,
`ksmps=64`), the checked-in `fixtures/blue-x7-pop-song.blue` regenerated an
identical `fixtures/blue-x7-pop-song.csd` with `174,645` bytes, `0dbfs=1`, and
syntax-check time `0.20 s`. The generated fixture contains no `tabw`,
Parameter `chnget`, or live transport table publication.

The same harness renders a 59-note dense case with fast release rates so the
comparison is repeatable (the fixture-specific run includes its natural
release tails):

| target | CSD bytes | compile | wall | CPU (user+sys) | rendered | realtime ratio | result |
|---|---:|---:|---:|---:|---:|---:|---|
| static UDO | 94,349 | 0.11 s | 1.96 s | 1.92 s | 1.181 s | 0.603x | reference |
| live UDO + per-note guards | 99,118 | 0.10 s | 1.94 s | 1.91 s | 1.181 s | 0.609x | equivalent |
| live inline + per-note guards | 126,639 | 0.13 s | 2.03 s | 2.01 s | 1.181 s | 0.582x | equivalent |
| live UDO + epoch | 98,166 | 0.10 s | 1.95 s | 1.94 s | 1.181 s | 0.606x | equivalent |
| live inline + epoch (selected) | 125,051 | 0.14 s | 1.99 s | 1.97 s | 1.181 s | 0.594x | equivalent |

Rendered output length and realtime ratios are emitted by the harness; the
selected inline target stayed within the static CPU budget while avoiding the
155-slot live UDO projection. Static/UDO-epoch and static/inline-epoch maximum
sample differences were both `0`. The fixture-specific 10-second score slice
rendered `20.139 s` including release tails (`1.92x` realtime); Blue Engine
one-shot measured `9.61 s` with channel mirroring enabled versus `9.56 s` with
shared memory disabled in the same run, so mirroring is not the dominant cost.

The direct-global target generator now emits instance-specialized `gk_blue_autoN`
references, epoch or per-note dirty guards, compact indexed state only for
dynamic loop access, and inline DSP when selected. The native engine validates
and queues one immutable batch, then applies it after a successful
`csoundPerformKsmps` boundary; queue-full, stopped/rebuild, missing-channel,
and automation-authority failures remain fail-closed. The inaudible-release
topology fast path is guarded by carrier gain and resumes on a live edit.

## 13. Scalar live-state refinement (follow-up) — PASS

The catalog now classifies 15 inexpensive controls as active-note (feedback,
LFO pitch/amplitude depth, six operator output levels, and six operator enables)
and 136 controls as next-note snapshots. The generated inline target captures
the latter with `i(gk_...)` at note initialization. It no longer allocates the
126-slot `kBlueX7LiveOperatorState[]`; it keeps eight PEG index/rate snapshots
and six output-level baselines, and reads the 15 live globals directly only on
a dirty epoch. A Csound-gated test changes all six output levels during a note
and confirms the generated target becomes inaudible without a packed live
array.

The opt-in dense benchmark was rerun after this refinement on the local macOS
arm64 build (Csound 7.0, `sr=44100`, `ksmps=64`). The 59-note score rendered
`1.181315 s` of audio and static/live-epoch outputs remained bit-identical:

| target | CSD bytes | wall | CPU (user+sys) | realtime ratio |
|---|---:|---:|---:|---:|
| static UDO | 94,349 | 1.96 s | 1.92 s | 0.603x |
| live UDO + epoch | 98,166 | 1.95 s | 1.94 s | 0.606x |
| live inline + epoch (selected) | 125,051 | 1.99 s | 1.97 s | 0.594x |

The checked-in fixture regenerated to `174,645` bytes in that run, passed
syntax validation, and retained `0dbfs=1`, no `tabw`, no Parameter `chnget`,
and no live transport table. The fixture and engine mirror timings are
machine-dependent; the important regression gate is unchanged output plus no
per-note 126-slot live projection.

Focused validation after the final generator/native changes:

- `pnpm --filter @blue/data build:esm` and `build:cjs` pass;
- target-generator, modern render/live, module-hygiene, and performance suites
  pass (the performance suite is skipped unless `BLUE_X7_PERF=1`);
- native Release build and `ctest --test-dir
  native/blue-engine/build-darwin-arm64-release --output-on-failure` pass,
  `16/16` targets;
- regenerated fixture passes Csound syntax validation and direct-global
  structure assertions.

## Open tasks

- None. T001–T105 are complete.

## 2026-08-30 final spec review and handoff — PASS

The completed implementation was reviewed against all 35 functional
requirements, 28 user-story acceptance scenarios, 10 success criteria, 13
plan decisions, and the five constitution principles. No missing, partial,
contradictory, or unrequested work remains within this feature's scope.

The review found one stale generated artifact before handoff: the checked
pop-song `.blue` and `.csd` files predated their deterministic builder. They
were regenerated from `pop-song-fixture.ts`; the resulting 244,888-byte
project and 197,232-byte CSD now match the builder byte-for-byte and preserve
the documented frequency-pitch, BBF-time, algorithm, mixer, and pinned-identity
contracts.

Fresh final validation after regeneration:

- `pnpm test` passes, including `@blue/data` at 176 files / 1,742 tests passed
  / 1 skipped, `@blue/app` at 409 files / 3,920 tests passed / 2 skipped, the
  42-test engine-client suite, native debug tests, Java tests, CLI tests, and
  repository script audits;
- `BLUE_X7_PERF=1 pnpm --filter @blue/data exec vitest run
  src/instruments/blue-x7/performance-benchmark.test.ts` passes its fixture,
  realtime-throughput, target-equivalence, and structural gates;
- the native release build succeeds and `ctest --test-dir
  native/blue-engine/build-darwin-arm64-release --output-on-failure` passes
  16/16 tests;
- `pnpm lint`, `pnpm --filter @blue/app build:main`,
  `pnpm --filter @blue/app build:preload`,
  `pnpm --filter @blue/data generate:blue-x7 --check`, and
  `git diff --check` pass.

## 2026-08-28 hot-path profile and bit-exact interpreter-cost reduction

A native `sample` profile of a dense 59-note render (Csound 7.0, double,
`sr=44100`, `ksmps=64`) showed the DSP math itself is a small fraction of the
cost: roughly half of compute time is Csound UDO statement dispatch, ~13% is
`array_get` opcode calls, ~7% is whole-array copying, and only ~3% is the sine
math. Two concrete waste sources were found in the maintained module:

- the six k-rate lookup-table mirrors at the top of `bluex7_voice`
  (~309 array elements) were re-copied on every k-cycle of every note;
- each algorithm UDO read `kGain[i]`/`kDph[i]` array elements inside the
  per-sample feedback loop and in a-rate expressions, paying an `array_get`
  opcode call per sample instead of one scalar read per k-cycle.

Three bit-exact changes landed (associations and value order preserved; the
change set is recorded in `provenance.json`):

1. the table mirrors copy once per note behind a `kMirrorInit` guard;
2. all 32 algorithm UDOs hoisted `kGain[0..5]`/`kDph[0..5]` into scalar
   locals at UDO entry; the later continuity correction retains the one-read
   boundary while replacing held `kG1..kG6` values with interpolated
   `aG1..aG6` ramps;
3. the per-k-cycle amplitude-modulation scale and pitch-EG/LFO exponent are
   hoisted out of the six-operator control loop (`kAmdScale`, `kPegLfo`),
   and the generated inline target calls the statically selected
   `dx7_algo_NN` UDO directly instead of the 32-way
   `dx7_render_algorithm` dispatcher.

Equivalence: the dense 59-note benchmark and the fixture CSD render
output-identical audio (maximum sample difference `0.0` for static-vs-live
UDO and static-vs-live inline comparisons, and for a direct before/after
render of the full voice).

Measurements after the change (same machine, best-of-N interleaved runs):

- dense 59-note benchmark, 1.181315 s of audio: static UDO 2.32 s -> 1.84 s
  CPU (-21%), live inline + epoch 2.35 s -> 1.78 s CPU (-24%); the production
  inline target is now also faster than the static UDO form, reversing the
  earlier inline regression;
- checked-in fixture 10-second slice (20.139 s of audio including release
  tails): plain Csound render ~20.1 s -> ~7.0 s wall (~2.9x realtime) — the
  fixture gains most because long release tails keep the per-note wrapper
  (formerly dominated by the per-k-cycle mirror copies) running while the
  inaudible-release fast path skips the topology;
  engine one-shot with shared-memory mirroring 9.61 s -> 6.95 s (-28%).

Full suites after the change: `@blue/data` 1,734 tests, `@blue/app` 3,920
tests, `generate:blue-x7 --check`, repository lint, and `git diff --check`
all pass; the regenerated fixture (187,117 bytes) passes Csound syntax
validation and the direct-global structure assertions. The dense benchmark
harness command and equivalence gates are unchanged.

## 2026-08-29 runtime algorithm-switch regression found and fixed

Review of the direct `dx7_algo_NN` call surfaced a semantics gap:
`common.algorithm` is a next-note parameter, and the main-process runtime sync
applies value edits as channel writes (no recompile), so a runtime algorithm
edit must re-topologize notes that start after the edit even inside a compiled
generated instance. The unconditional direct call was hard-wired to the
compile-time algorithm and would also desync the routing metadata
(carrier count, output scale, fast-path detection) from the rendered topology.

Fix: generated inline targets now emit the direct call behind a note-time
`if iAlgo == <generationIndex>` guard with the 32-way dispatcher as the
fallback branch. Unchanged notes take the direct path; notes started after an
algorithm edit take the dispatcher exactly as before the optimization.

A Csound-gated regression test
(`applies a runtime algorithm channel edit to the next note on the live inline
target`) renders two notes around a channel edit and asserts the second note is
sample-identical (window max difference 0) to a render that started on the new
algorithm, and audibly different from the old one. An interleaved best-of-N
A/B measured the guard's cost at ~0.03 s CPU (~2.5%) on the dense benchmark;
the net optimization win is retained. Full suites pass after the fix:
`@blue/data` 1,736 tests, `@blue/app` 3,920 tests, benchmark equivalence gates
(static-vs-live UDO and static-vs-live inline maximum difference 0), fixture
regeneration (187,343 bytes) and syntax validation.

## 2026-08-29 pop-song fixture generator, MIDI pitches, and BBF score time

The checked-in pop-song fixture is now owned by a permanent generator:
`packages/blue-data/src/instruments/blue-x7/pop-song-fixture.ts` builds the
whole project from embedded data with every identity pinned (tracks, layer
group, 151 Parameters per BlueX7, mixer Parameters), so regeneration is
byte-stable. `pop-song-fixture.test.ts` proves the checked-in `.blue` matches
the builder byte-for-byte and the `.csd` stays in lockstep; regeneration is
`BLUE_X7_REGEN_FIXTURE=1 pnpm --filter @blue/data test -- pop-song-fixture`.
A diff review against the previous fixture confirmed the only content changes
are the intended ones (394 note octaves remapped pch→MIDI, 12
`pchGenerationMethod` 1→2, 12 note templates, `timeDisplay` BEATS→BBF, notes
text).

Requested settings, end to end:

- **PianoRoll MIDI pitch generation**: all 12 PianoRolls use
  `pchGenerationMethod 2`; note octaves are MIDI octaves (pch octave 8 =
  MIDI 60, so every stored octave shifted by −3 keeps the same pitches).
- **BBF score time unit**: the score `timeState.timeDisplay` is `BBF`
  (bars.beats.hundredths); PianoRoll rulers already defaulted to BBF.
- **p4 boundary extension (intentional Java divergence)**: MIDI scores need
  `i1 0.0 1.5 60 88`-style p4. A score-side conversion
  (`cpsmidi(<FREQ>)` in the note template) is not viable: Csound's score
  parser mis-parses p-field expressions followed by further fields (a note
  silently degrades to 3 p-fields). The generated target now reads
  `p4 < 15 ? ftom:i(cpspch:i(p4)) : (int(p4) == p4 && p4 <= 127 ? p4 : ftom:i(p4)))`
  — pch below 15 (unchanged, Java parity), integer 15..127 as MIDI notes,
  everything else Hz. The locked pch reference render hash is unchanged, and
  a new Csound-gated test proves MIDI 69 ≡ pch 8.09 ≡ Hz 440 (< 1e-9) and
  that MIDI 70 differs; three existing assertions on the old boundary text
  were updated.

Full validation after the change: `@blue/data` 1,739 tests, `@blue/app`
3,920 tests, `BLUE_X7_PERF` benchmark (fixture validation, dense 10 s slice
~4.15x realtime, engine one-shot 4.77 s, static-vs-live equivalence 0),
fixture CSD syntax check, lint, `git diff --check`, and `@blue/data` dist
rebuild all pass.

## 2026-08-29 revision — frequency generation, original p4 boundary, BBF object times

Per the owner's review, the fixture settings were revised from the earlier
2026-08-29 entry:

- **Pitch generation is frequency** (`pchGenerationMethod 0`, not MIDI): with
  the default 12TET scale the note octaves return to their pch-style values
  (8 = middle C) because `Scale.getFrequency` uses the same octave-8
  convention, so the sounding pitches are unchanged and the score carries
  plain Hz p4 (`i1 0.0 1.5 261.625565 88`).
- **The BlueX7 p4 boundary is reverted** to its original Java-parity form
  `(p4 < 15 ? ftom:i(cpspch:i(p4)) : ftom:i(p4))` — pch below 15, Hz
  otherwise. The interim integer-MIDI extension, its unit/integration test
  additions, and the research.md divergence note were all removed; Hz scores
  flow through the existing `ftom:i(p4)` branch unchanged.
- **Score and objects use BBF**: beyond the score `timeDisplay`, every
  sound object's `startTime` is a 1-based BBF position and its
  `subjectiveDuration`/`repeatPoint` are count-based BBF durations
  (`<startTime type="BBF">` with bar/beat/fraction elements). Conversions
  were verified to round-trip exactly in the project's 4/4 meter (positions:
  bar 5 beat 1 = beat 16; durations: bar 4 beat 0 = 16 beats).

The generator (`pop-song-fixture.ts`) and its always-on test encode these
invariants (`getPchGenerationMethod() === 0`, BBF time bases on every roll,
and the Hz score line). Full validation after the revision: `@blue/data`
1,738 tests, `@blue/app` 3,920 tests, fixture CSD renders with zero errors,
`BLUE_X7_PERF` benchmark passes (dense slice ~3.2x realtime, static-vs-live
equivalence 0), lint, `git diff --check`, and the dist rebuild.

## 2026-08-29 release-tail accumulation fix (inaudible fast path was dead code)

Symptom: realtime performance degrades as playback continues. Root cause
confirmed analytically and empirically:

1. **Long release tails by design**: `bluex7_voice` extends each note by the
   worst-case R4 fall per operator (`xtratim iTailCap + 0.05`, capped at 15 s)
   and turns off only when all six envelopes freeze or the cap elapses. The
   fixture's E Piano patch has op6 R4=20 (worst-case 50.5 s fall -> 15 s cap);
   a probe measured one 0.5 s note's instance living **15.57 s**. The Bass
   patch tails ~5 s. Notes therefore accumulate (note rate x tail).
2. **The inaudible-release fast path could never engage**: it required carrier
   gain <= 1e-5, but the composed envelope floor itself is
   `2^(16*65536/2^24 - 14) = 2^-13.9375 ~= 6.4e-5` per enabled carrier —
   above the bound. Every accumulated tail note therefore ran the full
   six-operator topology until turnoff.

Fix: the carrier-audible bound is now **1e-4** (above the floor). FM output
amplitude is bounded by carrier gain, so when all enabled carriers are below
the bound the worst possible output is `ncar * 1e-4 * (0.5/ncar) * 0.75` ≈
-88 dBFS per voice; the scan still runs every block, so a live edit that
raises a carrier resumes the topology on the same block, and note lifetime
(15.57 s probe unchanged) and envelope semantics are untouched.

Measurements (best-of-N, macOS arm64, Csound 7, sr=44100, ksmps=64):

- accumulation stress (3 notes/s for 30 s, mixer active, ~45 concurrent
  tails): 21.84 s -> 11.70 s CPU (**-46%**);
- stress output comparison: identical audible peaks, max sample difference
  2.66e-4 summed across ~45 simultaneous sub-threshold tails (per voice
  within the -88 dBFS bound);
- reference render (`i1 0 2 8.09 127`, 2.5 s): difference confined to the
  release tail, max 2.5e-5 (~-88.5 dBFS) at t=2.345 s; the locked reference
  hash was re-locked with this review recorded in the test;
- dense fixture benchmark: 3.21x -> **5.01x realtime**; engine one-shot with
  mirroring 4.77 s -> 3.77 s; static-vs-live equivalence gates remain 0.

Validation after the fix: `@blue/data` 1,738 tests, `@blue/app` 3,920 tests,
`generate:blue-x7 --check`, fixture CSD syntax and full render, lint,
`git diff --check`, dist rebuild. Provenance records the change and the
reviewed divergence.

Follow-up option (not taken): turning notes off once all enabled carriers
stay sub-threshold would remove even the remaining wrapper cost of tail
notes, but would end live-edit resurrection of releasing notes (raising an
output level during a tail would no longer be heard); the current design
intentionally keeps notes alive to the frozen-or-capped bound.

## 2026-08-29 release-tail follow-up experiments

The `1e-4` carrier bound above is the baseline for these experiments. The
opt-in benchmark now regenerates the pop-song CSD directly from its checked-in
`.blue` source when the derived `.csd` is absent, accepts
`BLUE_X7_TAIL_RUNS=N`, reports best-of-N fixture CPU, and includes a synthetic
Algorithm 16 case with a fast operator-1 carrier and five slow modulators.

Results on the same local macOS arm64/Csound 7 configuration:

| experiment | natural fixture | synthetic carrier/modulator skew | decision |
|---|---:|---:|---|
| Existing `1e-4` parking baseline | 3.63 s CPU best-of-3; 20.139 s render | 7.82 s CPU; 16.081 s render | reference |
| Hoist `2 ^ kPegLfo` once per block | 3.62 s CPU best-of-3 | not isolated | rejected: ~0.3%, below timing noise |
| Park phase-increment/frequency derivation with the topology and fold the all-frozen count into the existing operator loop | 3.40 s CPU best-of-3; 20.139 s render; 5.84x realtime | 7.82 s CPU; 16.081 s render | kept: ~6.3% lower fixture CPU with unchanged lifetime |
| Terminate when carriers freeze, retaining the all-operator `xtratim` | 3.43 s CPU; 20.139 s render | 7.42 s CPU; 16.081 s render | rejected: no useful lifetime reduction and unsafe for nonzero L4 |
| Compute `xtratim` from carriers only | 2.45 s CPU; render shortened to 10.996 s | 1.32 s CPU; render shortened to 1.181 s | rejected: speed came from shortening valid note lifetime |

The kept frequency-parking change computes current phase increments on the
same block that a live carrier-level edit makes a parked production-inline
voice audible again. Shared-UDO/static/live-inline output equivalence remains
zero in the benchmark. The later release-continuity correction intentionally
re-locked the accepted reference hash because all operator gains now interpolate
between their previous and current block endpoints, matching MSFA.

Release-continuity validation used the fixture's fast Bass-style R4 rates
`90, 90, 82, 90, 90, 90`. With carrier parking disabled to isolate envelope
behavior, the largest control-boundary anomaly fell from 13.82 times its
neighboring waveform movement to below 1.2. With production parking enabled,
the last nonzero sample before exact zero remains below `5e-5`.

Two new Csound counterexamples lock the rejected lifetime policies out:

- a parked production-inline Algorithm 16 voice must resume after an active
  operator-1 output-level edit;
- a fast carrier with nonzero L4 must remain audible while its slow modulators
  release.

Both fail with carrier-only `xtratim`; the second also demonstrates why
`kEgIx >= 4` cannot be treated as carrier silence. After reverting those
variants, both pass along with all 15 modern render/live integration tests.

An initial version of the resurrection probe used the shared-UDO compatibility
path and exposed non-finite output after repeatedly raising a parked carrier's
live output level. The selected production-inline target does not reproduce
that failure and passes the regression. The compatibility-UDO behavior was
recorded but not changed in this release-tail experiment because it is not the
selected runtime path and requires a separate live-state audit.

## 2026-08-29 shared-UDO live-state convergence (T105) — PASS

The compatibility audit reproduced the recorded failure at 13.299 seconds of
a long release while the operator-1 carrier alternated between parked and
restored output levels. Repeated live level shifts could move `kEgLevel` above
the renderer's established `285212672` envelope accumulator ceiling; the
subsequent exponential gain calculation eventually emitted non-finite samples.

The maintained shared UDO and generated inline scalar adaptation now clamp
live output-level shifts to both the existing envelope floor and ceiling. A
Csound-gated regression renders the entire capped release, checks every sample
for finiteness, and requires the shared-UDO output to be byte-identical to the
selected inline+epoch target under the same repeated edit sequence.

Validation: generated-source/provenance check passed; focused target/orchestra/
render/live suites passed (30 tests); complete `@blue/data` suite passed (176
files, 1,741 tests, 1 skipped) after deterministic fixture regeneration; ESM
and CJS builds passed; repository lint and `git diff --check` passed.
