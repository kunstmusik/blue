# Feature Specification: Render to Disk and ScoreObject Freezing Parity

**Feature Branch**: `056-render-freeze-parity`  
**Created**: 2026-07-10  
**Status**: Complete (2026-07-11)  
**Input**: User description: "Create a spec for Render to Disk and ScoreObject Freezing as they're related. Review Java Blue implementation. Objects should freeze and unfreeze to the same file names and file formats as what Java Blue implements."

Render to Disk and ScoreObject Freezing are related audio-rendering workflows, but they have different user-facing contracts. Render to Disk creates a user-selected project render using Disk Render settings. Freezing creates a project-local cached audio artifact for one or more selected ScoreObjects using Utility settings, replaces each object with a `FrozenSoundObject`, and later restores the original object.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Render the Project to an Audio File (Priority: P1)

As a composer, I need Render to Disk to produce an audio file from the project using my saved disk-render settings so I can deliver, archive, or inspect a rendered performance.

**Why this priority**: Audio-file rendering is the primary disk-output workflow and is currently a missing consumer of the project and program disk-render settings.

**Independent Test**: Open a saved project with a known render range, choose an output path, render it, and verify that a playable audio file is created with the requested Java-compatible format and sample format.

**Acceptance Scenarios**:

1. **Given** a project with a render range and a selected output path, **When** the user invokes Render to Disk, **Then** the application renders audio to that exact path and reports progress until completion.
2. **Given** Disk Render settings with file format WAV and sample format SHORT enabled, **When** the user renders, **Then** the generated command uses Java Blue's equivalent format selection and the resulting file is a WAV file using the selected sample representation.
3. **Given** `diskAlwaysRenderEntireProject` is enabled, **When** the user invokes Render to Disk, **Then** rendering starts at project time zero and covers the entire project rather than only the current render selection.
4. **Given** the user cancels the output dialog, **When** Render to Disk is invoked, **Then** no render starts and no project settings or files are changed.

---

### User Story 2 - Freeze and Unfreeze ScoreObjects (Priority: P1)

As a composer, I need to freeze a selected ScoreObject into audio and unfreeze it later so expensive or unstable score content can be replaced temporarily by a playable cached result without losing the original object.

**Why this priority**: Freezing is the second primary workflow and depends on reliable disk rendering, project-relative artifact handling, and preservation of the source object.

**Independent Test**: Select a supported SoundObject in a saved project, freeze it, close and reopen the project, then unfreeze it. Verify the artifact, source object, timing, and layer placement before and after the round trip.

**Acceptance Scenarios**:

1. **Given** a saved project and a selected SoundObject, **When** the user chooses Freeze/Unfreeze ScoreObjects, **Then** the object is rendered to a project-local freeze file and replaced in the same layer by a `FrozenSoundObject`.
2. **Given** a `FrozenSoundObject`, **When** the user chooses Freeze/Unfreeze ScoreObjects, **Then** the original nested SoundObject is restored in the same layer at the frozen object's start time.
3. **Given** a selected `FrozenSoundObject` whose freeze file is also referenced by another `FrozenSoundObject`, **When** it is unfrozen, **Then** the original object is restored but the shared freeze file remains on disk.
4. **Given** the last `FrozenSoundObject` referencing a freeze file, **When** it is unfrozen, **Then** the application removes that generated freeze file after restoring the original object.

---

### User Story 3 - Preserve Java-Compatible Freeze Artifacts Across Project Lifecycles (Priority: P1)

As a composer sharing or moving a project, I need freeze artifacts and frozen-object metadata to use Java Blue's names, extensions, and project-relative references so the project remains understandable and portable across Blue implementations.

**Why this priority**: Filename and format parity is an explicit compatibility requirement, and losing the embedded source object would make unfreeze impossible after save/reopen.

**Independent Test**: Freeze objects on macOS and a non-macOS platform, inspect the generated filenames and audio headers, save/reopen the project, and compare the frozen XML fields and unfreeze result with Java Blue's contract.

