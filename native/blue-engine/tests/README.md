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
ctest -R FixedPoint           # Run FixedPoint tests
ctest -R AutomationFixedPoint # Run Automation FixedPoint tests
ctest -R ChannelBridge        # Run native channel bridge integration test
```

## Test Suites

### FixedPointTests

Tests for the `FixedPoint` class which provides BigDecimal-compatible arithmetic:

- Basic construction and conversion
- Arithmetic operations (add, subtract, remainder)
- `setScale` with various rounding modes (FLOOR, CEILING, DOWN, UP, HALF_UP, etc.)
- Quantization behavior matching Java BigDecimal

### QuantizationTests

Tests for the quantization logic used in AutomationManager:

- Fast path (double-based) quantization
- High-precision path (FixedPoint-based) quantization
- Descending segment bias behavior
- Consistency between fast and high-precision modes

### AutomationStoreTests

Tests for AutomationStore with resolution parameters:

- Create and update automations with resolution
- Resolution scale and high-precision flag storage
- Automation listing and retrieval

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
