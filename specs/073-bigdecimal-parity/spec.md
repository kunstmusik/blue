# Feature Specification: Java BigDecimal Automation Parity

**Feature Branch**: `073-bigdecimal-parity`

**Created**: 2026-08-14

**Status**: Implementation staged; remaining validation explicitly deferred for this handoff

**Input**: User description: "Create a new branch and spec using Spec-kit for BigDecimal parity with the information from above. Be sure to have tests that compare against Java results (fixtures can be generated from Java so that unit tests can be fast)."

## Clarifications

### Session 2026-08-14

- Q: Should the `highPrecision` behavioral choice remain available alongside exact Java-compatible quantization? → A: No. Remove the choice so every positive resolution starts from an exact Java-parity baseline; faster positive-resolution processing may be reconsidered in a future feature.

For this specification, **positive resolution** means that Java's `resolution.doubleValue() > 0.0` activation check succeeds; exact decimal values that convert to zero follow Java's unquantized behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear the Same Legacy Automation as Java Blue (Priority: P1)

As a musician opening a legacy Blue project with positive-resolution automation, I need each automated value to match Java Blue exactly so that the project sounds and behaves the same during playback.

**Why this priority**: Exact playback compatibility is the purpose of the feature. A numerically close value can still cross a quantization boundary and change the value sent to Csound.

**Independent Test**: Compare realtime evaluation against Java Blue `Line.getValue()` fixtures and compare offline render/freeze automation initialization and score output against Java Blue `CSDRender` fixtures. These are distinct Java reference paths and both must pass.

**Acceptance Scenarios**:

1. **Given** a linear automation with a positive decimal resolution, **When** its value is evaluated between points, **Then** the result has the same binary64 representation as Java Blue's line evaluation.
2. **Given** a descending linear segment with a positive resolution, **When** the value lies on or near a quantization boundary, **Then** the descending bias, decimal floor, remainder, and final value match Java Blue exactly.
3. **Given** an exact point time, a single-point line, repeated point times, or a time outside the line, **When** the line is evaluated, **Then** Java Blue's endpoint and discontinuity behavior is preserved, including whether quantization is bypassed.
4. **Given** the resolution is zero or negative, **When** the line is evaluated, **Then** decimal quantization is not performed and the result matches Java Blue's unquantized double calculation.
5. **Given** an offline render or freeze range containing parameter automation, **When** automation initialization and score events are generated, **Then** their values, times, boundary handling, and emitted sequence match Java Blue `CSDRender` for the same project data and render range.

---

### User Story 2 - Preserve Exact Decimal Resolution (Priority: P1)

As a user loading and saving a Java Blue project, I need the automation resolution's exact decimal value and scale preserved from project data through runtime evaluation so that values such as `0.1`, `0.10`, small exponents, and scales beyond the existing bounded fixed-point range retain Java behavior.

**Why this priority**: Java stores parameter and point values as doubles, but stores the resolution as `BigDecimal`. Converting that resolution to a double before evaluation loses information required for exact parity.

**Independent Test**: Round-trip representative Java Blue project fragments and verify that each resolution retains the same decimal value and scale, then confirm the runtime receives and evaluates that same resolution.

**Acceptance Scenarios**:

1. **Given** a project containing a valid `bdresolution`, **When** it is loaded, copied, saved, reloaded, and sent to the engine, **Then** its Java-compatible decimal value and scale remain unchanged.
2. **Given** positive resolutions that differ only in scale, such as `0.1` and `0.10`, **When** they are evaluated, **Then** each follows the result produced by Java Blue for its own scale.
3. **Given** a legacy project containing the older double-valued `resolution` form, **When** it is loaded, **Then** it is converted using Java Blue's legacy normalization behavior before subsequent save or evaluation.
4. **Given** parameter minimum, maximum, fixed value, and line-point coordinates and values, **When** exact resolution support is used, **Then** those values remain binary64 doubles and are not silently converted into decimal-stored values.
5. **Given** a user enters or edits a decimal resolution such as `0.10` or `1e-7`, **When** the edit is accepted and propagated, **Then** its Java-compatible decimal value and scale reach project persistence and runtime publication without a double-only conversion becoming the source of truth.