**Acceptance Scenarios**:

1. **Given** a non-macOS project with no existing numbered freeze files, **When** the first object is frozen, **Then** the artifact is named `freeze0.wav` in the project directory.
2. **Given** a macOS project with no existing numbered freeze files, **When** the first object is frozen, **Then** the artifact is named `freeze0.aif` in the project directory; `.aiff` is not substituted for Java Blue's freeze extension.
3. **Given** existing files such as `freeze0.wav`, `freeze2.wav`, and unrelated files beginning with `freeze`, **When** another object is frozen, **Then** the next Java-compatible numbered filename is selected without overwriting an existing freeze artifact.
4. **Given** a saved `FrozenSoundObject`, **When** the project is reopened, **Then** its relative `frozenWaveFileName`, channel count, and nested original `soundObject` are available for playback, editing, and unfreeze.

---

### User Story 4 - Use Render Results Safely (Priority: P2)

As a composer, I need clear progress, cancellation, and failure handling for both workflows so a missing executable, invalid output, or interrupted render does not silently replace project content or leave an unusable frozen object.

**Why this priority**: Rendering invokes an external audio engine and writes files, so failure behavior is essential to trust the workflow.

**Independent Test**: Exercise cancellation, missing executable, missing output, invalid custom command, unavailable source audio, and an interrupted freeze; verify that the project remains usable and that errors identify the failed operation.

**Acceptance Scenarios**:

1. **Given** a disk render or freeze operation that fails before a valid audio file is available, **When** the failure is reported, **Then** the original project object remains in place and no incomplete `FrozenSoundObject` is committed.
2. **Given** a valid Render to Disk result, **When** the user chooses Render to Disk and Play or Render to Disk and Open, **Then** the chosen action receives the exact generated file path after rendering completes.
3. **Given** a missing freeze artifact when an existing `FrozenSoundObject` is selected, **When** the user attempts to unfreeze it, **Then** the application restores the original nested object and skips artifact deletion.

### Edge Cases

