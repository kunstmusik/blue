# Feature Specification: Blue Engine Host Performance and Real-Time Safety

**Feature Branch**: `072-blue-engine-performance`

**Created**: 2026-08-13

**Status**: Implemented — local validation complete

**Input**: User description: "Incorporate the consolidated Blue Engine performance review into a measured optimization effort covering the realtime host loop, shared control-channel mirroring, automation processing, Release builds, request handling, and offline rendering without changing observable engine behavior."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sustain Predictable Realtime Playback (Priority: P1)

A musician can run a project with many control channels and active automations without avoidable Blue Engine host overhead causing playback spikes or dropouts. Projects with unchanged controls, frequently changing controls, completed automations, and no automations all retain the same audible and control behavior.

**Why this priority**: Realtime playback is the engine's primary responsibility. Work repeated during every control period directly reduces the processing time available to Csound and increases the risk of audible interruption.

**Independent Test**: Run representative Release workloads with 0, 32, 128, and 256 mirrored channels and with linear, exponential, quantized, completed, and absent automations; compare the host-processing measurements and final control values with the accepted baseline.

**Acceptance Scenarios**:

1. **Given** a project whose mirrored channels and automation definitions remain unchanged, **When** realtime playback continues across a full measurement interval, **Then** Blue Engine avoids repeated coordination and redundant publication work while preserving every visible value.
2. **Given** a project whose control channels change every control period, **When** realtime playback runs under the same score and environment as the baseline, **Then** every required change remains observable and host processing meets the feature's regression gate.
3. **Given** an automation reaches its final point, **When** later control periods occur without an edit, seek, reset, or restart, **Then** the final value remains stable without reevaluating the completed curve each period.
4. **Given** no mirrored channels or automation definitions are active, **When** playback runs, **Then** the empty workload adds only bounded observation overhead and does not acquire a blocking channel-operation path.

---

### User Story 2 - Edit a Running Performance Safely (Priority: P1)

A musician can edit automation, compile live orchestra changes, reset, seek, stop, or restart while Blue Engine is running. The engine adopts valid changes promptly without using stale runtime bindings, blocking the realtime path, crashing, or silently losing the final control value.

**Why this priority**: An optimization that is fast only for static projects but unsafe during live changes is not acceptable for Blue Live or interactive score editing.

**Independent Test**: Run a performance while automation definitions are edited approximately 30 times per second and while channel bindings are removed, restored, recompiled, reset, and restarted; verify correct values, prompt recovery, and the absence of races, invalid lifetime access, or realtime blocking.

**Acceptance Scenarios**:

1. **Given** an automation definition changes during playback, **When** the next safe processing boundary is reached, **Then** the new definition invalidates all affected completed, segment, and quantization state and becomes the source of subsequent values.
2. **Given** an automation's target channel is temporarily unavailable, **When** playback continues, **Then** the engine avoids retrying a blocking lookup every control period and begins applying the automation after a relevant binding change makes the channel available.
3. **Given** a live compile, reset, or restart can replace runtime channel storage, **When** the transition occurs, **Then** no processing cycle reads or writes an invalid binding and the first valid post-transition value is mirrored.
4. **Given** stop is requested during a busy performance, **When** the engine observes the request, **Then** it terminates promptly and reports a coherent final sample position and final mirrored values.

---

### User Story 3 - Trust Performance Claims and Regressions (Priority: P2)

A maintainer can run a reproducible Release benchmark through the actual Blue Engine execution path, compare a candidate with a named baseline, and decide from retained evidence whether each optimization is beneficial, neutral, or regressive.

**Why this priority**: The reviewed issues are plausible hot spots, but optimization decisions must be based on representative measurements rather than Debug timings or isolated microbenchmarks.

**Independent Test**: Run the complete benchmark matrix for a baseline and candidate on the same machine, compiler, architecture, sample rate, and control-period size; verify warmup, trial counts, percentile metrics, spike counts, metadata, and automated pass/fail evaluation.

**Acceptance Scenarios**:

1. **Given** a baseline and candidate Release build, **When** the benchmark suite completes, **Then** it reports automation, shared-channel, and remaining host overhead separately with average, 95th-percentile, maximum, and spike measurements.
2. **Given** five trials for a representative scenario, **When** results are summarized, **Then** the median trial is used for comparison and the raw artifacts remain available for inspection.
3. **Given** a candidate improves its targeted metric but regresses an unaffected workload beyond the allowed limit, **When** the gate is evaluated, **Then** the candidate fails rather than being accepted on its average improvement alone.
4. **Given** an optimization has not demonstrated a representative improvement, **When** the review is completed, **Then** it remains deferred and the evidence records why it was not adopted.

---

### User Story 4 - Keep Control and Offline Work Responsive (Priority: P3)

