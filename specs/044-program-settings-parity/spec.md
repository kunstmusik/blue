# Feature Specification: Program Settings Parity

**Feature Branch**: `044-program-settings-parity`  
**Created**: 2026-05-19  
**Status**: Closed  
**Input**: User description: "Use spec-kit process to create a new spec to implement all Program Settings options from Java Blue (blue-settings package). These settings are program-wide and many are used as default values for new projects. There are already some settings implemented in TS Blue but I'm not sure how much of those values are used. We'll need a spec with good detail to implement a panel for each of the settings panels in blue-settings. Be careful that we check that each setting is used in the app as it is in Java blue. If there's a major feature (like disk rendering) that is not yet implemented, collect those features and report them here and we can create additional specs to both implement the feature and make sure they use the setting."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit Every Active Java Blue Settings Panel (Priority: P1)

As a composer configuring Blue globally, I need the Settings window to expose every active Java Blue program settings panel and every option from those panels so that my app-wide defaults are visible, editable, and persistent.

**Why this priority**: The main value of this feature is complete program-setting parity. A partial Settings window would keep hidden Java defaults and make later parity work unreliable.

**Independent Test**: Open Settings without a project loaded, review each Java Blue panel category, change one value in every category, apply the changes, close and reopen Settings, and verify the values are restored.

**Acceptance Scenarios**:

1. **Given** the user opens Settings, **When** the category list is shown, **Then** it contains the six active Java Blue `blue-settings` panels: General, Project Defaults, Playback, Utility, Realtime Render, and Disk Render.
2. **Given** a settings category is selected, **When** the panel renders, **Then** every option from the corresponding Java Blue panel is represented with the same intent, default value, enabled state, and available choice list where applicable.
3. **Given** the user edits settings and applies them, **When** Settings is reopened, **Then** the edited app-wide values are restored before any project is loaded.
4. **Given** the user edits settings and cancels or closes without applying, **When** Settings is reopened, **Then** unapplied edits have not replaced the last saved values.

---

### User Story 2 - Create New Projects From Program Defaults (Priority: P1)

As a composer creating a new project, I need program-wide defaults to initialize project author, mixer state, render properties, disk render properties, score ruler defaults, snap behavior, layer height, and UDO style just as Java Blue does.

**Why this priority**: Many Java Blue program settings exist primarily to seed new projects. If they save but do not affect new projects, the Settings UI is misleading.

**Independent Test**: Change project-default, realtime-render, and disk-render settings, create a new project, and verify the new project's properties, score time state, mixer state, and future UDO/effect defaults reflect the saved program settings.

**Acceptance Scenarios**:

1. **Given** the user changes Default Author, Mixer Enabled, Default Layer Height, ruler defaults, snap defaults, SMPTE frame rate, and Default UDO Style, **When** a new project is created, **Then** those project and score defaults are applied to the new project or to new project-owned items as Java Blue applies them.
2. **Given** the user changes Realtime Render defaults, **When** a new project is created, **Then** the new project's realtime sample rate, ksmps, channel count, 0dbfs setting, audio/MIDI usage flags, message-level flags, and advanced settings match the saved realtime defaults.
3. **Given** the user changes Disk Render defaults, **When** a new project is created, **Then** the new project's disk sample rate, ksmps, channel count, 0dbfs setting, message-level flags, and advanced settings match the saved disk defaults.
4. **Given** an existing project is already loaded, **When** program defaults are changed, **Then** existing project-owned values are not silently overwritten unless Java Blue updates that specific future-create behavior rather than existing project data.

---

### User Story 3 - Use Program Settings In Runtime Behavior (Priority: P1)

As a composer playing, rendering, freezing, importing, or editing project content, I need saved program settings to affect the same workflows they affect in Java Blue so that the settings are operational rather than cosmetic.

**Why this priority**: The user explicitly asked to verify each setting is used as in Java Blue. Settings that are saved but ignored should be treated as incomplete.

**Independent Test**: For each saved setting, run the matching user workflow or inspect its generated command/options/output state and verify the workflow consumes the saved setting or is reported as blocked by a missing feature.

