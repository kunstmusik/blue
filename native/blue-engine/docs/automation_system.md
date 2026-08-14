# Automation System

The automation system provides a mechanism for automatically updating native Csound control-channel values over time, with shared memory maintained as a read mirror for external processes. This enables time-based parameter control (e.g., envelopes, fades) that runs efficiently within the engine thread while remaining observable from other processes.

This document describes the implementation on the `072-blue-engine-performance`
work branch. The performance changes are internal: the ZMQ protocol, generated
CSD, project data, and observable automation behavior are unchanged.

## Overview

### Goals

1. **Engine-Thread Processing**: All automation processing occurs in the Csound performance thread, minimizing IPC overhead during runtime
2. **External Configuration**: Automations can be created, updated, and deleted via ZMQ messages from external processes
3. **Lock-Free Design**: Uses immutable data structures with release-published atomic snapshots and generation gates; the steady-state performance path does not acquire a mutex or an atomic `shared_ptr` reference-count operation
4. **Deterministic Timing**: Uses sample-accurate timing (`int64_t` sample count) to avoid floating-point accumulation errors
5. **DAW-Friendly Updates**: Automation changes take effect immediately without resetting playback position

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        External UI Process (DAW)                         │
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │ Automation      │──── ZMQ Messages ────┐                             │
│  │ Configuration   │                      │                             │
│  └─────────────────┘                      │                             │
└───────────────────────────────────────────│─────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           blue-engine Process                            │
│                                                                         │
│  ┌─────────────────┐      ┌─────────────────────────────────┐           │
│  │   ZmqHandler    │─────▶│  Immutable AutomationList       │           │
│  │ (Main Thread)   │      │  (release-published snapshot)  │           │
│  └─────────────────┘      └─────────────────────────────────┘           │
│                                      │                                  │
│  ┌───────────────────────────────────│──────────────────────────────────┤
│  │              Csound Performance Thread                               │
│  │                                   ▼                                  │
│  │  ┌─────────────────┐      ┌─────────────────┐      ┌──────────────┐  │
│  │  │ AutomationMgr   │─────▶│ Native Csound   │─────▶│ SharedMemory │  │
│  │  │  + StateVector  │      │ ControlChannels │      │    Mirror    │  │
│  │  └─────────────────┘      └─────────────────┘      └──────────────┘  │
│  │         │                                                            │
│  │         ▼                                                            │
│  │  ┌─────────────────┐                                                 │
│  │  │ csoundPerform   │                                                 │
│  │  │    Ksmps()      │                                                 │
│  │  └─────────────────┘                                                 │
│  └──────────────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Automation

An automation defines how a channel's value should change over time. Each automation specifies:

- **Target Channel**: An exported Csound control channel to control
- **Curve Type**: The interpolation method (step, linear, exponential)
- **Segments**: Time-value pairs defining the envelope shape
- **Enabled State**: Whether the automation is currently active

### Timing Model

Automations use **absolute time from engine start** for synchronization to ensure precision:

- Time is tracked as `int64_t sampleNumber` (cumulative samples since engine start)
- Automation points are defined in seconds from engine start (time 0)
- Current time is calculated as `sampleNumber / sampleRate`
- `start()` resets the sample position to zero; a live compile preserves the current position while a normal stop/reset ends the performance
- Automations that complete remain at their final value until explicitly removed or updated

### Single Automation Per Channel

Each channel can have at most one automation.

- **Creation**: Setting a new automation for a channel seamlessly replaces any existing automation.
- **Updates**: If an automation is updated while running, it continues execution relative to its original start time (if preserving timing is desired) or resets, depending on the command. *Clarification: The "Update" command replaces the definition. The system ensures the new curve is evaluated at the current time offset, preventing jumps if the curve shape essentially matches.*
- **Missing Channels**: If an automation targets a channel that has not been exported yet, its state records an unresolved binding for the current runtime generation. The performance thread does not retry a lookup every period; a new channel-binding generation (for example after a compile) triggers one retry. Pending `setChannel` values are applied when a matching Csound channel is rebuilt.

> [!NOTE]
> **Future Consideration: Additive Automations**
>
> A future enhancement may allow multiple automations to target the same channel, with their values being summed together. This would require:
>
> 1. **Pre-Processing Zero Phase**: Before processing automations, zero all channels that have active automations
> 2. **Summation**: Each automation adds its current value to the channel instead of setting it
> 3. **Conflict Resolution**: Define ordering or priority when multiple automations control the same channel

## Data Structures

### AutomationPoint

Represents a single point in an automation curve:

