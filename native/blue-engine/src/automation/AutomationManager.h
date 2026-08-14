#pragma once

#include "AutomationStore.h"
#include "AutomationTypes.h"
#include <functional>
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
#include <cstdint>
#endif
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace blue {

// Handles per-k-cycle processing of automations
// Runs in the Csound performance thread
class AutomationManager {
public:
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    struct ProcessDiagnostics {
        bool snapshotChanged = false;
        size_t activeAutomationCount = 0;
        size_t activePointCount = 0;
        uint32_t resetTimeBackwardsCount = 0;
        uint32_t resetIndexOutOfRangeCount = 0;
        uint32_t resetBeforeSegmentCount = 0;
        uint32_t resetCompletedRewindCount = 0;
    };
#endif

    using ChannelWriter = std::function<void(const std::string&, double)>;
    using ChannelResolver = std::function<double*(const std::string&)>;
    using BindingGenerationProvider = std::function<uint64_t()>;

    AutomationManager(const std::shared_ptr<AutomationStore>& store,
                     ChannelWriter writer,
                     ChannelResolver resolver = {},
                     BindingGenerationProvider bindingGenerationProvider = {});
    ~AutomationManager() = default;

    // Non-copyable
    AutomationManager(const AutomationManager&) = delete;
    AutomationManager& operator=(const AutomationManager&) = delete;

    // Called once per k-cycle, before csoundPerformKsmps()
    void process(int64_t currentSample, double sampleRate);

    // Reset state (called when engine starts or restarts)
    void reset();

    // Standalone quantization helpers (for differential tests and direct invocation)
    static double quantizeFast(double y, double resolution, bool isDescending);
    static double quantizeHighPrecision(double y, double resolution,
                                        int resolutionScale, bool isDescending);

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    const ProcessDiagnostics& getLastProcessDiagnostics() const {
        return lastProcessDiagnostics_;
    }
#endif

private:
    struct ActiveAutomation {
        std::string channelName;
        const AutomationDef* def;
        AutomationState* state;
    };

    // Prepare invariant segment and quantization caches for an automation definition
    static void prepareAutomationState(const AutomationDef& def, AutomationState& state);

    // Interpolation helpers using invariant caches
    double interpolate(const AutomationDef& def, AutomationState& state, double elapsed);
    static double quantizeFastCached(double y, double resolution,
                                     const QuantizationCache& cache,
                                     bool isDescending);
    static double quantizeHighPrecisionCached(double y, double resolution,
                                              const QuantizationCache& cache,
                                              bool isDescending);

    void rebuildActiveAutomations(const std::shared_ptr<const AutomationList>& list);
    void pruneStatesForList(const std::shared_ptr<const AutomationList>& list);

    std::shared_ptr<AutomationStore> store_;
    ChannelWriter writer_;
    ChannelResolver resolver_;
    BindingGenerationProvider bindingGenerationProvider_;

    // Local state map, keyed by channel name
    std::map<std::string, AutomationState> states_;
    std::shared_ptr<const AutomationList> activeListSnapshot_;
    uint64_t cachedSnapshotRevision_ = 0;
    std::vector<ActiveAutomation> activeAutomations_;

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    size_t activePointCount_ = 0;
    bool snapshotChangedThisCycle_ = false;
    ProcessDiagnostics lastProcessDiagnostics_{};
#endif
};

}  // namespace blue
