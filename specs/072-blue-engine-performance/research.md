# Research & Decision Log: Blue Engine Host Performance and Real-Time Safety

**Feature**: `072-blue-engine-performance`  
**Date**: 2026-08-13  
**Status**: Completed  

---

## 1. Release Benchmark Driver & Workload Matrix

### Context & Problem
The existing repository has a `test:profiling` command, but it runs on a Debug build against synthetic test cases with 1–2 channels and dummy audio timing. It does not run representative Csound workloads in Release mode (`-O3`), does not execute a standardized warmup, and does not record or compare statistical percentiles (average, p95, max, spikes) across multiple trials.

### Decision
Implement a dedicated, standalone Release benchmark driver (`benchmark_engine`) within `native/blue-engine` that exercises the actual `CsoundEngine` performance path across a standardized workload matrix.

### Architecture & Protocol
1. **Build Configuration**: Built exclusively in `Release` configuration with `BLUE_ENGINE_USE_PERFORMANCE_TRACKING=1`.
2. **Measurement Window**:
   - Minimum 1,024 k-cycle warmup phase (unmeasured to eliminate cache and JIT cold starts).
   - Standard measurement phase of at least 4,096 consecutive k-cycles (matching `kSampleWindowCapacity`).
   - 5 independent runs per workload scenario; results evaluated via the median trial.
3. **Scenarios Matrix**:
   - **Idle host baseline**: 0 channels, 0 automations.
   - **Static channel mirrors**: 1, 32, 128, 256 channels with unchanging values (tests deduplicated mirror stores).
   - **Changing channel mirrors**: 1, 32, 128, 256 channels updated every k-cycle by Csound (tests worst-case load-compare-store).
   - **Linear automation ramps**: 1, 32, 128, 256 channels driven by linear envelopes (tests segment caching and normalized time math).
   - **Exponential automation ramps**: 1, 32, 128, 256 channels driven by exponential curves (tests segment `logRatio` caching).
   - **Quantized automation**: Fast double and high-precision modes (tests integer-scaled precomputed quantization).
   - **Completed envelopes**: 32–256 envelopes past their final point (tests early-out bypass).
   - **Live definition updates**: Envelopes mutated at ~30 Hz during active playback (tests snapshot rebuild cost).
   - **Live orchestra compilation**: Rebuilding orchestra and channels during playback (tests rebinding and lifetime safety).
   - **Missing channel bindings**: Envelopes targeting non-existent channels (tests avoidance of per-period mutex lookups).
4. **Machine-Readable Output**: JSON artifact capturing environment metadata (compiler, architecture, OS, sample rate, ksmps) and per-bucket metrics (`auto`, `shm`, `host_total`, `perform_ksmps`, spikes).

### Alternatives Considered
- *Using node-based integration test benchmarks*: Rejected because IPC latency over Node-ZeroMQ introduces external process jitter that obscures sub-microsecond host loop differences.
- *Google Benchmark library*: Evaluated, but Blue Engine already contains low-overhead `PerformanceSampleWindow` ring buffers and timestamp collectors designed specifically for real-time audio threads; wrapping them in a dedicated native binary avoids heavy external dependency changes.

---

## 2. Lock-Free Snapshot Gating & Memory Ordering

### Context & Problem
`CsoundEngine::performThread()` calls `AutomationStore::getList()` and accesses `shmMirrorBindings_` on every single k-cycle. Both rely on `std::atomic_load_explicit` on `std::shared_ptr`. On macOS / libc++ (and several Linux libstdc++ targets), C++17 atomic `shared_ptr` functions call internal runtime mutexes (`std::__1::__sp_mut::lock/unlock`), introducing library locks into the hard real-time audio thread on every control cycle.

### Decision
Replace per-cycle `std::shared_ptr` atomic loads with an integral lock-free generation/revision gate (`std::atomic<uint64_t>`). The performance thread holds a thread-local `std::shared_ptr` copy and refreshes it only when the generation changes.

