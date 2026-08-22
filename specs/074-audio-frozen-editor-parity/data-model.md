# Data Model: AudioFile and FrozenSoundObject Editor Detail Parity

The feature adds editor-facing snapshots and host-operation results. It does not add new `.blue` XML fields.

## AudioFileEditorSnapshot

The on-demand editor document for one uniquely selected `AudioFile`.

| Field | Type | Meaning | Validation / ownership |
|---|---|---|---|
| `kind` | `'audioFile'` | Discriminator for the type-specific editor | Renderer routing only |
| `target` | `ScoreObjectEditorTargetSnapshot` | Stable canonical target | Must still resolve before a patch is applied |
| `filePath` | `string` | Stored Blue path shown to the user | Empty is allowed; never edited as free text |
| `csoundPostCode` | `string` | Existing AudioFile post-processing code | Canonical project field; changed through an AudioFile-specific patch |
| `metadata` | `AudioFileMetadataState` | Derived inspection state | Recomputed from the resolved file; never serialized |
| `canChooseFile` | `boolean` | Whether a live project target can accept a source selection | False for stale/unsupported targets |

### AudioFileMetadataState

```text
empty      { status: 'empty' }
missing    { status: 'missing', path, message }
unreadable { status: 'unreadable', path, message }
unsupported{ status: 'unsupported', path, message }
available  {
  status: 'available',
  path,
  formatType,
  byteLength,
  encodingType,
  sampleRate,
  sampleSizeInBits,
  channels,
  isBigEndian,
  durationSeconds,
  frameCount,
  channelVariables,
  unavailableFields
}
```

`channelVariables` is derived as `aChannel1` through `aChannelN`, matching Java's Csound-tab feedback. Numeric values must be finite and non-negative where the source format provides them. `byteLength` is the source file length; duration is derived from the header's frame count/sample rate. `null`/unavailable values are represented by the status or an explicit unavailable display, never by values from the previous file.

`unavailableFields` names individual values that the recognized source did not provide (for example, `frameCount` and `durationSeconds` when a WAV header has no data chunk). The renderer uses this list to show `Unavailable` and never treats zero-filled parser defaults as verified metadata.

## FrozenSoundObjectEditorSnapshot

The on-demand editor document for one uniquely selected `FrozenSoundObject`.

| Field | Type | Meaning | Validation / ownership |
|---|---|---|---|
| `kind` | `'frozenSoundObject'` | Discriminator for the read-only editor | Renderer routing only |
| `target` | `ScoreObjectEditorTargetSnapshot` | Stable canonical target | Used only to verify Save Copy source identity |
| `frozenWaveFileName` | `string` | Stored generated artifact filename/path | Display-only; never accepted from a project patch |
| `sourceName` | `string` | Name of the nested source object | Derived from the retained nested object |
| `sourceType` | `string` | Java-compatible source type label | Derived from the nested object class/type |
| `sourceDurationBeats` | `number \| null` | Nested source subjective duration in current time context | Derived; not a new persisted field |
| `numChannels` | `number` | Frozen artifact channel count | Read-only model field already persisted by `FrozenSoundObject` |
| `artifactStatus` | `'empty' \| 'available' \| 'missing' \| 'unreadable'` | Whether the artifact can be inspected/copied | Main-process filesystem result |
| `message` | `string \| undefined` | Recoverable user-facing diagnostic | Transient |
| `canSaveCopy` | `boolean` | Whether Save Copy can be invoked | False when target/artifact is unavailable |

The source name/type/duration come from `getFrozenSoundObject()` and the current time context, matching Java's inspector. The frozen artifact filename and channel count remain read-only even though the underlying model has setters for freeze/unfreeze orchestration.

## AudioFileMetadata

The pure binary-header result in `@blue/data` is extended without removing existing fields:

- `format`: normalized `WAV`, `AIFF`, or `AIFC` format identifier.
- `channels`: positive channel count when available.
- `sampleRate`: positive sample rate when available.
- `durationSeconds`: frame count divided by sample rate.
- `frameCount`: total frames per channel.
- `bitsPerSample`: existing alias for sample size in bits.
- `byteLength`: total source byte length when the raw file bytes/stat are available.
- `encodingType`: normalized source encoding label such as PCM or float; `UNKNOWN` is allowed only when the header is recognized but the encoding code is not mapped.
- `isBigEndian`: `true` for AIFF, `false` for little-endian WAV, and explicit unavailable status when the format header cannot determine it.

Malformed or unrecognized bytes raise the existing typed metadata error. Main maps that error to an `unsupported` or `unreadable` editor state rather than allowing a stale snapshot.

## File-operation results

### AudioFile selection result

- `cancelled`: no filesystem or project mutation.
- `selected`: contains `storedPath`, `objectName`, `metadata`, and `copiedToMedia`.
- `error`: contains a stable code (`no-project`, `not-a-file`, `missing`, `unreadable`, `unsupported`, or `copy-failed`) and a user-facing message; no canonical project mutation.

### Frozen Save Copy result

- `cancelled`: chooser or overwrite confirmation was declined.
- `copied`: contains destination path and copied byte length; no canonical project mutation.
- `error`: contains a stable code (`no-project`, `missing-artifact`, `unreadable-artifact`, `directory-destination`, `freeze-destination`, `copy-failed`, or `invalid-artifact`) and a user-facing message.

## State transitions

### AudioFile editor

1. `open` resolves the stored path using Java-compatible lookup and enters `empty`, `missing`, `unreadable`, `unsupported`, or `available` metadata state.
2. `choose` opens a native file chooser. Cancel returns to the prior state. A successful result is committed with one atomic source-replacement patch and then the document is refreshed.
3. `post-code-edit` emits an AudioFile post-code patch; it does not touch derived metadata.
4. A project snapshot/reopen rehydrates the stored path and post code from `.blue`, then recomputes metadata from disk.

### FrozenSoundObject editor

1. `open` derives source details and probes the artifact; the artifact is `available`, `missing`, `unreadable`, or `empty`.
2. `save-copy` performs native destination validation and exact-byte copy. All outcomes leave the object and project revision unchanged.
3. `selection-changed` clears the old inspector immediately and loads the new document; a removed/unsupported target becomes the existing fallback state.

## Persistence and ownership matrix

| State | Canonical owner | Lifetime | `.blue` persistence |
|---|---|---|---|
| AudioFile stored path, object name, Csound post code | Main-process `BlueData` | Project session | Existing XML fields only |
| FrozenSoundObject nested source, artifact filename, channels | Main-process `BlueData` | Project session | Existing XML fields only |
| Metadata/status/channel-variable display | Renderer snapshot derived from main file probe | Editor session | None |
| Media-folder imported copy | User/project filesystem | Until user removes it | Referenced by existing AudioFile path |
| Freeze artifact | Project filesystem / freeze orchestration | Until unfreeze/reference cleanup | Referenced by existing FrozenSoundObject filename |
| Save Copy destination | User-selected filesystem path | User-owned output | None |
