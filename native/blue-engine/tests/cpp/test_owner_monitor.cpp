#include "process/OwnerMonitor.h"
#include "OwnerMonitorTestSupport.h"

#include <atomic>
#include <cassert>
#include <chrono>
#include <iostream>
#include <thread>

#if defined(_WIN32)
#include <windows.h>
#include <process.h>
#else
#include <unistd.h>
#endif

int main() {
  using namespace blue::test;

  // 1. Rejects PID <= 0
  {
    blue::OwnerMonitor monitor;
    assert(!monitor.start(0, []() {}));
    assert(!monitor.start(-1, []() {}));
    assert(!monitor.isWatching());
  }

  // 2. Rejects self PID
  {
    blue::OwnerMonitor monitor;
#if defined(_WIN32)
    int64_t selfPid = static_cast<int64_t>(GetCurrentProcessId());
#else
    int64_t selfPid = static_cast<int64_t>(getpid());
#endif
    assert(!monitor.start(selfPid, []() {}));
    assert(!monitor.isWatching());
  }

  // 3. Rejects dead / non-existent PID
  {
    blue::OwnerMonitor monitor;
    assert(!monitor.start(99999999, []() {}));
    assert(!monitor.isWatching());
  }

  // 4. Production mode accepts only the process that directly owns the
  // engine. This exercises the platform parent-death setup path.
  {
    blue::OwnerMonitor monitor;
    const int64_t parentPid = currentParentPid();
    assert(parentPid > 0);
    assert(monitor.start(parentPid, []() {}));
    assert(monitor.isWatching());
    monitor.stop();
    assert(!monitor.isWatching());
  }

  // 5. Starts on running dummy process and fires callback on owner exit
  {
    DummyProcess dummy;
    assert(dummy.spawn());
    assert(isProcessAlive(dummy.pid()));

    std::atomic<int> callbackCount{0};
    blue::OwnerMonitor monitor;
    // A sibling process is not a valid production owner. The explicit false
    // flag exercises the identity-monitoring seam used by these unit tests.
    assert(!monitor.start(dummy.pid(), []() {}));
    bool started = monitor.start(dummy.pid(), [&callbackCount]() {
      callbackCount.fetch_add(1);
    }, false);
    assert(started);
    assert(monitor.isWatching());

    // Kill dummy process to simulate owner crash/exit
    dummy.terminate();

    // Wait until callback has fired
    bool callbackFired = waitUntil([&callbackCount]() {
      return callbackCount.load() > 0;
    }, std::chrono::milliseconds(3000));

    assert(callbackFired);
    assert(callbackCount.load() == 1);

    // Ensure duplicate notifications are not emitted
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
    assert(callbackCount.load() == 1);
    monitor.stop();
    assert(!monitor.isWatching());
  }

  // 6. Normal cancellation: stop() stops watcher without calling callback
  {
    DummyProcess dummy;
    assert(dummy.spawn());

    std::atomic<int> callbackCount{0};
    blue::OwnerMonitor monitor;
    assert(monitor.start(dummy.pid(), [&callbackCount]() {
      callbackCount.fetch_add(1);
    }, false));

    // Stop monitor before dummy exits
    monitor.stop();
    assert(!monitor.isWatching());

    // Terminate dummy
    dummy.terminate();
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
    assert(callbackCount.load() == 0);
  }

  // 7. Destructor joins cleanly without deadlocks
  {
    DummyProcess dummy;
    assert(dummy.spawn());
    {
      blue::OwnerMonitor monitor;
      assert(monitor.start(dummy.pid(), []() {}, false));
      assert(monitor.isWatching());
    } // monitor destroyed here
    dummy.terminate();
  }

  std::cout << "OwnerMonitor tests passed\n";
  return 0;
}
