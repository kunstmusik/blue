#pragma once

#include "csound/CsoundTypes.h"
#include "EditorOpenGapDiagnostics.h"
#include "RealtimeChannelMailbox.h"
#include <array>
#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <thread>
#include <vector>

namespace blue {

class SharedMemory;
struct ChannelEntry;
class AutomationStore;
class AutomationManager;

static_assert(std::atomic<uint64_t>::is_always_lock_free,
              "Snapshot generation counter must be always lock-free on all target platforms");
static_assert(std::atomic<double>::is_always_lock_free,
              "ChannelEntry atomic double value must be always lock-free on all target platforms");

enum class EngineLifecycleState : uint8_t {
  EMPTY = 0,
  READY = 1,
  RUNNING = 2,
  STOPPED = 3,
};

enum class EngineStopReason : uint8_t {
  NONE = 0,
  COMPLETED = 1,
  STOP_REQUESTED = 2,
  DESTROYED = 3,
  FAILED = 4,
};

struct EngineStateSnapshot {
  EngineLifecycleState state = EngineLifecycleState::EMPTY;
  EngineStopReason stopReason = EngineStopReason::NONE;
  bool engineCreated = false;
  bool running = false;
  int64_t sampleFrames = 0;
  double sampleRate = 0.0;
  int32_t ksmps = 0;
  uint64_t sequence = 0;
  std::string lastError;
};

struct EnginePerformanceSummary {
  bool available = false;
  uint64_t cycleCount = 0;
  double automationAvgUs = 0.0;
  double automationP95Us = 0.0;
  double automationMaxUs = 0.0;
  double performAvgUs = 0.0;
  double performP95Us = 0.0;
  double performMaxUs = 0.0;
  double sharedMemoryAvgUs = 0.0;
  double sharedMemoryP95Us = 0.0;
  double sharedMemoryMaxUs = 0.0;
  double hostAvgUs = 0.0;
  double hostP95Us = 0.0;
  double hostMaxUs = 0.0;
  uint64_t automationSpikeCount = 0;
  uint64_t performSpikeCount = 0;
  uint64_t sharedMemorySpikeCount = 0;
  uint64_t hostSpikeCount = 0;
};

struct ShmMirrorBinding {
  double *pointer = nullptr;
  ChannelEntry *sharedMemoryEntry = nullptr;
};

struct ControlChannelState {
  int32_t type = 0;
  double *pointer = nullptr;
  ChannelEntry *sharedMemoryEntry = nullptr;
};

struct RuntimeChannelBindingSnapshot {
  std::unordered_map<std::string, ControlChannelState> controlChannels;
  std::vector<ShmMirrorBinding> mirrorBindings;
  uint64_t bindingGeneration = 0;

  RuntimeChannelBindingSnapshot() = default;
  explicit RuntimeChannelBindingSnapshot(uint64_t gen) : bindingGeneration(gen) {}
};

// Sanitized per-channel meter values captured from the Csound control
// channels. Immutable once published; publication threads only ever read
// these value copies, never the live channel memory.
struct MeterChannelValues {
  std::string csdKey;
  std::vector<double> rms;
  std::vector<double> peak;
};

// Race-safe meter telemetry handoff: the perform thread samples the meter
// control channels after each completed k-cycle (on the same thread as the
// Csound writes, so no unsynchronized read of the audio path exists) and
// swaps an immutable snapshot in for publication threads at a bounded rate.
struct MeterValuesSnapshot {
  uint64_t captureCount = 0;
  int64_t sampleFrames = -1;
  int32_t nchnls = 0;
  std::vector<MeterChannelValues> channels;
};

class CsoundEngine {
public:
  using StateChangeCallback = std::function<void(const EngineStateSnapshot &)>;

  CsoundEngine();
  ~CsoundEngine();

  // Set shared memory used as a read mirror for control channels.
  void setSharedMemory(SharedMemory *shm) { shm_ = shm; }

