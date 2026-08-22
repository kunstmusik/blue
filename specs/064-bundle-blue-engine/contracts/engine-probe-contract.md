# Contract: Engine Capabilities and Csound Probe

## Shared Protocol Version

The C++ engine and `@blue/engine-client` expose one integer `BLUE_ENGINE_PROTOCOL_VERSION`. The initial bundled contract is version `1`.

The running engine implements `GET_CAPABILITIES` at command byte `0x09`. Its response uses the existing protocol envelope:

```text
[status: uint8][payload_length: uint32 little-endian][UTF-8 JSON payload]
```

Successful payload:

```json
{
  "schemaVersion": 1,
  "engineVersion": "0.1.0",
  "protocolVersion": 1,
  "sourceRevision": "0123456789abcdef",
  "features": [
    "engine-state-v1",
    "channel-bridge-v1",
    "automation-v1",
    "csound-probe-v1"
  ]
}
```

`EngineClient.connect()` establishes sockets but no engine object. Before `CREATE_ENGINE`, the caller MUST request capabilities and compare `protocolVersion` with the client constant. Mismatch is fatal for that session and MUST close the connection without compiling or starting Csound.

## CLI Probe

```text
blue-engine --probe-csound --json [--csound-library <absolute-path>]
```

Rules:

- The probe MUST NOT bind ZeroMQ, create shared memory, or start a performance.
- It writes exactly one JSON object to stdout. Human diagnostics go to stderr.
- `--csound-library` takes precedence over `LIBCSOUND_PATH`; default platform search follows.
- Engine capability fields are present even when Csound fails.
- The probe process has a 3-second application deadline.
- A new probe process is used for retry so the loader's in-process cache cannot preserve an old failure.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Engine protocol and Csound are ready |
| `2` | Structured Csound not-found/load/symbol/version failure |
| `64` | Invalid command-line usage |
| `70` | Internal probe failure |

Successful example:

```json
{
  "schemaVersion": 1,
  "engine": {
    "schemaVersion": 1,
    "engineVersion": "0.1.0",
    "protocolVersion": 1,
    "sourceRevision": "0123456789abcdef",
    "features": ["engine-state-v1", "channel-bridge-v1", "automation-v1", "csound-probe-v1"]
  },
  "csound": {
    "status": "ready",
    "requestedPath": null,
    "loadedPath": "/Library/Frameworks/CsoundLib64.framework/CsoundLib64",
    "versionRaw": 7000,
    "major": 7,
    "minor": 0,
    "patch": 0,
    "supportedMajors": [7],
    "missingSymbols": [],
    "message": "Csound 7 is ready"
  },
  "ready": true
}
```

Unavailable example:

```json
{
  "schemaVersion": 1,
  "engine": {
    "schemaVersion": 1,
    "engineVersion": "0.1.0",
    "protocolVersion": 1,
    "sourceRevision": "0123456789abcdef",
    "features": ["engine-state-v1", "channel-bridge-v1", "automation-v1", "csound-probe-v1"]
  },
  "csound": {
    "status": "not-found",
    "requestedPath": null,
    "loadedPath": null,
    "versionRaw": null,
    "major": null,
    "minor": null,
    "patch": null,
    "supportedMajors": [7],
    "missingSymbols": [],
    "message": "No supported Csound library was found"
  },
  "ready": false
}
```

## Loader Search Contract

Search is deterministic:

1. `--csound-library`
2. `LIBCSOUND_PATH`
3. Platform candidates

Platform candidates include:

- macOS: Csound framework locations and Homebrew Intel/Apple Silicon library locations
- Windows: Csound 7 x64 installation location, then safe system/application registration candidates; the current working directory is not an implicit search source
- Linux: supported unversioned and versioned `libcsound64.so` SONAMEs across `/usr/lib`, `/usr/lib64`, `/usr/local/lib`, and standard multiarch locations

The loader resolves all required symbols, including `csoundGetVersion`, before reporting ready. Initial support is Csound major version 7.

## TypeScript Decoder Rules

`@blue/engine-client` owns strict decoders for capabilities and the probe report:

- Reject non-object JSON, missing required fields, unsupported `schemaVersion`, non-integer protocol/version values, and inconsistent `ready/status` combinations.
- Preserve unknown feature strings.
- Never coerce a protocol mismatch into a warning.
- Return a typed failure; do not throw raw JSON parser errors across IPC.
