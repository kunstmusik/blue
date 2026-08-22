#include "AutomationManager.h"

#include <algorithm>
#include <cmath>
#include <cstring>
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
    // The lifecycle caller joins the Csound perform thread before resetting
    // this manager. Releasing the active snapshot here is therefore control-
    // thread work and does not need an audio-time retirement handoff.
    activeListSnapshot_.reset();
    cachedSnapshotRevision_ = 0;
    activeAutomationCount_ = 0;
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    activePointCount_ = 0;
    snapshotChangedThisCycle_ = false;
    lastProcessDiagnostics_ = ProcessDiagnostics{};
#endif
}

void AutomationManager::process(int64_t currentSample, double sampleRate) {
    processElapsed(static_cast<double>(currentSample) / sampleRate);
}

#ifdef BLUE_ENGINE_TESTING
void AutomationManager::processAtElapsedTimeForTesting(double elapsed) {
    processElapsed(elapsed);
}
#endif

void AutomationManager::processElapsed(double elapsed) {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    lastProcessDiagnostics_ = ProcessDiagnostics{};
    snapshotChangedThisCycle_ = false;
#endif

    // 1. Check revision gate before touching atomic shared_ptr
    const uint64_t storeRev = store_ ? store_->getRevision() : 0;
    if (storeRev != cachedSnapshotRevision_ || !activeListSnapshot_) {
        // If the control thread has not reclaimed a previous snapshot, defer
        // this revision adoption. Keeping the old active list is safe because
        // it remains immutable; importantly, no shared_ptr destruction occurs
        // on the performance thread when the fixed retirement ring is full.
        if (activeListSnapshot_ && store_ && !store_->retireSnapshot(activeListSnapshot_)) {
            return;
        }

        auto nextSnapshot = store_ ? store_->getList() : nullptr;
        // Build the fixed runtime slots after the old snapshot has been handed
        // to a reclamation slot. The slot keeps all referenced strings alive
        // while the audio-thread state is rebuilt.
        rebuildActiveAutomations(nextSnapshot);
        activeListSnapshot_ = std::move(nextSnapshot);
        cachedSnapshotRevision_ = storeRev;
    }

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    lastProcessDiagnostics_.snapshotChanged = snapshotChangedThisCycle_;
    lastProcessDiagnostics_.activeAutomationCount = activeAutomationCount_;
    lastProcessDiagnostics_.activePointCount = activePointCount_;
#endif

    if (!activeListSnapshot_ || activeAutomationCount_ == 0) {
        return;
    }

    const uint64_t bindingGeneration = bindingGenerationProvider_
        ? bindingGenerationProvider_()
        : 0;

    // 2. Iterate through active automations only
    for (size_t activeIndex = 0; activeIndex < activeAutomationCount_; ++activeIndex) {
        auto& active = activeAutomations_[activeIndex];
        const auto& channelName = *active.channelName;
        const auto& def = *(active.def);
        auto& state = active.state;

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

        // 3. Early-out for completed envelope (when time has not moved
        // backward and the channel binding is unchanged).
        if (!bindingChanged && state.completed &&
            elapsed >= def.points.back().time && elapsed >= state.lastElapsed) {
            state.lastElapsed = elapsed;
            continue;
        }

        // Reset cached state if time moved backwards
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
        const bool resetTimeBackwards = elapsed < state.lastElapsed;
        const bool resetCompletedRewind = state.completed && elapsed < def.points.back().time;
        const bool resetState = resetTimeBackwards || resetCompletedRewind;
        if (resetTimeBackwards) {
            lastProcessDiagnostics_.resetTimeBackwardsCount += 1;
        }
        if (resetCompletedRewind) {
            lastProcessDiagnostics_.resetCompletedRewindCount += 1;
        }
#else
        const bool resetState =
            elapsed < state.lastElapsed ||
            (state.completed && elapsed < def.points.back().time);
#endif
        if (resetState) {
            state.completed = false;
            state.hasLastWrittenValue = false;
        }
        state.lastElapsed = elapsed;

        // 4. Java-order evaluation with exact quantization
        bool valid = true;
        const double value = evaluate(def, state, elapsed, valid);
        if (!valid) {
            // audio-time diagnostic: keep the last channel value, count, and
            // perform no formatting, logging, or allocation
            state.invalidEvaluationCount += 1;
            totalInvalidEvaluationCount_ += 1;
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
            lastProcessDiagnostics_.invalidEvaluationCount += 1;
#endif
            if (elapsed >= def.points.back().time) {
                state.completed = true;
            }
            continue;
        }

        // 5. Skip writes when value has not changed (Java API parity behavior)
        uint64_t valueBits = 0;
        uint64_t previousBits = 0;
        std::memcpy(&valueBits, &value, sizeof(valueBits));
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

double AutomationManager::evaluate(const AutomationDef& def, AutomationState& state,
                                   double elapsed, bool& valid) {
    const auto& points = def.points;

    // Java Line.getValue(double): early returns for the empty line, single
    // points, and time zero (Java compares time == 0.0, so -0.0 also matches)
    const size_t size = points.size();
    if (size == 0) {
        return 0.0;
    }
    const AutomationPoint& first = points[0];
    if (size == 1 || elapsed == 0.0) {
        return first.value;
    }

    size_t aIndex = 0;
    std::ptrdiff_t bIndex = -1;
    for (size_t i = 1; i < size; i++) {
        const AutomationPoint& candidate = points[i];
        if (candidate.time == elapsed) {
            if (i == size - 1) {
                return candidate.value;
            }
            // last point of the same-time run wins
            while (i < size) {
                const AutomationPoint& temp = points[i];
                if (temp.time != elapsed) {
                    break;
                }
                bIndex = static_cast<std::ptrdiff_t>(i);
                i++;
            }
            return points[static_cast<size_t>(bIndex)].value;
        }
        if (candidate.time < elapsed) {
            aIndex = i;
        } else {
            bIndex = static_cast<std::ptrdiff_t>(i);
            break;
        }
    }
    if (bIndex == -1) {
        // time at or beyond the last point (Java: b == a after the loop)
        state.currentIndex = size - 1;
        return points[size - 1].value;
    }
    const auto boundedB = static_cast<size_t>(bIndex);
    if (boundedB == aIndex) {
        return points[boundedB].value;
    }

    const AutomationPoint& a = points[aIndex];
    const AutomationPoint& b = points[boundedB];
    const AutomationSegmentCache& seg = def.segments[aIndex];

    double y = 0.0;
    switch (def.curve) {
        case AutomationCurve::STEP:
            // extension curve: pre-feature formula on the Java-selected segment
            y = (elapsed < b.time) ? a.value : b.value;
            break;

        case AutomationCurve::LINEAR: {
            // Java operation order with the prepared, already-rounded slope;
            // this unit is compiled with floating-point contraction disabled
            const double x = elapsed - a.time;
            y = seg.slope * x + a.value;
            break;
        }

        case AutomationCurve::EXPONENTIAL: {
            // extension curve: pre-feature formula, then exact quantization
            double t = (elapsed - a.time) * seg.invDuration;
            t = std::clamp(t, 0.0, 1.0);
            if (seg.isPositiveLogValid) {
                y = a.value * std::exp(t * seg.logRatio);
            } else {
                y = a.value + t * seg.deltaValue;
            }
            break;
        }

        default: {
            const double x = elapsed - a.time;
            y = seg.slope * x + a.value;
            break;
        }
    }

    // Java quantization activation and descending bias
    if (def.resolutionDouble > 0.0) {
        if (b.value < a.value) {
            y += def.resolutionDouble * 0.99;
        }
        double quantized = 0.0;
        if (!def.quantizer || !def.quantizer->quantize(y, &quantized)) {
            valid = false;
            return state.lastWrittenValue;
        }
        y = quantized;
    }

    state.currentIndex = boundedB;
    return y;
}

void AutomationManager::rebuildActiveAutomations(const std::shared_ptr<const AutomationList>& list) {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    snapshotChangedThisCycle_ = true;
#endif

    const size_t previousCount = activeAutomationCount_;
    for (size_t i = 0; i < previousCount; ++i) {
        previousStates_[i] = activeAutomations_[i].state;
        previousChannelNames_[i] = activeAutomations_[i].channelName;
    }
    activeAutomationCount_ = 0;
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    activePointCount_ = 0;
#endif

    if (!list) {
        return;
    }

    for (const auto& [channelName, def] : list->automations) {
        if (!def.enabled || def.points.empty()) {
            continue;
        }

        // The shared-memory channel bridge exposes at most 256 channels. Keep
        // the same fixed bound here so adopting a definition never grows an
        // audio-thread container. A control-plane caller can still retain the
        // definition; it simply cannot become an active perform slot.
        if (activeAutomationCount_ >= kMaxActiveAutomations) {
            continue;
        }

        AutomationState state;
        for (size_t previousIndex = 0; previousIndex < previousCount; ++previousIndex) {
            const auto* previousName = previousChannelNames_[previousIndex];
            if (previousName && *previousName == channelName) {
                state = previousStates_[previousIndex];
                break;
            }
        }
        if (state.cachedDefRevision != 0 && state.cachedDefRevision != def.definitionRevision) {
            // A same-channel update keeps the binding, but its envelope and
            // completion state are no longer valid. The old implementation
            // rebuilt these fields when the definition revision changed; do
            // the equivalent reset here without allocating on the performer.
            state.currentIndex = 0;
            state.completed = false;
            state.lastElapsed = -1.0;
            state.lastWrittenValue = 0.0;
            state.hasLastWrittenValue = false;
            state.invalidEvaluationCount = 0;
        }
        state.cachedDefRevision = def.definitionRevision;
        activeAutomations_[activeAutomationCount_] = ActiveAutomation{
            &channelName, &def, state};
        activeAutomationCount_ += 1;
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
        activePointCount_ += def.points.size();
#endif
    }
}

}  // namespace blue
