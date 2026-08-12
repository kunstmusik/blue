import type { BlueData } from '@blue/data';
import type { ProgramSettingsSnapshot, UsageParityMatrixEntry } from '../shared/program-settings';

export type { UsageParityMatrixEntry } from '../shared/program-settings';

/** Developer-facing Java parity notes; this metadata does not drive feature behavior. */
export interface FeatureParityNote {
  id: string;
  title: string;
  affectedSettings: string[];
  javaWorkflow: string;
  currentAppStatus: string;
  recommendedSpecScope: string;
}

import { UsageStatus } from '../shared/program-settings';

export const FEATURE_PARITY_NOTES: readonly FeatureParityNote[] = [
  {
    id: 'disk-render-execution',
    title: 'Disk Render Execution',
    affectedSettings: [
      'diskRender.csoundExecutable',
      'diskRender.fileFormat',
      'diskRender.sampleFormat',
      'diskRender.savePeakInformation',
      'diskRender.ditherOutput',
      'diskRender.rewriteHeader',
      'diskRender.renderMethod',
      'diskRender.externalPlayCommandEnabled',
      'diskRender.externalPlayCommand',
      'diskRender.externalOpenCommand',
    ],
    javaWorkflow: 'Java Blue executes Csound to render audio to disk with format/sample/header flags, render-and-play, and render-and-open commands.',
    currentAppStatus: 'Implemented: disk render executes Csound with program and project settings, validates output, and supports render-and-play/open follow-up commands.',
    recommendedSpecScope: 'Implemented by SPEC 056; retain this entry only as a Java-parity usage reference.',
  },
  {
    id: 'utility-freeze-unfreeze',
    title: 'Utility Freeze/Unfreeze',
    affectedSettings: [
      'utility.csoundExecutable',
      'utility.freezeFlags',
    ],
    javaWorkflow: 'Java Blue uses Utility Csound executable and freeze flags to pre-render SoundObjects to audio files.',
    currentAppStatus: 'Implemented: selected timeline SoundObjects freeze/unfreeze through the Utility Csound executable and freeze flags.',
    recommendedSpecScope: 'Implemented by SPEC 056; retain this entry only as a Java-parity usage reference.',
  },
  {
    id: 'soundfont-utility',
    title: 'SoundFont Utility',
    affectedSettings: ['utility.csoundExecutable'],
    javaWorkflow: 'Java Blue uses the Utility Csound executable for SoundFont file inspection.',
    currentAppStatus: 'Implemented: SoundFont Viewer uses the Utility Csound executable to inspect .sf2 instrument and preset metadata.',
    recommendedSpecScope: 'Implemented in the SoundFont Viewer Properties panel; retain this entry only as a Java-parity usage reference.',
  },
  {
    id: 'device-discovery-render-method',
    title: 'Device Discovery and Render Method Selection',
    affectedSettings: ['realtimeRender.renderMethod'],
    javaWorkflow: 'Java Blue lists audio/MIDI devices and render service factories via NetBeans Lookup.',
    currentAppStatus: 'Realtime driver settings use static Java-compatible choice lists; runtime device discovery and render-method selection are not implemented.',
    recommendedSpecScope: 'Create a device-discovery spec to enumerate audio/MIDI devices and render service factories at runtime, or explicitly keep renderMethod unavailable while retaining static driver lists.',
  },
  {
    id: 'general-work-directory-consumers',
    title: 'General Work Directory Consumers',
    affectedSettings: ['general.workDirectory'],
    javaWorkflow: 'Java Blue uses Work Directory as the default start directory for file choosers in import/export flows.',
    currentAppStatus: 'Implemented: generic import/export and asset file choosers use work directory when no project-specific directory is available.',
    recommendedSpecScope: 'Implemented in the main-process file chooser consumers; retain this entry only as a Java-parity usage reference.',
  },
  {
    id: 'new-user-defaults',
    title: 'New User Defaults',
    affectedSettings: ['general.newUserDefaultsEnabled'],
    javaWorkflow: 'Java Blue inserts placeholder code for newly created Code Repository snippets.',
    currentAppStatus: 'Implemented: the Code Repository editor uses the Java placeholder only when this setting is enabled.',
    recommendedSpecScope: 'Implemented by SPEC 069; retain this entry only as a Java-parity usage reference.',
  },
  {
    id: 'csound-error-warning',
    title: 'Csound Error Warning',
    affectedSettings: ['general.csoundErrorWarningEnabled'],
    javaWorkflow: 'Java Blue shows a modal warning after its command-line realtime Csound process exits with an error and points the user to the Csound output dialog.',
    currentAppStatus: 'Implemented: realtime blue-engine Csound errors, including orchestra compile failures, show a modal warning and keep the detailed error in the Csound output panel.',
    recommendedSpecScope: 'Implemented in the realtime EngineBridge error paths; retain this entry only as a Java-parity usage reference.',
  },
];

