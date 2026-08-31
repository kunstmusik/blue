#include "CsoundEngine.h"
#include "../automation/AutomationManager.h"
#include "../automation/AutomationStore.h"
#include "../csound/CsoundLoader.h"
#include "../ipc/SharedMemory.h"

#include <algorithm>
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
#include <array>
#include <chrono>
#include <cstddef>
#include <cstdint>
#endif
#include <cstdio>
#include <cmath>
#include <cstring>
#include <functional>
#include <utility>
#include <vector>

#if defined(_WIN32)
#include <windows.h>
#endif

#if defined(__APPLE__)
#include <pthread.h>
#include <errno.h>
#endif

#if defined(__linux__)
#include <pthread.h>
#include <sched.h>
#include <sys/resource.h>
#include <errno.h>
#endif

namespace blue {

namespace {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
class PerformanceSampleWindow {
public:
  explicit PerformanceSampleWindow(size_t capacity) : capacity_(capacity) {
    samples_.reserve(capacity_);
  }

  void add(uint64_t valueNs) {
    const auto boundedValue = static_cast<uint32_t>(
        std::min<uint64_t>(valueNs, UINT32_MAX));

    if (samples_.size() < capacity_) {
      samples_.push_back(boundedValue);
      return;
    }

    samples_[nextIndex_] = boundedValue;
    nextIndex_ = (nextIndex_ + 1) % capacity_;
  }

  double percentile(double percentileValue) const {
    if (samples_.empty()) {
      return 0.0;
    }

    auto values = samples_;
    const double clamped = std::clamp(percentileValue, 0.0, 1.0);
    const size_t index =
        static_cast<size_t>(clamped * static_cast<double>(values.size() - 1));
    std::nth_element(
        values.begin(), values.begin() + static_cast<std::ptrdiff_t>(index),
        values.end());
    return static_cast<double>(values[index]);
  }

  size_t size() const {
    return samples_.size();
  }

private:
  size_t capacity_;
  size_t nextIndex_ = 0;
  std::vector<uint32_t> samples_;
};
#endif

bool elevatePerformThreadPriority(char *errorBuffer, size_t errorBufferSize) {
#if defined(__APPLE__)
  // Match Java Blue intent: ask scheduler for a higher-priority interactive class.
  const int result = pthread_set_qos_class_self_np(QOS_CLASS_USER_INTERACTIVE, 0);
  if (result == 0) {
    return true;
  }

  if (errorBuffer && errorBufferSize > 0) {
    std::snprintf(errorBuffer, errorBufferSize,
                  "pthread_set_qos_class_self_np failed: %s (%d)",
                  std::strerror(result), result);
  }
  return false;
#elif defined(_WIN32)
  // Best-effort elevation without requiring MMCSS registration.
  if (SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_HIGHEST) != 0) {
    return true;
  }

  if (errorBuffer && errorBufferSize > 0) {
    const DWORD err = GetLastError();
    std::snprintf(errorBuffer, errorBufferSize,
                  "SetThreadPriority(THREAD_PRIORITY_HIGHEST) failed: %lu",
                  static_cast<unsigned long>(err));
  }
  return false;
#elif defined(__linux__)
  // Prefer realtime round-robin scheduling. This may require CAP_SYS_NICE.
  sched_param param{};
  const int maxPriority = sched_get_priority_max(SCHED_RR);
  if (maxPriority > 0) {
    param.sched_priority = std::max(1, maxPriority - 1);
    if (pthread_setschedparam(pthread_self(), SCHED_RR, &param) == 0) {
      return true;
    }
  }

  // Fallback: process nice boost (still privileged on many systems).
  if (setpriority(PRIO_PROCESS, 0, -10) == 0) {
    return true;
  }

  if (errorBuffer && errorBufferSize > 0) {
    const int err = errno;
    std::snprintf(errorBuffer, errorBufferSize,
                  "pthread_setschedparam/setpriority failed: %s (%d)",
                  std::strerror(err), err);
  }
  return false;
#else
  if (errorBuffer && errorBufferSize > 0) {
    std::snprintf(errorBuffer, errorBufferSize,
                  "thread priority elevation not implemented for this platform");
  }
  return false;
#endif
}
} // namespace

CsoundEngine::CsoundEngine()
    : automationStore_(std::make_shared<AutomationStore>()),
      channelMailbox_(std::make_unique<RealtimeChannelMailbox>()) {}

CsoundEngine::~CsoundEngine() { destroy(); }

std::string CsoundEngine::getLastError() const {
  std::lock_guard<std::mutex> lock(stateMutex_);
  return lastError_;
}

EngineStateSnapshot CsoundEngine::getStateSnapshot() const {
  std::lock_guard<std::mutex> lock(stateMutex_);
  return EngineStateSnapshot{
      state_,
      stopReason_,
      csound_ != nullptr,
      running_.load(),
      sampleNumber_.load(),
      sampleRate_,
      ksmps_,
      stateSequence_,
      lastError_,
  };
}

EnginePerformanceSummary CsoundEngine::getLastPerformanceSummary() const {
  std::lock_guard<std::mutex> lock(performanceMutex_);
  return lastPerformanceSummary_;
}

EngineNativeGapSummary CsoundEngine::getLastNativeGapSummary() const {
  NativeGapAccumulator snapshot;
  {
    std::lock_guard<std::mutex> lock(performanceMutex_);
    snapshot = nativeGapAccumulatorSnapshot_;
  }
  // Ordering and top-N selection happen here on the calling thread, never in
  // the perform loop.
  return snapshot.buildSummary();
}

void CsoundEngine::setStateChangeCallback(StateChangeCallback callback) {
  std::lock_guard<std::mutex> lock(callbackMutex_);
  stateChangeCallback_ = std::move(callback);
}

void CsoundEngine::setLastError(const std::string &message) {
  std::lock_guard<std::mutex> lock(stateMutex_);
  lastError_ = message;
}

void CsoundEngine::clearLastError() {
  std::lock_guard<std::mutex> lock(stateMutex_);
  lastError_.clear();
}

void CsoundEngine::transitionState(EngineLifecycleState state,
                                   EngineStopReason stopReason,
                                   const std::string &lastError) {
  EngineStateSnapshot snapshot;
  {
    std::lock_guard<std::mutex> lock(stateMutex_);
    state_ = state;
    stopReason_ = stopReason;
    if (!lastError.empty() || stopReason == EngineStopReason::FAILED) {
      lastError_ = lastError;
    } else if (state == EngineLifecycleState::RUNNING ||
               state == EngineLifecycleState::READY ||
               state == EngineLifecycleState::EMPTY) {
      lastError_.clear();
    }
    stateSequence_ += 1;
    snapshot = EngineStateSnapshot{
        state_,
        stopReason_,
        csound_ != nullptr,
        running_.load(),
        sampleNumber_.load(),
        sampleRate_,
        ksmps_,
        stateSequence_,
        lastError_,
    };
  }

  publishStateSnapshot(snapshot);
}

