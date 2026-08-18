#pragma once

#include <string>
#include <memory>
#include <atomic>
#include <mutex>
#include <vector>

#include "engine/CsoundEngine.h"

namespace blue {

class SharedMemory;

class ZmqHandler {
public:
    explicit ZmqHandler(CsoundEngine& engine, SharedMemory& shm);
    ~ZmqHandler();

    // Non-copyable
    ZmqHandler(const ZmqHandler&) = delete;
    ZmqHandler& operator=(const ZmqHandler&) = delete;

    // Initialize and bind to control and pubsub endpoints.
    bool bind(int port, int pubPort);
    bool bind(const std::string& controlEndpoint, const std::string& pubEndpoint);

    // Process one request, using a bounded poll so other threads can request
    // shutdown without touching ZeroMQ sockets they do not own.
    // Returns false if should shutdown
    bool processOne();

    // Request shutdown
    void requestShutdown();

    bool isShutdownRequested() const { return shutdownRequested_.load(); }

private:
    CsoundEngine& engine_;
    SharedMemory& shm_;
    void* context_ = nullptr;
    void* controlSocket_ = nullptr;
    void* pubSocket_ = nullptr;
    std::atomic<bool> shutdownRequested_{false};
    int controlPort_ = 0;
    int pubPort_ = 0;
    std::mutex pendingStateMutex_;
    std::vector<EngineStateSnapshot> pendingStateSnapshots_;

    void enqueueStateSnapshot(const EngineStateSnapshot &snapshot);
    void publishPendingStateSnapshots();
    void publishStateSnapshot(const EngineStateSnapshot &snapshot);
    static std::string serializeStateSnapshot(const EngineStateSnapshot &snapshot);
    static const char* stateToString(EngineLifecycleState state);
    static const char* stopReasonToString(EngineStopReason stopReason);
    static std::string escapeJsonString(const std::string &value);
};

}  // namespace blue
