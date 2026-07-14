import {
  createDefaultWindowLayoutSettings,
  mergeWindowLayoutSettings,
  type WindowLayoutSettingsSnapshot,
} from './window-layout-settings';
import {
  compareMidiInputDevicePreference,
  createDefaultMidiInputPreferences,
  normalizeMidiInputPreferences,
  type MidiInputPreferences,
} from './midi-input';
import {
  createDefaultOscServerPreferences,
  isValidOscPort,
  normalizeOscServerPreferences,
  type OscServerPreferences,
} from './osc-control';

export type ProgramSettingsPanelId =
  | 'general'
  | 'projectDefaults'
  | 'playback'
  | 'utility'
  | 'realtimeRender'
  | 'diskRender'
  | 'midi'
  | 'osc';

export interface GeneralSettingsSnapshot {
  workDirectory: string;
  newUserDefaultsEnabled: boolean;
  drawAlphaBackgroundOnMarquee: boolean;
  messageColorsEnabled: boolean;
  csoundErrorWarningEnabled: boolean;
  directoryTempFileLimit: number;
}

export interface ProjectDefaultsSettingsSnapshot {
  defaultAuthor: string;
  mixerEnabled: boolean;
  layerHeightDefault: number;
  defaultUdoStyle: 'CLASSIC' | 'MODERN';
  defaultPrimaryTimeBase: string;
  defaultSecondaryRulerEnabled: boolean;
  defaultSecondaryTimeBase: string;
  defaultSnapEnabled: boolean;
  defaultSnapValue: string;
  defaultSmpteFrameRate: number;
}

export interface PlaybackSettingsSnapshot {
  playbackFps: number;
  playbackLatencyCorrection: number;
  followPlayback: boolean;
  followPlaybackOnStart: boolean;
}

export interface UtilitySettingsSnapshot {
  csoundExecutable: string;
  freezeFlags: string;
}

export interface RealtimeRenderSettingsSnapshot {
  csoundExecutable: string;
  defaultSr: string;
  defaultKsmps: string;
  defaultNchnls: string;
  useZeroDbfs: boolean;
  zeroDbfs: string;
  audioDriverEnabled: boolean;
  audioDriver: string;
  audioOutEnabled: boolean;
  audioOutText: string;
  audioInEnabled: boolean;
  audioInText: string;
  midiDriverEnabled: boolean;
  midiDriver: string;
  midiOutEnabled: boolean;
  midiOutText: string;
  midiInEnabled: boolean;
  midiInText: string;
  softwareBufferEnabled: boolean;
  softwareBufferSize: number;
  hardwareBufferEnabled: boolean;
  hardwareBufferSize: number;
  noteAmpsEnabled: boolean;
  outOfRangeEnabled: boolean;
  warningsEnabled: boolean;
  benchmarkEnabled: boolean;
  displaysDisabled: boolean;
  advancedSettings: string;
  renderMethod: string;
}

export interface DiskRenderSettingsSnapshot {
  csoundExecutable: string;
  defaultSr: string;
  defaultKsmps: string;
  defaultNchnls: string;
  useZeroDbfs: boolean;
  zeroDbfs: string;
  fileFormatEnabled: boolean;
  fileFormat: string;
  sampleFormatEnabled: boolean;
  sampleFormat: string;
  savePeakInformation: boolean;
  ditherOutput: boolean;
  rewriteHeader: boolean;
  noteAmpsEnabled: boolean;
  outOfRangeEnabled: boolean;
  warningsEnabled: boolean;
  benchmarkEnabled: boolean;
  displaysDisabled: boolean;
  advancedSettings: string;
  renderMethod: string;
  externalPlayCommandEnabled: boolean;
  externalPlayCommand: string;
  externalOpenCommand: string;
}

export interface CurrentAppSettingsSnapshot {
  enginePath: string;
  recentFiles: string[];
  windowBounds: { x: number; y: number; width: number; height: number } | null;
  midiInputDevice: string;
  midiOutputDevice: string;
  oscInputPort: number;
  oscOutputHost: string;
  oscOutputPort: number;
  windowLayout: WindowLayoutSettingsSnapshot;
}

