# Implementation Plan: Audio File Player

**Branch**: `057-audio-file-player` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/057-audio-file-player/spec.md`

## Summary

Deliver a right-auxiliary Audio File Player that previews user-selected or
newly rendered local audio inside Blue. Playback uses Chromium's media stack
through a privileged, range-aware app protocol; the renderer owns transient
player state, waveform display, seeking, loop controls, metadata, and compact
transport presentation. Render-to-Disk Play completion opens and populates the
panel without changing Render-to-Disk Open behavior.

## Technical Context

**Language/Version**: TypeScript 5.8.x, strict mode
**Primary Dependencies**: React 19.x, Electron 35.x, Lucide React, Web Audio API, Vitest 4.x
**Storage**: Transient renderer player state; disk files remain user-selected or render-derived; no project XML changes
**Testing**: Vitest focused unit/component/contract tests; Electron media-pipeline smoke probe; production renderer build
**Target Platform**: Electron desktop application on macOS, Windows, and Linux
**Project Type**: Electron desktop monorepo
**Performance Goals**: Native media streaming and seeking for playback; smooth canvas playhead updates. Waveform and metadata decoding make one-time renderer byte reads.
**Constraints**: Context isolation and disabled Node integration in the renderer; main-process file access only; no Node built-ins or dynamic imports in `@blue/data`
**Scale/Scope**: One workbench panel, three preload IPC methods, one authorized privileged local-media scheme, and one render-completion handoff

## Constitution Check

| Principle | Result | Evidence |
|---|---|---|
| I. Data-First, UI-Separated | PASS | No `@blue/data` API or serialization behavior changed; player code is isolated to Electron main/preload/renderer layers. |
| II. Backwards-Compatible Serialization | PASS | The feature stores no player state in `.blue` XML and does not modify project serialization. |
| III. JVM Dependencies Preserved | PASS | No JVM-backed sound object or runtime path is changed. |
| IV. Engine as External Process | PASS | Preview playback uses the browser media pipeline and does not change the engine protocol. |
| V. Test-First for Serialization | NOT APPLICABLE | No data class or serialization work is included. |

**Post-design re-check**: PASS. The custom protocol and IPC endpoints remain
inside `@blue/app`; `@blue/data` remains browser-safe and untouched.

## Project Structure

### Documentation (this feature)

```text
specs/057-audio-file-player/
├── checklists/requirements.md
├── contracts/audio-player-ipc.md
├── data-model.md
├── handoff.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/blue-app/src/
├── main/
│   ├── audio-stream-protocol.ts
│   └── main.ts
├── preload/preload.ts
├── renderer/
│   ├── components/workbench/
│   │   ├── DockviewPanel.tsx
│   │   ├── WorkbenchShell.tsx
│   │   └── panels/audio-player/
│   ├── index.html
│   ├── popout.html
│   └── types/global.d.ts
└── shared/render-freeze-contract.ts
```

**Structure Decision**: The player is a renderer-local workbench panel. The
main process owns privileged file delivery and file-selection metadata, while
the preload layer exposes narrowly typed capabilities to the renderer.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
