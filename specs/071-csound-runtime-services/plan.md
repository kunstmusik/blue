# Implementation Plan: Csound Runtime Services

**Branch**: `071-csound-runtime-services` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Status**: Complete — all planned tasks are implemented and the repository validation gates are passing.

**Input**: Feature specification from `/specs/071-csound-runtime-services/spec.md`

## Summary

Make Blue Engine the single host for application-owned Csound work. Add three additive, one-shot native modes beside the existing compatibility probe: typed audio/MIDI module and selected-device discovery, direct Csound utility execution, and argument-driven offline Csound performance execution. Electron main deepens `EngineRuntimeService` to resolve the configured engine/Csound library, capability-gate each request, spawn the one-shot process, validate machine-readable results, stream execution output, and cancel only the owned child.

The settings renderer receives a narrow discovery IPC contract and replaces static driver-only choices with runtime modules plus editable discovered/custom device identifiers. Existing disk render, score-object freeze, and SoundFont inspection seams migrate from a caller-selected Csound executable to the main-owned engine service in increasing risk order. The realtime and Blue Live ZeroMQ loop, generated CSD, `.blue` XML, and project ownership remain unchanged. Legacy executable and render-method values remain loadable for downgrade safety but no longer select execution after cutover.

## Technical Context

**Language/Version**: C++17 for Blue Engine; TypeScript 5.8.x strict mode for Electron main/preload/renderer and `@blue/engine-client`; React 19.x; Node.js 22 through Electron 35.7.5

**Primary Dependencies**: Runtime-loaded Csound 7 host API; existing CMake 3.21+, ZeroMQ/libzmq, `@blue/engine-client`, Electron `child_process`/IPC, React settings components, and Vitest 4.x; no new third-party dependency

**Storage**: Main-owned `program-settings.json` advances to version 3 with `appSpecific.csoundLibraryPath`; existing realtime module/device identifiers remain durable settings; legacy `csoundExecutable` and `renderMethod` fields are retained but inactive; all discovery reports, execution state, messages, and capabilities are transient; `.blue` XML is unchanged

**Testing**: CTest C++ unit and Csound-backed integration coverage; Vitest for strict decoders, engine process orchestration, program-settings migration, IPC/preload contracts, render/freeze/SoundFont adapters, and React settings behavior; focused live Csound 7 quickstart validation on available platforms

**Target Platform**: macOS arm64, Windows x64, and Linux x64, preserving the existing bundled-engine platform matrix

**Project Type**: Electron desktop application with a separately spawned native C++ engine sidecar in a pnpm monorepo

**Performance Goals**: Engine/runtime probe and ordinary selected-module discovery complete within 3 seconds; cancellation terminates the owned one-shot process within 2 seconds; execution output is streamed without waiting for process completion; realtime request handling is never blocked by offline work

**Constraints**: Electron main exclusively owns files, processes, engine selection, runtime discovery, and cancellation; the renderer receives no generic execution primitive; the realtime/Blue Live ZMQ protocol remains unchanged; Csound stays runtime-loaded and optional at application startup; stdout for discovery is exactly one JSON document; Csound messages cannot corrupt JSON; process arguments bypass a shell; native filesystem paths remain native except when embedded in generated Csound source; incomplete artifacts never become successful results

**Scale/Scope**: Three additive engine capabilities, one selected audio module and one selected MIDI module per query, four device directions, one main runtime service, one discovery IPC surface, three migrated offline callers, three supported desktop targets, and four user stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate

- **Portable data core — PASS**: No `@blue/data` change is required. Csound ABI definitions stay native; Node process/filesystem work stays in Electron main; typed serializable contracts live in `@blue/engine-client` and `@blue/app` shared code with static imports only.
- **Java and project compatibility — PASS**: Java references are `DriverUtilities`, `RealtimeRenderSettingsPanel`, `CS6DiskRendererService`, and the API/command-line render factories. Disk, freeze, and SoundFont results remain compatible and `.blue`/CSD generation is unchanged. Two intentional divergences are explicit: direct runtime enumeration replaces Java's error-parsing/platform fallbacks, and Blue Engine/Csound API becomes the sole method instead of an API-versus-command-line selector.
- **Canonical ownership and contracts — PASS**: Electron main owns engine/Csound selection, child lifecycle, discovery, execution, output, and cancellation. `program-settings.json` owns the optional Csound library override and saved module/device identifiers. Renderer state is transient. The CLI, IPC, shared decoder, and execution adapter contracts define validation and recovery.
- **Runtime and engine isolation — PASS**: New work runs as one-shot Blue Engine processes. The existing realtime/Blue Live ZeroMQ processes remain independent; no blocking execution command is added to the single-request ZMQ loop. Renderer and data layers never load Csound or spawn processes.
- **Verification evidence — PASS**: The design requires fake-ABI native unit tests, installed-Csound integration tests, strict JSON/IPC decoder tests, settings version/migration tests, adapter regressions for all three migrated callers, cancellation/concurrency/path tests, and affected package test/lint/build commands plus the quickstart.

