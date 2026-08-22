#include "ExactDecimalQuantizer.h"

#include <algorithm>
#include <cmath>

namespace blue {

std::atomic<uint64_t>& decimalUpstreamAllocationCount() {
    static std::atomic<uint64_t> counter{0};
    return counter;
}

namespace {
thread_local DecimalArena* t_activeArena = nullptr;
}  // namespace

DecimalArena* activeDecimalArena() noexcept {
    return t_activeArena;
}

void setActiveDecimalArena(DecimalArena* arena) noexcept {
    t_activeArena = arena;
}

void DecimalArena::initialize(std::size_t capacityBytes) {
    backing_.assign(capacityBytes, std::byte{0});
    cursor_ = 0;
    highWater_ = 0;
    overflowCount_ = 0;
}

void DecimalArena::reset() const noexcept {
    cursor_ = 0;
}

void* DecimalArena::tryAllocate(std::size_t bytes) const noexcept {
    // keep every object aligned for fundamental types
    constexpr std::size_t kAlignment = alignof(std::max_align_t);
    const std::size_t aligned = (cursor_ + kAlignment - 1) & ~(kAlignment - 1);
    if (aligned + bytes > backing_.size()) {
        overflowCount_ += 1;
        return nullptr;
    }
    cursor_ = aligned + bytes;
    highWater_ = std::max(highWater_, cursor_);
    // the bump arena hands out mutable storage over a logically-const buffer
    return const_cast<std::byte*>(backing_.data()) + aligned;
}

bool DecimalArena::contains(const void* pointer) const noexcept {
    const auto* bytePointer = static_cast<const std::byte*>(pointer);
    return bytePointer >= backing_.data() && bytePointer < backing_.data() + backing_.size();
}

namespace {

// A binary64 exact expansion needs at most 751 significand digits plus 52
// integer digits (~1077 decimal digits worst case). cpp_int stores limbs of
// 64 bits; 1077 digits is ~3.6 kbit (~460 bytes). Add generous slack for
// intermediate products, division temporaries, and boost internals.
constexpr std::size_t kWorstCaseDoubleDigits = 1100;

std::size_t bytesForDigits(std::size_t digits) {
    // 4 bits per decimal digit, 8 bits per byte, plus limb headers
    return (digits / 2) + 64;
}

}  // namespace

std::unique_ptr<ExactDecimalQuantizer> ExactDecimalQuantizer::prepare(
    const JavaBigDecimal& resolution, std::string* error) {
    if (std::abs(static_cast<long long>(resolution.scale)) > kDecimalPow10Limit) {
        if (error) *error = "decimal workspace is unavailable for the requested scale";
        return nullptr;
    }

    auto quantizer = std::make_unique<ExactDecimalQuantizer>();
    quantizer->resolution_ = resolution;
    quantizer->canonicalText_ = resolution.canonicalText();
    quantizer->scale_ = resolution.scale;
    quantizer->resolutionDouble_ = resolution.doubleValue();
    quantizer->coefficientAbs_ =
        resolution.coefficient.sign() < 0 ? -resolution.coefficient : resolution.coefficient;
    // precomputed decimal text avoids any string formatting during evaluation
    quantizer->coefficientAbsText_ = quantizer->coefficientAbs_.str();
    quantizer->pow10Abs_ = 1;
    if (resolution.scale != 0) {
        decimal_detail::pow10Checked(std::abs(resolution.scale), quantizer->pow10Abs_);
    }

    // worst-case working set: exact double expansion, the resolution
    // coefficient, their products/quotients, and division temporaries
    const std::size_t resolutionDigits = quantizer->coefficientAbsText_.size();
    const std::size_t pow10Digits = quantizer->pow10Abs_.str().size();
    const std::size_t maxDigits =
        std::max({kWorstCaseDoubleDigits, resolutionDigits + pow10Digits + 8, pow10Digits + 16});
    const std::size_t bytesPerNumber = bytesForDigits(maxDigits);
    constexpr std::size_t kWorkingSetNumbers = 48;
    const std::size_t arenaBytes = bytesPerNumber * kWorkingSetNumbers + 8192;
    quantizer->arena_.initialize(arenaBytes);
    return quantizer;
}

bool ExactDecimalQuantizer::quantize(double y, double* out) const noexcept {
    evaluationCount_ += 1;
    if (std::isnan(y) || std::isinf(y)) {
        invalidInputCount_ += 1;
        return false;
    }

    arena_.reset();
    setActiveDecimalArena(&arena_);

    bool ok = false;
    double result = 0.0;
    do {
        using decimal_detail::doubleToBitsHost;

        const uint64_t bits = doubleToBitsHost(y);
        const bool negative = ((bits >> 63) & 1u) != 0;
        const uint32_t exponentBits = static_cast<uint32_t>((bits >> 52) & 0x7ffu);
        const uint64_t mantissa = bits & 0xfffffffffffffull;

        ArenaInt magnitude;
        int32_t binaryExponent = 0;
        if (exponentBits == 0 && mantissa == 0) {
            magnitude = 0;
        } else if (exponentBits == 0) {
            magnitude = ArenaInt(mantissa);
            binaryExponent = -1074;
        } else {
            magnitude = ArenaInt(mantissa) | (ArenaInt(1u) << 52);
            binaryExponent = static_cast<int32_t>(exponentBits) - 1075;
        }

        if (magnitude.is_zero()) {
            // BigDecimal(±0.0) is zero: floor/remainder/subtract all yield 0
            result = 0.0;
            ok = true;
            break;
        }

        // v at resolution scale: floor(m * 10^scale / 2^k) with k = -e2,
        // computed as one exact fraction so floor semantics are preserved.
        // Work in magnitude domain; floor of a negative value equals the
        // negation of ceil of its magnitude.
        ArenaInt numerator = magnitude;
        ArenaInt denominator(1);
        if (binaryExponent >= 0) {
            numerator <<= static_cast<unsigned>(binaryExponent);
        } else {
            denominator <<= static_cast<unsigned>(-binaryExponent);
        }
        if (scale_ > 0) {
            ArenaInt powerOfTen;
            if (!decimal_detail::pow10Checked(scale_, powerOfTen)) break;
            numerator *= powerOfTen;
        } else if (scale_ < 0) {
            ArenaInt powerOfTen;
            if (!decimal_detail::pow10Checked(-scale_, powerOfTen)) break;
            denominator *= powerOfTen;
        }

        ArenaInt quotient = numerator / denominator;
        const bool inexact = (numerator - quotient * denominator).sign() != 0;

        ArenaInt valueCoefficient = quotient;
        if (negative && inexact) {
            // floor(-x) = -ceil(x): step the magnitude up when inexact
            valueCoefficient = -(quotient + 1);
        } else if (negative) {
            valueCoefficient = -quotient;
        }

        // v - v.remainder(resolution): the signed remainder keeps the dividend
        // sign, so the magnitude-domain computation with a final negation is
        // exact: -(|v| - |v| mod C) = v - v.remainder(C)
        const bool coefficientNegative = valueCoefficient.sign() < 0;
        ArenaInt coefficientMagnitude =
            coefficientNegative ? -valueCoefficient : valueCoefficient;
        const ArenaInt resolutionCoefficient(coefficientAbsText_.c_str());
        const ArenaInt quotientMultiple = coefficientMagnitude / resolutionCoefficient;
        const ArenaInt remainder =
            coefficientMagnitude - quotientMultiple * resolutionCoefficient;
        coefficientMagnitude -= remainder;
        const ArenaInt resultCoefficient =
            coefficientNegative ? -coefficientMagnitude : coefficientMagnitude;

        result = decimalToBinary64(resultCoefficient, scale_);
        ok = true;
    } while (false);

    setActiveDecimalArena(nullptr);
    if (!ok) {
        invalidInputCount_ += 1;
        return false;
    }
    *out = result;
    return true;
}

}  // namespace blue
