# C++ Example Client

## Requirements

- CMake 3.16+
- libzmq
- C++17 compiler

## Build

Build from the project root:

```bash
cd /path/to/blue-engine
cmake -B build
cmake --build build
```

## Run

```bash
./build/examples/cpp/example_client_cpp
```

Run a specific test (1-5):

```bash
./build/examples/cpp/example_client_cpp --test=N
```

See `examples/README.md` for test scenario descriptions.
