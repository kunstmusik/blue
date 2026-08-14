#include "ZmqHandler.h"
#include "SharedMemory.h"
#include "engine/CsoundEngine.h"
#include "protocol/Capabilities.h"
#include "protocol/Protocol.h"
#include "../automation/AutomationStore.h"
#include "../automation/AutomationTypes.h"

#include <zmq.h>
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

}  // namespace

ZmqHandler::ZmqHandler(CsoundEngine& engine, SharedMemory& shm)
    : engine_(engine), shm_(shm)
{
    context_ = zmq_ctx_new();

    // Create inproc wakeup pair to wake up control thread when engine state changes occur
    wakeupPullSocket_ = zmq_socket(context_, ZMQ_PULL);
    if (wakeupPullSocket_) {
        const int linger = 0;
        zmq_setsockopt(wakeupPullSocket_, ZMQ_LINGER, &linger, sizeof(linger));
        zmq_bind(wakeupPullSocket_, "inproc://blue_engine_wakeup");
    }
    wakeupPushSocket_ = zmq_socket(context_, ZMQ_PUSH);
    if (wakeupPushSocket_) {
        const int linger = 0;
        zmq_setsockopt(wakeupPushSocket_, ZMQ_LINGER, &linger, sizeof(linger));
        zmq_connect(wakeupPushSocket_, "inproc://blue_engine_wakeup");
    }

    engine_.setStateChangeCallback([this](const EngineStateSnapshot &snapshot) {
        enqueueStateSnapshot(snapshot);
    });
}