**Acceptance Scenarios**:

1. **Given** realtime playback starts, **When** the app builds realtime options and command display, **Then** program-level realtime settings and project-level render flags combine according to Java Blue command-line behavior.
2. **Given** disk rendering or disk CSD generation runs, **When** the app prepares disk output, **Then** disk render program defaults and project disk settings are used where Java Blue uses them; any missing disk-render execution workflow is reported as a feature dependency.
3. **Given** score playback runs, **When** the playhead updates, **Then** playback FPS, latency correction, follow playback, and follow-on-render-start settings affect playhead animation and scrolling behavior.
4. **Given** a utility workflow such as SoundObject freeze or SoundFont inspection is available, **When** it invokes Csound, **Then** the Utility Csound executable and freeze flags are used as Java Blue uses them; unavailable utility workflows are reported as feature dependencies.

---

### User Story 4 - Preserve And Classify Existing Current-App Settings (Priority: P2)

As a user who already has app-level values saved in the current Blue app, I need existing settings to be preserved or migrated into the expanded settings model so that introducing Java Blue parity does not silently discard useful preferences.

**Why this priority**: The current app already has a small Settings window and a persisted settings store. This feature must avoid losing those values while separating Java Blue program settings from newer app-specific preferences.

**Independent Test**: Start with existing saved engine path, recent project file list, window bounds, MIDI placeholder values, and OSC placeholder values, upgrade to the expanded Settings surface, and verify each value remains available in an appropriate category or app-specific area.

**Acceptance Scenarios**:

1. **Given** the current app already has saved app settings, **When** the expanded Settings model first loads, **Then** existing values are either mapped into Java-compatible settings, retained as app-specific settings, or explicitly deprecated with a visible migration decision.
2. **Given** a setting appears in both current-app settings and Java Blue program settings, **When** migration occurs, **Then** the app documents the precedence rule and does not keep two conflicting active values for one workflow.
3. **Given** MIDI or OSC placeholders exist from prior Blue Live work, **When** this feature lands, **Then** they are preserved or moved without being confused with the Java `blue-settings` panel set.

---

### User Story 5 - Report Missing Feature Dependencies (Priority: P2)

As a maintainer planning parity work, I need a clear report of settings whose Java workflows are not implemented yet so that follow-up specs can implement those workflows and connect them to the settings.

**Why this priority**: Some settings, especially disk render execution and utility workflows, may depend on features beyond a settings panel. Capturing those dependencies prevents false completion.

**Independent Test**: Review the final parity matrix and confirm every Java Blue setting is marked as used by a current workflow, used as a new-project default, app-specific, resource-only/stale, or blocked by a named follow-up feature.

**Acceptance Scenarios**:

1. **Given** a setting depends on an unavailable workflow, **When** implementation is complete for this spec, **Then** the setting remains editable only if its status clearly says which workflow still needs a follow-up spec.
2. **Given** a workflow is present but does not yet consume the saved setting, **When** the feature is validated, **Then** that workflow is either corrected or listed as incomplete.
3. **Given** the stale Text Settings resource strings are present in the Java resource bundle, **When** the active Java settings inventory is reported, **Then** Text Settings is identified as resource-only in `blue-settings` because no active panel/controller is registered by the Java layer.

### Edge Cases