export interface ProgramSettingsSnapshot {
  version: number;
  general: GeneralSettingsSnapshot;
  projectDefaults: ProjectDefaultsSettingsSnapshot;
  playback: PlaybackSettingsSnapshot;
  utility: UtilitySettingsSnapshot;
  realtimeRender: RealtimeRenderSettingsSnapshot;
  diskRender: DiskRenderSettingsSnapshot;
  appSpecific: CurrentAppSettingsSnapshot;
  /**
   * App-wide MIDI input device preferences (SPEC 058). Distinct from the
   * legacy `appSpecific.midiInputDevice` placeholder (preserved for downgrade
   * safety), realtime-render MIDI driver options, and project-owned MIDI
   * processing.
   */
  midiInput: MidiInputPreferences;
  /**
   * App-wide inbound OSC server preference. This replaces the historical
   * appSpecific.oscInputPort placeholder while retaining that value for
   * downgrade safety.
   */
  osc: OscServerPreferences;
  lastSavedAt?: string;
}

export interface SettingsValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ProgramSettingsSaveResult {
  ok: boolean;
  snapshot?: ProgramSettingsSnapshot;
  validationIssues?: SettingsValidationIssue[];
}

export type UsageStatus =
  | 'used-by-workflow'
  | 'used-as-new-project-default'
  | 'app-specific-retained'
  | 'resource-only-stale'
  | 'blocked-by-missing-feature';

export interface UsageParityMatrixEntry {
  panel: string;
  settingKey: string;
  displayName: string;
  javaDefault: string;
  javaUsage: string;
  currentStatus: UsageStatus;
  consumerPath?: string;
  missingFeature?: string;
}

export const PROGRAM_SETTINGS_VERSION = 2;

export const TIME_BASE_CHOICES: readonly string[] = [
  'BEATS', 'BBT', 'BBST', 'BBF', 'TIME', 'SECONDS', 'SMPTE', 'FRAME',
];

export const SNAP_VALUE_CHOICES: readonly string[] = [
  'BAR', 'HALF', 'BEAT', 'EIGHTH', 'SIXTEENTH', 'THIRTY_SECOND', 'SIXTY_FOURTH',
  'QUARTER_TRIPLET', 'EIGHTH_TRIPLET', 'SIXTEENTH_TRIPLET',
  'ONE_SECOND', 'HUNDRED_MS', 'TEN_MS', 'ONE_MS',
  'FRAME', 'SAMPLE', 'AUTO',
];

export const SMPTE_FRAME_RATES: readonly number[] = [
  23.976, 24, 25, 29.97, 30, 50, 59.94, 60,
];

export const LAYER_HEIGHT_CHOICES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const UDO_STYLE_CHOICES: readonly ('CLASSIC' | 'MODERN')[] = ['CLASSIC', 'MODERN'];

export const FILE_FORMAT_CHOICES: readonly string[] = [
  'WAV', 'AIFF', 'AU', 'RAW', 'IRCAM', 'W64', 'WAVEX', 'SD2', 'FLAC',
];

export const SAMPLE_FORMAT_CHOICES: readonly string[] = [
  'ALAW', 'ULAW', 'SCHAR', 'UCHAR', 'FLOAT', 'SHORT', 'LONG', '24BIT',
];

export function getAudioDrivers(platform: string): string[] {
  switch (platform) {
    case 'darwin':
      return ['PortAudio', 'pa_cb', 'pa_bl', 'CoreAudio', 'JACK'];
    case 'win32':
      return ['PortAudio', 'pa_cb', 'pa_bl', 'MME'];
    default:
      return ['PortAudio', 'pa_cb', 'pa_bl', 'ALSA', 'JACK', 'pulse'];
  }
}

export function getMidiDrivers(platform: string): string[] {
  switch (platform) {
    case 'darwin':
      return ['PortMidi'];
    case 'win32':
      return ['PortMidi', 'MME'];
    default:
      return ['PortMidi', 'alsaseq', 'ALSA'];
  }
}

export function getDefaultCsoundExecutable(platform: string): string {
  return platform === 'darwin' ? '/usr/local/bin/csound' : 'csound';
}

export function getDefaultFreezeFlags(platform: string): string {
  return platform === 'darwin' ? '-Ado' : '-Wdo';
}

export function getDefaultAudioDriver(platform: string): string {
  return platform === 'darwin' ? 'pa_bl' : 'PortAudio';
}

export function getDefaultSoftwareBufferSize(platform: string): number {
  switch (platform) {
    case 'darwin': return 1024;
    case 'win32': return 4096;
    default: return 256;
  }
}

export function getDefaultHardwareBufferSize(platform: string): number {
  switch (platform) {
    case 'darwin': return 4096;
    case 'win32': return 16384;
    default: return 1024;
  }
}

