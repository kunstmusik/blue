#include "csound/CsoundLoader.h"
#include "csound/CsoundRuntimeServices.h"
#include "engine/CsoundEngine.h"
#include "ipc/SharedMemory.h"
#include "ipc/ZmqHandler.h"
#include "process/OwnerMonitor.h"
#include "protocol/Capabilities.h"

#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <string>
#include <vector>

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#else
#include <fcntl.h>
#include <unistd.h>
#endif

namespace {
blue::ZmqHandler *g_handler = nullptr;

enum class OneShotMode {
  NONE,
  PROBE,
  LIST_IO,
  RUN_UTILITY,
  RUN_CSOUND,
};

bool isAbsolutePath(const std::string &value) {
  return !value.empty() && std::filesystem::path(value).is_absolute();
}

bool isBoundedModuleName(const std::string &value) {
  return value.size() < 128 && value.find('\0') == std::string::npos;
}

class StdoutSilencer {
public:
  StdoutSilencer() {
    std::fflush(nullptr);
#ifdef _WIN32
    saved_ = _dup(_fileno(stdout));
    null_ = _open("NUL", _O_WRONLY);
    if (saved_ >= 0 && null_ >= 0) {
      _dup2(null_, _fileno(stdout));
    }
#else
    saved_ = dup(STDOUT_FILENO);
    null_ = open("/dev/null", O_WRONLY);
    if (saved_ >= 0 && null_ >= 0) {
      dup2(null_, STDOUT_FILENO);
    }
#endif
  }

  ~StdoutSilencer() {
    std::fflush(nullptr);
#ifdef _WIN32
    if (saved_ >= 0) {
      _dup2(saved_, _fileno(stdout));
    }
    if (null_ >= 0) {
      _close(null_);
    }
    if (saved_ >= 0) {
      _close(saved_);
    }
#else
    if (saved_ >= 0) {
      dup2(saved_, STDOUT_FILENO);
    }
    if (null_ >= 0) {
      close(null_);
    }
    if (saved_ >= 0) {
      close(saved_);
    }
#endif
  }

private:
  int saved_ = -1;
  int null_ = -1;
};

int runOneShot(OneShotMode mode, const std::string &csoundLibraryPath,
               const std::string &utilityName,
               const std::string &audioModule,
               const std::string &midiModule,
               const std::vector<std::string> &arguments) {
  blue::CsoundLoader::unload();
  const bool loaded = blue::CsoundLoader::load(csoundLibraryPath);

  if (mode == OneShotMode::PROBE) {
    std::printf("%s\n",
                blue::csoundProbeJson(blue::CsoundLoader::getReport()).c_str());
    blue::CsoundLoader::unload();
    return loaded ? 0 : 2;
  }

  if (mode == OneShotMode::LIST_IO) {
    blue::CsoundIoReport report;
    std::string error;
    blue::CsoundLoadReport loadReport;
    bool runtimeReady = false;
    bool queryOk = false;
    {
      StdoutSilencer silence;
      runtimeReady = loaded && blue::CsoundLoader::initialize();
      blue::csound::CSOUND *csound = nullptr;
      if (runtimeReady) {
        csound = blue::CsoundLoader::csoundCreate(nullptr, nullptr);
        runtimeReady = csound != nullptr;
        if (!runtimeReady) {
          error = "Failed to create Csound instance";
        }
      }
      if (runtimeReady) {
        blue::CsoundLoader::csoundCreateMessageBuffer(csound, 0);
        queryOk = blue::CsoundRuntimeServices::queryIo(
            csound, audioModule, midiModule, report, error);
        blue::CsoundRuntimeServices::drainMessages(
            csound, [&report](const std::string &message) {
              if (!message.empty()) report.diagnostics.push_back(message);
            });
        blue::CsoundLoader::csoundReset(csound);
        blue::CsoundLoader::csoundDestroyMessageBuffer(csound);
        blue::CsoundLoader::csoundDestroy(csound);
      }
      loadReport = blue::CsoundLoader::getReport();
      blue::CsoundLoader::unload();
    }
    std::printf("%s\n", blue::csoundIoJson(
                             loadReport, report, runtimeReady, error).c_str());
    return queryOk ? 0 : (loaded ? 65 : 2);
  }

  if (!loaded || !blue::CsoundLoader::initialize()) {
    std::fprintf(stderr, "%s\n", blue::CsoundLoader::getError().c_str());
    blue::CsoundLoader::unload();
    return 2;
  }

  blue::csound::CSOUND *csound = blue::CsoundLoader::csoundCreate(nullptr, nullptr);
  if (!csound) {
    std::fprintf(stderr, "Failed to create Csound instance\n");
    blue::CsoundLoader::unload();
    return 70;
  }

  blue::CsoundLoader::csoundCreateMessageBuffer(csound, 0);
  const auto onMessage = [](const std::string &message) {
    std::fwrite(message.data(), 1, message.size(), stderr);
    std::fflush(stderr);
  };
  int result = mode == OneShotMode::RUN_UTILITY
                   ? blue::CsoundRuntimeServices::runUtility(
                         csound, utilityName, arguments, onMessage)
                   : blue::CsoundRuntimeServices::runPerformance(
                         csound, arguments, onMessage);
  blue::CsoundLoader::csoundReset(csound);
  blue::CsoundLoader::csoundDestroyMessageBuffer(csound);
  blue::CsoundLoader::csoundDestroy(csound);
  blue::CsoundLoader::unload();
  return result == blue::csound::CSOUND_SUCCESS ? 0 : result;
}
}

