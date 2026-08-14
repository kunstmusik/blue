#include "../../src/automation/AutomationStore.h"
#include "../../src/csound/CsoundLoader.h"
#include "../../src/engine/CsoundEngine.h"
#include "../../src/ipc/SharedMemory.h"

#include <chrono>
#include <cmath>
#include <cstring>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {

constexpr int kCtestSkipReturnCode = 77;

void require(bool condition, const std::string &message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

bool approxEqual(double left, double right, double tolerance = 1e-6) {
  return std::abs(left - right) <= tolerance;
}

void testIeee754BitwiseDeduplicationAndSpecialValues() {
  const std::string shmName = "be-ieee-test";
  blue::SharedMemory shm;
  if (!shm.create(shmName)) {
    throw std::runtime_error("shared memory unavailable");
  }

  require(shm.createChannel("pos_zero", +0.0), "Failed pos_zero channel creation");
  require(shm.createChannel("neg_zero", -0.0), "Failed neg_zero channel creation");
  require(shm.createChannel("inf_val", std::numeric_limits<double>::infinity()), "Failed inf channel creation");

  double readVal = 0.0;
  require(shm.getChannel("pos_zero", readVal), "Failed pos_zero read");
  uint64_t posBits = 0;
  std::memcpy(&posBits, &readVal, sizeof(double));

  require(shm.getChannel("neg_zero", readVal), "Failed neg_zero read");
  uint64_t negBits = 0;
  std::memcpy(&negBits, &readVal, sizeof(double));

  // Verify sign bit distinguishes +0.0 from -0.0 (bit 63)
  require((posBits & (1ULL << 63)) == 0, "+0.0 sign bit must be 0");
  require((negBits & (1ULL << 63)) != 0, "-0.0 sign bit must be 1");

  require(shm.getChannel("inf_val", readVal), "Failed inf read");
  require(std::isinf(readVal) && readVal > 0, "Infinity bit pattern mismatch");
}

} // namespace

int main() {
  try {
    testIeee754BitwiseDeduplicationAndSpecialValues();

    if (!blue::CsoundLoader::load()) {
      std::cout << "Skipping channel bridge test: "
                << blue::CsoundLoader::getError() << std::endl;
      return kCtestSkipReturnCode;
    }

    const std::string shmName = "be-chan-bridge";
    blue::SharedMemory shm;
    require(shm.create(shmName), "Failed to create shared memory");

    blue::CsoundEngine engine;
    engine.setSharedMemory(&shm);

    require(engine.create(), engine.getLastError());
    require(engine.setOption("-+rtaudio=null"), engine.getLastError());
    require(engine.setOption("-odac"), engine.getLastError());
    require(engine.setOption("-d"), engine.getLastError());

    require(engine.createChannel("freq", 330.0), engine.getLastError());
    require(engine.setChannel("amp", 0.25), engine.getLastError());

    double value = 0.0;
    require(engine.getChannel("freq", value), engine.getLastError());
    require(approxEqual(value, 330.0), "Pending freq value mismatch before compile");
    require(shm.getChannel("freq", value), "Missing freq mirror before compile");
    require(approxEqual(value, 330.0), "Shared-memory freq mismatch before compile");

    const std::string orc = R"(
sr = 48000
ksmps = 32
nchnls = 2
0dbfs = 1

gk_freq init 0
gk_freq chnexport "freq", 3

gk_amp init 0
gk_amp chnexport "amp", 3

instr 1
    aout init 0
    out aout, aout
endin
)";

    require(engine.compileOrc(orc), engine.getLastError());
    require(engine.getChannel("freq", value), engine.getLastError());
    require(approxEqual(value, 330.0), "Pending freq value was not applied after compile");
    require(engine.getChannel("amp", value), engine.getLastError());
    require(approxEqual(value, 0.25), "Pending amp value was not applied after compile");
    require(shm.getChannel("amp", value), "Missing amp mirror after compile");
    require(approxEqual(value, 0.25), "Shared-memory amp mismatch after compile");

    auto store = engine.getAutomationStore();
    std::vector<blue::AutomationPoint> automationPoints = {
        {0.0, 330.0},
        {0.3, 660.0},
    };
    uint32_t automationId = 0;
    require(store->createAutomation(
                "freq", blue::AutomationCurve::LINEAR, automationPoints, true,
                "-1", &automationId) == blue::AutomationPrepareError::Ok,
            "Failed to create automation");
    require(automationId > 0, "Failed to create automation");

    require(engine.readScore("i1 0 0.4"), engine.getLastError());
    require(engine.start(), engine.getLastError());

    require(!engine.setChannel("freq", 440.0),
            "SET_CHANNEL should fail for an automated channel during playback");
    require(engine.getLastError().find("automated channel") != std::string::npos,
            "Unexpected error for automated channel write rejection");

    double liveValue = 0.0;
    double mirroredValue = 0.0;
    bool observedAutomation = false;
    for (int i = 0; i < 20; ++i) {
      std::this_thread::sleep_for(std::chrono::milliseconds(25));
      if (!engine.getChannel("freq", liveValue) || !shm.getChannel("freq", mirroredValue)) {
        continue;
      }
      if (liveValue > 340.0 && mirroredValue > 340.0) {
        observedAutomation = true;
        break;
      }
    }

    require(observedAutomation, "Automation did not update the live control channel");
    require(liveValue < 670.0, "Live control channel overshot the expected range");
    require(std::abs(liveValue - mirroredValue) < 5.0,
            "Shared-memory mirror did not track the live control channel");

    // Exercise the pointer lifetime boundary while playback is active. The
    // engine must quiesce the perform thread before Csound can replace channel
    // storage, then publish a fresh binding snapshot before resuming.
    require(engine.compileOrc(R"(
instr 2
    aout init 0
    out aout, aout
endin
)"),
            "Live orchestra recompilation failed while playback was active");

    engine.stop();
    engine.destroy();

    std::cout << "Channel bridge tests passed" << std::endl;
    return 0;
  } catch (const std::exception &error) {
    if (std::string(error.what()).find("shared memory unavailable") !=
        std::string::npos) {
      std::cout << "Skipping channel bridge test: shared memory unavailable"
                << std::endl;
      return kCtestSkipReturnCode;
    }
    std::cerr << "Channel bridge test failed: " << error.what() << std::endl;
    return 1;
  }
}