```cpp
struct AutomationPoint {
    double time;      // Time in seconds from automation start
    double value;     // Target value at this time
};
```

### AutomationCurve

Defines the interpolation method between points:

```cpp
enum class AutomationCurve : uint8_t {
    STEP        = 0x00,  // Instant jump to value
    LINEAR      = 0x01,  // Linear interpolation
    EXPONENTIAL = 0x02,  // Exponential curve
};
```

### AutomationDef

Complete automation definition (Immutable):

```cpp
struct AutomationDef {
    uint32_t id;                      // Unique automation ID
    std::string channelName;          // Target channel (key)
    AutomationCurve curve;            // Interpolation type
    std::vector<AutomationPoint> points;  // Envelope points
    bool enabled;                     // Currently active
    double resolution;                // Quantization step size (0.0 = no quantization)
    int resolutionScale;              // Decimal scale for resolution (e.g., 1 for 0.1)
    bool highPrecision;               // Use bounded Java-compatible fixed-point quantization
    uint64_t definitionRevision;      // Bumped on every replacement definition
};
```

### AutomationList

Immutable container for all active automations:

```cpp
struct AutomationList {
    // Map channel name -> AutomationDef
    std::map<std::string, AutomationDef> automations;
    uint64_t revision;                // Snapshot revision used by the audio thread
};
```

### Runtime State

Maintained by the performance thread:

```cpp
struct AutomationState {
    size_t currentIndex;       // Current segment index
    bool completed;             // Has reached end
    double* channelPointer;     // Current generation's Csound storage
    double lastElapsed;
    double lastWrittenValue;
    bool hasLastWrittenValue;
    uint64_t cachedDefRevision;
    uint64_t cachedBindingGeneration;
    bool bindingGenerationInitialized;
    std::vector<AutomationSegmentCache> segmentCaches;
    QuantizationCache quantCache;
};
```

## ZMQ Protocol Extensions

### New Commands

| Code | Command | Description |
|------|---------|-------------|
| 0x20 | CREATE_AUTOMATION | Create or replace an automation |
| 0x21 | UPDATE_AUTOMATION | Update automation parameters |
| 0x22 | DELETE_AUTOMATION | Remove an automation |
| 0x23 | ENABLE_AUTOMATION | Enable an automation |
| 0x24 | DISABLE_AUTOMATION | Disable an automation |
| 0x25 | LIST_AUTOMATIONS | Query active automations |
| 0x26 | CLEAR_AUTOMATIONS | Remove all automations |

### CREATE_AUTOMATION Payload

```
┌──────────────┬──────────────┬───────────┬────────────────┬─────────────────┬───────────────┬───────────┬────────────────────┐
│ channel_name │ curve (1B)   │ enabled   │ resolution(8B) │ resolutionScale │ highPrecision │ n_points  │ points (n * 16B)   │
│ (null-term)  │              │ (1B)      │ double (LE)    │ (4B) int32      │ (1B)          │ (4B)      │ (time + value)     │
└──────────────┴──────────────┴───────────┴────────────────┴─────────────────┴───────────────┴───────────┴────────────────────┘
```

| Field | Size | Description |
|-------|------|-------------|
| channel_name | variable | Null-terminated UTF-8 string |
| curve | 1 byte | AutomationCurve enum value |
| enabled | 1 byte | 0 = disabled, non-zero = enabled |
| resolution | 8 bytes | double, quantization step size (0 = none) |
| resolutionScale | 4 bytes | int32_t, decimal scale for resolution |
| highPrecision | 1 byte | 0 = fast path, non-zero = high-precision |
| n_points | 4 bytes | uint32_t, number of points |
| points | 16 bytes each | (time: double, value: double) pairs |

**Response**: Status + automation ID (4 bytes) on success

### UPDATE_AUTOMATION Payload

Identical to CREATE_AUTOMATION. The system matches by channel name and updates the definition.

### LIST_AUTOMATIONS Response

```
┌──────────────┬─────────────────────────────────────────────────┐
│ count (4B)   │ entries (variable)                              │
└──────────────┴─────────────────────────────────────────────────┘

Each entry:
┌────────────────┬───────────┬───────────┬───────────┐
│ id (4B)        │ enabled   │ channel   │ n_points  │
│                │ (1B)      │ (64B)     │ (4B)      │
└────────────────┴───────────┴───────────┴───────────┘
```

## Implementation Components

### AutomationStore (Manager of State)

Manages the immutable `AutomationList` and handles the atomic swap for the main thread.

