# Research: Mixer Generation Optimization

**Date**: 2026-10-24
**Status**: Design decisions resolved; implementation acceptance evidence remains future work.

## 1. Evidence and report reconciliation

**Decision**: Use the measured review to prioritize local transformations. Treat the supplied “Comprehensive Review: Fused Math Opcodes in Csound” as an opcode/applicability survey, not a performance result. Preserve the original mathematical microbenchmark and raw observations under [evidence/](evidence/); identify the supplied attachment by hash in [provenance.json](evidence/provenance.json). Do not incorporate its C/C++ excerpts or example instruments.

**Rationale**: Fewer opcode dispatches and intermediate vectors can help, but do not guarantee fewer dynamic allocations, hardware FMA, SIMD, zero temporary storage, proportional bandwidth savings, or lower runtime cost. Csound's `mac`/`maca` implementations use per-sample generic argument loops; `sum` uses scratch accumulation with groups of four inputs. Actual generated mixer structure and compiler/runtime builds matter.

The earlier original microbenchmark used macOS arm64, Csound 7 double samples, revision `efbcabb4d56e6237e2cabc9949cfadadda946cf9`, 44.1 kHz, 64 synthetic strips, 60 score seconds, one excluded warmup and three shuffled measured runs. Negative deltas mean less process CPU:

| Candidate                                | ksmps 32 | ksmps 64 | Design disposition                                           |
| ---------------------------------------- | -------: | -------: | ------------------------------------------------------------ |
| Combine send amount and gate at k-rate   |   −20.8% |   −17.5% | Initial implementation target                                |
| Batched final clearing                   |    −4.9% |    −5.0% | Initial implementation target                                |
| 32-input `sum`                           |   −56.1% |   −48.5% | Evaluate conservative batching                               |
| 32-input weighted `mac`                  |   −26.4% |   −13.6% | Evaluate applicability; likely defer if snapshots are needed |
| Two-term panner `mac`                    |    +4.7% |   +23.6% | Retain existing expressions                                  |
| Native audio-rate fade `maca`            |    −0.8% |    +2.4% | No useful demonstrated gain; outside mixer scope             |
| Promote pan controls to audio for `maca` |   +53.2% |   +58.6% | Reject rate promotion                                        |
| Single addition replaced with `vincr`    |   −31.8% |    −2.7% | Evaluate locally, including synchronization semantics        |

**Limitations**: Timings include startup/compilation and measure process CPU, not isolated mixer or steady-state engine time. Fixed gains and synthetic strips do not exercise generated gates, effects, observations, or binding updates. The 0.1-second float32 comparisons cannot prove double-precision equivalence or transition/tail/partial-block behavior. The Python `resource` timing method is not portable unchanged to Windows. The archived result's Blue revision was initially absent; provenance records the review checkout revision, without claiming a generated-CSD benchmark was run.

**Alternatives considered**: Adopt every “fused” opcode; use these percentages as app-wide claims; rerun only algebraic workloads. Rejected because all omit generated-mixer correctness and workload costs.

## 2. Local send-gain combining

**Decision**: In `applyEffectsChain` in `packages/blue-data/src/blue-data/csd-policy.ts`, compute the send amount × live gate as a k-rate value at the send's current position and share that value across its audio channels. Preserve the existing unity/no-gate and fixed-mode paths when no redundant audio-rate product exists. Allocate any new scratch names deterministically in a reserved mixer-specific namespace independent of parameter/gate/panner IDs.

**Rationale**: The current live send emits `(aSource * kSend) * kGate`. Replacing the two audio sweeps with `aSource * (kSend * kGate)` preserves mathematical gain and existing k-rate trajectories. A product calculated earlier could observe different authored control values after a UDO, so calculation stays at the tap.

**Alternatives considered**: In-place `gaBus mac 1, gaBus, kGain, aSource` (measured slower); moving faders/gates across effects; adding a smoothed audio gain; multiplying by `product` after promoting controls. None is justified.

## 3. Final accumulator clearing

