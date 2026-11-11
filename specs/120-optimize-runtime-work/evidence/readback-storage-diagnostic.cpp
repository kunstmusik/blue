// Original diagnostic using Blue's existing MIT native SharedMemory interface.
// Component proxy only: no Csound, transport, concurrency or device timing claim.
#include "ipc/SharedMemory.h"
#include <array>
#include <chrono>
#include <cstring>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <unistd.h>

struct alignas(64) LocalMirror {
    blue::ShmHeader header{};
    std::array<blue::ChannelEntry, blue::MAX_CHANNELS> entries{};
};
using Bindings = std::array<blue::ChannelEntry*, blue::MAX_CHANNELS>;

static double sample(const Bindings& bindings, size_t count, bool changing) {
    const auto begin = std::chrono::steady_clock::now();
    for (size_t cycle = 0; cycle < 16384; ++cycle) {
        const double next = changing ? (cycle & 1) * 0.5 : 0.5;
        uint64_t nextBits;
        std::memcpy(&nextBits, &next, sizeof(nextBits));
        for (size_t channel = 0; channel < count; ++channel) {
            const double prior = bindings[channel]->value.load(std::memory_order_relaxed);
            uint64_t priorBits;
            std::memcpy(&priorBits, &prior, sizeof(priorBits));
            if (priorBits != nextBits) bindings[channel]->value.store(next, std::memory_order_relaxed);
        }
    }
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - begin).count();
}

int main() {
    blue::SharedMemory mapped;
    if (!mapped.create("be120-readback-" + std::to_string(getpid()))) throw std::runtime_error("mapping failed");
    auto local = std::make_unique<LocalMirror>();
    Bindings os{}, heap{};
    for (size_t i = 0; i < blue::MAX_CHANNELS; ++i) {
        os[i] = mapped.getOrCreateChannelEntry("channel_" + std::to_string(i), 0.5);
        heap[i] = &local->entries[i];
        heap[i]->value.store(0.5, std::memory_order_relaxed);
        if (!os[i]) throw std::runtime_error("entry allocation failed");
    }
    std::cout << "{\"classification\":\"same-layout storage-only diagnostic, not performance acceptance\",\"entryBytes\":" << sizeof(blue::ChannelEntry) << ",\"cyclesPerSample\":16384,\"warmupPairs\":5,\"measuredPairs\":30,\"results\":[";
    bool comma = false;
    for (size_t count : {size_t(0), size_t(64), size_t(256)}) {
        for (bool changing : {false, true}) {
            for (int round = -5; round < 30; ++round) {
                double mappedMs, localMs;
                if ((round & 1) == 0) { mappedMs = sample(os, count, changing); localMs = sample(heap, count, changing); }
                else { localMs = sample(heap, count, changing); mappedMs = sample(os, count, changing); }
                for (size_t i = 0; i < count; ++i) {
                    if (os[i]->value.load() != heap[i]->value.load()) throw std::runtime_error("readback mismatch");
                }
                if (round < 0) continue;
                if (comma) std::cout << ',';
                comma = true;
                std::cout << "{\"channels\":" << count << ",\"changing\":" << (changing ? "true" : "false") << ",\"pair\":" << round << ",\"mappedMs\":" << mappedMs << ",\"localMs\":" << localMs << '}';
            }
        }
    }
    std::cout << "]}\n";
}
