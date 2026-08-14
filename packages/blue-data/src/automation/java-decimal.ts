/**
 * Java-compatible exact decimal model for automation resolutions.
 *
 * The authoritative state is a signed decimal coefficient plus a signed 32-bit
 * scale, exactly matching Java `BigDecimal` identity as Java Blue uses it:
 * value = coefficient × 10^(-scale). Parsing accepts exactly the decimal forms
 * Java `BigDecimal(String)` accepts, `canonicalText` reproduces Java
 * `BigDecimal.toString()`, and `doubleValue` reproduces Java
 * `BigDecimal.doubleValue()` including subnormal rounding, signed overflow to
 * infinity, and signed underflow to zero.
 *
 * This module is browser-safe and Node-safe: it uses only static ES imports
 * and JavaScript `BigInt` for exact integer operations. It never converts
 * through a `number` except in the explicitly named binary64 construction and
 * conversion operations.
 */

/** Stable recoverable diagnostic categories crossing package boundaries. */
export type JavaDecimalDiagnosticCode =
  | 'INVALID_DECIMAL_SYNTAX'
  | 'DECIMAL_SCALE_OVERFLOW'
  | 'DECIMAL_WORKSPACE_UNAVAILABLE'
  | 'NON_FINITE_AUTOMATION_INPUT';

export interface JavaDecimalDiagnostic {
  readonly code: JavaDecimalDiagnosticCode;
  readonly message: string;
}

export type JavaDecimalResult =
  | { readonly ok: true; readonly value: JavaDecimal }
  | { readonly ok: false; readonly code: JavaDecimalDiagnosticCode; readonly message: string };

/**
 * Immutable exact decimal value. The `(coefficient, scale)` pair is the
 * authority; `canonicalText` and `doubleValue` are cached derivations.
 * Instances cross process/UI boundaries as `canonicalText`, never as a class
 * instance or JavaScript `bigint`.
 */
export interface JavaDecimal {
  /** Canonical signed digit string: optional '-', no redundant leading zeros, zero never negative. */
  readonly coefficient: string;
  /** Signed 32-bit Java scale. */
  readonly scale: number;
  /** Exact Java `BigDecimal.toString()` equivalent (XML, snapshot, and wire representation). */
  readonly canonicalText: string;
  /** Java `BigDecimal.doubleValue()` equivalent. */
  readonly doubleValue: number;
}

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const INT64_MAX = 9223372036854775807n;

/**
 * The parser accepts Java's full signed-32-bit scale domain. Exact operations
 * still need a finite host allocation guard so malicious text cannot request a
 * multi-gigabyte BigInt; this is deliberately a workspace diagnostic rather
 * than a decimal scale restriction. Normal Java Blue projects, including
 * resolutions with scales well beyond 18 or 2000, stay below this guard.
 */
const POW10_LIMIT = 1_000_000;

const dataView = new DataView(new ArrayBuffer(8));

// ---------------------------------------------------------------------------
// Internal construction helpers
// ---------------------------------------------------------------------------

function digitCount(value: bigint): number {
  if (value === 0n) return 1;
  const s = value.toString();
  return s.startsWith('-') ? s.length - 1 : s.length;
}

/** Java `BigDecimal.toString()` layout from a coefficient/scale pair. */
function javaCanonicalText(coefficient: bigint, scale: number): string {
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString();
  const precision = digits.length;
  const sign = negative && coefficient !== 0n ? '-' : '';
  const adjusted = precision - 1 - scale;

  if (scale === 0) {
    return sign + digits;
  }
  if (scale > 0 && adjusted >= -6) {
    if (scale >= precision) {
      return sign + '0.' + '0'.repeat(scale - precision) + digits;
    }
    return sign + digits.slice(0, precision - scale) + '.' + digits.slice(precision - scale);
  }
  const mantissa =
    precision > 1 ? digits[0] + '.' + digits.slice(1) : digits;
  const exponent = adjusted >= 0 ? '+' + adjusted : String(adjusted);
  return sign + mantissa + 'E' + exponent;
}

function makeJavaDecimal(coefficient: bigint, scale: number): JavaDecimal {
  const canonicalText = javaCanonicalText(coefficient, scale);
  return Object.freeze({
    coefficient: coefficient.toString(),
    scale,
    canonicalText,
    doubleValue: javaDecimalToBinary64({ coefficient: coefficient.toString(), scale, canonicalText, doubleValue: 0 }),
  });
}

