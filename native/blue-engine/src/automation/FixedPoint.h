#pragma once

#include <cstdint>
#include <cmath>
#include <stdexcept>
#include <string>

namespace blue {

// Rounding modes matching Java's RoundingMode
enum class RoundingMode {
    FLOOR,      // Round towards negative infinity
    CEILING,    // Round towards positive infinity
    DOWN,       // Round towards zero
    UP,         // Round away from zero
    HALF_UP,    // Round towards nearest neighbor, ties go up
    HALF_DOWN,  // Round towards nearest neighbor, ties go down
    HALF_EVEN   // Round towards nearest neighbor, ties go to even (banker's rounding)
};

// Fixed-point decimal class to match Java BigDecimal behavior
// Uses integer arithmetic scaled by a power of 10
class FixedPoint {
public:
    // Constructors
    FixedPoint() : value_(0), scale_(0) {}
    FixedPoint(int64_t value, int scale) : value_(value), scale_(scale) {
        normalize();
    }

    // Construct from double with specified scale
    static FixedPoint fromDouble(double value, int scale) {
        double scaleFactor = std::pow(10.0, scale);
        int64_t scaledValue = static_cast<int64_t>(std::round(value * scaleFactor));
        return FixedPoint(scaledValue, scale);
    }

    // Construct from double using FLOOR semantics (matches new BigDecimal(y).setScale(scale, FLOOR))
    // This avoids the intermediate rounding used by fromDouble and preserves the downward bias.
    static FixedPoint fromDoubleFloor(double value, int scale) {
        double scaleFactor = std::pow(10.0, scale);
        double scaled = std::floor(value * scaleFactor);
        return FixedPoint(static_cast<int64_t>(scaled), scale);
    }

    // Construct from string representation (like BigDecimal)
    static FixedPoint fromString(const std::string& str) {
        size_t decimalPos = str.find('.');
        if (decimalPos == std::string::npos) {
            return FixedPoint(std::stoll(str), 0);
        }

        int integerPart = std::stoi(str.substr(0, decimalPos));
        std::string fractionalStr = str.substr(decimalPos + 1);
        int fractionalPart = std::stoi(fractionalStr);
        int scale = static_cast<int>(fractionalStr.length());

        int64_t value = integerPart;
        value = value * static_cast<int64_t>(std::pow(10, scale)) + fractionalPart;

        return FixedPoint(value, scale);
    }

    // Get the value as double
    double toDouble() const {
        return static_cast<double>(value_) / std::pow(10.0, scale_);
    }

    // Get the scale (number of decimal places)
    int scale() const { return scale_; }

    // Get the unscaled value
    int64_t unscaledValue() const { return value_; }

    // Arithmetic operations
    FixedPoint add(const FixedPoint& other) const {
        int maxScale = std::max(scale_, other.scale_);
        int64_t thisScaled = scaleTo(value_, scale_, maxScale);
        int64_t otherScaled = scaleTo(other.value_, other.scale_, maxScale);
        return FixedPoint(thisScaled + otherScaled, maxScale);
    }

    FixedPoint subtract(const FixedPoint& other) const {
        int maxScale = std::max(scale_, other.scale_);
        int64_t thisScaled = scaleTo(value_, scale_, maxScale);
        int64_t otherScaled = scaleTo(other.value_, other.scale_, maxScale);
        return FixedPoint(thisScaled - otherScaled, maxScale);
    }

    FixedPoint multiply(const FixedPoint& other) const {
        int64_t product = value_ * other.value_;
        int newScale = scale_ + other.scale_;
        return FixedPoint(product, newScale);
    }

    // Remainder operation (like BigDecimal.remainder)
    FixedPoint remainder(const FixedPoint& divisor) const {
        if (divisor.value_ == 0) {
            throw std::runtime_error("Division by zero");
        }

        // Scale both to the same precision
        int maxScale = std::max(scale_, divisor.scale_);
        int64_t thisScaled = scaleTo(value_, scale_, maxScale);
        int64_t divisorScaled = scaleTo(divisor.value_, divisor.scale_, maxScale);

        // Calculate remainder
        int64_t remainder = thisScaled % divisorScaled;
        return FixedPoint(remainder, maxScale);
    }

