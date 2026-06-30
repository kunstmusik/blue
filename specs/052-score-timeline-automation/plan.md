# Implementation Plan: Score Timeline Automation Editing

**Branch**: `052-score-timeline-automation` | **Date**: 2026-06-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/052-score-timeline-automation/spec.md`

## Summary

Implement Java Blue-style score timeline automation assignment and editing for soundObject layers and audio layers. The implementation completes the `@blue/data` automation layer model first, then extends the score document snapshot and patch contract so renderer edits mutate the canonical `BlueData` document. The renderer should reuse the existing score timeline canvases, audio clip canvas, score selection/snap utilities, and bar renderers, adding a shared automation overlay and layer-header controls instead of introducing a separate timeline surface.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages
**Primary Dependencies**: `@blue/data` automation/score/mixer classes, `@blue/app` shared project-editor IPC model, Zustand 5.x stores, Dockview 5.2.0 workbench shell, Radix Context Menu, existing score timeline components, Vitest 4.x
**Storage**: Main-process in-memory `BlueData` remains canonical; `.blue` XML remains canonical persistence. Layer automation assignments persist through Java-compatible `parameterId` entries, and line data persists on the underlying `Parameter` XML. Renderer state for current edit mode and active range selection is local UI state.
**Testing**: Vitest unit, renderer component tests, shared contract tests, and existing CSD/playback data-flow tests
**Target Platform**: Electron desktop renderer and main process
**Project Type**: Desktop app with pure data package and Electron renderer/main packages
**Performance Goals**: Automation overlays remain responsive at current score editor scale, with pointer gestures updating only affected rows/lines and using existing snap/time conversion utilities.
**Constraints**: `@blue/data` stays browser-safe and Node-safe with no Node built-ins, no `require()`, and no dynamic imports. Serialization must remain Java-compatible. Root timeline automation parity is the first target, matching Java Blue's root-only overlay behavior unless a nested-path behavior is explicitly specified.
**Scale/Scope**: Score timeline automation for root soundObject layers and audio layers, including assignment menus, single-line point/range editing, multi-line range move/scale, persistence, and playback/export data flow.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: PASS

- **Data-First, UI-Separated**: PASS. Layer assignment, parameter identity, line color, XML serialization, and point mutation primitives belong in `@blue/data`; renderer components consume snapshots and dispatch typed patches.
- **Backwards-Compatible Serialization**: PASS. The plan models Java Blue `SoundLayer` and `AudioLayer` `parameterId` persistence and line XML before renderer work.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Existing Java-backed sound object behavior remains unchanged; this feature edits parameter lines and assignments only.
- **Engine as External Process**: PASS. Playback/export uses existing generated CSD/runtime parameter flow; no engine architecture changes are planned.
- **Test-First for Serialization**: PASS. Foundational tasks require XML round-trip tests for `ParameterIdList`, `SoundLayer`, `PolyObject`, `AudioLayer`, and parameter line color before implementation.

## Project Structure

### Documentation (this feature)

```text
specs/052-score-timeline-automation/
├── spec.md
├── research.md
├── plan.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── score-timeline-automation-surface.md
├── checklists/
│   └── requirements.md
├── tasks.md
└── status.md
```

### Source Code (repository root)

```text
packages/blue-data/src/
├── automation/
│   ├── parameter.ts
│   ├── parameter.test.ts
│   ├── parameter-id-list.ts
│   └── parameter-id-list.test.ts
├── score/
│   ├── audio/
│   │   ├── audio-layer.ts
│   │   ├── audio-layer-group.ts
│   │   └── audio-layer-automation.test.ts
│   └── layers/
│       ├── automatable-layer.ts
│       └── automatable-layer-group.ts
├── sound-objects/
│   ├── sound-layer.ts
│   ├── poly-object.ts
│   └── sound-layer-automation.test.ts
└── blue-data-csd-automation.test.ts

packages/blue-app/src/shared/
├── project-editor.ts
├── score-timeline-automation-contract.test.ts
└── score-timeline-automation-patches.test.ts

packages/blue-app/src/renderer/
├── stores/
│   ├── project-store.ts
│   ├── score-selection-store.ts
│   └── score-automation-store.ts
├── components/workbench/panels/score/
│   ├── LayerPanel.tsx
│   ├── ScoreToolbar.tsx
│   ├── snap-grid-utils.ts
│   ├── layer-groups/
│   │   ├── ScoreTimeCanvas.tsx
│   │   └── AudioLayerGroupCanvas.tsx
│   └── automation/
│       ├── AutomationLayerOverlay.tsx
│       ├── AutomationLineView.tsx
│       ├── AutomationLayerHeaderControls.tsx
│       ├── AutomationTargetMenu.tsx
│       ├── automation-line-utils.ts
│       └── automation-selection-utils.ts
└── tests/
    ├── score-timeline-automation-menu.test.tsx
    ├── score-timeline-automation-single-line.test.tsx
    ├── score-timeline-automation-multi-line.test.tsx
    └── score-timeline-automation-persistence.test.ts
```

**Structure Decision**: Use the existing monorepo split. Data and XML compatibility work stays in `packages/blue-data`; canonical mutation/snapshot work stays in `packages/blue-app/src/shared/project-editor.ts`; renderer automation UI is added under the current score panel as reusable `automation/` components and integrated into the existing `ScoreTimeCanvas` and `AudioLayerGroupCanvas`.

## Phase Plan

### Phase 0: Research Complete

Java Blue review is captured in [research.md](research.md). The decisive references are:

- SoundObject timeline: Java `ScoreTimeCanvas`, `AutomationLayerPanel`, `SoundLayerPanel`, and `SoundLayer`
- Audio timeline: Java `AudioLayersPanel`, `AudioHeaderLayerPanel`, and `AudioLayer`
- Editing logic: Java `ParameterLinePanel`, `MultiLineSelectionMouseProcessor`, `MultiLineMoveMouseListener`, and `MultiLineScaleMouseListener`

### Phase 1: Design Outputs

- [data-model.md](data-model.md) defines layer assignments, automation parameter snapshots, target menus, edit modes, range selections, and patch semantics.
- [contracts/score-timeline-automation-surface.md](contracts/score-timeline-automation-surface.md) defines the renderer/shared snapshot and patch surface.
- [quickstart.md](quickstart.md) defines manual validation scenarios and implementation checks.

### Phase 2: Task Generation

Tasks are generated in [tasks.md](tasks.md) with this dependency order:

1. `@blue/data` automation model and XML parity
2. Shared score snapshot and patch contract
3. Reusable renderer automation primitives
4. A button target assignment workflow
5. Single-line editing workflow
6. Multi-line editing workflow
7. Persistence, playback/export validation, and handoff

## Component Reuse Decisions

- Reuse `ScoreTimeCanvas.tsx` for soundObject rows and `AudioLayerGroupCanvas.tsx` for audio rows. Automation draws as an overlay per row, like Java Blue, and does not replace existing bar rendering.
- Reuse score snap/time conversion behavior from `snap-grid-utils.ts`, `meter-map-utils.ts`, existing canvas beat mapping, and score ruler state.
- Reuse existing selection identity patterns from `score-selection-store.ts` for object and audio clip alignment, but keep automation edit mode/range state in a focused `score-automation-store.ts`.
- Reuse Radix Context Menu patterns already present in the renderer for the A button target menu.
- Reuse existing project-store patch dispatch patterns so automation edits are canonical `ProjectDocumentPatch` updates rather than direct renderer-only mutations.

## Complexity Tracking

No constitution violations are planned.
