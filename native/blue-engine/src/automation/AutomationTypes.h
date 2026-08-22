#pragma once

#include "ExactDecimalQuantizer.h"

#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace blue {

// Represents a single point in an automation curve. Points remain binary64,
// consistent with Java Blue storage.
struct AutomationPoint {
    double time;   // Time in seconds from automation start
    double value;  // Target value at that time

    AutomationPoint() : time(0.0), value(0.0) {}
    AutomationPoint(double t, double v) : time(t), value(v) {}
};

// Interpolation method between automation points
enum class AutomationCurve : uint8_t {
    STEP        = 0x00,  // Instant jump to value (no interpolation)
    LINEAR      = 0x01,  // Linear interpolation (Java Line.getValue parity)
    EXPONENTIAL = 0x02,  // Exponential curve (Blue extension)
};

// Invariant segment math prepared on the control thread when a definition is
// created or updated. LINEAR caches the already-rounded Java-order slope
// (b.value - a.value) / (b.time - a.time); extension curves retain the
// pre-feature inverse-duration and log caches.
struct AutomationSegmentCache {
    double slope = 0.0;        // Java-order linear slope
    double invDuration = 0.0;  // extension-curve normalized time
    double deltaValue = 0.0;   // extension-curve linear fallback
    double logRatio = 0.0;
    bool isPositiveLogValid = false;
    bool isDescending = false;  // Java bias condition: b.value < a.value
};

// Complete automation definition (immutable once published).
//
// All preparation happens on the control thread: exact-decimal parsing,
// quantizer workspace allocation, and segment caches. The performance thread
// adopts a new revision without parsing, allocating, or constructing error
// strings. Only the resolution is exact decimal; points, bounds, and values
// stay binary64, and there is no resolutionScale or highPrecision state.
struct AutomationDef {
    uint32_t id = 0;                       // Unique automation ID
    std::string channelName;               // Target channel (key)
    AutomationCurve curve = AutomationCurve::LINEAR;
    std::vector<AutomationPoint> points;   // Envelope points (ordered by time)
    bool enabled = true;
    std::string resolutionDecimal;         // validated canonical text
    double resolutionDouble = 0.0;         // prepared Java doubleValue()
    std::shared_ptr<const ExactDecimalQuantizer> quantizer;  // null unless active
    std::vector<AutomationSegmentCache> segments;            // empty for <= 1 point
    uint64_t definitionRevision = 1;       // Bumped whenever content changes
};

// Immutable container for all active automations
struct AutomationList {
    // Map channel name -> AutomationDef; each channel has at most one automation
    std::map<std::string, AutomationDef> automations;
    uint64_t revision = 0;

    AutomationList() = default;
    explicit AutomationList(uint64_t rev) : revision(rev) {}
};

// Runtime state maintained by the performance thread: small fixed data plus
// preallocated diagnostic counters; no owned allocations.
struct AutomationState {
    size_t currentIndex;          // Current segment hint (completion bookkeeping)
    bool completed;               // Has reached the end
    double* channelPointer;
    double lastElapsed;
    double lastWrittenValue;
    bool hasLastWrittenValue;
    uint64_t cachedDefRevision;
    uint64_t cachedBindingGeneration;
    bool bindingGenerationInitialized;
    uint64_t invalidEvaluationCount;  // audio-time diagnostic counter (no logging)

    AutomationState()
        : currentIndex(0),
          completed(false),
          channelPointer(nullptr),
          lastElapsed(-1.0),
          lastWrittenValue(0.0),
          hasLastWrittenValue(false),
          cachedDefRevision(0),
          cachedBindingGeneration(0),
          bindingGenerationInitialized(false),
          invalidEvaluationCount(0) {}
};

// Diagnostic categories for definition preparation (mirrors AutomationErrors.h)
enum class AutomationPrepareError {
    Ok,
    InvalidDecimalSyntax,
    DecimalScaleOverflow,
    NonFiniteAutomationInput,
    DecimalWorkspaceUnavailable,
    NotFound,
};

const char* automationPrepareErrorName(AutomationPrepareError error);

/**
 * Prepares a fully formed automation definition on the control thread:
 * parses the exact resolution (Java BigDecimal grammar), prepares the
 * quantizer workspace when the resolution is active (doubleValue() > 0),
 * and builds the invariant segment caches. Returns false (leaving out
 * untouched) on any validation or preparation failure; the caller keeps the
 * previous definition intact in that case.
 */
AutomationPrepareError prepareAutomationDef(uint32_t id,
                                            const std::string& channel,
                                            AutomationCurve curve,
                                            const std::vector<AutomationPoint>& points,
                                            bool enabled,
                                            const std::string& resolutionText,
                                            uint64_t definitionRevision,
                                            AutomationDef& out);

}  // namespace blue
