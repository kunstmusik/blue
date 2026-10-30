# Implementation Plan: Program Settings Parity

**Branch**: `044-program-settings-parity` | **Date**: 2026-05-19 | **Spec**: [/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/spec.md](/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/spec.md`

## Summary

Replace the current placeholder Settings surface with Java Blue program-settings parity for the active `blue-settings` panels: General, Project Defaults, Playback, Utility, Realtime Render, and Disk Render. Store program settings app-wide in a main-process-owned settings service, expose typed snapshot/update IPC to the Settings renderer, apply defaults during new project creation, consume settings in realtime playback/playhead behavior and available render workflows, and produce a usage parity matrix plus missing-feature report for unavailable Java workflows such as disk render execution or SoundObject freeze.

**Playback cadence follow-up (2026-10-29):** The project owner intentionally chose a 30 fps Blue TypeScript default for Time Pointer Animation FPS; Java Blue's default remains 24 fps. This is a documented default-value divergence, not a change to the supported 1–120 fps setting range. Settings Apply sends the saved FPS to the open workbench so its shared display ticker changes cadence in the same session. The change uses original code within the existing GPL-3.0-or-later `@blue/app` scope and adds no third-party material or dependency.

## Technical Context

**Language/Version**: TypeScript 5.8.x, React 19.x, Electron 35.x, strict renderer/main/preload packages, pure TypeScript `@blue/data` for project mutation helpers  
**Primary Dependencies**: Electron `app`/`BrowserWindow`/IPC/settings window, existing `settings-window.ts`, preload `blueAPI`, Zustand 5.x where still useful for renderer-local app preferences, `@blue/data` `BlueData`/`ProjectProperties`/`TimeState`/`Mixer`/`UDOStyle`/`TimeBase`/`SnapValueName`, existing playback store and `EngineBridge`, existing CSD export/render-command helpers, Vitest 4.x  
**Storage**: Main-process JSON settings file under the Electron user data area for Java-compatible program settings; existing renderer-persisted `blue-settings` values are migrated or retained as app-specific preferences; `.blue` project XML is only affected when Java Blue seeds new project-owned values from program settings  
**Testing**: Vitest main/shared/renderer tests, focused IPC/preload tests, settings renderer render tests, project-default application tests, realtime option/playback-store tests, `pnpm --filter @blue/app test`, `pnpm --filter @blue/app build`, `pnpm --filter @blue/data test` where data helper behavior is touched, `git diff --check`  
**Target Platform**: Electron desktop, macOS first with Java-compatible platform defaults and driver choices for macOS, Windows, Linux, and fallback platforms  
**Project Type**: Desktop application settings, Electron main/preload integration, renderer forms, and project/default/runtime integration  
**Performance Goals**: Settings open and category switches remain immediate for the small fixed panel set; settings load occurs once during app startup before project creation/playback; applying settings writes a small JSON document without blocking renderer interaction  
**Constraints**: Keep `@blue/data` UI-free and Node-free; do not serialize app settings into `.blue` files except through Java-compatible new-project defaults; preserve existing `.blue` round-trip behavior; keep current renderer settings values available through migration/retention; do not claim Text Settings parity without an active Java panel/controller  
**Scale/Scope**: Six settings panels, one app-wide settings model/store, IPC/preload contract, new project default application, realtime/playback/disk/utility usage hooks where workflows exist, usage parity matrix, missing-feature report, tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Data-First, UI-Separated**: PASS. Program settings are app state owned by `@blue/app`; any reusable project-default application logic remains pure and acts on `@blue/data` objects without UI dependencies.
- **Backwards-Compatible Serialization**: PASS. `.blue` XML remains unchanged except for normal project fields that Java Blue already initializes from program defaults on new project creation.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Utility settings that point at freeze/SoundFont workflows are reported as dependencies if those Java-backed workflows are unavailable.
- **Engine as External Process**: PASS. Realtime playback continues through blue-engine; settings alter command/options selection rather than introducing FFI or renderer audio.
- **Test-First for Serialization**: PASS/N/A. No new `@blue/data` XML class is required; if helper tests touch project defaults, they verify existing project XML behavior is preserved.
- **Research Integration**: PASS. Java `blue-settings` panel inventory, current TypeScript settings state, and workflow gaps are recorded in `research.md`.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── program-settings-surface.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/
├── program-settings.ts
└── project-editor.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── main.ts
├── settings-window.ts
├── program-settings-store.ts
├── program-settings-application.ts
├── program-settings-usage.ts
├── render-command.ts
├── csd-export.ts
└── engine-bridge.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/preload/
└── preload.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/
├── components/settings/
│   ├── SettingsApp.tsx
│   ├── SettingsField.tsx
│   ├── GeneralSettings.tsx
│   ├── ProjectDefaultsSettings.tsx
│   ├── PlaybackSettings.tsx
│   ├── UtilitySettings.tsx
│   ├── RealtimeRenderSettings.tsx
│   ├── DiskRenderSettings.tsx
│   └── SettingsSection.tsx
├── hooks/
│   └── use-ipc-listeners.ts
└── stores/
    ├── playback-store.ts
    ├── project-store.ts
    └── settings-store.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── program-settings-store.test.ts
├── program-settings-application.test.ts
├── program-settings-usage.test.ts
└── settings-window.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/renderer/tests/
├── program-settings-window.test.tsx
├── program-settings-migration.test.tsx
├── playback-settings-parity.test.ts
└── settings-store.test.tsx
```

**Structure Decision**: Keep Settings as the existing modal Electron settings window, but move Java-compatible program settings persistence into main process so project creation and playback can consume settings before any renderer-local store is available. Use shared TypeScript types for snapshots, validation, platform defaults, and usage-matrix status. Keep existing current-app preferences either migrated into program settings where they match Java semantics or retained in the renderer settings store as app-specific preferences.

## Complexity Tracking

No constitution exception is required.

## Phase 0 Research Output

See [/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/research.md](/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/research.md).

## Phase 1 Design Output

- [/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/data-model.md](/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/data-model.md)
- [/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/contracts/program-settings-surface.md](/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/contracts/program-settings-surface.md)
- [/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/quickstart.md](/Users/stevenyi/work/blue-electron/specs/044-program-settings-parity/quickstart.md)

## Post-Design Constitution Check

- **Data-First, UI-Separated**: PASS. The data model separates app settings snapshots from project-owned settings, and renderer panels edit snapshots rather than reaching into project data.
- **Backwards-Compatible Serialization**: PASS. New-project default application writes normal `BlueData` properties and does not introduce app settings XML.
- **JVM Dependencies Preserved, Not Replaced**: PASS. Missing Java utility workflows are represented as missing-feature dependencies, not reimplemented inside settings work.
- **Engine as External Process**: PASS. Runtime settings feed existing blue-engine command/options construction.
- **Test-First for Serialization**: PASS/N/A. Tasks require tests around new-project default output and no unintended `.blue` settings persistence.
- **Research Integration**: PASS. Research decisions identify active Java panels, stale Text Settings resources, settings ownership, migration, and missing-feature reporting.
