// Editor-open scheduling-gap diagnostics tests. The accumulator is pure
// logic, so the budget/threshold/retention behavior is exercised directly;
// including CsoundEngine.h additionally gates the engine integration on the
// performance-tracking build.

#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <vector>

#include "../../src/engine/EditorOpenGapDiagnostics.h"
#include "../../src/engine/CsoundEngine.h"

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING

namespace {

constexpr int32_t kKsmps = 32;
constexpr double kSampleRate = 48000.0;

double budgetNs() {
  return blue::NativeGapAccumulator::kPeriodBudgetNs(kKsmps, kSampleRate);
}

void testBudgetCalculation() {
  // 32 / 48000 seconds = 666.67us per k-period.
  const double expected = (static_cast<double>(kKsmps) / kSampleRate) * 1e9;
  assert(std::abs(budgetNs() - expected) < 1e-6);
  assert(std::abs(budgetNs() - 666666.6666666666) < 0.01);

  // Unknown budgets resolve to zero and never flag gaps.
  assert(blue::NativeGapAccumulator::kPeriodBudgetNs(0, kSampleRate) == 0.0);
  assert(blue::NativeGapAccumulator::kPeriodBudgetNs(-1, kSampleRate) == 0.0);
  assert(blue::NativeGapAccumulator::kPeriodBudgetNs(kKsmps, 0.0) == 0.0);
}

void testThresholdRelativeDetection() {
  blue::NativeGapAccumulator gaps;
  gaps.reset(budgetNs());

  const double threshold = budgetNs() * blue::NativeGapAccumulator::kGapThresholdFactor;
  const uint64_t justBelowNs = static_cast<uint64_t>(threshold);
  const uint64_t justAboveNs = justBelowNs + 1;

  // At or above budget * factor is a gap; below is not.
  gaps.observeCycle(0, false, 0); // first cycle: no loop start, never counted
  gaps.observeCycle(1 * kKsmps, true, justBelowNs / 2);
  gaps.observeCycle(2 * kKsmps, true, justBelowNs);
  gaps.observeCycle(3 * kKsmps, true, justAboveNs);
  gaps.observeCycle(4 * kKsmps, true, justAboveNs * 4);

  const blue::EngineNativeGapSummary summary = gaps.buildSummary();
  assert(!summary.available); // not stopped yet
  assert(summary.observedCycleCount == 4);
  assert(summary.gapCount == 2);
  assert(summary.kPeriodBudgetNs == budgetNs());
  assert(summary.gapThresholdNs == threshold);
  assert(summary.largestGaps.size() == 2);
  assert(summary.largestGaps[0].sampleFrame == 4 * kKsmps);
  assert(summary.largestGaps[0].loopDeltaNs == justAboveNs * 4);
  assert(summary.largestGaps[1].sampleFrame == 3 * kKsmps);
}

void testUnknownBudgetNeverFlags() {
  blue::NativeGapAccumulator gaps;
  gaps.reset(0.0);
  for (int i = 0; i < 10; ++i) {
    gaps.observeCycle(i * kKsmps, i > 0, UINT64_MAX);
  }
  const blue::EngineNativeGapSummary summary = gaps.buildSummary();
  gaps.finalize();
  assert(summary.gapCount == 0);
  assert(summary.observedCycleCount == 9);
  assert(summary.largestGaps.empty());
}

void testStopTimeEmission() {
  blue::NativeGapAccumulator gaps;
  gaps.reset(budgetNs());
  gaps.observeCycle(0, false, 0);
  gaps.observeCycle(kKsmps, true, static_cast<uint64_t>(budgetNs() * 3));

  blue::EngineNativeGapSummary before = gaps.buildSummary();
  assert(!before.available);

  gaps.finalize();
  const blue::EngineNativeGapSummary after = gaps.buildSummary();
  assert(after.available);
  assert(after.gapCount == 1);
  assert(after.observedCycleCount == 1);
  assert(after.largestGaps.size() == 1);
  assert(after.largestGaps[0].loopDeltaNs == static_cast<uint64_t>(budgetNs() * 3));
}

void testBoundedRetentionAndAggregation() {
  blue::NativeGapAccumulator gaps;
  gaps.reset(budgetNs());

  const uint64_t baseGapNs = static_cast<uint64_t>(
      budgetNs() * blue::NativeGapAccumulator::kGapThresholdFactor);

  // Ten huge gaps arrive first, then far more small (but above-threshold)
  // gaps. Largest-gap retention must keep reporting the huge early gaps.
  constexpr int kHugeGaps = 10;
  constexpr int kSmallGaps = 500;
  for (int index = 0; index < kHugeGaps; ++index) {
    const int64_t frame = static_cast<int64_t>(index + 1) * kKsmps;
    const uint64_t deltaNs = baseGapNs * 100 - static_cast<uint64_t>(index);
    gaps.observeCycle(frame, true, deltaNs);
  }
  for (int index = 0; index < kSmallGaps; ++index) {
    const int64_t frame = static_cast<int64_t>(kHugeGaps + index + 1) * kKsmps;
    gaps.observeCycle(frame, true, baseGapNs + static_cast<uint64_t>(index % 7));
  }

  gaps.finalize();
  const blue::EngineNativeGapSummary summary = gaps.buildSummary();

  assert(summary.available);
  assert(summary.observedCycleCount == static_cast<uint64_t>(kHugeGaps + kSmallGaps));
  assert(summary.gapCount == static_cast<uint64_t>(kHugeGaps + kSmallGaps));

  // Bounded retention: exactly kMaxRawObservations deltas kept, the rest
  // reported as dropped.
  assert(summary.droppedGapObservationCount
         == static_cast<uint64_t>(kHugeGaps + kSmallGaps
                                  - blue::NativeGapAccumulator::kMaxRawObservations));

  // Bounded largest-gap reporting: at most kMaxReportedGaps, descending, and
  // the huge early gaps outrank every later small gap.
  assert(summary.largestGaps.size() == blue::NativeGapAccumulator::kMaxReportedGaps);
  for (size_t i = 1; i < summary.largestGaps.size(); ++i) {
    assert(summary.largestGaps[i - 1].loopDeltaNs >= summary.largestGaps[i].loopDeltaNs);
  }
  for (int index = 0; index < blue::NativeGapAccumulator::kMaxReportedGaps; ++index) {
    assert(summary.largestGaps[static_cast<size_t>(index)].loopDeltaNs
           == baseGapNs * 100 - static_cast<uint64_t>(index));
    assert(summary.largestGaps[static_cast<size_t>(index)].sampleFrame
           == static_cast<int64_t>(index + 1) * kKsmps);
  }

  // Reset clears everything, including availability.
  gaps.reset(budgetNs());
  const blue::EngineNativeGapSummary reset = gaps.buildSummary();
  assert(!reset.available);
  assert(reset.gapCount == 0);
  assert(reset.observedCycleCount == 0);
  assert(reset.largestGaps.empty());
}

} // namespace

int main() {
  static_assert(BLUE_ENGINE_USE_PERFORMANCE_TRACKING == 1);
  static_assert(blue::NativeGapAccumulator::kMaxReportedGaps
                <= blue::NativeGapAccumulator::kMaxRawObservations);

  testBudgetCalculation();
  testThresholdRelativeDetection();
  testUnknownBudgetNeverFlags();
  testStopTimeEmission();
  testBoundedRetentionAndAggregation();

  std::cout << "Editor-open diagnostics tests passed\n";
  return 0;
}

#else

int main() {
  // Performance tracking is disabled; the behavior tests are compile-gated.
  std::cout << "Editor-open diagnostics tests skipped (tracking disabled)\n";
  return 77;
}

#endif