void CsoundEngine::publishStateSnapshot(const EngineStateSnapshot &snapshot) {
  StateChangeCallback callback;
  {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    callback = stateChangeCallback_;
  }

  if (callback) {
    callback(snapshot);
  }
}

bool CsoundEngine::create() {
  std::lock_guard<std::mutex> lifecycleLock(lifecycleMutex_);

  if (csound_) {
    setLastError("Engine already created");
    return false;
  }

  if (!CsoundLoader::initialize()) {
    setLastError(CsoundLoader::getError());
    return false;
  }

  csound_ = CsoundLoader::csoundCreate(nullptr, nullptr);
  if (!csound_) {
    setLastError("Failed to create Csound instance");
    return false;
  }

  automationManager_ = std::make_unique<AutomationManager>(
      automationStore_,
      AutomationManager::ChannelWriter{},
      [this](const std::string &name) {
        return findControlChannelPointer(name);
      },
      [this]() {
        return getChannelBindingGeneration();
      });

  sampleNumber_.store(0);
  {
    std::lock_guard<std::mutex> lock(stateMutex_);
    sampleRate_ = 0.0;
    ksmps_ = 0;
  }
  transitionState(EngineLifecycleState::READY, EngineStopReason::NONE);

  return true;
}

void CsoundEngine::destroy() {
  std::lock_guard<std::mutex> lifecycleLock(lifecycleMutex_);
  joinPerformThread(false);

  if (csound_) {
    CsoundLoader::csoundDestroy(csound_);
    csound_ = nullptr;
  }

  clearControlChannelCache();
  automationManager_.reset();
  automationStore_->clear();
  sampleNumber_.store(0);
  pendingChannelValues_.clear();
  channelMailbox_->reset();

  {
    std::lock_guard<std::mutex> lock(stateMutex_);
    sampleRate_ = 0.0;
    ksmps_ = 0;
  }
  transitionState(EngineLifecycleState::EMPTY, EngineStopReason::DESTROYED);
}

bool CsoundEngine::setOption(const std::string &option) {
  if (!csound_) {
    setLastError("Engine not created");
    return false;
  }

  int result = CsoundLoader::csoundSetOption(csound_, option.c_str());
  if (result != csound::CSOUND_SUCCESS) {
    setLastError("Failed to set option: " + option);
    return false;
  }

  clearLastError();

  return true;
}

bool CsoundEngine::compileOrc(const std::string &orc) {
  std::lock_guard<std::mutex> lifecycleLock(lifecycleMutex_);

  if (!csound_) {
    setLastError("Engine not created");
    return false;
  }

  const bool wasRunning = running_.load(std::memory_order_acquire);
  if (performThread_.joinable()) {
    // Csound may replace control-channel storage during compilation. Stop
    // the perform thread at a k-cycle boundary before rebuilding pointers.
    // A naturally completed thread can still be joinable after publishing
    // STOPPED, so join it even when running_ is already false.
    joinPerformThread(wasRunning);
  }

  const int result = CsoundLoader::csoundCompileOrc(csound_, orc.c_str(), 0);
  const bool compiled = result == csound::CSOUND_SUCCESS;
  const bool rebuilt = rebuildControlChannelCache();

  if (rebuilt) {
    applyPendingChannelValues();
    syncSharedMemoryFromChannels();
  }

  if (wasRunning && rebuilt) {
    resumePerformThread();
  }

  if (!compiled) {
    setLastError("Failed to compile orchestra");
    return false;
  }
  if (!rebuilt) {
    return false;
  }

  clearLastError();
  return true;
}

bool CsoundEngine::readScore(const std::string &sco) {
  if (!csound_) {
    setLastError("Engine not created");
    return false;
  }

  CsoundLoader::csoundEventString(csound_, sco.c_str(), 0);
  clearLastError();
  return true;
}

bool CsoundEngine::createChannel(const std::string &name, double initialValue) {
  return setChannel(name, initialValue);
}

bool CsoundEngine::setChannel(const std::string &name, double value) {
  return setChannels({{name, value}});
}

bool CsoundEngine::setChannels(
    const std::vector<std::pair<std::string, double>> &entries) {
  std::lock_guard<std::mutex> lifecycleLock(lifecycleMutex_);

  if (!csound_) {
    setLastError("Engine not created");
    return false;
  }
  if (entries.empty()) {
    setLastError("Batch channel set cannot be empty");
    return false;
  }

  const bool running = running_.load();
  for (size_t index = 0; index < entries.size(); ++index) {
    const auto &[name, value] = entries[index];
    if (name.empty()) {
      setLastError("Channel name cannot be empty");
      return false;
    }
    if (!std::isfinite(value)) {
      setLastError("Channel value must be finite");
      return false;
    }
    for (size_t previous = 0; previous < index; ++previous) {
      if (entries[previous].first == name) {
        setLastError("Batch payload contains duplicate channel name");
        return false;
      }
    }
    if (running && hasActiveAutomation(name)) {
      setLastError("Cannot set automated channel during playback: " + name);
      return false;
    }
  }

  // All validation, including live-channel applicability and automation
  // authority, completes before the first value is applied or enqueued.
  std::vector<std::pair<std::string, double>> directEntries;
  const auto bindings = getChannelBindings();
  if (running) {
    if (!bindings) {
      setLastError("Runtime channel bindings are unavailable");
      return false;
    }
    std::vector<ResolvedChannelValue> resolvedEntries;
    resolvedEntries.reserve(entries.size());
    for (const auto &[name, value] : entries) {
      const auto binding = bindings->controlChannels.find(name);
      if (binding == bindings->controlChannels.end() || !binding->second.pointer) {
        setLastError("Channel not found: " + name);
        return false;
      }
      resolvedEntries.push_back(ResolvedChannelValue{binding->second.pointer, value});
    }

    const auto enqueueResult = channelMailbox_->enqueue(
        bindings->bindingGeneration, resolvedEntries);
    if (enqueueResult == RealtimeChannelMailbox::EnqueueResult::Full) {
      setLastError("Channel batch queue is full; retry at the next control boundary");
      return false;
    }
    if (enqueueResult != RealtimeChannelMailbox::EnqueueResult::Accepted) {
      setLastError("Channel batch could not be queued");
      return false;
    }
  } else {
    for (const auto &[name, value] : entries) {
      if (bindings && bindings->controlChannels.find(name) !=
                          bindings->controlChannels.end()) {
        directEntries.emplace_back(name, value);
      }
    }
  }

  for (const auto &[name, value] : entries) {
    pendingChannelValues_[name] = value;
  }
  if (!running) {
    for (const auto &[name, value] : directEntries) {
      CsoundLoader::csoundSetControlChannel(csound_, name.c_str(), value);
    }
    for (const auto &[name, value] : entries) {
      mirrorChannelValue(name, value);
    }
  }

  clearLastError();
  return true;
}

bool CsoundEngine::getChannel(const std::string &name, double &value) {
  std::vector<double> values;
  if (!getChannels({name}, values)) {
    return false;
  }
  value = values.front();
  return true;
}

