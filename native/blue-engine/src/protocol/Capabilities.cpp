#include "Capabilities.h"

#include <string>
#include <vector>

#ifndef BLUE_ENGINE_SOURCE_REVISION
#define BLUE_ENGINE_SOURCE_REVISION "unknown"
#endif

namespace blue {
namespace {

std::string escapeJson(const std::string &value) {
  std::string escaped;
  escaped.reserve(value.size());
  for (const char character : value) {
    switch (character) {
    case '\\':
      escaped += "\\\\";
      break;
    case '"':
      escaped += "\\\"";
      break;
    case '\n':
      escaped += "\\n";
      break;
    case '\r':
      escaped += "\\r";
      break;
    case '\t':
      escaped += "\\t";
      break;
    default:
      if (static_cast<unsigned char>(character) < 0x20) {
        static constexpr char hex[] = "0123456789abcdef";
        escaped += "\\u00";
        escaped += hex[(static_cast<unsigned char>(character) >> 4) & 0x0f];
        escaped += hex[static_cast<unsigned char>(character) & 0x0f];
        break;
      }
      escaped += character;
      break;
    }
  }
  return escaped;
}

std::string nullableString(const std::string &value) {
  return value.empty() ? "null" : "\"" + escapeJson(value) + "\"";
}

std::string stringArray(const std::vector<std::string> &values) {
  std::string json = "[";
  for (size_t index = 0; index < values.size(); ++index) {
    if (index > 0) {
      json += ",";
    }
    json += "\"" + escapeJson(values[index]) + "\"";
  }
  return json + "]";
}

std::string integerArray(const std::vector<int> &values) {
  std::string json = "[";
  for (size_t index = 0; index < values.size(); ++index) {
    if (index > 0) {
      json += ",";
    }
    json += std::to_string(values[index]);
  }
  return json + "]";
}

std::string moduleArray(const std::vector<CsoundModuleInfo> &values) {
  std::string json = "[";
  for (size_t index = 0; index < values.size(); ++index) {
    if (index > 0) {
      json += ",";
    }
    json += "{\"name\":\"" + escapeJson(values[index].name) +
            "\",\"kind\":\"" + escapeJson(values[index].kind) + "\"}";
  }
  return json + "]";
}

std::string deviceArray(const std::vector<CsoundDeviceInfo> &values) {
  std::string json = "[";
  for (size_t index = 0; index < values.size(); ++index) {
    if (index > 0) {
      json += ",";
    }
    const auto &device = values[index];
    json += "{\"kind\":\"" + escapeJson(device.kind) +
            "\",\"direction\":\"" + escapeJson(device.direction) +
            "\",\"module\":\"" + escapeJson(device.module) +
            "\",\"deviceId\":\"" + escapeJson(device.deviceId) +
            "\",\"displayName\":\"" + escapeJson(device.displayName) +
            "\",\"interfaceName\":" + nullableString(device.interfaceName) +
            ",\"maxChannels\":" +
            (device.maxChannels < 0 ? "null" : std::to_string(device.maxChannels)) +
            "}";
  }
  return json + "]";
}

std::string diagnosticsArray(const CsoundIoReport &report,
                             const std::string &error) {
  std::string json = "[";
  bool first = true;
  for (const auto &diagnostic : report.diagnostics) {
    if (!first) {
      json += ",";
    }
    first = false;
    json += "\"" + escapeJson(diagnostic) + "\"";
  }
  if (!error.empty()) {
    if (!first) {
      json += ",";
    }
    json += "\"" + escapeJson(error) + "\"";
  }
  return json + "]";
}

std::string versionNumberOrNull(int value, bool hasVersion) {
  return hasVersion ? std::to_string(value) : "null";
}

} // namespace

std::string engineCapabilitiesJson() {
  return "{\"schemaVersion\":1,\"engineVersion\":\"0.1.0\","
         "\"protocolVersion\":" +
         std::to_string(BLUE_ENGINE_PROTOCOL_VERSION) +
         ",\"sourceRevision\":\"" + escapeJson(BLUE_ENGINE_SOURCE_REVISION) +
         "\",\"features\":[\"engine-state-v1\",\"channel-bridge-v1\","
         "\"automation-v1\",\"csound-probe-v1\",\"csound-io-v1\","
         "\"csound-utility-v1\",\"csound-performance-v1\"]}";
}

std::string csoundProbeJson(const CsoundLoadReport &report) {
  const bool hasVersion = report.versionRaw != 0;
  std::string json =
      "{\"schemaVersion\":1,\"engine\":" + engineCapabilitiesJson() +
      ",\"csound\":{";
  json += "\"status\":\"";
  json += CsoundLoader::statusName(report.status);
  json += "\",\"requestedPath\":" + nullableString(report.requestedPath);
  json += ",\"loadedPath\":" + nullableString(report.loadedPath);
  json += ",\"versionRaw\":" +
          versionNumberOrNull(report.versionRaw, hasVersion);
  json += ",\"major\":" + versionNumberOrNull(report.major, hasVersion);
  json += ",\"minor\":" + versionNumberOrNull(report.minor, hasVersion);
  json += ",\"patch\":" + versionNumberOrNull(report.patch, hasVersion);
  json += ",\"supportedMajors\":" + integerArray(report.supportedMajors);
  json += ",\"missingSymbols\":" + stringArray(report.missingSymbols);
  json += ",\"message\":\"" + escapeJson(report.message) + "\"}";
  json += ",\"ready\":";
  json += report.ready() ? "true" : "false";
  return json + "}";
}

std::string csoundIoJson(const CsoundLoadReport &report,
                         const CsoundIoReport &ioReport, bool ready,
                         const std::string &error) {
  const bool hasVersion = report.versionRaw != 0;
  std::string json =
      "{\"schemaVersion\":1,\"engine\":" + engineCapabilitiesJson() +
      ",\"csound\":{";
  json += "\"status\":\"" + std::string(CsoundLoader::statusName(report.status)) +
          "\",\"requestedPath\":" + nullableString(report.requestedPath);
  json += ",\"loadedPath\":" + nullableString(report.loadedPath);
  json += ",\"versionRaw\":" +
          versionNumberOrNull(report.versionRaw, hasVersion);
  json += ",\"major\":" + versionNumberOrNull(report.major, hasVersion);
  json += ",\"minor\":" + versionNumberOrNull(report.minor, hasVersion);
  json += ",\"patch\":" + versionNumberOrNull(report.patch, hasVersion);
  json += ",\"supportedMajors\":" + integerArray(report.supportedMajors);
  json += ",\"missingSymbols\":" + stringArray(report.missingSymbols);
  json += ",\"message\":\"" + escapeJson(report.message) + "\"}";
  json += ",\"selectedAudioModule\":" +
          nullableString(ioReport.selectedAudioModule);
  json += ",\"selectedMidiModule\":" +
          nullableString(ioReport.selectedMidiModule);
  json += ",\"audioModules\":" + moduleArray(ioReport.audioModules);
  json += ",\"midiModules\":" + moduleArray(ioReport.midiModules);
  json += ",\"audioInputs\":" + deviceArray(ioReport.audioInputs);
  json += ",\"audioOutputs\":" + deviceArray(ioReport.audioOutputs);
  json += ",\"midiInputs\":" + deviceArray(ioReport.midiInputs);
  json += ",\"midiOutputs\":" + deviceArray(ioReport.midiOutputs);
  json += ",\"diagnostics\":" + diagnosticsArray(ioReport, error);
  json += ",\"ready\":" + std::string(ready ? "true" : "false");
  return json + "}";
}

} // namespace blue
