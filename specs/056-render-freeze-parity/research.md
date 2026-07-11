# Research: Render to Disk and ScoreObject Freezing Parity

## Decision: Treat the current Java Blue sources as the behavioral baseline

**Rationale**: The requested compatibility is specifically with Java Blue's current implementation, not merely with older documentation or a generic Csound renderer. The reviewed sources define the exact settings ownership, command flags, artifact names, extensions, XML fields, render windows, and cleanup behavior.

**Evidence reviewed**:

- `blue-ui-core/.../project/RenderToDiskUtility.java`
- `blue-settings/.../DiskRenderSettings.java`
- `blue-core/.../ProjectProperties.java`
- `blue-csnd6/.../CS6DiskRendererService.java`
- `blue-ui-core/.../score/object/actions/FreezeUnfreezeAction.java`
- `blue-settings/.../UtilitySettings.java`
- `blue-core/.../soundObject/FrozenSoundObject.java`

**Alternatives considered**: Treating the existing CSD-to-file export as Render to Disk; rejected because it writes CSD text, not an audio file. Choosing a new filename or extension convention; rejected because Java compatibility requires `freezeN.wav` on non-macOS and `freezeN.aif` on macOS.

## Decision: Preserve Java Blue's three settings layers

**Rationale**: Java stores Program Disk Render and Program Utility values app-wide, while project render content and project workflow controls live in `.blue` XML. Mixing these layers would make changing a program preference mutate projects unexpectedly or make Freeze inherit ordinary disk flags.

**Chosen ownership**:

- Program Disk Render: executable, file/sample format values and enable toggles, peak/dither/header/display flags, and separate program advanced preference.
- Program Utility: separate executable and freeze flags.
- Project `ProjectProperties`: disk CSD header values, message-level toggles, `fileName`, `askOnRender`, `diskAdvancedSettings`, `diskCompleteOverride`, and `diskAlwaysRenderEntireProject`.

**Alternatives considered**: Copying all program settings into every render request; rejected because project-owned values must remain authoritative for an existing project. Reusing the Disk Render executable for Freeze; rejected because Java has an independent Utility executable setting.

## Decision: Generate CSD through the existing `@blue/data` render API

**Rationale**: `BlueData.toDiskCSD()`/`toDiskCSDAsync()` already use disk project properties for `sr`, `ksmps`, `nchnls`, `0dbfs`, render windows, and score generation. Existing Java runtime integration can remain available for Java-dependent project objects. `generate-csd-to-disk` is only a text export and must remain separate.

**Freeze-specific choice**: Add a pure helper that creates a deep-copied temporary `BlueData` containing a temporary PolyObject and copied source SoundObject, with the Java freeze start/end window and mixer extra render time. The main process then generates that temporary project's CSD and executes the Utility command.

**Alternatives considered**: Constructing CSD text in the main process; rejected because it would duplicate `@blue/data` generation and risk serialization/runtime divergence. Calling the realtime engine for Freeze; rejected because Java Freeze writes a standalone audio file using Utility flags.

## Decision: Use main-process subprocess orchestration with a pure command planner

**Rationale**: Electron main already owns Node `child_process`, file paths, dialogs, and project state. Normal commands can use executable-plus-argv invocation to preserve paths with spaces. A dedicated pure planner makes the three-layer settings behavior and exact flags unit-testable before process execution.

**Command modes**:

- Normal disk render: Program Disk Render executable and flags + project `-m` flags + project `diskAdvancedSettings` + `-o` output path + generated disk CSD path.
- Complete override: project `diskAdvancedSettings` is the complete Csound argument list, with no automatic Program Disk Render format/output flags; the executable remains the Program Disk Render executable and the output path is extracted for verification.
- Freeze: Program Utility executable + configured freeze flags + generated `freezeN` output path + temporary CSD path. No ordinary Disk Render flags are inherited.

**Cancellation**: Keep one active operation, retain the child process handle, terminate it on cancellation, and only commit a FrozenSoundObject after the output exists and metadata inspection succeeds.

**Alternatives considered**: Reuse `EngineBridge`; rejected because it targets realtime `@blue/engine-client` playback. Put execution in the renderer; rejected because it would violate the main-process file/subprocess boundary. Use synchronous shell execution; rejected because it would block the Electron main process.

