import { describe, expect, it } from 'vitest';
import { BlueData } from '@blue/data';
import {
  buildUsageMatrix,
  buildRealtimeEngineOptions,
  FEATURE_PARITY_NOTES,
} from './program-settings-usage';
import { createDefaultProgramSettings, type ProgramSettingsSnapshot } from '../shared/program-settings';

describe('program-settings-usage matrix', () => {
  it('has entries for every panel', () => {
    const matrix = buildUsageMatrix();
    const panels = new Set(matrix.map((e) => e.panel));
    expect(panels.has('general')).toBe(true);
    expect(panels.has('projectDefaults')).toBe(true);
    expect(panels.has('playback')).toBe(true);
    expect(panels.has('utility')).toBe(true);
    expect(panels.has('realtimeRender')).toBe(true);
    expect(panels.has('diskRender')).toBe(true);
  });

  it('includes stale Text Settings entry', () => {
    const matrix = buildUsageMatrix();
    const textEntry = matrix.find((e) => e.settingKey === 'textSettings.resourceOnly');
    expect(textEntry).toBeDefined();
    expect(textEntry!.currentStatus).toBe('resource-only-stale');
  });

  it('records freezeMaxJobs as a used blue-electron extension with no Java counterpart (SPEC 085)', () => {
    const matrix = buildUsageMatrix();
    const entry = matrix.find((e) => e.settingKey === 'utility.freezeMaxJobs');
    expect(entry).toBeDefined();
    expect(entry!.panel).toBe('utility');
    expect(entry!.currentStatus).toBe('used-by-workflow');
    expect(entry!.javaDefault).toContain('blue-electron extension');
    expect(entry!.javaUsage).toContain('No Java counterpart');
    expect(entry!.consumerPath).toContain('freeze-score-objects.ts');
  });

  it('covers all FR-004 through FR-015 settings', () => {
    const matrix = buildUsageMatrix();
    const keys = new Set(matrix.map((e) => e.settingKey));
    expect(keys.has('general.workDirectory')).toBe(true);
    expect(keys.has('general.newUserDefaultsEnabled')).toBe(true);
    expect(keys.has('general.messageColorsEnabled')).toBe(true);
    expect(keys.has('general.csoundErrorWarningEnabled')).toBe(true);
    expect(keys.has('general.directoryTempFileLimit')).toBe(true);
    expect(keys.has('projectDefaults.defaultAuthor')).toBe(true);
    expect(keys.has('projectDefaults.defaultLayerGroupType')).toBe(true);
    expect(keys.has('playback.playbackFps')).toBe(true);
    expect(keys.has('utility.csoundExecutable')).toBe(true);
    expect(keys.has('realtimeRender.csoundExecutable')).toBe(true);
    expect(keys.has('diskRender.csoundExecutable')).toBe(true);
    expect(keys.has('diskRender.externalPlayCommand')).toBe(true);
    expect(keys.has('diskRender.externalOpenCommand')).toBe(true);
  });

  it('has feature parity notes', () => {
    expect(FEATURE_PARITY_NOTES.length).toBeGreaterThan(0);
    const ids = FEATURE_PARITY_NOTES.map((f) => f.id);
    expect(ids).toContain('disk-render-execution');
    expect(ids).toContain('utility-freeze-unfreeze');
    expect(ids).toContain('soundfont-utility');
    expect(ids).toContain('csound-error-warning');
    expect(ids).not.toContain('alpha-marquee-csound-error-warning');
    expect(ids).not.toContain('udo-effect-creation-runtime');

    const soundfont = FEATURE_PARITY_NOTES.find((feature) => feature.id === 'soundfont-utility');
    expect(soundfont?.currentAppStatus).toContain('Implemented');
  });

  it('marks defaultUdoStyle as used by active creation workflows', () => {
    const matrix = buildUsageMatrix();
    const entry = matrix.find((item) => item.settingKey === 'projectDefaults.defaultUdoStyle');

    expect(entry).toBeDefined();
    expect(entry!.currentStatus).toBe('used-by-workflow');
    expect(entry!.consumerPath).toContain('UdoWorkspacePanel');
  });

  it('marks new-user defaults as consumed by the Code Repository workflow', () => {
    const matrix = buildUsageMatrix();
    const entry = matrix.find((item) => item.settingKey === 'general.newUserDefaultsEnabled');

    expect(entry).toMatchObject({
      currentStatus: 'used-by-workflow',
      consumerPath: expect.stringContaining('CodeRepositoryEditorModal'),
    });
  });

  it('marks work directory as consumed by file chooser workflows', () => {
    const entry = buildUsageMatrix().find((item) => item.settingKey === 'general.workDirectory');

    expect(entry).toMatchObject({
      currentStatus: 'used-by-workflow',
      consumerPath: expect.stringContaining('file chooser'),
    });
  });

  it('marks Csound error warnings as consumed by terminal playback errors', () => {
    const entry = buildUsageMatrix().find((item) => item.settingKey === 'general.csoundErrorWarningEnabled');

    expect(entry).toMatchObject({
      currentStatus: 'used-by-workflow',
      consumerPath: expect.stringContaining('EngineBridge'),
    });
  });

  it('keeps used realtime driver settings out of the device discovery dependency', () => {
    const feature = FEATURE_PARITY_NOTES.find(
      (entry) => entry.id === 'device-discovery-render-method',
    );

    expect(feature).toBeDefined();
    expect(feature!.affectedSettings).toEqual(['realtimeRender.renderMethod']);
  });

  it('every entry has a valid status', () => {
    const validStatuses = [
      'used-by-workflow',
      'used-as-new-project-default',
      'app-specific-retained',
      'resource-only-stale',
      'blocked-by-missing-feature',
    ];
    const matrix = buildUsageMatrix();
    for (const entry of matrix) {
      expect(validStatuses).toContain(entry.currentStatus);
    }
  });

  it('blocked entries reference valid feature parity notes', () => {
    const featureIds = new Set(FEATURE_PARITY_NOTES.map((f) => f.id));
    const matrix = buildUsageMatrix();
    const blocked = matrix.filter((e) => e.currentStatus === 'blocked-by-missing-feature');
    for (const entry of blocked) {
      expect(entry.missingFeature).toBeDefined();
      expect(featureIds.has(entry.missingFeature!)).toBe(true);
    }
  });
});