### Memory Ordering Specification
- **Writer (Control / ZMQ Thread)**:
  ```cpp
  // 1. Prepare new immutable snapshot off the real-time thread
  auto nextSnapshot = std::make_shared<SnapshotType>(...);
  // 2. Publish snapshot with release ordering
  std::atomic_store_explicit(&snapshotPtr_, nextSnapshot, std::memory_order_release);
  // 3. Increment generation with release ordering
  revision_.fetch_add(1, std::memory_order_release);
  ```
- **Reader (Real-Time Audio Thread)**:
  ```cpp
  // 1. Load generation with acquire ordering
  const uint64_t currentRev = revision_.load(std::memory_order_acquire);
  if (currentRev != cachedRev_) {
      // 2. Refresh local shared_ptr only on generation change
      cachedSnapshot_ = std::atomic_load_explicit(&snapshotPtr_, std::memory_order_acquire);
      rebuildRuntimeView(cachedSnapshot_);
      cachedRev_ = currentRev;
  }
  ```
- **Safety Assertions**:
  ```cpp
  static_assert(std::atomic<uint64_t>::is_always_lock_free,
                "Snapshot generation counter must be lock-free on all target platforms");
  ```

### Alternatives Considered
- *Bump generation before storing snapshot + relaxed reader*: Rejected as unsafe; a reader can observe the incremented generation, load an old snapshot, cache it, and never re-read the updated snapshot when generation remains equal.
- *Raw pointer swap (`atomic<const Snapshot*>`)*: Rejected because live orchestra compilation or ZMQ updates can destroy the previous snapshot while the audio thread is midway through reading it unless a hazard-pointer / epoch reclamation mechanism is built. `std::shared_ptr` cached on generation change provides safe deferred reclamation with zero lock acquisition in steady state.

---

## 3. Shared-Memory Mirroring & IEEE 754 Deduplication

### Context & Problem
On every k-cycle, `syncSharedMemoryFromChannels()` iterates over all registered channels and executes `binding.sharedMemoryEntry->value.store(*binding.pointer)` with sequentially consistent ordering (`memory_order_seq_cst`). With 256 channels at 689 k-cycles/sec, this executes ~176,000 sequentially consistent atomic stores/sec, even when channel values are completely static.

### Decision
1. Change channel value atomic operations to `std::memory_order_relaxed`. Mirrored channel values are independent scalar observations; they do not establish ordering for dependent data structures.
2. In the mirror loop, read the existing shared-memory value with `memory_order_relaxed` and write only if the IEEE 754 binary representation has changed.
3. Compare binary representations using exact bitwise comparison (`std::memcmp` or bit casting to `uint64_t`), preserving `-0.0`, `+0.0`, infinities, and specific NaN payloads that `operator==` would mishandle.
4. Maintain `std::memory_order_release` on `num_channels` when adding new channel entries to ensure readers never observe an uninitialized `ChannelEntry`.
5. Maintain `static_assert(std::atomic<double>::is_always_lock_free)` to guarantee no hidden mutexes in shared memory.

### Bitwise Deduplication Logic
```cpp
const double newValue = *binding.pointer;
const double currentValue = binding.sharedMemoryEntry->value.load(std::memory_order_relaxed);

uint64_t newBits, currentBits;
std::memcpy(&newBits, &newValue, sizeof(double));
std::memcpy(&currentBits, &currentValue, sizeof(double));

if (newBits != currentBits) {
    binding.sharedMemoryEntry->value.store(newValue, std::memory_order_relaxed);
}
```

### Alternatives Considered
- *`operator!=` floating point comparison*: Rejected because `+0.0 == -0.0` is true (losing negative zero transitions) and `NaN != NaN` is always true (causing continuous stores for static NaN values).
- *Thread-local last-value array*: Rejected because `syncSharedMemoryFromChannels()` and `mirrorChannelValue()` can be invoked from multiple lifecycle contexts (initial compile, reset, ZMQ setChannel); reading directly from the shared memory atomic slot avoids cache coherence bugs across multiple writer threads.

---

## 4. Real-Time Audio Thread Fallback Mutex Removal

