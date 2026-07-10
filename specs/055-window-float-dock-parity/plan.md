# Implementation Plan: Window Float/Dock Parity

**Branch**: `055-window-float-dock-parity` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/055-window-float-dock-parity/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement Java Blue/NetBeans-style Float and Dock behavior for the Electron workbench. The planned approach is to replace the current in-workbench floating tab action with Dockview popout groups hosted as separate Electron application windows, extend the workbench layout envelope with floating-origin metadata, centralize tab command eligibility, and route Window menu reveal commands through a workbench-window registry so existing docked, minimized, slide-out, maximized, or floating panels are focused without duplication.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x
**Primary Dependencies**: Dockview 5.2.0 / dockview-core 5.2.0, Zustand 5.x, Radix Context Menu, Electron `BrowserWindow`/IPC/Menu, existing `@blue/data` project snapshot IPC
**Storage**: Existing app-wide `program-settings.json` window-layout settings; workbench layout stored as a serialized layout envelope under `appSpecific.windowLayout.workbench`; `.blue` project XML remains unchanged
**Testing**: Vitest 4.x for shared/main/store/unit tests; existing renderer testing through Vitest/jsdom where practical; browser/Electron smoke coverage for popout/reveal behavior where feasible
**Target Platform**: Electron desktop app on macOS, Windows, and Linux
**Project Type**: Desktop app in the `@blue/app` package of the monorepo
**Performance Goals**: Float, Dock, reveal, and context-menu command-state updates should complete without visible UI stalls for the current workbench panel set; layout persistence must not block editing or playback interactions
**Constraints**: No `@blue/data` changes; no `.blue` project serialization changes; shared contracts must remain browser-safe and avoid Node/Electron imports; floating workbench windows must share the same active project/playback session; reset must clear floating layout state without altering unrelated settings
**Scale/Scope**: Current workbench panel registry, including editor panels, properties auxiliary group, output auxiliary group, REPL/output entries, minimized edge tabs, slide-outs, maximized groups, and multiple simultaneous floating workbench windows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Data-First, UI-Separated**: Pass. This feature changes Electron main/preload/renderer workbench behavior and shared app contracts only; it does not move business logic into UI or change `@blue/data`.
- **II. Backwards-Compatible Serialization**: Pass. No `.blue` XML schema or project round-trip behavior changes are planned.
- **III. JVM Dependencies Preserved, Not Replaced**: Pass. No Jython/Clojure/JVM behavior changes are planned.
- **IV. Engine as External Process**: Pass. Playback/live state remains surfaced through existing main-process IPC; no engine protocol or native binding changes are planned.
- **V. Test-First for Serialization**: Not directly applicable because this feature does not port data classes or project serialization. Layout and IPC changes still require targeted tests before implementation completion.
- **Additional Constraints**: Pass. Any shared types added for workbench windows must remain browser-safe; Node/Electron APIs stay in main/preload or renderer app layers.

## Project Structure

### Documentation (this feature)

```text
specs/055-window-float-dock-parity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── tab-command-contract.md
│   └── workbench-window-ipc.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/blue-app/src/shared/
├── window-layout-settings.ts
├── workbench-menu.ts
└── workbench-window-contract.ts        # new internal IPC/layout contract

packages/blue-app/src/main/
├── application-menu.ts
├── application-menu.test.ts
├── main.ts
├── window-layout-store.ts
├── window-state-manager.ts
├── workbench-window-manager.ts         # new floating workbench registry
└── workbench-window-manager.test.ts    # new

packages/blue-app/src/preload/
└── preload.ts

packages/blue-app/src/renderer/components/workbench/
├── AuxiliaryTab.tsx
├── WorkbenchShell.tsx
├── auxiliary-layout.ts
├── auxiliary-layout.test.ts            # existing or new focused coverage
├── panel-registry.ts
├── tab-command-state.ts                # new pure command-state helper
└── tab-command-state.test.ts           # new

packages/blue-app/src/renderer/stores/
├── layout-settings-store.ts
├── project-store.ts
└── workbench-store.ts

packages/blue-app/src/shared/
├── window-layout-settings.test.ts
└── workbench-window-contract.test.ts   # new if validation helpers are added
```

**Structure Decision**: Keep the feature inside `@blue/app` because it is app shell, IPC, menu, and renderer workbench behavior. Add shared browser-safe contracts only for IPC/layout shapes. Keep `@blue/data`, `@blue/engine-client`, and Java runtime packages untouched.

## Complexity Tracking

No constitution violations identified.

## Post-Design Constitution Check

*Re-check after Phase 1 design artifacts.*

- **I. Data-First, UI-Separated**: Pass. `data-model.md` and contracts keep window-system state in `@blue/app` shared/main/renderer layers and do not add UI dependencies to `@blue/data`.
- **II. Backwards-Compatible Serialization**: Pass. `research.md` and `data-model.md` keep floating layout in app-wide settings and explicitly leave `.blue` XML unchanged.
- **III. JVM Dependencies Preserved, Not Replaced**: Pass. No JVM-backed score object, note processor, or runtime behavior is touched.
- **IV. Engine as External Process**: Pass. Shared playback/live state is synchronized through existing main-process events; no engine protocol changes are introduced.
- **V. Test-First for Serialization**: Not applicable to `.blue` serialization; the plan still requires test-first coverage for layout envelope migration and IPC/window behavior.
- **Additional Constraints**: Pass. The IPC contracts are documented as browser-safe shared types, with Electron-specific work kept in main/preload layers.