ZmqHandler::~ZmqHandler() {
    engine_.setStateChangeCallback(nullptr);
    if (wakeupPushSocket_) {
        zmq_close(wakeupPushSocket_);
    }
    if (wakeupPullSocket_) {
        zmq_close(wakeupPullSocket_);
    }
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

    zmq_pollitem_t items[2];
    items[0].socket = controlSocket_;
    items[0].fd = 0;
    items[0].events = ZMQ_POLLIN;
    items[0].revents = 0;

    items[1].socket = wakeupPullSocket_;
    items[1].fd = 0;
    items[1].events = ZMQ_POLLIN;
    items[1].revents = 0;

    // Sleep efficiently in kernel until request arrives or state change wakes us up
    int rc = zmq_poll(items, 2, 500);
    if (rc == -1) {
        if (zmq_errno() == EINTR) {
            publishPendingStateSnapshots();
            return !shutdownRequested_.load(std::memory_order_relaxed);
        }
        return false;
    }

    if (items[1].revents & ZMQ_POLLIN) {
        char drainBuf[64];
        while (zmq_recv(wakeupPullSocket_, drainBuf, sizeof(drainBuf), ZMQ_DONTWAIT) > 0) {}
        publishPendingStateSnapshots();
        if (shutdownRequested_.load(std::memory_order_relaxed)) {
            return false;
        }
    }

    if (!(items[0].revents & ZMQ_POLLIN)) {
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
                    double value;
                    std::memcpy(&value, req.payload.data() + nameLen + 1, sizeof(double));
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
                    std::string payload(sizeof(double), '\0');
                    std::memcpy(payload.data(), &value, sizeof(double));
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
                    std::memcpy(&initialValue, req.payload.data() + nameLen + 1, sizeof(double));
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

            // Automation commands
            case Command::CREATE_AUTOMATION:
            case Command::UPDATE_AUTOMATION: {
                // payload: channel_name\0 + curve(1B) + enabled(1B) + resolution(8B) + resolutionScale(4B) + highPrecision(1B) + n_points(4B) + points
                const char* payload = req.payload.c_str();
                size_t nameLen = std::strlen(payload);

                // Minimum size: name + null + curve(1) + enabled(1) + resolution(8) + resolutionScale(4) + highPrecision(1) + n_points(4)
                if (req.payload.size() < nameLen + 1 + 1 + 1 + sizeof(double) + sizeof(int32_t) + 1 + sizeof(uint32_t)) {
                    resp = Response::error("Invalid automation payload (too small)");
                    break;
                }

                std::string channelName(payload, nameLen);
                size_t offset = nameLen + 1;

                uint8_t curveValue = static_cast<uint8_t>(req.payload[offset]);
                AutomationCurve curve = static_cast<AutomationCurve>(curveValue);
                offset += 1;

                uint8_t enabledValue = static_cast<uint8_t>(req.payload[offset]);
                bool enabled = (enabledValue != 0);
                offset += 1;

                // Read resolution (double, little-endian)
                double resolution = 0.0;
                std::memcpy(&resolution, req.payload.data() + offset, sizeof(double));
                offset += sizeof(double);

                // Read resolutionScale (int32_t, little-endian)
                int32_t resolutionScale = 0;
                std::memcpy(&resolutionScale, req.payload.data() + offset, sizeof(int32_t));
                offset += sizeof(int32_t);

                // Read highPrecision (1 byte)
                uint8_t highPrecisionValue = static_cast<uint8_t>(req.payload[offset]);
                bool highPrecision = (highPrecisionValue != 0);
                offset += 1;

                uint32_t nPoints;
                std::memcpy(&nPoints, req.payload.data() + offset, sizeof(uint32_t));
                offset += sizeof(uint32_t);

                // Validate remaining size for points
                if (req.payload.size() < offset + nPoints * 16) {
                    resp = Response::error("Invalid automation points data");
                    break;
                }

                // Parse points
                std::vector<AutomationPoint> points;
                points.reserve(nPoints);
                for (uint32_t i = 0; i < nPoints; ++i) {
                    double time, value;
                    std::memcpy(&time, req.payload.data() + offset, sizeof(double));
                    offset += sizeof(double);
                    std::memcpy(&value, req.payload.data() + offset, sizeof(double));
                    offset += sizeof(double);
                    points.emplace_back(time, value);
                }

                auto store = engine_.getAutomationStore();
                if (req.command == Command::CREATE_AUTOMATION) {
                    uint32_t id = store->createAutomation(channelName, curve, points, enabled,
                                                          resolution, resolutionScale, highPrecision);
                    // Return automation ID
                    std::string payload(sizeof(uint32_t), '\0');
                    std::memcpy(payload.data(), &id, sizeof(uint32_t));
                    resp = Response::ok(payload);
                } else {
                    // UPDATE_AUTOMATION
                    if (store->updateAutomation(channelName, curve, points, enabled,
                                                resolution, resolutionScale, highPrecision)) {
                        resp = Response::ok();
                    } else {
                        resp = Response::error("Automation not found");
                    }
                }
                break;
            }

            case Command::DELETE_AUTOMATION: {
                // payload: channel_name\0
                std::string channelName = req.payload.c_str();
                auto store = engine_.getAutomationStore();
                if (store->deleteAutomation(channelName)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error("Automation not found");
                }
                break;
            }

            case Command::ENABLE_AUTOMATION: {
                // payload: channel_name\0
                std::string channelName = req.payload.c_str();
                auto store = engine_.getAutomationStore();
                if (store->setEnabled(channelName, true)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error("Automation not found");
                }
                break;
            }

            case Command::DISABLE_AUTOMATION: {
                // payload: channel_name\0
                std::string channelName = req.payload.c_str();
                auto store = engine_.getAutomationStore();
                if (store->setEnabled(channelName, false)) {
                    resp = Response::ok();
                } else {
                    resp = Response::error("Automation not found");
                }
                break;
            }

            case Command::LIST_AUTOMATIONS: {
                auto store = engine_.getAutomationStore();
                auto automations = store->listAutomations();

                // Build response: count(4B) + entries
                std::string payload;
                uint32_t count = static_cast<uint32_t>(automations.size());
                payload.append(reinterpret_cast<const char*>(&count), sizeof(uint32_t));

                for (const auto& def : automations) {
                    // id(4B) + enabled(1B) + channel(64B) + n_points(4B)
                    payload.append(reinterpret_cast<const char*>(&def.id), sizeof(uint32_t));

                    uint8_t enabledByte = def.enabled ? 1 : 0;
                    payload.append(reinterpret_cast<const char*>(&enabledByte), 1);

                    char channelBuf[64] = {0};
                    std::strncpy(channelBuf, def.channelName.c_str(), 63);
                    payload.append(channelBuf, 64);

                    uint32_t nPoints = static_cast<uint32_t>(def.points.size());
                    payload.append(reinterpret_cast<const char*>(&nPoints), sizeof(uint32_t));
                }

                resp = Response::ok(payload);
                break;
            }

            case Command::CLEAR_AUTOMATIONS: {
                auto store = engine_.getAutomationStore();
                store->clear();
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
    if (wakeupPushSocket_) {
        char sig = 1;
        zmq_send(wakeupPushSocket_, &sig, 1, ZMQ_DONTWAIT);
    }
}

void ZmqHandler::enqueueStateSnapshot(const EngineStateSnapshot &snapshot) {
    {
        std::lock_guard<std::mutex> lock(pendingStateMutex_);
        pendingStateSnapshots_.push_back(snapshot);
    }
    if (wakeupPushSocket_) {
        char sig = 1;
        zmq_send(wakeupPushSocket_, &sig, 1, ZMQ_DONTWAIT);
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
