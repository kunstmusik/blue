#include "csound/CsoundLoader.h"
#include "csound/CsoundRuntimeServices.h"
#include "engine/CsoundEngine.h"

#include <chrono>
#include <iostream>
#include <filesystem>
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

    // Exercise the one-shot Csound API lifecycle with the committed fixture.
    auto *csound = blue::CsoundLoader::csoundCreate(nullptr, nullptr);
    require(csound != nullptr, "Failed to create one-shot Csound instance");
    blue::CsoundLoader::csoundCreateMessageBuffer(csound, 0);
    const auto fixture = (std::filesystem::path(__FILE__).parent_path().parent_path() /
                          "fixtures" / "csound-runtime.csd").string();
    std::string messages;
    const int performance = blue::CsoundRuntimeServices::runPerformance(
        csound, {"-n", "-d", "-m0", fixture},
        [&messages](const std::string &message) { messages += message; });
    blue::CsoundLoader::csoundReset(csound);
    blue::CsoundLoader::csoundDestroyMessageBuffer(csound);
    blue::CsoundLoader::csoundDestroy(csound);
    require(performance == blue::csound::CSOUND_SUCCESS,
            "One-shot Csound performance did not complete");

    // Module enumeration without a selected backend must be a valid empty
    // device result and must not activate every installed audio/MIDI module.
    auto *ioCsound = blue::CsoundLoader::csoundCreate(nullptr, nullptr);
    require(ioCsound != nullptr, "Failed to create I/O discovery Csound instance");
    blue::CsoundIoReport ioReport;
    std::string ioError;
    require(blue::CsoundRuntimeServices::queryIo(
                ioCsound, "", "", ioReport, ioError),
            "I/O module enumeration failed: " + ioError);
    require(ioReport.selectedAudioModule.empty() &&
                ioReport.selectedMidiModule.empty(),
            "Unselected I/O discovery unexpectedly selected a backend");
    require(ioReport.audioInputs.empty() && ioReport.audioOutputs.empty() &&
                ioReport.midiInputs.empty() && ioReport.midiOutputs.empty(),
            "Unselected I/O discovery returned device entries");
    blue::CsoundLoader::csoundReset(ioCsound);
    blue::CsoundLoader::csoundDestroy(ioCsound);

    const auto repositoryRoot = std::filesystem::path(__FILE__)
                                    .parent_path()
                                    .parent_path()
                                    .parent_path()
                                    .parent_path()
                                    .parent_path();
    const auto sourceAudio = repositoryRoot / "examples" / "techniques" /
                             "hellorcb.aif";
    require(std::filesystem::exists(sourceAudio),
            "sndinfo integration fixture is missing");
    const auto utilityDirectory = std::filesystem::temp_directory_path() /
                                  "blue runtime utility fixture";
    std::filesystem::create_directories(utilityDirectory);
    const auto copiedAudio = utilityDirectory / "fixture with spaces.aif";
    std::filesystem::copy_file(sourceAudio, copiedAudio,
                               std::filesystem::copy_options::overwrite_existing);
    auto *utilityCsound = blue::CsoundLoader::csoundCreate(nullptr, nullptr);
    require(utilityCsound != nullptr, "Failed to create utility Csound instance");
    blue::CsoundLoader::csoundCreateMessageBuffer(utilityCsound, 0);
    std::string utilityMessages;
    const int utilityResult = blue::CsoundRuntimeServices::runUtility(
        utilityCsound, "sndinfo", {copiedAudio.string()},
        [&utilityMessages](const std::string &message) { utilityMessages += message; });
    blue::CsoundLoader::csoundReset(utilityCsound);
    blue::CsoundLoader::csoundDestroyMessageBuffer(utilityCsound);
    blue::CsoundLoader::csoundDestroy(utilityCsound);
    std::filesystem::remove_all(utilityDirectory);
    require(utilityResult == blue::csound::CSOUND_SUCCESS,
            "sndinfo utility did not complete");
    require(utilityMessages.find("fixture with spaces.aif") != std::string::npos,
            "sndinfo output did not retain the path argument");
    std::cout << "Csound 7 null-audio integration test passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "Csound integration test failed: " << error.what() << '\n';
    return 1;
  }
}
