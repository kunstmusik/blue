#include "engine/CsoundEngine.h"
#include "ipc/SharedMemory.h"
#include "ipc/ZmqHandler.h"

#include <cassert>
#include <chrono>
#include <iostream>
#include <thread>

int main() {
  blue::CsoundEngine engine;
  blue::SharedMemory sharedMemory;
  blue::ZmqHandler handler(engine, sharedMemory);
  assert(handler.bind("inproc://blue-idle-control",
                      "inproc://blue-idle-pub"));

  const auto started = std::chrono::steady_clock::now();
  std::thread control([&]() {
    while (handler.processOne()) {
    }
  });
  std::this_thread::sleep_for(std::chrono::milliseconds(20));
  handler.requestShutdown();
  control.join();
  const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now() - started);

  assert(handler.isShutdownRequested());
  // The bounded 50 ms poll should notice shutdown promptly without blocking
  // indefinitely or failing in CI under CPU scheduling contention.
  assert(elapsed.count() < 1500);
  std::cout << "ZMQ idle wakeup passed in " << elapsed.count() << " ms\n";
  return 0;
}
