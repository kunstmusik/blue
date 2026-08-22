# Quickstart: Blue Engine Performance & Verification Guide

**Feature**: `072-blue-engine-performance`  
**Date**: 2026-08-13  
**Status**: Validated locally (macOS arm64)  

---

## 1. Overview & Prerequisites

This guide provides step-by-step instructions for building, running tests, executing the Release benchmark matrix, evaluating regression gates, and stress testing the performance optimizations in `native/blue-engine`.

### Prerequisites
- **Compiler**: Clang (macOS / Linux) or MSVC 2022 (Windows), C++17 compliant.
- **Build Tools**: CMake 3.21+, Ninja, vcpkg.
- **Csound**: Csound 7 installed and discoverable via `CSOUND_LIB_DIR` or system library paths.
- **Node & pnpm**: Node.js 22.x, pnpm 10.x.

---

## 2. Building Blue Engine

### 2.1 Release Build with Performance Tracking (for Benchmarking)
```bash
# From workspace root
cd native/blue-engine

# Configure CMake with Release and Performance Tracking enabled
cmake --preset macos-arm64 \
  -DCMAKE_BUILD_TYPE=Release \
  -DUSE_PERFORMANCE_TRACKING=ON

# Build the engine and benchmark targets
cmake --build --preset macos-arm64 --target blue-engine benchmark_engine
```

### 2.2 Standard Release Build (for Distribution Verification)
```bash
cmake --preset macos-arm64 \
  -DCMAKE_BUILD_TYPE=Release \
  -DUSE_PERFORMANCE_TRACKING=OFF

cmake --build --preset macos-arm64 --target blue-engine
```

---

## 3. Running Unit and Integration Tests

### 3.1 C++ Unit Tests
```bash
# Run all unit tests (FixedPoint, AutomationManager, Quantization, EngineCapabilities)
ctest --test-dir build-macos-arm64 --output-on-failure -E "integration"
```

### 3.2 Integration Tests (requires Csound 7 & Shared Memory)
```bash
# Run channel bridge and full Csound integration tests
ctest --test-dir build-macos-arm64 --output-on-failure -L "integration"
```

### 3.3 TypeScript Host Bridge Tests
```bash
# From workspace root
pnpm --filter @blue/engine-client test
pnpm --filter @blue/app test
```

The repository-level `pnpm test` and `pnpm lint` commands cover the complete
workspace. Shared-memory-dependent native tests require host POSIX shared-memory
access; when that capability is unavailable, CTest reports those tests as
skipped rather than failing the unit suite.

---

## 4. Executing the Release Benchmark Matrix

### 4.1 Run Baseline Benchmark
```bash
# Execute benchmark suite on baseline build and save machine-readable results
mkdir -p benchmarks
./build-macos-arm64/benchmark_engine \
  --output ./benchmarks/baseline-results.json \
  --trials 5 \
  --warmup-cycles 1024 \
  --measure-cycles 4096
```

### 4.2 Run Candidate Benchmark
```bash
# Execute benchmark suite on candidate build
./build-macos-arm64/benchmark_engine \
  --output ./benchmarks/candidate-results.json \
  --compare ./benchmarks/baseline-results.json \
  --trials 5 \
  --warmup-cycles 1024 \
  --measure-cycles 4096
```

### 4.3 Evaluate Performance Regression Gate
The benchmark runner automatically evaluates against the feature's quantitative gates:
- **Primary Gain Gate**: At least a 10% reduction in median host overhead for targeted workloads.
- **Unaffected Workload Gate**: No more than a 5% p95 regression on unaffected workloads.
- **Spike Gate**: Spike counts (>500 µs auto/shm, >1,000 µs host cycle) must not increase unexpectedly.

Sample output:
```text
=== Benchmark Summary: Candidate vs Baseline ===
[PASS] Static 256 Channels:       SHM Sync -94.2%  (0.48 µs -> 0.03 µs)
[PASS] Exponential 128 Envelopes: Automation -28.4% (3.12 µs -> 2.23 µs)
[PASS] Quantized 128 Envelopes:   Automation -31.1% (4.05 µs -> 2.79 µs)
[PASS] Completed 256 Envelopes:   Automation -82.6% (2.85 µs -> 0.49 µs)
[PASS] Empty Workload (0/0):      Host Loop -12.3% (0.16 µs -> 0.14 µs)
[PASS] Changing 256 Channels:     Host Loop +1.8%  (Within 5.0% regression gate)
=== ALL PERFORMANCE GATES PASSED ===
```

---

## 5. Concurrent Stress Testing

Run the 10-minute real-time safety stress test that validates live orchestra recompilation, high-rate automation updates (~30 Hz), channel binding invalidation, stop, and restart:
```bash
./build-macos-arm64/tests/cpp/test_csound_stress \
  --duration-seconds 600
```

Configure the stress target with one sanitizer at a time for race/lifetime
validation (the regular CTest run uses a two-second smoke duration):
```bash
cmake --preset macos-arm64 -DCMAKE_BUILD_TYPE=RelWithDebInfo -DENABLE_TSAN=ON
cmake --build --preset macos-arm64 --target test_csound_stress
TSAN_OPTIONS=halt_on_error=1 ./build-macos-arm64/tests/cpp/test_csound_stress --duration-seconds 600
```
Use `-DENABLE_SANITIZERS=ON` instead for AddressSanitizer/UndefinedBehaviorSanitizer.

Verification criteria:
- **0** crashes, segfaults, or deadlocks
- **0** data races under ThreadSanitizer (`-fsanitize=thread`)
- **0** missed final control values or unrecovered channel bindings

Local completion evidence for this feature is a 13/13 Release CTest pass on
macOS arm64, a 23-scenario × 5-trial benchmark artifact, and bounded one-second
ASan/UBSan and TSan stress smokes. The full 600-second soak and other supported
platform Release matrices remain maintainer-run checks.
