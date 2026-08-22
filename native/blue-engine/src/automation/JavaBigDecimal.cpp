#include "JavaBigDecimal.h"

namespace blue {

namespace {

using decimal_detail::pow10;
using decimal_detail::pow10Checked;

BlueBigInt pow5(int32_t power) {
    BlueBigInt result(1);
    BlueBigInt base(5);
    int32_t remaining = power;
    while (remaining > 0) {
        if (remaining & 1) result *= base;
        remaining >>= 1;
        if (remaining > 0) base *= base;
    }
    return result;
}

}  // namespace

std::size_t JavaBigDecimal::digitCount() const {
    return decimal_detail::magnitudeDigits(coefficient).size();
}

std::string JavaBigDecimal::canonicalText() const {
    const bool negative = coefficient.sign() < 0;
    const std::string digits = decimal_detail::magnitudeDigits(coefficient);
    const long long precision = static_cast<long long>(digits.size());
    const long long scale = this->scale;
    std::string sign = (negative && !coefficient.is_zero()) ? "-" : "";

    if (scale == 0) {
        return sign + digits;
    }
    const long long adjusted = precision - 1 - scale;
    if (scale > 0 && adjusted >= -6) {
        if (scale >= precision) {
            return sign + "0." + std::string(static_cast<std::size_t>(scale - precision), '0') +
                   digits;
        }
        return sign + digits.substr(0, static_cast<std::size_t>(precision - scale)) + "." +
               digits.substr(static_cast<std::size_t>(precision - scale));
    }
    std::string mantissa = digits.substr(0, 1);
    if (precision > 1) {
        mantissa += "." + digits.substr(1);
    }
    std::string exponent =
        adjusted >= 0 ? ("+" + std::to_string(adjusted)) : std::to_string(adjusted);
    return sign + mantissa + "E" + exponent;
}

DecimalParseError parseJavaBigDecimal(const std::string& text, JavaBigDecimal& out) {
    if (text.empty()) {
        return DecimalParseError::InvalidSyntax;
    }
    std::size_t index = 0;
    bool negative = false;
    if (text[index] == '+' || text[index] == '-') {
        negative = text[index] == '-';
        index++;
    }

    std::string intDigits;
    std::string fracDigits;
    bool sawPoint = false;
    while (index < text.size()) {
        const char c = text[index];
        if (c >= '0' && c <= '9') {
            if (sawPoint) fracDigits += c;
            else intDigits += c;
            index++;
        } else if (c == '.' && !sawPoint) {
            sawPoint = true;
            index++;
        } else {
            break;
        }
    }
    if (intDigits.empty() && fracDigits.empty()) {
        return DecimalParseError::InvalidSyntax;
    }

    BlueBigInt exponent = 0;
    if (index < text.size()) {
        const char c = text[index];
        if (c != 'e' && c != 'E') {
            return DecimalParseError::InvalidSyntax;
        }
        index++;
        bool exponentNegative = false;
        if (index < text.size() && (text[index] == '+' || text[index] == '-')) {
            exponentNegative = text[index] == '-';
            index++;
        }
        std::string exponentDigits;
        while (index < text.size()) {
            const char d = text[index];
            if (d >= '0' && d <= '9') {
                exponentDigits += d;
                index++;
            } else {
                return DecimalParseError::InvalidSyntax;
            }
        }
        if (exponentDigits.empty()) {
            return DecimalParseError::InvalidSyntax;
        }
        exponent = BlueBigInt(exponentDigits.c_str());
        if (exponentNegative) exponent = -exponent;
        // Java parses the exponent into a signed 64-bit value and rejects
        // anything larger before computing the scale
        if (exponent > BlueBigInt(std::numeric_limits<int64_t>::max()) ||
            exponent < BlueBigInt(std::numeric_limits<int64_t>::min())) {
            return DecimalParseError::ScaleOverflow;
        }
    }
    if (index != text.size()) {
        return DecimalParseError::InvalidSyntax;
    }

    const BlueBigInt scaleValue = BlueBigInt(static_cast<int64_t>(fracDigits.size())) - exponent;
    if (scaleValue > BlueBigInt(std::numeric_limits<int32_t>::max()) ||
        scaleValue < BlueBigInt(std::numeric_limits<int32_t>::min())) {
        return DecimalParseError::ScaleOverflow;
    }

    // Java's unscaled value carries no redundant leading zeros; stripping
    // them also keeps cpp_int's string constructor out of its octal-prefix
    // interpretation of a leading '0'
    std::string coefficientDigits = intDigits + fracDigits;
    const std::size_t firstSignificant = coefficientDigits.find_first_not_of('0');
    if (firstSignificant == std::string::npos) {
        coefficientDigits = "0";
    } else {
        coefficientDigits = coefficientDigits.substr(firstSignificant);
    }
    BlueBigInt magnitude(coefficientDigits.c_str());
    out.coefficient = negative ? -magnitude : magnitude;
    out.scale = static_cast<int32_t>(scaleValue.convert_to<int64_t>());
    return DecimalParseError::Ok;
}

bool javaBigDecimalFromBinary64(double value, JavaBigDecimal& out) {
    if (std::isnan(value) || std::isinf(value)) {
        return false;
    }
    const uint64_t bits = decimal_detail::doubleToBitsHost(value);
    const uint64_t signBit = (bits >> 63) & 1u;
    const uint32_t exponentBits = static_cast<uint32_t>((bits >> 52) & 0x7ffu);
    const uint64_t mantissa = bits & 0xfffffffffffffull;

    if (exponentBits == 0 && mantissa == 0) {
        out.coefficient = 0;
        out.scale = 0;
        return true;
    }

    BlueBigInt significand;
    int32_t binaryExponent = 0;
    if (exponentBits == 0) {
        significand = BlueBigInt(mantissa);
        binaryExponent = -1074;
    } else {
        significand = BlueBigInt(mantissa) | (BlueBigInt(1u) << 52);
        binaryExponent = static_cast<int32_t>(exponentBits) - 1075;
    }

    BlueBigInt coefficient;
    int32_t scale = 0;
    if (binaryExponent >= 0) {
        coefficient = significand << static_cast<unsigned>(binaryExponent);
        scale = 0;
    } else {
        // exact: significand / 2^k = significand * 5^k at scale k
        const int32_t k = -binaryExponent;
        coefficient = significand * pow5(k);
        scale = k;
        // Java reduces m * 5^k by trailing decimal zeros for a minimal pair
        const BlueBigInt ten(10);
        while (scale > 0 && (coefficient % ten).is_zero()) {
            coefficient /= ten;
            scale -= 1;
        }
    }
    if (signBit == 1) {
        coefficient = -coefficient;
    }
    out.coefficient = coefficient;
    out.scale = scale;
    return true;
}

bool javaBigDecimalSetScale(const JavaBigDecimal& value, int32_t newScale,
                            DecimalRounding rounding, JavaBigDecimal& out) {
    if (newScale == value.scale) {
        out = value;
        return true;
    }
    if (newScale > value.scale) {
        const int64_t padScale = static_cast<int64_t>(newScale) - value.scale;
        if (padScale > kDecimalPow10Limit) {
            return false;
        }
        BlueBigInt pad;
        if (!pow10Checked(static_cast<int32_t>(padScale), pad)) {
            return false;
        }
        out.coefficient = value.coefficient * pad;
        out.scale = newScale;
        return true;
    }
    const int64_t k = static_cast<int64_t>(value.scale) - newScale;
    if (k > kDecimalPow10Limit) {
        return false;
    }
    const BlueBigInt divisor = pow10<BlueBigInt>(static_cast<int32_t>(k));
    BlueBigInt quotient = value.coefficient / divisor;
    const BlueBigInt remainder = value.coefficient - quotient * divisor;
    if (rounding == DecimalRounding::Floor) {
        // trunc rounded toward zero; floor steps one further for negative
        // dividends with a nonzero remainder
        if (!remainder.is_zero() && value.coefficient.sign() < 0) {
            quotient -= 1;
        }
    } else {
        BlueBigInt twiceRemainder = remainder < 0 ? (-remainder) * 2 : remainder * 2;
        if (twiceRemainder >= divisor) {
            quotient += (value.coefficient.sign() < 0) ? -1 : 1;
        }
    }
    out.coefficient = quotient;
    out.scale = newScale;
    return true;
}

bool javaBigDecimalRemainder(const JavaBigDecimal& dividend, const JavaBigDecimal& divisor,
                             JavaBigDecimal& out) {
    const int32_t scale = dividend.scale > divisor.scale ? dividend.scale : divisor.scale;
    const int64_t dividendPadScale = static_cast<int64_t>(scale) - dividend.scale;
    const int64_t divisorPadScale = static_cast<int64_t>(scale) - divisor.scale;
    BlueBigInt dividendPad;
    BlueBigInt divisorPad;
    if (dividendPadScale > kDecimalPow10Limit || divisorPadScale > kDecimalPow10Limit ||
        !pow10Checked(static_cast<int32_t>(dividendPadScale), dividendPad) ||
        !pow10Checked(static_cast<int32_t>(divisorPadScale), divisorPad)) {
        return false;
    }
    const BlueBigInt dividendCoefficient = dividend.coefficient * dividendPad;
    const BlueBigInt divisorCoefficient = divisor.coefficient * divisorPad;
    if (divisorCoefficient.is_zero()) {
        return false;
    }
    out.coefficient =
        dividendCoefficient - (dividendCoefficient / divisorCoefficient) * divisorCoefficient;
    out.scale = scale;
    return true;
}

bool javaBigDecimalSubtract(const JavaBigDecimal& minuend, const JavaBigDecimal& subtrahend,
                            JavaBigDecimal& out) {
    const int32_t scale = minuend.scale > subtrahend.scale ? minuend.scale : subtrahend.scale;
    const int64_t leftPadScale = static_cast<int64_t>(scale) - minuend.scale;
    const int64_t rightPadScale = static_cast<int64_t>(scale) - subtrahend.scale;
    BlueBigInt leftPad;
    BlueBigInt rightPad;
    if (leftPadScale > kDecimalPow10Limit || rightPadScale > kDecimalPow10Limit ||
        !pow10Checked(static_cast<int32_t>(leftPadScale), leftPad) ||
        !pow10Checked(static_cast<int32_t>(rightPadScale), rightPad)) {
        return false;
    }
    out.coefficient = minuend.coefficient * leftPad - subtrahend.coefficient * rightPad;
    out.scale = scale;
    return true;
}

JavaBigDecimal javaBigDecimalStripTrailingZeros(const JavaBigDecimal& value) {
    if (value.isZero()) {
        JavaBigDecimal out;
        out.coefficient = 0;
        out.scale = 0;
        return out;
    }
    BlueBigInt coefficient = value.coefficient;
    int32_t scale = value.scale;
    const BlueBigInt ten(10);
    while ((coefficient % ten).is_zero()) {
        coefficient /= ten;
        scale -= 1;
    }
    JavaBigDecimal out;
    out.coefficient = coefficient;
    out.scale = scale;
    return out;
}

}  // namespace blue
