# Research: Bundled Blue Engine Integration

**Feature**: `064-bundle-blue-engine`
**Date**: 2026-07-28
**Outcome**: Adopted and implemented; hosted cross-platform evidence is recorded in [quickstart.md](quickstart.md).

## Executive Decision

Copy the clean Blue Engine checkpoint `6d59daa180cd6474d4fe181918539695d5512101` into `native/blue-engine` as ordinary tracked monorepo source. Do not use a Git submodule, preserve the separate repository history, or make application packaging download a standalone engine release.

Add a private pnpm workspace wrapper for the native source and use a pinned vcpkg manifest for its native dependencies. The root workspace build should build the engine before `@blue/app`, and the packaging workflow should stage and verify the resulting executable. Statically link third-party build dependencies such as ZeroMQ. Keep Csound deliberately external and load it at runtime so Blue can still open and edit projects without Csound installed.

## Findings

### Current Engine/Csound Relationship

- Blue Engine does not require Csound headers to compile; it declares the required ABI types locally in `src/csound/CsoundTypes.h`.
- `src/csound/CsoundLoader.cpp` uses `dlopen` on macOS/Linux and `LoadLibrary` on Windows, resolves the Csound API symbols at runtime, and reports a load failure rather than making Csound a link-time dependency.
- The inspected macOS arm64 engine executable did not contain a Csound load command. `otool -L` reported only macOS system frameworks/libraries, while the link command included static `libzmq.a` and `libsodium.a`.
- Default and performance-tracking builds both passed all seven CTest cases, including the Csound-backed channel bridge integration test. The automation-shrink regression also passed with AddressSanitizer and performance tracking enabled.
- The current loader still needs production hardening:
  - Linux searches too few installation locations and only an unversioned `libcsound64.so` name.
  - It does not validate a supported Csound version before using the API.
  - Several fallback paths are Csound 6-specific even though current testing uses Csound 7.
  - Windows needs deterministic library search behavior.
  - The app needs a non-performance compatibility probe with structured output.

### Current Blue Electron Integration

- `EngineBridge` and Blue Live already launch Blue Engine as an external process in the Electron main process and communicate over ZeroMQ.
- The current resolver checks a small set of relative Unix-style candidates. It neither robustly resolves a packaged Windows executable nor searches the user's executable path.
- The existing engine path setting is not consistently passed into every `EngineBridge` or Blue Live construction path.
- Keeping the process boundary is desirable. It isolates native crashes and concurrent engine sessions and follows the repository constitution's external-runtime ownership rule.

### Current Separate-Repository Release Risks

- The separate repository does not currently provide a dependable artifact contract for the application: no published release/tag flow was found, Linux is absent, and the macOS jobs do not demonstrate distinct architecture configuration.
- The Windows workflow uses a dynamic vcpkg triplet but archives only the executable, which risks omitting required DLLs.
- A runtime GitHub download would add network availability, checksum/signature, cache invalidation, offline install, updater coordination, and engine/client version-selection problems.
- These costs provide little benefit when engine and application changes are expected to land synchronously.

### Selected Import Checkpoint

The separate source repository was cleaned and committed before this plan was finalized:

| Item | Selected value |
|---|---|
| Repository | `/Users/stevenyi/work/csound/blue-engine` |
| Branch | `main` |
| Upstream base | `3c8d78f4c5781b14ab6b6c328aab0e59c1be3f8a` |
| Import checkpoint | `6d59daa180cd6474d4fe181918539695d5512101` |
| Working-tree state | Clean; no tracked modifications or untracked files |
| Checkpoint commit 1 | `2cc55d7f4c07bf5628bc683a722698b9f365617f` — perform-thread priority elevation |
| Checkpoint commit 2 | `6d59daa180cd6474d4fe181918539695d5512101` — optional bounded performance tracking and automation regression |

The monorepo import will copy the files at the selected checkpoint without copying `.git`. `native/blue-engine/IMPORT.md` will retain the source repository, checkpoint SHA, upstream base, import date, exclusions, and validation evidence. If the separate repository diverges before implementation, the import must stop until the intended checkpoint is explicitly updated here.

## Decisions

### 1. Source Layout and Migration

**Decision**: Import into `native/blue-engine`.

The implementation should copy source from the selected clean checkpoint above and exclude:

- `.git`
- CMake build directories and compiled binaries
- vcpkg downloads, installed trees, and caches
- editor metadata and unrelated local files
- generated test output

Before copying, verify that the source repository still resolves to the selected checkpoint and remains clean. The monorepo import begins with one normal commit; history remains available in the old repository if needed for archaeology.

**Rejected alternatives**:

- **Git submodule**: adds clone/init/update failure modes, detached revisions, two-review coordination, and a second release boundary without providing value for synchronous development.
- **Git subtree/history import**: preserves history but adds migration noise the user does not need.
- **Download from GitHub release**: useful only if the engine has an independent compatibility/release lifecycle; it currently does not and would make offline and reproducible builds harder.

### 2. pnpm Workspace Wrapper

**Decision**: Add `native/blue-engine/package.json` as a private workspace orchestration package named `@blue/engine-native`, and add `native/*` to `pnpm-workspace.yaml`.

This package is useful even though the implementation is C++:

- The root already uses `pnpm -r run build`, `pnpm -r run test`, and `pnpm -r run lint`.
- A private package exposes native `build`, `test`, and validation scripts to those existing commands.
- `@blue/app` can declare `@blue/engine-native: workspace:*` as a development/build dependency, giving pnpm a topological edge so the native artifact is ready before app packaging consumes it.
- Native command differences stay behind cross-platform Node entry scripts rather than leaking shell-specific syntax into root scripts.

Recommended package behavior:

- `build`: select the supported CMake preset/triplet, configure, and build the release engine.
- `test`: build the test target if necessary and run CTest.
- `lint`: validate formatting/build metadata or remain a lightweight no-op until a C++ formatter is adopted.
- `verify`: check executable existence, architecture, protocol metadata, execute permission, and native dependency closure.
- `clean`: remove only the package-owned configured build directory.

The package is orchestration metadata, not a JavaScript runtime library. `@blue/app` must not import it in renderer or data code.

### 3. Native Dependency Management and Static Linking

**Decision**: Use vcpkg manifest mode, pinned by `builtin-baseline`, with the manifest stored beside Blue Engine source.

Initial manifest dependencies should include ZeroMQ and its required transitive dependencies. CI acquires and caches the pinned vcpkg revision explicitly. When `VCPKG_ROOT` is absent locally, the native package bootstraps that same revision into an ignored package-local checkout and reuses it on later builds; the build never floats against the registry head.

Use static third-party linkage:

| Target | Triplet approach | External runtime exceptions |
|---|---|---|
| macOS arm64 | `arm64-osx` with static library linkage asserted | macOS system libraries; runtime-loaded Csound |
| macOS x64 (future matrix entry) | `x64-osx` with static library linkage asserted | macOS system libraries; runtime-loaded Csound |
| Windows x64 | `x64-windows-static-md` or a source-controlled equivalent custom triplet | Microsoft runtime supplied/validated by the application installer; runtime-loaded Csound |
| Linux x64 | `x64-linux` or a source-controlled equivalent custom triplet with static libraries | glibc/system libraries; runtime-loaded Csound |

`x64-windows-static-md` is preferred over fully static CRT linkage: it statically includes vcpkg libraries while using the supported dynamic Microsoft runtime model. This still satisfies the feature's static-linking goal for distributable third-party engine dependencies. The release check, not the triplet name alone, is the authority: `otool`, `dumpbin`/equivalent, and `readelf`/`ldd` checks must reject unexpected dependencies.

Csound is the deliberate exception. Statically linking Csound would prevent Blue from opening independently, substantially enlarge and complicate the application distribution, and couple Blue to one Csound/plugin build.

### 4. Build and Packaging Flow

**Decision**: Build native artifacts inside the workspace, then stage them into the Electron package through an explicit packaging input.

Expected flow:

1. The root recursive build reaches `@blue/engine-native`.
2. The native wrapper configures CMake with vcpkg manifest mode and a supported platform preset.
3. Blue Engine is built and tested into a deterministic package-owned output directory.
4. Artifact verification records platform, architecture, protocol version, and dependency closure.
5. `@blue/app` packaging copies the verified executable into an application resources location.
6. The main-process resolver chooses the bundled artifact by default and an explicit configured external engine only when requested.
7. Packaged smoke tests start the actual installed application, not the unpackaged development tree.

Do not fall back to an arbitrary stale development binary when a release build is missing its expected engine; fail packaging instead.

Development startup follows the same ownership rule: `pnpm --filter @blue/app run dev` resolves the verified current-platform artifact under `native/blue-engine/dist` and does not consult `/usr/local/bin` or `PATH`. An absent workspace artifact produces a direct build instruction rather than silently selecting a system executable.

### 5. Csound Runtime Probe and Compatibility

**Decision**: Extend Blue Engine with a structured, side-effect-free compatibility probe and make the application consume it before or during first engine use.

The report should include:

- engine build/protocol version
- resolved Csound library path
- Csound version
- required-symbol readiness
- supported/unsupported status
- stable error code and human-readable detail

The loader should accept a deliberate override, then search documented platform locations and supported versioned library names. It should not silently accept an unsupported major version merely because symbols happened to resolve.