bool CsoundEngine::getChannels(const std::vector<std::string> &names,
                               std::vector<double> &values) {
  std::lock_guard<std::mutex> lifecycleLock(lifecycleMutex_);

  if (!csound_) {
    setLastError("Engine not created");
    return false;
  }
  if (names.empty()) {
    setLastError("Batch channel get cannot be empty");
    return false;
  }

  const auto bindings = getChannelBindings();
  std::vector<double> nextValues;
  nextValues.reserve(names.size());
  for (const auto &name : names) {
    if (bindings) {
      const auto binding = bindings->controlChannels.find(name);
      if (binding != bindings->controlChannels.end()) {
        if (binding->second.sharedMemoryEntry) {
          nextValues.push_back(
              binding->second.sharedMemoryEntry->value.load(std::memory_order_relaxed));
          continue;
        }

        int32_t err = csound::CSOUND_SUCCESS;
        const double value =
            CsoundLoader::csoundGetControlChannel(csound_, name.c_str(), &err);
        if (err == csound::CSOUND_SUCCESS) {
          nextValues.push_back(value);
          continue;
        }
      }
    }

    const auto pending = pendingChannelValues_.find(name);
    if (pending != pendingChannelValues_.end()) {
      nextValues.push_back(pending->second);
      continue;
    }

    setLastError("Channel not found: " + name);
    return false;
  }

  values = std::move(nextValues);
  clearLastError();
  return true;
}

bool CsoundEngine::start() {
  std::lock_guard<std::mutex> lifecycleLock(lifecycleMutex_);

  if (!csound_) {
    setLastError("Engine not created");
    return false;
  }

  if (running_.load()) {
    setLastError("Engine already running");
    return false;
  }

  // A naturally completed performance leaves a joinable std::thread even
  // though running_ is already false. Reap it before creating the next
  // perform thread; assigning over a joinable thread would terminate the
  // process during restart stress.
  if (performThread_.joinable()) {
    performThread_.join();
    channelMailbox_->reset();
  }

  int result = CsoundLoader::csoundStart(csound_);
  if (result != csound::CSOUND_SUCCESS) {
    setLastError("Failed to start Csound");
    return false;
  }

  shouldStop_.store(false, std::memory_order_release);
  preservePerformanceState_.store(false, std::memory_order_release);
  sampleNumber_.store(0);
  {
    std::lock_guard<std::mutex> lock(performanceMutex_);
    lastPerformanceSummary_ = EnginePerformanceSummary{};
    nativeGapAccumulatorSnapshot_ = NativeGapAccumulator{};
  }

  {
    std::lock_guard<std::mutex> lock(stateMutex_);
    sampleRate_ = CsoundLoader::csoundGetSr(csound_);
    ksmps_ = CsoundLoader::csoundGetKsmps(csound_);
  }

  if (!rebuildControlChannelCache()) {
    running_.store(false);
    return false;
  }

  applyPendingChannelValues();

  if (automationManager_) {
    automationManager_->reset();
  }

  syncSharedMemoryFromChannels();
  resumePerformThread();
  return true;
}

void CsoundEngine::stop() {
  std::lock_guard<std::mutex> lifecycleLock(lifecycleMutex_);
  joinPerformThread(false);
}

void CsoundEngine::resumePerformThread() {
  shouldStop_.store(false, std::memory_order_release);
  preservePerformanceState_.store(false, std::memory_order_release);
  running_.store(true, std::memory_order_release);
  transitionState(EngineLifecycleState::RUNNING, EngineStopReason::NONE);
  performThread_ = std::thread(&CsoundEngine::performThread, this);
}

void CsoundEngine::joinPerformThread(bool preservePerformanceState) {
  preservePerformanceState_.store(preservePerformanceState,
                                   std::memory_order_release);
  shouldStop_.store(true, std::memory_order_release);

  if (performThread_.joinable()) {
    performThread_.join();
  } else {
    running_.store(false, std::memory_order_release);
    preservePerformanceState_.store(false, std::memory_order_release);
  }

  // A batch accepted immediately before stop may not have reached a perform
  // boundary. Its latest values remain in pendingChannelValues_ and are
  // re-applied by start()/compileOrc(); discard stale pointer envelopes only
  // after the performance thread is quiescent.
  channelMailbox_->reset();
}

