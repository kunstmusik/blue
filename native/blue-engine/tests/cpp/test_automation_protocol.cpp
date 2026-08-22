// Protocol-v2 request tests through the real ZMQ handler boundary.

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <vector>

#include <zmq.h>

#include "engine/CsoundEngine.h"
#include "ipc/SharedMemory.h"
#include "ipc/ZmqHandler.h"
#include "automation/AutomationManager.h"
#include "automation/AutomationStore.h"
#include "automation/AutomationTypes.h"
#include "automation/JavaBigDecimal.h"
#include "protocol/Protocol.h"
#include "java_parity_fixtures.h"

#ifndef BLUE_ENGINE_PARITY_FIXTURES_DIR
#error "BLUE_ENGINE_PARITY_FIXTURES_DIR must be provided by the build"
#endif

namespace {

int g_failures = 0;

void expect(bool condition, const std::string& what) {
    if (!condition) {
        std::printf("FAIL: %s\n", what.c_str());
        g_failures += 1;
    }
}

void appendUint32LE(std::string& payload, uint32_t value) {
    payload.push_back(static_cast<char>(value & 0xffu));
    payload.push_back(static_cast<char>((value >> 8) & 0xffu));
    payload.push_back(static_cast<char>((value >> 16) & 0xffu));
    payload.push_back(static_cast<char>((value >> 24) & 0xffu));
}

uint32_t readUint32LE(const uint8_t* bytes) {
    return static_cast<uint32_t>(bytes[0])
         | (static_cast<uint32_t>(bytes[1]) << 8)
         | (static_cast<uint32_t>(bytes[2]) << 16)
         | (static_cast<uint32_t>(bytes[3]) << 24);
}

std::vector<uint8_t> makeRequest(blue::Command command, const std::string& payload) {
    std::vector<uint8_t> request(5 + payload.size());
    request[0] = static_cast<uint8_t>(command);
    request[1] = static_cast<uint8_t>(payload.size() & 0xffu);
    request[2] = static_cast<uint8_t>((payload.size() >> 8) & 0xffu);
    request[3] = static_cast<uint8_t>((payload.size() >> 16) & 0xffu);
    request[4] = static_cast<uint8_t>((payload.size() >> 24) & 0xffu);
    std::memcpy(request.data() + 5, payload.data(), payload.size());
    return request;
}

std::string makeAutomationPayload(
    const std::string& channel,
    const std::string& resolution,
    uint8_t enabled = 1,
    uint32_t pointCount = 2,
    bool includePoints = true) {
    std::string payload = channel;
    payload.push_back('\0');
    payload.push_back(static_cast<char>(blue::AutomationCurve::LINEAR));
    payload.push_back(static_cast<char>(enabled));
    appendUint32LE(payload, static_cast<uint32_t>(resolution.size()));
    payload.append(resolution);
    appendUint32LE(payload, pointCount);
    if (includePoints) {
        const double points[][2] = {{0.0, 0.1}, {1.0, 0.9}};
        for (uint32_t i = 0; i < pointCount && i < 2; ++i) {
            payload.append(reinterpret_cast<const char*>(&points[i][0]), sizeof(double));
            payload.append(reinterpret_cast<const char*>(&points[i][1]), sizeof(double));
        }
    }
    return payload;
}

std::string makeNamePayload(const std::string& channel) {
    std::string payload = channel;
    payload.push_back('\0');
    return payload;
}

struct ResponseView {
    bool transportOk = false;
    uint8_t status = 0xff;
    std::string payload;
};

ResponseView roundTrip(
    blue::ZmqHandler& handler,
    const std::string& endpoint,
    const std::vector<uint8_t>& request) {
    void* context = zmq_ctx_new();
    void* socket = zmq_socket(context, ZMQ_REQ);
    const int timeoutMs = 2000;
    zmq_setsockopt(socket, ZMQ_RCVTIMEO, &timeoutMs, sizeof(timeoutMs));
    zmq_setsockopt(socket, ZMQ_SNDTIMEO, &timeoutMs, sizeof(timeoutMs));
    zmq_connect(socket, endpoint.c_str());

    bool processed = false;
    std::thread control([&]() { processed = handler.processOne(); });
    const int sendResult = zmq_send(socket, request.data(), request.size(), 0);

    std::vector<uint8_t> response(64 * 1024);
    const int responseSize = sendResult >= 0
        ? zmq_recv(socket, response.data(), response.size(), 0)
        : -1;
    control.join();

    ResponseView result;
    result.transportOk = sendResult >= 0 && responseSize >= 5 && processed;
    if (result.transportOk) {
        result.status = response[0];
        const uint32_t payloadSize = readUint32LE(response.data() + 1);
        if (payloadSize <= static_cast<uint32_t>(responseSize - 5)) {
            result.payload.assign(
                reinterpret_cast<const char*>(response.data() + 5), payloadSize);
        } else {
            result.transportOk = false;
        }
    }

    zmq_close(socket);
    zmq_ctx_destroy(context);
    return result;
}

void testMutationReclaimsRetiredSnapshots(
    blue::CsoundEngine& engine,
    blue::ZmqHandler& handler,
    const std::string& controlEndpoint) {
    const std::string channel = "reclaim-channel";
    const auto created = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(
            blue::Command::CREATE_AUTOMATION,
            makeAutomationPayload(channel, "0.1")));
    expect(created.transportOk && created.status == static_cast<uint8_t>(blue::Status::OK),
           "reclamation test creates its automation");

