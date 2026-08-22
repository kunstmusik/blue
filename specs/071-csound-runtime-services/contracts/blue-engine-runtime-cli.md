# Contract: Blue Engine Csound Runtime CLI

## Capability Names

Blue Engine adds these feature strings to its existing capability document:

```text
csound-io-v1
csound-utility-v1
csound-performance-v1
```

They are additive. `BLUE_ENGINE_PROTOCOL_VERSION` remains `1` because the ZeroMQ command set and framing are unchanged.

## General Rules

- Each mode is one-shot: it MUST exit before any ZeroMQ bind, shared-memory creation, or realtime engine construction.
- `--csound-library` is optional and MUST be an absolute native filesystem path.
- An exact `--` separates Blue Engine options from Csound/utility arguments.
- Arguments after `--` are preserved as individual byte strings; Blue Engine does not invoke a shell.
- Invalid syntax exits `64` and writes usage diagnostics to stderr.
- Csound load/symbol/version failure exits `2`.
- Internal host failure exits `70`.
- Normal execution result `0` means success; `1` means Csound compile/perform/utility failure; `65` means a requested module or utility is unavailable.

## I/O Discovery

```text
blue-engine --list-io --json \
  [--csound-library <absolute-path>] \
  [--audio-module <exact-name>] \
  [--midi-module <exact-name>]
```

Rules:

- `--json` is mandatory.
- Without selected modules, the command enumerates module names and returns empty device arrays.
- With `--audio-module`, it selects and queries only that module's audio input and output devices.
- With `--midi-module`, it selects and queries only that module's MIDI input and output devices.
- A device count of zero is a successful empty array. A negative count is a scoped query failure.
- Stdout is exactly one UTF-8 JSON object followed by a newline. Csound/backend messages and human diagnostics go to stderr.
- The command exits `0` only when Csound is ready and every requested device query succeeds. It may still return zero devices.

### Schema

```json
{
  "schemaVersion": 1,
  "engine": {
    "schemaVersion": 1,
    "engineVersion": "0.1.0",
    "protocolVersion": 1,
    "sourceRevision": "revision",
    "features": [
      "csound-probe-v1",
      "csound-io-v1",
      "csound-utility-v1",
      "csound-performance-v1"
    ]
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
  "audioModules": [
    { "name": "auhal", "kind": "audio" }
  ],
  "midiModules": [
    { "name": "coremidi", "kind": "midi" }
  ],
  "selectedAudioModule": "auhal",
  "selectedMidiModule": "coremidi",
  "audioInputs": [
    {
      "kind": "audio",
      "direction": "input",
      "module": "auhal",
      "deviceId": "0",
      "displayName": "Built-in Microphone",
      "interfaceName": null,
      "maxChannels": 2
    }
  ],
  "audioOutputs": [],
  "midiInputs": [],
  "midiOutputs": [],
  "diagnostics": []
}
```

The unavailable-Csound response retains the same engine and Csound compatibility shapes, returns empty arrays, includes a runtime diagnostic, and exits `2`.

## Utility Execution

```text
blue-engine --run-utility <utility-name> \
  [--csound-library <absolute-path>] -- [utility-args...]
```

Rules:

- The utility name is a Csound utility identifier, not an executable path. It cannot contain NUL or path separators.
- Blue Engine verifies the name against the utilities registered by the active Csound instance.
- The host calls `csoundRunUtility()` directly. It does not create a `-U` command line or launch another process.
- The native utility argument vector begins with the utility name followed by the exact arguments after `--`.
- Csound messages are written to stderr as they become available or immediately after the synchronous utility returns.
- Blue Engine resets and destroys the Csound instance for every terminal path.
- SIGTERM/SIGINT may terminate a synchronous utility process; the parent maps a requested termination to cancellation.

Example:

```text
blue-engine --run-utility sndinfo -- examples/techniques/hellorcb.aif
```

## Offline Performance Execution

```text
blue-engine --run-csound \
  [--csound-library <absolute-path>] -- [csound-args...]
```

Rules:

- Blue Engine internally prepends `argv[0] = "csound"`; all caller arguments follow unchanged.
- Lifecycle is `csoundCompile` → `csoundStart` → repeated `csoundPerformKsmps` → `csoundReset` → destroy.
- Compile or start failure skips performance but still drains messages and resets/destroys the instance.
- Csound messages are drained to stderr during compilation and after each performance block. This preserves existing progress-line handling.
- The process working directory is set by Electron when spawning Blue Engine. Blue Engine MUST NOT globally rewrite native path arguments.
- SIGTERM/SIGINT marks the operation for termination. If graceful Csound stop is unavailable or a synchronous native call is blocked, operating-system process termination remains authoritative.

## Message and JSON Safety

- JSON discovery creates the Csound message buffer with direct output disabled.
- Native strings are NUL-safe and JSON-escaped for backslash, quote, control characters, and newlines.
- No Csound message may be concatenated to the JSON stdout document.
- Execution modes do not emit a terminal JSON object; their process exit status and streamed stdout/stderr form the contract.

## Native Verification

- Fake-function-table tests cover all lifecycle and serialization branches without an installed Csound library.
- Installed-Csound tests may skip with the repository's existing `77` convention when Csound is absent.
- Device integration asserts schema and type consistency only; a machine with zero devices is valid.
- Utility integration uses `sndinfo` and `examples/techniques/hellorcb.aif`.
- Performance integration uses a minimal null-audio CSD and verifies a complete lifecycle.
