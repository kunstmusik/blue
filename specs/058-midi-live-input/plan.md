# Implementation Plan: MIDI Device Input And Blue Live Routing

**Branch**: `058-midi-live-input` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/058-midi-live-input/spec.md`

## Summary

Add app-wide MIDI input device management and route physical note events through the existing Blue Live project-mapping path. The primary application renderer owns a single Web MIDI transport service because Chromium already provides portable device access; Electron main grants non-SysEx MIDI permission only to the trusted primary renderer, persists explicit device preferences, coordinates settings/status IPC, and retains canonical Blue Live engine submission. Previously unknown devices are enabled and opened by default, while an explicit saved disabled preference remains authoritative across app launches. The obsolete Blue Live `MIDI Input` button is removed rather than replaced with another global capture state.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; React 19.x; Electron 35.x
**Primary Dependencies**: Chromium Web MIDI API, Electron `session`/`BrowserWindow`/IPC, Zustand 5.x, existing `@blue/data` MIDI mapping utilities, existing Blue Live engine bridge
**Storage**: Main-process `program-settings.json` under Electron user data for durable enabled-device identities; transient renderer/main runtime snapshots for availability, connections, and held notes; `.blue` XML unchanged
**Testing**: Vitest 4.x unit/component tests with injected fake `MIDIAccess`/ports, existing main/preload/renderer test patterns, package build/type checks, and manual hardware smoke tests in development and packaged Electron builds
**Target Platform**: Electron desktop on macOS, Windows, and Linux; first proof-of-concept on the currently supported development platform, then packaged verification on each release target
**Project Type**: Electron desktop application in a TypeScript monorepo
**Performance Goals**: Rescan state visible within 2 seconds; device lifecycle changes visible within 1 second; 95% of hardware events add no more than 5 ms application routing delay relative to equivalent Virtual Keyboard events
**Constraints**: No global MIDI capture toggle; non-SysEx input only; one long-lived transport owner in the primary renderer; Settings renderer must not own ports; no native MIDI addon in the primary design; no new Node/browser dependencies in `@blue/data`; listeners and cleanup must be idempotent under React Strict Mode, rescan, hot-plug, and partial failure
**Scale/Scope**: Zero or more remembered devices, multiple concurrently enabled devices, one app-wide settings panel, one primary renderer transport, one settings child renderer, note-on/note-off only, and the existing Blue Live/Virtual Keyboard project-mapping surface

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Plan evidence |
|---|---|---|
| I. Data-First, UI-Separated | PASS | Device contracts are shared serializable types; browser device access stays in `@blue/app`; existing pure `@blue/data` mapping remains canonical and unchanged. |
| II. Backwards-Compatible Serialization | PASS | `.blue` XML is unchanged. Program settings gain versioned MIDI preferences with migration/preservation for legacy placeholder strings. |
| III. JVM Dependencies Preserved | PASS | No JVM or Blue Java runtime dependencies change. |
| IV. Engine Runs Externally | PASS | Hardware notes reuse the existing Blue Live engine/IPC path; no embedded Csound or alternate engine is introduced. |
| V. Test-First Serialization | PASS | No `.blue` serialization changes. Program-settings migration and persistence receive focused tests before integration. |
| VI. Research Documents Are Source Of Truth | PASS | Java behavior, TypeScript gaps, selected ownership, deliberate toolbar divergence, and fallback are recorded in `research.md`. |
| VII. Spec-Driven Implementation | PASS | `spec.md`, this plan, Phase 1 contracts/data model, and generated `tasks.md` define the work before implementation. |

**Post-design re-check**: PASS. Phase 1 keeps all raw Web MIDI types behind a renderer adapter, sends only serializable snapshots/events across IPC, and does not add any constitution exception.

## Project Structure

### Documentation (this feature)

```text
specs/058-midi-live-input/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── midi-input-runtime.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/blue-app/src/
├── shared/
│   ├── midi-input.ts                    # serializable settings, runtime, command, and note contracts
│   ├── program-settings.ts              # versioned MIDI preference section and panel ID
│   └── project-editor.ts                # compatible live-note source metadata extension
├── main/
│   ├── main.ts                          # trusted permission policy and IPC registration
│   ├── midi-input-coordinator.ts        # settings/status relay to the primary renderer
│   ├── midi-permission.ts               # trusted permission decision plus Electron label workaround
│   └── program-settings-store.ts        # migration and durable enabled-device preferences
├── preload/
│   └── preload.ts                       # narrow MIDI settings/status/control bridge
└── renderer/
    ├── hooks/
    │   └── use-midi-input-service.ts    # primary-window lifetime host
    ├── services/
    │   ├── midi-input-service.ts        # Web MIDI discovery, port lifecycle, hot-plug, parsing
    │   └── midi-note-router.ts          # shared hardware/Virtual Keyboard note route and ledger
    ├── stores/
    │   └── midi-input-store.ts          # serializable runtime snapshot for primary UI consumers
    └── components/
        ├── settings/
        │   ├── SettingsApp.tsx          # app-wide MIDI category and Apply lifecycle
        │   └── MidiSettings.tsx         # device table, states, rescan, enablement, errors
        ├── menu-bar/
        │   └── ToolbarBlueLive.tsx      # remove obsolete MIDI Input control
        └── workbench/panels/
            └── VirtualKeyboardPanel.tsx # submit through common note router

packages/blue-app/src/
├── main/
│   ├── midi-input-coordinator.test.ts
│   ├── midi-permission.test.ts
│   └── program-settings-store.test.ts
└── renderer/tests/
    ├── midi-input-contract.test.ts
    ├── midi-input-service.test.ts
    ├── midi-note-router.test.ts
    ├── midi-settings.test.tsx
    ├── blue-live-toolbar.test.tsx
    └── virtual-keyboard-panel.test.tsx
```

**Structure Decision**: Extend the existing `@blue/app` main/preload/renderer boundaries. Raw Web MIDI objects never cross IPC and are never placed in project data. A small main coordinator makes the primary renderer the only device owner while allowing the separate Settings renderer to issue commands and observe cached serializable state. The existing `@blue/data` MIDI processor and Blue Live main handler remain the canonical mapping implementation.

## Complexity Tracking

No constitution violations or additional project layers are required. The coordinator and two renderer services isolate lifecycle, transport, and routing concerns that otherwise cross Electron process boundaries. The shared runtime-channel update path also preserves BSB widget fan-out to both timeline playback and Blue Live.
