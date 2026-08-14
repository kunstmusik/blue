#include "AutomationStore.h"
#include <algorithm>

namespace blue {

AutomationStore::AutomationStore()
    : currentList_(std::make_shared<AutomationList>(1)),
      revision_(1),
      nextId_(1) {
}

uint32_t AutomationStore::createAutomation(
    const std::string& channelName,
    AutomationCurve curve,
    const std::vector<AutomationPoint>& points,
    bool enabled,
    double resolution,
    int resolutionScale,
    bool highPrecision) {

    std::lock_guard<std::mutex> lock(listMutex_);

    uint32_t autoId = nextId_++;

    updateList([&](AutomationList& list) {
        // Create new automation definition with initial definitionRevision = 1
        AutomationDef def(autoId, channelName, curve, points, enabled,
                         resolution, resolutionScale, highPrecision, 1);

        // Replace any existing automation for this channel
        list.automations[channelName] = std::move(def);
    });

    return autoId;
}

bool AutomationStore::updateAutomation(
    const std::string& channelName,
    AutomationCurve curve,
    const std::vector<AutomationPoint>& points,
    bool enabled,
    double resolution,
    int resolutionScale,
    bool highPrecision) {

    std::lock_guard<std::mutex> lock(listMutex_);

    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    auto it = current->automations.find(channelName);

    if (it == current->automations.end()) {
        return false;  // Automation doesn't exist
    }

    uint32_t existingId = it->second.id;
    uint64_t nextDefRev = it->second.definitionRevision + 1;

    updateList([&](AutomationList& list) {
        // Update automation, preserving the ID and bumping definitionRevision
        AutomationDef def(existingId, channelName, curve, points, enabled,
                         resolution, resolutionScale, highPrecision, nextDefRev);
        list.automations[channelName] = std::move(def);
    });

    return true;
}

bool AutomationStore::deleteAutomation(const std::string& channelName) {
    std::lock_guard<std::mutex> lock(listMutex_);

    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    auto it = current->automations.find(channelName);

    if (it == current->automations.end()) {
        return false;  // Automation doesn't exist
    }

    updateList([&](AutomationList& list) {
        list.automations.erase(channelName);
    });

    return true;
}

bool AutomationStore::setEnabled(const std::string& channelName, bool enabled) {
    std::lock_guard<std::mutex> lock(listMutex_);

    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    auto it = current->automations.find(channelName);

    if (it == current->automations.end()) {
        return false;  // Automation doesn't exist
    }

    uint64_t nextDefRev = it->second.definitionRevision + 1;

    updateList([&](AutomationList& list) {
        auto& def = list.automations[channelName];
        // Create new definition with updated enabled state and bumped definitionRevision
        AutomationDef newDef(def.id, def.channelName, def.curve,
                            def.points, enabled, def.resolution,
                            def.resolutionScale, def.highPrecision, nextDefRev);
        list.automations[channelName] = std::move(newDef);
    });

    return true;
}

void AutomationStore::clear() {
    std::lock_guard<std::mutex> lock(listMutex_);

    const uint64_t nextRev = revision_.load(std::memory_order_relaxed) + 1;
    auto emptyList = std::make_shared<AutomationList>(nextRev);

    // Publish snapshot first with release ordering
    std::atomic_store_explicit(
        &currentList_,
        std::shared_ptr<const AutomationList>(std::move(emptyList)),
        std::memory_order_release);

    // Bump revision with release ordering
    revision_.store(nextRev, std::memory_order_release);
}

std::vector<AutomationDef> AutomationStore::listAutomations() const {
    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    std::vector<AutomationDef> result;

    result.reserve(current->automations.size());
    for (const auto& [channelName, def] : current->automations) {
        result.push_back(def);
    }

    return result;
}

template<typename F>
void AutomationStore::updateList(F&& modifier) {
    // Deep copy current list (writer lock already held by caller)
    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    auto newList = std::make_shared<AutomationList>(*current);

    // Apply modification
    modifier(*newList);

    const uint64_t nextRev = revision_.load(std::memory_order_relaxed) + 1;
    newList->revision = nextRev;

    // Publish snapshot first with release ordering
    std::atomic_store_explicit(
        &currentList_,
        std::shared_ptr<const AutomationList>(std::move(newList)),
        std::memory_order_release);

    // Bump revision with release ordering
    revision_.store(nextRev, std::memory_order_release);
}

}  // namespace blue
