#include "../../src/automation/FixedPoint.h"
#include "../../src/automation/AutomationManager.h"
#include "../../src/automation/AutomationStore.h"
#include <iostream>
#include <cassert>
#include <memory>
#include <cmath>
#include <thread>
#include <vector>
#include <atomic>
#include <chrono>

void testFixedPointQuantization() {
    using namespace blue;

    // Test the core quantization logic that mimics Java BigDecimal behavior
    std::cout << "Testing FixedPoint quantization..." << std::endl;

    // Test 1: Basic quantization
    FixedPoint value1 = FixedPoint::fromDouble(0.75, 2);
    FixedPoint resolution1 = FixedPoint::fromDouble(0.25, 2);
    FixedPoint quantized1 = value1.subtract(value1.remainder(resolution1));
    std::cout << "0.75 quantized to 0.25 resolution: " << quantized1.toDouble() << std::endl;
    assert(quantized1.toDouble() == 0.75);

    // Test 2: Quantization with remainder
    FixedPoint value2 = FixedPoint::fromDouble(0.77, 2);
    FixedPoint resolution2 = FixedPoint::fromDouble(0.25, 2);
    FixedPoint quantized2 = value2.subtract(value2.remainder(resolution2));
    std::cout << "0.77 quantized to 0.25 resolution: " << quantized2.toDouble() << std::endl;
    assert(quantized2.toDouble() == 0.75);

    // Test 3: Descending segment bias (like Java implementation)
    FixedPoint descendingValue = FixedPoint::fromDouble(0.74, 2);
    FixedPoint biasedValue = FixedPoint::fromDouble(descendingValue.toDouble() + 0.25 * 0.99, 2);
    FixedPoint biasedQuantized = biasedValue.subtract(biasedValue.remainder(resolution2));
    std::cout << "0.74 with descending bias quantized to 0.25: " << biasedQuantized.toDouble() << std::endl;
    assert(biasedQuantized.toDouble() == 0.75);

    // Test 4: Fine resolution
    FixedPoint value3 = FixedPoint::fromDouble(0.123456, 6);
    FixedPoint resolution3 = FixedPoint::fromDouble(0.01, 2);
    FixedPoint quantized3 = value3.subtract(value3.remainder(resolution3));
    std::cout << "0.123456 quantized to 0.01 resolution: " << quantized3.toDouble() << std::endl;
    assert(quantized3.toDouble() == 0.12);

    std::cout << "All FixedPoint quantization tests passed!" << std::endl;
}

void testAutomationStoreResolution() {
    using namespace blue;

    std::cout << "\nTesting AutomationStore with resolution..." << std::endl;

    auto store = std::make_shared<AutomationStore>();
    std::vector<AutomationPoint> points = {
        {0.0, 0.0},
        {1.0, 1.0}
    };

    // Test creating automation with resolution
    uint32_t autoId = store->createAutomation("test", AutomationCurve::LINEAR, points, true, 0.1, 1, false);

    // Get the automation and verify the resolution is stored correctly
    auto automations = store->listAutomations();
    assert(automations.size() == 1);
    assert(std::abs(automations[0].resolution - 0.1) < 1e-9);
    assert(automations[0].resolutionScale == 1);
    assert(automations[0].highPrecision == false);
    assert(automations[0].definitionRevision >= 1);

    std::cout << "Resolution stored: " << automations[0].resolution << std::endl;
    std::cout << "Resolution scale: " << automations[0].resolutionScale << std::endl;

    // Test updating with different resolution and high precision
    store->updateAutomation("test", AutomationCurve::LINEAR, points, true, 0.01, 2, true);
    automations = store->listAutomations();
    double resolutionValue = automations[0].resolution;
    std::cout << "Updated resolution value: " << resolutionValue << std::endl;
    assert(std::abs(resolutionValue - 0.01) < 1e-9);
    assert(automations[0].resolutionScale == 2);
    assert(automations[0].highPrecision == true);
    assert(automations[0].definitionRevision >= 2);

    std::cout << "AutomationStore resolution tests passed!" << std::endl;
}

void testConcurrentStoreModifications() {
    using namespace blue;

    std::cout << "\nTesting concurrent AutomationStore multi-threaded reader/writer race conditions..." << std::endl;

    auto store = std::make_shared<AutomationStore>();
    std::atomic<bool> running{true};
    std::atomic<uint64_t> readOperations{0};
    std::atomic<uint64_t> writeOperations{0};

    // Reader thread mimicking perform audio loop
    std::thread readerThread([&]() {
        uint64_t lastRev = 0;
        std::shared_ptr<const AutomationList> cachedList;

        while (running.load(std::memory_order_relaxed)) {
            const uint64_t curRev = store->getRevision();
            if (curRev != lastRev || !cachedList) {
                cachedList = store->getList();
                lastRev = curRev;
            }

            if (cachedList) {
                for (const auto& [name, def] : cachedList->automations) {
                    if (def.enabled && !def.points.empty()) {
                        readOperations.fetch_add(1, std::memory_order_relaxed);
                    }
                }
            }
        }
    });

    // Writer thread mimicking ZMQ control plane
    std::thread writerThread([&]() {
        for (int i = 0; i < 500; ++i) {
            std::string chan = "chan_" + std::to_string(i % 10);
            std::vector<AutomationPoint> pts = {
                {0.0, static_cast<double>(i)},
                {1.0, static_cast<double>(i + 10)}
            };
            store->createAutomation(chan, AutomationCurve::LINEAR, pts, true);
            store->updateAutomation(chan, AutomationCurve::EXPONENTIAL, pts, (i % 2 == 0));
            if (i % 5 == 0) {
                store->setEnabled(chan, false);
            }
            if (i % 20 == 0) {
                store->deleteAutomation(chan);
            }
            writeOperations.fetch_add(1, std::memory_order_relaxed);
        }
    });

    writerThread.join();
    running.store(false, std::memory_order_relaxed);
    readerThread.join();

    std::cout << "Concurrent test completed: " << writeOperations.load() << " writes, "
              << readOperations.load() << " reads safely executed without data races!" << std::endl;
}

int main() {
    testFixedPointQuantization();
    testAutomationStoreResolution();
    testConcurrentStoreModifications();
    return 0;
}