### Post-Design Re-check

- **Portable data core — PASS**: [blue-engine-runtime-cli.md](contracts/blue-engine-runtime-cli.md) and [main-runtime-contract.md](contracts/main-runtime-contract.md) place all native/host behavior outside `@blue/data`; [csound-runtime-ipc.md](contracts/csound-runtime-ipc.md) exposes serializable discovery data only.
- **Java and project compatibility — PASS**: [research.md](research.md) records the Java behavior and approved divergences. [quickstart.md](quickstart.md) verifies existing disk render, freeze, and SoundFont outputs while direct executable settings are absent.
- **Canonical ownership and contracts — PASS**: [data-model.md](data-model.md) assigns owner, lifetime, validation, and transitions for every entity. Settings migration preserves legacy values and adds only an app-wide Csound library preference.
- **Runtime and engine isolation — PASS**: CLI execution is one process per operation, capability-gated through the resolved engine. Generic utility/performance execution is not exposed through preload; renderer access is limited to the validated I/O query.
- **Verification evidence — PASS**: Contracts define empty-versus-error discovery, feature negotiation, exact argument boundaries, message routing, bounded accumulation, cancellation races, Windows path preservation, and non-overlap with realtime sessions. Quickstart includes native, app, integration, and repository gates.

No constitution violations require an exception.

## Project Structure

### Documentation (this feature)

```text
specs/071-csound-runtime-services/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── blue-engine-runtime-cli.md
│   ├── csound-runtime-ipc.md
│   └── main-runtime-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
native/blue-engine/
├── CMakeLists.txt
├── src/
│   ├── main.cpp
│   ├── csound/
│   │   ├── CsoundTypes.h
│   │   ├── CsoundLoader.h
│   │   ├── CsoundLoader.cpp
│   │   ├── CsoundRuntimeServices.h       # new deep native runtime module
│   │   └── CsoundRuntimeServices.cpp     # new
│   └── protocol/
│       ├── Capabilities.h
│       └── Capabilities.cpp
└── tests/cpp/
    ├── CMakeLists.txt
    ├── test_csound_probe.cpp
    ├── test_engine_capabilities.cpp
    ├── test_csound_runtime_services.cpp  # new fake-ABI unit coverage
    └── test_csound_integration.cpp       # installed-Csound coverage

packages/blue-engine-client/
├── src/capabilities.ts
└── tests/capabilities.test.ts

packages/blue-app/src/
├── shared/
│   ├── csound-runtime.ts                 # new contracts, normalizers, decoders
│   ├── csound-runtime.test.ts            # new
│   ├── engine-runtime.ts
│   ├── engine-runtime.test.ts
│   ├── program-settings.ts
│   ├── program-settings.test.ts
│   └── settings-window.ts                 # close-resolution contract
├── main/
│   ├── engine-runtime.ts                 # deepen resolved one-shot runtime seam
│   ├── engine-runtime.test.ts
│   ├── engine-runtime-ipc.test.ts
│   ├── csound-runtime-boundary.test.ts
│   ├── csound-runtime-isolation.test.ts
│   ├── disk-render-command.ts
│   ├── disk-render-command.test.ts
│   ├── render-to-disk.ts
│   ├── render-to-disk.test.ts
│   ├── freeze-score-objects.ts
│   ├── freeze-score-objects.test.ts
│   ├── soundfont-viewer.ts
│   ├── soundfont-viewer.test.ts
│   ├── program-settings-store.ts
│   ├── program-settings-store.test.ts
│   ├── program-settings-usage.ts
│   ├── program-settings-usage.test.ts
│   ├── settings-window.ts                # native close interception
│   ├── settings-window.test.ts
│   └── main.ts
├── preload/
│   ├── preload.ts
│   └── csound-runtime-api.test.ts
└── renderer/
    ├── components/settings/
    │   ├── RealtimeRenderSettings.tsx
    │   ├── DiskRenderSettings.tsx
    │   ├── UtilitySettings.tsx
    │   └── RuntimeDeviceField.tsx        # new editable discovered/custom field
    ├── components/floating-position-utils.ts # shared popup viewport positioning
    ├── tests/engine-runtime-settings.test.tsx
    ├── tests/floating-position-utils.test.ts
    ├── tests/settings-window.test.tsx
    └── types/global.d.ts
```

