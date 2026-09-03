# Implementation Plan: Layer and Clip Colors

**Branch**: `096-layer-clip-colors` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/096-layer-clip-colors/spec.md`

## Summary

Add a concrete, project-persisted background color to ordinary sound layers, Tracks, and Pattern layers. Newly created items copy their destination layer color once; existing, copied, imported, duplicated, and moved items retain their concrete colors. Users can explicitly recolor a selection or every item on a layer through one atomic score patch. The existing color picker is reused in layer headers, and a bounded score-color history provides one-step undo/redo without introducing a general project-history framework.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Node.js/Electron versions managed by the workspace

**Primary Dependencies**: `@blue/data`, React, Zustand, Electron IPC/preload project-document bridge, `@rgrove/parse-xml` through the existing XML reader

**Storage**: Canonical `.blue` XML; each owning layer or item stores a signed 32-bit `<backgroundColor>` child

**Testing**: Vitest and Testing Library for packages; repository Node test scripts; Java fixture/round-trip comparison where applicable

**Target Platform**: Electron desktop application on macOS, Windows, and Linux; browser-safe `@blue/data` core

**Project Type**: pnpm monorepo desktop application with a platform-neutral data package

**Performance Goals**: A 1,000-item layer-color application is one atomic edit and one undo entry; routine color changes remain responsive in docked and floated score panels

**Constraints**: Preserve legacy item colors and unknown XML; use copy-on-create rather than live inheritance; keep Java-readable concrete item colors; do not add a project-wide undo system or palette subsystem

**Scale/Scope**: Three layer implementations, their XML readers/writers and snapshots, score patch contracts and canonical handlers, optimistic renderer state, layer-header controls, explicit recolor actions, and focused score-color history

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- **Portable data core**: **PASS** — color constants, normalization, layer model fields, and XML serialization use only static TypeScript imports and browser-safe utilities in `@blue/data`; Electron, DOM, and host APIs remain outside the package.
- **Java and project compatibility**: **PASS** — the Java `Layer`/`SoundLayer` model has no layer color, while score objects own concrete `Color.DARK_GRAY`-defaulted colors serialized as `<backgroundColor>`. The design mirrors that signed integer representation, preserves every existing item color, and documents that Java Blue may discard unknown layer-color children when resaving while retaining concrete item colors.
- **Canonical ownership and contracts**: **PASS** — `BlueData` remains the canonical owner. Layer and item colors persist in `.blue` XML; `ScoreLayerSnapshot`, typed score patches, preload IPC, canonical patch handlers, and optimistic reducers carry serializable numeric colors. Missing legacy layer values normalize to the neutral default and materialize on save.
- **Runtime and engine isolation**: **N/A** — no Java-runtime, filesystem, process, Csound engine, or ZeroMQ behavior changes. Renderer edits continue through the existing document bridge.
- **Host-path portability**: **N/A** — the feature introduces no filesystem paths or embedded external-text paths.
- **Verification evidence**: **PASS** — focused coverage will exercise all three layer XML round trips, legacy/malformed values, creation versus copy/import/move behavior, atomic patch rejection, optimistic parity, one-entry undo/redo, accessibility, and floated-panel picker behavior. Quickstart validation includes affected package tests/build, full tests/lint, and `git diff --check`.

### Post-design re-check

The Phase 1 artifacts retain the same boundaries: one shared color representation in `@blue/data`, one typed document-bridge extension, no host dependencies in the data package, no live-inheritance metadata, and no general undo architecture. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/096-layer-clip-colors/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── layer-color-contract.md
└── tasks.md                 # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
packages/blue-data/src/
├── score/layers/layer.ts
├── score/patterns/pattern-layer.ts
├── score/track/track.ts
└── sound-objects/
    ├── poly-object.ts
    └── sound-layer.ts

packages/blue-app/src/
├── shared/project-editor/
│   ├── contract.ts
│   ├── patch-score.ts
│   └── snapshot-score.ts
└── renderer/
    ├── components/
    │   ├── ColorPicker.tsx
    │   └── workbench/panels/
    │       ├── ScorePanel.tsx
    │       └── score/
    │           ├── ScoreToolbar.tsx
    │           ├── PatternLayerHeader.tsx
    │           ├── ScoreTimeCanvas.tsx
    │           └── TrackLayerGroupCanvas.tsx
    └── stores/
        ├── project-store.ts
        └── score-color-history-store.ts
```

Tests remain beside or within the existing test directories of the affected packages. New focused files should be preferred over enlarging already-large modules unless an existing test suite is the natural owner.

**Structure Decision**: Extend the established `@blue/data` layer implementations and the existing shared project-editor document bridge. Renderer controls remain in the score UI; the narrowly scoped, disposable undo stack lives in a separate renderer store to avoid coupling color history to canonical project data or growing the main project store further.

## Implementation Strategy

1. Add a shared opaque signed-ARGB default and normalization helper in `@blue/data`, then give all three layer implementations `getBackgroundColor()`/`setBackgroundColor()` behavior and compatible XML persistence.
2. Extend layer snapshots and `updateLayerState` with background color. Make creation-time item color optional only at the document-bridge boundary, where absence means “use the destination layer color” for a genuinely new item; restored/imported/copied data must preserve or supply its concrete color.
3. Add one atomic `setScoreObjectBackgroundColors` patch for both selected-item and whole-layer commands. Validate the complete request before mutating canonical data, and mirror it exactly in optimistic snapshots.
4. Reuse `ColorPickerButton` in shared and Pattern layer headers. Add an optional picker commit lifecycle so continuous preview can produce one history record when the gesture completes. Use host-document portals and realm-safe dismissal behavior already provided by the picker.
5. Add bounded, renderer-local score-color history entries containing forward and inverse document patches. Flush pending edits before undo/redo, clear invalid history on project replacement or structural score changes, and expose score-scoped undo/redo controls without intercepting native text-edit undo globally.
6. Add direct actions for “Set to Layer Color” and “Apply Layer Color to All Clips,” deriving every target and prior color from the current snapshot and submitting one atomic patch/history entry.

## Complexity Tracking

No constitution violations or additional subsystems are required. The only new stateful helper is a bounded, score-color-specific undo stack required by FR-017; it is deliberately not a general project command framework.