```cpp
class AutomationStore {
public:
    // Called from ZMQ handler thread (writers)
    uint32_t createAutomation(const AutomationDef& def);
    bool deleteAutomation(const std::string& channel);
    bool setEnabled(const std::string& channel, bool enabled);
    void clear();

    // Called from performance thread (reader). C++17 uses the atomic
    // shared_ptr free functions rather than std::atomic<shared_ptr<T>>.
    uint64_t getRevision() const;
    std::shared_ptr<const AutomationList> getList() const;

private:
    std::shared_ptr<const AutomationList> currentList_;
    std::atomic<uint64_t> revision_;
    uint32_t nextId_ = 1;

    // Helper to perform copy-update-swap
    template<typename F>
    void updateList(F&& modifier);
};
```

### AutomationManager (Performance Thread)

Handles the per-k-cycle processing of automations using the current list.

```cpp
class AutomationManager {
public:
    AutomationManager(const std::shared_ptr<AutomationStore>& store,
                      ChannelWriter writer,
                      ChannelResolver resolver = {},
                      BindingGenerationProvider bindingGenerationProvider = {});

    // Called once per k-cycle, before csoundPerformKsmps()
    void process(int64_t currentSampleNumber, double sampleRate);

    // Reset state (called on engine start)
    void reset();

private:
    std::shared_ptr<AutomationStore> store_;
    ChannelWriter writer_;
    ChannelResolver resolver_;
    BindingGenerationProvider bindingGenerationProvider_;

    // Local state map is only rebuilt when the immutable list revision changes.
    std::map<std::string, AutomationState> states_;
    std::shared_ptr<const AutomationList> activeListSnapshot_;
    uint64_t cachedSnapshotRevision_ = 0;
    std::vector<ActiveAutomation> activeAutomations_;

    double interpolate(const AutomationDef& def, AutomationState& state,
                       double elapsed);
};
```

### Integration with CsoundEngine

```cpp
void CsoundEngine::performThread() {
    int64_t sampleNumber = sampleNumber_.load(std::memory_order_relaxed);
    std::shared_ptr<const RuntimeChannelBindingSnapshot> cachedBindings;
    uint64_t cachedBindingGeneration = 0;

    while (!shouldStop_.load(std::memory_order_relaxed)) {
        // Process automations
        if (automationManager_) {
            automationManager_->process(sampleNumber, csoundGetSr(csound_));
        }

        if (CsoundLoader::csoundPerformKsmps(csound_) != 0) {
            break;
        }

        syncSharedMemoryFromChannels(cachedBindings, cachedBindingGeneration);
        sampleNumber += csoundGetKsmps(csound_);
    }
}
```

The real implementation also records optional automation, Csound, shared-memory,
and host-cycle timings when `BLUE_ENGINE_USE_PERFORMANCE_TRACKING=1`. The
benchmark target enables that definition; the distributed engine does not.

## Processing Logic

### Interpolation

**Linear**:
```cpp
double t = (elapsed - p0.time) / (p1.time - p0.time);
double y = p0.value + t * (p1.value - p0.value);
```

**Exponential**:
```cpp
double t = (elapsed - p0.time) / (p1.time - p0.time);
// Non-positive endpoints use the existing linear fallback.
if (segment.isPositiveLogValid) {
    // `logRatio` is prepared once for this segment, not recomputed per cycle.
    double y = p0.value * exp(t * segment.logRatio);
} else {
    double y = p0.value + t * segment.deltaValue;
}
```

### Quantization (resolution)

After interpolation, if `resolution > 0.0`, the value is quantized to a grid of
`resolution`-sized steps. The system supports two quantization modes:

#### Fast Path (Default)

Simple double-based quantization, suitable for most use cases:

```cpp
double step = def.resolution; // 0.0 => no quantization
if (step > 0.0) {
    // Detect descending segments and apply bias
    if (p1.value < p0.value) {
        y += step * 0.99;
    }
    // Snap to nearest lower multiple of step
    double n = std::floor(y / step);
    y = n * step;
}
```

#### High-Precision Path

When `highPrecision` is enabled, the engine uses bounded decimal fixed-point
arithmetic. Within the validated domain (finite values, `resolutionScale` from
0 through 18, and scaled values that fit in `int64_t`) it preserves the same
integer quantization grid as the prior `FixedPoint` path and the accepted Java
Blue fixtures. This is not arbitrary-precision decimal arithmetic, and the
cached path is not promised to produce the identical binary64 encoding for
every high-scale result: the old `FixedPoint` conversion normalizes trailing
zeroes before division, while the realtime cache divides by the original
scale factor. The difference is at most a representation-level rounding
difference in the supported range, not a different quantization step.