- What happens when saved settings contain invalid numbers, unknown enum values, unavailable render services, or unavailable driver names?
- What happens when a user changes defaults while a project is loaded and then creates a new project in the same app session?
- What happens when no project is loaded but Settings is opened and edited?
- What happens when a configured Csound executable, work directory, or external command path no longer exists?
- What happens when an operating system does not support a Java Blue default driver option or device discovery path?
- What happens when a workflow is not implemented yet but its setting can still be edited?
- What happens when current-app settings conflict with Java Blue program settings during migration?
- What happens when multiple Settings windows or repeated Settings commands are invoked?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST use the Java Blue `blue-settings` layer registration as the source of active program settings panels and MUST expose exactly the active registered categories General, Project Defaults, Playback, Utility, Realtime Render, and Disk Render for this feature.
- **FR-002**: The system MUST record that Java `blue-settings` contains Text Settings resource strings but no active registered Text Settings panel/controller, and MUST NOT claim Text Settings parity unless a real active Java source panel is identified.
- **FR-003**: The Settings surface MUST support review, edit, apply, cancel, validation feedback, and reopening of saved program-wide settings without requiring a project to be loaded.
- **FR-004**: General settings MUST include Work Directory, New User Defaults Enabled, Message Colors Enabled, Csound Error Warning Enabled, and Max Temp Files per Directory, with Java defaults of empty work directory, true, false, true, and 3 respectively.
- **FR-005**: Project Defaults settings MUST include Default Author, Mixer Enabled, Default Layer Height, Default UDO Style, Primary Ruler, Secondary Ruler Enabled, Secondary Ruler, Snap Enabled, Snap Value, and SMPTE Frame Rate, with Java defaults of empty author, mixer enabled, layer height index 0, Modern UDO style, Beats primary ruler, secondary ruler disabled, Time secondary ruler, snap disabled, Beat snap value, and 24 fps SMPTE.
- **FR-006**: Project Defaults MUST offer Java-compatible choices for layer height 1 through 9, UDO style Classic/Modern, TimeBase values Beats, BBT, BBST, BBF, Time, Seconds, SMPTE, and Samples, SnapValue choices supported by the project model, and SMPTE frame rates 23.976, 24, 25, 29.97, 30, 50, 59.94, and 60 fps.
- **FR-007**: Playback settings MUST include Time Pointer Animation Latency/FPS, Latency Correction, Score Follows Playback, and Enable Follows Playback on Render Start, with Java defaults of 24 fps, 0.0 seconds, true, and true.
- **FR-008**: Utility settings MUST include Csound Executable and Freeze Flags, with Java-compatible operating-system defaults of `/usr/local/bin/csound` and `-Ado` on macOS, and `csound` and `-Wdo` on other supported platforms.
- **FR-009**: Realtime Render settings MUST include Csound Executable, default sr, default ksmps, default nchnls, 0dbfs enabled/value, audio driver enabled/value, audio out enabled/value, audio in enabled/value, MIDI driver enabled/value, MIDI out enabled/value, MIDI in enabled/value, software buffer enabled/size, hardware buffer enabled/size, Note Amplitudes, Out-of-Range Messages, Warnings, Benchmark Information, Disable Displays, Advanced Settings, and Render Method.
- **FR-010**: Realtime Render MUST use Java-compatible defaults: sr 44100, ksmps 1, nchnls 2, 0dbfs enabled with value 1, audio driver enabled, audio out enabled with `dac`, audio in disabled with `adc`, MIDI driver enabled with `PortMidi`, MIDI in/out disabled with empty device text, buffers disabled, message-level flags enabled, displays disabled, and empty advanced settings.
- **FR-011**: Realtime Render MUST use Java-compatible operating-system defaults for realtime buffer sizes and audio driver: macOS uses software buffer 1024, hardware buffer 4096, and `pa_bl`; Windows uses software buffer 4096 and hardware buffer 16384; other platforms use software buffer 256, hardware buffer 1024, and `PortAudio`.
- **FR-012**: Realtime Render MUST offer Java-compatible driver choices by platform for audio and MIDI drivers, and MUST handle unavailable device discovery or render-method choices by reporting the limitation rather than fabricating devices.
- **FR-013**: Disk Render settings MUST include Csound Executable, default sr, default ksmps, default nchnls, 0dbfs enabled/value, file format enabled/value, sample format enabled/value, Save Peak Information in Header, Dither Output, Rewrite Header While Rendering, Note Amplitudes, Out-of-Range Messages, Warnings, Benchmark Information, Disable Displays, Advanced Settings, Render Method, Render and Play enabled/command, and Render and Open command.
- **FR-014**: Disk Render MUST use Java-compatible defaults: Csound executable `csound` or `/usr/local/bin/csound` on macOS, sr 44100, ksmps 1, nchnls 2, 0dbfs enabled with value 1, file format enabled with WAV, sample format enabled with SHORT, save peak enabled, dither disabled, rewrite header enabled, message-level flags enabled, displays disabled, empty advanced settings, render/play disabled with `command $outfile`, and render/open command `command $outfile`.
- **FR-015**: Disk Render MUST offer Java-compatible file format choices WAV, AIFF, AU, RAW, IRCAM, W64, WAVEX, SD2, and FLAC, and sample format choices ALAW, ULAW, SCHAR, UCHAR, FLOAT, SHORT, LONG, and 24BIT.
- **FR-016**: Program settings MUST be stored app-wide, MUST be available before any project is loaded, and MUST not be serialized into `.blue` project files except through project values that Java Blue also seeds from program defaults.
- **FR-017**: Creating a new project MUST apply Project Defaults to the new project author, mixer enabled state, root layer-group default height behavior, score primary and secondary ruler state, snap state and value, SMPTE frame rate, and future default UDO/effect style.
- **FR-018**: Creating a new project MUST apply Realtime Render defaults to the project's realtime sample rate, ksmps, channel count, 0dbfs enabled/value, audio/MIDI usage flags, message-level flags, and advanced settings.
- **FR-019**: Creating a new project MUST apply Disk Render defaults to the project's disk sample rate, ksmps, channel count, 0dbfs enabled/value, message-level flags, and advanced settings.
- **FR-020**: Realtime playback MUST consume program-level realtime command settings where Java Blue does, including Csound executable or equivalent runtime command selection, message color suppression/enabling, audio/MIDI driver selections, device selections, buffer flags, display disabling, and advanced settings, combined with project-level realtime flags.
- **FR-021**: Realtime playback MUST consume Playback settings for playhead update frequency, latency correction, follow playback, and follow-on-render-start behavior.
- **FR-022**: Disk render workflows MUST consume Disk Render settings where Java Blue does, including executable or equivalent runtime command selection, format/sample options, header/peak/dither/display options, message color suppression/enabling, render service/method, external play command, and external open command.
- **FR-023**: Utility workflows MUST consume Utility settings where Java Blue does, including SoundObject freeze/unfreeze and SoundFont-related Csound inspection when those workflows are present.
- **FR-024**: General settings MUST be consumed where Java Blue consumes them, including work-directory defaults for file choosers/import/export flows, New User Defaults behavior, message color behavior in render commands, Csound error warning behavior, and temporary-file-per-directory limit.
- **FR-025**: The implementation MUST produce a setting usage parity matrix covering every setting in FR-004 through FR-015, with status values of used by workflow, used as new-project default, app-specific retained, resource-only/stale, or blocked by named missing feature.
- **FR-026**: Existing current-app settings MUST be inventoried and migrated or retained, including engine path, recent project files, window bounds, MIDI placeholder values, and OSC placeholder values; Java-compatible settings MUST not conflict with retained app-specific settings.
- **FR-027**: Numeric fields MUST validate user input before apply and MUST keep the last valid saved value when invalid input is entered.
- **FR-028**: Path and command fields MUST allow advanced users to enter non-existing paths or commands when Java Blue allows free text, but the workflows that execute them MUST show actionable errors when the path or command fails.
- **FR-029**: Automated tests MUST cover settings persistence, apply/cancel behavior, active category inventory, new-project default application, realtime option consumption, playback follow/latency behavior, current-app setting migration, and the usage parity matrix.
- **FR-030**: Any setting whose consuming workflow is unavailable by the end of this feature MUST be included in the missing-feature report with the setting names, Java workflow, current app status, and recommended follow-up spec scope.

