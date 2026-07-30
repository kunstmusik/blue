# C Example Client

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
./build/examples/c/example_client_c
```

Run a specific test (1-5):

```bash
./build/examples/c/example_client_c --test=N
```

See `examples/README.md` for test scenario descriptions.
