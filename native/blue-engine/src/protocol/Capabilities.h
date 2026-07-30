#pragma once

#include "../csound/CsoundLoader.h"

#include <string>

namespace blue {

constexpr int BLUE_ENGINE_PROTOCOL_VERSION = 1;
constexpr int BLUE_ENGINE_CAPABILITIES_SCHEMA_VERSION = 1;

std::string engineCapabilitiesJson();
std::string csoundProbeJson(const CsoundLoadReport &report);

} // namespace blue
