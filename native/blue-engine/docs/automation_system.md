# Automation System

The automation system provides a mechanism for automatically updating native Csound control-channel values over time, with shared memory maintained as a read mirror for external processes. This enables time-based parameter control (e.g., envelopes, fades) that runs efficiently within the engine thread while remaining observable from other processes.

## Overview

### Goals

1. **Engine-Thread Processing**: All automation processing occurs in the Csound performance thread, minimizing IPC overhead during runtime
2. **External Configuration**: Automations can be created, updated, and deleted via ZMQ messages from external processes
3. **Lock-Free Design**: Uses immutable data structures with atomic pointer swap—zero contention between threads
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
│  │ (Main Thread)   │      │  (atomic shared_ptr swap)       │           │
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
- Automations that complete remain at their final value until explicitly removed or updated

### Single Automation Per Channel

Each channel can have at most one automation.

- **Creation**: Setting a new automation for a channel seamlessly replaces any existing automation.
- **Updates**: If an automation is updated while running, it continues execution relative to its original start time (if preserving timing is desired) or resets, depending on the command. *Clarification: The "Update" command replaces the definition. The system ensures the new curve is evaluated at the current time offset, preventing jumps if the curve shape essentially matches.*
- **Missing Channels**: If an automation targets a channel that has not been exported yet, the engine can stage a value for later application, but live automation only affects exported control channels.

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
    bool highPrecision;               // Use BigDecimal-compatible quantization
};
```

### AutomationList

Immutable container for all active automations:

```cpp
struct AutomationList {
    // Map channel name -> AutomationDef
    std::map<std::string, AutomationDef> automations;
};
```

### Runtime State

Maintained by the performance thread:

```cpp
struct AutomationState {
    size_t currentIndex;  // Current segment index optimization
    bool completed;       // Has reached end
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

    // Called from performance thread (reader)
    std::shared_ptr<const AutomationList> getList() const {
        return currentList_.load();
    }

private:
    std::atomic<std::shared_ptr<const AutomationList>> currentList_;
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
    AutomationManager(const std::shared_ptr<AutomationStore>& store, ChannelWriter writer);

    // Called once per k-cycle, before csoundPerformKsmps()
    void process(int64_t currentSampleNumber, double sampleRate);

    // Reset state (called on engine start)
    void reset();

private:
    std::shared_ptr<AutomationStore> store_;
    ChannelWriter writer_;

    // Local state vector, keyed by channel name or ID
    // We use a map here to match the store's structure
    std::map<std::string, AutomationState> states_;

    double interpolate(const AutomationDef& def, double elapsed);
};
```

### Integration with CsoundEngine

```cpp
void CsoundEngine::performThread() {
    int64_t sampleNumber = 0;

    while (!shouldStop_.load()) {
        // Process automations
        if (automationMgr_) {
            automationMgr_->process(sampleNumber, csoundGetSr(csound_));
        }

        if (CsoundLoader::csoundPerformKsmps(csound_) != 0) {
            break;
        }

        sampleNumber += csoundGetKsmps(csound_);
    }
}
```

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
// Handle zero crossing or negative values by falling back to linear
// or implementing a specific signed exponential behavior
if (p0.value <= 0 || p1.value <= 0) return linear(p0, p1, t);
double logRatio = log(p1.value / p0.value);
double y = p0.value * exp(t * logRatio);
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

When `highPrecision` is enabled, uses `FixedPoint` arithmetic to match Java's
`BigDecimal` behavior exactly. This is useful when exact compatibility with
Blue's Java `Line.getValue()` implementation is required:

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
    FixedPoint yFixed = FixedPoint::fromDouble(y, def.resolutionScale);
    yFixed = yFixed.setScale(def.resolutionScale, RoundingMode::FLOOR);
    FixedPoint resFixed = FixedPoint::fromDouble(def.resolution, def.resolutionScale);
    FixedPoint remainder = yFixed.remainder(resFixed);
    FixedPoint quantized = yFixed.subtract(remainder);
    y = quantized.toDouble();
}
```

### FixedPoint Class

The `FixedPoint` class provides BigDecimal-compatible arithmetic:

- **Internal Representation**: Uses `int64_t` unscaled value with decimal scale
- **Operations**: add, subtract, multiply, remainder, setScale
- **Rounding Modes**: FLOOR, CEILING, DOWN, UP, HALF_UP, HALF_DOWN, HALF_EVEN
- **setScale**: Matches Java's `BigDecimal.setScale(int, RoundingMode)` behavior

### Per-Cycle Processing

```cpp
void AutomationManager::process(int64_t currentSample, double sr) {
    // 1. Load the current automation list
    auto list = store_->getList();
    if (!list) return;

    // 2. Iterate through automations
    for (const auto& [channelName, def] : list->automations) {
        if (!def.enabled) continue;

        // 3. Find or create state
        auto& state = states_[channelName];
        if (state.completed) { // Reset if completed
            state.currentIndex = 0;
            state.completed = false;
        }

        // 4. Calculate absolute time from engine start
        double elapsed = static_cast<double>(currentSample) / sr;

        // 5. Interpolate and quantize value at current time
        double value = interpolate(def, elapsed);

        // 6. Write the native control channel value
        if (writer_) {
            writer_(channelName, value);
        }
    }

    // 7. Cleanup states for removed or disabled automations
    for (auto it = states_.begin(); it != states_.end();) {
        if (list->automations.find(it->first) == list->automations.end() ||
            !list->automations.at(it->first).enabled) {
            it = states_.erase(it);
        } else {
            ++it;
        }
    }
}
```

## Thread Safety

**Lock-Free Immutable Swap**:

1. **Writers (ZMQ Thread)**:
   - Load `currentList_`
   - Create deep copy: `newList = make_shared<AutomationList>(*currentList_)`
   - Modify `newList`
   - `atomic_store(&currentList_, newList)`
   - Old list destroyed when refcount hits 0 (after readers finish)

2. **Reader (Performance Thread)**:
   - `localPtr = atomic_load(&currentList_)`
   - Read from `*localPtr`
   - `localPtr` goes out of scope, refcount decrements

This guarantees the audio thread never blocks on a mutex.

## File Structure

```
src/
├── automation/
│   ├── AutomationTypes.h      # Data structures (AutomationDef, AutomationList)
│   ├── AutomationStore.h      # Thread-safe storage (the Writer)
│   ├── AutomationStore.cpp
│   ├── AutomationManager.h    # Per-cycle logic (the Reader)
│   └── AutomationManager.cpp
...
```
