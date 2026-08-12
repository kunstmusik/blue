# Data Model: Program Settings Parity

## Entity: ProgramSettingsSnapshot

**Purpose**: Complete app-wide Java-compatible settings snapshot exposed to main, preload, and renderer code.

**Fields**:
- `version`: settings schema version for migrations.
- `general`: GeneralSettingsSnapshot.
- `projectDefaults`: ProjectDefaultsSettingsSnapshot.
- `playback`: PlaybackSettingsSnapshot.
- `utility`: UtilitySettingsSnapshot.
- `realtimeRender`: RealtimeRenderSettingsSnapshot.
- `diskRender`: DiskRenderSettingsSnapshot.
- `appSpecific`: CurrentAppSettingsSnapshot.
- `lastSavedAt`: optional timestamp for diagnostics.

**Relationships**:
- Owns all active Java-compatible panel snapshots.
- Owns retained current-app settings that are not Java `blue-settings` values.
- Feeds ProjectDefaultApplication and RuntimeSettingsUsage.

**Validation**:
- Missing sections are filled from Java-compatible defaults.
- Unknown enum values fall back to Java defaults and produce validation warnings.
- Invalid numeric values are rejected on apply and do not replace the last saved snapshot.

## Entity: GeneralSettingsSnapshot

**Purpose**: App-wide General panel values.

**Fields**:
- `workDirectory`: string path, default empty.
- `newUserDefaultsEnabled`: boolean, default true.
- `messageColorsEnabled`: boolean, default false.
- `csoundErrorWarningEnabled`: boolean, default true.
- `directoryTempFileLimit`: integer, default 3.

**Consumers**:
- File chooser/import/export default locations.
- Render option message-color behavior.
- Temporary CSD snapshot cleanup grouping where supported.
- Code repository defaults and realtime Csound error warnings.

## Entity: ProjectDefaultsSettingsSnapshot

**Purpose**: Program defaults copied into new projects and future project-owned objects.

**Fields**:
- `defaultAuthor`: string, default empty.
- `mixerEnabled`: boolean, default true.
- `layerHeightDefault`: integer index 0 through 8, default 0.
- `defaultUdoStyle`: `CLASSIC` or `MODERN`, default `MODERN`.
- `defaultPrimaryTimeBase`: TimeBase, default `BEATS`.
- `defaultSecondaryRulerEnabled`: boolean, default false.
- `defaultSecondaryTimeBase`: TimeBase, default `TIME`.
- `defaultSnapEnabled`: boolean, default false.
- `defaultSnapValue`: SnapValueName, default `BEAT`.
- `defaultSmpteFrameRate`: number, default 24.0.

**Consumers**:
- New project `ProjectProperties.author`.
- New project mixer enabled state.
- Root score layer group default height behavior.
- New project `Score.timeState`.
- New UDO/effect default style where new UDO/effect creation exists.

## Entity: PlaybackSettingsSnapshot

**Purpose**: Program playback and playhead-scrolling behavior.

**Fields**:
- `playbackFps`: integer, default 24.
- `playbackLatencyCorrection`: number in seconds, default 0.0.
- `followPlayback`: boolean, default true.
- `followPlaybackOnStart`: boolean, default true.

**Consumers**:
- Renderer playback display tick cadence where applicable.
- Realtime playhead interpolation/latency correction.
- Score auto-scroll follow behavior.
- Native menu checked states and playback store defaults.

## Entity: UtilitySettingsSnapshot

**Purpose**: Program Csound utility invocation settings.

**Fields**:
- `csoundExecutable`: string, default `/usr/local/bin/csound` on macOS and `csound` elsewhere.
- `freezeFlags`: string, default `-Ado` on macOS and `-Wdo` elsewhere.

**Consumers**:
- SoundObject freeze/unfreeze when available.
- SoundFont utility Csound inspection when available.
- Missing-feature report when consumers are unavailable.

## Entity: RealtimeRenderSettingsSnapshot

**Purpose**: Program realtime render command defaults and new-project realtime defaults.

