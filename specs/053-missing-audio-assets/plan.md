# Implementation Plan: Missing Audio Asset Check On Project Load

**Branch**: `053-missing-audio-assets` | **Date**: 2026-07-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/053-missing-audio-assets/spec.md`

**Note**: This file is filled by the Spec Kit planning workflow. Task generation is captured separately in `tasks.md`.

## Summary

Match Java Blue's post-load AudioFile dependency check for newly opened projects. After a `.blue` file is successfully loaded and made current, Electron main scans the project's AudioFile score-object paths using Java-compatible resolution rules, sends any unique missing paths to the renderer, and lets the user resolve rows in a modal. Confirmed mappings mutate only matching AudioFile paths in the in-memory project, normalize replacements relative to the project directory when possible, refresh the renderer snapshot, and leave the project open. Cancel, close, and confirm-with-no-mappings are no-op path changes.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages
**Primary Dependencies**: `@blue/data`, Electron `dialog`/IPC, React renderer components, Zustand project store, Vitest 4.x, Node `fs`/`path` in Electron main only
**Storage**: Main-process in-memory `BlueData` remains canonical; `.blue` XML format is unchanged; AudioFile replacement changes persist only when the user saves the project
**Testing**: Vitest for main-process service/IPC units and renderer jsdom component/listener tests
**Target Platform**: Electron desktop app
**Project Type**: Desktop application with pure data package plus Electron main/preload/renderer packages
**Performance Goals**: Missing-audio scan completes within 2 seconds for representative projects and deduplicates repeated missing paths before showing the modal
**Constraints**: Preserve Java Blue behavior; do not add Node built-ins to `@blue/data`; use static imports; no `.blue` schema changes; project remains open for every modal dismissal outcome
**Scale/Scope**: AudioFile score-object references in root score layer groups and nested PolyObjects; excludes BSB file selectors, AudioClip media, FrozenSoundObject files, external score scripts, and generated render outputs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Data-First, UI-Separated**: PASS. The data model remains `@blue/data`; filesystem probing and modal orchestration stay in `@blue/app` because file existence is caller responsibility.
- **Backwards-Compatible Serialization**: PASS. The feature mutates existing AudioFile `soundFileName` values only; it adds no XML elements or migration requirements.
- **JVM Dependencies Preserved, Not Replaced**: PASS. This feature does not alter Jython, Clojure, or Java runtime handling.
- **Engine as External Process**: PASS. Playback/render engine integration is untouched.
- **Test-First for Serialization**: PASS. No new serialized classes are introduced; tests will verify changed AudioFile paths round-trip through existing XML serialization when saved and reopened.
- **File I/O Abstraction**: PASS. `@blue/data` remains free of `fs`, `path`, `child_process`, `Buffer`, and other Node built-ins; Electron main owns path resolution and file checks.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/053-missing-audio-assets/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── missing-audio-assets-ipc.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── main.ts
├── missing-audio-assets.ts
└── missing-audio-assets.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/
└── missing-audio-assets.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/
└── preload.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/
├── App.tsx
├── hooks/use-ipc-listeners.ts
├── stores/project-store.ts
├── types/global.d.ts
├── components/workbench/panels/MissingAudioAssetsModal.tsx
└── tests/
    ├── missing-audio-assets-modal.test.tsx
    └── use-ipc-listeners.test.tsx
```

**Structure Decision**: Implement the filesystem-dependent scan, path normalization, replacement application, and session validation in Electron main. Share typed payloads through `packages/blue-app/src/shared/missing-audio-assets.ts`. Render the repair table as a normal React modal in the app shell, with Electron main providing native file picker IPC for row replacement selection.

## Phase 0: Research

Research is captured in [research.md](research.md). Key decisions:

- Keep the Java Blue parity scope AudioFile-only for this feature.
- Treat missing-file repair as post-load state repair, never as a project-open gate.
- Use current project directory, direct path, and `SFDIR` filename lookup as the Java-compatible resolution rules.
- Use a renderer modal plus main-process IPC because Electron native dialogs cannot represent the two-column repair table.

## Phase 1: Design And Contracts

Design artifacts generated by this plan:

- [data-model.md](data-model.md): Missing-audio entities, replacement mapping validation, and session state transitions.
- [contracts/missing-audio-assets-ipc.md](contracts/missing-audio-assets-ipc.md): Project-loaded extension payload and IPC methods for choosing, resolving, and dismissing replacements.
- [quickstart.md](quickstart.md): Manual and automated parity validation scenarios.

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. The design keeps project data mutations on the canonical main-process `BlueData` and keeps modal rendering in the renderer.
- **Backwards-Compatible Serialization**: PASS. Replacement paths reuse existing AudioFile XML fields.
- **JVM Dependencies Preserved, Not Replaced**: PASS.
- **Engine as External Process**: PASS.
- **Test-First for Serialization**: PASS. Round-trip validation is covered by quickstart and tasks using existing serialization.
- **File I/O Abstraction**: PASS. Node filesystem APIs are limited to `@blue/app` main-process code.

## Complexity Tracking

No constitution violations or additional complexity exceptions are required.