Invalid, non-finite, unsupported, or out-of-range inputs retain the existing
fallback behavior and are returned unquantized. The Java expression shown below
is the compatibility reference for the accepted fixture set:

```cpp
// Java Line.getValue() implementation:
if (resolution.doubleValue() > 0.0) {
    if (b.getY() < a.getY()) {
        y += resolution.doubleValue() * 0.99;
    }
    BigDecimal v = new BigDecimal(y).setScale(resolution.scale(), RoundingMode.FLOOR);
    v = v.subtract(v.remainder(resolution));
    y = v.doubleValue();
}
```

The C++ high-precision implementation:

```cpp
if (def.highPrecision && def.resolution > 0.0) {
    if (isDescending) {
        y += def.resolution * 0.99;
    }
    // The real-time path uses the per-definition integer scaleFactor and
    // scaledResolution prepared in AutomationState. The standalone helper
    // uses FixedPoint::fromDoubleFloor for differential Java tests.
    const double scaled = std::floor(y * static_cast<double>(cache.scaleFactor));
    if (!std::isfinite(scaled) ||
        scaled < INT64_MIN || scaled > INT64_MAX ||
        cache.scaledResolution <= 0) {
        return y; // Invalid/out-of-range resolutions use the existing value.
    }
    const int64_t scaledValue = static_cast<int64_t>(scaled);
    y = static_cast<double>(scaledValue - scaledValue % cache.scaledResolution) /
        static_cast<double>(cache.scaleFactor);
}
```

### FixedPoint Class

The `FixedPoint` class provides bounded decimal arithmetic for the accepted
Java-compatible quantization fixtures; it is not an arbitrary-precision
replacement for Java `BigDecimal`:

- **Internal Representation**: Uses `int64_t` unscaled value with decimal scale
- **Operations**: add, subtract, multiply, remainder, setScale
- **Rounding Modes**: FLOOR, CEILING, DOWN, UP, HALF_UP, HALF_DOWN, HALF_EVEN
- **setScale**: Mirrors Java's `BigDecimal.setScale(int, RoundingMode)` behavior for values that fit the fixed-point representation

### Per-Cycle Processing & Performance Optimizations

1. **Generation Gating & Active Vector**:
   - The audio thread checks `store_->getRevision()` using `memory_order_acquire`.
   - Only when a mutation occurs does the audio thread acquire a new `shared_ptr<const AutomationList>` snapshot and rebuild `activeAutomations_`.
   - Per-cycle processing iterates over a compact active-automation vector,
     avoiding map lookups.

2. **Precomputed Invariant Segment Math**:
   - `invDuration = 1.0 / duration`, `deltaValue = p1.value - p0.value`.
   - For exponential segments: `logRatio = std::log(p1.value / p0.value)` is computed once per segment transition rather than evaluated every k-cycle.

3. **Precomputed Quantization & Integer Fast Path**:
   - Power-of-10 scale factors are loaded via `constexpr` lookup table `FixedPoint::getScaleFactor(scale)`.
   - `scaledResolution`, `invResolution`, and `isFastQuantizeSafe` are cached.
   - When the prepared high-precision constants are valid, integer remainder arithmetic replaces per-cycle `FixedPoint` construction while preserving the same quantization grid; invalid, non-finite, or out-of-range resolutions fall back to the unquantized value. The cache intentionally does not claim universal bit-for-bit equality with the old normalized `FixedPoint::toDouble()` result at every decimal scale.

4. **Definition-Aware Completed Envelope Bypass**:
   - When an automation envelope reaches its final segment and target time, `state.completed` is set and the final value is written once.
   - Subsequent k-cycles first confirm that the runtime binding generation is unchanged, then bypass interpolation and quantization until a rewind/seek, definition revision, or binding generation change requires the final value to be applied again.

5. **Lock-Free Audio Thread Channel Lookups & SHM Mirroring**:
   - Direct Csound channel pointers are cached in an immutable `RuntimeChannelBindingSnapshot` swapped atomically without `channelMutex_`.
   - Shared memory mirror updates use relaxed atomic stores (`memory_order_relaxed`) with IEEE 754 64-bit bitwise deduplication via `memcpy`, writing only when float bits change.

6. **Event-Driven Control Plane**:
   - In-process wakeup sockets (`inproc://blue_engine_wakeup`) wake the control loop immediately on state transitions and shutdown signals instead of waiting for the 500 ms poll timeout. The wakeup path is tested for sub-200 ms shutdown response.

### Shared-Memory Publication

