# Implementation Plan: Complete Stereo Mixer Panning

**Branch**: `113-pan-laws-configuration` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/113-pan-laws-configuration/spec.md`

## Summary

Extend Spec 112's mixer panner with a score-wide center-depth law and optional off-center boost. Keep Balance as the default for every existing two-bus channel. Add channel-selectable Stereo Pan with Position/Width and Dual Pan with independent source-side positions. Reuse the existing channel position, automation, canonical document/history, runtime binding, and CSD pan stage. The score owns the law; each channel owns its mode and positions. Mono clip adaptation, sends, mixer gates, and unsupported multichannel behavior stay as specified by Specs 111–112.

## Technical Context

**Language/Version**: TypeScript 5.8+ in the strict pnpm workspace; generated Csound orchestra.

**Primary Dependencies**: Existing `@blue/data`, `@blue/app`, `@blue/engine-client`, Electron 35, React 19, `@rgrove/parse-xml`, Csound. No new package dependency.

**Storage**: Canonical `.blue` XML. Score attributes hold pan law/boost; channel XML holds mode, width, dual positions, and their automatable Parameters. Defaults read without a separate migration or raw-presence shadow state.

**Testing**: Vitest for model/XML/CSD/patch/history/runtime; existing browser test harness for mixer controls; native Csound float-output fixtures; documented manual interaction.

**Target Platform**: macOS, Windows, Linux desktop; `@blue/data` remains browser-safe.

**Project Type**: Desktop audio application with a portable project/compiler library and external engine client.

**Performance Goals**: Position/Width/Dual Pan automation and score law changes update running audio without event retrigger or transport movement when the compiled graph is stable; no additional unbounded work per audio sample beyond fixed gain math per two-bus channel.

**Constraints**: Preserve exact Spec 112 −3 dB unboosted Mono Pan and Balance output, Java-compatible legacy loading, project-history ownership, existing send tap and gate/meter placement, compiled performance generation fences, and two-channel-only supported panning.

**Scale/Scope**: One score-wide law/boost pair; all mixer channel types with supported two-bus output; four law depths, three stereo modes, one Width and two Dual positions per channel. No per-channel law overrides, send panners, per-clip pan, Mid/Side, or surround.

## Constitution Check

*GATE: evaluated before Phase 0 research; rechecked after Phase 1 design below.*

- **Portable data core — PASS**: Score/Channel data, validation, coefficient math, and CSD generation stay in `@blue/data` with static imports and no host APIs. File layout inspection remains in Electron main as in Spec 112.
- **Java and project compatibility — PASS**: Java Blue has no panning law or stereo-mode fields. Missing score values resolve to −3 dB/unboosted and missing channel values to Balance, preserving Spec 112 and Java legacy output. Existing XML fields and unrelated unknown data remain intact. New TypeScript-only values are an intentional divergence.
- **Canonical ownership and contracts — PASS**: Score owns law/boost; Channel owns mode, shared pan, width, and dual positions; active BlueData is canonical. Typed document snapshots/patches and generation-scoped engine bindings carry changes. Invalid data resolves safely on load and is rejected at edit boundaries.
- **Project history and undo/redo — PASS**: Each score/channel setting and automation edit enters `ProjectHistory` with a semantic label. Drag preview is disposable and cancellation restores canonical runtime; completion commits one edit. Focused commit→undo→redo tests will cover value, identity/reference, dirty state, publication, and audio reconciliation.
- **Runtime and engine isolation — PASS**: Electron main owns runtime channel writes and compilation; renderer uses typed preload/IPC. Data and renderer do not call engine-native APIs.
- **Host-path portability — PASS**: The feature introduces no path format. Existing native audio-file inspection and external Csound text boundaries stay as in Spec 112; regression fixtures include synthetic Windows paths and native Windows validation where available.
- **Verification evidence — PASS**: Planned model/XML/CSD and actual float-audio fixtures, patch/history/runtime failure tests, mixer browser interactions, `pnpm --filter @blue/data test`, `pnpm --filter @blue/app test`, app main/renderer builds, `pnpm test`, `pnpm lint`, and `git diff --check`. Quickstart defines the manual matrix. Spec 111's outstanding physical latency and Windows checks remain separately identified.

## Project Structure

### Documentation (this feature)

```text
specs/113-pan-laws-configuration/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── audio-panning.md
    └── project-runtime.md
```

### Source Code (repository root)

```text
packages/blue-data/src/
├── score/score.ts
├── mixer/{channel.ts,channel-pan.ts}
├── blue-data/{csd-policy.ts,compile-data.ts}
└── automation/                         # existing Parameter catalog path
packages/blue-app/src/
├── shared/project-editor/{contract.ts,patch-score.ts,patch-mixer-bluelive.ts,snapshot-mixer-orchestra.ts}
├── main/{runtime-parameter-sync.ts,project-runtime-reconciliation.ts,mixer-gain-preview.ts}
└── renderer/components/workbench/panels/
    ├── score/ScoreSettingsDialog.tsx
    └── mixer/{ChannelStrip.tsx,MixerPanSlider.tsx}
