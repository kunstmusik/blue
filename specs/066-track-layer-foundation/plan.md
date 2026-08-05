# Implementation Plan: Track Layer Foundation

**Branch**: `066-track-layer-foundation` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/066-track-layer-foundation/spec.md`

## Summary

Replace the TypeScript Audio Layer Group/Audio Layer runtime model with one canonical Track Layer Group/Track model. A Track directly owns an ordered mixture of AudioClips and explicitly compatible SoundObjects, an optional independently copied Blue instrument, a Note Processor Chain, automation state, and one stable mixer-channel association. Historical `audioLayerGroup` XML is converted before deserialization and subsequently saved only as Track XML; newly saved Track projects are intentionally not required to load in Java Blue.

Compilation will register enabled Track instruments into the ephemeral render Arrangement before UDO, parameter, string-channel, table, global-score, and orchestra collection. The corresponding live Track parameters are mapped back in the same Arrangement-instrument, Track-instrument, then mixer order so preset and widget changes reach regular playback and Blue Live. Continuous Track BSB gestures use a validated session/stable-ID runtime-control path immediately, while a single-flight renderer queue coalesces safely superseded durable values and retries stale revisions against the returned canonical snapshot. SoundObject generation receives a typed generation-options object. Note owners identify whether their generated events may use the Track instrument; the Track applies the runtime p1 after the complete top-level object's processing and before Track and root Score processors. Track and SoundObject Layer paths share the same post-generation render-start rebase for SoundObject notes, while already-relative AudioClip playback events are merged afterward. AudioClip and self-instrumented events retain their dedicated runtime identities. Renderer snapshots and canonical main-process patches will expose the mixed Track timeline, Note Processor and complete instrument payloads (including BSB widgets, presets, automation, and embedded UDOs), Unified Library drops, one typed instrument clipboard spanning all Track/Arrangement/Unified-Library source and target combinations, exact Track-owned UDO source/destination identities, a main-owned active Library clipboard shared across renderer windows, and a non-modal, always-on-top Track instrument editor. Track automation presentation flattens the associated channel under Track Channel, unnamed Track mixer strips derive italic one-based labels without changing canonical names, Track Command/Control-click paste shares the normal paste contract, and editor opening preserves mounted same-type UI state. All renderer color controls share one persistent in-app picker with live preset, HSL, and hexadecimal editing, outside-click dismissal, viewport-clamped above/below placement, and Set Color anchoring outside the affected object row; the captured Set Color selection remains stable across every edit. PolyObject is excluded from Tracks at every mutation boundary, and the unreleased/incomplete NotationObject remains intentionally removed.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; React 19.x; Electron 35.7.5 with Node.js 22.16.0

**Primary Dependencies**: `@blue/data`, `@rgrove/parse-xml`, Electron `BrowserWindow`/IPC/preload, Zustand 5.x, Radix Context Menu, Dockview 5.2.0, existing Unified Libraries and instrument editor components

**Storage**: Canonical `.blue` XML in the main-owned `BlueData`; app-wide `program-settings.json` for Default Layer Group Type; renderer selection/drop previews and render generation metadata are transient

**Testing**: Vitest 4.x across `@blue/data` and `@blue/app`; focused renderer tests with jsdom; Electron/Playwright smoke coverage for the non-modal, always-on-top editor where practical; deterministic generated-CSD and XML fixtures

**Target Platform**: Cross-platform Electron desktop application on macOS, Windows, and Linux

**Project Type**: Desktop application in a pnpm monorepo with a platform-neutral data/compiler package and Electron main/preload/renderer packages

**Performance Goals**: Automated 1,000-item tests bound item/property visits to linear work and require one generation call per item. Five warmed manual runs must have median selection, move, and compile times no greater than 2× an equivalent SoundObject-layer workload, with no measured interaction over 100 ms. Mixer reconciliation remains linear in Tracks and channels. Rapid Track controls have one durable request in flight, a bounded coalescible pending value per consecutive compatible control target, and an immediate runtime message for every gesture value.

**Constraints**: No retained AudioLayer/AudioLayerGroup compatibility runtime classes; no InstrumentClip wrapper; PolyObject cannot be created, pasted, dragged, or moved into a Track; NotationObject remains removed; no Node/Electron/DOM or dynamic imports in `@blue/data`; historical projects must load losslessly into Track models including unknown group/container/Track attributes and children; new Track XML need not load in Java Blue; synchronous and asynchronous CSD paths must stay behaviorally aligned through shared orchestration helpers; SoundObject events from either layer path use the render start as performance time zero without double-rebasing Track AudioClip events; transient runtime controls may omit the global document revision only because they cannot mutate canonical project state and remain project-session/stable-Track fenced

**Scale/Scope**: One new Track/Track Layer Group model, one raw-XML migration, all registered SoundObject capability declarations, standard/disk/async CSD compilation, settings/new-project initialization, score snapshots/patches/store/UI, mixer reconciliation, Unified Library transfer target, shared clipboard integration, and one non-modal, always-on-top instrument editor window

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core**: PASS — Track models, XML conversion, placement metadata, generation options, and CSD behavior remain in `@blue/data` with static imports and no host APIs. Electron windows, library service calls, and presentation stay in `@blue/app`.
- **Java and project compatibility**: PASS WITH DOCUMENTED DIVERGENCE — Java AudioLayer/AudioLayerGroup, automation-menu, and mixer-association behavior were consulted first. Historical Java/TypeScript Audio Layer XML is migrated before deserialization while preserving IDs, clips, automation, and unknown group/container/Track data. The spec records the owner-approved divergences that canonical Track XML is TypeScript-only, the never-released incomplete NotationObject is removed rather than preserved, and TypeScript-only Track presentation flattens its automation channel level and derives transient unnamed-strip labels.
- **Canonical ownership and contracts**: PASS — Electron main remains the sole owner of `BlueData`; `.blue` owns Track data, `program-settings.json` owns the new default, the Unified Library service owns the transient cross-window Library clipboard plus a separate type-isolated BSB widget slot, renderer stores own other type-specific transient UI state, and `CompileData` owns disposable runtime mappings. Durable mutations and the Track instrument editor cross typed snapshot/patch/preload contracts with session/revision/stable-ID validation. The separate validated runtime-control message is session/stable-ID fenced, has no persistence authority, and therefore does not create a second owner.
- **Runtime and engine isolation**: PASS — Track instrument registration uses the existing in-process compiler abstractions. Java-backed SoundObjects and instruments continue through existing host runtime contracts; `@blue/data` does not launch processes, read files, or contact Blue Engine.
- **Verification evidence**: PASS — design requires registry exhaustiveness, raw migration/round-trip fixtures, p1/order/sync-async CSD tests, mixer preservation cycles, settings fallback tests, typed IPC failure tests, renderer interaction/drop/menu tests, package tests/builds, and the end-to-end quickstart.

### Post-design re-check

The data model and contracts preserve the boundaries above. The compatibility divergences are the explicitly approved TypeScript-only Track XML format, intentional removal of the never-released incomplete NotationObject, and Track-only automation/mixer presentation rules for a model Java Blue never released; one-way migration, canonical ownership, and deterministic tests are specified. No unexplained constitution violation remains.

## Project Structure

### Documentation (this feature)

```text
specs/066-track-layer-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── app-contracts.md
│   └── persistence-generation.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/blue-data/src/
├── score/
│   ├── track/
│   │   ├── track.ts
│   │   ├── track-layer-group.ts
│   │   ├── track-audio-playback.ts
│   │   └── track-automation.test.ts
│   ├── layers/layer-group.ts
│   └── score.ts
├── sound-objects/
│   ├── sound-object.ts
│   ├── sound-object-registry.ts
│   ├── register-sound-object-types.ts
│   └── [registered SoundObject implementations]
├── migration/
│   ├── upgrade-manager.ts
│   └── migrate-audio-layers-to-tracks.ts
├── compile-data.ts
├── blue-data.ts
└── index.ts

