# Feature Specification: Bundled Blue Engine Integration

**Feature Branch**: `064-bundle-blue-engine`
**Created**: 2026-07-28
**Status**: Feature implementation closed; cross-platform CI verified; release-candidate checks documented
**Input**: Bring the separately maintained Blue Engine source into the Blue Electron monorepo, build and package it with the application on macOS and Windows with Linux support, statically link its build-time native dependencies, and continue loading Csound at runtime so the application can open without Csound installed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install Blue Without a Separate Engine Setup (Priority: P1)

A musician installs Blue from a normal platform package and can open, inspect, and edit projects without separately finding or installing Blue Engine. When a supported Csound installation is available, playback and rendering use the engine bundled with that exact Blue release.

**Why this priority**: A release is incomplete if its core playback helper must be installed independently or can drift out of protocol compatibility with the application.

**Independent Test**: Install a release package on a clean supported system that has no standalone Blue Engine installation. Confirm that Blue opens and edits a project, finds its bundled engine, and can perform a minimal render after a supported Csound installation is made available.

**Acceptance Scenarios**:

1. **Given** Blue and a supported Csound installation are present on a clean supported system, **When** the user starts playback or rendering, **Then** Blue launches the engine bundled with that application release and completes the operation without a separate Blue Engine installation.
2. **Given** Blue is installed but Csound is absent, **When** the user opens or edits a project, **Then** the application remains usable and does not fail during startup.
3. **Given** Csound is absent or unsupported, **When** the user requests an engine-backed operation, **Then** Blue reports a specific, recoverable Csound diagnostic and preserves the open project and unsaved work.
4. **Given** no Blue Engine is installed on the system or available on `PATH`, **When** a contributor runs `pnpm --filter @blue/app run dev` after building the workspace engine, **Then** the development application resolves and can launch that workspace-built engine.

---

### User Story 2 - Build Engine and Application From One Revision (Priority: P1)

A contributor can change Blue Electron, the engine protocol, and Blue Engine in one branch. A documented root build produces a matching engine and application from the same checkout, and engine integration tests run as part of the repository workflow.

**Why this priority**: The engine and application are expected to evolve synchronously. Atomic changes and one build graph remove release drift and make protocol changes reviewable and testable together.

**Independent Test**: Start from a clean checkout with the documented platform prerequisites, run the root build, and verify that it builds the native engine before any application packaging step that consumes it.

**Acceptance Scenarios**:

1. **Given** a clean checkout with documented prerequisites, **When** a contributor runs the root workspace build, **Then** the native engine and the application build successfully without checking out another repository.
2. **Given** an engine protocol change and its client change in one branch, **When** repository tests run, **Then** the matching engine/client pair is exercised together and an incompatible pair is rejected with a useful error.
3. **Given** a release build for a supported platform, **When** packaging begins, **Then** packaging depends on the engine artifact produced by that build rather than an arbitrary executable already present on the machine.
4. **Given** the root workspace engine artifact exists and no system Blue Engine is installed, **When** `pnpm --filter @blue/app run dev` starts the development application, **Then** the application selects the current checkout's verified engine artifact without consulting `/usr/local/bin` or any other executable-search path.

---

### User Story 3 - Distribute Native Packages Across Platforms (Priority: P2)

A user receives a platform-correct Blue package for macOS, Windows, or Linux. The bundled engine contains its non-system build-time dependencies, while Csound remains an explicitly detected runtime requirement.

**Why this priority**: macOS and Windows are required release platforms, and Linux support should not be restricted to Debian-family distributions.

**Independent Test**: Build and install each supported package on a clean platform runner, inspect the bundled engine's native dependencies, and perform startup tests both without Csound and with a supported Csound installation.

**Acceptance Scenarios**:

1. **Given** a macOS or Windows release package, **When** it is installed on the matching architecture, **Then** it contains one runnable, platform-correct Blue Engine and does not require separate third-party engine libraries.
2. **Given** the Linux AppImage, **When** it is run on representative Debian, Arch/Manjaro, and Fedora/RHEL-family systems within the documented compatibility baseline, **Then** Blue opens and locates its bundled engine without requiring Debian package management.
3. **Given** a packaged engine on any supported platform, **When** its native dependency closure is inspected, **Then** only documented operating-system runtimes and the intentionally runtime-loaded Csound requirement remain external.

---

### User Story 4 - Diagnose or Override the Engine Safely (Priority: P3)

A developer or advanced user can inspect engine and Csound compatibility before playback and can explicitly select an external engine for development or recovery. Normal installed use continues to prefer the bundled engine.

**Why this priority**: Diagnostics make missing-library and version failures actionable, while an explicit override preserves development workflows without weakening the deterministic packaged default.

**Independent Test**: Run the engine compatibility probe with supported, missing, and incompatible Csound installations, then configure an external engine with both matching and mismatched protocol versions.

**Acceptance Scenarios**:

1. **Given** a supported Csound installation, **When** Blue probes engine compatibility, **Then** it reports the engine protocol, Csound path, Csound version, and readiness without starting a performance.
2. **Given** an incompatible external engine override, **When** Blue attempts to connect, **Then** it rejects the engine before project playback and explains the protocol mismatch.
3. **Given** no explicit override, **When** Blue resolves the engine path in an installed application, **Then** the bundled engine is selected without relying on the user's executable search path.

### Edge Cases

- The bundled engine is missing, lacks execute permission, is corrupt, or is built for a different architecture.
- Csound is absent, only a versioned shared-library filename is present, or it is installed in a platform-specific location not covered by a single hard-coded path.
- Csound can be loaded but is older than the supported version or lacks required API symbols.
- Csound is installed or its location changes while Blue is already running, and the user retries without restarting the application.
- Windows finds the engine executable but cannot resolve a native dependency or loads an unintended DLL from the working directory.
- A signed and hardened macOS package can launch the bundled helper but denies the intended external Csound library at runtime.
- A Linux system has no legacy FUSE 2 installation, uses a non-Debian package manager, or provides Csound under a versioned library name.
- A Linux distribution's C library is older than the one used to build the engine.
- Realtime playback and Blue Live launch separate engine processes concurrently.
- The separate Blue Engine repository diverges from the reviewed import checkpoint before the source copy begins.
- Native dependency acquisition is unavailable during a clean build, or a dependency registry changes upstream.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST contain the Blue Engine source as normal tracked monorepo source, without a Git submodule, nested Git repository, or required runtime download from a separate release.
- **FR-002**: The source import MUST copy the reviewed clean Blue Engine checkpoint identified in the research notes without importing its Git history, generated build outputs, dependency caches, or unrelated local artifacts.
- **FR-003**: A documented root workspace build MUST build Blue Engine and the application from the same checkout.
- **FR-004**: Application packaging MUST have an explicit build dependency on the engine artifact and MUST fail if the expected artifact is missing, stale, for the wrong platform, or for the wrong architecture.
- **FR-005**: Every supported release package MUST contain a platform-correct Blue Engine executable in a deterministic application-owned location.
- **FR-006**: Normal installed use MUST prefer the bundled engine and MUST NOT require an engine executable on the user's executable search path.
- **FR-007**: Blue MUST retain an explicit external-engine override for development and diagnostics, and MUST clearly distinguish an override from the bundled default.
- **FR-008**: Electron's main process MUST remain the owner of engine process lifecycle and ZeroMQ communication; renderer and data-library code MUST NOT gain native process or Csound coupling.
- **FR-009**: Engine/client communication MUST use a declared protocol version or capability handshake and MUST reject an incompatible engine before starting playback.
- **FR-010**: Csound MUST remain a runtime-loaded, replaceable dependency rather than a link-time or bundled engine dependency.
- **FR-011**: Blue MUST open, create, edit, and save projects when Csound is not installed.
- **FR-012**: Before an engine-backed operation, Blue MUST be able to report whether a compatible Csound library is available, which library was selected, its version, and any load or symbol-resolution failure.
- **FR-013**: The release MUST define and enforce a supported Csound version range, including a clear diagnostic for unsupported versions.
- **FR-014**: Blue MUST allow the user to retry Csound detection after correcting the installation or location without losing the current project.
- **FR-015**: All non-system native dependencies used to implement Blue Engine MUST be statically linked into its executable. Csound and documented operating-system runtimes are the explicit exceptions.
- **FR-016**: Native dependency versions and build inputs MUST be pinned in source control through a reproducible, cross-platform dependency manifest.
- **FR-017**: The supported build matrix MUST cover macOS Apple Silicon, Windows x64, and Linux x64; the build design MUST remain capable of adding macOS x64 without restructuring the source package.
- **FR-018**: The Linux engine MUST use a documented C-library compatibility baseline suitable for the supported distribution matrix.
- **FR-019**: The Linux AppImage MUST run without legacy FUSE 2 and MUST be tested on representative Debian, Arch/Manjaro, and Fedora/RHEL-family systems.
- **FR-020**: Release validation MUST inspect each bundled executable's architecture and native dependency closure and MUST fail for an unexpected non-system dependency.
- **FR-021**: Release validation MUST include an application startup/editing smoke test without Csound and an engine integration test with a supported Csound installation.
- **FR-022**: macOS packaging and signing configuration MUST treat the engine as a nested executable and MUST preserve the intended runtime loading of a user-installed Csound library.
- **FR-023**: Windows packaging MUST not depend on undeclared DLLs beside the engine executable and MUST use safe, deterministic native-library resolution.
- **FR-024**: Realtime playback and Blue Live MUST continue to use isolated engine processes and MUST remain operable concurrently.
- **FR-025**: User and contributor documentation MUST state that Blue Engine is bundled, Csound is an optional-at-startup runtime prerequisite for audio operations, and which platform/Csound versions are supported.
- **FR-026**: This feature MUST NOT change `.blue` XML, generated CSD semantics, or project ownership and persistence rules.
- **FR-027**: The release process MUST NOT require a separately published Blue Engine GitHub release for normal application packaging.
- **FR-028**: Development startup through `pnpm --filter @blue/app run dev` MUST use the verified current-platform engine artifact from the same workspace checkout when no explicit external override is configured, and MUST NOT require or search for a system-installed Blue Engine.

