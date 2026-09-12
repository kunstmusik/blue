# Quickstart Validation: Meter Presentation and Calibration

## Prerequisites

- Work from repository root on branch `105-meter-presentation-calibration`.
- Install workspace dependencies with `pnpm install` if needed.
- Have one legacy `.blue` fixture without the new mixer elements and one project saved by the new
  version.

## 0. Baseline and Compatibility Reference

- **Java `<mixer>` child ordering**:
  1. `<enabled>` (boolean)
  2. `<extraRenderTime>` (double)
  3. `<channelListGroups>` (if present and non-empty)
  4. `<channelList list="channels">` (Orchestra)
  5. `<channelList list="subChannels">` (SubChannels)
  6. `<channel>` (Master)
  *(Reference: `~/work/nbprojects/blue/blue-core/src/main/java/blue/mixer/Mixer.java`)*
- **Legacy absence semantics**:
  Java Blue `Mixer.java` has no concept of `enableMeters` or `meterProfile`. Projects lacking these XML elements indicate legacy projects and must resolve on load to `enableMeters=false` and `meterProfileKey='peak-rms-linear-plus-6'`. New projects default to `enableMeters=true` and `meterProfileKey='peak-rms-mixing-plus-6'`.
- **Spec 104 Realtime Metering & CSD baseline**:
  Meter telemetry emits Csound `chn_k` statements (`bm_meter_rms_*` and `bm_meter_peak_*`) during mixer init. Meter presentation profiles and visibility toggles do not alter CSD generation, audio routing, fader taper, or signal processing (`.tmp-research/METER_FADE_ROUND2.md`).


## 1. Focused automated validation

```bash
pnpm --filter @blue/data test -- src/mixer/mixer.test.ts
pnpm --filter @blue/app test -- src/renderer/tests/meter-store.test.ts src/renderer/tests/meter-canvas.test.tsx src/renderer/tests/mixer-contract.test.ts src/renderer/tests/mixer-panel.test.tsx src/renderer/tests/mixer-meter-popout.test.tsx
pnpm --filter @blue/app verify:global-history
pnpm --filter @blue/app build:main
pnpm --filter @blue/app build:renderer
git diff --check
```

Expected:

- New, legacy, explicit, and invalid XML cases pass.
- Stable keys survive snapshot, patch, save, copy, undo, and redo; visual labels never appear in XML.
- All profile landmarks and monotonic, clamped mappings pass.
- Atomic peak reset and disabled-meter cleanup pass.
- Mixer Settings and profile selection work in docked and detached host documents.

## 2. New and legacy defaults

1. Create a new project and open the mixer.
2. Confirm meters are visible and the selected label is `Peak/RMS (+6 dBFS)`.
3. Open a pre-feature project containing no `enableMeters` or `meterProfile` child.
4. Confirm meters are hidden.
5. Open Mixer Settings, enable meters, and confirm the legacy project initially uses
   `Peak/RMS Linear (+6 dBFS)`.
6. Save, close, and reopen both projects; confirm their explicit choices persist.

## 3. Profile identity and presentation

1. Play fixed signals at -60, -30, -20, -14, -12, -6, 0, and +6 dBFS as applicable.
2. Select each of the five profile labels from the meter surface.
3. Confirm bars, peak markers, ticks, labels, and colors move to the profile's documented positions.
4. Confirm the numeric peak remains the same absolute dBFS value while profiles change.
5. Inspect saved XML and confirm only stable keys appear, never visual labels.
6. Temporarily change a registry label in a development build and confirm an existing saved key
   selects the newly labeled profile without migration.

## 4. Peak readout and reset

1. Play a stereo or multichannel signal with different peaks per output.
2. Confirm the strip readout shows the highest held sample peak to one decimal place.
3. Click the meter and confirm its numeric peak, all peak-hold markers, and all clip flags clear.
4. Repeat by clicking the numeric readout.
5. Confirm other strips are unaffected and `-inf` appears until new finite audio arrives.

## 5. Project history and concurrent views

