#pragma once

#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace blue {

// Command codes
enum class Command : uint8_t {
    CREATE_ENGINE   = 0x01,
    COMPILE_ORC     = 0x02,
    READ_SCORE      = 0x03,
    SET_OPTION      = 0x04,
    START           = 0x05,
    STOP            = 0x06,
    DESTROY_ENGINE  = 0x07,
    GET_ENGINE_STATE = 0x08,
    GET_CAPABILITIES = 0x09,

    // Channel commands (native Csound control channels mirrored to shared memory)
    SET_CHANNEL     = 0x10,  // payload: name\0 + double value (8 bytes)
    GET_CHANNEL     = 0x11,  // payload: name\0, response: double value
    CREATE_CHANNEL  = 0x12,  // payload: name\0 + double initial (8 bytes)
    GET_SHM_NAME    = 0x13,  // no payload, response: shm name string

    // Automation commands
    CREATE_AUTOMATION  = 0x20,  // payload: channel_name\0 + curve(1B) + enabled(1B) + resolution(8B) + resolutionScale(4B) + highPrecision(1B) + n_points(4B) + points
    UPDATE_AUTOMATION  = 0x21,  // payload: same as CREATE_AUTOMATION
    DELETE_AUTOMATION  = 0x22,  // payload: channel_name\0
    ENABLE_AUTOMATION  = 0x23,  // payload: channel_name\0
    DISABLE_AUTOMATION = 0x24,  // payload: channel_name\0
    LIST_AUTOMATIONS   = 0x25,  // no payload, response: count(4B) + entries
    CLEAR_AUTOMATIONS  = 0x26,  // no payload
};

/*
 * Automation payload format details:
 *
 * CREATE_AUTOMATION and UPDATE_AUTOMATION:
 * - channel_name: null-terminated string
 * - curve: 1 byte (AutomationCurve enum value)
 * - enabled: 1 byte (0 = disabled, non-zero = enabled)
 * - resolution: 8-byte double (quantization step size, 0.0 = no quantization)
 * - resolutionScale: 4-byte int32_t (decimal scale for resolution, e.g., 1 for 0.1, 2 for 0.01)
 * - highPrecision: 1 byte (0 = fast double path, non-zero = BigDecimal-compatible path)
 * - n_points: 4-byte uint32_t (number of automation points)
 * - points: array of (time, value) pairs, each 16 bytes (2 doubles)
 */

// Response status codes
enum class Status : uint8_t {
    OK    = 0x00,
    ERROR = 0x01,
};

// Request message structure
struct Request {
    Command command;
    std::string payload;

    // Parse from raw bytes
    static bool parse(const uint8_t* data, size_t size, Request& req) {
        if (size < 5) return false;  // minimum: 1 byte cmd + 4 bytes len

        req.command = static_cast<Command>(data[0]);

        uint32_t payloadLen;
        std::memcpy(&payloadLen, data + 1, sizeof(payloadLen));

        if (size < 5 + payloadLen) return false;

        req.payload.assign(reinterpret_cast<const char*>(data + 5), payloadLen);
        return true;
    }
};

// Response message structure
struct Response {
    Status status;
    std::string payload;

    // Serialize to bytes
    std::vector<uint8_t> serialize() const {
        std::vector<uint8_t> data;
        data.reserve(5 + payload.size());

        data.push_back(static_cast<uint8_t>(status));

        uint32_t payloadLen = static_cast<uint32_t>(payload.size());
        data.insert(data.end(),
                    reinterpret_cast<uint8_t*>(&payloadLen),
                    reinterpret_cast<uint8_t*>(&payloadLen) + sizeof(payloadLen));

        data.insert(data.end(), payload.begin(), payload.end());
        return data;
    }

    // Convenience constructors
    static Response ok(const std::string& msg = "") {
        return Response{Status::OK, msg};
    }

    static Response error(const std::string& msg) {
        return Response{Status::ERROR, msg};
    }
};

constexpr const char* ENGINE_STATE_TOPIC = "engine.state";

}  // namespace blue
