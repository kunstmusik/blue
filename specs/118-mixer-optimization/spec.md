# Feature Specification: Mixer Generation Optimization

**Feature Branch**: `codex/118-mixer-optimization`

**Created**: 2026-10-24

**Status**: Complete — implementation accepted 2026-10-25; native Windows/Linux release validation deferred

**Input**: Optimize BlueMixer generation using the prior measured review and the supplied fused-math opcode survey. Reduce mixer processing cost without changing project sound, routing, automation, live controls, or supported project compatibility. Select changes by measured benefit and behavioral equivalence rather than operation counts alone.

## Completion and acceptance

The implementation is complete: eligible live sends combine amount and gate once
at the existing tap, and final accumulator resets use bounded `clear` statements.
Bus accumulation candidates remain deferred or rejected with recorded reasons;
no project format, authored DSP, public runtime contract, or dependency changed.

The owner accepts the recorded SC-001 shortfall: independent 32-sample runs
improved processing time by 9.56% and 9.14%, and the 64-sample run improved it by
11.49%. The raw 10% numerical check remains false at 32 samples; this is a scoped
acceptance decision, not a changed global threshold.

Verified macOS evidence includes 197 offline comparisons, 38 panning cases, two
managed timeline/BlueLive traces, and 72 representative performance comparisons.
The largest measured regression is 3.61%, within the unchanged 5% bound. The
unrelated native `sndinfo` discovery failure has a documented scoped validation
exception. See [implementation validation](evidence/implementation-validation.md).

Native Windows/Linux correctness, performance, and path validation remain
required release follow-ups, tracked by T038/T053/T056/T059. They are deferred
from implementation closure, remain unchecked, and are not claimed as passes.
This specification's completion does not declare cross-platform release acceptance.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Run send-heavy mixes with less processing overhead (Priority: P1)

A composer plays or exports a project with many mixer strips, sends, and changing mute/solo states. Mixing consumes less processing time while send levels, effect inputs, and audible transitions retain their existing meaning.

**Why this priority**: Combining simultaneously applicable gains offers a local improvement with measured support, without redesigning the mixer graph.

**Independent Test**: Play and render a fixed send-heavy project before and after optimization, compare audio and control transitions, and measure processing time for the generated mixer workload under identical conditions.

**Acceptance Scenarios**:

1. **Given** a stereo project with automated send amounts and live mute/solo changes, **When** the project plays, **Then** every destination receives the same source at the same tap position, with the same gain trajectory and transition duration.
2. **Given** a send before a fader or between two effects, **When** later processing changes the source, **Then** the send retains the signal value at its original position in the chain.
3. **Given** a measured send-heavy reference workload, **When** an optimization is accepted, **Then** it satisfies the performance and audio-equivalence criteria without requiring a new project setting.

---

### User Story 2 - Scale bus-heavy mixes safely (Priority: P2)

A composer routes many source strips and submixes into shared buses. The system reduces redundant mixing work where it can preserve the existing execution order and visibility of bus signals.

**Why this priority**: Large groups of incoming signals have the largest measured opportunity, but regrouping contributions can change behavior when their values or timing are not preserved.

**Independent Test**: Render projects containing direct bus input, several sources per bus, chained submixes, interleaved effects and sends, and effects that observe global buses. Compare all monitored destinations with the reference behavior and benchmark large fan-ins.

**Acceptance Scenarios**:

1. **Given** a bus with existing direct instrument input and contributions from multiple strips, **When** incoming contributions are combined, **Then** the direct input is retained exactly once and the bus processes the complete input in its established order.
2. **Given** an effect that reads a bus before a later contribution is produced, **When** optimization runs, **Then** that effect observes the same contribution set as before.
3. **Given** a route whose ordering or signal lifetime cannot be shown to be safe for regrouping, **When** the mix is generated, **Then** that route retains its existing processing strategy.
4. **Given** a candidate optimization that is slower for the applicable workload, **When** the implementation is selected, **Then** it is not enabled for that workload solely because it combines more arithmetic operations.

---

### User Story 3 - Reopen existing projects and trust playback and exports (Priority: P1)

A composer reopens an existing Java Blue or Blue TypeScript project and plays it in timeline or live mode, or exports audio. Optimization is automatic and retains project sound and controls without changing the saved project or instrument/effect source text.

**Why this priority**: Performance improvements must not alter music, supported data, or runtime control behavior.

**Independent Test**: Load the compatibility corpus, generate all supported render modes, compare saved project content and runtime bindings, and compare deterministic audio with the pre-optimization reference.

**Acceptance Scenarios**:

1. **Given** an existing project with panning disabled, **When** it is opened and rendered, **Then** legacy routing and supported project content are retained.
2. **Given** enabled mono or stereo panning, **When** pan position, law, boost, width, or stereo mode changes, **Then** gain equations, channel separation, startup values, and live updates retain their existing behavior.
3. **Given** a note or clip ends or a muted route remains inactive, **When** the next processing cycle begins, **Then** stale bus samples do not leak into the output.
4. **Given** a render is generated, **When** generation completes or fails, **Then** this feature introduces no additional canonical project mutations, dirty-state changes, history entries, or edits to authored source text.

### Edge Cases

- No source channels; one source; no sends; disabled mixer; mono output; stereo output; currently supported wider-channel routing with panning restrictions unchanged.
- Unity and zero send amounts, fixed-muted routes, initially muted playback, gate changes during playback, rapid successive control updates, and existing automation boundaries.
- Multiple sends to one destination, chained subchannels, self-route guards, existing invalid-route/cycle diagnostics, direct `blueMixerOut` bus contributions, and `blueMixerIn` replacement behavior.
- A signal changes after an early send; an effect reads or writes global buses; an effect has internal state or produces output from silence; nonlinear effects separate two gains.
- Stereo matrices use both original inputs; left-only, right-only, correlated, antiphase, center, endpoints, every supported law and boost setting, and live mode switches.
- A silent block follows a non-silent block, sample-accurate partial first/final blocks, effect tails, and repeated live performances do not retain unintended contributions.
- Different processing block sizes, including one-sample blocks and the existing 32/64-sample reference cases; no assumption that fewer operations are faster on every platform.
- Tiny rounding differences from reordered arithmetic; no new clipping, normalization, attenuation, smoothing, or gain floor may be introduced to hide a mismatch.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST reduce redundant mixer arithmetic and buffer-reset work where the existing signal and timing contracts can be preserved. The first delivery MUST address simultaneously applicable send gains and end-of-cycle clearing, subject to the evidence gates below.
- **FR-002**: The system MUST evaluate large unweighted and weighted bus fan-ins and individual route accumulation as additional optimization candidates. A candidate MAY be retained in the existing form when safety or measured benefit is not established; the decision and evidence MUST be recorded.
- **FR-003**: Optimized playback and export MUST preserve send tap positions, effect/fader/pan/gate order, existing destination contributions, subchannel dependency order, output/meter tap positions, and observable global-bus reads/writes by authored code. Contributions MUST never be lost, duplicated, or deferred past an observer.
- **FR-004**: All current pan modes, laws, boost choices, channel layouts, automation, mute/solo startup states, gate transition durations, and runtime control bindings MUST retain their existing meaning and update behavior.
- **FR-005**: Every audio accumulator currently reset after output MUST still be reset at the corresponding point, including source, subchannel, and master accumulators, with no residual-audio leakage.
- **FR-006**: Optimization MUST apply consistently to synchronous and asynchronous generation, timeline realtime playback, BlueLive, and disk export where the candidate is eligible. Repeated generation from equivalent inputs MUST remain deterministic.
- **FR-007**: Optimization MUST be automatic, deterministic, and limited to generator-owned mixer math. It MUST NOT rewrite user instruments, effect bodies, library resources, embedded code, or the separate audio-clip fade templates as part of this feature.
- **FR-008**: The system MUST preserve supported current and historical projects, existing validation and diagnostics, disabled-mixer behavior, existing compilation/runtime bindings, and the supported external engine contract. No new project option, migration, dependency, or runtime capability requirement may be introduced.
- **FR-009**: Each enabled transformation MUST have focused generation tests and rendered-audio comparisons appropriate to its signal flow. Tests MUST cover the transformation's boundary cases and at least one negative case where it must not apply.
- **FR-010**: Performance evidence MUST separate isolated arithmetic measurements from complete generated-mixer and representative-project measurements; record environment, runtime revision, workload, baseline revision, block size, repetitions, timing method, and raw results; and exclude audio device and disk-output variability from the core processing comparison.
- **FR-011**: A transformation MUST satisfy the correctness contract and demonstrate repeatable benefit for its eligible workload before it is enabled. Selection MUST NOT rely solely on fewer generated statements, assumed hardware instructions, or the supplied report's general efficiency claims.
- **FR-012**: Existing exact-output fixtures MUST remain unchanged for unaffected generation. Any deliberately changed mixer statements MUST be documented as an intentional generated-text divergence from Java and covered with narrowly scoped expectations and semantic/audio validation; broad snapshot normalization MUST NOT hide unrelated differences.
- **FR-013**: Where regrouping cannot preserve signal lifetime or authored-code observations conservatively, the system MUST keep the existing evaluation strategy. Optimization MUST NOT change signal rates or control-transition shapes to make a candidate applicable.