A musician can leave Blue Engine idle, send control requests, shut it down, or run message-heavy offline work without unnecessary polling cost, missed wakeups, delayed cancellation, unbounded message growth, or loss of important Csound diagnostics.

**Why this priority**: Idle request handling and offline message processing do not run on the realtime audio path, but they affect battery use, command latency, shutdown behavior, and long render reliability.

**Independent Test**: Measure idle CPU use, request latency and throughput, shutdown latency, quiet and message-heavy offline rendering, cancellation, and final diagnostic delivery before and after each candidate change.

**Acceptance Scenarios**:

1. **Given** no request is pending, **When** Blue Engine remains idle, **Then** it avoids unnecessary sustained work while remaining ready to process the next request within the accepted latency.
2. **Given** requests arrive during idle or shutdown transitions, **When** they are submitted, **Then** no request or wakeup is lost and shutdown completes without a hang.
3. **Given** an offline render produces a large message stream, **When** it completes or is cancelled, **Then** memory use remains bounded and errors, terminal status, and required final output remain available.

### Edge Cases

- Zero active channels or automations, one active item, and the upper representative loads of 128 and 256 items.
- Mirrored values that are numerically unusual, including positive zero, negative zero, infinities, and distinct not-a-number representations.
- Every mirrored value changing each control period versus no mirrored value changing for the full run.
- An automation with one point, repeated point times, a zero-duration segment, a zero or unsupported resolution, or values that cross zero during exponential interpolation.
- An automation edited after it completed, while it is between points, or while the playback position moves backward or jumps forward.
- A target channel that is missing at startup, disappears during live compilation, reappears later, or is replaced by new runtime storage with the same name.
- Automation-list changes and runtime-binding changes that occur concurrently with realtime processing, stop, reset, or restart.
- A supported platform on which the required control-value publication is not lock-free.
- A benchmark run with insufficient warmup, an incomplete measurement window, incompatible metadata, or unusually high trial variance.
- An idle request arriving at the same time as a timeout, notification, or shutdown.
- An offline render that emits no messages, emits messages faster than they can be displayed, fails after producing output, or is cancelled while its final messages are in flight.
- An optimization that improves average cost but increases the 95th percentile, maximum, or spike count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST establish a Release-mode performance baseline through the same engine path used by representative realtime and offline workloads before accepting optimization changes.
- **FR-002**: The benchmark matrix MUST cover idle processing; static and continuously changing mirrored-channel sets at 1, 32, 128, and 256 channels; absent, linear, exponential, quantized, high-precision quantized, and completed automations; live automation edits; live orchestra compilation; and missing automation targets.
- **FR-003**: Every benchmark result MUST identify the build type, compiler, architecture, operating system, sample rate, control-period size, workload, baseline identity, and candidate identity.
- **FR-004**: Every measured scenario MUST include a warmup, at least one full 4,096-period measurement window, five comparable trials, and separate average, 95th-percentile, maximum, and spike results for automation, shared-channel, and remaining host work.
- **FR-005**: Candidate results MUST be evaluated using the median of the five trials and MUST retain the individual trial artifacts for review.
- **FR-006**: An optimization MUST demonstrate at least a 10% improvement in its affected host-overhead measure and MUST NOT regress an unaffected 95th-percentile measure by more than 5% before it is accepted.
- **FR-007**: A candidate that improves average cost but increases the median-trial maximum cost or spike count MUST be investigated and the disposition documented before acceptance.
- **FR-008**: The benchmark suite MUST distinguish Debug correctness runs from Release performance evidence and MUST reject comparisons made from incompatible benchmark metadata.
- **FR-009**: Steady-state realtime processing MUST avoid blocking waits and repeated coordination work when automation definitions and runtime channel bindings have not changed.
- **FR-010**: Runtime definition and binding changes MUST become visible at a safe processing boundary without exposing partially published state or state whose lifetime has ended.
- **FR-011**: Concurrent update, reset, restart, compilation, stop, and processing scenarios MUST be covered by stress validation designed to detect invalid lifetime access and data races.
- **FR-012**: Shared control-channel values MUST remain atomically readable and writable without blocking on every supported target; a target that cannot provide this property MUST fail compatibility validation rather than silently entering realtime use.
- **FR-013**: Redundant shared control-channel publication MAY be skipped only when the new value has the same complete binary representation as the previously published value.
- **FR-014**: Shared control-channel behavior MUST preserve positive and negative zero, infinities, and not-a-number payload behavior supported by the existing engine rather than treating all numerically equal values as interchangeable.
- **FR-015**: The final required shared control-channel values MUST be visible before the engine reports that a performance has completed or stopped.
- **FR-016**: Automation processing MUST resolve reusable target bindings outside unchanged per-period work, MUST avoid a blocking lookup retry every period for an unresolved target, and MUST retry after a relevant definition or binding change.
- **FR-017**: Live compilation, reset, and restart MUST either preserve runtime binding validity or coordinate their replacement at a boundary where realtime processing cannot access invalid storage.
- **FR-018**: Any automation preparation state MUST be invalidated when either the automation collection or an individual automation definition changes.
- **FR-019**: A completed automation MAY bypass repeated curve evaluation only until an edit, seek, reset, restart, or other relevant state transition requires evaluation again.
- **FR-020**: Linear, step, exponential, and quantized automation MUST preserve existing boundary, completion, and fallback behavior for every supported curve and resolution.
- **FR-021**: High-precision quantization MUST match the Java Blue line-evaluation behavior for the accepted cross-language fixture set, including negative values, tie boundaries, and fractional resolutions.
- **FR-022**: Stop observation and sample-position reporting MUST remain coherent under concurrency; telemetry may be briefly stale where already permitted, but every reported position MUST be a complete position published by the engine, MUST be nondecreasing within a run except after an explicit seek or restart, and MUST NOT delay lifecycle completion.
- **FR-023**: A candidate Release-build optimization MUST preserve required numerical behavior and portable artifact production across supported platforms; unsafe global numerical shortcuts MUST NOT be introduced solely for benchmark gains.
- **FR-024**: Changes to idle request handling MUST be evaluated for idle CPU use, request latency, sustained throughput, missed wakeups, and shutdown latency before adoption.
- **FR-025**: Changes to offline message handling MUST be evaluated with quiet and message-heavy workloads and MUST preserve error messages, required final output, terminal status, cancellation behavior, and bounded memory use.
- **FR-026**: Control-plane lookup structures, serialization reuse, shutdown policy, and other secondary candidates MUST be changed only when representative profiling identifies them as meaningful contributors and the standard regression gate is met.
- **FR-027**: Multipart event delivery MUST preserve complete event boundaries and MUST NOT discard frames independently in a way that can combine parts from different events.
- **FR-028**: Automated validation MUST include existing automation and fixed-point tests, shared-channel behavior, lifecycle and integration tests, concurrent update stress tests, and the complete Release benchmark matrix.
- **FR-029**: The feature MUST NOT change the engine-client protocol, `.blue` XML, generated CSD semantics, project data models, or renderer-facing control behavior.
- **FR-030**: The final performance report MUST identify which candidates were adopted, rejected, or deferred and link each decision to benchmark or correctness evidence.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Current Blue Engine realtime, automation, shared-channel, lifecycle, request, and offline-render behavior provides the observable baseline. Java Blue's line evaluation is the numerical reference for high-precision automation quantization and interpolation boundary fixtures.
- **Compatibility Requirements**: Existing projects, automation definitions, channel names, control values, stop/restart behavior, engine-client messages, generated CSD, and render diagnostics must remain observably compatible. Positive and negative zero, supported not-a-number representations, completion boundaries, missing-channel recovery, and Java-compatible quantization are part of the required behavioral baseline.
- **Intentional Divergences**: None are user-visible. The engine may perform less redundant host work and may delay retrying an unresolved automation target until relevant state changes, provided recovery and final values remain equivalent.
- **State Ownership**: Csound remains the canonical owner of runtime channel storage and audio execution. The automation store owns transient automation definitions; Blue Engine owns transient prepared automation state, channel-mirror state, lifecycle state, and sample telemetry. Benchmark baselines and results are derived development artifacts. The canonical project document, program settings, and `.blue` XML are unaffected.