  // Get automation store (for ZMQ handler)
  std::shared_ptr<AutomationStore> getAutomationStore() { return automationStore_; }

  // Get runtime channel binding generation and snapshot
  uint64_t getChannelBindingGeneration() const {
    return channelBindingGeneration_.load(std::memory_order_acquire);
  }
  std::shared_ptr<const RuntimeChannelBindingSnapshot> getChannelBindings() const {
    return std::atomic_load_explicit(&runtimeChannelBindings_, std::memory_order_acquire);
  }

  // Latest sanitized meter value snapshot captured by the perform thread, or
  // null when no metered performance has run. Safe to call from any thread.
  std::shared_ptr<const MeterValuesSnapshot> getMeterValuesSnapshot() const;

  // True while the current channel bindings contain meter tap channels.
  // Mirrors the perform-thread layout state for cheap cross-thread polling.
  bool hasMeterChannels() const {
    return meterChannelsPresent_.load(std::memory_order_acquire);
  }

  // Non-copyable
  CsoundEngine(const CsoundEngine &) = delete;
  CsoundEngine &operator=(const CsoundEngine &) = delete;

  // Core API
  bool create();
  void destroy();

  bool setOption(const std::string &option);
  bool compileOrc(const std::string &orc);
  bool readScore(const std::string &sco);
  bool createChannel(const std::string &name, double initialValue);
  bool setChannel(const std::string &name, double value);
  bool setChannels(const std::vector<std::pair<std::string, double>> &entries);
  bool getChannel(const std::string &name, double &value);
  bool getChannels(const std::vector<std::string> &names,
                   std::vector<double> &values);

  bool start();
  void stop();

  void setThreadPriorityElevationEnabled(bool enabled) {
    threadPriorityElevationEnabled_ = enabled;
  }

  // Configure the optional performance-tracking window. The first
  // warmupCycles are discarded; the following measuredCycles are reported.
  // A measuredCycles value of zero records the complete performance.
  void setPerformanceWindow(uint64_t warmupCycles, uint64_t measuredCycles) {
    performanceWarmupCycles_ = warmupCycles;
    performanceMeasuredCycles_ = measuredCycles;
  }

  bool isRunning() const { return running_.load(std::memory_order_relaxed); }

  std::string getLastError() const;
  EngineStateSnapshot getStateSnapshot() const;
  EnginePerformanceSummary getLastPerformanceSummary() const;
  EngineNativeGapSummary getLastNativeGapSummary() const;
  void setStateChangeCallback(StateChangeCallback callback);

  // Hot-path allocation assertion hook for tests/verification (FR-014, T050).
  inline static thread_local bool t_trapCaptureAllocations = false;
  inline static thread_local uint64_t t_trappedCaptureAllocations = 0;
  uint64_t getCaptureHotPathAllocationCount() const {
    return captureHotPathAllocationCount_.load(std::memory_order_relaxed);
  }

private:
  std::atomic<uint64_t> captureHotPathAllocationCount_{0};
  void performThread();
  bool rebuildControlChannelCache();
  void clearControlChannelCache();
  void applyPendingChannelValues();
  void consumePendingChannelBatch();
  void syncSharedMemoryFromChannels();
  void syncSharedMemoryFromChannels(
      std::shared_ptr<const RuntimeChannelBindingSnapshot> &cachedBindings,
      uint64_t &cachedGeneration);
  void syncSharedMemoryFromBindings(
      const RuntimeChannelBindingSnapshot *bindings);
  void mirrorChannelValue(const std::string &name, double value);
  double *findControlChannelPointer(const std::string &name);
  bool hasActiveAutomation(const std::string &name) const;
  void rebuildMeterLayout(const RuntimeChannelBindingSnapshot *bindings);
  void captureMeterValuesIfDue(
      int64_t localSample, double sampleRate,
      std::shared_ptr<const RuntimeChannelBindingSnapshot> &cachedBindings,
      uint64_t &cachedGeneration);
  void resumePerformThread();
  void joinPerformThread(bool preservePerformanceState);
  void setLastError(const std::string &message);
  void clearLastError();
  void transitionState(EngineLifecycleState state, EngineStopReason stopReason,
                       const std::string &lastError = "");
  void publishStateSnapshot(const EngineStateSnapshot &snapshot);