### Context & Problem
In `AutomationManager::process()`, when an automation does not have a cached `channelPointer` (`nullptr`), it falls back to `resolver_(channelName)` (which calls `CsoundEngine::findControlChannelPointer`) or `writer_(channelName, value)` (which calls `CsoundEngine::writeAutomationValue`). Both methods acquire `channelMutex_`. For unresolved channel names, this mutex is acquired every single k-cycle. During live `compileOrc()`, recompilation can modify `controlChannels_` while the audio thread is performing.

### Decision
1. Consolidate channel name resolution into the generation-gated `RuntimeChannelBindingSnapshot`.
2. When the channel binding generation changes (or automation revision changes), resolve all automation target channels to direct `double*` pointers upfront.
3. If a channel name is not present in the current binding snapshot, mark its state as `UNRESOLVED` for that generation and do not retry resolution or take mutex locks during the steady-state k-cycle loop.
4. When `compileOrc()` or live orchestra recompilation occurs, build a new `RuntimeChannelBindingSnapshot` off-thread and publish it via release/acquire generation bump.
5. Invalidate automation runtime views at safe k-cycle boundaries so no dangling pointer into old Csound channel storage is dereferenced.

### Alternatives Considered
- *Try-lock with fallback*: Rejected because failing to acquire a lock in the audio thread would cause dropped control values, and try-lock in a tight loop is still an atomic bus transaction.
- *Keeping fallback locks and documenting them as startup-only*: Rejected because unresolved automation targets (e.g., misnamed channels or instruments not yet compiled) convert the fallback into an unconditional 689 locks/sec overhead.

---

## 5. Automation Invariant Precomputation & Java Blue Parity

### Context & Problem
In `AutomationManager::interpolate()`, the hot loop executes invariant arithmetic on every cycle:
- Division for normalized time parameter `t = (elapsed - p0.time) / (p1.time - p0.time)` on every cycle.
- `std::log(p1.value / p0.value)` on every exponential cycle, even though `p0` and `p1` are fixed for the segment.
- `std::pow(10, scale)` calls and `FixedPoint` floor/remainder arithmetic on every cycle for high-precision quantization.
- Evaluating curves after an envelope has completed its duration.

### Decision
1. **Per-Definition Revision Tracking**: Assign each `AutomationDef` an internal revision counter that increments only when its points, curve type, or resolution properties change.
2. **Segment Invariant Cache**:
   - `invDuration = 1.0 / (p1.time - p0.time)` precomputed for each segment.
   - `logRatio = std::log(p1.value / p0.value)` precomputed for exponential segments where `p0.value > 0` and `p1.value > 0`.
   - `deltaValue = p1.value - p0.value` precomputed for linear segments.
3. **Quantization Invariant Cache**:
   - High precision: Precalculate scale factor and scaled resolution once per definition revision. Use fast 64-bit integer fixed-point arithmetic while inputs fit within 64-bit bounds; this preserves the accepted decimal-grid contract, not arbitrary-precision decimal semantics.
   - Fast mode: Precalculate `invResolution = 1.0 / resolution` only when differential verification against Java Blue passes 100%.
4. **Completed Envelope Early-Out**:
   - If `state.completed == true` and `elapsed >= def.points.back().time`, bypass curve evaluation and interpolation.
   - Invalidate `state.completed = false` if the definition revision changes, if time rewinds (`elapsed < lastElapsed`), or if a seek/reset occurs.
5. **Java Parity Verification**: Run differential test suite against Java Blue's `Line.getValue()` / `BigDecimal` fixtures across negative values, tie boundaries, zero crossings, and fractional resolutions. The fixtures define the supported compatibility contract; exact `new BigDecimal(double)` behavior outside that set is not guaranteed by the C++ double-to-fixed-point conversion.

### Alternatives Considered
- *Naïve completed early-out without definition revision check*: Rejected as a correctness bug; live parameter adjustments to an envelope that finished would be ignored.
- *Replacing all FixedPoint instances with double multiplication*: Rejected for high-precision mode because Java Blue uses `BigDecimal` with `RoundingMode.FLOOR` and exact decimal scale; precomputing the fixed-point constants inside `AutomationState` achieves the performance target without changing the accepted decimal-grid behavior in the supported `int64_t` domain.