### Existing Behavior & Data Compatibility *(mandatory)*

- **Reference behavior**: The current Electron main process launches Blue Engine as an external subprocess for realtime playback and Blue Live and communicates with it through the versioned `@blue/engine-client` ZeroMQ protocol. Blue Engine's current loader resolves the Csound shared library at runtime rather than linking Csound into the executable.
- **Data compatibility**: Existing `.blue` project XML, CSD generation, project snapshots, settings ownership, and save behavior remain unchanged. Engine and Csound availability are runtime environment facts and are not written into project files.
- **State ownership**: The Electron main process owns the engine executable selection, subprocess lifecycle, probe results, and communication state. The main-process canonical `BlueData` document continues to own project state. The monorepo owns engine source, dependency manifests, protocol definitions, build metadata, and packaged artifacts.
- **Intentional changes**: Blue Engine becomes a bundled application component built from the same revision as Blue Electron. A separate engine installation and separate engine release download are no longer part of normal installation or packaging. Csound intentionally remains external and runtime-loaded so Blue can start without it.
- **Regression boundary**: Existing realtime playback, stop behavior, Blue Live, output forwarding, crash recovery, and multiple-process isolation MUST continue to work. Rendering output and Java-compatible project data MUST not change solely because the engine source moved.

### Key Entities

