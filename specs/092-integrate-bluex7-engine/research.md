# Research: Modern BlueX7 Engine and Parameter Integration

## Reviewed inputs

The requested filenames do not exist verbatim. The matching local artifacts are:

- `/Users/stevenyi/work/csound/dx7-emulation/blue_integration_report.md` — 248 lines, SHA-256 `b3c4f7b38cdf7cf5931d2b552a2416082fd1055f5109bdbb015bfa256d804e47`.
- `/Users/stevenyi/work/csound/dx7-emulation/bluex7.orc` — 1,996 generated lines, SHA-256 `2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda`.
- The external checkout was at commit `0482f608cae693516321fa7c3f1ccef31e6ee5e4`; the integration report itself was untracked at review time.

The review also covered the existing TypeScript BlueX7 model/generator/editor, Parameter and score-automation systems, runtime channel synchronization, Track instrument compilation, Java Blue's BlueX7 sources, and the completed spec 081 artifacts.

The project owner subsequently clarified that `dx7-emulation` is transient precursor work. Only the pinned `bluex7.orc` is imported as a starting source; the report and other files remain research evidence, not product dependencies or copied assets.

## Executive conclusion

This feature is three coupled changes, not a resource swap:

1. Replace the Pinkston-derived, per-algorithm generator with the modern 32-algorithm voice renderer.
2. Turn BlueX7's stored scalar values into persistent Parameters and map those Parameters into the generated instrument.
3. Extend the modern renderer's immutable note-start contract so selected values can change during a running performance, with strict instance isolation.

The current `bluex7.orc` is well suited as the synthesis core but not yet as the complete live-control boundary. Its public UDO accepts an i-rate preset table and reads most voice values once at note initialization. Merely writing new values into that table or exporting Parameter channels would update future notes only. Active-note control requires a generated-source change, a Blue-specific live adapter with explicit update semantics, or both.

## Decision 1: Treat the integration as an intentional sound migration

**Decision**: Adopt the modern renderer as the new BlueX7 sound reference. Do not claim legacy Pinkston PCM parity and do not make old/new selection part of this feature.

**Evidence**:

- The new renderer retains the 32 topologies but changes frequency/detune math, log-domain gain, velocity response, envelopes, feedback, oscillator implementation, LFO/PEG, note tails, and output normalization.
- Algorithms 6 and 20 intentionally follow corrected msfa/Dexed/Yamaha routing rather than defects in the old ORCs.
- The current TypeScript BlueX7 generator intentionally matches Java's old behavior, including a hardcoded operator frequency value and many editor values marked stored-only.

**Consequence**: Migration/release notes and regression tests must distinguish data compatibility from sound compatibility. Existing voice XML remains canonical, but the same voice will often sound materially different.

## Decision 2: Promote the precursor `bluex7.orc` into Blue-owned source

**Decision**: Import only the checksum-pinned `bluex7.orc` from `dx7-emulation`, record that baseline, and then maintain/adapt the Csound source in this repository. Use a small Blue-owned deterministic bundler to produce the browser-safe TypeScript artifact. Do not retain a build/runtime dependency on the precursor checkout.

**Evidence**: The artifact is already self-contained and its public UDO is a useful behavioral reference interface. Active-note Parameter behavior and realtime performance require substantial Blue-specific changes, so neither the imported file nor its UDO layout is an immutable production deliverable.

**Consequence**: Git history and `provenance.json` retain the exact imported digest while later edits belong to this feature. Blue CI checks the maintained behavioral source and deterministic TypeScript generator outputs. The precursor generator, UDO fragments, ROM bank, demos, renders, and unrelated validation tooling are not imported.

**Attribution/license handling**: The project owner authorizes reuse of the original precursor work. The imported source still contains portions adapted or transcribed from Google MSFA (Apache-2.0) and behavior cross-checked against Dexed and legacy Blue/Pinkston sources. Preserve the applicable MSFA license/copyright notices, distinguish reference-only projects from incorporated expression, and credit the precursor and relevant projects. No ROM SysEx data is imported.

