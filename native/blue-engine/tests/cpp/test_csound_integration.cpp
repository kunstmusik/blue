#include "csound/CsoundLoader.h"
#include "engine/CsoundEngine.h"

#include <chrono>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>

namespace {
constexpr int kCtestSkipReturnCode = 77;

void require(bool condition, const std::string &message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}
} // namespace

int main() {
  try {
    if (!blue::CsoundLoader::initialize()) {
      std::cout << "Skipping Csound integration test: "
                << blue::CsoundLoader::getError() << '\n';
      return kCtestSkipReturnCode;
    }

    blue::CsoundEngine engine;
    engine.setThreadPriorityElevationEnabled(false);
    require(engine.create(), engine.getLastError());
    require(engine.setOption("-n"), engine.getLastError());
    require(engine.setOption("-d"), engine.getLastError());
    require(engine.compileOrc(R"(
sr = 48000
ksmps = 32
nchnls = 2
0dbfs = 1
instr 1
  a0 init 0
  out a0, a0
endin
)"), engine.getLastError());
    require(engine.readScore("i1 0 0.05"), engine.getLastError());
    require(engine.start(), engine.getLastError());

    const auto deadline =
        std::chrono::steady_clock::now() + std::chrono::seconds(5);
    while (engine.isRunning() && std::chrono::steady_clock::now() < deadline) {
      std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    require(!engine.isRunning(), "Null-audio performance did not complete");
    const auto state = engine.getStateSnapshot();
    require(state.stopReason == blue::EngineStopReason::COMPLETED,
            "Null-audio performance did not report completion");
    engine.destroy();
    std::cout << "Csound 7 null-audio integration test passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "Csound integration test failed: " << error.what() << '\n';
    return 1;
  }
}
