#include "engine/CsoundEngine.h"
#include "csound/CsoundLoader.h"
#include "automation/AutomationStore.h"
#include "ipc/SharedMemory.h"

#include <algorithm>
#include <chrono>
#include <cmath>
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

namespace {

struct Scenario {
  const char *name;
  int channelCount;
  int automationCount;
  bool changing;
  bool exponential;
  bool quantized;
  bool highPrecision;
  bool completed;
  bool liveEdit;
  bool liveCompile;
  bool missingBinding;
  bool indefinitePerformance;
};

// The matrix deliberately includes the limits called out by the performance
// contract instead of hiding them behind a synthetic stand-in.
const std::vector<Scenario> kScenarios = {
    {"static_0", 0, 0, false, false, false, false, false, false, false, false, false},
    {"static_1", 1, 0, false, false, false, false, false, false, false, false, false},
    {"static_32", 32, 0, false, false, false, false, false, false, false, false, false},
    {"static_128", 128, 0, false, false, false, false, false, false, false, false, false},
    {"static_256", 256, 0, false, false, false, false, false, false, false, false, false},
    {"changing_1", 1, 0, true, false, false, false, false, false, false, false, false},
    {"changing_32", 32, 0, true, false, false, false, false, false, false, false, false},
    {"changing_128", 128, 0, true, false, false, false, false, false, false, false, false},
    {"changing_256", 256, 0, true, false, false, false, false, false, false, false, false},
    {"linear_1", 1, 1, false, false, false, false, false, false, false, false, false},
    {"linear_32", 32, 32, false, false, false, false, false, false, false, false, false},
    {"linear_128", 128, 128, false, false, false, false, false, false, false, false, false},
    {"linear_256", 256, 256, false, false, false, false, false, false, false, false, false},
    {"exponential_1", 1, 1, false, true, false, false, false, false, false, false, false},
    {"exponential_32", 32, 32, false, true, false, false, false, false, false, false, false},
    {"exponential_128", 128, 128, false, true, false, false, false, false, false, false, false},
    {"exponential_256", 256, 256, false, true, false, false, false, false, false, false, false},
    {"quantized_fast_32", 32, 32, false, false, true, false, false, false, false, false, false},
    {"quantized_high_precision_32", 32, 32, false, false, true, true, false, false, false, false, false},
    {"completed_256", 256, 256, false, false, true, true, true, false, false, false, false},
    {"live_edit_32", 32, 32, false, false, true, false, false, true, false, false, true},
    {"live_compile_32", 32, 32, false, false, false, false, false, false, true, false, true},
    {"missing_binding_32", 32, 1, false, false, false, false, false, false, false, true, false},
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
                points, true, scenario.quantized ? 0.01 : 0.0, 2,
                scenario.highPrecision) > 0,
            "automation setup failed");
  }
  if (scenario.missingBinding) {
    store->createAutomation(
        "missing_channel", AutomationCurve::LINEAR,
        std::vector<AutomationPoint>{{0.0, 0.0}, {3.0, 1.0}}, true);
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
            true, scenario.quantized ? 0.01 : 0.0, 2,
            scenario.highPrecision);
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
           << "      \"highPrecision\": " << (result.scenario->highPrecision ? "true" : "false") << ",\n"
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
               "[--output FILE] [--json]\n";
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
      } else if (argument == "--trials") {
        trials = std::max(1, std::stoi(nextValue("--trials")));
      } else if (argument == "--warmup" || argument == "--warmup-cycles") {
        warmupCycles = std::max(1024, std::stoi(nextValue(argument.c_str())));
      } else if (argument == "--cycles" || argument == "--measure-cycles") {
        measuredCycles = std::max(4096, std::stoi(nextValue(argument.c_str())));
      } else if (argument == "--compare") {
        comparePath = nextValue("--compare");
      } else if (argument == "--output") {
        outputPath = nextValue("--output");
      } else if (argument == "--json") {
        json = true;
      } else {
        throw std::runtime_error("unknown argument: " + argument);
      }
    }

    if (!blue::CsoundLoader::initialize()) {
      std::cerr << "benchmark unavailable: Csound 7 could not be loaded: "
                << blue::CsoundLoader::getError() << '\n';
      return 2;
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
      bool foundTarget = false;
      for (const auto &result : results) {
        const auto baselineIt = baseline.metrics.find(result.scenario->name);
        if (baselineIt == baseline.metrics.end()) {
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
        const bool targeted = scenarioName.find("changing") != std::string::npos ||
                              scenarioName.find("linear") != std::string::npos ||
                              scenarioName.find("exponential") != std::string::npos ||
                              scenarioName.find("quantized") != std::string::npos ||
                              scenarioName.find("completed") != std::string::npos ||
                              scenarioName.find("live_edit") != std::string::npos;
        if (targeted) {
          foundTarget = true;
          if (hostDeltaPct > -10.0) {
            primaryImprovementMet = false;
          }
        } else if (p95DeltaPct > 5.0) {
          unaffectedRegressionMet = false;
        }
        if (current.hostCycleSpikeCount > previous.hostSpikeCount) {
          spikeCountDischarged = false;
        }
      }
      primaryImprovementMet = primaryImprovementMet && foundTarget;
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