## Current BlueX7 boundary

The current `BlueX7` class:

- owns the complete Java-compatible voice model and lossless XML template;
- has no `ParameterList` or `getParameters()` method;
- allocates eleven shared legacy tables plus six operator tables per instance;
- selects one legacy algorithm ORC when generating the instrument body;
- substitutes fixed values into orchestra text;
- maps Blue p4 values below 15 through `cpspch`, treats larger p4 as Hz, and reads velocity from p5;
- appends `csoundPostCode` after producing `aout`;
- exposes semantic document patches but has no BlueX7 runtime synchronization path.

The main process currently special-cases `BlueSynthBuilder` for live widget updates. BlueX7 patches persist and update previews but do not write active engine channels.

## Current Parameter and automation boundary

The useful existing pipeline is:

```text
Parameter unique ID (project) -> compilation variable (one render generation)
-> exported Csound control channel -> engine automation/fixed-value writer
-> shared-memory/readback value
```

Important properties:

- `Parameter` already owns stable persisted IDs, fixed values, range, exact decimal resolution, curve, points, automation enabled state, and line color.
- Compilation variable names such as `gk_blue_autoN` are disposable and unique within one compiled parameter list.
- Blue Engine runs automation in the performance thread and mirrors current channel values.
- BlueSynthBuilder provides the closest precedent for synchronizing UI values, Parameters, generated code, and live channels.
- Runtime name reconciliation currently depends on a deterministic parameter ordering between the compile snapshot and live project.

BlueX7 should reuse this system rather than invent a second automation transport.

## Decision 3: Expose 151 Parameters per BlueX7 instance

The minimal complete catalog is 151 values:

| Group | Count | Values |
|---|---:|---|
| Common | 3 | Key transpose, algorithm, feedback |
| Operator enables | 6 | One enable value per logical operator |
| Shared DX7 values | 2 | Oscillator key sync, pitch modulation sensitivity |
| LFO | 6 | Speed, delay, PMD, AMD, sync, wave |
| Operators 1–6 | 126 | 13 per-operator scalars plus four rate/level pairs (21 each) |
| Pitch envelope | 8 | Four rate/level pairs |
| **Total** | **151** | 145 canonical voice-table values plus six enable-mask values |

The two shared values replace twelve per-operator stored projections in the automation catalog. This matches the current TypeScript editor's shared-control semantics and the new renderer's single global slots while leaving mixed legacy XML untouched until an explicit shared edit.

All current values are integers. Each Parameter therefore uses resolution 1. Boolean/enumerated values default to step behavior; ranged numeric values default to the existing linear automation behavior with integer quantization.

Recommended stable internal names are path-like and independent of the instrument display name, for example:

- `common.algorithm`
- `lfo.pitchModulationDepth`
- `operator.1.outputLevel`
- `operator.1.envelope.1.rate`
- `pitchEnvelope.4.level`

User labels can be friendlier (`Operator 1 / Envelope / R1`). Parameter unique IDs, not names, remain the durable score-layer references.

## Decision 4: Keep voice and Parameter state synchronized without split ownership

**Decision**: The BlueX7 voice remains the canonical preset shape; its Parameter list is the canonical automation/fixed-value projection. A single mutation updates both representations. The 155-value projection is derived mapping/test data only; the live target uses compiled globals directly.

Rules:

- Loading old XML creates missing Parameters from voice values.
- Loading XML with Parameters preserves Parameter IDs and automation data, then reconciles catalog names/domains without replacing existing curves.
- A non-automated widget edit updates both the voice scalar and Parameter fixed value.
- An automated Parameter's curve owns effective playback; the voice scalar/fixed value remains the fallback when automation is disabled.
- SysEx import and whole-voice replacement update every fixed projection atomically but retain Parameter identities and automation assignments. Existing automation curves should be retained and clamped only if the field domain changes (none are expected in this migration).
- Deep-copy for a new owner copies values/curves but regenerates IDs. A disposable render clone may use derived IDs because runtime reconciliation is owner/order-based today, but an identity-aware reconciliation is safer.

