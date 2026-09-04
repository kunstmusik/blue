# Automation System

The automation system provides a mechanism for automatically updating native Csound control-channel values over time, with shared memory maintained as a read mirror for external processes. This enables time-based parameter control (e.g., envelopes, fades) that runs efficiently within the engine thread while remaining observable from other processes.

This document describes the Spec 073 implementation. The exact-resolution
contract is shared by the project model, Electron bridge, engine client, and
native engine. Only the resolution is exact decimal text; automation values,
times, bounds, and points remain binary64.

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
- **Updates**: If an automation is updated while running, it continues execution relative to its original start time (if preserving timing is desired) or resets, depending on the command. _Clarification: The "Update" command replaces the definition. The system ensures the new curve is evaluated at the current time offset, preventing jumps if the curve shape essentially matches._
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
    uint32_t id;                         // Unique automation ID
    std::string channelName;             // Target channel (key)
    AutomationCurve curve;               // Interpolation type
    std::vector<AutomationPoint> points; // Envelope points, still binary64
    bool enabled;                        // Currently active
    std::string resolutionDecimal;       // Canonical Java decimal text
    double resolutionDouble;             // Prepared Java BigDecimal.doubleValue()
    uint64_t definitionRevision;         // Bumped on every replacement definition
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
    size_t currentIndex;
    bool completed;
    double* channelPointer;
    double lastElapsed;
    double lastWrittenValue;
    bool hasLastWrittenValue;
    uint64_t cachedDefRevision;
    uint64_t cachedBindingGeneration;
    bool bindingGenerationInitialized;
    uint64_t invalidEvaluationCount;
};
```

## ZMQ Protocol Extensions

### New Commands

| Code | Command            | Description                     |
| ---- | ------------------ | ------------------------------- |
| 0x20 | CREATE_AUTOMATION  | Create or replace an automation |
| 0x21 | UPDATE_AUTOMATION  | Update automation parameters    |
| 0x22 | DELETE_AUTOMATION  | Remove an automation            |
| 0x23 | ENABLE_AUTOMATION  | Enable an automation            |
| 0x24 | DISABLE_AUTOMATION | Disable an automation           |
| 0x25 | LIST_AUTOMATIONS   | Query active automations        |
| 0x26 | CLEAR_AUTOMATIONS  | Remove all automations          |

### Protocol version 2 automation payload

```
┌──────────────┬──────────────┬───────────┬────────────────────┬────────────────────┬───────────┬────────────────────┐
│ channel_name │ curve (1B)   │ enabled   │ resolutionLength    │ resolution (ASCII) │ n_points  │ points (n * 16B)   │
│ (null-term)  │              │ (1B)      │ (4B) uint32 LE       │                    │ (4B)      │ (time + value)     │
└──────────────┴──────────────┴───────────┴────────────────────┴────────────────────┴───────────┴────────────────────┘
```

| Field            | Size          | Description                                                                        |
| ---------------- | ------------- | ---------------------------------------------------------------------------------- |
| channel_name     | variable      | Null-terminated UTF-8 string                                                       |
| curve            | 1 byte        | AutomationCurve enum value                                                         |
| enabled          | 1 byte        | 0 = disabled, non-zero = enabled                                                   |
| resolutionLength | 4 bytes       | uint32_t little-endian byte length                                                 |
| resolution       | variable      | Canonical Java decimal ASCII text; positive `doubleValue()` activates quantization |
| n_points         | 4 bytes       | uint32_t, number of points                                                         |
| points           | 16 bytes each | (time: double, value: double) pairs                                                |

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
    // Called from the ZMQ handler thread. Parsing and exact workspace
    // preparation complete before any revision is published.
    AutomationPrepareError createAutomation(...);
    AutomationPrepareError updateAutomation(...);
    AutomationPrepareError deleteAutomation(const std::string& channel);
    AutomationPrepareError setEnabled(const std::string& channel, bool enabled);
    void clear();

    // Called from the performance thread (reader). C++17 uses the atomic
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

    // Fixed arrays are rebuilt/adopted only at a revision boundary. No
    // container growth or decimal preparation occurs on the audio thread.
    std::array<AutomationState, kMaxActiveAutomations> states_;
    std::shared_ptr<const AutomationList> activeListSnapshot_;
    uint64_t cachedSnapshotRevision_ = 0;
    size_t activeCount_ = 0;

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
double m = (p1.value - p0.value) / (p1.time - p0.time);
double x = elapsed - p0.time;
double y = (m * x) + p0.value;
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

### Exact decimal quantization

Quantization is active exactly when the prepared resolution's Java
`doubleValue()` is greater than zero. Zero, negative, and positive values that
underflow to zero remain unquantized. There is one exact path; no bounded
fixed-point mode or precision flag is part of the runtime contract.

The evaluator follows Java Blue's operation order:

```cpp
if (resolution.doubleValue() > 0.0) {
    if (b.getY() < a.getY()) {
        y += resolution.doubleValue() * 0.99;
    }
    BigDecimal v = new BigDecimal(y).setScale(resolution.scale(), RoundingMode.FLOOR);
    v = v.subtract(v.remainder(resolution));
    y = v.doubleValue();
}
```

The native `JavaBigDecimal` and `ExactDecimalQuantizer` implementations use
prepared arbitrary-precision decimal state on the control thread. A prepared
definition owns its workspace; the performance thread only consumes it and
increments a fixed diagnostic counter if an invalid evaluation is encountered.

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
   - Exact decimal parsing, scale preparation, and workspace sizing happen on
     the control thread. The audio thread consumes the prepared quantizer and
     never constructs decimal objects or requests system allocation.

4. **Definition-Aware Completed Envelope Bypass**:
   - When an automation envelope reaches its final segment and target time, `state.completed` is set and the final value is written once.
   - Subsequent k-cycles first confirm that the runtime binding generation is unchanged, then bypass interpolation and quantization until a rewind/seek, definition revision, or binding generation change requires the final value to be applied again.

5. **Lock-Free Audio Thread Channel Lookups & SHM Mirroring**:
   - Direct Csound channel pointers are cached in an immutable `RuntimeChannelBindingSnapshot` swapped atomically without `channelMutex_`.
   - Shared memory mirror updates use relaxed atomic stores (`memory_order_relaxed`) with IEEE 754 64-bit bitwise deduplication via `memcpy`, writing only when float bits change.

6. **Event-Driven Control Plane**:
   - The control loop uses a bounded poll interval so state transitions and shutdown requests from other threads do not require cross-thread ZeroMQ socket access. The shutdown response is tested below 200 ms.

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
unquantized and exact-decimal quantization; completed envelopes; live edits; live
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
   - If revision changed, adopt the prepared snapshot and copy into fixed
     audio-thread state slots
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
│   ├── JavaBigDecimal.h/.cpp  # Java-compatible exact decimal operations
│   └── ExactDecimalQuantizer.h/.cpp # Prepared realtime quantizer workspace
├── engine/
│   ├── CsoundEngine.h         # Lock-free channel binding snapshots & perform loop
│   └── CsoundEngine.cpp
└── ipc/
    ├── SharedMemory.h         # Lock-free bitwise deduplication shared memory mirror
    ├── SharedMemory.cpp
    ├── ZmqHandler.h           # Event-driven inproc wakeup control plane
    └── ZmqHandler.cpp
```