export function createDefaultGeneralSettings(): GeneralSettingsSnapshot {
  return {
    workDirectory: '',
    newUserDefaultsEnabled: true,
    drawAlphaBackgroundOnMarquee: false,
    messageColorsEnabled: false,
    csoundErrorWarningEnabled: true,
    directoryTempFileLimit: 3,
  };
}

export function createDefaultProjectDefaultsSettings(): ProjectDefaultsSettingsSnapshot {
  return {
    defaultAuthor: '',
    mixerEnabled: true,
    layerHeightDefault: 0,
    defaultUdoStyle: 'MODERN',
    defaultPrimaryTimeBase: 'BEATS',
    defaultSecondaryRulerEnabled: false,
    defaultSecondaryTimeBase: 'TIME',
    defaultSnapEnabled: false,
    defaultSnapValue: 'BEAT',
    defaultSmpteFrameRate: 24,
  };
}

export function createDefaultPlaybackSettings(): PlaybackSettingsSnapshot {
  return {
    playbackFps: 24,
    playbackLatencyCorrection: 0,
    followPlayback: true,
    followPlaybackOnStart: true,
  };
}

export function createDefaultUtilitySettings(platform: string): UtilitySettingsSnapshot {
  return {
    csoundExecutable: getDefaultCsoundExecutable(platform),
    freezeFlags: getDefaultFreezeFlags(platform),
  };
}

export function createDefaultRealtimeRenderSettings(platform: string): RealtimeRenderSettingsSnapshot {
  return {
    csoundExecutable: getDefaultCsoundExecutable(platform),
    defaultSr: '44100',
    defaultKsmps: '1',
    defaultNchnls: '2',
    useZeroDbfs: true,
    zeroDbfs: '1',
    audioDriverEnabled: true,
    audioDriver: getDefaultAudioDriver(platform),
    audioOutEnabled: true,
    audioOutText: 'dac',
    audioInEnabled: false,
    audioInText: 'adc',
    midiDriverEnabled: true,
    midiDriver: 'PortMidi',
    midiOutEnabled: false,
    midiOutText: '',
    midiInEnabled: false,
    midiInText: '',
    softwareBufferEnabled: false,
    softwareBufferSize: getDefaultSoftwareBufferSize(platform),
    hardwareBufferEnabled: false,
    hardwareBufferSize: getDefaultHardwareBufferSize(platform),
    noteAmpsEnabled: true,
    outOfRangeEnabled: true,
    warningsEnabled: true,
    benchmarkEnabled: true,
    displaysDisabled: true,
    advancedSettings: '',
    renderMethod: '',
  };
}

export function createDefaultDiskRenderSettings(platform: string): DiskRenderSettingsSnapshot {
  return {
    csoundExecutable: getDefaultCsoundExecutable(platform),
    defaultSr: '44100',
    defaultKsmps: '1',
    defaultNchnls: '2',
    useZeroDbfs: true,
    zeroDbfs: '1',
    fileFormatEnabled: true,
    fileFormat: 'WAV',
    sampleFormatEnabled: true,
    sampleFormat: 'SHORT',
    savePeakInformation: true,
    ditherOutput: false,
    rewriteHeader: true,
    noteAmpsEnabled: true,
    outOfRangeEnabled: true,
    warningsEnabled: true,
    benchmarkEnabled: true,
    displaysDisabled: true,
    advancedSettings: '',
    renderMethod: '',
    externalPlayCommandEnabled: false,
    externalPlayCommand: 'command $outfile',
    externalOpenCommand: 'command $outfile',
  };
}

export function createDefaultCurrentAppSettings(): CurrentAppSettingsSnapshot {
  return {
    enginePath: 'blue-engine',
    recentFiles: [],
    windowBounds: null,
    midiInputDevice: '',
    midiOutputDevice: '',
    oscInputPort: 0,
    oscOutputHost: 'localhost',
    oscOutputPort: 0,
    windowLayout: createDefaultWindowLayoutSettings(),
  };
}

export function createDefaultProgramSettings(platform: string): ProgramSettingsSnapshot {
  return {
    version: PROGRAM_SETTINGS_VERSION,
    general: createDefaultGeneralSettings(),
    projectDefaults: createDefaultProjectDefaultsSettings(),
    playback: createDefaultPlaybackSettings(),
    utility: createDefaultUtilitySettings(platform),
    realtimeRender: createDefaultRealtimeRenderSettings(platform),
    diskRender: createDefaultDiskRenderSettings(platform),
    appSpecific: createDefaultCurrentAppSettings(),
    midiInput: createDefaultMidiInputPreferences(),
    osc: createDefaultOscServerPreferences(),
  };
}