---

### User Story 3 - Detect Parity Regressions Quickly (Priority: P2)

As a maintainer, I need fast deterministic unit tests backed by Java Blue results so that BigDecimal parity regressions are caught without launching a JVM or requiring a Java Blue checkout during the normal test run.

**Why this priority**: Exact decimal behavior is difficult to validate from hand-calculated expectations, and a live cross-runtime test would make routine native tests slow and fragile.

**Independent Test**: Run the committed parity fixture suite in an environment with no Java runtime and verify that it compares exact result bits, covers the required boundary categories, and completes within the unit-test time budget.

**Acceptance Scenarios**:

1. **Given** a committed fixture corpus generated by the Java Blue reference implementation, **When** normal unit tests run, **Then** all positive-resolution results are compared bit-for-bit without invoking Java.
2. **Given** access to the documented Java Blue reference revision, **When** the fixture generator is run, **Then** it reproducibly emits the same schema, inputs, exact expected result bits, and provenance metadata.
3. **Given** a deliberate one-bit change to an expected result or evaluated output, **When** the unit suite runs, **Then** it fails and identifies the fixture case and relevant inputs.
4. **Given** a change to project parsing or runtime transport, **When** the parity suite runs, **Then** it verifies the exact decimal resolution at the data, transport, and evaluation boundaries rather than testing the arithmetic helper alone.
5. **Given** the Java fixture generator, **When** the authoritative corpus is regenerated, **Then** it includes realtime line results, offline automation initialization and score output, canonical `bdresolution` save forms, and legacy-resolution normalization results.

---

### User Story 4 - Retain the Unquantized Common Path (Priority: P2)

As a user of typical projects with no positive resolution, I need the existing optimized behavior to remain unchanged so that legacy parity support does not impose decimal-arithmetic cost on the common audio path.

**Why this priority**: Positive-resolution decimal automation is a compatibility path. The performance improvements delivered for ordinary unquantized automation must remain intact.

**Independent Test**: Compare existing correctness tests and representative common-path benchmarks before and after the feature while separately reporting the cost of positive-resolution decimal evaluation.

**Acceptance Scenarios**:

1. **Given** an automation whose resolution is zero or negative, **When** it is processed, **Then** its output and common-path performance remain within the established regression limits.
2. **Given** an automation whose resolution is positive, **When** it is processed, **Then** exact Java-compatible decimal quantization is used without a selectable approximate alternative.
3. **Given** positive-resolution automation, **When** its performance is measured, **Then** its overhead is reported separately and correctness is not weakened to meet the unquantized-path target.
4. **Given** the Blue app and bundled engine are built for this feature, **When** they create or update automation, **Then** they use the same exact-decimal payload and contain no selectable or compatibility-only `highPrecision` behavior.

### Edge Cases

