// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutSettingsStore } from '../stores/layout-settings-store';
import type {
  ProgramSettingsSnapshot,
} from '../../shared/program-settings';
import {
  createDefaultWindowLayoutSettings,
  resetWindowLayoutSettings,
  type WindowLayoutUpdateRequest,
} from '../../shared/window-layout-settings';

interface BlueAPIMock {
  getProgramSettings: ReturnType<typeof vi.fn>;
  updateWindowLayout: ReturnType<typeof vi.fn>;
  resetWindows: ReturnType<typeof vi.fn>;
  onWindowLayoutReset: ReturnType<typeof vi.fn>;
}

function createProgramSettings(layoutOverrides: Partial<ReturnType<typeof createDefaultWindowLayoutSettings>> = {}): ProgramSettingsSnapshot {
  const base = createDefaultWindowLayoutSettings();
  return {
    version: 1,
    general: {
      workDirectory: '',
      newUserDefaultsEnabled: true,
      drawAlphaBackgroundOnMarquee: false,
      messageColorsEnabled: false,
      csoundErrorWarningEnabled: true,
      directoryTempFileLimit: 3,
    },
    projectDefaults: {
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
    },
    playback: { playbackFps: 24, playbackLatencyCorrection: 0, followPlayback: true, followPlaybackOnStart: true },
    utility: { csoundExecutable: 'csound', freezeFlags: '-Wdo' },
    realtimeRender: {
      csoundExecutable: 'csound',
      defaultSr: '44100',
      defaultKsmps: '1',
      defaultNchnls: '2',
      useZeroDbfs: true,
      zeroDbfs: '1',
      audioDriverEnabled: true,
      audioDriver: 'PortAudio',
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
      softwareBufferSize: 256,
      hardwareBufferEnabled: false,
      hardwareBufferSize: 1024,
      noteAmpsEnabled: true,
      outOfRangeEnabled: true,
      warningsEnabled: true,
      benchmarkEnabled: true,
      displaysDisabled: true,
      advancedSettings: '',
      renderMethod: '',
    },
    diskRender: {
      csoundExecutable: 'csound',
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
    },
    appSpecific: {
      enginePath: 'blue-engine',
      recentFiles: [],
      windowBounds: null,
      midiInputDevice: '',
      midiOutputDevice: '',
      oscInputPort: 0,
      oscOutputHost: 'localhost',
      oscOutputPort: 0,
      windowLayout: { ...base, ...layoutOverrides },
    },
  };
}

