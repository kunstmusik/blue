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
         "\"automation-v1\",\"csound-probe-v1\"]}";
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

} // namespace blue
