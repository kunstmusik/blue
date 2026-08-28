#pragma once

#include "../csound/CsoundLoader.h"
#include "../csound/CsoundRuntimeServices.h"

#include <string>

namespace blue {

// Protocol version 2: the automation create/update payload carries the
// authoritative Java-canonical decimal resolution text (see Protocol.h).
// The app, engine client, and bundled engine change atomically; version 2 is
// an incompatible schema marker so a mixed pairing fails the handshake.
constexpr int BLUE_ENGINE_PROTOCOL_VERSION = 2;
constexpr int BLUE_ENGINE_CAPABILITIES_SCHEMA_VERSION = 1;
constexpr const char* BLUE_ENGINE_AUTOMATION_DECIMAL_FEATURE = "automation-decimal-v1";
constexpr const char* BLUE_ENGINE_OWNER_LIVENESS_FEATURE = "owner-liveness-v1";
// Batch channel set/get commands (Protocol.h BATCH_SET/BATCH_GET_CHANNELS).
constexpr const char* BLUE_ENGINE_BATCH_CHANNELS_FEATURE = "batch-channels-v1";

std::string engineCapabilitiesJson();
std::string csoundProbeJson(const CsoundLoadReport &report);
std::string csoundIoJson(const CsoundLoadReport &loadReport,
                         const CsoundIoReport &ioReport,
                         bool ready,
                         const std::string &error = "");

} // namespace blue