    auto store = engine.getAutomationStore();
    blue::AutomationManager manager(
        store,
        [](const std::string&, double) {});
    manager.process(0, 100.0);

    // The retirement ring has 256 slots. Run enough control/audio handoffs to
    // prove every mutation command reclaims the previous snapshot before the
    // next handoff can exhaust that ring.
    constexpr size_t kMutationCount = 300;
    for (size_t i = 0; i < kMutationCount; ++i) {
        ResponseView response;
        switch (i % 5) {
            case 0:
                response = roundTrip(
                    handler,
                    controlEndpoint,
                    makeRequest(
                        blue::Command::ENABLE_AUTOMATION,
                        makeNamePayload(channel)));
                break;
            case 1:
                response = roundTrip(
                    handler,
                    controlEndpoint,
                    makeRequest(
                        blue::Command::DISABLE_AUTOMATION,
                        makeNamePayload(channel)));
                break;
            case 2:
                response = roundTrip(
                    handler,
                    controlEndpoint,
                    makeRequest(
                        blue::Command::DELETE_AUTOMATION,
                        makeNamePayload(channel)));
                break;
            case 3:
                response = roundTrip(
                    handler,
                    controlEndpoint,
                    makeRequest(blue::Command::CLEAR_AUTOMATIONS, ""));
                break;
            default:
                response = roundTrip(
                    handler,
                    controlEndpoint,
                    makeRequest(
                        blue::Command::CREATE_AUTOMATION,
                        makeAutomationPayload(channel, "0.1")));
                break;
        }
        expect(
            response.transportOk && response.status == static_cast<uint8_t>(blue::Status::OK),
            "mutation remains successful during retirement-ring exercise");
        manager.process(static_cast<int64_t>(i + 1), 100.0);
    }

    expect(
        store->inlineRetireCount() == 0,
        "all mutation commands reclaim retired snapshots before ring exhaustion");
}

}  // namespace

