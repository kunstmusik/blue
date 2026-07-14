# Implementation Plan: OSC Control Parity

**Branch**: `059-osc-control-parity` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)\
**Input**: Feature specification from `/specs/059-osc-control-parity/spec.md`\
**Status**: Complete | **Closed**: 2026-07-14

## Summary

Add an always-on inbound OSC/UDP service to the Electron main process, an `OSC` Application Settings category immediately after `MIDI`, and a serialized renderer command router for the five score and three Blue Live commands retained from Java Blue. The service binds the saved preferred IPv4 port (default 8000) on all interfaces and scans upward only after `EADDRINUSE`, leaving the selected fallback transient and visible in Settings. It uses Node's `dgram` lifecycle with `node-osc` packet decoding, preserves Java Blue's prefix matching, argument-ignoring, recursive bundle order, and immediate timetag behavior, and deliberately leaves `/blueLive/toggleMidiInput` unregistered because that application command has been retired.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; React 19.x; Electron 35.x with its Node 22 runtime\
**Primary Dependencies**: Electron `BrowserWindow`/IPC, Node `dgram`, `node-osc` 11.6.x for OSC packet codecs/types, existing program-settings store, Zustand 5.x project/playback stores, existing Blue Live engine bridge\
**Storage**: Main-process `program-settings.json` for the preferred port; transient main-process listener status; `.blue` project XML unchanged\
**Testing**: Vitest 4.x unit/integration tests, Electron main/preload contract tests, renderer component/store tests, real local UDP smoke tests\
**Target Platform**: Electron desktop on macOS, Windows, and Linux with IPv4 UDP support\
**Project Type**: TypeScript monorepo desktop application\
**Performance Goals**: Report preferred-port fallback and listening status within two seconds; begin 95% of local command transitions within 250 ms, excluding engine compile/start work\
**Constraints**: Exactly one listener; bind `udp4` to `0.0.0.0`; retry only `EADDRINUSE`; never wrap past 65535; no replies, authentication, output OSC, project persistence, or retired MIDI-toggle behavior; deterministic lifecycle command ordering; clean shutdown port release\
**Scale/Scope**: Eight fixed command prefixes, one app-wide OSC preference, one runtime listener, one Settings panel, and one primary-renderer command consumer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **I. Data-First, UI-Separated**: PASS. OSC transport and Electron IPC remain in `@blue/app`; no Node or UI dependency enters `@blue/data`.
- **II. Backward-Compatible Serialization**: PASS. `.blue` XML is unchanged. Program-settings migration reads the legacy app-specific input-port placeholder and preserves unused output placeholders.
- **III. JVM Plugin Dependencies Preserved**: PASS. This slice neither removes nor changes Java/JVM dependency metadata.
- **IV. Engine Process Boundary**: PASS. OSC commands reuse the existing playback and Blue Live bridges; no Csound engine logic is embedded in the renderer or data library.
- **V. Serialization and Round-Trip Tests**: PASS. No project-model serialization changes are planned. Program-settings migration and save/load behavior receive dedicated fixtures.
- **Additional Constraints**: PASS. All imports are static. Node built-ins are limited to Electron main-process code, and `@blue/data` is untouched.

Post-design re-check: PASS. The data model and contracts retain these boundaries and introduce no constitution exception.

## Project Structure

### Documentation (this feature)

```text
specs/059-osc-control-parity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── osc-control-runtime.md
└── tasks.md                 # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
packages/blue-app/
├── package.json
├── src/
│   ├── shared/
│   │   ├── osc-control.ts                  # OSC preferences, status, command, and IPC contracts
│   │   └── program-settings.ts             # OSC panel/order/defaults and settings migration shape
│   ├── main/
│   │   ├── osc-control-service.ts          # UDP bind/retry/decode/dispatch lifecycle
│   │   ├── program-settings-store.ts       # Persist/migrate/reset preferred port
│   │   └── main.ts                         # Startup, settings reconfigure, IPC, shutdown
│   ├── preload/
│   │   └── preload.ts                      # Typed OSC snapshot and command subscriptions
│   └── renderer/
│       ├── App.tsx                         # Install the primary-window command consumer
│       ├── components/settings/
│       │   ├── SettingsApp.tsx             # OSC draft/status wiring and left-nav order
│       │   └── OscSettings.tsx              # Preferred/active port and listener status UI
│       ├── hooks/
│       │   └── use-osc-control-commands.ts  # Subscribe/unsubscribe command stream
│       ├── services/
│       │   └── osc-command-router.ts        # Ordered score/Blue Live action execution
│       ├── stores/
│       │   ├── playback-store.ts            # Explicit fresh-play/restart action
│       │   └── project-store.ts             # Existing rewind and marker actions reused
│       └── types/
│           └── global.d.ts                  # Preload API declarations
└── tests/
    ├── main/
    │   ├── osc-control-service.test.ts
    │   └── program-settings-store.test.ts
    ├── preload/
    │   └── osc-control-api.test.ts
    ├── renderer/
    │   ├── osc-command-router.test.ts
    │   └── osc-settings.test.tsx
    └── shared/
        └── osc-control.test.ts

pnpm-lock.yaml                               # node-osc dependency lock update
```

**Structure Decision**: Keep the OSC socket and decoder in the Electron main process, where Node networking and app lifecycle belong. Put serializable contracts in the existing shared package area, expose a narrow preload bridge, and execute UI/store-dependent commands through a single ordered router in the primary renderer. This reuses existing score, playback, Blue Live, and settings architecture without changing `@blue/data` or adding a new package.

## Design Sequence

1. Define shared preference, runtime snapshot, command event, registry, validation, and IPC channel contracts.
2. Add the structured OSC preference and versioned legacy migration to program settings; place the new panel after MIDI.
3. Implement the main-process UDP service with injected socket/decoder seams, upward conflict scanning, packet flattening, status reporting, and idempotent start/restart/stop.
4. Wire startup, settings Apply/Reset reconfiguration, snapshot/command IPC, and shutdown ordering in the Electron main process and preload.
5. Replace the orphan renderer OSC placeholder with the preferred/active/status panel.
6. Add a serialized primary-renderer command router and an explicit fresh regular-playback action, while reusing marker, rewind, stop, Blue Live, and project-patch flushing behavior.
7. Add unit, contract, integration, and manual UDP verification for command parity, the retired address, fallback, races, malformed traffic, and port release.

## Complexity Tracking

No constitution violations require justification.

## Implementation Closeout

The planned main-process listener, shared contracts, preload bridge, renderer command queue, Settings panel, persistence migration, and verification coverage are implemented. Final review found no blocking code-quality, scope, parity, or constitution issues. The feature passed focused and full application tests, the workspace test suite, the application build, repository lint, and hands-on OSC command acceptance.