export function validateProgramSettings(
  snapshot: ProgramSettingsSnapshot,
): SettingsValidationIssue[] {
  const issues: SettingsValidationIssue[] = [];

  if (snapshot.general.directoryTempFileLimit < 1) {
    issues.push({
      path: 'general.directoryTempFileLimit',
      message: 'Must be at least 1',
      severity: 'error',
    });
  }

  if (snapshot.projectDefaults.layerHeightDefault < 0 || snapshot.projectDefaults.layerHeightDefault > 8) {
    issues.push({
      path: 'projectDefaults.layerHeightDefault',
      message: 'Must be between 0 and 8',
      severity: 'error',
    });
  }

  if (!TIME_BASE_CHOICES.includes(snapshot.projectDefaults.defaultPrimaryTimeBase)) {
    issues.push({
      path: 'projectDefaults.defaultPrimaryTimeBase',
      message: `Must be one of: ${TIME_BASE_CHOICES.join(', ')}`,
      severity: 'error',
    });
  }

  if (!TIME_BASE_CHOICES.includes(snapshot.projectDefaults.defaultSecondaryTimeBase)) {
    issues.push({
      path: 'projectDefaults.defaultSecondaryTimeBase',
      message: `Must be one of: ${TIME_BASE_CHOICES.join(', ')}`,
      severity: 'error',
    });
  }

  if (!SNAP_VALUE_CHOICES.includes(snapshot.projectDefaults.defaultSnapValue)) {
    issues.push({
      path: 'projectDefaults.defaultSnapValue',
      message: `Must be a valid snap value`,
      severity: 'error',
    });
  }

  if (!SMPTE_FRAME_RATES.includes(snapshot.projectDefaults.defaultSmpteFrameRate)) {
    issues.push({
      path: 'projectDefaults.defaultSmpteFrameRate',
      message: `Must be a valid SMPTE frame rate`,
      severity: 'warning',
    });
  }

  if (snapshot.playback.playbackFps < 1 || snapshot.playback.playbackFps > 120) {
    issues.push({
      path: 'playback.playbackFps',
      message: 'Must be between 1 and 120',
      severity: 'error',
    });
  }

  if (!isValidOscPort(snapshot.osc?.preferredPort)) {
    issues.push({
      path: 'osc.preferredPort',
      message: 'Must be an integer between 1 and 65535',
      severity: 'error',
    });
  }

  const sr = parseInt(snapshot.realtimeRender.defaultSr, 10);
  if (isNaN(sr) || sr < 1) {
    issues.push({
      path: 'realtimeRender.defaultSr',
      message: 'Must be a positive number',
      severity: 'error',
    });
  }

  const ksmps = parseInt(snapshot.realtimeRender.defaultKsmps, 10);
  if (isNaN(ksmps) || ksmps < 1) {
    issues.push({
      path: 'realtimeRender.defaultKsmps',
      message: 'Must be a positive number',
      severity: 'error',
    });
  }

  const nchnls = parseInt(snapshot.realtimeRender.defaultNchnls, 10);
  if (isNaN(nchnls) || nchnls < 1) {
    issues.push({
      path: 'realtimeRender.defaultNchnls',
      message: 'Must be a positive number',
      severity: 'error',
    });
  }

  const diskSr = parseInt(snapshot.diskRender.defaultSr, 10);
  if (isNaN(diskSr) || diskSr < 1) {
    issues.push({
      path: 'diskRender.defaultSr',
      message: 'Must be a positive number',
      severity: 'error',
    });
  }

  const diskKsmps = parseInt(snapshot.diskRender.defaultKsmps, 10);
  if (isNaN(diskKsmps) || diskKsmps < 1) {
    issues.push({
      path: 'diskRender.defaultKsmps',
      message: 'Must be a positive number',
      severity: 'error',
    });
  }

  const diskNchnls = parseInt(snapshot.diskRender.defaultNchnls, 10);
  if (isNaN(diskNchnls) || diskNchnls < 1) {
    issues.push({
      path: 'diskRender.defaultNchnls',
      message: 'Must be a positive number',
      severity: 'error',
    });
  }

  if (!FILE_FORMAT_CHOICES.includes(snapshot.diskRender.fileFormat)) {
    issues.push({
      path: 'diskRender.fileFormat',
      message: `Must be one of: ${FILE_FORMAT_CHOICES.join(', ')}`,
      severity: 'error',
    });
  }

  if (!SAMPLE_FORMAT_CHOICES.includes(snapshot.diskRender.sampleFormat)) {
    issues.push({
      path: 'diskRender.sampleFormat',
      message: `Must be one of: ${SAMPLE_FORMAT_CHOICES.join(', ')}`,
      severity: 'error',
    });
  }

  return issues;
}

