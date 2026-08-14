// Exact-decimal native tests: Java grammar parsing, canonical text, binary64
// construction/conversion, rounding operations, and the realtime allocation
// contract of the arena-backed ExactDecimalQuantizer.
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <new>

#include "../../src/automation/ExactDecimalQuantizer.h"
#include "../../src/automation/JavaBigDecimal.h"

#include <cmath>
#include <string>
#include <vector>

// ---------------------------------------------------------------------------
// Global allocation counter: proves quantize() performs zero system
// allocations. Replacing global new/delete in this test binary is the
// hard-fail upstream allocator required by the exact-decimal contract.
// ---------------------------------------------------------------------------
namespace {
unsigned long long g_allocations = 0;
bool g_countingAllocations = false;
}  // namespace

void* operator new(std::size_t size) {
    if (g_countingAllocations) g_allocations += 1;
    void* pointer = std::malloc(size == 0 ? 1 : size);
    if (!pointer) throw std::bad_alloc();
    return pointer;
}

void* operator new[](std::size_t size) { return operator new(size); }

void operator delete(void* pointer) noexcept { std::free(pointer); }

void operator delete[](void* pointer) noexcept { std::free(pointer); }

void operator delete(void* pointer, std::size_t) noexcept { std::free(pointer); }

void operator delete[](void* pointer, std::size_t) noexcept { std::free(pointer); }