**Decision**: Collect the existing source/sub/master reset variables in their current deterministic traversal order and emit batched `clear` at the existing end position, after output and live applied-token echo. Retain resets for disk-pruned sources. Use a deterministic bounded chunk size only if supported-runtime argument-count/large-project checks demonstrate a need; no speculative configurable chunker.

**Rationale**: Csound documents `clear` as equivalent to zero assignment for the listed audio buffers, and its implementation resets full buffers. The accumulator set and placement remain observable contracts. Partial first/final blocks and repeated performances still require direct comparison rather than inference.

**Alternatives considered**: Clear early, skip quiet/pruned buffers, clear only master, or change global bus ownership. These can leak or discard audio.

## 4. Safe bus batching and accumulator replacement

**Decision**: Evaluate `sum` over stable unweighted contributions and `mac` over stable weighted contributions; enable only a conservative region that passes the [eligibility contract](contracts/optimization-eligibility.md). Keep direct `+=` otherwise. Do not add signal snapshots, a purity analyser, a general graph optimizer, a public toggle, or a runtime/platform autotuner. If no useful safe region survives barriers, record batching as deferred and finish the local improvements.

**Rationale**: Source buffers change after sends. Shared `ktempdb`, pan coefficients, and mixer scratch also change between strips. Storing variable names is not storing their tap values. A UDO can read/write arbitrary buses through nested code or macros, so absence of a textual global reference does not prove purity. Destination output of `sum`/`mac` replaces its buffer, so existing direct instrument and earlier effect contributions must be included exactly once.

Required barriers are every enabled effect call (all destinations), first write to a referenced source/gain, destination reads/writes, receiving sub/master processing, meter/output observation, and clearing. Maintain source/sub traversal and contribution order; use `sortSubChannelsForRendering`, never a second sort. Flush affected contributions before a known local mutation and all pending contributions before opaque authored execution. Conservatively decline alias-ambiguous regions. No sends may be deferred merely because a receiver runs later.

**Alternatives considered**: Collect everything until each destination runs; infer effect purity by searching source text; make copies of every tap; build a reusable intermediate representation. Rejected for changed observations, lifecycle bugs, or disproportionate complexity.

## 5. Remaining opcode survey

**Decision**: Restrict implementation to generator-owned mixer operations. Explicitly record the disposition of all surveyed families:

| Family                                            | Applicability and decision                                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mac`                                             | Alternating k/audio pairs; evaluate large weighted fan-ins only. Preserve panner expressions and single-send accumulation.                                                                                   |
| `maca`                                            | Audio/audio pair sums; current mixer gains and gate ramps are k-rate. Clip fades remain outside this feature.                                                                                                |
| `sum`                                             | Audio summing is relevant; k/i array reductions do not map to current scalar bus storage.                                                                                                                    |
| `vincr`                                           | Local route accumulation candidate inside BlueMixer only. Inspect opcode flags/locking and test supported engine concurrency before adoption. Instrument-to-bus conversion in `arrangement.ts` is unchanged. |
| `product` / `dot`                                 | No current multi-audio-factor or numeric-array reduction in generator-owned mixer math. No array conversion or rate promotion.                                                                               |
| `polynomial` / `chebyshevpoly` / `chebyshevpoly2` | Waveshaping, not a present mixer expression. User effect bodies are opaque and unchanged.                                                                                                                    |
| `scale` / `scale2`                                | No demonstrated matching mixer map. Added smoothing/clamping would change the existing contract.                                                                                                             |
| `ntrpol`                                          | Complementary interpolation weights, not arbitrary stereo matrix gains; does not replace audio-rate clip envelopes.                                                                                          |
| `divz` / `limit`                                  | No new safe-division or clamp opportunity established. Existing gate `limit` already has a behavioral role; changing fallback/clamp behavior is not optimization.                                            |
| `pan2` / `modmatrix`                              | No drop-in coverage for all existing laws/modes/boost/runtime updates or current audio buses. Defer.                                                                                                         |

**Rationale**: The report's mathematical descriptions help identify shapes, not authorize feature expansion or guaranteed instruction selection. We do not rely on its broad safety claims about floating-point exceptions, array allocation, or hardware clamping.

**Alternatives considered**: General optimization of all generated or authored orchestra code. Outside scope and unsafe without separate contracts.

## 6. Java parity and generated text

**Decision**: Preserve Java-observable ordering and explicitly permit only the documented optimized mixer statements to differ. Retain unaffected byte-level fixtures; add focused assertions and rendered-audio comparisons for the intentional differences.

**Rationale**: At Java revision `3ca3f40579c48a023299a68130d8ab6b9e950974`, `blue-core/src/main/java/blue/mixer/MixerNode.java` processes pre-effects, fader, post-effects, and route output in order; `Mixer.java` emits output then clears all buses. `blue3` baseline is `6d884110241e55b779210eb93dee5071c0068c02`. Features 111–113 own TypeScript mute/solo/panning extensions. Parameter names, channel identities, gate bank sampling/commit echo, gate/pan ordinals, and existing 5 ms k-rate gate ramps remain unchanged.

**Alternatives considered**: Treat every generated statement as permanently byte-identical; normalize whole snapshots; change legacy musical behavior. The first blocks the authorized optimization; the latter two conceal regressions. No XML changes require loader/writer-history or standalone-resource migrations in this feature.

## 7. Host-owned validation and measurement

**Decision**: Reuse the managed `EngineSession` real-engine integration approach for audio/live controls and add a narrow generated-CSD input mode to the existing native benchmark executable plus wrapper. Both baseline and candidate CSD use the same benchmark executable/runtime. Keep the existing fixed automation scenarios, defaults, report schema, and gates intact for existing callers; the new mode has its own explicit versioned benchmark report contract.

**Rationale**: Existing `native/blue-engine/src/benchmark_main.cpp` only accepts fixed scenarios, with 48 kHz/ksmps 32; it cannot benchmark supplied BlueMixer CSD today. Its `performKsmpsAvgUs` is steady-clock elapsed time, not process CPU. The new mode loads captured/generated CSD with rate/block settings from that file and excludes compilation, startup, warmup, sound-file writes, and device I/O from the measurement window. The primary result is median trial-average elapsed performance time per block for a mixer-dominated generated fixture; representative whole-project results remain separately labelled. No claim of exact mixer-only CPU attribution is made. SC-001/002 use this measurable processing-time outcome.

Capture baseline CSD and manifests before changing the emitter, from the pinned baseline revision. Fixtures use original deterministic source signals and authored test effects, with equivalent baseline/candidate inputs and bindings. The application test harness generates complete project CSD using public generation entry points and exports it for the developer benchmark runner; no production optimization toggle is needed. The wrapper runs baseline/candidate in paired, seeded order and retains raw trials. See the [benchmark contract](contracts/benchmark-evidence.md).

The current ordinary three-platform PR workflow does not set `BLUE_RUN_REAL_ENGINE=1`. Unit success is not engine/audio/performance evidence. Explicit acceptance runs must fail when Csound, engine artifacts, baseline data, or required scenarios are missing, instead of counting skipped tests as success. Performance runs are dedicated evidence, not flaky timing assertions added to the normal unit suite.

**Alternatives considered**: Python process timing as cross-platform release evidence; calling existing native benchmark unchanged; deriving exact mixer cost by subtracting unrelated projects; adding production profiling/IPC. Rejected as inaccurate or unnecessarily broad.

## 8. Numerical and behavioral proof

**Decision**: Decode double-precision WAV for deterministic offline comparisons, assert format/length/finiteness independently, and compare every channel/sample using the [render contract](contracts/render-equivalence.md). Extend host-only test decoding narrowly rather than relying on Float32 conversions or plateau maxima. Managed-engine live captures may remain float32 with their explicitly looser bound and structural control-order assertions.

**Rationale**: `packages/blue-data/src/test-support/csd-render-fixtures.ts` currently decodes PCM16/float32; `compareRenderAudio` casts inputs to Float32. The host panning integration suite renders double WAV but checks plateau levels. Neither alone proves small arithmetic residuals over whole buffers. Existing residual helpers also need an explicit non-finite assertion so NaNs cannot falsely pass.

**Alternatives considered**: Listening alone; float32 equality alone; bit equality for reordered sums; changing gain/normalization or weakening tolerances when a candidate fails. None establishes the required equivalence.

## 9. Boundaries and provenance

**Decision**: Keep the production edit in the existing CSD policy module; defer extraction under `docs/modularization.md` because two local changes do not establish a new deep-module boundary. `BlueData` remains canonical, compilation scratch is disposable, and no project/history/serialization/IPC contract changes are needed. Benchmark C++ remains host-owned in `native/blue-engine`; filesystem/process/decode helpers remain in app or explicitly host-only test support.

**License assessment**: Read `LICENSING.md`, `packages/blue-data/LICENSE`, package metadata/notices, `native/blue-engine/LICENSE.txt`, metadata/notices, and relevant file headers. New generator work is original within the MIT data scope; new native benchmark work is original within the MIT native scope; app-host harness work and spec documents stay in the repository GPL-3.0-or-later scope. Existing artifact expressions include separately licensed dependencies; no new dependencies/assets/tables are planned. Csound source is LGPL-2.1-or-later under the inspected file headers; the Java reference tree's `LICENSE.txt` is GPL v2 with applicable file notices. They are behavioral references only, not source to translate or copy into MIT code. User-supplied report excerpts are likewise not incorporated. No third-party attribution inventory changes are currently required; reassess if implementation introduces external material. This is an original-code-only design, not a finding that cross-scope copying would be compatible.

**Alternatives considered**: Translate Csound kernels into Blue; move GPL host helpers into the MIT data package; extract a generic optimizer for anticipated reuse. Rejected.

## References and exact provenance

- [Archived prior microbenchmark](evidence/microbenchmark.py), [raw measurements](evidence/microbenchmark-results.json), [input provenance](evidence/provenance.json).
- [Java MixerNode, pinned revision](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/mixer/MixerNode.java), [Java Mixer](https://github.com/kunstmusik/blue/blob/3ca3f40579c48a023299a68130d8ab6b9e950974/blue-core/src/main/java/blue/mixer/Mixer.java). Inspected through the local reference checkout.
- [Csound multiply-accumulate implementation, measured revision](https://github.com/csound/csound/blob/efbcabb4d56e6237e2cabc9949cfadadda946cf9/Opcodes/pitch.c), [sum/product implementation](https://github.com/csound/csound/blob/efbcabb4d56e6237e2cabc9949cfadadda946cf9/Opcodes/uggab.c), [accumulator implementation](https://github.com/csound/csound/blob/efbcabb4d56e6237e2cabc9949cfadadda946cf9/OOps/aops.c). Inspected with `git show` at the measured revision, not the moving checkout HEAD.
- Primary manual pages verified during review/planning: [mac](https://csound.com/docs/manual/mac.html), [maca](https://csound.com/docs/manual/maca.html), [sum](https://csound.com/manual/opcodes/sum/), [clear](https://csound.com/docs/manual/clear.html). Additional applicability references: [product](https://csound.com/manual/opcodes/product/), [vincr](https://csound.com/docs/manual/vincr.html), [ntrpol](https://csound.com/docs/manual/ntrpol.html), [pan2](https://csound.com/manual/opcodes/pan2/), [modmatrix](https://csound.com/docs/manual/modmatrix.html), [polynomial](https://csound.com/docs/manual/polynomial.html).
- Existing validation seams: `packages/blue-data/src/blue-data/mixer-gate-csd.test.ts`, `blue-data-csd-{determinism,copy-safety,parity,disk}.test.ts`, `blue-live-csd.test.ts`; `packages/blue-app/src/main/{mixer-mute-solo,mono-clip-panning}.integration.test.ts` and `runtime-parameter-sync.test.ts`.

All design unknowns are resolved. The two local transformations and their
candidate measurements, double-render proofs, and managed-live checks are
complete; see `evidence/implementation-validation.md` and the candidate ledger.
The owner accepts the recorded SC-001 shortfall. Native Windows/Linux evidence
is deferred release validation and is not claimed as completed.
