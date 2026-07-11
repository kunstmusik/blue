# Data Model: Render to Disk and ScoreObject Freezing Parity

## Settings Sources

| Source | Lifetime | Fields used by this feature | Authority |
|---|---|---|---|
| Program Disk Render | App-wide preferences | `csoundExecutable`, `fileFormat`, `fileFormatEnabled`, `sampleFormat`, `sampleFormatEnabled`, `savePeakInformation`, `ditherOutput`, `rewriteHeader`, `displaysDisabled`, `advancedSettings`, plus new-project defaults | Supplies normal disk command flags and seeds new projects where Java Blue does so. |
| Program Utility | App-wide preferences | Separate `csoundExecutable`, `freezeFlags` | Supplies Freeze's external command and is never silently replaced by the Disk Render executable. |
| Project Properties | `.blue` XML | `diskSampleRate`, `diskKsmps`, `diskChannels`, `diskUseZeroDbFS`, `diskZeroDbFS`, `diskNoteAmpsEnabled`, `diskOutOfRangeEnabled`, `diskWarningsEnabled`, `diskBenchmarkEnabled`, `fileName`, `askOnRender`, `diskAdvancedSettings`, `diskCompleteOverride`, `diskAlwaysRenderEntireProject` | Travels with the project and is authoritative for its CSD header, message level, output selection, and project render behavior. |

## DiskRenderCommandPlan

Represents the fully resolved command before subprocess execution.

```text
mode: normal | completeOverride
executable: string
args: string[]
outputPath: string | null
workingDirectory: string
csdPath: string
format: string | null
sampleFormat: string | null
messageLevel: number | null
renderWindow: { start: number; end: number }
```

Validation:

- Normal mode requires a nonblank output path and a project directory.
- `fileFormat` must be one of `WAV`, `AIFF`, `AU`, `RAW`, `IRCAM`, `W64`, `WAVEX`, `SD2`, `FLAC` when enabled.
- `sampleFormat` must be one of `ALAW`, `ULAW`, `SCHAR`, `UCHAR`, `FLOAT`, `SHORT`, `LONG`, `24BIT` when enabled.
- `sampleFormat` is appended only when `fileFormatEnabled` is true and `sampleFormatEnabled` is true.
- Complete override does not merge normal Program Disk Render flags and must provide an identifiable output path for completion verification.

## RenderOperationState

```text
operationId: string
kind: diskRender | freeze
phase: preparing | rendering | inspecting | committing | completed | cancelled | failed
message: string
progress: number | null
outputPath: string | null
error: string | null
```

Only one disk/freeze operation is active at a time. Cancellation transitions through `cancelled`; failure never transitions to `committing`.

## FreezeArtifact

```text
fileName: string                 # project-relative, e.g. freeze0.wav or freeze0.aif
absolutePath: string             # derived main-process path, never persisted
extension: .wav | .aif
channels: number
sampleRate: number
durationSeconds: number
durationBeats: number
sourceTimeBase: string
```

Invariants:

- `fileName` is generated in the project directory and is never an absolute path.
- Non-macOS defaults to `.wav`; macOS defaults to `.aif`.
- The counter is one greater than the highest parseable `freezeN` entry and advances on collision.
- `absolutePath` is used only for main-process file access and command execution.

## FrozenSoundObject Persistence

Java-compatible persisted fields:

```text
basic ScoreObject properties
numChannels: integer
frozenWaveFileName: project-relative string
soundObject: nested serialized original SoundObject
```

Runtime relationships:

- A `FrozenSoundObject` plays `frozenWaveFileName` through a generated `diskin2` instrument.
- Its nested `soundObject` is the restoration source and is deep-copied with the frozen object.
- Its current subjective duration reflects the measured audio artifact; its nested source retains the original duration and time base.

## FreezeTarget

Uses the existing `ScoreObjectEditorTargetSnapshot` and `ScoreObjectLocationRef`:

```text
selectionId: string
location: { rootGroupIndex, containerPath[], layerIndex, objectIndex }
selectedObjectType: string
ownerKind: timeline
```

Targets must resolve to SoundObjects in the canonical project. Library-owned or AudioClip targets are rejected with an actionable result unless explicitly supported by a later feature.

## Freeze Operation State Transitions

```text
non-frozen SoundObject
  -> validate saved project and target
  -> deep-copy temporary render data
  -> render temporary CSD to new freeze artifact
  -> inspect duration/channels
  -> create FrozenSoundObject retaining original source
  -> replace in same layer and broadcast

FrozenSoundObject
  -> validate nested source and backing file
  -> restore nested source at frozen start time
  -> count all remaining references recursively
  -> delete artifact only when count is zero
  -> replace in same layer and broadcast
```

## Mutation Invariants

- Canonical `currentData` is unchanged until render and metadata inspection succeed.
- A failed/cancelled Freeze leaves the source object in place.
- Unfreeze never discards the nested source merely because the backing file is missing.
- All successful main-process mutations increment the existing project revision and broadcast a fresh project snapshot to workbench windows.
