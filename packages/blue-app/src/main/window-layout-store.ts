/**
 * Main-process durable layout store.
 *
 * Reads and writes the canonical window layout snapshot through the existing
 * app-wide program settings file. Reset persists defaults and broadcasts a
 * `window-layout:reset` IPC event to every active renderer window so the
 * workbench and split surfaces can return to defaults immediately.
 */

import { BrowserWindow } from 'electron';
import {
  applyWindowLayoutUpdate,
  createDefaultWindowLayoutSettings,
  mergeWindowLayoutSettings,
  resetWindowLayoutSettings,
  WINDOW_LAYOUT_RESET_CHANNEL,
  type WindowLayoutSettingsSnapshot,
  type WindowLayoutUpdateRequest,
} from '../shared/window-layout-settings';
import { loadProgramSettings, saveProgramSettings } from './program-settings-store';

export { WINDOW_LAYOUT_RESET_CHANNEL };

let currentSessionResetHandler: (() => void) | null = null;

export function setCurrentSessionWindowResetHandler(handler: (() => void) | null): void {
  currentSessionResetHandler = handler;
}

export function loadWindowLayoutSettings(): WindowLayoutSettingsSnapshot {
  const settings = loadProgramSettings();
  return settings.appSpecific.windowLayout ?? createDefaultWindowLayoutSettings();
}

export function saveWindowLayoutSettings(
  layout: WindowLayoutSettingsSnapshot,
): WindowLayoutSettingsSnapshot {
  const current = loadProgramSettings();
  // Always re-merge so invalid entries cannot survive a save round-trip.
  const normalized = mergeWindowLayoutSettings(layout);
  const result = saveProgramSettings({
    ...current,
    appSpecific: {
      ...current.appSpecific,
      windowLayout: normalized,
    },
  });

  if (!result.ok || !result.snapshot) {
    throw new Error('Failed to save window layout settings');
  }

  return result.snapshot.appSpecific.windowLayout ?? createDefaultWindowLayoutSettings();
}

export function updateWindowLayout(
  request: WindowLayoutUpdateRequest,
): WindowLayoutSettingsSnapshot {
  const current = loadWindowLayoutSettings();
  const next = applyWindowLayoutUpdate(current, request);
  return saveWindowLayoutSettings(next);
}

export function resetWindowLayout(): WindowLayoutSettingsSnapshot {
  const reset = resetWindowLayoutSettings();
  const next = saveWindowLayoutSettings(reset);
  currentSessionResetHandler?.();
  broadcastWindowLayoutReset();
  return next;
}

export function broadcastWindowLayoutReset(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.webContents.send(WINDOW_LAYOUT_RESET_CHANNEL);
  }
}
