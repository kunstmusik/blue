# Data Model: Focused MIDI Instrument Routing

All feature state is transient. The project model remains canonical in Electron main and no entity below is serialized to `.blue` XML or app settings.

## Ownership overview

```text
Primary renderer
├── MidiRoutingState                 one mode + optional focus target
└── MidiNoteRouter
    └── HeldMidiNote                 source note + target captured at note-on

Electron main / Blue Live session
└── CompiledMidiTargetCatalog        exact targets present in active CSD

Electron main / project document
└── BlueData                         unchanged canonical Track/Arrangement data
```

## MIDI routing mode

```ts
type MidiRoutingMode = 'focus' | 'channel';
```

| Value | Meaning | Instrument selector |
|---|---|---|
| `focus` | New default for the primary renderer session | Last explicitly focused eligible Track or Orchestra assignment |
| `channel` | Compatibility / multi-timbral path | Virtual Keyboard selected channel or hardware message channel |

The mode may survive project replacement within one renderer lifetime, but it is not persisted. Project replacement always clears focus and held-note state.

## Focused MIDI target

```ts
type FocusedMidiTarget =
  | {
      kind: 'track';
      projectSessionId: number;
      rootGroupId: string;
      trackId: string;
      displayName: string;
    }
  | {
      kind: 'orchestra';
      projectSessionId: number;
      assignmentId: string;
      displayName: string;
    };
```

### Validation rules

- `projectSessionId` is nonnegative and must equal the current renderer project session.
- `trackId`, `rootGroupId`, and `assignmentId` are non-empty stable identities from the current snapshot.
- Display names are informational and never authoritative.
- Track focus can be set by an explicit Track header, timeline, Track-contained object, or Track instrument-control interaction.
- Orchestra focus can be set only by explicit assignment selection; component auto-selection must not steal performance focus.
- Deleting the target or switching projects clears focus. Renaming updates display metadata without changing identity.
- Disabling/removing the target's instrument can leave the project identity visibly focused, but that identity is unavailable to routing until a later successful compilation includes it.

## Renderer MIDI routing state

```ts
interface MidiRoutingState {
  mode: MidiRoutingMode;
  focusedTarget: FocusedMidiTarget | null;
}
```

### State transitions

| Event | Before | After |
|---|---|---|
| Renderer starts | none | `mode: 'focus'`, `focusedTarget: null` |
| User explicitly selects eligible target | any | same mode, focused target replaced atomically |
| User selects focus mode | any | `mode: 'focus'`, existing current-session focus retained |
| User selects channel mode | any | `mode: 'channel'`, focus retained only for later display/reuse and ignored for routing |
| Focused target is removed | any | `focusedTarget: null` |
| Project session changes | any | mode retained, `focusedTarget: null`; router releases all held notes |
| Blue Live stops or its generation changes | any | mode and current-project focus retained; router releases held notes; main clears the old catalog |
| Blue Live starts/recompiles successfully | current-project focus retained | main installs the new catalog atomically; focus is reconciled against the current project snapshot and routes only if present in the catalog |
| App restarts | any | default state restored; nothing rehydrated |

Rejected target resolution and trigger attempts return an internal typed failure but
do not alter this store or publish user-visible error state. They create no held-note
or aggregate entry.

## Blue Live note target contract

```ts
type BlueLiveNoteTarget =
  | { kind: 'track'; trackId: string }
  | { kind: 'orchestra'; assignmentId: string }
  | { kind: 'channel'; channel: number };
```

The existing note request retains its source `channel` for project MIDI mapping and compatibility. `target` is optional during migration; omission has the same meaning as `{ kind: 'channel', channel: request.channel }`. The request also accepts an optional nonnegative `liveSessionId`. The shared focus-aware router always supplies the current ID, and Electron main rejects a supplied ID that differs from the active Blue Live session. Omission remains valid for existing direct-channel callers.

### Target identity key

```text
track:<trackId>
orchestra:<assignmentId>
channel:<channel>
```

Keys are derived, never persisted, and escaped or structurally encoded so user-controlled assignment text cannot collide with separators.

## Compiled MIDI target catalog

```ts
type CompiledMidiInstrumentTarget =
  | {
      kind: 'track';
      trackId: string;
      runtimeInstrumentId: number | string;
    }
  | {
      kind: 'orchestra';
      assignmentId: string;
      runtimeInstrumentId: number | string;
    };

interface CompiledMidiTargetCatalog {
  liveSessionId: number;
  targets: readonly CompiledMidiInstrumentTarget[];
}
```

### Rules

- The catalog is produced by the same disposable render snapshot and compile data that produce `toBlueLiveCSD()` output.
- It includes enabled Track instruments registered for that CSD and enabled Orchestra assignments present in that CSD.
- It is installed only after the session's CSD generation succeeds and replaces the prior catalog atomically.
- Its `liveSessionId` is the same main-owned generation exposed in the running Blue Live status snapshot.
- It is cleared on failed start, stop cleanup, and session teardown without clearing renderer focus.
- It is not reconstructed from a later `BlueData` revision and never crosses renderer IPC.
- Duplicate or malformed identities cause deterministic rejection rather than first-match routing.

## Resolved routed target

After validating a request target against the compiled catalog, the live session derives:

```ts
interface ResolvedBlueLiveTarget {
  target: BlueLiveNoteTarget;
  targetKey: string;
  runtimeInstrumentId: number | string;
}
```

For direct-channel compatibility, the runtime identifier is resolved using the existing channel-assignment behavior. Focused Track and Orchestra targets resolve directly by stable identity.

## Held MIDI note

```ts
interface HeldMidiNote {
  sourceId: string;
  sourceKind: 'hardware' | 'mouse' | 'computer';
  deviceId: string | null;
  channel: number;
  midiNote: number;
  velocity: number;
  liveSessionId: number;
  target: BlueLiveNoteTarget;
  targetKey: string;
}
```

### Source and aggregate keys

- Source key remains `(sourceId, channel, midiNote)` to preserve MIDI idempotence and note-off lookup.
- Aggregate key becomes `(targetKey, midiNote)` rather than `(channel, midiNote)`.
- Target is resolved only for a new note-on. A matching note-off uses the target stored on the held source record.
- The held record retains the successful note-on's `liveSessionId`; note-off never substitutes the current generation.
- Failed note-on does not create a held record or aggregate count.
- Multiple sources on one target/pitch share one aggregate engine note.
- Equal pitches on different target keys remain independent.

### Lifecycle

```text
incoming note-on
  -> validate MIDI values and live state
  -> resolve mode/current target
  -> submit first aggregate note-on
  -> on success, store HeldMidiNote and increment aggregate

incoming note-off
  -> look up source key
  -> decrement aggregate for the stored target
  -> submit final note-off only when aggregate reaches zero
  -> remove held state

source/Blue Live session cleanup
  -> release affected stored targets or issue engine all-notes-off
  -> clear ledgers before a new engine generation accepts input
  -> preserve current-project focus for reconciliation

project replacement
  -> release/clear all held state
  -> clear focused target before the new project session accepts input
```

## Invariants

1. Project edits and routing focus never mutate one another.
2. The running CSD's compiled catalog is authority for target availability.
3. One successful note-on has exactly one retained target until release/cleanup.
4. No validation failure selects a fallback instrument.
5. Focus changes affect only future note-ons.
6. Direct channel remains a target kind, not an implicit array index in renderer state.
7. All state derived by this feature is disposable and session-fenced.
8. A rejected note produces no user-visible routing error, no fallback score event, and no held-note state.
9. A request from an earlier Blue Live session ID can never submit into the active session.