- **Bundled Engine Artifact**: A platform- and architecture-specific executable identified by application version, engine protocol version, build revision, and verified native dependency closure.
- **Engine Compatibility Report**: A transient result containing engine protocol compatibility, selected Csound library path, detected Csound version, required symbol availability, and a structured readiness or failure reason.
- **Native Dependency Manifest**: Source-controlled, pinned declarations for the engine's non-system native libraries and supported platform triplets.
- **Engine Selection**: The resolved executable source—bundled default or explicit external override—together with its validated path, architecture, and protocol compatibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On each required build platform, a contributor can start from a clean checkout with documented prerequisites and complete the engine plus application build with one root workspace build command.
- **SC-002**: 100% of macOS Apple Silicon, Windows x64, and Linux x64 release packages contain exactly one validated engine executable for the package's platform and architecture.
- **SC-003**: Native dependency inspection of every release engine finds zero undeclared non-system shared-library dependencies; Csound and documented operating-system runtimes are the only allowed external dependencies.
- **SC-004**: On every supported platform, all startup, project-open, project-edit, and project-save smoke tests pass with Csound absent.
- **SC-005**: On every supported platform, a minimal engine render or realtime smoke test passes with each supported Csound major version in the declared compatibility range.
- **SC-006**: Missing, unloadable, symbol-incompatible, or version-incompatible Csound installations produce a structured user-facing diagnostic within 3 seconds of a probe or engine-backed request, without closing the project.
- **SC-007**: A deliberately mismatched engine/client protocol pair is rejected before performance starts in 100% of compatibility tests.
- **SC-008**: The Linux AppImage startup and bundled-engine discovery tests pass on at least one Debian-family, one Arch/Manjaro-family, and one Fedora/RHEL-family environment within the documented C-library baseline.
- **SC-009**: Realtime playback and Blue Live can run simultaneous isolated engine processes without cross-contaminating commands, output, or shutdown behavior.
- **SC-010**: Release packaging fails before artifact publication when the engine is missing, incorrectly linked, non-executable, stale, or built for the wrong architecture.
- **SC-011**: With all system-installed `blue-engine` executables removed from `PATH`, the development application started by `pnpm --filter @blue/app run dev` resolves the workspace artifact and passes its engine discovery/probe test on every supported development platform.

**Closeout evidence (2026-07-30 UTC)**: Automated feature evidence covers the
root build, all three package targets, dependency closure, no-Csound project
safety, protocol mismatch, development resolution, concurrent sessions, and
the Debian/Arch/Fedora AppImage matrix. Actual Csound 7 null-audio integration
passed on macOS arm64. SC-005 clean-machine Windows/Linux playback and any
future signed/notarized macOS validation remain release-candidate gates and
must pass before those artifacts are announced as a stable release.

## Assumptions

- The initial required release architectures are macOS arm64, Windows x64, and Linux x64. Intel macOS support may be added to the same build matrix later.
- Csound 7 is the primary compatibility target. Any additional supported major version will be declared and tested rather than assumed.
- “Static linking” means all distributable third-party libraries used by Blue Engine are included in the executable. Core operating-system libraries, the platform C/C++ runtime where required by the supported toolchain, and the deliberately optional Csound shared library are excluded from that definition.
- The selected Blue Engine source state is the reviewed clean checkpoint recorded in the research notes. Implementation will verify that checkpoint before copying, record its provenance with the imported source, and omit the repository history.
- A standalone Blue Engine release remains possible for developers but is outside the normal Blue application installation and release path.
- Downloading Csound automatically, bundling Csound, and implementing a Csound installer are outside this feature.
- The existing external-process boundary is intentional; this feature does not embed Blue Engine or Csound inside the Electron renderer or main process.

## Out of Scope

- Importing or preserving the separate Blue Engine Git history.
- Using a Git submodule or downloading Blue Engine from GitHub during a normal application build or install.
- Bundling Csound, Csound plugins, or third-party opcode libraries.
- Changing audio-rendering semantics, `.blue` XML, or generated CSD content.
- Replacing the ZeroMQ protocol or collapsing the engine into the Electron process.
- Providing every Linux distribution's native package format; AppImage is the cross-distribution deliverable for this feature.
