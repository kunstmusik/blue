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
  getDefaultAudioDriver,
  getDefaultMidiDriver,
  isAbsoluteEnginePath,
  normalizeEnginePathSetting,
  PROGRAM_SETTINGS_PANEL_ORDER,
  TIME_BASE_CHOICES,
  SNAP_VALUE_CHOICES,
  SMPTE_FRAME_RATES,
  FILE_FORMAT_CHOICES,
  SAMPLE_FORMAT_CHOICES,
  isValidPlaybackPreferencePatch,
  FREEZE_MAX_JOBS_DEFAULT,
  FREEZE_MAX_JOBS_MIN,
  FREEZE_MAX_JOBS_MAX,
  normalizeFreezeMaxJobs,
  type ProgramSettingsSnapshot,
} from './program-settings';
import {
  createDefaultWindowLayoutSettings,
  WINDOW_LAYOUT_SETTINGS_VERSION,
} from './window-layout-settings';

describe('program-settings defaults', () => {
  it('creates macOS defaults', () => {
    const s = createDefaultProgramSettings('darwin');
    expect(s.version).toBe(3);
    expect(s.general.messageColorsEnabled).toBe(false);
    expect(s.general.csoundErrorWarningEnabled).toBe(true);
    expect(s.general.directoryTempFileLimit).toBe(3);
    expect(s.projectDefaults.defaultPrimaryTimeBase).toBe('BEATS');
    expect(s.projectDefaults.defaultLayerGroupType).toBe('TRACK');
    expect(s.projectDefaults.defaultUdoStyle).toBe('MODERN');
    expect(s.projectDefaults.defaultSmpteFrameRate).toBe(24);
    expect(s.playback.playbackFps).toBe(24);
    expect(s.playback.followPlayback).toBe(true);
    expect(s.utility.csoundExecutable).toBe('/usr/local/bin/csound');
    expect(s.utility.freezeFlags).toBe('-Ado');
    expect(s.realtimeRender.defaultKsmps).toBe('64');
    expect(s.diskRender.defaultKsmps).toBe('64');
    expect(s.realtimeRender.audioDriver).toBe('auhal');
    expect(s.realtimeRender.midiDriver).toBe('portmidi');
    expect(s.realtimeRender.softwareBufferSize).toBe(1024);
    expect(s.realtimeRender.hardwareBufferSize).toBe(4096);
    expect(s.diskRender.fileFormat).toBe('WAV');
    expect(s.diskRender.sampleFormat).toBe('SHORT');
    expect(s.appSpecific.enginePath).toBe('blue-engine');
    expect(s.appSpecific.csoundLibraryPath).toBe('');
    expect(s.osc.preferredPort).toBe(8000);
  });

  it('migrates a version-2 runtime path without dropping legacy selections', () => {
    const merged = mergeWithDefaults(
      {
        version: 2,
        appSpecific: {
          enginePath: '/external/blue-engine',
          csoundLibraryPath: '/Library/Frameworks/CsoundLib64.framework/CsoundLib64',
        } as any,
        realtimeRender: {
          audioDriver: 'custom-audio',
          audioOutText: 'saved-output',
        } as any,
        utility: { csoundExecutable: '/legacy/csound' } as any,
      },
      'darwin',
    );
    expect(merged.version).toBe(2);
    expect(merged.appSpecific.csoundLibraryPath).toContain('CsoundLib64');
    expect(merged.realtimeRender.audioDriver).toBe('custom-audio');
    expect(merged.utility.csoundExecutable).toBe('/legacy/csound');
  });

  it('creates Linux defaults', () => {
    const s = createDefaultProgramSettings('linux');
    expect(s.utility.csoundExecutable).toBe('csound');
    expect(s.utility.freezeFlags).toBe('-Wdo');
    expect(s.realtimeRender.audioDriver).toBe('alsa');
    expect(s.realtimeRender.midiDriver).toBe('alsa');
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
      'general',
      'projectDefaults',
      'playback',
      'utility',
      'realtimeRender',
      'diskRender',
      'midi',
      'osc',
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

  it('uses Csound runtime module defaults by platform', () => {
    expect(getDefaultAudioDriver('darwin')).toBe('auhal');
    expect(getDefaultAudioDriver('linux')).toBe('alsa');
    expect(getDefaultAudioDriver('win32')).toBe('PortAudio');
    expect(getDefaultMidiDriver('darwin')).toBe('portmidi');
    expect(getDefaultMidiDriver('linux')).toBe('alsa');
    expect(getDefaultMidiDriver('win32')).toBe('portmidi');
  });

  it('returns correct default freeze flags', () => {
    expect(getDefaultFreezeFlags('darwin')).toBe('-Ado');
    expect(getDefaultFreezeFlags('linux')).toBe('-Wdo');
  });

  it('normalizes bundled engine sentinels and recognizes cross-platform absolute paths', () => {
    expect(normalizeEnginePathSetting('')).toBe('blue-engine');
    expect(normalizeEnginePathSetting(' blue-engine ')).toBe('blue-engine');
    expect(normalizeEnginePathSetting(' /opt/blue-engine ')).toBe('/opt/blue-engine');
    expect(isAbsoluteEnginePath('/opt/blue-engine')).toBe(true);
    expect(isAbsoluteEnginePath('C:\\Blue\\blue-engine.exe')).toBe(true);
    expect(isAbsoluteEnginePath('relative/blue-engine')).toBe(false);
  });
});

describe('program-settings validation', () => {
  it('passes valid defaults', () => {
    const s = createDefaultProgramSettings('darwin');
    const issues = validateProgramSettings(s);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('rejects a relative external engine override without changing the settings version', () => {
    const s = createDefaultProgramSettings('darwin');
    s.appSpecific.enginePath = 'relative/blue-engine';
    expect(validateProgramSettings(s)).toContainEqual(
      expect.objectContaining({
        path: 'appSpecific.enginePath',
        severity: 'error',
      }),
    );
    expect(s.version).toBe(3);
  });

  it('rejects invalid directoryTempFileLimit', () => {
    const s = createDefaultProgramSettings('darwin');
    s.general.directoryTempFileLimit = 0;
    const issues = validateProgramSettings(s);
    expect(
      issues.some((i) => i.path === 'general.directoryTempFileLimit' && i.severity === 'error'),
    ).toBe(true);
  });

  it('rejects an invalid default layer group type', () => {
    const s = createDefaultProgramSettings('darwin');
    s.projectDefaults.defaultLayerGroupType = 'INVALID' as never;
    expect(validateProgramSettings(s)).toContainEqual(
      expect.objectContaining({
        path: 'projectDefaults.defaultLayerGroupType',
        severity: 'error',
      }),
    );
  });

  it('rejects invalid playbackFps', () => {
    const s = createDefaultProgramSettings('darwin');
    s.playback.playbackFps = 0;
    const issues = validateProgramSettings(s);
    expect(issues.some((i) => i.path === 'playback.playbackFps')).toBe(true);
  });

  it('rejects an invalid OSC preferred port', () => {
    const s = createDefaultProgramSettings('darwin');
    s.osc.preferredPort = 65536;
    expect(validateProgramSettings(s).some((issue) => issue.path === 'osc.preferredPort')).toBe(
      true,
    );
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

  it('resets OSC without changing other panels', () => {
    const s = createDefaultProgramSettings('darwin');
    s.osc.preferredPort = 9000;
    s.general.workDirectory = '/keep';
    const reset = resetProgramSettingsPanel(s, 'osc', 'darwin');
    expect(reset.osc.preferredPort).toBe(8000);
    expect(reset.general.workDirectory).toBe('/keep');
  });
});

describe('program-settings mergeWithDefaults', () => {
  it('fills missing sections from defaults', () => {
    const merged = mergeWithDefaults({}, 'darwin');
    expect(merged.general.messageColorsEnabled).toBe(false);
    expect(merged.realtimeRender.audioDriver).toBe('auhal');
    expect(merged.version).toBe(3);
    expect(merged.projectDefaults.defaultLayerGroupType).toBe('TRACK');
  });

  it('normalizes a missing or malformed saved default layer group type to Track', () => {
    expect(
      mergeWithDefaults({ projectDefaults: {} }, 'darwin').projectDefaults.defaultLayerGroupType,
    ).toBe('TRACK');
    expect(
      mergeWithDefaults({ projectDefaults: { defaultLayerGroupType: 'invalid' } as any }, 'darwin')
        .projectDefaults.defaultLayerGroupType,
    ).toBe('TRACK');
    expect(
      mergeWithDefaults(
        { projectDefaults: { defaultLayerGroupType: 'SOUND_OBJECT' } as any },
        'darwin',
      ).projectDefaults.defaultLayerGroupType,
    ).toBe('SOUND_OBJECT');
  });

  it('preserves saved values', () => {
    const merged = mergeWithDefaults(
      {
        general: { workDirectory: '/saved' } as any,
      },
      'darwin',
    );
    expect(merged.general.workDirectory).toBe('/saved');
    expect(merged.general.messageColorsEnabled).toBe(false);
  });

  it('drops the removed alpha marquee setting from legacy snapshots', () => {
    const merged = mergeWithDefaults(
      {
        general: {
          drawAlphaBackgroundOnMarquee: true,
          messageColorsEnabled: true,
        } as any,
      },
      'darwin',
    );

    expect(merged.general.messageColorsEnabled).toBe(true);
    expect(Object.hasOwn(merged.general, 'drawAlphaBackgroundOnMarquee')).toBe(false);
  });

  it('migrates a valid legacy OSC input port and ignores invalid placeholders', () => {
    expect(
      mergeWithDefaults(
        {
          appSpecific: { oscInputPort: 9020 } as any,
        },
        'darwin',
      ).osc.preferredPort,
    ).toBe(9020);
    expect(
      mergeWithDefaults(
        {
          appSpecific: { oscInputPort: 0 } as any,
        },
        'darwin',
      ).osc.preferredPort,
    ).toBe(8000);
  });

  it('defaults File Manager favorites to an empty list and normalizes saved entries', () => {
    expect(mergeWithDefaults({}, 'darwin').appSpecific.fileManagerFavorites).toEqual([]);
    expect(
      mergeWithDefaults(
        {
          appSpecific: {
            fileManagerFavorites: ['/Users/a/music', '  ', 7, '/Users/a/music', '/Users/b'],
          } as any,
        },
        'darwin',
      ).appSpecific.fileManagerFavorites,
    ).toEqual(['/Users/a/music', '/Users/b']);
  });

  it('defaults File Manager root labels to an empty map and normalizes saved entries', () => {
    expect(mergeWithDefaults({}, 'darwin').appSpecific.fileManagerRootLabels).toEqual({});
    expect(
      mergeWithDefaults(
        {
          appSpecific: {
            fileManagerRootLabels: {
              '/Users/a': 'Home Folder',
              '/': '  ',
              '/Volumes/media': 123,
              '/Volumes/backup': 'Backup Drive',
            },
          } as any,
        },
        'darwin',
      ).appSpecific.fileManagerRootLabels,
    ).toEqual({
      '/Users/a': 'Home Folder',
      '/Volumes/backup': 'Backup Drive',
    });
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
    const merged = mergeWithDefaults(
      {
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
      },
      'darwin',
    );

    expect(merged.appSpecific.windowLayout?.windows.main?.normalBounds.x).toBe(5);
    expect(merged.appSpecific.windowLayout?.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(
      true,
    );
  });

  it('mergeWithDefaults drops malformed windowLayout and falls back to defaults', () => {
    const merged = mergeWithDefaults(
      {
        appSpecific: {
          windowLayout: { version: 'bad', windows: 'nope' } as any,
        } as any,
      },
      'darwin',
    );

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
      legacyMigration: {
        blueSettingsWindowBoundsMigrated: true,
        workbenchLocalStorageMigrated: false,
      },
    };
    base.general.workDirectory = '/keep';
    base.appSpecific.enginePath = '/engine';
    base.realtimeRender.audioDriver = 'CoreAudio';

    const merged = mergeWithDefaults(
      {
        general: { workDirectory: '/keep' },
        appSpecific: { windowLayout: base.appSpecific.windowLayout, enginePath: '/engine' },
        realtimeRender: { audioDriver: 'CoreAudio' },
      } as any,
      'darwin',
    );
    expect(merged.appSpecific.windowLayout?.windows.main?.normalBounds.width).toBe(1024);
    expect(merged.appSpecific.windowLayout?.splits['orchestra.outer']?.sizePx).toBe(250);
    expect(merged.appSpecific.windowLayout?.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(
      true,
    );
    expect(merged.general.workDirectory).toBe('/keep');
    expect(merged.appSpecific.enginePath).toBe('/engine');
    expect(merged.realtimeRender.audioDriver).toBe('CoreAudio');
  });

  it('malformed windowLayout is replaced with defaults while preserving unrelated settings', () => {
    const base = createDefaultProgramSettings('darwin');
    base.general.workDirectory = '/keep';
    base.appSpecific.enginePath = '/engine';

    const merged = mergeWithDefaults(
      {
        general: { workDirectory: '/keep' },
        appSpecific: {
          windowLayout: { version: 'bad', windows: 'nope' } as any,
          enginePath: '/engine',
        },
      } as any,
      'darwin',
    );

    expect(merged.appSpecific.windowLayout).toEqual(createDefaultWindowLayoutSettings());
    expect(merged.general.workDirectory).toBe('/keep');
    expect(merged.appSpecific.enginePath).toBe('/engine');
  });
});

describe('program-settings appSpecific.appZoomPercent (SPEC 061)', () => {
  it('defaults to 100 on a fresh CurrentAppSettingsSnapshot', () => {
    const app = createDefaultCurrentAppSettings();
    expect(app.appZoomPercent).toBe(100);
  });

  it('seeds 100 on a fresh ProgramSettingsSnapshot without changing the settings version', () => {
    const s = createDefaultProgramSettings('darwin');
    expect(s.version).toBe(3);
    expect(s.appSpecific.appZoomPercent).toBe(100);
  });

  it('mergeWithDefaults preserves a valid saved zoom percent and keeps siblings intact', () => {
    const merged = mergeWithDefaults(
      {
        appSpecific: {
          enginePath: '/engine',
          recentFiles: ['/a.blue'],
          windowBounds: null,
          midiInputDevice: '',
          midiOutputDevice: '',
          oscInputPort: 0,
          oscOutputHost: 'localhost',
          oscOutputPort: 0,
          appZoomPercent: 170,
        } as any,
      } as any,
      'darwin',
    );

    expect(merged.appSpecific.appZoomPercent).toBe(170);
    expect(merged.appSpecific.enginePath).toBe('/engine');
    expect(merged.appSpecific.recentFiles).toEqual(['/a.blue']);
    expect(merged.version).toBe(3);
  });

  it('mergeWithDefaults falls back to 100 for missing appZoomPercent while preserving other app-specific fields', () => {
    const merged = mergeWithDefaults(
      {
        appSpecific: {
          enginePath: '/engine',
        } as any,
      } as any,
      'darwin',
    );

    expect(merged.appSpecific.appZoomPercent).toBe(100);
    expect(merged.appSpecific.enginePath).toBe('/engine');
  });

  it('mergeWithDefaults normalizes off-step, out-of-range, and malformed values to 100', () => {
    const cases: Array<{ input: unknown; label: string }> = [
      { input: 49, label: 'below range' },
      { input: 301, label: 'above range' },
      { input: 105, label: 'off-step inside range' },
      { input: 100.5, label: 'fractional' },
      { input: '120', label: 'string' },
      { input: null, label: 'null' },
      { input: Number.NaN, label: 'NaN' },
      { input: Number.POSITIVE_INFINITY, label: 'Infinity' },
      { input: true, label: 'boolean' },
    ];

    for (const { input, label } of cases) {
      const merged = mergeWithDefaults(
        {
          appSpecific: { appZoomPercent: input } as any,
        } as any,
        'darwin',
      );
      expect(merged.appSpecific.appZoomPercent, label).toBe(100);
    }
  });

  it('validateProgramSettings flags unsupported appZoomPercent at appSpecific.appZoomPercent', () => {
    const s = createDefaultProgramSettings('darwin');
    (s.appSpecific as any).appZoomPercent = 105;
    const issues = validateProgramSettings(s);
    const issue = issues.find((i) => i.path === 'appSpecific.appZoomPercent');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
  });

  it('validateProgramSettings accepts every legal zoom percentage', () => {
    for (let v = 50; v <= 300; v += 10) {
      const s = createDefaultProgramSettings('darwin');
      (s.appSpecific as any).appZoomPercent = v;
      const issues = validateProgramSettings(s);
      expect(
        issues.some((i) => i.path === 'appSpecific.appZoomPercent'),
        `value=${v}`,
      ).toBe(false);
    }
  });

  it('mergeWithDefaults does not bump the program-settings version when filling appZoomPercent', () => {
    const savedVersion = 2;
    const merged = mergeWithDefaults(
      {
        version: savedVersion,
        appSpecific: {} as any,
      } as any,
      'darwin',
    );
    expect(merged.version).toBe(savedVersion);
  });
});

describe('isValidPlaybackPreferencePatch (SPEC 079)', () => {
  it('accepts patches with at least one boolean field', () => {
    expect(isValidPlaybackPreferencePatch({ followPlayback: true })).toBe(true);
    expect(isValidPlaybackPreferencePatch({ followPlaybackOnStart: false })).toBe(true);
    expect(
      isValidPlaybackPreferencePatch({ followPlayback: false, followPlaybackOnStart: true }),
    ).toBe(true);
  });

  it('rejects empty or non-object payloads', () => {
    expect(isValidPlaybackPreferencePatch({})).toBe(false);
    expect(isValidPlaybackPreferencePatch(null)).toBe(false);
    expect(isValidPlaybackPreferencePatch(undefined)).toBe(false);
    expect(isValidPlaybackPreferencePatch('followPlayback')).toBe(false);
    expect(isValidPlaybackPreferencePatch(42)).toBe(false);
  });

  it('rejects non-boolean field values', () => {
    expect(isValidPlaybackPreferencePatch({ followPlayback: 'yes' })).toBe(false);
    expect(isValidPlaybackPreferencePatch({ followPlaybackOnStart: 1 })).toBe(false);
    expect(isValidPlaybackPreferencePatch({ followPlayback: null })).toBe(false);
    expect(
      isValidPlaybackPreferencePatch({ followPlayback: true, followPlaybackOnStart: 'no' }),
    ).toBe(false);
  });
});

describe('program-settings utility.freezeMaxJobs (SPEC 085)', () => {
  it('defaults to 4 on fresh Utility and ProgramSettings snapshots', () => {
    expect(createDefaultUtilitySettings('darwin').freezeMaxJobs).toBe(FREEZE_MAX_JOBS_DEFAULT);
    expect(createDefaultUtilitySettings('win32').freezeMaxJobs).toBe(FREEZE_MAX_JOBS_DEFAULT);
    expect(createDefaultProgramSettings('darwin').utility.freezeMaxJobs).toBe(
      FREEZE_MAX_JOBS_DEFAULT,
    );
  });

  it('mergeWithDefaults preserves a valid saved freezeMaxJobs with utility siblings intact', () => {
    const merged = mergeWithDefaults(
      {
        utility: { csoundExecutable: '/custom/csound', freezeFlags: '-W', freezeMaxJobs: 7 } as any,
      } as any,
      'darwin',
    );
    expect(merged.utility.freezeMaxJobs).toBe(7);
    expect(merged.utility.csoundExecutable).toBe('/custom/csound');
    expect(merged.utility.freezeFlags).toBe('-W');
  });

  it('mergeWithDefaults loads the default 4 for missing, malformed, and out-of-range values', () => {
    const cases: Array<{ input: unknown; label: string }> = [
      { input: undefined, label: 'missing' },
      { input: null, label: 'null' },
      { input: '4', label: 'string' },
      { input: 4.5, label: 'fractional' },
      { input: Number.NaN, label: 'NaN' },
      { input: 0, label: 'below range' },
      { input: -2, label: 'negative' },
      { input: 33, label: 'above range' },
      { input: 1000, label: 'far above range' },
    ];
    for (const { input, label } of cases) {
      expect(normalizeFreezeMaxJobs(input), label).toBe(FREEZE_MAX_JOBS_DEFAULT);
      const merged = mergeWithDefaults(
        { utility: { freezeMaxJobs: input } as any } as any,
        'darwin',
      );
      expect(merged.utility.freezeMaxJobs, label).toBe(FREEZE_MAX_JOBS_DEFAULT);
    }
  });

  it('accepts the inclusive range boundaries through merge and normalization', () => {
    expect(normalizeFreezeMaxJobs(FREEZE_MAX_JOBS_MIN)).toBe(FREEZE_MAX_JOBS_MIN);
    expect(normalizeFreezeMaxJobs(FREEZE_MAX_JOBS_MAX)).toBe(FREEZE_MAX_JOBS_MAX);
  });

  it('validateProgramSettings rejects non-integer and out-of-range values at the boundaries', () => {
    for (const value of [0, -1, 33, 1.5, Number.NaN]) {
      const snapshot = createDefaultProgramSettings('darwin');
      snapshot.utility.freezeMaxJobs = value as number;
      const issues = validateProgramSettings(snapshot).filter(
        (issue) => issue.path === 'utility.freezeMaxJobs',
      );
      expect(issues, `value ${value}`).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
    }
  });

  it('validateProgramSettings accepts the inclusive range without utility issues', () => {
    for (const value of [FREEZE_MAX_JOBS_MIN, 4, FREEZE_MAX_JOBS_MAX]) {
      const snapshot = createDefaultProgramSettings('darwin');
      snapshot.utility.freezeMaxJobs = value;
      const issues = validateProgramSettings(snapshot).filter(
        (issue) => issue.path === 'utility.freezeMaxJobs',
      );
      expect(issues, `value ${value}`).toHaveLength(0);
    }
  });

  it('resetting the utility panel restores the default freezeMaxJobs', () => {
    const snapshot = createDefaultProgramSettings('darwin');
    snapshot.utility.freezeMaxJobs = 12;
    snapshot.utility.freezeFlags = '-W';
    const reset = resetProgramSettingsPanel(snapshot, 'utility', 'darwin');
    expect(reset.utility.freezeMaxJobs).toBe(FREEZE_MAX_JOBS_DEFAULT);
    expect(reset.utility.freezeFlags).toBe('-Ado');
  });
});
