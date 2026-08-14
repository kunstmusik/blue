#include "csound/CsoundLoader.h"
#include "csound/CsoundRuntimeServices.h"

#include <cassert>
#include <cstring>
#include <deque>
#include <iostream>

namespace {

char audioName[] = "Fake output";
char audioId[] = "fake-out";
char audioModule[] = "fake-audio";
char midiName[] = "Fake MIDI";
char midiInterface[] = "Fake interface";
char midiId[] = "fake-midi";
char midiModule[] = "fake-midi-module";
char moduleAudioName[] = "fake-audio";
char moduleAudioType[] = "audio";
char moduleMidiName[] = "fake-midi-module";
char moduleMidiType[] = "midi";
char utilityName[] = "sndinfo";
char *utilities[] = {utilityName, nullptr};
std::string message;
std::deque<std::string> messageQueue;
int performCalls = 0;
int audioCountOverride = 0;
int midiCountOverride = 0;
int utilityResultOverride = 0;

int32_t getModule(blue::csound::CSOUND *, int32_t index, char **name,
                  char **type) {
  if (index == 0) {
    *name = moduleAudioName;
    *type = moduleAudioType;
    return 0;
  }
  if (index == 1) {
    *name = moduleMidiName;
    *type = moduleMidiType;
    return 0;
  }
  return -1;
}

void setAudioModule(blue::csound::CSOUND *, const char *) {}
void setMidiModule(blue::csound::CSOUND *, const char *) {}

int32_t getAudioDevices(blue::csound::CSOUND *,
                        blue::csound::CS_AUDIODEVICE *list,
                        int32_t isOutput) {
  if (audioCountOverride != 0) return audioCountOverride;
  if (!isOutput) {
    return 0;
  }
  if (!list) {
    return 2;
  }
  std::strncpy(list[0].device_name, audioName,
               sizeof(list[0].device_name) - 1);
  std::strncpy(list[0].device_id, audioId,
               sizeof(list[0].device_id) - 1);
  std::strncpy(list[0].rt_module, audioModule,
               sizeof(list[0].rt_module) - 1);
  list[0].max_nchnls = 2;
  list[0].isOutput = 1;
  list[1] = list[0];
  return 2;
}

int32_t getMidiDevices(blue::csound::CSOUND *,
                       blue::csound::CS_MIDIDEVICE *list,
                       int32_t isOutput) {
  if (midiCountOverride != 0) return midiCountOverride;
  if (!isOutput) {
    return 0;
  }
  if (!list) {
    return 1;
  }
  std::strncpy(list[0].device_name, midiName,
               sizeof(list[0].device_name) - 1);
  std::strncpy(list[0].interface_name, midiInterface,
               sizeof(list[0].interface_name) - 1);
  std::strncpy(list[0].device_id, midiId,
               sizeof(list[0].device_id) - 1);
  std::strncpy(list[0].midi_module, midiModule,
               sizeof(list[0].midi_module) - 1);
  list[0].isOutput = 1;
  return 1;
}

char **listUtilities(blue::csound::CSOUND *) { return utilities; }
void deleteUtilityList(blue::csound::CSOUND *, char **) {}

int32_t runUtility(blue::csound::CSOUND *, const char *, int32_t argc,
                   char **) {
  assert(argc == 2);
  message = "utility message\n";
  return utilityResultOverride;
}

void createMessageBuffer(blue::csound::CSOUND *, int32_t) {}
const char *firstMessage(blue::csound::CSOUND *) {
  if (!messageQueue.empty()) {
    return messageQueue.front().c_str();
  }
  return message.empty() ? "" : message.c_str();
}
void popMessage(blue::csound::CSOUND *) {
  if (!messageQueue.empty()) {
    messageQueue.pop_front();
  } else {
    message.clear();
  }
}
int32_t messageCount(blue::csound::CSOUND *) {
  if (!messageQueue.empty()) {
    return static_cast<int32_t>(messageQueue.size());
  }
  return message.empty() ? 0 : 1;
}
void destroyMessageBuffer(blue::csound::CSOUND *) {}

int32_t compile(blue::csound::CSOUND *, int32_t argc, const char **argv) {
  assert(argc == 2);
  assert(std::strcmp(argv[0], "csound") == 0);
  message = "compile message\n";
  return 0;
}
int start(blue::csound::CSOUND *) { return 0; }
int perform(blue::csound::CSOUND *) {
  message = "perform message\n";
  return performCalls++ == 0 ? 0 : 1;
}

void installFakeSymbols() {
  blue::CsoundLoader::csoundGetModule = getModule;
  blue::CsoundLoader::csoundSetRTAudioModule = setAudioModule;
  blue::CsoundLoader::csoundSetMIDIModule = setMidiModule;
  blue::CsoundLoader::csoundGetAudioDevList = getAudioDevices;
  blue::CsoundLoader::csoundGetMIDIDevList = getMidiDevices;
  blue::CsoundLoader::csoundListUtilities = listUtilities;
  blue::CsoundLoader::csoundDeleteUtilityList = deleteUtilityList;
  blue::CsoundLoader::csoundRunUtility = runUtility;
  blue::CsoundLoader::csoundCreateMessageBuffer = createMessageBuffer;
  blue::CsoundLoader::csoundGetFirstMessage = firstMessage;
  blue::CsoundLoader::csoundPopFirstMessage = popMessage;
  blue::CsoundLoader::csoundGetMessageCnt = messageCount;
  blue::CsoundLoader::csoundDestroyMessageBuffer = destroyMessageBuffer;
  blue::CsoundLoader::csoundCompile = compile;
  blue::CsoundLoader::csoundStart = start;
  blue::CsoundLoader::csoundPerformKsmps = perform;
}

} // namespace

