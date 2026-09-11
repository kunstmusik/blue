// Race-safe meter sampling coverage (Spec 104 T048, FR-014, Constitution V).
//
// The meter pipeline must never read Csound control-channel memory from the
// ZeroMQ publication thread while the perform thread writes it. The engine
// samples meter taps on the perform thread and hands immutable value
// snapshots to the publication thread. This test drives a real Csound
// performance with active meter taps through the production control
// topology — every engine control-plane call (CREATE_ENGINE, SET_OPTION,
// COMPILE_ORC, READ_SCORE, START, STOP) is issued over the ZMQ command
// socket and executed on the handler thread, exactly like blue-engine
// main.cpp — while:
//   - the handler thread publishes engine.meters frames continuously,
//   - the main thread concurrently polls the atomic snapshot handoff.
// It asserts sustained delivery, strictly monotonic sequences, sanitized
// value ranges, and clean teardown state. Build with ENABLE_TSAN=1 (or
// ENABLE_SANITIZERS=1) for sanitizer-capable stress coverage.

#include "csound/CsoundLoader.h"
#include "engine/CsoundEngine.h"
#include "ipc/SharedMemory.h"
#include "ipc/ZmqHandler.h"
#include "protocol/Protocol.h"

#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <new>
#include <string>
#include <thread>
#include <vector>
#include <zmq.h>

// Global allocation hooks verifying zero perform-thread capture hot-path allocations (FR-014, T050)
void *operator new(std::size_t size) {
  if (blue::CsoundEngine::t_trapCaptureAllocations) {
    ++blue::CsoundEngine::t_trappedCaptureAllocations;
  }
  void *ptr = std::malloc(size);
  if (!ptr) {
    throw std::bad_alloc();
  }
  return ptr;
}

void operator delete(void *ptr) noexcept {
  if (blue::CsoundEngine::t_trapCaptureAllocations) {
    ++blue::CsoundEngine::t_trappedCaptureAllocations;
  }
  std::free(ptr);
}

void *operator new[](std::size_t size) {
  if (blue::CsoundEngine::t_trapCaptureAllocations) {
    ++blue::CsoundEngine::t_trappedCaptureAllocations;
  }
  void *ptr = std::malloc(size);
  if (!ptr) {
    throw std::bad_alloc();
  }
  return ptr;
}

void operator delete[](void *ptr) noexcept {
  if (blue::CsoundEngine::t_trapCaptureAllocations) {
    ++blue::CsoundEngine::t_trappedCaptureAllocations;
  }
  std::free(ptr);
}

void operator delete(void *ptr, std::size_t) noexcept {
  if (blue::CsoundEngine::t_trapCaptureAllocations) {
    ++blue::CsoundEngine::t_trappedCaptureAllocations;
  }
  std::free(ptr);
}

void operator delete[](void *ptr, std::size_t) noexcept {
  if (blue::CsoundEngine::t_trapCaptureAllocations) {
    ++blue::CsoundEngine::t_trappedCaptureAllocations;
  }
  std::free(ptr);
}

namespace {

constexpr int kCtestSkipReturnCode = 77;
constexpr int kControlPort = 5810;
constexpr int kPubPort = 5811;

double readDoubleLE(const char *data) {
  std::uint64_t bits = 0;
  for (int i = 7; i >= 0; --i) {
    bits = (bits << 8) | static_cast<std::uint8_t>(data[i]);
  }
  double value = 0.0;
  std::memcpy(&value, &bits, sizeof(double));
  return value;
}

std::uint32_t readUint32LE(const char *data) {
  return static_cast<std::uint32_t>(static_cast<std::uint8_t>(data[0])) |
         (static_cast<std::uint32_t>(static_cast<std::uint8_t>(data[1])) << 8) |
         (static_cast<std::uint32_t>(static_cast<std::uint8_t>(data[2])) << 16) |
         (static_cast<std::uint32_t>(static_cast<std::uint8_t>(data[3])) << 24);
}

std::uint16_t readUint16LE(const char *data) {
  return static_cast<std::uint16_t>(static_cast<std::uint8_t>(data[0]) |
                                    (static_cast<std::uint16_t>(
                                         static_cast<std::uint8_t>(data[1]))
                                     << 8));
}

struct MeterFrame {
  std::uint32_t sequence = 0;
  std::uint16_t channelCount = 0;
  std::uint16_t nchnls = 0;
  std::vector<std::string> keys;
  std::vector<double> rms;
  std::vector<double> peak;
};

// The orchestra mirrors the meter taps emitted by the TypeScript CSD policy
// (chn_k declarations plus per-k-cycle chnset writes) for two metered keys.
const char *kMeteredOrchestra = R"(
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1
chn_k "bm_meter_rms_src1_0", 2
chn_k "bm_meter_rms_src1_1", 2
chn_k "bm_meter_peak_src1_0", 2
chn_k "bm_meter_peak_src1_1", 2
chn_k "bm_meter_rms_src2_0", 2
chn_k "bm_meter_rms_src2_1", 2
chn_k "bm_meter_peak_src2_0", 2
chn_k "bm_meter_peak_src2_1", 2
instr 1
  kVal oscili 0.5, 2
  chnset kVal, "bm_meter_rms_src1_0"
  chnset kVal, "bm_meter_rms_src1_1"
  chnset kVal, "bm_meter_peak_src1_0"
  chnset kVal, "bm_meter_peak_src1_1"
  chnset kVal, "bm_meter_rms_src2_0"
  chnset kVal, "bm_meter_rms_src2_1"
  chnset kVal, "bm_meter_peak_src2_0"
  chnset kVal, "bm_meter_peak_src2_1"
  outch 1, kVal, 2, kVal
endin
)";

