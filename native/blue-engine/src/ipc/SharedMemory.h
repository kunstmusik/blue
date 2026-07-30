#pragma once

#include <string>
#include <cstdint>
#include <atomic>

namespace blue {

// Shared memory layout:
// [Header: 64 bytes]
//   - magic (4 bytes): "BLUE"
//   - version (4 bytes): 1
//   - num_channels (4 bytes): current channel count
//   - max_channels (4 bytes): maximum channels
//   - reserved (48 bytes)
// [Channel entries: max_channels * sizeof(ChannelEntry)]
//   - name (64 bytes): null-terminated string
//   - value (8 bytes): double value
//   - flags (4 bytes): channel type flags
//   - reserved (4 bytes)

constexpr size_t CHANNEL_NAME_SIZE = 64;
constexpr size_t MAX_CHANNELS = 256;
constexpr uint32_t SHM_MAGIC = 0x454C5542;  // "BLUE"
constexpr uint32_t SHM_VERSION = 1;

struct ShmHeader {
    uint32_t magic;
    uint32_t version;
    std::atomic<uint32_t> num_channels;
    uint32_t max_channels;
    uint8_t reserved[48];
};

struct ChannelEntry {
    char name[CHANNEL_NAME_SIZE];
    std::atomic<double> value;
    uint32_t flags;
    uint32_t reserved;
};

static_assert(sizeof(ShmHeader) == 64, "ShmHeader must be 64 bytes");
static_assert(sizeof(ChannelEntry) == 80, "ChannelEntry must be 80 bytes");

class SharedMemory {
public:
    SharedMemory();
    ~SharedMemory();

    // Non-copyable
    SharedMemory(const SharedMemory&) = delete;
    SharedMemory& operator=(const SharedMemory&) = delete;

    // Create shared memory region (server side)
    bool create(const std::string& name);

    // Open existing shared memory region (client side)
    bool open(const std::string& name);

    // Close/destroy shared memory
    void close();

    // Channel operations
    bool createChannel(const std::string& name, double initialValue = 0.0);
    bool setChannel(const std::string& name, double value);
    bool getChannel(const std::string& name, double& value);

    // Get channel count
    uint32_t getChannelCount() const;

    // Get channel by index (for iteration)
    bool getChannelByIndex(uint32_t index, std::string& name, double& value) const;

    // Check if open
    bool isOpen() const { return data_ != nullptr; }

    // Get shared memory name for clients
    const std::string& getName() const { return name_; }

    // Get direct pointer to channel entry (for opcode caching)
    // Returns nullptr if channel doesn't exist
    ChannelEntry* getChannelEntry(const std::string& name);

    // Get or create channel entry (for opcode caching)
    ChannelEntry* getOrCreateChannelEntry(const std::string& name, double initialValue = 0.0);

private:
    ChannelEntry* findChannel(const std::string& name);
    ChannelEntry* findOrCreateChannel(const std::string& name);

    std::string name_;
    void* data_ = nullptr;
    size_t size_ = 0;
    bool isOwner_ = false;

#ifdef _WIN32
    void* hMapFile_ = nullptr;  // HANDLE
#else
    int fd_ = -1;
#endif

    ShmHeader* header() { return static_cast<ShmHeader*>(data_); }
    const ShmHeader* header() const { return static_cast<const ShmHeader*>(data_); }
    ChannelEntry* channels() {
        return reinterpret_cast<ChannelEntry*>(static_cast<uint8_t*>(data_) + sizeof(ShmHeader));
    }
    const ChannelEntry* channels() const {
        return reinterpret_cast<const ChannelEntry*>(static_cast<const uint8_t*>(data_) + sizeof(ShmHeader));
    }
};

}  // namespace blue