- Positive resolutions with scale zero, negative scale, trailing zeros, exponent notation, scale greater than 18, and magnitudes near double underflow or overflow.
- Resolutions whose exact decimal value is not recoverable from their nearest binary64 approximation.
- Positive, negative, `+0.0`, and `-0.0` interpolated values; exact grid values; and the adjacent binary64 values immediately above and below a grid boundary.
- Ascending, descending, flat, and zero-crossing segments.
- Single-point lines, empty lines, repeated point times, exact point hits, evaluation before the first point, and evaluation after the last point.
- Non-finite point values, times, or derived values that Java cannot convert to `BigDecimal`.
- Malformed decimal resolution text and conflicting parameter-level and nested-line resolutions.
- Accidentally mixed app/engine builds whose declared protocol metadata does not match the payload schema shipped by the other component.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: During realtime playback, when Java Blue would apply a positive resolution, linear automation evaluation MUST return the exact same binary64 result as Java Blue's `Line.getValue()` for all supported finite inputs.
- **FR-002**: Parity evaluation MUST reproduce Java Blue's observable operation sequence: double interpolation; descending-segment bias using the resolution's double value; exact decimal construction from the computed double; floor to the resolution scale; decimal remainder subtraction; and conversion of the result back to double.
- **FR-003**: Parity evaluation MUST preserve Java Blue's early-return and point-selection behavior, including empty and single-point lines, time zero, exact point hits, repeated times, and times outside the defined range.
- **FR-004**: Parameter minimum, maximum, fixed value, automation point time, and automation point value MUST remain binary64 values, consistent with Java Blue storage and serialization.
- **FR-005**: The exact decimal value and scale of `bdresolution` MUST be preserved without using a double conversion as the source of truth for positive-resolution evaluation.
- **FR-006**: Saving a loaded `bdresolution` MUST produce a Java-compatible decimal representation that preserves its numerical value and scale, including meaningful trailing zeros.
- **FR-007**: Parameter-level and nested-line resolution state MUST remain synchronized through load, edit, copy, snapshot, save, and runtime publication. Resolution edits MUST preserve the accepted decimal value and scale rather than replacing them with a double-derived approximation.
- **FR-008**: The legacy `resolution` form MUST be normalized using the same double conversion, five-place half-up rounding, and trailing-zero removal behavior used by Java Blue before it is treated as an exact decimal resolution.
- **FR-009**: The runtime automation boundary MUST carry enough information to reproduce the exact decimal resolution value and scale; it MUST NOT silently substitute the nearest double value for positive-resolution evaluation.
- **FR-010**: Positive-resolution evaluation MUST support every Java decimal resolution present in a project accepted by the existing XML input boundary and MUST NOT add a scale, precision, or magnitude restriction that Java Blue does not impose, including the current scale-0-through-18 and signed-64-bit restrictions.
- **FR-011**: When the resolution's double value is zero or negative, the system MUST skip decimal quantization exactly as Java Blue does.
- **FR-012**: The `highPrecision` behavioral option MUST be removed from the project model and runtime-facing API. Positive resolution MUST always mean exact Java-compatible decimal quantization, with no selectable fast approximation. Any legacy serialized occurrence MAY be retained only as ignored compatibility data and MUST NOT select behavior.
- **FR-013**: For step and exponential curves that do not have a complete Java `Line` equivalent, the curve calculation MUST remain unchanged, while any positive-resolution quantization applied to its computed double MUST match the Java decimal quantization operation for that input.
- **FR-014**: Malformed resolutions and non-finite inputs that cannot participate in Java decimal evaluation MUST produce a deterministic, recoverable diagnostic and MUST NOT crash the engine or silently emit an unrelated value.
- **FR-015**: The Blue app, engine client, and bundled engine MUST change atomically to an automation create/update payload that carries the canonical exact resolution and omits the former `highPrecision` field. Backward compatibility with separately released older clients or engines is not required. Protocol/capability metadata MUST still identify the incompatible schema so an accidentally mixed build fails explicitly rather than silently interpreting lossy data as exact.
- **FR-016**: A deterministic fixture corpus generated by the Java Blue reference implementation MUST be committed with the feature and used as the authoritative expected-output source for realtime evaluation, offline automation generation, and resolution serialization behavior.
- **FR-017**: Expected numeric results in the parity corpus MUST be recorded by exact binary64 bits, not only by decimal text or tolerance-based expectations.
- **FR-018**: The fixture corpus MUST include curated cases for all listed edge categories and at least 2,000 deterministic seeded cases spanning interpolation inputs, descending state, decimal resolutions, and scales.
- **FR-019**: Fixture provenance MUST identify the Java Blue source revision, reference class/method, generator version, fixture schema version, seed, and generation command.
- **FR-020**: The standard parity unit suite MUST consume committed fixtures without requiring a JVM, Java Blue source tree, network access, or fixture regeneration.
- **FR-021**: Automated coverage MUST verify project XML preservation, exact-decimal editing, model copying, runtime encoding/decoding, quantization, realtime evaluation, and offline render/freeze automation generation against the same exact-resolution contract.
- **FR-022**: Existing tests for unquantized automation MUST remain passing, tests that previously selected fast positive-resolution quantization MUST be replaced with exact Java-result expectations, and representative unquantized-path performance MUST be compared with the completed performance-work baseline.
- **FR-023**: Positive-resolution decimal overhead MUST be measured and documented separately; slower execution is acceptable, but no bounded approximation may be presented as exact Java parity.
- **FR-024**: Automation documentation MUST explain that Java Blue stores values and points as doubles, stores only resolution as `BigDecimal`, applies exact decimal quantization automatically for positive resolution, and uses unquantized double evaluation for zero or negative resolution.
- **FR-025**: The final feature evidence MUST distinguish exact Java-backed linear evaluation, exact decimal quantization of extension curves, and unquantized behavior so that no broader parity claim is implied.
- **FR-026**: Positive-resolution decimal evaluation MUST preserve realtime safety: it MUST NOT introduce per-cycle heap allocation or blocking synchronization into the audio perform loop. Resolution parsing, workspace sizing, and reusable working-state preparation needed to establish a finite evaluation bound MUST occur when automation definitions are created or changed.
- **FR-027**: Offline render/freeze automation initialization and score generation MUST match Java Blue `CSDRender` independently of the realtime `Line.getValue()` contract; passing the realtime arithmetic fixtures alone MUST NOT be accepted as offline parity evidence.
- **FR-028**: Renderer curve drawing is not required to perform bit-exact decimal evaluation, but renderer edit and snapshot paths MUST preserve the canonical exact resolution and MUST NOT alter audio-producing results.
- **FR-029**: Java-generated fixture expectations MUST include exact realtime result bits, offline automation initialization and score output, Java-compatible `bdresolution` save strings, and legacy `resolution` normalization results.
- **FR-030**: All test consumers MUST derive from one canonical logical fixture corpus and schema. Consumer-specific representations MAY be generated during planning or build setup, but they MUST be reproducible and verified against the canonical corpus rather than maintained as independent expected-result copies.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue `blue.automation.Parameter`, `blue.components.lines.LinePoint`, and `blue.components.lines.Line`, especially `Line.getValue()`, `Parameter.loadFromXML()`, and their XML save methods, plus `blue.ui.core.render.CSDRender` for offline automation initialization and score generation. Java stores parameter values and line points as doubles, preserves resolution as `BigDecimal`, and constructs a temporary `BigDecimal` from an interpolated double only for positive-resolution quantization.
- **Compatibility Requirements**: Existing `.blue` projects must retain Java-compatible resolution value and scale across edits and round trips. Positive-resolution realtime linear evaluation must match Java output bits automatically. Offline render/freeze automation output must separately match Java `CSDRender`. The ordinary zero-or-negative-resolution path must retain its established performance characteristics while matching Java's unquantized result contract.
- **Intentional Divergences**: Step and exponential curves are extensions without full Java `Line` equivalents, so only their decimal quantization stage claims Java parity. Renderer preview drawing may remain an approximation because it is not an audio-producing path. Invalid decimal input may be rejected with a recoverable diagnostic rather than reproducing an unchecked Java exception. Older app/engine protocol pairings are not supported because the two components are released together; no second, lossy runtime path is retained.
- **State Ownership**: The Electron main process remains the canonical owner of active project data and `.blue` XML remains canonical persistence. The project model owns the exact resolution value and scale. The engine owns only a transient runtime copy received through the engine-client boundary. Generated Java fixtures and their provenance are versioned development artifacts, not project or user state.