- Freezing requires a saved project directory; the action must explain this prerequisite and must not render into an unspecified working directory.
- A project directory may contain no files, malformed names such as `freeze-old.wav`, numbered names with non-freeze extensions, or gaps in numbering. Valid numeric `freezeN.*` names determine the next counter; gaps are not filled by overwriting.
- Filename allocation must be checked against the project directory and must be safe when a candidate already exists.
- macOS uses `.aif`; other supported platforms use `.wav` for generated freeze artifacts. Render-to-Disk output remains the user-selected path and may use any supported Java disk format.
- A render output path may contain spaces, Unicode, or platform-specific separators; command construction and file lookup must preserve the exact path.
- A user may cancel the output chooser, cancel an active render, close the project while a render is running, or lose access to the output directory.
- A configured executable or advanced command may be missing, invalid, or return a nonzero result; failures must not replace score objects.
- A freeze render can have a different actual duration from the source object's subjective duration. The frozen object's duration must be derived from the generated file using the active tempo context and retain the source time base.
- An enabled mixer may add extra render time to a freeze render, as in Java Blue.
- A source object may reference missing external media or project resources. Freeze must fail clearly and leave the source object untouched.
- Nested PolyObjects and multiple frozen references may point to the same artifact. Reference counting must include nested score content before deleting a freeze file.
- An older or malformed frozen object that lacks its nested source cannot be recovered and must report an error. A missing, empty, or unsafe backing-file reference must not prevent restoration when the nested source is available; cleanup is skipped instead.
- Moving a project must preserve resolution of project-relative freeze filenames when the generated audio files move with the project.
- The CSD text export workflow is distinct from Render to Disk and must not be treated as a successful audio render merely because a `.csd` file was written.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST preserve Java Blue's three settings layers: app-wide Program Disk Render settings, app-wide Program Utility settings, and project-owned `ProjectProperties` persisted in `.blue` XML. Ordinary Render to Disk MUST use the appropriate values from all three layers without conflating them; ScoreObject Freezing MUST use the Program Utility layer plus the project data needed to generate the temporary CSD.
- **FR-002**: Render to Disk MUST generate an audio file from the project and MUST support the Java Blue disk file-format choices `WAV`, `AIFF`, `AU`, `RAW`, `IRCAM`, `W64`, `WAVEX`, `SD2`, and `FLAC`.
- **FR-003**: Render to Disk MUST support the Java Blue sample-format choices `ALAW`, `ULAW`, `SCHAR`, `UCHAR`, `FLOAT`, `SHORT`, `LONG`, and `24BIT` when sample-format selection is enabled.
- **FR-004**: `fileFormatEnabled` and `sampleFormatEnabled` MUST remain independent Program Disk Render booleans, distinct from their format values. When `fileFormatEnabled` is true, disk rendering MUST express `fileFormat` as the equivalent of `--format=<file-format>` and append `:<sample-format>` only when `sampleFormatEnabled` is also true; when `fileFormatEnabled` is false, the complete `--format` option MUST be omitted.
- **FR-005**: Normal disk rendering MUST combine the layers explicitly: the Program Disk Render executable and output flags (`-K`, `-Z`, `-R`, `-d`) provide command-line behavior; project-owned `diskSampleRate`, `diskKsmps`, `diskChannels`, `diskUseZeroDbFS`, and `diskZeroDbFS` provide the disk CSD header values; project-owned `diskNoteAmpsEnabled`, `diskOutOfRangeEnabled`, `diskWarningsEnabled`, and `diskBenchmarkEnabled` provide the `-m` message-level value; and project-owned `diskAdvancedSettings` provides project-specific extra command text. The separate Program Disk Render `advancedSettings` preference MUST NOT be substituted for `diskAdvancedSettings`; the active Java command builder preserves that program preference without appending it to this project command.
- **FR-006**: New-project and migrated-project disk defaults MUST remain Java-compatible. The `ProjectProperties` baseline used for legacy or missing XML fields is 44100 sample rate, ksmps 1, two channels, zero-dbFS disabled with value `1`, and note-amplitude, out-of-range, warning, and benchmark messages enabled. A newly created project MUST then be seeded from Program Disk Render defaults exactly where Java Blue does so; the default Program Disk Render zero-dbFS setting is enabled with value `1`, and its output format defaults to WAV with SHORT samples. Program-level defaults MUST NOT override already-saved project values at render time.
- **FR-007**: `fileName` and `askOnRender` MUST remain project-owned `ProjectProperties` values. Render to Disk MUST use the saved project output filename when configured, ask for a destination when the project setting requires it, and preserve the chosen path exactly.
- **FR-008**: `diskCompleteOverride` and `diskAdvancedSettings` MUST remain project-owned values. When `diskCompleteOverride` is enabled, the project text MUST be treated as the complete Csound argument list while the executable remains owned by Program Disk Render, and it MUST NOT be merged with Program Disk Render format or output flags; the application MUST identify the output from the override's output argument for completion, validate that the generated file exists, and report an actionable error when no output file can be determined.
- **FR-009**: `diskAlwaysRenderEntireProject` MUST remain a project-owned `ProjectProperties` value. When it is enabled, Render to Disk MUST render from project time zero through the complete project duration; otherwise it MUST use the active project render window.
- **FR-010**: Render to Disk MUST provide progress and cancellation, must not report success until the output file exists, and must surface engine, command, permission, and output-file failures without mutating project score content.
- **FR-011**: Render to Disk and Play and Render to Disk and Open MUST invoke their configured follow-up action only after a successful render and MUST pass the exact generated file path, including paths containing spaces.
- **FR-012**: Freeze/Unfreeze ScoreObjects MUST operate on selected SoundObjects, toggling a selected `FrozenSoundObject` back to its stored source and freezing a selected non-frozen SoundObject into a new `FrozenSoundObject`.
- **FR-013**: Freeze MUST require a saved project directory and MUST render a deep copy of the source object so the source remains available as the nested object stored inside the resulting `FrozenSoundObject`.
- **FR-014**: Freeze MUST render the source object from its start time through its subjective end time, adding the project's mixer extra render time when the mixer is enabled, using the active tempo context for beat/second conversion.
- **FR-015**: Freeze MUST use the Program Utility Csound executable and configured freeze flags, which are independent of the Program Disk Render executable and settings. Java-compatible defaults are `-Wdo` and `.wav` on non-macOS platforms, and `-Ado` and `.aif` on macOS; user-configured Utility values MUST be honored verbatim. Freeze MUST NOT use ordinary Render to Disk command-line flags such as `--format`, `-K`, `-Z`, `-R`, or `-d`, nor the project disk command override; the Utility freeze flags provide the freeze process's output-format and output-file behavior.
- **FR-016**: Freeze artifact names MUST be project-relative and MUST follow Java Blue's `freeze` plus a nonnegative integer counter: `freeze0.wav`, `freeze1.wav`, and so on on non-macOS; `freeze0.aif`, `freeze1.aif`, and so on on macOS.
- **FR-017**: Freeze filename allocation MUST inspect existing project-directory entries beginning with `freeze`, derive the next counter from the highest parseable numeric suffix, start at zero when none exists, and continue advancing until the candidate does not exist. It MUST never overwrite an existing freeze artifact.
- **FR-018**: A successful freeze MUST set the new object's stored source, generated relative wave filename, display name using Java Blue's `F: <source name>` convention, actual channel count, generated audio duration converted to the source time base, and original start time.
- **FR-019**: Freeze replacement MUST be atomic from the user's perspective: the original object remains until rendering and audio-file inspection succeed, then the replacement is inserted in the same layer at the same start time.
- **FR-020**: Unfreeze MUST restore the stored nested source at the frozen object's start time and MUST remove the freeze artifact only when no other frozen object in the complete score, including nested PolyObjects, references the same filename.
- **FR-021**: Frozen-object persistence MUST retain Java Blue's `FrozenSoundObject` data contract: basic object properties, `numChannels`, `frozenWaveFileName`, and the nested original `soundObject`. The filename MUST remain a project-relative reference rather than an absolute machine-specific path.
- **FR-022**: Freeze playback and subsequent disk rendering MUST resolve a relative frozen filename against the current project directory before falling back to the same file-resolution behavior supported for project audio assets.
- **FR-023**: If a freeze render, duration/channel inspection, or project mutation fails, the application MUST leave the source object in place, preserve any existing valid freeze artifact, and provide an actionable error. During unfreeze, a missing or unsafe artifact path MUST NOT block restoration of a valid nested source and MUST only suppress artifact cleanup.
- **FR-024**: Render to Disk and Freeze MUST share compatible CSD-generation and audio-file validation behavior while keeping their settings, naming, and persistence contracts separate. Both workflows MUST use the active project JavaScript session for JavaScript objects and the active Java runtime session for Python and Clojure objects; CSD text export MUST not satisfy either audio-render requirement.
- **FR-025**: Automated tests MUST cover command construction, every supported disk file and sample format, output-path handling, render-window selection, entire-project rendering, cancellation/failure behavior, platform-specific freeze names and defaults, counter allocation, collision avoidance, frozen-object persistence, duration/channel metadata and format validation, same-layer replacement, nested reference counting, project-relative resolution, freeze/unfreeze round trips, shared JavaScript/Python/Clojure render contexts, frozen editor/bar integration, stereo waveform layout, and settings provenance across Program Disk Render, Program Utility, and project-owned values.
- **FR-026**: A frozen timeline object MUST expose the Java-compatible `F: <source name>` bar, a Frozen file editor, the measured frozen duration, and a waveform loaded from the project-relative artifact. Multichannel waveforms MUST render each channel in its own equal-height band using Java Blue's inner bar geometry.

