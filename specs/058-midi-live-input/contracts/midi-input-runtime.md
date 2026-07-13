# Contract: MIDI Input Runtime And Electron IPC

## Boundary Overview

The contract separates raw browser MIDI access from serializable application state.

```text
Settings renderer
  | get cached state / request rescan / save ProgramSettings draft
  v
Electron main coordinator
  | initialize + reconcile + rescan commands
  v
Primary renderer MIDI service
  | serializable runtime snapshots
  ^
  +-- Web MIDI ports (raw browser objects stay here)

Physical note -> common renderer note router <- Virtual Keyboard note
                         |
                         v
             existing Blue Live trigger IPC
                         |
                         v
          canonical project mapping + engine
```

All IPC payloads use shared static TypeScript types from `packages/blue-app/src/shared/midi-input.ts`. They contain only structured-clone-safe primitives and arrays.

## Shared Settings Contract

The existing `ProgramSettingsSnapshot` gains:

```ts
interface MidiInputDevicePreference {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  enabled: boolean;
}

interface MidiInputPreferences {
  devices: MidiInputDevicePreference[];
}

interface ProgramSettingsSnapshot {
  // existing fields remain unchanged
  midiInput: MidiInputPreferences;
}
```

`MIDI` is added to `ProgramSettingsPanelId`. Saving the existing full Settings draft remains the only durable write. After a successful save, main compares the prior and new `midiInput` section and sends a `reconcile` command to the primary renderer. Rescan is a live runtime action and never writes settings by itself.

Migration rules:

1. Missing `midiInput` becomes `{ devices: [] }`.
2. Existing valid structured entries are normalized and deduplicated by ID.
3. Legacy `appSpecific.midiInputDevice` remains preserved for downgrade safety and is not silently converted to a structured preference in this slice.
4. `appSpecific.midiOutputDevice`, realtime-render MIDI fields, and project MIDI processing are unchanged.

## Shared Runtime Contract

```ts
type MidiInputServicePhase =
  | 'idle'
  | 'requestingAccess'
  | 'discovering'
  | 'ready'
  | 'partial'
  | 'unsupported'
  | 'denied'
  | 'error';

type MidiInputAvailability = 'available' | 'unavailable';

type MidiInputConnection =
  | 'closed'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

interface MidiInputDeviceRuntime {
  id: string;
  name: string;
  manufacturer: string;
  version: string;
  enabled: boolean;
  availability: MidiInputAvailability;
  connection: MidiInputConnection;
  lastError: string | null;
}

interface MidiInputServiceSnapshot {
  instanceId: string;
  revision: number;
  phase: MidiInputServicePhase;
  devices: MidiInputDeviceRuntime[];
  message: string | null;
  updatedAt: number;
}
```

The coordinator replaces its cache when `instanceId` changes and otherwise accepts only an increasing `revision`. UI consumers treat the snapshot as read-only observation. Saved rows take their checkbox value from the current Settings draft; a live row with no saved preference takes the service's default-enabled value until the user saves an explicit choice.

## Main-To-Primary Commands

```ts
type MidiInputServiceCommand =
  | {
      commandId: string;
      type: 'reconcile';
      preferences: MidiInputPreferences;
    }
  | {
      commandId: string;
      type: 'rescan';
    }
  | {
      commandId: string;
      type: 'shutdown';
    };

interface MidiInputServiceInitialization {
  preferences: MidiInputPreferences;
  cachedSnapshot: MidiInputServiceSnapshot | null;
}

interface MidiInputCommandAck {
  commandId: string;
  accepted: boolean;
  message?: string;
}
```

Command rules:

- `reconcile` replaces the applied preference snapshot immediately. Concurrent port work uses current preferences and generation guards so stale callbacks cannot restore an older enabled state.
- Repeated `rescan` commands coalesce when discovery is already in flight.
- The coordinator queues at most one pending rescan while the primary service is not ready.
- `shutdown` releases the note ledger and closes ports before acknowledging main; app quit waits for that acknowledgement with a bounded timeout, while Electron main still owns final Blue Live engine cleanup.
- Command handling and acknowledgements must never block one device on another device’s open failure.

## Preload API Surface

The preload exposes narrow wrappers; no generic `send` or raw `ipcRenderer` access is added.

### Primary renderer service methods

```ts
initializeMidiInputService(): Promise<MidiInputServiceInitialization | null>;
reportMidiInputServiceSnapshot(snapshot: MidiInputServiceSnapshot): void;
acknowledgeMidiInputCommand(ack: MidiInputCommandAck): void;
onMidiInputServiceCommand(
  callback: (command: MidiInputServiceCommand) => void,
): () => void;
```

Main accepts initialize/report/ack calls only when `event.sender` is the current primary application `webContents`. Reports from Settings, workbench pop-outs, or stale primary renderer instances are ignored.

### Settings and observer methods

