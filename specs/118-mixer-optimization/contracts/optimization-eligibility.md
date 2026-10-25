# Contract: Optimization Eligibility and Generated Mixer Behavior

This contract governs generator-owned statements in `packages/blue-data/src/blue-data/csd-policy.ts`. It does not authorize rewriting authored instruments/effects, audio-clip fade templates, XML, production engine APIs, or `arrangement.ts` instrument-to-bus writes.

## Preserved execution sequence

- Gate preamble samples the commit/bank once per processing cycle, initializes each state at the existing target, and advances the existing clamped 5 ms k-rate ramp.
- Each source strip executes pre-effects/sends → level → post-effects/sends → eligible pan → output gate → output metering → main route.
- Subchannels follow the existing dependency order from `sortSubChannelsForRendering`, with the same local sequence.
- Master follows its existing local sequence → output → applied-commit echo → all current accumulator clears.
- The same pipeline supports sync/async generation, timeline realtime, BlueLive, and disk. Existing disabled/pruned paths and invalid routing behavior remain.

No optimization changes traversal, source/target resolution, gate ordinals, pan ordinals, parameter/channel identities, exported names, meter keys, scheduled events, or graph diagnostics.

## Local send gain combination

A send amount and live gate may be combined at k-rate only at their original tap, before immediate accumulation for that send's audio channels. Evaluate the product once and reuse it within that send. Never hoist it across a UDO or combine it with gains separated by effects, a send tap, or an observer.

Preserve unity/no-gate short paths. Keep fixed gates, including zero, and disk pruning semantically unchanged. Do not assume a zero factor permits removing a stateful effect or earlier send. Avoid audio-rate control promotion, new interpolation, envelope smoothing, or normalization.

## Batched clearing

The new reset statements list exactly the variables in the old source/sub/master clearing loops, at the old location. Include sources skipped by disk pruning. No new reset occurs earlier. Verify runtime argument limits with a large fixture; split deterministically only if required. Do not emit a zero-argument clear. Batch shape is internal and does not change bindings.

## Deferred accumulation eligibility

All of the following are required for every pending contribution:

1. Source, gain, and destination identity/alias relationships are known from generator-owned operations. Reused pan/level/send scratch is not a stable value merely because its symbol is unchanged.
2. Its audio source and gain retain the original tap values until flush. No known writer, mutation, or implicit source alias is crossed.
3. No observer sees a different destination contribution set or order. Unknown effects are opaque observers/writers of all global audio and control values.
4. Its destination's existing accumulated content is included exactly once when a replacement-output opcode is used.
5. Original contribution order is retained. Mathematical reassociation is permitted only within the numerical bound and never changes a tap/processing boundary.
6. The selected fan-in shape/threshold has matched generated-workload correctness and performance evidence; no platform/runtime probe is added to the data core.

Otherwise emit the current immediate expression. Safety is established per region; project-wide “effect-free” assumptions and textual UDO purity searches are prohibited.

### Flush barriers

| Next operation                                                              | Required action before it executes                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Enabled effect UDO, including nested/macro/opaque authored execution        | Flush **all** pending destinations; do not infer effect purity                                                      |
| Source/gain overwrite, including a fader, scratch reuse, pan or output gate | Flush contributions referencing that value or alias                                                                 |
| Destination read/write                                                      | Flush pending contributions for that destination before the observation/mutation                                    |
| Receiving subchannel or master processing                                   | Flush its input and any affected aliases before processing starts                                                   |
| Meter or output observation                                                 | Flush every contribution that could affect the observed value; use a global flush if that cannot be narrowed safely |
| Commit to a generated ordering boundary with uncertain dependencies         | Flush all; retain the old path if uncertainty remains                                                               |
| Final output/reset/end of emission                                          | No affected pending value survives; all pending lists are empty before clears                                       |

Conservative flushing is preferred to signal snapshots. If barriers eliminate useful groups, document deferral. Do not introduce materialized tap buffers or a general expression IR to force applicability in this feature.

## Opcode-specific conditions

- `sum`: unweighted stable audio contributions; include prior destination content once. Preserve original grouping order as far as the opcode permits and prove whole-buffer residuals.
- `mac`: alternating k-rate gain/audio pairs, even argument count; same lifetime/observer rules. It assigns a weighted sum, so it is not an implicit `+=`. Preserve existing two-term panner expressions and original left/right source copies.
- `maca`: no current BlueMixer adoption. K-rate coefficients are not promoted to make it applicable.
- `vincr`: consider only immediate routes inside BlueMixer. It must pass same-source/destination alias, partial-block, and supported-concurrency behavior checks. The native opcode flag/locking difference must be understood before adoption. Instrument-to-bus emission remains unchanged.

Crossovers must be measured for small and large fan-ins, supported blocks/platforms, and alias cases. A static common threshold is acceptable only with evidence; otherwise defer the candidate.

## Required positive and negative proofs

- Send with non-unity amount/live gate, mono and stereo; unity/no-gate and fixed-muted counterexamples.
- Early send followed by fader, second send, nonlinear/stateful effect, pan, and output gate: destination values remain tied to each original tap.
- Direct bus input plus several contributors; source/sub/master chains; one destination existing before BlueMixer starts.
- Effect that observes a destination before a later contribution; effect that writes a destination; nested UDO/macro observations; an effect without textual bus references is still a barrier.
- Reused gain/scratch names and ambiguous generated aliases retain the existing path or flush before reuse.
- Left-only/right-only/antiphase stereo matrix signals retain both original inputs.
- Existing self-route handling, invalid-route diagnostics, disk pruning, live commit echo, and full clear set remain covered.