// ---------------------------------------------------------------------------
// Parsing (Java BigDecimal(String) grammar)
// ---------------------------------------------------------------------------

/**
 * Parses decimal text with exactly the grammar Java `BigDecimal(String)`
 * accepts: optional sign, integer/fraction digit groups with an optional
 * single decimal point (at least one digit overall), and an optional signed
 * exponent. The resulting scale must fit Java's signed 32-bit range.
 * Surrounding whitespace is rejected; callers trim at their input boundary.
 */
export function parseJavaDecimal(text: string): JavaDecimalResult {
  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, code: 'INVALID_DECIMAL_SYNTAX', message: 'decimal text is empty' };
  }

  let index = 0;
  let negative = false;
  if (text[index] === '+' || text[index] === '-') {
    negative = text[index] === '-';
    index++;
  }

  let intDigits = '';
  let fracDigits = '';
  let sawPoint = false;

  while (index < text.length) {
    const c = text[index];
    if (c >= '0' && c <= '9') {
      if (sawPoint) fracDigits += c;
      else intDigits += c;
      index++;
    } else if (c === '.' && !sawPoint) {
      sawPoint = true;
      index++;
    } else {
      break;
    }
  }

  if (intDigits.length + fracDigits.length === 0) {
    return { ok: false, code: 'INVALID_DECIMAL_SYNTAX', message: 'no digits in decimal text' };
  }

  let exponent = 0n;
  if (index < text.length) {
    const c = text[index];
    if (c !== 'e' && c !== 'E') {
      return { ok: false, code: 'INVALID_DECIMAL_SYNTAX', message: `unexpected character '${c}' in decimal text` };
    }
    index++;
    let exponentNegative = false;
    if (text[index] === '+' || text[index] === '-') {
      exponentNegative = text[index] === '-';
      index++;
    }
    let exponentDigits = '';
    while (index < text.length) {
      const d = text[index];
      if (d >= '0' && d <= '9') {
        exponentDigits += d;
        index++;
      } else {
        return {
          ok: false,
          code: 'INVALID_DECIMAL_SYNTAX',
          message: `unexpected character '${d}' in decimal exponent`,
        };
      }
    }
    if (exponentDigits.length === 0) {
      return { ok: false, code: 'INVALID_DECIMAL_SYNTAX', message: 'decimal exponent has no digits' };
    }
    exponent = BigInt(exponentDigits);
    if (exponentNegative) exponent = -exponent;
    if (exponent > INT64_MAX || exponent < -INT64_MAX) {
      return { ok: false, code: 'DECIMAL_SCALE_OVERFLOW', message: 'decimal exponent overflow' };
    }
  }

  if (index !== text.length) {
    return { ok: false, code: 'INVALID_DECIMAL_SYNTAX', message: 'trailing characters in decimal text' };
  }

  const scaleBig = BigInt(fracDigits.length) - exponent;
  if (scaleBig > BigInt(INT32_MAX) || scaleBig < BigInt(INT32_MIN)) {
    return { ok: false, code: 'DECIMAL_SCALE_OVERFLOW', message: 'decimal scale out of 32-bit range' };
  }
  const scale = Number(scaleBig);

  const coefficientDigits = intDigits + fracDigits;
  const magnitude = coefficientDigits === '' ? 0n : BigInt(coefficientDigits);
  const coefficient = negative ? -magnitude : magnitude;
  return { ok: true, value: makeJavaDecimal(coefficient, scale) };
}

// ---------------------------------------------------------------------------
// Binary64 construction (Java new BigDecimal(double))
// ---------------------------------------------------------------------------

/**
 * Exact construction from a finite binary64, matching Java
 * `new BigDecimal(double)`: preserves the exact mathematical value of the
 * double, rejects non-finite input, and drops the sign of zero.
 */
