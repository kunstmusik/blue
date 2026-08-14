#include "../../src/automation/AutomationManager.h"
#include "../../src/automation/FixedPoint.h"
#include <iostream>
#include <cassert>
#include <cmath>
#include <vector>

using namespace blue;

// Helper for floating-point comparison
static bool approxEqual(double a, double b, double epsilon = 1e-7) {
    return std::abs(a - b) < epsilon;
}

struct FixtureCase {
    const char* name;
    double value;
    double resolution;
    int resolutionScale;
    bool isDescending;
    double expectedHighPrecision;
    double expectedFast;
};

// All 20 differential test cases derived from Java Blue BigDecimal FLOOR quantization
static const FixtureCase kFixtures[] = {
    {"positive_scale1_res01_ascending", 0.12345, 0.1, 1, false, 0.1, 0.1},
    {"positive_scale1_res01_descending", 0.12345, 0.1, 1, true, 0.2, 0.2},
    {"positive_scale2_res001_ascending", 0.4567, 0.01, 2, false, 0.45, 0.45},
    {"positive_scale2_res001_descending", 0.4567, 0.01, 2, true, 0.46, 0.46},
    {"positive_scale2_res025_ascending", 0.74, 0.25, 2, false, 0.5, 0.5},
    {"positive_scale2_res025_descending", 0.74, 0.25, 2, true, 0.75, 0.75},
    {"negative_scale1_res01_ascending", -0.12345, 0.1, 1, false, -0.2, -0.2},
    {"negative_scale1_res01_descending", -0.12345, 0.1, 1, true, -0.1, -0.1},
    {"negative_scale2_res001_ascending", -0.4567, 0.01, 2, false, -0.46, -0.46},
    {"negative_scale2_res001_descending", -0.4567, 0.01, 2, true, -0.45, -0.45},
    {"boundary_exact_step_ascending", 0.5, 0.1, 1, false, 0.5, 0.5},
    {"boundary_exact_step_descending", 0.5, 0.1, 1, true, 0.5, 0.5},
    {"boundary_just_below_ascending", 0.4999999, 0.1, 1, false, 0.4, 0.4},
    {"boundary_just_below_descending", 0.4999999, 0.1, 1, true, 0.5, 0.5},
    {"zero_ascending", 0.0, 0.1, 1, false, 0.0, 0.0},
    {"zero_descending", 0.0, 0.1, 1, true, 0.0, 0.0},
    {"integer_scale0_res1_ascending", 4.8, 1.0, 0, false, 4.0, 4.0},
    {"integer_scale0_res1_descending", 4.8, 1.0, 0, true, 5.0, 5.0},
    {"integer_scale0_res5_ascending", 13.2, 5.0, 0, false, 10.0, 10.0},
    {"integer_scale0_res5_descending", 13.2, 5.0, 0, true, 15.0, 15.0},
};

void testDifferentialQuantizationFixtures() {
    std::cout << "Testing differential quantization against Java Blue fixtures..." << std::endl;

    for (const auto& tc : kFixtures) {
        double highResult = AutomationManager::quantizeHighPrecision(
            tc.value, tc.resolution, tc.resolutionScale, tc.isDescending);

        if (!approxEqual(highResult, tc.expectedHighPrecision)) {
            std::cerr << "FAILED HighPrecision on " << tc.name
                      << ": got " << highResult << ", expected " << tc.expectedHighPrecision << std::endl;
            assert(false);
        }

        double fastResult = AutomationManager::quantizeFast(
            tc.value, tc.resolution, tc.isDescending);

        if (!approxEqual(fastResult, tc.expectedFast)) {
            std::cerr << "FAILED Fast on " << tc.name
                      << ": got " << fastResult << ", expected " << tc.expectedFast << std::endl;
            assert(false);
        }
    }

    std::cout << "All 20 differential quantization fixtures passed!" << std::endl;
}

void testFixedPointOperations() {
    std::cout << "Testing FixedPoint operations..." << std::endl;

    FixedPoint a = FixedPoint::fromString("12.34");
    FixedPoint b = FixedPoint::fromString("5.6");
    assert(a.scale() == 2);
    assert(b.scale() == 1);

    FixedPoint sum = a.add(b);
    assert(approxEqual(sum.toDouble(), 17.94));

    FixedPoint diff = a.subtract(b);
    assert(approxEqual(diff.toDouble(), 6.74));

    FixedPoint rem = a.remainder(b);
    assert(approxEqual(rem.toDouble(), 1.14));

    std::cout << "FixedPoint operations passed!" << std::endl;
}

int main() {
    testDifferentialQuantizationFixtures();
    testFixedPointOperations();
    std::cout << "All QuantizationTests passed successfully!" << std::endl;
    return 0;
}