# Feature Specification: AudioFile and FrozenSoundObject Editor Detail Parity

**Feature Branch**: `074-audio-frozen-editor-parity`

**Created**: 2026-08-14

**Status**: Complete

**Input**: User description: "AudioFile and FrozenSoundObject Editor Detail Parity. Implement Java Blue parity for file chooser and metadata flows, FrozenSoundObject Save Copy/read-only UI state, and the remaining editor detail affordances while preserving existing freeze, waveform, and project persistence behavior."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect and Replace an AudioFile (Priority: P1)

As a composer editing an `AudioFile` score object, I need a Java Blue-style file editor so I can choose an audio asset, understand its format, and maintain its Csound post-processing code without manually editing a path string.

**Why this priority**: Choosing and inspecting the source file is the primary workflow for a file-backed score object. Without it, the existing editor exposes only a partial and error-prone version of the object.

**Independent Test**: Open an `AudioFile` editor with a valid audio fixture, inspect its metadata, choose a different fixture through the file chooser, and verify the selected asset and editor fields update in the project.

**Acceptance Scenarios**:

1. **Given** a readable audio file is assigned to an `AudioFile`, **When** the editor opens, **Then** it shows a non-editable path display, a file chooser affordance, an Audio File view, a Csound view, and the available metadata for duration, format, byte length, encoding, sample rate, sample size, channel count, and byte order.
2. **Given** the user chooses a different regular audio file and confirms the selection, **When** the file is accepted, **Then** the object's file reference, displayed filename/name, metadata, and channel-variable information refresh together.
3. **Given** project media copying is enabled, **When** the user selects an external audio file, **Then** the file is copied into the project's media area, the object retains the Java-compatible project-relative reference, and the object name follows the selected file's basename.
4. **Given** the user cancels the file chooser, **When** the chooser closes, **Then** the existing file reference, object name, metadata, and unsaved project state remain unchanged.
5. **Given** the Csound view is active, **When** the user edits post-processing code and commits the edit, **Then** the code is retained on the `AudioFile` and survives the existing project save and reopen flow.

### User Story 2 - Inspect and Save a FrozenSoundObject Artifact (Priority: P1)

As a composer inspecting a frozen score object, I need a read-only explanation of what was frozen and a safe way to save a copy of the rendered audio so I can use the artifact outside the current project without accidentally changing the freeze state.

**Why this priority**: A frozen object represents a derived render, not an ordinary editable source file. The current generic path editor suggests an unsafe mutation model and omits Java Blue's practical artifact-export workflow.

**Independent Test**: Open a `FrozenSoundObject` backed by a valid freeze artifact, verify its source and artifact details are read-only, save a copy to a temporary destination, and compare the copied bytes with the original artifact.

**Acceptance Scenarios**:

1. **Given** a frozen object has a valid source object and freeze artifact, **When** its editor opens, **Then** it presents the source name, source type, frozen audio filename/path, source duration, and available channel information as read-only details, with a `Save Copy` action.
2. **Given** the user invokes `Save Copy` and selects a valid destination, **When** the copy completes, **Then** the destination contains the same audio bytes as the freeze artifact and the frozen object's project data is unchanged.
3. **Given** the freeze artifact is missing or cannot be read, **When** the frozen editor opens or `Save Copy` is invoked, **Then** the UI reports the missing artifact clearly, does not expose stale metadata as current, and leaves the project unchanged.
4. **Given** the user selects a directory, cancels the destination chooser, or declines an overwrite confirmation, **When** `Save Copy` handles the choice, **Then** no copy is made and the frozen object remains unchanged.
5. **Given** the proposed destination is an existing file whose basename begins with the freeze-artifact prefix, **When** the user attempts to save the copy, **Then** the operation refuses the unsafe destination and explains why.

### User Story 3 - Recover Clearly from Missing or Unsupported Audio State (Priority: P2)

As a composer working with projects whose audio files may have moved or whose formats may not expose every metadata field, I need explicit states and recovery actions so the editor never presents stale or misleading information.

**Why this priority**: Projects commonly outlive their source media. Clear recovery behavior protects existing work and makes the editor useful even when a host cannot inspect every format detail.

**Independent Test**: Exercise valid, missing, unreadable, unsupported, and newly reassigned audio fixtures for both object types, then verify that each state has a clear visual result and that choosing a valid replacement restores normal details.

**Acceptance Scenarios**:

1. **Given** an `AudioFile` reference is missing, **When** the editor opens, **Then** it identifies the missing path, clears or marks unavailable all metadata that cannot be verified, and offers the file chooser as the recovery action.
2. **Given** an audio file can be selected but one or more metadata fields cannot be read, **When** the editor displays the file, **Then** it shows the fields that are available and labels unavailable values explicitly instead of inventing values or leaving stale values from the previous file.
3. **Given** a missing file is replaced with a valid file, **When** the replacement is accepted, **Then** the error state clears, the complete available metadata is refreshed, and existing waveform, playback, freeze, and save behavior continues to work.
4. **Given** a project is reopened after an editor change, **When** the score object editor is opened again, **Then** the persisted file reference, object name, and Csound post code match the last saved project state while derived metadata is recalculated from the referenced file.

### Edge Cases

- A selected path resolves to a directory rather than a regular audio file.
- A chosen file has a valid extension but cannot be opened or inspected by the available audio reader.
- The selected file is outside the project and media copying is disabled, or the project has no usable media directory when copying is enabled.
- A selected file has no readable duration, channel count, byte order, or other individual metadata field.
- The previously displayed file is valid, then the user selects a missing or unsupported replacement; no metadata from the previous file may remain visible as current.
- The freeze artifact is missing, unreadable, or resolves to a directory.
- The `Save Copy` destination is the same file as the source, an existing freeze-named file, or a location that cannot be written.
- The user cancels either chooser after the editor has been opened with an existing valid object.
- A frozen object is unfreezed or removed while its editor is open; the editor must not continue presenting stale editable controls.
- More than one score object is selected or the selection is not an `AudioFile`/`FrozenSoundObject`; the editor must show its existing deliberate empty or unsupported state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST match the observable Java Blue behavior represented by `AudioFileEditor` and `FrozenSoundObjectEditor`, including their file selection, metadata, read-only, error, and artifact-copy flows.
- **FR-002**: The `AudioFile` editor MUST display the current file reference as a non-editable value and MUST provide a file chooser for changing it.
- **FR-003**: The `AudioFile` editor MUST provide separate Audio File and Csound views, and the Csound view MUST retain the existing post-processing code editing behavior.
- **FR-004**: The file chooser MUST accept only a selected regular file that the application can use as an audio source, and MUST report cancellation, missing paths, directories, unreadable files, and unsupported files without mutating the object.
- **FR-005**: When a new `AudioFile` is accepted, the editor MUST refresh the file reference, filename/name presentation, and all derived details as one coherent update; the object name MUST follow the selected file's basename in the Java-compatible flow.
- **FR-006**: The `AudioFile` editor MUST honor the existing project media-copy preference: when enabled, an imported external file MUST be copied into the project's media area and represented with the compatible project-relative reference; when disabled, the selected reference MUST retain the existing compatible path semantics.
- **FR-007**: For a readable source, the editor MUST present available duration, format type, byte length, encoding type, sample rate, sample size, channel count, byte order, and channel-variable information.
- **FR-008**: The editor MUST mark metadata unavailable when the source cannot provide a value and MUST clear or replace details from the prior source; it MUST NOT display stale metadata as if it belonged to the current file.
- **FR-009**: The `FrozenSoundObject` editor MUST present the source name, source type, frozen artifact filename/path, source duration, and available channel information as read-only details.
- **FR-010**: The `FrozenSoundObject` editor MUST NOT offer direct editing or replacement of the frozen artifact reference; its artifact interaction MUST be limited to inspection and `Save Copy`.
- **FR-011**: `Save Copy` MUST resolve the current freeze artifact, open a destination chooser with the current project directory as the default when available, copy the artifact bytes to a valid user-selected file, and report success or failure clearly.
- **FR-012**: `Save Copy` MUST reject directories, missing or unreadable sources, unsafe freeze-prefixed overwrite targets, and destinations that cannot be written; it MUST confirm ordinary overwrites and honor cancellation.
- **FR-013**: `Save Copy` MUST NOT modify the frozen object, its source object, the freeze state, or the `.blue` project document.
- **FR-014**: Existing freeze rendering, freeze/unfreeze, waveform display, audio playback, and missing-audio recovery behavior MUST remain functional after these editor changes.
- **FR-015**: The editor MUST preserve the existing project save and reopen contract for `AudioFile` file references and Csound post code, and MUST preserve `FrozenSoundObject` freeze references without introducing a new project persistence format.
- **FR-016**: The editor MUST retain a deliberate empty or unsupported state when no uniquely editable supported object is selected and MUST clear a stale editor when the selected object is removed or changes type.
- **FR-017**: Automated verification MUST cover valid selection, chooser cancellation, media-copy and path/name behavior, metadata refresh and failure states, Csound post-code persistence, frozen read-only presentation, successful byte-for-byte Save Copy, and every Save Copy rejection/confirmation path.

