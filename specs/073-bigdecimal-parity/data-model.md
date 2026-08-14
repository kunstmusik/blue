# Data Model: Java BigDecimal Automation Parity

## Ownership overview

```text
.blue XML bdresolution
        │ load/save
        ▼
Electron-main BlueData / Parameter / BSB widget (canonical JavaDecimal)
        ├── renderer snapshot: canonical text + derived display number
        ├── offline CSD generation: JavaDecimal + binary64 points
        └── engine publication: canonical text over protocol v2
                                      │
                                      ▼
                          native prepared automation definition
                                      │
                                      ▼
                          performance-thread runtime state
```

`.blue` XML is the durable authority. Electron main owns the active project object. Renderer state and Blue Engine state are transient projections and must never become competing sources of resolution truth.

## Entity: `JavaDecimal`

Portable immutable value type in `@blue/data` representing Java `BigDecimal` identity relevant to this feature.

| Field | Type | Authority | Rules |
|---|---|---|---|
| `coefficient` | signed decimal digit string | canonical | No leading `+`; no redundant leading zeros except zero; zero has no negative sign; trailing zeros are retained because they contribute to scale identity. |
| `scale` | signed 32-bit integer | canonical | Matches Java `BigDecimal.scale()` after parsing/normalization. Exponent application must fail if the resulting scale is outside Java `int` range. |
| `canonicalText` | string | derived, cached | Exact Java `BigDecimal.toString()` equivalent. This is the XML, snapshot, patch, and wire representation. |
| `doubleValue` | binary64 number | derived, cached | Exact Java `BigDecimal.doubleValue()` behavior, including subnormal rounding, signed finite overflow to infinity, and positive values that underflow to `+0.0`. |

### Invariants

- `(coefficient, scale)` uniquely determines `canonicalText`; parsing `canonicalText` reconstructs the same pair.
- `0.1` is `(1, 1)` and `0.10` is `(10, 2)`; equality for persistence/parity compares both value and scale.
- Input spellings such as lowercase exponent or redundant leading zeros are accepted only if Java `BigDecimal(String)` accepts them, then normalized to Java canonical text.
- The type never derives its authoritative coefficient from `number` except in the explicitly named legacy-normalization and exact-binary64-construction operations.
- Instances are immutable and safe to share/copy. Serialization crosses process/UI boundaries as `canonicalText`, not a class instance or JavaScript `bigint`.

### Operations

- `parse(text)` → exact Java-compatible instance or stable validation diagnostic
- `fromBinary64Exact(value)` → Java `new BigDecimal(double)` equivalent for finite values
- `normalizeLegacyBinary64(value)` → exact construction, scale 5 `HALF_UP`, then `stripTrailingZeros`
- `setScale(targetScale, roundingMode)` and `remainder(other)` → exact integer operations required by parity and editor snapping
- `toBinary64()` → correctly rounded Java-compatible double conversion
- `isQuantizationActive()` → `doubleValue > 0.0`, exactly matching Java activation

## Entity: Parameter numeric state

Canonical project model owned by `Parameter`.

| Field | Type | Persistence | Notes |
|---|---|---|---|
| `minimum` | binary64 | parameter/line XML double text | Remains a number. |
| `maximum` | binary64 | parameter/line XML double text | Remains a number. |
| `fixedValue` | binary64 | parameter XML double text | Remains a number. |
| `points[]` | ordered `{time: binary64, value: binary64}` | nested line XML | Duplicate times retain their stable order. |
| `curve` | `STEP \| LINEAR \| EXPONENTIAL` | parameter/line XML | Only linear claims full Java `Line` parity. |
| `enabled` | Boolean | parameter XML | Existing semantics. |
| `resolution` | `JavaDecimal` | `bdresolution` on parameter and line | Defaults to Java-compatible `-1`; sole quantization selector. |

### Removed fields

- `resolutionScale`: scale now belongs to `JavaDecimal` and cannot disagree with the coefficient.
- `highPrecision`: behavior is no longer selectable.

Legacy XML children with those names may be ignored for read compatibility but are neither saved nor copied as modeled behavior.

### XML load transition

1. Initialize resolution to exact decimal `-1`.
2. If top-level legacy `resolution` exists, parse it as binary64 and apply Java legacy normalization.
3. If top-level `bdresolution` exists, parse it exactly and override the legacy result.
4. Load the nested line and its points/metadata.
5. Synchronize the parameter's exact resolution to the nested line; a conflicting or line-only resolution does not override the Java parameter owner.
6. If any authoritative decimal is malformed, return the existing project-load diagnostic path without installing a partially parsed resolution.

### Save/copy transition

- Save the same `resolution.canonicalText` to both parameter and line `bdresolution` attributes.
- Deep copy the immutable exact resolution without converting through a number.
- Save no behavioral `highPrecision` or `resolutionScale` fields.

## Entity: BSB exact-resolution owner

The BSB horizontal slider, vertical slider, horizontal slider bank, and vertical slider bank define parameter resolutions and therefore own a `JavaDecimal` rather than a number.

| Field | Type | Rules |
|---|---|---|
| `resolution` | `JavaDecimal` | XML and copies preserve canonical text and scale. |
| `resolutionForDisplay` | binary64 | Derived only; may be used by visual preview/range labels. |

### Relationships

- `buildParameterSpecs()` and widget-to-parameter synchronization pass the exact value.
- Parameter-to-widget updates do not reconstruct resolution from `getResolution()` number.
- Range changes and committed value/point snapping use the Java-compatible exact rounding helper.

## Entity: Renderer automation snapshot

Serializable projection, not a state owner.

