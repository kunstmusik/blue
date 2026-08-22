#pragma once

#include "AutomationTypes.h"
#include <atomic>
#include <memory>
#include <mutex>

namespace blue {

// Thread-safe storage for automation definitions.
//
// Writers (the ZMQ control thread) publish fully prepared immutable
// definitions with copy-update-swap and release ordering. The performance
// thread reads lock-free through the revision gate. Old snapshots retired by
// the performance thread are reclaimed on the control thread so prepared
// quantizers and their arenas never become audio-thread destruction work.
class AutomationStore {
public:
    AutomationStore();
    ~AutomationStore();

    // Non-copyable
    AutomationStore(const AutomationStore&) = delete;
    AutomationStore& operator=(const AutomationStore&) = delete;

    // Writer operations (called from the ZMQ control thread). The definition
    // is parsed and prepared before publication; a preparation failure keeps
    // the previous definition intact and reports the diagnostic category.
    AutomationPrepareError createAutomation(const std::string& channelName,
                                            AutomationCurve curve,
                                            const std::vector<AutomationPoint>& points,
                                            bool enabled,
                                            const std::string& resolutionText,
                                            uint32_t* outId = nullptr);

    AutomationPrepareError updateAutomation(const std::string& channelName,
                                            AutomationCurve curve,
                                            const std::vector<AutomationPoint>& points,
                                            bool enabled,
                                            const std::string& resolutionText);

    // Delete automation by channel name
    bool deleteAutomation(const std::string& channelName);

    // Enable/disable automation (bumps the definition revision)
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

    // Performance-thread handoff: transfers ownership of a retired snapshot
    // into a fixed reclamation slot without destroying anything inline. The
    // raw ownership is reclaimed later on the control thread. Returns false
    // when every slot is occupied; in that case the caller retains ownership
    // and must defer adoption rather than destroy on the audio thread.
    bool retireSnapshot(std::shared_ptr<const AutomationList>& snapshot);

    // Control-thread reclamation: destroys retired snapshots. Called from the
    // ZMQ handling path after command batches and from writer operations.
    void reclaimRetired();

    // Instrumentation: how many handoffs found every reclamation slot occupied.
    // A capacity miss is deferred and never destroys a snapshot inline.
    uint64_t inlineRetireCount() const { return inlineRetireCount_.load(std::memory_order_relaxed); }

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

    // Fixed reclamation slots. State 0 is empty, 1 is being written by the
    // performance thread, and 2 is ready for the control thread. The
    // two-phase state avoids a data race between publishing the shared_ptr
    // and the control thread reclaiming it.
    static constexpr size_t kRetireSlots = 256;
    std::atomic<uint8_t> retireStates_[kRetireSlots];
    std::shared_ptr<const AutomationList> retireSlots_[kRetireSlots];
    std::atomic<uint64_t> inlineRetireCount_{0};
};

}  // namespace blue
