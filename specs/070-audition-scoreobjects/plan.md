# Implementation Plan: Audition Selected ScoreObjects

**Branch**: `[070-audition-scoreobjects]` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/070-audition-scoreobjects/spec.md`

## Summary

Implement Java-compatible selected-object audition from the Project menu and its platform shortcut. The renderer will advertise whether its current score selection can be auditioned; the native menu will expose Cmd+Shift+A on macOS and Ctrl+Shift+A elsewhere. On invocation, the renderer flushes pending project edits and sends the current stable object IDs to Electron main. Main resolves and validates those IDs against canonical `BlueData`, creates an isolated copy, filters it to selected content across conventional score layers and TypeScript Track LayerGroups, sets one-shot selection bounds, and starts it through the existing realtime engine bridge.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode

**Primary Dependencies**: Electron 35.x, React 19.x, Zustand 5.x, Vitest 4.x, `@blue/data`, existing `EngineBridge`

**Storage**: No new durable storage. The main-process in-memory `BlueData` remains canonical; selection and audition state are transient; `.blue` XML and program settings are unchanged.

**Testing**: Vitest 4.x focused unit/contract tests in `@blue/data` and `@blue/app`; existing renderer store and native-menu test harnesses; manual quickstart against the Electron app

**Target Platform**: Electron desktop on macOS, Windows, and Linux

**Project Type**: Electron desktop application with a portable data-model package

**Performance Goals**: Menu availability updates promptly with selection changes; starting an audition remains comparable to existing realtime project playback for the same selected content.

**Constraints**: `@blue/data` stays browser- and Node-safe with static imports only; only Electron main may access the engine; the canonical project, renderer selection, loop setting, and XML must not be mutated; disk render/freeze remains exclusive.

**Scale/Scope**: One Project-menu command and accelerator, one typed renderer/main IPC request, one selected-score copy/filter helper, and focused regression coverage for conventional and Track score content.

## Constitution Check

### Pre-Research

- **Portable data core**: **PASS** — selected-score copying/filtering is pure `@blue/data` behavior with no Electron, Node, DOM, or dynamic imports. Menu, IPC, and engine work remain in `@blue/app`.
- **Java and project compatibility**: **PASS** — Java references are `AuditionSelectedSoundObjectsAction` and `RealtimeRenderManager.auditionSoundObjects`/`filterScore`. The plan preserves selected-only rendering, cleared retained-layer mute/solo, disabled looping, selection bounds plus mixer tail, and `DS-A`; the documented TypeScript divergence is Track LayerGroup support. XML is not changed.
- **Canonical ownership and contracts**: **PASS** — Electron main owns canonical `BlueData`, validation, the disposable audition copy, and engine startup. The renderer owns transient selection and sends a typed serializable list of IDs over preload IPC. No migration or recovery storage is required.
- **Runtime and engine isolation**: **PASS** — only Electron main passes generated CSD to `EngineBridge`; renderer and `@blue/data` do not communicate with the engine.
- **Verification evidence**: **PASS** — add pure filtering/CSD tests, IPC/menu contract tests, renderer command tests, main orchestration tests with an engine stub, and quickstart validation. Run affected package tests, type checks, lint, and build commands.

### Post-Design

- **Portable data core**: **PASS** — `createAuditionProjectCopy` accepts existing data objects and selected source references, with no host APIs.
- **Java and project compatibility**: **PASS** — the helper preserves Java-visible audition semantics and extends them structurally to Track LayerGroups and audio clips. The project copy is disposable, so no XML or canonical-CSD behavior changes.
- **Canonical ownership and contracts**: **PASS** — the contract has one direction per concern: renderer availability notification for menu state, renderer invocation with selected IDs, main validation/result, and main-to-renderer native-menu command. Stale IDs reject without mutation.
- **Runtime and engine isolation**: **PASS** — the existing `EngineBridge.playCSD` route is reused and receives a CSD from the temporary data copy only.
- **Verification evidence**: **PASS** — planned tasks cover the pure data contract, native menu accelerator/menu enablement, preload/global declarations, renderer flush-and-dispatch, stale input/error behavior, engine invocation, and manual end-to-end validation.

## Project Structure

### Documentation (this feature)

```text
specs/070-audition-scoreobjects/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── audition-scoreobjects.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/
├── blue-data/src/
│   ├── blue-data.ts
│   ├── score/
│   │   ├── audition-project.ts
│   │   ├── audition-project.test.ts
│   │   ├── layers/
│   │   └── track/
│   └── index.ts
└── blue-app/src/
    ├── main/
    │   ├── main.ts
    │   ├── application-menu.ts
    │   ├── application-menu.test.ts
    │   ├── audition-score-objects.ts
    │   └── audition-score-objects.test.ts
    ├── preload/preload.ts
    ├── renderer/
    │   ├── stores/score-selection-store.ts
    │   ├── stores/playback-store.ts
    │   ├── stores/workbench-store.ts
    │   ├── tests/workbench-store.test.ts
    │   └── types/global.d.ts
    └── shared/
        ├── project-editor.ts
        └── workbench-menu.ts
```

**Structure Decision**: Keep score-copy and filtering behavior in `@blue/data` for portable, isolated tests. Keep stable-ID resolution in the existing shared project-editor contract, then place menu state, IPC, engine orchestration, and renderer command handling in their existing Electron layers.
