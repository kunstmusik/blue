#include "process/OwnerMonitor.h"
#include "OwnerMonitorTestSupport.h"

#include <atomic>
#include <cassert>
#include <chrono>
#include <iostream>
#include <thread>

int main() {
  using namespace blue::test;

  std::cout << "Starting OwnerMonitor integration test...\n";

  std::atomic<bool> ownerLossReported{false};
  std::atomic<int> callbackCount{0};

  blue::OwnerMonitor monitor;

  DummyProcess owner;
  if (!owner.spawn()) {
    std::cerr << "Could not spawn owner process\n";
    return 1;
  }
  const auto ownerPid = owner.pid();
  if (ownerPid <= 0 || !waitUntil([&ownerPid]() {
        return isProcessAlive(ownerPid);
      }, std::chrono::milliseconds(1000))) {
    std::cerr << "Owner process did not become ready\n";
    return 1;
  }

  bool started = monitor.start(ownerPid, [&ownerLossReported, &callbackCount]() {
    ownerLossReported = true;
    callbackCount.fetch_add(1);
  }, false);
  if (!started || !monitor.isWatching()) {
    std::cerr << "Owner monitor did not start\n";
    return 1;
  }

  // Terminate owner process abruptly
  owner.terminate();

  const auto startTime = std::chrono::steady_clock::now();
  while (!ownerLossReported.load()) {
    const auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
      std::chrono::steady_clock::now() - startTime
    ).count();
    if (elapsed > 5) {
      std::cerr << "Owner loss detection timed out (> 5 seconds)\n";
      return 1;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
  }

  if (!ownerLossReported.load() || callbackCount.load() != 1) {
    std::cerr << "Owner loss callback count was incorrect\n";
    return 1;
  }

  // Monitor stop should be clean and joined
  monitor.stop();
  if (monitor.isWatching()) {
    std::cerr << "Owner monitor did not stop\n";
    return 1;
  }

  std::cout << "OwnerMonitor integration test passed\n";
  return 0;
}
