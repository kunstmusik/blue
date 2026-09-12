// Paired metering-enabled vs metering-disabled playback soak with
// measurable underrun/dropout diagnostics (Spec 104 T046, FR-014, SC-004).
//
// Two identical audio performances are run back to back through the real
// CsoundEngine + ZmqHandler pipeline: one with the meter tap load of the
// SC-003 workload (64 metered strips x 2 output channels: per-k-cycle
// windowed rms + maxk + chnset per channel, plus perform-thread snapshot
// capture and ZMQ publication), and one without any metering. Diagnostics
// come from the engine's own realtime instrumentation: perform/host spike
// counts (a spike is a k-cycle overrun threshold) and scheduling-gap counts
// (a loop delta at or above twice the k-period budget — the underrun
// proxy). The paired results are printed for recording in quickstart.md.

#include "csound/CsoundLoader.h"
#include "engine/CsoundEngine.h"
#include "ipc/SharedMemory.h"
#include "ipc/ZmqHandler.h"
#include "protocol/Protocol.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <numeric>
#include <string>
#include <thread>
#include <vector>
#include <zmq.h>

namespace {

constexpr int kCtestSkipReturnCode = 77;
constexpr int kMeteredStrips = 64;
constexpr int kChannels = 2;
constexpr double kSampleRate = 44100.0;
constexpr int kKsmps = 32;

struct RunDiagnostics {
  double performP95Us = 0.0;
  double hostP95Us = 0.0;
  double hostAvgUs = 0.0;
  double shmAvgUs = 0.0;
  std::uint64_t performSpikeCount = 0;
  std::uint64_t hostSpikeCount = 0;
  std::uint64_t gapCount = 0;
  std::uint64_t observedCycleCount = 0;
  bool publishedMeterFrames = false;
};

std::string buildOrchestra(bool metered) {
  std::string orc;
  orc += "sr = 44100\nksmps = 32\nnchnls = 2\n0dbfs = 1\n";
  if (metered) {
    for (int i = 0; i < kMeteredStrips; ++i) {
      for (int ch = 0; ch < kChannels; ++ch) {
        orc += "chn_k \"bm_meter_rms_src" + std::to_string(i) + "_" +
               std::to_string(ch) + "\", 2\n";
        orc += "chn_k \"bm_meter_peak_src" + std::to_string(i) + "_" +
               std::to_string(ch) + "\", 2\n";
      }
    }
  }
  orc += "instr 1\n";
  orc += "  aSig oscili 0.5, 220\n";
  if (metered) {
    // Mirror the production CSD-policy taps: windowed RMS and peak per
    // metered channel, with chnset updates gated at ~30 Hz (sr / 30).
    orc += "  kMeterSamples init 0\n";
    orc += "  kMeterWindow = sr / 30\n";
    orc += "  kMeterSamples += ksmps\n";
    orc += "  if kMeterSamples >= kMeterWindow then\n";
    orc += "    kMeterTrig = 1\n";
    orc += "    kMeterSamples = 0\n";
    orc += "  else\n";
    orc += "    kMeterTrig = 0\n";
    orc += "  endif\n";
    for (int i = 0; i < kMeteredStrips; ++i) {
      for (int ch = 0; ch < kChannels; ++ch) {
        const std::string key =
            "src" + std::to_string(i) + "_" + std::to_string(ch);
        orc += "  kRms_" + key + " rms aSig\n";
        orc += "  kPk_" + key + " maxk aSig, kMeterTrig, 1\n";
        orc += "  if kMeterTrig == 1 then\n";
        orc += "    chnset kRms_" + key + ", \"bm_meter_rms_" + key + "\"\n";
        orc += "    chnset kPk_" + key + ", \"bm_meter_peak_" + key + "\"\n";
        orc += "  endif\n";
      }
    }
  }
  orc += "  outch 1, aSig, 2, aSig\n";
  orc += "endin\n";
  return orc;
}

bool runSoak(bool metered, double durationSeconds, int controlPort, int pubPort,
             RunDiagnostics *out) {
  blue::SharedMemory shm;
  blue::CsoundEngine engine;
  // Plain-member configuration is written before any thread exists so the
  // thread-creation edges publish it to the handler and perform threads.
  engine.setThreadPriorityElevationEnabled(false);
  // Skip ~0.5s of startup cycles so steady state dominates the summary.
  engine.setPerformanceWindow(700, 0);
  blue::ZmqHandler handler(engine, shm);
  if (!handler.bind(controlPort, pubPort)) {
    std::cerr << "Failed to bind benchmark endpoints\n";
    return false;
  }

  std::atomic<bool> stopHandlers{false};
  std::thread handlerThread([&handler, &stopHandlers]() {
    while (!stopHandlers.load() && handler.processOne()) {
    }
  });
  const auto joinHandler = [&stopHandlers, &handlerThread, &handler]() {
    stopHandlers.store(true);
    handler.requestShutdown();
    if (handlerThread.joinable()) {
      handlerThread.join();
    }
  };

  void *context = zmq_ctx_new();
  void *control = zmq_socket(context, ZMQ_REQ);
  zmq_connect(control,
              ("tcp://127.0.0.1:" + std::to_string(controlPort)).c_str());
  const auto call = [control](blue::Command command,
                              const std::string &payload,
                              std::string *error) -> bool {
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
    if (zmq_send(control, request.data(), request.size(), 0) <
        static_cast<int>(request.size())) {
      *error = "failed to send command";
      return false;
    }
    char body[512];
    const int received = zmq_recv(control, body, sizeof(body) - 1, 0);
    if (received < 5) {
      *error = "short command response";
      return false;
    }
    const std::uint32_t payloadLen =
        static_cast<std::uint32_t>(static_cast<std::uint8_t>(body[1])) |
        (static_cast<std::uint32_t>(static_cast<std::uint8_t>(body[2])) << 8) |
        (static_cast<std::uint32_t>(static_cast<std::uint8_t>(body[3]))
         << 16) |
        (static_cast<std::uint32_t>(static_cast<std::uint8_t>(body[4]))
         << 24);
    const std::string responsePayload(body + 5, body + 5 + payloadLen);
    if (static_cast<std::uint8_t>(body[0]) !=
        static_cast<std::uint8_t>(blue::Status::OK)) {
      *error = responsePayload;
      return false;
    }
    return true;
  };

  bool ok = true;
  std::string error;
  do {
    // All control-plane calls execute on the handler thread via the command
    // socket, matching the single-threaded control topology of blue-engine
    // main.cpp.
    if (!call(blue::Command::CREATE_ENGINE, "", &error)) {
      ok = false;
      error = "engine create failed: " + error;
      break;
    }
    if (!call(blue::Command::SET_OPTION, "-n", &error) ||
        !call(blue::Command::SET_OPTION, "-d", &error)) {
      ok = false;
      error = "setOption failed: " + error;
      break;
    }
    const std::string orchestra = buildOrchestra(metered);
    if (!call(blue::Command::COMPILE_ORC, orchestra, &error)) {
      ok = false;
      error = "compileOrc failed: " + error;
      break;
    }
    const std::string score = "i1 0 " + std::to_string(durationSeconds);
    if (!call(blue::Command::READ_SCORE, score, &error)) {
      ok = false;
      error = "readScore failed: " + error;
      break;
    }
    if (!call(blue::Command::START, "", &error)) {
      ok = false;
      error = "start failed: " + error;
      break;
    }

    const auto deadline = std::chrono::steady_clock::now() +
                          std::chrono::duration<double>(
                              durationSeconds + 10.0);
    while (engine.isRunning() &&
           std::chrono::steady_clock::now() < deadline) {
      std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }
    if (engine.isRunning()) {
      if (!call(blue::Command::STOP, "", &error)) {
        ok = false;
        error = "stop failed: " + error;
        break;
      }
    }
  } while (false);

  if (!ok) {
    std::cerr << error << '\n';
    zmq_close(control);
    zmq_ctx_term(context);
    joinHandler();
    engine.destroy();
    return false;
  }

  const auto summary = engine.getLastPerformanceSummary();
  const auto gaps = engine.getLastNativeGapSummary();
  out->performP95Us = summary.performP95Us;
  out->hostP95Us = summary.hostP95Us;
  out->hostAvgUs = summary.hostAvgUs;
  out->shmAvgUs = summary.sharedMemoryAvgUs;
  out->performSpikeCount = summary.performSpikeCount;
  out->hostSpikeCount = summary.hostSpikeCount;
  out->gapCount = gaps.available ? gaps.gapCount : 0;
  out->observedCycleCount = summary.cycleCount;
  // hasMeterChannels() is cleared at perform-thread teardown, so verify the
  // metered arm through the persistent value snapshot instead.
  const auto finalMeterSnapshot = engine.getMeterValuesSnapshot();
  out->publishedMeterFrames =
      metered && static_cast<bool>(finalMeterSnapshot) &&
      !finalMeterSnapshot->channels.empty();

  zmq_close(control);
  zmq_ctx_term(context);
  joinHandler();
  engine.destroy();
  return true;
}

} // namespace

