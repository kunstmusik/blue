import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  broadcastProjectDocumentUpdateToEffectWindows,
  closeEffectEditorWindow,
  closeEffectEditorWindowsForOwner,
  openEffectEditorWindow,
  openEffectInterfaceWindow,
} from './effect-editor-window-manager';
import {
  PROJECT_DOCUMENT_UPDATED_CHANNEL,
  type ProjectDocumentUpdatedEvent,
} from '../shared/workbench-window-contract';
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
    getBounds = vi.fn(() => ({ x: 320, y: 240, width: 900, height: 700 }));
    getNormalBounds = vi.fn(() => ({ x: 320, y: 240, width: 900, height: 700 }));
    setBounds = vi.fn();
    setContentSize = vi.fn();
    webContents: {
      send: ReturnType<typeof vi.fn>;
      getZoomFactor: ReturnType<typeof vi.fn>;
      setZoomFactor: ReturnType<typeof vi.fn>;
    };

    private readyToShowHandler?: () => void;
    private closedHandler?: () => void;
    eventHandlers: Record<string, () => void> = {};

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.webContents = {
        send: vi.fn(),
        getZoomFactor: vi.fn(() => 1),
        setZoomFactor: vi.fn(),
      };
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
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-effect-window-test-'));
  setSettingsFilePathForTesting(path.join(tempDir, 'program-settings.json'));
  clearSettingsCache();
  closeEffectEditorWindowsForOwner('project');
  closeEffectEditorWindowsForOwner('library');
  electronMock.instances.length = 0;
  process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173/';
});

afterEach(() => {
  closeEffectEditorWindowsForOwner('project');
  closeEffectEditorWindowsForOwner('library');
  fs.rmSync(tempDir, { recursive: true, force: true });
  clearSettingsCache();
  delete process.env.VITE_DEV_SERVER_URL;
  vi.clearAllMocks();
});

describe('effect editor window manager', () => {
  it('reuses the same project window when the effect is reopened', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const request = {
      ownerType: 'project' as const,
      effectId: 'effect-1',
      projectRef: {
        channelId: 'channel-1',
        chain: 'pre' as const,
        entryId: 'effect-1',
      },
    };

    openEffectEditorWindow(mainWindow, request);
    expect(electronMock.instances).toHaveLength(1);

    const firstWindow = electronMock.instances[0]!;
    expect(String(firstWindow.loadURL.mock.calls[0]?.[0])).toContain('effect-editor.html');

    openEffectEditorWindow(mainWindow, request);
    expect(firstWindow.focus).toHaveBeenCalledTimes(1);
    expect(electronMock.instances).toHaveLength(1);
  });

  it('keeps project and library editor windows separate', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const projectRequest = {
      ownerType: 'project' as const,
      effectId: 'effect-1',
      projectRef: {
        channelId: 'channel-1',
        chain: 'pre' as const,
        entryId: 'effect-1',
      },
    };
    const libraryRequest = {
      ownerType: 'library' as const,
      effectId: 'effect-1',
      libraryRef: {
        libraryEffectId: 'effect-1',
      },
    };

    openEffectEditorWindow(mainWindow, projectRequest);
    openEffectEditorWindow(mainWindow, libraryRequest);

    expect(electronMock.instances).toHaveLength(2);

    closeEffectEditorWindowsForOwner('project');
    expect(electronMock.instances[0]?.close).toHaveBeenCalledTimes(1);
    expect(electronMock.instances[1]?.close).not.toHaveBeenCalled();

    closeEffectEditorWindow(libraryRequest);
    expect(electronMock.instances[1]?.close).toHaveBeenCalledTimes(1);
  });

  it('routes project document updates to open project effect windows but not library windows (US4)', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const projectRequest = {
      ownerType: 'project' as const,
      effectId: 'fx-proj',
      projectRef: { channelId: 'ch-1', chain: 'pre' as const, entryId: 'fx-proj' },
    };
    const libraryRequest = {
      ownerType: 'library' as const,
      effectId: 'fx-lib',
      libraryRef: { libraryEffectId: 'fx-lib' },
    };

    openEffectEditorWindow(mainWindow, projectRequest);
    openEffectEditorWindow(mainWindow, libraryRequest);

    const projectWindow = electronMock.instances[0]!;
    const libraryWindow = electronMock.instances[1]!;

    const projectUdos = [
      {
        name: 'RenamedGlobal',
        style: 'CLASSIC' as const,
        outTypes: 'a',
        inTypes: 'a',
        inputArguments: '',
        code: '',
        comments: '',
      },
    ];
    const event = {
      sessionId: 3,
      revision: 9,
      snapshot: { projectUdos },
    } as ProjectDocumentUpdatedEvent;
    broadcastProjectDocumentUpdateToEffectWindows(event);

    expect(projectWindow.webContents.send).toHaveBeenCalledWith(
      PROJECT_DOCUMENT_UPDATED_CHANNEL,
      event,
    );
    expect(libraryWindow.webContents.send).not.toHaveBeenCalled();
  });
});

