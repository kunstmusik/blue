import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  broadcastWindowLayoutReset,
  loadWindowLayoutSettings,
  resetWindowLayout,
  saveWindowLayoutSettings,
  setCurrentSessionWindowResetHandler,
  updateWindowLayout,
} from './window-layout-store';
import {
  clearSettingsCache,
  setSettingsFilePathForTesting,
  loadProgramSettings,
  saveProgramSettings,
} from './program-settings-store';
import {
  createDefaultSplitLocation,
  createDefaultWindowLayoutSettings,
  WINDOW_LAYOUT_SETTINGS_VERSION,
  WINDOW_IDENTITIES,
  DEFAULT_SPLIT_SIZE_PX,
  type SplitId,
} from '../shared/window-layout-settings';

const webContentsSend = vi.fn();
const mockWindows: Array<{ isDestroyed: () => boolean; webContents: { send: typeof webContentsSend } }> = [];

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => mockWindows,
  },
}));

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-layout-store-test-'));
  setSettingsFilePathForTesting(path.join(tempDir, 'program-settings.json'));
  clearSettingsCache();
  webContentsSend.mockClear();
  mockWindows.length = 0;
});

afterEach(() => {
  setCurrentSessionWindowResetHandler(null);
  fs.rmSync(tempDir, { recursive: true, force: true });
  clearSettingsCache();
});

describe('window-layout-store load', () => {
  it('returns default layout when no settings file exists', () => {
    const layout = loadWindowLayoutSettings();
    expect(layout).toEqual(createDefaultWindowLayoutSettings());
    expect(layout.version).toBe(WINDOW_LAYOUT_SETTINGS_VERSION);
  });

  it('reads previously saved layout from the program settings file', () => {
    saveWindowLayoutSettings({
      ...createDefaultWindowLayoutSettings(),
      windows: {
        main: {
          normalBounds: { x: 10, y: 20, width: 800, height: 600 },
          displayState: 'normal',
        },
      },
    });

    clearSettingsCache();
    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.windows.main?.normalBounds).toEqual({ x: 10, y: 20, width: 800, height: 600 });
  });

  it('preserves unrelated app-specific settings across save/load', () => {
    const first = loadWindowLayoutSettings();
    saveWindowLayoutSettings({
      ...first,
      splits: {
        'orchestra.outer': {
          orientation: 'horizontal',
          controlledPane: 'first',
          sizePx: 250,
        },
      },
    });

    clearSettingsCache();
    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.splits['orchestra.outer']?.sizePx).toBe(250);
  });
});

describe('window-layout-store update', () => {
  it('applies a window-state update through the canonical settings file', () => {
    updateWindowLayout({
      type: 'window-state',
      windowId: 'settings',
      state: {
        normalBounds: { x: 30, y: 40, width: 600, height: 400 },
        displayState: 'normal',
      },
    });

    clearSettingsCache();
    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.windows.settings?.normalBounds.width).toBe(600);
  });

  it('drops invalid window-state payloads without losing prior entries', () => {
    updateWindowLayout({
      type: 'window-state',
      windowId: 'main',
      state: {
        normalBounds: { x: 0, y: 0, width: 800, height: 600 },
        displayState: 'normal',
      },
    });
    updateWindowLayout({
      type: 'window-state',
      windowId: 'settings',
      state: {
        normalBounds: { x: 0, y: 0, width: 0, height: 0 },
        displayState: 'normal',
      },
    });

    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.windows.main).toBeDefined();
    expect(reloaded.windows.settings).toBeUndefined();
  });

  it('applies a split-location update', () => {
    updateWindowLayout({
      type: 'split-location',
      splitId: 'line-object.lines',
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: 220 },
    });

    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.splits['line-object.lines']?.sizePx).toBe(220);
  });

  it('applies a workbench-layout update', () => {
    updateWindowLayout({
      type: 'workbench-layout',
      serializedLayout: '{"version":5}',
    });

    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.workbench?.serializedLayout).toBe('{"version":5}');
  });

  it('persists legacy migration payload values through the canonical settings file', () => {
    updateWindowLayout({
      type: 'legacy-migration',
      legacy: {
        windowBounds: { x: 40, y: 50, width: 1000, height: 700 },
        workbenchSerializedLayout: '{"version":5,"legacy":true}',
      },
    });

    clearSettingsCache();
    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.windows.main?.normalBounds).toEqual({ x: 40, y: 50, width: 1000, height: 700 });
    expect(reloaded.workbench?.serializedLayout).toBe('{"version":5,"legacy":true}');
    expect(reloaded.legacyMigration.blueSettingsWindowBoundsMigrated).toBe(true);
    expect(reloaded.legacyMigration.workbenchLocalStorageMigrated).toBe(true);
  });
});

