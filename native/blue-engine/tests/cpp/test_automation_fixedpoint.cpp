#include "../../src/automation/FixedPoint.h"
#include <iostream>
#include <cassert>
#include <cmath>

using namespace blue;

// Helper for floating-point comparison
bool approxEqual(double a, double b, double epsilon = 1e-9) {
    return std::abs(a - b) < epsilon;
}

// Test the quantization logic that would be used in AutomationManager
double quantizeFast(double y, double resolution, bool isDescending) {
    if (resolution <= 0.0) return y;

    if (isDescending) {
        y += resolution * 0.99;
    }
    double steps = std::floor(y / resolution);
    return steps * resolution;
}

double quantizeHighPrecision(double y, double resolution, int resolutionScale, bool isDescending) {
    if (resolution <= 0.0) return y;

    if (isDescending) {
        y += resolution * 0.99;
    }
    // Mirror Java BigDecimal: new BigDecimal(y).setScale(resolution.scale(), FLOOR)
    FixedPoint yFixed = FixedPoint::fromDoubleFloor(y, resolutionScale);
    FixedPoint resFixed = FixedPoint::fromDoubleFloor(resolution, resolutionScale);
    FixedPoint remainder = yFixed.remainder(resFixed);
    FixedPoint quantized = yFixed.subtract(remainder);
    return quantized.toDouble();
}

void testFastQuantization() {
    std::cout << "Testing fast quantization..." << std::endl;

    // Test 1: Exact value (no remainder)
    double result = quantizeFast(0.5, 0.1, false);
    std::cout << "0.5 quantized to 0.1: " << result << std::endl;
    assert(approxEqual(result, 0.5));

    // Test 2: Value with remainder
    result = quantizeFast(0.57, 0.1, false);
    std::cout << "0.57 quantized to 0.1: " << result << std::endl;
    assert(approxEqual(result, 0.5));

    // Test 3: Descending segment with bias
    result = quantizeFast(0.5, 0.2, true);
    std::cout << "0.5 descending quantized to 0.2: " << result << std::endl;
    assert(approxEqual(result, 0.6));

    std::cout << "Fast quantization tests passed!" << std::endl;
}

void testHighPrecisionQuantization() {
    std::cout << "\nTesting high-precision quantization..." << std::endl;

    // Test 1: Exact value (no remainder)
    double result = quantizeHighPrecision(0.5, 0.1, 1, false);
    std::cout << "0.5 quantized to 0.1: " << result << std::endl;
    assert(approxEqual(result, 0.5));

    // Test 2: Value with remainder
    result = quantizeHighPrecision(0.57, 0.1, 1, false);
    std::cout << "0.57 quantized to 0.1: " << result << std::endl;
    assert(approxEqual(result, 0.5));

    // Test 3: Descending segment with bias
    result = quantizeHighPrecision(0.5, 0.2, 1, true);
    std::cout << "0.5 descending quantized to 0.2: " << result << std::endl;
    assert(approxEqual(result, 0.6));

    // Test 4: Fine resolution
    result = quantizeHighPrecision(0.123456, 0.01, 2, false);
    std::cout << "0.123456 quantized to 0.01: " << result << std::endl;
    assert(approxEqual(result, 0.12));

    std::cout << "High-precision quantization tests passed!" << std::endl;
}

void testQuantizationConsistency() {
    std::cout << "\nTesting quantization consistency between fast and high-precision..." << std::endl;

    // Both methods should produce the same results for simple cases
    double testValues[] = {0.0, 0.1, 0.25, 0.5, 0.75, 0.99, 1.0};
    double resolution = 0.1;

    for (double val : testValues) {
        double fast = quantizeFast(val, resolution, false);
        double precise = quantizeHighPrecision(val, resolution, 1, false);
        std::cout << "Value " << val << ": fast=" << fast << ", precise=" << precise << std::endl;
        assert(std::abs(fast - precise) < 1e-9);
    }

    std::cout << "Quantization consistency tests passed!" << std::endl;
}

int main() {
    testFastQuantization();
    testHighPrecisionQuantization();
    testQuantizationConsistency();
    std::cout << "\nAll automation quantization tests passed!" << std::endl;
    return 0;
}