void CsoundEngine::performThread() {
  if (threadPriorityElevationEnabled_) {
    char priorityError[256] = {0};
    if (elevatePerformThreadPriority(priorityError, sizeof(priorityError))) {
      std::fprintf(stderr, "[ThreadPriority] perform thread elevated\n");
    } else {
      std::fprintf(stderr, "[ThreadPriority] elevation failed: %s\n", priorityError);
    }
  } else {
    std::fprintf(stderr, "[ThreadPriority] perform thread elevation disabled\n");
  }

  const double sampleRate = CsoundLoader::csoundGetSr(csound_);
  const int ksmps = CsoundLoader::csoundGetKsmps(csound_);
  EngineStopReason stopReason = EngineStopReason::STOP_REQUESTED;
  std::string terminalError;
  int64_t localSample = sampleNumber_.load(std::memory_order_relaxed);
  std::shared_ptr<const RuntimeChannelBindingSnapshot> cachedBindings;
  uint64_t cachedBindingGeneration = 0;

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
  using Clock = std::chrono::steady_clock;
  using Nanos = std::chrono::nanoseconds;

  constexpr uint64_t kSlowHostCycleThresholdNs = 50000; // 50us
  constexpr uint64_t kAutoSpikeThresholdNs = 500000;    // 0.5ms
  constexpr uint64_t kPerformSpikeThresholdNs = 1000000; // 1.0ms
  constexpr uint64_t kShmSpikeThresholdNs = 500000;      // 0.5ms
  constexpr uint64_t kHostSpikeThresholdNs = 1000000;    // 1.0ms
  constexpr size_t kTopSpikeCycles = 8;
  constexpr int64_t kBurstWindowNeighborCycles = 8;
  constexpr uint64_t kSchedulerDeltaThresholdNs = 1000000; // 1.0ms
  constexpr size_t kSampleWindowCapacity = 4096;
  constexpr size_t kMaxBurstWindows = 16;

  // Budget-relative scheduling-gap diagnostics: recording is O(1) with a
  // fixed-capacity ring; aggregation happens at read time, off this thread.
  NativeGapAccumulator nativeGaps;
  nativeGaps.reset(NativeGapAccumulator::kPeriodBudgetNs(ksmps, sampleRate));

  uint64_t cycleCount = 0;
  uint64_t totalCycleCount = 0;
  uint64_t slowHostCycleCount = 0;
  uint64_t autoSpikeCount = 0;
  uint64_t performSpikeCount = 0;
  uint64_t shmSpikeCount = 0;
  uint64_t hostSpikeCount = 0;
  uint64_t loopDeltaSpikeCount = 0;
  uint64_t schedulerLikelySpikeCount = 0;
  uint64_t computeLikelySpikeCount = 0;
  Nanos automationDuration{0};
  Nanos performKsmpsDuration{0};
  Nanos sharedMemorySyncDuration{0};
  Nanos loopDeltaDuration{0};

  uint64_t loopDeltaMaxNs = 0;

  uint64_t automationMaxNs = 0;
  uint64_t performKsmpsMaxNs = 0;
  uint64_t sharedMemorySyncMaxNs = 0;
  uint64_t hostCycleMaxNs = 0;

  PerformanceSampleWindow automationSamplesNs(kSampleWindowCapacity);
  PerformanceSampleWindow performSamplesNs(kSampleWindowCapacity);
  PerformanceSampleWindow shmSamplesNs(kSampleWindowCapacity);
  PerformanceSampleWindow hostCycleSamplesNs(kSampleWindowCapacity);
  PerformanceSampleWindow loopDeltaSamplesNs(kSampleWindowCapacity);

  std::array<uint64_t, 6> hostHistogram{};
  std::array<uint64_t, 6> performHistogram{};

  struct CycleSpike {
    int64_t sampleFrame;
    uint64_t autoNs;
    uint64_t performNs;
    uint64_t shmNs;
    uint64_t hostNs;
  };
  std::vector<CycleSpike> topSpikes;
  topSpikes.reserve(kTopSpikeCycles);

  struct AutoSpikeDetail {
    int64_t sampleFrame;
    uint64_t autoNs;
    bool snapshotChanged;
    uint32_t resetTimeBackwardsCount;
    uint32_t resetIndexOutOfRangeCount;
    uint32_t resetBeforeSegmentCount;
    uint32_t resetCompletedRewindCount;
    size_t activeAutomationCount;
    size_t activePointCount;
  };

  std::vector<AutoSpikeDetail> topAutoSpikes;
  topAutoSpikes.reserve(6);

  uint64_t autoSpikeWithSnapshotChangeCount = 0;
  uint64_t autoSpikeWithAnyResetCount = 0;
  uint64_t autoSpikeResetTimeBackwardsTotal = 0;
  uint64_t autoSpikeResetIndexOutOfRangeTotal = 0;
  uint64_t autoSpikeResetBeforeSegmentTotal = 0;
  uint64_t autoSpikeResetCompletedRewindTotal = 0;
  size_t autoSpikeMaxActiveAutomationCount = 0;
  size_t autoSpikeMaxActivePointCount = 0;
  uint64_t autoSpikeActiveAutomationCountSum = 0;
  uint64_t autoSpikeActivePointCountSum = 0;

  struct BurstWindow {
    int64_t centerSampleFrame;
    int64_t startSampleFrame;
    int64_t endSampleFrame;
    uint64_t maxHostNs;
    uint64_t maxPerformNs;
    uint64_t maxAutoNs;
    uint64_t maxShmNs;
    uint64_t maxLoopDeltaNs;
    uint64_t contributingCycles;
  };
  std::vector<BurstWindow> burstWindows;
  burstWindows.reserve(kMaxBurstWindows);

  bool hasLastLoopStart = false;
  Clock::time_point lastLoopStart{};

  uint64_t spikeClusterCount = 0;
  uint64_t maxSpikeClusterLength = 0;
  uint64_t currentSpikeClusterLength = 0;
  uint64_t spikeClusterInterGapSum = 0;
  uint64_t spikeClusterInterGapCount = 0;
  int64_t lastHostSpikeSampleFrame = -1;

  auto recordHistogramBucket = [](std::array<uint64_t, 6> &hist, uint64_t ns) {
    // Buckets in microseconds: [0-25), [25-50), [50-100), [100-500), [500-1000), [1000+)
    if (ns < 25000) {
      hist[0] += 1;
    } else if (ns < 50000) {
      hist[1] += 1;
    } else if (ns < 100000) {
      hist[2] += 1;
    } else if (ns < 500000) {
      hist[3] += 1;
    } else if (ns < 1000000) {
      hist[4] += 1;
    } else {
      hist[5] += 1;
    }
  };

  auto recordTopSpike = [&](int64_t sampleFrame,
                            uint64_t autoNs,
                            uint64_t performNs,
                            uint64_t shmNs,
                            uint64_t hostNs) {
    CycleSpike candidate{sampleFrame, autoNs, performNs, shmNs, hostNs};

    if (topSpikes.size() < kTopSpikeCycles) {
      topSpikes.push_back(candidate);
    } else if (hostNs > topSpikes.back().hostNs) {
      topSpikes.back() = candidate;
    } else {
      return;
    }

    std::sort(topSpikes.begin(), topSpikes.end(), [](const CycleSpike &left, const CycleSpike &right) {
      return left.hostNs > right.hostNs;
    });
  };

  auto updateBurstWindow = [&](int64_t sampleFrame,
                               uint64_t autoNs,
                               uint64_t performNs,
                               uint64_t shmNs,
                               uint64_t hostNs,
                               uint64_t loopDeltaNs) {
    const int64_t windowStart = sampleFrame - (kBurstWindowNeighborCycles * static_cast<int64_t>(ksmps));
    const int64_t windowEnd = sampleFrame + (kBurstWindowNeighborCycles * static_cast<int64_t>(ksmps));

    for (auto &window : burstWindows) {
      if (sampleFrame >= window.startSampleFrame && sampleFrame <= window.endSampleFrame) {
        window.startSampleFrame = std::min(window.startSampleFrame, windowStart);
        window.endSampleFrame = std::max(window.endSampleFrame, windowEnd);
        window.maxHostNs = std::max(window.maxHostNs, hostNs);
        window.maxPerformNs = std::max(window.maxPerformNs, performNs);
        window.maxAutoNs = std::max(window.maxAutoNs, autoNs);
        window.maxShmNs = std::max(window.maxShmNs, shmNs);
        window.maxLoopDeltaNs = std::max(window.maxLoopDeltaNs, loopDeltaNs);
        window.contributingCycles += 1;
        return;
      }
    }

    const BurstWindow newWindow{
        sampleFrame,
        windowStart,
        windowEnd,
        hostNs,
        performNs,
        autoNs,
        shmNs,
        loopDeltaNs,
        1};

    if (burstWindows.size() < kMaxBurstWindows) {
      burstWindows.push_back(newWindow);
      return;
    }

    auto smallestWindow = std::min_element(
        burstWindows.begin(), burstWindows.end(),
        [](const BurstWindow &left, const BurstWindow &right) {
          return left.maxHostNs < right.maxHostNs;
        });
    if (smallestWindow != burstWindows.end() &&
        hostNs > smallestWindow->maxHostNs) {
      *smallestWindow = newWindow;
    }
  };

  auto recordTopAutoSpike = [&](const AutoSpikeDetail &candidate) {
    if (topAutoSpikes.size() < 6) {
      topAutoSpikes.push_back(candidate);
    } else if (candidate.autoNs > topAutoSpikes.back().autoNs) {
      topAutoSpikes.back() = candidate;
    } else {
      return;
    }

    std::sort(topAutoSpikes.begin(), topAutoSpikes.end(), [](const AutoSpikeDetail &left, const AutoSpikeDetail &right) {
      return left.autoNs > right.autoNs;
    });
  };
#endif

  while (!shouldStop_.load(std::memory_order_relaxed)) {
#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    const uint64_t currentCycle = totalCycleCount++;
    const bool measureCycle =
        currentCycle >= performanceWarmupCycles_ &&
        (performanceMeasuredCycles_ == 0 ||
         cycleCount < performanceMeasuredCycles_);
    const auto loopStart = Clock::now();
    uint64_t loopDeltaNs = 0;
    if (hasLastLoopStart) {
      loopDeltaNs = static_cast<uint64_t>(
          std::chrono::duration_cast<Nanos>(loopStart - lastLoopStart).count());
      if (measureCycle) {
        loopDeltaDuration += Nanos(loopDeltaNs);
        loopDeltaMaxNs = std::max(loopDeltaMaxNs, loopDeltaNs);
        loopDeltaSamplesNs.add(loopDeltaNs);
        if (loopDeltaNs >= kSchedulerDeltaThresholdNs) {
          loopDeltaSpikeCount += 1;
        }
        nativeGaps.observeCycle(localSample, true, loopDeltaNs);
      }
    }
    hasLastLoopStart = true;
    lastLoopStart = loopStart;
#endif

    if (automationManager_) {
      automationManager_->process(localSample, sampleRate);
    }

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    const auto automationDiagnostics =
        automationManager_ ? automationManager_->getLastProcessDiagnostics()
                           : AutomationManager::ProcessDiagnostics{};

    const auto afterAutomation = Clock::now();
#endif

    const int result = CsoundLoader::csoundPerformKsmps(csound_);

    // Accepted live channel batches become visible only at this boundary:
    // Csound has completed the previous k-cycle, and the next automation /
    // performance cycle will observe every entry from a batch together. A
    // failed/completed perform must not apply a batch after Csound has stopped.
    if (result == 0) {
      consumePendingChannelBatch();
    }

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    const auto afterPerformKsmps = Clock::now();
#endif

    syncSharedMemoryFromChannels(cachedBindings, cachedBindingGeneration);

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
    const auto afterSharedMemorySync = Clock::now();
    const auto autoNs = static_cast<uint64_t>(
        std::chrono::duration_cast<Nanos>(afterAutomation - loopStart).count());
    const auto performNs = static_cast<uint64_t>(
        std::chrono::duration_cast<Nanos>(
            afterPerformKsmps - afterAutomation).count());
    const auto shmNs = static_cast<uint64_t>(
        std::chrono::duration_cast<Nanos>(
            afterSharedMemorySync - afterPerformKsmps).count());
    const auto hostCycleNs = autoNs + performNs + shmNs;

    if (measureCycle) {

    automationDuration += Nanos(autoNs);
    performKsmpsDuration += Nanos(performNs);
    sharedMemorySyncDuration += Nanos(shmNs);

    automationMaxNs = std::max(automationMaxNs, autoNs);
    performKsmpsMaxNs = std::max(performKsmpsMaxNs, performNs);
    sharedMemorySyncMaxNs = std::max(sharedMemorySyncMaxNs, shmNs);
    hostCycleMaxNs = std::max(hostCycleMaxNs, hostCycleNs);

    automationSamplesNs.add(autoNs);
    performSamplesNs.add(performNs);
    shmSamplesNs.add(shmNs);
    hostCycleSamplesNs.add(hostCycleNs);

    recordHistogramBucket(hostHistogram, hostCycleNs);
    recordHistogramBucket(performHistogram, performNs);

    if (autoNs >= kAutoSpikeThresholdNs) {
      autoSpikeCount += 1;

      if (automationDiagnostics.snapshotChanged) {
        autoSpikeWithSnapshotChangeCount += 1;
      }

      const bool anyReset =
          automationDiagnostics.resetTimeBackwardsCount > 0 ||
          automationDiagnostics.resetIndexOutOfRangeCount > 0 ||
          automationDiagnostics.resetBeforeSegmentCount > 0 ||
          automationDiagnostics.resetCompletedRewindCount > 0;
      if (anyReset) {
        autoSpikeWithAnyResetCount += 1;
      }

      autoSpikeResetTimeBackwardsTotal += automationDiagnostics.resetTimeBackwardsCount;
      autoSpikeResetIndexOutOfRangeTotal += automationDiagnostics.resetIndexOutOfRangeCount;
      autoSpikeResetBeforeSegmentTotal += automationDiagnostics.resetBeforeSegmentCount;
      autoSpikeResetCompletedRewindTotal += automationDiagnostics.resetCompletedRewindCount;

      autoSpikeMaxActiveAutomationCount =
          std::max(autoSpikeMaxActiveAutomationCount, automationDiagnostics.activeAutomationCount);
      autoSpikeMaxActivePointCount =
          std::max(autoSpikeMaxActivePointCount, automationDiagnostics.activePointCount);
      autoSpikeActiveAutomationCountSum += automationDiagnostics.activeAutomationCount;
      autoSpikeActivePointCountSum += automationDiagnostics.activePointCount;

      recordTopAutoSpike(AutoSpikeDetail{
          localSample,
          autoNs,
          automationDiagnostics.snapshotChanged,
          automationDiagnostics.resetTimeBackwardsCount,
          automationDiagnostics.resetIndexOutOfRangeCount,
          automationDiagnostics.resetBeforeSegmentCount,
          automationDiagnostics.resetCompletedRewindCount,
          automationDiagnostics.activeAutomationCount,
          automationDiagnostics.activePointCount});
    }
    if (performNs >= kPerformSpikeThresholdNs) {
      performSpikeCount += 1;
    }
    if (shmNs >= kShmSpikeThresholdNs) {
      shmSpikeCount += 1;
    }
    if (hostCycleNs >= kHostSpikeThresholdNs) {
      hostSpikeCount += 1;

      if (performNs >= kPerformSpikeThresholdNs) {
        computeLikelySpikeCount += 1;
      }

      if (loopDeltaNs >= kSchedulerDeltaThresholdNs && performNs < kPerformSpikeThresholdNs) {
        schedulerLikelySpikeCount += 1;
      }

      updateBurstWindow(localSample, autoNs, performNs, shmNs, hostCycleNs, loopDeltaNs);

      if (lastHostSpikeSampleFrame >= 0 &&
          localSample == lastHostSpikeSampleFrame + static_cast<int64_t>(ksmps)) {
        currentSpikeClusterLength += 1;
      } else {
        if (currentSpikeClusterLength > 0) {
          spikeClusterCount += 1;
          maxSpikeClusterLength = std::max(maxSpikeClusterLength, currentSpikeClusterLength);
        }
        currentSpikeClusterLength = 1;

        if (lastHostSpikeSampleFrame >= 0) {
          const int64_t gapSamples = localSample - lastHostSpikeSampleFrame;
          if (gapSamples > 0) {
            spikeClusterInterGapSum += static_cast<uint64_t>(gapSamples / static_cast<int64_t>(ksmps));
            spikeClusterInterGapCount += 1;
          }
        }
      }
      lastHostSpikeSampleFrame = localSample;
    }

    recordTopSpike(localSample, autoNs, performNs, shmNs, hostCycleNs);

    if (hostCycleNs > kSlowHostCycleThresholdNs) {
      slowHostCycleCount += 1;
    }

    cycleCount += 1;
    }
#endif

    if (result != 0) {
      if (result < 0) {
        stopReason = EngineStopReason::FAILED;
        terminalError = "Csound performance failed";
      } else {
        stopReason = EngineStopReason::COMPLETED;
      }
      break;
    }

    localSample += ksmps;
    sampleNumber_.store(localSample, std::memory_order_relaxed);
  }

  if (shouldStop_.load(std::memory_order_relaxed)) {
    stopReason = EngineStopReason::STOP_REQUESTED;
  }

  // Flush one final snapshot so observers catch the latest values before reset.
  syncSharedMemoryFromChannels(cachedBindings, cachedBindingGeneration);

  const bool preservePerformanceState =
      preservePerformanceState_.load(std::memory_order_acquire);
  if (!preservePerformanceState && csound_ && CsoundLoader::csoundReset) {
    CsoundLoader::csoundReset(csound_);
  }

  clearControlChannelCache();
  running_.store(false, std::memory_order_relaxed);
  transitionState(EngineLifecycleState::STOPPED, stopReason, terminalError);

#if BLUE_ENGINE_USE_PERFORMANCE_TRACKING
  if (cycleCount > 0) {
    const auto automationAvgNs =
        static_cast<double>(automationDuration.count()) / static_cast<double>(cycleCount);
    const auto performAvgNs =
        static_cast<double>(performKsmpsDuration.count()) / static_cast<double>(cycleCount);
    const auto shmSyncAvgNs =
        static_cast<double>(sharedMemorySyncDuration.count()) / static_cast<double>(cycleCount);
    const auto hostAvgNs = automationAvgNs + performAvgNs + shmSyncAvgNs;

    const auto automationP95Ns = automationSamplesNs.percentile(0.95);
    const auto performP95Ns = performSamplesNs.percentile(0.95);
    const auto shmP95Ns = shmSamplesNs.percentile(0.95);
    const auto hostP95Ns = hostCycleSamplesNs.percentile(0.95);
    const auto loopDeltaAvgNs =
        hasLastLoopStart
            ? static_cast<double>(loopDeltaDuration.count()) /
                  static_cast<double>(std::max<uint64_t>(1, cycleCount - 1))
            : 0.0;
    const auto loopDeltaP95Ns = loopDeltaSamplesNs.percentile(0.95);

    if (currentSpikeClusterLength > 0) {
      spikeClusterCount += 1;
      maxSpikeClusterLength = std::max(maxSpikeClusterLength, currentSpikeClusterLength);
    }

    const auto avgSpikeClusterGapCycles =
        spikeClusterInterGapCount > 0
            ? static_cast<double>(spikeClusterInterGapSum) /
                  static_cast<double>(spikeClusterInterGapCount)
            : 0.0;

    const auto slowPct =
        100.0 * (static_cast<double>(slowHostCycleCount) / static_cast<double>(cycleCount));

    {
      std::lock_guard<std::mutex> lock(performanceMutex_);
      lastPerformanceSummary_ = EnginePerformanceSummary{
          true,
          cycleCount,
          automationAvgNs / 1.0e3,
          automationP95Ns / 1.0e3,
          static_cast<double>(automationMaxNs) / 1.0e3,
          performAvgNs / 1.0e3,
          performP95Ns / 1.0e3,
          static_cast<double>(performKsmpsMaxNs) / 1.0e3,
          shmSyncAvgNs / 1.0e3,
          shmP95Ns / 1.0e3,
          static_cast<double>(sharedMemorySyncMaxNs) / 1.0e3,
          hostAvgNs / 1.0e3,
          hostP95Ns / 1.0e3,
          static_cast<double>(hostCycleMaxNs) / 1.0e3,
          autoSpikeCount,
          performSpikeCount,
          shmSpikeCount,
          hostSpikeCount};
    }

    std::fprintf(
        stderr,
        "[Counters] cycles=%llu "
        "p95_window_samples=%zu "
        "auto_total_ms=%.3f auto_avg_us=%.3f auto_max_us=%.3f auto_p95_us=%.3f "
        "perform_total_ms=%.3f perform_avg_us=%.3f perform_max_us=%.3f perform_p95_us=%.3f "
        "shm_total_ms=%.3f shm_avg_us=%.3f shm_max_us=%.3f shm_p95_us=%.3f "
        "host_avg_us=%.3f host_max_us=%.3f host_p95_us=%.3f slow_host_cycles=%llu slow_host_pct=%.3f\n",
        static_cast<unsigned long long>(cycleCount),
        hostCycleSamplesNs.size(),
        static_cast<double>(automationDuration.count()) / 1.0e6,
        automationAvgNs / 1.0e3,
        static_cast<double>(automationMaxNs) / 1.0e3,
        automationP95Ns / 1.0e3,
        static_cast<double>(performKsmpsDuration.count()) / 1.0e6,
        performAvgNs / 1.0e3,
        static_cast<double>(performKsmpsMaxNs) / 1.0e3,
        performP95Ns / 1.0e3,
        static_cast<double>(sharedMemorySyncDuration.count()) / 1.0e6,
        shmSyncAvgNs / 1.0e3,
        static_cast<double>(sharedMemorySyncMaxNs) / 1.0e3,
        shmP95Ns / 1.0e3,
        hostAvgNs / 1.0e3,
        static_cast<double>(hostCycleMaxNs) / 1.0e3,
        hostP95Ns / 1.0e3,
        static_cast<unsigned long long>(slowHostCycleCount),
        slowPct);

    const auto autoSpikePct =
        100.0 * (static_cast<double>(autoSpikeCount) / static_cast<double>(cycleCount));
    const auto performSpikePct =
        100.0 * (static_cast<double>(performSpikeCount) / static_cast<double>(cycleCount));
    const auto shmSpikePct =
        100.0 * (static_cast<double>(shmSpikeCount) / static_cast<double>(cycleCount));
    const auto hostSpikePct =
        100.0 * (static_cast<double>(hostSpikeCount) / static_cast<double>(cycleCount));

    std::fprintf(
        stderr,
        "[CountersSpikes] auto_ge_0.5ms=%llu auto_ge_0.5ms_pct=%.3f "
        "perform_ge_1ms=%llu perform_ge_1ms_pct=%.3f "
        "shm_ge_0.5ms=%llu shm_ge_0.5ms_pct=%.3f "
        "host_ge_1ms=%llu host_ge_1ms_pct=%.3f\n",
        static_cast<unsigned long long>(autoSpikeCount),
        autoSpikePct,
        static_cast<unsigned long long>(performSpikeCount),
        performSpikePct,
        static_cast<unsigned long long>(shmSpikeCount),
        shmSpikePct,
        static_cast<unsigned long long>(hostSpikeCount),
        hostSpikePct);

    if (autoSpikeCount > 0) {
      const auto autoSpikeWithSnapshotChangePct =
          100.0 * (static_cast<double>(autoSpikeWithSnapshotChangeCount) /
                   static_cast<double>(autoSpikeCount));
      const auto autoSpikeWithAnyResetPct =
          100.0 * (static_cast<double>(autoSpikeWithAnyResetCount) /
                   static_cast<double>(autoSpikeCount));
      const auto autoSpikeAvgActiveAutomationCount =
          static_cast<double>(autoSpikeActiveAutomationCountSum) /
          static_cast<double>(autoSpikeCount);
      const auto autoSpikeAvgActivePointCount =
          static_cast<double>(autoSpikeActivePointCountSum) /
          static_cast<double>(autoSpikeCount);

      std::fprintf(
          stderr,
          "[CountersAutoCorr] spikes=%llu with_snapshot_change=%llu with_snapshot_change_pct=%.3f "
          "with_any_reset=%llu with_any_reset_pct=%.3f resets_tb=%llu resets_idx=%llu "
          "resets_seg=%llu resets_rewind=%llu active_auto_avg=%.3f active_auto_max=%zu "
          "active_points_avg=%.3f active_points_max=%zu\n",
          static_cast<unsigned long long>(autoSpikeCount),
          static_cast<unsigned long long>(autoSpikeWithSnapshotChangeCount),
          autoSpikeWithSnapshotChangePct,
          static_cast<unsigned long long>(autoSpikeWithAnyResetCount),
          autoSpikeWithAnyResetPct,
          static_cast<unsigned long long>(autoSpikeResetTimeBackwardsTotal),
          static_cast<unsigned long long>(autoSpikeResetIndexOutOfRangeTotal),
          static_cast<unsigned long long>(autoSpikeResetBeforeSegmentTotal),
          static_cast<unsigned long long>(autoSpikeResetCompletedRewindTotal),
          autoSpikeAvgActiveAutomationCount,
          autoSpikeMaxActiveAutomationCount,
          autoSpikeAvgActivePointCount,
          autoSpikeMaxActivePointCount);

      for (size_t i = 0; i < topAutoSpikes.size(); ++i) {
        const auto &spike = topAutoSpikes[i];
        std::fprintf(
          stderr,
          "[CountersAutoTop] rank=%zu sample=%lld auto_us=%.3f snapshot_changed=%u "
          "reset_tb=%u reset_idx=%u reset_seg=%u reset_rewind=%u active_auto=%zu active_points=%zu\n",
          i + 1,
          static_cast<long long>(spike.sampleFrame),
          static_cast<double>(spike.autoNs) / 1.0e3,
          spike.snapshotChanged ? 1u : 0u,
          spike.resetTimeBackwardsCount,
          spike.resetIndexOutOfRangeCount,
          spike.resetBeforeSegmentCount,
          spike.resetCompletedRewindCount,
          spike.activeAutomationCount,
          spike.activePointCount);
      }
    }

    std::fprintf(
        stderr,
        "[CountersScheduler] loop_delta_avg_us=%.3f loop_delta_max_us=%.3f loop_delta_p95_us=%.3f "
        "loop_delta_ge_1ms=%llu scheduler_likely=%llu compute_likely=%llu\n",
        loopDeltaAvgNs / 1.0e3,
        static_cast<double>(loopDeltaMaxNs) / 1.0e3,
        loopDeltaP95Ns / 1.0e3,
        static_cast<unsigned long long>(loopDeltaSpikeCount),
        static_cast<unsigned long long>(schedulerLikelySpikeCount),
        static_cast<unsigned long long>(computeLikelySpikeCount));

    std::fprintf(
        stderr,
        "[CountersClusters] clusters=%llu max_cluster_len=%llu avg_inter_cluster_gap_cycles=%.3f\n",
        static_cast<unsigned long long>(spikeClusterCount),
        static_cast<unsigned long long>(maxSpikeClusterLength),
        avgSpikeClusterGapCycles);

    std::fprintf(
        stderr,
        "[CountersHistHost] lt25us=%llu lt50us=%llu lt100us=%llu lt500us=%llu lt1ms=%llu ge1ms=%llu\n",
        static_cast<unsigned long long>(hostHistogram[0]),
        static_cast<unsigned long long>(hostHistogram[1]),
        static_cast<unsigned long long>(hostHistogram[2]),
        static_cast<unsigned long long>(hostHistogram[3]),
        static_cast<unsigned long long>(hostHistogram[4]),
        static_cast<unsigned long long>(hostHistogram[5]));

    std::fprintf(
        stderr,
        "[CountersHistPerform] lt25us=%llu lt50us=%llu lt100us=%llu lt500us=%llu lt1ms=%llu ge1ms=%llu\n",
        static_cast<unsigned long long>(performHistogram[0]),
        static_cast<unsigned long long>(performHistogram[1]),
        static_cast<unsigned long long>(performHistogram[2]),
        static_cast<unsigned long long>(performHistogram[3]),
        static_cast<unsigned long long>(performHistogram[4]),
        static_cast<unsigned long long>(performHistogram[5]));

    for (size_t i = 0; i < topSpikes.size(); ++i) {
      const auto &spike = topSpikes[i];
      std::fprintf(
          stderr,
          "[CountersTop] rank=%zu sample=%lld host_us=%.3f perform_us=%.3f auto_us=%.3f shm_us=%.3f\n",
          i + 1,
          static_cast<long long>(spike.sampleFrame),
          static_cast<double>(spike.hostNs) / 1.0e3,
          static_cast<double>(spike.performNs) / 1.0e3,
          static_cast<double>(spike.autoNs) / 1.0e3,
          static_cast<double>(spike.shmNs) / 1.0e3);
    }

    std::sort(
        burstWindows.begin(), burstWindows.end(),
        [](const BurstWindow &left, const BurstWindow &right) {
          return left.maxHostNs > right.maxHostNs;
        });

    const size_t burstReportCount = std::min<size_t>(burstWindows.size(), 6);
    for (size_t i = 0; i < burstReportCount; ++i) {
      const auto &window = burstWindows[i];
      std::fprintf(
          stderr,
          "[CountersBurst] rank=%zu center_sample=%lld window=[%lld,%lld] cycles=%llu "
          "host_max_us=%.3f perform_max_us=%.3f auto_max_us=%.3f shm_max_us=%.3f loop_delta_max_us=%.3f\n",
          i + 1,
          static_cast<long long>(window.centerSampleFrame),
          static_cast<long long>(window.startSampleFrame),
          static_cast<long long>(window.endSampleFrame),
          static_cast<unsigned long long>(window.contributingCycles),
          static_cast<double>(window.maxHostNs) / 1.0e3,
          static_cast<double>(window.maxPerformNs) / 1.0e3,
          static_cast<double>(window.maxAutoNs) / 1.0e3,
          static_cast<double>(window.maxShmNs) / 1.0e3,
          static_cast<double>(window.maxLoopDeltaNs) / 1.0e3);
    }
  }

  // Performance stop: hand the raw gap observations over for off-thread
  // aggregation. This always emits, even when no cycles were measured.
  nativeGaps.finalize();
  {
    std::lock_guard<std::mutex> lock(performanceMutex_);
    nativeGapAccumulatorSnapshot_ = nativeGaps;
  }
#endif
}