## Decision: Parse generated WAV/AIFF metadata without a new external dependency

**Rationale**: Freeze output is intentionally limited to Java's fixed `.wav`/`.aif` platform formats. A small pure parser over `Uint8Array` can read duration, channel count, sample rate, and frame count without Node imports. The main process reads bytes; `@blue/data` performs the format interpretation.

**Alternatives considered**: Require `ffprobe` or another installed utility; rejected because it adds an external dependency and does not match Java's direct file inspection contract. Parse arbitrary user Render-to-Disk formats for Freeze; rejected because Freeze names and formats are fixed by Java's Utility flags.

## Decision: Use a dedicated typed IPC operation for render/freeze actions

**Rationale**: Render and Freeze are asynchronous, file-producing operations with progress, cancellation, and failure states. The renderer already has stable `ScoreObjectEditorTargetSnapshot` locations and the main process already owns canonical `currentData` plus snapshot broadcasts. A dedicated operation can validate targets, mutate canonical data once, increment the project revision, and broadcast the updated snapshot.

**Alternatives considered**: Encode the whole operation as ordinary renderer-generated `ProjectDocumentPatch` objects; rejected because file creation, metadata inspection, atomic replacement, and reference-counted deletion must happen in main and cannot be trusted to renderer state. Add ad hoc XML parsing in the renderer; rejected by the constitution and existing project-editor architecture.

## Decision: Fix FrozenSoundObject XML and CSD behavior as part of this feature

**Rationale**: The current TypeScript class preserves the filename and channel count but does not serialize the nested source object and skips CSD generation. That prevents reliable unfreeze after save/reopen and prevents frozen objects from participating in subsequent renders. Java stores the nested `<soundObject>` and emits a `diskin2` instrument/note using the stored filename and channel count.

**Alternatives considered**: Keep current null nested-source behavior and make unfreeze session-only; rejected because the spec requires project lifecycle parity. Store an absolute file path; rejected because Java stores a project-relative filename and portability requires that contract.

## Open questions resolved for planning

- Program Disk Render and Program Utility executables remain independent.
- Project disk properties are authoritative for generated CSD header values and message-level flags.
- `fileFormatEnabled` controls whether `--format` exists; `sampleFormatEnabled` controls only the suffix when the format option exists.
- `diskCompleteOverride` is project-owned and bypasses normal Program Disk Render flags.
- Freeze does not inherit ordinary Disk Render flags; it uses only Utility freeze flags for the external audio process.

## Final implementation decisions

### Reuse active project interpreter sessions for generated CSD

**Decision**: Disk render and freeze generation receive the active project JavaScript session and the active Java runtime client. JavaScript objects therefore see shared on-load variables, while Python and Clojure objects use the same project Java helper session used by other generation paths.

**Reason**: Constructing a deep-copied temporary freeze project must isolate model mutation, not interpreter state. Fresh evaluation contexts caused valid objects that depend on shared project code to fail only during freeze.

### Validate the generated container format before committing a freeze

**Decision**: WAV/AIFF metadata includes the detected container format. Freeze rejects and removes an artifact when that format does not match the Java platform filename policy (`WAV`/`.wav` off macOS, `AIFF`/`.aif` on macOS).

**Reason**: User-configured Utility flags are honored verbatim, but a mismatched flag must not create a misleading or unusable `freezeN` artifact under the required Java-compatible extension.

### Keep multi-object freeze atomic

**Decision**: Resolve every canonical target, stage every generated artifact and replacement, revalidate locations, then commit replacements together. Unfreeze cleanup occurs after replacement and uses the complete recursively counted score.

**Reason**: Partial replacement made a failed multi-selection difficult to recover and contradicted the source-preservation requirement. Staging also makes cancellation and metadata failures straightforward to roll back.

### Integrate Frozen bars with existing Java-style waveform rendering

**Decision**: Frozen artifacts use the existing waveform cache. AIFF PCM is summarized directly when Chromium cannot decode it, and each channel renders in its own integer-height band inside the `rowHeight - 4` waveform area used by Java `FrozenSoundObjectView`/`AudioWaveformUI`.

**Reason**: A valid frozen artifact is not fully usable if the timeline remains visually indistinguishable from an empty or ordinary object. Separate channel bands are required for stereo parity; overlaying both paths at one centerline looked mono.
