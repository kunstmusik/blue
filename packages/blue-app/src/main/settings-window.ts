import { BrowserWindow } from 'electron';
import * as path from 'path';
import {
  attachWindowStateHandlers,
  restoreWindowState,
} from './window-state-manager';

let settingsWindow: BrowserWindow | null = null;
let disposeStateHandlers: (() => void) | null = null;

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

  const useSheetModal = process.platform !== 'darwin';

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
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
    settingsWindow = null;
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
    settingsWindow.close();
    settingsWindow = null;
  }
  disposeStateHandlers?.();
  disposeStateHandlers = null;
}