**Structure Decision**: Extend the existing native loader with one cohesive `CsoundRuntimeServices` module instead of placing one-off Csound calls in `main.cpp`. Keep additive feature names in the established engine capabilities contract. Deepen the existing Electron `EngineRuntimeService`—the module that already resolves and probes the bundled or overridden engine—rather than adding parallel resolvers. Put only serializable request/result validation in `src/shared/csound-runtime.ts`; keep process handles, abort controllers, output callbacks, paths, and filesystem behavior in Electron main. Reuse the established render/freeze/SoundFont injected seams after removing the executable parameter so existing focused tests remain useful.

## Design Decisions

### Native Csound Host Surface

- Correct the local `csoundReset` ABI declaration from `int` to `void` before adding symbols.
- Extend the runtime-loaded function table with module enumeration/selection, audio and MIDI device list calls, `csoundCompile`, utility enumeration/execution, message-buffer calls, and the existing start/perform/reset lifecycle. The loader continues to compile without Csound headers or a link-time Csound dependency.
- Put query/utility/performance lifecycle rules and JSON serialization in `CsoundRuntimeServices`, supplied through an injectable function table for no-Csound unit tests.
- Capture Csound messages with its message buffer. JSON modes suppress direct Csound output, emit exactly one JSON object to stdout, and route human diagnostics to stderr. Execution modes drain messages to stderr so existing output/progress consumers remain compatible.

### One-Shot CLI and Capability Negotiation

- Add `csound-io-v1`, `csound-utility-v1`, and `csound-performance-v1` feature strings to the existing capabilities document. Define shared string constants in `@blue/engine-client` and preserve unknown features.
- Keep `BLUE_ENGINE_PROTOCOL_VERSION` at 1 because no ZeroMQ command or framing changes. Older external engines remain protocol-compatible for realtime but fail new calls through explicit missing-feature diagnostics.
- Add `--list-io --json`, `--run-utility`, and `--run-csound` modes with an optional absolute `--csound-library` before an exact `--` argument boundary. These modes do not bind ZeroMQ or shared memory.
- Implement utility execution with `csoundRunUtility`; `-U` remains Csound's command-line spelling and is not synthesized internally. Implement general performance execution with `csoundCompile`, `csoundStart`, the ksmps loop, and `csoundReset`.

### Device Discovery

- Enumerate modules with their exact Csound names and `audio`/`midi` type. Apply only the requested audio and MIDI module before querying devices.
- Use the documented count-then-fill calls for audio input/output and MIDI input/output. A count of zero is success; a negative count is an error. Preserve exact 128-byte Csound fields after safe NUL termination and UTF-8 serialization.
- Do not query every module because backends such as JACK may attempt connections and emit warnings. Settings loads modules and devices for the current audio and MIDI selections on page load, refreshes only the affected device list when a module selection changes, and exposes a manual refresh for hardware changes.
- Format known module identifiers with source-derived friendly labels such as `CoreAudio (auhal)`, `PortAudio - Blocking (pa_bl)`, `PortAudio - Callback (pa_cb)`, `ALSA (alsa)`, `PulseAudio (pulse)`, `WASAPI (wasapi)`, and `CoreMIDI (coremidi)`. Keep the exact identifier in the option value and show unknown discovered names unchanged.
- Seed new settings from Csound's own platform defaults (`auhal` on macOS, `alsa` on Linux, `PortAudio` on Windows; `portmidi` for MIDI except Linux `alsa`) and order the selected value first before the remaining discovered modules.
- Keep the current saved value available in every module/device control even when absent from the runtime result. A small editable `RuntimeDeviceField` uses discovered options without turning the device ID into a closed enum.

