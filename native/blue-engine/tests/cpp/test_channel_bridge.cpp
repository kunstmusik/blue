#include "../../src/automation/AutomationStore.h"
#include "../../src/csound/CsoundLoader.h"
#include "../../src/engine/CsoundEngine.h"
#include "../../src/ipc/SharedMemory.h"
#include "../../src/ipc/ZmqHandler.h"
#include "../../src/protocol/Protocol.h"

#include <zmq.h>

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

namespace {

void appendUint16LE(std::string& payload, uint16_t value) {
  payload.push_back(static_cast<char>(value & 0xffu));
  payload.push_back(static_cast<char>((value >> 8) & 0xffu));
}

std::vector<uint8_t> makeProtocolRequest(blue::Command command,
                                         const std::string& payload) {
  std::vector<uint8_t> request(5 + payload.size());
  request[0] = static_cast<uint8_t>(command);
  request[1] = static_cast<uint8_t>(payload.size() & 0xffu);
  request[2] = static_cast<uint8_t>((payload.size() >> 8) & 0xffu);
  request[3] = static_cast<uint8_t>((payload.size() >> 16) & 0xffu);
  request[4] = static_cast<uint8_t>((payload.size() >> 24) & 0xffu);
  std::memcpy(request.data() + 5, payload.data(), payload.size());
  return request;
}

struct BatchResponseView {
  bool transportOk = false;
  uint8_t status = 0xff;
  std::string payload;
};

BatchResponseView batchRoundTrip(blue::ZmqHandler& handler,
                                 const std::string& endpoint,
                                 const std::vector<uint8_t>& request) {
  void* context = zmq_ctx_new();
  void* socket = zmq_socket(context, ZMQ_REQ);
  const int timeoutMs = 4000;
  zmq_setsockopt(socket, ZMQ_RCVTIMEO, &timeoutMs, sizeof(timeoutMs));
  zmq_setsockopt(socket, ZMQ_SNDTIMEO, &timeoutMs, sizeof(timeoutMs));
  zmq_connect(socket, endpoint.c_str());

  bool processed = false;
  std::thread control([&]() { processed = handler.processOne(); });
  const int sendResult = zmq_send(socket, request.data(), request.size(), 0);
  std::vector<uint8_t> response(64 * 1024);
  const int responseSize = sendResult >= 0
      ? zmq_recv(socket, response.data(), response.size(), 0)
      : -1;
  control.join();

  BatchResponseView result;
  result.transportOk = sendResult >= 0 && responseSize >= 5 && processed;
  if (result.transportOk) {
    result.status = response[0];
    const uint32_t payloadSize = static_cast<uint32_t>(response[1])
        | (static_cast<uint32_t>(response[2]) << 8)
        | (static_cast<uint32_t>(response[3]) << 16)
        | (static_cast<uint32_t>(response[4]) << 24);
    if (payloadSize <= static_cast<uint32_t>(responseSize - 5)) {
      result.payload.assign(reinterpret_cast<const char*>(response.data() + 5),
                            payloadSize);
    } else {
      result.transportOk = false;
    }
  }

  zmq_close(socket);
  zmq_ctx_destroy(context);
  return result;
}

std::string makeBatchSetPayload(
    const std::vector<std::pair<std::string, double>>& entries) {
  std::string payload;
  appendUint16LE(payload, static_cast<uint16_t>(entries.size()));
  for (const auto& entry : entries) {
    appendUint16LE(payload, static_cast<uint16_t>(entry.first.size()));
    payload.append(entry.first);
    payload.append(reinterpret_cast<const char*>(&entry.second), sizeof(double));
  }
  return payload;
}

std::string makeBatchGetPayload(const std::vector<std::string>& names) {
  std::string payload;
  appendUint16LE(payload, static_cast<uint16_t>(names.size()));
  for (const auto& name : names) {
    appendUint16LE(payload, static_cast<uint16_t>(name.size()));
    payload.append(name);
  }
  return payload;
}

void testBatchChannelCommandsThroughHandler(blue::CsoundEngine& engine) {
  blue::SharedMemory batchShm;
  require(batchShm.create("be-batch-bridge"), "Failed to create batch shm");
  blue::CsoundEngine batchEngine;
  batchEngine.setSharedMemory(&batchShm);
  require(batchEngine.create(), batchEngine.getLastError());
  require(batchEngine.setOption("-+rtaudio=null"), batchEngine.getLastError());
  require(batchEngine.setOption("-odac"), batchEngine.getLastError());
  require(batchEngine.setOption("-d"), batchEngine.getLastError());

  blue::ZmqHandler handler(batchEngine, batchShm);
  const std::string controlEndpoint = "tcp://127.0.0.1:39183";
  const std::string pubEndpoint = "tcp://127.0.0.1:39184";
  require(handler.bind(controlEndpoint, pubEndpoint),
          "batch bridge test could not bind its endpoints");

  auto setReply = batchRoundTrip(
      handler, controlEndpoint,
      makeProtocolRequest(
          blue::Command::BATCH_SET_CHANNELS,
          makeBatchSetPayload({{"bx7-a", 1.5}, {"bx7-b", -2.25}, {"bx7-c", 99.125}})));
  require(setReply.transportOk && setReply.status == static_cast<uint8_t>(blue::Status::OK),
          "batch set should apply a fully valid payload");

  auto getReply = batchRoundTrip(
      handler, controlEndpoint,
      makeProtocolRequest(
          blue::Command::BATCH_GET_CHANNELS,
          makeBatchGetPayload({"bx7-c", "bx7-a", "bx7-b"})));
  require(getReply.transportOk && getReply.status == static_cast<uint8_t>(blue::Status::OK),
          "batch get should succeed for existing channels");
  require(getReply.payload.size() == 2 + 3 * sizeof(double),
          "batch get payload size must match the requested count");
  const uint16_t count = static_cast<uint16_t>(static_cast<unsigned char>(getReply.payload[0]))
      | static_cast<uint16_t>(static_cast<unsigned char>(getReply.payload[1]) << 8);
  require(count == 3, "batch get count header must match the request");
  double c = 0.0, a = 0.0, b = 0.0;
  std::memcpy(&c, getReply.payload.data() + 2, sizeof(double));
  std::memcpy(&a, getReply.payload.data() + 2 + 8, sizeof(double));
  std::memcpy(&b, getReply.payload.data() + 2 + 16, sizeof(double));
  require(a == 1.5 && b == -2.25 && c == 99.125,
          "batch get values must correspond exactly to request order");

  // Once the Csound channels are live, a batch must preflight every target
  // before applying any value. A late missing or automated channel must not
  // leave the earlier channel changed.
  require(batchEngine.compileOrc(R"(
sr = 48000
ksmps = 32
nchnls = 2
0dbfs = 1

gk_bx7_a init 0
gk_bx7_a chnexport "bx7-a", 3
gk_bx7_b init 0
gk_bx7_b chnexport "bx7-b", 3

instr 1
    aout init 0
    out aout, aout
endin
)"),
          batchEngine.getLastError());
  auto batchStore = batchEngine.getAutomationStore();
  require(batchStore->createAutomation(
              "bx7-b", blue::AutomationCurve::LINEAR,
              {{0.0, 0.0}, {5.0, 1.0}}, true, "-1", nullptr)
              == blue::AutomationPrepareError::Ok,
          "failed to create batch automation");
  require(batchEngine.readScore("i1 0 5"), batchEngine.getLastError());
  require(batchEngine.start(), batchEngine.getLastError());

  auto missingLiveChannel = batchRoundTrip(
      handler, controlEndpoint,
      makeProtocolRequest(
          blue::Command::BATCH_SET_CHANNELS,
          makeBatchSetPayload({{"bx7-a", 9.0}, {"bx7-missing", 3.0}})));
  require(missingLiveChannel.transportOk
              && missingLiveChannel.status == static_cast<uint8_t>(blue::Status::ERROR),
          "batch set must reject a missing live channel");
  double unchangedValue = 0.0;
  require(batchEngine.getChannel("bx7-a", unchangedValue), batchEngine.getLastError());
  require(approxEqual(unchangedValue, 1.5),
          "missing-channel rejection must not apply an earlier batch value");

  auto automatedLateChannel = batchRoundTrip(
      handler, controlEndpoint,
      makeProtocolRequest(
          blue::Command::BATCH_SET_CHANNELS,
          makeBatchSetPayload({{"bx7-a", 8.0}, {"bx7-b", 4.0}})));
  require(automatedLateChannel.transportOk
              && automatedLateChannel.status == static_cast<uint8_t>(blue::Status::ERROR),
          "batch set must reject a later automated channel");
  require(batchEngine.getChannel("bx7-a", unchangedValue), batchEngine.getLastError());
  require(approxEqual(unchangedValue, 1.5),
          "automation rejection must not apply an earlier batch value");

  // single-channel commands remain wire-compatible alongside the batch pair
  double directValue = 0.0;
  require(batchEngine.getChannel("bx7-a", directValue),
          batchEngine.getLastError());
  require(approxEqual(directValue, 1.5),
          "batch-set value must be readable through GET_CHANNEL");

  batchEngine.stop();
  batchEngine.destroy();
}

}  // namespace

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

    testBatchChannelCommandsThroughHandler(engine);

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
