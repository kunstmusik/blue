# Research: Java BigDecimal Automation Parity

## 1. Authoritative Java behavior

**Decision**: Generate expectations by executing the actual pinned Java Blue classes and methods:

- realtime: `blue.components.lines.Line.getValue(double)`
- XML: `blue.automation.Parameter.loadFromXML()` / `saveAsXML()` and `Line.loadFromXML()` / `saveAsXML()`
- committed-value snapping: the Java line-resolution utility used by the editor
- offline: `blue.ui.core.render.CSDRender.appendParameterScore(...)`, invoked by reflection, plus its real initialization path and `NumberUtilities.formatDouble()`

**Rationale**: The Java behavior contains non-obvious branches that a rewritten oracle could accidentally simplify: time zero, single points, exact duplicate-time hits, after-last returns, before-first extrapolation, quantization bypasses, descending bias, and a distinct offline stepping/formatting algorithm. Calling the actual classes makes Java Blue—not a copied formula—the authority.

**Alternatives considered**:

- Copy the Java arithmetic into a small standalone generator: rejected because the copied oracle could share the same mistake as the TypeScript or C++ implementation.
- Launch Java during every test: rejected because normal tests must remain fast, offline, and independent of a Java checkout.
- Use hand-authored tolerances: rejected because one binary64 bit can change a quantization boundary and the goal is exact parity.

## 2. Exact decimal representation in `@blue/data`

**Decision**: Add a portable immutable `JavaDecimal` value type whose authoritative state is a signed decimal coefficient string and signed 32-bit scale. It validates Java `BigDecimal(String)` syntax, derives Java-canonical `toString()` text and `doubleValue()`, and uses `BigInt` internally for exact operations. Snapshots, patches, XML, and engine transport carry canonical text; a derived `number` is display/offline-stepping data only.

**Rationale**: A coefficient and scale preserve both numerical value and scale (`0.1` differs from `0.10`) and survive JSON/structured-clone boundaries without serializing JavaScript `bigint`. Canonical text is one-to-one with Java's coefficient/scale pair and is already the project and wire representation users can inspect.

**Alternatives considered**:

- `number + scale`: rejected because the coefficient is already irrecoverably rounded.
- Preserve only the input string: rejected because validation, equality, scale, canonicalization, and conversion would become scattered responsibilities.
- Add `decimal.js`: rejected because its number-construction semantics do not directly implement Java's exact `new BigDecimal(double)`, and a configured precision would introduce an artificial bound.
- Convert all parameter values and points to decimal: rejected because Java Blue stores those as doubles and doing so would reduce, not improve, parity.

## 3. Java-compatible decimal operations

**Decision**: Implement the observable Java sequence explicitly in both portable TypeScript and native C++:

1. Convert the interpolated binary64 value exactly as `new BigDecimal(double)` by decoding sign, significand, and power-of-two exponent.
2. Apply `setScale(resolution.scale(), FLOOR)` with sign-correct arbitrary-integer division.
3. Apply Java signed `remainder(resolution)` and subtract it.
4. Convert the exact decimal rational back to binary64 using round-to-nearest, ties-to-even.

Legacy `resolution` loading separately implements `new BigDecimal(double).setScale(5, HALF_UP).stripTrailingZeros()`. Committed-value editor snapping uses the Java rounding operation identified by its fixture oracle. Resolution activation and descending bias use the exact decimal's Java-compatible `doubleValue()`.

**Rationale**: This mirrors the Java source at each diagnosable boundary and supports negative scale, scale beyond 18, trailing zeros, subnormals, and arbitrary coefficient precision. It avoids libc parsing, `long double`, and platform-specific decimal behavior.

**Alternatives considered**:

- Directly compute `floor(y * 10^scale)`: mathematically related, but rejected as the primary implementation because the explicit Java stages are easier to prove and diagnose against fixtures.
- Continue the current `int64_t` fixed-point helper: rejected because it is limited to scale 0–18 and signed 64-bit intermediates.
- Use decimal floating point or `strtod`: rejected because neither guarantees Java `BigDecimal(double)` and `BigDecimal.doubleValue()` behavior across supported toolchains.

