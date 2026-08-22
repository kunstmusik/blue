#pragma once

#include <boost/multiprecision/cpp_int.hpp>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <limits>
#include <string>

#include "AutomationErrors.h"

namespace blue {

/**
 * Java `BigDecimal`-compatible exact decimal used on the control thread for
 * parsing, validating, canonicalizing, and preparing automation resolutions.
 *
 * The authoritative state is the signed unscaled coefficient plus a signed
 * 32-bit scale (value = coefficient x 10^-scale). Audio-thread evaluation uses
 * ExactDecimalQuantizer, which mirrors this math over a fixed arena; this type
 * may allocate freely.
 */
using BlueBigInt =
    boost::multiprecision::number<boost::multiprecision::cpp_int_backend<>, boost::multiprecision::et_off>;

template <class Int>
double decimalToBinary64(const Int& coefficient, int32_t scale);

struct JavaBigDecimal {
    BlueBigInt coefficient{0};
    int32_t scale = 0;

    /** Exact Java BigDecimal.toString() equivalent. */
    std::string canonicalText() const;
    /** Java BigDecimal.doubleValue() equivalent (correctly rounded, half-even). */
    double doubleValue() const { return decimalToBinary64(coefficient, scale); }
    bool isZero() const { return coefficient.is_zero(); }
    /** Decimal digit count of the coefficient magnitude (at least one). */
    std::size_t digitCount() const;
};

enum class DecimalParseError {
    Ok,
    InvalidSyntax,
    ScaleOverflow,
};

/** Parses exactly the decimal forms Java BigDecimal(String) accepts. */
DecimalParseError parseJavaBigDecimal(const std::string& text, JavaBigDecimal& out);

enum class DecimalRounding {
    Floor,
    HalfUp,
};

/**
 * Exact setScale. Returns false (leaving out untouched) when the scale
 * adjustment is outside the supported power-of-ten bound; production paths
 * never reach that bound because quantization only activates within double
 * range.
 */
bool javaBigDecimalSetScale(const JavaBigDecimal& value, int32_t newScale,
                            DecimalRounding rounding, JavaBigDecimal& out);

/** Java signed remainder; result scale is max(dividend, divisor). */
bool javaBigDecimalRemainder(const JavaBigDecimal& dividend, const JavaBigDecimal& divisor,
                             JavaBigDecimal& out);

/** Exact subtraction at the larger operand scale. */
bool javaBigDecimalSubtract(const JavaBigDecimal& minuend, const JavaBigDecimal& subtrahend,
                            JavaBigDecimal& out);

/** Java stripTrailingZeros(); zero becomes scale 0. */
JavaBigDecimal javaBigDecimalStripTrailingZeros(const JavaBigDecimal& value);

/**
 * Exact construction from a finite binary64, matching Java
 * new BigDecimal(double): the exact mathematical value of the double with the
 * minimal coefficient/scale pair. Returns false for non-finite input.
 */
bool javaBigDecimalFromBinary64(double value, JavaBigDecimal& out);

/**
 * Host-workspace guard shared with @blue/data's JavaDecimal. Parsing still
 * accepts Java's entire signed-32-bit scale range; callers report a
 * workspace diagnostic only if exact arithmetic would require an
 * unreasonably large temporary integer.
 */
constexpr int32_t kDecimalPow10Limit = 1'000'000;

// ---------------------------------------------------------------------------
// Correctly rounded decimal-to-binary64 conversion (Java BigDecimal.doubleValue())
// ---------------------------------------------------------------------------

namespace decimal_detail {

template <class Int>
bool pow10Checked(int32_t power, Int& out) {
    if (power < 0 || power > kDecimalPow10Limit) {
        return false;
    }
    out = Int(1);
    Int base(10);
    int32_t remaining = power;
    while (remaining > 0) {
        if (remaining & 1) out *= base;
        remaining >>= 1;
        if (remaining > 0) base *= base;
    }
    return true;
}

template <class Int>
Int pow10(int32_t power) {
    Int result;
    pow10Checked(power, result);
    return result;
}

template <class Int>
std::string magnitudeDigits(const Int& coefficient) {
    if (coefficient.sign() < 0) {
        return (-coefficient).str();
    }
    return coefficient.str();
}

inline double bitsToDoubleHost(uint64_t bits) {
    double value;
    std::memcpy(&value, &bits, sizeof(value));
    return value;
}

inline uint64_t doubleToBitsHost(double value) {
    uint64_t bits;
    std::memcpy(&bits, &value, sizeof(bits));
    return bits;
}

template <class Int>
int estimateBinaryExponent(const Int& magnitude, int32_t scale) {
    const long long bitLength = static_cast<long long>(boost::multiprecision::msb(magnitude)) + 1;
    if (scale == 0) {
        return static_cast<int>(bitLength - 1);
    }
    // log2(10) to double precision; the alignment loop corrects small errors
    return static_cast<int>(std::floor(static_cast<double>(bitLength - 1) -
                                       static_cast<double>(scale) * std::log2(10.0)));
}

/** round-half-even(magnitude * 10^-scale * 2^(52-e)); assumes magnitude > 0 */
template <class Int>
Int scaleSignificand(const Int& magnitude, int32_t scale, int e) {
    Int numerator = magnitude;
    Int denominator(1);
    if (scale < 0) {
        numerator *= pow10<Int>(-scale);
    } else {
        denominator = pow10<Int>(scale);
    }
    const long long shift = static_cast<long long>(52) - e;
    if (shift >= 0) {
        numerator <<= static_cast<unsigned long long>(shift);
    } else {
        denominator <<= static_cast<unsigned long long>(-shift);
    }
    const Int quotient = numerator / denominator;
    const Int remainder = numerator - quotient * denominator;
    const Int twiceRemainder = remainder * 2;
    if (twiceRemainder > denominator) return quotient + 1;
    if (twiceRemainder == denominator) {
        return (quotient & 1u).is_zero() ? quotient : quotient + 1;
    }
    return quotient;
}

template <class Int>
double signedFromRawBits(bool negative, uint64_t rawBits) {
    const double magnitude = bitsToDoubleHost(rawBits);
    return negative ? -magnitude : magnitude;
}

}  // namespace decimal_detail

/**
 * Correctly rounded binary64 conversion for any cpp_int-backed integer type:
 * round to nearest with ties to even, signed overflow to infinity, and signed
 * underflow to zero. Matches Java BigDecimal.doubleValue().
 *
 * The magnitude shortcut uses a string-free digit estimate so this template
 * stays allocation-free for arena-backed integer types; the ±1-digit estimate
 * error is absorbed by the wide overflow/underflow margins.
 */
template <class Int>
double decimalToBinary64(const Int& coefficient, int32_t scale) {
    using namespace decimal_detail;

    const bool negative = coefficient.sign() < 0;
    Int magnitude = negative ? -coefficient : coefficient;
    if (magnitude.is_zero()) {
        return 0.0;
    }

    const long long bitLength = static_cast<long long>(boost::multiprecision::msb(magnitude)) + 1;
    const long long digitEstimate = (bitLength * 301029) / 1000000 + 1;  // log10(2)
    const long long adjustedEstimate = digitEstimate - 1 - scale;
    if (adjustedEstimate > 340) {
        return negative ? -std::numeric_limits<double>::infinity()
                        : std::numeric_limits<double>::infinity();
    }
    if (adjustedEstimate < -400) {
        return negative ? -0.0 : 0.0;
    }

    int e = estimateBinaryExponent(magnitude, scale);
    Int q = 0;
    const Int twoPow52 = Int(1u) << 52;
    const Int twoPow53 = Int(1u) << 53;
    for (int attempt = 0; attempt < 6; attempt++) {
        q = scaleSignificand(magnitude, scale, e);
        if (q >= twoPow53) {
            e++;
            continue;
        }
        if (q < twoPow52) {
            e--;
            continue;
        }
        break;
    }

    if (e > 1023) {
        return negative ? -std::numeric_limits<double>::infinity()
                        : std::numeric_limits<double>::infinity();
    }
    if (e >= -1022) {
        const uint64_t significandBits = (q - twoPow52).template convert_to<uint64_t>();
        const uint64_t bits = (static_cast<uint64_t>(e + 1023) << 52) | significandBits;
        return signedFromRawBits<Int>(negative, bits);
    }

    // subnormal range: rescale onto the 2^-1074 grid, ties to even
    const unsigned long long shift = static_cast<unsigned long long>(-1022 - e);
    const Int shifted = q >> shift;
    const Int remainder = q - (shifted << shift);
    Int subnormal = shifted;
    const Int half = Int(1u) << (shift - 1);
    if (remainder > half || (remainder == half && !(shifted & 1u).is_zero())) {
        subnormal += 1;
    }
    if (subnormal.is_zero()) {
        return negative ? -0.0 : 0.0;
    }
    if (subnormal >= twoPow52) {
        // rounded up into the smallest normal
        return signedFromRawBits<Int>(negative, 1ull << 52);
    }
    return signedFromRawBits<Int>(negative, subnormal.template convert_to<uint64_t>());
}

inline double javaBigDecimalToBinary64(const BlueBigInt& coefficient, int32_t scale) {
    return decimalToBinary64(coefficient, scale);
}

}  // namespace blue
