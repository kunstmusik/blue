# Research: Realtime Mixer Metering

**Branch**: `104-mixer-metering` | **Date**: 2026-09-10

## R-001: Meter Data Transport Mechanism

**Decision**: Use a new ZMQ PUB/SUB topic (`engine.meters`) for meter telemetry, not shared memory.

**Rationale**: The engine's SHM channel mirror (`SharedMemory.h`) has `MAX_CHANNELS = 256` entries
mirrored every k-cycle by `syncSharedMemoryFromChannels()`. Using it for meters would: (a) consume
bounded user-channel capacity (FR-016), (b) add per-k-cycle atomic stores even when no consumer
reads them, (c) require the Electron app to read SHM (it currently does not — only name
bookkeeping in `engine-session`). A dedicated PUB topic is sequence-gated (publish only when new
data exists), adds zero per-cycle cost when idle, and uses the existing ZMQ PUB socket on port
5556 already connected by `EngineClient`.

**Alternatives considered**:
- SHM with increased `MAX_CHANNELS`: Rejected — violates FR-016, adds unnecessary k-cycle cost,
  requires SHM reader addon in Electron.
- Separate TCP socket: Rejected — unnecessary complexity; the PUB socket already exists and
  supports multiple topics.
- WebSocket from engine: Rejected — adds a new transport; ZMQ is the established pattern.

## R-002: Csound Meter Channel Naming & Declaration

**Decision**: Use `chn_k` declarations in global init with prefix `bm_meter_` and explicit type
flag 2 (output). Channel names follow the pattern:
- Source channels: `bm_meter_rms_{channelId}_{outputIndex}`, `bm_meter_peak_{channelId}_{outputIndex}`
- Subchannels: `bm_meter_rms_sub_{safeName}_{outputIndex}`, `bm_meter_peak_sub_{safeName}_{outputIndex}`
- Master: `bm_meter_rms_sub_Master_{outputIndex}`, `bm_meter_peak_sub_Master_{outputIndex}`

**Rationale**: `report-review.md` (item 3) confirms the engine rebuilds its channel pointer cache
at compile/score-read time, before `BlueMixer` runs. Explicit `chn_k` declarations in the global
init section (alongside `ga_*` inits) ensure channels exist at compile time. The `bm_meter_` prefix
is reserved and namespaced to avoid collision with user channels. Names must fit the 63-byte
budget (`MAX_BATCH_NAME_BYTES`).

**Alternatives considered**:
- Implicit `chnset`-only: Rejected — `report-review.md` confirms channels must exist before
  `BlueMixer`'s i-time; auto-creation semantics are non-deterministic.
- Single packed channel per strip: Rejected — channel values are scalar `MYFLT`; packing would
  require custom decode and loses Csound-native semantics.

## R-003: Csound Peak Measurement Approach

**Decision**: Use manual windowed peak tracking (per-k-cycle `max` comparison with periodic reset),
not the Csound `peak` opcode.

**Rationale**: `report-review.md` (item 4) confirms `peak` holds the running maximum since
instrument init and never resets — producing a monotonically growing bar. For windowed peak, track
the running maximum manually and reset at each meter publication interval (derived from sample
count, targeting ~30-40 Hz). RMS is computed with the standard `rms` opcode over the same window.

**Alternatives considered**:
- `max_k` with reset trigger: Viable but `max_k` availability varies across Csound versions;
  manual tracking is universal and explicit.
- `peak` with periodic instrument restart: Rejected — instrument restart would gap the
  measurement and add orchestration complexity.

## R-004: Meter Tap Point in Signal Chain

**Decision**: Tap after `applyEffectsChain(postEffects)` and before `routeChannelOutput()` in
`generateBlueMixer()` (`csd-policy.ts` ~L1341).

**Rationale**: Confirmed by `report-review.md` (item 2) and spec clarification Q2. This is the
post-fader, post-effects signal before accumulation into the destination bus — the standard DAW
channel-strip meter position. For the master channel, tap after post-effects and before `outc`.

## R-005: CSD Generation Gating (FR-008)

**Decision**: Gate meter statement emission per-call-site, not by profile argument.