namespace {

int g_failures = 0;

void expect(bool condition, const std::string& what) {
    if (!condition) {
        std::printf("FAIL: %s\n", what.c_str());
        g_failures += 1;
    }
}

void expectText(const std::string& actual, const std::string& expected, const std::string& what) {
    if (actual != expected) {
        std::printf("FAIL: %s\n  expected: %s\n  actual:   %s\n", what.c_str(), expected.c_str(),
                    actual.c_str());
        g_failures += 1;
    }
}

void expectDouble(double actual, double expected, const std::string& what) {
    if (std::isnan(expected)) {
        expect(std::isnan(actual), what + " (expected NaN)");
        return;
    }
    unsigned long long a, b;
    std::memcpy(&a, &actual, 8);
    std::memcpy(&b, &expected, 8);
    if (a != b) {
        std::printf("FAIL: %s\n  expected bits: %016llx\n  actual bits:   %016llx\n", what.c_str(),
                    b, a);
        g_failures += 1;
    }
}

blue::JavaBigDecimal parseOk(const std::string& text) {
    blue::JavaBigDecimal value;
    if (blue::parseJavaBigDecimal(text, value) != blue::DecimalParseError::Ok) {
        std::printf("FAIL: parse unexpectedly failed for %s\n", text.c_str());
        g_failures += 1;
    }
    return value;
}

void testParsing() {
    struct Row {
        const char* text;
        const char* coefficient;
        int scale;
        const char* canonical;
    };
    const Row rows[] = {
        {"0.1", "1", 1, "0.1"},
        {"0.10", "10", 2, "0.10"},
        {"1e-7", "1", 7, "1E-7"},
        {"1E+3", "1", -3, "1E+3"},
        {"0.00", "0", 2, "0.00"},
        {".5", "5", 1, "0.5"},
        {"5.", "5", 0, "5"},
        {"5.e3", "5", -3, "5E+3"},
        {"+.5", "5", 1, "0.5"},
        {"-0.0", "0", 1, "0.0"},
        {"-0", "0", 0, "0"},
        {"007", "7", 0, "7"},
        {"0.000005678", "5678", 9, "0.000005678"},
        {"0.0000005678", "5678", 10, "5.678E-7"},
        {"0e+5", "0", -5, "0E+5"},
        {"1E-2147483647", "1", 2147483647, "1E-2147483647"},
        {"12345.6789", "123456789", 4, "12345.6789"},
    };
    for (const auto& row : rows) {
        blue::JavaBigDecimal value;
        expect(blue::parseJavaBigDecimal(row.text, value) == blue::DecimalParseError::Ok,
               std::string("parse accepts ") + row.text);
        if (blue::parseJavaBigDecimal(row.text, value) == blue::DecimalParseError::Ok) {
            expectText(value.coefficient.str(), row.coefficient,
                       std::string("coefficient of ") + row.text);
            expect(value.scale == row.scale, std::string("scale of ") + row.text);
            expectText(value.canonicalText(), row.canonical,
                       std::string("canonical text of ") + row.text);
        }
    }
    const char* invalid[] = {"abc", "1.2.3", "", " 0.1", "0.1 ", "+", ".", "e5",
                             "0x10", "1_000", "NaN", "Infinity", "1e", "1e+", "--1"};
    for (const char* text : invalid) {
        blue::JavaBigDecimal value;
        expect(blue::parseJavaBigDecimal(text, value) == blue::DecimalParseError::InvalidSyntax,
               std::string("parse rejects ") + text);
    }
    const char* overflow[] = {"1E-2147483648", "1E+2147483649",
                              "0.00000000000000000000000000000001e-2147483647"};
    for (const char* text : overflow) {
        blue::JavaBigDecimal value;
        expect(blue::parseJavaBigDecimal(text, value) == blue::DecimalParseError::ScaleOverflow,
               std::string("scale overflow for ") + text);
    }
}

void testFromBinary64() {
    blue::JavaBigDecimal value;
    expect(blue::javaBigDecimalFromBinary64(0.1, value), "fromBinary64 accepts 0.1");
    expectText(value.canonicalText(),
               "0.1000000000000000055511151231257827021181583404541015625",
               "exact 0.1 expansion");

    expect(blue::javaBigDecimalFromBinary64(-0.0, value), "fromBinary64 accepts -0.0");
    expect(value.isZero() && value.scale == 0, "-0.0 becomes unsigned zero");

    expect(blue::javaBigDecimalFromBinary64(4.9e-324, value), "fromBinary64 accepts subnormal");
    expect(value.scale > 1000, "subnormal keeps a large scale");

    expect(!blue::javaBigDecimalFromBinary64(std::nan(""), value), "fromBinary64 rejects NaN");
    expect(!blue::javaBigDecimalFromBinary64(INFINITY, value),
           "fromBinary64 rejects infinity");
}

void testToBinary64() {
    expectDouble(parseOk("0.1").doubleValue(), 0.1, "doubleValue(0.1)");
    expectDouble(parseOk("1E+3").doubleValue(), 1000.0, "doubleValue(1E+3)");
    expectDouble(parseOk("1E-400").doubleValue(), 0.0, "doubleValue(1E-400)");
    expectDouble(parseOk("-1E-400").doubleValue(), -0.0, "doubleValue(-1E-400) keeps sign");
    expectDouble(parseOk("1E309").doubleValue(), INFINITY, "doubleValue(1E309)");
    expectDouble(parseOk("-1E309").doubleValue(), -INFINITY, "doubleValue(-1E309)");
    expectDouble(parseOk("9007199254740993").doubleValue(), 9007199254740992.0,
                 "tie rounds to even (down)");
    expectDouble(parseOk("9007199254740995").doubleValue(), 9007199254740996.0,
                 "tie rounds to even (up)");
}

void testRoundingOperations() {
    blue::JavaBigDecimal out;

    expect(blue::javaBigDecimalSetScale(parseOk("-0.46"), 1, blue::DecimalRounding::Floor, out),
           "setScale floor ok");
    expectText(out.canonicalText(), "-0.5", "floor(-0.46, scale 1)");
    expect(blue::javaBigDecimalSetScale(parseOk("0.46"), 1, blue::DecimalRounding::Floor, out),
           "setScale floor ok");
    expectText(out.canonicalText(), "0.4", "floor(0.46, scale 1)");
    expect(blue::javaBigDecimalSetScale(parseOk("2.675"), 5, blue::DecimalRounding::HalfUp, out),
           "setScale half-up ok");
    expectText(out.canonicalText(), "2.67500", "halfUp(2.675, scale 5)");

    blue::JavaBigDecimal v;
    expect(blue::javaBigDecimalSetScale(parseOk("0.549"), 1, blue::DecimalRounding::Floor, v),
           "0.549 floor");
    expectText(v.canonicalText(), "0.5", "floor(0.549, scale 1)");
    blue::JavaBigDecimal r;
    expect(blue::javaBigDecimalRemainder(v, parseOk("0.1"), r), "remainder ok");
    expectText(r.canonicalText(), "0.0", "0.5 remainder 0.1");
    expect(r.scale == 1, "remainder keeps dividend scale");
    blue::JavaBigDecimal q;
    expect(blue::javaBigDecimalSubtract(v, r, q), "subtract ok");
    expectText(q.canonicalText(), "0.5", "0.5 - 0.0");
    expectDouble(q.doubleValue(), 0.5, "quantized 0.5");

    expectText(blue::javaBigDecimalStripTrailingZeros(parseOk("2.67500")).canonicalText(), "2.675",
               "strip(2.67500)");
    expectText(blue::javaBigDecimalStripTrailingZeros(parseOk("0.00000")).canonicalText(), "0",
               "strip(0.00000)");
    expectText(blue::javaBigDecimalStripTrailingZeros(parseOk("100")).canonicalText(), "1E+2",
               "strip(100)");
}

std::string localBits(double value) {
    unsigned long long bits;
    std::memcpy(&bits, &value, 8);
    char buffer[17];
    std::snprintf(buffer, sizeof(buffer), "%016llx", bits);
    return buffer;
}

std::string quantizeWithNewQuantizer(const std::string& resolutionText, double y, bool* ok) {
    blue::JavaBigDecimal resolution = parseOk(resolutionText);
    auto quantizer = blue::ExactDecimalQuantizer::prepare(resolution, nullptr);
    if (!quantizer) {
        *ok = false;
        return {};
    }
    double out = 0.0;
    *ok = quantizer->quantize(y, &out);
    return localBits(out);
}

void testQuantizerArithmetic() {
    bool ok = false;
    expectText(quantizeWithNewQuantizer("0.1", 0.549, &ok), "3fe0000000000000",
               "quantize 0.549 to 0.1 grid");
    expectText(quantizeWithNewQuantizer("0.1", -0.46, &ok), "bfe0000000000000",
               "quantize -0.46 floors to -0.5");
    expectText(quantizeWithNewQuantizer("1E+3", 1234.5, &ok), "408f400000000000",
               "quantize 1234.5 to 1E+3 grid");
    double tiny = 4.9e-324;
    expectText(quantizeWithNewQuantizer("0.0000000000000000001", tiny, &ok),
               "0000000000000000", "subnormal quantizes to 0");

    const std::string largeScaleResolution = "1." + std::string(3000, '0');
    blue::JavaBigDecimal largeScale;
    expect(blue::parseJavaBigDecimal(largeScaleResolution, largeScale) == blue::DecimalParseError::Ok,
           "parse active scale > 2000 resolution");
    expect(largeScale.scale == 3000, "active scale > 2000 is preserved");
    expectText(quantizeWithNewQuantizer(largeScaleResolution, 1.9, &ok),
               "3ff0000000000000", "scale > 2000 quantizes without a scale restriction");
}

void testAllocationContract() {
    blue::JavaBigDecimal resolution = parseOk("0.1");
    auto quantizer = blue::ExactDecimalQuantizer::prepare(resolution, nullptr);
    expect(quantizer != nullptr, "quantizer prepared");
    if (!quantizer) return;

    // a spread of values covering typical, boundary, and subnormal inputs
    std::vector<double> values;
    for (int i = 0; i < 100; i++) {
        values.push_back(-1000.0 + i * 20.043);
        values.push_back(0.001 * i);
    }
    values.push_back(4.9e-324);
    values.push_back(-4.9e-324);
    values.push_back(1e308);
    values.push_back(-1e308);

    const unsigned long long upstreamBefore = blue::decimalUpstreamAllocationCount().load();
    g_allocations = 0;
    g_countingAllocations = true;
    double out = 0.0;
    for (int evaluation = 0; evaluation < 100; evaluation++) {
        for (double value : values) {
            if (!quantizer->quantize(value, &out)) {
                expect(false, "quantize failed during allocation test");
                break;
            }
        }
    }
    g_countingAllocations = false;
    const unsigned long long systemAllocations = g_allocations;
    const unsigned long long upstream =
        blue::decimalUpstreamAllocationCount().load() - upstreamBefore;

    expect(systemAllocations == 0,
           "10,000+ prepared evaluations performed zero system allocations (got " +
               std::to_string(systemAllocations) + ")");
    expect(upstream == 0, "no upstream arena bypass (got " + std::to_string(upstream) + ")");
    expect(quantizer->arena().overflowCount() == 0, "no arena overflow");
    expect(quantizer->invalidInputCount() == 0, "no invalid inputs");

    // non-finite input must fail closed without allocating
    g_allocations = 0;
    g_countingAllocations = true;
    double ignored = 0.0;
    const bool nanOk = quantizer->quantize(std::nan(""), &ignored);
    const bool infOk = quantizer->quantize(INFINITY, &ignored);
    g_countingAllocations = false;
    expect(!nanOk && !infOk, "non-finite input rejected");
    expect(g_allocations == 0, "non-finite rejection allocates nothing");
    expect(quantizer->invalidInputCount() == 2, "invalid inputs counted");
}

void testArenaOverflowInstrumentation() {
    // a deliberately tiny arena must record overflow and fall back safely.
    // the value must exceed cpp_int's inline small-value capacity so the
    // arena allocator is actually reached
    blue::DecimalArena arena;
    arena.initialize(16);
    blue::setActiveDecimalArena(&arena);
    const unsigned long long upstreamBefore = blue::decimalUpstreamAllocationCount().load();
    {
        // 40+ digits need more limbs than cpp_int keeps inline
        blue::ArenaInt value(
            "123456789012345678901234567890123456789012345678901234567890");
        value *= value;
    }
    blue::setActiveDecimalArena(nullptr);
    expect(arena.overflowCount() > 0, "tiny arena recorded overflow");
    expect(blue::decimalUpstreamAllocationCount().load() > upstreamBefore,
           "overflow incremented upstream counter");
}

}  // namespace

int main() {
    testParsing();
    testFromBinary64();
    testToBinary64();
    testRoundingOperations();
    testQuantizerArithmetic();
    testAllocationContract();
    testArenaOverflowInstrumentation();
    if (g_failures == 0) {
        std::printf("test_java_bigdecimal: all tests passed\n");
        return 0;
    }
    std::printf("test_java_bigdecimal: %d failure(s)\n", g_failures);
    return 1;
}
