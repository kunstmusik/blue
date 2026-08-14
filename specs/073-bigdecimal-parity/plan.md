# Implementation Plan: Java BigDecimal Automation Parity

**Branch**: `073-bigdecimal-parity` | **Date**: 2026-08-14 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `specs/073-bigdecimal-parity/spec.md`

## Summary

Replace the bounded `double + scale + highPrecision` automation-resolution model with one Java-compatible exact decimal contract. `@blue/data` will preserve a resolution as signed unscaled digits plus Java `int` scale, expose canonical `BigDecimal.toString()` text and a derived `doubleValue()`, and keep all parameter values and line points as binary64 doubles. TypeScript and native evaluators will reproduce Java Blue's line selection, double-operation order, positive-resolution `BigDecimal` quantization, and offline `CSDRender` behavior. The Blue app, engine client, and bundled engine will move atomically to protocol version 2, whose automation payload transports canonical resolution text and contains no `highPrecision` field. A committed corpus produced by actual pinned Java Blue classes will provide exact-bit and exact-text expectations to Vitest and CTest without Java in normal test runs.

The native positive-resolution path will use Boost.Multiprecision integers behind a private exact-decimal module. Parsing, segment preparation, workspace sizing, and arena allocation occur on the control thread; the audio thread receives prepared state and uses a fixed arena with no system allocation, locking, parsing, logging, or destruction of retired arenas. Zero-or-negative resolutions branch before arbitrary-precision work and retain the Spec 072 common-path optimizations, subject to Java-compatible linear operation order and the five-trial 5% regression gate.

## Technical Context

**Language/Version**: TypeScript 5.8.x in strict mode; C++17 with Clang 15+, GCC 12+, and MSVC 2022; Java 25 for the maintainer-only fixture generator; Node.js 22 and Electron 35.7.5.

**Primary Dependencies**:

- `@rgrove/parse-xml` and the existing `@blue/data` XML utilities
- Native JavaScript `BigInt` for portable TypeScript exact-integer operations
- Boost.Multiprecision `cpp_int` as a header-only native dependency with a feature-owned arena allocator
- ZeroMQ 4.3.x through the pinned vcpkg manifest and `@blue/engine-client`
- CMake 3.21+, pnpm 10, Vitest 4.x, CTest, and the existing Release benchmark/stress harnesses
- A pinned external Java Blue Maven reactor only when fixtures are intentionally regenerated

**Storage**:

- `.blue` XML remains canonical project persistence; `bdresolution` stores Java-canonical decimal text at the parameter and nested-line boundaries
- Electron main remains the canonical owner of active `BlueData`; renderer snapshots carry exact resolution text plus a derived display number
- `fixtures/java-blue-automation-parity/v1/` is a committed, versioned development corpus with provenance; it is not user state
- Native prepared decimal definitions and work arenas are transient engine state

**Testing**:

- Vitest in `@blue/data`, `@blue/engine-client`, and `@blue/app` for decimal primitives, XML/copy/edit propagation, protocol v2, engine publication, BSB synchronization, committed-value snapping, and offline CSD fragments
- CTest for the native decimal module, Java line evaluator, `AutomationManager`, protocol parsing, allocation instrumentation, and fixture-driven exact-bit comparisons
- Existing Csound integration, 10-minute stress, sanitizer, and Release profiling targets
- Deterministic opt-in Java fixture regeneration/check commands; normal tests read committed TSV files and do not launch Java
- Root package tests, builds, and lint after focused suites pass

**Target Platform**: macOS arm64/x86_64, Linux x86_64, and Windows 10/11 x64, with Electron hosting the external Blue Engine and runtime-loaded Csound 7.

**Project Type**: Cross-platform desktop monorepo with a portable data library, typed engine client, Electron host, native audio-engine sidecar, and maintainer tooling.

**Performance Goals**:

