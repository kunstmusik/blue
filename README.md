# Blue — TypeScript Port

> **Object composition environment for Csound** — ported from the NetBeans RCP Java application to a TypeScript monorepo.

[![Status](https://img.shields.io/badge/status-alpha-orange)](https://github.com/kunstmusik/blue)

Blue is a visual composition environment for [Csound](https://csound.com/) that lets you create, edit, and render complex music projects. This project ports the **data model and business logic** from the original Java/NetBeans application to TypeScript, with plans for both an Electron desktop app and a future browser-based UI.

---

## Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Building](#building)
- [Releases](#releases)
- [Testing](#testing)
- [Development](#development)
- [Progress](#progress)
- [Architecture](#architecture)
- [Contributing](#contributing)

---

## Overview

### What is Blue?

Blue lets you compose music using Csound by providing a visual timeline editor where you can arrange score events, audio clips, pattern sequencers, instruments, mixers, and automation. Projects are saved as `.blue` files (XML format) that are compiled into CSD (Csound Document) files for audio rendering via the bundled Blue Engine C++ sidecar maintained in this monorepo.

### Why Port?

- **Modern stack:** TypeScript with full type safety, modern tooling, and a monorepo structure
- **Universal data layer:** The `@blue/data` package works in **both browser and Node.js** — enabling a future web app alongside the Electron desktop app
- **Backwards compatible:** Preserves and round-trips Java Blue `.blue` project data, including unsupported legacy fields
- **Incremental migration:** Data classes, score layers, and engine integration are ported phase-by-phase

---

## Monorepo Structure

```
blue-electron/
├── packages/
│   ├── blue-data/            # @blue/data — Universal data model (browser + Node)
│   │   ├── src/
│   │   │   ├── blue-data.ts           # Root project data class
│   │   │   ├── arrangement.ts         # Instrument → CSD ID mapping
│   │   │   ├── score/                 # Score + layer system
│   │   │   │   ├── score.ts
│   │   │   │   └── layers/            # Layer, LayerGroup, providers
│   │   │   ├── sound-objects/         # SoundObject types
│   │   │   │   ├── generic-score.ts   # Raw Csound score text
│   │   │   │   ├── poly-object.ts     # Nested layer group
│   │   │   │   └── note.ts            # Csound note (p-fields)
│   │   │   ├── instruments/           # Instrument types
│   │   │   ├── time/                  # TimePosition, TimeDuration, TempoMap
│   │   │   ├── migration/             # Version upgraders
│   │   │   └── serialization/         # XML parser/writer
│   │   └── package.json
│   │
│   ├── blue-engine-client/   # @blue/engine-client — Node.js ZMQ client for blue-engine
│   │   └── src/
│   │
│   └── blue-app/             # @blue/app — Electron application shell and playback bridge
│       └── src/
│
├── native/
│   └── blue-engine/          # @blue/engine-native — bundled C++ sidecar
│
├── specs/                    # Spec-kit specifications
│   └── 001-blue-data-port/
│       ├── spec.md           # Feature specification
│       ├── plan.md           # Technical implementation plan
│       ├── research.md       # Consolidated research
│       └── tasks.md          # Task breakdown (157 tasks)
│
├── research/                 # Architecture & design documents
│   ├── 001-project-analysis-and-plan.md
│   ├── 002-data-class-dependency-graph.md
│   └── 003-engine-protocol.md
│
├── package.json              # Workspace root (pnpm)
├── pnpm-workspace.yaml
├── tsconfig.base.json        # Shared TypeScript config
└── vitest.workspace.ts       # Vitest workspace config
```

### Packages

| Package | Environment | Purpose |
|---------|------------|---------|
| **`@blue/data`** | Browser + Node.js | Core data model — all Blue data classes with XML serialization compatible with Java `.blue` files |
| **`@blue/engine-client`** | Node.js only | ZeroMQ client for the C++ blue-engine process (playback control) |
| **`@blue/engine-native`** | Native desktop targets | C++ source, pinned vcpkg build, tests, and verified artifacts |
| **`@blue/app`** | Electron | Desktop application shell — loads `.blue` files, generates CSD, plays via blue-engine |

---

## Prerequisites

| Tool | Version | Required |
|------|---------|----------|
| [Node.js](https://nodejs.org/) | 22+ | ✅ |
| [pnpm](https://pnpm.io/) | 10+ | ✅ |
| Java and Maven | Java 17+ / Maven 3+ | For the Java helper runtime and app builds |
| CMake and C/C++ toolchain | CMake 3.21+ | Source builds only |
| vcpkg | Pinned repository revision | Bootstrapped automatically on the first native build; `VCPKG_ROOT` may select an existing checkout |
| Csound 7 | Latest | Optional at startup; required for audio playback/rendering |

Blue Engine is built from `native/blue-engine` and bundled with installed
applications. Do not install a separate `blue-engine` executable. Blue opens,
edits, and saves projects without Csound; engine-backed operations report a
recoverable diagnostic until Csound 7 is installed.

### Install pnpm

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/kunstmusik/blue-electron-poc.git
cd blue-electron-poc

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run tests
pnpm test
```

---

## Building

### Build All Packages

```bash
pnpm build
```

This builds the native Blue Engine first, stages its verified artifact for the
application, and then compiles the Java and TypeScript packages.

Run the Electron development app with:

```bash
pnpm --filter @blue/app run dev
```

This command builds and selects
`native/blue-engine/dist/<platform>-<arch>/blue-engine[.exe]`; it never falls
back to `/usr/local/bin` or `PATH`.

### Build a Specific Package

```bash
pnpm --filter @blue/data build
```

### Watch Mode (Development)

```bash
pnpm --filter @blue/data build --watch
```

### TypeScript Type Checking

```bash
pnpm --filter @blue/data exec tsc --noEmit
```

---

## Releases

Blue ships for macOS arm64, Windows x64, and Linux x64 with a revision-matched
Blue Engine bundled under application resources. Csound 7 remains an optional
runtime installation for playback, and a Java runtime remains required for
Java-backed features. Linux builds target glibc 2.35 and use the modern
AppImage runtime, including extract-and-run operation without FUSE 2.

Contributor, develop, and stable packages are unsigned and require no production signing credentials. Stable releases use the protected GitHub `release` Environment as the publisher boundary; under the current single-maintainer policy, no separate approval prompt is configured. Signed macOS and Windows release paths are reserved for future funded work.

| Audience | Quick command |
| --- | --- |
| Contributor (local unsigned package) | `pnpm --filter @blue/app package:dir && pnpm --filter @blue/app verify:packaged-app` |
| PR validation | `.github/workflows/pr.yml` directly uploads versioned `.dmg`, `.exe`, `.AppImage`, and `.deb` Actions artifacts for macOS arm64, Windows x64, and Linux x64. |
| Develop build | Push to `develop`; `.github/workflows/develop.yml` directly uploads native packages named `blue-{os}-{cputype}-{version}-{short-sha}.{ext}` and creates no GitHub Release. |
| Maintainer (stable release) | Push an immutable `vX.Y.Z` tag matching `packages/blue-app/package.json`. After all package jobs succeed, `.github/workflows/release.yml` publishes verified unsigned `.dmg`, `.exe`, `.AppImage`, and `.deb` assets from the `release` Environment. |

The `package:*` scripts are the normal packaging entry point. Each stages the selected Blue Engine, generates `release-metadata.json`, validates the complete package inputs, and then invokes `electron-builder`. To run input validation separately after building, first run `pnpm --filter @blue/app release:metadata`, then `pnpm verify:package-inputs`.

Full repository verification: `pnpm verify`. Workflow contract validation: `pnpm verify:release-workflows`. Credential test coverage: `pnpm verify:release-credentials`. Stable-version validation: `pnpm --filter @blue/app verify:release-version -- --tag vX.Y.Z --app-version X.Y.Z --repository <owner/repo>`.

For GitHub Environment policy, future signing readiness, and failure recovery see the [release guide](docs/release-guide.md).

---

## Testing

### Run All Tests

```bash
pnpm test
```

### Run Tests for a Specific Package

```bash
pnpm --filter @blue/data test
```

### Run Tests in Watch Mode

```bash
pnpm --filter @blue/data test -- --watch
```

### Run a Single Test File

```bash
pnpm --filter @blue/data exec vitest run src/serialization/xml-reader.test.ts
```

### Test Coverage

```bash
pnpm --filter @blue/data test -- --coverage
```

---

## Development

### Project Structure Conventions

- **Source code:** `packages/*/src/`
- **Tests:** Co-located `*.test.ts` files in `src/`
- **Build output:** `packages/*/dist/` (gitignored)

### Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Format all packages
pnpm exec prettier --write "packages/*/src/**/*.ts"
```

### Import Guidelines for `@blue/data`

The `@blue/data` package must remain **environment-agnostic** (works in both browser and Node.js):

- ❌ No `import` of Node.js built-ins (`fs`, `path`, `child_process`, `Buffer`, etc.)
- ❌ No DOM-specific APIs
- ❌ No `require()`, dynamic `import()`, or inline `import("...").Type` annotations
- ✅ Use top-level static ES imports and type imports
- ✅ Use `Element.parse()` and `element.toXml()` for XML
- ✅ File I/O is the caller's responsibility — `BlueData.loadFromString(xml)` and `blueData.saveToString()`

### Java-First Parity

For behavior, rendering, XML, or formatting differences, consult the Java implementation before
changing TypeScript. The primary references are [blue-core](https://github.com/kunstmusik/blue/tree/develop/blue-core) and
[blue-ui-core](https://github.com/kunstmusik/blue/tree/develop/blue-ui-core). Compare Java-generated artifacts when available and document
every intentional divergence in the active feature spec and plan.

### Adding a New Data Class

1. Create the file in the appropriate `packages/blue-data/src/` subdirectory
2. Implement `saveAsXML(): Element` and `static loadFromXML(data: Element): T`
3. Implement `deepCopy(): T` (via `DeepCopyable<T>`)
4. Add a round-trip test in `src/**/`*name*`.test.ts`
5. Export from `src/index.ts`

---

## Progress

### Current Status

- `@blue/data` loads and saves `.blue` projects, applies Java-style migrations, and generates CSD with BSB instruments, mixer routing, effect UDOs, string channels, and automation exports.
- `@blue/engine-client` implements playback control plus automation/channel operations for `blue-engine`.
- `@blue/app` can open projects, generate CSD, and play through `blue-engine`.
- The realtime automation path uses standard Csound `chnexport`; `blue-engine` owns native Csound channels and mirrors live scalar control values into shared memory for external readers.

For the current resume state, parity investigations, and next debugging targets, see [STATUS.md](STATUS.md).

---

## Architecture

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Electron (not Tauri)** | Blue-engine communicates via ZMQ — Node.js talks to it directly. No Rust FFI needed. |
| **Universal `@blue/data`** | Zero Node.js built-ins. Works in browser and Node for future web app. |
| **XML serialization** | Must match Java `electric.xml` format exactly for bi-directional `.blue` compatibility. |
| **Migration on load** | XML-level upgrades (like Java) before deserialization — handles structural schema changes. |
| **Host-injected JVM helper** | Electron main owns the Java helper and injects an abstract runtime contract into `@blue/data`; hosts without Java preserve project metadata and report unavailable execution. |

### Data Flow

```
.blue XML file
     │
     ▼
Element.parse(xml) ──→ UpgradeManager ──→ BlueData.loadFromString(xml)
     │                                          │
     │                                    (all data classes)
     │                                          │
     ▼                                          ▼
Element.toXml() ←────────────────── BlueData.saveToString()

                                        │
                                        ▼ (toCSD())

                                 <CsoundSynthesizer>
                                 <CsOptions> -r 44100 ...
                                 <CsInstruments>
                                   ; orchestra code
                                 </CsInstruments>
                                 <CsScore>
                                   i1 0 2 440 0.5
                                 </CsScore>
                                 </CsoundSynthesizer>
                                        │
                                        ▼ (blue-engine via ZMQ)

                                   Audio Output
```

### For More Detail

| Document | Content |
|----------|---------|
| [`research/001-project-analysis-and-plan.md`](research/001-project-analysis-and-plan.md) | Full architecture analysis, framework decision, Phase 1-10 plan |
| [`research/002-data-class-dependency-graph.md`](research/002-data-class-dependency-graph.md) | All 85+ classes mapped to TS targets in 14 dependency layers |
| [`research/003-engine-protocol.md`](research/003-engine-protocol.md) | ZMQ binary protocol reference for blue-engine client |
| [`specs/001-blue-data-port/spec.md`](specs/001-blue-data-port/spec.md) | Feature specification with 6 user stories, 30 requirements |
| [`specs/001-blue-data-port/plan.md`](specs/001-blue-data-port/plan.md) | Technical implementation plan with full source tree mapping |

---

## Contributing

### Spec-Driven Development

This project uses [Spec Kit](https://github.com/github/spec-kit) for structured development. Features follow a spec → plan → tasks → implement workflow.

### How to Help

1. Check [STATUS.md](STATUS.md) for the current branch state and active parity findings.
2. Pick the next relevant spec or follow-up from `specs/` and confirm the Java reference path.
3. Implement the change in the appropriate package.
4. Add or update tests around the affected render/runtime path.
5. Submit a PR.

### Areas That Need Help

- **Playback parity** — remaining Java/TypeScript differences in complex projects
- **Score/editor features** — additional SoundObject types, remaining data-model gaps, and editor/UI work
- **Electron app UX** — project workflow, transport, diagnostics, and polish
- **Native engine integration** — continued cross-platform runtime, packaging, and Csound compatibility work for the monorepo-owned `blue-engine`

---

## License

GPL v2.0 or later — same license as the original Java Blue application.

See [LICENSE](LICENSE) for details.

---

*This project ports Blue from Java/NetBeans RCP to TypeScript. The original Blue Java application is at [https://github.com/kunstmusik/blue](https://github.com/kunstmusik/blue).*