### Settings Layer Contract

The implementation MUST preserve the following Java Blue ownership model:

| Layer | Java source and persistence | Settings and responsibility |
|---|---|---|
| Program Disk Render | `DiskRenderSettings`, persisted app-wide through preferences | Disk-render Csound executable; `fileFormat` and `fileFormatEnabled`; `sampleFormat` and `sampleFormatEnabled`; peak-information, dither, header-rewrite, and display flags that become `-K`, `-Z`, `-R`, and `-d`; and the separate program `advancedSettings` preference. These values are not project XML. |
| Program Utility | `UtilitySettings`, persisted app-wide through preferences | A separate Utility Csound executable and `freezeFlags`, used by Freeze and other utility workflows. Utility executable and flags MUST NOT silently reuse Program Disk Render values. |
| Project | `ProjectProperties`, persisted in `.blue` XML | Disk CSD values (`diskSampleRate`, `diskKsmps`, `diskChannels`, `diskUseZeroDbFS`, `diskZeroDbFS`); disk message toggles; `fileName`; `askOnRender`; `diskAdvancedSettings`; `diskCompleteOverride`; and `diskAlwaysRenderEntireProject`. These values travel with the project and control project-specific render behavior. |

Program defaults may seed a new project's project-owned values where Java Blue does so, but a saved project's project-owned values remain authoritative. In normal Render to Disk mode, the project `diskAdvancedSettings` value is combined with the Program Disk Render command flags. In complete-override mode, `diskCompleteOverride` selects the project `diskAdvancedSettings` as the complete Csound argument list and bypasses those Program Disk Render flags while retaining the Program Disk Render executable. Freeze uses the Program Utility executable and `freezeFlags`, while its temporary CSD is generated from the project data; it does not inherit ordinary Disk Render command-line flags.

