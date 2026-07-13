# Data Model: MIDI Device Input And Blue Live Routing

## Model Boundaries

The feature has three distinct kinds of state:

1. **Durable user intent** in main-owned program settings.
2. **Transient device observation** produced by the primary renderer’s Web MIDI service and cached by main for other windows.
3. **Transient note routing state** held by the common renderer note router while Blue Live consumes notes.

Raw browser objects (`MIDIAccess`, `MIDIInput`, `MIDIMessageEvent`) never cross IPC and are never persisted. Project MIDI processing continues to live in the canonical `.blue` project model.

## Durable Entities

### MIDI Input Device Preference

Represents one remembered input device and the user’s intent to use it.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Non-empty host-supplied stable port ID; primary preference key. |
| `name` | string | Last known display name; empty host values become a localized/neutral fallback in the UI. |
| `manufacturer` | string | Last known manufacturer, possibly empty. |
| `version` | string | Last known device version, possibly empty. |
| `enabled` | boolean | The sole user-controlled connection state. |

Identity records remain in settings when a device is unavailable so an enabled device can reconnect later. Identity metadata is refreshed from a matching live port when settings are next saved.

### MIDI Input Preferences

App-wide program-settings section.

| Field | Type | Rules |
|---|---|---|
| `devices` | MIDI Input Device Preference[] | Unique by `id`, deterministically ordered for persistence. May contain unavailable devices. |

This section is versioned through the existing program-settings envelope. The legacy `appSpecific.midiInputDevice` string is preserved for downgrade safety but is not auto-converted into a structured device preference in this slice. `appSpecific.midiOutputDevice` remains untouched.

## Transient Runtime Entities

### MIDI Input Device Runtime

Serializable observation for one remembered or currently discovered port.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Joins to a preference and to the live port map. |
| `name` | string | Current host value when available, otherwise last remembered value. |
| `manufacturer` | string | Current or remembered value. |
| `version` | string | Current or remembered value. |
| `enabled` | boolean | Uses the applied program setting when present; otherwise defaults to `true` for a live, newly discovered device. |
| `availability` | `available` \| `unavailable` | Whether the current `MIDIAccess.inputs` contains the port. |
| `connection` | `closed` \| `connecting` \| `connected` \| `disconnecting` \| `error` | Application connection lifecycle, not durable. |
| `lastError` | string \| null | User-safe message for the most recent access/open/close failure. Cleared after successful reconciliation. |

Remembered unavailable devices and newly discovered enabled devices both appear in the same list. Duplicate display names are allowed; duplicate IDs are not.

### MIDI Device Service Snapshot

Latest serializable aggregate emitted by the primary renderer and cached by main.

| Field | Type | Rules |
|---|---|---|
| `instanceId` | string | Unique for one primary-renderer service lifetime; lets main replace a stale cache after reload. |
| `revision` | non-negative integer | Monotonically increases on each published change. |
| `phase` | `idle` \| `requestingAccess` \| `discovering` \| `ready` \| `partial` \| `unsupported` \| `denied` \| `error` | Overall service outcome. |
| `devices` | MIDI Input Device Runtime[] | Stable UI ordering: enabled first, then locale/name, then ID. |
| `message` | string \| null | Aggregate user-facing diagnostic when relevant. |
| `updatedAt` | number | Epoch milliseconds for display/diagnostics, not conflict resolution. |

Aggregate phase derivation:

- `unsupported`: `navigator.requestMIDIAccess` is unavailable.
- `denied`: access request is rejected for permission reasons.
- `partial`: at least one enabled port is connected and at least one enabled port is unavailable or errored.
- `ready`: discovery completed without an enabled-port failure; zero discovered or explicitly enabled ports is a valid ready state with an explanatory empty state.
- `error`: discovery failed for a non-permission reason and no usable snapshot can be produced.

### Normalized MIDI Note Event

Application-level note ingress used by hardware and Virtual Keyboard sources.

