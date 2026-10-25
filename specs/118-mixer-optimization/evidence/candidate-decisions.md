# US2 Candidate Decision Ledger (Spec 118)

Decision date: 2026-10-25. Every entry follows the contract shape: *candidate
name, eligible shape, barrier cases, correctness result, performance evidence
per environment, accept/defer/reject and rationale*. Performance numbers are
median `performKsmpsAvgUs` deltas of paired seeded Release runs (macOS 14.2.1
arm64, Csound 7.0 double, 44.1 kHz/ksmps32, 128 sources → 8 buses, 7 trials;
raw artifacts in `us2-raw/`). Synthetic measurements prioritize shapes only —
they are not generated-mixer acceptance evidence.

> Contract quote honored throughout: **"If aliases/lifetimes cannot be
> established from generator-owned operations, emit the original accumulation
> immediately."** No text-based UDO purity inference, no snapshots, no rate
> promotion, no per-host selection was used or added.

## Completed implementation (US1, accepted)

Implementation closure was accepted on 2026-10-25. The SC-001 exception is
limited to the recorded 32-sample shortfall. macOS correctness and all 72
representative timing comparisons pass; native Windows/Linux validation remains
deferred release work. The two emitter changes below are the final implementation.

| Candidate | Decision | Summary |
| --- | --- | --- |
| Send amount × live gate combined at k-rate at the tap | **SC-001 OWNER-ACCEPTED; PLATFORM GATES PENDING** | Correctness passes; confirmed 32-sample improvement is 9.56% / 9.14%, below SC-001. 64 samples passes at 11.49%. See convergence-performance-results.json. |
| Batched final `clear` | **SC-001 OWNER-ACCEPTED; PLATFORM GATES PENDING** | Correctness passes with the exact ordered reset set. Clearing alone improves 2.37%; the combined candidate still fails SC-001 at 32 samples. |

## Evaluated candidates (US2, this phase)

### `sum` (unweighted large fan-in) — **DEFER**

- Eligible shape: ≥2 consecutive unweighted route contributions into one
  destination bus with no enabled effect, meter/output observation, send
  interleave, or receiving-bus processing between them; prior destination
  content included exactly once.
- Barrier cases: any enabled effect anywhere (opaque observer/writer of all
  global audio → flush all); interleaved sends from other strips (the primary
  fixture's four sends per strip destroy grouping); destination read by
  authored `blueMixerOut "Bus"` direct content (replacement output must seed);
  receiving subchannel processing.
- Correctness result: not implemented in production; eligibility tests pin the
  immediate path (T028, 16 passing).
- Performance evidence: synthetic pure fan-in −11.7% (g2) … −15.6% (g8)
  (macOS/ksmps32 only; no cross-platform/cross-block data).
- Rationale: measured upside exists only in observer-free fan-in-dominated
  regions that the barrier analysis eliminates for realistic bus-heavy
  projects; no supported-platform threshold evidence. Emitting the original
  accumulation immediately is the contract-mandated fallback.

### `mac` (large weighted fan-in) — **DEFER**

- Eligible shape: ≥2 weighted contributions with *stable current k-rate gain
  values* (not expression names), even alternating k/audio argument count,
  prior destination content counted once.
- Barrier cases: all of `sum`'s barriers, plus the gain-lifetime barrier — the
  emitter's `kMixSendGain` and `ktempdb` scratch symbols are shared and reused
  by every subsequent send/fader, so a deferred contribution holding the gain
  by name is not holding a value snapshot (contract: "an expression name is
  not a value snapshot"). Replacement output must seed prior direct bus
  content; the runtime additionally rejects odd argument counts (verified:
  `Must have even number of arguments in mac`).
- Correctness result: not implemented in production.
- Performance evidence: synthetic fresh-assignment form −15.2% (g2) … −18.4%
  (g32) (macOS/ksmps32 only).
- Rationale: safe regions require per-send gain scratch allocation, seeding,
  and full flush bookkeeping — the disproportionate complexity explicitly
  rejected by the plan when barriers leave no worthwhile region; no
  cross-platform threshold evidence.

### `vincr` (immediate inside-BlueMixer route accumulation) — **DEFER**

- Eligible shape: immediate route additions inside BlueMixer with
  same-source/destination alias, partial-block, and concurrency checks passed.
- Barrier cases: same destination observation barriers; native opcode
  flag/locking semantics differ from plain assignment and would need
  supported-concurrency verification.
- Correctness result: not implemented in production.
- Performance evidence: synthetic pure fan-in −1.8% … −3.9% — below
  realistic-mix measurement noise.
- Rationale: fails FR-011's measured-benefit requirement on its own synthetic
  best case; US1's local combining already captured the send-path savings.

## Remaining surveyed families (research §5) — disposition unchanged

| Family | Decision | Applicability reason (from research, re-verified) |
| --- | --- | --- |
| `maca` | REJECT for this feature | Mixer gains/gate ramps are k-rate; audio-rate promotion measured slower (+53..+59%) and forbidden. |
| `product` / `dot` | REJECT | No multi-audio-factor or numeric-array reduction exists in generator-owned mixer math; array conversion/rate promotion out of scope. |
| `polynomial` / `chebyshevpoly(2)` | REJECT | Waveshaping shapes, not present mixer expressions; user effect bodies are opaque and untouched. |
| `scale` / `scale2` | REJECT | No matching mixer map; added smoothing/clamping would change the contract. |
| `ntrpol` | REJECT | Complementary interpolation weights, not arbitrary stereo matrix gains; does not replace audio-rate clip envelopes (outside scope). |
| `divz` / `limit` | REJECT | No new safe-division/clamp opportunity; the gate `limit` has an existing behavioral role. |
| `pan2` / `modmatrix` | REJECT | No drop-in coverage for all existing laws/modes/boost/runtime updates or current audio buses. |
| Two-term panner `mac` | REJECT | Measured slower (+4.7%/+23.6% in archived microbenchmark); panner expressions stay two-term by design (T024 verifies). |

## Intentional generated-text divergences from Java

Only the two current US1 statements differ from Java Blue's generated text
(combined send-gain product; batched `clear`), each documented in
`implementation-validation.md` Phase 3 and covered by focused expectations and
rendered-audio equivalence. All deferred/rejected candidates leave generated
text unchanged.

## Convergence checkpoint, 2026-10-25

Historical numerical checkpoint (later scoped owner acceptance): ksmps32 improves only
9.56% and 9.14% in independent complete seven-pair runs; ksmps64 passes at
11.49%. See [convergence performance evidence](convergence-performance-results.json).
The candidate emitter remains present as uncommitted work for review; it must
not be treated as release-ready or as satisfying SC-001.

`vincr` remains **DEFERRED**. A temporary immediate, nonaliasing live-send
prototype passes 119 full single-thread comparisons, but the required
concurrency proof is blocked by a pinned-baseline four-thread amplitude
violation. No performance/adoption result is claimed. Runtime 19b39531's
`Opcodes/fout.c` registers `vincr` and `clear` with `WI` (writes input arguments);
its increment handles partial blocks. These are behavioral observations from
LGPL-2.1-or-later source, not incorporated source. The active candidate source
was unchanged by these temporary experiments. Sum/mac and other dispositions
remain unchanged.

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
