import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachWindowStateHandlers,
  captureWindowState,
  getAvailableDisplayWorkAreas,
  getDefaultWindowBounds,
  restoreWindowState,
  resetTrackedWindowsToDefaultBounds,
  resetWindowToDefaultBounds,
} from './window-state-manager';
import {
  clearSettingsCache,
  setSettingsFilePathForTesting,
} from './program-settings-store';
import { loadWindowLayoutSettings, saveWindowLayoutSettings } from './window-layout-store';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { WindowStateSnapshot } from '../shared/window-layout-settings';

interface MockBrowserWindow {
  options: Record<string, unknown>;
  bounds: { x: number; y: number; width: number; height: number };
  isMaximized: ReturnType<typeof vi.fn>;
  isFullScreen: ReturnType<typeof vi.fn>;
  isMinimized: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
  setBounds: ReturnType<typeof vi.fn>;
  getBounds: ReturnType<typeof vi.fn>;
  getNormalBounds: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  maximize: ReturnType<typeof vi.fn>;
  unmaximize: ReturnType<typeof vi.fn>;
  setFullScreen: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  trigger: (event: string) => void;
}

const screenMock = vi.hoisted(() => ({
  getAllDisplays: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  screen: screenMock,
}));

function createMockWindow(initialBounds: { x: number; y: number; width: number; height: number }): MockBrowserWindow {
  const maximized = { value: false };
  const fullscreen = { value: false };
  const minimized = { value: false };
  const destroyed = { value: false };
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    options: {},
    bounds: { ...initialBounds },
    isMaximized: vi.fn(() => maximized.value),
    isFullScreen: vi.fn(() => fullscreen.value),
    isMinimized: vi.fn(() => minimized.value),
    isDestroyed: vi.fn(() => destroyed.value),
    getBounds: vi.fn(() => ({ ...initialBounds })),
    getNormalBounds: vi.fn(() => ({ ...initialBounds })),
    setBounds: vi.fn((next: Partial<{ x: number; y: number; width: number; height: number }>) => {
      Object.assign(initialBounds, next);
    }),
    setSize: vi.fn((w: number, h: number) => {
      initialBounds.width = w;
      initialBounds.height = h;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      initialBounds.x = x;
      initialBounds.y = y;
    }),
    maximize: vi.fn(() => { maximized.value = true; }),
    unmaximize: vi.fn(() => { maximized.value = false; }),
    setFullScreen: vi.fn((value: boolean) => { fullscreen.value = value; }),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler);
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler);
    }),
    removeListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(handler);
    }),
    trigger(event: string): void {
      const set = handlers.get(event);
      if (!set) return;
      for (const handler of [...set]) handler();
    },
    show: vi.fn(),
    focus: vi.fn(),
  } as unknown as MockBrowserWindow;
}

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-window-state-test-'));
  setSettingsFilePathForTesting(path.join(tempDir, 'program-settings.json'));
  clearSettingsCache();
  screenMock.getAllDisplays.mockReset();
  screenMock.getAllDisplays.mockReturnValue([
    { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
  ]);
});

