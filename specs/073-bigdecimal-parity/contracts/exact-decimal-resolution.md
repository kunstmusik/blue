# Contract: Exact Decimal Resolution

## Purpose

Define one language-neutral resolution identity and the Java-compatible operations shared by project XML, TypeScript models/editors/offline rendering, the engine protocol, and native realtime evaluation.

## Canonical identity

An exact resolution is a pair:

```text
coefficient: arbitrary-precision signed base-10 integer
scale: signed 32-bit integer
value = coefficient × 10^(-scale)
```

The external representation is the exact output of Java `BigDecimal.toString()` for that pair. This text preserves value and scale:

| Input accepted by Java | Coefficient | Scale | Canonical text |
|---|---:|---:|---|
| `0.1` | `1` | 1 | `0.1` |
| `0.10` | `10` | 2 | `0.10` |
| `1e-7` | `1` | 7 | `1E-7` |
| `1E+3` | `1` | -3 | `1E+3` |
| `0.00` | `0` | 2 | `0.00` |

Original spelling is not retained when it differs from Java canonical text. Meaningful scale is retained.

## Parsing

Production parsers MUST accept exactly the decimal forms accepted by Java `BigDecimal(String)` that fit Java's signed 32-bit scale. They MUST:

- consume the entire input;
- reject surrounding whitespace unless the caller's existing XML/input layer explicitly trims before this boundary;
- accept optional sign, decimal point, and exponent forms supported by Java;
- reject `NaN`, infinities, hexadecimal floats, locale separators, empty coefficients, and scale overflow;
- return a stable recoverable diagnostic without installing partial state.

XML, snapshots, patches, and protocol publication MUST validate/canonicalize once and MUST NOT use `parseFloat`/`strtod` as the source of truth.

## Java binary64 construction

`fromBinary64Exact(y)` MUST match `new BigDecimal(y)` for every finite IEEE 754 binary64 value:

- preserve the exact mathematical value of the binary64 input, not its shortest decimal display;
- reject non-finite input with `NON_FINITE_AUTOMATION_INPUT`;
- handle subnormals and signed zero consistently with Java's observable result;
- avoid host `long double`, decimal floating point, and libc text conversion as the parity implementation.

## Java decimal-to-binary64 conversion

`toBinary64()` MUST match `BigDecimal.doubleValue()`:

- correctly round to nearest with ties to even;
- produce subnormal or signed finite overflow results where Java does;
- allow a positive exact decimal to underflow to `+0.0`;
- provide the raw output bits for fixture comparison.

## Quantization activation

Quantization is active only when:

```text
resolution.toBinary64() > 0.0
```

An exact positive decimal that converts to zero is unquantized. Zero and negative resolutions are unquantized. The branch occurs before arbitrary-precision evaluation on the common path.

## Realtime linear evaluation

For Java-linear automation, select points exactly as Java `Line.getValue(double)` does. These paths return directly and bypass quantization:

- empty line (`+0.0`);
- single point;
- `time == 0.0`;
- exact point hit, returning the last point in the same-time run;
- last/beyond-last behavior reached by Java's search.

For an interpolated value, preserve double rounding after each operation:

```text
slope = (b.value - a.value) / (b.time - a.time)
x = time - a.time
y = (slope * x) + a.value
```

If quantization is active and `b.value < a.value`, apply two rounded binary64 operations:

```text
bias = resolutionDouble * 0.99
y = y + bias
```

Then perform:

```text
v = fromBinary64Exact(y)
v = v.setScale(resolution.scale, FLOOR)
v = v - v.remainder(resolution)
result = v.toBinary64()
```

No fused multiply-add or algebraic reassociation is permitted in the native linear parity unit.

## Extension curves

Step and exponential curves retain their pre-feature curve calculation and selection behavior. When that calculation produces a value eligible for positive-resolution quantization, the exact quantization sequence above applies to that computed double. This is exact decimal-quantizer parity, not a claim that the extension curve itself exists in Java `Line`.

## Legacy XML normalization

When a parameter has legacy double-valued `resolution` and no overriding `bdresolution`, normalization is:

```text
legacyDouble = Java-compatible binary64 parse
value = fromBinary64Exact(legacyDouble)
value = value.setScale(5, HALF_UP)
value = value.stripTrailingZeros()
```

The resulting coefficient/scale pair becomes the canonical exact resolution and is saved as `bdresolution`.

## Editor mutation

- A resolution edit is a decimal string mutation and returns canonical text or a validation diagnostic.
- BSB widget/parameter synchronization copies exact identity.
- A numeric derived projection may draw a curve preview but may not be patched back as the resolution authority.
- Operations that commit snapped values use the Java rounding helper covered by the Java fixture corpus; display-only preview may remain approximate.

## XML ownership

- The parameter-level exact resolution is authoritative after load.
- `bdresolution` overrides legacy `resolution` at the parameter boundary.
- The nested line receives the parameter resolution after its content loads.
- Save writes the same canonical text to parameter and nested line.
- `resolutionScale` and `highPrecision` are not behavioral state.

## Failure contract

Malformed input, non-finite input, scale overflow, or unavailable preparation memory MUST fail recoverably. It MUST NOT:

- silently use a nearest double as authoritative resolution;
- fall back to the old bounded or fast quantizer;
- mutate the previous valid definition;
- throw, allocate, format, or log on the realtime audio path.