### Existing Behavior & Data Compatibility _(mandatory when applicable)_

- **Reference Behavior**: Java Blue `Mixer.java` and `MixerNode.java` establish separate fader multiplication, ordered effect/send processing, route accumulation, and final clearing. The prior review used Java revision `3ca3f40579c48a023299a68130d8ab6b9e950974`. Existing TypeScript mute/solo and panning contracts in features 111–113 remain authoritative for those extensions. The implementation plan records exact source/artifact provenance.
- **Compatibility Requirements**: `.blue` project and independently loaded resource formats, accepted historical forms, validation rules, significant code whitespace, and safe save behavior are unchanged. This is generation-only work, not a serialization change. Authored source and bindings remain intact; generated mixer text may change only under FR-012.
- **Migration Boundaries**: No project, resource, disk/library, or BlueShare migrations are added or modified. Existing loader ownership, ordering, conflict handling, and diagnostics remain in effect.
- **Intentional Divergences**: Eligible generated mixer arithmetic and clearing syntax may differ from Java's generated statements for measured performance, with equivalent observable audio/routing/control behavior. No new musical behavior or Java project-format divergence is authorized.
- **State Ownership**: Main-owned canonical `BlueData` remains unchanged by this feature. Generated mixer statements and any contribution descriptions exist only for one compilation and are discarded with its result. Benchmark outputs are developer evidence, not project state or application settings.
- **Undo/Redo Impact**: No new or modified durable project writer is introduced, so no new history entry or non-undoable mutation is needed. Existing mixer edits, previews, cancellation, undo/redo, and runtime reconciliation continue through their current owners and contracts.

### Key Entities

- **Mixer contribution**: A source signal at a specific tap position, its applicable gain and gate, its destination, and the point at which observers must see it.
- **Processing boundary**: An effect, fader, pan, gate, meter, authored-code observation, or receiving-bus execution that limits which operations may be combined safely.
- **Optimization evidence**: The baseline and candidate behavior, applicable workload, correctness results, measured processing cost, supported environments, and acceptance or deferral decision.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The designated send-heavy reference mix uses at least 10% less median processing time per audio block at both 32- and 64-sample blocks on the recorded reference system, using at least seven timed runs after warmup. The fixture is deliberately mixer-dominated and excludes compilation/startup from timing; this is not exact attribution of mixer-only CPU or a promised percentage reduction in total project cost.
- **SC-002**: Across the representative small, send-heavy, bus-heavy, effects-heavy, mono, stereo, and disabled-mixer workloads, no enabled transformation produces a repeatable median processing-time regression above 5% under identical conditions. Release acceptance includes correctness and representative performance evidence on macOS, Windows, and Linux; missing evidence is reported as incomplete.
- **SC-003**: Every deterministic audio fixture passes the explicit numerical-equivalence limits in the render contract, including silence, channel isolation, control boundaries, tails, and partial blocks. Routing order, control events, and accumulator clearing have zero behavioral mismatches; numerical tolerance cannot excuse structural differences.
- **SC-004**: All compatibility and generation-mode fixtures pass, with identical authored project/resource content and unchanged public runtime bindings. Repeated equivalent renders produce identical output within each generation mode, including synchronous/asynchronous parity.
- **SC-005**: Every evaluated candidate has a recorded accept/defer/reject decision with correctness and performance evidence or a concrete applicability reason. Unmeasured opcode changes are not enabled and no unverified whole-project speedup is claimed.

## Assumptions

- The completed delivery includes the two local emitter changes, their validation tooling and evidence, and documented candidate dispositions. Native Windows/Linux release validation remains deferred as recorded above.
- Local gain combining and clearing are the initial scope. Bus regrouping and alternative accumulation remain candidate work requiring conservative safety and measured benefit; adopting every surveyed opcode is not a completion requirement.
- The existing supported Csound runtime remains the target. The earlier Mac microbenchmarks inform prioritization but do not establish end-to-end or cross-platform performance.
- Generic fused arithmetic is not a hardware-FMA/SIMD guarantee. Temporary storage and dispatch behavior depend on the opcode, compiler, runtime build, and input shape.
- User-authored DSP optimizations, clip fade rewrites, synthesis changes, native Csound patches, a general expression optimizer, UI controls, and a platform-specific runtime autotuner are outside this feature.
- Existing invalid-input handling and any unrelated defects observed during comparison are preserved and reported separately; this feature does not silently redefine behavior under the label of optimization.
