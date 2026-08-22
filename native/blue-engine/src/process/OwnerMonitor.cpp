#include "OwnerMonitor.h"

#include <chrono>
#include <fstream>
#include <optional>
#include <sstream>
#include <utility>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <tlhelp32.h>
#else
#if defined(__APPLE__)
#include <libproc.h>
#include <sys/event.h>
#include <sys/time.h>
#elif defined(__linux__)
#include <sys/prctl.h>
#include <sys/types.h>
#endif
#include <cerrno>
#include <csignal>
#include <unistd.h>
#endif

namespace blue {

namespace {

int64_t getCurrentProcessId() {
#if defined(_WIN32)
  return static_cast<int64_t>(GetCurrentProcessId());
#else
  return static_cast<int64_t>(getpid());
#endif
}

std::optional<std::string> readProcessIdentity(int64_t pid) {
#if defined(__linux__)
  std::ifstream statFile("/proc/" + std::to_string(pid) + "/stat");
  std::string stat;
  if (!statFile || !std::getline(statFile, stat)) {
    return std::nullopt;
  }

  // The process command name is parenthesized and may itself contain ')'.
  // The start time is field 22, which is the twentieth field after that
  // command name.
  const size_t commandEnd = stat.rfind(')');
  if (commandEnd == std::string::npos || commandEnd + 2 > stat.size()) {
    return std::nullopt;
  }
  std::istringstream fields(stat.substr(commandEnd + 2));
  std::string value;
  for (int field = 3; field <= 22; ++field) {
    if (!(fields >> value)) {
      return std::nullopt;
    }
  }
  return value.empty() ? std::nullopt
                       : std::optional<std::string>("linux:" + value);
#elif defined(__APPLE__)
  proc_bsdinfo processInfo{};
  const int result = proc_pidinfo(
      static_cast<int>(pid), PROC_PIDTBSDINFO, 0, &processInfo,
      static_cast<int>(sizeof(processInfo)));
  if (result != static_cast<int>(sizeof(processInfo))) {
    return std::nullopt;
  }
  return "mac:" + std::to_string(processInfo.pbi_start_tvsec) + ":" +
         std::to_string(processInfo.pbi_start_tvusec);
#else
  (void)pid;
  return std::nullopt;
#endif
}

#if defined(_WIN32)
HANDLE openOwnerProcess(int64_t pid) {
  if (pid <= 0) {
    return nullptr;
  }

  HANDLE processHandle = OpenProcess(
      SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, FALSE,
      static_cast<DWORD>(pid));
  if (!processHandle) {
    return nullptr;
  }

  DWORD exitCode = 0;
  if (!GetExitCodeProcess(processHandle, &exitCode) ||
      exitCode != STILL_ACTIVE) {
    CloseHandle(processHandle);
    return nullptr;
  }
  return processHandle;
}

std::optional<int64_t> readParentProcessId(int64_t pid) {
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return std::nullopt;
  }

  PROCESSENTRY32 entry{};
  entry.dwSize = sizeof(entry);
  std::optional<int64_t> parentPid;
  if (Process32First(snapshot, &entry)) {
    do {
      if (static_cast<int64_t>(entry.th32ProcessID) == pid) {
        parentPid = static_cast<int64_t>(entry.th32ParentProcessID);
        break;
      }
    } while (Process32Next(snapshot, &entry));
  }
  CloseHandle(snapshot);
  return parentPid;
}
#endif

bool isDirectParent(int64_t ownerPid) {
#if defined(_WIN32)
  const auto parentPid = readParentProcessId(getCurrentProcessId());
  return parentPid && *parentPid == ownerPid;
#else
  return static_cast<int64_t>(getppid()) == ownerPid;
#endif
}

#if defined(__linux__)
bool armParentDeathSignal(int64_t ownerPid) {
  if (prctl(PR_SET_PDEATHSIG, SIGTERM) != 0) {
    return false;
  }
  // The owner may exit between the initial parent check and prctl(). Check
  // again before allowing the engine to bind or service any requests.
  return static_cast<int64_t>(getppid()) == ownerPid;
}
#endif

#if defined(__APPLE__)
int createOwnerExitQueue(int64_t ownerPid) {
  const int queue = kqueue();
  if (queue < 0) {
    return -1;
  }

  struct kevent event;
  EV_SET(&event, static_cast<uintptr_t>(ownerPid), EVFILT_PROC,
         EV_ADD | EV_ENABLE | EV_ONESHOT, NOTE_EXIT, 0, nullptr);
  if (kevent(queue, &event, 1, nullptr, 0, nullptr) < 0) {
    close(queue);
    return -1;
  }
  return queue;
}
#endif

} // namespace

