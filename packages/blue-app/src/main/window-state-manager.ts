/**
 * BrowserWindow bounds capture/restore helpers.
 *
 * Capture reads the current normal bounds and display state, skipping
 * minimized windows so transient state is not persisted. Restore applies a
 * saved snapshot before the window is shown when its bounds are still valid
 * (finite, large enough, and intersecting an available display work area).
 */

import { screen, type BrowserWindow } from 'electron';
import {
  isValidWindowState,
  type WindowId,
  type WindowBoundsSnapshot,
  type WindowStateSnapshot,
  type DisplayWorkArea,
} from '../shared/window-layout-settings';
import { loadWindowLayoutSettings, updateWindowLayout } from './window-layout-store';

export interface WindowStateRestoreResult {
  applied: boolean;
  state: WindowStateSnapshot | null;
}

const SAVE_EVENTS = [
  'resize',
  'move',
  'maximize',
  'unmaximize',
  'enter-full-screen',
  'leave-full-screen',
  'close',
] as const;

const DEFAULT_WINDOW_SIZES: Record<WindowId, { width: number; height: number }> = {
  main: { width: 1200, height: 800 },
  settings: { width: 800, height: 600 },
  'effect-editor': { width: 1100, height: 820 },
  'effect-interface': { width: 460, height: 560 },
  'track-instrument-editor': { width: 1000, height: 760 },
};

const trackedWindowIds = new WeakMap<BrowserWindow, WindowId>();

export function attachWindowStateHandlers(
  window: BrowserWindow,
  windowId: WindowId,
  options: {
    onSave?: (state: WindowStateSnapshot) => void;
  } = {},
): () => void {
  trackedWindowIds.set(window, windowId);

  const handleSave = () => {
    if (window.isDestroyed()) return;
    const state = captureWindowState(window);
    if (!state) return;

    if (options.onSave) {
      options.onSave(state);
    } else {
      try {
        updateWindowLayout({ type: 'window-state', windowId, state });
      } catch {
        // Program settings save failed; main process logs the error elsewhere.
      }
    }
  };

  const disposers: Array<() => void> = [];
  // Electron's BrowserWindow.on() overloads are per-event-type; cast to the
  // generic listener signature so a single loop can subscribe to all of the
  // user-driven layout-change events.
  const onEvent = window.on.bind(window) as unknown as (
    event: (typeof SAVE_EVENTS)[number],
    listener: () => void,
  ) => void;
  const removeEvent = window.removeListener.bind(window) as unknown as (
    event: (typeof SAVE_EVENTS)[number],
    listener: () => void,
  ) => void;

  for (const event of SAVE_EVENTS) {
    onEvent(event, handleSave);
    disposers.push(() => {
      try {
        removeEvent(event, handleSave);
      } catch {
        // Window may already be destroyed during shutdown.
      }
    });
  }

  return () => {
    trackedWindowIds.delete(window);
    for (const dispose of disposers) dispose();
  };
}

export function restoreWindowState(
  window: BrowserWindow,
  windowId: WindowId,
  options: {
    state?: WindowStateSnapshot;
  } = {},
): WindowStateRestoreResult {
  const state = options.state ?? loadWindowLayoutSettings().windows[windowId] ?? null;
  if (!state) {
    return { applied: false, state: null };
  }

  const workAreas = safeGetAllDisplays().map((display) => display.workArea);
  if (!isValidWindowState(state, { workAreas })) {
    return { applied: false, state: null };
  }

  try {
    window.setBounds(state.normalBounds);
  } catch {
    return { applied: false, state };
  }

  if (state.displayState === 'maximized' && !window.isMaximized()) {
    try {
      window.maximize();
    } catch {
      // Ignore — restoring normal bounds is the priority.
    }
  } else if (state.displayState === 'fullscreen' && !window.isFullScreen()) {
    try {
      window.setFullScreen(true);
    } catch {
      // Ignore — restoring normal bounds is the priority.
    }
  }

  return { applied: true, state };
}

export function captureWindowState(window: BrowserWindow): WindowStateSnapshot | null {
  if (window.isDestroyed() || window.isMinimized()) return null;

  const isMaximized = window.isMaximized();
  const isFullScreen = window.isFullScreen();
  const displayState: WindowStateSnapshot['displayState'] = isFullScreen
    ? 'fullscreen'
    : isMaximized
      ? 'maximized'
      : 'normal';

  // getNormalBounds returns the pre-maximize/pre-fullscreen bounds on platforms
  // where Electron tracks it. We fall back to the live bounds when the platform
  // does not provide a separate normal bounds (e.g. Linux without a window
  // manager hint).
  let normalBounds: WindowStateSnapshot['normalBounds'];
  try {
    normalBounds = isMaximized || isFullScreen
      ? (window.getNormalBounds?.() ?? window.getBounds())
      : window.getBounds();
  } catch {
    normalBounds = window.getBounds();
  }

  return {
    normalBounds: {
      x: Math.round(normalBounds.x),
      y: Math.round(normalBounds.y),
      width: Math.round(normalBounds.width),
      height: Math.round(normalBounds.height),
    },
    displayState,
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultWindowBounds(windowId: WindowId): WindowBoundsSnapshot {
  const displays = safeGetAllDisplays();
  const workArea = displays[0]?.workArea ?? { x: 0, y: 0, width: 1440, height: 900 };
  const defaultSize = DEFAULT_WINDOW_SIZES[windowId];
  const width = Math.min(defaultSize.width, workArea.width);
  const height = Math.min(defaultSize.height, workArea.height);
  return {
    x: Math.round(workArea.x + Math.max(0, (workArea.width - width) / 2)),
    y: Math.round(workArea.y + Math.max(0, (workArea.height - height) / 2)),
    width,
    height,
  };
}

/**
 * Returns copies of the currently connected display work areas for renderer
 * layout restoration. Keeping the screen query in main is required because a
 * renderer's viewport only describes its current window, not all displays.
 */
export function getAvailableDisplayWorkAreas(): DisplayWorkArea[] {
  return safeGetAllDisplays().map(({ workArea }) => ({ ...workArea }));
}

export function resetWindowToDefaultBounds(
  window: BrowserWindow,
  windowId: WindowId,
): boolean {
  if (window.isDestroyed()) return false;

  try {
    if (window.isFullScreen()) {
      window.setFullScreen(false);
    }
  } catch {
    // Continue with bounds restore when leaving fullscreen is unsupported.
  }

  try {
    if (window.isMaximized()) {
      (window as BrowserWindow & { unmaximize?: () => void }).unmaximize?.();
    }
  } catch {
    // Continue with bounds restore when unmaximize is unsupported.
  }

  try {
    window.setBounds(getDefaultWindowBounds(windowId));
    return true;
  } catch {
    return false;
  }
}

export function resetTrackedWindowsToDefaultBounds(
  windows: BrowserWindow[],
): number {
  let resetCount = 0;
  for (const window of windows) {
    const windowId = trackedWindowIds.get(window);
    if (!windowId) continue;
    if (resetWindowToDefaultBounds(window, windowId)) {
      resetCount += 1;
    }
  }
  return resetCount;
}

function safeGetAllDisplays() {
  try {
    return screen.getAllDisplays();
  } catch {
    return [];
  }
}
