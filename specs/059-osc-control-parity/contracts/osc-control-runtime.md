# OSC Control Runtime Contract

## Purpose

This contract defines the shared TypeScript shapes and Electron IPC boundary for the inbound OSC listener. Names may be adjusted to existing code conventions during implementation, but behavior and field semantics are normative.

## Program Settings Contract

```ts
export interface OscServerPreferences {
  preferredPort: number;
}

export interface ProgramSettingsSnapshot {
  // existing fields...
  osc: OscServerPreferences;
}
```

`preferredPort` is an integer from 1 through 65535. Its default and Reset Panel value are 8000. The `OSC` panel identifier appears immediately after `MIDI` in `PROGRAM_SETTINGS_PANEL_ORDER`.

Legacy `appSpecific.oscInputPort`, `oscOutputHost`, and `oscOutputPort` remain readable/preserved. They are not included in the new panel's editable contract except that a valid nonzero legacy input port seeds `osc.preferredPort` during migration.

## Shared Runtime Types

```ts
export type OscServerPhase =
  | "stopped"
  | "starting"
  | "listening"
  | "restarting"
  | "error";

export interface OscRuntimeDiagnostic {
  code: string | null;
  message: string;
  port: number | null;
}

export interface OscServerRuntimeSnapshot {
  phase: OscServerPhase;
  preferredPort: number;
  activePort: number | null;
  fallbackFrom: number | null;
  lastBindError: OscRuntimeDiagnostic | null;
  lastPacketError: OscRuntimeDiagnostic | null;
  revision: number;
  updatedAt: string;
}

export type OscCommandId =
  | "score.play"
  | "score.stop"
  | "score.rewind"
  | "score.markerNext"
  | "score.markerPrevious"
  | "blueLive.onOff"
  | "blueLive.recompile"
  | "blueLive.allNotesOff";

export interface OscCommandEvent {
  sequence: number;
  commandId: OscCommandId;
  receivedAddress: string;
  receivedAt: string;
}
```

All runtime objects crossing IPC must be structured-clone-safe and contain no `Error`, socket, decoder, callback, or Node buffer objects.

## Command Registry Contract

| Registration order | Prefix | Command ID |
|--------------------|--------|------------|
| 1 | `/score/play` | `score.play` |
| 2 | `/score/stop` | `score.stop` |
| 3 | `/score/rewind` | `score.rewind` |
| 4 | `/score/markerNext` | `score.markerNext` |
| 5 | `/score/markerPrevious` | `score.markerPrevious` |
| 6 | `/blueLive/onOff` | `blueLive.onOff` |
| 7 | `/blueLive/recompile` | `blueLive.recompile` |
| 8 | `/blueLive/allNotesOff` | `blueLive.allNotesOff` |

Matching is case-sensitive and uses first registered prefix. Arguments are ignored. Recognized message suffixes are accepted. Bundle children are recursively processed in packet order and timetags do not delay dispatch.

The following is an explicit negative contract:

```text
/blueLive/toggleMidiInput -> no match, no event, no MIDI state change
```

Unknown, case-mismatched, and malformed input produces no command event. Malformed input may update the listener diagnostic snapshot.

## Electron IPC Channels

Suggested channel constants:

```ts
export const OSC_CONTROL_GET_SNAPSHOT = "osc-control:get-snapshot";
export const OSC_CONTROL_SNAPSHOT_CHANGED = "osc-control:snapshot-changed";
export const OSC_CONTROL_COMMAND = "osc-control:command";
```

### `osc-control:get-snapshot`

- Direction: renderer to main via `ipcRenderer.invoke`.
- Request: no payload.
- Response: current `OscServerRuntimeSnapshot`.
- Availability: application windows only through the preload bridge.

### `osc-control:snapshot-changed`

- Direction: main to renderer via `webContents.send`.
- Payload: complete `OscServerRuntimeSnapshot`, not a partial patch.
- Recipients: all live Blue application/settings windows that need to display status.
- Ordering: consumers discard any snapshot with a lower `revision` than the latest observed snapshot for the service lifetime.

### `osc-control:command`

- Direction: main to renderer via `webContents.send`.
- Payload: one `OscCommandEvent`.
- Recipient: primary workbench renderer only.
- Delivery rule: no event is sent when the primary renderer is absent/destroyed or app shutdown has begun; auxiliary/Settings windows do not execute commands.
- Execution rule: the primary renderer queues event work by arrival order and catches each command failure so later commands can continue.

## Preload Contract

```ts
interface BlueAPI {
  // existing APIs...
  getOscServerSnapshot(): Promise<OscServerRuntimeSnapshot>;
  onOscServerSnapshot(
    listener: (snapshot: OscServerRuntimeSnapshot) => void,
  ): () => void;
  onOscCommand(listener: (event: OscCommandEvent) => void): () => void;
}
```

Each subscription returns an idempotent unsubscribe function. Listener arguments are validated/sanitized at the shared/main boundary before use.

## Settings Apply/Cancel/Reset Contract

- **Apply valid unchanged value**: persist normally; no listener restart is required.
- **Apply valid changed value**: persist settings, then serialize a listener restart from the new preferred port. Snapshot transitions through `restarting` to `listening` or `error`.
- **Apply invalid value**: disabled/rejected before persistence; listener remains unchanged.
- **Cancel**: discard draft; listener and saved settings remain unchanged.
- **Reset Panel**: immediately persist default 8000 using the existing reset behavior, then restart listener from 8000.
- A settings window never binds or closes a socket directly.

## Listener Lifecycle Contract

- Startup creates one service and attempts the saved preferred port even when no project is loaded.
- Bind address/family is `0.0.0.0`/`udp4`.
- Only an error with code `EADDRINUSE` advances to the next integer port.
- Candidate scanning stops after 65535 and never wraps.
- A successful fallback remains active until the next explicit start/restart.
- Restart and shutdown invalidate the old socket generation before accepting new commands.
- App shutdown awaits socket close before completing quit cleanup.
- No OSC acknowledgment or outbound packet is sent.

## Renderer Action Contract

| Command ID | Existing/new action contract |
|------------|------------------------------|
| `score.play` | If a project exists, flush pending project patches, then perform explicit fresh regular playback (stop/restart if already active). |
| `score.stop` | Stop regular playback even without a loaded project; never stop Blue Live. |
| `score.rewind` | Reuse canonical rewind action: render start 0, render end open-ended, visible state updated. |
| `score.markerNext` | Reuse strict-next-marker/score-end action and score view follow; no-op without project. Flush its patch before a later queued play. |
| `score.markerPrevious` | Reuse strict-previous-marker/zero action and score view follow; no-op without project. Flush its patch before a later queued play. |
| `blueLive.onOff` | Reuse existing Blue Live toggle; requires a current project to start, can stop an active session. |
| `blueLive.recompile` | Reuse stop-if-needed then start-fresh path; requires a current project. |
| `blueLive.allNotesOff` | Submit once only if Blue Live is active. |

Rapid events use one serialized promise chain. A failed command updates the same user-visible output/error path as its in-app equivalent and must not reject the chain permanently.

## Compatibility And Security Contract

- `.blue` project XML and `@blue/data` APIs are unchanged.
- The server is unauthenticated and reachable on all IPv4 interfaces subject to OS firewall policy.
- Documentation labels the feature suitable for trusted networks and does not imply sender authentication.
- TCP, IPv6-only binding, replies, output OSC, custom mappings, scheduling, allowlists, and rate limiting are out of scope.