### Main-Owned Runtime Interface

- Add strict request/report decoders in `packages/blue-app/src/shared/csound-runtime.ts` and reuse the existing `EngineSelection`, compatibility report, and bounded diagnostic conventions.
- Extend `EngineRuntimeService` with `queryCsoundIo()` plus a discriminated `executeCsound()` request for `utility` or `performance`. Resolution, probe caching, feature checks, absolute library-path validation, engine spawning, and result mapping remain behind that module.
- Use `execFile` with a 3-second deadline and bounded buffers for JSON discovery. Use `spawn` with `shell: false`, an explicit `cwd`, streaming callbacks, a bounded retained diagnostic, and an `AbortSignal` for execution.
- Expose only `queryCsoundIo` over main/preload IPC. Utility and performance execution are internal main-process contracts used by trusted workflows; the renderer never receives an arbitrary command facility.

### Offline Caller Migration

- Remove `executable` from `DiskCommandPlan`, freeze command inputs, `RenderExecutionSeam`, `FreezeExecutionSeam`, and `SoundFontExecutionSeam`. These planners continue to own only Csound argument construction.
- Replace `createCsoundExecutionSeam` with an adapter over `EngineRuntimeService.executeCsound({ kind: 'performance' })`. An operation-owned `AbortController` replaces direct exposure of the child process to cancellation code.
- Migrate SoundFont inspection first because it is short-lived and has no output artifact, then freeze with artifact cleanup/validation, then disk render with progress and post-render actions. Preserve native `cwd` and argument paths; normalize only file paths embedded inside the generated SoundFont probe CSD.
- Retain the existing single render/freeze operation policy. This feature does not prohibit an independent SoundFont inspection or realtime/Blue Live process, but cancellation identities cannot cross sessions.

### Settings and Migration

- Advance `PROGRAM_SETTINGS_VERSION` to 3 and add normalized `appSpecific.csoundLibraryPath`, defaulting to an empty auto-detect value. The existing engine path and the new Csound library path feed every probe, discovery, and execution request.
- Retain legacy `utility.csoundExecutable`, `realtimeRender.csoundExecutable`, `diskRender.csoundExecutable`, and both `renderMethod` values in the saved snapshot for downgrade safety, but hide executable fields from the active UI and mark these usage-matrix entries `app-specific-retained`.
- Replace static driver choices with runtime results. Seed fresh settings from the platform default, put the selected value first, retain a saved value when it is unavailable, and keep every module/device identifier editable. Apply friendly labels only at render time; exact Csound module identifiers remain canonical.
- Do not add a render-method control. The accepted intentional divergence is one engine-owned Csound API method.
- Intercept native Settings-window close requests in the main process and ask the renderer to resolve dirty drafts. Show a native unsaved-settings confirmation with `Yes`, `No`, and `Cancel`; apply before closing for `Yes`, discard for `No`, and leave the window open for `Cancel` or a failed apply.

### Verification Strategy

- Native fake-function-table tests cover module enumeration termination, count/fill devices, zero versus negative counts, struct serialization, unknown modules/utilities, message draining, lifecycle cleanup, JSON escaping, and the corrected `csoundReset` signature.
- Installed-Csound integration uses `sndinfo` with `examples/techniques/hellorcb.aif`, a minimal null-audio CSD performance, and schema-only device checks that never assume hardware exists.
- TypeScript tests cover invalid JSON, capability gating, timeout, absolute path validation, exact argument arrays including synthetic Windows paths, bounded output, abort races, retry, and independent concurrent sessions.
- Existing disk render, freeze, and SoundFont tests assert no executable parameter remains and preserve flags, progress, parsing, cleanup, artifact validation, and errors. Settings tests cover version-2 migration, unavailable saved choices, selected-only automatic refreshes, manual rescans, empty device lists, user diagnostics, and the native close confirmation's Yes/No/Cancel paths.

## Implementation Closeout

- All tasks T001–T065 are complete.
- The cross-artifact review found no uncovered functional or success criterion, constitution conflict, or unresolved implementation blocker.
- Validation passed with the full workspace test suite, native Csound integration tests, lint, build, verify, and whitespace checks. Detailed command evidence and the host-dependent hardware note are recorded in [quickstart.md](quickstart.md).

## Complexity Tracking

No constitution violations or exception-bearing complexity are planned.
