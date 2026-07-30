#include "../../src/automation/AutomationManager.h"
#include "../../src/automation/AutomationStore.h"

#include <cassert>
#include <cmath>
#include <memory>
#include <string>
#include <vector>

namespace {

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
        "gain", AutomationCurve::LINEAR, initialPoints, true);

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
        "gain", AutomationCurve::LINEAR, replacementPoints, true));

    manager.process(260, 100.0);
    assert(writtenChannel == "gain");
    assert(std::abs(writtenValue - 12.6) < 1.0e-9);
}

} // namespace

int main() {
    testShrinkingActiveAutomationResetsCachedSegment();
    return 0;
}
