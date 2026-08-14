#include "automation/AutomationStore.h"
#include "csound/CsoundLoader.h"
#include "engine/CsoundEngine.h"
#include "ipc/SharedMemory.h"

#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {
constexpr int kSkip = 77;

std::string orchestra(int channelCount) {
  std::ostringstream orc;
  orc << "sr = 48000\nksmps = 32\nnchnls = 2\n0dbfs = 1\n\n";
  for (int index = 0; index < channelCount; ++index) {
    orc << "gk_chan" << index << " init 0\n"
        << "gk_chan" << index << " chnexport \"chan_" << index
        << "\", 3\n";
  }
  orc << "\ninstr 1\n  a0 init 0\n  out a0, a0\nendin\n";
  return orc.str();
}

std::string liveCompileOrchestra(uint64_t iteration) {
  std::ostringstream orc;
  orc << "instr " << (2 + (iteration / 3)) << R"(
  a0 init 0
  out a0, a0
endin
 )";
  return orc.str();
}

std::string rebindOrchestra(uint64_t iteration) {
  std::ostringstream orc;
  orc << "\n";
  for (int index = 0; index < 32; ++index) {
    orc << "gk_chan" << index << " init 0\n"
        << "gk_chan" << index << " chnexport \"chan_" << index
        << "\", 3\n";
  }
  orc << "instr " << (100 + iteration) << R"(
  a0 init 0
  out a0, a0
endin
 )";
  return orc.str();
}

std::string restartOrchestra() {
  return R"(
sr = 48000
ksmps = 32
nchnls = 2
0dbfs = 1
instr 1
  a0 init 0
  out a0, a0
endin
)";
}

void require(bool condition, const std::string &message,
             const blue::CsoundEngine &engine) {
  if (!condition) {
    throw std::runtime_error(message +
                             (engine.getLastError().empty()
                                  ? std::string{}
                                  : ": " + engine.getLastError()));
  }
}
} // namespace

int main(int argc, char **argv) {
  int durationSeconds = 10;
  if (argc == 3 && std::string(argv[1]) == "--duration-seconds") {
    durationSeconds = std::max(1, std::atoi(argv[2]));
  }

  if (!blue::CsoundLoader::initialize()) {
    std::cout << "Skipping Csound stress test: "
              << blue::CsoundLoader::getError() << '\n';
    return kSkip;
  }

  try {
    blue::SharedMemory sharedMemory;
    const auto uniqueName = std::string("be-stress-") +
                            std::to_string(std::chrono::steady_clock::now()
                                               .time_since_epoch()
                                               .count());
    if (!sharedMemory.create(uniqueName)) {
      std::cout << "Skipping Csound stress test: shared memory unavailable\n";
      return kSkip;
    }

    constexpr int kChannelCount = 32;
    blue::CsoundEngine engine;
    engine.setSharedMemory(&sharedMemory);
    engine.setThreadPriorityElevationEnabled(false);
    require(engine.create(), "engine create failed", engine);
    require(engine.setOption("-n"), "set -n failed", engine);
    require(engine.setOption("-d"), "set -d failed", engine);
    require(engine.setOption("-m0"), "set -m0 failed", engine);
    require(engine.compileOrc(orchestra(kChannelCount)),
            "initial orchestra compile failed", engine);
    for (int index = 0; index < kChannelCount; ++index) {
      require(engine.createChannel("chan_" + std::to_string(index), 0.0),
              "channel creation failed", engine);
    }

    const auto store = engine.getAutomationStore();
    for (int index = 0; index < kChannelCount; ++index) {
      store->createAutomation(
          "chan_" + std::to_string(index), blue::AutomationCurve::LINEAR,
          std::vector<blue::AutomationPoint>{{0.0, 0.0}, {1.0, 1.0}}, true,
          index % 3 == 0 ? "0.01" : "-1");
    }

    std::atomic<bool> stopWriters{false};
    std::atomic<uint64_t> updates{0};
    std::thread writer([&]() {
      uint64_t iteration = 0;
      while (!stopWriters.load(std::memory_order_relaxed)) {
        const double endpoint = (iteration % 2 == 0) ? 1.0 : 0.25;
        for (int index = 0; index < kChannelCount; ++index) {
          store->updateAutomation(
              "chan_" + std::to_string(index),
              index % 2 == 0 ? blue::AutomationCurve::LINEAR
                             : blue::AutomationCurve::EXPONENTIAL,
              std::vector<blue::AutomationPoint>{{0.0, 0.0},
                                                  {1.0, endpoint}},
              true, index % 3 == 0 ? "0.01" : "-1");
        }
        updates.fetch_add(1, std::memory_order_relaxed);
        ++iteration;
        std::this_thread::sleep_for(std::chrono::milliseconds(2));
      }
    });

    const auto deadline = std::chrono::steady_clock::now() +
                          std::chrono::seconds(durationSeconds);
    uint64_t lifecycleIterations = 0;
    while (std::chrono::steady_clock::now() < deadline) {
      // An indefinite event ensures the explicit stop path owns the lifecycle
      // boundary; this avoids relying on how quickly null audio can finish a
      // finite score and makes repeated restart behavior deterministic.
      require(engine.setOption("-n"), "restart set -n failed", engine);
      require(engine.setOption("-d"), "restart set -d failed", engine);
      require(engine.setOption("-m0"), "restart set -m0 failed", engine);
      require(engine.compileOrc(restartOrchestra()),
              "restart orchestra compile failed", engine);
      require(engine.readScore("i1 0 -1"), "score update failed", engine);
      require(engine.start(), "restart failed", engine);

      // First run without exported channels to exercise the unresolved-binding
      // path, then add the same channel names back while playback is active.
      // The engine must stop at a k-cycle boundary, rebuild immutable channel
      // snapshots, rebind the automation pointers, and resume.
      if ((lifecycleIterations % 2) == 0) {
        require(engine.compileOrc(rebindOrchestra(lifecycleIterations)),
                "channel rebind failed", engine);
      }

      // Recompile while the perform thread is active with a distinct
      // channel-free instrument as well, covering repeated live compilation.
      if ((lifecycleIterations % 3) == 0) {
        require(engine.compileOrc(liveCompileOrchestra(lifecycleIterations)),
                "live compile failed", engine);
      }
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
      engine.stop();

      if ((lifecycleIterations % 2) == 0) {
        double mirroredValue = 0.0;
        require(sharedMemory.getChannel("chan_0", mirroredValue),
                "rebound channel mirror missing", engine);
        require(std::isfinite(mirroredValue),
                "rebound channel mirror was not published", engine);
      }
      ++lifecycleIterations;
    }

    stopWriters.store(true, std::memory_order_relaxed);
    writer.join();
    engine.stop();
    require(updates.load(std::memory_order_relaxed) > 0,
            "automation writer did not make progress", engine);
    require(lifecycleIterations > 0, "lifecycle loop did not make progress",
            engine);
    engine.destroy();
    std::cout << "Csound lifecycle stress passed: " << lifecycleIterations
              << " restarts, " << updates.load() << " automation updates\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "Csound lifecycle stress failed: " << error.what() << '\n';
    return 1;
  }
}