- 100% raw-binary64 equality for all Java realtime fixtures and byte-exact equality for all Java offline fixtures
- At least 2,048 seeded realtime cases plus curated resolution, endpoint, duplicate-time, diagnostic, and offline cases; committed-fixture tests complete in under 10 seconds after binaries are built
- No system heap allocation, blocking synchronization, or diagnostic formatting in an audio-cycle evaluation, including the cycle that adopts an updated definition
- No more than 5% median regression in the zero-or-negative-resolution benchmark across five Release trials relative to the completed Spec 072 baseline
- A 10-minute representative positive-resolution stress run with zero decimal-attributable deadline misses, engine stalls, arena overflows, or system allocations

**Constraints**:

- Java Blue `Line.getValue()`, `Parameter`/`Line` XML methods, `LineUtils` value snapping where edits commit values, and `CSDRender` are the behavioral references
- Only the resolution is exact decimal; point times, point values, bounds, and fixed values remain doubles
- Positive resolution always selects exact Java-compatible quantization; `highPrecision` is removed rather than retained as a mode
- Zero, negative, and positive-but-double-underflowed resolutions avoid arbitrary-precision evaluation as Java does
- `@blue/data` remains browser-safe and Node-safe, with static imports and no Node, Electron, DOM-only, or dynamic-import dependency
- Normal tests are deterministic, offline, and independent of Java, network access, or an external Java Blue checkout
- App, client, and bundled engine change and ship together; protocol v2 records the incompatible schema but no version-1 parser or transition mode is implemented
- Native exact arithmetic may consume memory proportional to a valid resolution's coefficient and scale; preparation failure is recoverable and never falls back to approximation

**Scale/Scope**:

- 0 to 256 concurrent automations, each with ordered binary64 points and an independently prepared exact resolution
- Sample rates from 44.1 kHz to 192 kHz and `ksmps` from 16 to 1024
- Java `BigDecimal(String)` coefficient precision and signed 32-bit scale, limited only by validated message/project size and successful control-thread workspace preparation
- Exactly 2,048 deterministic seeded realtime line cases, plus curated cases and independent offline/resolution sections in fixture schema v1

## Constitution Check

*GATE: Passed before Phase 0 research and passed again after Phase 1 design.*

- **Portable data core**: **PASS (pre-research and post-design)**. The exact TypeScript decimal model uses only portable language primitives and existing XML utilities. Java execution, filesystem access, corpus regeneration, ZeroMQ, and native code remain outside `@blue/data`; test-only fixture readers may use Node APIs without entering production code.
- **Java and project compatibility**: **PASS (pre-research and post-design)**. Actual Java Blue `Line`, `Parameter`, and `CSDRender` methods are the fixture oracles. Exact `bdresolution` value and scale survive `.blue` round trips, legacy `resolution` follows Java normalization, and point/value fields remain doubles. Step/exponential curve math and approximate renderer previews are the only documented partial-parity areas.
- **Canonical ownership and contracts**: **PASS (pre-research and post-design)**. Electron main owns `BlueData`; `.blue` owns durable resolution text; renderers receive typed serializable snapshots and submit exact-string patches; Blue Engine owns only a transient prepared copy. Protocol v2, decimal grammar, error responses, fixture schema, and state transitions are documented in `contracts/` and `data-model.md`.
- **Runtime and engine isolation**: **PASS (pre-research and post-design)**. Electron main remains the only ZeroMQ/process owner. The Java Blue checkout and Maven/JDK toolchain are opt-in maintainer inputs to a repository tool, never application/runtime dependencies. Renderer and portable data code do not couple to native state.
- **Verification evidence**: **PASS (pre-research and post-design)**. The design covers exact Java-derived fixtures at data, editor, protocol, realtime, and offline boundaries; XML and copy round trips; malformed-input failures; allocation instrumentation; sanitizers; stress; focused package checks; root build/test/lint; and reproducible fixture regeneration.

## Project Structure

### Documentation (this feature)

```text
specs/073-bigdecimal-parity/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── automation-protocol-v2.md
│   ├── exact-decimal-resolution.md
│   └── java-parity-fixtures-v1.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # Generated later by /speckit-tasks
```

### Source Code (repository root)

