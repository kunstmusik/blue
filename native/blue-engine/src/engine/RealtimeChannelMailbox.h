#pragma once

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace blue {

struct ResolvedChannelValue {
  double *pointer = nullptr;
  double value = 0.0;
};

// Single-producer/single-consumer handoff for complete control-channel batches.
// enqueue() runs on the control thread; consumeOne() runs between k-cycles on
// the performance thread. Slots are fixed-capacity so the consumer never locks,
// allocates, retries, or performs unbounded work.
class RealtimeChannelMailbox {
public:
  static constexpr size_t kCapacity = 128;
  static constexpr size_t kMaxBatchEntries = 256;

  enum class EnqueueResult : uint8_t {
    Accepted,
    Full,
    InvalidBatch,
  };

  enum class ConsumeResult : uint8_t {
    Empty,
    Applied,
    StaleGeneration,
  };

  EnqueueResult enqueue(
      uint64_t bindingGeneration,
      const std::vector<ResolvedChannelValue> &entries) noexcept {
    if (entries.empty() || entries.size() > kMaxBatchEntries) {
      return EnqueueResult::InvalidBatch;
    }
    for (const auto &entry : entries) {
      if (!entry.pointer) {
        return EnqueueResult::InvalidBatch;
      }
    }

    const uint64_t write = writeIndex_.load(std::memory_order_relaxed);
    const uint64_t read = readIndex_.load(std::memory_order_acquire);
    if (write - read >= kCapacity) {
      return EnqueueResult::Full;
    }

    Slot &slot = slots_[write % kCapacity];
    slot.bindingGeneration = bindingGeneration;
    slot.entryCount = entries.size();
    for (size_t index = 0; index < entries.size(); ++index) {
      slot.entries[index] = entries[index];
    }
    writeIndex_.store(write + 1, std::memory_order_release);
    return EnqueueResult::Accepted;
  }

  ConsumeResult consumeOne(uint64_t activeBindingGeneration) noexcept {
    const uint64_t read = readIndex_.load(std::memory_order_relaxed);
    const uint64_t write = writeIndex_.load(std::memory_order_acquire);
    if (read == write) {
      return ConsumeResult::Empty;
    }

    const Slot &slot = slots_[read % kCapacity];
    if (slot.bindingGeneration != activeBindingGeneration) {
      readIndex_.store(read + 1, std::memory_order_release);
      return ConsumeResult::StaleGeneration;
    }

    for (size_t index = 0; index < slot.entryCount; ++index) {
      *slot.entries[index].pointer = slot.entries[index].value;
    }
    readIndex_.store(read + 1, std::memory_order_release);
    return ConsumeResult::Applied;
  }

  // Requires producer and consumer to be quiescent. Lifecycle code calls this
  // only after joining the performance thread.
  void reset() noexcept {
    readIndex_.store(0, std::memory_order_relaxed);
    writeIndex_.store(0, std::memory_order_relaxed);
  }

private:
  struct Slot {
    uint64_t bindingGeneration = 0;
    size_t entryCount = 0;
    std::array<ResolvedChannelValue, kMaxBatchEntries> entries{};
  };

  std::array<Slot, kCapacity> slots_{};
  alignas(64) std::atomic<uint64_t> writeIndex_{0};
  alignas(64) std::atomic<uint64_t> readIndex_{0};
};

static_assert(std::atomic<uint64_t>::is_always_lock_free,
              "Realtime channel mailbox indices must be lock-free");

} // namespace blue