Persist a standard `parameterList` child under the BlueX7 instrument, matching established Parameter XML rather than creating a BlueX7-only curve schema. Java Blue does not make BlueX7 Automatable and may discard this unknown child on save; that limitation must be explicit.

## Exact UI/model-to-renderer mapping

The reviewed renderer expects the canonical 155-value unpacked DX7 layout. Only slots 0–144 affect synthesis.

### Operator blocks

The renderer stores operator 6 first but Blue models logical operators 1 through 6. For Blue operator index `op` in 1..6, its table block begins at `(6 - op) * 21` and contains:

| Offset | Blue value | Transform |
|---:|---|---|
| 0..3 | Envelope R1..R4 | None |
| 4..7 | Envelope L1..L4 | None |
| 8 | Breakpoint | None |
| 9, 10 | Left/right depth | None |
| 11, 12 | Left/right curve | None |
| 13 | Keyboard rate scaling | None |
| 14 | Amplitude modulation sensitivity | None |
| 15 | Velocity sensitivity | None |
| 16 | Output level | None |
| 17 | Oscillator mode | None |
| 18, 19 | Coarse/fine frequency | None |
| 20 | Detune | Add 7 to Blue's -7..7 value |

### Common block

| Slot(s) | Blue value | Transform/policy |
|---:|---|---|
| 126..129 | Pitch EG R1..R4 | None |
| 130..133 | Pitch EG L1..L4 | None |
| 134 | Algorithm | Subtract 1 from Blue's 1..32 value |
| 135 | Feedback | None |
| 136 | Shared oscillator key sync | Use the shared Parameter; on untouched mixed XML, use logical operator 1 deterministically without normalizing XML |
| 137..140 | LFO speed, delay, PMD, AMD | None |
| 141, 142 | LFO sync, wave | Note the renderer orders sync before wave, unlike some model presentations |
| 143 | Shared pitch modulation sensitivity | Use the shared Parameter; on untouched mixed XML, use logical operator 1 deterministically |
| 144 | Key transpose | Preserve 0..48; renderer subtracts 24 internally |
| 145..154 | Voice name bytes | Not synthesized; fill deterministically and do not create a second canonical instrument name |

The operator-enable booleans form a six-bit mask with bit 0 for logical operator 1 and bit 5 for logical operator 6.

The wrapper converts Blue's established p4 pitch into Hz and then fractional MIDI (`ftom`), passes p5 as velocity, and passes `abs(p3)` as the gate interval. Output becomes `aout`, receives one documented calibration factor, and then enters the saved post code and normal mixer/direct-output transformation.

## Decision 5: Split active-note and next-note semantics explicitly

The existing UDO cannot make any table-backed value live because it reads all voice inputs at i-rate. The revised boundary should classify values rather than letting implementation accidents define behavior.

Implemented semantics:

| Class | Behavior |
|---|---|
| Active-note continuous | Recompute effective gain/frequency/modulation or current envelope target/rate on the next control cycle; smooth values where a discontinuity would otherwise click |
| Active-note discrete | Switch at a control boundary with range validation and bounded transition behavior |
| Next-note | Update the instance immediately, but existing notes retain the state captured when they began; the next note uses the new value |

The selected active-note set is deliberately limited to feedback, LFO pitch/amplitude depth, six operator output levels, and six operator-enable bits. Algorithm topology, transpose, LFO timing/wave/sensitivity, pitch-envelope values, and the remaining operator fields are next-note snapshots. This keeps topology, frequency/scaling, and envelope derivation out of every sounding-note update while retaining useful live mix/modulation edits.

Envelope edits therefore affect the next triggered note. Existing notes retain their captured stage rates/levels and release-tail bound; output-level edits remain active and update the current stage target without replaying completed stages.

The final classification belongs in a shared catalog used by model validation, preview labels, runtime mapping, and tests. It must not be duplicated across renderer widgets and engine code.