Blue startup must not require the probe to succeed. Probe failure affects engine-backed operations, not project editing.

### 6. Platform Packaging

#### macOS

- Package and sign the engine as a nested executable.
- Register the resource executable as an additional macOS binary and use per-file/custom signing configuration so only Blue Engine receives the library-validation exception needed to load a user-installed Csound library; do not broaden Electron helper or renderer entitlements.
- Test the signed/notarized artifact, since an unsigned development build does not exercise library-validation behavior.
- Build arm64 as required; retain a preset and packaging path that can add x64 without reorganizing the package.

#### Windows

- Bundle `blue-engine.exe` in a deterministic resources location.
- Use static vcpkg libraries so ZeroMQ/libsodium DLLs are not loose packaging requirements.
- Resolve Csound through safe explicit paths and supported installation locations rather than the process working directory.
- Validate the Microsoft runtime expectation on a clean Windows installation.

#### Linux/AppImage

- Build on an old-enough glibc baseline for the declared supported distributions; glibc remains a system dependency and cannot be made universally portable merely by using AppImage.
- Statically link libstdc++/libgcc only if toolchain and licensing validation support it; otherwise include/document the compatibility baseline and inspect the resulting closure.
- Configure modern AppImage runtime behavior that does not require FUSE 2 (electron-builder `toolsets.appimage` modern runtime setting).
- Test both direct AppImage execution and extraction fallback on Debian, Arch/Manjaro, and Fedora/RHEL-family containers or runners.
- Search supported versioned Csound SONAMEs and common `/usr/lib64`/multiarch locations rather than assuming Debian paths.

An AppImage is distribution-neutral packaging, not an ABI time machine. Compatibility depends on the build baseline, dependency closure, kernel/runtime behavior, and the separately installed Csound ABI.

### 7. CI and Release Evidence

Required checks:

- native configure/build/test on macOS arm64, Windows x64, and Linux x64
- root workspace build proving the pnpm dependency edge
- protocol handshake match and deliberate mismatch tests
- engine dependency-closure checks on all platforms
- packaged-app startup/edit/save test without Csound
- engine probe and minimal null-audio render with supported Csound
- packaged path resolution tests, including Windows executable suffix
- two simultaneous engine process test covering realtime and Blue Live isolation
- AppImage tests across the three Linux distribution families
- signed macOS helper/runtime-loading smoke test before final notarized release

## Implementation Sequencing Recommendation

1. Import reviewed source and add the private workspace wrapper.
2. Convert native dependencies to pinned vcpkg manifest mode and make static linkage checks pass.
3. Add engine protocol/build metadata and the Csound compatibility probe.
4. Make the Electron resolver and settings path deterministic for development and packaged use.
5. Add packaging staging/verification on macOS and Windows.
6. Add Linux build, modern AppImage runtime configuration, and cross-distribution testing.
7. Complete signed/notarized macOS and clean-machine Windows release validation.

## Sources Consulted

### Local Source

- `~/work/csound/blue-engine/CMakeLists.txt`
- `~/work/csound/blue-engine/src/csound/CsoundLoader.cpp`
- `~/work/csound/blue-engine/src/csound/CsoundTypes.h`
- `~/work/csound/blue-engine/.github/workflows/`
- `~/work/csound/blue-engine` commits `2cc55d7f4c07bf5628bc683a722698b9f365617f` and `6d59daa180cd6474d4fe181918539695d5512101`
- `packages/blue-app/src/main/engine-bridge.ts`
- `packages/blue-app/src/main/blue-live.ts`
- `packages/blue-app/electron-builder.yml`
- `package.json`
- `pnpm-workspace.yaml`

### Primary Documentation

- [vcpkg manifest mode](https://learn.microsoft.com/vcpkg/consume/manifest-mode)
- [vcpkg triplet variables](https://learn.microsoft.com/vcpkg/users/triplets)
- [vcpkg Windows triplets and runtime linkage](https://learn.microsoft.com/vcpkg/users/platforms/windows)
- [pnpm recursive topological ordering](https://pnpm.io/cli/recursive)
- [pnpm workspace protocol](https://pnpm.io/workspaces)
- [electron-builder application contents](https://www.electron.build/contents.html)
- [electron-builder macOS extra-binary signing](https://www.electron.build/mac/)
- [electron-builder signing lifecycle and hooks](https://www.electron.build/docs/features/build-lifecycle/)
- [electron-builder AppImage options and modern static runtime](https://www.electron.build/appimage.html)
- [AppImage portability best practices](https://docs.appimage.org/reference/best-practices.html)
- [AppImage cross-distribution testing](https://docs.appimage.org/packaging-guide/testing.html)
- [Apple hardened runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- [GitHub release assets API](https://docs.github.com/rest/releases/assets)