---

## Exact Decimal Resolution and Thread Ownership (Spec 073)

Spec 073 uses one Java-compatible exact decimal contract. The payload tables
and evaluator details above are the normative protocol-v2 and realtime model.

### Canonical ownership

- `.blue` XML is the durable authority; the `bdresolution` attribute stores
  Java-canonical decimal text at the parameter and nested-line boundaries.
- The Electron main process owns the active project model (`@blue/data`
  `Parameter` and BSB slider/bank models hold the exact resolution).
- Renderer snapshots carry authoritative `resolutionDecimal` text plus a
  derived display number; patches commit only the decimal string.
- The Blue Engine owns only a transient prepared copy received through the
  engine-client protocol-v2 boundary. Protocol v2 transports canonical
  resolution text (`channelName\0 + curve:u8 + enabled:u8 +
resolutionLength:u32-le + resolution:ascii + pointCount:u32-le + points`)
  and contains no resolution-double, scale, or precision-mode field.

### Realtime ownership and retirement

- The ZMQ control thread parses, validates, and prepares automation
  definitions: exact-decimal parsing (`JavaBigDecimal`), segment preparation
  with Java-order slopes, and arena sizing/allocation
  (`ExactDecimalQuantizer::prepare`).
- Publication is atomic: a definition revision is fully prepared before the
  store publishes it; any failure before publication leaves the previous
  definition intact.
- The performance thread is the single consumer of each quantizer workspace:
  it resets the arena cursor per evaluation and never parses, locks, logs,
  or reaches the system allocator. The `DecimalArenaAllocator` records any
  bypass in a global counter; tests hard-fail when it is nonzero.
- Retired prepared definitions (old snapshots) are reclaimed on the control
  thread after the performance thread releases its snapshot reference, so
  arena and big-integer destruction never become audio-thread work.

### Quantization activation

Quantization is active exactly when the exact resolution's Java
`doubleValue() > 0.0`. Zero, negative, and positive-underflow-to-zero
resolutions branch before any arbitrary-precision work and retain the common
unquantized path. Positive resolution always uses the exact Java sequence
(`new BigDecimal(y).setScale(scale, FLOOR).subtract(remainder(resolution))`
converted back with `doubleValue()`); there is no selectable approximation.