void signalHandler(int sig) {
  (void)sig;
  if (g_handler) {
    g_handler->requestShutdown();
  }
}

void printUsage(const char *progname) {
  std::printf("Usage: %s [options]\n", progname);
  std::printf("Options:\n");
  std::printf("  --port <port>   ZMQ port to listen on (default: 5555)\n");
  std::printf("  --pub-port <port>  ZMQ PUB port for engine state events (default: port + 1)\n");
  std::printf("  --control-endpoint <endpoint>  ZMQ control endpoint (overrides --port)\n");
  std::printf("  --pub-endpoint <endpoint>  ZMQ PUB endpoint (overrides --pub-port)\n");
  std::printf("  --shm <name>    Shared memory name (default: blue-engine)\n");
  std::printf("  --disable-channel-mirroring  Disable shared-memory channel mirroring\n");
  std::printf("  --disable-shared-memory  Disable shared-memory subsystem entirely\n");
  std::printf("  --disable-thread-priority-elevation  Disable perform-thread priority elevation\n");
  std::printf("  --owner-pid <pid>  Owner process PID to monitor for lifetime\n");
  std::printf("  --probe-csound --json  Print one compatibility report and exit\n");
  std::printf("  --list-io --json  List Csound modules and selected devices\n");
  std::printf("  --run-utility <name> -- [args...]  Run a Csound utility\n");
  std::printf("  --run-csound -- [args...]  Run an offline Csound performance\n");
  std::printf("  --csound-library <absolute-path>  Select a specific Csound library\n");
  std::printf("  --audio-module <name>  Select an audio module for --list-io\n");
  std::printf("  --midi-module <name>  Select a MIDI module for --list-io\n");
  std::printf("  --help          Show this help message\n");
}