describe('window-state-manager reset defaults', () => {
  it('computes centered default bounds for a window identity', () => {
    const bounds = getDefaultWindowBounds('main');
    expect(bounds).toEqual({ x: 360, y: 140, width: 1200, height: 800 });
  });

  it('moves a window to its default bounds and clears display state', () => {
    const window = createMockWindow({ x: 100, y: 100, width: 700, height: 500 });
    window.isMaximized.mockReturnValue(true);
    window.isFullScreen.mockReturnValue(true);

    const reset = resetWindowToDefaultBounds(window as never, 'settings');

    expect(reset).toBe(true);
    expect(window.setFullScreen).toHaveBeenCalledWith(false);
    expect(window.unmaximize).toHaveBeenCalledTimes(1);
    expect(window.setBounds).toHaveBeenCalledWith({ x: 560, y: 240, width: 800, height: 600 });
  });

  it('resets only windows still tracked by attachWindowStateHandlers', () => {
    const main = createMockWindow({ x: 100, y: 100, width: 700, height: 500 });
    const settings = createMockWindow({ x: 200, y: 200, width: 700, height: 500 });
    const disposeSettings = attachWindowStateHandlers(settings as never, 'settings', { onSave: vi.fn() });
    attachWindowStateHandlers(main as never, 'main', { onSave: vi.fn() });
    disposeSettings();

    const count = resetTrackedWindowsToDefaultBounds([main as never, settings as never]);

    expect(count).toBe(1);
    expect(main.setBounds).toHaveBeenCalledWith({ x: 360, y: 140, width: 1200, height: 800 });
    expect(settings.setBounds).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  clearSettingsCache();
  vi.clearAllMocks();
});

describe('window-state-manager captureWindowState', () => {
  it('captures normal bounds when the window is not maximized/fullscreen/minimized', () => {
    const window = createMockWindow({ x: 100, y: 80, width: 800, height: 600 });
    const state = captureWindowState(window as never);
    expect(state?.normalBounds).toEqual({ x: 100, y: 80, width: 800, height: 600 });
    expect(state?.displayState).toBe('normal');
    expect(state?.updatedAt).toEqual(expect.any(String));
  });

  it('captures displayState maximized without losing the pre-maximize normal bounds', () => {
    const window = createMockWindow({ x: 100, y: 80, width: 800, height: 600 });
    window.isMaximized.mockReturnValue(true);
    window.getNormalBounds.mockReturnValue({ x: 100, y: 80, width: 800, height: 600 });
    window.getBounds.mockReturnValue({ x: 0, y: 0, width: 1920, height: 1080 });

    const state = captureWindowState(window as never) as WindowStateSnapshot;
    expect(state.displayState).toBe('maximized');
    expect(state.normalBounds).toEqual({ x: 100, y: 80, width: 800, height: 600 });
  });

  it('captures displayState fullscreen while preserving normal bounds', () => {
    const window = createMockWindow({ x: 100, y: 80, width: 800, height: 600 });
    window.isFullScreen.mockReturnValue(true);
    window.getNormalBounds.mockReturnValue({ x: 100, y: 80, width: 800, height: 600 });
    window.getBounds.mockReturnValue({ x: 0, y: 0, width: 1920, height: 1080 });

    const state = captureWindowState(window as never) as WindowStateSnapshot;
    expect(state.displayState).toBe('fullscreen');
    expect(state.normalBounds).toEqual({ x: 100, y: 80, width: 800, height: 600 });
  });

  it('returns null while the window is minimized so transient state is not persisted', () => {
    const window = createMockWindow({ x: 100, y: 80, width: 800, height: 600 });
    window.isMinimized.mockReturnValue(true);
    expect(captureWindowState(window as never)).toBeNull();
  });
});

describe('window-state-manager restoreWindowState', () => {
  it('exposes copies of every connected display work area', () => {
    const displays = [
      {
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 24, width: 1920, height: 1056 },
      },
      {
        bounds: { x: 1920, y: 0, width: 1440, height: 900 },
        workArea: { x: 1920, y: 24, width: 1440, height: 876 },
      },
    ];
    screenMock.getAllDisplays.mockReturnValue(displays);

    const areas = getAvailableDisplayWorkAreas();

    expect(areas).toEqual([
      { x: 0, y: 24, width: 1920, height: 1056 },
      { x: 1920, y: 24, width: 1440, height: 876 },
    ]);
    areas[0]!.x = 999;
    expect(displays[0]!.workArea.x).toBe(0);
  });

  it('applies valid saved bounds before the window is shown', () => {
    const window = createMockWindow({ x: 0, y: 0, width: 1200, height: 800 });
    const state: WindowStateSnapshot = {
      normalBounds: { x: 50, y: 60, width: 1000, height: 700 },
      displayState: 'normal',
    };

    const result = restoreWindowState(window as never, 'main', { state });
    expect(result.applied).toBe(true);
    expect(window.setBounds).toHaveBeenCalledWith({ x: 50, y: 60, width: 1000, height: 700 });
  });

  it('restores maximized state after applying valid normal bounds', () => {
    const window = createMockWindow({ x: 0, y: 0, width: 1200, height: 800 });
    const state: WindowStateSnapshot = {
      normalBounds: { x: 50, y: 60, width: 1000, height: 700 },
      displayState: 'maximized',
    };

    restoreWindowState(window as never, 'main', { state });
    expect(window.setBounds).toHaveBeenCalledWith({ x: 50, y: 60, width: 1000, height: 700 });
    expect(window.maximize).toHaveBeenCalledTimes(1);
  });

  it('restores fullscreen state after applying valid normal bounds', () => {
    const window = createMockWindow({ x: 0, y: 0, width: 1200, height: 800 });
    const state: WindowStateSnapshot = {
      normalBounds: { x: 50, y: 60, width: 1000, height: 700 },
      displayState: 'fullscreen',
    };

    restoreWindowState(window as never, 'main', { state });
    expect(window.setFullScreen).toHaveBeenCalledWith(true);
  });

  it('falls back to defaults when saved state is missing', () => {
    const window = createMockWindow({ x: 0, y: 0, width: 1200, height: 800 });
    const result = restoreWindowState(window as never, 'main', { state: undefined });
    expect(result.applied).toBe(false);
    expect(window.setBounds).not.toHaveBeenCalled();
  });

  it('falls back to defaults when saved bounds are too small', () => {
    const window = createMockWindow({ x: 0, y: 0, width: 1200, height: 800 });
    const result = restoreWindowState(window as never, 'main', {
      state: {
        normalBounds: { x: 10, y: 10, width: 10, height: 10 },
        displayState: 'normal',
      },
    });
    expect(result.applied).toBe(false);
    expect(window.setBounds).not.toHaveBeenCalled();
  });

  it('falls back to defaults when saved bounds are offscreen', () => {
    screenMock.getAllDisplays.mockReturnValue([
      { bounds: { x: 0, y: 0, width: 1000, height: 1000 }, workArea: { x: 0, y: 0, width: 1000, height: 1000 } },
    ]);
    const window = createMockWindow({ x: 0, y: 0, width: 1200, height: 800 });
    const result = restoreWindowState(window as never, 'main', {
      state: {
        normalBounds: { x: 5000, y: 5000, width: 800, height: 600 },
        displayState: 'normal',
      },
    });
    expect(result.applied).toBe(false);
    expect(window.setBounds).not.toHaveBeenCalled();
  });
});

describe('window-state-manager attachWindowStateHandlers', () => {
  it('persists normal bounds on user-driven resize using the canonical store', () => {
    const window = createMockWindow({ x: 100, y: 100, width: 800, height: 600 });
    const savedSpy = vi.fn();

    attachWindowStateHandlers(window as never, 'main', { onSave: savedSpy });

    window.trigger('resize');
    expect(savedSpy).toHaveBeenCalledTimes(1);
    const captured = savedSpy.mock.calls[0]?.[0] as WindowStateSnapshot;
    expect(captured.normalBounds.width).toBe(800);
  });

  it('persists normal bounds on move, maximize, unmaximize, fullscreen, leave-fullscreen, and close', () => {
    const window = createMockWindow({ x: 100, y: 100, width: 800, height: 600 });
    const savedSpy = vi.fn();

    attachWindowStateHandlers(window as never, 'main', { onSave: savedSpy });

    for (const event of ['move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'close']) {
      window.trigger(event);
    }
    expect(savedSpy).toHaveBeenCalledTimes(6);
  });

  it('skips capture while the window is minimized', () => {
    const window = createMockWindow({ x: 100, y: 100, width: 800, height: 600 });
    window.isMinimized.mockReturnValue(true);
    const savedSpy = vi.fn();

    attachWindowStateHandlers(window as never, 'main', { onSave: savedSpy });
    window.trigger('resize');
    expect(savedSpy).not.toHaveBeenCalled();
  });

  it('returns a dispose function that stops further saves', () => {
    const window = createMockWindow({ x: 100, y: 100, width: 800, height: 600 });
    const savedSpy = vi.fn();

    const dispose = attachWindowStateHandlers(window as never, 'main', { onSave: savedSpy });
    dispose();
    window.trigger('resize');
    expect(savedSpy).not.toHaveBeenCalled();
  });

  it('round-trips a captured state through the canonical layout store', () => {
    saveWindowLayoutSettings({
      ...loadWindowLayoutSettings(),
      windows: {
        main: {
          normalBounds: { x: 80, y: 90, width: 1200, height: 800 },
          displayState: 'normal',
        },
      },
    });

    const window = createMockWindow({ x: 0, y: 0, width: 800, height: 600 });
    const result = restoreWindowState(window as never, 'main');
    expect(result.applied).toBe(true);
    expect(window.setBounds).toHaveBeenCalledWith({ x: 80, y: 90, width: 1200, height: 800 });
  });
});
