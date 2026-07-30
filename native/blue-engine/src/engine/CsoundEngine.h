#pragma once

#include "csound/CsoundTypes.h"
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
  ERROR = 4,
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

class CsoundEngine {
public:
  using StateChangeCallback = std::function<void(const EngineStateSnapshot &)>;

  CsoundEngine();
  ~CsoundEngine();

  // Set shared memory used as a read mirror for control channels.
  void setSharedMemory(SharedMemory *shm) { shm_ = shm; }

  // Get automation store (for ZMQ handler)
  std::shared_ptr<AutomationStore> getAutomationStore() { return automationStore_; }

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
  bool getChannel(const std::string &name, double &value);

  bool start();
  void stop();

  void setThreadPriorityElevationEnabled(bool enabled) {
    threadPriorityElevationEnabled_ = enabled;
  }

  bool isRunning() const { return running_.load(); }

  std::string getLastError() const;
  EngineStateSnapshot getStateSnapshot() const;
  void setStateChangeCallback(StateChangeCallback callback);

private:
  struct ShmMirrorBinding {
    double *pointer = nullptr;
    ChannelEntry *sharedMemoryEntry = nullptr;
  };

  struct ControlChannelState {
    int32_t type = 0;
    double *pointer = nullptr;
    ChannelEntry *sharedMemoryEntry = nullptr;
  };

  void performThread();
  bool rebuildControlChannelCache();
  void clearControlChannelCache();
  void applyPendingChannelValues();
  void syncSharedMemoryFromChannels();
  void mirrorChannelValue(const std::string &name, double value);
  double *findControlChannelPointer(const std::string &name);
  bool hasActiveAutomation(const std::string &name) const;
  void writeAutomationValue(const std::string &name, double value);
  void setLastError(const std::string &message);
  void clearLastError();
  void transitionState(EngineLifecycleState state, EngineStopReason stopReason,
                       const std::string &lastError = "");
  void publishStateSnapshot(const EngineStateSnapshot &snapshot);

  csound::CSOUND *csound_ = nullptr;
  SharedMemory *shm_ = nullptr;
  std::atomic<bool> running_{false};
  std::atomic<bool> shouldStop_{false};
  std::thread performThread_;
  std::atomic<int64_t> sampleNumber_{0};
  bool threadPriorityElevationEnabled_ = true;

  // Automation system
  std::shared_ptr<AutomationStore> automationStore_;
  std::unique_ptr<AutomationManager> automationManager_;
  mutable std::mutex channelMutex_;
  std::unordered_map<std::string, ControlChannelState> controlChannels_;
  std::shared_ptr<const std::vector<ShmMirrorBinding>> shmMirrorBindings_;
  std::unordered_map<std::string, double> pendingChannelValues_;
  mutable std::mutex stateMutex_;
  EngineLifecycleState state_ = EngineLifecycleState::EMPTY;
  EngineStopReason stopReason_ = EngineStopReason::NONE;
  double sampleRate_ = 0.0;
  int32_t ksmps_ = 0;
  uint64_t stateSequence_ = 0;
  std::string lastError_;
  mutable std::mutex callbackMutex_;
  StateChangeCallback stateChangeCallback_;
};

} // namespace blue