| Field | Type | Rules |
|---|---|---|
| `type` | `noteOn` \| `noteOff` | Hardware note-on with velocity 0 is normalized to `noteOff`. |
| `sourceKind` | `hardware` \| `mouse` \| `computer` | Human-readable source class. |
| `sourceId` | string | Stable runtime source: for example `midi:<port-id>` or `virtual-keyboard:mouse`. |
| `deviceId` | string \| null | Present only for hardware. |
| `channel` | integer | Zero-based MIDI channel, 0 through 15. |
| `midiNote` | integer | 0 through 127. |
| `velocity` | integer | 0 through 127; note-off may retain release velocity. |
| `timestamp` | number | Source high-resolution timestamp when available; otherwise the renderer’s current monotonic time. |

Non-note MIDI messages are ignored before this entity is created.

### Held Note

Internal note-router record used for deterministic source cleanup.

| Field | Type | Rules |
|---|---|---|
| `sourceId` | string | Partitions cleanup by device or Virtual Keyboard source. |
| `channel` | integer | Zero-based channel. |
| `midiNote` | integer | Original MIDI note before project mapping. |
| `velocity` | integer | Velocity accepted for the active note. |

The unique source key is `(sourceId, channel, midiNote)`. The router also maintains an aggregate reference count by `(channel, midiNote)`. A repeated note-on for the same source key is idempotent; the main Blue Live note-off is sent only when the aggregate reference count reaches zero, preventing one source’s disconnect from releasing an equivalent note still held by another source.

## State Transitions

### Service lifecycle

```text
idle
  -> requestingAccess
      -> discovering
          -> ready
          -> partial
          -> error
      -> denied
      -> unsupported

ready/partial
  -> discovering        (manual rescan or host statechange)
  -> denied/error       (permission revoked or access failure)
  -> idle               (primary renderer shutdown)
```

Calling start more than once must reuse the same in-flight access request and listener set. Calling stop more than once must be safe.

### Per-device lifecycle

```text
disabled + available     -> closed
new + available          -> connecting -> connected (default enabled)
enabled + available      -> connecting -> connected
enabled + unavailable    -> closed/unavailable
connected + disabled     -> disconnecting -> closed
connected + removed      -> closed/unavailable
connecting/open failure  -> error
error + rescan/return     -> connecting -> connected | error
```

Every transition away from a usable enabled connection detaches its message listener and releases that source’s held-note records before publishing the final state.

## Reconciliation Rules

Given applied preferences `P` and current live inputs `L`:

1. Index `P` and `L` by port ID.
2. Emit the union of IDs so absent preferences and newly discovered default-enabled devices both remain visible.
3. For each live port, prefer live descriptive metadata; for absent ports, retain remembered metadata.
4. Open a live port when its applied preference is enabled or no preference exists; an explicit saved `enabled: false` keeps it closed.
5. Close/detach any open port whose preference was removed or disabled.
6. Do not let one port failure cancel reconciliation of another port.
7. Install at most one message listener per live port and at most one access `statechange` listener.
8. Ignore late messages from a replaced, disabled, or disconnected port generation.
9. Publish a new snapshot only after increasing `revision`; consumers accept only a newer revision.

## Validation Rules

- Reject empty IDs in saved device preferences.
- Deduplicate saved entries by ID; preserve the last valid enabled choice and freshest non-empty metadata.
- Clamp or reject note/channel/velocity values outside MIDI ranges at the note-router boundary.
- Treat malformed or shorter-than-required hardware messages as unsupported input and do not route them.
- Never persist `phase`, `availability`, `connection`, `lastError`, held notes, or raw browser objects.
- Never modify project MIDI processing settings while saving app-wide device preferences.

## Cleanup Invariants

- Disabling/removing one source releases only its source ledger entries.
- Equivalent notes held by another source remain active until that source releases them.
- Blue Live stop, project replacement, and app exit clear the complete router ledger; the existing engine stop/all-notes-off path remains the final audio safeguard.
- Rescan, reconnect, React Strict Mode remount, and Settings close/reopen cannot multiply listeners or note submissions.