class CommandClient {
public:
  CommandClient(void *context, const std::string &address) {
    socket_ = zmq_socket(context, ZMQ_REQ);
    zmq_connect(socket_, address.c_str());
  }
  ~CommandClient() {
    if (socket_ != nullptr) {
      zmq_close(socket_);
    }
  }
  CommandClient(const CommandClient &) = delete;
  CommandClient &operator=(const CommandClient &) = delete;

  // Must run before zmq_ctx_term: a context with open sockets never
  // terminates.
  void close() {
    if (socket_ != nullptr) {
      zmq_close(socket_);
      socket_ = nullptr;
    }
  }

  // Returns true when the command succeeded; fills `error` from the
  // response payload otherwise.
  bool call(blue::Command command, const std::string &payload,
            std::string *error) {
    std::vector<std::uint8_t> request(5 + payload.size());
    request[0] = static_cast<std::uint8_t>(command);
    const std::uint32_t len = static_cast<std::uint32_t>(payload.size());
    request[1] = static_cast<std::uint8_t>(len & 0xffu);
    request[2] = static_cast<std::uint8_t>((len >> 8) & 0xffu);
    request[3] = static_cast<std::uint8_t>((len >> 16) & 0xffu);
    request[4] = static_cast<std::uint8_t>((len >> 24) & 0xffu);
    if (!payload.empty()) {
      std::memcpy(request.data() + 5, payload.data(), payload.size());
    }
    if (zmq_send(socket_, request.data(), request.size(), 0) <
        static_cast<int>(request.size())) {
      *error = "failed to send command";
      return false;
    }
    char body[512];
    const int received = zmq_recv(socket_, body, sizeof(body) - 1, 0);
    if (received < 5) {
      *error = "short command response";
      return false;
    }
    const auto status = static_cast<std::uint8_t>(body[0]);
    const std::uint32_t payloadLen = readUint32LE(body + 1);
    const std::string responsePayload(body + 5, body + 5 + payloadLen);
    if (status != static_cast<std::uint8_t>(blue::Status::OK)) {
      *error = responsePayload;
      return false;
    }
    return true;
  }

private:
  void *socket_ = nullptr;
};

} // namespace