The shared-memory channel value is an independent scalar observation. All
`ChannelEntry::value` loads and stores use `std::memory_order_relaxed`; the
channel-count publication remains release/acquire so a client sees initialized
entries. Before a mirror store, the engine compares the complete 64-bit IEEE
754 representation with `memcpy`. This preserves transitions between positive
and negative zero, infinities, and distinct NaN payloads while skipping
redundant stores for unchanged values. `mirrorChannelValue()` uses the same
comparison for control-plane writes.

### Channel Lifetime and Live Recompilation

`RuntimeChannelBindingSnapshot` owns the channel pointer set for one Csound
orchestra generation. `compileOrc()` serializes lifecycle operations, joins a
joinable perform thread at a k-cycle boundary (preserving the Csound instance
when recompiling live), calls `csoundCompileOrc()`, rebuilds and release-publishes
the snapshot, applies pending channel values, mirrors the rebuilt values, and
only then resumes playback. A normal stop/completion performs a final mirror
flush before clearing the snapshot and resetting Csound. The performance thread
loads a new snapshot only when the acquire-loaded generation changes;
unresolved automation targets are retried only on a later generation. This
keeps raw Csound pointers off the control mutex and prevents dereferences after
Csound replaces channel storage. A naturally completed but still joinable
`std::thread` is reaped before a later `start()` or compile.

### Verification and Benchmarking

`benchmark_engine` executes the same `CsoundEngine::performThread()` path used
by the sidecar. It requires shared memory and covers idle/static/changing
mirrors at 1, 32, 128, and 256 channels; linear and exponential automation;
fast and high-precision quantization; completed envelopes; live edits; live
compilation; and missing bindings. It discards at least 1,024 warmup periods,
records at least 4,096 measured periods for each of five trials by default, and
emits compiler, architecture, operating-system, sample-rate, `ksmps`, Csound
version, timestamp, source-revision, and optional baseline identity metadata.
`--compare baseline.json` rejects incompatible metadata, evaluates the 10%
targeted-improvement, 5% unaffected-p95, and spike-count gates, and
`--output path.json` retains the raw trials. The lifecycle stress target is
`tests/cpp/test_csound_stress`; it supports a 600-second sanitizer soak. The
stress and benchmark targets are validation tools, not protocol or persistence
changes.

### Control-Plane and Offline Diagnostics

ZMQ control and publication sockets use `ZMQ_LINGER=0` for bounded shutdown.
The state publication socket deliberately does not use `ZMQ_CONFLATE`: state
events are multipart messages and conflating them could break frame boundaries.
Offline Csound messages are drained in bounded batches (4 KiB flush batches,
up to 8,192 messages per drain) without dropping the remainder; utility and
performance paths continue draining until the message queue is empty, and
performance drains periodically plus once at completion. The drain always
consumes the internal Csound queue even when a caller supplies no diagnostic
callback, so suppressed output cannot accumulate unboundedly.

## Thread Safety

**Lock-Free Immutable Swap**:

1. **Writers (ZMQ Thread)**:
   - Load `currentList_`
   - Create deep copy: `newList = make_shared<AutomationList>(*currentList_)`
   - Modify `newList` and bump `definitionRevision`
   - `atomic_store_explicit(&currentList_, newList, memory_order_release)`
   - `revision_.store(nextRevision, memory_order_release)`

2. **Reader (Performance Thread)**:
   - Check `store_->getRevision()` (`memory_order_acquire`)
   - If revision changed, swap active snapshot and rebuild segment cache
   - Direct pointer writes and relaxed shared-memory atomic stores
   - Zero audio-thread mutex acquisitions in the steady-state path; lifecycle
     control joins the perform thread before replacing Csound channel storage.

## File Structure

```
src/
├── automation/
│   ├── AutomationTypes.h      # Data structures, segment caches, and definition revisions
│   ├── AutomationStore.h      # Thread-safe storage (the Writer)
│   ├── AutomationStore.cpp
│   ├── AutomationManager.h    # Per-cycle logic and invariant caching (the Reader)
│   ├── AutomationManager.cpp
│   └── FixedPoint.h           # Decimal fixed-point arithmetic and scale lookup table
├── engine/
│   ├── CsoundEngine.h         # Lock-free channel binding snapshots & perform loop
│   └── CsoundEngine.cpp
└── ipc/
    ├── SharedMemory.h         # Lock-free bitwise deduplication shared memory mirror
    ├── SharedMemory.cpp
    ├── ZmqHandler.h           # Event-driven inproc wakeup control plane
    └── ZmqHandler.cpp
```