```

**Structure Decision**: Extend the existing score, channel, project bridge, pan helper, CSD stage, and mixer control files. Add no new package or general panner framework. Actual changes and tests should use the smallest existing module boundaries that cover all channel types.

## Phase 0: Research Decisions

All technical choices are resolved in [research.md](research.md). The chosen coefficient family preserves Spec 112's exact −3 dB default; Stereo Pan uses a shared center/width with endpoint narrowing; Dual Pan uses independent source-side positions. The true-stereo path is a 2×2 gain matrix over the existing stereo buses. Balance stays untouched. The score owns law/boost; Channel owns mode and values. No `NEEDS CLARIFICATION` item remains.

## Phase 1: Design

1. **Portable model and persistence**: Extend `Score` with two validated attributes and `Channel` with one mode plus Width and two Dual positions. Keep existing `pan` as shared Balance/Stereo Position. Add distinct Width/Left/Right `Parameter` objects and enumerate them through the existing mixer parameter catalogs; explicitly dispatch known Parameter names on XML load. Preserve legacy defaults, copy modes, and unknown unrelated data. See [data-model.md](data-model.md).
2. **Panner coefficients and CSD**: Extend `channel-pan.ts` with the four law functions, boost, stereo effective positions, and 2×2 matrix. In `csd-policy.ts`, retain the disabled route and Balance branch; use the existing pan stage for Mono Pan, Stereo Pan, and Dual Pan. The compiled static and dynamic forms must match the [audio contract](contracts/audio-panning.md), with focus on default −3 dB byte/numeric parity, mixed-track fold gain, sends, gates, meters, and automation.
3. **Document bridge and history**: Extend typed score/channel snapshots and patches, snapshot restoration, patch validation/classification, semantic labels, and `ProjectHistory` tests. Keep stored stereo mode distinct from the current derived Mono Pan/Balance layout label. One drag commits one action; cancellation restores the canonical project and runtime. See [project-runtime.md](contracts/project-runtime.md).
4. **Running engine**: Add generation-scoped control bindings for score law/boost and channel mode to compiled performance metadata; main reconciles committed edits to each active timeline/BlueLive engine via existing engine-client channel writes. Width/dual scalars use Parameter bindings and extend the existing preview/automation sync. Reuse current performance-generation fencing, error reporting, and canonical recovery. Keep mode/law changes on a stable two-bus graph live; retain Spec 112 recompile behavior for enable/layout changes.
5. **Mixer controls**: Extend the current pan UI to show mode selection on two-bus channels and the relevant Position/Width or Left/Right controls. Mono-only channels keep Mono Pan. Add concise law/boost controls to Score Settings; expose accessible names, keyboard editing, disabled explanations, effective width feedback, and a true-stereo peak warning.
6. **Verification**: Follow [quickstart.md](quickstart.md). Start with focused model, CSD/audio, contract/history, runtime and browser checks; then run package tests/builds and repository-wide test/lint because the change crosses data, main, shared, and renderer boundaries. Record native Windows and physical-output evidence separately; do not mark Spec 111's pending acceptance as passed by proxy.

## Post-Design Constitution Recheck

- **Portable data core — PASS**: The data model, coefficient function, and CSD contract require no filesystem, Electron, DOM, or dynamic imports in `@blue/data`. Host layout preflight remains external.
- **Java and project compatibility — PASS**: The design preserves missing-value defaults, Java-readable known XML, exact Spec 112 default panning, and unknown unrelated data. New modes and laws are named TypeScript-only divergences with deterministic fixtures.
- **Canonical ownership and contracts — PASS**: [data-model.md](data-model.md) assigns score/channel ownership; [project-runtime.md](contracts/project-runtime.md) specifies typed snapshots, patches, generation bindings, invalid-value fallbacks, and failure recovery. No app preference or renderer-owned project state is added.
- **Project history and undo/redo — PASS**: Every new durable writer has a semantic label and commit→undo→redo requirement. Preview is disposable, with canonical restoration on cancel and runtime failure handling.
- **Runtime and engine isolation — PASS**: Main owns all engine writes and generation checks. Renderer uses existing typed preload/IPC; CSD/data never invoke the engine.
- **Host-path portability — PASS**: No new path semantics. Existing native file inspection and Csound-text conversion boundaries remain; Windows synthetic/native cases are in the validation guide.
- **Verification evidence — PASS**: [quickstart.md](quickstart.md) covers numeric and actual-audio gain matrices, live/disk parity, XML/patch/history, browser accessibility, failure recovery, affected package commands, and repository-wide checks.

No constitution exception or unresolved technical clarification is required.