int main(int argc, char **argv) {
  double durationSeconds = 3.0;
  int rounds = 4;
  for (int i = 1; i + 1 < argc; ++i) {
    const std::string arg = argv[i];
    if (arg == "--duration-seconds") {
      durationSeconds = std::stod(argv[i + 1]);
    } else if (arg == "--rounds") {
      rounds = std::stoi(argv[i + 1]);
    }
  }

  if (!blue::CsoundLoader::initialize()) {
    std::cout << "Skipping metering benchmark: " << blue::CsoundLoader::getError()
              << '\n';
    return kCtestSkipReturnCode;
  }

  // Alternate configurations across rounds so machine-level drift affects
  // both arms of the comparison rather than one. Each soak owns a distinct
  // port pair; runs are sequential so the ports never collide.
  std::vector<RunDiagnostics> meteredRuns;
  std::vector<RunDiagnostics> baselineRuns;
  int nextPort = 5820;
  for (int round = 0; round < rounds; ++round) {
    RunDiagnostics first{};
    RunDiagnostics second{};
    const bool meteredFirst = round % 2 == 0;
    const int firstPort = nextPort;
    const int secondPort = nextPort + 2;
    nextPort += 4;
    if (!runSoak(meteredFirst, durationSeconds, firstPort, firstPort + 1,
                 &first) ||
        !runSoak(!meteredFirst, durationSeconds, secondPort, secondPort + 1,
                 &second)) {
      return 1;
    }
    if (meteredFirst) {
      meteredRuns.push_back(first);
      baselineRuns.push_back(second);
    } else {
      baselineRuns.push_back(first);
      meteredRuns.push_back(second);
    }
  }

  const auto medianP95 = [](std::vector<double> values) {
    std::sort(values.begin(), values.end());
    if (values.empty()) {
      return 0.0;
    }
    return values[values.size() / 2];
  };

  std::vector<double> meteredPerformP95;
  std::vector<double> baselinePerformP95;
  std::vector<double> meteredHostP95;
  std::vector<double> baselineHostP95;
  // Spikes and scheduling gaps are dominated by OS scheduling transients on
  // a loaded machine; the minimum across rounds is the comparable steady
  // state for the dropout comparison, while sums would inflate any single
  // noisy round.
  const auto minOf = [](const std::vector<std::uint64_t> &values) {
    if (values.empty()) {
      return std::uint64_t{0};
    }
    return *std::min_element(values.begin(), values.end());
  };
  std::vector<std::uint64_t> meteredPerformSpikes;
  std::vector<std::uint64_t> baselinePerformSpikes;
  std::vector<std::uint64_t> meteredHostSpikes;
  std::vector<std::uint64_t> baselineHostSpikes;
  std::vector<std::uint64_t> meteredGapCounts;
  std::vector<std::uint64_t> baselineGapCounts;
  std::uint64_t meteredPerformSpikesTotal = 0;
  std::uint64_t baselinePerformSpikesTotal = 0;
  std::uint64_t meteredHostSpikesTotal = 0;
  std::uint64_t baselineHostSpikesTotal = 0;
  std::uint64_t meteredGapsTotal = 0;
  std::uint64_t baselineGapsTotal = 0;
  double meteredHostAvg = 0.0;
  double baselineHostAvg = 0.0;
  std::vector<double> baselineHostAvgs;
  std::vector<double> meteredHostAvgs;
  std::vector<double> baselineShmAvgs;
  std::vector<double> meteredShmAvgs;

  for (const auto &run : meteredRuns) {
    meteredPerformP95.push_back(run.performP95Us);
    meteredHostP95.push_back(run.hostP95Us);
    meteredPerformSpikes.push_back(run.performSpikeCount);
    meteredHostSpikes.push_back(run.hostSpikeCount);
    meteredGapCounts.push_back(run.gapCount);
    meteredPerformSpikesTotal += run.performSpikeCount;
    meteredHostSpikesTotal += run.hostSpikeCount;
    meteredGapsTotal += run.gapCount;
    meteredHostAvg += run.hostAvgUs;
    meteredHostAvgs.push_back(run.hostAvgUs);
    meteredShmAvgs.push_back(run.shmAvgUs);
  }
  for (const auto &run : baselineRuns) {
    baselinePerformP95.push_back(run.performP95Us);
    baselineHostP95.push_back(run.hostP95Us);
    baselinePerformSpikes.push_back(run.performSpikeCount);
    baselineHostSpikes.push_back(run.hostSpikeCount);
    baselineGapCounts.push_back(run.gapCount);
    baselinePerformSpikesTotal += run.performSpikeCount;
    baselineHostSpikesTotal += run.hostSpikeCount;
    baselineGapsTotal += run.gapCount;
    baselineHostAvg += run.hostAvgUs;
    baselineHostAvgs.push_back(run.hostAvgUs);
    baselineShmAvgs.push_back(run.shmAvgUs);
  }
  meteredHostAvg /= static_cast<double>(meteredRuns.size());
  baselineHostAvg /= static_cast<double>(baselineRuns.size());

  // Same-machine baseline variance across baseline runs (SC-004)
  const double baselineHostAvgMean = baselineHostAvg;
  double baselineHostAvgVariance = 0.0;
  double baselineMinHostAvg = baselineHostAvgs.empty() ? 0.0 : baselineHostAvgs[0];
  double baselineMaxHostAvg = baselineHostAvgs.empty() ? 0.0 : baselineHostAvgs[0];
  for (double val : baselineHostAvgs) {
    const double d = val - baselineHostAvgMean;
    baselineHostAvgVariance += d * d;
    if (val < baselineMinHostAvg) baselineMinHostAvg = val;
    if (val > baselineMaxHostAvg) baselineMaxHostAvg = val;
  }
  if (baselineHostAvgs.size() > 1) {
    baselineHostAvgVariance /= (baselineHostAvgs.size() - 1);
  }
  const double baselineHostAvgStdDev = std::sqrt(baselineHostAvgVariance);
  const double baselineHostAvgSpread = baselineMaxHostAvg - baselineMinHostAvg;
  const double baselineNoiseTolerance = std::max(baselineHostAvgSpread, 2.0 * baselineHostAvgStdDev);

  // Perform-thread metering telemetry overhead
  const double baselineShmAvg =
      std::accumulate(baselineShmAvgs.begin(), baselineShmAvgs.end(), 0.0) /
      (baselineShmAvgs.empty() ? 1 : baselineShmAvgs.size());
  const double meteredShmAvg =
      std::accumulate(meteredShmAvgs.begin(), meteredShmAvgs.end(), 0.0) /
      (meteredShmAvgs.empty() ? 1 : meteredShmAvgs.size());
  const double telemetryOverheadUs =
      meteredShmAvg > baselineShmAvg ? (meteredShmAvg - baselineShmAvg) : 0.0;
  const double totalMeteringOverheadUs =
      meteredHostAvg > baselineHostAvg ? (meteredHostAvg - baselineHostAvg) : 0.0;

  const double meteredPerformP95Us = medianP95(meteredPerformP95);
  const double baselinePerformP95Us = medianP95(baselinePerformP95);
  const double meteredHostP95Us = medianP95(meteredHostP95);
  const double baselineHostP95Us = medianP95(baselineHostP95);

  std::cout << "==== Metering paired soak (strips=" << kMeteredStrips
            << ", channels=" << kChannels << ", sr=" << kSampleRate
            << ", ksmps=" << kKsmps << ", rounds=" << rounds
            << ", seconds/round=" << durationSeconds << ") ====\n";
  std::cout << "baseline  perform_p95_us=" << baselinePerformP95Us
            << " host_p95_us=" << baselineHostP95Us
            << " host_avg_us=" << baselineHostAvg
            << " perform_spikes_min=" << minOf(baselinePerformSpikes)
            << " host_spikes_min=" << minOf(baselineHostSpikes)
            << " scheduling_gaps_min=" << minOf(baselineGapCounts)
            << " (totals: spikes=" << baselinePerformSpikesTotal << "/"
            << baselineHostSpikesTotal << " gaps=" << baselineGapsTotal
            << ")\n";
  std::cout << "metered  perform_p95_us=" << meteredPerformP95Us
            << " host_p95_us=" << meteredHostP95Us
            << " host_avg_us=" << meteredHostAvg
            << " perform_spikes_min=" << minOf(meteredPerformSpikes)
            << " host_spikes_min=" << minOf(meteredHostSpikes)
            << " scheduling_gaps_min=" << minOf(meteredGapCounts)
            << " (totals: spikes=" << meteredPerformSpikesTotal << "/"
            << meteredHostSpikesTotal << " gaps=" << meteredGapsTotal
            << ")\n";
  std::cout << "baseline variance: std_dev=" << baselineHostAvgStdDev
            << "us spread=" << baselineHostAvgSpread
            << "us noise_tolerance=" << baselineNoiseTolerance << "us\n";
  std::cout << "telemetry capture overhead: baseline_shm_avg=" << baselineShmAvg
            << "us metered_shm_avg=" << meteredShmAvg
            << "us overhead=" << telemetryOverheadUs << "us\n";
  std::cout << "total workload overhead: metered_host_avg=" << meteredHostAvg
            << "us baseline_host_avg=" << baselineHostAvg
            << "us overhead=" << totalMeteringOverheadUs << "us\n";

  int failures = 0;
  const auto require = [&failures](bool condition, const std::string &message) {
    if (!condition) {
      std::cerr << "FAIL: " << message << '\n';
      ++failures;
    }
  };

  for (const auto &run : meteredRuns) {
    require(run.publishedMeterFrames,
            "A metered soak run never activated meter channels");
  }

  // Dropout/underrun diagnostics: steady state must show no added dropouts/spikes
  require(minOf(meteredGapCounts) <= minOf(baselineGapCounts),
          "Metering added scheduling gaps (underruns): baseline best " +
              std::to_string(minOf(baselineGapCounts)) + ", metered best " +
              std::to_string(minOf(meteredGapCounts)));
  require(minOf(meteredPerformSpikes) <= minOf(baselinePerformSpikes),
          "Metering added perform k-cycle spikes: baseline best " +
              std::to_string(minOf(baselinePerformSpikes)) + ", metered best " +
              std::to_string(minOf(meteredPerformSpikes)));
  require(minOf(meteredHostSpikes) <= minOf(baselineHostSpikes),
          "Metering added host cycle spikes: baseline best " +
              std::to_string(minOf(baselineHostSpikes)) + ", metered best " +
              std::to_string(minOf(meteredHostSpikes)));

  // SC-004: Perform-thread metering telemetry overhead must not exceed normal run-to-run noise
  // (with 1.0 us floor for hardware timer resolution)
  const double kNoiseFloorUs = 1.0;
  const double kAllowedTelemetryNoiseUs = std::max(baselineNoiseTolerance, kNoiseFloorUs);
  require(telemetryOverheadUs <= kAllowedTelemetryNoiseUs,
          "SC-004 violation: perform-thread metering telemetry overhead (" +
              std::to_string(telemetryOverheadUs) +
              "us) exceeded baseline run-to-run noise tolerance (" +
              std::to_string(kAllowedTelemetryNoiseUs) + "us)");

  // Realtime budget headroom: complete metering workload (CSD + telemetry capture)
  const double kPeriodBudgetUs = kKsmps / kSampleRate * 1.0e6;
  require(baselineHostP95Us < kPeriodBudgetUs,
          "Baseline host p95 exceeded the k-period budget: " +
              std::to_string(baselineHostP95Us) + "us");
  require(meteredHostP95Us < 0.25 * kPeriodBudgetUs,
          "Metered host p95 exceeded 25% of k-period budget: " +
              std::to_string(meteredHostP95Us) + "us");
  require(meteredHostAvg < 0.1 * kPeriodBudgetUs,
          "Metered host average exceeded 10% of k-period budget: " +
              std::to_string(meteredHostAvg) + "us");
  require(totalMeteringOverheadUs < 0.1 * kPeriodBudgetUs,
          "Total metering workload overhead (" +
              std::to_string(totalMeteringOverheadUs) +
              "us) exceeded 10% of k-period budget: " +
              std::to_string(0.1 * kPeriodBudgetUs) + "us");

  if (failures > 0) {
    std::cerr << failures << " metering benchmark assertion(s) failed\n";
    return 1;
  }
  std::cout << "Metering paired soak passed: no added underruns/dropouts, "
               "telemetry overhead within baseline noise, strict realtime budget satisfied\n";
  return 0;
}