### Key Entities *(include if feature involves data)*

- **Program Settings**: App-wide values equivalent to Java Blue `blue-settings`, available independently of project files and used by project creation or app workflows.
- **Settings Panel**: A user-facing category corresponding to an active Java Blue options panel: General, Project Defaults, Playback, Utility, Realtime Render, or Disk Render.
- **Project Default Template**: The subset of program settings copied into new project data or applied to future project-owned items when Java Blue creates a new project or item.
- **Runtime Render Defaults**: Program-level realtime settings that affect how playback command/options are built alongside project-owned render flags.
- **Disk Render Defaults**: Program-level disk settings that affect new project disk defaults and disk render execution behavior.
- **Usage Parity Matrix**: A validation artifact listing every Java setting, its saved value/default, Java usage, current app usage, and completion or dependency status.
- **Missing Feature Dependency**: A named app workflow required before a setting can be fully consumed with Java-compatible behavior.
- **Current-App Settings**: Existing non-Java or pre-parity app preferences such as engine path, recent projects, window bounds, MIDI placeholders, and OSC placeholders that must be retained or classified.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can open Settings and confirm all six active Java Blue settings panels are present with no missing options from the registered Java panels.
- **SC-002**: A reviewer can edit at least one value in each panel, apply changes, reopen Settings, and see all applied values restored.
- **SC-003**: A reviewer can cancel edits in at least three panels and verify the prior saved values remain unchanged.
- **SC-004**: After changing project-default, realtime-default, and disk-default values, a reviewer can create a new project and verify at least 95% of Java-seeded default fields match the saved program settings, with any remaining fields listed as missing-feature dependencies.
- **SC-005**: Realtime playback command/options and playhead behavior can be validated against changed program settings for message colors, display disabling, buffer settings, audio/MIDI settings, advanced settings, FPS, latency correction, and follow playback behavior.
- **SC-006**: Disk render settings are either consumed by a working disk-render execution workflow or listed in the missing-feature report with a follow-up spec recommendation.
- **SC-007**: The usage parity matrix accounts for 100% of settings listed in this spec, with no unclassified settings.
- **SC-008**: Existing current-app settings remain available after the expanded settings model is introduced, and migration/retention behavior is covered by automated tests.

