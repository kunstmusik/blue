#include "AutomationManager.h"
#include "FixedPoint.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <utility>

namespace blue {

AutomationManager::AutomationManager(
    const std::shared_ptr<AutomationStore>& store,
    ChannelWriter writer,
    ChannelResolver resolver)
    : store_(store), writer_(std::move(writer)), resolver_(std::move(resolver)) {
}

void AutomationManager::reset() {
    states_.clear();
    activeListSnapshot_.reset();
    activeAutomations_.clear();
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    activePointCount_ = 0;
    snapshotChangedThisCycle_ = false;
    lastProcessDiagnostics_ = ProcessDiagnostics{};
#endif
}

void AutomationManager::process(int64_t currentSample, double sampleRate) {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    lastProcessDiagnostics_ = ProcessDiagnostics{};
#endif

    // 1. Atomically load the current automation list
    auto list = store_->getList();

    rebuildActiveAutomationsIfNeeded(list);
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    lastProcessDiagnostics_.snapshotChanged = snapshotChangedThisCycle_;
    lastProcessDiagnostics_.activeAutomationCount = activeAutomations_.size();
    lastProcessDiagnostics_.activePointCount = activePointCount_;
#endif

    if (!list || activeAutomations_.empty()) {
        return;
    }

    const double elapsed = static_cast<double>(currentSample) / sampleRate;

    // 2. Iterate through active automations only (enabled with non-empty points)
    for (const auto& active : activeAutomations_) {
        const auto& channelName = active.channelName;
        const auto& def = *(active.def);
        auto& state = *(active.state);

        // Reset cached segment state if time moved backwards or the envelope changed
        // in a way that invalidates the current segment.
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
            state.channelPointer = nullptr;
        }
        state.lastElapsed = elapsed;

        // 4. Interpolate value at current time using the cached segment index.
        double value = interpolate(def, state, elapsed);

        // 5. Resolve the native channel bridge once and write directly on subsequent passes.
        if (!state.channelPointer && resolver_) {
            state.channelPointer = resolver_(channelName);
        }

        // Skip writes when value has not changed (Java API parity behavior).
        const bool valueChanged = !state.hasLastWrittenValue ||
            std::abs(value - state.lastWrittenValue) > std::numeric_limits<double>::epsilon();

        if (valueChanged) {
            if (state.channelPointer) {
                *(state.channelPointer) = value;
            } else if (writer_) {
                writer_(channelName, value);
            }

            state.lastWrittenValue = value;
            state.hasLastWrittenValue = true;
        }

        // 6. Check if automation has completed.
        const auto& lastPoint = def.points.back();
        if (elapsed >= lastPoint.time) {
            state.completed = true;
        }
    }
}

void AutomationManager::rebuildActiveAutomationsIfNeeded(const std::shared_ptr<const AutomationList>& list) {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    snapshotChangedThisCycle_ = false;
#endif

    if (list == activeListSnapshot_) {
        return;
    }

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
        (void)inserted;
        activeAutomations_.push_back(ActiveAutomation{channelName, &def, &stateIt->second});
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

    const auto& p0 = points[state.currentIndex];
    const auto& p1 = points[state.currentIndex + 1];

    double y = 0.0;

    // Apply interpolation based on curve type
    switch (def.curve) {
        case AutomationCurve::STEP:
            // Step: instant jump to next value at the time boundary
            y = (elapsed < p1.time) ? p0.value : p1.value;
            break;

        case AutomationCurve::LINEAR:
            y = interpolateLinear(p0, p1, elapsed);
            break;

        case AutomationCurve::EXPONENTIAL:
            y = interpolateExponential(p0, p1, elapsed);
            break;

        default:
            y = interpolateLinear(p0, p1, elapsed);
            break;
    }

    // Apply resolution-based quantization with downward-slope bias
    if (def.resolution > 0.0) {
        bool isDescending = (p1.value < p0.value);

        if (def.highPrecision) {
            // High-precision path: matches Java BigDecimal behavior exactly
            y = quantizeHighPrecision(y, def.resolution, def.resolutionScale, isDescending);
        } else {
            // Fast path: simple double-based quantization
            y = quantizeFast(y, def.resolution, isDescending);
        }
    }

    return y;
}

double AutomationManager::quantizeFast(double y, double resolution, bool isDescending) {
    // Apply downward bias for descending segments (matches Java behavior)
    if (isDescending) {
        y += resolution * 0.99;
    }

    // Simple floor-based quantization using double arithmetic
    double steps = std::floor(y / resolution);
    return steps * resolution;
}

double AutomationManager::quantizeHighPrecision(double y, double resolution,
                                                 int resolutionScale, bool isDescending) {
    // High-precision path that matches Java BigDecimal.setScale + remainder behavior
    //
    // Java code being matched:
    //   if (b.getY() < a.getY()) {
    //       y += resolution.doubleValue() * 0.99;
    //   }
    //   BigDecimal v = new BigDecimal(y).setScale(resolution.scale(), RoundingMode.FLOOR);
    //   v = v.subtract(v.remainder(resolution));
    //   y = v.doubleValue();

    // Apply downward bias for descending segments
    if (isDescending) {
        y += resolution * 0.99;
    }

    // Convert using FLOOR semantics to mirror new BigDecimal(y).setScale(resolution.scale(), FLOOR)
    FixedPoint yFixed = FixedPoint::fromDoubleFloor(y, resolutionScale);

    // Create resolution as FixedPoint
    FixedPoint resFixed = FixedPoint::fromDoubleFloor(resolution, resolutionScale);

    // Compute remainder and subtract (matches Java v.subtract(v.remainder(resolution)))
    FixedPoint remainder = yFixed.remainder(resFixed);
    FixedPoint quantized = yFixed.subtract(remainder);

    return quantized.toDouble();
}

double AutomationManager::interpolateLinear(
    const AutomationPoint& p0,
    const AutomationPoint& p1,
    double elapsed) {

    // Handle degenerate case
    if (p1.time == p0.time) {
        return p0.value;
    }

    // Linear interpolation: y = y0 + t * (y1 - y0)
    double t = (elapsed - p0.time) / (p1.time - p0.time);
    t = std::clamp(t, 0.0, 1.0);

    return p0.value + t * (p1.value - p0.value);
}

double AutomationManager::interpolateExponential(
    const AutomationPoint& p0,
    const AutomationPoint& p1,
    double elapsed) {

    // Handle degenerate case
    if (p1.time == p0.time) {
        return p0.value;
    }

    // Calculate normalized time parameter
    double t = (elapsed - p0.time) / (p1.time - p0.time);
    t = std::clamp(t, 0.0, 1.0);

    // Handle zero or negative values (fall back to linear)
    // Exponential interpolation only makes sense for positive values
    if (p0.value <= 0.0 || p1.value <= 0.0) {
        return interpolateLinear(p0, p1, elapsed);
    }

    // Exponential interpolation: y = y0 * exp(t * ln(y1/y0))
    //                          or: y = y0 * (y1/y0)^t
    double logRatio = std::log(p1.value / p0.value);
    return p0.value * std::exp(t * logRatio);
}

}  // namespace blue
