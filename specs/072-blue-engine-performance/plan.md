# Implementation Plan: Blue Engine Host Performance and Real-Time Safety

**Branch**: `072-blue-engine-performance` | **Date**: 2026-08-13 | **Spec**: [`spec.md`](file:///Users/stevenyi/work/blue-electron/specs/072-blue-engine-performance/spec.md)

**Input**: Feature specification from [`specs/072-blue-engine-performance/spec.md`](file:///Users/stevenyi/work/blue-electron/specs/072-blue-engine-performance/spec.md) and consolidated performance review findings in [`BLUE_ENGINE_PERFORMANCE_PLAN.md`](file:///Users/stevenyi/work/blue-electron/BLUE_ENGINE_PERFORMANCE_PLAN.md).

---

## Summary

Incorporate the consolidated Blue Engine performance review into an evidence-driven optimization effort that removes lock contention and invariant host overhead from the real-time audio loop (`performThread()`), deduplicates shared-memory channel mirroring, precalculates automation segment math, and introduces a dedicated Release-mode benchmark suite with quantitative regression gates without altering observable engine behavior, protocol schemas, or project persistence.

---

## Technical Context

**Language/Version**: C++17 (Clang 15+, GCC 12+, MSVC 2022) for `native/blue-engine`; TypeScript 5.8.x (strict mode) for `@blue/engine-client` and `@blue/app`.

**Primary Dependencies**:
- Csound 7 (runtime dynamic loader via `dlopen`/`LoadLibrary`)
- ZeroMQ 4.3.x (statically linked via pinned vcpkg manifest)
- CMake 3.21+, Ninja build system
- `@blue/engine-client` (ZeroMQ host IPC client in Electron main)

**Storage**:
- In-memory lock-free snapshot containers and atomic generation counters
- OS-backed shared memory (`shm_open`/`mmap` on POSIX, named file mapping on Windows)
- Machine-readable benchmark JSON artifacts under `benchmarks/`
- No durable database or `.blue` XML storage changes

**Testing**:
- CTest unit tests (`test_fixedpoint`, `test_automation_fixedpoint`, `test_automation_manager`, `test_engine_capabilities`, `test_csound_runtime_services`, and `test_zmq_idle_wakeup`)
- CTest integration fixtures (`test_channel_bridge`, `test_csound_integration`) requiring Csound 7
- Standalone Release benchmark runner (`benchmark_engine`) exercising `CsoundEngine`
- Lifecycle stress target (`test_csound_stress`) with AddressSanitizer/UBSan and ThreadSanitizer configurations
- Workspace test and lint suites for the native, client, data, app, CLI, and Java packages

**Target Platform**:
- macOS (arm64, x86_64)
- Linux (x86_64, glibc 2.31+ floor)
- Windows 10/11 (x64)

**Project Type**: Native audio engine executable + client packages in a monorepo.

**Performance Goals**:
- At least 10% reduction in targeted median host overhead measures (static channel sync, exponential automation, quantization, completed envelopes).
- No more than 5% p95 regression on unaffected workloads.
- Zero runtime library mutex locks (`__sp_mut::lock`) or fallback mutexes (`channelMutex_`) in steady-state audio perform loop.
- 100% bitwise parity on IEEE 754 scalar representations (preserving `+0.0`, `-0.0`, infinities, and NaN payloads).

**Constraints**:
- Hard real-time audio thread safety: no OS blocking calls, allocations, or mutexes in `performThread()`.
- Zero changes to ZeroMQ wire protocol commands (`0x01`–`0x26`), `.blue` XML, CSD generation, or project models.
- Portability: standard C++17, no `-march=native` compiler flags in distributed binaries.

**Scale/Scope**:
- 0 to 256 mirrored control channels.
- 0 to 256 concurrent active automations.
- Audio sample rates from 44.1 kHz to 192 kHz with `ksmps` from 16 to 1024.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Portable data core**: **PASS**. `@blue/data` remains completely isolated from the native engine, containing only platform-neutral TypeScript data models, CSD generation, and XML parsing without native or DOM dependencies.
- **Java and project compatibility**: **PASS for the accepted fixture contract**. Java Blue's `Line.getValue()` BigDecimal logic serves as the numerical reference for the supported bounded fixed-point domain; this work does not claim arbitrary-precision or universal bit-for-bit `BigDecimal(double)` equivalence. `.blue` XML serialization, generated CSD syntax, and project data structures are 100% untouched.
- **Canonical ownership and contracts**: **PASS**. Csound owns runtime channel storage; Electron main owns engine process lifecycle; Blue Engine owns transient shared memory mirrors and automation snapshots. No engine runtime state leaks into `.blue` XML.
- **Runtime and engine isolation**: **PASS**. Blue Engine runs as an external host-owned subprocess communicating strictly through ZeroMQ and shared memory. Data models and renderer packages remain decoupled from engine internals.
- **Verification evidence**: **PASS**. Plan includes native unit tests, Java differential parity tests, 10-minute concurrent stress testing under TSan, and a 5-trial Release benchmark matrix comparing candidate builds against baseline evidence.

---

## Project Structure

### Documentation (this feature)

```text
specs/072-blue-engine-performance/
├── spec.md                                  # Feature specification
├── plan.md                                  # Implementation plan (this file)
├── research.md                              # Phase 0 decisions & analysis
├── data-model.md                            # Phase 1 data entities & state transitions
├── quickstart.md                            # Phase 1 verification & execution guide
├── contracts/                               # Phase 1 interface & runtime contracts
│   ├── benchmark-matrix-schema.json         # JSON schema for benchmark results
│   └── engine-runtime-invariants.md         # Thread safety & memory ordering invariants
├── checklists/
│   └── requirements.md                      # Quality checklist
└── tasks.md                                 # Phase 2 task decomposition (via /speckit-tasks)
```

### Source Code (repository root)

```text
native/blue-engine/
├── CMakeLists.txt                           # Build targets, profiling options, IPO/LTO configuration
├── CMakePresets.json                        # Release & Debug compiler presets
├── src/
│   ├── main.cpp                             # Process entry point, signal handlers, lifecycle
│   ├── automation/
│   │   ├── AutomationManager.h/.cpp         # Real-time automation processing & invariant caches
│   │   ├── AutomationStore.h/.cpp           # Lock-free generation-gated automation storage
│   │   ├── AutomationTypes.h                # Invariant segment & quantization cache structures
│   │   └── FixedPoint.h                     # Bounded Java-compatible decimal quantization math
│   ├── csound/
│   │   ├── CsoundLoader.h/.cpp              # Dynamic Csound 7 library bindings
│   │   ├── CsoundRuntimeServices.h/.cpp     # Device queries, offline render loop & message batching
│   │   └── CsoundTypes.h                    # Csound C API definitions
│   ├── engine/
│   │   ├── CsoundEngine.h/.cpp              # Audio perform thread, generation-bound binding snapshots
│   ├── benchmark_main.cpp                   # Standalone Release benchmark runner
│   ├── ipc/
│   │   ├── SharedMemory.h/.cpp              # Relaxed atomic scalar mirroring & bitwise deduplication
│   │   └── ZmqHandler.h/.cpp                # Control plane request parsing & inproc event wakeup
│   └── protocol/
│       ├── Protocol.h                       # ZeroMQ command & payload definitions
│       └── Capabilities.h/.cpp              # Engine capability reporting
└── tests/
    └── cpp/
        ├── CMakeLists.txt                   # CTest test suite definition
        ├── test_automation_manager.cpp      # Automation state, invalidation & curve tests
        ├── test_automation_fixedpoint.cpp   # Differential Java parity quantization tests
        ├── test_channel_bridge.cpp          # Shared memory channel synchronization tests
        ├── test_csound_stress.cpp            # TSan/ASan live update, rebinding, and lifecycle stress test
        ├── test_zmq_idle_wakeup.cpp          # In-process control-plane wakeup test
        ├── test_csound_runtime_services.cpp  # Bounded offline message-drain test
        └── test_csound_integration.cpp       # Full end-to-end Csound audio loop tests
```

---

## Complexity Tracking

> **Constitution Check passed with zero violations.**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | N/A | N/A |