1. Open the mixer docked and in a detached view.
2. Toggle Enable Meters in Mixer Settings and select a different profile.
3. Confirm both views update immediately and the project becomes dirty.
4. Undo and redo each action independently.
5. Confirm both views, an open settings dialog, canonical values, stable channel identities, and
   dirty state follow history exactly.
6. Reapply the active value and confirm no history or dirty-state change.

## 6. Accessibility, layout, and performance

1. Navigate to the Mixer Settings gear at the far right of the mixer toolbar using only the
   keyboard.
2. Confirm its accessible name, visible focus, dialog focus behavior, checkbox state, and close
   behavior in both docked and detached views.
3. Resize and zoom the mixer; confirm aligned ticks remain visible and at least one labeled scale is
   legible.
4. Disable meters during playback; confirm meter animation and repaint stop, stale holds are cleared,
   and mixer controls and audio continue normally.
5. Re-enable meters; confirm they restart from silence without stale clip or peak state.

## 7. Audio and export non-regression

For representative projects, compare CSD-to-screen, exported CSD, and disk-render fixtures across
all five profiles and both visibility states. Expected output is byte-identical because these values
are presentation-only.

## 8. Full validation before handoff

```bash
pnpm test
pnpm lint
git diff --check
```

Record any platform-specific manual checks for macOS, Windows, and Linux in the implementation
handoff.

## 9. Execution Evidence (2026-09-11)

### Focused automated validation (§ 1)
- `pnpm --filter @blue/data test -- src/mixer/mixer.test.ts`: **1860 passed** (1 skipped, 185 test files). Verified new, legacy, explicit, and invalid XML round-trip, absent `<mixer>` root element policy, and CSD byte-identical parity.
- `pnpm --filter @blue/app test -- src/renderer/tests/meter-store.test.ts src/renderer/tests/meter-canvas.test.tsx src/renderer/tests/mixer-contract.test.ts src/renderer/tests/mixer-panel.test.tsx src/renderer/tests/mixer-meter-popout.test.tsx`: **4895 passed** (2 skipped, 466 test files). Verified profile registry landmarks, click-to-clear peak reset, Mixer Settings dialog, docked/detached synchronization, and history undo/redo.
- `pnpm --filter @blue/app verify:global-history`: **Passed** (exit code 0). 100 samples per direction; undo p50=45.3ms, redo p50=41.8ms; retainedBytes=44828, heapDeltaBytes=0.
- `pnpm --filter @blue/app build:main`: **Passed** (exit code 0). TypeScript main process compilation succeeded with zero type errors.
- `pnpm --filter @blue/app build:renderer`: **Passed** (exit code 0). Vite renderer and preload bundles built cleanly.
- `pnpm --filter @blue/app test:browser`: **69 passed** (14 test files). Includes 7 accessibility-focus tests, 7 accessibility-contrast tests, and the 64-strip mounted mixer frame rate/latency benchmark (`[SC-003] baselineFps=59.9 meteredFps=59.9 baselineInteractionMs=24.00 meteredInteractionMs=28.60 fpsRatio=1.000`).

### Full validation before handoff (§ 8)
- `pnpm test`: **Passed** (exit code 0). All packages (`native/blue-engine`, `@blue/data`, `@blue/engine-client`, `@blue/app`) and all 49 node scripts tests passed.
- `pnpm lint`: **Passed** (exit code 0). Typography audit verified (1281 approved role assignments, 0 unapproved roles, 0 arbitrary sizes), ESLint passed across the monorepo, and Prettier verified code style across all files.
- `git diff --check`: **Passed** (exit code 0, zero whitespace or EOF errors).

### Closure verification (2026-09-11)

- Preferred far-right toolbar gear placement: **Passed** in focused renderer tests.
- Mixer Settings and meter-context profile interaction: **Passed** in focused renderer tests.
- Accessibility focus and contrast coverage: **14 passed** across the two focused browser suites.
- Renderer production build, targeted ESLint/Prettier, and `git diff --check`: **Passed**.
- Project-owner manual acceptance: **Passed**; the completed feature looked correct in manual use.
