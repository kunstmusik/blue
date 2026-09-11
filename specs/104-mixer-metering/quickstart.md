# Quickstart Validation Guide: Realtime Mixer Metering

**Branch**: `104-mixer-metering` | **Date**: 2026-09-10

## Prerequisites

- Built `native/blue-engine` with `mixer-metering-v1` capability
- Built `packages/blue-engine-client` with meter topic subscription
- Built `packages/blue-data` with meter CSD emission
- Built `packages/blue-app` with meter UI components
- A multi-track Blue project with mixer enabled (several source channels, at least one
  subchannel, master)

## Automated Validation

### 1. CSD Fixture Byte-Identity (SC-005)

```bash
pnpm --filter @blue/data test -- --grep "fixture"
```

**Expected**: All existing CSD/XML fixtures pass unchanged. No meter statements appear in
disk-render or CSD-to-screen output.

### 2. CSD Meter Emission Tests

```bash
pnpm --filter @blue/data test -- --grep "meter"
```

**Expected**:
- `toBlueLiveCSD()` with metering enabled emits `chn_k "bm_meter_..."` declarations and
  `chnset` statements in the BlueMixer instrument
- `buildStandardCSD('disk')` does NOT emit any meter statements
- `buildStandardCSD('realtime')` (CSD-to-screen) does NOT emit meter statements
- `MeterBindingMap` is returned in `RenderCsdResult` with correct entries mapping CSD keys
  to UI strip IDs

### 3. Engine Protocol Tests

```bash
pnpm --filter @blue/engine-client test -- --grep "meter"
```

**Expected**:
- `MIXER_METERING_FEATURE` constant exists and is `'mixer-metering-v1'`
- Meter frame binary codec correctly encodes/decodes test frames
- `EngineClient` subscribes to `engine.meters` only when capability is present

### 4. Renderer Meter Component Tests

```bash
pnpm --filter @blue/app test -- --grep "meter"
```

**Expected**:
- Meter display state correctly computes ballistics (decay, peak hold, clip latch)
- Non-finite values are sanitized to 0.0
- Meter reset clears all display state

### 5. Full Build Validation

```bash
pnpm test && pnpm lint
pnpm --filter @blue/app build:main
```

**Expected**: All packages compile, lint, and tests pass.

## Manual Validation

### SC-001: Meters Track Audio

1. Open a multi-track project with mixer enabled
2. Start playback
3. **Verify**: Every channel strip (source, subchannel, master) shows a meter that rises and
   falls with the audio
4. Stop playback
5. **Verify**: All meters fall to silence within ~1 second

### SC-002: Update Rate

1. During playback, visually confirm meters update smoothly (no stuttering)
2. Optional: Enable meter frame logging in the console to verify ≥30 Hz

### SC-003: UI Responsiveness

1. During playback with many channels metered, drag a fader
2. Toggle solo/mute on channels
3. **Verify**: No perceptible lag in UI interactions

### SC-004: Audio Safety

1. Play a CPU-intensive project with metering enabled
2. **Verify**: No audio dropouts or glitches attributable to metering

### SC-005: Disk Render Identity

1. Render a project to disk before and after the feature
2. **Verify**: Output files are byte-identical

### SC-006: Capability Graceful Degradation

1. Run against an engine build WITHOUT `mixer-metering-v1`
2. Start playback
3. **Verify**: Playback works normally, meters stay inactive, no errors

### SC-007: Popout Window

1. During playback, pop out the mixer panel
2. **Verify**: Meters animate in the popout window
3. Re-dock the panel
4. **Verify**: Meters continue in the docked panel

### Engine Crash Recovery

1. During playback with active meters, kill the engine process
2. **Verify**: Meters fall to silence, app remains functional, no meter-related errors