### Java Blue Parity Basis Reviewed

The specification is based on the current Java sources in the reference checkout:

- `blue-ui-core/.../project/RenderToDiskUtility.java` for output selection, command construction, message flags, completion, and output-file validation.
- `blue-settings/.../DiskRenderSettings.java` and `blue-core/.../ProjectProperties.java` for supported disk formats, sample formats, defaults, project settings, advanced override, and whole-project rendering.
- `blue-csnd6/.../CS6DiskRendererService.java` for disk CSD generation, render-window handling, project working directory, and the distinction between generated CSD text and audio output.
- `blue-ui-core/.../score/object/actions/FreezeUnfreezeAction.java` for freeze rendering, project-relative filename allocation, platform extensions, Utility settings, object replacement, unfreeze restoration, and recursive reference-counted cleanup.
- `blue-settings/.../UtilitySettings.java` for the default `-Wdo`/`-Ado` freeze flags and Utility Csound executable.
- `blue-core/.../soundObject/FrozenSoundObject.java` for generated-note playback, duration/channel fields, and XML persistence of the nested source object.

The implementation MUST use these observed Java behaviors as the compatibility source of truth. Any intentional deviation MUST be documented with a user-visible compatibility rationale and regression coverage.

### Key Entities *(include if feature involves data)*

