import { describe, expect, it } from 'vitest';
import {
  createDefaultProgramSettings,
  createDefaultGeneralSettings,
  createDefaultProjectDefaultsSettings,
  createDefaultPlaybackSettings,
  createDefaultUtilitySettings,
  createDefaultRealtimeRenderSettings,
  createDefaultDiskRenderSettings,
  createDefaultCurrentAppSettings,
  validateProgramSettings,
  resetProgramSettingsPanel,
  mergeWithDefaults,
  getAudioDrivers,
  getMidiDrivers,
  getDefaultCsoundExecutable,
  getDefaultFreezeFlags,
  PROGRAM_SETTINGS_PANEL_ORDER,
  TIME_BASE_CHOICES,
  SNAP_VALUE_CHOICES,
  SMPTE_FRAME_RATES,
  FILE_FORMAT_CHOICES,
  SAMPLE_FORMAT_CHOICES,
  type ProgramSettingsSnapshot,
} from './program-settings';
import {
  createDefaultWindowLayoutSettings,
  WINDOW_LAYOUT_SETTINGS_VERSION,
} from './window-layout-settings';

describe('program-settings defaults', () => {
  it('creates macOS defaults', () => {
    const s = createDefaultProgramSettings('darwin');
    expect(s.version).toBe(1);
    expect(s.general.messageColorsEnabled).toBe(false);
    expect(s.general.csoundErrorWarningEnabled).toBe(true);
    expect(s.general.directoryTempFileLimit).toBe(3);
    expect(s.projectDefaults.defaultPrimaryTimeBase).toBe('BEATS');
    expect(s.projectDefaults.defaultUdoStyle).toBe('MODERN');
    expect(s.projectDefaults.defaultSmpteFrameRate).toBe(24);
    expect(s.playback.playbackFps).toBe(24);
    expect(s.playback.followPlayback).toBe(true);
    expect(s.utility.csoundExecutable).toBe('/usr/local/bin/csound');
    expect(s.utility.freezeFlags).toBe('-Ado');
    expect(s.realtimeRender.audioDriver).toBe('pa_bl');
    expect(s.realtimeRender.softwareBufferSize).toBe(1024);
    expect(s.realtimeRender.hardwareBufferSize).toBe(4096);
    expect(s.diskRender.fileFormat).toBe('WAV');
    expect(s.diskRender.sampleFormat).toBe('SHORT');
    expect(s.appSpecific.enginePath).toBe('blue-engine');
  });

  it('creates Linux defaults', () => {
    const s = createDefaultProgramSettings('linux');
    expect(s.utility.csoundExecutable).toBe('csound');
    expect(s.utility.freezeFlags).toBe('-Wdo');
    expect(s.realtimeRender.audioDriver).toBe('PortAudio');
    expect(s.realtimeRender.softwareBufferSize).toBe(256);
    expect(s.realtimeRender.hardwareBufferSize).toBe(1024);
  });

  it('creates Windows defaults', () => {
    const s = createDefaultProgramSettings('win32');
    expect(s.realtimeRender.softwareBufferSize).toBe(4096);
    expect(s.realtimeRender.hardwareBufferSize).toBe(16384);
  });
});

describe('program-settings choices', () => {
  it('has correct panel order', () => {
    expect(PROGRAM_SETTINGS_PANEL_ORDER.map((p) => p.id)).toEqual([
      'general', 'projectDefaults', 'playback', 'utility', 'realtimeRender', 'diskRender',
    ]);
  });

  it('has correct time base choices', () => {
    expect(TIME_BASE_CHOICES).toContain('BEATS');
    expect(TIME_BASE_CHOICES).toContain('TIME');
    expect(TIME_BASE_CHOICES).toContain('SMPTE');
    expect(TIME_BASE_CHOICES.length).toBe(8);
  });

  it('has correct file format choices', () => {
    expect(FILE_FORMAT_CHOICES).toContain('WAV');
    expect(FILE_FORMAT_CHOICES).toContain('FLAC');
  });

  it('has correct sample format choices', () => {
    expect(SAMPLE_FORMAT_CHOICES).toContain('SHORT');
    expect(SAMPLE_FORMAT_CHOICES).toContain('FLOAT');
  });

  it('has correct SMPTE frame rates', () => {
    expect(SMPTE_FRAME_RATES).toContain(24);
    expect(SMPTE_FRAME_RATES).toContain(29.97);
  });
});

