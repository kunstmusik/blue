# Implementation Plan: Bundled Blue Engine Integration

**Branch**: `064-bundle-blue-engine` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/064-bundle-blue-engine/spec.md`

## Summary

Import the reviewed clean `~/work/csound/blue-engine` checkpoint `6d59daa180cd6474d4fe181918539695d5512101` into `native/blue-engine` as ordinary monorepo source, wrap it as a private pnpm workspace package, and build its C++17 executable with CMake plus a pinned vcpkg manifest. The native artifact is staged and verified before Electron packaging, then resolved from application resources by the main process. ZeroMQ and other distributable native dependencies are statically linked; Csound 7 remains an external runtime-loaded library so Blue can start and edit projects without it.

The design adds a versioned engine capability handshake and a side-effect-free JSON Csound probe, keeps process and filesystem work in Electron main, retains an explicit external-engine override, and validates macOS arm64, Windows x64, and Linux x64 packages. Linux uses electron-builder's modern static AppImage runtime and an old-enough glibc build baseline, with AppImage smoke coverage across Debian-, Arch-, and Fedora-family environments.

## Technical Context

**Language/Version**: C++17 for Blue Engine; TypeScript 5.8.x strict mode for Electron/main/preload/renderer and `@blue/engine-client`; Node.js 22 and pnpm 10 for workspace orchestration

**Primary Dependencies**: CMake 3.21+; vcpkg manifest mode with a pinned `builtin-baseline`; ZeroMQ/libzmq and transitive libsodium statically linked; Csound 7 shared library loaded at runtime; Electron 35.7.5; electron-builder 26.x; Node `zeromq`; `@blue/engine-client`

**Storage**: Existing main-owned `program-settings.json` retains `appSpecific.enginePath` for an explicit override; engine selection and compatibility reports are transient; native artifact manifests are derived build outputs; `.blue` XML is unchanged

**Testing**: CTest for C++ unit/integration coverage; Vitest 4.x for protocol, resolver, IPC, settings, and packaging contracts; Playwright/plain-spawn packaged-application smoke checks; platform dependency inspection with `otool`, PE import inspection, and `readelf`/`ldd`; GitHub Actions platform and Linux-distribution matrices

**Target Platform**: macOS arm64, Windows x64, and Linux x64 AppImage/deb; architecture-neutral source/presets retain a path for future macOS x64

**Project Type**: Electron desktop application with a separately spawned native sidecar executable in a pnpm monorepo

**Performance Goals**: Compatibility probe returns within 3 seconds; Blue startup and project editing do not wait on or require Csound; realtime/Blue Live process behavior and audio-thread performance remain unchanged

**Constraints**: No engine, Csound, filesystem, or Node coupling in `@blue/data`; Electron main owns subprocesses and probing; Csound must not become a link-time or bundled dependency; all other distributable native engine dependencies must be static; imported performance tracking remains opt-in and fully compiled out of default builds; development startup must resolve the current workspace artifact without a system engine or `PATH` search; package builds fail closed for stale/missing/wrong-architecture artifacts; Linux output must honor the documented glibc baseline and run without FUSE 2

**Scale/Scope**: One native workspace package, one shared protocol package, one Electron application, three required release targets, four user stories, and concurrent realtime plus Blue Live engine processes

## Constitution Check

### Pre-Design Gate

- **Portable data core — PASS**: No change is planned in `@blue/data`. Native build, subprocess, filesystem, probing, and packaging work stays in `native/blue-engine`, `@blue/engine-client`, Electron main, and repository scripts.
- **Java and project compatibility — PASS**: This is packaging/runtime integration rather than Java parity. `.blue` XML, CSD generation, render semantics, and project snapshots remain unchanged; packaged startup/save smoke tests guard the compatibility boundary.
- **Canonical ownership and contracts — PASS**: Electron main owns engine selection, probing, subprocess lifecycle, and ZeroMQ. `program-settings.json` remains the only durable owner of the existing engine override. The capability/probe, artifact, and main/preload IPC contracts are typed and versioned; compatibility reports remain disposable runtime state.
- **Runtime and engine isolation — PASS**: Blue Engine remains a separately spawned process. ZeroMQ flows through `@blue/engine-client`; renderer access is limited to typed preload methods; Csound loading occurs only inside Blue Engine.
- **Verification evidence — PASS**: The design requires CTest success/failure coverage, engine-client protocol tests, main-process resolver/probe tests, packaged startup without Csound, supported-Csound integration, concurrent-process regression, dependency-closure inspection, root build validation, and platform package smoke tests.

### Post-Design Re-check

- **Portable data core — PASS**: [engine-probe-contract.md](contracts/engine-probe-contract.md) and [engine-selection-contract.md](contracts/engine-selection-contract.md) place all host-specific behavior outside `@blue/data`.
- **Java and project compatibility — PASS**: [quickstart.md](quickstart.md) includes startup/open/save validation without Csound and a supported-Csound playback smoke; no data model or contract writes runtime state to `.blue` XML.
- **Canonical ownership and contracts — PASS**: [data-model.md](data-model.md) names the owner and lifetime of every new entity. Artifact, probe, and selection contracts define validation and failure behavior, including legacy `enginePath: "blue-engine"` handling.
- **Runtime and engine isolation — PASS**: The version handshake is implemented in the C++ protocol and `@blue/engine-client`; main invokes the CLI probe and owns the executable path; the settings renderer only submits typed requests.
- **Verification evidence — PASS**: [engine-artifact-contract.md](contracts/engine-artifact-contract.md) defines release evidence and [quickstart.md](quickstart.md) provides deterministic local/package checks. CI remains the authority for cross-platform linkage, signing, and Linux-family evidence.

No constitution violations require an exception.

## Project Structure

### Documentation (this feature)

```text
specs/064-bundle-blue-engine/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── engine-artifact-contract.md
│   ├── engine-probe-contract.md
│   └── engine-selection-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
native/blue-engine/
├── package.json
├── CMakeLists.txt
├── CMakePresets.json
├── vcpkg.json
├── vcpkg-configuration.json
├── cmake/
├── scripts/
│   ├── build.mjs
│   ├── clean.mjs
│   ├── target.mjs
│   └── verify-artifact.mjs
├── src/
│   ├── automation/
│   ├── csound/
│   ├── engine/
│   ├── ipc/
│   └── protocol/
├── tests/cpp/
└── dist/                         # generated, ignored
    └── <platform>-<arch>/
        ├── blue-engine[.exe]
        └── artifact.json

