# Implementation Plan: Window Layout Persistence

**Branch**: `054-window-layout-persistence` | **Date**: 2026-07-05 | **Spec**: [/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/spec.md](/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/spec.md`

**Note**: This file is filled by the Spec Kit planning workflow. Task generation is captured separately in `tasks.md`.

## Summary

Persist all application-level window and split layout state in the existing main-process program settings file. Extend app-specific settings with a versioned window-layout snapshot, replace renderer-only workbench localStorage persistence with app-wide settings plus one-time legacy migration, persist app-owned BrowserWindow bounds by stable identity, persist every user-adjustable split as a controlled-pane pixel size, default side and bottom controlled panes to 200px except the documented 250px BSB property-pane parity case, and replace the current Window > Reset Default Layout command with Java Blue-style Window > Reset Windows that clears only layout state.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, strict monorepo packages
**Primary Dependencies**: Existing `@blue/app` program settings store, Electron `BrowserWindow`/`screen`/IPC, preload `blueAPI`, React renderer, Zustand workbench/settings stores, Dockview 5.2.0, reusable `SplitPane`, Vitest 4.x
**Storage**: Main-process app-wide `program-settings.json` under Electron user data; layout state lives under app-specific program settings; legacy renderer storage keys `blue-settings.windowBounds` and `blue-workbench-layout` migrate once; `.blue` project XML is unchanged
**Testing**: Vitest shared/main/renderer tests, focused workbench/split/menu/window manager suites, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, `git diff --check`
**Target Platform**: Electron desktop app, macOS first with cross-platform screen bounds validation for Windows/Linux behavior
**Project Type**: Desktop application app-state persistence, Electron main/preload/renderer integration, and renderer layout controls
**Performance Goals**: Window restore happens before show; layout load happens during workbench initialization; debounced layout writes keep drag/resize interaction responsive; settings files remain small JSON documents
**Constraints**: Preserve `@blue/data` browser-safe and Node-free constraints; do not write layout state into `.blue` files; use static imports; avoid duplicate renderer/main sources of truth; Reset Windows must not prompt for project save/discard
**Scale/Scope**: Main app window, Settings window, effect editor/interface windows, Dockview workbench layout, auxiliary side/bottom sizes, reusable SplitPane call sites, current ad hoc score-object splitters, legacy renderer layout migration, Reset Windows tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Data-First, UI-Separated**: PASS. This feature is app layout state in `@blue/app`; no business/data model logic moves into UI-only code, and `@blue/data` is untouched.
- **Backwards-Compatible Serialization**: PASS. No `.blue` XML fields or migrations are introduced.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Java runtime surfaces are unrelated to window/split layout persistence.
- **Engine as External Process**: PASS. Playback/render engine integration is untouched.
- **Test-First for Serialization**: PASS/N/A. No serialized `@blue/data` classes are added; tasks require tests first for app settings persistence instead.
- **File I/O Abstraction**: PASS. Node filesystem and screen APIs remain in Electron main/app code; `@blue/data` remains free of Node built-ins.
- **Research Integration**: PASS. Java Blue and current Electron layout findings are captured in `research.md`.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── window-layout-settings.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/
├── program-settings.ts
├── window-layout-settings.ts
├── workbench-menu.ts
└── project-editor.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── main.ts
├── application-menu.ts
├── program-settings-store.ts
├── window-layout-store.ts
├── window-state-manager.ts
├── settings-window.ts
└── effect-editor-window-manager.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/
└── preload.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/
├── components/workbench/
│   ├── WorkbenchShell.tsx
│   └── auxiliary-layout.ts
├── components/workbench/panels/
│   ├── OrchestraPanel.tsx
│   ├── ScorePanel.tsx
│   ├── EffectLibraryModal.tsx
│   ├── orchestra/SplitPane.tsx
│   ├── orchestra/bsb/BSBInterfaceEditor.tsx
│   ├── udo/UdoWorkspacePanel.tsx
│   └── score-object/editors/
│       ├── LineObjectEditor.tsx
│       ├── PatternObjectEditor.tsx
│       ├── PianoRollEditor.tsx
│       └── ZakLineObjectEditor.tsx
├── hooks/
│   └── use-ipc-listeners.ts
├── stores/
│   ├── layout-settings-store.ts
│   ├── settings-store.ts
│   └── workbench-store.ts
└── types/
    └── global.d.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/
├── program-settings.test.ts
└── window-layout-settings.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── program-settings-store.test.ts
├── window-layout-store.test.ts
├── window-state-manager.test.ts
├── application-menu.test.ts
├── settings-window.test.ts
└── effect-editor-window-manager.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/
├── layout-settings-store.test.ts
├── workbench-layout-persistence.test.ts
├── workbench-store.test.ts
├── workbench-auxiliary.test.ts
├── orchestra-split-pane.test.tsx
├── editor-split-persistence.test.tsx
└── use-ipc-listeners.test.tsx
```

**Structure Decision**: Keep canonical persistence in Electron main through the existing program-settings file, with a small shared layout-settings type/helper module used by main/preload/renderer. Main owns BrowserWindow bounds, display-state validation, and Reset Windows persistence. Renderer owns live workbench and split controls but reads/writes through layout-specific IPC instead of direct durable localStorage.

## Phase 0: Research

Research is captured in [/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/research.md](/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/research.md). Key decisions:

- Persist layout state under app-wide program settings rather than project XML or renderer-only localStorage.
- Store split locations as controlled-pane pixel sizes even if components convert to ratios internally.
- Rename and expand the current Reset Default Layout command into a single Reset Windows command.
- Migrate `blue-settings.windowBounds` and `blue-workbench-layout` once without overwriting newer app-wide layout values.
- Clamp invalid/offscreen bounds and too-small split sizes for display without rewriting saved values solely because clamping occurred.

## Phase 1: Design And Contracts

Design artifacts generated by this plan:

- [/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/data-model.md](/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/data-model.md)
- [/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/contracts/window-layout-settings.md](/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/contracts/window-layout-settings.md)
- [/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/quickstart.md](/Users/stevenyi/work/blue-electron/specs/054-window-layout-persistence/quickstart.md)

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. The design introduces app-level layout snapshots and helpers in `@blue/app` only.
- **Backwards-Compatible Serialization**: PASS. Project XML is untouched and the data model identifies layout state as app settings.
- **JVM Dependencies Preserved, Not Replaced**: PASS.
- **Engine as External Process**: PASS.
- **Test-First for Serialization**: PASS/N/A. The task plan requires test-first settings persistence and reset coverage instead.
- **File I/O Abstraction**: PASS. Screen/file/user-data behavior remains isolated to Electron main.

## Complexity Tracking

No constitution violations or additional complexity exceptions are required.