## Decision 6: Use shared synthesis support and generated per-instance target code

Lookup arrays and topology helpers are immutable and should occur once per CSD. TypeScript should generate each instance's complete note target after compilation variable names are assigned. Per-instrument state should include:

- the instance's own Parameter-to-compilation-global bindings;
- one generated note instrument containing those exact global names;
- independent note and operator-mask state;
- optional generated domain-epoch globals if the benchmark selects a per-instance change coordinator.

Do not create a mutable 155-slot live transport array or live transport table. Small private indexed state needed by the maintained dynamic loops is acceptable when refreshed only behind a dirty guard. Do not use instrument display names in Csound identifiers. Compilation variable allocation already provides collision-free `gk_blue_autoN` identity and is preferable to module-global counters.

The existing `Arrangement.generateGlobalOrc()` deduplicates only shared object references, not equivalent content from distinct instruments. The plan therefore needs an explicit compile-once registration seam or equivalent UDO/module deduplication. Calling `generateGlobalOrc()` from every BlueX7 would duplicate global arrays and opcode names.

## Decision 7: Commit multi-field updates atomically

Sequentially setting 151 engine channels during SysEx import can expose hybrid voices for several control cycles. This is especially dangerous if algorithm, mask, and operator data disagree temporarily.

Recommended protocol:

1. UI submits one canonical semantic patch (`replaceVoice`, undo, or redo).
2. Main applies it once and derives the complete target snapshot.
3. Main sends one complete validated channel batch.
4. Blue Engine validates and enqueues the batch without calling Csound from the IPC thread.
5. The performance thread applies all entries between `csoundPerformKsmps` calls.
6. Generated direct-global code observes the new complete set at the next control boundary.

The required property is atomic observation, not a Csound table. Applying the whole batch on the performance thread supplies that property at the engine seam and also avoids concurrent `csoundSetControlChannel` calls from the IPC thread. Ordinary one-widget edits use the same queued path with a one-field batch while playing.

## Decision 8: Close the Track automation gap

Track instruments already participate in CSD compilation:

- `Score.prepareTrackInstruments()` deep-copies them into the disposable Arrangement.
- `CompileData.addInstrument()` collects their Parameters.
- Compiled runtime parameter-name synchronization reconstructs arrangement, Track, then mixer ordering.

But two live project paths currently omit Track instrument Parameters:

- score automation snapshot/target construction starts from `ParameterHelper.getAllParameters(arrangement, mixer)`, which has no Score argument;
- `syncScoreAutomationParametersToEngine()` resolves changed IDs from the same arrangement+mixer-only collection.

The feature must introduce one authoritative project-parameter catalog covering arrangement instruments, Track instruments, and mixer Parameters in deterministic order. Track automation targets should appear under their owning Track rather than as globally ambiguous instrument targets.

This catalog also removes the risk of different callers silently choosing different parameter orders during compilation, live-name reconciliation, automation menus, and runtime updates.

## Decision 9: Define manual-versus-automation authority

The current BSB live path may send a direct widget channel write even while engine automation writes the same channel every control period. That creates a transient race and should not be copied.

For BlueX7:

- automation disabled: widget edit updates fixed value and the live channel;
- automation enabled and stopped: widget edit updates the fallback fixed value; the curve remains unchanged;
- automation enabled and playing: automation remains the engine authority, the widget displays readback effective value, and the manual fixed-value edit does not masquerade as an automation write;
- disabling/removing automation deletes engine automation and restores the current fixed value;
- automation authoring occurs through the existing timeline, because this feature does not add latch/touch/write automation modes.

Effective-value feedback can use the engine's channel mirror and should be batched for visible BlueX7 controls rather than issuing 151 independent request/response polls. Readback is disposable renderer state and must not dirty the project.

## Decision 10: Preserve deterministic generation and verification boundaries

Required focused evidence:

