#pragma once

#include <cstdint>
#include <map>
#include <string>
#include <vector>
#include "FixedPoint.h"

namespace blue {

// Represents a single point in an automation curve
struct AutomationPoint {
    double time;   // Time in seconds from automation start
    double value;  // Target value at this time

    AutomationPoint() : time(0.0), value(0.0) {}
    AutomationPoint(double t, double v) : time(t), value(v) {}
};

// Interpolation method between automation points
enum class AutomationCurve : uint8_t {
    STEP        = 0x00,  // Instant jump to value (no interpolation)
    LINEAR      = 0x01,  // Linear interpolation
    EXPONENTIAL = 0x02,  // Exponential curve
};

// Complete automation definition (immutable)
struct AutomationDef {
    uint32_t id;                           // Unique automation ID
    std::string channelName;               // Target channel (key)
    AutomationCurve curve;                 // Interpolation type
    std::vector<AutomationPoint> points;   // Envelope points (sorted by time)
    bool enabled;                          // Currently active
    double resolution;                     // Quantization step size (0 = no quantization)
    int resolutionScale;                   // Decimal scale for resolution (e.g., 1 for 0.1, 2 for 0.01)
    bool highPrecision;                    // Use bounded Java-compatible fixed-point quantization
    uint64_t definitionRevision;           // Incremented whenever points/curve/resolution change

    AutomationDef()
        : id(0), curve(AutomationCurve::LINEAR), enabled(true),
          resolution(0.0), resolutionScale(0), highPrecision(false),
          definitionRevision(1) {}

    AutomationDef(uint32_t autoId, const std::string& channel,
                  AutomationCurve curveType,
                  const std::vector<AutomationPoint>& pts,
                  bool isEnabled = true,
                  double res = 0.0,
                  int resScale = 0,
                  bool highPrec = false,
                  uint64_t defRev = 1)
        : id(autoId), channelName(channel), curve(curveType),
          points(pts), enabled(isEnabled), resolution(res),
          resolutionScale(resScale), highPrecision(highPrec),
          definitionRevision(defRev) {}
};

// Immutable container for all active automations
struct AutomationList {
    // Map channel name -> AutomationDef
    // Each channel can have at most one automation
    std::map<std::string, AutomationDef> automations;
    uint64_t revision = 0;

    AutomationList() = default;
    explicit AutomationList(uint64_t rev) : revision(rev) {}
};

// Invariant segment math precalculated when an automation definition is prepared
struct AutomationSegmentCache {
    double invDuration = 0.0;
    double deltaValue = 0.0;
    double logRatio = 0.0;
    bool isPositiveLogValid = false;
    bool isDescending = false;
};

// Invariant quantization parameters precalculated when an automation definition is prepared
struct QuantizationCache {
    int64_t scaleFactor = 1;
    int64_t scaledResolution = 0;
    double invResolution = 0.0;
    bool isFastQuantizeSafe = false;
};

// Runtime state maintained by the performance thread
struct AutomationState {
    size_t currentIndex;   // Current segment index (optimization)
    bool completed;        // Has reached the end
    double* channelPointer;
    double lastElapsed;
    double lastWrittenValue;
    bool hasLastWrittenValue;
    uint64_t cachedDefRevision;
    uint64_t cachedBindingGeneration;
    bool bindingGenerationInitialized;
    std::vector<AutomationSegmentCache> segmentCaches;
    QuantizationCache quantCache;

    AutomationState()
        : currentIndex(0),
          completed(false),
          channelPointer(nullptr),
          lastElapsed(-1.0),
          lastWrittenValue(0.0),
          hasLastWrittenValue(false),
          cachedDefRevision(0),
          cachedBindingGeneration(0),
          bindingGenerationInitialized(false) {}
};

}  // namespace blue
