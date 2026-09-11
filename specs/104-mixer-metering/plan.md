# Implementation Plan: Realtime Mixer Metering

**Branch**: `104-mixer-metering` | **Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/104-mixer-metering/spec.md`

## Summary

Add realtime RMS and peak level meters to every mixer channel strip (source, subchannel, master)
during playback. The audio engine computes raw windowed RMS/peak values via Csound `chnset` in
the BlueMixer instrument, publishes compact meter frames over a new ZMQ PUB/SUB topic
(`engine.meters`), and the renderer displays them using a canvas-based meter with
`requestAnimationFrame` — bypassing React state to maintain UI responsiveness at scale.
Metering is gated by engine capability (`mixer-metering-v1`), scoped to the realtime playback
program only, and introduces no persistent state.

## Technical Context

**Language/Version**: TypeScript 5.x (packages), C++ 20 (native engine), Csound 6.x (CSD generation)

**Primary Dependencies**: Electron 36+, React 19, ZeroMQ (via zeromq.js), @rgrove/parse-xml,
Dockview, Vitest, Csound API

**Storage**: N/A — all meter data is transient runtime state. No persistence introduced.

**Testing**: Vitest (`pnpm test`), focused CSD emission tests, protocol codec tests, display
state unit tests, manual playback validation

**Target Platform**: macOS (primary dev), Windows/Linux (CI)

**Project Type**: Desktop application (Electron)

**Performance Goals**: ≥30 Hz meter updates per channel during playback; mixer panel stays
interactive with 64 metered strips (SC-003); no audio dropouts from metering (SC-004)

**Constraints**: Meter data must not enter SHM (256-slot budget, FR-016); disk-render and
CSD-to-screen output byte-identical (SC-005); `@blue/data` remains host-neutral (Constitution I)

**Scale/Scope**: Typical projects have 2–30 mixer channels; stress target is 64 strips with
`nchnls=2` (128 meter values per frame). Frame payload ~6 KB at 64 channels stereo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: PASS — `@blue/data` changes are limited to CSD generation
  (`csd-policy.ts`) and `RenderCsdResult` type extension. No Node.js built-ins, DOM APIs,
  Electron APIs, dynamic imports, or host implementation details are introduced. The
  `MeterBindingMap` type is a plain serializable object. Csound code generation remains
  string-based. `getInitStatements()` extension in `mixer.ts` is pure string concatenation.

- **Java and project compatibility**: PASS — Java Blue has no mixer meters (verified:
  `ChannelPanel.java` has no metering). This is net-new; no parity obligation. `.blue` XML is
  unaffected (no meter data persisted). CSD metering statements are additive to the realtime
  playback program only; disk-render and CSD-to-screen paths are unchanged. Existing CSD
  fixtures remain byte-identical. The metering tap uses existing `assignChannelIds()` numeric
  IDs and sanitized subchannel names — same identity system shared with Java.

- **Canonical ownership and contracts**: PASS —
  - `MeterBindingMap`: owned by CSD generation, returned in `RenderCsdResult`, carried to
    renderer via IPC. Transient per session.
  - `MeterFrame`: owned by engine (source of truth), decoded by `EngineClient`, forwarded by
    main process via `broadcastToWorkbenchWindows`. Transient.
  - `MeterDisplayState`: owned by renderer meter store. Disposable, reset on stop.
  - No durable store introduced. No migration needed.
  - IPC contracts: typed `MeterBindingMapPayload`, `MeterFramePayload` via preload. See
    [ipc-meter-contract.md](contracts/ipc-meter-contract.md).

- **Runtime and engine isolation**: PASS — Engine changes are in `native/blue-engine` (C++):
  meter channel pointer resolution in `rebuildControlChannelCache()`, SHM exclusion, ZMQ
  publication in `ZmqHandler`. Client decoding in `@blue/engine-client` (TypeScript).
  Renderer and `@blue/data` never touch ZMQ, engine native state, or filesystem.

- **Host-path portability**: N/A — No filesystem paths involved in metering. Csound channel
  names are ASCII identifiers, not file paths.

- **Verification evidence**: PASS —
  - CSD emission: fixture identity tests, meter emission tests in `@blue/data`
  - Protocol: codec round-trip tests in `@blue/engine-client`
  - Display state: ballistics unit tests, sanitization tests in `@blue/app`
  - Build: `pnpm test`, `pnpm lint`, `pnpm --filter @blue/app build:main`
  - Manual: quickstart scenarios (see [quickstart.md](quickstart.md))

## Project Structure

### Documentation (this feature)

```text
specs/104-mixer-metering/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── research/
│   └── report-review.md # Pre-existing research review
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── engine-meter-protocol.md
│   ├── ipc-meter-contract.md
│   └── csd-meter-emission.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
# @blue/data — CSD generation changes
packages/blue-data/src/
├── blue-data/csd-policy.ts          # Meter CSD emission in generateBlueMixer, init declarations
├── blue-data.ts                     # RenderCsdResult type extension (meterBindingMap)
├── mixer/mixer.ts                   # getInitStatements extension for chn_k declarations

# @blue/engine-client — protocol extension
packages/blue-engine-client/src/
├── protocol.ts                      # METER_TOPIC constant
├── capabilities.ts                  # MIXER_METERING_FEATURE constant
├── engine-client.ts                 # Meter topic subscription, frame decoding
├── meter-codec.ts                   # [NEW] Binary meter frame encode/decode

# native/blue-engine — engine metering
native/blue-engine/src/
├── CsoundEngine.cpp                 # rebuildControlChannelCache: meter channel exclusion from SHM
├── ZmqHandler.cpp                   # Meter frame publication on engine.meters topic
├── ZmqHandler.h                     # Meter publisher state
├── ipc/SharedMemory.cpp             # bm_meter_ prefix exclusion

# @blue/app — main process
packages/blue-app/src/main/
├── engine-bridge.ts                 # Meter frame forwarding via broadcastToWorkbenchWindows
├── main.ts                          # MeterBindingMap forwarding at playback start

# @blue/app — preload
packages/blue-app/src/preload/
├── preload.ts                       # onMeterBindingMap, onMeterFrame, onMeterReset listeners

# @blue/app — shared types
packages/blue-app/src/shared/
├── meter-types.ts                   # [NEW] MeterBindingMapPayload, MeterFramePayload types

# @blue/app — renderer
packages/blue-app/src/renderer/
├── stores/meter-store.ts            # [NEW] Transient meter state store (non-React)
├── components/workbench/panels/mixer/
│   ├── ChannelStrip.tsx             # Mount MeterCanvas in mixer-level-section
│   └── MeterCanvas.tsx              # [NEW] Canvas-based meter component with rAF loop
```

**Structure Decision**: Changes span 4 packages (`@blue/data`, `@blue/engine-client`,
`native/blue-engine`, `@blue/app`) following the existing layered architecture. New files are
minimal: `meter-codec.ts`, `meter-types.ts`, `meter-store.ts`, `MeterCanvas.tsx`. All other
changes modify existing files at defined extension points.

## Complexity Tracking

> No Constitution Check violations. No complexity exceptions needed.
