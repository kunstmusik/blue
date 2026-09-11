# Engine Meter Protocol Contract

**Version**: `mixer-metering-v1` | **Transport**: ZMQ PUB/SUB

## Capability Handshake

The engine advertises `mixer-metering-v1` in its `features` array returned by
`CMD_GET_CAPABILITIES`. The client checks:

```typescript
export const MIXER_METERING_FEATURE = 'mixer-metering-v1';
const supported = hasEngineFeature(capabilities, MIXER_METERING_FEATURE);
```

When the feature is absent, the client MUST NOT subscribe to the meter topic and the CSD
generator MUST NOT emit meter statements.

## PUB/SUB Topic

**Topic**: `engine.meters`

Published on the existing PUB socket (port 5556) alongside `engine.state`. The client subscribes
to `engine.meters` only when `mixer-metering-v1` is present in capabilities.

## Binary Frame Format

Each ZMQ message on `engine.meters` is a multi-part message:

```
Frame 0: topic bytes ("engine.meters")
Frame 1: payload (binary)
```

### Payload Layout

All values are little-endian.

```
Offset  Size   Type      Field
──────  ─────  ────────  ──────────────────────────────
0       4      uint32    sequence       (monotonically increasing frame number)
4       2      uint16    channelCount   (number of metered channels)
6       2      uint16    nchnls         (output channels per metered channel)
8       ...    entries[] (channelCount entries, each of fixed size)
```

### Entry Layout (per metered channel)

```
Offset  Size          Type       Field
──────  ────────────  ─────────  ──────────────────────────────
0       64            char[64]   csdKey (null-terminated UTF-8, matches MeterChannelIdentity.csdKey)
64      nchnls * 8    float64[]  rms values (one per output channel, linear amplitude)
64+N    nchnls * 8    float64[]  peak values (one per output channel, linear amplitude)
```

Where `N = nchnls * 8`.

**Entry size** = `64 + (nchnls * 8 * 2)` bytes.

**Total payload** = `8 + channelCount * entrySize` bytes.

### Example (stereo, 3 channels)

- `nchnls = 2`, `channelCount = 3`
- Entry size = `64 + (2 * 8 * 2) = 96` bytes
- Total = `8 + 3 * 96 = 296` bytes

## Publication Cadence

The engine publishes at approximately 30–40 Hz, gated by sample count (not k-cycle count).
Publication occurs on the ZMQ handler thread (not the audio thread). The handler reads cached
control channel pointers written by the audio thread.

A frame is published only when new data exists (sequence-gated); idle periods produce no
messages.

## Lifecycle

- **Start**: Meter channel pointers are resolved during `rebuildControlChannelCache()` after
  `compileOrc` + `readScore`. Publishing begins on the first `performKsmps` cycle.
- **Stop**: Publishing stops when the engine transitions out of `RUNNING` state. The final
  `engine.state` snapshot signals the client to reset meters.
- **Exclusion**: Meter channels (prefix `bm_meter_`) are excluded from `ShmMirrorBinding`.
