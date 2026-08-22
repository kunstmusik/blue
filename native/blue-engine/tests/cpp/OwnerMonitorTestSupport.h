#pragma once

#include <atomic>
#include <chrono>
#include <cstdint>
#include <functional>
#include <thread>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <tlhelp32.h>
#else
#include <csignal>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#endif

namespace blue::test {

inline bool isProcessAlive(int64_t pid) {
  if (pid <= 0) {
    return false;
  }
#if defined(_WIN32)
  HANDLE processHandle = OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, FALSE, static_cast<DWORD>(pid));
  if (!processHandle) {
    return false;
  }
  DWORD exitCode = 0;
  if (GetExitCodeProcess(processHandle, &exitCode) && exitCode == STILL_ACTIVE) {
    CloseHandle(processHandle);
    return true;
  }
  CloseHandle(processHandle);
  return false;
#else
  return ::kill(static_cast<pid_t>(pid), 0) == 0;
#endif
}

inline int64_t currentParentPid() {
#if defined(_WIN32)
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return 0;
  }

  PROCESSENTRY32 entry{};
  entry.dwSize = sizeof(entry);
  int64_t parentPid = 0;
  if (Process32First(snapshot, &entry)) {
    do {
      if (entry.th32ProcessID == GetCurrentProcessId()) {
        parentPid = static_cast<int64_t>(entry.th32ParentProcessID);
        break;
      }
    } while (Process32Next(snapshot, &entry));
  }
  CloseHandle(snapshot);
  return parentPid;
#else
  return static_cast<int64_t>(getppid());
#endif
}

class DummyProcess {
public:
  DummyProcess() = default;

  ~DummyProcess() {
    terminate();
  }

  bool spawn() {
#if defined(_WIN32)
    STARTUPINFOA si;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi_, sizeof(pi_));

    // Launch a background timeout / ping command
    char cmd[] = "ping 127.0.0.1 -n 30 > NUL";
    if (!CreateProcessA(NULL, cmd, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi_)) {
      return false;
    }
    pid_ = static_cast<int64_t>(pi_.dwProcessId);
    return true;
#else
    pid_t pid = fork();
    if (pid < 0) {
      return false;
    }
    if (pid == 0) {
      // Child process sleeps for up to 30 seconds
      ::execlp("sleep", "sleep", "30", static_cast<char*>(nullptr));
      ::_exit(127);
    }
    pid_ = static_cast<int64_t>(pid);
    return true;
#endif
  }

  int64_t pid() const {
    return pid_;
  }

  void terminate() {
    if (pid_ <= 0) {
      return;
    }
#if defined(_WIN32)
    if (pi_.hProcess) {
      TerminateProcess(pi_.hProcess, 0);
      WaitForSingleObject(pi_.hProcess, 1000);
      CloseHandle(pi_.hProcess);
      CloseHandle(pi_.hThread);
      pi_.hProcess = NULL;
      pi_.hThread = NULL;
    }
#else
    ::kill(static_cast<pid_t>(pid_), SIGKILL);
    int status = 0;
    ::waitpid(static_cast<pid_t>(pid_), &status, 0);
#endif
    pid_ = 0;
  }

private:
  int64_t pid_ = 0;
#if defined(_WIN32)
  PROCESS_INFORMATION pi_{};
#endif
};

inline bool waitUntil(const std::function<bool()>& condition, std::chrono::milliseconds timeout) {
  const auto deadline = std::chrono::steady_clock::now() + timeout;
  while (std::chrono::steady_clock::now() < deadline) {
    if (condition()) {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
  return condition();
}

} // namespace blue::test