int main(int argc, char *argv[]) {
  int port = 5555;
  int pubPort = 5556;
  std::string shmName = "blue-engine";
  std::string controlEndpoint;
  std::string pubEndpoint;
  int64_t ownerPid = 0;
  bool channelMirroringEnabled = true;
  bool sharedMemoryEnabled = true;
  bool threadPriorityElevationEnabled = true;
  OneShotMode oneShotMode = OneShotMode::NONE;
  bool jsonOutput = false;
  std::string csoundLibraryPath;
  std::string utilityName;
  std::string audioModule;
  std::string midiModule;
  std::vector<std::string> oneShotArguments;
  bool argumentSeparator = false;

  // Parse arguments
  for (int i = 1; i < argc; i++) {
    if (std::strcmp(argv[i], "--") == 0) {
      argumentSeparator = true;
      continue;
    }
    if (argumentSeparator) {
      oneShotArguments.emplace_back(argv[i]);
      continue;
    }
    if (std::strcmp(argv[i], "--port") == 0 && i + 1 < argc) {
      port = std::atoi(argv[++i]);
      pubPort = port + 1;
    } else if (std::strcmp(argv[i], "--pub-port") == 0 && i + 1 < argc) {
      pubPort = std::atoi(argv[++i]);
    } else if (std::strcmp(argv[i], "--control-endpoint") == 0 && i + 1 < argc) {
      controlEndpoint = argv[++i];
    } else if (std::strcmp(argv[i], "--pub-endpoint") == 0 && i + 1 < argc) {
      pubEndpoint = argv[++i];
    } else if (std::strcmp(argv[i], "--shm") == 0 && i + 1 < argc) {
      shmName = argv[++i];
    } else if (std::strcmp(argv[i], "--owner-pid") == 0 && i + 1 < argc) {
      char *endptr = nullptr;
      ownerPid = std::strtoll(argv[++i], &endptr, 10);
      if (ownerPid <= 0 || *endptr != '\0') {
        std::fprintf(stderr, "Invalid --owner-pid value\n");
        return 64;
      }
    } else if (std::strcmp(argv[i], "--disable-channel-mirroring") == 0) {
      channelMirroringEnabled = false;
    } else if (std::strcmp(argv[i], "--disable-shared-memory") == 0) {
      sharedMemoryEnabled = false;
    } else if (std::strcmp(argv[i], "--disable-thread-priority-elevation") == 0) {
      threadPriorityElevationEnabled = false;
    } else if (std::strcmp(argv[i], "--probe-csound") == 0) {
      oneShotMode = OneShotMode::PROBE;
    } else if (std::strcmp(argv[i], "--list-io") == 0) {
      oneShotMode = OneShotMode::LIST_IO;
    } else if (std::strcmp(argv[i], "--run-utility") == 0 && i + 1 < argc) {
      oneShotMode = OneShotMode::RUN_UTILITY;
      utilityName = argv[++i];
    } else if (std::strcmp(argv[i], "--run-csound") == 0) {
      oneShotMode = OneShotMode::RUN_CSOUND;
    } else if (std::strcmp(argv[i], "--json") == 0) {
      jsonOutput = true;
    } else if (std::strcmp(argv[i], "--csound-library") == 0 &&
               i + 1 < argc) {
      csoundLibraryPath = argv[++i];
    } else if (std::strcmp(argv[i], "--audio-module") == 0 && i + 1 < argc) {
      audioModule = argv[++i];
    } else if (std::strcmp(argv[i], "--midi-module") == 0 && i + 1 < argc) {
      midiModule = argv[++i];
    } else if (std::strcmp(argv[i], "--help") == 0) {
      printUsage(argv[0]);
      return 0;
    } else {
      std::fprintf(stderr, "Unknown option: %s\n", argv[i]);
      printUsage(argv[0]);
      return 64;
    }
  }

  if (oneShotMode == OneShotMode::PROBE || oneShotMode == OneShotMode::LIST_IO) {
    if (!jsonOutput || (!csoundLibraryPath.empty() &&
                        !isAbsolutePath(csoundLibraryPath))) {
      std::fprintf(stderr,
                   "JSON Csound modes require --json and any --csound-library "
                   "value must be absolute\n");
      return 64;
    }
    if (oneShotMode == OneShotMode::PROBE &&
        (!audioModule.empty() || !midiModule.empty() || !oneShotArguments.empty())) {
      std::fprintf(stderr, "--probe-csound cannot select modules or arguments\n");
      return 64;
    }
    if (oneShotMode == OneShotMode::LIST_IO && !oneShotArguments.empty()) {
      std::fprintf(stderr, "--list-io does not accept arguments after --\n");
      return 64;
    }
    if (oneShotMode == OneShotMode::LIST_IO &&
        ((!audioModule.empty() && !isBoundedModuleName(audioModule)) ||
         (!midiModule.empty() && !isBoundedModuleName(midiModule)))) {
      std::fprintf(stderr, "Selected Csound module name is too long or invalid\n");
      return 64;
    }
    return runOneShot(oneShotMode, csoundLibraryPath, utilityName, audioModule,
                      midiModule, oneShotArguments);
  }

  if (oneShotMode == OneShotMode::RUN_UTILITY ||
      oneShotMode == OneShotMode::RUN_CSOUND) {
    if (jsonOutput || !audioModule.empty() || !midiModule.empty() ||
        (!csoundLibraryPath.empty() && !isAbsolutePath(csoundLibraryPath))) {
      std::fprintf(stderr,
                   "Execution modes reject --json/modules and require an "
                   "absolute --csound-library value\n");
      return 64;
    }
    if (oneShotMode == OneShotMode::RUN_UTILITY && utilityName.empty()) {
      std::fprintf(stderr, "--run-utility requires a utility name\n");
      return 64;
    }
    if (oneShotMode == OneShotMode::RUN_UTILITY &&
        (utilityName == "--" || !isBoundedModuleName(utilityName) || utilityName.find('/') != std::string::npos ||
         utilityName.find('\\') != std::string::npos)) {
      std::fprintf(stderr, "--run-utility name is invalid\n");
      return 64;
    }
    return runOneShot(oneShotMode, csoundLibraryPath, utilityName, audioModule,
                      midiModule, oneShotArguments);
  }

  if (jsonOutput || !csoundLibraryPath.empty() || !audioModule.empty() ||
      !midiModule.empty() || !oneShotArguments.empty()) {
    std::fprintf(stderr,
                 "--json and --csound-library are valid only with "
                 "--probe-csound\n");
    return 64;
  }

  if (controlEndpoint.empty() != pubEndpoint.empty()) {
    std::fprintf(stderr, "Both --control-endpoint and --pub-endpoint must be provided together.\n");
    printUsage(argv[0]);
    return 1;
  }

  // Load Csound library
  if (!blue::CsoundLoader::load()) {
    std::fprintf(stderr, "%s\n", blue::CsoundLoader::getError().c_str());
    return 1;
  }
  std::printf("Csound loaded from: %s\n",
              blue::CsoundLoader::getLoadedPath().c_str());

  // Setup signal handlers
  std::signal(SIGINT, signalHandler);
  std::signal(SIGTERM, signalHandler);

  // Create shared memory
  blue::SharedMemory shm;
  if (sharedMemoryEnabled) {
    if (!shm.create(shmName)) {
      std::fprintf(stderr, "Failed to create shared memory\n");
      return 1;
    }
    std::printf("Shared memory created: %s\n", shm.getName().c_str());
  } else {
    std::printf("Shared memory disabled (baseline mode).\n");
  }

  // Create engine and handler
  blue::CsoundEngine engine;
  engine.setThreadPriorityElevationEnabled(threadPriorityElevationEnabled);
  if (sharedMemoryEnabled && channelMirroringEnabled) {
    engine.setSharedMemory(&shm); // Connect shared-memory read mirror
  } else {
    std::printf("Channel mirroring disabled (baseline mode).\n");
  }
  blue::ZmqHandler handler(engine, shm);
  g_handler = &handler;

  // Validate and start owner monitoring before opening IPC endpoints. The
  // monitor owns no ZeroMQ socket, so its callback can safely request shutdown
  // from its watcher thread.
  blue::OwnerMonitor ownerMonitor;
  if (ownerPid > 0) {
    if (!ownerMonitor.start(ownerPid, [&handler]() {
          handler.requestShutdown();
        })) {
      std::fprintf(stderr, "Failed to start owner process monitor for PID %lld\n",
                   static_cast<long long>(ownerPid));
      return 1;
    }
    std::printf("Monitoring owner process PID: %lld\n",
                static_cast<long long>(ownerPid));
  }

  // Bind to port
  if (!controlEndpoint.empty()) {
    if (!handler.bind(controlEndpoint, pubEndpoint)) {
      return 1;
    }
  } else if (!handler.bind(port, pubPort)) {
    return 1;
  }

  // Main loop
  std::printf("blue-engine ready. Press Ctrl+C to quit.\n");
  while (handler.processOne()) {
    // Continue processing
  }

  ownerMonitor.stop();

  std::printf("blue-engine shutdown complete.\n");
  return 0;
}
