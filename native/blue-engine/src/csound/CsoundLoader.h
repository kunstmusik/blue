#pragma once

#include "CsoundTypes.h"
#include <string>
#include <vector>

// ============================================================================
// Csound Dynamic Loader
// Loads Csound library at runtime using dlopen/LoadLibrary.
// Checks LIBCSOUND_PATH env var first, then platform-specific default paths.
// ============================================================================

namespace blue {

enum class CsoundLoadStatus {
  READY,
  NOT_FOUND,
  LOAD_FAILED,
  MISSING_SYMBOLS,
  UNSUPPORTED_VERSION,
  INTERNAL_ERROR,
};

struct CsoundLoadReport {
  CsoundLoadStatus status = CsoundLoadStatus::NOT_FOUND;
  std::string requestedPath;
  std::string loadedPath;
  int versionRaw = 0;
  int major = 0;
  int minor = 0;
  int patch = 0;
  std::vector<int> supportedMajors{7};
  std::vector<std::string> missingSymbols;
  std::string message;

  bool ready() const { return status == CsoundLoadStatus::READY; }
};

class CsoundLoader {
public:
  // Load Csound library. Returns true on success.
  // Safe to call multiple times - subsequent calls return cached result.
  static bool load(const std::string &explicitPath = "");
  static bool initialize();

  static const CsoundLoadReport &getReport();
  static std::vector<std::string>
  candidatePaths(const std::string &explicitPath = "",
                 const std::string &environmentPath = "");
  static std::vector<std::string>
  platformCandidatePaths(const std::string &platform,
                         const std::string &homeDirectory = "",
                         const std::string &programFilesDirectory = "");
  static bool isSupportedVersion(int versionRaw);
  static const char *statusName(CsoundLoadStatus status);

  // Check if library is loaded
  static bool isLoaded();

  // Get error message if load() failed
  static const std::string &getError();

  // Get path of loaded library (empty if not loaded)
  static const std::string &getLoadedPath();

  // Unload the library (mainly for testing)
  static void unload();

  // ========================================================================
  // Function pointers - populated by load()
  // Use these instead of direct Csound function calls
  // ========================================================================

  // Core lifecycle
  static csound::csoundGetVersion_t csoundGetVersion;
  static csound::csoundInitialize_t csoundInitialize;
  static csound::csoundCreate_t csoundCreate;
  static csound::csoundDestroy_t csoundDestroy;
  static csound::csoundReset_t csoundReset;

  // Configuration
  static csound::csoundSetOption_t csoundSetOption;

  // Compilation and performance
  static csound::csoundCompileOrc_t csoundCompileOrc;
  static csound::csoundCompile_t csoundCompile;
  static csound::csoundStart_t csoundStart;
  static csound::csoundPerformKsmps_t csoundPerformKsmps;
  static csound::csoundEventString_t csoundEventString;

  // Runtime modules, devices, utilities, and messages
  static csound::csoundGetModule_t csoundGetModule;
  static csound::csoundSetRTAudioModule_t csoundSetRTAudioModule;
  static csound::csoundSetMIDIModule_t csoundSetMIDIModule;
  static csound::csoundGetAudioDevList_t csoundGetAudioDevList;
  static csound::csoundGetMIDIDevList_t csoundGetMIDIDevList;
  static csound::csoundRunUtility_t csoundRunUtility;
  static csound::csoundListUtilities_t csoundListUtilities;
  static csound::csoundDeleteUtilityList_t csoundDeleteUtilityList;
  static csound::csoundCreateMessageBuffer_t csoundCreateMessageBuffer;
  static csound::csoundGetFirstMessage_t csoundGetFirstMessage;
  static csound::csoundPopFirstMessage_t csoundPopFirstMessage;
  static csound::csoundGetMessageCnt_t csoundGetMessageCnt;
  static csound::csoundDestroyMessageBuffer_t csoundDestroyMessageBuffer;

  // Audio parameters
  static csound::csoundGetSr_t csoundGetSr;
  static csound::csoundGetKsmps_t csoundGetKsmps;

  // Channel access
  static csound::csoundGetChannelPtr_t csoundGetChannelPtr;
  static csound::csoundListChannels_t csoundListChannels;
  static csound::csoundDeleteChannelList_t csoundDeleteChannelList;
  static csound::csoundGetControlChannel_t csoundGetControlChannel;
  static csound::csoundSetControlChannel_t csoundSetControlChannel;

private:
  CsoundLoader() = delete; // Static-only class
};

} // namespace blue