### Key Entities *(include if feature involves data)*

- **Parameter Numeric State**: The double-valued minimum, maximum, fixed value, and ordered line-point times and values that retain existing Java-compatible binary64 semantics.
- **Exact Decimal Resolution**: A Java-compatible decimal value together with its scale and canonical serialization form; its Java double conversion determines whether exact decimal quantization occurs.
- **Runtime Automation Definition**: A transient automation description containing points, curve behavior, and losslessly transferred resolution semantics; Java's resolution activation predicate determines whether exact decimal quantization applies.
- **Java Parity Fixture Case**: One deterministic input definition paired with Java Blue's exact realtime output bits, offline automation output, resolution serialization result, legacy normalization result, or expected diagnostic.
- **Fixture Corpus Provenance**: The reference revision, generator/schema versions, seed, command, and coverage categories needed to reproduce and audit the committed results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of curated and seeded positive-resolution realtime fixture cases match Java Blue `Line.getValue()` binary64 results exactly, and 100% of offline render/freeze fixture cases match Java Blue `CSDRender` automation initialization and score output.
- **SC-002**: 100% of the resolution round-trip corpus preserves Java-compatible decimal value and scale through load, copy, save, reload, and runtime publication.
- **SC-003**: The committed parity suite contains at least 2,000 seeded Java-generated cases plus all required boundary categories and completes in under 10 seconds after test binaries are built, without Java installed.
- **SC-004**: Regenerating fixtures from the recorded Java Blue revision and seed produces identical realtime result bits, offline automation outputs, resolution save strings, legacy normalization results, schema, and provenance metadata.
- **SC-005**: All existing unquantized correctness tests continue to pass, former fast-positive-resolution cases match their Java fixtures, and the representative zero-or-negative-resolution benchmark shows no greater than a 5% median regression across five trials relative to the completed performance-work baseline.
- **SC-006**: Java-valid fixture resolutions with negative scale, scale greater than 18, trailing zeros, and exponent notation complete without bounded-fixed-point fallback or silent approximation.
- **SC-007**: Every unsupported or malformed parity input in the negative fixture corpus produces its specified recoverable diagnostic with zero engine crashes.
- **SC-008**: Final documentation and completion evidence make no claim that parameter values or line points are stored as `BigDecimal`, and state that positive resolution always uses exact Java-compatible quantization while zero or negative resolution remains unquantized.
- **SC-009**: A 10-minute representative positive-resolution stress run completes with zero audio deadline misses or engine stalls attributable to decimal evaluation, while realtime-safety validation confirms the audio loop remains allocation-free and nonblocking.

## Assumptions

- Correctness has priority over speed in the positive-resolution compatibility path; the user accepts that it will be slower because it is primarily needed by legacy projects.
- Most projects use a zero or negative resolution, so arbitrary-precision work must remain outside that common evaluation path.
- Exact parity is defined for finite binary64 times and values and valid Java decimal resolutions within normal accepted project-size limits.
- Java Blue source is available when maintainers intentionally regenerate fixtures, but it is not a runtime or normal-test dependency.
- The completed Spec 072 automation caching and common-path optimizations are the performance and behavior baseline for this feature.
- General Java `Double.toString()` parity for every project numeric field is outside this feature; only resolution preservation and automation evaluation are in scope.
- The existing fast positive-resolution quantization mode is removed from product behavior rather than retained as an alternative to Java parity.
- The Blue app, engine client, and engine are built and released together, so this feature may replace the current automation wire payload without supporting independently versioned legacy consumers.
- Renderer curve previews may use approximate arithmetic for display, but all editor and snapshot paths must preserve the exact resolution used by audio-producing paths.
- The fixture generator's repository location and any consumer-specific fixture adapters are planning decisions; the specification requires one reproducible canonical logical corpus regardless of physical layout.