## 4. Native arbitrary integers and realtime safety

**Decision**: Use the header-only [Boost.Multiprecision `cpp_int`](https://www.boost.org/doc/libs/latest/libs/multiprecision/doc/html/boost_multiprecision/ref/cpp_int_ref.html) behind private `JavaBigDecimal` and `ExactDecimalQuantizer` modules. Configure a dynamic `cpp_int_backend` with expression templates disabled and a feature-owned fixed bump-arena allocator. On create/update, the control thread parses the resolution, prepares immutable segment data, performs a counting/worst-size pass, allocates the arena, and publishes a fully prepared definition. The perform thread resets an arena cursor and must never reach an upstream allocator.

Retired prepared definitions remain owned by a control-thread reclamation list until the performance thread no longer references their snapshot. This prevents arena and big-integer destruction from becoming audio-thread deallocation work. Preparation failure leaves the prior definition unchanged and returns a recoverable diagnostic.

**Rationale**: Boost supplies audited arbitrary-precision integer and conversion building blocks without a runtime library. Its documented allocator customization enables preallocated workspaces while preserving scale/precision support proportional to actual input rather than a fixed feature cap.

**Alternatives considered**:

- GMP: rejected because static distribution and LGPL/GPL obligations complicate the MIT sidecar.
- LibTomMath: rejected because keeping all general-division temporaries off its normal allocator would require more invasive allocator work.
- Write a complete arbitrary-integer library: rejected as unnecessary cryptographic/numeric infrastructure and a larger parity risk.
- Allocate ordinary `cpp_int` temporaries on each k-cycle: rejected as non-realtime-safe.
- Fixed maximum precision/scale: rejected because Java Blue and the feature contract do not impose the old scale-18/int64 bound.

**Implementation risk**: Allocator propagation and hidden temporaries must pass an early cross-toolchain spike with the upstream path instrumented as a hard failure. This is an implementation gate, not an unresolved product decision; if the chosen Boost backend cannot meet it, implementation must stop and revise the native arithmetic design rather than weaken parity or realtime safety.

## 5. Point selection and floating-point operation order

**Decision**: Use one Java-linear evaluator in production and fixture tests. It reproduces Java's early returns and duplicate-time selection before quantization. Interpolated linear values use these explicit double operations:

```text
slope = (b.value - a.value) / (b.time - a.time)
x = time - a.time
y = (slope * x) + a.value
```

The native parity translation unit disables floating-point contraction/reassociation (`-ffp-contract=off` on Clang/GCC and corresponding precise/strict MSVC controls). Prepared segments cache the already-rounded Java-order slope, not inverse duration. Step and exponential calculations retain their existing formulas and send only their computed double through the exact quantizer.

**Rationale**: The current algebraically equivalent `p0 + ((time-p0.time) * invDuration) * delta` can differ in the last bits. Exact point returns and duplicate-time runs also bypass quantization in Java and cannot be modeled as a clamped interpolation alone.

**Alternatives considered**:

- Keep inverse-duration caching and compare within tolerance: rejected because it violates exact Java bits.
- Compile the whole engine in globally strict floating-point mode: rejected because only the parity translation unit needs this restriction and global changes could regress unrelated DSP/host code.

## 6. App/engine protocol

**Decision**: Change the Blue app, `@blue/engine-client`, and bundled engine atomically to protocol version 2. Keep automation command codes `0x20` and `0x21`, replace their payload rather than maintaining a second command family, add capability `automation-decimal-v1`, and remove `resolution:f64`, `resolutionScale:i32`, and `highPrecision:u8`:

```text
channelName:NUL-terminated UTF-8
curve:u8
enabled:u8
resolutionLength:u32-le
resolution:canonical BigDecimal ASCII
pointCount:u32-le
points[pointCount]:time:f64-le,value:f64-le
```

The parser validates command length, NUL/name rules, curve, Boolean encoding, decimal grammar, scale overflow, point count, finite supported inputs, and trailing bytes before mutating the store. App/client/engine packages and artifact metadata are released together, so no protocol-v1 parser, reserved legacy byte, or lossy fallback is retained. The version marker exists to diagnose an accidentally mixed binary.

**Rationale**: A canonical decimal string preserves coefficient and scale, remains language-neutral, and avoids a duplicated decimal wire codec. An atomic payload replacement is the smallest design now that the user confirmed there are no independently released legacy consumers.

**Alternatives considered**:

- Keep version 1 and append text after the old points: rejected because it retains duplicate lossy fields and an obsolete behavioral byte.
- Add new decimal command codes while retaining old ones: rejected because there is no compatibility requirement and two parsers create unnecessary state space.
- Send coefficient bytes plus scale: rejected because it adds signed-big-integer encoding complexity with no benefit over validated canonical ASCII at control-plane frequency.

## 7. Project, BSB, snapshot, and editor propagation

**Decision**: Make exact resolution ownership end-to-end. `Parameter` and the BSB horizontal/vertical sliders and banks store `JavaDecimal`; parameter/widget synchronization passes that object or canonical text. Project snapshots expose authoritative `resolutionDecimal:string` and optional derived `resolution:number` for rendering. Patch APIs commit only the string. Resolution inputs use a decimal-specific validator and do not round-trip through `parseFloat`. Committed point/value snapping uses the exact Java helper; curve previews may use the derived number.

On load, parameter-level `bdresolution` overrides legacy `resolution`, which follows Java's five-place normalization. After nested line loading, the parameter-level exact resolution is synchronized to the line, matching Java ownership. Compatibility-only `resolutionScale` and `highPrecision` elements may be read and ignored, but are not model state and do not select behavior. Save writes the same Java-canonical text to parameter and line `bdresolution`.

**Rationale**: BSB widgets are a common source of parameter definitions. Fixing only `Parameter` would still lose `0.10`, exponent forms, or large scales when widgets rebuild parameters or renderer patches reconstruct snapshots.

**Alternatives considered**:

- Preserve exact text only in `Parameter`: rejected because BSB synchronization and renderer edits would overwrite it with a number.
- Make renderer preview exact arbitrary precision: deferred because it is non-audio display work and the spec explicitly permits an approximate preview; committed data still remains exact.

## 8. Offline render/freeze behavior

**Decision**: Isolate parameter automation CSD generation in a pure `@blue/data` helper and match Java `CSDRender` independently from realtime evaluation. Initialization calls the exact Java-compatible line evaluator and formats through the Java `NumberUtilities.formatDouble` equivalent. Positive-resolution score stepping uses the resolution's Java `doubleValue()`, Java's `Math.round`, step/accumulation order, range clipping, duplicate/final-point rules, and 10-fraction-digit formatter; it does not quantize every note through the realtime BigDecimal evaluator.

**Rationale**: Java's offline path is observably different from `Line.getValue()`. Current code also uses `formatJavaDouble` in score events where Java uses the formatter represented by `formatBlueNumber`. Exact offline fixtures must compare emitted text byte-for-byte.

**Alternatives considered**:

- Reuse the realtime evaluator for all offline score values: rejected because that would be cleaner but not Java-compatible.
- Parse generated notes numerically and compare with tolerances: rejected because formatting and event sequence are part of CSD parity.

## 9. Canonical Java fixture corpus

**Decision**: Store one schema-versioned corpus at `fixtures/java-blue-automation-parity/v1/`:

- `manifest.json`: oracle revision, source-file SHA-256 values, methods, generator/schema versions, Java release, SplitMix64 seed, command, and exact category counts
- `realtime.tsv`: raw input/output binary64 bits, canonical resolution, origin/category, and expected result or diagnostic
- `resolution.tsv`: parse/save, legacy normalization, parameter/line ownership, coefficient, scale, canonical string, `doubleValue` bits, and diagnostic cases
- `offline.tsv`: raw input bits and base64-encoded exact initialization/score fragments
- `SCHEMA.md`: grammar, escaping, invariants, and consumer requirements

All doubles use 16 lowercase hexadecimal raw bits. The corpus contains exactly 2,048 deterministic seeded finite realtime cases from a generator-owned documented SplitMix64 algorithm plus curated boundary and diagnostic cases. Vitest reads the same TSV files in test-only Node code. CMake copies those canonical files for CTest; no hand-maintained C++ expectation duplicate is permitted.

**Rationale**: TSV is deterministic and fast to parse in TypeScript and C++17 without adding a native JSON dependency. A manifest plus section files remains one logical corpus and supports byte-identical regeneration.

**Alternatives considered**:

- One JSON file: workable in TypeScript but rejected because it adds or requires a native JSON parser and makes exact binary fields no clearer.
- Generate a checked-in C++ header: rejected as a second expected-result representation that could drift.
- Separate TypeScript and native corpora: rejected by the single-authority requirement.

## 10. Fixture generator location and reproducibility

**Decision**: Own the generator in `tools/java-blue-automation-fixtures/` and invoke it with `scripts/generate-java-blue-automation-fixtures.mjs`. The wrapper accepts `--java-blue-root`, verifies the pinned 40-character commit and source hashes, builds/installs the required Java Blue Maven reactor artifacts, then runs against the actual `blue-core` and `blue-ui-core` JARs. A check command regenerates into a temporary directory and byte-compares it. Output contains no timestamp, absolute path, JVM vendor string, or other machine-local data.

**Rationale**: The schema, generator, and all consumers remain reviewable in this repository, while the executable oracle remains an independently pinned Java Blue checkout. Normal builds never need Maven, JDK, network, or that checkout.

**Alternatives considered**:

- Put the only generator in Java Blue: rejected because it would require a coordinated two-repository change to maintain this feature.
- Vendor Java Blue sources or binaries into the app: rejected because the reference is needed only for deliberate fixture regeneration.

## 11. Diagnostics and failure behavior

**Decision**: Reject malformed text, scale overflow, invalid payloads, non-finite protocol inputs, and workspace-preparation/resource failures on the control thread without replacing the last valid definition. Audio-time non-finite derived values keep the last channel value, increment a preallocated diagnostic counter, and perform no formatting or logging. Tests map Java exceptions to stable product diagnostic codes rather than copying unchecked exception text.

**Rationale**: This is deterministic, recoverable, realtime-safe, and consistent with the specification's intentional divergence for invalid inputs.

**Alternatives considered**:

- Clamp or approximate invalid/unpreparable values: rejected because it silently breaks parity.
- Throw or log from the perform loop: rejected because it can allocate or block and destabilize audio.

## 12. Verification and performance gates

**Decision**: Drive arithmetic helpers and production boundaries from the committed corpus; replace the old tolerance-based `quantization-fixtures.json` and hard-coded fixed-point cases. Add an allocation test with at least 10,000 prepared evaluations and a hard-fail upstream allocator. Preserve the Spec 072 `linear_32` benchmark and replace fast/high-precision positive scenarios with separately reported ordinary-scale and large-scale exact scenarios. Run focused Vitest/CTest, integration, ASan/UBSan, TSan, five-trial Release comparisons, and the 10-minute Csound stress case.

**Rationale**: Helper-only correctness does not prove XML, editor, transport, lifecycle, or offline behavior. Separate common-path and exact-path measurements protect ordinary projects without weakening the legacy parity path.

**Alternatives considered**:

- Measure only average exact-decimal throughput: rejected because deadline spikes, update-cycle allocation, and common-path regression are the meaningful audio risks.
- Retain the old fast positive mode for benchmark wins: rejected by the user's decision to start from one exact baseline.
