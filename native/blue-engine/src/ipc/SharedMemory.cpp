#include "SharedMemory.h"

#include <cstring>
#include <cstdio>

#ifdef _WIN32
    #define WIN32_LEAN_AND_MEAN
    #include <windows.h>
#else
    #include <sys/mman.h>
    #include <sys/stat.h>
    #include <fcntl.h>
    #include <unistd.h>
#endif

namespace blue {

namespace {

bool sameDoubleBits(double left, double right) {
    uint64_t leftBits = 0;
    uint64_t rightBits = 0;
    std::memcpy(&leftBits, &left, sizeof(left));
    std::memcpy(&rightBits, &right, sizeof(right));
    return leftBits == rightBits;
}

}  // namespace

SharedMemory::SharedMemory() = default;

SharedMemory::~SharedMemory() {
    close();
}

#ifdef _WIN32
// ============================================================================
// Windows implementation
// ============================================================================

bool SharedMemory::create(const std::string& name) {
    if (data_) {
        return false;  // Already open
    }

    name_ = name;  // Windows doesn't need leading slash
    size_ = sizeof(ShmHeader) + MAX_CHANNELS * sizeof(ChannelEntry);

    // Create file mapping object
    hMapFile_ = CreateFileMappingA(
        INVALID_HANDLE_VALUE,    // Use paging file
        nullptr,                 // Default security
        PAGE_READWRITE,          // Read/write access
        0,                       // High-order DWORD of size
        static_cast<DWORD>(size_), // Low-order DWORD of size
        name_.c_str()            // Name of mapping object
    );

    if (hMapFile_ == nullptr) {
        std::fprintf(stderr, "CreateFileMapping failed: %lu\n", GetLastError());
        return false;
    }

    // Map view of file
    data_ = MapViewOfFile(
        hMapFile_,               // Handle to map object
        FILE_MAP_ALL_ACCESS,     // Read/write permission
        0, 0,                    // Offset
        size_                    // Number of bytes to map
    );

    if (data_ == nullptr) {
        std::fprintf(stderr, "MapViewOfFile failed: %lu\n", GetLastError());
        CloseHandle(hMapFile_);
        hMapFile_ = nullptr;
        return false;
    }

    // Initialize header
    std::memset(data_, 0, size_);
    header()->magic = SHM_MAGIC;
    header()->version = SHM_VERSION;
    header()->num_channels.store(0, std::memory_order_release);
    header()->max_channels = MAX_CHANNELS;

    isOwner_ = true;
    return true;
}

bool SharedMemory::open(const std::string& name) {
    if (data_) {
        return false;  // Already open
    }

    name_ = name;
    size_ = sizeof(ShmHeader) + MAX_CHANNELS * sizeof(ChannelEntry);

    // Open existing file mapping object
    hMapFile_ = OpenFileMappingA(
        FILE_MAP_ALL_ACCESS,     // Read/write access
        FALSE,                   // Do not inherit handle
        name_.c_str()            // Name of mapping object
    );

    if (hMapFile_ == nullptr) {
        std::fprintf(stderr, "OpenFileMapping failed: %lu\n", GetLastError());
        return false;
    }

    // Map view of file
    data_ = MapViewOfFile(
        hMapFile_,               // Handle to map object
        FILE_MAP_ALL_ACCESS,     // Read/write permission
        0, 0,                    // Offset
        size_                    // Number of bytes to map
    );

    if (data_ == nullptr) {
        std::fprintf(stderr, "MapViewOfFile failed: %lu\n", GetLastError());
        CloseHandle(hMapFile_);
        hMapFile_ = nullptr;
        data_ = nullptr;
        return false;
    }

    // Validate header
    if (header()->magic != SHM_MAGIC || header()->version != SHM_VERSION) {
        std::fprintf(stderr, "Invalid shared memory header\n");
        UnmapViewOfFile(data_);
        CloseHandle(hMapFile_);
        hMapFile_ = nullptr;
        data_ = nullptr;
        return false;
    }

    isOwner_ = false;
    return true;
}

void SharedMemory::close() {
    if (data_) {
        UnmapViewOfFile(data_);
        data_ = nullptr;
    }

    if (hMapFile_) {
        CloseHandle(hMapFile_);
        hMapFile_ = nullptr;
    }

    name_.clear();
    isOwner_ = false;
}

#else
// ============================================================================
// POSIX implementation (macOS, Linux)
// ============================================================================

bool SharedMemory::create(const std::string& name) {
    if (data_) {
        return false;  // Already open
    }

    name_ = "/" + name;  // POSIX shm names must start with /
    size_ = sizeof(ShmHeader) + MAX_CHANNELS * sizeof(ChannelEntry);

    // Create shared memory object
    fd_ = shm_open(name_.c_str(), O_CREAT | O_RDWR, 0666);
    if (fd_ == -1) {
        std::perror("shm_open");
        return false;
    }

    // Set size
    if (ftruncate(fd_, size_) == -1) {
        std::perror("ftruncate");
        ::close(fd_);
        shm_unlink(name_.c_str());
        fd_ = -1;
        return false;
    }

    // Map memory
    data_ = mmap(nullptr, size_, PROT_READ | PROT_WRITE, MAP_SHARED, fd_, 0);
    if (data_ == MAP_FAILED) {
        std::perror("mmap");
        ::close(fd_);
        shm_unlink(name_.c_str());
        fd_ = -1;
        data_ = nullptr;
        return false;
    }

    // Initialize header
    std::memset(data_, 0, size_);
    header()->magic = SHM_MAGIC;
    header()->version = SHM_VERSION;
    header()->num_channels.store(0, std::memory_order_release);
    header()->max_channels = MAX_CHANNELS;

    isOwner_ = true;
    return true;
}

bool SharedMemory::open(const std::string& name) {
    if (data_) {
        return false;  // Already open
    }

    name_ = "/" + name;
    size_ = sizeof(ShmHeader) + MAX_CHANNELS * sizeof(ChannelEntry);

    // Open existing shared memory object
    fd_ = shm_open(name_.c_str(), O_RDWR, 0666);
    if (fd_ == -1) {
        std::perror("shm_open");
        return false;
    }

    // Map memory
    data_ = mmap(nullptr, size_, PROT_READ | PROT_WRITE, MAP_SHARED, fd_, 0);
    if (data_ == MAP_FAILED) {
        std::perror("mmap");
        ::close(fd_);
        fd_ = -1;
        data_ = nullptr;
        return false;
    }

    // Validate header
    if (header()->magic != SHM_MAGIC || header()->version != SHM_VERSION) {
        std::fprintf(stderr, "Invalid shared memory header\n");
        munmap(data_, size_);
        ::close(fd_);
        fd_ = -1;
        data_ = nullptr;
        return false;
    }

    isOwner_ = false;
    return true;
}

void SharedMemory::close() {
    if (data_) {
        munmap(data_, size_);
        data_ = nullptr;
    }

    if (fd_ != -1) {
        ::close(fd_);
        fd_ = -1;
    }

    if (isOwner_ && !name_.empty()) {
        shm_unlink(name_.c_str());
    }

    name_.clear();
    isOwner_ = false;
}

#endif  // _WIN32

ChannelEntry* SharedMemory::findChannel(const std::string& name) {
    if (!data_) return nullptr;

    uint32_t count = header()->num_channels.load(std::memory_order_acquire);
    ChannelEntry* entries = channels();

    for (uint32_t i = 0; i < count; ++i) {
        if (std::strncmp(entries[i].name, name.c_str(), CHANNEL_NAME_SIZE - 1) == 0) {
            return &entries[i];
        }
    }

    return nullptr;
}

ChannelEntry* SharedMemory::findOrCreateChannel(const std::string& name) {
    ChannelEntry* entry = findChannel(name);
    if (entry) return entry;

    // Create new channel
    uint32_t index = header()->num_channels.load(std::memory_order_acquire);
    if (index >= header()->max_channels) {
        return nullptr;  // Full
    }

    entry = &channels()[index];
    std::strncpy(entry->name, name.c_str(), CHANNEL_NAME_SIZE - 1);
    entry->name[CHANNEL_NAME_SIZE - 1] = '\0';
    entry->value.store(0.0, std::memory_order_relaxed);
    entry->flags = 0;

    header()->num_channels.fetch_add(1, std::memory_order_release);
    return entry;
}

bool SharedMemory::createChannel(const std::string& name, double initialValue) {
    if (!data_) return false;

    ChannelEntry* entry = findOrCreateChannel(name);
    if (!entry) return false;

    const double currentValue = entry->value.load(std::memory_order_relaxed);
    if (!sameDoubleBits(currentValue, initialValue)) {
        entry->value.store(initialValue, std::memory_order_relaxed);
    }
    return true;
}

bool SharedMemory::setChannel(const std::string& name, double value) {
    if (!data_) return false;

    ChannelEntry* entry = findChannel(name);
    if (!entry) return false;

    const double currentValue = entry->value.load(std::memory_order_relaxed);
    if (!sameDoubleBits(currentValue, value)) {
        entry->value.store(value, std::memory_order_relaxed);
    }
    return true;
}

bool SharedMemory::getChannel(const std::string& name, double& value) {
    if (!data_) return false;

    ChannelEntry* entry = findChannel(name);
    if (!entry) return false;

    value = entry->value.load(std::memory_order_relaxed);
    return true;
}

uint32_t SharedMemory::getChannelCount() const {
    if (!data_) return 0;
    return header()->num_channels.load(std::memory_order_acquire);
}

bool SharedMemory::getChannelByIndex(uint32_t index, std::string& name, double& value) const {
    if (!data_) return false;

    uint32_t count = header()->num_channels.load(std::memory_order_acquire);
    if (index >= count) return false;

    const ChannelEntry* entry = &channels()[index];
    name = entry->name;
    value = entry->value.load(std::memory_order_relaxed);
    return true;
}

ChannelEntry* SharedMemory::getChannelEntry(const std::string& name) {
    return findChannel(name);
}

ChannelEntry* SharedMemory::getOrCreateChannelEntry(const std::string& name, double initialValue) {
    ChannelEntry* entry = findOrCreateChannel(name);
    if (entry) {
        const double currentValue = entry->value.load(std::memory_order_relaxed);
        if (sameDoubleBits(currentValue, 0.0) &&
            !sameDoubleBits(currentValue, initialValue)) {
            entry->value.store(initialValue, std::memory_order_relaxed);
        }
    }
    return entry;
}

}  // namespace blue
