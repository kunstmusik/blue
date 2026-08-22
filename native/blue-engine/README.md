# blue-engine

A C++ audio engine wrapping Csound's C API, controlled via ZeroMQ commands with shared memory exposed as a fast read mirror of native Csound control channels.

Blue Engine is maintained as native source within the Blue Electron monorepo.
Build it through the private `@blue/engine-native` pnpm workspace package.
The application uses the verified workspace artifact in development and the
bundled resource in installed builds; a system-installed `blue-engine` is not
required or searched for.

## Runtime Requirements

- **Csound 7** - loaded dynamically at runtime and required only for engine-backed audio operations, not for building or opening Blue
  - macOS: Install from [csound.com](https://csound.com/download.html) or `brew install csound`
  - Windows: Install from [csound.com](https://csound.com/download.html)
  - Linux: `sudo apt install csound` or equivalent

## Build Dependencies

- Node.js 22 and pnpm 10
- CMake 3.21 or newer
- A supported C/C++ toolchain

The first native build automatically bootstraps the committed vcpkg baseline
into the ignored `native/blue-engine/.vcpkg/` directory. Set `VCPKG_ROOT` only
when you want to use an already-bootstrapped checkout, such as a CI cache.

Linux release artifacts are built on Ubuntu 22.04 with a maximum required
glibc symbol version of 2.35. The verifier reports and rejects a higher floor.
This baseline targets contemporary Debian/Ubuntu, Arch/Manjaro, and
Fedora/RHEL-family distributions; the AppImage does not require FUSE 2 and can
also run through its extract-and-run path.

ZeroMQ and its distributable dependencies are acquired through the committed
vcpkg manifest and statically linked. Do not rely on Homebrew, apt, a global
vcpkg installation, or shared ZeroMQ libraries for release artifacts.

## Building

```bash
pnpm install
pnpm --filter @blue/engine-native build
```

The verified executable and manifest are written to
`dist/<platform>-<arch>/`. From the repository root, `pnpm build` builds this
package before `@blue/app`. No `VCPKG_ROOT` configuration is required for a
normal developer checkout; the first build requires network access to acquire
the pinned vcpkg source and native dependencies.

### Build Options

| Option | Default | Description |
|--------|---------|-------------|
| `USE_PERFORMANCE_TRACKING` | OFF | Compile bounded runtime performance diagnostics into the engine |
| `BUILD_EXAMPLES` | OFF | Build standalone protocol examples |

## Running

```bash
./blue-engine [--port 5555] [--pub-port 5556] [--control-endpoint ipc:///tmp/blue-engine-control.ipc] [--pub-endpoint ipc:///tmp/blue-engine-pub.ipc] [--shm blue-engine]
```

- `--port` exposes the control-plane REQ/REP socket.
- `--pub-port` exposes the engine-state PUB socket and defaults to `port + 1`.
- `--control-endpoint` and `--pub-endpoint` let you bind alternate ZeroMQ transports such as `ipc://...`.
- `ipc` transport works on macOS and Linux, but not on Windows with the current libzmq support model.

### Csound runtime one-shot services

The same executable also owns the application Csound boundary for discovery and
offline work. These modes do not start ZeroMQ and exit after one request:

```bash
# Probe the selected Csound library and print one JSON document.
./blue-engine --probe-csound --json [--csound-library /absolute/path]

# Enumerate modules; add one selected module to query only that backend's devices.
./blue-engine --list-io --json [--audio-module pa_bl] [--midi-module portmidi]

# Run a registered Csound utility without a shell.
./blue-engine --run-utility sndinfo -- path/to/file.aif

# Compile and perform an argument-driven Csound workload without a shell.
./blue-engine --run-csound -- -n path/to/workload.csd
```

`csound-io-v1`, `csound-utility-v1`, and `csound-performance-v1` are advertised
in the capabilities report. The application checks those feature names before
dispatching a request. Discovery JSON is written only to stdout; Csound
messages and diagnostics remain on stderr so warnings cannot corrupt the
machine-readable response. Empty device arrays are successful results.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `LIBCSOUND_PATH` | Override Csound library location |

## Testing

```bash
pnpm --filter @blue/engine-native test
pnpm --filter @blue/engine-native test:profiling
pnpm --filter @blue/engine-native test:integration
```

Unit tests do not require Csound. The integration suite requires Csound 7.

## Channel Model

- Orchestra code should use standard Csound channel exports such as `chnexport`.
- `CREATE_CHANNEL` and `SET_CHANNEL` stage values before compile and write through to native Csound control channels after compile.
- `GET_CHANNEL` returns the current live channel value when available, falling back to staged values before export.
- `GET_SHM_NAME` exposes the shared-memory mirror for fast external reads.
- Manual writes to an enabled automated channel are rejected while playback is running.

## Protocol

Binary protocol over two ZeroMQ transports:

- REQ/REP control socket for commands and polling snapshots.
- PUB/SUB event socket for engine lifecycle snapshots.

### Request Format

```
┌──────────┬──────────┬─────────────────┐
│ cmd (1B) │ len (4B) │ payload (varlen)│
└──────────┴──────────┴─────────────────┘
```

### Response Format

```
┌────────────┬──────────┬─────────────────┐
│ status (1B)│ len (4B) │ payload (varlen)│
└────────────┴──────────┴─────────────────┘
```

### Commands

| Code | Command | Payload (request) |
|------|---------|-------------------|
| 0x01 | CREATE_ENGINE | none |
| 0x02 | COMPILE_ORC | orchestra string (UTF-8) |
| 0x03 | READ_SCORE | score string (UTF-8) |
| 0x04 | SET_OPTION | option string (UTF-8) |
| 0x05 | START | none |
| 0x06 | STOP | none |
| 0x07 | DESTROY_ENGINE | none |
| 0x08 | GET_ENGINE_STATE | none (response: JSON state snapshot) |
| 0x09 | GET_CAPABILITIES | none (response: immutable engine/protocol/features JSON) |
| 0x10 | SET_CHANNEL | `name\0` + double value (8B) |
| 0x11 | GET_CHANNEL | `name\0` (response: double value) |
| 0x12 | CREATE_CHANNEL | `name\0` + initial double value (8B) |
| 0x13 | GET_SHM_NAME | none (response: shared memory name as UTF-8) |
| 0x20 | CREATE_AUTOMATION | `channel\0` + curve(1B) + enabled(1B) + resolutionLength(u32-le) + canonical resolution text (UTF-8) + n_points(u32-le) + points(time,value) pairs (16B each, f64-le) |
| 0x21 | UPDATE_AUTOMATION | same payload as CREATE_AUTOMATION |
| 0x22 | DELETE_AUTOMATION | `channel\0` |
| 0x23 | ENABLE_AUTOMATION | `channel\0` |
| 0x24 | DISABLE_AUTOMATION | `channel\0` |
| 0x25 | LIST_AUTOMATIONS | none (response: count + entries) |
| 0x26 | CLEAR_AUTOMATIONS | none |

`GET_SHM_NAME` returns a mirror of current scalar control-channel state. It is not the source of truth for channel writes.

### Engine State Events

The PUB socket emits multipart messages on topic `engine.state` whenever the engine lifecycle changes.

- Frame 1: topic string `engine.state`
- Frame 2: UTF-8 JSON payload

Example payload:

```json
{
  "state": "stopped",
  "stopReason": "completed",
  "engineCreated": true,
  "running": false,
  "sampleFrames": 88200,
  "sampleRate": 44100,
  "ksmps": 64,
  "sequence": 3,
  "lastError": ""
}
```

`GET_ENGINE_STATE` returns the same JSON schema on the control socket for polling and reconciliation.

### Status Codes

| Code | Meaning |
|------|---------|
| 0x00 | OK |
| 0x01 | ERROR (payload contains error message) |

### Automation protocol version

Automation decimal resolution is part of protocol version 2 and is advertised
by the `automation-decimal-v1` capability. `CREATE_AUTOMATION` and
`UPDATE_AUTOMATION` use the same payload shape:

```
channel\0 + curve (1B) + enabled (1B) +
resolutionLength (u32 little-endian) + canonical ASCII resolution +
n_points (u32 little-endian) + n_points × (time f64 little-endian, value f64 little-endian)
```

The resolution is an exact Java-compatible decimal string. It is not a binary
floating-point value and there are no behavioral `resolutionScale` or
`highPrecision` fields. Automation times, values, bounds, and channel values
remain binary64.

## Test Clients

Test clients are provided in multiple languages:

- `tests/c/` - C client
- `tests/cpp/` - C++ client
- `tests/python/` - Python client
- `tests/java/` - Java client
- `tests/rust/` - Rust client
- `tests/javascript/` - Node.js client

Each client exercises a common set of 5 tests:

- Test 1: Manual channel updates on exported `freq`/`amp` control channels.
- Test 2: LINEAR automation.
- Test 3: STEP automation.
- Test 4: EXPONENTIAL automation (and basic list/clear operations).
- Test 5: LINEAR automation with a non-zero **resolution** to audibly quantize the parameter.

Most clients accept a `--test=N` flag to run a specific test; see `tests/README.md` and the per-language READMEs under `tests/` for build and usage details.

## License

MIT