- canonical 151-Parameter catalog and XML round trip;
- old XML migration and unknown-node preservation;
- deep-copy/library/Track identity regeneration;
- exact 155-slot transport mapping, including reversed operator order, algorithm -1, detune +7, shared values, and mask bits;
- p4-to-MIDI, p5 velocity, p3 gate/release, post-code, mixer and no-mixer output;
- module included once with two or more BlueX7 instances;
- live fixed edits, automation edits, disable/remove, seek, loop, nonzero render start, and engine rebuild;
- active-note versus next-note classification;
- atomic import/undo/redo;
- four-instance isolation spanning arrangement and Track ownership;
- all 32 algorithms, corrected 6/20 routing, zero-mask silence, finite output, release completion, and accepted modern reference renders;
- output calibration over a representative corpus without per-preset hidden gain.

The external `check.sh` establishes parity between `bluex7.orc` and its research UDO path, all-algorithm renderability, zero-mask silence, and a Blue-shaped demo. It does not establish legacy Pinkston parity, Blue Parameter behavior, multi-instance isolation, or active-note updates; those are new Blue integration obligations.

## Planning risks

1. **Imported-source attribution accuracy**: record which relevant projects supplied incorporated expression versus behavioral cross-checks, and carry applicable third-party license notices with the adapted source.
2. **Active-note algorithm switching**: next-note classification is recommended unless a bounded-cost, click-safe transition design is proven.
3. **151-channel UI readback**: batch and scope to visible/open editors to avoid IPC churn.
4. **Order-based runtime reconciliation**: replace or harden with a shared owner-aware parameter catalog before relying on four-instance routing.
5. **Release-tail mutation**: rate changes during release must not exceed a stale `xtratim` bound or leave notes alive indefinitely.
6. **Output calibration**: the research demos use different gains per preset, which is unsuitable as hidden project behavior; establish one documented integration gain and corpus ceiling.
7. **Legacy Java round trips**: older Java Blue may discard the new Parameter list even while retaining the voice. Document this limitation and test TypeScript round trips separately.

## Performance follow-up: transport and active-note scaling

### Measured baseline

- The generated dense-fixture segment spent about 90.2 CPU seconds in the current live path versus 27.1 CPU seconds with the live hold/transport read replaced by a fixed value, a roughly 3.3x penalty attributable to live parameter handling and repeated active-note derivation.
- The fixture can retain about 59 simultaneous release-inclusive voices (48 piano and 11 bass). The current wrapper copies roughly 145 values and writes them back to the transport table for every active note at every control cycle, so work scales with `parameters × active notes × control cycles`.
- An actual Blue Engine run with all 305 generated control channels advanced 228,480 samples in five wall-clock seconds with mirroring enabled and 232,064 with mirroring disabled. The roughly 1.6% difference makes channel mirroring a secondary concern, not the first optimization target.

### Decision: generate direct-global target code and remove live transport

**Decision**: Preserve the existing `chnexport` globals as the live Parameter representation and generate instance-specialized Csound that names those `gk_blue_autoN` variables directly. Remove both transport ftables, the generated live target's 155-slot `kLiveVoice[]` projection, the per-note catalog copy, table writes, and Parameter `chnget` reads from the live path. Retain the pure 155-slot projection only as a mapping/import/test oracle. The generated inline target captures next-note fields with `i(gk_...)` and keeps only the small state required by the maintained body for dynamic indexing.

**Rationale**: `chnexport` binds the control channel to an ordinary Csound global variable, so generated direct references are the lowest-overhead value path available to orchestra code. The measured regression is not evidence that global reads are costly; it is evidence that the current wrapper copies 145 globals into every note, writes an ftable from every note, and then re-derives all live state every k-cycle. TypeScript already knows the exact compilation symbols and semantic domains, so it can emit optimal target code instead of preserving a generic array-shaped interface.

**Alternatives considered**:

- A central table publisher reduces the current note multiplier but retains a copy, comparison, table-write, and table-read layer that direct generated globals do not need.
- A generic 151-argument UDO keeps one source body but creates a wide shallow interface and may add argument/array overhead; generated target code gives the caller a small semantic generator interface while hiding specialized Csound implementation.
- Unconditionally re-reading and re-deriving all 151 controls in every note retains parameter-by-note work even though the reads themselves are cheap.
- Recompile-on-edit or making every field next-note violates live-edit latency and note-continuity requirements.
- Optimizing Blue Engine mirroring first addresses only the measured low-single-digit portion of the problem.

### Decision: update only changed synthesis domains

The TypeScript generator classifies exactly 15 controls as active-note: feedback, LFO pitch/amplitude depth, six operator output levels, and six operator enables. The other 136 controls are next-note snapshots, including algorithm, transpose, LFO timing/wave/sensitivity, pitch-envelope values, and the remaining operator fields. A per-instance coordinator scans only those 15 globals and publishes a scalar epoch; it never copies values. On a dirty epoch, the inline target reads the live scalars directly, updates six output-level deltas against note-local baselines, and leaves the eight PEG index/rate snapshots untouched. An unchanged note performs no active-state derivation.

### Decision: specialize the live state instead of preserving a generic array

**Decision**: Keep the compact 126-slot operator projection only as a generator fallback for a future active descriptor that truly requires dynamic indexing. For the current catalog, generate no `kLiveOperatorState[]`: use eight k-indexable PEG snapshots and six output-level baselines, with direct global reads for the remaining active controls. UDOs remain available for static and compatibility comparisons; the selected live target is generated inline from the maintained body.

**Rationale**: `chnexport` globals are ordinary Csound globals, so a generated direct read avoids both channel lookup and array marshalling. Most BlueX7 controls are musically safe to apply at note initialization, and their `i(gk_...)` snapshots remove the need to keep k-rate copies alive. The remaining live controls either have scalar effects (feedback/LFO depth/enables) or can be updated from a six-entry baseline (output level). This preserves audible live response while reducing per-note memory and the amount of code executed after a coordinator epoch.

**Measured follow-up**: On the local macOS arm64 build (Csound 7.0, `sr=44100`, `ksmps=64`), the dense 59-note benchmark rendered `1.181315 s` of audio. Static UDO took `1.96 s` wall time; generated inline epoch took `1.99 s`; both outputs were bit-identical (`max difference 0`). The checked-in fixture regenerated to `174,645` bytes and remained syntax-valid. These timings are machine samples, not a new universal realtime guarantee, but they confirm that the scalar target removes the prior live-state projection without adding a measurable CPU penalty to the shared-UDO comparison path.

### Decision: permit generated inlining across UDO seams

**Decision**: Treat the current `bluex7_voice` and topology UDO seams as provisional. The TypeScript target generator must be capable of emitting a shared-UDO target and a behaviorally identical partially or fully inlined target. The selected live form is generated inline when it removes the 155-slot live projection without exceeding the CPU budget; otherwise the maintained UDO remains available for comparison/static paths. If argument passing, array marshalling, or UDO-local state prevents the direct-global target from meeting the performance gates, inline the affected implementation into each generated instance instrument.

**Rationale**: Reuse in source text is not valuable when its runtime interface requires moving or reshaping 151 controls or large per-note arrays. The deep module is the TypeScript generator, whose small semantic interface hides code layout. Csound UDOs are internal seams of that implementation and can be removed without exposing complexity to `BlueX7`, compilation callers, or tests. Immutable lookup tables may still be shared without imposing a per-note parameter-transfer interface.

**Selection rule**: Measure shared-UDO and generated-inline targets with identical globals, score, `ksmps`, and output checks. If CPU differs by more than 5%, choose the faster passing target. Within 5%, prefer the smaller/easier-to-audit generated CSD. Record CSD size and compile time as secondary costs; realtime throughput is primary.

**Alternatives considered**: Keeping UDOs categorically favors source compactness without measuring their Csound runtime cost. Fully inlining by default can inflate CSD size and compile time without benefit. Hand-maintaining separate UDO and inline orchestra implementations would invite behavioral drift, so both benchmark forms must come from the same TypeScript semantic fragments.

