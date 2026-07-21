# Implementation Plan: App Zooming

**Branch**: `061-app-zooming` | **Date**: 2026-07-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/Users/stevenyi/work/blue-electron/specs/061-app-zooming/spec.md`

**Note**: This file is filled by the Spec Kit planning workflow. Task generation is captured separately in `tasks.md`.

## Summary

Add a conventional View menu with Zoom In, Zoom Out, and Actual Size commands,
backed by a main-process app zoom controller that owns one exact integer
percentage for every Blue content window. Store the validated percentage in the
existing app-wide program settings, apply it as an absolute page zoom factor to
all live windows, seed it before newly created windows show content, and preserve
the current session scale if a settings write fails. Use custom menu callbacks
with standard application-local accelerators because Electron's built-in zoom
roles operate only on the focused page, use nonlinear zoom levels, and do not
provide the persistence hook this feature requires.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; Electron 35.7.5 with embedded Node 22.16.0; React 19.x renderers remain consumers of page zoom without feature-specific changes
**Primary Dependencies**: Electron `Menu`/`BrowserWindow`/`WebContents`/`app`, existing `@blue/app` program settings store, existing BrowserWindow factories and Dockview popout lifecycle, Vitest 4.x, Playwright 1.60.x Electron automation
**Storage**: Existing main-process `${app.getPath('userData')}/program-settings.json`; one validated `appSpecific.appZoomPercent` scalar; `.blue` project XML and workbench layout state remain unchanged
**Testing**: Vitest shared/main tests, application-menu and window-factory tests, focused Electron integration or browser smoke for real zoom/accelerators, full `@blue/app` test/build gates, workspace lint, `git diff --check`
**Target Platform**: Electron desktop app on macOS, Windows, and Linux
**Project Type**: Desktop application shell and app-preference persistence in `@blue/app`
**Performance Goals**: Every open Blue content window reflects a zoom command within 250 milliseconds; saved zoom is applied before first visible content on startup and new-window creation; persistence adds only one synchronous small-file settings write per changed command
**Constraints**: Exact 50%-to-300% range in 10-percentage-point steps; 100% Actual Size; application-local Command/Control shortcuts; all current/future Blue-owned BrowserWindows share one value; no project data, `@blue/data`, engine, JVM, renderer-local zoom store, global OS shortcut, pinch gesture, or custom percentage changes
**Scale/Scope**: 26 legal zoom values; main workbench, Settings, effect editor/interface windows, multiple Dockview popouts, application menu, app settings normalization/persistence, and stale Settings-draft protection

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Data-First, UI-Separated**: PASS. App zoom is Electron shell/profile state in `@blue/app`; no business logic or UI dependency enters `@blue/data`.
- **II. Backwards-Compatible Serialization**: PASS. `.blue` XML and its migration/round-trip behavior are untouched.
- **III. JVM Dependencies Preserved, Not Replaced**: PASS. Jython, Clojure, and Java runtime behavior are outside the feature.
- **IV. Engine as External Process**: PASS. No engine client, protocol, playback, or shared-memory behavior changes.
- **V. Test-First for Serialization**: PASS/N/A. No `@blue/data` serialization class is added; the plan requires test-first coverage for the app settings scalar and persistence path.
- **File I/O Abstraction**: PASS. File access remains in the existing Electron main-process program settings store; shared helpers remain browser-safe and Node-free.
- **Static Imports**: PASS. All planned production imports are top-level static imports; no `require()`, dynamic `import()`, or inline import type is introduced.
- **Research Integration**: PASS. Electron 35.7.5 behavior, application-window topology, and persistence decisions are recorded in `research.md`.

## Project Structure

### Documentation (this feature)

```text
/Users/stevenyi/work/blue-electron/specs/061-app-zooming/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── app-zoom.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
/Users/stevenyi/work/blue-electron/packages/blue-app/src/shared/
├── app-zoom.ts                         # New pure constants/validation/step helpers
├── app-zoom.test.ts                    # New exact-level and normalization coverage
├── program-settings.ts                 # appSpecific scalar/default/merge/validation
└── program-settings.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/src/main/
├── app-zoom-controller.ts              # New main-owned runtime/window/persistence coordinator
├── app-zoom-controller.test.ts
├── application-menu.ts                 # View menu and custom callbacks
├── application-menu.test.ts
├── main.ts                             # Early lifecycle registration and Settings-save merge
├── program-settings-store.test.ts
├── settings-window.ts                  # Declarative initial zoom for explicit factory
├── settings-window.test.ts
├── effect-editor-window-manager.ts     # Declarative initial zoom for explicit factories
└── effect-editor-window-manager.test.ts

/Users/stevenyi/work/blue-electron/packages/blue-app/scripts/
└── verify-app-zoom.mjs                 # Scripted restart/timing/multi-window acceptance gate
```

**Structure Decision**: Keep the feature entirely in `@blue/app`. Put value
validation and step arithmetic in a small browser-safe shared module, while a
main-process controller owns live state, BrowserWindow application, and durable
settings writes. Explicit window factories receive the initial factor as a
first-paint guard; an early `browser-window-created` listener covers Dockview
popouts, recreated main windows, and future app-owned BrowserWindows. No new
preload, IPC, renderer store, or project model contract is needed. A small
Playwright/Electron acceptance driver supplies the repeated restart, timing, and
native multi-window evidence that unit tests cannot provide.

## Phase 0: Research

Research is captured in [research.md](research.md). Key decisions:

- Use custom View menu items with Electron's conventional labels and
  accelerators; do not attach built-in zoom roles because their action bypasses
  the app-wide persistence/synchronization path.
- Represent zoom as one integer percentage and apply `percent / 100` through
  `setZoomFactor`; do not use Electron's exponential `zoomLevel` increments.
- Store `appSpecific.appZoomPercent` with default-fill normalization and no
  program-settings version bump.
- Initialize the controller and window-creation hook before the first
  BrowserWindow, then apply absolute factors to all open windows on change.
- Seed Dockview popouts through their `overrideBrowserWindowOptions.zoomFactor`
  and reapply on navigation because Chromium can reset a creation-time factor
  while committing the popout document.
- Preserve the controller-owned current percentage when a Settings window
  submits an older full settings snapshot.
- Keep persistence failure non-fatal and do not roll back the live scale.

## Phase 1: Design And Contracts

Design artifacts generated by this plan:

- [data-model.md](data-model.md)
- [contracts/app-zoom.md](contracts/app-zoom.md)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **I. Data-First, UI-Separated**: PASS. The design keeps pure zoom arithmetic in `@blue/app` shared code and Electron lifecycle/persistence behavior in main code; `@blue/data` remains untouched.
- **II. Backwards-Compatible Serialization**: PASS. The data model explicitly classifies zoom as app-profile state outside `.blue` XML.
- **III. JVM Dependencies Preserved, Not Replaced**: PASS. No JVM-backed object or runtime is affected.
- **IV. Engine as External Process**: PASS. The controller touches only application windows and program settings.
- **V. Test-First for Serialization**: PASS/N/A. Shared and main tests cover settings normalization/round-trip before implementation completion; no project serialization changes exist.
- **File I/O Abstraction**: PASS. The contract adds no Node dependency to shared code, and the controller delegates durable writes to the existing main-only store.
- **Static Imports**: PASS. The design requires static imports throughout.
- **Research Integration**: PASS. Every Phase 1 entity and contract maps to a resolved decision in `research.md`; no `NEEDS CLARIFICATION` markers remain.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
