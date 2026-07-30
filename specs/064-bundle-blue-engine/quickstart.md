# Quickstart: Bundled Blue Engine Integration

This guide defines the end-to-end validation path for the completed feature 064. The commands are runnable from the feature branch with the listed prerequisites.

## Prerequisites

- Node.js 22
- pnpm 10
- CMake 3.21 or newer
- C/C++ toolchain for the host
- Network access on the first native build so the committed vcpkg baseline can
  be bootstrapped automatically. An existing checkout may instead be selected
  with `VCPKG_ROOT`.
- Optional Csound 7 installation for ready/playback scenarios
- Java 17 for the existing Blue application build

Platform tools:

- macOS: Xcode command-line tools, `otool`, `codesign`
- Windows: Visual Studio 2022 Build Tools and a PE import inspector
- Linux: compiler compatible with the documented glibc baseline, `readelf`, `ldd`, Xvfb

## 1. Install and Build From the Root

```bash
pnpm install --frozen-lockfile
pnpm build
```

Expected:

- `@blue/engine-native` builds before `@blue/app`.
- `native/blue-engine/dist/<platform>-<arch>/blue-engine[.exe]` exists.
- The adjacent `artifact.json` matches the executable hash, platform, architecture, source revision, vcpkg baseline, and protocol version.

## 2. Run the Development Application Without a System Engine

Ensure no `blue-engine` executable is installed in `/usr/local/bin` or otherwise available on `PATH`, then run:

```bash
pnpm --filter @blue/app run dev
```

Expected:

- The development application starts without a separately installed Blue Engine.
- Engine discovery selects the verified artifact under `native/blue-engine/dist/<platform>-<arch>`.
- No resolver attempt uses `/usr/local/bin` or an executable-search-path fallback.
- If Csound is absent, project startup, editing, and saving still work; the first engine-backed operation reports the structured Csound diagnostic.

## 3. Run Native and Protocol Tests

```bash
pnpm --filter @blue/engine-native test
pnpm --filter @blue/engine-native test:profiling
pnpm --filter @blue/engine-client test
pnpm --filter @blue/app test
```

Expected:

- C++ unit tests pass without requiring Csound unless marked as Csound integration tests.
- Default and performance-tracking native builds both compile and pass their applicable tests; the default binary contains no profiler output path.
- Probe decoder and capability mismatch tests pass.
- Main-process resolver, timeout, settings, and process-isolation tests pass.

## 4. Verify Static Native Dependencies

```bash
pnpm --filter @blue/engine-native verify
```

Expected:

- No load-time dependency on Csound.
- No shared libzmq or libsodium dependency.
- Only the platform allowlist from [engine-artifact-contract.md](contracts/engine-artifact-contract.md) remains.

## 5. Probe Without Csound

Run with an intentionally absent override:

```bash
LIBCSOUND_PATH=/path/that/does/not/exist native/blue-engine/dist/<platform>-<arch>/blue-engine --probe-csound --json
```

Expected:

- Exit code `2`.
- One valid JSON report with engine protocol/build metadata.
- `ready` is `false`.
- `csound.status` is a structured failure.
- No ZeroMQ port, shared memory, or performance is created.

Blue itself must still open, create, edit, and save `fixtures/smoke-test.blue`.

## 6. Probe and Render With Csound 7

```bash
native/blue-engine/dist/<platform>-<arch>/blue-engine --probe-csound --json
```

Expected:

- Exit code `0`.
- `protocolVersion` matches `@blue/engine-client`.
- `csound.status` is `ready`, major version is `7`, and the loaded path is reported.

Then run the native Csound integration test selected by CTest:

```bash
pnpm --filter @blue/engine-native test:integration
```

Expected: a minimal null-audio render completes without opening an audio device.

## 7. Package and Inspect the Application

```bash
pnpm --filter @blue/app package:dir
pnpm --filter @blue/app verify:packaged-app -- --no-playwright
```

Expected:

- Packaging stages exactly one current-platform engine.
- The installed resource path contains `assets/engine/blue-engine[.exe]` and `artifact.json`.
- The packaged app starts and opens/saves the smoke project without Csound.
- When Csound 7 is available, the settings probe and a minimal playback/render smoke succeed.

## 8. Verify Override and Protocol Rejection

In Realtime Render settings:

1. Leave engine path at the bundled default and run “Check Engine and Csound”.
2. Select a matching external engine and repeat.
3. Select a fixture engine with a deliberately different protocol version.

Expected:

- The bundled resource is selected by default.
- The matching explicit override is identified as an override.
- The mismatched engine is rejected before `CREATE_ENGINE` or playback.
- Reset returns selection to bundled.

## 9. Verify Concurrent Sessions

Start realtime playback, then start Blue Live using a compatible project.

Expected:

- Two distinct engine processes, endpoints, shared-memory names, and process-registry records are used.
- POSIX shared-memory names, including the leading slash, remain within
  macOS's 31-character limit.
- Stopping either session does not terminate or corrupt the other.
- Application shutdown removes both processes and registry records.

## 10. Linux AppImage Matrix

CI is authoritative for the distribution matrix:

- Debian-family image at the declared glibc baseline
- current Arch/Manjaro-family image
- current Fedora/RHEL-family image