## Assumptions

- The Java `blue-settings` layer registration, not stale resource bundle strings alone, defines the active panel set for this feature.
- Text Settings bundle entries are treated as resource-only unless a real active Java panel/controller is found during planning.
- App-wide settings are not project data; they seed or influence projects only where Java Blue does so.
- Changing program defaults does not mutate already-loaded project properties unless Java Blue applies that setting to future-created child items or runtime behavior.
- The current app's engine path is app-specific and may not be the same setting as Java Blue's Csound executable fields; migration must classify it explicitly.
- Disk CSD generation exists, but full Java-style disk render execution, render-and-play, and render-and-open behavior may need a follow-up feature if not already implemented.
- Utility settings depend on SoundObject freeze/unfreeze and SoundFont utility workflows; if those workflows are absent, this feature reports them rather than pretending the settings are fully used.

## Major Feature Dependencies To Report

- **Disk Render Execution**: Java Blue has settings for Csound executable, file/sample format flags, render method, external render-and-play, and render-and-open commands. Current app support must be checked beyond CSD export; if audio file rendering/play/open is missing, create a follow-up disk-render execution spec.
- **Utility Freeze/Unfreeze**: Java Blue's Utility panel drives SoundObject freeze flags and executable selection. If SoundObject freeze/unfreeze is not implemented, create a follow-up score utility/freeze spec before marking Utility settings fully consumed.
- **SoundFont Utility**: Java Blue uses Utility Csound executable for SoundFont inspection. If this utility is absent, record it as a separate follow-up unless intentionally deferred.
- **Device Discovery And Render Method Selection**: Java Blue lists audio/MIDI devices and render service factories. If current runtime architecture cannot expose equivalent choices, create a follow-up device/render-method discovery spec or explicitly narrow parity.
- **General Work Directory Consumers**: Java Blue uses Work Directory for several import/export chooser defaults. Missing import/export workflows such as code repository, UDO library, effects library, or preset import/export must be listed with their affected settings.
- **New User Defaults**: Java Blue uses this for code repository default insertion. If the code repository workflow is missing, track it as a follow-up before marking this setting used.
- **Csound Error Warning**: Java Blue consumes this in the command-line realtime renderer. If the current runtime has an equivalent error path, the setting should control its warning behavior; otherwise record the gap with a follow-up or an explicit non-parity decision. Alpha marquee drawing is intentionally excluded because it is a legacy Swing presentation option with no current TypeScript feature.
