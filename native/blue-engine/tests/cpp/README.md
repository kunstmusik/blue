# C++ Test Client

## Requirements

- CMake 3.16+
- libzmq

## Build

Build from the project root:

```bash
cd /path/to/blue-engine
cmake -B build
cmake --build build
```

## Run

```bash
./build/tests/cpp/test_client_cpp
```

## Test Coverage

The test client demonstrates:

1. **Manual Channel Updates**: Direct control channel manipulation during playback
2. **LINEAR Curve Automation**: Smooth linear interpolation from 440Hz to 880Hz over 2 seconds
3. **STEP Curve Automation**: Discrete frequency jumps at defined time points
4. **EXPONENTIAL Curve Automation**: Exponential frequency curve from 220Hz to 880Hz

All automation tests:
- Create automation in disabled state
- Play for 2 seconds with steady frequency
- Enable automation (starts at engine time 2.0 seconds)
- Run automation for 2 more seconds
- Demonstrate different interpolation curves