bool CsoundEngine::rebuildControlChannelCache() {
  csound::controlChannelInfo_t *channelList = nullptr;
  const int32_t count =
      CsoundLoader::csoundListChannels(csound_, &channelList);

  if (count < 0) {
    setLastError("Failed to list Csound channels");
    return false;
  }

  std::unordered_map<std::string, ControlChannelState> newChannels;
  std::vector<ShmMirrorBinding> newMirrorBindings;

  for (int32_t index = 0; index < count; ++index) {
    const auto &channel = channelList[index];
    if (!channel.name) {
      continue;
    }

    if ((channel.type & csound::CSOUND_CHANNEL_TYPE_MASK) !=
        csound::CSOUND_CONTROL_CHANNEL) {
      continue;
    }

    void *pointer = nullptr;
    if (CsoundLoader::csoundGetChannelPtr(csound_, &pointer, channel.name,
                                          channel.type) !=
            csound::CSOUND_SUCCESS ||
        pointer == nullptr) {
      continue;
    }

    ChannelEntry *sharedMemoryEntry = nullptr;
    if (shm_) {
      sharedMemoryEntry = shm_->getOrCreateChannelEntry(
          channel.name, *static_cast<double *>(pointer));
    }

    newChannels.emplace(channel.name,
                        ControlChannelState{channel.type,
                                            static_cast<double *>(pointer),
                                            sharedMemoryEntry});

    if (sharedMemoryEntry) {
      newMirrorBindings.push_back(
          ShmMirrorBinding{static_cast<double *>(pointer), sharedMemoryEntry});
    }
  }

  if (channelList) {
    CsoundLoader::csoundDeleteChannelList(csound_, channelList);
  }

  const uint64_t nextGen = channelBindingGeneration_.load(std::memory_order_relaxed) + 1;
  auto snapshot = std::make_shared<RuntimeChannelBindingSnapshot>(nextGen);
  snapshot->mirrorBindings = std::move(newMirrorBindings);

  snapshot->controlChannels = std::move(newChannels);
  std::atomic_store_explicit(
      &runtimeChannelBindings_,
      std::shared_ptr<const RuntimeChannelBindingSnapshot>(std::move(snapshot)),
      std::memory_order_release);

  channelBindingGeneration_.store(nextGen, std::memory_order_release);

  return true;
}