describe('layout-settings-store', () => {
  let blueAPI: BlueAPIMock;

  beforeEach(() => {
    blueAPI = {
      getProgramSettings: vi.fn(),
      updateWindowLayout: vi.fn(),
      resetWindows: vi.fn(),
      onWindowLayoutReset: vi.fn(() => () => {}),
    };
    Object.assign(window, { blueAPI });
    useLayoutSettingsStore.setState({ layout: null });
  });

  afterEach(() => {
    delete (window as Window & { blueAPI?: BlueAPIMock }).blueAPI;
    vi.clearAllMocks();
  });

  it('loads the canonical layout snapshot from program settings', async () => {
    const settings = createProgramSettings({
      windows: {
        main: {
          normalBounds: { x: 10, y: 20, width: 800, height: 600 },
          displayState: 'normal',
        },
      },
    });
    blueAPI.getProgramSettings.mockResolvedValue(settings);

    await useLayoutSettingsStore.getState().load();

    expect(blueAPI.getProgramSettings).toHaveBeenCalledTimes(1);
    expect(useLayoutSettingsStore.getState().layout?.windows.main?.normalBounds.width).toBe(800);
  });

  it('forwards split updates to the main process through updateWindowLayout', async () => {
    const updated = {
      ...createDefaultWindowLayoutSettings(),
      splits: {
        'orchestra.outer': {
          orientation: 'horizontal' as const,
          controlledPane: 'first' as const,
          sizePx: 240,
        },
      },
    };
    blueAPI.updateWindowLayout.mockResolvedValue(updated);

    await useLayoutSettingsStore.getState().updateSplitLocation('orchestra.outer', {
      orientation: 'horizontal',
      controlledPane: 'first',
      sizePx: 240,
    });

    const expectedRequest: WindowLayoutUpdateRequest = {
      type: 'split-location',
      splitId: 'orchestra.outer',
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: 240 },
    };
    expect(blueAPI.updateWindowLayout).toHaveBeenCalledWith(expectedRequest);
    expect(useLayoutSettingsStore.getState().layout).toEqual(updated);
  });

  it('forwards workbench layout updates to the main process', async () => {
    const updated = {
      ...createDefaultWindowLayoutSettings(),
      workbench: { serializedLayout: '{"version":5}' },
    };
    blueAPI.updateWindowLayout.mockResolvedValue(updated);

    await useLayoutSettingsStore.getState().updateWorkbenchLayout('{"version":5}');

    expect(blueAPI.updateWindowLayout).toHaveBeenCalledWith({
      type: 'workbench-layout',
      serializedLayout: '{"version":5}',
    });
    expect(useLayoutSettingsStore.getState().layout?.workbench?.serializedLayout).toBe('{"version":5}');
  });

  it('forwards window-state updates to the main process', async () => {
    const updated = {
      ...createDefaultWindowLayoutSettings(),
      windows: {
        main: {
          normalBounds: { x: 1, y: 2, width: 800, height: 600 },
          displayState: 'normal' as const,
        },
      },
    };
    blueAPI.updateWindowLayout.mockResolvedValue(updated);

    await useLayoutSettingsStore.getState().updateWindowState('main', {
      normalBounds: { x: 1, y: 2, width: 800, height: 600 },
      displayState: 'normal',
    });

    expect(blueAPI.updateWindowLayout).toHaveBeenCalledWith({
      type: 'window-state',
      windowId: 'main',
      state: { normalBounds: { x: 1, y: 2, width: 800, height: 600 }, displayState: 'normal' },
    });
  });

  it('reset() calls resetWindows and applies the returned defaults locally', async () => {
    const reset = createDefaultWindowLayoutSettings();
    blueAPI.resetWindows.mockResolvedValue(reset);

    await useLayoutSettingsStore.getState().reset();

    expect(blueAPI.resetWindows).toHaveBeenCalledTimes(1);
    expect(useLayoutSettingsStore.getState().layout).toEqual(reset);
  });

  it('applyReset() immediately clears the local snapshot without contacting main', () => {
    useLayoutSettingsStore.setState({
      layout: {
        ...createDefaultWindowLayoutSettings(),
        windows: {
          main: {
            normalBounds: { x: 99, y: 99, width: 800, height: 600 },
            displayState: 'normal',
          },
        },
      },
    });

    useLayoutSettingsStore.getState().applyReset();

    expect(useLayoutSettingsStore.getState().layout).toEqual({
      ...resetWindowLayoutSettings(),
      lastResetAt: expect.any(String),
      legacyMigration: {
        blueSettingsWindowBoundsMigrated: true,
        workbenchLocalStorageMigrated: true,
        migratedAt: expect.any(String),
      },
    });
  });

  it('applyReset() preserves the legacyMigration envelope on the fresh snapshot', () => {
    useLayoutSettingsStore.setState({
      layout: {
        ...createDefaultWindowLayoutSettings(),
        windows: {
          main: {
            normalBounds: { x: 99, y: 99, width: 800, height: 600 },
            displayState: 'normal',
          },
        },
        legacyMigration: {
          blueSettingsWindowBoundsMigrated: true,
          workbenchLocalStorageMigrated: true,
          migratedAt: '2026-07-05T12:00:00.000Z',
        },
      },
    });

    useLayoutSettingsStore.getState().applyReset();

    const fresh = useLayoutSettingsStore.getState().layout;
    expect(fresh).toBeDefined();
    expect(fresh!.windows).toEqual({});
    expect(fresh!.splits).toEqual({});
    expect(fresh!.workbench).toBeUndefined();
    expect(fresh!.legacyMigration).toEqual({
      blueSettingsWindowBoundsMigrated: true,
      workbenchLocalStorageMigrated: true,
      migratedAt: expect.any(String),
    });
  });

  it('reset() via IPC returns a snapshot with cleared layout state', async () => {
    const defaults = createDefaultWindowLayoutSettings();
    blueAPI.resetWindows.mockResolvedValue(defaults);

    await useLayoutSettingsStore.getState().reset();

    expect(blueAPI.resetWindows).toHaveBeenCalledTimes(1);
    expect(useLayoutSettingsStore.getState().layout).toEqual(defaults);
    expect(useLayoutSettingsStore.getState().layout!.windows).toEqual({});
    expect(useLayoutSettingsStore.getState().layout!.splits).toEqual({});
  });
});

// Preload/API type exposure for layout methods is enforced by the
// `pnpm --filter @blue/app build` step: global.d.ts must declare
// getProgramSettings, updateWindowLayout, resetWindows, and
// onWindowLayoutReset on Window['blueAPI'], and preload.ts must wire
// them, or the renderer TypeScript build fails.