function entry(
  panel: string,
  settingKey: string,
  displayName: string,
  javaDefault: string,
  javaUsage: string,
  currentStatus: UsageStatus,
  opts?: { consumerPath?: string; missingFeature?: string },
): UsageParityMatrixEntry {
  return {
    panel,
    settingKey,
    displayName,
    javaDefault,
    javaUsage,
    currentStatus,
    ...opts,
  };
}

export function buildUsageMatrix(): UsageParityMatrixEntry[] {
  return [
    entry('general', 'general.workDirectory', 'Work Directory', '(empty)', 'File chooser default start directory', 'used-by-workflow', { consumerPath: 'main-process import/export and asset file chooser dialogs' }),
    entry('general', 'general.newUserDefaultsEnabled', 'New User Defaults Enabled', 'true', 'Code Repository new-snippet placeholder', 'used-by-workflow', { consumerPath: 'renderer: CodeRepositoryEditorModal' }),
    entry('general', 'general.messageColorsEnabled', 'Message Colors Enabled', 'false', 'Csound -+msg_color command flag', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('general', 'general.csoundErrorWarningEnabled', 'Csound Error Warning Enabled', 'true', 'Csound output error warning behavior', 'used-by-workflow', { consumerPath: 'main.ts:EngineBridge playback-error warning' }),
    entry('general', 'general.directoryTempFileLimit', 'Max Temp Files per Directory', '3', 'Temp CSD snapshot cleanup limit', 'used-by-workflow', { consumerPath: 'render-command.ts' }),

    entry('projectDefaults', 'projectDefaults.defaultAuthor', 'Default Author', '(empty)', 'New project author', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('projectDefaults', 'projectDefaults.mixerEnabled', 'Mixer Enabled', 'true', 'New project mixer state', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('projectDefaults', 'projectDefaults.defaultLayerGroupType', 'Default Layer Group', 'TRACK', 'Initial and generic new layer group type', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts, project-editor.ts' }),
    entry('projectDefaults', 'projectDefaults.layerHeightDefault', 'Default Layer Height', '0 (1)', 'Root layer group height', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('projectDefaults', 'projectDefaults.defaultUdoStyle', 'Default UDO Style', 'MODERN', 'Default style when creating new UDOs or effects', 'used-by-workflow', { consumerPath: 'renderer: UdoWorkspacePanel, EffectsChainContextMenu, unified Libraries editor' }),
    entry('projectDefaults', 'projectDefaults.defaultPrimaryTimeBase', 'Primary Ruler', 'BEATS', 'New project primary ruler', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('projectDefaults', 'projectDefaults.defaultSecondaryRulerEnabled', 'Secondary Ruler Enabled', 'false', 'New project secondary ruler', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('projectDefaults', 'projectDefaults.defaultSecondaryTimeBase', 'Secondary Ruler', 'TIME', 'New project secondary ruler timebase', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('projectDefaults', 'projectDefaults.defaultSnapEnabled', 'Snap Enabled', 'false', 'New project snap state', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('projectDefaults', 'projectDefaults.defaultSnapValue', 'Snap Value', 'BEAT', 'New project snap value', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('projectDefaults', 'projectDefaults.defaultSmpteFrameRate', 'SMPTE Frame Rate', '24', 'New project SMPTE frame rate', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),

    entry('playback', 'playback.playbackFps', 'Time Pointer Animation FPS', '24', 'Playhead update frequency', 'used-by-workflow', { consumerPath: 'playback-store.ts' }),
    entry('playback', 'playback.playbackLatencyCorrection', 'Latency Correction', '0.0', 'Playhead latency correction', 'used-by-workflow', { consumerPath: 'playback-store.ts' }),
    entry('playback', 'playback.followPlayback', 'Score Follows Playback', 'true', 'Auto-scroll follow behavior', 'used-by-workflow', { consumerPath: 'playback-store.ts' }),
    entry('playback', 'playback.followPlaybackOnStart', 'Follow on Render Start', 'true', 'Enable follow on playback start', 'used-by-workflow', { consumerPath: 'playback-store.ts' }),

    entry('utility', 'utility.csoundExecutable', 'Csound Executable', '/usr/local/bin/csound (macOS)', 'Freeze and SoundFont utility Csound', 'used-by-workflow', { consumerPath: 'freeze-score-objects.ts:planFreezeCommand; soundfont-viewer.ts:inspectSoundFont' }),
    entry('utility', 'utility.freezeFlags', 'Freeze Flags', '-Ado (macOS)', 'SoundObject freeze render flags', 'used-by-workflow', { consumerPath: 'freeze-score-objects.ts:planFreezeCommand' }),

    entry('realtimeRender', 'realtimeRender.csoundExecutable', 'Csound Executable', '/usr/local/bin/csound (macOS)', 'Realtime render executable selection', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.defaultSr', 'Default sr', '44100', 'New project realtime sample rate', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.defaultKsmps', 'Default ksmps', '1', 'New project realtime ksmps', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.defaultNchnls', 'Default nchnls', '2', 'New project realtime channels', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.useZeroDbfs', '0dbfs Enabled', 'true', 'New project 0dbfs enabled', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.zeroDbfs', '0dbfs Value', '1', 'New project 0dbfs value', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.audioDriverEnabled', 'Audio Driver Enabled', 'true', 'Realtime audio driver flag', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.audioDriver', 'Audio Driver', 'pa_bl (macOS)', 'Realtime audio driver selection', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.audioOutEnabled', 'Audio Out Enabled', 'true', 'Seeds project useAudioOut (include -o flag)', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.audioOutText', 'Audio Out', 'dac', 'Realtime audio out device (program-level)', 'used-by-workflow', { consumerPath: 'program-settings-usage.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.audioInEnabled', 'Audio In Enabled', 'false', 'Seeds project useAudioIn (include -i flag)', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.audioInText', 'Audio In', 'adc', 'Realtime audio in device (program-level)', 'used-by-workflow', { consumerPath: 'program-settings-usage.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.midiDriverEnabled', 'MIDI Driver Enabled', 'true', 'Realtime MIDI driver flag', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.midiDriver', 'MIDI Driver', 'PortMidi', 'Realtime MIDI driver selection', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.midiOutEnabled', 'MIDI Out Enabled', 'false', 'Seeds project useMidiOut (include -Q flag)', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.midiOutText', 'MIDI Out', '(empty)', 'Realtime MIDI out device (program-level)', 'used-by-workflow', { consumerPath: 'program-settings-usage.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.midiInEnabled', 'MIDI In Enabled', 'false', 'Seeds project useMidiIn (include -M flag)', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.midiInText', 'MIDI In', '(empty)', 'Realtime MIDI in device (program-level)', 'used-by-workflow', { consumerPath: 'program-settings-usage.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.softwareBufferEnabled', 'Software Buffer Enabled', 'false', 'Realtime software buffer flag', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.softwareBufferSize', 'Software Buffer Size', '1024 (macOS)', 'Realtime software buffer size', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.hardwareBufferEnabled', 'Hardware Buffer Enabled', 'false', 'Realtime hardware buffer flag', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.hardwareBufferSize', 'Hardware Buffer Size', '4096 (macOS)', 'Realtime hardware buffer size', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.noteAmpsEnabled', 'Note Amplitudes', 'true', 'New project realtime message flag', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.outOfRangeEnabled', 'Out-of-Range Messages', 'true', 'New project realtime message flag', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.warningsEnabled', 'Warnings', 'true', 'New project realtime message flag', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.benchmarkEnabled', 'Benchmark Information', 'true', 'New project realtime message flag', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.displaysDisabled', 'Disable Displays', 'true', 'Realtime -d flag', 'used-by-workflow', { consumerPath: 'main.ts:buildRealtimeEngineOptions' }),
    entry('realtimeRender', 'realtimeRender.advancedSettings', 'Advanced Settings', '(empty)', 'New project realtime advanced settings', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('realtimeRender', 'realtimeRender.renderMethod', 'Render Method', '(first available)', 'Render service factory selection', 'blocked-by-missing-feature', { missingFeature: 'device-discovery-render-method' }),

    entry('diskRender', 'diskRender.csoundExecutable', 'Csound Executable', '/usr/local/bin/csound (macOS)', 'Disk render executable selection', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.defaultSr', 'Default sr', '44100', 'New project disk sample rate', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.defaultKsmps', 'Default ksmps', '1', 'New project disk ksmps', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.defaultNchnls', 'Default nchnls', '2', 'New project disk channels', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.useZeroDbfs', '0dbfs Enabled', 'true', 'New project disk 0dbfs enabled', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.zeroDbfs', '0dbfs Value', '1', 'New project disk 0dbfs value', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.fileFormatEnabled', 'File Format Enabled', 'true', 'Disk render file format flag', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.fileFormat', 'File Format', 'WAV', 'Disk render output file format', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.sampleFormatEnabled', 'Sample Format Enabled', 'true', 'Disk render sample format flag', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.sampleFormat', 'Sample Format', 'SHORT', 'Disk render output sample format', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.savePeakInformation', 'Save Peak Information', 'true', 'Disk render peak info in header', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.ditherOutput', 'Dither Output', 'false', 'Disk render dither', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.rewriteHeader', 'Rewrite Header', 'true', 'Disk render header rewrite while rendering', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.noteAmpsEnabled', 'Note Amplitudes', 'true', 'New project disk message flag', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.outOfRangeEnabled', 'Out-of-Range Messages', 'true', 'New project disk message flag', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.warningsEnabled', 'Warnings', 'true', 'New project disk message flag', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.benchmarkEnabled', 'Benchmark Information', 'true', 'New project disk message flag', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.displaysDisabled', 'Disable Displays', 'true', 'Disk render -d flag', 'used-by-workflow', { consumerPath: 'disk-render-command.ts:planDiskCommand' }),
    entry('diskRender', 'diskRender.advancedSettings', 'Advanced Settings', '(empty)', 'New project disk advanced settings', 'used-as-new-project-default', { consumerPath: 'program-settings-application.ts' }),
    entry('diskRender', 'diskRender.renderMethod', 'Render Method', '(first available)', 'Disk render service factory', 'blocked-by-missing-feature', { missingFeature: 'device-discovery-render-method' }),
    entry('diskRender', 'diskRender.externalPlayCommandEnabled', 'Render and Play Enabled', 'false', 'External play command after render', 'used-by-workflow', { consumerPath: 'main.ts:handleRenderToDisk' }),
    entry('diskRender', 'diskRender.externalPlayCommand', 'Render and Play Command', 'command $outfile', 'External play command template', 'used-by-workflow', { consumerPath: 'main.ts:handleRenderToDisk' }),
    entry('diskRender', 'diskRender.externalOpenCommand', 'Render and Open Command', 'command $outfile', 'External open command template', 'used-by-workflow', { consumerPath: 'main.ts:handleRenderToDisk' }),

    entry('(stale)', 'textSettings.resourceOnly', 'Text Settings (resource-only)', '(stale)', 'Resource bundle strings without active panel/controller', 'resource-only-stale'),
  ];
}

export function getFeatureParityNoteById(id: string): FeatureParityNote | undefined {
  return FEATURE_PARITY_NOTES.find((f) => f.id === id);
}

export function buildRealtimeEngineOptions(
  data: BlueData,
  projectDirectory: string | null,
  settings: ProgramSettingsSnapshot,
): string[] {
  const options: string[] = [];
  const props = data.getProjectProperties();
  const rt = settings.realtimeRender;

  void projectDirectory;

  if (!settings.general.messageColorsEnabled) {
    options.push('-+msg_color=false');
  }

  if (rt.displaysDisabled) {
    options.push('-d');
  }

  if (props.completeOverride) {
    options.push(...props.getRealtimeCsoundOptions());
    return options;
  }

  if (rt.audioDriverEnabled && rt.audioDriver) {
    options.push(`-+rtaudio=${rt.audioDriver}`);
  }

  if (props.useAudioOut && rt.audioOutText) {
    options.push(`-o${rt.audioOutText}`);
  }

  if (props.useAudioIn && rt.audioInText) {
    options.push(`-i${rt.audioInText}`);
  }

  if ((props.useMidiIn || props.useMidiOut) && rt.midiDriverEnabled && rt.midiDriver) {
    options.push(`-+rtmidi=${rt.midiDriver}`);
  }

  if (props.useMidiIn && rt.midiInText) {
    options.push(`-M${rt.midiInText}`);
  }

  if (props.useMidiOut && rt.midiOutText) {
    options.push(`-Q${rt.midiOutText}`);
  }

  if (rt.softwareBufferEnabled) {
    options.push(`-b${rt.softwareBufferSize}`);
  }

  if (rt.hardwareBufferEnabled) {
    options.push(`-B${rt.hardwareBufferSize}`);
  }

  options.push(
    ...props.getRealtimeCsoundOptions().filter(
      (option) => option !== '-odac' && option !== '-iadc',
    ),
  );

  return options;
}
