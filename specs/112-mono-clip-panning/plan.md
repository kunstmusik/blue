# Implementation Plan: Mono Clip Panning Compatibility

**Branch**: `112-mono-clip-panning` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/112-mono-clip-panning/spec.md`

## Summary

Add score-owned `panningEnabled` with new-score true and absent/invalid XML false. Keep the disabled Csound route unchanged. On enabled stereo renders, determine source layouts from actual files, center mono clips at equal power, preserve stereo pairs, and apply channel pan for verified mono-only sources or balance for stereo, mixed, and unknown sources. Persist and automate the channel position through the mixer Parameter system and canonical project history. Diagnose unsupported layouts before rendering without changing project data.

## Technical Context

**Language/Version**: Strict TypeScript 5.8; generated Csound orchestra text

**Primary Dependencies**: `@blue/data`, Electron/React `@blue/app`, Blue Engine/Csound, `@rgrove/parse-xml`, Vitest

**Storage**: Canonical `.blue` XML: score `panningEnabled` attribute and mixer channel pan/parameter elements; file layout observations are disposable

**Testing**: Vitest package tests, focused CSD fixtures, project history/runtime integration tests, deterministic render checks

**Target Platform**: Blue Electron on macOS, Windows, Linux; mono and stereo Csound output

**Project Type**: Desktop application with portable data/model package and host-owned filesystem/runtime

**Performance Goals**: One header/layout inspection per unique clip file per compile; constant-size pan/balance DSP per channel

**Constraints**: Legacy disabled routing and sends unchanged; no host I/O in `@blue/data`; no silent channel loss; score edits undoable; native paths preserved until embedded in Csound text

**Scale/Scope**: Score setting, mixer channel controls/automation, clip playback and mixer CSD, typed document bridge, runtime reconciliation, mono/stereo fixtures

## Constitution Check

*Gate before research: PASS. Post-design gate: PASS, contingent on implementation verification.*

- **Portable data core — PASS**: `@blue/data` receives a typed disposable layout manifest and generates CSD. Main probes files. No filesystem, Electron, DOM, dynamic import, or Node built-in enters production data code.
- **Java and project compatibility — PASS**: Java `Channel.java` has no pan; Java audio playback also writes mono only to its first output variable. Enabled mode is an explicit TS divergence. Absent/invalid `panningEnabled` loads false; disabled scores retain existing CSD routing, send taps, and unknown project data. New XML is additive.
- **Canonical ownership and contracts — PASS**: `BlueData.Score` owns the setting; `Mixer.Channel` owns pan and its Parameter; main owns active document/runtime. Renderer uses typed snapshots/patches. Layout observations are compile-scoped derived data; failures leave XML untouched.
- **Project history and undo/redo — PASS**: Score toggle uses a typed score patch with label `Set Score Panning`; pan uses the mixer patch with `Set Channel Pan`. Parameter automation uses existing history. Commit, undo, redo, dirty state, stable identities, and runtime reconciliation require focused tests. No non-undoable writers are planned.
- **Runtime and engine isolation — PASS**: Main performs file inspection and starts/reconciles engine. `@blue/data` only consumes layout facts and emits Csound. Engine transport stays behind `@blue/engine-client`.
- **Host-path portability — PASS**: File probes use native OS paths; Csound path conversion/escaping occurs only when creating note text. Tests use `path.join`/`os.tmpdir` and synthetic Windows paths; changed host-path code gets Windows CI.
- **Verification evidence — PASS**: [quickstart.md](quickstart.md) covers round trips, legacy CSD comparison, audio-level fixtures, unsupported layouts, history/runtime tests, package and repository gates, and `git diff --check`.

## Design

### Score and channel state

Use the `Score` XML codec pattern for one boolean attribute: new `Score()` is enabled, while `Score.loadFromXML` treats absent or invalid values as disabled. A missing score element must also take the legacy-disabled path in `xml-policy.ts`. Copy the setting in history and duplication copies. Persist `Channel.pan` as a bounded finite `0..1` value (center `0.5`) and add a distinct pan `Parameter` rather than overloading volume. Identify volume and pan parameters during XML load without treating an unknown parameter as either; preserve Java volume-only files and unrelated XML. Existing snapshot and mixer patch fields remain the document contract, with validation at load, patch, automation, and compile boundaries.

### Layout and render pipeline

Preflight each referenced audio file used by an enabled render in Electron main, using actual header data as authority. Supply the portable compiler a typed map of resolved channel counts keyed by clip/file identity. An enabled compile without required layout observations must fail explicitly, including direct calls to the data compiler. Report missing/unreadable or greater-than-two-channel files before launch. The playback instrument retains `filenchnls` guards so stale clip metadata cannot affect routing. `AudioClip.numChannels` is a cache. All-mono classification requires verified mono clips, no unclassified instrument source, and no effect that can make the buses differ before the pan stage; stereo, mixed, and unknown channels use balance. An unassociated clip reaching Master is conservatively stereo/unknown.

Keep the legacy playback and mixer generation branch when disabled. In enabled stereo mode, mono playback contributes both buses at `1/sqrt(2)`; stereo contributes each original side unchanged. For verified all-mono channels, normalize the equal-power upmix at the pan stage so center stays `1/sqrt(2)` per side and hard endpoints reach unity. Stereo/mixed/unknown channels use balance gains: unity at center and opposite-side attenuation toward each endpoint. Exact gain equations and Csound behavior are in [audio-routing.md](contracts/audio-routing.md). Mixer-disabled direct output follows the same clip rule. One-channel output stays one channel with no audible pan; wider output is diagnosed before enabled rendering.

Insert pan/balance after existing post effects and sends, before output gate, output meter, and route-to-parent. This preserves send tap semantics; meters reflect processed channel output. Recompile/restart at the next safe reconciliation point when the score setting or layout-affecting edit changes the graph. Pan-value and automation edits update the registered runtime Parameter when the graph is stable; undo/redo follows the same route.

### User interface and diagnostics

Add `Enable Panning` to Score Settings. Add a channel position control labeled `Pan` for verified mono-only source channels and `Balance` otherwise, with center indication and accessible range text. Disable it when score panning is off. Typed diagnostics carry file/channel count and recovery guidance. No diagnostic changes XML.

## Project Structure

### Documentation (this feature)

```text
specs/112-mono-clip-panning/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── audio-routing.md
    └── project-and-runtime.md
```

### Source Code (repository root)

```text
packages/blue-data/src/
├── score/score.ts
├── score/track/track-audio-playback.ts
├── score/audio/playback-instrument-orc.ts
├── mixer/channel.ts
└── blue-data/csd-policy.ts
packages/blue-app/src/
├── main/                 # file layout preflight and runtime reconciliation
├── shared/project-editor/ # typed score/mixer snapshot and patch contracts
└── renderer/components/workbench/panels/ # Score Settings and mixer controls
```

**Structure Decision**: Extend existing model, compiler, editor bridge, and UI modules. Add a small typed layout contract at the compile boundary; no new persistence store.

## Post-Design Constitution Recheck

All five principles remain satisfied by these boundaries. The main risk is channels with non-clip instrument sources; they use balance until their layout is known. Implementation verification requires legacy fixtures, actual-file layout checks, audio-level renders, and history/runtime reconciliation.

## Complexity Tracking

No constitution violations or exceptions are planned.
