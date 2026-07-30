/**
 * Blue Engine C++ Test Client
 */

#include <iostream>
#include <string>
#include <vector>
#include <cstring>
#include <thread>
#include <chrono>

#include <zmq.h>

#include "protocol/Protocol.h"

enum class AutomationCurve : uint8_t {
    STEP = 0x00,
    LINEAR = 0x01,
    EXPONENTIAL = 0x02
};

struct AutomationPoint {
    double time;
    double value;
};

class BlueEngineClient {
public:
    BlueEngineClient(const std::string& endpoint = "tcp://localhost:5555") {
        context_ = zmq_ctx_new();
        socket_ = zmq_socket(context_, ZMQ_REQ);
        zmq_connect(socket_, endpoint.c_str());
    }

    ~BlueEngineClient() {
        if (socket_) zmq_close(socket_);
        if (context_) zmq_ctx_destroy(context_);
    }

    std::pair<bool, std::string> sendCommand(blue::Command cmd, const std::string& payload = "") {
        // Build request
        std::vector<uint8_t> request;
        request.push_back(static_cast<uint8_t>(cmd));

        uint32_t len = static_cast<uint32_t>(payload.size());
        request.insert(request.end(),
                       reinterpret_cast<uint8_t*>(&len),
                       reinterpret_cast<uint8_t*>(&len) + sizeof(len));
        request.insert(request.end(), payload.begin(), payload.end());

        // Send
        zmq_send(socket_, request.data(), request.size(), 0);

        // Receive
        uint8_t buffer[4096];
        int recvLen = zmq_recv(socket_, buffer, sizeof(buffer), 0);
        if (recvLen < 5) {
            return {false, "Invalid response"};
        }

        auto status = static_cast<blue::Status>(buffer[0]);
        uint32_t msgLen;
        std::memcpy(&msgLen, buffer + 1, sizeof(msgLen));
        std::string msg(reinterpret_cast<char*>(buffer + 5), msgLen);

        return {status == blue::Status::OK, msg};
    }

    auto createEngine() {
        auto resp = sendCommand(blue::Command::CREATE_ENGINE);
        if (!resp.first && resp.second.find("Engine already created") != std::string::npos) {
            sendCommand(blue::Command::DESTROY_ENGINE);
            resp = sendCommand(blue::Command::CREATE_ENGINE);
        }
        return resp;
    }
    auto compileOrc(const std::string& orc) { return sendCommand(blue::Command::COMPILE_ORC, orc); }
    auto readScore(const std::string& sco) { return sendCommand(blue::Command::READ_SCORE, sco); }
    auto setOption(const std::string& opt) { return sendCommand(blue::Command::SET_OPTION, opt); }
    auto start() { return sendCommand(blue::Command::START); }
    auto stop() { return sendCommand(blue::Command::STOP); }
    auto destroyEngine() { return sendCommand(blue::Command::DESTROY_ENGINE); }

    auto createChannel(const std::string& name, double initialValue) {
        std::string payload = name;
        payload.push_back('\0');
        payload.append(reinterpret_cast<const char*>(&initialValue), sizeof(double));
        return sendCommand(blue::Command::CREATE_CHANNEL, payload);
    }

    auto setChannel(const std::string& name, double value) {
        std::string payload = name;
        payload.push_back('\0');
        payload.append(reinterpret_cast<const char*>(&value), sizeof(double));
        return sendCommand(blue::Command::SET_CHANNEL, payload);
    }

    std::pair<bool, uint32_t> createAutomation(const std::string& channelName,
                                                AutomationCurve curve,
                                                const std::vector<AutomationPoint>& points,
                                                bool enabled = true,
                                                double resolution = 0.0,
                                                int32_t resolutionScale = 0,
                                                bool highPrecision = false) {
        std::string payload = channelName;
        payload.push_back('\0');

        uint8_t curveVal = static_cast<uint8_t>(curve);
        uint8_t enabledVal = enabled ? 1 : 0;
        uint8_t highPrecisionVal = highPrecision ? 1 : 0;
        uint32_t numPoints = static_cast<uint32_t>(points.size());

        // payload: name\0 + curve(1B) + enabled(1B) + resolution(8B) + resolutionScale(4B) + highPrecision(1B) + n_points(4B) + points
        payload.append(reinterpret_cast<const char*>(&curveVal), sizeof(curveVal));
        payload.append(reinterpret_cast<const char*>(&enabledVal), sizeof(enabledVal));
        payload.append(reinterpret_cast<const char*>(&resolution), sizeof(double));
        payload.append(reinterpret_cast<const char*>(&resolutionScale), sizeof(int32_t));
        payload.append(reinterpret_cast<const char*>(&highPrecisionVal), sizeof(highPrecisionVal));
        payload.append(reinterpret_cast<const char*>(&numPoints), sizeof(numPoints));

        for (const auto& pt : points) {
            payload.append(reinterpret_cast<const char*>(&pt.time), sizeof(double));
            payload.append(reinterpret_cast<const char*>(&pt.value), sizeof(double));
        }

        auto [ok, msg] = sendCommand(blue::Command::CREATE_AUTOMATION, payload);
        uint32_t id = 0;
        if (ok && msg.size() >= sizeof(uint32_t)) {
            std::memcpy(&id, msg.data(), sizeof(uint32_t));
        }
        return {ok, id};
    }