int main(int argc, char **argv) {
  double durationSeconds = 2.0;
  for (int i = 1; i + 1 < argc; ++i) {
    if (std::string(argv[i]) == "--duration-seconds") {
      durationSeconds = std::stod(argv[i + 1]);
    }
  }

  if (!blue::CsoundLoader::initialize()) {
    std::cout << "Skipping meter sampling test: "
              << blue::CsoundLoader::getError() << '\n';
    return kCtestSkipReturnCode;
  }

  blue::SharedMemory shm;
  blue::CsoundEngine engine;
  // Written before the handler thread exists so the thread-creation edge
  // publishes it to every later reader.
  engine.setThreadPriorityElevationEnabled(false);
  blue::ZmqHandler handler(engine, shm);
  if (!handler.bind(kControlPort, kPubPort)) {
    std::cerr << "Failed to bind meter sampling test endpoints\n";
    return 1;
  }

  std::atomic<bool> stopHandlers{false};
  std::thread handlerThread([&handler, &stopHandlers]() {
    while (!stopHandlers.load() && handler.processOne()) {
    }
  });

  void *context = zmq_ctx_new();
  const std::string controlAddress =
      "tcp://127.0.0.1:" + std::to_string(kControlPort);
  const std::string pubAddress =
      "tcp://127.0.0.1:" + std::to_string(kPubPort);
  CommandClient commands(context, controlAddress);

  void *subscriber = zmq_socket(context, ZMQ_SUB);
  if (zmq_connect(subscriber, pubAddress.c_str()) != 0 ||
      zmq_setsockopt(subscriber, ZMQ_SUBSCRIBE, "engine.meters", 13) != 0) {
    std::cerr << "Failed to subscribe to engine.meters\n";
    return 1;
  }

  int failures = 0;
  const auto require = [&failures](bool condition, const std::string &message) {
    if (!condition) {
      std::cerr << "FAIL: " << message << '\n';
      ++failures;
    }
  };

  // All control-plane calls execute on the handler thread via the command
  // socket, matching the single-threaded control topology of blue-engine
  // main.cpp.
  std::string error;
  require(commands.call(blue::Command::CREATE_ENGINE, "", &error),
          "CREATE_ENGINE failed: " + error);
  require(commands.call(blue::Command::SET_OPTION, "-n", &error),
          "setOption -n failed: " + error);
  require(commands.call(blue::Command::SET_OPTION, "-d", &error),
          "setOption -d failed: " + error);
  require(commands.call(blue::Command::COMPILE_ORC, kMeteredOrchestra, &error),
          "compileOrc failed: " + error);
  require(commands.call(blue::Command::READ_SCORE, "i1 0 3600", &error),
          "readScore failed: " + error);
  require(commands.call(blue::Command::START, "", &error),
          "start failed: " + error);
  if (failures > 0) {
    std::cerr << failures << " setup command(s) failed\n";
    return 1;
  }

  // Concurrent handoff probe: captureCount must advance while the perform
  // thread publishes snapshots and the handler thread consumes them.
  const auto firstSnapshot = engine.getMeterValuesSnapshot();
  const std::uint64_t firstCaptureCount =
      firstSnapshot ? firstSnapshot->captureCount : 0;

  std::vector<MeterFrame> frames;
  const auto deadline = std::chrono::steady_clock::now() +
                        std::chrono::duration<double>(durationSeconds);
  while (std::chrono::steady_clock::now() < deadline && engine.isRunning()) {
    zmq_pollitem_t item{subscriber, 0, ZMQ_POLLIN, 0};
    if (zmq_poll(&item, 1, 50) > 0 && (item.revents & ZMQ_POLLIN)) {
      char topic[256];
      char body[64 * 128 + 8 + 1024];
      const int topicLen = zmq_recv(subscriber, topic, sizeof(topic) - 1, 0);
      if (topicLen <= 0) {
        continue;
      }
      topic[topicLen] = '\0';
      if (std::strcmp(topic, "engine.meters") != 0) {
        continue;
      }
      const int bodyLen = zmq_recv(subscriber, body, sizeof(body), 0);
      if (bodyLen < 8) {
        continue;
      }

      MeterFrame frame;
      frame.sequence = readUint32LE(body);
      frame.channelCount = readUint16LE(body + 4);
      frame.nchnls = readUint16LE(body + 6);
      const size_t entrySize = 64 + frame.nchnls * 8 * 2;
      if (static_cast<size_t>(bodyLen) <
          8 + static_cast<size_t>(frame.channelCount) * entrySize) {
        continue;
      }
      for (int c = 0; c < frame.channelCount; ++c) {
        const char *entry = body + 8 + c * entrySize;
        size_t keyLen = 0;
        while (keyLen < 63 && entry[keyLen] != '\0') {
          ++keyLen;
        }
        frame.keys.push_back(std::string(entry, keyLen));
        for (int ch = 0; ch < frame.nchnls; ++ch) {
          frame.rms.push_back(readDoubleLE(entry + 64 + ch * 8));
        }
        for (int ch = 0; ch < frame.nchnls; ++ch) {
          frame.peak.push_back(
              readDoubleLE(entry + 64 + frame.nchnls * 8 + ch * 8));
        }
      }
      frames.push_back(std::move(frame));
    }
  }

  const auto midSnapshot = engine.getMeterValuesSnapshot();
  require(static_cast<bool>(midSnapshot),
          "No meter value snapshot was captured during playback");
  if (midSnapshot) {
    require(midSnapshot->captureCount > firstCaptureCount,
            "Concurrent snapshot handoff did not advance captureCount");
    require(midSnapshot->sampleFrames > 0,
            "Snapshot sampleFrames did not advance");
    require(midSnapshot->channels.size() == 2,
            "Expected two metered channel groups");
    for (const auto &channel : midSnapshot->channels) {
      for (double v : channel.rms) {
        require(v >= 0.0 && v <= 1.0 && std::isfinite(v),
                "Sanitized RMS value out of range: " + std::to_string(v));
      }
      for (double v : channel.peak) {
        require(v >= 0.0 && v <= 1.0 && std::isfinite(v),
                "Sanitized peak value out of range: " + std::to_string(v));
      }
    }
    require(engine.getCaptureHotPathAllocationCount() == 0,
            "FR-014 / T050 violation: detected " +
                std::to_string(engine.getCaptureHotPathAllocationCount()) +
                " allocations on perform-thread meter capture hot path");
  }

  require(commands.call(blue::Command::STOP, "", &error),
          "stop failed: " + error);

  // After the performance ends the pointer layout is gone; the last value
  // snapshot remains readable from any thread. Both reads are atomics.
  const auto settleDeadline =
      std::chrono::steady_clock::now() + std::chrono::seconds(2);
  while (engine.isRunning() &&
         std::chrono::steady_clock::now() < settleDeadline) {
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
  }
  require(!engine.isRunning(), "Engine still running after STOP");
  require(!engine.hasMeterChannels(),
          "Meter layout survived performance teardown");
  const auto finalSnapshot = engine.getMeterValuesSnapshot();
  require(static_cast<bool>(finalSnapshot),
          "Final meter value snapshot missing after stop");

  stopHandlers.store(true);
  handler.requestShutdown();
  if (handlerThread.joinable()) {
    handlerThread.join();
  }

  // Drain any frames already queued so the sequence check sees all of them.
  for (int i = 0; i < 20; ++i) {
    zmq_pollitem_t item{subscriber, 0, ZMQ_POLLIN, 0};
    if (zmq_poll(&item, 1, 25) <= 0 || !(item.revents & ZMQ_POLLIN)) {
      break;
    }
    char topic[256];
    char body[64 * 128 + 8 + 1024];
    const int topicLen =
        zmq_recv(subscriber, topic, sizeof(topic) - 1, ZMQ_DONTWAIT);
    if (topicLen <= 0) {
      continue;
    }
    const int bodyLen = zmq_recv(subscriber, body, sizeof(body), ZMQ_DONTWAIT);
    if (bodyLen < 8) {
      continue;
    }
    MeterFrame frame;
    frame.sequence = readUint32LE(body);
    frames.push_back(std::move(frame));
  }

  require(frames.size() >= 30,
          "Expected at least 30 meter frames, received " +
              std::to_string(frames.size()));
  for (size_t i = 1; i < frames.size(); ++i) {
    require(frames[i].sequence == frames[i - 1].sequence + 1,
            "Meter frame sequence not strictly monotonic at index " +
                std::to_string(i));
  }

  // No frames may arrive after the performance stopped and drained.
  bool lateFrame = false;
  for (int i = 0; i < 10; ++i) {
    zmq_pollitem_t item{subscriber, 0, ZMQ_POLLIN, 0};
    if (zmq_poll(&item, 1, 25) > 0 && (item.revents & ZMQ_POLLIN)) {
      char topic[64];
      if (zmq_recv(subscriber, topic, sizeof(topic), ZMQ_DONTWAIT) > 0) {
        char body[256];
        zmq_recv(subscriber, body, sizeof(body), ZMQ_DONTWAIT);
        if (std::strncmp(topic, "engine.meters", 13) == 0) {
          lateFrame = true;
        }
      }
    }
  }
  require(!lateFrame, "A meter frame was published after playback stopped");

  if (!frames.empty()) {
    const auto &first = frames.front();
    require(first.channelCount == 2,
            "Expected two metered channel groups, got " +
                std::to_string(first.channelCount));
    require(first.nchnls == 2, "Expected nchnls=2 meter frame");
    bool sawSrc1 = false;
    bool sawSrc2 = false;
    for (const auto &key : first.keys) {
      sawSrc1 = sawSrc1 || key == "src1";
      sawSrc2 = sawSrc2 || key == "src2";
    }
    require(sawSrc1 && sawSrc2, "Meter frame missing expected csd keys");
    for (double v : first.rms) {
      require(v >= 0.0 && v <= 1.0, "Wire RMS value out of range");
    }
    for (double v : first.peak) {
      require(v >= 0.0 && v <= 1.0, "Wire peak value out of range");
    }
  }

  commands.close();
  zmq_close(subscriber);
  zmq_ctx_term(context);
  engine.destroy();

  if (failures > 0) {
    std::cerr << failures << " meter sampling assertion(s) failed\n";
    return 1;
  }
  std::cout << "Meter sampling stress passed: " << frames.size()
            << " frames, sequence monotonic, snapshot handoffs advanced\n";
  return 0;
}