void CsoundEngine::clearControlChannelCache() {
  const uint64_t nextGen = channelBindingGeneration_.load(std::memory_order_relaxed) + 1;
  auto emptySnapshot = std::make_shared<RuntimeChannelBindingSnapshot>(nextGen);

  std::atomic_store_explicit(
      &runtimeChannelBindings_,
      std::shared_ptr<const RuntimeChannelBindingSnapshot>(std::move(emptySnapshot)),
      std::memory_order_release);

  channelBindingGeneration_.store(nextGen, std::memory_order_release);
}

void CsoundEngine::applyPendingChannelValues() {
  std::vector<std::pair<std::string, double>> valuesToApply;
  const auto bindings = getChannelBindings();
  valuesToApply.reserve(pendingChannelValues_.size());
  for (const auto &[name, value] : pendingChannelValues_) {
    if (bindings && bindings->controlChannels.find(name) !=
                        bindings->controlChannels.end()) {
      valuesToApply.emplace_back(name, value);
    }
  }

  for (const auto &[name, value] : valuesToApply) {
    CsoundLoader::csoundSetControlChannel(csound_, name.c_str(), value);
    mirrorChannelValue(name, value);
  }
}

void CsoundEngine::consumePendingChannelBatch() {
  (void)channelMailbox_->consumeOne(
      channelBindingGeneration_.load(std::memory_order_acquire));
}

