import { BrowserWindow, screen, type NativeImage, type WebContents } from 'electron';
import * as path from 'node:path';

let aboutWindow: BrowserWindow | null = null;

/**
 * Base content size for the About window at zoom factor 1.0. The window grows
 * with the zoom factor until it reaches the current display's work area; the
 * renderer scrolls when the full scaled layout no longer fits.
 */
const ABOUT_BASE_CONTENT_WIDTH = 520;
const ABOUT_BASE_CONTENT_HEIGHT = 460;
const ABOUT_WORK_AREA_MARGIN = 32;

export interface AboutWindowOptions {
  initialZoomFactor?: number;
  icon?: NativeImage;
}

function applyAboutContentSize(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  let factor = 1;
  try {
    factor = window.webContents.getZoomFactor();
  } catch {
    factor = 1;
  }
  if (!Number.isFinite(factor) || factor <= 0) factor = 1;

  const bounds = window.getBounds();
  const contentBounds = window.getContentBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;
  const frameWidth = Math.max(0, bounds.width - contentBounds.width);
  const frameHeight = Math.max(0, bounds.height - contentBounds.height);
  const width = Math.min(
    Math.round(ABOUT_BASE_CONTENT_WIDTH * factor) + frameWidth,
    workArea.width - ABOUT_WORK_AREA_MARGIN,
  );
  const height = Math.min(
    Math.round(ABOUT_BASE_CONTENT_HEIGHT * factor) + frameHeight,
    workArea.height - ABOUT_WORK_AREA_MARGIN,
  );

  window.setSize(width, height);
  window.center();
}

export function openAboutWindow(
  mainWindow: BrowserWindow | null,
  options: AboutWindowOptions = {},
): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return aboutWindow;
  }

  aboutWindow = new BrowserWindow({
    width: ABOUT_BASE_CONTENT_WIDTH,
    height: ABOUT_BASE_CONTENT_HEIGHT,
    backgroundColor: '#1a1a2e',
    center: true,
    title: 'About Blue',
    icon: options.icon,
    parent: mainWindow,
    modal: true,
    frame: true,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      ...(options.initialZoomFactor !== undefined ? { zoomFactor: options.initialZoomFactor } : {}),
    },
  });

  const currentWindow = aboutWindow;
  currentWindow.once('ready-to-show', () => {
    if (currentWindow.isDestroyed()) return;
    // Size the content area for the initial zoom factor before the first
    // paint so the user never sees a clipped frame.
    applyAboutContentSize(currentWindow);
    currentWindow.show();
  });
  currentWindow.on('closed', () => {
    if (aboutWindow === currentWindow) {
      aboutWindow = null;
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const devBase = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '');
    void currentWindow.loadURL(`${devBase}/about.html`);
  } else {
    void currentWindow.loadFile(path.join(__dirname, '..', 'renderer', 'about.html'));
  }

  return currentWindow;
}

/**
 * Re-sizes the About window for its current zoom factor and
 * re-centers it on its parent. Safe to call after each app-zoom command
 * while the About window is open; a no-op when it is closed.
 */
export function syncAboutWindowZoom(): void {
  if (!aboutWindow || aboutWindow.isDestroyed()) return;
  applyAboutContentSize(aboutWindow);
}

export function closeAboutWindow(sender: WebContents): boolean {
  if (!aboutWindow || aboutWindow.isDestroyed() || aboutWindow.webContents !== sender) {
    return false;
  }

  aboutWindow.close();
  return true;
}