OwnerMonitor::~OwnerMonitor() {
  stop();
}

bool OwnerMonitor::start(int64_t ownerPid, OwnerLostCallback callback,
                         bool requireParentProcess) {
  if (ownerPid <= 0 || !callback) {
    return false;
  }

  if (ownerPid == getCurrentProcessId()) {
    return false;
  }

  stop();

  if (requireParentProcess && !isDirectParent(ownerPid)) {
    return false;
  }

#if defined(_WIN32)
  HANDLE processHandle = openOwnerProcess(ownerPid);
  if (!processHandle) {
    return false;
  }
  ownerProcessHandle_ = processHandle;
#else
  const auto identity = readProcessIdentity(ownerPid);
  if (!identity) {
    return false;
  }
  ownerIdentityToken_ = *identity;
#if defined(__linux__)
  if (requireParentProcess && !armParentDeathSignal(ownerPid)) {
    ownerIdentityToken_.clear();
    return false;
  }
#elif defined(__APPLE__)
  if (requireParentProcess) {
    ownerKqueueFd_ = createOwnerExitQueue(ownerPid);
    if (ownerKqueueFd_ < 0) {
      ownerIdentityToken_.clear();
      return false;
    }
  }
#endif
#endif

  ownerPid_ = ownerPid;
  callback_ = std::move(callback);
  stopRequested_ = false;
  notified_ = false;
  watching_ = true;

  try {
    watcherThread_ = std::thread(&OwnerMonitor::watchLoop, this);
  } catch (...) {
    stop();
    return false;
  }
  return true;
}

void OwnerMonitor::stop() {
  stopRequested_.store(true, std::memory_order_release);
  if (watcherThread_.joinable()) {
    watcherThread_.join();
  }
#if defined(_WIN32)
  if (ownerProcessHandle_) {
    CloseHandle(static_cast<HANDLE>(ownerProcessHandle_));
    ownerProcessHandle_ = nullptr;
  }
#elif defined(__APPLE__)
  if (ownerKqueueFd_ >= 0) {
    close(ownerKqueueFd_);
    ownerKqueueFd_ = -1;
  }
#endif
  ownerIdentityToken_.clear();
  callback_ = nullptr;
  ownerPid_ = 0;
  watching_.store(false, std::memory_order_release);
}

bool OwnerMonitor::isWatching() const {
  return watching_.load();
}

void OwnerMonitor::watchLoop() {
  while (!stopRequested_.load()) {
    bool ownerAlive = false;
#if defined(_WIN32)
    ownerAlive = ownerProcessHandle_ &&
                 WaitForSingleObject(static_cast<HANDLE>(ownerProcessHandle_), 0) == WAIT_TIMEOUT;
#elif defined(__APPLE__)
    if (ownerKqueueFd_ >= 0) {
      struct kevent event;
      struct timespec timeout{0, 50 * 1000 * 1000};
      const int result = kevent(ownerKqueueFd_, nullptr, 0, &event, 1, &timeout);
      if (result > 0) {
        ownerAlive = false;
      } else if (result == 0 || (result < 0 && errno == EINTR)) {
        ownerAlive = true;
      }
    } else {
      const auto identity = readProcessIdentity(ownerPid_);
      ownerAlive = identity && *identity == ownerIdentityToken_;
    }
#else
    const auto identity = readProcessIdentity(ownerPid_);
    ownerAlive = identity && *identity == ownerIdentityToken_;
#endif

    if (!ownerAlive) {
      if (!stopRequested_.load() && !notified_.exchange(true)) {
        if (callback_) {
          callback_();
        }
      }
      break;
    }

    std::this_thread::sleep_for(std::chrono::milliseconds(50));
  }

  watching_.store(false, std::memory_order_release);
}

} // namespace blue