| Field | Type | Purpose |
|---|---|---|
| `resolutionDecimal` | string | Authoritative Java-canonical text used by editors and patches. |
| `resolution` | number | Derived `doubleValue()` for approximate curve preview and ordinary numeric display. |
| other parameter fields | existing serializable values | Unchanged binary64/Boolean/curve data. |

### Patch rules

- Resolution mutation accepts a decimal string and validates it before canonical project mutation.
- Optimistic renderer state uses the validated canonical string returned/derived by the same portable parser.
- A numeric-only patch cannot change the canonical resolution.
- An invalid edit keeps the last valid project value and presents a recoverable validation message.

## Entity: Runtime automation request (protocol v2)

Typed app/client representation before encoding.

| Field | Type | Validation |
|---|---|---|
| `channelName` | UTF-8 string | Non-empty, no embedded NUL, within existing command-size limits. |
| `curve` | curve enum | Known code only. |
| `enabled` | Boolean | Encodes as 0 or 1. |
| `resolutionDecimal` | canonical ASCII string | Must parse as Java-compatible exact decimal; source comes directly from the project model. |
| `points` | array of binary64 pairs | Count/byte-length checked; production input must meet the finite-input contract. |

`resolution`, `resolutionScale`, and `highPrecision` are absent from the public API and payload.

## Entity: Native exact resolution

Immutable control-thread-prepared representation.

| Field | Type | Notes |
|---|---|---|
| `canonicalText` | `std::string` | Validated protocol text retained for listing/diagnostics. |
| `coefficient` | private Boost integer | Exact signed unscaled value. |
| `scale` | `int32_t` | Exact Java scale. |
| `doubleValue` | `double` | Correct Java projection, prepared once. |
| `quantizationActive` | Boolean | `doubleValue > 0.0`. |
| `preparedPowers/limits` | private immutable data | Reused exact arithmetic inputs and checked size bounds. |
| `arenaBacking` | fixed byte storage | Allocated on the control thread from the preparation count. |
| `arenaCursor/workspace` | mutable single-consumer state | Reset and used only by the engine performance thread. |

### Invariants

- No normal/system allocator is reachable after successful preparation.
- The upstream allocator path records/fails in tests; an overflow is never treated as approximate success.
- Mutable workspace has exactly one consumer. Control-thread code never mutates it after publication.
- Destruction/reclamation occurs on the control thread after the performance thread has released the retired snapshot.
- Positive decimal values whose `doubleValue` is zero have `quantizationActive == false` and require no runtime quantization workspace.

## Entity: Prepared automation definition

Published, revisioned runtime definition.

| Field | Type | Notes |
|---|---|---|
| existing identity/channel/curve/enabled/points | existing types | Points remain binary64 and stable-ordered. |
| `segments` | immutable prepared segment array | Linear segments cache Java-order slope; exponential segments retain current log cache. |
| `resolution` | prepared native exact resolution | Replaces bounded quantization cache and mode flag. |
| `definitionRevision` | unsigned integer | Existing invalidation contract. |

### State transition

```text
protocol request
  → validate all fields
  → parse exact resolution
  → prepare segments and count workspace
  → allocate and verify arena
  → atomically publish new immutable definition revision
  → performance thread adopts prepared revision without allocating
  → old snapshot enters control-owned retirement
  → control thread reclaims after audio reference release
```

Any failure before publication leaves the previous definition intact.

## Entity: Performance-thread automation state

Small mutable state per active automation.

| Field | Purpose |
|---|---|
| current point/segment index | Accelerates forward playback while retaining Java duplicate/exact-point behavior. |
| completed/last elapsed | Existing rewind and completion behavior. |
| channel binding generation/pointer | Existing allocation-free channel resolution. |
| last written value bits | Existing write deduplication. |
| prepared definition reference | Adopted only on revision change; no parsing or vector construction. |
| diagnostic counters | Preallocated counts for invalid derived values/arena contract failures. |

Linear evaluation uses Java point selection and operation order. Direct point/endpoint returns bypass quantization. Interpolated positive-resolution values use the prepared exact quantizer. Step and exponential retain existing curve calculations, then use the same quantizer when active.

## Entity: Java parity fixture corpus

One logical, versioned development artifact.

| Component | Contents |
|---|---|
| manifest | Schema/generator versions, Java release, Java Blue revision and source hashes, reference methods, seed, command, counts/categories. |
| realtime cases | Raw binary64 point/time inputs, exact resolution text, expected output bits or diagnostic. |
| resolution cases | Exact parse/save/legacy/ownership inputs and expected coefficient, scale, canonical text, double bits, activation, or diagnostic. |
| offline cases | Raw inputs and base64 exact initialization/score text from Java `CSDRender`. |

### Corpus invariants

- Every case has a stable ID, origin (`curated` or `seeded`), and category.
- All doubles are encoded as 16 lowercase hexadecimal raw bits.
- Exactly 2,048 seeded realtime cases use the documented SplitMix64 seed/algorithm.
- Manifest counts and category minimums are asserted by every consumer.
- Regeneration has no timestamp or local path and is byte-identical at the pinned Java revision.
- Normal consumers never invoke Java and never maintain their own expected-result copy.

## Diagnostic model

Stable categories, not Java exception messages, cross package/native boundaries:

- `INVALID_DECIMAL_SYNTAX`
- `DECIMAL_SCALE_OVERFLOW`
- `NON_FINITE_AUTOMATION_INPUT`
- `AUTOMATION_PAYLOAD_INVALID`
- `DECIMAL_WORKSPACE_UNAVAILABLE`
- `DECIMAL_EVALUATION_INVALID`

Control-plane diagnostics reject the requested mutation. Audio-time diagnostics preserve the last written channel value and increment a counter without allocating, blocking, throwing, or logging.
