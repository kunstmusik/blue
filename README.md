# Blue 3

Blue is an object composition environment for [Csound](https://csound.com/).
Arrange musical ideas on a visual timeline, design instruments, route audio
through a mixer, and use automation and code to shape a composition. Blue
saves projects as `.blue` XML and generates Csound documents (`.csd`) for
playback and audio rendering.

This repository contains the Blue 3 Electron desktop application, its
TypeScript project model, command-line compiler, Java helper, and native
Blue Engine. It continues the original Java/NetBeans Blue application;
the Java source is preserved on the
[`legacy/blue-2.x`](https://github.com/kunstmusik/blue/tree/legacy/blue-2.x)
branch.

## Working with Blue

- **Compose with SoundObjects:** combine written Csound scores, piano-roll
  notes, patterns, audio files, and generated events. Nest phrases in
  PolyObjects and reuse material through the SoundObject Library.
- **Build instruments and effects:** edit orchestra code, use BlueSynthBuilder
  interfaces, and organize instruments, UDOs, and project-wide Csound text.
- **Mix and automate:** route instruments through mixer channels and effects,
  and automate instrument and mixer parameters.
- **Generate and render:** create CSD files, play projects through Blue Engine,
  render audio to disk, or use Blue Live for performance.

The [Blue 3 manual](docs/manual/index.qmd) covers installation, a first
project, editors, settings, and keyboard shortcuts. After launching Blue,
choose **File → Open Example Project…** to explore a bundled composition.

### Downloads and runtime requirements

Find published packages on the
[Releases page](https://github.com/kunstmusik/blue/releases).
Development builds are available as artifacts from the
[Develop workflow](https://github.com/kunstmusik/blue/actions/workflows/develop.yml).
The release targets are macOS arm64, Windows x64, and Linux x64, with DMG,
Windows installer, AppImage, and Deb packages.

Blue includes its own Blue Engine executable. Install **Csound 7** separately
for playback and rendering. Opening, editing, and saving projects does not
require Csound. Java-backed features, including Clojure and Jython execution,
require a Java runtime. See the [installation guide](docs/manual/installation.qmd)
for platform details.

## Build from source

Run workspace commands from the repository root with pnpm.

### Prerequisites

| Tool               | Requirement                                                          |
| ------------------ | -------------------------------------------------------------------- |
| Node.js            | 22 or newer; CI uses Node.js 22                                      |
| pnpm               | Use the version pinned in the root `package.json` (`packageManager`) |
| Java and Maven     | JDK 17+ and Maven 3+ for the Java helper                             |
| Native build tools | CMake 3.21+ and a C/C++ toolchain                                    |
| Quarto             | Required to build the manual and application packages                |
| Csound 7           | Required for playback, rendering, and Csound integration tests       |

The native build bootstraps the repository's pinned vcpkg revision. The first
build needs network access to download native and Java dependencies. On
macOS, install Xcode or the Xcode Command Line Tools for the native toolchain.

### Start the desktop app

```bash
git clone https://github.com/kunstmusik/blue.git
cd blue
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @blue/app dev
```

`pnpm build` builds the workspace packages, including Blue Engine and the Java
helper. The `dev` command launches the Electron app with development reloads
and uses the engine built from this checkout.

To build the bundled manual and launch the compiled app:

```bash
pnpm build:manual
pnpm --filter @blue/app start
```

### Package the app

After building, create and verify an unsigned unpacked application:

```bash
pnpm --filter @blue/app rebuild:native
pnpm --filter @blue/app package:dir
pnpm --filter @blue/app verify:packaged-app
```

Use `pnpm app:package` to produce the current platform's installer. Packaging
builds the manual, stages Blue Engine, generates release metadata, and validates
package inputs. See the [release guide](docs/release-guide.md) for release
channels, platform packaging, verification, and publication procedures.

## Repository layout

| Location                                              | Purpose                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/blue-app` (`@blue/app`)                     | Electron main process, preload contracts, and React desktop UI                      |
| `packages/blue-data` (`@blue/data`)                   | Platform-neutral project models, XML loading/saving, migrations, and CSD generation |
| `packages/blue-engine-client` (`@blue/engine-client`) | Node.js client and versioned protocol for Blue Engine                               |
| `packages/blue-java` (`@blue/java-runtime`)           | Java helper for project-scoped Clojure and Jython execution                         |
| `packages/blue-cli` (`blue-cli`)                      | Command-line compilation of `.blue` projects into `.csd` files                      |
| `native/blue-engine` (`@blue/engine-native`)          | C++ Csound sidecar, native builds, and engine tests                                 |
| `docs/manual`                                         | Quarto source for the bundled user manual                                           |
| `docs`                                                | Architecture conventions, release procedures, and contributor references            |
| `examples`                                            | Example compositions and supporting resources                                       |
| `specs`                                               | Feature specifications, plans, research, and implementation tasks                   |
| `.specify`                                            | Spec Kit templates and project constitution                                         |

See the [data package guide](packages/blue-data/README.md),
[CLI guide](packages/blue-cli/README.md),
[Java runtime guide](packages/blue-java/README.md), and
[engine guide](native/blue-engine/README.md) for component details.

## Architecture and compatibility

`BlueData` owns the canonical in-memory project, and `.blue` XML is the
canonical project format. The portable `@blue/data` package handles models,
serialization, migrations, and CSD generation without Node.js, DOM, or
Electron APIs. Electron main owns filesystem access, processes, Java, and
engine integration; the renderer communicates through typed preload and
IPC contracts. User-visible project edits go through the document bridge
and project history for undo/redo.

Blue Engine runs as a separate process, loads Csound at runtime, and
communicates with the application through ZeroMQ. The application bundles
the engine built from the same source revision.

Java Blue is the behavioral reference for supported legacy projects and
resources. Compatibility work uses explicit serialization contracts and
documented migrations, with diagnostics for unexpected input. Java Blue is
not required to read Blue 3 extensions. See the
[project constitution](.specify/memory/constitution.md) for the governing
compatibility and ownership rules, and
[repository history](docs/repository-history.md) for the Java/TypeScript
repository transition.

## Contributing

Read [AGENTS.md](AGENTS.md), the
[project constitution](.specify/memory/constitution.md), and
[licensing guidance](LICENSING.md) before making changes. Features use a
specification → plan → tasks → implementation workflow under `specs/`.
For behavior, rendering, or serialization changes, consult the Java reference
and add focused regression coverage. Larger module changes follow the
[modularization guide](docs/modularization.md).

Start validation with the affected package, then run workspace checks for
changes that span packages or shared behavior:

```bash
# Focused package tests
pnpm --filter @blue/data test
pnpm --filter @blue/app test

# Application build checks
pnpm --filter @blue/app build:main
pnpm --filter @blue/app typecheck:renderer

# Workspace checks
pnpm test
pnpm lint
git diff --check
```

The [developer guide](docs/manual/developer.qmd) has additional build and
extension guidance.

Application correctness tests run automatically in CI, including browser coverage.
Speed measurements use separate opt-in `test:performance`,
`test:performance:browser`, and `test:performance:engine` commands in `@blue/app`.
Use controlled desktop hardware for performance acceptance; manual hosted CI is
available for diagnosis. See [performance testing](docs/performance-testing.md)
for setup, evidence interpretation, and the remaining legacy data-package timings.

## License

Blue-authored code and documentation are **GPL-3.0-or-later** by default.
Reusable packages have their own license scopes, Java helper source is
EPL-2.0, and third-party material retains its original terms. The manual is
licensed under GFDL 1.3. See [LICENSE](LICENSE), the
[scope map](LICENSING.md), and [third-party notices](THIRD_PARTY_NOTICES.md)
for the applicable terms.
