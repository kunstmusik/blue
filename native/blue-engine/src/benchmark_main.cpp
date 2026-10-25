#include "engine/CsoundEngine.h"
#include "csound/CsoundLoader.h"
#include "automation/AutomationStore.h"
#include "ipc/SharedMemory.h"
#include "revision.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <memory>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#else
#include <dlfcn.h>
#endif

namespace {

struct Scenario {
  const char *name;
  int channelCount;
  int automationCount;
  bool changing;
  bool exponential;
  bool quantized;
  const char* quantizedResolutionText;
  bool completed;
  bool liveEdit;
  bool liveCompile;
  bool missingBinding;
  bool indefinitePerformance;
};

// The matrix deliberately includes the limits called out by the performance
// contract instead of hiding them behind a synthetic stand-in.
const std::vector<Scenario> kScenarios = {
    {"static_0", 0, 0, false, false, false, nullptr, false, false, false, false, false},
    {"static_1", 1, 0, false, false, false, nullptr, false, false, false, false, false},
    {"static_32", 32, 0, false, false, false, nullptr, false, false, false, false, false},
    {"static_128", 128, 0, false, false, false, nullptr, false, false, false, false, false},
    {"static_256", 256, 0, false, false, false, nullptr, false, false, false, false, false},
    {"changing_1", 1, 0, true, false, false, nullptr, false, false, false, false, false},
    {"changing_32", 32, 0, true, false, false, nullptr, false, false, false, false, false},
    {"changing_128", 128, 0, true, false, false, nullptr, false, false, false, false, false},
    {"changing_256", 256, 0, true, false, false, nullptr, false, false, false, false, false},
    {"linear_1", 1, 1, false, false, false, nullptr, false, false, false, false, false},
    {"linear_32", 32, 32, false, false, false, nullptr, false, false, false, false, false},
    {"linear_128", 128, 128, false, false, false, nullptr, false, false, false, false, false},
    {"linear_256", 256, 256, false, false, false, nullptr, false, false, false, false, false},
    {"exponential_1", 1, 1, false, true, false, nullptr, false, false, false, false, false},
    {"exponential_32", 32, 32, false, true, false, nullptr, false, false, false, false, false},
    {"exponential_128", 128, 128, false, true, false, nullptr, false, false, false, false, false},
    {"exponential_256", 256, 256, false, true, false, nullptr, false, false, false, false, false},
    // exact decimal quantization scenarios: one ordinary scale and one scale
    // beyond the former bounded fixed-point range, reported separately
    {"quantized_exact_32", 32, 32, false, false, true, "0.01", false, false, false, false, false},
    {"quantized_exact_large_scale_32", 32, 32, false, false, true, "0.0000000000000000001", false, false, false, false, false},
    {"completed_256", 256, 256, false, false, true, "0.01", true, false, false, false, false},
    {"live_edit_32", 32, 32, false, false, true, "0.01", false, true, false, false, true},
    {"live_compile_32", 32, 32, false, false, false, nullptr, false, false, true, false, true},
    {"missing_binding_32", 32, 1, false, false, false, nullptr, false, false, false, true, false},
};

struct TrialMetrics {
  uint64_t measuredCycles = 0;
  double autoAvgUs = 0.0;
  double autoP95Us = 0.0;
  double autoMaxUs = 0.0;
  uint64_t autoSpikeCount = 0;
  double shmAvgUs = 0.0;
  double shmP95Us = 0.0;
  double shmMaxUs = 0.0;
  uint64_t shmSpikeCount = 0;
  double hostCycleAvgUs = 0.0;
  double hostCycleP95Us = 0.0;
  double hostCycleMaxUs = 0.0;
  uint64_t hostCycleSpikeCount = 0;
  double performKsmpsAvgUs = 0.0;
};

struct ScenarioResult {
  const Scenario *scenario = nullptr;
  int warmupCycles = 0;
  int measuredCycles = 0;
  std::vector<TrialMetrics> trials;
  TrialMetrics medianSummary;
};

struct BaselineMetric {
  double hostAvgUs = 0.0;
  double hostP95Us = 0.0;
  uint64_t hostSpikeCount = 0;
};

struct BaselineData {
  std::map<std::string, BaselineMetric> metrics;
  std::string buildType;
  std::string compiler;
  std::string targetArch;
  std::string operatingSystem;
  std::string sourceRevision;
  double sampleRate = 0.0;
  int ksmps = 0;
  int warmupCycles = 0;
  int measuredCycles = 0;
};

std::string jsonEscape(const std::string &value) {
  std::string result;
  result.reserve(value.size() + 8);
  for (const char character : value) {
    if (character == '\\' || character == '"') {
      result.push_back('\\');
    }
    result.push_back(character);
  }
  return result;
}

std::string timestampNow() {
  const auto now = std::chrono::system_clock::now();
  const auto seconds = std::chrono::time_point_cast<std::chrono::seconds>(now);
  const std::time_t time = std::chrono::system_clock::to_time_t(seconds);
  std::tm utc{};
#if defined(_WIN32)
  gmtime_s(&utc, &time);
#else
  gmtime_r(&time, &utc);
#endif
  std::ostringstream output;
  output << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
  return output.str();
}

std::string compilerName() {
#if defined(__clang__)
  return "clang " + std::to_string(__clang_major__) + "." +
         std::to_string(__clang_minor__) + "." +
         std::to_string(__clang_patchlevel__);
#elif defined(__GNUC__)
  return "gcc " + std::to_string(__GNUC__) + "." +
         std::to_string(__GNUC_MINOR__) + "." +
         std::to_string(__GNUC_PATCHLEVEL__);
#elif defined(_MSC_VER)
  return "msvc " + std::to_string(_MSC_VER);
#else
  return "unknown";
#endif
}

std::string targetArchitecture() {
#if defined(__aarch64__) || defined(_M_ARM64)
  return "arm64";
#elif defined(__x86_64__) || defined(_M_X64)
  return "x86_64";
#elif defined(__arm__) || defined(_M_ARM)
  return "arm32";
#else
  return "unknown";
#endif
}

std::string operatingSystem() {
#if defined(__APPLE__)
  return "macos";
#elif defined(_WIN32)
  return "windows";
#elif defined(__linux__)
  return "linux";
#else
  return "unknown";
#endif
}

std::string makeOrchestra(const Scenario &scenario) {
  std::ostringstream orc;
  orc << "sr = 48000\nksmps = 32\nnchnls = 2\n0dbfs = 1\n\n";
  for (int index = 0; index < scenario.channelCount; ++index) {
    orc << "gk_chan" << index << " init 0\n"
        << "gk_chan" << index << " chnexport \"chan_" << index
        << "\", 3\n";
  }
  orc << "\ninstr 1\n";
  if (scenario.changing) {
    for (int index = 0; index < scenario.channelCount; ++index) {
      orc << "  gk_chan" << index << " = gk_chan" << index
          << " + 0.000001\n";
    }
  }
  orc << "  a0 init 0\n  out a0, a0\nendin\n";
  return orc.str();
}

std::string makeLiveCompileOrchestra() {
  return R"(
instr 2
  a0 init 0
  out a0, a0
endin
)";
}

