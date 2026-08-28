#include "ZmqHandler.h"
#include "SharedMemory.h"
#include "engine/CsoundEngine.h"
#include "protocol/Capabilities.h"
#include "protocol/Protocol.h"
#include "../automation/AutomationStore.h"
#include "../automation/AutomationTypes.h"

#include <zmq.h>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <utility>
#include <vector>

namespace blue {

namespace {

std::string tcpEndpointForPort(int port) {
    return "tcp://*:" + std::to_string(port);
}

bool isValidUtf8(const std::string& text) {
    for (size_t i = 0; i < text.size();) {
        const auto byte = static_cast<unsigned char>(text[i]);
        if (byte <= 0x7f) {
            i += 1;
            continue;
        }
        size_t continuationCount = 0;
        unsigned char firstContinuationMin = 0x80;
        unsigned char firstContinuationMax = 0xbf;
        if (byte >= 0xc2 && byte <= 0xdf) {
            continuationCount = 1;
        } else if (byte == 0xe0) {
            continuationCount = 2;
            firstContinuationMin = 0xa0;
        } else if (byte >= 0xe1 && byte <= 0xec) {
            continuationCount = 2;
        } else if (byte == 0xed) {
            continuationCount = 2;
            firstContinuationMax = 0x9f;
        } else if (byte >= 0xee && byte <= 0xef) {
            continuationCount = 2;
        } else if (byte == 0xf0) {
            continuationCount = 3;
            firstContinuationMin = 0x90;
        } else if (byte >= 0xf1 && byte <= 0xf3) {
            continuationCount = 3;
        } else if (byte == 0xf4) {
            continuationCount = 3;
            firstContinuationMax = 0x8f;
        } else {
            return false;
        }
        if (i + continuationCount >= text.size()) return false;
        const auto firstContinuation = static_cast<unsigned char>(text[i + 1]);
        if (firstContinuation < firstContinuationMin || firstContinuation > firstContinuationMax) {
            return false;
        }
        for (size_t j = 2; j <= continuationCount; ++j) {
            const auto continuation = static_cast<unsigned char>(text[i + j]);
            if (continuation < 0x80 || continuation > 0xbf) return false;
        }
        i += continuationCount + 1;
    }
    return true;
}

bool parseNamePayload(const std::string& payload, std::string& name) {
    const size_t terminator = payload.find('\0');
    if (terminator == std::string::npos || terminator == 0 || terminator + 1 != payload.size()) {
        return false;
    }
    name.assign(payload.data(), terminator);
    return isValidUtf8(name);
}

uint32_t readUint32LE(const char* bytes) {
    const auto* data = reinterpret_cast<const unsigned char*>(bytes);
    return static_cast<uint32_t>(data[0])
         | (static_cast<uint32_t>(data[1]) << 8)
         | (static_cast<uint32_t>(data[2]) << 16)
         | (static_cast<uint32_t>(data[3]) << 24);
}

uint64_t readUint64LE(const char* bytes) {
    const auto* data = reinterpret_cast<const unsigned char*>(bytes);
    uint64_t value = 0;
    for (unsigned int index = 0; index < sizeof(value); ++index) {
        value |= static_cast<uint64_t>(data[index]) << (index * 8);
    }
    return value;
}

double readDoubleLE(const char* bytes) {
    const uint64_t bits = readUint64LE(bytes);
    double value = 0.0;
    std::memcpy(&value, &bits, sizeof(value));
    return value;
}

void appendUint32LE(std::string& output, uint32_t value) {
    output.push_back(static_cast<char>(value & 0xffu));
    output.push_back(static_cast<char>((value >> 8) & 0xffu));
    output.push_back(static_cast<char>((value >> 16) & 0xffu));
    output.push_back(static_cast<char>((value >> 24) & 0xffu));
}

void appendUint64LE(std::string& output, uint64_t value) {
    for (unsigned int index = 0; index < sizeof(value); ++index) {
        output.push_back(static_cast<char>((value >> (index * 8)) & 0xffu));
    }
}

void appendDoubleLE(std::string& output, double value) {
    uint64_t bits = 0;
    std::memcpy(&bits, &value, sizeof(bits));
    appendUint64LE(output, bits);
}

// Documented protocol maximums for batch channel commands (batch-channels-v1).
constexpr uint16_t BATCH_MAX_CHANNELS = 256;
constexpr uint16_t BATCH_MAX_NAME_BYTES = 63;  // fits the 64-byte shm field

struct BatchChannelEntry {
    std::string name;
    double value = 0.0;
};

// Parse a batch payload's entries with whole-payload validation: exact
// length, count bounds, non-empty NUL-free valid-UTF-8 names within the
// engine channel-name limit, and (for sets) finite values. Duplicate names
// are rejected so entry order never becomes meaning-bearing. Returns false
// with a diagnostic instead of applying any write.
bool parseBatchChannelPayload(
    const std::string& payload,
    bool withValues,
    std::vector<BatchChannelEntry>& entries,
    std::string& errorMessage) {
    if (payload.size() < 2) {
        errorMessage = "BATCH payload truncated before count";
        return false;
    }
    const size_t count = static_cast<size_t>(static_cast<unsigned char>(payload[0]))
        | (static_cast<size_t>(static_cast<unsigned char>(payload[1])) << 8);
    if (count == 0 || count > BATCH_MAX_CHANNELS) {
        errorMessage = "BATCH channel count out of bounds";
        return false;
    }
    size_t offset = 2;
    std::vector<std::string> seen;
    seen.reserve(count);
    for (size_t index = 0; index < count; ++index) {
        if (offset + 2 > payload.size()) {
            errorMessage = "BATCH payload truncated in entry header";
            return false;
        }
        const size_t nameLength = static_cast<size_t>(static_cast<unsigned char>(payload[offset]))
            | (static_cast<size_t>(static_cast<unsigned char>(payload[offset + 1])) << 8);
        offset += 2;
        if (nameLength == 0 || nameLength > BATCH_MAX_NAME_BYTES) {
            errorMessage = "BATCH channel name length out of bounds";
            return false;
        }
        if (offset + nameLength > payload.size()) {
            errorMessage = "BATCH payload truncated in channel name";
            return false;
        }
        BatchChannelEntry entry;
        entry.name.assign(payload, offset, nameLength);
        offset += nameLength;
        if (entry.name.find('\0') != std::string::npos) {
            errorMessage = "BATCH channel name contains NUL";
            return false;
        }
        if (!isValidUtf8(entry.name)) {
            errorMessage = "BATCH channel name is not valid UTF-8";
            return false;
        }
        for (const auto& previous : seen) {
            if (previous == entry.name) {
                errorMessage = "BATCH payload contains duplicate channel name";
                return false;
            }
        }
        seen.push_back(entry.name);
        if (withValues) {
            if (offset + sizeof(double) > payload.size()) {
                errorMessage = "BATCH payload truncated in channel value";
                return false;
            }
            entry.value = readDoubleLE(payload.data() + offset);
            offset += sizeof(double);
            if (!std::isfinite(entry.value)) {
                errorMessage = "BATCH channel value must be finite";
                return false;
            }
        }
        entries.push_back(std::move(entry));
    }
    if (offset != payload.size()) {
        errorMessage = "BATCH payload has trailing bytes";
        return false;
    }
    return true;
}

}  // namespace

ZmqHandler::ZmqHandler(CsoundEngine& engine, SharedMemory& shm)
    : engine_(engine), shm_(shm)
{
    context_ = zmq_ctx_new();

    engine_.setStateChangeCallback([this](const EngineStateSnapshot &snapshot) {
        enqueueStateSnapshot(snapshot);
    });
}

ZmqHandler::~ZmqHandler() {
    engine_.setStateChangeCallback(nullptr);
    if (controlSocket_) {
        zmq_close(controlSocket_);
    }
    if (pubSocket_) {
        zmq_close(pubSocket_);
    }
    if (context_) {
        zmq_ctx_destroy(context_);
    }
}

bool ZmqHandler::bind(int port, int pubPort) {
    return bind(tcpEndpointForPort(port), tcpEndpointForPort(pubPort));
}

bool ZmqHandler::bind(const std::string& controlEndpoint, const std::string& pubEndpoint) {
    controlSocket_ = zmq_socket(context_, ZMQ_REP);
    if (!controlSocket_) {
        std::fprintf(stderr, "Failed to create ZMQ control socket\n");
        return false;
    }

    pubSocket_ = zmq_socket(context_, ZMQ_PUB);
    if (!pubSocket_) {
        std::fprintf(stderr, "Failed to create ZMQ pub socket\n");
        return false;
    }

    const int linger = 0;
    zmq_setsockopt(controlSocket_, ZMQ_LINGER, &linger, sizeof(linger));
    zmq_setsockopt(pubSocket_, ZMQ_LINGER, &linger, sizeof(linger));

    if (zmq_bind(controlSocket_, controlEndpoint.c_str()) != 0) {
        std::fprintf(stderr, "Failed to bind control socket to %s: %s\n", controlEndpoint.c_str(), zmq_strerror(zmq_errno()));
        return false;
    }

    if (zmq_bind(pubSocket_, pubEndpoint.c_str()) != 0) {
        std::fprintf(stderr, "Failed to bind pub socket to %s: %s\n", pubEndpoint.c_str(), zmq_strerror(zmq_errno()));
        return false;
    }

    std::printf("blue-engine listening on control endpoint %s and pub endpoint %s\n", controlEndpoint.c_str(), pubEndpoint.c_str());
    return true;
}

bool ZmqHandler::processOne() {
    publishPendingStateSnapshots();

    if (shutdownRequested_.load(std::memory_order_relaxed)) {
        return false;
    }

    zmq_pollitem_t item;
    item.socket = controlSocket_;
    item.fd = 0;
    item.events = ZMQ_POLLIN;
    item.revents = 0;

    // ZeroMQ sockets are thread-affine. A bounded poll keeps requestShutdown
    // safe from signal and owner-monitor threads without sending on an
    // inproc socket owned by this thread.
    int rc = zmq_poll(&item, 1, 50);
    if (rc == -1) {
        if (zmq_errno() == EINTR) {
            publishPendingStateSnapshots();
            return !shutdownRequested_.load(std::memory_order_relaxed);
        }
        return false;
    }

    if (!(item.revents & ZMQ_POLLIN)) {
        publishPendingStateSnapshots();
        return !shutdownRequested_.load(std::memory_order_relaxed);
    }

    // Receive request
    zmq_msg_t msg;
    zmq_msg_init(&msg);

    rc = zmq_msg_recv(&msg, controlSocket_, 0);
    if (rc == -1) {
        zmq_msg_close(&msg);
        if (zmq_errno() == EAGAIN) {
            publishPendingStateSnapshots();
            return !shutdownRequested_.load(std::memory_order_relaxed);
        }
        std::fprintf(stderr, "Receive error: %s\n", zmq_strerror(zmq_errno()));
        return false;
    }

    // Parse request
    Request req;
    bool parsed = Request::parse(
        static_cast<uint8_t*>(zmq_msg_data(&msg)),
        zmq_msg_size(&msg),
        req
    );
    zmq_msg_close(&msg);

    Response resp;

    if (!parsed) {
        resp = Response::error("Invalid request format");
    } else {
        // Handle command
        switch (req.command) {
            case Command::CREATE_ENGINE:
                if (engine_.create()) {
                    resp = Response::ok();
                } else {
                    resp = Response::error(engine_.getLastError());
                }
                break;

            case Command::COMPILE_ORC:
                if (engine_.compileOrc(req.payload)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error(engine_.getLastError());
                }
                break;

            case Command::READ_SCORE:
                if (engine_.readScore(req.payload)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error(engine_.getLastError());
                }
                break;

            case Command::SET_OPTION:
                if (engine_.setOption(req.payload)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error(engine_.getLastError());
                }
                break;

            case Command::START:
                if (engine_.start()) {
                    resp = Response::ok();
                } else {
                    resp = Response::error(engine_.getLastError());
                }
                break;

            case Command::STOP:
                engine_.stop();
                resp = Response::ok();
                break;

            case Command::DESTROY_ENGINE:
                engine_.destroy();
                resp = Response::ok();
                break;

            case Command::GET_ENGINE_STATE:
                resp = Response::ok(serializeStateSnapshot(engine_.getStateSnapshot()));
                break;

            case Command::GET_CAPABILITIES:
                resp = Response::ok(engineCapabilitiesJson());
                break;

            case Command::SET_CHANNEL: {
                // payload: name\0 + double value (8 bytes)
                size_t nameLen = std::strlen(req.payload.c_str());
                if (req.payload.size() >= nameLen + 1 + sizeof(double)) {
                    std::string name = req.payload.substr(0, nameLen);
                    const double value = readDoubleLE(req.payload.data() + nameLen + 1);
                    if (engine_.setChannel(name, value)) {
                        resp = Response::ok();
                    } else {
                        resp = Response::error(engine_.getLastError());
                    }
                } else {
                    resp = Response::error("Invalid SET_CHANNEL payload");
                }
                break;
            }

            case Command::GET_CHANNEL: {
                // payload: name\0
                std::string name = req.payload.c_str();
                double value;
                if (engine_.getChannel(name, value)) {
                    std::string payload;
                    payload.reserve(sizeof(double));
                    appendDoubleLE(payload, value);
                    resp = Response::ok(payload);
                } else {
                    resp = Response::error(engine_.getLastError());
                }
                break;
            }

            case Command::CREATE_CHANNEL: {
                // payload: name\0 + double initial (8 bytes)
                size_t nameLen = std::strlen(req.payload.c_str());
                double initialValue = 0.0;
                if (req.payload.size() >= nameLen + 1 + sizeof(double)) {
                    initialValue = readDoubleLE(req.payload.data() + nameLen + 1);
                }
                std::string name = req.payload.substr(0, nameLen);
                if (engine_.createChannel(name, initialValue)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error(engine_.getLastError());
                }
                break;
            }

            case Command::GET_SHM_NAME:
                resp = Response::ok(shm_.getName());
                break;

            case Command::BATCH_SET_CHANNELS: {
                // Whole-payload validation happens before any write so the
                // command is all-or-error at the protocol boundary.
                std::vector<BatchChannelEntry> entries;
                std::string errorMessage;
                if (!parseBatchChannelPayload(req.payload, true, entries, errorMessage)) {
                    resp = Response::error(errorMessage);
                    break;
                }
                bool applied = true;
                for (const auto& entry : entries) {
                    if (!engine_.setChannel(entry.name, entry.value)) {
                        resp = Response::error(engine_.getLastError());
                        applied = false;
                        break;
                    }
                }
                if (applied) {
                    resp = Response::ok();
                }
                break;
            }

            case Command::BATCH_GET_CHANNELS: {
                std::vector<BatchChannelEntry> entries;
                std::string errorMessage;
                if (!parseBatchChannelPayload(req.payload, false, entries, errorMessage)) {
                    resp = Response::error(errorMessage);
                    break;
                }
                std::string payload;
                payload.reserve(2 + entries.size() * sizeof(double));
                payload.push_back(static_cast<char>(entries.size() & 0xffu));
                payload.push_back(static_cast<char>((entries.size() >> 8) & 0xffu));
                for (const auto& entry : entries) {
                    double value = 0.0;
                    if (!engine_.getChannel(entry.name, value)) {
                        // No partial value list: one unavailable channel
                        // fails the whole batch.
                        resp = Response::error(engine_.getLastError());
                        payload.clear();
                        break;
                    }
                    appendDoubleLE(payload, value);
                }
                if (!payload.empty()) {
                    resp = Response::ok(payload);
                }
                break;
            }

            // Automation commands (protocol version 2: exact decimal text)
            case Command::CREATE_AUTOMATION:
            case Command::UPDATE_AUTOMATION: {
                // payload: channel_name\0 + curve(1B) + enabled(1B) +
                //          resolutionLength(u32-le) + resolution(ascii) +
                //          n_points(u32-le) + points
                const char* payload = req.payload.c_str();
                const size_t payloadSize = req.payload.size();
                const size_t nameLen = strnlen(payload, payloadSize);

                if (nameLen == 0 || nameLen == payloadSize) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] channel name must be a non-empty NUL-terminated string");
                    break;
                }
                std::string channelName(payload, nameLen);
                if (!isValidUtf8(channelName)) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] channel name must be valid UTF-8");
                    break;
                }
                size_t offset = nameLen + 1;

