# MIDI Import Data Model

The model is split at the Electron IPC boundary. Raw file bytes and `midi-file` event objects are main-process concerns; the converter consumes a plain normalized document and returns normal `@blue/data` objects.

## Normalized import document

```ts
interface MidiImportDocument {
  format: 0 | 1 | 2;
  division:
    | { kind: 'ppq'; ticksPerBeat: number }
    | { kind: 'smpte'; framesPerSecond: number; ticksPerFrame: number };
  tracks: MidiImportTrack[];
  tempoChanges: MidiImportTempoChange[];
}

interface MidiImportTrack {
  trackIndex: number;
  name?: string;
  streams: MidiImportStream[];
  tempoChanges: MidiImportTempoChange[];
  lastTick: number;
}

interface MidiImportTempoChange {
  absoluteTick: number;
  bpm: number;
  trackIndex: number;
}

interface MidiImportStream {
  streamKey: string; // `${trackIndex}:${channel}`
  trackIndex: number;
  channel: number;
  events: MidiNoteEvent[];
  noteCount: number;
  firstTick?: number;
  lastTick?: number;
  warnings: MidiImportWarning[];
}

interface MidiNoteEvent {
  absoluteTick: number;
  type: 'noteOn' | 'noteOff';
  noteNumber: number;
  velocity: number;
}

interface MidiImportWarning {
  code:
    | 'unmatched-note-off'
    | 'dangling-note-on'
    | 'invalid-note'
    | 'unsupported-event';
  message: string;
  trackIndex: number;
  channel?: number;
  tick?: number;
}
```

The implementation may use internal richer types while parsing, but only serializable equivalents cross IPC. `absoluteTick` is computed from parser delta times before the data package sees the document.

## Preview and settings

The renderer-facing preview is derived from the normalized document and contains no raw note-event arrays unless needed for diagnostics:

```ts
interface MidiImportPreview {
  fileName: string;
  format: 0 | 1;
  ticksPerBeat: number;
  streams: MidiImportStreamPreview[];
}

interface MidiImportStreamPreview {
  streamKey: string;
  trackIndex: number;
  trackName?: string;
  channel: number;
  noteCount: number;
  firstBeat: number;
  lastBeat: number;
  warnings: MidiImportWarning[];
  defaults: MidiImportSettings;
}

interface MidiImportSettings {
  streamKey: string;
  instrumentId: string;
  noteTemplate: string;
  trimTime: boolean;
}
```

The main process retains the normalized document behind a random pending-import token rather than sending all events to the renderer. The token is bound to the current project/editor session and is cleared on completion, cancellation, error, or session change.

## Conversion objects

The pure converter creates:

```text
new BlueData
└── Score
    └── root layer group selected by project defaults
        ├── TrackLayerGroup
        │   └── Track (one per accepted source stream)
        │       └── GenericScore (expanded Csound note text)
        └── or PolyObject
            └── SoundLayer (one per accepted source stream)
                └── GenericScore (expanded Csound note text)
```

The Score's tempo map is enabled for an imported project. Each `MidiImportTempoChange` becomes a constant `TempoPoint` at `absoluteTick / ticksPerBeat`, with BPM calculated from the MIDI event's microseconds-per-quarter-note value. If no tempo event is present, the map contains the Standard MIDI File default of 120 BPM.

Each generated note has these derived values:

- `startBeats = absoluteStartTick / ticksPerBeat`;
- `durationBeats = (endTick - startTick) / ticksPerBeat`;
- `key` and derived pitch placeholders from the MIDI note number;
- raw MIDI velocity and Java-compatible velocity amplitude;
- the row's instrument ID and template.

With trim disabled, the `GenericScore` starts at beat zero and retains absolute starts. With trim enabled, all note starts are reduced by the first note start and the `GenericScore` starts at that first beat. This removes leading silence within the imported stream while preserving its placement in the containing root layer group.

## Ownership and persistence

| Data | Owner | Lifetime | Persistence |
| --- | --- | --- | --- |
| File bytes and parser events | Electron main | One import attempt | Never persisted |
| Normalized document and pending token | Electron main | Until cancel/commit/session change | Never persisted |
| Preview and editable settings | Renderer dialog | Until dialog closes | Never persisted |
| Generated `BlueData` | Electron main | Current project session | Serialized by existing `.blue` save path |
| Source MIDI path | None after import | Not retained as project metadata | The imported project starts unsaved |

## Validation invariants

- `format` must be 0 or 1 and `division.kind` must be `ppq` before conversion.
- `ticksPerBeat` is a positive finite integer.
- A stream key identifies exactly one source track and channel.
- Settings submitted by the renderer must contain exactly one valid row for every selected stream key and no unknown keys.
- Instrument IDs and templates are trimmed, non-empty strings; numeric zero is not a valid instrument ID; the template must expand without leaving known placeholders unresolved.
- Generated note starts and durations are finite and non-negative.