describe('program-settings platform helpers', () => {
  it('returns correct audio drivers per platform', () => {
    expect(getAudioDrivers('darwin')).toContain('pa_bl');
    expect(getAudioDrivers('linux')).toContain('ALSA');
    expect(getAudioDrivers('win32')).toContain('MME');
  });

  it('returns correct MIDI drivers per platform', () => {
    expect(getMidiDrivers('darwin')).toEqual(['PortMidi']);
    expect(getMidiDrivers('linux')).toContain('alsaseq');
    expect(getMidiDrivers('win32')).toContain('MME');
  });

  it('returns correct default csound executable', () => {
    expect(getDefaultCsoundExecutable('darwin')).toBe('/usr/local/bin/csound');
    expect(getDefaultCsoundExecutable('linux')).toBe('csound');
  });

  it('returns correct default freeze flags', () => {
    expect(getDefaultFreezeFlags('darwin')).toBe('-Ado');
    expect(getDefaultFreezeFlags('linux')).toBe('-Wdo');
  });
});

describe('program-settings validation', () => {
  it('passes valid defaults', () => {
    const s = createDefaultProgramSettings('darwin');
    const issues = validateProgramSettings(s);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('rejects invalid directoryTempFileLimit', () => {
    const s = createDefaultProgramSettings('darwin');
    s.general.directoryTempFileLimit = 0;
    const issues = validateProgramSettings(s);
    expect(issues.some((i) => i.path === 'general.directoryTempFileLimit' && i.severity === 'error')).toBe(true);
  });

  it('rejects invalid playbackFps', () => {
    const s = createDefaultProgramSettings('darwin');
    s.playback.playbackFps = 0;
    const issues = validateProgramSettings(s);
    expect(issues.some((i) => i.path === 'playback.playbackFps')).toBe(true);
  });

  it('rejects invalid realtime sr', () => {
    const s = createDefaultProgramSettings('darwin');
    s.realtimeRender.defaultSr = 'abc';
    const issues = validateProgramSettings(s);
    expect(issues.some((i) => i.path === 'realtimeRender.defaultSr')).toBe(true);
  });

  it('rejects invalid disk file format', () => {
    const s = createDefaultProgramSettings('darwin');
    s.diskRender.fileFormat = 'INVALID';
    const issues = validateProgramSettings(s);
    expect(issues.some((i) => i.path === 'diskRender.fileFormat')).toBe(true);
  });
});

describe('program-settings reset', () => {
  it('resets a single panel', () => {
    const s = createDefaultProgramSettings('darwin');
    s.general.workDirectory = '/test';
    s.playback.playbackFps = 60;
    const reset = resetProgramSettingsPanel(s, 'general', 'darwin');
    expect(reset.general.workDirectory).toBe('');
    expect(reset.playback.playbackFps).toBe(60);
  });
});

describe('program-settings mergeWithDefaults', () => {
  it('fills missing sections from defaults', () => {
    const merged = mergeWithDefaults({}, 'darwin');
    expect(merged.general.messageColorsEnabled).toBe(false);
    expect(merged.realtimeRender.audioDriver).toBe('pa_bl');
    expect(merged.version).toBe(1);
  });

  it('preserves saved values', () => {
    const merged = mergeWithDefaults({
      general: { workDirectory: '/saved' } as any,
    }, 'darwin');
    expect(merged.general.workDirectory).toBe('/saved');
    expect(merged.general.messageColorsEnabled).toBe(false);
  });
});

describe('program-settings appSpecific.windowLayout', () => {
  it('seeds default window layout settings on createDefaultCurrentAppSettings', () => {
    const app = createDefaultCurrentAppSettings();
    expect(app.windowLayout).toEqual(createDefaultWindowLayoutSettings());
    expect(app.windowLayout?.version).toBe(WINDOW_LAYOUT_SETTINGS_VERSION);
  });

  it('mergeWithDefaults fills missing windowLayout from defaults', () => {
    const merged = mergeWithDefaults({} as Partial<ProgramSettingsSnapshot>, 'darwin');
    expect(merged.appSpecific.windowLayout).toEqual(createDefaultWindowLayoutSettings());
  });

  it('mergeWithDefaults preserves valid saved window layout entries', () => {
    const merged = mergeWithDefaults({
      appSpecific: {
        enginePath: '/engine',
        recentFiles: [],
        windowBounds: null,
        midiInputDevice: '',
        midiOutputDevice: '',
        oscInputPort: 0,
        oscOutputHost: 'localhost',
        oscOutputPort: 0,
        windowLayout: {
          version: WINDOW_LAYOUT_SETTINGS_VERSION,
          windows: {
            main: {
              normalBounds: { x: 5, y: 5, width: 800, height: 600 },
              displayState: 'normal',
            },
          },
          splits: {},
          legacyMigration: {
            blueSettingsWindowBoundsMigrated: true,
            workbenchLocalStorageMigrated: false,
          },
        },
      } as any,
    }, 'darwin');

    expect(merged.appSpecific.windowLayout?.windows.main?.normalBounds.x).toBe(5);
    expect(merged.appSpecific.windowLayout?.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
  });

  it('mergeWithDefaults drops malformed windowLayout and falls back to defaults', () => {
    const merged = mergeWithDefaults({
      appSpecific: {
        windowLayout: { version: 'bad', windows: 'nope' } as any,
      } as any,
    }, 'darwin');

    expect(merged.appSpecific.windowLayout).toEqual(createDefaultWindowLayoutSettings());
  });

  it('validateProgramSettings does not flag a default snapshot', () => {
    const s = createDefaultProgramSettings('darwin');
    const issues = validateProgramSettings(s);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('windowLayout round-trip: defaults merge → save → load → reset preserves unrelated fields', () => {
    const base = createDefaultProgramSettings('darwin');
    base.appSpecific.windowLayout = {
      version: WINDOW_LAYOUT_SETTINGS_VERSION,
      windows: {
        main: { normalBounds: { x: 10, y: 20, width: 1024, height: 768 }, displayState: 'normal' },
      },
      splits: {
        'orchestra.outer': { orientation: 'horizontal', controlledPane: 'first', sizePx: 250 },
      },
      legacyMigration: { blueSettingsWindowBoundsMigrated: true, workbenchLocalStorageMigrated: false },
    };
    base.general.workDirectory = '/keep';
    base.appSpecific.enginePath = '/engine';
    base.realtimeRender.audioDriver = 'CoreAudio';

    const merged = mergeWithDefaults({
      general: { workDirectory: '/keep' },
      appSpecific: { windowLayout: base.appSpecific.windowLayout, enginePath: '/engine' },
      realtimeRender: { audioDriver: 'CoreAudio' },
    } as any, 'darwin');
    expect(merged.appSpecific.windowLayout?.windows.main?.normalBounds.width).toBe(1024);
    expect(merged.appSpecific.windowLayout?.splits['orchestra.outer']?.sizePx).toBe(250);
    expect(merged.appSpecific.windowLayout?.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
    expect(merged.general.workDirectory).toBe('/keep');
    expect(merged.appSpecific.enginePath).toBe('/engine');
    expect(merged.realtimeRender.audioDriver).toBe('CoreAudio');
  });

  it('malformed windowLayout is replaced with defaults while preserving unrelated settings', () => {
    const base = createDefaultProgramSettings('darwin');
    base.general.workDirectory = '/keep';
    base.appSpecific.enginePath = '/engine';

    const merged = mergeWithDefaults({
      general: { workDirectory: '/keep' },
      appSpecific: { windowLayout: { version: 'bad', windows: 'nope' } as any, enginePath: '/engine' },
    } as any, 'darwin');

    expect(merged.appSpecific.windowLayout).toEqual(createDefaultWindowLayoutSettings());
    expect(merged.general.workDirectory).toBe('/keep');
    expect(merged.appSpecific.enginePath).toBe('/engine');
  });
});