export function javaDecimalFromBinary64(value: number): JavaDecimalResult {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return {
      ok: false,
      code: 'NON_FINITE_AUTOMATION_INPUT',
      message: 'cannot construct an exact decimal from a non-finite value',
    };
  }
  dataView.setFloat64(0, value);
  const bits = dataView.getBigUint64(0);
  const signBit = (bits >> 63n) & 1n;
  const exponentBits = Number((bits >> 52n) & 0x7ffn);
  const mantissa = bits & 0xfffffffffffffn;

  if (exponentBits === 0 && mantissa === 0n) {
    return { ok: true, value: makeJavaDecimal(0n, 0) };
  }

  const significand = exponentBits === 0 ? mantissa : mantissa | (1n << 52n);
  const binaryExponent = exponentBits === 0 ? -1074 : exponentBits - 1075;

  let coefficient: bigint;
  let scale: number;
  if (binaryExponent >= 0) {
    coefficient = significand << BigInt(binaryExponent);
    scale = 0;
  } else {
    // value = significand / 2^k = significand * 5^k / 10^k, exact
    const k = -binaryExponent;
    coefficient = significand * 5n ** BigInt(k);
    scale = k;
    // Java reduces m * 5^k by its trailing decimal zeros so the stored
    // coefficient/scale pair is minimal (e.g. 0.1 keeps 55 digits, not 56)
    while (scale > 0 && coefficient % 10n === 0n) {
      coefficient /= 10n;
      scale -= 1;
    }
  }
  if (signBit === 1n) {
    coefficient = -coefficient;
  }
  return { ok: true, value: makeJavaDecimal(coefficient, scale) };
}

// ---------------------------------------------------------------------------
// Binary64 conversion (Java BigDecimal.doubleValue())
// ---------------------------------------------------------------------------

function pow10(power: number): bigint {
  if (power < 0 || power > POW10_LIMIT) {
    throw new Error(`pow10 out of supported range: ${power}`);
  }
  return 10n ** BigInt(power);
}

/**
 * Correctly rounded binary64 conversion matching Java
 * `BigDecimal.doubleValue()`: round to nearest with ties to even, signed
 * overflow to infinity, and positive/negative underflow to signed zero.
 */
