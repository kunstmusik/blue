# Blue Engine Unit Tests

This directory contains unit tests for **blue-engine** that can be run via CTest.

## Running Tests

After building the project, run all tests with:

```bash
pnpm --filter @blue/engine-native test
```

To run only tests that do not require a local Csound runtime:

The workspace `test` script excludes tests labeled `requires-csound`.
Use `pnpm --filter @blue/engine-native test:integration` for the Csound 7
integration suite and `test:profiling` for the opt-in profiler configuration.

Or run specific test suites:

```bash
ctest -R JavaBigDecimal       # Decimal arithmetic and Java parity
ctest -R AutomationProtocol   # Protocol-v2 exact-resolution payloads
ctest -R AutomationManager    # Realtime state and quantization
ctest -R ChannelBridge        # Native channel bridge integration test
```

## Test Suites

### JavaBigDecimalTests and JavaBigDecimalParityTests

Tests for the bounded, allocation-free runtime decimal implementation and the
committed Java Blue corpus:

- `BigDecimal` parsing, scale, sign, rounding, division, and remainder
- Exact quantization including the descending-segment `resolution * 0.99` bias
- More than 2,000 realtime fixture cases through the production manager
- Prepared-resource evaluation with an upstream-allocation guard

### AutomationProtocolTests

Protocol-v2 request validation and little-endian boundary coverage:

- Canonical decimal text and malformed payload diagnostics
- Exact resolution round-trip through create/update requests
- Rejection of trailing bytes and non-finite point values

### AutomationStoreTests

Tests for immutable automation snapshots and realtime-safe publication:

- Fixed-capacity active definitions and revision-aware state reset
- Deferred snapshot retirement without audio-thread locks or allocation
- Zero/negative resolution as an unquantized path

### Benchmark scenarios

`benchmark_engine --scenario all` reports the common `linear_32` binary64 path
and exact-decimal paths separately (`quantized_exact_32` and
`quantized_exact_large_scale_32`). The release comparison gate allows at most a
5% median host-cycle regression for `linear_32`; exact paths are reported for
visibility and are not substituted for that common-path budget.

### ChannelBridgeTests

Integration coverage for the native Csound channel bridge:

- Pending channel values staged before compile
- `chnexport` channels rebound after orchestra compile
- Shared-memory mirror updated from live control-channel state
- Automation writes applied to native Csound control channels
- Manual writes rejected for automated channels during playback

This test is labeled `requires-csound` and is reported as skipped when the
Csound runtime is not available.

## Adding New Tests

1. Create a new test file in `tests/cpp/`
2. Add the executable and test to `tests/cpp/CMakeLists.txt`:

```cmake
add_executable(test_new_feature test_new_feature.cpp)
target_include_directories(test_new_feature PRIVATE ${CMAKE_SOURCE_DIR}/src)
set_target_properties(test_new_feature PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_test(NAME NewFeatureTests COMMAND test_new_feature)
```

For example clients in various languages, see the `examples/` directory.