int main() {
  installFakeSymbols();
  auto *csound = reinterpret_cast<blue::csound::CSOUND *>(0x1);

  blue::CsoundIoReport report;
  std::string error;
  assert(blue::CsoundRuntimeServices::queryIo(
      csound, "fake-audio", "fake-midi-module", report, error));
  assert(error.empty());
  assert(report.audioModules.size() == 1);
  assert(report.midiModules.size() == 1);
  assert(report.audioInputs.empty());
  assert(report.audioOutputs.size() == 1);
  assert(report.audioOutputs.front().deviceId == "fake-out");
  assert(report.midiOutputs.size() == 1);
  assert(report.midiOutputs.front().interfaceName == "Fake interface");

  audioCountOverride = -1;
  assert(!blue::CsoundRuntimeServices::queryIo(
      csound, "fake-audio", "", report, error));
  assert(error.find("audio device query failed") != std::string::npos);
  audioCountOverride = 0;
  midiCountOverride = -1;
  assert(!blue::CsoundRuntimeServices::queryIo(
      csound, "", "fake-midi-module", report, error));
  assert(error.find("MIDI device query failed") != std::string::npos);
  midiCountOverride = 0;

  assert(!blue::CsoundRuntimeServices::queryIo(
      csound, "missing", "", report, error));
  assert(error.find("unavailable") != std::string::npos);

  std::string output;
  assert(blue::CsoundRuntimeServices::runUtility(
             csound, "sndinfo", {"fixture.aif"},
             [&output](const std::string &value) { output += value; }) == 0);
  assert(output == "utility message\n");

  output.clear();
  utilityResultOverride = 1;
  assert(blue::CsoundRuntimeServices::runUtility(
             csound, "sndinfo", {"fixture.aif"},
             [&output](const std::string &value) { output += value; }) == 1);
  utilityResultOverride = 0;

  output.clear();
  assert(blue::CsoundRuntimeServices::runUtility(
             csound, "missing-utility", {},
             [&output](const std::string &value) { output += value; }) == 65);
  assert(output.find("unavailable") != std::string::npos);

  output.clear();
  performCalls = 0;
  assert(blue::CsoundRuntimeServices::runPerformance(
             csound, {"fixture.csd"},
             [&output](const std::string &value) { output += value; }) == 0);
  assert(output.find("compile message") != std::string::npos);
  assert(output.find("perform message") != std::string::npos);

  // Offline renders can produce far more than one k-cycle's worth of
  // diagnostics. Verify that the batched drain keeps every line instead of
  // truncating at the old per-call safety limit.
  output.clear();
  messageQueue.assign(100000, "bulk message\n");
  performCalls = 0;
  assert(blue::CsoundRuntimeServices::runPerformance(
             csound, {"fixture.csd"},
             [&output](const std::string &value) { output += value; }) == 0);
  size_t bulkLines = 0;
  for (size_t position = 0;
       (position = output.find("bulk message\n", position)) != std::string::npos;
       position += std::strlen("bulk message\n")) {
    ++bulkLines;
  }
  assert(bulkLines == 100000);

  // Test batched multi-message draining
  output.clear();
  messageQueue = {"line 1\n", "line 2\n", "line 3\n"};
  blue::CsoundRuntimeServices::drainMessages(
      csound, [&output](const std::string &value) { output += value; });
  assert(output == "line 1\nline 2\nline 3\n");

  // A caller may intentionally suppress diagnostics, but the Csound queue
  // must still be consumed so message-heavy offline work cannot retain an
  // unbounded backlog.
  messageQueue = {"discarded 1\n", "discarded 2\n"};
  blue::CsoundRuntimeServices::drainMessages(csound, {});
  assert(messageQueue.empty());

  std::cout << "Csound runtime service tests passed\n";
  return 0;
}