void CsoundEngine::syncSharedMemoryFromChannels() {
  if (!shm_) {
    return;
  }

  auto bindings = std::atomic_load_explicit(
      &runtimeChannelBindings_, std::memory_order_acquire);
  syncSharedMemoryFromBindings(bindings.get());
}

void CsoundEngine::syncSharedMemoryFromChannels(
    std::shared_ptr<const RuntimeChannelBindingSnapshot> &cachedBindings,
    uint64_t &cachedGeneration) {
  if (!shm_) {
    return;
  }

  const uint64_t currentGeneration =
      channelBindingGeneration_.load(std::memory_order_acquire);
  if (cachedGeneration != currentGeneration) {
    cachedBindings = std::atomic_load_explicit(
        &runtimeChannelBindings_, std::memory_order_acquire);
    cachedGeneration = currentGeneration;
  }

  syncSharedMemoryFromBindings(cachedBindings.get());
}

void CsoundEngine::syncSharedMemoryFromBindings(
    const RuntimeChannelBindingSnapshot *bindings) {
  if (!bindings) {
    return;
  }

  for (const auto &binding : bindings->mirrorBindings) {
    if (!binding.pointer || !binding.sharedMemoryEntry) {
      continue;
    }

    const double newValue = *binding.pointer;
    const double currentValue =
        binding.sharedMemoryEntry->value.load(std::memory_order_relaxed);

    uint64_t newBits = 0;
    uint64_t currentBits = 0;
    std::memcpy(&newBits, &newValue, sizeof(double));
    std::memcpy(&currentBits, &currentValue, sizeof(double));

    if (newBits != currentBits) {
      binding.sharedMemoryEntry->value.store(newValue, std::memory_order_relaxed);
    }
  }
}