### Key Entities

- **Benchmark Scenario**: A reproducible workload definition containing channel count and change pattern, automation shape and state, editing activity, lifecycle activity, audio configuration, and measurement rules.
- **Benchmark Result**: One trial's metadata and separate timing and spike observations for automation, shared-channel, and remaining host work.
- **Performance Baseline**: The named set of comparable Release benchmark results against which a candidate is evaluated.
- **Automation Definition**: The ordered points, interpolation mode, resolution, target channel, and revision of one automation curve.
- **Prepared Automation State**: Transient state derived from an automation definition and playback position that can be reused only while its source definition and binding remain valid.
- **Runtime Channel Binding**: A transient association between a channel name, current Csound-owned channel storage, and the lifecycle in which that storage is valid.
- **Shared Control-Channel Mirror**: The transient, cross-process representation of a runtime control value and the metadata needed to know when the mirror set changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every adopted primary optimization reduces its targeted median host-overhead measure by at least 10% in one or more representative Release scenarios.
- **SC-002**: No adopted optimization regresses an unaffected 95th-percentile host-overhead measure by more than 5%, and any increase in maximum time or spike count is resolved or explicitly rejected before completion.
- **SC-003**: Static-channel, completed-automation, and empty-workload instrumentation records zero blocking channel lookups and zero definition or binding refreshes after the relevant state is established and remains unchanged.
- **SC-004**: All existing automation, fixed-point, shared-channel, lifecycle, integration, and cross-language differential fixtures pass with zero behavioral mismatches after optimization.
- **SC-005**: Bit-sensitive channel fixtures observe 100% matching final representations for positive zero, negative zero, infinities, and supported not-a-number values, including the last value before stop or completion.
- **SC-006**: A 10-minute concurrent stress run with automation edits near 30 updates per second plus binding removal, restoration, live compilation, reset, stop, and restart completes with zero crashes, invalid lifetime accesses, detected data races, missed final values, or unrecovered targets.
- **SC-007**: Every reported performance comparison contains five trials with at least 4,096 measured control periods after warmup and includes all required environment metadata and raw artifacts.
- **SC-008**: The complete Release benchmark and correctness matrix passes on every supported desktop artifact target, and unsupported non-lock-free targets are rejected by compatibility validation.
- **SC-009**: Any adopted idle-loop change produces no missed requests or shutdown hangs across the stress suite, improves its targeted idle CPU or response measure by at least 10%, and does not fail the standard 5% unaffected-regression gate.
- **SC-010**: Any adopted offline-message change completes quiet and at least 100,000-message render scenarios without exceeding a documented fixed backlog capacity, with zero missing errors or terminal messages and no cancellation regression beyond the standard 5% gate.
- **SC-011**: The final report classifies 100% of reviewed candidates as adopted, rejected, or deferred with linked evidence, and confirms zero engine-client protocol, project XML, generated CSD, or project-model changes.

