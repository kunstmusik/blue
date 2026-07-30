# Contract: Native Build and Packaged Engine Artifact

## Workspace Build Contract

The private package is `@blue/engine-native` at `native/blue-engine/package.json`.

Required scripts:

| Script | Contract |
|---|---|
| `build` | Configure the current supported target with CMake/vcpkg, build Release, and produce `dist/<platform>-<arch>` |
| `test` | Build test targets and run CTest with failure output |
| `test:profiling` | Build/test with performance tracking enabled and verify the default build compiles the profiler out |
| `verify` | Validate manifest, hash, executable architecture, protocol metadata, and dependency closure |
| `lint` | Validate CMake/vcpkg/package metadata and any adopted C++ formatting checks |
| `clean` | Remove only package-owned build, install, stage, and generated `dist` paths |

`pnpm -r run build` MUST order `@blue/engine-native` before `@blue/app`. The app has a workspace development/build dependency on the native package but no JavaScript import.

## vcpkg Contract

- `native/blue-engine/vcpkg.json` declares ZeroMQ and records a 40-character `builtin-baseline`.
- `native/blue-engine/vcpkg-configuration.json` records the default registry and any overlay triplet location.
- CMake is configured with the vcpkg toolchain and explicit target triplet before `project()`.
- CI uses a pinned vcpkg checkout/cache. Local builds automatically bootstrap
  the same baseline into an ignored package-local checkout when `VCPKG_ROOT`
  is not set.
- CMake fails if it cannot select a static ZeroMQ target.
- Windows uses `x64-windows-static-md` or a source-controlled equivalent; macOS/Linux use explicit static-library triplets.

## Derived Artifact Layout

```text
native/blue-engine/dist/<platform>-<arch>/
├── blue-engine[.exe]
└── artifact.json
```

`artifact.json` follows [data-model.md](../data-model.md). The build wrapper computes its checksum only after the executable is final.

Release packaging rejects:

- missing executable or manifest
- manifest/hash mismatch
- wrong platform or architecture
- non-Release build
- protocol mismatch
- uncommitted/different source revision in CI
- unexpected shared dependency
- missing Unix execute permission

## Dependency Closure Policy

Allowed external classes:

- macOS system libraries/frameworks
- Windows system libraries and the declared Microsoft runtime model
- Linux glibc, loader, and explicitly documented baseline system libraries
- runtime-loaded Csound, which SHOULD NOT appear as a load-time dependency

Disallowed external dependencies include libzmq, libsodium, and any dependency supplied only by the developer's package manager.

Platform inspectors:

- macOS: `file`, `otool -L`, code-signature inspection when signing is enabled
- Windows: PE architecture/import-table inspection
- Linux: `file`, `readelf -d`, `ldd`, and required glibc symbol-version inspection

## Electron Staging Contract

Before electron-builder runs:

1. Determine the target platform/architecture from the package command.
2. Run native artifact verification.
3. Replace only `packages/blue-app/.engine-stage`.
4. Copy exactly one executable and its manifest.
5. Invoke electron-builder.

Installed layout:

```text
resources/
└── assets/
    └── engine/
        ├── blue-engine[.exe]
        └── artifact.json
```

The stage directory and all native build outputs are ignored and removable by the root clean script.

## AppImage Contract

`packages/blue-app/electron-builder.yml` sets:

```yaml
toolsets:
  appimage: "1.0.3"
```

This selects electron-builder's modern static AppImage runtime and removes the legacy FUSE 2 dependency. The Linux engine is built on the declared oldest glibc baseline. CI validates startup/resource discovery on Debian-, Arch-, and Fedora-family images and records the engine's required glibc symbol floor.

## macOS Nested Executable Contract

The engine path under `Contents/Resources/assets/engine/blue-engine` is registered as an additional binary and signed before the outer application. A per-file/custom signing hook applies `entitlements.blue-engine.mac.plist` only to that executable; Electron helpers and renderers retain their existing narrower entitlements. Final validation verifies both the nested and outer signatures plus the helper entitlement in the signed/notarized shape. Unsigned PR artifacts still verify layout, architecture, and dependency closure.