                if (payloadSize < offset + 1 + 1 + sizeof(uint32_t)) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] payload too small for curve, enabled, and resolution length");
                    break;
                }

                const uint8_t curveValue = static_cast<uint8_t>(req.payload[offset]);
                if (curveValue > static_cast<uint8_t>(AutomationCurve::EXPONENTIAL)) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] unknown curve code");
                    break;
                }
                const AutomationCurve curve = static_cast<AutomationCurve>(curveValue);
                offset += 1;

                const uint8_t enabledValue = static_cast<uint8_t>(req.payload[offset]);
                if (enabledValue > 1) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] enabled must be 0 or 1");
                    break;
                }
                const bool enabled = (enabledValue == 1);
                offset += 1;

                uint32_t resolutionLength = 0;
                resolutionLength = readUint32LE(req.payload.data() + offset);
                offset += sizeof(uint32_t);

                if (resolutionLength == 0 || resolutionLength > payloadSize - offset) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] resolution length does not fit the payload");
                    break;
                }
                const std::string resolutionText(req.payload.data() + offset, resolutionLength);
                offset += resolutionLength;
                bool resolutionAsciiValid = true;
                for (const char c : resolutionText) {
                    if (static_cast<unsigned char>(c) < 0x20 || static_cast<unsigned char>(c) > 0x7e) {
                        resolutionAsciiValid = false;
                        break;
                    }
                }
                if (!resolutionAsciiValid) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] resolution must be printable ASCII");
                    break;
                }

                JavaBigDecimal parsedResolution;
                const auto resolutionStatus = parseJavaBigDecimal(resolutionText, parsedResolution);
                if (resolutionStatus == DecimalParseError::InvalidSyntax) {
                    resp = Response::error("[INVALID_DECIMAL_SYNTAX] automation resolution is not valid Java decimal text");
                    break;
                }
                if (resolutionStatus == DecimalParseError::ScaleOverflow) {
                    resp = Response::error("[DECIMAL_SCALE_OVERFLOW] automation resolution scale is outside Java int range");
                    break;
                }
                if (parsedResolution.canonicalText() != resolutionText) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] resolution must use canonical Java decimal text");
                    break;
                }

                if (payloadSize < offset + sizeof(uint32_t)) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] payload too small for point count");
                    break;
                }
                uint32_t nPoints = 0;
                nPoints = readUint32LE(req.payload.data() + offset);
                offset += sizeof(uint32_t);

                const uint64_t pointsBytes = static_cast<uint64_t>(nPoints) * 16u;
                if (pointsBytes != payloadSize - offset) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] point count does not match remaining bytes");
                    break;
                }

                std::vector<AutomationPoint> points;
                points.reserve(nPoints);
                bool finitePoints = true;
                for (uint32_t i = 0; i < nPoints; ++i) {
                    const double time = readDoubleLE(req.payload.data() + offset);
                    offset += sizeof(double);
                    const double value = readDoubleLE(req.payload.data() + offset);
                    offset += sizeof(double);
                    if (!std::isfinite(time) || !std::isfinite(value)) {
                        finitePoints = false;
                        break;
                    }
                    points.emplace_back(time, value);
                }
                if (!finitePoints) {
                    resp = Response::error("[NON_FINITE_AUTOMATION_INPUT] automation points must be finite");
                    break;
                }

                auto store = engine_.getAutomationStore();
                if (req.command == Command::CREATE_AUTOMATION) {
                    uint32_t id = 0;
                    const auto status = store->createAutomation(channelName, curve, points,
                                                                enabled, resolutionText, &id);
                    if (status != AutomationPrepareError::Ok) {
                        resp = Response::error(std::string("[") + automationPrepareErrorName(status) + "] automation definition rejected");
                        break;
                    }
                    // Return automation ID
                    std::string idPayload;
                    idPayload.reserve(sizeof(uint32_t));
                    appendUint32LE(idPayload, id);
                    resp = Response::ok(idPayload);
                } else {
                    // UPDATE_AUTOMATION
                    const auto status = store->updateAutomation(channelName, curve, points,
                                                                enabled, resolutionText);
                    if (status == AutomationPrepareError::NotFound) {
                        resp = Response::error("[AUTOMATION_NOT_FOUND] no automation for channel");
                    } else if (status != AutomationPrepareError::Ok) {
                        resp = Response::error(std::string("[") + automationPrepareErrorName(status) + "] automation definition rejected");
                    } else {
                        resp = Response::ok();
                    }
                }
                // reclaim snapshots retired by the performance thread
                store->reclaimRetired();
                break;
            }

            case Command::DELETE_AUTOMATION: {
                // payload: channel_name\0
                std::string channelName;
                auto store = engine_.getAutomationStore();
                if (!parseNamePayload(req.payload, channelName)) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] expected one UTF-8 channel name");
                } else if (store->deleteAutomation(channelName)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error("[AUTOMATION_NOT_FOUND] no automation for channel");
                }
                store->reclaimRetired();
                break;
            }

            case Command::ENABLE_AUTOMATION: {
                // payload: channel_name\0
                std::string channelName;
                auto store = engine_.getAutomationStore();
                if (!parseNamePayload(req.payload, channelName)) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] expected one UTF-8 channel name");
                } else if (store->setEnabled(channelName, true)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error("[AUTOMATION_NOT_FOUND] no automation for channel");
                }
                store->reclaimRetired();
                break;
            }

            case Command::DISABLE_AUTOMATION: {
                // payload: channel_name\0
                std::string channelName;
                auto store = engine_.getAutomationStore();
                if (!parseNamePayload(req.payload, channelName)) {
                    resp = Response::error("[AUTOMATION_PAYLOAD_INVALID] expected one UTF-8 channel name");
                } else if (store->setEnabled(channelName, false)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error("[AUTOMATION_NOT_FOUND] no automation for channel");
                }
                store->reclaimRetired();
                break;
            }

            case Command::LIST_AUTOMATIONS: {
                auto store = engine_.getAutomationStore();
                auto automations = store->listAutomations();

                // Build response: count(4B) + entries
                std::string payload;
                uint32_t count = static_cast<uint32_t>(automations.size());
                appendUint32LE(payload, count);

                for (const auto& def : automations) {
                    // id(4B) + enabled(1B) + channel(64B) + n_points(4B)
                    appendUint32LE(payload, def.id);

                    uint8_t enabledByte = def.enabled ? 1 : 0;
                    payload.append(reinterpret_cast<const char*>(&enabledByte), 1);

                    char channelBuf[64] = {0};
                    std::strncpy(channelBuf, def.channelName.c_str(), 63);
                    payload.append(channelBuf, 64);

                    uint32_t nPoints = static_cast<uint32_t>(def.points.size());
                    appendUint32LE(payload, nPoints);
                }

                resp = Response::ok(payload);
                break;
            }

            case Command::CLEAR_AUTOMATIONS: {
                auto store = engine_.getAutomationStore();
                store->clear();
                store->reclaimRetired();
                resp = Response::ok();
                break;
            }

            default:
                resp = Response::error("Unknown command");
                break;
        }
    }

    publishPendingStateSnapshots();

    // Send response
    auto data = resp.serialize();
    zmq_send(controlSocket_, data.data(), data.size(), 0);

    return true;
}

