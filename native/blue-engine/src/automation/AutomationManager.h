#pragma once

#include "AutomationStore.h"
#include "AutomationTypes.h"
#include <array>
#include <functional>
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
#include <cstdint>
#endif
#include <memory>
#include <string>

namespace blue {

// Handles per-k-cycle processing of automations. Runs on the Csound
// performance thread. All preparation (decimal parsing, quantizer workspaces,
// segment caches) happens on the control thread; this class only evaluates
// prepared definitions, keeps small fixed per-channel state, and hands
// retired snapshots back to the store for control-thread reclamation.
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
        uint32_t invalidEvaluationCount = 0;
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

#ifdef BLUE_ENGINE_TESTING
    // Test-only seam for the Java parity corpus. Runtime callers enter through
    // the integer sample boundary above; fixture times are arbitrary binary64
    // values and cannot all be represented as int64 samples at one rate.
    void processAtElapsedTimeForTesting(double elapsed);
#endif

    // Reset state (called when engine starts or restarts)
    void reset();

    // Total audio-time invalid-evaluation diagnostics (non-finite values that
    // could not participate in exact quantization)
    uint64_t totalInvalidEvaluationCount() const { return totalInvalidEvaluationCount_; }

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    const ProcessDiagnostics& getLastProcessDiagnostics() const {
        return lastProcessDiagnostics_;
    }
#endif

private:
    static constexpr size_t kMaxActiveAutomations = 256;

    struct ActiveAutomation {
        const std::string* channelName = nullptr;
        const AutomationDef* def = nullptr;
        AutomationState state{};
    };

    // Java Line.getValue(double) evaluation over a prepared definition.
    // Sets valid=false when a non-finite value blocks exact quantization; the
    // caller keeps the last written channel value and counts a diagnostic.
    double evaluate(const AutomationDef& def, AutomationState& state, double elapsed,
                    bool& valid);

    void processElapsed(double elapsed);

    void rebuildActiveAutomations(const std::shared_ptr<const AutomationList>& list);

    std::shared_ptr<AutomationStore> store_;
    ChannelWriter writer_;
    ChannelResolver resolver_;
    BindingGenerationProvider bindingGenerationProvider_;

    std::shared_ptr<const AutomationList> activeListSnapshot_;
    uint64_t cachedSnapshotRevision_ = 0;
    std::array<ActiveAutomation, kMaxActiveAutomations> activeAutomations_{};
    std::array<AutomationState, kMaxActiveAutomations> previousStates_{};
    std::array<const std::string*, kMaxActiveAutomations> previousChannelNames_{};
    size_t activeAutomationCount_ = 0;
    uint64_t totalInvalidEvaluationCount_ = 0;

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    size_t activePointCount_ = 0;
    bool snapshotChangedThisCycle_ = false;
    ProcessDiagnostics lastProcessDiagnostics_{};
#endif
};

}  // namespace blue