## Assumptions

- Release builds on the supported macOS, Windows, and Linux artifact targets are the authority for performance decisions; Debug and instrumented builds are used for correctness and concurrency validation only.
- Representative scores and fixtures can isolate host-side overhead from the Csound orchestra's own audio-processing cost.
- The existing profiling counters can be extended or reorganized while preserving a machine-readable record of automation, shared-channel, remaining host, and spike measurements.
- A 4,096-period measurement window and five trials provide the minimum comparable evidence; maintainers may run longer experiments when results are noisy.
- Interactive automation editing near 30 updates per second is a representative upper-rate control-plane workload for this feature.
- Briefly stale sample-position telemetry remains acceptable where current consumers already tolerate it; lifecycle completion and final values are not allowed to be stale.
- Platform portability, exact automation behavior, and realtime safety take precedence over a larger benchmark gain from unsafe numerical or ownership shortcuts.
- The consolidated performance review is an investigation plan as well as an optimization plan: candidates without measured benefit may be documented and deferred without making speculative code changes.

## Out of Scope

- Changing Csound's internal audio-processing algorithms, orchestra semantics, or plugin performance.
- Changing the engine-client protocol, renderer behavior, `.blue` XML, generated CSD, or persistent project/application data.
- Replacing current safe ownership with unowned runtime pointers solely to reduce overhead.
- Broad rewrites of automation containers, fixed-point arithmetic, shared-memory lookup structures, or serialization without representative profiling evidence.
- Binary-search seek optimization for typical short automation envelopes unless new evidence identifies seeking as a material cost.
- Event-frame conflation that can corrupt multipart delivery.
- Treating faster shutdown policy as a realtime optimization; shutdown behavior may be evaluated separately under its own correctness and latency evidence.

## Implementation Completion Evidence

- Native Release build and CTest pass on the local macOS arm64 target: 13/13 tests, including shared-channel, integration, lifecycle/rebinding stress, idle wakeup, completed-envelope rebinding, and 100,000-message offline batching coverage. The native Debug unit suite (10/10) and native lint also pass.
- The actual `benchmark_engine` path produced 23 scenarios × 5 trials with 1,024 warmup periods and 4,096 measured periods per trial. The JSON artifact retains trial data and environment metadata; the self-comparison regression gate correctly rejects a baseline with no measured improvement.
- AddressSanitizer/UBSan and ThreadSanitizer stress targets are configured, rebuilt after the final lifecycle fixes, and each completed a bounded one-second local smoke run without sanitizer reports. The documented 600-second sanitizer soak and cross-platform Release matrix remain maintainer-run evidence rather than claims made by this local validation.
- Repository-level `pnpm test` and `pnpm lint` both pass across the workspace packages. The unprivileged package integration command skips only shared-memory-dependent tests in the sandbox; the elevated native Release CTest run executes those tests successfully.
- Final classification: generation-safe snapshots, relaxed/bitwise-deduplicated shared-memory mirroring, cached automation math and quantization, completed envelopes, event-driven idle wakeup, and bounded offline message batching adopted; multipart PUB conflation rejected; broader map/seek rewrites deferred.