    auto updateAutomation(const std::string& channelName,
                         AutomationCurve curve,
                         const std::vector<AutomationPoint>& points,
                         bool enabled = true,
                         double resolution = 0.0,
                         int32_t resolutionScale = 0,
                         bool highPrecision = false) {
        std::string payload = channelName;
        payload.push_back('\0');

        uint8_t curveVal = static_cast<uint8_t>(curve);
        uint8_t enabledVal = enabled ? 1 : 0;
        uint8_t highPrecisionVal = highPrecision ? 1 : 0;
        uint32_t numPoints = static_cast<uint32_t>(points.size());

        // payload: name\0 + curve(1B) + enabled(1B) + resolution(8B) + resolutionScale(4B) + highPrecision(1B) + n_points(4B) + points
        payload.append(reinterpret_cast<const char*>(&curveVal), sizeof(curveVal));
        payload.append(reinterpret_cast<const char*>(&enabledVal), sizeof(enabledVal));
        payload.append(reinterpret_cast<const char*>(&resolution), sizeof(double));
        payload.append(reinterpret_cast<const char*>(&resolutionScale), sizeof(int32_t));
        payload.append(reinterpret_cast<const char*>(&highPrecisionVal), sizeof(highPrecisionVal));
        payload.append(reinterpret_cast<const char*>(&numPoints), sizeof(numPoints));

        for (const auto& pt : points) {
            payload.append(reinterpret_cast<const char*>(&pt.time), sizeof(double));
            payload.append(reinterpret_cast<const char*>(&pt.value), sizeof(double));
        }

        return sendCommand(blue::Command::UPDATE_AUTOMATION, payload);
    }

    auto deleteAutomation(const std::string& channelName) {
        std::string payload = channelName + '\0';
        return sendCommand(blue::Command::DELETE_AUTOMATION, payload);
    }

    auto enableAutomation(const std::string& channelName) {
        std::string payload = channelName + '\0';
        return sendCommand(blue::Command::ENABLE_AUTOMATION, payload);
    }

    auto disableAutomation(const std::string& channelName) {
        std::string payload = channelName + '\0';
        return sendCommand(blue::Command::DISABLE_AUTOMATION, payload);
    }

    auto listAutomations() {
        return sendCommand(blue::Command::LIST_AUTOMATIONS);
    }

    auto clearAutomations() {
        return sendCommand(blue::Command::CLEAR_AUTOMATIONS);
    }

private:
    void* context_ = nullptr;
    void* socket_ = nullptr;
};

