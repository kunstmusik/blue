#include "protocol/Capabilities.h"
#include "protocol/Protocol.h"

#include <cassert>
#include <cstring>
#include <iostream>
#include <string>

int main() {
  static_assert(static_cast<uint8_t>(blue::Command::GET_CAPABILITIES) == 0x09);
  assert(blue::BLUE_ENGINE_PROTOCOL_VERSION == 2);

  const std::string json = blue::engineCapabilitiesJson();
  assert(json.find("\"schemaVersion\":1") != std::string::npos);
  assert(json.find("\"protocolVersion\":2") != std::string::npos);
  assert(json.find("\"engine-state-v1\"") != std::string::npos);
  assert(json.find("\"channel-bridge-v1\"") != std::string::npos);
  assert(json.find("\"automation-v1\"") != std::string::npos);
  assert(json.find(blue::BLUE_ENGINE_AUTOMATION_DECIMAL_FEATURE) != std::string::npos);
  assert(json.find(blue::BLUE_ENGINE_OWNER_LIVENESS_FEATURE) != std::string::npos);
  assert(json.find("\"csound-probe-v1\"") != std::string::npos);
  assert(json.find("\"csound-io-v1\"") != std::string::npos);
  assert(json.find("\"csound-utility-v1\"") != std::string::npos);
  assert(json.find("\"csound-performance-v1\"") != std::string::npos);

  blue::CsoundLoadReport loadReport;
  loadReport.status = blue::CsoundLoadStatus::READY;
  loadReport.versionRaw = 7000;
  loadReport.message = "ready";
  blue::CsoundIoReport ioReport;
  ioReport.audioModules.push_back({"module\"name", "audio"});
  ioReport.audioOutputs.push_back({"audio", "output", "module\"name",
                                   "device", "display\nname", "", 2});
  const std::string ioJson = blue::csoundIoJson(loadReport, ioReport, true, "");
  assert(ioJson.find("module\\\"name") != std::string::npos);
  assert(ioJson.find("display\\nname") != std::string::npos);

  const auto response = blue::Response::ok(json).serialize();
  assert(response.front() == static_cast<uint8_t>(blue::Status::OK));
  uint32_t payloadLength = 0;
  std::memcpy(&payloadLength, response.data() + 1, sizeof(payloadLength));
  assert(payloadLength == json.size());
  assert(response.size() == 5 + json.size());

  std::cout << "Engine capability tests passed\n";
  return 0;
}