- **Disk Render Job**: A user-requested project audio render with a destination path, render window, disk settings, and completion state.
- **Freeze Render Job**: An object-scoped audio render using Utility settings and a generated project-local artifact name.
- **FrozenSoundObject**: A score object that plays a generated audio artifact while retaining the original SoundObject for unfreeze.
- **Freeze Artifact**: The project-relative `freezeN.wav` or `freezeN.aif` file generated by freezing, including its channel count and measured duration.
- **Project Render Settings**: Project-owned disk output, render-window, advanced-command, format-option, and message-level values.
- **Utility Render Settings**: App-owned Csound executable and freeze-flag values used only by utility workflows such as freezing.
- **Render Output**: The user-selected audio file produced by ordinary Render to Disk; it is not automatically a freeze artifact.
- **Frozen-File Reference Set**: All frozen objects in the complete score that refer to one freeze filename and determine whether cleanup is safe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every Java-supported disk file format and sample format, a focused command/output test demonstrates that the selected format is represented correctly and that the completed output is found at the requested path.
- **SC-002**: On macOS, a first freeze produces `freeze0.aif` with the configured/default AIFF freeze flags; on non-macOS, a first freeze produces `freeze0.wav` with the configured/default WAV freeze flags; neither path produces the other platform's default extension.
- **SC-003**: A project containing at least three freeze artifacts with gaps and unrelated `freeze*` filenames receives the next non-colliding Java-compatible counter without overwriting any existing file.
- **SC-004**: In a freeze/save/reopen/unfreeze test, 100% of the source object's type, serialized properties, nested source data, layer placement, and start time are restored, subject only to the measured frozen duration expected by Java Blue.
- **SC-005**: In a shared-reference test, the artifact remains after unfreezing all but one reference and is deleted only after the final reference is removed.
- **SC-006**: Render cancellation, missing executable, invalid output, and failed freeze inspection each leave the original project score content unchanged and produce an actionable error in automated tests.
- **SC-007**: Render to Disk, Render to Disk and Play, Render to Disk and Open, Freeze, and Unfreeze complete successfully in acceptance coverage for a representative project containing ordinary, nested, audio-backed, and frozen ScoreObjects. User-driven Electron acceptance covers the interactive freeze/editor/waveform flows, while main-process integration tests cover disk render and post-render action dispatch.
- **SC-008**: The feature has no unresolved filename, extension, format, persistence, or cleanup differences from the reviewed Java Blue behavior; any intentional differences are listed in the implementation's compatibility notes.
- **SC-009**: A settings-provenance test matrix covers 100% of settings listed in the Settings Layer Contract and demonstrates that changing a Program Disk Render value, Program Utility value, or project value affects only the Java-compatible workflow and layer that owns it.

## Assumptions

- Java Blue's current source behavior, including its project-local freeze naming and platform extension rules, is the compatibility baseline even where older documentation differs.
- Ordinary Render to Disk uses the existing project disk properties and app-wide Disk Render settings; Freeze uses the existing Utility Csound executable and freeze flags rather than inheriting ordinary disk-render format preferences.
- The project directory is the canonical location for generated freeze artifacts, and the serialized filename is relative to that directory so a project can be moved with its audio files.
- Csound remains the audio engine for both workflows; this feature does not add a new synthesis engine or a remote rendering service.
- A generated freeze artifact is disposable derived project data. The original SoundObject and its persisted nested representation are canonical and must survive freezing.
- Existing CSD text generation/export, realtime playback, and future waveform redesigns are outside this feature. Integrating a valid frozen artifact with the existing Frozen editor and Java-compatible multichannel bar waveform is in scope.
- The first release targets the SoundObject types already supported by the current project model; unsupported Java-only object types must fail clearly rather than being silently frozen as generic content.
- Existing Java-compatible program-settings fields for Disk Render and Utility are available to this feature; if a setting is currently only a placeholder, implementation planning must identify the dependency rather than silently ignoring it.
- Program Disk Render `advancedSettings` and project `diskAdvancedSettings` are intentionally separate. The former is an app-wide preference retained for Java settings parity; the latter is the project command text used by the active project render path.

## Completion Notes

- Implemented on branch `056-render-freeze-parity` and reviewed against the Java sources listed above.
- The final review found and resolved missing regression coverage for shared-reference cleanup, cancellation/spawn/nonzero failure safety, output-path ownership, platform audio-format validation, menu routing, shared runtime contexts, and stereo frozen waveforms.
- User-driven Electron acceptance exercised freeze/unfreeze, missing-artifact recovery, multi-object progress/settlement, measured duration, Frozen editor/bar rendering, and mono/stereo waveform behavior during implementation.
- Full monorepo tests, lint, production build, focused feature tests, and `git diff --check` pass. No intentional Java-compatibility deviations remain for the delivered scope.
