#include "../../src/automation/FixedPoint.h"
#include <iostream>
#include <cassert>

void testFixedPoint() {
    using namespace blue;

    // Test basic construction
    FixedPoint fp1 = FixedPoint::fromDouble(0.123, 3);
    assert(fp1.toDouble() == 0.123);
    assert(fp1.scale() == 3);

    // Test string construction
    FixedPoint fp2 = FixedPoint::fromString("0.123");
    assert(fp2.toDouble() == 0.123);
    assert(fp2.scale() == 3);

    // Test arithmetic operations
    FixedPoint fp3 = FixedPoint::fromDouble(0.1, 1);
    FixedPoint fp4 = FixedPoint::fromDouble(0.2, 1);
    FixedPoint sum = fp3.add(fp4);
    assert(sum.toDouble() == 0.3);

    // Test remainder operation (key for quantization)
    FixedPoint fp5 = FixedPoint::fromDouble(0.75, 2);
    FixedPoint fp6 = FixedPoint::fromDouble(0.25, 2);
    FixedPoint remainder = fp5.remainder(fp6);
    assert(remainder.toDouble() == 0.0); // 0.75 % 0.25 = 0

    // Test quantization behavior
    FixedPoint value = FixedPoint::fromDouble(0.75, 2);
    FixedPoint resolution = FixedPoint::fromDouble(0.25, 2);
    FixedPoint quantized = value.subtract(value.remainder(resolution));
    assert(quantized.toDouble() == 0.75); // Should snap to 0.75

    // Test descending segment bias (like Java implementation)
    FixedPoint descendingValue = FixedPoint::fromDouble(0.74, 2);
    FixedPoint biasedValue = FixedPoint::fromDouble(descendingValue.toDouble() + 0.25 * 0.99, 2);
    FixedPoint biasedQuantized = biasedValue.subtract(biasedValue.remainder(resolution));
    assert(biasedQuantized.toDouble() == 0.75); // Should snap to 0.75 with bias

    std::cout << "All FixedPoint tests passed!" << std::endl;
}

void testSetScale() {
    using namespace blue;

    std::cout << "Testing setScale..." << std::endl;

    // Test scaling up (no rounding needed)
    // Note: FixedPoint normalizes by removing trailing zeros, so scale may differ
    FixedPoint fp1 = FixedPoint::fromDouble(1.5, 1);  // 15 with scale 1
    FixedPoint scaled1 = fp1.setScale(3, RoundingMode::FLOOR);
    assert(scaled1.toDouble() == 1.5);  // Value should be preserved
    // Scale may be normalized, so we just verify the value is correct

    // Test FLOOR rounding (positive values)
    FixedPoint fp2 = FixedPoint::fromDouble(1.567, 3);  // 1567 with scale 3
    FixedPoint scaled2 = fp2.setScale(1, RoundingMode::FLOOR);
    assert(scaled2.toDouble() == 1.5);  // Floor of 1.567 at scale 1 is 1.5

    // Test FLOOR rounding (negative values - should round towards negative infinity)
    FixedPoint fp3 = FixedPoint::fromDouble(-1.567, 3);
    FixedPoint scaled3 = fp3.setScale(1, RoundingMode::FLOOR);
    assert(scaled3.toDouble() == -1.6);  // Floor of -1.567 at scale 1 is -1.6

    // Test CEILING rounding (positive values)
    FixedPoint fp4 = FixedPoint::fromDouble(1.567, 3);
    FixedPoint scaled4 = fp4.setScale(1, RoundingMode::CEILING);
    assert(scaled4.toDouble() == 1.6);  // Ceiling of 1.567 at scale 1 is 1.6

    // Test DOWN rounding (truncation towards zero)
    FixedPoint fp5 = FixedPoint::fromDouble(-1.567, 3);
    FixedPoint scaled5 = fp5.setScale(1, RoundingMode::DOWN);
    assert(scaled5.toDouble() == -1.5);  // Truncate towards zero

    // Test HALF_UP rounding
    FixedPoint fp6 = FixedPoint::fromDouble(1.55, 2);
    FixedPoint scaled6 = fp6.setScale(1, RoundingMode::HALF_UP);
    assert(scaled6.toDouble() == 1.6);  // 1.55 rounds up to 1.6

    FixedPoint fp7 = FixedPoint::fromDouble(1.54, 2);
    FixedPoint scaled7 = fp7.setScale(1, RoundingMode::HALF_UP);
    assert(scaled7.toDouble() == 1.5);  // 1.54 rounds down to 1.5

    // Test same scale (no-op)
    FixedPoint fp8 = FixedPoint::fromDouble(1.5, 1);
    FixedPoint scaled8 = fp8.setScale(1, RoundingMode::FLOOR);
    assert(scaled8.toDouble() == 1.5);
    assert(scaled8.scale() == 1);

    // Test Java-compatible quantization pattern:
    // BigDecimal v = new BigDecimal(y).setScale(resolution.scale(), RoundingMode.FLOOR);
    // v = v.subtract(v.remainder(resolution));
    double y = 0.567;
    int resolutionScale = 1;
    double resolution = 0.1;

    // Mirror Java path directly with floor-scale construction
    FixedPoint yFixed = FixedPoint::fromDoubleFloor(y, resolutionScale);
    FixedPoint resFixed = FixedPoint::fromDoubleFloor(resolution, resolutionScale);
    FixedPoint rem = yFixed.remainder(resFixed);
    FixedPoint quantized = yFixed.subtract(rem);
    assert(std::abs(quantized.toDouble() - 0.5) < 1e-9);  // 0.567 floors to 0.5 at scale 1, then quantizes to 0.5

    std::cout << "All setScale tests passed!" << std::endl;
}

int main() {
    testFixedPoint();
    testSetScale();
    return 0;
}