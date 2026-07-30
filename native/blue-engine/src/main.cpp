#include "csound/CsoundLoader.h"
#include "engine/CsoundEngine.h"
#include "ipc/SharedMemory.h"
#include "ipc/ZmqHandler.h"
#include "protocol/Capabilities.h"

#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <string>

namespace {
blue::ZmqHandler *g_handler = nullptr;
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
  std::printf("  --probe-csound --json  Print one compatibility report and exit\n");
  std::printf("  --csound-library <absolute-path>  Probe a specific Csound library\n");
  std::printf("  --help          Show this help message\n");
}

int main(int argc, char *argv[]) {
  int port = 5555;
  int pubPort = 5556;
  std::string shmName = "blue-engine";
  std::string controlEndpoint;
  std::string pubEndpoint;
  bool channelMirroringEnabled = true;
  bool sharedMemoryEnabled = true;
  bool threadPriorityElevationEnabled = true;
  bool probeCsound = false;
  bool jsonOutput = false;
  std::string csoundLibraryPath;

  // Parse arguments
  for (int i = 1; i < argc; i++) {
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
    } else if (std::strcmp(argv[i], "--disable-channel-mirroring") == 0) {
      channelMirroringEnabled = false;
    } else if (std::strcmp(argv[i], "--disable-shared-memory") == 0) {
      sharedMemoryEnabled = false;
    } else if (std::strcmp(argv[i], "--disable-thread-priority-elevation") == 0) {
      threadPriorityElevationEnabled = false;
    } else if (std::strcmp(argv[i], "--probe-csound") == 0) {
      probeCsound = true;
    } else if (std::strcmp(argv[i], "--json") == 0) {
      jsonOutput = true;
    } else if (std::strcmp(argv[i], "--csound-library") == 0 &&
               i + 1 < argc) {
      csoundLibraryPath = argv[++i];
    } else if (std::strcmp(argv[i], "--help") == 0) {
      printUsage(argv[0]);
      return 0;
    } else {
      std::fprintf(stderr, "Unknown option: %s\n", argv[i]);
      printUsage(argv[0]);
      return 64;
    }
  }

  if (probeCsound) {
    if (!jsonOutput ||
        (!csoundLibraryPath.empty() &&
         !std::filesystem::path(csoundLibraryPath).is_absolute())) {
      std::fprintf(stderr,
                   "--probe-csound requires --json and any --csound-library "
                   "value must be absolute\n");
      return 64;
    }
    blue::CsoundLoader::unload();
    const bool ready = blue::CsoundLoader::load(csoundLibraryPath);
    std::printf("%s\n",
                blue::csoundProbeJson(blue::CsoundLoader::getReport()).c_str());
    blue::CsoundLoader::unload();
    return ready ? 0 : 2;
  }

  if (jsonOutput || !csoundLibraryPath.empty()) {
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

  std::printf("blue-engine shutdown complete.\n");
  return 0;
}
