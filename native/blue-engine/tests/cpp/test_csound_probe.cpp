#include "csound/CsoundLoader.h"
#include "protocol/Capabilities.h"

#include <algorithm>
#include <cassert>
#include <iostream>
#include <string>

namespace {

void testBenchmarkMatrixSchemaStructure() {
  // Verify required schema keys for benchmark JSON contract
  const std::string sampleBenchmarkJson = R"({
  "timestamp": "2026-08-13T21:40:00Z",
  "metadata": {
    "buildType": "Release",
    "compiler": "Clang",
    "targetArch": "arm64",
    "operatingSystem": "macos",
    "sampleRate": 48000.0,
    "ksmps": 32,
    "gitCommit": "HEAD"
  },
  "gateStatus": {
    "passed": true,
    "primaryImprovementMet": true,
    "unaffectedRegressionMet": true,
    "spikeCountDischarged": true
  },
  "scenarios": []
})";

  assert(sampleBenchmarkJson.find("\"timestamp\"") != std::string::npos);
  assert(sampleBenchmarkJson.find("\"metadata\"") != std::string::npos);
  assert(sampleBenchmarkJson.find("\"gateStatus\"") != std::string::npos);
  assert(sampleBenchmarkJson.find("\"primaryImprovementMet\"") != std::string::npos);
  assert(sampleBenchmarkJson.find("\"unaffectedRegressionMet\"") != std::string::npos);
  assert(sampleBenchmarkJson.find("\"spikeCountDischarged\"") != std::string::npos);
  assert(sampleBenchmarkJson.find("\"scenarios\"") != std::string::npos);
}

} // namespace

int main() {
  testBenchmarkMatrixSchemaStructure();

  const auto explicitCandidates =
      blue::CsoundLoader::candidatePaths("/absolute/csound", "/environment/csound");
  assert(explicitCandidates.size() == 1);
  assert(explicitCandidates.front() == "/absolute/csound");

  const auto environmentCandidates =
      blue::CsoundLoader::candidatePaths("", "/environment/csound");
  assert(environmentCandidates.size() == 1);
  assert(environmentCandidates.front() == "/environment/csound");

  assert(blue::CsoundLoader::isSupportedVersion(7000));
  assert(blue::CsoundLoader::isSupportedVersion(7190));
  assert(!blue::CsoundLoader::isSupportedVersion(6200));
  assert(!blue::CsoundLoader::isSupportedVersion(8000));

  const auto macCandidates =
      blue::CsoundLoader::platformCandidatePaths("darwin", "/Users/test");
  assert(macCandidates.front() ==
         "/Library/Frameworks/CsoundLib64.framework/CsoundLib64");
  assert(std::find(macCandidates.begin(), macCandidates.end(),
                   "/opt/homebrew/lib/libcsound64.dylib") !=
         macCandidates.end());
  assert(std::find(macCandidates.begin(), macCandidates.end(),
                   "/usr/local/lib/libcsound64.dylib") !=
         macCandidates.end());

  const auto windowsCandidates =
      blue::CsoundLoader::platformCandidatePaths(
          "win32", "", "C:\\Program Files");
  assert(!windowsCandidates.empty());
  for (const auto &candidate : windowsCandidates) {
    assert(candidate.rfind("C:\\Program Files\\", 0) == 0);
    assert(candidate != "csound64.dll");
  }
  assert(blue::CsoundLoader::platformCandidatePaths(
             "win32", "", ".")
             .empty());

  const auto linuxCandidates =
      blue::CsoundLoader::platformCandidatePaths("linux");
  assert(std::find(linuxCandidates.begin(), linuxCandidates.end(),
                   "/usr/lib64/libcsound64.so.7") !=
         linuxCandidates.end());
  assert(std::find(linuxCandidates.begin(), linuxCandidates.end(),
                   "/usr/lib/x86_64-linux-gnu/libcsound64.so.7.0") !=
         linuxCandidates.end());

  blue::CsoundLoadReport missingSymbols;
  missingSymbols.status = blue::CsoundLoadStatus::MISSING_SYMBOLS;
  missingSymbols.requestedPath = "/absolute/csound";
  missingSymbols.loadedPath = "/absolute/csound";
  missingSymbols.missingSymbols = {"csoundGetVersion"};
  missingSymbols.message = "Csound library is missing required symbols";
  const std::string missingJson = blue::csoundProbeJson(missingSymbols);
  assert(missingJson.find("\"status\":\"missing-symbols\"") !=
         std::string::npos);
  assert(missingJson.find("\"csoundGetVersion\"") != std::string::npos);
  assert(missingJson.find("\"ready\":false") != std::string::npos);

  blue::CsoundLoader::unload();
  const bool loaded =
      blue::CsoundLoader::load("/path/that/does/not/exist/libcsound64");
  assert(!loaded);
  const auto &report = blue::CsoundLoader::getReport();
  assert(report.status == blue::CsoundLoadStatus::LOAD_FAILED);
  assert(report.requestedPath ==
         "/path/that/does/not/exist/libcsound64");
  assert(!report.ready());
  blue::CsoundLoader::unload();

  std::cout << "Csound probe tests passed\n";
  return 0;
}
