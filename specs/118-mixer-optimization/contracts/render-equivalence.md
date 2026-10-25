# Contract: Render, Control, and Compatibility Equivalence

## Baseline ownership

Capture complete CSD and binding manifests from the pinned pre-change revision using public BlueData render entry points, before emitter changes. Baseline/candidate use identical original fixture projects, source samples, events, controls, engine/runtime build, sample rate, block size, channel count, and rendering flags. Retain both CSD hashes. No application/project optimization switch or candidate-text reversal creates a reference oracle.

For live captures, use the same initial targets and control-change trace. Existing bank sampling, transaction acknowledgments and observation ordering must match; do not align each audio capture after the fact to conceal a changed transition time. If realtime scheduling is nondeterministic, use a block-synchronized trace and test its structural timing separately.

## Offline numerical limits

Use IEEE float64 WAV output from a supported double-sample Csound 7 build, with `0dbfs=1`, clipping/limiting/dithering disabled. Decode all frames/channel samples as doubles without a Float32 intermediate. Reject missing/malformed/unsupported output explicitly. Test-only decoder extensions remain host-only and use native filesystem paths.

Before computing a residual, assert:

- Equal sample rate, channel count, sample format, number of frames, and complete expected duration including tails.
- Every baseline and candidate sample is finite. NaN/Infinity are failures even when a residual helper would otherwise ignore them.
- Fixture amplitudes stay inside the declared comparison range; overflow or clipping is not a successful comparison.

For original deterministic linear-routing fixtures with reference amplitudes bounded by full scale, the maximum absolute residual across the entire interleaved output MUST be **≤ 1e-12 full scale**. For controlled deterministic stateful/nonlinear effect fixtures the maximum residual MUST be **≤ 1e-6 full scale (−120 dBFS)** across the entire output. The latter also requires the strict linear/tap-observer proofs; it does not authorize different signal paths. Do not loosen these limits or normalize/delay the output to make a failing transformation pass. Defer a failing candidate or investigate a separate existing defect.

Digital silence after clearing and structurally isolated channels require exact zero where the baseline contract specifies zero and no dither/tail exists. Signed zeros may be treated as equivalent. Correlated/antiphase fixtures must retain cancellation behavior within the strict linear bound. Independent musical expectations (tap values, expected impulse indices, gain plateaus and trajectories) supplement baseline comparison so a shared baseline defect cannot mask new routing behavior.

These bounds apply to the controlled acceptance fixtures; they do not claim sample identity for every arbitrary chaotic user DSP system. Authored execution order/content remains exact regardless of numerical tolerance.

## Managed-engine live capture

Reuse the existing opt-in EngineSession capture pattern and managed Csound discovery. Float32 live output is acceptable with whole-buffer residual **≤ 1e-6 full scale**, finite/equal-format/equal-length checks, and separate sample/block timing assertions. Captures must cover startup mute, ramp-in/out, successive bank commits, timeline and BlueLive, parameter synchronization, and meter/output ordering. Test the gate transition duration and commit-to-applied behavior, not merely a final RMS plateau.

Where double offline rendering uses the existing CLI render convention, it remains a host-test operation; new production code does not bypass the managed engine/runtime boundary. Explicit acceptance mode fails if the runtime or required binary is unavailable. Normal non-engine unit runs may remain opt-in, but skips never count as evidence.

## Fixture matrix

| Dimension     | Required cases                                                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generation    | Sync and async timeline, realtime/disk, BlueLive, mixer disabled                                                                                                                          |
| Layout        | Mono/stereo, supported wider unpanned routing, existing unsupported-panning diagnostics                                                                                                   |
| Routing       | No sources, one source, many sources, direct sub/master input, same destination multiple times, chained subchannels, current self-route/cycle rules                                       |
| Sends/effects | Pre/post-fader, interleaved sends/effects, source mutation after early send, nested global observer/writer, controlled nonlinear and stateful effect, effect producing sound from silence |
| Gains/gates   | Zero/unity/non-unity, fixed-muted, live initially closed/open, automated amount, repeated mute/solo updates, bank sampling and applied echo                                               |
| Panning       | Every law/boost pair, Balance/Stereo Pan/Dual Pan, verified mono adaptation, width 0/1, center/endpoints/crossed positions, left/right/correlated/antiphase signals, live switches        |
| Lifecycle     | Sound then silence, effect tails, sample-accurate partial first/final blocks, repeated performances, disk-pruned source clears                                                            |
| Block/rate    | ksmps 1/32/64/128 for correctness where valid, 44.1/48 kHz                                                                                                                                |

A feature-specific test may compose several dimensions; exhaustive Cartesian multiplication is not required. Every changed branch and safety barrier must have a named case, including a negative non-optimization case.

## Text, bindings, and canonical state

- Compare repeated and sync/async generation deterministically. Scratch allocation is independent of automation/channel/gate/pan identities.
- Preserve exact unaffected legacy fixture text and all authored instrument/effect source. Update only intentionally changed mixer statements with explicit expectations; no blanket snapshot regeneration/normalization.
- Compare exported names, parameter maps, gate/panner bindings, meter keys, scheduling, and unsupported-input diagnostics with the reference.
- Assert this feature adds no project mutation, dirty/history change, or source rewrite during successful/failed compilation. Existing generation copy-safety behavior is the reference, not an invitation to repair unrelated mutations.
- Run existing mixer history/preview/reconciliation tests as regressions where live fixtures exercise those paths; no new project writer is introduced.

## Evidence result

Retain fixture ID, baseline/candidate revision and CSD hashes, runtime identity, rendering settings, format/frame counts, finite-sample verdict, maximum residual, structural assertions, and live-trace identity. Record failures and unavailable environments explicitly. All checks must pass before enabling a candidate.