**Rationale**: `report-review.md` (item 2) clarifies the playback CSD path is `toBlueLiveCSD()`,
which shares `generateMixerOrchestra()` → `generateBlueMixer()` with `buildStandardCSD('realtime')`
(used by "CSD to screen"). Since `generateBlueMixer` receives no profile argument, gating inside
it would require threading a flag through multiple functions. Instead, pass an `emitMetering` flag
(defaulting to `false`) through `generateMixerOrchestra` → `generateBlueMixer`, set to `true`
only at the `toBlueLiveCSD` call site and the `startPlayback` path in `main.ts` that calls
`toRealtimePlaybackCSD`.

**Alternatives considered**:
- Profile-based gating inside `generateBlueMixer`: Rejected — the function doesn't receive a
  profile, and "CSD to screen (realtime)" must NOT have meter statements despite using the
  `'realtime'` profile.

## R-006: MeterBindingMap Construction

**Decision**: Build the MeterBindingMap during CSD generation and return it as part of
`RenderCsdResult`. The map associates compile-time CSD channel identities (numeric source channel
ID / sanitized subchannel name) with UI strip identities (`channel.id` strings).

**Rationale**: `report-review.md` (item 1) confirms source channels use sequential integer IDs
from `assignChannelIds()`, while the UI identifies strips by string `channel.id`. The binding map
must be produced at the same point that assigns these identities (CSD generation) and carried to
the renderer for the playback session. It is transient per session and never persisted.

## R-007: Engine Capability Flag

**Decision**: Add `mixer-metering-v1` to the engine's `features` array in `Capabilities.cpp` and
declare the corresponding constant in `capabilities.ts`.

**Rationale**: The existing capability handshake (`CMD_GET_CAPABILITIES`) already validates
required features. The client checks `hasEngineFeature(capabilities, MIXER_METERING_FEATURE)`
before emitting meter CSD statements or subscribing to the meter topic. Engines without the flag
behave identically to today (FR-009).

## R-008: Meter Data Publication from Engine

**Decision**: The engine's ZMQ handler publishes meter frames on a `engine.meters` topic from the
main thread (not the audio thread), reading Csound control channel pointers that were written by
the audio thread's k-cycle.

**Rationale**: The audio thread writes `chnset` values at k-rate. The engine's main loop
(`while (handler.processOne())`) already runs on a separate thread from the audio thread with a
50ms poll timeout. The meter publisher reads the control channel pointers (already cached by
`rebuildControlChannelCache()`) at the publication cadence (~30 Hz) and publishes a binary frame.
This is non-blocking from the audio thread's perspective (FR-014) — the audio thread writes to
Csound channel memory; the publisher thread reads it.

## R-009: SHM Mirror Exclusion

**Decision**: Meter channels (prefix `bm_meter_`) must be excluded from `ShmMirrorBinding` during
`rebuildControlChannelCache()`.

**Rationale**: `report-review.md` (item 5) confirms `syncSharedMemoryFromBindings` mirrors every
cached channel every k-cycle. Meter channels would waste the 256-slot budget and add per-cycle
atomic stores. A name-prefix check (`bm_meter_`) during `rebuildControlChannelCache` skips these
channels from the SHM binding list.

## R-010: Renderer Meter Display Architecture

**Decision**: Use a transient registry + `requestAnimationFrame` loop, bypassing React state for
meter values. The meter component uses an HTML5 Canvas element, obtains its `document` from
`useHostDocument()` for popout compatibility, and reads from a shared meter store updated by IPC.

**Rationale**: `report-review.md` (item 6) confirms this approach. React re-renders at 30-60 Hz
would be prohibitively expensive for dozens of meters (FR-013). A canvas-based meter beside the
existing SVG `MixerLevelSlider` (32px wide, `ResizeObserver`-aware) in the `.mixer-level-section`
div fits the existing layout. The rAF loop reads from a plain object store and draws directly;
no React state changes occur per meter update.

## R-011: IPC Streaming Pattern

**Decision**: Main process receives ZMQ meter frames via `EngineClient`, then broadcasts to all
workbench windows via `broadcastToWorkbenchWindows('meter-frame', data)`. The preload script
exposes a listener registration function.

**Rationale**: `broadcastToWorkbenchWindows()` already exists in `workbench-window-host.ts` and is
used by the engine bridge for playback status. This handles popout windows automatically (FR-015).
The meter frame payload is a compact binary or structured object with channel identities and
values.