  csound::CSOUND *csound_ = nullptr;
  SharedMemory *shm_ = nullptr;
  std::atomic<bool> running_{false};
  std::atomic<bool> shouldStop_{false};
  std::atomic<bool> preservePerformanceState_{false};
  std::thread performThread_;
  std::atomic<int64_t> sampleNumber_{0};
  bool threadPriorityElevationEnabled_ = true;

  // Automation system
  std::shared_ptr<AutomationStore> automationStore_;
  std::unique_ptr<AutomationManager> automationManager_;
  mutable std::mutex lifecycleMutex_;
  std::atomic<uint64_t> channelBindingGeneration_{1};
  std::shared_ptr<const RuntimeChannelBindingSnapshot> runtimeChannelBindings_;

  // Meter telemetry layout and bounded lock-free handoff (FR-014, T050).
  // The layout setup and slot preallocation happen on the control thread
  // before perform starts; capture on the perform thread writes into the
  // preallocated triple-buffer slot and swaps via atomic CAS with zero
  // allocations, zero locking, zero reclamation, and zero string/vector copies.
  struct MeterChannelPointerGroup {
    std::string csdKey;
    std::vector<double *> rmsPointers;
    std::vector<double *> peakPointers;
  };
  std::vector<MeterChannelPointerGroup> meterLayout_;
  static constexpr size_t kMeterBufferSlots = 3;
  std::array<MeterValuesSnapshot, kMeterBufferSlots> meterBufferSlots_;
  // Lock-free triple-buffer state:
  // Bits 0-1: middle slot index (0..2)
  // Bit 2: hasNew flag (1 if middle slot has new unread data)
  mutable std::atomic<uint32_t> meterBufferState_{2};
  uint32_t meterWriteSlot_ = 0;
  mutable uint32_t meterReadSlot_ = 1;
  uint64_t meterCaptureCount_ = 0;
  mutable std::mutex meterReaderMutex_;
  mutable std::shared_ptr<const MeterValuesSnapshot> cachedReaderSnapshot_;
  std::atomic<bool> meterChannelsPresent_{false};
  int32_t meterLayoutNchnls_ = 0;
  int64_t lastMeterCaptureSampleFrames_ = -1;
  uint64_t lastMeterLayoutGeneration_ = 0;
  std::unordered_map<std::string, double> pendingChannelValues_;
  std::unique_ptr<RealtimeChannelMailbox> channelMailbox_;
  mutable std::mutex stateMutex_;
  EngineLifecycleState state_ = EngineLifecycleState::EMPTY;
  EngineStopReason stopReason_ = EngineStopReason::NONE;
  double sampleRate_ = 0.0;
  int32_t ksmps_ = 0;
  uint64_t stateSequence_ = 0;
  std::string lastError_;
  mutable std::mutex performanceMutex_;
  EnginePerformanceSummary lastPerformanceSummary_{};
  // Editor-open scheduling-gap diagnostics. The perform thread keeps its
  // accumulator function-local during the run and hands a snapshot over under
  // performanceMutex_ at performance stop; getLastNativeGapSummary() does the
  // aggregation on the calling thread, never inside the perform loop.
  NativeGapAccumulator nativeGapAccumulatorSnapshot_;
  uint64_t performanceWarmupCycles_ = 0;
  uint64_t performanceMeasuredCycles_ = 0;
  mutable std::mutex callbackMutex_;
  StateChangeCallback stateChangeCallback_;
};

} // namespace blue