### Decision: park inaudible release synthesis

After publication and dirty-domain work meet the relative benchmark, add a conservative release fast path. A released note continues its k-rate envelope/liveness state and existing freeze/cap behavior, but skips the six-operator audio topology while every enabled carrier has a provably sub-audible upper bound. It must resume audio synthesis if a live edit can make the note audible again. This reduces tail cost without shortening note lifetime or changing automation semantics.

## Phase 0 resolution record

The following records turn the exploratory findings above into implementation choices.

### Renderer source form and provenance

**Decision**: Copy the exact reviewed `bluex7.orc` into `packages/blue-data/resources/blue-x7-modern/bluex7.orc` and record its precursor digest as the auditable behavioral baseline. Refactor production into compile-once immutable lookup support plus a browser-safe TypeScript target generator that emits instance-specialized orchestra code and can choose shared-UDO or generated-inline DSP layout. Import no other precursor assets unless a later implementation finding demonstrates a specific need.

**Rationale**: `@blue/data` must generate CSD in browser and Node hosts without runtime filesystem access. The self-contained orchestra is sufficient as an auditable starting point, but its generic `kLiveVoice[]` interface is not a required production architecture. TypeScript knows the catalog, static voice, and resolved Parameter globals at compilation, so a target generator can preserve the synthesis behavior while emitting direct specialized Csound. Checksums, deterministic generated-text tests, and Git history distinguish the imported baseline from later Blue integration work.

**Current evidence**: The inspected precursor checkout is at `0482f608cae693516321fa7c3f1ccef31e6ee5e4`; `blue_integration_report.md` is untracked there. Its reviewed report and `bluex7.orc` hashes remain `b3c4f7b38cdf7cf5931d2b552a2416082fd1055f5109bdbb015bfa256d804e47` and `2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda`. The precursor's original work is authorized for import by the project owner. Locally retained MSFA reference files carry Google Apache-2.0 headers; the Blue copy must propagate applicable notices and clearly label MSFA, Dexed, legacy Blue/Pinkston, and other sources as incorporated or reference-only as appropriate.

**Alternatives considered**: Runtime file loading violates the portable core and package distribution model. Copying the entire precursor repository imports unnecessary ROM, demos, renders, and tooling. Keeping the external repository as a build dependency makes ordinary builds nondeterministic and contradicts its transient role. Treating one monolithic generated string as hand-edited source would be difficult to maintain; the target generator instead owns named semantic fragments and is verified against accepted renders and deterministic generated-source snapshots.

### Parameter schema and reconciliation

**Decision**: Define one immutable 151-entry descriptor catalog and reconcile each BlueX7-owned persisted `ParameterList` by stable semantic key.

**Rationale**: One schema prevents the editor, XML loader, automation chooser, CSD mapping, and runtime sync from drifting. Reconciliation supports legacy XML while retaining IDs and automation metadata for existing owners.

**Alternatives considered**: Generating Parameters from renderer widgets would make UI structure canonical and duplicate non-UI Track behavior. Storing all descriptor metadata independently in every project would increase migration drift. Recreating IDs on every load would break automation layer assignments.

### Project-wide Parameter enumeration

**Decision**: Add an owner-aware project Parameter catalog covering arrangement, Track, and mixer domains, while retaining `ParameterHelper.getAllParameters(arrangement, mixer)` as a compatibility facade for callers that intentionally exclude Score.

**Rationale**: Current compilation includes Track Parameters but live score lookup does not. Owner identity plus Parameter ID closes this gap and removes ambiguous name/order routing without forcing an unrelated API break.

**Alternatives considered**: Appending Track Parameters at individual call sites preserves divergent order and omissions. Routing by display name fails duplicate-name and copy cases. Mutating the project Arrangement to contain Track instruments would violate canonical ownership.

### Compile-once synthesis resources

