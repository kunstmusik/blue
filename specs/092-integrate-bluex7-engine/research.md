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

**Evidence**: The artifact is already self-contained and its public UDO is the useful integration boundary. Active-note Parameter behavior requires substantial Blue-specific changes, so the imported file is a starting source rather than an immutable generated deliverable.

**Consequence**: Git history and `provenance.json` retain the exact imported digest while later edits belong to this feature. Blue CI checks the maintained `.orc` against the generated TypeScript module. The precursor generator, UDO fragments, ROM bank, demos, renders, and unrelated validation tooling are not imported.

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

**Decision**: The BlueX7 voice remains the canonical preset shape; its Parameter list is the canonical automation/fixed-value projection. A single mutation updates both representations. The 155-value engine table is derived transport only.

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

Recommended semantics:

| Class | Behavior |
|---|---|
| Active-note continuous | Recompute effective gain/frequency/modulation or current envelope target/rate on the next control cycle; smooth values where a discontinuity would otherwise click |
| Active-note discrete | Switch at a control boundary with range validation and bounded transition behavior |
| Next-note | Update the instance immediately, but existing notes retain the state captured when they began; the next note uses the new value |

Initial next-note candidates are algorithm topology, oscillator key sync, and LFO key-sync initialization. Algorithm could be made active-note only with substantially more routing-state and transition work; classifying it next-note is the simpler predictable default. Oscillator/LFO sync are intrinsically note-initialization concepts.

Envelope edits require special rules: a change to the current/future stage updates the active state machine without replaying completed stages; a changed release rate/target must also update the release-tail bound or use a safe dynamic cap.

The final classification belongs in a shared catalog used by model validation, preview labels, runtime mapping, and tests. It must not be duplicated across renderer widgets and engine code.

## Decision 6: Use one shared synthesis module and per-instance transport

The generated UDOs and lookup arrays are immutable and should occur once per CSD. Per-instrument state should include:

- one independent voice transport (or double-buffered pair);
- one independent operator mask;
- the instance's own Parameter-to-compilation-channel bindings;
- a commit/version value for atomic multi-field changes.

Do not create global mutable voice arrays with unqualified names. Do not use instrument display names in Csound identifiers. Table allocation through the compilation context already provides collision-free numeric identity and is preferable to module-global counters.

The existing `Arrangement.generateGlobalOrc()` deduplicates only shared object references, not equivalent content from distinct instruments. The plan therefore needs an explicit compile-once registration seam or equivalent UDO/module deduplication. Calling `generateGlobalOrc()` from every BlueX7 would duplicate global arrays and opcode names.

## Decision 7: Commit multi-field updates atomically

Sequentially setting 151 engine channels during SysEx import can expose hybrid voices for several control cycles. This is especially dangerous if algorithm, mask, and operator data disagree temporarily.

Recommended protocol:

1. UI submits one canonical semantic patch (`replaceVoice`, undo, or redo).
2. Main applies it once and derives the complete target snapshot.
3. Runtime writes changed values into inactive/staging transport.
4. Runtime advances one instance-scoped commit generation.
5. Notes observe the new complete generation at a control boundary.

A double-buffered table is one viable implementation; a staging table plus versioned copy is another. The requirement is atomic observation, not a particular mechanism. Ordinary one-widget edits can use the same commit path with a one-field delta.

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

## Phase 0 resolution record

The following records turn the exploratory findings above into implementation choices.

### Renderer source form and provenance

**Decision**: Copy the exact reviewed `bluex7.orc` into `packages/blue-data/resources/blue-x7-modern/bluex7.orc`, record its precursor digest, and adapt it there as the canonical Blue-owned Csound source. Generate a checked-in, browser-safe TypeScript string module deterministically. Import no other precursor assets unless a later implementation finding demonstrates a specific need.