### Existing Behavior & Data Compatibility *(mandatory when applicable)*

- **Reference Behavior**: Java Blue's `AudioFileEditor` provides an Audio File tab, a Csound tab, a non-editable path field with a chooser, project-media import handling, file metadata rows, channel-variable feedback, and explicit missing/unsupported-file states. Java Blue's `FrozenSoundObjectEditor` provides read-only source/artifact details and a `Save Copy` workflow with missing-file, directory, overwrite, and freeze-prefixed destination safeguards. Existing TypeScript score-object editing, missing-audio handling, waveform bars, and freeze rendering are the behavior being completed rather than replaced.
- **Compatibility Requirements**: `.blue` XML remains the canonical project format. Existing `AudioFile` file references and Csound post code, and existing `FrozenSoundObject` freeze/source references, MUST continue to round-trip. File metadata, waveform data, and Save Copy destinations are derived or user-selected disk state and MUST NOT be serialized as new project fields. A Save Copy operation MUST leave canonical project data unchanged.
- **Intentional Divergences**: None. If a host cannot provide an individual metadata value, the UI will show an explicit unavailable state and retain the compatible file reference rather than fabricating a value; this is an error-state requirement, not a change to Java Blue's project data semantics.
- **State Ownership**: The Electron main process remains the canonical owner of the active project document and owns file dialogs, project-relative path resolution, media import copies, artifact inspection, and Save Copy filesystem operations. Renderer editor snapshots and open/error/metadata presentation remain transient session state. `.blue` remains the only durable project state affected by ordinary `AudioFile` edits; derived metadata, waveform caches, freeze artifacts, and Save Copy destinations remain outside project XML.

### Key Entities *(include if feature involves data)*

- **AudioFile Editor State**: The selected source reference, displayed filename/name, available audio metadata, channel-variable information, Csound post code, and current missing/unsupported status for one `AudioFile`.
- **Audio Metadata**: Read-only details derived from the selected source, including duration, format, byte length, encoding, sample rate, sample size, channels, and byte order.
- **FrozenSoundObject Inspector State**: Read-only source identity, source type, frozen artifact reference, source duration, channel information, artifact availability, and Save Copy status for one frozen object.
- **Freeze Artifact**: The rendered audio file referenced by a `FrozenSoundObject`; it is derived project data that can be inspected or copied but is not edited through the score-object editor.
- **File Transfer Result**: The accepted, cancelled, missing, unreadable, unsupported, or rejected result of a source selection, media import, or Save Copy operation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of valid `AudioFile` fixtures show the chooser, both editor views, and every metadata field that the fixture reader can provide, with no stale values after switching files.
- **SC-002**: In acceptance testing, 100% of valid `FrozenSoundObject` fixtures show the required source/artifact details with no editable artifact-path control; `Save Copy` is the only artifact export action.
- **SC-003**: Across the defined Save Copy success, cancellation, missing-source, directory, overwrite, freeze-prefixed, and unwritable-destination cases, every case produces the specified outcome and zero unintended project mutations.
- **SC-004**: A user can recover a missing `AudioFile` by choosing a valid replacement in one editor session, and the editor returns to a complete available-metadata state without reopening the project.
- **SC-005**: Project save/reopen acceptance tests preserve all edited `AudioFile` references and Csound post code, while recomputed metadata matches the referenced source and existing freeze/waveform behavior remains green.
- **SC-006**: Focused automated tests cover all functional requirements in FR-002 through FR-017, including both success and failure paths for host file operations.

## Assumptions

- The feature applies to one uniquely selected `AudioFile` or `FrozenSoundObject` at a time; existing empty, mixed, and unsupported-selection behavior remains the fallback outside this scope.
- Existing project media-copy preference, media-directory rules, freeze rendering, unfreeze behavior, waveform presentation, playback, and project save/reopen flows are available for reuse and are not redesigned here.
- Java Blue remains the authoritative behavioral reference for user-visible editor details and file-operation safeguards.
- The available audio reader may not expose every metadata field for every format; the editor will show available values and explicit unavailable states without blocking an otherwise usable source unnecessarily.
- No new durable settings store, project format, or external audio interchange format is required for this feature.
- AudioClip, generic file-backed score objects other than `AudioFile`, and a redesign of waveform rendering are outside this feature unless required to preserve the existing shared editor contract.