    // Set scale with rounding mode (like BigDecimal.setScale)
    // This is the key method for Java BigDecimal compatibility
    FixedPoint setScale(int newScale, RoundingMode mode) const {
        if (newScale == scale_) {
            return *this;
        }

        if (newScale > scale_) {
            // Scale up - no rounding needed, just multiply
            int64_t factor = static_cast<int64_t>(std::pow(10, newScale - scale_));
            return FixedPoint(value_ * factor, newScale);
        }

        // Scale down - need to apply rounding
        int64_t factor = static_cast<int64_t>(std::pow(10, scale_ - newScale));
        int64_t quotient = value_ / factor;
        int64_t remainder = value_ % factor;

        // Apply rounding based on mode
        switch (mode) {
            case RoundingMode::FLOOR:
                // Round towards negative infinity
                if (remainder != 0 && value_ < 0) {
                    quotient -= 1;
                }
                break;

            case RoundingMode::CEILING:
                // Round towards positive infinity
                if (remainder != 0 && value_ > 0) {
                    quotient += 1;
                }
                break;

            case RoundingMode::DOWN:
                // Round towards zero (truncate) - default integer division behavior
                break;

            case RoundingMode::UP:
                // Round away from zero
                if (remainder != 0) {
                    quotient += (value_ > 0) ? 1 : -1;
                }
                break;

            case RoundingMode::HALF_UP: {
                // Round towards nearest, ties go up (away from zero for positive)
                int64_t halfFactor = factor / 2;
                if (std::abs(remainder) >= halfFactor) {
                    quotient += (value_ > 0) ? 1 : -1;
                }
                break;
            }

            case RoundingMode::HALF_DOWN: {
                // Round towards nearest, ties go down (towards zero)
                int64_t halfFactor = factor / 2;
                if (std::abs(remainder) > halfFactor) {
                    quotient += (value_ > 0) ? 1 : -1;
                }
                break;
            }

            case RoundingMode::HALF_EVEN: {
                // Banker's rounding - ties go to nearest even
                int64_t halfFactor = factor / 2;
                if (std::abs(remainder) > halfFactor) {
                    quotient += (value_ > 0) ? 1 : -1;
                } else if (std::abs(remainder) == halfFactor) {
                    // Tie - round to even
                    if (quotient % 2 != 0) {
                        quotient += (value_ > 0) ? 1 : -1;
                    }
                }
                break;
            }
        }

        return FixedPoint(quotient, newScale);
    }

    // Comparison operators
    bool operator==(const FixedPoint& other) const {
        int maxScale = std::max(scale_, other.scale_);
        return scaleTo(value_, scale_, maxScale) == scaleTo(other.value_, other.scale_, maxScale);
    }

    bool operator!=(const FixedPoint& other) const {
        return !(*this == other);
    }

    bool operator<(const FixedPoint& other) const {
        int maxScale = std::max(scale_, other.scale_);
        return scaleTo(value_, scale_, maxScale) < scaleTo(other.value_, other.scale_, maxScale);
    }

    bool operator<=(const FixedPoint& other) const {
        return *this < other || *this == other;
    }

    bool operator>(const FixedPoint& other) const {
        return !(*this <= other);
    }

    bool operator>=(const FixedPoint& other) const {
        return !(*this < other);
    }

    // String representation
    std::string toString() const {
        if (scale_ <= 0) {
            return std::to_string(value_);
        }

        std::string str = std::to_string(value_);
        if (str.length() <= scale_) {
            // Pad with leading zeros
            str = std::string(scale_ - str.length() + 1, '0') + str;
        }

        size_t insertPos = str.length() - scale_;
        return str.substr(0, insertPos) + "." + str.substr(insertPos);
    }

private:
    int64_t value_;  // Unscaled value
    int scale_;      // Number of decimal places

    // Normalize by removing trailing zeros
    void normalize() {
        if (scale_ <= 0 || value_ == 0) return;

        int64_t temp = value_;
        int trailingZeros = 0;

        while (temp % 10 == 0 && trailingZeros < scale_) {
            temp /= 10;
            trailingZeros++;
        }

        if (trailingZeros > 0) {
            value_ = temp;
            scale_ -= trailingZeros;
        }
    }

    // Scale a value to a target scale
    static int64_t scaleTo(int64_t value, int currentScale, int targetScale) {
        if (currentScale == targetScale) {
            return value;
        } else if (currentScale < targetScale) {
            // Scale up
            int64_t factor = static_cast<int64_t>(std::pow(10, targetScale - currentScale));
            return value * factor;
        } else {
            // Scale down
            int64_t factor = static_cast<int64_t>(std::pow(10, currentScale - targetScale));
            return value / factor;
        }
    }
};

}  // namespace blue