packages/blue-engine-client/
├── src/
│   ├── protocol.ts
│   ├── capabilities.ts
│   ├── engine-client.ts
│   └── index.ts
└── tests/
    ├── protocol.test.ts
    ├── capabilities.test.ts
    └── engine-client.test.ts

packages/blue-app/
├── build/
│   ├── entitlements.mac.plist
│   └── entitlements.blue-engine.mac.plist
├── scripts/
│   ├── sign-blue-engine.mjs
│   ├── stage-blue-engine.mjs
│   └── verify-packaged-app.mjs
├── src/
│   ├── main/
│   │   ├── engine-bridge.ts
│   │   ├── engine-runtime.ts
│   │   ├── engine-runtime.test.ts
│   │   ├── blue-live-engine.ts
│   │   └── main.ts
│   ├── preload/preload.ts
│   ├── shared/
│   │   ├── engine-runtime.ts
│   │   ├── engine-runtime.test.ts
│   │   └── program-settings.ts
│   └── renderer/
│       ├── components/settings/RealtimeRenderSettings.tsx
│       ├── components/settings/SettingsApp.tsx
│       ├── tests/engine-runtime-settings.test.tsx
│       └── types/global.d.ts
├── .engine-stage/                # generated, ignored
├── electron-builder.yml
└── package.json

scripts/
├── verify-package-inputs.mjs
└── clean.mjs

.github/
├── actions/setup-blue-build/action.yml
└── workflows/
    ├── pr.yml
    └── release.yml
