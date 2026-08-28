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

    // Batch channel commands (feature batch-channels-v1). Allocated from the
    // channel range without changing existing values.
    // SET payload: count(u16) + per entry: nameLength(u16) + name(utf8) + value(f64)
    // GET payload: count(u16) + per entry: nameLength(u16) + name(utf8)
    // GET success response payload: count(u16) + values in request order
    BATCH_SET_CHANNELS = 0x14,
    BATCH_GET_CHANNELS = 0x15,

    // Automation commands (protocol version 2: exact decimal resolution)
    CREATE_AUTOMATION  = 0x20,  // payload: channel_name\0 + curve(1B) + enabled(1B) + resolutionLength(4B) + resolution(canonical ASCII) + n_points(4B) + points
    UPDATE_AUTOMATION  = 0x21,  // payload: same as CREATE_AUTOMATION
    DELETE_AUTOMATION  = 0x22,  // payload: channel_name\0
    ENABLE_AUTOMATION  = 0x23,  // payload: channel_name\0
    DISABLE_AUTOMATION = 0x24,  // payload: channel_name\0
    LIST_AUTOMATIONS   = 0x25,  // no payload, response: count(4B) + entries
    CLEAR_AUTOMATIONS  = 0x26,  // no payload
};

/*
 * Automation payload format details (protocol version 2):
 *
 * CREATE_AUTOMATION and UPDATE_AUTOMATION:
 * - channel_name: null-terminated string
 * - curve: 1 byte (AutomationCurve enum value)
 * - enabled: 1 byte (0 = disabled, 1 = enabled; no other values)
 * - resolutionLength: 4-byte uint32 little-endian (ASCII byte count)
 * - resolution: resolutionLength ASCII bytes of the authoritative
 *   Java-canonical decimal text (exact-decimal-resolution contract); there
 *   are no resolution-double, scale, or precision-mode fields
 * - n_points: 4-byte uint32 little-endian
 * - points: array of (time, value) pairs, each 16 bytes (2 doubles LE)
 *
 * Version 2 is an incompatible schema marker: the app, engine client, and
 * bundled engine change together, so no version-1 automation parser or
 * lossy fallback is retained. The capability handshake must agree on
 * protocol version 2 and the automation-decimal-v1 feature before any
 * automation command is published.
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

    static uint32_t readUint32LE(const uint8_t* bytes) {
        return static_cast<uint32_t>(bytes[0])
             | (static_cast<uint32_t>(bytes[1]) << 8)
             | (static_cast<uint32_t>(bytes[2]) << 16)
             | (static_cast<uint32_t>(bytes[3]) << 24);
    }

    // Parse from raw bytes
    static bool parse(const uint8_t* data, size_t size, Request& req) {
        if (size < 5) return false;  // minimum: 1 byte cmd + 4 bytes len

        req.command = static_cast<Command>(data[0]);

        const uint32_t payloadLen = readUint32LE(data + 1);

        // The request envelope is length-delimited. Accepting trailing bytes
        // would let a malformed v2 payload be interpreted differently by
        // different command handlers.
        if (payloadLen > size - 5 || size != 5 + payloadLen) return false;

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

        const uint32_t payloadLen = static_cast<uint32_t>(payload.size());
        data.push_back(static_cast<uint8_t>(payloadLen & 0xffu));
        data.push_back(static_cast<uint8_t>((payloadLen >> 8) & 0xffu));
        data.push_back(static_cast<uint8_t>((payloadLen >> 16) & 0xffu));
        data.push_back(static_cast<uint8_t>((payloadLen >> 24) & 0xffu));

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