describe('effect editor and interface layout persistence', () => {
  it('persists effect editor bounds on close under the "effect-editor" identity', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const request = {
      ownerType: 'project' as const,
      effectId: 'effect-1',
      projectRef: { channelId: 'channel-1', chain: 'pre' as const, entryId: 'effect-1' },
    };

    openEffectEditorWindow(mainWindow, request);
    const editorWindow = electronMock.instances[0]!;
    editorWindow.trigger('close');

    const layout = loadWindowLayoutSettings();
    expect(layout.windows['effect-editor']?.normalBounds).toEqual({ x: 320, y: 240, width: 900, height: 700 });
  });

  it('persists effect interface bounds on close under the "effect-interface" identity', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const request = {
      ownerType: 'project' as const,
      effectId: 'effect-2',
      projectRef: { channelId: 'channel-1', chain: 'pre' as const, entryId: 'effect-2' },
    };

    openEffectInterfaceWindow(mainWindow, request, 460, 560);
    const interfaceWindow = electronMock.instances[0]!;
    interfaceWindow.trigger('close');

    const layout = loadWindowLayoutSettings();
    expect(layout.windows['effect-interface']?.normalBounds).toEqual({ x: 320, y: 240, width: 900, height: 700 });
  });

  it('restores effect editor bounds from the canonical store before show', () => {
    saveWindowLayoutSettings({
      ...loadWindowLayoutSettings(),
      windows: {
        'effect-editor': {
          normalBounds: { x: 200, y: 200, width: 1100, height: 820 },
          displayState: 'normal',
        },
      },
    });

    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const request = {
      ownerType: 'project' as const,
      effectId: 'effect-3',
      projectRef: { channelId: 'channel-1', chain: 'pre' as const, entryId: 'effect-3' },
    };

    openEffectEditorWindow(mainWindow, request);
    expect(electronMock.instances[0]?.setBounds).toHaveBeenCalledWith({ x: 200, y: 200, width: 1100, height: 820 });
  });
});

describe('effect editor window declarative zoom factor (SPEC 061)', () => {
  it('passes initialZoomFactor through to the effect editor webPreferences', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const request = {
      ownerType: 'project' as const,
      effectId: 'zoom-edit',
      projectRef: { channelId: 'channel-1', chain: 'pre' as const, entryId: 'zoom-edit' },
    };

    openEffectEditorWindow(mainWindow, request, { initialZoomFactor: 1.4 });

    const editorWindow = electronMock.instances[0]!;
    const webPreferences = editorWindow.options.webPreferences as Record<string, unknown>;
    expect(webPreferences.zoomFactor).toBeCloseTo(1.4, 10);
    expect(webPreferences.contextIsolation).toBe(true);
    expect(webPreferences.nodeIntegration).toBe(false);
    expect(editorWindow.options.modal).toBe(true);
    expect(editorWindow.options.show).toBe(false);
  });

  it('passes initialZoomFactor through to the effect interface webPreferences', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const request = {
      ownerType: 'project' as const,
      effectId: 'zoom-interface',
      projectRef: { channelId: 'channel-1', chain: 'pre' as const, entryId: 'zoom-interface' },
    };

    openEffectInterfaceWindow(mainWindow, request, 460, 560, { initialZoomFactor: 0.8 });

    const interfaceWindow = electronMock.instances[0]!;
    const webPreferences = interfaceWindow.options.webPreferences as Record<string, unknown>;
    expect(webPreferences.zoomFactor).toBeCloseTo(0.8, 10);
    expect(webPreferences.contextIsolation).toBe(true);
    expect(webPreferences.nodeIntegration).toBe(false);
    expect(interfaceWindow.options.alwaysOnTop).toBe(true);
    expect(interfaceWindow.options.show).toBe(false);
  });

  it('omits zoomFactor when initialZoomFactor is not provided', () => {
    const mainWindow = { isDestroyed: vi.fn(() => false) } as never;
    const request = {
      ownerType: 'project' as const,
      effectId: 'no-zoom',
      projectRef: { channelId: 'channel-1', chain: 'pre' as const, entryId: 'no-zoom' },
    };

    openEffectEditorWindow(mainWindow, request);

    const editorWindow = electronMock.instances[0]!;
    const webPreferences = editorWindow.options.webPreferences as Record<string, unknown>;
    expect(webPreferences.zoomFactor).toBeUndefined();
    expect(webPreferences.devTools).toBe(true);
  });
});