int main(int argc, char** argv) {
    int selectedTest = 0; // 0 = all tests
    for (int i = 1; i < argc; ++i) {
        if (std::strncmp(argv[i], "--test=", 7) == 0) {
            selectedTest = std::atoi(argv[i] + 7);
        } else if (std::strcmp(argv[i], "--test") == 0 && i + 1 < argc) {
            selectedTest = std::atoi(argv[i + 1]);
            ++i;
        }
    }

    std::cout << "Connecting to blue-engine...\n";

    BlueEngineClient client;

    // Compile orchestra using standard chnexport control channels.
    const char* orc = R"(
        sr = 44100
        ksmps = 64
        nchnls = 2
        0dbfs = 1

        gk_freq init 440
        gk_freq chnexport "freq", 3

        gk_amp init 0.5
        gk_amp chnexport "amp", 3

        instr 1
            aenv = linseg:a(0, 0.01, 1, p3 - 0.02, 1, 0.01, 0)
            asig = oscil:a(aenv * gk_amp, gk_freq)
            out(asig, asig)
        endin
    )";

    bool ok;
    std::string msg;

    if (selectedTest == 0 || selectedTest == 1) {
        // Create engine
        std::tie(ok, msg) = client.createEngine();
        std::cout << "create_engine: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";
        if (!ok) return 1;

        // Set options
        client.setOption("-odac");
        std::cout << "set_option(-odac): OK\n";

        client.setOption("-d");
        std::cout << "set_option(-d): OK\n";

        std::tie(ok, msg) = client.compileOrc(orc);
        std::cout << "compile_orc: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        // Create channels
        std::tie(ok, msg) = client.createChannel("freq", 440.0);
        std::cout << "create_channel(freq): " << (ok ? "OK" : "FAILED") << "\n";

        std::tie(ok, msg) = client.createChannel("amp", 0.5);
        std::cout << "create_channel(amp): " << (ok ? "OK" : "FAILED") << "\n";

        // Test 1: Manual channel updates
        std::cout << "\n=== Test 1: Manual Channel Updates ===\n";
        std::tie(ok, msg) = client.readScore("i1 0 5");
        std::cout << "read_score: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        // Start
        std::tie(ok, msg) = client.start();
        std::cout << "start: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        // Demonstrate channel updates
        std::cout << "Playing with channel updates...\n";
        int frequencies[] = {440, 550, 660, 880, 660, 550, 440};
        for (int freq : frequencies) {
            std::tie(ok, msg) = client.setChannel("freq", static_cast<double>(freq));
            std::cout << "  set freq=" << freq << ": " << (ok ? "OK" : "FAILED") << "\n";
            std::this_thread::sleep_for(std::chrono::milliseconds(400));
        }

        // Stop
        client.stop();
        std::cout << "stop: OK\n";

        // Destroy
        client.destroyEngine();
        std::cout << "destroy_engine: OK\n";
    }

    if (selectedTest == 0 || selectedTest == 2) {
        // Test 2: Automation system with LINEAR curve
        std::cout << "\n=== Test 2: LINEAR Curve Automation ===\n";
        std::tie(ok, msg) = client.createEngine();
        std::cout << "create_engine: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        client.setOption("-odac");
        client.setOption("-d");

        std::tie(ok, msg) = client.compileOrc(orc);
        std::cout << "compile_orc: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        std::tie(ok, msg) = client.createChannel("freq", 440.0);
        std::cout << "create_channel(freq): " << (ok ? "OK" : "FAILED") << "\n";

        std::tie(ok, msg) = client.createChannel("amp", 0.5);
        std::cout << "create_channel(amp): " << (ok ? "OK" : "FAILED") << "\n";

        std::vector<AutomationPoint> linearPoints = {{2.0, 440.0}, {4.0, 880.0}};
        auto [autoOk, autoId] = client.createAutomation("freq", AutomationCurve::LINEAR, linearPoints, false);
        std::cout << "create_automation (LINEAR): " << (autoOk ? "OK" : "FAILED") << ", ID=" << autoId << "\n";

        std::tie(ok, msg) = client.readScore("i1 0 6");
        std::cout << "read_score: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        std::tie(ok, msg) = client.start();
        std::cout << "start: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        std::cout << "Playing for 2 seconds with automation disabled (steady 440Hz)...\n";
        std::this_thread::sleep_for(std::chrono::seconds(2));

        std::cout << "Enabling LINEAR automation (440Hz -> 880Hz over 2 seconds)...\n";
        std::tie(ok, msg) = client.enableAutomation("freq");
        std::cout << "enable_automation: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        std::this_thread::sleep_for(std::chrono::milliseconds(2500));

        client.stop();
        std::cout << "stop: OK\n";
    }

    if (selectedTest == 0 || selectedTest == 3) {
        // Test 3: STEP curve
        std::cout << "\n=== Test 3: STEP Curve Automation ===\n";
        client.destroyEngine();
        std::tie(ok, msg) = client.createEngine();
        client.setOption("-odac");
        client.setOption("-d");
        client.compileOrc(orc);
        client.createChannel("freq", 440.0);
        client.createChannel("amp", 0.5);

        std::vector<AutomationPoint> stepPoints = {
            {2.0, 440.0}, {2.5, 550.0}, {3.0, 660.0}, {3.5, 880.0}, {4.0, 660.0}
        };
        auto [autoOk, autoId] = client.createAutomation("freq", AutomationCurve::STEP, stepPoints, false);
        std::cout << "create_automation (STEP): " << (autoOk ? "OK" : "FAILED") << ", ID=" << autoId << "\n";

        client.readScore("i1 0 6");
        client.start();

        std::cout << "Waiting 2 seconds before enabling STEP automation...\n";
        std::this_thread::sleep_for(std::chrono::seconds(2));

        std::cout << "Enabling STEP automation (frequency jumps every 0.5 seconds)...\n";
        std::tie(ok, msg) = client.enableAutomation("freq");
        std::cout << "enable_automation: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        std::this_thread::sleep_for(std::chrono::milliseconds(2500));

        client.stop();
        std::cout << "stop: OK\n";
    }

    if (selectedTest == 0 || selectedTest == 4) {
        // Test 4: EXPONENTIAL curve
        std::cout << "\n=== Test 4: EXPONENTIAL Curve Automation ===\n";
        client.destroyEngine();
        std::tie(ok, msg) = client.createEngine();
        client.setOption("-odac");
        client.setOption("-d");
        client.compileOrc(orc);
        client.createChannel("freq", 440.0);
        client.createChannel("amp", 0.5);

        std::vector<AutomationPoint> expPoints = {{2.0, 220.0}, {4.0, 880.0}};
        auto [autoOk, autoId] = client.createAutomation("freq", AutomationCurve::EXPONENTIAL, expPoints, false);
        std::cout << "create_automation (EXPONENTIAL): " << (autoOk ? "OK" : "FAILED") << ", ID=" << autoId << "\n";

        client.readScore("i1 0 6");
        client.start();

        std::cout << "Waiting 2 seconds before enabling EXPONENTIAL automation...\n";
        std::this_thread::sleep_for(std::chrono::seconds(2));

        std::cout << "Enabling EXPONENTIAL automation (220Hz -> 880Hz exponential curve)...\n";
        std::tie(ok, msg) = client.enableAutomation("freq");
        std::cout << "enable_automation: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        std::this_thread::sleep_for(std::chrono::milliseconds(2500));

        client.stop();
        std::cout << "stop: OK\n";

        // List automations
        std::cout << "\n=== Listing Automations ===\n";
        std::tie(ok, msg) = client.listAutomations();
        std::cout << "list_automations: " << (ok ? "OK" : "FAILED") << "\n";
        if (ok && msg.size() >= 4) {
            uint32_t count;
            std::memcpy(&count, msg.data(), sizeof(uint32_t));
            std::cout << "Found " << count << " automations\n";
        }

        // Clear all automations
        std::cout << "\nClearing all automations...\n";
        std::tie(ok, msg) = client.clearAutomations();
        std::cout << "clear_automations: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        // Final cleanup
        client.destroyEngine();
        std::cout << "destroy_engine: OK\n";
    }

    if (selectedTest == 0 || selectedTest == 5) {
        std::cout << "\n=== Test 5: LINEAR Automation with Resolution ===\n";
        std::tie(ok, msg) = client.createEngine();
        std::cout << "create_engine: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";
        client.setOption("-odac");
        client.setOption("-d");
        client.compileOrc(orc);
        client.createChannel("freq", 220.0);
        client.createChannel("amp", 0.5);

        std::vector<AutomationPoint> quantPoints = {{2.0, 220.0}, {6.0, 880.0}};
        double resolution = 100.0;
        auto [autoOk, autoId] = client.createAutomation("freq", AutomationCurve::LINEAR, quantPoints, false, resolution);
        std::cout << "create_automation (LINEAR + resolution=" << resolution << "): "
                  << (autoOk ? "OK" : "FAILED") << ", ID=" << autoId << "\n";

        client.readScore("i1 0 8");
        client.start();

        std::cout << "Waiting 2 seconds before enabling quantized automation...\n";
        std::this_thread::sleep_for(std::chrono::seconds(2));

        std::cout << "Enabling quantized LINEAR automation (listen for stepped pitch changes)...\n";
        std::tie(ok, msg) = client.enableAutomation("freq");
        std::cout << "enable_automation: " << (ok ? "OK" : "FAILED") << " " << msg << "\n";

        std::this_thread::sleep_for(std::chrono::milliseconds(4500));

        client.stop();
        std::cout << "stop: OK\n";

        client.destroyEngine();
        std::cout << "destroy_engine: OK\n";
    }

    std::cout << "\nAll tests completed!\n";
    return 0;
}
