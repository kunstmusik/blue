#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <string>
#include <thread>

namespace blue {

class OwnerMonitor {
public:
  using OwnerLostCallback = std::function<void()>;

  OwnerMonitor() = default;
  ~OwnerMonitor();

  OwnerMonitor(const OwnerMonitor &) = delete;
  OwnerMonitor &operator=(const OwnerMonitor &) = delete;

  bool start(int64_t ownerPid, OwnerLostCallback callback,
             bool requireParentProcess = true);
  void stop();
  bool isWatching() const;

private:
  int64_t ownerPid_ = 0;
  std::atomic<bool> watching_{false};
  std::atomic<bool> stopRequested_{false};
  std::atomic<bool> notified_{false};
  std::thread watcherThread_;
  OwnerLostCallback callback_;
  std::string ownerIdentityToken_;
#if defined(_WIN32)
  void* ownerProcessHandle_ = nullptr;
#elif defined(__APPLE__)
  int ownerKqueueFd_ = -1;
#endif

  void watchLoop();
};

} // namespace blue