void CsoundEngine::mirrorChannelValue(const std::string &name, double value) {
  if (!shm_) {
    return;
  }

  ChannelEntry *sharedMemoryEntry = nullptr;
  const auto bindings = getChannelBindings();
  if (bindings) {
    const auto it = bindings->controlChannels.find(name);
    if (it != bindings->controlChannels.end()) {
      sharedMemoryEntry = it->second.sharedMemoryEntry;
    }
  }

  if (sharedMemoryEntry) {
    const double currentValue =
        sharedMemoryEntry->value.load(std::memory_order_relaxed);
    uint64_t newBits = 0;
    uint64_t currentBits = 0;
    std::memcpy(&newBits, &value, sizeof(double));
    std::memcpy(&currentBits, &currentValue, sizeof(double));

    if (newBits != currentBits) {
      sharedMemoryEntry->value.store(value, std::memory_order_relaxed);
    }
    return;
  }

  if (!shm_->setChannel(name, value)) {
    shm_->createChannel(name, value);
  }
}

double *CsoundEngine::findControlChannelPointer(const std::string &name) {
  auto bindings = std::atomic_load_explicit(&runtimeChannelBindings_, std::memory_order_acquire);
  if (!bindings) {
    return nullptr;
  }
  auto it = bindings->controlChannels.find(name);
  if (it == bindings->controlChannels.end()) {
    return nullptr;
  }

  return it->second.pointer;
}

bool CsoundEngine::hasActiveAutomation(const std::string &name) const {
  if (!automationStore_) {
    return false;
  }
  auto list = automationStore_->getList();
  if (!list) {
    return false;
  }

  auto it = list->automations.find(name);
  return it != list->automations.end() && it->second.enabled;
}

} // namespace blue