**Rationale**: `@blue/data` must generate CSD in browser and Node hosts without runtime filesystem access. The self-contained orchestra is sufficient as an auditable starting point, and adapting it locally avoids treating a transient research checkout as an upstream dependency. Checksums and Git history distinguish the imported baseline from later Blue integration work.

**Current evidence**: The inspected precursor checkout is at `0482f608cae693516321fa7c3f1ccef31e6ee5e4`; `blue_integration_report.md` is untracked there. Its reviewed report and `bluex7.orc` hashes remain `b3c4f7b38cdf7cf5931d2b552a2416082fd1055f5109bdbb015bfa256d804e47` and `2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda`. The precursor's original work is authorized for import by the project owner. Locally retained MSFA reference files carry Google Apache-2.0 headers; the Blue copy must propagate applicable notices and clearly label MSFA, Dexed, legacy Blue/Pinkston, and other sources as incorporated or reference-only as appropriate.

**Alternatives considered**: Runtime file loading violates the portable core and package distribution model. Copying the entire precursor repository imports unnecessary ROM, demos, renders, and tooling. Keeping the external repository as a build dependency makes ordinary builds nondeterministic and contradicts its transient role. Treating only a generated TypeScript string as source would be difficult to maintain; retaining the `.orc` plus a Blue-owned bundler preserves editability.

### Parameter schema and reconciliation

**Decision**: Define one immutable 151-entry descriptor catalog and reconcile each BlueX7-owned persisted `ParameterList` by stable semantic key.

**Rationale**: One schema prevents the editor, XML loader, automation chooser, CSD mapping, and runtime sync from drifting. Reconciliation supports legacy XML while retaining IDs and automation metadata for existing owners.

**Alternatives considered**: Generating Parameters from renderer widgets would make UI structure canonical and duplicate non-UI Track behavior. Storing all descriptor metadata independently in every project would increase migration drift. Recreating IDs on every load would break automation layer assignments.

### Project-wide Parameter enumeration

**Decision**: Add an owner-aware project Parameter catalog covering arrangement, Track, and mixer domains, while retaining `ParameterHelper.getAllParameters(arrangement, mixer)` as a compatibility facade for callers that intentionally exclude Score.

**Rationale**: Current compilation includes Track Parameters but live score lookup does not. Owner identity plus Parameter ID closes this gap and removes ambiguous name/order routing without forcing an unrelated API break.

**Alternatives considered**: Appending Track Parameters at individual call sites preserves divergent order and omissions. Routing by display name fails duplicate-name and copy cases. Mutating the project Arrangement to contain Track instruments would violate canonical ownership.

### Compile-once synthesis resources

**Decision**: Pass the existing `CompileData` into instrument global-orchestra generation and register a BlueX7 module key in its compilation-variable map. Allocate per-instance mutable transport through the same render context.

**Rationale**: `CompileData` already owns one generated performance and has a generic registry; it is the smallest deterministic seam for one shared module without process globals. Extending the base method with an optional/context argument remains compatible with zero-argument overrides.

**Alternatives considered**: Deduplicating by instrument object only fails distinct BlueX7 instances. A module-global boolean leaks across renders. Text-level global-orchestra deduplication is fragile. Recasting the generated module as many `OpcodeDefinition` objects does not naturally own its global arrays and generator provenance.

### Active-note transport and atomic batches

**Decision**: Use per-instance transport with hold/commit controls. Active-note fields consume validated Parameter channels at k-rate; algorithm and the two sync controls are captured at note start. Complete voice changes hold the old committed snapshot, batch-write all values, and publish one generation at a control boundary.

**Rationale**: The reviewed UDO is i-rate today and cannot satisfy live updates unchanged. Hold/commit prevents algorithm/operator hybrids while allowing existing engine automation to remain channel-authoritative between whole-voice operations.

**Alternatives considered**: Sequential channel writes expose partial voices. Recompiling on every edit misses latency and note-continuity requirements. Making all fields active-note makes algorithm topology and sync transitions costly and unpredictable. Making all fields next-note fails the explicit live-edit requirement.

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