TrialMetrics runTrial(const Scenario &scenario, int warmupCycles,
                      int measuredCycles, int trialIndex) {
  using namespace blue;

  SharedMemory sharedMemory;
  const auto uniqueId = std::chrono::steady_clock::now()
                            .time_since_epoch()
                            .count();
  const std::string sharedMemoryName =
      "be-bench-" + std::to_string(uniqueId) + "-" +
      std::to_string(trialIndex);
  if (!sharedMemory.create(sharedMemoryName)) {
    throw std::runtime_error(
        "shared-memory setup failed for benchmark (name=" +
        sharedMemoryName + "); run the benchmark where POSIX shared memory "
        "or Windows file mappings are available");
  }

  CsoundEngine engine;
  engine.setSharedMemory(&sharedMemory);
  engine.setThreadPriorityElevationEnabled(false);
  engine.setPerformanceWindow(static_cast<uint64_t>(warmupCycles),
                              static_cast<uint64_t>(measuredCycles));

  auto require = [&](bool condition, const std::string &message) {
    if (!condition) {
      throw std::runtime_error(message +
                               (engine.getLastError().empty()
                                    ? std::string{}
                                    : ": " + engine.getLastError()));
    }
  };

  require(engine.create(), "engine create failed");
  require(engine.setOption("-n"), "failed to disable audio output");
  require(engine.setOption("-d"), "failed to disable displays");
  require(engine.setOption("-m0"), "failed to disable Csound messages");
  require(engine.compileOrc(makeOrchestra(scenario)),
          "orchestra compilation failed");

  for (int index = 0; index < scenario.channelCount; ++index) {
    require(engine.createChannel("chan_" + std::to_string(index), 0.25),
            "channel setup failed");
  }

  const auto store = engine.getAutomationStore();
  for (int index = 0; index < scenario.automationCount; ++index) {
    const std::string channelName = "chan_" + std::to_string(index);
    const std::vector<AutomationPoint> points = scenario.completed
        ? std::vector<AutomationPoint>{{0.0, 0.1}, {0.03, 0.9},
                                       {0.06, 0.2}, {0.1, 0.8}}
        : std::vector<AutomationPoint>{{0.0, 0.1}, {0.75, 0.9},
                                       {1.5, 0.2}, {3.0, 0.8}};
    require(store->createAutomation(
                channelName,
                scenario.exponential ? AutomationCurve::EXPONENTIAL
                                     : AutomationCurve::LINEAR,
                points, true,
                scenario.quantized ? scenario.quantizedResolutionText : "-1") ==
                AutomationPrepareError::Ok,
            "automation setup failed");
  }
  if (scenario.missingBinding) {
    store->createAutomation(
        "missing_channel", AutomationCurve::LINEAR,
        std::vector<AutomationPoint>{{0.0, 0.0}, {3.0, 1.0}}, true, "-1");
  }

  // Leave enough Csound periods for the requested measurement window. Null
  // audio runs faster than wall clock, but it still executes the real engine
  // performThread path and all channel/automation synchronization.
  require(engine.readScore(scenario.indefinitePerformance ? "i1 0 3600.0"
                                                           : "i1 0 4.0"),
          "score setup failed");
  require(engine.start(), "engine start failed");

  if (scenario.liveCompile) {
    // This call intentionally races the newly-started perform thread through
    // the public lifecycle API. compileOrc joins at a k-cycle boundary,
    // rebuilds bindings, and resumes without resetting Csound state.
    require(engine.compileOrc(makeLiveCompileOrchestra()),
            "live orchestra compilation failed");
  }

  if (scenario.liveEdit) {
    for (int update = 0; update < 16 && engine.isRunning(); ++update) {
      for (int index = 0; index < scenario.automationCount; ++index) {
        store->updateAutomation(
            "chan_" + std::to_string(index),
            scenario.exponential ? AutomationCurve::EXPONENTIAL
                                 : AutomationCurve::LINEAR,
            std::vector<AutomationPoint>{{0.0, 0.1},
                                         {0.75, 0.2 + update * 0.01},
                                         {3.0, 0.8}},
            true, scenario.quantized ? scenario.quantizedResolutionText : "-1");
      }
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
  }

  // Changing scenarios exercise control-plane writes while the real perform
  // thread is active. The loop is bounded and harmless if null audio finishes
  // before the first wakeup.
  if (scenario.changing) {
    for (int update = 0; update < 16 && engine.isRunning(); ++update) {
      for (int index = 0; index < std::min(scenario.channelCount, 32); ++index) {
        engine.setChannel("chan_" + std::to_string(index),
                         0.2 + 0.01 * static_cast<double>(update));
      }
      std::this_thread::yield();
    }
  }

  if (scenario.indefinitePerformance) {
    // The live-edit and live-compile workloads use an indefinite score so the
    // control-plane activity is guaranteed to overlap playback. Allow the
    // requested measurement window to fill before taking the explicit stop
    // boundary; stopping immediately would leave no published summary.
    std::this_thread::sleep_for(std::chrono::milliseconds(250));
    engine.stop();
  }

  const auto deadline = std::chrono::steady_clock::now() +
                        std::chrono::seconds(10);
  while (engine.isRunning() && std::chrono::steady_clock::now() < deadline) {
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
  }
  require(!engine.isRunning(), "benchmark performance did not complete");

  // A naturally completed perform thread has already published STOPPED but is
  // still joinable while it emits its final counters. Join before reading the
  // summary so the benchmark observes the completed publication.
  engine.stop();

  const auto summary = engine.getLastPerformanceSummary();
  require(summary.available, "engine did not publish performance counters");
  require(summary.cycleCount >= static_cast<uint64_t>(measuredCycles),
          "performance ended before the requested measurement window");

  TrialMetrics metrics;
  metrics.measuredCycles = summary.cycleCount;
  metrics.autoAvgUs = summary.automationAvgUs;
  metrics.autoP95Us = summary.automationP95Us;
  metrics.autoMaxUs = summary.automationMaxUs;
  metrics.autoSpikeCount = summary.automationSpikeCount;
  metrics.shmAvgUs = summary.sharedMemoryAvgUs;
  metrics.shmP95Us = summary.sharedMemoryP95Us;
  metrics.shmMaxUs = summary.sharedMemoryMaxUs;
  metrics.shmSpikeCount = summary.sharedMemorySpikeCount;
  metrics.hostCycleAvgUs = summary.hostAvgUs;
  metrics.hostCycleP95Us = summary.hostP95Us;
  metrics.hostCycleMaxUs = summary.hostMaxUs;
  metrics.hostCycleSpikeCount = summary.hostSpikeCount;
  metrics.performKsmpsAvgUs = summary.performAvgUs;
  engine.destroy();
  return metrics;
}

TrialMetrics medianSummary(std::vector<TrialMetrics> trials) {
  if (trials.empty()) {
    return {};
  }
  std::sort(trials.begin(), trials.end(),
            [](const TrialMetrics &left, const TrialMetrics &right) {
              return left.hostCycleAvgUs < right.hostCycleAvgUs;
            });
  return trials[trials.size() / 2];
}

std::string metricJson(const TrialMetrics &metrics, const std::string &indent) {
  std::ostringstream output;
  output << indent << "{\n"
         << indent << "  \"measuredCycles\": " << metrics.measuredCycles << ",\n"
         << indent << "  \"autoAvgUs\": " << metrics.autoAvgUs << ",\n"
         << indent << "  \"autoP95Us\": " << metrics.autoP95Us << ",\n"
         << indent << "  \"autoMaxUs\": " << metrics.autoMaxUs << ",\n"
         << indent << "  \"autoSpikeCount\": " << metrics.autoSpikeCount << ",\n"
         << indent << "  \"shmAvgUs\": " << metrics.shmAvgUs << ",\n"
         << indent << "  \"shmP95Us\": " << metrics.shmP95Us << ",\n"
         << indent << "  \"shmMaxUs\": " << metrics.shmMaxUs << ",\n"
         << indent << "  \"shmSpikeCount\": " << metrics.shmSpikeCount << ",\n"
         << indent << "  \"hostCycleAvgUs\": " << metrics.hostCycleAvgUs << ",\n"
         << indent << "  \"hostCycleP95Us\": " << metrics.hostCycleP95Us << ",\n"
         << indent << "  \"hostCycleMaxUs\": " << metrics.hostCycleMaxUs << ",\n"
         << indent << "  \"hostCycleSpikeCount\": " << metrics.hostCycleSpikeCount << ",\n"
         << indent << "  \"performKsmpsAvgUs\": " << metrics.performKsmpsAvgUs << "\n"
         << indent << "}";
  return output.str();
}

std::string buildJson(const std::vector<ScenarioResult> &results,
                      int warmupCycles, int measuredCycles,
                      bool compared, bool primaryImprovementMet,
                      bool unaffectedRegressionMet,
                      bool spikeCountDischarged,
                      const std::string &baselineIdentity) {
#ifdef BLUE_ENGINE_SOURCE_REVISION
  const std::string sourceRevision = BLUE_ENGINE_SOURCE_REVISION;
#else
  const std::string sourceRevision = "unknown";
#endif
  const auto &loaderReport = blue::CsoundLoader::getReport();
  std::ostringstream output;
  output << std::setprecision(12);
  output << "{\n"
         << "  \"timestamp\": \"" << timestampNow() << "\",\n"
         << "  \"metadata\": {\n"
         << "    \"buildType\": \"Release\",\n"
         << "    \"compiler\": \"" << jsonEscape(compilerName()) << "\",\n"
         << "    \"targetArch\": \"" << targetArchitecture() << "\",\n"
         << "    \"operatingSystem\": \"" << operatingSystem() << "\",\n"
         << "    \"sampleRate\": 48000.0,\n"
         << "    \"ksmps\": 32,\n"
         << "    \"warmupCycles\": " << warmupCycles << ",\n"
         << "    \"measuredCycles\": " << measuredCycles << ",\n"
         << "    \"csoundVersion\": " << loaderReport.versionRaw << ",\n"
         << "    \"gitCommit\": \"" << jsonEscape(sourceRevision) << "\"";
  if (!baselineIdentity.empty()) {
    output << ",\n    \"baselineCommit\": \""
           << jsonEscape(baselineIdentity) << "\"\n";
  } else {
    output << "\n";
  }
  output << "  },\n"
         << "  \"gateStatus\": {\n"
         << "    \"baselineCompared\": " << (compared ? "true" : "false") << ",\n"
         << "    \"passed\": "
         << ((!compared || (primaryImprovementMet && unaffectedRegressionMet &&
                            spikeCountDischarged))
                 ? "true"
                 : "false")
         << ",\n"
         << "    \"primaryImprovementMet\": "
         << (primaryImprovementMet ? "true" : "false") << ",\n"
         << "    \"unaffectedRegressionMet\": "
         << (unaffectedRegressionMet ? "true" : "false") << ",\n"
         << "    \"spikeCountDischarged\": "
         << (spikeCountDischarged ? "true" : "false") << "\n"
         << "  },\n"
         << "  \"scenarios\": [\n";

  for (size_t index = 0; index < results.size(); ++index) {
    const auto &result = results[index];
    output << "    {\n"
           << "      \"name\": \"" << result.scenario->name << "\",\n"
           << "      \"channelCount\": " << result.scenario->channelCount << ",\n"
           << "      \"automationCount\": " << result.scenario->automationCount << ",\n"
           << "      \"changing\": " << (result.scenario->changing ? "true" : "false") << ",\n"
           << "      \"exponential\": " << (result.scenario->exponential ? "true" : "false") << ",\n"
           << "      \"quantized\": " << (result.scenario->quantized ? "true" : "false") << ",\n"
           << "      \"resolution\": " << (result.scenario->quantized && result.scenario->quantizedResolutionText ? ("\"" + std::string(result.scenario->quantizedResolutionText) + "\"") : std::string("null")) << ",\n"
           << "      \"completed\": " << (result.scenario->completed ? "true" : "false") << ",\n"
           << "      \"liveEdit\": " << (result.scenario->liveEdit ? "true" : "false") << ",\n"
           << "      \"liveCompile\": " << (result.scenario->liveCompile ? "true" : "false") << ",\n"
           << "      \"missingBinding\": " << (result.scenario->missingBinding ? "true" : "false") << ",\n"
           << "      \"indefinitePerformance\": " << (result.scenario->indefinitePerformance ? "true" : "false") << ",\n"
           << "      \"warmupCycles\": " << result.warmupCycles << ",\n"
           << "      \"measuredCycles\": " << result.measuredCycles << ",\n"
           << "      \"trials\": [\n";
    for (size_t trial = 0; trial < result.trials.size(); ++trial) {
      output << metricJson(result.trials[trial], "        ")
             << (trial + 1 < result.trials.size() ? "," : "") << "\n";
    }
    output << "      ],\n"
           << "      \"medianSummary\":\n"
           << metricJson(result.medianSummary, "        ") << "\n"
           << "    }" << (index + 1 < results.size() ? "," : "") << "\n";
  }
  output << "  ]\n}\n";
  return output.str();
}

BaselineData readBaseline(const std::string &path) {
  std::ifstream input(path);
  if (!input) {
    throw std::runtime_error("cannot open baseline JSON: " + path);
  }
  std::ostringstream contents;
  contents << input.rdbuf();
  std::string compact = contents.str();
  std::replace(compact.begin(), compact.end(), '\n', ' ');
  std::replace(compact.begin(), compact.end(), '\r', ' ');

  BaselineData result;
  const auto readString = [&compact](const char *key) {
    const std::regex pattern("\\\"" + std::string(key) +
                             "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
    std::smatch match;
    return std::regex_search(compact, match, pattern) ? match[1].str()
                                                       : std::string{};
  };
  const auto readNumber = [&compact](const char *key) {
    const std::regex pattern("\\\"" + std::string(key) +
                             "\\\"\\s*:\\s*([-+0-9.eE]+)");
    std::smatch match;
    return std::regex_search(compact, match, pattern)
               ? std::stod(match[1].str())
               : 0.0;
  };
  result.buildType = readString("buildType");
  result.compiler = readString("compiler");
  result.targetArch = readString("targetArch");
  result.operatingSystem = readString("operatingSystem");
  result.sourceRevision = readString("gitCommit");
  result.sampleRate = readNumber("sampleRate");
  result.ksmps = static_cast<int>(readNumber("ksmps"));
  result.warmupCycles = static_cast<int>(readNumber("warmupCycles"));
  result.measuredCycles = static_cast<int>(readNumber("measuredCycles"));

  const std::regex pattern(
      R"REGEX("name"\s*:\s*"([^"]+)".*?"medianSummary"\s*:\s*\{.*?"hostCycleAvgUs"\s*:\s*([-+0-9.eE]+).*?"hostCycleP95Us"\s*:\s*([-+0-9.eE]+).*?"hostCycleSpikeCount"\s*:\s*([0-9]+))REGEX");
  for (std::sregex_iterator it(compact.begin(), compact.end(), pattern), end;
       it != end; ++it) {
    result.metrics[(*it)[1].str()] = BaselineMetric{
        std::stod((*it)[2].str()), std::stod((*it)[3].str()),
        static_cast<uint64_t>(std::stoull((*it)[4].str()))};
  }
  if (result.metrics.empty()) {
    throw std::runtime_error("baseline JSON contains no scenario medians: " + path);
  }
  return result;
}

void printUsage() {
  std::cout << "Usage: benchmark_engine [--scenario NAME|all] [--trials N] "
               "[--warmup N|--warmup-cycles N] "
               "[--cycles N|--measure-cycles N] [--compare FILE] "
               "[--output FILE] [--json] [--csd FILE]\n";
  std::cout << "  --csd FILE runs the supplied-CSD developer mode "
               "(mutually exclusive with --scenario and --compare)\n";
}

// ============================================================================
// Supplied-CSD developer mode (SPEC 118 mixer-optimization evidence).
//
// The mode loads a complete CSD file, compiles its <CsInstruments> through the
// same engine compileOrc/readScore path used by the fixed scenarios, and
// reports steady-clock ksmps perform timing after the warmup window. It is
// separate from the fixed-scenario code paths above and leaves them untouched.
// ============================================================================

struct CsdProgram {
  std::string instruments;
  std::string score;
};

struct CsdHeaderValues {
  double sampleRate = 0.0;
  int ksmps = 0;
  int nchnls = 0;
  bool hasZeroDbFs = false;
  double zeroDbFs = 0.0;
};

struct CsdTrialResult {
  double performKsmpsAvgUs = 0.0;
  uint64_t measuredCycles = 0;
};

// Extract the required top-level CSD sections. Section tags are matched
// exactly as Csound defines them; anything else is rejected rather than
// guessed at.
CsdProgram parseCsdProgram(const std::string &text, const std::string &path) {
  const auto extract = [&text, &path](const char *section,
                                      std::string *output) {
    const std::string startTag = std::string("<") + section + ">";
    const std::string endTag = std::string("</") + section + ">";
    const auto start = text.find(startTag);
    if (start == std::string::npos) {
      throw std::runtime_error("CSD is missing the <" + std::string(section) +
                               "> section: " + path);
    }
    const auto bodyStart = start + startTag.size();
    const auto end = text.find(endTag, bodyStart);
    if (end == std::string::npos) {
      throw std::runtime_error("CSD has an unterminated <" +
                               std::string(section) + "> section: " + path);
    }
    *output = text.substr(bodyStart, end - bodyStart);
  };
  CsdProgram program;
  extract("CsInstruments", &program.instruments);
  extract("CsScore", &program.score);
  return program;
}

// Read sr/ksmps/nchnls/0dbfs from the CsInstruments header region (the lines
// before the first instr/opcode definition). The derived values are also
// cross-checked against the running engine in runCsdTrial.
CsdHeaderValues parseCsdHeader(const std::string &instruments,
                               const std::string &path) {
  static const std::regex assignment(
      "^\\s*(sr|ksmps|nchnls|0dbfs)\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)");
  static const std::regex definition("^\\s*(instr|opcode)\\b");

  bool hasSampleRate = false;
  bool hasKsmps = false;
  bool hasNchnls = false;
  CsdHeaderValues values;
  std::istringstream stream(instruments);
  std::string line;
  while (std::getline(stream, line)) {
    if (std::regex_search(line, definition)) {
      break;
    }
    std::smatch match;
    if (!std::regex_search(line, match, assignment)) {
      continue;
    }
    const std::string key = match[1].str();
    const double value = std::stod(match[2].str());
    if (key == "sr" && !hasSampleRate) {
      values.sampleRate = value;
      hasSampleRate = true;
    } else if (key == "ksmps" && !hasKsmps) {
      values.ksmps = static_cast<int>(value);
      hasKsmps = true;
    } else if (key == "nchnls" && !hasNchnls) {
      values.nchnls = static_cast<int>(value);
      hasNchnls = true;
    } else if (key == "0dbfs" && !values.hasZeroDbFs) {
      values.zeroDbFs = value;
      values.hasZeroDbFs = true;
    }
  }
  if (!hasSampleRate || !hasKsmps || !hasNchnls) {
    throw std::runtime_error(
        "CSD CsInstruments header must declare sr, ksmps, and nchnls: " +
        path);
  }
  if (values.sampleRate <= 0.0 || values.ksmps <= 0 || values.nchnls <= 0) {
    throw std::runtime_error(
        "CSD CsInstruments header values must be positive: " + path);
  }
  return values;
}

// SHA-256 message digest implemented directly from the published FIPS 180-4
// §6.2.2 algorithm (original arrangement; no external dependencies). Used to
// identify the supplied CSD content in the benchmark report.
std::string sha256Hex(const std::string &data) {
  static const uint32_t kRoundConstants[64] = {
      0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu,
      0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u, 0xd807aa98u, 0x12835b01u,
      0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u,
      0xc19bf174u, 0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
      0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau, 0x983e5152u,
      0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u,
      0x06ca6351u, 0x14292967u, 0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu,
      0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
      0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u,
      0xd6990624u, 0xf40e3585u, 0x106aa070u, 0x19a4c116u, 0x1e376c08u,
      0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu,
      0x682e6ff3u, 0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
      0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u};
  const uint32_t initialState[8] = {0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u,
                                   0xa54ff53au, 0x510e527fu, 0x9b05688cu,
                                   0x1f83d9abu, 0x5be0cd19u};
  const auto rotateRight = [](uint32_t value, int bits) {
    return (value >> bits) | (value << (32 - bits));
  };

  uint32_t state[8];
  for (int index = 0; index < 8; ++index) {
    state[index] = initialState[index];
  }

  std::string message = data;
  const uint64_t bitLength = static_cast<uint64_t>(data.size()) * 8u;
  message.push_back(static_cast<char>(0x80));
  while (message.size() % 64 != 56) {
    message.push_back('\0');
  }
  for (int byte = 7; byte >= 0; --byte) {
    message.push_back(static_cast<char>((bitLength >> (byte * 8)) & 0xffu));
  }

  for (size_t offset = 0; offset < message.size(); offset += 64) {
    uint32_t w[64];
    for (int t = 0; t < 16; ++t) {
      w[t] = 0;
      for (int b = 0; b < 4; ++b) {
        w[t] = (w[t] << 8) |
               static_cast<uint8_t>(message[offset + t * 4 + b]);
      }
    }
    for (int t = 16; t < 64; ++t) {
      const uint32_t s0 = rotateRight(w[t - 15], 7) ^
                          rotateRight(w[t - 15], 18) ^ (w[t - 15] >> 3);
      const uint32_t s1 = rotateRight(w[t - 2], 17) ^
                          rotateRight(w[t - 2], 19) ^ (w[t - 2] >> 10);
      w[t] = w[t - 16] + s0 + w[t - 7] + s1;
    }
    uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
    uint32_t e = state[4], f = state[5], g = state[6], h = state[7];
    for (int t = 0; t < 64; ++t) {
      const uint32_t sum1 =
          rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const uint32_t choice = (e & f) ^ ((~e) & g);
      const uint32_t t1 = h + sum1 + choice + kRoundConstants[t] + w[t];
      const uint32_t sum0 =
          rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
      const uint32_t t2 = sum0 + majority;
      h = g;
      g = f;
      f = e;
      e = d + t1;
      d = c;
      c = b;
      b = a;
      a = t1 + t2;
    }
    state[0] += a;
    state[1] += b;
    state[2] += c;
    state[3] += d;
    state[4] += e;
    state[5] += f;
    state[6] += g;
    state[7] += h;
  }

  std::ostringstream hex;
  static const char *digits = "0123456789abcdef";
  for (int index = 0; index < 8; ++index) {
    for (int shift = 28; shift >= 0; shift -= 4) {
      hex << digits[(state[index] >> shift) & 0xfu];
    }
  }
  return hex.str();
}

CsdTrialResult runCsdTrial(const CsdProgram &program,
                           const CsdHeaderValues &header, int warmupCycles,
                           int measuredCycles, int trialIndex) {
  using namespace blue;

  SharedMemory sharedMemory;
  const auto uniqueId = std::chrono::steady_clock::now()
                            .time_since_epoch()
                            .count();
  // Keep the POSIX shared-memory name short: macOS caps names at 31 bytes
  // (PSHMNAMLEN), so the fixed-mode "be-bench-" prefix is shortened here.
  const std::string sharedMemoryName =
      "be-bcsd-" + std::to_string(uniqueId) + "-" +
      std::to_string(trialIndex);
  if (!sharedMemory.create(sharedMemoryName)) {
    throw std::runtime_error(
        "shared-memory setup failed for CSD benchmark (name=" +
        sharedMemoryName + "); run the benchmark where POSIX shared memory "
        "or Windows file mappings are available");
  }

  CsoundEngine engine;
  engine.setSharedMemory(&sharedMemory);
  engine.setThreadPriorityElevationEnabled(false);
  engine.setPerformanceWindow(static_cast<uint64_t>(warmupCycles),
                              static_cast<uint64_t>(measuredCycles));

  auto require = [&](bool condition, const std::string &message) {
    if (!condition) {
      throw std::runtime_error(message +
                               (engine.getLastError().empty()
                                    ? std::string{}
                                    : ": " + engine.getLastError()));
    }
  };

  require(engine.create(), "engine create failed");
  require(engine.setOption("-n"), "failed to disable audio output");
  require(engine.setOption("-d"), "failed to disable displays");
  require(engine.setOption("-m0"), "failed to disable Csound messages");
  require(engine.compileOrc(program.instruments),
          "CSD orchestra compilation failed");
  require(engine.readScore(program.score), "CSD score setup failed");
  require(engine.start(), "engine start failed");

  const auto snapshot = engine.getStateSnapshot();
  if (snapshot.sampleRate != header.sampleRate ||
      snapshot.ksmps != header.ksmps) {
    std::ostringstream detail;
    detail << "CSD header disagrees with the compiled engine (header sr="
           << header.sampleRate << " ksmps=" << header.ksmps
           << ", engine sr=" << snapshot.sampleRate
           << " ksmps=" << snapshot.ksmps << ")";
    throw std::runtime_error(detail.str());
  }

  // Null audio normally outruns wall clock; the deadline still scales with
  // the audio duration of the requested window so an engine that cannot
  // outrun real time fails explicitly instead of hanging.
  const double windowAudioSeconds =
      static_cast<double>(warmupCycles + measuredCycles) *
      static_cast<double>(header.ksmps) / header.sampleRate;
  const auto deadline =
      std::chrono::steady_clock::now() +
      std::chrono::duration_cast<std::chrono::steady_clock::duration>(
          std::chrono::duration<double>(10.0 + windowAudioSeconds));
  while (engine.isRunning() && std::chrono::steady_clock::now() < deadline) {
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
  }
  require(!engine.isRunning(), "CSD performance did not complete");

  // A naturally completed perform thread has already published STOPPED but
  // is still joinable while it emits its final counters; join before reading
  // the summary (same boundary as the fixed-scenario trials).
  engine.stop();

  const auto summary = engine.getLastPerformanceSummary();
  require(summary.available, "engine did not publish performance counters");
  require(summary.cycleCount >= static_cast<uint64_t>(measuredCycles),
          "CSD performance ended before the requested measurement window");

  CsdTrialResult result;
  result.measuredCycles = summary.cycleCount;
  result.performKsmpsAvgUs = summary.performAvgUs;
  engine.destroy();

  if (!std::isfinite(result.performKsmpsAvgUs) ||
      result.performKsmpsAvgUs <= 0.0) {
    throw std::runtime_error(
        "CSD benchmark produced a non-finite or non-positive "
        "performKsmpsAvgUs");
  }
  return result;
}

std::string buildCsdJson(const std::string &csdPath, const std::string &csdSha256,
                         const CsdHeaderValues &header, int trials, bool research,
                         int warmupCycles, int measuredCycles,
                         const std::vector<CsdTrialResult> &results) {
  std::vector<CsdTrialResult> sorted = results;
  std::sort(sorted.begin(), sorted.end(),
            [](const CsdTrialResult &left, const CsdTrialResult &right) {
              return left.performKsmpsAvgUs < right.performKsmpsAvgUs;
            });
  const CsdTrialResult median = sorted[sorted.size() / 2];

#ifdef BLUE_ENGINE_SOURCE_REVISION
  const std::string sourceRevision = BLUE_ENGINE_SOURCE_REVISION;
#else
  const std::string sourceRevision = "unknown";
#endif
  const auto &loaderReport = blue::CsoundLoader::getReport();
  std::ifstream libraryInput(loaderReport.loadedPath, std::ios::binary);
  if (!libraryInput) throw std::runtime_error("cannot hash loaded Csound library: " + loaderReport.loadedPath);
  std::ostringstream libraryContents;
  libraryContents << libraryInput.rdbuf();
  const auto libraryHash = sha256Hex(libraryContents.str());


  std::ostringstream output;
  output << std::setprecision(12);
  output << "{\n"
         << "  \"benchmarkKind\": \"mixer-generated-csd\",\n"
         << "  \"schemaVersion\": 1,\n"
         << "  \"research\": " << (research ? "true" : "false") << ",\n"
         << "  \"timestamp\": \"" << timestampNow() << "\",\n"
         << "  \"csdPath\": \"" << jsonEscape(csdPath) << "\",\n"
         << "  \"csdSha256\": \"" << csdSha256 << "\",\n"
         << "  \"metric\": {\n"
         << "    \"name\": \"performKsmpsAvgUs\",\n"
         << "    \"clock\": \"steady_clock\",\n"
         << "    \"units\": \"microseconds per ksmps block\",\n"
         << "    \"summary\": \"mean steady-clock elapsed Csound perform time per ksmps block within a trial; median across trials reported as medianPerformKsmpsAvgUs; elapsed time, not CPU time\"\n"
         << "  },\n"
         << "  \"metadata\": {\n"
         << "    \"buildType\": \"Release\",\n"
         << "    \"compiler\": \"" << jsonEscape(compilerName()) << "\",\n"
         << "    \"targetArch\": \"" << targetArchitecture() << "\",\n"
         << "    \"operatingSystem\": \"" << operatingSystem() << "\",\n"
         << "    \"csoundVersion\": " << loaderReport.versionRaw << ",\n"
         << "    \"csoundLibraryPath\": \"" << jsonEscape(loaderReport.loadedPath) << "\",\n"
         << "    \"csoundLibrarySha256\": \"" << libraryHash << "\",\n"
         << "    \"sampleBytes\": 8,\n"
         << "    \"precisionDerivation\": \"csoundGetSizeOfMYFLT() verified on loaded library\",\n"
         << "    \"threading\": \"single perform thread, priority elevation disabled, no multicore option\",\n"

         << "    \"engineSourceRevision\": \"" << jsonEscape(sourceRevision) << "\",\n"
         << "    \"sampleRate\": " << header.sampleRate << ",\n"
         << "    \"ksmps\": " << header.ksmps << ",\n"
         << "    \"nchnls\": " << header.nchnls << ",\n"
         << "    \"zeroDbFs\": "
         << (header.hasZeroDbFs ? std::to_string(header.zeroDbFs)
                                : std::string("null"))
         << ",\n"
         << "    \"headerDerivation\": \"effective sr/ksmps/nchnls/0dbfs inspected on an untimed compiled instance; explicit header values cross-checked; omitted 0dbfs uses runtime default\"\n"
         << "    , \"csoundOptions\": [\"-n\", \"-d\", \"-m0\"],\n"
         << "    \"csdCsOptionsIgnored\": true,\n"
         << "    \"warmupCycles\": " << warmupCycles << ",\n"
         << "    \"measuredCycles\": " << measuredCycles << ",\n"
         << "    \"trials\": " << trials << "\n"
         << "  },\n"
         << "  \"trials\": [\n";
  for (size_t index = 0; index < results.size(); ++index) {
    output << "    {\n"
           << "      \"performKsmpsAvgUs\": " << results[index].performKsmpsAvgUs
           << ",\n"
           << "      \"measuredCycles\": " << results[index].measuredCycles
           << "\n"
           << "    }" << (index + 1 < results.size() ? "," : "") << "\n";
  }
  output << "  ],\n"
         << "  \"medianPerformKsmpsAvgUs\": " << median.performKsmpsAvgUs
         << "\n"
         << "}\n";
  return output.str();
}

// Developer-only inspection of the loaded library. No production protocol or
// loader capability changes: resolve only the public introspection functions
// needed to validate this benchmark's assumed ABI and effective header.
void validateCsdRuntime(const CsdProgram &program, CsdHeaderValues &header) {
  const auto &path = blue::CsoundLoader::getLoadedPath();
#ifdef _WIN32
  auto library = LoadLibraryA(path.c_str());
  auto symbol = [&](const char *name) { return GetProcAddress(library, name); };
#else
  auto library = dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
  auto symbol = [&](const char *name) { return dlsym(library, name); };
#endif
  if (!library) throw std::runtime_error("cannot inspect loaded Csound library");
  auto sampleSize = reinterpret_cast<int32_t (*)()>(symbol("csoundGetSizeOfMYFLT"));
  using Csound = blue::csound::CSOUND;
  auto channels = reinterpret_cast<uint32_t (*)(Csound *, int32_t)>(symbol("csoundGetChannels"));
  auto zeroDbFs = reinterpret_cast<double (*)(Csound *)>(symbol("csoundGet0dBFS"));
  const bool symbolsPresent = sampleSize && channels && zeroDbFs;
  const bool doubleSamples = symbolsPresent && sampleSize() == 8;
  bool headerMatches = false;
  if (doubleSamples) {
    std::unique_ptr<Csound, decltype(blue::CsoundLoader::csoundDestroy)> instance(
        blue::CsoundLoader::csoundCreate(nullptr, nullptr), blue::CsoundLoader::csoundDestroy);
    if (instance && blue::CsoundLoader::csoundSetOption(instance.get(), "-n") == 0 &&
        blue::CsoundLoader::csoundSetOption(instance.get(), "-d") == 0 &&
        blue::CsoundLoader::csoundSetOption(instance.get(), "-m0") == 0 &&
        blue::CsoundLoader::csoundCompileOrc(instance.get(), program.instruments.c_str(), 0) == 0 &&
        blue::CsoundLoader::csoundStart(instance.get()) == 0) {
      if (!header.hasZeroDbFs) { header.zeroDbFs = zeroDbFs(instance.get()); header.hasZeroDbFs = true; }
      headerMatches = blue::CsoundLoader::csoundGetSr(instance.get()) == header.sampleRate &&
        blue::CsoundLoader::csoundGetKsmps(instance.get()) == static_cast<uint32_t>(header.ksmps) &&
        channels(instance.get(), 0) == static_cast<uint32_t>(header.nchnls) &&
        header.hasZeroDbFs && zeroDbFs(instance.get()) == header.zeroDbFs;
    }
  }
#ifdef _WIN32
  FreeLibrary(library);
#else
  dlclose(library);
#endif
  if (!doubleSamples) throw std::runtime_error("benchmark requires verified double-sample Csound introspection");
  if (!headerMatches) throw std::runtime_error("CSD header differs from effective compiled sr/ksmps/nchnls/0dbfs");
}

int runCsdBenchmark(const std::string &csdPath, int trials, int warmupCycles,
                    int measuredCycles, bool json, const std::string &outputPath, bool research) {
  std::ifstream input(csdPath, std::ios::binary);
  if (!input) {
    throw std::runtime_error("cannot open CSD file: " + csdPath);
  }
  std::ostringstream contents;
  contents << input.rdbuf();
  const std::string csdText = contents.str();

  const CsdProgram program = parseCsdProgram(csdText, csdPath);
  CsdHeaderValues header = parseCsdHeader(program.instruments, csdPath);
  const std::string csdSha256 = sha256Hex(csdText);
  validateCsdRuntime(program, header);

  std::vector<CsdTrialResult> results;
  results.reserve(static_cast<size_t>(trials));
  for (int trial = 0; trial < trials; ++trial) {
    results.push_back(
        runCsdTrial(program, header, warmupCycles, measuredCycles, trial));
  }

  const std::string output = buildCsdJson(csdPath, csdSha256, header, trials, research,
                                          warmupCycles, measuredCycles, results);
  if (!outputPath.empty()) {
    std::ofstream file(outputPath);
    if (!file) {
      throw std::runtime_error("cannot write benchmark output: " + outputPath);
    }
    file << output;
  }
  if (json) {
    std::cout << output;
  } else {
    std::vector<CsdTrialResult> sorted = results;
    std::sort(sorted.begin(), sorted.end(),
              [](const CsdTrialResult &left, const CsdTrialResult &right) {
                return left.performKsmpsAvgUs < right.performKsmpsAvgUs;
              });
    const CsdTrialResult &median = sorted[sorted.size() / 2];
    std::cout << "mixer-generated-csd: perform_ksmps_avg_us="
              << median.performKsmpsAvgUs
              << " measured_cycles=" << median.measuredCycles << '\n';
  }
  return 0;
}

} // namespace

int main(int argc, char **argv) {
  std::string targetScenario = "all";
  int trials = 5;
  int warmupCycles = 1024;
  int measuredCycles = 4096;
  bool json = false;
  std::string outputPath;
  std::string comparePath;
  std::string csdPath;
  bool scenarioExplicit = false;
  bool cyclesExplicit = false;
  bool research = false;

  try {
    for (int index = 1; index < argc; ++index) {
      const std::string argument = argv[index];
      auto nextValue = [&](const char *name) {
        if (index + 1 >= argc) {
          throw std::runtime_error(std::string(name) + " requires a value");
        }
        return std::string(argv[++index]);
      };
      if (argument == "--help" || argument == "-h") {
        printUsage();
        return 0;
      } else if (argument == "--scenario") {
        targetScenario = nextValue("--scenario");
        scenarioExplicit = true;
      } else if (argument == "--trials") {
        trials = std::max(1, std::stoi(nextValue("--trials")));
      } else if (argument == "--warmup" || argument == "--warmup-cycles") {
        warmupCycles = std::max(1024, std::stoi(nextValue(argument.c_str())));
      } else if (argument == "--cycles" || argument == "--measure-cycles") {
        measuredCycles = std::stoi(nextValue(argument.c_str()));
        cyclesExplicit = true;
      } else if (argument == "--research") {
        research = true;
      } else if (argument == "--compare") {
        comparePath = nextValue("--compare");
      } else if (argument == "--output") {
        outputPath = nextValue("--output");
      } else if (argument == "--json") {
        json = true;
      } else if (argument == "--csd") {
        csdPath = nextValue("--csd");
      } else {
        throw std::runtime_error("unknown argument: " + argument);
      }
    }

    if (!csdPath.empty()) {
      if (!cyclesExplicit) measuredCycles = 65536;
      if (measuredCycles <= 0 || (!research && measuredCycles < 65536)) {
        throw std::runtime_error("supplied-CSD acceptance requires at least 65536 measured cycles; shorter runs require --research");
      }
      if (scenarioExplicit) {
        throw std::runtime_error(
            "--csd cannot be combined with --scenario (the supplied-CSD mode "
            "derives rate, block size, and layout from the CSD file)");
      }
      if (!comparePath.empty()) {
        throw std::runtime_error(
            "--csd cannot be combined with --compare (use the wrapper's "
            "--baseline-csd for a supplied-CSD baseline)");
      }
      // Fail fast on an unreadable file before loading the Csound runtime.
      std::ifstream probe(csdPath);
      if (!probe) {
        throw std::runtime_error("cannot open CSD file: " + csdPath);
      }
    }

    if (csdPath.empty()) measuredCycles = std::max(4096, measuredCycles);

    if (!blue::CsoundLoader::initialize()) {
      std::cerr << "benchmark unavailable: Csound 7 could not be loaded: "
                << blue::CsoundLoader::getError() << '\n';
      return 2;
    }

    if (!csdPath.empty()) {
      return runCsdBenchmark(csdPath, trials, warmupCycles, measuredCycles,
                             json, outputPath, research);
    }

    std::vector<const Scenario *> selected;
    for (const auto &scenario : kScenarios) {
      if (targetScenario == "all" || targetScenario == scenario.name) {
        selected.push_back(&scenario);
      }
    }
    if (selected.empty()) {
      throw std::runtime_error("unknown scenario: " + targetScenario);
    }

    std::vector<ScenarioResult> results;
    for (const Scenario *scenario : selected) {
      ScenarioResult result;
      result.scenario = scenario;
      result.warmupCycles = warmupCycles;
      result.measuredCycles = measuredCycles;
      result.trials.reserve(static_cast<size_t>(trials));
      for (int trial = 0; trial < trials; ++trial) {
        result.trials.push_back(
            runTrial(*scenario, warmupCycles, measuredCycles, trial));
      }
      result.medianSummary = medianSummary(result.trials);
      results.push_back(std::move(result));
    }

    bool compared = !comparePath.empty();
    bool primaryImprovementMet = true;
    bool unaffectedRegressionMet = true;
    bool spikeCountDischarged = true;
    std::string baselineIdentity;
    if (compared) {
      const auto baseline = readBaseline(comparePath);
      const auto incompatible = [&](const std::string &field,
                                    const std::string &expected,
                                    const std::string &actual) {
        if (actual != expected) {
          throw std::runtime_error("baseline metadata mismatch for " + field +
                                   " (expected " + expected + ", got " +
                                   actual + ")");
        }
      };
      incompatible("buildType", "Release", baseline.buildType);
      incompatible("compiler", compilerName(), baseline.compiler);
      incompatible("targetArch", targetArchitecture(), baseline.targetArch);
      incompatible("operatingSystem", operatingSystem(), baseline.operatingSystem);
      if (baseline.sampleRate != 48000.0 || baseline.ksmps != 32 ||
          baseline.warmupCycles != warmupCycles ||
          baseline.measuredCycles != measuredCycles) {
        throw std::runtime_error(
            "baseline metadata mismatch for sample rate, ksmps, or measurement window");
      }
      baselineIdentity = baseline.sourceRevision.empty()
                             ? comparePath
                             : baseline.sourceRevision;
      bool foundCommonPath = false;
      for (const auto &result : results) {
        const auto baselineIt = baseline.metrics.find(result.scenario->name);
        if (baselineIt == baseline.metrics.end()) {
          if (std::string(result.scenario->name).find("quantized_exact") == 0) {
            // Exact-decimal scenarios were added after the SPEC 072 baseline.
            // They remain visible in the current report without making an
            // older baseline unusable.
            continue;
          }
          throw std::runtime_error("baseline is missing scenario " +
                                   std::string(result.scenario->name));
        }
        const auto &current = result.medianSummary;
        const auto &previous = baselineIt->second;
        const double hostDeltaPct = previous.hostAvgUs > 0.0
                                        ? (current.hostCycleAvgUs - previous.hostAvgUs) /
                                              previous.hostAvgUs * 100.0
                                        : 0.0;
        const double p95DeltaPct = previous.hostP95Us > 0.0
                                       ? (current.hostCycleP95Us - previous.hostP95Us) /
                                             previous.hostP95Us * 100.0
                                       : 0.0;
        const std::string scenarioName = result.scenario->name;
        const bool exactScenario = scenarioName.find("quantized_exact") == 0;
        if (scenarioName == "linear_32") {
          foundCommonPath = true;
          if (hostDeltaPct > 5.0) {
            primaryImprovementMet = false;
          }
        } else if (!exactScenario && p95DeltaPct > 5.0) {
          unaffectedRegressionMet = false;
        }
        if (current.hostCycleSpikeCount > previous.hostSpikeCount) {
          spikeCountDischarged = false;
        }
      }
      primaryImprovementMet = primaryImprovementMet && foundCommonPath;
    }

    const std::string output = buildJson(
        results, warmupCycles, measuredCycles, compared,
        primaryImprovementMet, unaffectedRegressionMet, spikeCountDischarged,
        baselineIdentity);
    if (!outputPath.empty()) {
      std::ofstream file(outputPath);
      if (!file) {
        throw std::runtime_error("cannot write benchmark output: " + outputPath);
      }
      file << output;
    }
    if (json) {
      std::cout << output;
    } else {
      for (const auto &result : results) {
        std::cout << result.scenario->name << ": host_avg_us="
                  << result.medianSummary.hostCycleAvgUs
                  << " host_p95_us=" << result.medianSummary.hostCycleP95Us
                  << " host_spikes=" << result.medianSummary.hostCycleSpikeCount
                  << " measured_cycles=" << result.medianSummary.measuredCycles
                  << '\n';
      }
    }

    if (compared &&
        !(primaryImprovementMet && unaffectedRegressionMet &&
          spikeCountDischarged)) {
      std::cerr << "BENCHMARK_REGRESSION_GATE_FAILED\n";
      return 1;
    }
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "benchmark failed: " << error.what() << '\n';
    return 2;
  }
}
