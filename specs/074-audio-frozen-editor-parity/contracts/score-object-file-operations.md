# Score-object file operation contracts

This contract describes the renderer/preload/main boundary for the AudioFile chooser and FrozenSoundObject Save Copy flow. Canonical project edits still cross the existing `ProjectDocumentPatch` bridge; Save Copy never crosses that bridge.

## AudioFile source selection

Preload method:

```text
selectScoreObjectAudioFile(currentPath?: string): Promise<AudioFileSelectionResult>
```

The main process:

1. Opens a single-file native chooser using the current stored path or the project directory as the default location.
2. Accepts only a regular file.
3. Applies the Java-compatible project path rules: project-relative storage for files inside the current project, absolute storage otherwise; separator-less lookup continues to honor the existing `SFDIR`-equivalent search behavior when inspecting an existing path.
4. If `copyToMediaFileOnImport` is enabled and a project directory exists, copies the selected file into the configured media folder using collision-safe Java behavior, then returns the path to the actual copied file.
5. Inspects the selected file and returns metadata or a typed error. A cancelled, invalid, unreadable, or unsupported selection does not produce a project patch.

```text
AudioFileSelectionResult =
  | { status: 'cancelled' }
  | {
      status: 'selected'
      storedPath: string
      objectName: string
      metadata: AudioFileMetadataSnapshot
      copiedToMedia: boolean
    }
  | {
      status: 'error'
      code: 'no-project' | 'not-a-file' | 'missing' | 'unreadable' | 'unsupported' | 'copy-failed'
      message: string
      path?: string
    }
```

`objectName` is the selected file's basename. The renderer uses `storedPath` and `objectName` in one `replaceAudioFileSource` project intent, so the path/name pair cannot be observed half-updated.

## FrozenSoundObject Save Copy

Preload method:

```text
saveFrozenSoundObjectCopy(request: {
  frozenWaveFileName: string
}): Promise<FrozenSoundObjectSaveCopyResult>
```

The main process resolves the artifact against the current project using the existing safe freeze-artifact rules. It opens a save dialog defaulting to the current project directory when available, rejects directories and destinations whose basename starts with `freeze`, confirms ordinary overwrites, and copies exact bytes only after validation.

```text
FrozenSoundObjectSaveCopyResult =
  | { status: 'cancelled' }
  | { status: 'copied'; destinationPath: string; byteLength: number }
  | {
      status: 'error'
      code: 'no-project' | 'missing-artifact' | 'unreadable-artifact'
        | 'invalid-artifact' | 'directory-destination' | 'freeze-destination'
        | 'copy-failed'
      message: string
    }
```

The result does not contain a `ProjectDocumentSnapshot` and must not advance the project revision. Ordinary overwrite confirmation cancellation returns `status: 'cancelled'`.

## Canonical project intents

Add typed score intents beside the existing generic type-specific editor patch:

```text
{ type: 'replaceAudioFileSource'
  target: ScoreObjectEditorTargetSnapshot
  filePath: string
  name: string }

{ type: 'updateAudioFilePostCode'
  target: ScoreObjectEditorTargetSnapshot
  csoundPostCode: string }
```

The main patch handler validates that the target resolves to an `AudioFile`. Any attempt to mutate `FrozenSoundObject.frozenWaveFileName` through the legacy generic path patch is rejected/no-op. Save Copy is intentionally not a score intent.

## Snapshot contract

`TypeSpecificScoreObjectEditorSnapshot` uses dedicated discriminators for the two flows:

- `kind: 'audioFile'` carries the stored path, post code, and `AudioFileMetadataState`.
- `kind: 'frozenSoundObject'` carries read-only source/artifact details and Save Copy availability.

The existing fallback discriminators remain responsible for no selection, multiple selection, removed target, and unsupported object types. Renderer controls must derive their enabled/read-only state from these discriminators and status values rather than from object-type string checks alone.

## Failure and recovery guarantees

- Chooser cancellation leaves the canonical `BlueData` revision unchanged.
- File-copy failure leaves the AudioFile object unchanged; any successfully created media file is treated as a derived filesystem artifact and reported in the error path for later cleanup/retry consideration.
- Missing/unsupported metadata clears derived fields and preserves the stored reference when loading an existing project.
- Save Copy failures and cancellations leave the frozen object, nested source, freeze reference, project XML, and project revision unchanged.
