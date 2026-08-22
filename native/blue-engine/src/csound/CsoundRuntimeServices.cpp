#include "CsoundRuntimeServices.h"

#include "CsoundLoader.h"

#include <algorithm>
#include <cstring>
#include <utility>

namespace blue {
namespace {

constexpr int32_t kMaxReportedDevices = 4096;
constexpr size_t kMaxMessages = 8192;
constexpr size_t kMaxMessageBytes = 1024 * 1024;

std::string copyField(const char *value, size_t capacity) {
  if (!value || capacity == 0) {
    return {};
  }
  size_t length = 0;
  while (length < capacity && value[length] != '\0') {
    ++length;
  }
  return std::string(value, length);
}

bool hasModule(const std::vector<CsoundModuleInfo> &modules,
              const std::string &name) {
  return std::any_of(modules.begin(), modules.end(),
                     [&name](const CsoundModuleInfo &module) {
                       return module.name == name;
                     });
}

void appendDeviceUnique(std::vector<CsoundDeviceInfo> &devices,
                        CsoundDeviceInfo device) {
  const auto duplicate = std::find_if(
      devices.begin(), devices.end(), [&device](const CsoundDeviceInfo &item) {
        return item.kind == device.kind && item.direction == device.direction &&
               item.module == device.module && item.deviceId == device.deviceId;
      });
  if (duplicate == devices.end()) {
    devices.push_back(std::move(device));
  }
}

bool queryAudioDevices(csound::CSOUND *csound, const std::string &module,
                       int32_t isOutput, std::vector<CsoundDeviceInfo> &out,
                       std::string &error) {
  const int32_t count = CsoundLoader::csoundGetAudioDevList(csound, nullptr,
                                                             isOutput);
  if (count < 0) {
    error = "Csound audio device query failed for module " + module;
    return false;
  }
  if (count > kMaxReportedDevices) {
    error = "Csound audio device query returned an unreasonable device count for module " + module;
    return false;
  }
  if (count == 0) {
    return true;
  }

  std::vector<csound::CS_AUDIODEVICE> devices(static_cast<size_t>(count));
  const int32_t filled = CsoundLoader::csoundGetAudioDevList(
      csound, devices.data(), isOutput);
  if (filled < 0) {
    error = "Csound audio device query failed while reading module " + module;
    return false;
  }

  const int32_t safeCount = std::min(count, filled);
  for (int32_t index = 0; index < safeCount; ++index) {
    const auto &device = devices[static_cast<size_t>(index)];
    CsoundDeviceInfo info;
    info.kind = "audio";
    info.direction = isOutput ? "output" : "input";
    info.module = module;
    info.deviceId = copyField(device.device_id, sizeof(device.device_id));
    info.displayName = copyField(device.device_name, sizeof(device.device_name));
    info.maxChannels = device.max_nchnls;
    if (info.displayName.empty()) {
      info.displayName = info.deviceId;
    }
    appendDeviceUnique(out, std::move(info));
  }
  return true;
}

bool queryMidiDevices(csound::CSOUND *csound, const std::string &module,
                      int32_t isOutput, std::vector<CsoundDeviceInfo> &out,
                      std::string &error) {
  const int32_t count = CsoundLoader::csoundGetMIDIDevList(csound, nullptr,
                                                            isOutput);
  if (count < 0) {
    error = "Csound MIDI device query failed for module " + module;
    return false;
  }
  if (count > kMaxReportedDevices) {
    error = "Csound MIDI device query returned an unreasonable device count for module " + module;
    return false;
  }
  if (count == 0) {
    return true;
  }

  std::vector<csound::CS_MIDIDEVICE> devices(static_cast<size_t>(count));
  const int32_t filled = CsoundLoader::csoundGetMIDIDevList(
      csound, devices.data(), isOutput);
  if (filled < 0) {
    error = "Csound MIDI device query failed while reading module " + module;
    return false;
  }

  const int32_t safeCount = std::min(count, filled);
  for (int32_t index = 0; index < safeCount; ++index) {
    const auto &device = devices[static_cast<size_t>(index)];
    CsoundDeviceInfo info;
    info.kind = "midi";
    info.direction = isOutput ? "output" : "input";
    info.module = module;
    info.deviceId = copyField(device.device_id, sizeof(device.device_id));
    info.displayName = copyField(device.device_name, sizeof(device.device_name));
    info.interfaceName = copyField(device.interface_name,
                                   sizeof(device.interface_name));
    if (info.displayName.empty()) {
      info.displayName = info.deviceId;
    }
    appendDeviceUnique(out, std::move(info));
  }
  return true;
}

} // namespace

bool CsoundRuntimeServices::queryIo(csound::CSOUND *csound,
                                     const std::string &audioModule,
                                     const std::string &midiModule,
                                     CsoundIoReport &report,
                                     std::string &error) {
  if (!csound || !CsoundLoader::csoundGetModule ||
      !CsoundLoader::csoundGetAudioDevList ||
      !CsoundLoader::csoundGetMIDIDevList) {
    error = "Csound I/O discovery symbols are unavailable";
    return false;
  }

  report = CsoundIoReport{};
  report.selectedAudioModule = audioModule;
  report.selectedMidiModule = midiModule;

  for (int32_t index = 0;; ++index) {
    char *name = nullptr;
    char *type = nullptr;
    if (CsoundLoader::csoundGetModule(csound, index, &name, &type) !=
        csound::CSOUND_SUCCESS) {
      break;
    }
    const CsoundModuleInfo module{ name ? name : "", type ? type : "" };
    if (module.name.empty()) {
      continue;
    }
    if (module.kind == "audio" && !hasModule(report.audioModules, module.name)) {
      report.audioModules.push_back(module);
    } else if (module.kind == "midi" && !hasModule(report.midiModules, module.name)) {
      report.midiModules.push_back(module);
    }
  }

  if (!audioModule.empty()) {
    if (!hasModule(report.audioModules, audioModule)) {
      report.selectedAudioModule.clear();
      error = "Audio module is unavailable: " + audioModule;
      return false;
    }
    CsoundLoader::csoundSetRTAudioModule(csound, audioModule.c_str());
    if (!queryAudioDevices(csound, audioModule, 0, report.audioInputs, error) ||
        !queryAudioDevices(csound, audioModule, 1, report.audioOutputs, error)) {
      return false;
    }
  }

  if (!midiModule.empty()) {
    if (!hasModule(report.midiModules, midiModule)) {
      report.selectedMidiModule.clear();
      error = "MIDI module is unavailable: " + midiModule;
      return false;
    }
    CsoundLoader::csoundSetMIDIModule(csound, midiModule.c_str());
    if (!queryMidiDevices(csound, midiModule, 0, report.midiInputs, error) ||
        !queryMidiDevices(csound, midiModule, 1, report.midiOutputs, error)) {
      return false;
    }
  }

  return true;
}

void CsoundRuntimeServices::drainMessages(csound::CSOUND *csound,
                                           const CsoundMessageCallback &onMessage) {
  if (!csound || !CsoundLoader::csoundGetMessageCnt ||
      !CsoundLoader::csoundGetFirstMessage ||
      !CsoundLoader::csoundPopFirstMessage) {
    return;
  }
  size_t messageCount = 0;
  std::string batchedBuffer;
  batchedBuffer.reserve(4096);

  while (CsoundLoader::csoundGetMessageCnt(csound) > 0 &&
         messageCount < kMaxMessages) {
    const char *message = CsoundLoader::csoundGetFirstMessage(csound);
    const size_t len = message ? std::strlen(message) : 0;
    if (len > 0 && onMessage) {
      // Flush a bounded batch before appending the next message. This keeps
      // memory use bounded without dropping diagnostics from message-heavy
      // offline renders.
      if (batchedBuffer.size() + len > kMaxMessageBytes &&
          !batchedBuffer.empty()) {
        onMessage(batchedBuffer);
        batchedBuffer.clear();
      }
      batchedBuffer.append(message, len);
    }
    CsoundLoader::csoundPopFirstMessage(csound);
    ++messageCount;

    if (onMessage && batchedBuffer.size() >= 4096) {
      onMessage(batchedBuffer);
      batchedBuffer.clear();
    }
  }

  if (onMessage && !batchedBuffer.empty()) {
    onMessage(batchedBuffer);
  }
}

int CsoundRuntimeServices::runUtility(
    csound::CSOUND *csound, const std::string &utilityName,
    const std::vector<std::string> &arguments,
    const CsoundMessageCallback &onMessage) {
  if (!csound || !CsoundLoader::csoundRunUtility ||
      !CsoundLoader::csoundListUtilities ||
      !CsoundLoader::csoundDeleteUtilityList) {
    return csound::CSOUND_ERROR;
  }

  bool available = false;
  char **utilities = CsoundLoader::csoundListUtilities(csound);
  if (utilities) {
    for (char **utility = utilities; *utility; ++utility) {
      if (utilityName == *utility) {
        available = true;
        break;
      }
    }
    CsoundLoader::csoundDeleteUtilityList(csound, utilities);
  }
  if (!available) {
    if (onMessage) {
      onMessage("Csound utility is unavailable: " + utilityName + "\n");
    }
    return 65;
  }

  std::vector<std::string> argvStorage;
  argvStorage.reserve(arguments.size() + 1);
  argvStorage.push_back(utilityName);
  argvStorage.insert(argvStorage.end(), arguments.begin(), arguments.end());
  std::vector<char *> argv;
  argv.reserve(argvStorage.size());
  for (auto &argument : argvStorage) {
    argv.push_back(argument.data());
  }

  const int result = CsoundLoader::csoundRunUtility(
      csound, utilityName.c_str(), static_cast<int32_t>(argv.size()), argv.data());
  while (CsoundLoader::csoundGetMessageCnt &&
         CsoundLoader::csoundGetMessageCnt(csound) > 0) {
    drainMessages(csound, onMessage);
  }
  return result;
}

int CsoundRuntimeServices::runPerformance(
    csound::CSOUND *csound, const std::vector<std::string> &arguments,
    const CsoundMessageCallback &onMessage) {
  if (!csound || !CsoundLoader::csoundCompile || !CsoundLoader::csoundStart ||
      !CsoundLoader::csoundPerformKsmps) {
    return csound::CSOUND_ERROR;
  }

  std::vector<std::string> argvStorage;
  argvStorage.reserve(arguments.size() + 1);
  argvStorage.push_back("csound");
  argvStorage.insert(argvStorage.end(), arguments.begin(), arguments.end());
  std::vector<const char *> argv;
  argv.reserve(argvStorage.size());
  for (const auto &argument : argvStorage) {
    argv.push_back(argument.c_str());
  }

  int result = CsoundLoader::csoundCompile(
      csound, static_cast<int32_t>(argv.size()), argv.data());
  while (CsoundLoader::csoundGetMessageCnt &&
         CsoundLoader::csoundGetMessageCnt(csound) > 0) {
    drainMessages(csound, onMessage);
  }
  if (result != csound::CSOUND_SUCCESS) {
    return result;
  }
  result = CsoundLoader::csoundStart(csound);
  while (CsoundLoader::csoundGetMessageCnt &&
         CsoundLoader::csoundGetMessageCnt(csound) > 0) {
    drainMessages(csound, onMessage);
  }
  if (result != csound::CSOUND_SUCCESS) {
    return result;
  }

  size_t kcycle = 0;
  while ((result = CsoundLoader::csoundPerformKsmps(csound)) == 0) {
    if ((++kcycle & 127) == 0 && CsoundLoader::csoundGetMessageCnt &&
        CsoundLoader::csoundGetMessageCnt(csound) > 0) {
      drainMessages(csound, onMessage);
    }
  }
  while (CsoundLoader::csoundGetMessageCnt &&
         CsoundLoader::csoundGetMessageCnt(csound) > 0) {
    drainMessages(csound, onMessage);
  }
  return result > 0 ? csound::CSOUND_SUCCESS : result;
}

} // namespace blue