export function javaDecimalToBinary64(decimal: JavaDecimal): number {
  const negative = decimal.coefficient.startsWith('-');
  let magnitude = BigInt(decimal.coefficient);
  if (magnitude < 0n) magnitude = -magnitude;
  const scale = decimal.scale;

  if (magnitude === 0n) return 0.0;

  // Fast magnitude shortcuts far outside the double range; the margins keep
  // every near-boundary case on the exact path below.
  const adjustedEstimate = digitCount(magnitude) - 1 - scale;
  if (adjustedEstimate > 340) return negative ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  if (adjustedEstimate < -400) return negative ? -0.0 : 0.0;

  // value = magnitude * 10^-scale. Target: significand q in [2^52, 2^53) and
  // binary exponent e with value ~= q * 2^(e-52).
  let e = estimateBinaryExponent(magnitude, scale);
  let q = 0n;
  for (let attempt = 0; attempt < 4; attempt++) {
    const rounded = scaleSignificand(magnitude, scale, e);
    if (rounded === null) {
      e--;
      continue;
    }
    q = rounded;
    if (q >= 1n << 53n) {
      e++;
      continue;
    }
    if (q < 1n << 52n) {
      e--;
      continue;
    }
    break;
  }

  if (e > 1023) {
    return negative ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  if (e >= -1022) {
    const significandBits = q - (1n << 52n);
    const bits = (BigInt(e + 1023) << 52n) | significandBits;
    return fromSignAndRawBits(negative, bits);
  }

  // Subnormal range: rescale onto the 2^-1074 grid, ties to even.
  const shift = BigInt(-1022 - e);
  const shifted = q >> shift;
  const remainderMask = (1n << shift) - 1n;
  const remainder = q & remainderMask;
  let subnormal = shifted;
  const half = 1n << (shift - 1n);
  if (remainder > half || (remainder === half && (shifted & 1n) === 1n)) {
    subnormal = shifted + 1n;
  }
  if (subnormal === 0n) {
    return negative ? -0.0 : 0.0;
  }
  if (subnormal >= 1n << 52n) {
    // rounded up into the smallest normal
    return fromSignAndRawBits(negative, 1n << 52n);
  }
  return fromSignAndRawBits(negative, subnormal);
}

function fromSignAndRawBits(negative: boolean, rawBits: bigint): number {
  dataView.setBigUint64(0, rawBits);
  const value = dataView.getFloat64(0);
  return negative ? -value : value;
}

function estimateBinaryExponent(magnitude: bigint, scale: number): number {
  const bitLength = magnitude.toString(2).length;
  if (scale === 0) return bitLength - 1;
  // log2(10) to double precision; the alignment loop corrects any small error.
  return Math.floor(bitLength - 1 - scale * Math.log2(10));
}

/**
 * Computes round-half-even(magnitude * 10^-scale * 2^(52-e)) or null when the
 * result is not representable without rebalancing (denominator zero cases).
 */
function scaleSignificand(magnitude: bigint, scale: number, e: number): bigint | null {
  let numerator = magnitude;
  let denominator = 1n;
  if (scale < 0) {
    numerator *= pow10(-scale);
  } else {
    denominator = pow10(scale);
  }
  const shift = 52 - e;
  if (shift >= 0) {
    numerator <<= BigInt(shift);
  } else {
    denominator <<= BigInt(-shift);
  }
  const quotient = numerator / denominator;
  const remainder = numerator - quotient * denominator;
  const twiceRemainder = remainder << 1n;
  if (twiceRemainder > denominator) return quotient + 1n;
  if (twiceRemainder === denominator) {
    return (quotient & 1n) === 0n ? quotient : quotient + 1n;
  }
  return quotient;
}

// ---------------------------------------------------------------------------
// Exact decimal operations
// ---------------------------------------------------------------------------

function coefficientOf(decimal: JavaDecimal): bigint {
  return BigInt(decimal.coefficient);
}

/** Exact `setScale(newScale, FLOOR)`: rounds toward negative infinity. */
export function javaDecimalSetScaleFloor(
  decimal: JavaDecimal,
  newScale: number,
): JavaDecimalResult {
  return setScale(decimal, newScale, 'FLOOR');
}

/** Exact `setScale(newScale, HALF_UP)`: rounds away from zero on ties. */
export function javaDecimalSetScaleHalfUp(
  decimal: JavaDecimal,
  newScale: number,
): JavaDecimalResult {
  return setScale(decimal, newScale, 'HALF_UP');
}

function setScale(
  decimal: JavaDecimal,
  newScale: number,
  mode: 'FLOOR' | 'HALF_UP',
): JavaDecimalResult {
  if (newScale < INT32_MIN || newScale > INT32_MAX) {
    return { ok: false, code: 'DECIMAL_SCALE_OVERFLOW', message: 'target scale out of 32-bit range' };
  }
  const coefficient = coefficientOf(decimal);
  if (newScale === decimal.scale) {
    return { ok: true, value: makeJavaDecimal(coefficient, newScale) };
  }
  if (newScale > decimal.scale) {
    const pad = newScale - decimal.scale;
    if (pad > POW10_LIMIT) {
      return { ok: false, code: 'DECIMAL_WORKSPACE_UNAVAILABLE', message: 'decimal workspace is unavailable for the requested scale' };
    }
    return { ok: true, value: makeJavaDecimal(coefficient * pow10(pad), newScale) };
  }
  const k = decimal.scale - newScale;
  if (k > POW10_LIMIT) {
    return { ok: false, code: 'DECIMAL_WORKSPACE_UNAVAILABLE', message: 'decimal workspace is unavailable for the requested scale' };
  }
  const divisor = pow10(k);
  let quotient = coefficient / divisor;
  const remainder = coefficient - quotient * divisor;
  if (mode === 'FLOOR') {
    // trunc division rounded toward zero; floor must move one step toward
    // negative infinity for negative dividends with a nonzero remainder
    if (remainder !== 0n && coefficient < 0n) {
      quotient -= 1n;
    }
  } else {
    const twiceRemainder = remainder < 0n ? -remainder << 1n : remainder << 1n;
    if (twiceRemainder >= divisor) {
      quotient += coefficient < 0n ? -1n : 1n;
    }
  }
  return { ok: true, value: makeJavaDecimal(quotient, newScale) };
}

/** Java signed `remainder(divisor)`: result keeps the dividend's scale. */
export function javaDecimalRemainder(
  dividend: JavaDecimal,
  divisor: JavaDecimal,
): JavaDecimalResult {
  const scale = Math.max(dividend.scale, divisor.scale);
  if (scale - dividend.scale > POW10_LIMIT || scale - divisor.scale > POW10_LIMIT) {
    return {
      ok: false,
      code: 'DECIMAL_WORKSPACE_UNAVAILABLE',
      message: 'decimal workspace is unavailable for scale alignment',
    };
  }
  const dividendCoefficient = coefficientOf(dividend) * pow10(scale - dividend.scale);
  const divisorCoefficient = coefficientOf(divisor) * pow10(scale - divisor.scale);
  if (divisorCoefficient === 0n) {
    return { ok: false, code: 'INVALID_DECIMAL_SYNTAX', message: 'decimal remainder by zero' };
  }
  const remainder =
    dividendCoefficient - (dividendCoefficient / divisorCoefficient) * divisorCoefficient;
  return { ok: true, value: makeJavaDecimal(remainder, scale) };
}

/** Exact subtraction at the larger operand scale, matching Java semantics. */
export function javaDecimalSubtract(
  minuend: JavaDecimal,
  subtrahend: JavaDecimal,
): JavaDecimalResult {
  const scale = Math.max(minuend.scale, subtrahend.scale);
  if (scale - minuend.scale > POW10_LIMIT || scale - subtrahend.scale > POW10_LIMIT) {
    return {
      ok: false,
      code: 'DECIMAL_WORKSPACE_UNAVAILABLE',
      message: 'decimal workspace is unavailable for scale alignment',
    };
  }
  const left = coefficientOf(minuend) * pow10(scale - minuend.scale);
  const right = coefficientOf(subtrahend) * pow10(scale - subtrahend.scale);
  return { ok: true, value: makeJavaDecimal(left - right, scale) };
}

/** Java `stripTrailingZeros()`: removes trailing zero digits; zero becomes scale 0. */
export function javaDecimalStripTrailingZeros(decimal: JavaDecimal): JavaDecimal {
  let coefficient = coefficientOf(decimal);
  let scale = decimal.scale;
  if (coefficient === 0n) {
    return makeJavaDecimal(0n, 0);
  }
  while (coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return makeJavaDecimal(coefficient, scale);
}

// ---------------------------------------------------------------------------
// Activation and Java evaluator helpers
// ---------------------------------------------------------------------------

/** Quantization is active exactly when `resolution.doubleValue() > 0.0`. */
export function javaDecimalIsQuantizationActive(resolution: JavaDecimal): boolean {
  return resolution.doubleValue > 0.0;
}

/**
 * Java Blue's quantization sequence for an interpolated value:
 * `new BigDecimal(y).setScale(resolution.scale(), FLOOR)` then
 * `subtract(remainder(resolution))`, converted back with `doubleValue()`.
 * Returns null when y is non-finite (Java would throw).
 */
export function quantizeToResolutionJava(y: number, resolution: JavaDecimal): number | null {
  const exact = javaDecimalFromBinary64(y);
  if (!exact.ok) return null;
  const scaled = javaDecimalSetScaleFloor(exact.value, resolution.scale);
  if (!scaled.ok) return null;
  const remainder = javaDecimalRemainder(scaled.value, resolution);
  if (!remainder.ok) return null;
  const quantized = javaDecimalSubtract(scaled.value, remainder.value);
  if (!quantized.ok) return null;
  return javaDecimalToBinary64(quantized.value);
}

/**
 * Java Blue `LineUtils.snapToResolution(value, min, max, resolution)`:
 * boundary clamps first, then HALF_UP snapping of (value - min) onto the
 * resolution grid, finally re-adding min (as a double addition).
 */
export function snapToResolutionJava(
  value: number,
  min: number,
  max: number,
  resolution: JavaDecimal,
): number {
  if (value >= max) return max;
  if (value <= min) return min;
  if (!(resolution.doubleValue > 0.0)) return value;

  let retVal = value - min;
  const exact = javaDecimalFromBinary64(retVal);
  if (exact.ok) {
    let grid = javaDecimalSetScaleHalfUp(exact.value, resolution.scale);
    if (grid.ok) {
      const remainder = javaDecimalRemainder(grid.value, resolution);
      if (remainder.ok) {
        const snapped = javaDecimalSubtract(grid.value, remainder.value);
        if (snapped.ok) {
          retVal = javaDecimalToBinary64(snapped.value);
        }
      }
    }
  }
  return retVal + min;
}

/**
 * Java Blue legacy resolution normalization:
 * `new BigDecimal(double).setScale(5, HALF_UP).stripTrailingZeros()`.
 */
export function normalizeLegacyResolution(legacyValue: number): JavaDecimalResult {
  const exact = javaDecimalFromBinary64(legacyValue);
  if (!exact.ok) return exact;
  const rounded = javaDecimalSetScaleHalfUp(exact.value, 5);
  if (!rounded.ok) return rounded;
  return { ok: true, value: javaDecimalStripTrailingZeros(rounded.value) };
}

/** Equality of exact identity: same coefficient and same scale. */
export function javaDecimalEquals(a: JavaDecimal, b: JavaDecimal): boolean {
  return a.coefficient === b.coefficient && a.scale === b.scale;
}
