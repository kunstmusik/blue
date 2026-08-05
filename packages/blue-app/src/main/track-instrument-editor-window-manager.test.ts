import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  broadcastProjectDocumentUpdateToTrackInstrumentWindows,
  closeTrackInstrumentEditorWindows,
  closeTrackInstrumentEditorWindowsForGroup,
  openTrackInstrumentEditorWindow,
} from './track-instrument-editor-window-manager';
import { PROJECT_DOCUMENT_UPDATED_CHANNEL } from '../shared/workbench-window-contract';

const electronMock = vi.hoisted(() => {
  const instances: MockBrowserWindow[] = [];

  class MockBrowserWindow {
    readonly options: Record<string, unknown>;
    readonly webContents = { send: vi.fn() };
    destroyed = false;
    focus = vi.fn();
    show = vi.fn();
    loadURL = vi.fn();
    isDestroyed = vi.fn(() => this.destroyed);
    isMaximized = vi.fn(() => false);
    isFullScreen = vi.fn(() => false);
    isMinimized = vi.fn(() => false);
    getBounds = vi.fn(() => ({ x: 100, y: 100, width: 1000, height: 760 }));
    getNormalBounds = vi.fn(() => ({ x: 100, y: 100, width: 1000, height: 760 }));
    setBounds = vi.fn();
    on = vi.fn((_event: string, _handler: () => void) => this);
    once = vi.fn((_event: string, _handler: () => void) => this);
    removeListener = vi.fn();
    close = vi.fn(() => { this.destroyed = true; });

    constructor(options: Record<string, unknown>) {
      this.options = options;
      instances.push(this);
    }
  }

  return { instances, MockBrowserWindow };
});

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: electronMock.MockBrowserWindow,
  screen: {
    getAllDisplays: () => [{
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    }],
  },
}));

describe('Track instrument editor window manager', () => {
  beforeEach(() => {
    electronMock.instances.length = 0;
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173/';
  });

  afterEach(() => {
    closeTrackInstrumentEditorWindows();
    delete process.env.VITE_DEV_SERVER_URL;
    vi.clearAllMocks();
  });

  it('reuses one floating native window per stable Track target and broadcasts updates', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const request = {
      track: {
        rootGroupId: 'group-1',
        trackId: 'track-1',
        projectSessionId: 3,
        projectRevision: 4,
      },
    };

    const first = openTrackInstrumentEditorWindow(mainWindow, request);
    const second = openTrackInstrumentEditorWindow(mainWindow, request);

    expect(first).toBe(second);
    expect(electronMock.instances).toHaveLength(1);
    expect(electronMock.instances[0]!.options.parent).toBe(mainWindow);
    expect(electronMock.instances[0]!.options.frame).toBe(true);
    expect(electronMock.instances[0]!.options.modal).toBe(false);
    expect(electronMock.instances[0]!.options.show).toBe(false);
    expect(electronMock.instances[0]!.options.alwaysOnTop).toBe(true);
    expect(String(electronMock.instances[0]!.loadURL.mock.calls[0]?.[0]))
      .toContain('rootGroupId=group-1');
    expect(electronMock.instances[0]!.focus).toHaveBeenCalledTimes(1);

    const event = { sessionId: 3, revision: 5, snapshot: {} } as never;
    broadcastProjectDocumentUpdateToTrackInstrumentWindows(event);
    expect(electronMock.instances[0]!.webContents.send).toHaveBeenCalledWith(
      PROJECT_DOCUMENT_UPDATED_CHANNEL,
      event,
    );
  });

  it('closes every editor attached to a removed Track group', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const fence = { projectSessionId: 3, projectRevision: 4 };
    openTrackInstrumentEditorWindow(mainWindow, { track: { rootGroupId: 'group-1', trackId: 'track-1', ...fence } });
    openTrackInstrumentEditorWindow(mainWindow, { track: { rootGroupId: 'group-1', trackId: 'track-2', ...fence } });
    openTrackInstrumentEditorWindow(mainWindow, { track: { rootGroupId: 'group-2', trackId: 'track-1', ...fence } });

    closeTrackInstrumentEditorWindowsForGroup('group-1');

    expect(electronMock.instances[0]!.close).toHaveBeenCalledTimes(1);
    expect(electronMock.instances[1]!.close).toHaveBeenCalledTimes(1);
    expect(electronMock.instances[2]!.close).not.toHaveBeenCalled();
  });

  it('does not reuse an editor target across project sessions', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const target = { rootGroupId: 'group-1', trackId: 'track-1', projectRevision: 4 };

    openTrackInstrumentEditorWindow(mainWindow, {
      track: { ...target, projectSessionId: 3 },
    });
    openTrackInstrumentEditorWindow(mainWindow, {
      track: { ...target, projectSessionId: 5 },
    });

    expect(electronMock.instances).toHaveLength(2);
  });
});