```ts
getMidiInputServiceSnapshot(): Promise<MidiInputServiceSnapshot | null>;
requestMidiInputRescan(): Promise<{ accepted: boolean; message?: string }>;
onMidiInputServiceSnapshot(
  callback: (snapshot: MidiInputServiceSnapshot) => void,
): () => void;
```

Main permits these observer/control methods only from application-owned windows. A successful rescan response means the command was delivered or queued; completion is observed through later snapshots.

### IPC channel mapping

| Channel | Direction | Request/response |
|---|---|---|
| `midi-input:initialize-service` | primary renderer -> main | invoke -> initialization |
| `midi-input:service-command` | main -> primary renderer | event |
| `midi-input:command-ack` | primary renderer -> main | send |
| `midi-input:report-snapshot` | primary renderer -> main | send |
| `midi-input:get-snapshot` | app renderer -> main | invoke -> cached snapshot/null |
| `midi-input:request-rescan` | app renderer -> main | invoke -> accepted result |
| `midi-input:snapshot-changed` | main -> app renderers | event |

## Permission Contract

Electron main updates both session handlers:

- Permission `midi`: allowed only when the requesting/checking `webContents` is the trusted primary application window at its current application location.
- Electron permission label `midiSysex`: allowed under the same restriction because Electron 35 uses this label for ordinary `{ sysex: false }` requests.
- Existing `local-fonts` behavior remains intact.
- All other permissions remain denied unless another existing feature explicitly allows them.

The renderer requests `navigator.requestMIDIAccess({ sysex: false })` and treats `sysexEnabled === true` as an error. Permission denial becomes a `denied` service snapshot and is not retried in a tight loop; user rescan or app restart may initiate a later explicit retry.

## Normalized Note Contract

```ts
interface MidiNoteEvent {
  type: 'noteOn' | 'noteOff';
  sourceKind: 'hardware' | 'mouse' | 'computer';
  sourceId: string;
  deviceId: string | null;
  channel: number;
  midiNote: number;
  velocity: number;
  timestamp: number;
}

interface MidiNoteRouteResult {
  accepted: boolean;
  message?: string;
}
```

The renderer-local router API is:

```ts
routeNote(event: MidiNoteEvent): Promise<MidiNoteRouteResult>;
releaseSource(sourceId: string): Promise<void>;
releaseAll(): Promise<boolean>;
```

Routing rules:

1. Validate ranges and normalize hardware note-on velocity zero to note-off.
2. Reject hardware events whose current port generation is no longer enabled and connected.
3. Maintain source-key and aggregate `(channel, midiNote)` held-note counts.
4. Forward the first aggregate note-on and the final aggregate note-off through the existing Blue Live IPC.
5. Record a held note only after main accepts its first aggregate note-on. Failed/unmapped/stopped note-ons do not create cleanup debt.
6. A release for an unknown source key is idempotently ignored.

The existing request expands compatibly:

```ts
interface BlueLiveNoteTriggerRequest {
  type: 'noteOn' | 'noteOff';
  midiNote: number;
  velocity: number;
  channel: number;
  source: 'mouse' | 'computer' | 'hardware';
  sourceId?: string;
  deviceId?: string;
  timestamp?: number;
}
```

Main continues to map channel, pitch, scale, and velocity from canonical project data. Extra source fields support diagnostics and future consumers but do not alter `.blue` data or score formatting.

## Web MIDI Adapter Contract

`MidiInputService` accepts an injected access requester and clock so tests do not depend on browser hardware:

```ts
type RequestMidiAccess = () => Promise<MIDIAccess>;

interface MidiInputServiceDependencies {
  requestAccess: RequestMidiAccess;
  now: () => number;
  routeNote: (event: MidiNoteEvent) => Promise<MidiNoteRouteResult>;
  releaseSource: (sourceId: string) => Promise<void>;
  publishSnapshot: (snapshot: MidiInputServiceSnapshot) => void;
}
```

Production passes `() => navigator.requestMIDIAccess({ sysex: false })`. Tests pass fake access/input objects with explicit `open`, `close`, `onmidimessage`, and `statechange` behavior.

Hardware message decoding accepts only channel voice note messages:

- `0x8n`: note-off.
- `0x9n` with velocity 1–127: note-on.
- `0x9n` with velocity 0: note-off.
- Every other status byte: ignored without error.

## Error And Cleanup Contract

- Device errors are attached to the affected runtime row; an aggregate `partial` phase is used when another enabled device remains connected.
- Permission and platform errors use aggregate `denied`/`unsupported` states and do not crash either renderer.
- Port disable, removal, replacement, service stop, Blue Live stop, project replacement, and app exit each invoke an idempotent ledger cleanup path.
- Disconnect cleanup detaches `onmidimessage` before awaiting close and marks the port generation invalid so late callbacks cannot route.
- React Strict Mode mount/unmount/mount must result in one active access listener and one listener per connected input.
- Settings window closure only unsubscribes its snapshot listener; it never affects device connections.