For each environment:

```bash
chmod +x Blue-*.AppImage
./Blue-*.AppImage
```

Expected:

- No `libfuse.so.2` dependency or FUSE 2 installation is required.
- Blue opens and finds the bundled engine.
- The no-Csound startup/open/save test passes.
- With Csound 7 installed, the probe and minimal render pass.

If container restrictions prevent direct mounting, also validate the supported extraction path:

```bash
./Blue-*.AppImage --appimage-extract
./squashfs-root/AppRun
```

## 11. Final Repository Validation

```bash
pnpm test
pnpm lint
pnpm build
pnpm verify
pnpm verify:package-inputs
```

Feature closeout requires dependency-closure evidence for all three platforms. A
future signed release additionally requires signed/notarized macOS helper
validation when signing is enabled.

## Validation Evidence — 2026-07-28 through 2026-07-30 UTC

Local host: macOS arm64, feature branch `064-bundle-blue-engine`. The imported engine checkpoint is
`6d59daa180cd6474d4fe181918539695d5512101`.

| Scenario | Result |
| --- | --- |
| Frozen workspace install/lockfile | Passed; seven workspace projects resolved from `pnpm-lock.yaml` |
| Root topological `pnpm build` | Passed; `@blue/engine-native` completed before `@blue/app`, which staged the verified artifact |
| First build without `VCPKG_ROOT` | Passed; `env -u VCPKG_ROOT pnpm build` bootstrapped the committed vcpkg revision into `native/blue-engine/.vcpkg/`; a second build reused it without another download |
| No-system-engine development command | Passed with `/usr/local/bin/blue-engine` absent; `pnpm --filter @blue/app run dev` built/staged the workspace engine, started Vite, built main/preload, and launched Electron |
| Native no-Csound unit suite | Passed: 11 Node metadata/dependency/bootstrap tests and 8 CTest unit/protocol tests |
| Performance-tracking suite | Passed; tracking build tests passed and the ordinary debug executable contained no profiler output markers |
| Csound integration | Passed with Csound 7.0: channel/shared-memory integration and the null-audio render test |
| macOS shared-memory boundary | Passed; the UUID-length regression reproduced at 64 characters including the POSIX slash, the compact maximum-PID name test stays at or below 31, and the native process created `/be-r-nqj-0123456789abcdef` and reached ready state |
| Probe without Csound | Passed using an absolute nonexistent Csound path: exit 2, structured `load-failed`, protocol 1, no runtime services started |
| Probe with Csound | Passed: Csound 7.0 loaded from `/Library/Frameworks/CsoundLib64.framework/CsoundLib64` |
| Static dependency inspection | Passed; the macOS arm64 engine links only `/usr/lib/libc++.1.dylib` and `/usr/lib/libSystem.B.dylib`—no Csound, ZeroMQ, or libsodium load-time dependency |
| Unpacked application package | Passed; installed resources contain exactly `blue-engine` and `artifact.json`, with matching arm64/hash/protocol metadata |
| Packaged no-Csound smoke | Passed; the installed engine reported an intentionally missing Csound library recoverably |
| Packaged project safety | Passed; `fixtures/smoke-test.blue` opened and serialized/reloaded at an isolated save path without Csound |
| Incompatible engine safety | Passed; protocol-99 fixture rejected before playback while the project remained open |
| Client/application tests | Passed: engine-client 32 tests; complete application suite 2,270 passed and 2 pre-existing skips |
| Repository gates | Passed: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm verify`, package preflight, release workflow/manifest validation, and `git diff --check` |
| Hosted platform matrix | Passed on commit `0627b172eb0962b9455c2c61a7cb0c2030d25df7`: macOS arm64, Windows x64, and Linux x64 built, tested, inspected, packaged, and passed the installed no-Csound/project smoke |
| Hosted AppImage matrix | Passed for the same Linux AppImage on Debian Bookworm, Arch Linux, and Fedora 41, including direct and extracted `AppRun` without FUSE 2 |

Hosted closeout evidence:

- [PR run 30510157369](https://github.com/kunstmusik/blue-electron-poc/actions/runs/30510157369)
  passed the macOS arm64, Windows x64, and Linux x64 jobs. Each job used the
  root build graph, native architecture/dependency inspection, full workspace
  tests and lint, platform packaging, and packaged no-Csound/project
  verification.
- [AppImage Compatibility run 30510157344](https://github.com/kunstmusik/blue-electron-poc/actions/runs/30510157344)
  built one Ubuntu 22.04/glibc-2.35 AppImage and passed that same artifact on
  Debian Bookworm, Arch Linux, and Fedora 41. The verifier rejected legacy FUSE
  2 dependence, located the bundled engine, and exercised direct and extracted
  `AppRun`.
- Actual Csound 7 null-audio integration passed on macOS arm64. Cross-platform
  loader candidate, version, and failure behavior is covered by native tests;
  clean-machine Windows and Linux playback remains a release-candidate manual
  gate.
- This local package is intentionally unsigned. The nested-engine shape was
  verified, and the signing hook applies
  `entitlements.blue-engine.mac.plist` only when
  `BLUE_MAC_SIGN_IDENTITY` is configured; signed/notarized evidence remains a
  release-credential-gated check.
