# Implementation Plan: Meter Presentation and Calibration

**Branch**: `105-meter-presentation-calibration` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/105-meter-presentation-calibration/spec.md`

## Summary

Add project-owned mixer presentation settings, five stable meter-profile keys with replaceable
visual labels, profile-aware dB mapping/ticks/colors, one numeric held peak per strip, atomic
click-to-clear behavior, and a Mixer Settings gear at the far right of the mixer toolbar opening a
dialog containing Enable Meters. The toolbar location is the preferred placement because it remains
visible independently of channel-strip scrolling.
Extend the existing Mixer model, document patch/snapshot contracts, and scalar ProjectHistory path
so new projects enable meters with `peak-rms-mixing-plus-6`, while loaded projects missing the new
XML fields disable meters and use `peak-rms-linear-plus-6`. Reuse the Spec 104 RMS/peak telemetry;
do not alter fader taper, audio generation, or engine protocol.

## Technical Context

**Language/Version**: TypeScript 5.8 in strict mode; React 19; Electron 35

**Primary Dependencies**: `@blue/data`, React, Zustand, Lucide React, existing project-editor and
ProjectHistory contracts; Canvas 2D for meter rendering

**Storage**: Canonical `.blue` XML under the existing `<mixer>` element; transient meter values and
state remain renderer memory only

**Testing**: Vitest unit, jsdom, and browser tests; project XML fixtures; global-history
verification; TypeScript builds; ESLint and Prettier; deterministic manual checks

**Target Platform**: Blue Electron desktop on macOS, Windows, and Linux; docked and detached mixer
surfaces

**Project Type**: Multi-package desktop application with platform-neutral data core and Electron
host/renderer packages

**Performance Goals**: Preserve the existing animation-frame cadence with no React state update per
telemetry frame; disabled meters perform no canvas animation or repaint; profile mapping remains
O(1) per channel per rendered frame

**Constraints**: Stable serialized keys must be independent of labels; legacy missing fields have
different defaults from newly constructed projects; profile changes are presentation-only; no new
engine messages, meter measurements, dependencies, or fader behavior

**Scale/Scope**: Five profiles applied project-wide to all source, subchannel, and master strips;
one settings dialog; existing mono, stereo, and multichannel telemetry; one scalar visibility patch
and one scalar profile patch

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core — PASS (pre/post)**: `@blue/data` gains only a string-key type, validation,
  model fields, copy behavior, and XML serialization. It gains no React, DOM, Electron, Node.js,
  dynamic import, or host dependency. Labels and Canvas behavior remain in `@blue/app`.
- **Java and project compatibility — PASS (pre/post)**: Java
  `blue-core/src/main/java/blue/mixer/Mixer.java` confirms `<mixer>` ownership and the absence of
  presentation fields. Existing enabled/channels/effects/routing/extra-render-time and unknown data
  remain intact. The intentional divergence is two optional Electron-era child elements with
  explicit missing-field semantics. CSD generation and audio values are unchanged and covered by
  regression fixtures.
- **Canonical ownership and contracts — PASS (pre/post)**: `BlueData.getMixer()` canonically owns
  `enableMeters` and `meterProfileKey`; `.blue` XML persists them. `MixerSnapshot` publishes them and
  typed `MixerPatch` variants mutate them. Labels, open-dialog state, telemetry, peak holds, and clip
  flags remain derived or transient. Invalid keys recover to the legacy linear key without blocking
  project load.
- **Project history and undo/redo — PASS (pre/post)**: `setMeterEnabled` and `setMeterProfile` are
  scalar ProjectHistory patches labeled Enable/Disable Meters and Set Meter Profile. Existing scalar
  preparation/memento machinery records old/new values. Focused tests cover no-op, commit, undo,
  redo, stable mixer/channel identities, dirty state, snapshot publication, dialog reconciliation,
  and clearing transient meter state on disable. There is no preview/cancel writer.
- **Runtime and engine isolation — PASS (pre/post)**: Existing Spec 104 engine protocol and main
  process transport remain unchanged. Renderer presentation consumes existing RMS/peak snapshots.
  A subsequent playback start may omit telemetry subscription/emission when meters are disabled
  only through existing typed options; correctness does not depend on that optimization.
- **Host-path portability — N/A (pre/post)**: The feature reads no host paths and adds no filesystem
  boundary. Cross-platform coverage is UI/model behavior only.
- **Verification evidence — PASS (pre/post)**: Model default/load/save/deep-copy tests; legacy and
  invalid-key XML tests; snapshot/patch/action-label/history round trips; scale landmark and
  monotonic-mapping tests; meter-store reset tests; Canvas tick/readout/profile tests; MixerPanel
  dialog, accessibility, persistence, and popout tests; canonical CSD regression; affected package
  tests, builds, lint, formatting, and `git diff --check`; plus [quickstart.md](quickstart.md).

## Project Structure

### Documentation (this feature)

```text
specs/105-meter-presentation-calibration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── meter-presentation.md
└── tasks.md                    # created later by /speckit-tasks
```

### Source Code (repository root)

```text
packages/blue-data/src/
└── mixer/
    ├── mixer.ts
    └── mixer.test.ts

packages/blue-app/src/shared/project-editor/
├── contract.ts
├── snapshot-mixer-orchestra.ts
└── patch-mixer-bluelive.ts

packages/blue-app/src/main/
├── project-history.ts
├── project-history-memento.ts
└── global-project-history.test.ts

packages/blue-app/src/renderer/
├── components/workbench/panels/
│   ├── MixerPanel.tsx
│   └── mixer/
│       ├── ChannelStrip.tsx
│       ├── MeterCanvas.tsx
│       ├── MixerSettingsDialog.tsx
│       └── meter-profiles.ts
├── stores/
│   ├── meter-store.ts
│   └── project-store.ts
└── tests/
    ├── meter-canvas.test.tsx
    ├── meter-store.test.ts
    ├── mixer-contract.test.ts
    ├── mixer-panel.test.tsx
    └── mixer-meter-popout.test.tsx
```

**Structure Decision**: Extend the existing mixer model, document bridge, scalar history mechanism,
meter store, and mixer components. Keep profile keys and project validation in the portable data or
shared contract boundary, but keep display strings, curves, marks, colors, and Canvas rendering in
the renderer. Add no package and no generalized strategy infrastructure beyond one closed keyed
profile registry required by the five profiles.

## Phase 0: Research Decisions

All decisions and alternatives are recorded in [research.md](research.md). No NEEDS CLARIFICATION
items remain. The decisive points are stable identity versus replaceable labels, missing-field
legacy defaults, exact measurement naming, project-wide scope, and reuse of existing RMS/peak data.

## Phase 1: Design and Contracts

- [data-model.md](data-model.md) defines canonical fields, stable-key validation, XML absence
  semantics, transient peak state, and settings transitions.
- [contracts/meter-presentation.md](contracts/meter-presentation.md) defines the project XML,
  snapshot/patch, profile registry, reset, and dialog behavior contracts.
- [quickstart.md](quickstart.md) provides automated and manual validation for defaults, persistence,
  undo/redo, meter landmarks, popouts, accessibility, and audio/CSD non-regression.

## Complexity Tracking

No constitution violations or justified complexity exceptions.
