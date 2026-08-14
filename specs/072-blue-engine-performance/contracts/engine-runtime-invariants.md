# Contract: Blue Engine Internal Runtime Invariants and Memory Boundaries

**Feature**: `072-blue-engine-performance`  
**Date**: 2026-08-13  
**Status**: Active  

---

## 1. Scope and Authority

This document defines the strict internal invariants, thread synchronization contracts, and memory ordering guarantees for the Blue Engine native runtime (`native/blue-engine`). These contracts govern:
- Real-time performance loop safety
- Lock-free snapshot publication and reclamation
- Shared memory IPC integrity
- Csound runtime channel pointer lifecycle

---

## 2. Invariants

### INV-001: Hard Real-Time Lock Freedom in `performThread()`
- Under no circumstances shall `CsoundEngine::performThread()`, `AutomationManager::process()`, or `CsoundEngine::syncSharedMemoryFromChannels()` acquire `std::mutex`, `std::recursive_mutex`, `std::unique_lock`, `std::lock_guard`, or call functions that invoke OS/library locking primitives (`pthread_mutex_lock`, `EnterCriticalSection`, `__sp_mut::lock`).
- All synchronization across threads must use lock-free atomic variables (`std::atomic<T>`) verified with `static_assert(std::atomic<T>::is_always_lock_free)`.

### INV-002: Snapshot Publication and Acquisition Ordering
- Any multi-word immutable snapshot (e.g., `AutomationList`, `RuntimeChannelBindingSnapshot`) must be published via an atomic `std::shared_ptr` store with `std::memory_order_release` immediately followed by an atomic generation increment with `std::memory_order_release`:
  ```cpp
  // Writer (Control Plane)
  std::atomic_store_explicit(&snapshotPtr_, nextSnapshot, std::memory_order_release);
  revision_.fetch_add(1, std::memory_order_release);
  ```
- The real-time reader must read the generation with `std::memory_order_acquire`. The atomic `shared_ptr` load is executed if and only if the observed generation differs from the thread-local cached generation:
  ```cpp
  // Reader (Real-Time Audio Thread)
  const uint64_t observedRev = revision_.load(std::memory_order_acquire);
  if (observedRev != cachedRev_) {
      cachedSnapshot_ = std::atomic_load_explicit(&snapshotPtr_, std::memory_order_acquire);
      cachedRev_ = observedRev;
  }
  ```

### INV-003: Csound Channel Pointer Lifetime & Rebinding Safety
- Direct `double*` pointers pointing to native Csound control channel storage are valid only within the lifetime of the active Csound instance and orchestra configuration.
- During live orchestra compilation (`csoundCompileOrc()`), Csound may reallocate or invalidate existing channel memory. The control thread must:
  1. Rebuild the channel cache.
  2. Instantiate a new `RuntimeChannelBindingSnapshot`.
  3. Publish the new snapshot via the release/acquire generation protocol.
- The audio thread must not dereference cached channel pointers across a generation change without re-verifying the binding against the newly acquired snapshot.

### INV-004: Shared Memory Scalar Ordering & Deduplication
- `ChannelEntry::value` stores and loads must use `std::memory_order_relaxed`.
- Writers must compare the IEEE 754 64-bit object representation (via bit casting or `std::memcmp`) before issuing an atomic store.
- Binary comparison must preserve distinct bit patterns including `+0.0` vs `-0.0`, infinities (`+inf`, `-inf`), and specific NaN payloads.
- `ShmHeader::num_channels` must be stored with `std::memory_order_release` and read with `std::memory_order_acquire` to ensure all initialized `ChannelEntry` records are visible before the count is exposed.

### INV-005: Automation Definition Invalidation & Numerical Parity
- Every automation definition update must advance its internal `definitionRevision`.
- An automation curve that has completed its playback duration (`elapsed >= points.back().time`) may bypass interpolation calculations if and only if:
  1. `state.completed == true`
  2. `state.cachedDefRevision == def.definitionRevision`
  3. `elapsed >= state.lastElapsed` (no rewind or seek)
- Any modification to points, curve type, or resolution must invalidate the completed state and recompute cached segment invariants.
- High-precision quantization must match the accepted Java Blue fixture set and preserve the same integer quantization grid while finite scaled values fit the bounded `int64_t` representation. This contract does not claim arbitrary-precision or universal bit-exact `BigDecimal(double)` output. The current cached path can differ from the old normalized `FixedPoint::toDouble()` representation by a small binary64 rounding difference at higher scales; universal bit-exact output remains a follow-up if it becomes a product requirement.

---

## 3. Protocol & Persistence Immutability

- **Engine-Client ZMQ Protocol**: The message schemas in `src/protocol/Protocol.h` (commands `0x01` through `0x26`) remain strictly unchanged.
- **External Serialization**: `.blue` XML persistence, project models, and CSD generation templates in `@blue/data` remain strictly unchanged.