void ZmqHandler::requestShutdown() {
    shutdownRequested_.store(true, std::memory_order_release);
}

void ZmqHandler::enqueueStateSnapshot(const EngineStateSnapshot &snapshot) {
    {
        std::lock_guard<std::mutex> lock(pendingStateMutex_);
        pendingStateSnapshots_.push_back(snapshot);
    }
}

void ZmqHandler::publishPendingStateSnapshots() {
    std::vector<EngineStateSnapshot> snapshots;
    {
        std::lock_guard<std::mutex> lock(pendingStateMutex_);
        if (pendingStateSnapshots_.empty()) {
            return;
        }
        snapshots.swap(pendingStateSnapshots_);
    }

    for (const auto &snapshot : snapshots) {
        publishStateSnapshot(snapshot);
    }
}

void ZmqHandler::publishStateSnapshot(const EngineStateSnapshot &snapshot) {
    if (!pubSocket_) {
        return;
    }

    const std::string payload = serializeStateSnapshot(snapshot);
    zmq_send(pubSocket_, ENGINE_STATE_TOPIC, std::strlen(ENGINE_STATE_TOPIC), ZMQ_SNDMORE);
    zmq_send(pubSocket_, payload.data(), payload.size(), 0);
}

std::string ZmqHandler::serializeStateSnapshot(const EngineStateSnapshot &snapshot) {
    std::string json = "{";
    json += "\"state\":\"";
    json += stateToString(snapshot.state);
    json += "\",";
    json += "\"stopReason\":\"";
    json += stopReasonToString(snapshot.stopReason);
    json += "\",";
    json += "\"engineCreated\":";
    json += snapshot.engineCreated ? "true" : "false";
    json += ",";
    json += "\"running\":";
    json += snapshot.running ? "true" : "false";
    json += ",";
    json += "\"sampleFrames\":" + std::to_string(snapshot.sampleFrames) + ",";
    json += "\"sampleRate\":" + std::to_string(snapshot.sampleRate) + ",";
    json += "\"ksmps\":" + std::to_string(snapshot.ksmps) + ",";
    json += "\"sequence\":" + std::to_string(snapshot.sequence) + ",";
    json += "\"lastError\":\"" + escapeJsonString(snapshot.lastError) + "\"";
    json += "}";
    return json;
}

const char* ZmqHandler::stateToString(EngineLifecycleState state) {
    switch (state) {
        case EngineLifecycleState::EMPTY:
            return "empty";
        case EngineLifecycleState::READY:
            return "ready";
        case EngineLifecycleState::RUNNING:
            return "running";
        case EngineLifecycleState::STOPPED:
            return "stopped";
    }

    return "empty";
}

const char* ZmqHandler::stopReasonToString(EngineStopReason stopReason) {
    switch (stopReason) {
        case EngineStopReason::NONE:
            return "none";
        case EngineStopReason::COMPLETED:
            return "completed";
        case EngineStopReason::STOP_REQUESTED:
            return "stop-requested";
        case EngineStopReason::DESTROYED:
            return "destroyed";
        case EngineStopReason::FAILED:
            return "error";
    }

    return "none";
}

std::string ZmqHandler::escapeJsonString(const std::string &value) {
    std::string escaped;
    escaped.reserve(value.size());

    for (const char ch : value) {
        switch (ch) {
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
                escaped += ch;
                break;
        }
    }

    return escaped;
}

}  // namespace blue
