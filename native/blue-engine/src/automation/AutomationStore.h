#pragma once

#include "AutomationTypes.h"
#include <atomic>
#include <memory>
#include <mutex>

namespace blue {

// Thread-safe storage for automation definitions
// Uses immutable data structures with atomic generation gating for lock-free reads
class AutomationStore {
public:
    AutomationStore();
    ~AutomationStore() = default;

    // Non-copyable
    AutomationStore(const AutomationStore&) = delete;
    AutomationStore& operator=(const AutomationStore&) = delete;

    // Writer operations (called from ZMQ handler thread)
    // Returns the assigned automation ID
    uint32_t createAutomation(const std::string& channelName,
                             AutomationCurve curve,
                             const std::vector<AutomationPoint>& points,
                             bool enabled = true,
                             double resolution = 0.0,
                             int resolutionScale = 0,
                             bool highPrecision = false);

    // Update existing automation (replaces definition, preserves ID, bumps definitionRevision)
    bool updateAutomation(const std::string& channelName,
                         AutomationCurve curve,
                         const std::vector<AutomationPoint>& points,
                         bool enabled = true,
                         double resolution = 0.0,
                         int resolutionScale = 0,
                         bool highPrecision = false);

    // Delete automation by channel name
    bool deleteAutomation(const std::string& channelName);

    // Enable/disable automation
    bool setEnabled(const std::string& channelName, bool enabled);

    // Remove all automations
    void clear();

    // Get list of all automations (for LIST_AUTOMATIONS command)
    std::vector<AutomationDef> listAutomations() const;

    // Fast lock-free revision query for gating snapshot loads in the audio thread
    uint64_t getRevision() const {
        return revision_.load(std::memory_order_acquire);
    }

    // Reader operation (called from performance thread or control thread).
    // Lock-free snapshot load for realtime safety.
    std::shared_ptr<const AutomationList> getList() const {
        return std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    }

private:
    // Helper to perform copy-update-swap pattern
    template<typename F>
    void updateList(F&& modifier);

    // Shared pointer to immutable list.
    // Writes are serialized by listMutex_ and published with atomic store.
    std::shared_ptr<const AutomationList> currentList_;

    // Lock-free revision counter for gating snapshot acquisition
    std::atomic<uint64_t> revision_{1};

    // Mutex protects writers
    mutable std::mutex listMutex_;

    // ID generation (protected by listMutex_)
    uint32_t nextId_;
};

}  // namespace blue
