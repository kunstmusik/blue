#pragma once

#include "CsoundTypes.h"

#include <functional>
#include <string>
#include <vector>

namespace blue {

struct CsoundModuleInfo {
  std::string name;
  std::string kind;
};

struct CsoundDeviceInfo {
  std::string kind;
  std::string direction;
  std::string module;
  std::string deviceId;
  std::string displayName;
  std::string interfaceName;
  int maxChannels = -1;
};

struct CsoundIoReport {
  std::string selectedAudioModule;
  std::string selectedMidiModule;
  std::vector<CsoundModuleInfo> audioModules;
  std::vector<CsoundModuleInfo> midiModules;
  std::vector<CsoundDeviceInfo> audioInputs;
  std::vector<CsoundDeviceInfo> audioOutputs;
  std::vector<CsoundDeviceInfo> midiInputs;
  std::vector<CsoundDeviceInfo> midiOutputs;
  std::vector<std::string> diagnostics;
};

using CsoundMessageCallback = std::function<void(const std::string &)>;

class CsoundRuntimeServices {
public:
  static bool queryIo(csound::CSOUND *csound,
                      const std::string &audioModule,
                      const std::string &midiModule,
                      CsoundIoReport &report,
                      std::string &error);

  static int runUtility(csound::CSOUND *csound,
                        const std::string &utilityName,
                        const std::vector<std::string> &arguments,
                        const CsoundMessageCallback &onMessage);

  static int runPerformance(csound::CSOUND *csound,
                            const std::vector<std::string> &arguments,
                            const CsoundMessageCallback &onMessage);

  static void drainMessages(csound::CSOUND *csound,
                            const CsoundMessageCallback &onMessage);

private:
  CsoundRuntimeServices() = delete;
};

} // namespace blue
