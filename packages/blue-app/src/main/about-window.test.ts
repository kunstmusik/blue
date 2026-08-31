import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeAboutWindow, openAboutWindow } from './about-window';

const electronMock = vi.hoisted(() => {
  const instances: MockBrowserWindow[] = [];

  class MockBrowserWindow {
    options: Record<string, unknown>;
    destroyed = false;
    bounds = { x: 100, y: 80, width: 520, height: 460 };
    webContents: {
      getZoomFactor: () => number;
    };
    show = vi.fn();
    focus = vi.fn();
    center = vi.fn();
    loadURL = vi.fn();
    loadFile = vi.fn();
    setSize = vi.fn((width: number, height: number) => {
      this.bounds = { ...this.bounds, width, height };
    });
    once = vi.fn((event: string, handler: () => void) => {
      if (event === 'ready-to-show') this.readyToShowHandler = handler;
    });
    on = vi.fn((event: string, handler: () => void) => {
      if (event === 'closed') this.closedHandler = handler;
    });
    close = vi.fn(() => {
      this.destroyed = true;
      this.closedHandler?.();
    });
    isDestroyed = vi.fn(() => this.destroyed);
    getBounds = vi.fn(() => this.bounds);
    getContentBounds = vi.fn(() => ({
      ...this.bounds,
      height: this.bounds.height - 28,
    }));

    private readyToShowHandler?: () => void;
    private closedHandler?: () => void;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      const webPreferences = options.webPreferences as { zoomFactor?: number };
      this.webContents = {
        getZoomFactor: () => webPreferences.zoomFactor ?? 1,
      };
      instances.push(this);
    }

    triggerReadyToShow(): void {
      this.readyToShowHandler?.();
    }
  }

  return { instances, MockBrowserWindow };
});

vi.mock('electron', () => ({
  BrowserWindow: electronMock.MockBrowserWindow,
  screen: {
    getDisplayMatching: () => ({
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
    }),
  },
}));

beforeEach(() => {
  electronMock.instances.length = 0;
  delete process.env.VITE_DEV_SERVER_URL;
});

afterEach(() => {
  const currentWindow = electronMock.instances.at(-1);
  if (currentWindow && !currentWindow.destroyed) {
    closeAboutWindow(currentWindow.webContents as never);
  }
  vi.clearAllMocks();
});

describe('about window', () => {
  it('caps zoomed dimensions to the display work area before showing', () => {
    const mainWindow = { isDestroyed: () => false } as never;
    openAboutWindow(mainWindow, { initialZoomFactor: 3 });

    const window = electronMock.instances[0]!;
    window.triggerReadyToShow();

    expect(window.options.backgroundColor).toBe('#1a1a2e');
    expect(window.setSize).toHaveBeenCalledWith(1408, 868);
    expect(window.center).toHaveBeenCalledTimes(1);
    expect(window.show).toHaveBeenCalledTimes(1);
  });

  it('sizes the frame for the base content area at normal zoom', () => {
    const mainWindow = { isDestroyed: () => false } as never;
    openAboutWindow(mainWindow, { initialZoomFactor: 1 });

    const window = electronMock.instances[0]!;
    window.triggerReadyToShow();

    expect(window.setSize).toHaveBeenCalledWith(520, 488);
  });

  it('reuses the existing window and only accepts its sender when closing', () => {
    const mainWindow = { isDestroyed: () => false } as never;
    const first = openAboutWindow(mainWindow);
    const second = openAboutWindow(mainWindow);

    expect(second).toBe(first);
    expect(electronMock.instances).toHaveLength(1);
    expect(electronMock.instances[0]!.focus).toHaveBeenCalledTimes(1);
    expect(closeAboutWindow({} as never)).toBe(false);
    expect(closeAboutWindow(electronMock.instances[0]!.webContents as never)).toBe(true);
  });
});