```

**Structure Decision**: The engine lives under `native/` rather than `packages/` to make the language boundary visible, while its private `package.json` and the `native/*` workspace glob integrate it into pnpm's build graph. `@blue/app` declares a workspace build dependency on `@blue/engine-native`, but never imports it at runtime. Generated native outputs stay in `native/blue-engine/dist`; a packaging script validates and stages exactly one platform artifact into the app's ignored `.engine-stage` directory.

## Design Decisions

### Native Workspace and Build Graph

- Add `native/*` to `pnpm-workspace.yaml`.
- Name the private package `@blue/engine-native` and expose `build`, `test`, `verify`, `lint`, and `clean` scripts through cross-platform Node entry points.
- Add `@blue/engine-native: workspace:*` to `@blue/app` development dependencies so `pnpm -r run build` orders the native build before the app.
- When `VCPKG_ROOT` is absent, bootstrap the committed vcpkg revision into the ignored package-local `.vcpkg/` checkout so a normal root build needs no manual vcpkg configuration; explicit cached checkouts remain supported for CI.
- Update the shared CI setup action to install/configure pinned vcpkg and use the root build graph rather than manually omitting the native package.
- Produce one deterministic `dist/<platform>-<arch>` artifact plus manifest. Build directories and vcpkg installation trees remain ignored.

### Static Dependency Policy

- Use vcpkg manifest mode with a committed `builtin-baseline`; record registry and optional overlay-triplet configuration in `vcpkg-configuration.json`.
- Use static-library triplets on macOS and Linux. Use `x64-windows-static-md` (or an equivalent committed overlay) on Windows so ZeroMQ/libsodium are static while the supported Microsoft runtime remains an explicit system/installer dependency.
- Make CMake fail when the static ZeroMQ target is unavailable; remove the current silent dynamic fallback.
- Treat Csound, operating-system frameworks/libraries, glibc, and the selected platform C/C++ runtime as the only allowed external dependency classes.

### Runtime Compatibility

- Add protocol version and engine capabilities to both C++ `Protocol.h` and `@blue/engine-client`.
- Add a `GET_CAPABILITIES` command immediately after connection; the client rejects a mismatched protocol before `CREATE_ENGINE`.
- Add `blue-engine --probe-csound --json` for a process-level check that does not bind sockets or start performance.
- Add `csoundGetVersion` to the runtime loader, support Csound 7 versioned library names/locations, return structured failure codes, and retain `LIBCSOUND_PATH` as the explicit Csound-library override.
- Require both the probe and live handshake: the probe produces actionable Csound diagnostics; the handshake proves the running process matches the client.
- Use compact per-session shared-memory identifiers that preserve realtime/Blue Live isolation while remaining within macOS's 31-character POSIX shared-memory-name limit.

### Application Resolution and Settings

- Introduce a pure resolver plus a main-owned `EngineRuntimeService` in `packages/blue-app/src/main/engine-runtime.ts`.
- Selection precedence is: explicit `BLUE_ENGINE_PATH` development override, non-sentinel `program-settings.json` `appSpecific.enginePath`, packaged resource, then monorepo development artifact.
- `pnpm --filter @blue/app run dev` depends on the current-platform workspace artifact and resolves it from `native/blue-engine/dist/<platform>-<arch>`; it never requires `/usr/local/bin/blue-engine` or another `PATH` entry.
- Preserve the existing `enginePath` field. Empty values and the legacy default `"blue-engine"` mean “use bundled”; an absolute path means explicit override. Invalid relative overrides are rejected without mutating settings.
- Pass one resolved selection into both realtime `EngineBridge` and `BlueLiveEngineSession`.
- Expose typed `engine-runtime:probe` IPC to the settings renderer. Probe results are transient and never enter program settings or project XML.

### Packaging and Release

- Stage only the verified current-platform artifact into `packages/blue-app/.engine-stage`, copy it to `resources/assets/engine/blue-engine[.exe]`, and fail packaging for absent/mismatched metadata.
- Extend package-input and packaged-app verification to inspect engine presence, execute permission, architecture, protocol version, and dependency closure.
- Configure `toolsets.appimage: "1.0.3"` so AppImage uses the modern static runtime without FUSE 2.
- Build Linux on the declared oldest supported glibc baseline and test the resulting AppImage on Debian-, Arch-, and Fedora-family environments.
- Register the macOS resource executable as an additional signed binary and add per-file/custom signing treatment so only Blue Engine receives the runtime-library-loading entitlement needed for user-installed Csound.
- Update release notes to remove the separate Blue Engine prerequisite while retaining Csound 7 as the audio runtime prerequisite.

## Complexity Tracking

No constitution violations or exception-bearing complexity are planned.
