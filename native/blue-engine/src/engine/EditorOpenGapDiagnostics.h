#pragma once

// Editor-open scheduling-gap diagnostics. The perform loop records raw
// k-period observations with O(1) fixed-capacity writes: no allocation, no
// locks, and no per-cycle aggregation on the audio thread. The bounded
// largest-gap summary is assembled on the calling thread at read time, after
// the accumulator snapshot has been handed off at performance stop.

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace blue {

struct EngineSchedulingGapObservation {
  int64_t sampleFrame = 0;
  uint64_t loopDeltaNs = 0;
};

struct EngineNativeGapSummary {
  bool available = false;
  double kPeriodBudgetNs = 0.0;
  double gapThresholdNs = 0.0;
  uint64_t observedCycleCount = 0;
  uint64_t gapCount = 0;
  uint64_t droppedGapObservationCount = 0;
  std::vector<EngineSchedulingGapObservation> largestGaps;
};

class NativeGapAccumulator {
public:
  static constexpr size_t kMaxRawObservations = 64;
  static constexpr size_t kMaxReportedGaps = 8;
  // A gap is a loop delta at or above this multiple of the k-period budget.
  // A delta larger than one budget means the engine fell behind real time;
  // the factor tolerates benign scheduling jitter.
  static constexpr double kGapThresholdFactor = 2.0;

  // Real-time budget of one k-period: ksmps / sampleRate, in nanoseconds.
  // Returns zero when the budget is unknown; unknown budgets never flag gaps.
  static double kPeriodBudgetNs(int32_t ksmps, double sampleRate) {
    if (ksmps <= 0 || sampleRate <= 0.0) {
      return 0.0;
    }
    return (static_cast<double>(ksmps) / sampleRate) * 1e9;
  }

  void reset(double budgetNs) {
    budgetNs_ = budgetNs;
    thresholdNs_ = budgetNs * kGapThresholdFactor;
    observedCycleCount_ = 0;
    gapCount_ = 0;
    recordedCount_ = 0;
    stopped_ = false;
  }

  // Records one measured perform-loop iteration. hasLoopStart is false for
  // the first measured cycle because no previous loop start exists.
  void observeCycle(int64_t sampleFrame, bool hasLoopStart, uint64_t loopDeltaNs) {
    if (!hasLoopStart) {
      return;
    }
    observedCycleCount_ += 1;
    if (thresholdNs_ <= 0.0
        || static_cast<double>(loopDeltaNs) < thresholdNs_) {
      return;
    }
    gapCount_ += 1;
    if (recordedCount_ < kMaxRawObservations) {
      rawObservations_[recordedCount_] = EngineSchedulingGapObservation{
          sampleFrame, loopDeltaNs};
      recordedCount_ += 1;
      return;
    }
    // Retention is full: keep the largest deltas by replacing the smallest
    // retained observation when a larger one arrives. The minimum scan runs
    // only on gap occurrences (rare by definition), is bounded to
    // kMaxRawObservations comparisons, and never allocates or locks.
    size_t minIndex = 0;
    for (size_t index = 1; index < kMaxRawObservations; ++index) {
      if (rawObservations_[index].loopDeltaNs
          < rawObservations_[minIndex].loopDeltaNs) {
        minIndex = index;
      }
    }
    if (loopDeltaNs > rawObservations_[minIndex].loopDeltaNs) {
      rawObservations_[minIndex] = EngineSchedulingGapObservation{
          sampleFrame, loopDeltaNs};
    }
  }

  // Marks the run as stopped; the summary becomes available only after this.
  void finalize() {
    stopped_ = true;
  }

  // Aggregation happens here, on the calling thread - never in the perform
  // loop. Largest gaps are reported in descending delta order, bounded to
  // kMaxReportedGaps entries.
  EngineNativeGapSummary buildSummary() const {
    EngineNativeGapSummary summary;
    summary.available = stopped_;
    summary.kPeriodBudgetNs = budgetNs_;
    summary.gapThresholdNs = thresholdNs_;
    summary.observedCycleCount = observedCycleCount_;
    summary.gapCount = gapCount_;
    // Gaps observed but not retained once the bounded set is full.
    summary.droppedGapObservationCount =
        gapCount_ > recordedCount_ ? gapCount_ - recordedCount_ : 0;

    const size_t count = std::min(recordedCount_, kMaxRawObservations);
    summary.largestGaps.assign(
        rawObservations_.begin(),
        rawObservations_.begin() + static_cast<std::ptrdiff_t>(count));
    std::sort(summary.largestGaps.begin(), summary.largestGaps.end(),
              [](const EngineSchedulingGapObservation &left,
                 const EngineSchedulingGapObservation &right) {
                return left.loopDeltaNs > right.loopDeltaNs;
              });
    if (summary.largestGaps.size() > kMaxReportedGaps) {
      summary.largestGaps.resize(kMaxReportedGaps);
    }
    return summary;
  }

private:
  std::array<EngineSchedulingGapObservation, kMaxRawObservations>
      rawObservations_{};
  double budgetNs_ = 0.0;
  double thresholdNs_ = 0.0;
  uint64_t observedCycleCount_ = 0;
  uint64_t gapCount_ = 0;
  size_t recordedCount_ = 0;
  bool stopped_ = false;
};

} // namespace blue
