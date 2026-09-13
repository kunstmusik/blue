# Implementation Plan: Mixer Follow-Up

**Branch**: `035-mixer-follow-up` | **Date**: 2026-05-01 | **Spec**: [/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/spec.md](/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/spec.md`

## Scope Disposition

The playback-aware and windowing-polish portion of the original draft is
withdrawn and is not an implementation target for this plan. Later mixer
metering/presentation and window/editor specifications own those concerns.
Future work in that area requires a new explicit specification.

## Summary

Build the next mixer parity slice on top of Spec 034 by focusing on routing safety, richer chain editing, and stronger effects-library workspace tools. The slice intentionally avoids durable library persistence or SQLite work and instead improves the session-local workflows introduced by the core mixer editor.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages  
**Primary Dependencies**: Spec 034 mixer snapshot and effects-library session infrastructure, existing `@blue/data` mixer models, Electron file dialogs and menu IPC, Zustand project/workbench stores, Dockview 5.2.0, existing effect-editor window manager, Vitest 4.x
**Storage**: canonical project state still lives in main-process `BlueData`; effects-library workflow remains session-local with explicit import/export file operations only; no writes back to `~/.blue`; no SQLite or other new durable library store  
**Testing**: Vitest main-process and renderer tests, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, `pnpm --filter @blue/data test` if routing validation is implemented as a pure helper in `@blue/data`, `./.specify/scripts/bash/check-prerequisites.sh --json --include-tasks --require-tasks`, `git diff --check`  
**Target Platform**: Electron desktop on macOS first, preserving current workbench and child-window patterns  
**Project Type**: follow-on desktop application feature spanning pure routing helpers, Electron main/preload file actions, and renderer workflow polish  
**Performance Goals**: Routing validation and chain editing should feel immediate for ordinary mixer sizes; library drag/drop or reload should not freeze the main window
**Constraints**: no durable library persistence, no SQLite, no storage redesign specific to effects, and preserve the existing one-window-per-owner behavior from Spec 034
**Scale/Scope**: one follow-up slice for routing validation, advanced chain editing, and effects-library session polish

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Data-First, UI-Separated**: PASS. Routing validation can stay in a pure helper, while library workflow changes continue to flow through explicit main/preload/renderer seams.
- **Backwards-Compatible Serialization**: PASS. Project mixer state still round-trips through canonical `BlueData`, and library session changes remain non-persistent by design.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Java Blue routing, library, and menu/window behavior remain the parity source.
- **Engine as External Process**: PASS. The plan adds no engine integration or renderer-owned engine logic.
- **Test-First for Serialization**: PASS. Routing validation and session workflow changes are explicitly backed by tests before UI parity is considered complete.
- **Research Integration**: PASS. Java and Spec 034 surfaces are the direct anchors for this follow-up slice.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mixer-follow-up-surfaces.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-data/src/mixer/
└── [optional pure routing-validation helper if it belongs in @blue/data]

/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/
└── project-editor.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── main.ts
├── mixer-effects-library.ts
└── effect-editor-window-manager.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/
└── preload.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/
├── stores/
│   ├── project-store.ts
│   └── workbench-store.ts
├── components/workbench/panels/
│   ├── MixerPanel.tsx
│   ├── EffectLibraryModal.tsx
│   ├── effect-editor/
│   └── mixer/
└── tests/
    └── [new routing and library workflow tests]
```

**Structure Decision**: Build directly on the mixer/editor/library foundations from Spec 034. Keep routing logic pure where possible and keep library workflow state in the existing session service.

## Complexity Tracking

No constitution exceptions are required.

## Phase 0 Research Output

See [/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/research.md](/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/research.md).

## Phase 1 Design Output

- [/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/data-model.md](/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/data-model.md)
- [/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/contracts/mixer-follow-up-surfaces.md](/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/contracts/mixer-follow-up-surfaces.md)
- [/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/quickstart.md](/Users/stevenyi/work/blue-electron/specs/035-mixer-follow-up/quickstart.md)

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. Routing validity and clipboard payloads can be modeled separately from the UI, while session workflow changes continue to use the established app seams.
- **Backwards-Compatible Serialization**: PASS. No durable library rewrite is introduced, and project mixer state still flows through canonical document patches.
- **JVM Dependencies Preserved, Not Replaced**: PASS. The follow-up behaviors remain tied to Java Blue menu, routing, and library workflows.
- **Engine as External Process**: PASS. This plan adds no engine architecture or engine integration.
- **Test-First for Serialization**: PASS. Validation, import/export, and reload behavior are all planned with explicit tests.
- **Research Integration**: PASS. The slice is explicitly bounded by Spec 034 foundations and the remaining Java parity gaps it leaves behind.