```text
fixtures/java-blue-automation-parity/v1/
├── manifest.json
├── SCHEMA.md
├── realtime.tsv
├── resolution.tsv
└── offline.tsv

tools/java-blue-automation-fixtures/
├── pom.xml
├── README.md
└── src/main/java/...                # Calls actual pinned Java Blue classes

scripts/
└── generate-java-blue-automation-fixtures.mjs

package.json                         # Fixture generation/check commands

packages/blue-data/src/
├── automation/
│   ├── java-decimal.ts              # Exact model/conversion/rounding primitives
│   ├── parameter.ts                 # Java line selection and XML ownership
│   └── csd-parameter-automation.ts  # Isolated Java CSDRender-compatible path
├── instruments/blue-synth-builder/  # Exact BSB slider/bank resolution ownership
└── blue-data.ts                     # Delegates automation initialization/score output

packages/blue-engine-client/src/
├── capabilities.ts                  # Protocol version 2 and decimal capability
├── protocol.ts                      # Exact resolution payload encoder
└── engine-client.ts                 # Exact automation API and mismatch diagnostics

packages/blue-app/src/
├── shared/project-editor.ts         # Exact snapshot/patch fields
├── main/engine-bridge.ts            # Protocol-v2 publication
└── renderer/components/...          # Decimal editor; numeric preview remains derived

native/blue-engine/
├── CMakeLists.txt
├── vcpkg.json                       # Header-only Boost.Multiprecision dependency
├── README.md                        # Protocol/build/dependency overview
├── src/
│   ├── automation/
│   │   ├── JavaBigDecimal.h/.cpp
│   │   ├── ExactDecimalQuantizer.h/.cpp
│   │   ├── AutomationTypes.h
│   │   ├── AutomationStore.h/.cpp
│   │   └── AutomationManager.h/.cpp
│   ├── ipc/ZmqHandler.cpp
│   └── protocol/{Protocol.h,Capabilities.h,Capabilities.cpp}
├── tests/cpp/
│   ├── test_java_bigdecimal.cpp
│   ├── test_java_bigdecimal_parity.cpp
│   ├── test_automation_manager.cpp
│   └── test_automation_protocol.cpp
├── tests/README.md                   # Corpus, allocation, stress, benchmark guide
├── examples/{c,cpp,java,javascript,python}/
│   └── ...                          # Protocol-v2 automation payload examples
└── docs/automation_system.md         # Exact path and realtime ownership model
```

**Structure Decision**: Keep exact decimal semantics in one portable `@blue/data` module and one private native module, with canonical text as the cross-process representation. Reuse the existing package, main-process, ZeroMQ, and engine boundaries rather than introduce a new service. Keep fixture generation in repository-owned tooling but invoke actual pinned Java Blue artifacts so the oracle is independent of both implementations under test.

## Design Sequence

1. Establish fixture schema v1 and a small curated Java-generated corpus, then prove raw-bit decoding in Vitest and CTest before implementing arithmetic.
2. Implement the portable exact-decimal value object, Java double conversion, rounding/remainder operations, legacy normalization, and XML/copy behavior; use it in `Parameter`, BSB resolution owners, committed-value snapping, and offline automation generation.
3. Implement the native exact-decimal spike with the arena allocator and system-allocation instrumentation on Clang, GCC, and MSVC; proceed only when the production evaluation path demonstrates zero upstream allocations after preparation.
4. Move segment and quantizer preparation to the native control thread, add control-thread reclamation for retired prepared resources, reproduce Java point selection and linear operation order, and retain existing step/exponential calculations before exact quantization.
5. Advance the app/client/engine boundary together to protocol version 2, update packaged-runtime manifests/examples/tests in the same slice, and publish canonical resolution text from Electron main without a numeric reconstruction.
6. Generate the full deterministic corpus from pinned Java Blue, run each section through the production boundary it covers, then complete focused, integration, sanitizer, stress, benchmark, documentation, and repository-wide validation. Update the native automation guide, README protocol table, test guide, and all shipped example clients; retain Specs 009 and 072 as historical records rather than rewriting their completed contracts.

## Complexity Tracking

> Constitution Check passed with no violations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | N/A | N/A |