---

## 6. Build-Level Optimization Flags

### Context & Problem
The Release build in CMake already uses `-O3`. Speculative suggestions included Link-Time Optimization (IPO/LTO) and `-fno-math-errno`.

### Decision
1. **CMake IPO/LTO**: Evaluate via CMake `check_ipo_supported()`. Keep IPO enabled only if:
   - It builds cleanly across all four targets (macOS arm64, macOS x64, Linux x64, Windows x64).
   - Packaging and symbol exports remain fully compatible.
   - Benchmark measurements demonstrate a measurable reduction in host overhead without code bloat or compiler regressions.
2. **`-fno-math-errno`**: Enable for GCC/Clang Release builds after verifying that `log`, `exp`, and `pow` calls in automation math do not depend on `errno` and produce identical numerical outputs.
3. **No `-march=native`**: Disallow host-specific instruction set flags in distributed artifacts to ensure portability across CPU generations.

---

## 7. Control-Plane Event Wakeup & Offline Message Draining

### Context & Problem
1. `ZmqHandler::processOne()` polls with a 500 ms fallback timeout so it can check for engine state transitions and shutdown.
2. `CsoundRuntimeServices::runPerformance()` queries the Csound message buffer on every k-cycle and calls `std::fflush(stderr)` for every message, creating severe I/O bottlenecks during offline rendering.

### Decision
1. **State Event Wakeup**:
   - Decouple state snapshot publication from the 500 ms fallback timeout by notifying the ZMQ polling loop via an internal in-process signaling mechanism (`zmq_poll` on an inproc socket or self-pipe) when a state snapshot is published.
   - Measure idle CPU usage and shutdown latency to ensure no resource regression.
2. **Offline Message Drain Throttling**:
   - Maintain k-cycle message draining to prevent unbounded Csound internal ring buffer growth.
   - Buffer standard diagnostic output to stderr, flushing only when a bounded byte threshold is reached, on error messages, or upon render completion/cancellation.

---

## Summary of Adopted vs Deferred Architectural Changes

| Proposal / Opportunity | Status | Rationale |
|------------------------|--------|-----------|
| Release Benchmark Matrix Driver | **Adopted (P0)** | Essential empirical gate for all optimizations |
| Atomic `shared_ptr` Gating with Generation Counters | **Adopted (P0)** | Eliminates libc++ runtime mutex locks from audio thread |
| Relaxed Shared-Memory Atomics + Bitwise Deduplication | **Adopted (P0)** | Cuts ~176k stores/sec down to 0 on static workloads |
| Generation-Bound Channel Pointer Snapshot (No Audio Locks) | **Adopted (P0)** | Eliminates per-cycle fallback mutex locks and guarantees pointer safety |
| Automation Segment Invariant & Math Caching | **Adopted (P1)** | Eliminates per-cycle `log` and `div` calls while preserving Java parity |
| Definition-Aware Completed-Envelope Early-Out | **Adopted (P1)** | Skips finished automations safely with prompt edit recovery |
| Relaxed Telemetry Atomics (`shouldStop_`, `sampleNumber_`) | **Adopted (P1)** | Low-risk reduction of memory bus ordering constraints |
| CMake IPO/LTO & `-fno-math-errno` Evaluation | **Opt-in (P2)** | CMake exposes both behind explicit options; neither is enabled for the distributed/default benchmark until cross-platform evidence justifies it |
| In-Process Event-Driven Wakeup & Offline I/O Batching | **Adopted (P2)** | Improves responsiveness and offline render throughput |
| Raw Unowned Atomic Pointers | **Rejected** | Dangerous lifetime risks during live orchestra recompilation |
| `ZMQ_CONFLATE=1` on PUB Socket | **Rejected** | ZeroMQ documentation states conflate corrupts multipart messages |
| `std::unordered_map` / Binary Search Seeks | **Deferred** | Not on hot path; no current runtime seek API |