describe('window-layout-store reset preserves unrelated settings', () => {
  it('clears saved window/workbench/split state and stamps lastResetAt', () => {
    updateWindowLayout({
      type: 'window-state',
      windowId: 'main',
      state: {
        normalBounds: { x: 10, y: 20, width: 800, height: 600 },
        displayState: 'normal',
      },
    });
    updateWindowLayout({
      type: 'split-location',
      splitId: 'orchestra.outer',
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: 240 },
    });

    const reset = resetWindowLayout();
    expect(reset.windows).toEqual({});
    expect(reset.splits).toEqual({});
    expect(reset.workbench).toBeUndefined();
    expect(reset.lastResetAt).toEqual(expect.any(String));

    clearSettingsCache();
    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.windows).toEqual({});
    expect(reloaded.splits).toEqual({});
  });

  it('preserves recentFiles, enginePath, render settings, and other app-specific values', () => {
    const settings = loadProgramSettings('darwin');
    settings.general.workDirectory = '/keep';
    settings.appSpecific.enginePath = '/engine';
    settings.appSpecific.recentFiles = ['/a.blue', '/b.blue'];
    settings.realtimeRender.audioDriver = 'CoreAudio';
    saveProgramSettings(settings, 'darwin');

    resetWindowLayout();

    clearSettingsCache();
    const reloaded = loadProgramSettings('darwin');
    expect(reloaded.general.workDirectory).toBe('/keep');
    expect(reloaded.appSpecific.enginePath).toBe('/engine');
    expect(reloaded.appSpecific.recentFiles).toEqual(['/a.blue', '/b.blue']);
    expect(reloaded.realtimeRender.audioDriver).toBe('CoreAudio');
    expect(reloaded.appSpecific.windowLayout).toEqual({
      ...createDefaultWindowLayoutSettings(),
      legacyMigration: {
        blueSettingsWindowBoundsMigrated: true,
        workbenchLocalStorageMigrated: true,
        migratedAt: expect.any(String),
      },
      lastResetAt: expect.any(String),
    });
  });

  it('runs the current-session window reset hook before broadcasting', () => {
    const resetCurrentSession = vi.fn();
    setCurrentSessionWindowResetHandler(resetCurrentSession);
    mockWindows.push(
      { isDestroyed: () => false, webContents: { send: webContentsSend } },
    );

    resetWindowLayout();

    expect(resetCurrentSession).toHaveBeenCalledTimes(1);
    expect(webContentsSend).toHaveBeenCalledWith('window-layout:reset');
  });
});

describe('window-layout-store broadcast', () => {
  it('broadcasts the reset to every active BrowserWindow', () => {
    mockWindows.push(
      { isDestroyed: () => false, webContents: { send: webContentsSend } },
      { isDestroyed: () => false, webContents: { send: webContentsSend } },
    );

    resetWindowLayout();

    expect(webContentsSend).toHaveBeenCalledTimes(2);
    expect(webContentsSend.mock.calls[0]?.[0]).toBe('window-layout:reset');
  });

  it('skips destroyed windows during broadcast', () => {
    mockWindows.push(
      { isDestroyed: () => true, webContents: { send: webContentsSend } },
      { isDestroyed: () => false, webContents: { send: webContentsSend } },
    );

    resetWindowLayout();

    expect(webContentsSend).toHaveBeenCalledTimes(1);
  });
});

describe('window-layout-store round-trip for every identity', () => {
  it('round-trips each in-scope window identity through save/load', () => {
    for (const windowId of WINDOW_IDENTITIES) {
      clearSettingsCache();
      updateWindowLayout({
        type: 'window-state',
        windowId,
        state: {
          normalBounds: { x: 100, y: 100, width: 1024, height: 768 },
          displayState: 'normal',
        },
      });

      const reloaded = loadWindowLayoutSettings();
      const entry = reloaded.windows[windowId];
      expect(entry, `window ${windowId}`).toBeDefined();
      expect(entry!.normalBounds).toEqual({ x: 100, y: 100, width: 1024, height: 768 });
      expect(entry!.updatedAt).toEqual(expect.any(String));
    }
  });

  it('round-trips every split identity through save/load', () => {
    const splitIds: SplitId[] = [
      'orchestra.outer',
      'score.main',
      'udo.workspace.outer',
      'bsb.interface.properties',
      'piano-roll.field-editor',
      'line-object.lines',
      'zak-line-object.lines',
      'pattern-object.layers',
      'pattern-object.score',
      'soundfont-viewer.tables',
    ];

    for (const splitId of splitIds) {
      clearSettingsCache();
      updateWindowLayout({
        type: 'split-location',
        splitId,
        location: { orientation: 'horizontal', controlledPane: 'first', sizePx: 300 },
      });

      const reloaded = loadWindowLayoutSettings();
      const entry = reloaded.splits[splitId];
      expect(entry, `split ${splitId}`).toBeDefined();
      expect(entry!.sizePx).toBe(300);
    }
  });

  it('default split location for unknown split ID is a valid 200px first/horizontal layout', () => {
    expect(createDefaultSplitLocation()).toEqual({
      orientation: 'horizontal',
      controlledPane: 'first',
      sizePx: DEFAULT_SPLIT_SIZE_PX,
    });
    expect(DEFAULT_SPLIT_SIZE_PX).toBe(200);
  });
});

describe('window-layout-store invalid-value preservation', () => {
  it('drops a bad window-state update while keeping all prior valid entries', () => {
    updateWindowLayout({
      type: 'window-state',
      windowId: 'main',
      state: { normalBounds: { x: 10, y: 20, width: 800, height: 600 }, displayState: 'normal' },
    });
    updateWindowLayout({
      type: 'window-state',
      windowId: 'main',
      state: { normalBounds: { x: 0, y: 0, width: 0, height: 0 }, displayState: 'normal' },
    });

    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.windows.main).toBeDefined();
    expect(reloaded.windows.main!.normalBounds.width).toBe(800);
  });

  it('drops a bad split-location update while keeping all prior valid splits', () => {
    updateWindowLayout({
      type: 'split-location',
      splitId: 'orchestra.outer',
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: 250 },
    });
    updateWindowLayout({
      type: 'split-location',
      splitId: 'score.main',
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: -10 },
    });

    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.splits['orchestra.outer']?.sizePx).toBe(250);
    expect(reloaded.splits['score.main']).toBeUndefined();
  });

  it('drops an unknown split identity key', () => {
    updateWindowLayout({
      type: 'split-location',
      splitId: 'nonexistent.split' as SplitId,
      location: { orientation: 'horizontal', controlledPane: 'first', sizePx: 200 },
    });

    const reloaded = loadWindowLayoutSettings();
    expect(reloaded.splits['nonexistent.split' as SplitId]).toBeUndefined();
  });
});
