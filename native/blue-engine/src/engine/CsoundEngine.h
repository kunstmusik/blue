#pragma once

#include "csound/CsoundTypes.h"
#include <atomic>
#include <cstdint>
#include <deque>
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
  void setStateChangeCallback(StateChangeCallback callback);

private:
  void performThread();
  bool rebuildControlChannelCache();
  void clearControlChannelCache();
  void applyPendingChannelValues();
  void applyPendingChannelBatches();
  void syncSharedMemoryFromChannels();
  void syncSharedMemoryFromChannels(
      std::shared_ptr<const RuntimeChannelBindingSnapshot> &cachedBindings,
      uint64_t &cachedGeneration);
  void syncSharedMemoryFromBindings(
      const RuntimeChannelBindingSnapshot *bindings);
  void mirrorChannelValue(const std::string &name, double value);
  double *findControlChannelPointer(const std::string &name);
  bool hasActiveAutomation(const std::string &name) const;
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
  mutable std::mutex channelMutex_;
  mutable std::mutex lifecycleMutex_;
  std::unordered_map<std::string, ControlChannelState> controlChannels_;
  std::atomic<uint64_t> channelBindingGeneration_{1};
  std::shared_ptr<const RuntimeChannelBindingSnapshot> runtimeChannelBindings_;
  std::unordered_map<std::string, double> pendingChannelValues_;
  using ChannelBatch = std::vector<std::pair<std::string, double>>;
  static constexpr size_t kMaxPendingChannelBatches = 128;
  std::deque<ChannelBatch> pendingChannelBatches_;
  mutable std::mutex stateMutex_;
  EngineLifecycleState state_ = EngineLifecycleState::EMPTY;
  EngineStopReason stopReason_ = EngineStopReason::NONE;
  double sampleRate_ = 0.0;
  int32_t ksmps_ = 0;
  uint64_t stateSequence_ = 0;
  std::string lastError_;
  mutable std::mutex performanceMutex_;
  EnginePerformanceSummary lastPerformanceSummary_{};
  uint64_t performanceWarmupCycles_ = 0;
  uint64_t performanceMeasuredCycles_ = 0;
  mutable std::mutex callbackMutex_;
  StateChangeCallback stateChangeCallback_;
};

} // namespace blue