describe('buildRealtimeEngineOptions', () => {
  it('includes -+msg_color=false when message colors disabled', () => {
    const data = new BlueData();
    const settings = createDefaultProgramSettings('darwin');
    settings.general.messageColorsEnabled = false;
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).toContain('-+msg_color=false');
  });

  it('omits -+msg_color=false when message colors enabled', () => {
    const data = new BlueData();
    const settings = createDefaultProgramSettings('darwin');
    settings.general.messageColorsEnabled = true;
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).not.toContain('-+msg_color=false');
  });

  it('includes -d when displays disabled', () => {
    const data = new BlueData();
    const settings = createDefaultProgramSettings('darwin');
    settings.realtimeRender.displaysDisabled = true;
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).toContain('-d');
  });

  it('includes audio driver when enabled', () => {
    const data = new BlueData();
    const settings = createDefaultProgramSettings('darwin');
    settings.realtimeRender.audioDriverEnabled = true;
    settings.realtimeRender.audioDriver = 'pa_bl';
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).toContain('-+rtaudio=pa_bl');
  });

  it('includes audio out when project useAudioOut is true', () => {
    const data = new BlueData();
    data.getProjectProperties().useAudioOut = true;
    const settings = createDefaultProgramSettings('darwin');
    settings.realtimeRender.audioOutText = 'dac';
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).toContain('-odac');
  });

  it('omits audio out when project useAudioOut is false', () => {
    const data = new BlueData();
    data.getProjectProperties().useAudioOut = false;
    const settings = createDefaultProgramSettings('darwin');
    settings.realtimeRender.audioOutText = 'dac';
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options.some((o) => o.startsWith('-o'))).toBe(false);
  });

  it('includes MIDI driver only when project uses MIDI', () => {
    const data = new BlueData();
    data.getProjectProperties().useMidiIn = true;
    const settings = createDefaultProgramSettings('darwin');
    settings.realtimeRender.midiDriverEnabled = true;
    settings.realtimeRender.midiDriver = 'PortMidi';
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).toContain('-+rtmidi=PortMidi');
  });

  it('omits MIDI driver when project does not use MIDI', () => {
    const data = new BlueData();
    data.getProjectProperties().useMidiIn = false;
    data.getProjectProperties().useMidiOut = false;
    const settings = createDefaultProgramSettings('darwin');
    settings.realtimeRender.midiDriverEnabled = true;
    settings.realtimeRender.midiDriver = 'PortMidi';
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).not.toContain('-+rtmidi=PortMidi');
  });

  it('includes buffer sizes when enabled', () => {
    const data = new BlueData();
    const settings = createDefaultProgramSettings('darwin');
    settings.realtimeRender.softwareBufferEnabled = true;
    settings.realtimeRender.softwareBufferSize = 1024;
    settings.realtimeRender.hardwareBufferEnabled = true;
    settings.realtimeRender.hardwareBufferSize = 4096;
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).toContain('-b1024');
    expect(options).toContain('-B4096');
  });

  it('includes advanced settings as separate tokens from project properties', () => {
    const data = new BlueData();
    data.getProjectProperties().advancedSettings = '--env:FOO=bar -v';
    const settings = createDefaultProgramSettings('darwin');
    const options = buildRealtimeEngineOptions(data, null, settings);
    expect(options).toContain('--env:FOO=bar');
    expect(options).toContain('-v');
  });

  it('preserves completeOverride parsing semantics from project properties', () => {
    const data = new BlueData();
    data.getProjectProperties().completeOverride = true;
    data.getProjectProperties().advancedSettings = 'csound -odac -b512 "-+rtaudio=pa_bl"';
    const settings = createDefaultProgramSettings('darwin');
    const options = buildRealtimeEngineOptions(data, null, settings);

    expect(options).toContain('-odac');
    expect(options).toContain('-b512');
    expect(options).toContain('-+rtaudio=pa_bl');
  });
});