export function resetProgramSettingsPanel(
  snapshot: ProgramSettingsSnapshot,
  panel: ProgramSettingsPanelId,
  platform: string,
): ProgramSettingsSnapshot {
  const result = { ...snapshot };

  switch (panel) {
    case 'general':
      result.general = createDefaultGeneralSettings();
      break;
    case 'projectDefaults':
      result.projectDefaults = createDefaultProjectDefaultsSettings();
      break;
    case 'playback':
      result.playback = createDefaultPlaybackSettings();
      break;
    case 'utility':
      result.utility = createDefaultUtilitySettings(platform);
      break;
    case 'realtimeRender':
      result.realtimeRender = createDefaultRealtimeRenderSettings(platform);
      break;
    case 'diskRender':
      result.diskRender = createDefaultDiskRenderSettings(platform);
      break;
    case 'midi':
      result.midiInput = createDefaultMidiInputPreferences();
      break;
    case 'osc':
      result.osc = createDefaultOscServerPreferences();
      break;
  }

  return result;
}

export function mergeWithDefaults(
  saved: Partial<ProgramSettingsSnapshot>,
  platform: string,
): ProgramSettingsSnapshot {
  const defaults = createDefaultProgramSettings(platform);

  const savedAppSpecific = (saved.appSpecific ?? {}) as Partial<CurrentAppSettingsSnapshot>;
  const mergedAppSpecific: CurrentAppSettingsSnapshot = {
    ...defaults.appSpecific,
    ...savedAppSpecific,
    // Deep-merge the layout envelope so partial/stale layout state still
    // gets default-filled, and unrelated app-specific values are preserved.
    windowLayout: mergeWindowLayoutSettings(savedAppSpecific.windowLayout),
  };

  // Preserve legacy appSpecific.midiInputDevice / midiOutputDevice placeholder
  // strings exactly as saved. They are NOT used to seed structured midiInput
  // preferences in this feature.

  // Normalize and dedupe structured midiInput preferences.
  const mergedMidiInput = saved.midiInput
    ? normalizeMidiInputPreferences(saved.midiInput)
    : createDefaultMidiInputPreferences();

  const mergedOsc = normalizeOscServerPreferences(
    saved.osc,
    savedAppSpecific.oscInputPort,
  );

  return {
    version: saved.version ?? PROGRAM_SETTINGS_VERSION,
    general: { ...defaults.general, ...saved.general },
    projectDefaults: { ...defaults.projectDefaults, ...saved.projectDefaults },
    playback: { ...defaults.playback, ...saved.playback },
    utility: { ...defaults.utility, ...saved.utility },
    realtimeRender: { ...defaults.realtimeRender, ...saved.realtimeRender },
    diskRender: { ...defaults.diskRender, ...saved.diskRender },
    appSpecific: mergedAppSpecific,
    midiInput: mergedMidiInput,
    osc: mergedOsc,
    lastSavedAt: saved.lastSavedAt,
  };
}

export const PROGRAM_SETTINGS_PANEL_ORDER: readonly { id: ProgramSettingsPanelId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'projectDefaults', label: 'Project Defaults' },
  { id: 'playback', label: 'Playback' },
  { id: 'utility', label: 'Utility' },
  { id: 'realtimeRender', label: 'Realtime Render' },
  { id: 'diskRender', label: 'Disk Render' },
  { id: 'midi', label: 'MIDI' },
  { id: 'osc', label: 'OSC' },
];

/**
 * Re-export structured MIDI preference helpers so consumers can import a
 * consistent surface from the program-settings module.
 */
export {
  compareMidiInputDevicePreference,
  createDefaultMidiInputPreferences,
  normalizeMidiInputPreferences,
} from './midi-input';
export type { MidiInputPreferences, MidiInputDevicePreference } from './midi-input';
