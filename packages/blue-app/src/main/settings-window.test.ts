import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { openSettingsWindow, closeSettingsWindow } from './settings-window';
import {
  clearSettingsCache,
  setSettingsFilePathForTesting,
} from './program-settings-store';
import { loadWindowLayoutSettings, saveWindowLayoutSettings } from './window-layout-store';

const electronMock = vi.hoisted(() => {
  const instances: MockBrowserWindow[] = [];

  class MockBrowserWindow {
    options: Record<string, unknown>;
    destroyed = false;
    focus = vi.fn();
    show = vi.fn();
    loadURL = vi.fn();
    loadFile = vi.fn();
    once = vi.fn((event: string, handler: () => void) => {
      if (event === 'ready-to-show') {
        this.readyToShowHandler = handler;
      }
    });
    on = vi.fn((event: string, handler: () => void) => {
      this.eventHandlers[event] = handler;
    });
    removeListener = vi.fn();
    close = vi.fn(() => {
      this.destroyed = true;
      this.closedHandler?.();
    });
    isDestroyed = vi.fn(() => this.destroyed);
    isMaximized = vi.fn(() => false);
    isFullScreen = vi.fn(() => false);
    isMinimized = vi.fn(() => false);
    getBounds = vi.fn(() => ({ x: 80, y: 90, width: 800, height: 600 }));
    getNormalBounds = vi.fn(() => ({ x: 80, y: 90, width: 800, height: 600 }));
    setBounds = vi.fn();

    private readyToShowHandler?: () => void;
    private closedHandler?: () => void;
    eventHandlers: Record<string, () => void> = {};

    constructor(options: Record<string, unknown>) {
      this.options = options;
      instances.push(this);
    }

    triggerReadyToShow(): void {
      this.readyToShowHandler?.();
    }

    trigger(event: string): void {
      this.eventHandlers[event]?.();
    }
  }

  return { instances, MockBrowserWindow };
});

vi.mock('electron', () => ({
  BrowserWindow: electronMock.MockBrowserWindow,
  screen: {
    getAllDisplays: () => [
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
    ],
  },
}));

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-settings-window-test-'));
  setSettingsFilePathForTesting(path.join(tempDir, 'program-settings.json'));
  clearSettingsCache();
  closeSettingsWindow();
  electronMock.instances.length = 0;
  delete process.env.VITE_DEV_SERVER_URL;
});

afterEach(() => {
  closeSettingsWindow();
  fs.rmSync(tempDir, { recursive: true, force: true });
  clearSettingsCache();
  vi.clearAllMocks();
});

describe('settings window lifecycle', () => {
  it('creates a modal child window with the expected presentation', () => {
    const mainWindow = {} as never;
    openSettingsWindow(mainWindow);

    expect(electronMock.instances).toHaveLength(1);
    const settingsWindow = electronMock.instances[0];

    expect(settingsWindow.options.parent).toBe(mainWindow);
    expect(settingsWindow.options.title).toBe('Settings');
    expect(settingsWindow.options.show).toBe(false);
    expect(settingsWindow.options.frame).toBe(true);
    expect(settingsWindow.options.titleBarStyle).toBe('default');
    expect(settingsWindow.options.minimizable).toBe(false);
    expect(settingsWindow.options.maximizable).toBe(false);
    expect(settingsWindow.options.resizable).toBe(true);
    expect(settingsWindow.options.modal).toBe(process.platform !== 'darwin');
    expect(String(settingsWindow.loadFile.mock.calls[0]?.[0])).toContain('settings.html');

    settingsWindow.triggerReadyToShow();
    expect(settingsWindow.show).toHaveBeenCalledTimes(1);
  });

  it('focuses the existing window on repeat open and recreates after close', () => {
    const mainWindow = {} as never;
    openSettingsWindow(mainWindow);
    const firstWindow = electronMock.instances[0];

    openSettingsWindow(mainWindow);
    expect(firstWindow.focus).toHaveBeenCalledTimes(1);
    expect(electronMock.instances).toHaveLength(1);

    closeSettingsWindow();
    expect(firstWindow.close).toHaveBeenCalledTimes(1);

    openSettingsWindow(mainWindow);
    expect(electronMock.instances).toHaveLength(2);
  });
});

describe('settings window layout persistence', () => {
  it('persists the settings window bounds on close under the "settings" identity', () => {
    const mainWindow = {} as never;
    openSettingsWindow(mainWindow);

    const settingsWindow = electronMock.instances[0]!;
    settingsWindow.trigger('close');

    const layout = loadWindowLayoutSettings();
    expect(layout.windows.settings?.normalBounds).toEqual({ x: 80, y: 90, width: 800, height: 600 });
  });

  it('applies saved settings window bounds before the window is shown', () => {
    const mainWindow = {} as never;

    // Seed a saved snapshot manually through the canonical store.
    saveWindowLayoutSettings({
      ...loadWindowLayoutSettings(),
      windows: {
        settings: {
          normalBounds: { x: 200, y: 150, width: 700, height: 500 },
          displayState: 'normal',
        },
      },
    });

    openSettingsWindow(mainWindow);

    const settingsWindow = electronMock.instances[0]!;
    expect(settingsWindow.setBounds).toHaveBeenCalledWith({ x: 200, y: 150, width: 700, height: 500 });
  });
});
