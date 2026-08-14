#include "AutomationManager.h"
#include "FixedPoint.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>
#include <utility>

namespace blue {

AutomationManager::AutomationManager(
    const std::shared_ptr<AutomationStore>& store,
    ChannelWriter writer,
    ChannelResolver resolver,
    BindingGenerationProvider bindingGenerationProvider)
    : store_(store),
      writer_(std::move(writer)),
      resolver_(std::move(resolver)),
      bindingGenerationProvider_(std::move(bindingGenerationProvider)) {
}

void AutomationManager::reset() {
    states_.clear();
    activeListSnapshot_.reset();
    cachedSnapshotRevision_ = 0;
    activeAutomations_.clear();
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    activePointCount_ = 0;
    snapshotChangedThisCycle_ = false;
    lastProcessDiagnostics_ = ProcessDiagnostics{};
#endif
}

void AutomationManager::prepareAutomationState(const AutomationDef& def, AutomationState& state) {
    state.segmentCaches.clear();
    state.currentIndex = 0;
    state.completed = false;
    state.lastElapsed = -1.0;
    state.hasLastWrittenValue = false;
    const auto& points = def.points;

    if (points.size() > 1) {
        state.segmentCaches.reserve(points.size() - 1);
        for (size_t i = 0; i < points.size() - 1; ++i) {
            AutomationSegmentCache seg;
            const auto& p0 = points[i];
            const auto& p1 = points[i + 1];
            const double duration = p1.time - p0.time;
            seg.invDuration = (duration > 0.0) ? (1.0 / duration) : 0.0;
            seg.deltaValue = p1.value - p0.value;
            seg.isDescending = (p1.value < p0.value);

            if (def.curve == AutomationCurve::EXPONENTIAL && p0.value > 0.0 && p1.value > 0.0) {
                seg.logRatio = std::log(p1.value / p0.value);
                seg.isPositiveLogValid = true;
            } else {
                seg.logRatio = 0.0;
                seg.isPositiveLogValid = false;
            }
            state.segmentCaches.push_back(seg);
        }
    }

    state.quantCache = QuantizationCache{};
    if (std::isfinite(def.resolution) && def.resolution > 0.0) {
        if (def.highPrecision && def.resolutionScale >= 0 &&
            def.resolutionScale <= 18) {
            state.quantCache.scaleFactor = FixedPoint::getScaleFactor(def.resolutionScale);
            const double scaledResolution =
                def.resolution * static_cast<double>(state.quantCache.scaleFactor);
            if (std::isfinite(scaledResolution) &&
                scaledResolution >= 1.0 &&
                scaledResolution <= static_cast<double>(std::numeric_limits<int64_t>::max())) {
                state.quantCache.scaledResolution = static_cast<int64_t>(
                    std::floor(scaledResolution));
            }
        } else if (!def.highPrecision) {
            const double invResolution = 1.0 / def.resolution;
            if (std::isfinite(invResolution) && invResolution > 0.0) {
                state.quantCache.invResolution = invResolution;
                state.quantCache.isFastQuantizeSafe = true;
            }
        }
    }
}

void AutomationManager::process(int64_t currentSample, double sampleRate) {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    lastProcessDiagnostics_ = ProcessDiagnostics{};
    snapshotChangedThisCycle_ = false;
#endif

    // 1. Check revision gate before touching atomic shared_ptr
    const uint64_t storeRev = store_ ? store_->getRevision() : 0;
    if (storeRev != cachedSnapshotRevision_ || !activeListSnapshot_) {
        auto nextSnapshot = store_ ? store_->getList() : nullptr;
        rebuildActiveAutomations(nextSnapshot);
        cachedSnapshotRevision_ = storeRev;
    }

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    lastProcessDiagnostics_.snapshotChanged = snapshotChangedThisCycle_;
    lastProcessDiagnostics_.activeAutomationCount = activeAutomations_.size();
    lastProcessDiagnostics_.activePointCount = activePointCount_;
#endif

    if (!activeListSnapshot_ || activeAutomations_.empty()) {
        return;
    }

    const double elapsed = static_cast<double>(currentSample) / sampleRate;

    const uint64_t bindingGeneration = bindingGenerationProvider_
        ? bindingGenerationProvider_()
        : 0;

    // 2. Iterate through active automations only
    for (const auto& active : activeAutomations_) {
        const auto& channelName = active.channelName;
        const auto& def = *(active.def);
        auto& state = *(active.state);

        // Check if definition revision changed
        if (state.cachedDefRevision != def.definitionRevision ||
            state.segmentCaches.empty() != (def.points.size() <= 1)) {
            prepareAutomationState(def, state);
            state.cachedDefRevision = def.definitionRevision;
        }

        // Resolve the native channel bridge once per binding generation before
        // the completed-envelope fast path. A live compile can replace the
        // channel storage after an automation has completed; the replacement
        // must receive the final value before later cycles are skipped.
        const bool bindingChanged = resolver_ &&
            (!state.bindingGenerationInitialized ||
             state.cachedBindingGeneration != bindingGeneration);
        if (bindingChanged) {
            state.cachedBindingGeneration = bindingGeneration;
            state.bindingGenerationInitialized = true;
            state.channelPointer = resolver_(channelName);
            state.hasLastWrittenValue = false;
        }

        // 3. Early-out for completed envelope (when time has not moved backward
        // and the channel binding is unchanged).
        if (!bindingChanged && state.completed &&
            elapsed >= def.points.back().time && elapsed >= state.lastElapsed) {
            state.lastElapsed = elapsed;
            continue;
        }

        // Reset cached segment state if time moved backwards or envelope changed
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
        const bool resetTimeBackwards = elapsed < state.lastElapsed;
        const bool resetIndexOutOfRange = state.currentIndex >= def.points.size() - 1;
        const bool resetBeforeSegment =
            !resetIndexOutOfRange && elapsed < def.points[state.currentIndex].time;
        const bool resetCompletedRewind = state.completed && elapsed < def.points.back().time;
        const bool resetState =
            resetTimeBackwards || resetIndexOutOfRange ||
            resetBeforeSegment || resetCompletedRewind;
#else
        const bool resetState =
            elapsed < state.lastElapsed ||
            state.currentIndex >= def.points.size() - 1 ||
            elapsed < def.points[state.currentIndex].time ||
            (state.completed && elapsed < def.points.back().time);
#endif

        if (resetState) {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
            if (resetTimeBackwards) {
                lastProcessDiagnostics_.resetTimeBackwardsCount += 1;
            }
            if (resetIndexOutOfRange) {
                lastProcessDiagnostics_.resetIndexOutOfRangeCount += 1;
            }
            if (resetBeforeSegment) {
                lastProcessDiagnostics_.resetBeforeSegmentCount += 1;
            }
            if (resetCompletedRewind) {
                lastProcessDiagnostics_.resetCompletedRewindCount += 1;
            }
#endif
            state.currentIndex = 0;
            state.completed = false;
            state.hasLastWrittenValue = false;
        }
        state.lastElapsed = elapsed;

        // 4. Interpolate value at current time using precalculated segment and quantization caches
        double value = interpolate(def, state, elapsed);

        // 5. Skip writes when value has not changed (Java API parity behavior)
        uint64_t valueBits = 0;
        uint64_t previousBits = 0;
        std::memcpy(&valueBits, &value, sizeof(value));
        std::memcpy(&previousBits, &state.lastWrittenValue,
                    sizeof(state.lastWrittenValue));
        const bool valueChanged = !state.hasLastWrittenValue ||
            valueBits != previousBits;

        if (valueChanged) {
            if (state.channelPointer) {
                *(state.channelPointer) = value;
            } else if (!resolver_ && writer_) {
                writer_(channelName, value);
            }

            state.lastWrittenValue = value;
            state.hasLastWrittenValue = true;
        }

        // 6. Check if automation has reached the end
        if (elapsed >= def.points.back().time) {
            state.completed = true;
        }
    }
}

void AutomationManager::rebuildActiveAutomations(const std::shared_ptr<const AutomationList>& list) {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    snapshotChangedThisCycle_ = true;
#endif

    activeAutomations_.clear();
    activeListSnapshot_ = list;
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    activePointCount_ = 0;
#endif

    if (!list) {
        states_.clear();
        return;
    }

    pruneStatesForList(list);

    activeAutomations_.reserve(list->automations.size());
    for (const auto& [channelName, def] : list->automations) {
        if (!def.enabled || def.points.empty()) {
            continue;
        }

        auto [stateIt, inserted] = states_.try_emplace(channelName);
        auto& state = stateIt->second;

        if (inserted || state.cachedDefRevision != def.definitionRevision) {
            prepareAutomationState(def, state);
            state.cachedDefRevision = def.definitionRevision;
        }

        activeAutomations_.push_back(ActiveAutomation{channelName, &def, &state});
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
        activePointCount_ += def.points.size();
#endif
    }
}

void AutomationManager::pruneStatesForList(const std::shared_ptr<const AutomationList>& list) {
    if (!list) {
        states_.clear();
        return;
    }

    std::vector<std::string> toRemove;
    toRemove.reserve(states_.size());

    for (const auto& [channelName, state] : states_) {
        auto it = list->automations.find(channelName);
        if (it == list->automations.end() || !it->second.enabled || it->second.points.empty()) {
            toRemove.push_back(channelName);
        }
    }

    for (const auto& name : toRemove) {
        states_.erase(name);
    }
}

double AutomationManager::interpolate(const AutomationDef& def, AutomationState& state, double elapsed) {
    const auto& points = def.points;

    // Handle edge cases
    if (points.empty()) {
        return 0.0;
    }

    if (points.size() == 1) {
        return points[0].value;
    }

    // Before first point: return first value
    if (elapsed <= points[0].time) {
        return points[0].value;
    }

    // After last point: return last value
    if (elapsed >= points.back().time) {
        state.currentIndex = points.size() - 2;
        return points.back().value;
    }

    while (state.currentIndex + 1 < points.size() - 1 &&
           elapsed >= points[state.currentIndex + 1].time) {
        state.currentIndex += 1;
    }

    if (state.currentIndex >= state.segmentCaches.size()) {
        state.currentIndex = state.segmentCaches.size() - 1;
    }

    const auto& p0 = points[state.currentIndex];
    const auto& p1 = points[state.currentIndex + 1];
    const auto& seg = state.segmentCaches[state.currentIndex];

    double t = (elapsed - p0.time) * seg.invDuration;
    t = std::clamp(t, 0.0, 1.0);

    double y = 0.0;

    // Apply interpolation based on curve type
    switch (def.curve) {
        case AutomationCurve::STEP:
            y = (elapsed < p1.time) ? p0.value : p1.value;
            break;

        case AutomationCurve::LINEAR:
            y = p0.value + t * seg.deltaValue;
            break;

        case AutomationCurve::EXPONENTIAL:
            if (seg.isPositiveLogValid) {
                y = p0.value * std::exp(t * seg.logRatio);
            } else {
                // Fallback to linear for non-positive values
                y = p0.value + t * seg.deltaValue;
            }
            break;

        default:
            y = p0.value + t * seg.deltaValue;
            break;
    }

    // Apply resolution-based quantization with downward-slope bias
    if (def.resolution > 0.0) {
        if (def.highPrecision) {
            y = quantizeHighPrecisionCached(y, def.resolution, state.quantCache,
                                             seg.isDescending);
        } else {
            y = quantizeFastCached(y, def.resolution, state.quantCache,
                                   seg.isDescending);
        }
    }

    return y;
}

double AutomationManager::quantizeFast(double y, double resolution, bool isDescending) {
    if (!std::isfinite(resolution) || resolution <= 0.0) {
        return y;
    }

    // Apply downward bias for descending segments (matches Java behavior)
    if (isDescending) {
        y += resolution * 0.99;
    }

    // Simple floor-based quantization using double arithmetic
    double steps = std::floor(y / resolution);
    return steps * resolution;
}

double AutomationManager::quantizeFastCached(
    double y, double resolution, const QuantizationCache& cache,
    bool isDescending) {
    if (!std::isfinite(resolution) || resolution <= 0.0 ||
        !cache.isFastQuantizeSafe) {
        return y;
    }

    if (isDescending) {
        y += resolution * 0.99;
    }

    return std::floor(y * cache.invResolution) * resolution;
}

double AutomationManager::quantizeHighPrecision(double y, double resolution,
                                               int resolutionScale, bool isDescending) {
    if (!std::isfinite(resolution) || resolution <= 0.0 ||
        resolutionScale < 0 || resolutionScale > 18) {
        return y;
    }

    // High-precision path that matches Java BigDecimal.setScale + remainder behavior
    if (isDescending) {
        y += resolution * 0.99;
    }

    FixedPoint yFixed = FixedPoint::fromDoubleFloor(y, resolutionScale);
    FixedPoint resFixed = FixedPoint::fromDoubleFloor(resolution, resolutionScale);

    if (resFixed.unscaledValue() == 0) {
        return y;
    }

    FixedPoint remainder = yFixed.remainder(resFixed);
    FixedPoint quantized = yFixed.subtract(remainder);

    return quantized.toDouble();
}

double AutomationManager::quantizeHighPrecisionCached(
    double y, double resolution, const QuantizationCache& cache,
    bool isDescending) {
    if (!std::isfinite(resolution) || resolution <= 0.0 ||
        cache.scaleFactor <= 0 ||
        cache.scaledResolution <= 0) {
        return y;
    }

    if (isDescending) {
        y += resolution * 0.99;
    }

    const double scaled = std::floor(
        y * static_cast<double>(cache.scaleFactor));
    if (scaled < static_cast<double>(std::numeric_limits<int64_t>::min()) ||
        scaled > static_cast<double>(std::numeric_limits<int64_t>::max())) {
        return y;
    }

    const auto scaledValue = static_cast<int64_t>(scaled);
    const int64_t remainder = scaledValue % cache.scaledResolution;
    const int64_t quantized = scaledValue - remainder;
    return static_cast<double>(quantized) /
           static_cast<double>(cache.scaleFactor);
}

}  // namespace blue
