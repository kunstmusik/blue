#include "AutomationStore.h"

#include <algorithm>
#include <new>
#include <string_view>
#include <unordered_set>

namespace blue {

const char* automationPrepareErrorName(AutomationPrepareError error) {
    switch (error) {
        case AutomationPrepareError::Ok:
            return "OK";
        case AutomationPrepareError::InvalidDecimalSyntax:
            return "INVALID_DECIMAL_SYNTAX";
        case AutomationPrepareError::DecimalScaleOverflow:
            return "DECIMAL_SCALE_OVERFLOW";
        case AutomationPrepareError::NonFiniteAutomationInput:
            return "NON_FINITE_AUTOMATION_INPUT";
        case AutomationPrepareError::DecimalWorkspaceUnavailable:
            return "DECIMAL_WORKSPACE_UNAVAILABLE";
        case AutomationPrepareError::NotFound:
            return "AUTOMATION_NOT_FOUND";
        case AutomationPrepareError::DuplicateChannel:
            return "DUPLICATE_AUTOMATION_CHANNEL";
    }
    return "UNKNOWN";
}

AutomationPrepareError prepareAutomationDef(uint32_t id,
                                            const std::string& channel,
                                            AutomationCurve curve,
                                            const std::vector<AutomationPoint>& points,
                                            bool enabled,
                                            const std::string& resolutionText,
                                            uint64_t definitionRevision,
                                            AutomationDef& out) {
    // Supported input contract: every point time/value must be finite.
    for (const auto& point : points) {
        if (!std::isfinite(point.time) || !std::isfinite(point.value)) {
            return AutomationPrepareError::NonFiniteAutomationInput;
        }
    }

    // Parse the exact resolution under the Java BigDecimal(String) grammar.
    JavaBigDecimal resolution;
    switch (parseJavaBigDecimal(resolutionText, resolution)) {
        case DecimalParseError::Ok:
            break;
        case DecimalParseError::InvalidSyntax:
            return AutomationPrepareError::InvalidDecimalSyntax;
        case DecimalParseError::ScaleOverflow:
            return AutomationPrepareError::DecimalScaleOverflow;
    }

    // Prepare the quantizer workspace only when Java would quantize.
    std::shared_ptr<const ExactDecimalQuantizer> quantizer;
    const double resolutionDouble = resolution.doubleValue();
    if (resolutionDouble > 0.0) {
        std::string workspaceError;
        auto prepared = ExactDecimalQuantizer::prepare(resolution, &workspaceError);
        if (!prepared) {
            return AutomationPrepareError::DecimalWorkspaceUnavailable;
        }
        quantizer = std::move(prepared);
    }

    // Build the invariant segment caches with the Java-order slope.
    std::vector<AutomationSegmentCache> segments;
    if (points.size() > 1) {
        segments.reserve(points.size() - 1);
        for (size_t i = 0; i + 1 < points.size(); ++i) {
            const auto& p0 = points[i];
            const auto& p1 = points[i + 1];
            AutomationSegmentCache seg;
            const double duration = p1.time - p0.time;
            seg.slope = (p1.value - p0.value) / (p1.time - p0.time);
            seg.invDuration = (duration > 0.0) ? (1.0 / duration) : 0.0;
            seg.deltaValue = p1.value - p0.value;
            seg.isDescending = (p1.value < p0.value);

            if (curve == AutomationCurve::EXPONENTIAL && p0.value > 0.0 && p1.value > 0.0) {
                seg.logRatio = std::log(p1.value / p0.value);
                seg.isPositiveLogValid = true;
            }
            segments.push_back(seg);
        }
    }

    out = AutomationDef{};
    out.id = id;
    out.channelName = channel;
    out.curve = curve;
    out.points = points;
    out.pointsOrdered = std::is_sorted(points.begin(), points.end(),
        [](const AutomationPoint& a, const AutomationPoint& b) { return a.time < b.time; });
    out.enabled = enabled;
    out.resolutionDecimal = resolution.canonicalText();
    out.resolutionDouble = resolutionDouble;
    out.quantizer = std::move(quantizer);
    out.segments = std::move(segments);
    out.definitionRevision = definitionRevision;
    return AutomationPrepareError::Ok;
}

AutomationStore::AutomationStore()
    : currentList_(std::make_shared<AutomationList>(1)),
      revision_(1),
      nextId_(1) {
    for (auto& state : retireStates_) {
        state.store(0, std::memory_order_relaxed);
    }

}

AutomationStore::~AutomationStore() {
#ifdef BLUE_ENGINE_TESTING
    autoReclaimPaused_.store(false, std::memory_order_release);
#endif
    reclaimRetired();
}

AutomationPrepareError AutomationStore::createAutomation(
    const std::string& channelName,
    AutomationCurve curve,
    const std::vector<AutomationPoint>& points,
    bool enabled,
    const std::string& resolutionText,
    uint32_t* outId) {
    struct ReclaimGuard {
        AutomationStore& store;
        ~ReclaimGuard() { store.reclaimRetired(); }
    } reclaimGuard{*this};
    std::lock_guard<std::mutex> lock(listMutex_);

    AutomationDef def;
    const uint32_t autoId = nextId_;
    const auto status = prepareAutomationDef(autoId, channelName, curve, points, enabled,
                                              resolutionText, 1, def);
    if (status != AutomationPrepareError::Ok) {
        return status;  // previous definition (if any) remains intact
    }

    nextId_ += 1;
    updateList([&](AutomationList& list) {
        list.automations[channelName] = std::make_shared<const AutomationDef>(std::move(def));
    });

    if (outId) *outId = autoId;
    return AutomationPrepareError::Ok;
}

AutomationPrepareError AutomationStore::updateAutomation(
    const std::string& channelName,
    AutomationCurve curve,
    const std::vector<AutomationPoint>& points,
    bool enabled,
    const std::string& resolutionText) {
    struct ReclaimGuard {
        AutomationStore& store;
        ~ReclaimGuard() { store.reclaimRetired(); }
    } reclaimGuard{*this};
    std::lock_guard<std::mutex> lock(listMutex_);

    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    auto it = current->automations.find(channelName);
    if (it == current->automations.end()) {
        return AutomationPrepareError::NotFound;
    }

    const uint32_t existingId = it->second->id;
    const uint64_t nextDefRev = it->second->definitionRevision + 1;

    AutomationDef def;
    const auto status = prepareAutomationDef(existingId, channelName, curve, points, enabled,
                                              resolutionText, nextDefRev, def);
    if (status != AutomationPrepareError::Ok) {
        return status;  // previous definition remains intact
    }

    updateList([&](AutomationList& list) {
        list.automations[channelName] = std::make_shared<const AutomationDef>(std::move(def));
    });

    return AutomationPrepareError::Ok;
}

AutomationPrepareError AutomationStore::createAutomations(
    const std::vector<AutomationBatchEntry>& entries,
    std::vector<uint32_t>* outIds) {
    return applyAutomationBatch(entries, true, outIds);
}

AutomationPrepareError AutomationStore::updateAutomations(
    const std::vector<AutomationBatchEntry>& entries) {
    return applyAutomationBatch(entries, false, nullptr);
}

AutomationPrepareError AutomationStore::applyAutomationBatch(
    const std::vector<AutomationBatchEntry>& entries,
    bool createMode,
    std::vector<uint32_t>* outIds) {
    struct ReclaimGuard {
        AutomationStore& store;
        ~ReclaimGuard() { store.reclaimRetired(); }
    } reclaimGuard{*this};
    std::lock_guard<std::mutex> lock(listMutex_);

    if (entries.empty()) {
        if (outIds) {
            outIds->clear();
        }
        return AutomationPrepareError::Ok;
    }

    // Reject duplicate channel names within the batch so direct C++ callers
    // preserve ID/revision invariants just like ZMQ batch validation.
    constexpr size_t kLinearDuplicateLimit = 16;
    if (entries.size() <= kLinearDuplicateLimit) {
        for (size_t i = 0; i < entries.size(); ++i) {
            for (size_t j = i + 1; j < entries.size(); ++j) {
                if (entries[i].channelName == entries[j].channelName) {
                    return AutomationPrepareError::DuplicateChannel;
                }
            }
        }
    } else {
        std::unordered_set<std::string_view> seenNames;
        seenNames.reserve(entries.size());
        for (const auto& entry : entries) {
            if (!seenNames.insert(entry.channelName).second) {
                return AutomationPrepareError::DuplicateChannel;
            }
        }
    }

    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    std::vector<AutomationDef> prepared;
    prepared.reserve(entries.size());
    std::vector<uint32_t> createdIds;
    if (outIds) {
        createdIds.reserve(entries.size());
    }

    uint32_t allocatedNextId = nextId_;
    for (const auto& entry : entries) {
        uint32_t autoId = 0;
        uint64_t defRev = 1;
        if (createMode) {
            autoId = allocatedNextId++;
        } else {
            auto it = current->automations.find(entry.channelName);
            if (it == current->automations.end()) {
                return AutomationPrepareError::NotFound;
            }
            autoId = it->second->id;
            defRev = it->second->definitionRevision + 1;
        }

        AutomationDef def;
        const auto status = prepareAutomationDef(autoId,
                                                 entry.channelName,
                                                 entry.curve,
                                                 entry.points,
                                                 entry.enabled,
                                                 entry.resolutionText,
                                                 defRev,
                                                 def);
        if (status != AutomationPrepareError::Ok) {
            return status;
        }
        if (outIds) {
            createdIds.push_back(autoId);
        }
        prepared.push_back(std::move(def));
    }

    if (createMode) {
        nextId_ = allocatedNextId;
    }

    updateList([&](AutomationList& list) {
        for (auto& def : prepared) {
            const std::string key = def.channelName;
            list.automations[key] = std::make_shared<const AutomationDef>(std::move(def));
        }
    });

    if (outIds) {
        *outIds = std::move(createdIds);
    }
    return AutomationPrepareError::Ok;
}

bool AutomationStore::deleteAutomation(const std::string& channelName) {
    struct ReclaimGuard {
        AutomationStore& store;
        ~ReclaimGuard() { store.reclaimRetired(); }
    } reclaimGuard{*this};
    std::lock_guard<std::mutex> lock(listMutex_);

    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    auto it = current->automations.find(channelName);
    if (it == current->automations.end()) {
        return false;
    }

    updateList([&](AutomationList& list) {
        list.automations.erase(channelName);
    });

    return true;
}

bool AutomationStore::setEnabled(const std::string& channelName, bool enabled) {
    struct ReclaimGuard {
        AutomationStore& store;
        ~ReclaimGuard() { store.reclaimRetired(); }
    } reclaimGuard{*this};
    std::lock_guard<std::mutex> lock(listMutex_);

    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    auto it = current->automations.find(channelName);
    if (it == current->automations.end()) {
        return false;
    }

    uint64_t nextDefRev = it->second->definitionRevision + 1;

    updateList([&](AutomationList& list) {
        AutomationDef newDef = *list.automations.at(channelName);
        newDef.enabled = enabled;
        newDef.definitionRevision = nextDefRev;
        list.automations[channelName] = std::make_shared<const AutomationDef>(std::move(newDef));
    });

    return true;
}

void AutomationStore::clear() {
    struct ReclaimGuard {
        AutomationStore& store;
        ~ReclaimGuard() { store.reclaimRetired(); }
    } reclaimGuard{*this};
    std::lock_guard<std::mutex> lock(listMutex_);

    const uint64_t nextRev = revision_.load(std::memory_order_relaxed) + 1;
    auto emptyList = std::make_shared<AutomationList>(nextRev);

    std::atomic_store_explicit(
        &currentList_,
        std::shared_ptr<const AutomationList>(std::move(emptyList)),
        std::memory_order_release);
    revision_.store(nextRev, std::memory_order_release);
}

std::vector<AutomationDef> AutomationStore::listAutomations() const {
    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    std::vector<AutomationDef> result;

    result.reserve(current->automations.size());
    for (const auto& [channelName, def] : current->automations) {
        result.push_back(*def);
    }

    return result;
}

bool AutomationStore::retireSnapshot(std::shared_ptr<const AutomationList>& snapshot) {
    if (!snapshot) return true;
    for (size_t i = 0; i < kRetireSlots; i++) {
        uint8_t expected = 0;
        if (retireStates_[i].compare_exchange_strong(
                expected, 1, std::memory_order_acq_rel, std::memory_order_relaxed)) {
            // The control thread cannot inspect this slot until state 2 is
            // published, and state 0 is only published after its reset.
            retireSlots_[i] = std::move(snapshot);
            retireStates_[i].store(2, std::memory_order_release);
            return true;
        }
    }
    // Every slot is occupied (the control thread is stalled). Defer adoption
    // instead of blocking or destroying the active snapshot on the performer.
    inlineRetireCount_.fetch_add(1, std::memory_order_relaxed);
    return false;
}

#ifdef BLUE_ENGINE_TESTING
void AutomationStore::setAutoReclaimPausedForTesting(bool paused) {
    autoReclaimPaused_.store(paused, std::memory_order_release);
}
#endif

void AutomationStore::reclaimRetired() {
#ifdef BLUE_ENGINE_TESTING
    if (autoReclaimPaused_.load(std::memory_order_acquire)) {
        return;
    }
#endif
    std::lock_guard<std::mutex> lock(reclaimMutex_);
    for (size_t i = 0; i < kRetireSlots; i++) {
        if (retireStates_[i].load(std::memory_order_acquire) != 2) {
            continue;
        }
        // destroy on this (control) thread, then release the slot
        retireSlots_[i].reset();
        retireStates_[i].store(0, std::memory_order_release);
    }
}

template<typename F>
void AutomationStore::updateList(F&& modifier) {
    // Deep copy current list (writer lock already held by caller)
    auto current = std::atomic_load_explicit(&currentList_, std::memory_order_acquire);
    auto newList = std::make_shared<AutomationList>(*current);

    modifier(*newList);

    const uint64_t nextRev = revision_.load(std::memory_order_relaxed) + 1;
    newList->revision = nextRev;

    std::atomic_store_explicit(
        &currentList_,
        std::shared_ptr<const AutomationList>(std::move(newList)),
        std::memory_order_release);
    revision_.store(nextRev, std::memory_order_release);
}

}  // namespace blue
