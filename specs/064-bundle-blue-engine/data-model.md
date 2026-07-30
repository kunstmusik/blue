# Data Model: Bundled Blue Engine Integration

**Feature**: `064-bundle-blue-engine`
**Date**: 2026-07-28

This feature adds build metadata and transient runtime contracts. It does not add project entities or change `.blue` XML.

## Bundled Engine Artifact

**Owner**: `@blue/engine-native` build; consumed by repository packaging scripts and Electron main
**Lifetime**: Derived build output; disposable and reproducible
**Persistence**: `native/blue-engine/dist/<platform>-<arch>/artifact.json` beside the executable

| Field | Type | Validation |
|---|---|---|
| `schemaVersion` | integer | Exactly `1` |
| `engineVersion` | semantic-version string | Matches the native package/project version |
| `protocolVersion` | positive integer | Matches `@blue/engine-client` expected version |
| `sourceRevision` | string | Non-empty Git revision or explicit `dirty:<revision>` marker for local builds |
| `platform` | `'darwin' \| 'win32' \| 'linux'` | Matches packaging target |
| `arch` | `'arm64' \| 'x64'` | Matches executable architecture |
| `executableName` | string | `blue-engine.exe` on Windows; `blue-engine` otherwise |
| `sha256` | lowercase hexadecimal string | Exactly 64 characters and matches executable bytes |
| `buildType` | `'Release'` | Release package inputs only |
| `vcpkgBaseline` | 40-character Git SHA | Matches committed `vcpkg.json` baseline |
| `vcpkgTriplet` | string | One of the supported target triplets |
| `allowedExternalDependencies` | string[] | Only documented OS/runtime classes; never contains ZeroMQ/libsodium |

**Relationships**:

- One release package consumes exactly one matching Bundled Engine Artifact.
- One Bundled Engine Artifact reports one protocol version shared with `@blue/engine-client`.
- The artifact manifest is validated before it becomes a Packaged Engine Resource.

## Packaged Engine Resource

**Owner**: `@blue/app` packaging
**Lifetime**: Installed application lifetime
**Persistence**: Application resources, not user data

| Field | Type | Validation |
|---|---|---|
| `executablePath` | absolute path | File exists; platform suffix and execute permission are correct |
| `manifest` | Bundled Engine Artifact | Platform/architecture/protocol/hash all match |
| `resourceOrigin` | `'bundled'` | Constant |

The installed path is `resources/assets/engine/blue-engine[.exe]`. Metadata may remain adjacent as `artifact.json` for diagnostics.

## Engine Selection

**Owner**: Electron main `EngineRuntimeService`
**Lifetime**: Current application session; recomputed after settings changes
**Persistence**: Only the existing `appSpecific.enginePath` override is durable

| Field | Type | Validation |
|---|---|---|
| `source` | `'environment-override' \| 'settings-override' \| 'bundled' \| 'development'` | Selected by documented precedence |
| `executablePath` | absolute path | Existing regular executable for current platform |
| `expectedProtocolVersion` | positive integer | From `@blue/engine-client` |
| `artifact` | Bundled Engine Artifact or null | Required for bundled/development artifacts |
| `diagnostic` | string or null | Human-readable reason for fallback/failure |

**Durable override interpretation**:

- `enginePath === ""` or `enginePath === "blue-engine"`: no explicit override; use bundled/development selection.
- Absolute non-empty path: explicit external override.
- Other relative value: invalid override with a recoverable diagnostic; do not silently search `PATH`.

## Engine Capabilities

**Owner**: Running Blue Engine; typed decoder in `@blue/engine-client`
**Lifetime**: One process connection
**Persistence**: None

| Field | Type | Validation |
|---|---|---|
| `schemaVersion` | integer | Exactly `1` |
| `engineVersion` | semantic-version string | Non-empty |
| `protocolVersion` | positive integer | Must equal client expectation |
| `sourceRevision` | string | Non-empty |
| `features` | string[] | Known values accepted; unknown values preserved for forward diagnostics |

Required initial features:

- `engine-state-v1`
- `channel-bridge-v1`
- `automation-v1`
- `csound-probe-v1`

## Engine Compatibility Report

**Owner**: Blue Engine loader; invoked and cached transiently by Electron main
**Lifetime**: One probe request; may be replaced on retry
**Persistence**: None

| Field | Type | Validation |
|---|---|---|
| `schemaVersion` | integer | Exactly `1` |
| `engine` | Engine Capabilities | Always present, even when Csound is unavailable |
| `csound.status` | status enum | One of the values below |
| `csound.requestedPath` | string or null | Explicit `--csound-library`/`LIBCSOUND_PATH` request, if any |
| `csound.loadedPath` | string or null | Non-empty only after successful load |
| `csound.versionRaw` | integer or null | Result from `csoundGetVersion` |
| `csound.major` | integer or null | Derived and validated |
| `csound.minor` | integer or null | Derived |
| `csound.patch` | integer or null | Derived |
| `csound.supportedMajors` | integer[] | Initially `[7]` |
| `csound.missingSymbols` | string[] | Empty when ready |
| `csound.message` | string | Stable user-facing diagnostic |
| `ready` | boolean | True only when protocol and Csound checks succeed |

`csound.status` values:

- `ready`
- `not-found`
- `load-failed`
- `missing-symbols`
- `unsupported-version`
- `internal-error`

## Engine Probe Result

**Owner**: Electron main/preload boundary
**Lifetime**: One IPC request and renderer display session
**Persistence**: None

| Field | Type | Validation |
|---|---|---|
| `ok` | boolean | True only when selection, probe execution, schema, protocol, and Csound are ready |
| `selection` | Engine Selection or null | Null only if resolution failed |
| `report` | Engine Compatibility Report or null | Null only if executable launch/output failed |
| `errorCode` | stable error enum or null | Present when `ok` is false |
| `message` | string | Always present |
| `durationMs` | non-negative integer | Probe deadline is 3000 ms |

Main-side error codes:

- `ENGINE_NOT_FOUND`
- `ENGINE_NOT_EXECUTABLE`
- `ENGINE_ARCH_MISMATCH`
- `ENGINE_PROBE_TIMEOUT`
- `ENGINE_PROBE_FAILED`
- `ENGINE_PROBE_INVALID_JSON`
- `ENGINE_PROTOCOL_MISMATCH`
- `CSOUND_UNAVAILABLE`

## State Transitions

```text
unresolved
  -> resolving
  -> resolution-failed
  -> resolved
  -> probing
  -> probe-failed
  -> incompatible
  -> ready
  -> starting
  -> connected
  -> running
  -> stopped
```

- `resolution-failed`, `probe-failed`, and `incompatible` are recoverable. A retry returns to `resolving`.
- Project state is never changed by these transitions.
- Realtime and Blue Live maintain independent `starting` through `stopped` process states but may share an immutable resolved selection.