**Fields**:
- `csoundExecutable`: string.
- `defaultSr`: string, default `44100`.
- `defaultKsmps`: string, default `1`.
- `defaultNchnls`: string, default `2`.
- `useZeroDbfs`: boolean, default true.
- `zeroDbfs`: string, default `1`.
- `audioDriverEnabled`: boolean, default true.
- `audioDriver`: string, platform default.
- `audioOutEnabled`: boolean, default true.
- `audioOutText`: string, default `dac`.
- `audioInEnabled`: boolean, default false.
- `audioInText`: string, default `adc`.
- `midiDriverEnabled`: boolean, default true.
- `midiDriver`: string, default `PortMidi`.
- `midiOutEnabled`: boolean, default false.
- `midiOutText`: string, default empty.
- `midiInEnabled`: boolean, default false.
- `midiInText`: string, default empty.
- `softwareBufferEnabled`: boolean, default false.
- `softwareBufferSize`: integer, platform default.
- `hardwareBufferEnabled`: boolean, default false.
- `hardwareBufferSize`: integer, platform default.
- `noteAmpsEnabled`: boolean, default true.
- `outOfRangeEnabled`: boolean, default true.
- `warningsEnabled`: boolean, default true.
- `benchmarkEnabled`: boolean, default true.
- `displaysDisabled`: boolean, default true.
- `advancedSettings`: string, default empty.
- `renderMethod`: string identifier, default first available method.

**Consumers**:
- New project realtime properties.
- Realtime playback option generation.
- Render method/device discovery where available.

## Entity: DiskRenderSettingsSnapshot

**Purpose**: Program disk render command defaults and new-project disk defaults.

**Fields**:
- `csoundExecutable`: string.
- `defaultSr`: string, default `44100`.
- `defaultKsmps`: string, default `1`.
- `defaultNchnls`: string, default `2`.
- `useZeroDbfs`: boolean, default true.
- `zeroDbfs`: string, default `1`.
- `fileFormatEnabled`: boolean, default true.
- `fileFormat`: enum, default `WAV`.
- `sampleFormatEnabled`: boolean, default true.
- `sampleFormat`: enum, default `SHORT`.
- `savePeakInformation`: boolean, default true.
- `ditherOutput`: boolean, default false.
- `rewriteHeader`: boolean, default true.
- `noteAmpsEnabled`: boolean, default true.
- `outOfRangeEnabled`: boolean, default true.
- `warningsEnabled`: boolean, default true.
- `benchmarkEnabled`: boolean, default true.
- `displaysDisabled`: boolean, default true.
- `advancedSettings`: string, default empty.
- `renderMethod`: string identifier, default first available method.
- `externalPlayCommandEnabled`: boolean, default false.
- `externalPlayCommand`: string, default `command $outfile`.
- `externalOpenCommand`: string, default `command $outfile`.

**Consumers**:
- New project disk properties.
- Disk render/CSD export option generation where available.
- Render-and-play/open follow-up dependency tracking.

## Entity: CurrentAppSettingsSnapshot

**Purpose**: Existing app-specific preferences retained separately from Java program settings.

**Fields**:
- `enginePath`: string, current app default `blue-engine`.
- `recentFiles`: string list.
- `windowBounds`: optional rectangle.
- `midiInputDevice`: string.
- `midiOutputDevice`: string.
- `oscInputPort`: number.
- `oscOutputHost`: string.
- `oscOutputPort`: number.

**Migration Rules**:
- Retain recent files and window bounds as app-specific values.
- Retain MIDI/OSC placeholders unless a future spec assigns concrete consumers.
- Do not map `enginePath` to Csound executable without explicit user-facing migration because it points to blue-engine, not Csound.

## Entity: SettingsDraft

**Purpose**: Renderer-local editable copy of ProgramSettingsSnapshot.

**State transitions**:
- `loaded` -> `dirty` when any field changes.
- `dirty` -> `validating` when Apply is requested.
- `validating` -> `saved` when main process accepts and persists the snapshot.
- `validating` -> `invalid` when validation fails.
- `dirty` -> `discarded` when Cancel or close without apply is chosen.

## Entity: UsageParityMatrixEntry

**Purpose**: One traceability row for a Java setting.

**Fields**:
- `panel`: settings panel name.
- `settingKey`: stable key.
- `displayName`: user-facing label.
- `javaDefault`: documented Java default.
- `javaUsage`: Java workflow or new-project seed behavior.
- `currentStatus`: `used-by-workflow`, `used-as-new-project-default`, `app-specific-retained`, `resource-only-stale`, or `blocked-by-missing-feature`.
- `consumerPath`: optional implementation area.
- `missingFeature`: optional FeatureParityNote id.

## Entity: FeatureParityNote

**Purpose**: Developer-facing Java parity note for one or more settings. Notes may document either remaining gaps or completed parity work.

**Fields**:
- `id`: stable identifier such as `disk-render-execution`.
- `title`: short name.
- `affectedSettings`: setting keys.
- `javaWorkflow`: behavior in Java Blue.
- `currentAppStatus`: observed current status.
- `recommendedSpecScope`: recommended follow-up feature scope.
