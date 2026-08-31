import { BrowserWindow } from 'electron';
import * as path from 'path';
import {
  attachWindowStateHandlers,
  restoreWindowState,
} from './window-state-manager';
import {
  SETTINGS_CLOSE_REQUEST_CHANNEL,
  type SettingsCloseResolution,
} from '../shared/settings-window';

let settingsWindow: BrowserWindow | null = null;
let disposeStateHandlers: (() => void) | null = null;
let closeRequestPending = false;
let allowNextClose = false;

export interface OpenSettingsWindowOptions {
  /**
   * Initial Chromium/Electron page zoom factor (`percent / 100`) applied
   * before the Settings renderer becomes visible (SPEC 061). When omitted
   * the controller-owned factor is still applied via the early
   * `browser-window-created` listener, but passing it declaratively gives
   * Settings windows the same first-paint guarantee as the main window.
   */
  initialZoomFactor?: number;
}

export function openSettingsWindow(
  mainWindow: BrowserWindow,
  options: OpenSettingsWindowOptions = {},
): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  closeRequestPending = false;
  allowNextClose = false;

  const useSheetModal = process.platform !== 'darwin';

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    title: 'Settings',
    parent: mainWindow,
    // On macOS, modal child windows render as sheets (no normal title bar controls).
    // Keep this as a regular child window on macOS so native title bar + close button stay visible.
    modal: useSheetModal,
    frame: true,
    titleBarStyle: 'default',
    show: false,
    minimizable: false,
    maximizable: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      ...(options.initialZoomFactor !== undefined
        ? { zoomFactor: options.initialZoomFactor }
        : {}),
    },
  });

  restoreWindowState(settingsWindow, 'settings');

  disposeStateHandlers?.();
  disposeStateHandlers = attachWindowStateHandlers(settingsWindow, 'settings');

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  settingsWindow.on('closed', () => {
    disposeStateHandlers?.();
    disposeStateHandlers = null;
    closeRequestPending = false;
    allowNextClose = false;
    settingsWindow = null;
  });

  settingsWindow.on('close', (event) => {
    if (allowNextClose) {
      allowNextClose = false;
      return;
    }
    event.preventDefault();
    if (closeRequestPending) return;
    closeRequestPending = true;
    try {
      settingsWindow?.webContents.send(SETTINGS_CLOSE_REQUEST_CHANNEL);
    } catch {
      // If the renderer has already gone away, there is no draft left to
      // protect. Allow the native window to finish closing.
      resolveSettingsWindowClose('allow');
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const devBase = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '');
    settingsWindow.loadURL(`${devBase}/settings.html`);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  }
}

export function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    allowNextClose = true;
    settingsWindow.close();
    settingsWindow = null;
  }
  closeRequestPending = false;
  disposeStateHandlers?.();
  disposeStateHandlers = null;
}

/** Resolve a renderer-originated close request after the draft is handled. */
export function resolveSettingsWindowClose(resolution: SettingsCloseResolution): void {
  if (!settingsWindow || settingsWindow.isDestroyed() || !closeRequestPending) return;
  closeRequestPending = false;
  if (resolution !== 'allow') return;
  allowNextClose = true;
  settingsWindow.close();
}