**Decision**: Pass the existing `CompileData` into instrument global-orchestra generation and register a BlueX7 support key in its compilation-variable map. Emit immutable lookup/topology support once, then invoke the TypeScript target generator after each instance's Parameter globals have been allocated.

**Rationale**: `CompileData` already owns one generated performance, a generic registry, and the disposable `gk_blue_autoN` names. It is the smallest deterministic seam for compile-once support and instance specialization without process globals. The generator becomes a deep module: its interface is catalog bindings plus static voice context, while its implementation owns Csound declarations, direct references, domain guards, initialization, and DSP composition.

**Alternatives considered**: Deduplicating by instrument object only fails distinct BlueX7 instances. A module-global boolean leaks across renders. Text-level global-orchestra deduplication is fragile. Recasting the generated module as many `OpcodeDefinition` objects does not naturally own its global arrays and generator provenance.

### Direct-global active-note code and atomic batches

**Decision**: Generate direct `gk_blue_autoN` references at the synthesis use sites. Capture the 136 next-note descriptors with `i(gk_...)` at note start, and generate a scalar epoch coordinator for the 15 active descriptors (feedback, LFO depths, output levels, and enables). Apply complete channel batches on the Blue Engine performance thread between k-cycles. The pure 155-slot mapping remains an oracle, not a live transport.

**Rationale**: The reviewed UDO is i-rate today and cannot satisfy live updates unchanged, but neither an array nor a table is inherent to active-note support. Direct generated globals remove the avoidable copy path. Domain guards prevent expensive derivation from scaling with every parameter on every k-cycle. Performance-thread batch application supplies old-or-new observation for both existing and newly initialized notes while keeping automation channel-authoritative.

**Alternatives considered**: Sequential IPC-thread channel writes expose partial voices and race the performance thread. A committed table can mask that problem but retains redundant transport. Recompiling on every edit misses latency and note-continuity requirements. Making all fields active-note makes algorithm topology and sync transitions costly and unpredictable. Making all fields next-note fails the explicit live-edit requirement; the selected 15-control live set is the minimum measured surface that preserves useful sounding-note edits without rebuilding operator state.

### Effective-value readback and engine transport

**Decision**: Add capability-gated batch get/set commands to Blue Engine and request only visible controls for open editors at 20 Hz.

**Rationale**: The existing engine protocol serializes REQ/REP calls. Up to 151 separate reads per editor every 50 ms would create avoidable queue latency, especially for several instruments. Engine readback reflects seeks, automation quantization, and actual authority more reliably than renderer-side curve estimation.

**Alternatives considered**: Polling single channels is unbounded round-trip churn. Mirroring the entire automation evaluator in the renderer creates a second runtime truth. Exposing native shared memory directly to renderer code violates engine isolation. Pushing all 151 values continuously wastes work when most controls are not visible.

### Output calibration

**Decision**: Choose one documented integration gain using a representative voice/note/velocity corpus, preserve Blue's post-code and mixer/direct-output position, and fail tests on non-finite output or corpus clipping.

**Rationale**: External demos use preset-specific gains, which cannot become hidden project behavior. A fixed boundary gain is predictable, testable, and compatible with downstream user post-processing.

**Alternatives considered**: Per-voice gain changes sound semantics and is invisible to automation. Automatic normalization changes dynamics over time. Keeping demo gains makes identical Blue controls depend on test-preset identity.

### Validation baseline

**Decision**: Treat modern reference renders, mapping/protocol contracts, Java/XML fixtures, and the four-owner stress scenario as complementary gates; do not claim Pinkston PCM parity.

**Rationale**: The external checks prove the modern renderer against its own research path but not Blue's persistence, automation, routing, Track, or instance behavior. Java remains authoritative for project semantics while the new renderer is an intentional sonic migration.

**Alternatives considered**: Waveform parity with the old renderer contradicts the selected synthesis engine. Manual-only validation cannot protect 151 mappings or multi-instance routing. Unit-only testing misses engine timing, release, and isolation faults.
