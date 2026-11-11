#include "../../src/automation/AutomationManager.h"
#include "../../src/automation/AutomationStore.h"

#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <memory>
#include <string>
#include <vector>

namespace {

void testUnchangedDefinitionsAreSharedAndSnapshotsStayImmutable() {
    using namespace blue;
    auto store = std::make_shared<AutomationStore>();
    std::vector<AutomationPoint> points(10000, AutomationPoint{0, 0.5});
    assert(store->createAutomation("a", AutomationCurve::LINEAR, points, true, "-1") == AutomationPrepareError::Ok);
    const auto before = store->getList();
    const auto original = before->automations.at("a");
    const auto* pointBuffer = original->points.data();
    const auto* segments = original->segments.data();
    assert(store->createAutomation("b", AutomationCurve::STEP, {{0, 1}, {1, 2}}, true, "-1") == AutomationPrepareError::Ok);
    assert(store->getList()->automations.at("a") == original);
    assert(store->updateAutomation("b", AutomationCurve::LINEAR, {{0, 3}, {1, 4}}, true, "-1") == AutomationPrepareError::Ok);
    assert(store->setEnabled("b", false));
    assert(store->getList()->automations.at("a") == original);
    assert(original->points.data() == pointBuffer);
    assert(original->segments.data() == segments);
    assert(store->setEnabled("a", false));
    assert(original->enabled);
    assert(!store->getList()->automations.at("a")->enabled);
    assert(before->automations.size() == 1);
    const auto listed = store->listAutomations();
    assert(listed.size() == 2);
    assert(!listed.front().enabled);
    assert(store->deleteAutomation("a"));
    store->clear();
    assert(original->points.data() == pointBuffer);
    assert(original->points.back().value == 0.5);
}

void testSameNameReplacementDoesNotInheritCompletedState() {
    using namespace blue;
    auto store = std::make_shared<AutomationStore>();
    assert(store->createAutomation("gain", AutomationCurve::LINEAR, {{0, 0}, {1, 1}}, true, "-1") == AutomationPrepareError::Ok);
    double value = -1;
    AutomationManager manager(store, [&](const std::string&, double next) { value = next; });
    manager.processAtElapsedTimeForTesting(2);
    assert(value == 1);
    assert(store->createAutomation("gain", AutomationCurve::LINEAR, {{0, 10}, {1, 20}}, true, "-1") == AutomationPrepareError::Ok);
    manager.processAtElapsedTimeForTesting(2);
    assert(value == 20);
}

void testDenseLookupWorkAndSeeks() {
    using namespace blue;
    auto store = std::make_shared<AutomationStore>();
    std::vector<AutomationPoint> points;
    for (int i = 0; i < 10000; ++i) points.emplace_back(i, i);
    assert(store->createAutomation("dense", AutomationCurve::LINEAR, points, true, "-1") == AutomationPrepareError::Ok);
    double value = -1;
    AutomationManager manager(store, [&](const std::string&, double next) { value = next; });
    manager.processAtElapsedTimeForTesting(9000.25);
    assert(value == 9000.25);
    assert(manager.lookupComparisonsForTesting() <= 20);
    for (int i = 0; i < 100; ++i) {
        const double time = 9000.25 + i * 0.001;
        manager.processAtElapsedTimeForTesting(time);
        assert(value == time);
        assert(manager.lookupComparisonsForTesting() <= 3);
    }
    for (double time : {10.5, 9998.5, 150.5, -0.5, 10000.0, 5.5}) {
        manager.processAtElapsedTimeForTesting(time);
        assert(value == (time > 9999 ? 9999 : time));
        assert(manager.lookupComparisonsForTesting() <= 20);
    }
    manager.processAtElapsedTimeForTesting(std::numeric_limits<double>::quiet_NaN());
    assert(std::isnan(value));

    points.assign(10000, AutomationPoint{1, 7});
    points.front() = {0, 0};
    points.emplace_back(2, 9);
    assert(store->updateAutomation("dense", AutomationCurve::LINEAR, points, true, "-1") == AutomationPrepareError::Ok);
    manager.processAtElapsedTimeForTesting(1);
    assert(value == 7);
    assert(manager.lookupComparisonsForTesting() <= 20);
    manager.processAtElapsedTimeForTesting(1);
    assert(value == 7);
    assert(manager.lookupComparisonsForTesting() <= 3);
}

void testOrderedEdgeRulesAndUnorderedFallback() {
    using namespace blue;
    for (auto curve : {AutomationCurve::LINEAR, AutomationCurve::STEP, AutomationCurve::EXPONENTIAL}) {
        auto store = std::make_shared<AutomationStore>();
        assert(store->createAutomation("edge", curve,
            {{-2, 1}, {0, 2}, {0, 3}, {2, 5}, {2, 7}, {4, 9}}, true, "-1") == AutomationPrepareError::Ok);
        double value = -1;
        AutomationManager manager(store, [&](const std::string&, double next) { value = next; });
        const std::vector<std::pair<double, double>> cases = {
            {-3, curve == AutomationCurve::LINEAR ? 0.5 : 1},
            {-0.0, 1}, {0, 1},
            {1, curve == AutomationCurve::LINEAR ? 4 : curve == AutomationCurve::STEP ? 3 : std::sqrt(15.0)},
            {2, 7}, {2, 7},
            {3, curve == AutomationCurve::LINEAR ? 8 : curve == AutomationCurve::STEP ? 7 : std::sqrt(63.0)},
            {4, 9}, {5, 9},
            {-1, curve == AutomationCurve::LINEAR ? 1.5 : curve == AutomationCurve::STEP ? 1 : std::sqrt(2.0)},
        };
        for (const auto& [time, expected] : cases) {
            manager.processAtElapsedTimeForTesting(time);
            assert(std::abs(value - expected) < 1e-12);
        }
    }
    auto store = std::make_shared<AutomationStore>();
    assert(store->createAutomation("unordered", AutomationCurve::LINEAR,
        {{0, 0}, {3, 3}, {1, 10}, {5, 5}}, true, "-1") == AutomationPrepareError::Ok);
    double value = -1;
    AutomationManager manager(store, [&](const std::string&, double next) { value = next; });
    for (const auto& [time, expected] : std::vector<std::pair<double, double>>{
             {2, 2}, {3, 3}, {4, 6.25}, {1, 1}, {6, 5}, {4, 6.25}}) {
        manager.processAtElapsedTimeForTesting(time);
        assert(value == expected);
    }
    manager.processAtElapsedTimeForTesting(std::numeric_limits<double>::quiet_NaN());
    assert(std::isnan(value));
}

void testShrinkingActiveAutomationResetsCachedSegment() {
    using namespace blue;

    auto store = std::make_shared<AutomationStore>();
    const std::vector<AutomationPoint> initialPoints = {
        {0.0, 0.0},
        {1.0, 1.0},
        {2.0, 2.0},
        {3.0, 3.0},
    };
    store->createAutomation(
        "gain", AutomationCurve::LINEAR, initialPoints, true, "-1");

    std::string writtenChannel;
    double writtenValue = 0.0;
    AutomationManager manager(
        store,
        [&](const std::string& channelName, double value) {
            writtenChannel = channelName;
            writtenValue = value;
        });

    manager.process(250, 100.0);
    assert(writtenChannel == "gain");
    assert(std::abs(writtenValue - 2.5) < 1.0e-9);

    const std::vector<AutomationPoint> replacementPoints = {
        {0.0, 10.0},
        {4.0, 14.0},
    };
    assert(store->updateAutomation(
        "gain", AutomationCurve::LINEAR, replacementPoints, true, "-1") ==
        AutomationPrepareError::Ok);

    manager.process(260, 100.0);
    assert(writtenChannel == "gain");
    assert(std::abs(writtenValue - 12.6) < 1.0e-9);
}

void testExponentialInterpolationWithLogRatio() {
    using namespace blue;

    auto store = std::make_shared<AutomationStore>();
    // Exponential curve from 1.0 to 4.0 over 2.0 seconds
    const std::vector<AutomationPoint> expPoints = {
        {0.0, 1.0},
        {2.0, 4.0},
    };
    store->createAutomation("exp_channel", AutomationCurve::EXPONENTIAL, expPoints, true, "-1");

    std::string writtenChannel;
    double writtenValue = 0.0;
    AutomationManager manager(
        store,
        [&](const std::string& channelName, double value) {
            writtenChannel = channelName;
            writtenValue = value;
        });

    // At t = 1.0s (midpoint), y = 1.0 * (4.0 / 1.0)^0.5 = 2.0
    manager.process(100, 100.0);
    assert(writtenChannel == "exp_channel");
    assert(std::abs(writtenValue - 2.0) < 1.0e-7);

    // Test non-positive endpoint fallback to linear
    const std::vector<AutomationPoint> zeroPoints = {
        {0.0, 0.0},
        {2.0, 4.0},
    };
    store->updateAutomation("exp_channel", AutomationCurve::EXPONENTIAL, zeroPoints, true, "-1");

    // At t = 1.0s (midpoint), linear fallback gives (0.0 + 4.0) / 2 = 2.0
    manager.process(100, 100.0);
    assert(std::abs(writtenValue - 2.0) < 1.0e-7);
}

void testCompletedEnvelopeEarlyOutAndInvalidation() {
    using namespace blue;

    auto store = std::make_shared<AutomationStore>();
    const std::vector<AutomationPoint> points = {
        {0.0, 0.0},
        {1.0, 5.0},
    };
    store->createAutomation("cutoff", AutomationCurve::LINEAR, points, true, "-1");

    uint64_t writeCount = 0;
    double lastWritten = -1.0;
    AutomationManager manager(
        store,
        [&](const std::string&, double value) {
            writeCount += 1;
            lastWritten = value;
        });

    // Process up to t = 1.0s (completion)
    manager.process(50, 100.0);
    assert(std::abs(lastWritten - 2.5) < 1.0e-7);

    manager.process(100, 100.0); // t = 1.0s -> reaches 5.0 and marks completed
    assert(std::abs(lastWritten - 5.0) < 1.0e-7);
    uint64_t completedWriteCount = writeCount;

    // Process past completion at t = 1.5s -> early-out should skip without extra writes
    manager.process(150, 100.0);
    assert(writeCount == completedWriteCount);

    // Live update definition with new end point at t = 3.0s -> should invalidate completed state
    const std::vector<AutomationPoint> extendedPoints = {
        {0.0, 0.0},
        {3.0, 15.0},
    };
    store->updateAutomation("cutoff", AutomationCurve::LINEAR, extendedPoints, true, "-1");

    // Process at t = 2.0s -> should interpolate to 10.0 and write value
    manager.process(200, 100.0);
    assert(std::abs(lastWritten - 10.0) < 1.0e-7);
    assert(writeCount > completedWriteCount);

    // Rewind time to t = 0.5s -> should reset state and write 2.5
    manager.process(50, 100.0);
    assert(std::abs(lastWritten - 2.5) < 1.0e-7);
}

void testExactQuantizationThroughManager() {
    using namespace blue;

    // Exact Java quantization through the production manager, replacing the
    // former fast/high-precision static helpers. Expected values are
    // Java-verified (see the realtime fixture corpus for full coverage).
    const auto run = [](double first, double second, const char* resolutionText) {
        auto store = std::make_shared<AutomationStore>();
        store->createAutomation(
            "quantized", AutomationCurve::LINEAR,
            std::vector<AutomationPoint>{{0.0, first}, {1.0, second}}, true,
            resolutionText);
        double value = 0.0;
        AutomationManager manager(
            store,
            [&](const std::string&, double nextValue) { value = nextValue; });
        manager.process(50, 100.0);
        return value;
    };

    assert(std::abs(run(0.0, 0.2469, "0.1") - 0.1) < 1.0e-12);
    assert(std::abs(run(0.2469, 0.0, "0.1") - 0.2) < 1.0e-12);
    assert(std::abs(run(0.0, -0.2469, "0.1") + 0.1) < 1.0e-12);
    assert(std::abs(run(0.0, 1.0, "0.0000000000000000001") - 0.5) < 1.0e-12);
    assert(std::abs(run(0.0, 1.0, "1E-400") - 0.5) < 1.0e-12);
    assert(std::abs(run(0.0, 1.0, "-1") - 0.5) < 1.0e-12);
}

void testChannelResolutionIsGenerationGated() {
    using namespace blue;

    auto store = std::make_shared<AutomationStore>();
    store->createAutomation(
        "late_channel", AutomationCurve::LINEAR,
        std::vector<AutomationPoint>{{0.0, 1.0}, {1.0, 2.0}}, true, "-1");

    double firstChannelValue = 0.0;
    double secondChannelValue = 0.0;
    uint64_t bindingGeneration = 1;
    size_t resolverCalls = 0;

    AutomationManager manager(
        store,
        AutomationManager::ChannelWriter{},
        [&](const std::string&) -> double* {
            ++resolverCalls;
            return bindingGeneration == 1 ? nullptr : &secondChannelValue;
        },
        [&]() { return bindingGeneration; });

    // An unresolved channel is attempted once for generation 1, not once per
    // k-cycle. This is the property that removes the old audio-thread lookup.
    manager.process(0, 100.0);
    manager.process(1, 100.0);
    assert(resolverCalls == 1);
    assert(firstChannelValue == 0.0);

    // Publishing a new binding generation causes exactly one re-resolution and
    // the next value is written through the new pointer.
    bindingGeneration = 2;
    manager.process(100, 100.0);
    assert(resolverCalls == 2);
    assert(std::abs(secondChannelValue - 2.0) < 1.0e-9);
    manager.process(101, 100.0);
    assert(resolverCalls == 2);
}

void testCompletedAutomationRebindsFinalValue() {
    using namespace blue;

    auto store = std::make_shared<AutomationStore>();
    store->createAutomation(
        "completed_channel", AutomationCurve::LINEAR,
        std::vector<AutomationPoint>{{0.0, 0.0}, {1.0, 5.0}}, true, "-1");

    double firstChannelValue = 0.0;
    double replacementChannelValue = 0.0;
    uint64_t bindingGeneration = 1;
    size_t resolverCalls = 0;

    AutomationManager manager(
        store,
        AutomationManager::ChannelWriter{},
        [&](const std::string&) -> double* {
            ++resolverCalls;
            return bindingGeneration == 1 ? &firstChannelValue
                                          : &replacementChannelValue;
        },
        [&]() { return bindingGeneration; });

    manager.process(100, 100.0);
    assert(resolverCalls == 1);
    assert(std::abs(firstChannelValue - 5.0) < 1.0e-9);

    // The completed fast path should avoid duplicate writes while the binding
    // remains unchanged.
    manager.process(200, 100.0);
    assert(resolverCalls == 1);
    assert(std::abs(replacementChannelValue) < 1.0e-12);

    // A replacement Csound binding must receive the already-completed final
    // value even though curve evaluation was previously bypassed.
    bindingGeneration = 2;
    manager.process(200, 100.0);
    assert(resolverCalls == 2);
    assert(std::abs(replacementChannelValue - 5.0) < 1.0e-9);
}

void testInvalidDefinitionKeepsPreviousRevision() {
    using namespace blue;

    auto store = std::make_shared<AutomationStore>();
    assert(store->createAutomation(
               "kept", AutomationCurve::LINEAR,
               std::vector<AutomationPoint>{{0.0, 0.0}, {1.0, 1.0}}, true,
               "0.1") == AutomationPrepareError::Ok);

    // malformed resolution text is rejected; the previous revision remains
    assert(store->updateAutomation(
               "kept", AutomationCurve::LINEAR,
               std::vector<AutomationPoint>{{0.0, 0.0}, {1.0, 1.0}}, true,
               "not-a-decimal") == AutomationPrepareError::InvalidDecimalSyntax);
    assert(store->updateAutomation(
               "kept", AutomationCurve::LINEAR,
               std::vector<AutomationPoint>{{0.0, 0.0}, {1.0, 1.0}}, true,
               "1E-2147483648") == AutomationPrepareError::DecimalScaleOverflow);

    double value = -1.0;
    AutomationManager manager(
        store, [&](const std::string&, double nextValue) { value = nextValue; });
    manager.process(50, 100.0);
    // 0.5 floored to the 0.1 grid
    assert(std::abs(value - 0.5) < 1.0e-12);
}

} // namespace

int main() {
    testUnchangedDefinitionsAreSharedAndSnapshotsStayImmutable();
    testSameNameReplacementDoesNotInheritCompletedState();
    testOrderedEdgeRulesAndUnorderedFallback();
    testDenseLookupWorkAndSeeks();
    std::cout << "Starting test 1..." << std::endl;
    testShrinkingActiveAutomationResetsCachedSegment();
    std::cout << "Starting test 2..." << std::endl;
    testExponentialInterpolationWithLogRatio();
    std::cout << "Starting test 3..." << std::endl;
    testCompletedEnvelopeEarlyOutAndInvalidation();
    std::cout << "Starting test 4..." << std::endl;
    testExactQuantizationThroughManager();
    std::cout << "Starting test 5..." << std::endl;
    testChannelResolutionIsGenerationGated();
    std::cout << "Starting test 6..." << std::endl;
    testCompletedAutomationRebindsFinalValue();
    std::cout << "Starting test 7..." << std::endl;
    testInvalidDefinitionKeepsPreviousRevision();
    std::cout << "All AutomationManager tests passed successfully!" << std::endl;
    return 0;
}