packages/blue-app/src/
├── shared/
│   ├── project-editor.ts
│   ├── program-settings.ts
│   ├── unified-library.ts
│   └── track-instrument-editor-contract.ts
├── main/
│   ├── main.ts
│   ├── program-settings-application.ts
│   ├── program-settings-usage.ts
│   ├── bsb-instrument-runtime-sync.ts
│   ├── track-instrument-editor-window-manager.ts
│   └── unified-library/
├── preload/
│   ├── preload.ts
│   └── global.d.ts
└── renderer/
    ├── track-instrument-editor.html
    ├── track-instrument-editor.tsx
    ├── components/settings/ProjectDefaultsSettings.tsx
    ├── components/workbench/panels/ScorePanel.tsx
    ├── components/workbench/panels/score/
    │   ├── LayerPanel.tsx
    │   ├── ScoreManagerDialog.tsx
    │   └── layer-groups/
    │       ├── ScoreObjectColorPicker.tsx
    │       └── TrackLayerGroupCanvas.tsx
    └── stores/project-store.ts
```

**Structure Decision**: Extend the existing `@blue/data` score/compiler and `@blue/app` project-document architecture. Track replaces the audio runtime folder as the sole canonical mixed-content model. The app reuses existing Score bar renderers, library transfer services, clipboard contracts, instrument editors, and effect-window lifecycle patterns instead of introducing another state owner or clip wrapper.

## Complexity Tracking

No constitution violations require an exception. The TypeScript-only Track XML, removal of the never-released incomplete NotationObject, flattened Track automation hierarchy, and transient unnamed Track strip labels are intentional compatibility divergences allowed by Principle II and explicitly approved and test-scoped in the feature specification.
