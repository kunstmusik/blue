# CSD Meter Emission Contract

## Scope

Metering Csound statements are emitted ONLY for the realtime playback program:
- `toBlueLiveCSD()` path: YES (via `emitMetering: true` flag)
- `toRealtimePlaybackCSD()` / `buildStandardCSD('realtime')` path: YES (via `emitMetering: true` in `startPlayback`)
- `buildStandardCSD('disk')` path: NO
- "CSD to screen" paths: NO
- CSD export: NO

## Global Init Declarations

Emitted alongside `ga_bluemix_*` / `ga_bluesub_*` init statements in the global orchestra
section, before any instrument definitions:

```csound
; Source channel 0, stereo (nchnls=2)
chn_k "bm_meter_rms_0_0", 2
chn_k "bm_meter_rms_0_1", 2
chn_k "bm_meter_peak_0_0", 2
chn_k "bm_meter_peak_0_1", 2

; Subchannel "Reverb", stereo
chn_k "bm_meter_rms_sub_Reverb_0", 2
chn_k "bm_meter_rms_sub_Reverb_1", 2
chn_k "bm_meter_peak_sub_Reverb_0", 2
chn_k "bm_meter_peak_sub_Reverb_1", 2

; Master, stereo
chn_k "bm_meter_rms_sub_Master_0", 2
chn_k "bm_meter_rms_sub_Master_1", 2
chn_k "bm_meter_peak_sub_Master_0", 2
chn_k "bm_meter_peak_sub_Master_1", 2
```

The `2` flag means output (engine writes, host reads).

## BlueMixer Instrument Meter Statements

Inserted in `generateBlueMixer()` after `applyEffectsChain(postEffects)` and before
`routeChannelOutput()` for each source and subchannel, and after post-effects before `outc`
for the master:

```csound
; --- Meter tap for source channel 0 ---
; RMS (windowed)
kMeter_rms_0_0 rms ga_bluemix_0_0
kMeter_rms_0_1 rms ga_bluemix_0_1
chnset kMeter_rms_0_0, "bm_meter_rms_0_0"
chnset kMeter_rms_0_1, "bm_meter_rms_0_1"

; Peak (windowed, manual tracking with periodic reset)
kMeter_peak_0_0 max kMeter_peak_0_0, abs(ga_bluemix_0_0)
kMeter_peak_0_1 max kMeter_peak_0_1, abs(ga_bluemix_0_1)

; Windowed reset (sample-count based, ~30 Hz)
kMeterSamples += ksmps
if kMeterSamples >= kMeterWindow then
  chnset kMeter_peak_0_0, "bm_meter_peak_0_0"
  chnset kMeter_peak_0_1, "bm_meter_peak_0_1"
  kMeter_peak_0_0 = 0
  kMeter_peak_0_1 = 0
  kMeterSamples = 0
endif
```

> **Note**: The exact windowed peak implementation will be validated with a focused CSD test
> during implementation (per `report-review.md` item 4). The above is the design intent; the
> implementation may use `max_k` or an equivalent if it proves cleaner.

## Channel Name Budget

All meter channel names must fit within `MAX_BATCH_NAME_BYTES` (63 UTF-8 bytes). With the
`bm_meter_peak_sub_` prefix (19 bytes) plus `_{outputIndex}` suffix (2 bytes), subchannel
names are limited to 42 bytes — well within typical mixer naming.

## Byte-Identity Guarantee

Projects that do not use `toBlueLiveCSD()` or `toRealtimePlaybackCSD()` with metering enabled
produce byte-identical CSD output to the pre-feature baseline. Existing CSD fixtures MUST
continue to pass unchanged (FR-008, SC-005).
