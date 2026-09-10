# Research Report Review: Realtime Mixer Metering (2026-09-10)

Review of the September 7, 2026 research report ("Realtime Mixer Metering (RMS & Peak) in Blue
Electron") against the actual codebase (develop @ 3f81d47a). The report's end-to-end
architecture (Csound computes meters → control channels → native sampling off the audio
thread → PUB/SUB topic → main-process IPC → canvas + rAF in renderer) is sound and fits this
codebase. The findings below correct concrete errors and record verified facts the plan must
build on.

## Verified correct (safe to build on)

1. **Java Blue has no mixer meters.** `blue-ui-core/.../mixer/ChannelPanel.java` (735 lines)
   contains effects chains, level, routing only; `blue-core` mixer has no telemetry. Net-new
   capability; no parity obligation.
2. **Mixer structure in `generateBlueMixer()`** (`packages/blue-data/src/blue-data/csd-policy.ts`
   ~L1320): per source channel `pre-effects → level → post-effects → route`; subchannels same
   with `outc`-bound master; all `ga_bluemix_*`/`ga_bluesub_*` cleared at end of instrument.
   Post-fader/post-effects tap between `applyEffectsChain(postEffects)` and
   `routeChannelOutput()` is the correct measurement point.
3. **Native engine facts** (`native/blue-engine`): `rebuildControlChannelCache()` uses
   `csoundListChannels`/`csoundGetChannelPtr`; `SharedMemory.h` `MAX_CHANNELS = 256`;
   SHM mirror direction is engine→host (`syncSharedMemoryFromBindings` reads Csound pointers,
   stores to SHM) each k-cycle; `performThread` runs `csoundPerformKsmps`; `ZmqHandler` binds
   REP 5555 + PUB 5556, `processOne()` polls REP with 50 ms timeout and publishes
   `engine.state` on lifecycle changes; main loop is `while (handler.processOne())`
   (`main.cpp:412`) on a separate thread from the audio thread.
4. **Client/protocol**: `ENGINE_STATE_TOPIC = 'engine.state'` only; binary codec helpers and
   capability command (`CMD_GET_CAPABILITIES`) exist (`packages/blue-engine-client/src/protocol.ts`).
5. **App plumbing**: `broadcastToWorkbenchWindows()` exists (`workbench-window-host.ts:231`);
   `EngineBridge` exposes state listeners and `stopPlayback()`; preload/global.d.ts pattern is
   as described.
6. **Renderer**: `ChannelStrip.tsx` has `.mixer-level-section` with SVG `MixerLevelSlider`
   (32 px, ResizeObserver); a canvas meter beside it is feasible; popout realm rules
   (`useHostDocument`) apply. Transient-registry + rAF approach (no React state at 30–60 Hz)
   is the right call.
7. ksmps=1 edge case: report correctly demands sample-count-based cadence, not k-cycle-based.
   Engine knows `sampleRate`/`ksmps` (`EngineStateSnapshot`).

## Report errors the plan must not inherit

1. **Source-channel identity is numeric, not `channel.id`.** `assignChannelIds()`
   (csd-policy.ts ~L847, mirrors Java) assigns sequential integers to source channels; the UI
   identifies strips by string `channel.id`. The report's `bm_meter_rms:${channelId}` with a
   UI string ID cannot work. A **MeterBindingMap** from the compile-time assignment
   (Channel→numeric id / sanitized subchannel name → UI strip id) must be produced at CSD
   generation and carried to the renderer for that playback session (FR-010).
2. **The playback CSD path is `toBlueLiveCSD()`, not `toCSD('realtime')`.** Playback flows
   through `blue-live-engine.ts:358` → `data.toBlueLiveCSD(session)`, which shares
   `generateMixerOrchestra()` → `generateBlueMixer()` (~L669). `toCSD`/`toCSDAsync` are used by
   "CSD to screen" (`csd-generation.ts`), and `generateBlueMixer` receives no `profile`
   argument today. Gating must therefore be per-call-site (meter statements emitted for the
   BlueLive playback program only; screen/disk paths unchanged — FR-008), not a
   `profile === 'realtime'` check inside `generateBlueMixer`.
3. **`chnset` alone is insufficient; declare channels at init.** The engine rebuilds its
   channel pointer cache at compile/score-read time (`CsoundEngine.cpp` ~L347, ~L583), before
   `BlueMixer`'s i-time (it is score-scheduled `i "BlueMixer" 0 36000`). Meter channels must
   exist at orchestra compile time — emit explicit `chn_k "bm_meter_...", 2` declarations in
   the global init section (where mixer `ga_*` inits are emitted), or verify auto-creation
   semantics; explicit declaration is deterministic either way.
4. **Csound `peak` never resets.** `kpeak peak asig` holds the running maximum since init;
   the report's snippet would show a monotonically growing bar. Use a windowed peak (e.g.
   `max_k` with a reset trigger, or manual per-window tracking); exact opcode choice and
   semantics must be verified with a focused CSD test in implementation.
5. **SHM exclusion claim is right but reasoning incomplete.** The Electron app does not read
   SHM (only name bookkeeping in `engine-process-registry`/`engine-session`; no reader
   addon), so ZMQ PUB is the pragmatic transport — but meter channels would also be mirrored
   every k-cycle by `syncSharedMemoryFromBindings` (engine→host), wasting the 256-slot budget
   and adding per-cycle stores. Exclusion from `ShmMirrorBinding` during
   `rebuildControlChannelCache()` is required for both capacity and cycle-cost reasons
   (FR-016).
6. **Report's performance numbers are unsourced** ("~20 ns", "< 3 µs", "0.2%"). Treat as
   hypotheses; validate with the engine's existing benchmark harness (`benchmark_main.cpp`,
   `src/benchmark`) per SC-004 rather than citing them.
7. **Minor**: decreasing `zmq_poll` timeout 50→25 ms is fine but publishing must be
   sequence-gated (publish only when a new frame exists), or idle loops re-send stale frames;
   Csound meter channel names embed arbitrary subchannel names — namespacing (`bm_meter_`)
   must be reserved and validated (63-byte name budget exists elsewhere in the protocol).

## Additional facts for the plan

- Realtime `nchnls` drives meter channel count per strip (`getNchnls(profile)`), i.e. meters
  are per output channel, 2 for typical stereo.
- Subchannel CSD identity is the whitespace-sanitized name (`ga_bluesub_${safeName}_${i}`,
  'Master' special-cased); pre-existing collision behavior ("My Drums" vs "My_Drums") must be
  defined for meters (first-wins + diagnostic acceptable).
- Engine sessions are managed by `engine-process-registry`/`engine-session` with kinds;
  meters must be scoped to the project playback session only (spec Assumptions).
- Capabilities handshake exists (`CMD_GET_CAPABILITIES`, `capabilities.ts`) for the
  `mixer-metering-v1` flag proposed by the report (FR-009).
- Report's edge-case table (disabled mixer, silent channels, non-finite audio, popouts,
  engine crash) is sound and is folded into the spec's edge cases; its "isReset packet" idea
  maps to FR-012 (lifecycle-driven silence, not packet-driven only).
