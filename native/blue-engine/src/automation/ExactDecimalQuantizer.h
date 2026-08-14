#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "JavaBigDecimal.h"

namespace blue {

/**
 * Counts exact-decimal allocations that bypassed an active arena (no arena
 * bound to the thread, or arena exhaustion). This is a realtime-safety
 * contract violation: tests hard-fail when it is nonzero after preparation.
 */
std::atomic<uint64_t>& decimalUpstreamAllocationCount();

/**
 * Feature-owned fixed bump arena backing audio-thread exact-decimal
 * arithmetic. The control thread sizes and allocates the backing storage
 * during preparation; the single performance-thread consumer resets the
 * cursor before each evaluation and never frees individual objects.
 */
class DecimalArena {
public:
    void initialize(std::size_t capacityBytes);

    // The arena is logically const once prepared: reset/tryAllocate serve the
    // single performance-thread consumer of an immutable prepared quantizer
    // (the cursor and counters are mutable per the ownership contract).
    void reset() const noexcept;
    void* tryAllocate(std::size_t bytes) const noexcept;
    bool contains(const void* pointer) const noexcept;

    std::size_t capacityBytes() const noexcept { return backing_.size(); }
    std::size_t highWaterBytes() const noexcept { return highWater_; }
    uint64_t overflowCount() const noexcept { return overflowCount_; }

private:
    std::vector<std::byte> backing_;
    mutable std::size_t cursor_ = 0;
    mutable std::size_t highWater_ = 0;
    mutable uint64_t overflowCount_ = 0;
};

/** The arena bound to the current thread; null outside an evaluation. */
DecimalArena* activeDecimalArena() noexcept;
void setActiveDecimalArena(DecimalArena* arena) noexcept;

/**
 * Stateless allocator routing cpp_int limb storage to the thread's active
 * bump arena. Deallocation inside the arena is a no-op (reclaimed on reset);
 * anything outside falls back to the system allocator and increments the
 * upstream counter, preserving correctness while exposing the violation.
 */
template <class T>
class DecimalArenaAllocator {
public:
    using value_type = T;

    DecimalArenaAllocator() noexcept = default;
    template <class U>
    DecimalArenaAllocator(const DecimalArenaAllocator<U>&) noexcept {}

    template <class U>
    struct rebind {
        using other = DecimalArenaAllocator<U>;
    };

    T* allocate(std::size_t n) {
        if (DecimalArena* arena = activeDecimalArena()) {
            if (void* pointer = arena->tryAllocate(n * sizeof(T))) {
                return static_cast<T*>(pointer);
            }
        }
        decimalUpstreamAllocationCount().fetch_add(1, std::memory_order_relaxed);
        return std::allocator<T>{}.allocate(n);
    }

    void deallocate(T* pointer, std::size_t n) noexcept {
        if (DecimalArena* arena = activeDecimalArena()) {
            if (arena->contains(pointer)) {
                return;  // reclaimed wholesale on the next reset
            }
        }
        std::allocator<T>{}.deallocate(pointer, n);
    }
};

template <class T, class U>
bool operator==(const DecimalArenaAllocator<T>&, const DecimalArenaAllocator<U>&) noexcept {
    return true;
}

template <class T, class U>
bool operator!=(const DecimalArenaAllocator<T>&, const DecimalArenaAllocator<U>&) noexcept {
    return false;
}

/** Arbitrary-precision integer whose dynamic storage comes from the arena. */
using ArenaInt = boost::multiprecision::number<
    boost::multiprecision::cpp_int_backend<0, 0, boost::multiprecision::signed_magnitude,
                                           boost::multiprecision::unchecked,
                                           DecimalArenaAllocator<boost::multiprecision::limb_type>>,
    boost::multiprecision::et_off>;

/**
 * Control-thread-prepared exact resolution for the performance thread.
 *
 * Preparation parses and validates the resolution, precomputes the exact
 * power-of-ten inputs, sizes and allocates the arena from a worst-case bound,
 * and publishes an immutable object. The performance thread only resets the
 * arena cursor and runs the exact Java quantization sequence; it never parses,
 * locks, logs, or reaches the system allocator.
 *
 * Single consumer: exactly one performance thread may call quantize(). All
 * mutation happens inside quantize() between reset() and return.
 */
class ExactDecimalQuantizer {
public:
    /**
     * Prepares a quantizer for the validated resolution. Returns null with a
     * diagnostic message when the workspace cannot be established; the caller
     * keeps the previous definition intact in that case.
     */
    static std::unique_ptr<ExactDecimalQuantizer> prepare(const JavaBigDecimal& resolution,
                                                          std::string* error);

    double resolutionDouble() const noexcept { return resolutionDouble_; }
    /** Java activation: resolutionDouble() > 0.0. */
    bool quantizationActive() const noexcept { return resolutionDouble_ > 0.0; }
    int32_t scale() const noexcept { return scale_; }
    const std::string& canonicalText() const noexcept { return canonicalText_; }
    const JavaBigDecimal& resolution() const noexcept { return resolution_; }

    /**
     * Java quantization of an interpolated double:
     * new BigDecimal(y).setScale(scale, FLOOR).subtract(remainder(resolution))
     * converted back with doubleValue(). Returns false when y is non-finite
     * (the caller keeps the last channel value and counts a diagnostic) or
     * when the arena contract was violated.
     */
    bool quantize(double y, double* out) const noexcept;

    const DecimalArena& arena() const noexcept { return arena_; }
    uint64_t invalidInputCount() const noexcept { return invalidInputCount_; }
    uint64_t evaluationCount() const noexcept { return evaluationCount_; }

private:
    friend std::unique_ptr<ExactDecimalQuantizer> std::make_unique<ExactDecimalQuantizer>();
    ExactDecimalQuantizer() = default;

    JavaBigDecimal resolution_;
    std::string canonicalText_;
    int32_t scale_ = 0;
    double resolutionDouble_ = 0.0;
    BlueBigInt coefficientAbs_;   // |resolution coefficient| at scale_
    std::string coefficientAbsText_;  // precomputed to avoid runtime formatting
    BlueBigInt pow10Abs_;         // 10^|scale_| when scale_ != 0
    mutable DecimalArena arena_;
    mutable uint64_t evaluationCount_ = 0;
    mutable uint64_t invalidInputCount_ = 0;
};

}  // namespace blue