int main() {
    const auto& corpus = blue::parity::FixtureCorpus::load(BLUE_ENGINE_PARITY_FIXTURES_DIR);
    expect(corpus.manifest().schemaVersion == 1, "fixture corpus loads from build dir");
    expect(!corpus.realtime().empty(), "realtime section present");

    // The same canonical resolution texts used by the parity corpus must be
    // accepted by the protocol parser before they reach the store.
    for (const auto& row : corpus.realtime()) {
        blue::JavaBigDecimal resolution;
        expect(
            blue::parseJavaBigDecimal(row.resolutionText, resolution) == blue::DecimalParseError::Ok,
            "protocol resolution parses: " + row.caseId + " (" + row.resolutionText + ")");
    }

    blue::Request parsedRequest{};
    const auto validEnvelope = makeRequest(blue::Command::LIST_AUTOMATIONS, "");
    expect(blue::Request::parse(validEnvelope.data(), validEnvelope.size(), parsedRequest),
           "request envelope parses with an exact length");
    auto trailingEnvelope = validEnvelope;
    trailingEnvelope.push_back(0);
    expect(!blue::Request::parse(trailingEnvelope.data(), trailingEnvelope.size(), parsedRequest),
           "request envelope rejects trailing bytes");
    auto truncatedEnvelope = validEnvelope;
    truncatedEnvelope[1] = 1;
    expect(!blue::Request::parse(truncatedEnvelope.data(), truncatedEnvelope.size(), parsedRequest),
           "request envelope rejects a truncated payload");

    blue::CsoundEngine engine;
    blue::SharedMemory sharedMemory;
    blue::ZmqHandler handler(engine, sharedMemory);
    const std::string controlEndpoint = "tcp://127.0.0.1:39173";
    const std::string pubEndpoint = "tcp://127.0.0.1:39174";
    if (!handler.bind(controlEndpoint, pubEndpoint)) {
        std::printf("FAIL: protocol test could not bind its TCP endpoints\n");
        return 1;
    }

    auto valid = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(
            blue::Command::CREATE_AUTOMATION,
            makeAutomationPayload("protocol-channel", "0.10")));
    expect(valid.transportOk && valid.status == static_cast<uint8_t>(blue::Status::OK),
           "canonical exact resolution reaches CREATE_AUTOMATION");
    const auto definitions = engine.getAutomationStore()->listAutomations();
    expect(definitions.size() == 1 && definitions[0].resolutionDecimal == "0.10",
           "store retains resolution scale and trailing zero");

    auto updated = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(
            blue::Command::UPDATE_AUTOMATION,
            makeAutomationPayload("protocol-channel", "1E-7")));
    expect(updated.transportOk && updated.status == static_cast<uint8_t>(blue::Status::OK),
           "canonical exponent resolution reaches UPDATE_AUTOMATION");

    auto nonCanonical = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(
            blue::Command::UPDATE_AUTOMATION,
            makeAutomationPayload("protocol-channel", "1e-7")));
    expect(nonCanonical.transportOk && nonCanonical.status == static_cast<uint8_t>(blue::Status::ERROR),
           "non-canonical decimal spelling is rejected");
    expect(nonCanonical.payload.find("AUTOMATION_PAYLOAD_INVALID") != std::string::npos,
           "non-canonical decimal reports a stable payload diagnostic");

    auto malformed = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(
            blue::Command::UPDATE_AUTOMATION,
            makeAutomationPayload("protocol-channel", "NaN")));
    expect(malformed.transportOk && malformed.status == static_cast<uint8_t>(blue::Status::ERROR),
           "malformed decimal is recoverable");
    expect(malformed.payload.find("INVALID_DECIMAL_SYNTAX") != std::string::npos,
           "malformed decimal reports its diagnostic category");

    auto invalidEnabled = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(
            blue::Command::UPDATE_AUTOMATION,
            makeAutomationPayload("protocol-channel", "1E-7", 2)));
    expect(invalidEnabled.transportOk && invalidEnabled.status == static_cast<uint8_t>(blue::Status::ERROR),
           "enabled field rejects values outside its one-byte domain");

    auto countMismatch = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(
            blue::Command::UPDATE_AUTOMATION,
            makeAutomationPayload("protocol-channel", "1E-7", 1, 3)));
    expect(countMismatch.transportOk && countMismatch.status == static_cast<uint8_t>(blue::Status::ERROR),
           "point count must match the remaining payload");

    std::string invalidUtf8Payload = makeAutomationPayload("protocol-channel", "1E-7");
    invalidUtf8Payload[0] = static_cast<char>(0xc0);
    auto invalidUtf8 = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(blue::Command::UPDATE_AUTOMATION, invalidUtf8Payload));
    expect(invalidUtf8.transportOk && invalidUtf8.status == static_cast<uint8_t>(blue::Status::ERROR),
           "channel names must be valid UTF-8");

    testMutationReclaimsRetiredSnapshots(engine, handler, controlEndpoint);

    auto deleteWithTrailingBytes = roundTrip(
        handler,
        controlEndpoint,
        makeRequest(blue::Command::DELETE_AUTOMATION, std::string("protocol-channel\0\0", 18)));
    expect(deleteWithTrailingBytes.transportOk
               && deleteWithTrailingBytes.status == static_cast<uint8_t>(blue::Status::ERROR),
           "name-only commands reject trailing bytes");

    if (g_failures == 0) {
        std::printf("test_automation_protocol: all tests passed\n");
        return 0;
    }
    std::printf("test_automation_protocol: %d failure(s)\n", g_failures);
    return 1;
}
