# Phase 1 Data Model: OSC Control Parity

## Overview

OSC support adds one durable program preference and three transient runtime concepts. It does not modify `BlueData`, project snapshots, or `.blue` XML.

```text
OSC Server Preferences (durable)
        │ configure/restart
        ▼
OSC Listener Runtime (main-process transient)
        │ decodes UDP packets
        ▼
OSC Command Event (IPC transient)
        │ ordered primary-renderer execution
        ▼
Existing project / playback / Blue Live actions
```

## Entity: OSC Server Preferences

App-wide durable settings owned by the main-process program-settings store.

| Field | Type | Rules | Default |
|-------|------|-------|---------|
| `preferredPort` | integer | Inclusive range 1-65535 | `8000` |

### Validation

- Settings input may temporarily be text while the user edits it, but Apply is valid only when the complete value represents a base-10 integer from 1 through 65535.
- Blank, fractional, signed-out-of-range, nonnumeric, and non-finite values are invalid.
- Invalid drafts do not update the settings file or restart the listener.
- The active fallback port is never written into `preferredPort`.

### Migration

When normalizing a settings document from before the OSC settings section:

1. If a valid structured `osc.preferredPort` exists, normalize and retain it.
2. Otherwise, if `appSpecific.oscInputPort` is an integer from 1 through 65535, copy it into `osc.preferredPort`.
3. Otherwise, initialize `osc.preferredPort` to 8000.
4. Preserve existing `appSpecific.oscInputPort`, `appSpecific.oscOutputHost`, and `appSpecific.oscOutputPort` fields. They are not active OSC output configuration.
5. Increment the program-settings schema version; do not rewrite `.blue` files.

Reset Panel sets `preferredPort` to 8000 through the existing immediate reset flow. Cancel discards the renderer draft and has no persistence or listener effect.

## Entity: OSC Listener Runtime Snapshot

A serializable, read-only view of the main-process listener published to Settings and other interested application windows.

| Field | Type | Meaning |
|-------|------|---------|
| `phase` | `stopped \| starting \| listening \| restarting \| error` | Current lifecycle phase |
| `preferredPort` | integer | Saved candidate at which the current/last bind sequence began |
| `activePort` | integer or `null` | Bound port only while listening |
| `fallbackFrom` | integer or `null` | Preferred port when `activePort` differs; otherwise null |
| `lastBindError` | diagnostic or `null` | Most recent terminal bind failure or exhaustion detail |
| `lastPacketError` | diagnostic or `null` | Most recent malformed-packet diagnostic; non-fatal |
| `revision` | nonnegative integer | Monotonic change counter for snapshot ordering |
| `updatedAt` | ISO-8601 string | Time the published state last changed |

### Diagnostic Shape

| Field | Type | Meaning |
|-------|------|---------|
| `code` | string or `null` | Stable OS/parser code when available |
| `message` | string | Human-readable, sanitized description |
| `port` | integer or `null` | Candidate port involved, when applicable |

Diagnostics must not include raw datagram contents or unbounded exception data.

### Derived UI State

- `phase === "listening" && activePort === preferredPort`: listening on preferred port.
- `phase === "listening" && activePort !== preferredPort`: listening on fallback; show both ports and conflict explanation.
- `phase === "starting" || phase === "restarting"`: transitional status; no active-port claim until bind succeeds.
- `phase === "error"`: not listening; show `lastBindError` and keep Settings usable.
- `lastPacketError` may coexist with `listening` and is presented as a non-disruptive diagnostic.

## Entity: OSC Command Definition

An immutable registry entry used for address matching and event creation.

| Field | Type | Rules |
|-------|------|-------|
| `id` | `OscCommandId` | Unique internal identifier |
| `addressPrefix` | string | Case-sensitive OSC path prefix |

### Command Identifier Set

```text
score.play
score.stop
score.rewind
score.markerNext
score.markerPrevious
blueLive.onOff
blueLive.recompile
blueLive.allNotesOff
```

The registry order is the table order above. The first definition for which `receivedAddress.startsWith(addressPrefix)` is true wins and runs once. `/blueLive/toggleMidiInput` has no definition and therefore cannot create a command event.

## Entity: OSC Command Event

A serializable main-to-primary-renderer event created only after a packet address matches the registry.

| Field | Type | Meaning |
|-------|------|---------|
| `sequence` | positive integer | Monotonic event order for one listener-service lifetime |
| `commandId` | `OscCommandId` | Action to execute |
| `receivedAddress` | string | Original matched address, including any accepted suffix |
| `receivedAt` | ISO-8601 string | Datagram decode/dispatch time |

OSC arguments, sender address, and bundle timetag are intentionally absent because command behavior must not depend on them. The renderer processes events in sequence through one promise chain.

## Internal Value: Decoded OSC Packet

The decoder's message/bundle representation stays inside the main-process service.

- A message supplies an address and zero or more ignored arguments.
- A bundle supplies zero or more child packets and an ignored timetag.
- Bundles are recursively flattened depth-first in stored child order.
- Unknown/case-mismatched messages yield no command event.
- Decoder failures update `lastPacketError` without moving the listener out of `listening`.

## Listener State Transitions

```text
stopped ──start──▶ starting ──bind success──▶ listening
   ▲                   │                         │
   │                   └──terminal failure──▶ error
   │                                             │
   └──────────────────────── stop ───────────────┘

listening/error ──preference Apply or Reset──▶ restarting
restarting ──bind success──▶ listening
restarting ──terminal failure──▶ error
any phase ──shutdown──▶ stopped
```

### Bind Candidate Algorithm

1. Capture the normalized preferred port and lifecycle generation.
2. Attempt an actual `udp4` bind to `0.0.0.0` at the candidate.
3. On success, publish `listening`; set `fallbackFrom` only if candidate differs from preferred.
4. On `EADDRINUSE` below 65535, close/discard that socket, increment candidate, and retry.
5. On `EADDRINUSE` at 65535, publish `error` for exhausted range.
6. On any other failure, publish `error` immediately.
7. Ignore late callbacks whose generation is no longer current.

## Runtime Invariants

- At most one current UDP socket can accept packets.
- `activePort` is non-null only in the listening phase.
- `fallbackFrom` is non-null only when listening above the preferred port.
- Restart and shutdown complete old socket closure before a new bind or app exit completes.
- No command event is emitted after shutdown begins or from a stale socket generation.
- Packet decode and command execution errors do not automatically restart or close a healthy listener.
- Command events are delivered to one primary renderer consumer and executed once in received order.
